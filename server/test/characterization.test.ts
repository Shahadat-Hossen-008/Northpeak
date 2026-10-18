process.env.NODE_ENV = "test";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../src/index.ts";
import { User } from "../src/models/User.ts";
import { Project } from "../src/models/Project.ts";
import { Task } from "../src/models/Task.ts";
import { Subtask } from "../src/models/Subtask.ts";
import { Comment } from "../src/models/Comment.ts";
import { Notification } from "../src/models/Notification.ts";
import { Activity } from "../src/models/Activity.ts";
import { generateToken } from "../src/middleware/auth.ts";

let replSet: MongoMemoryReplSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri());
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

// Helper for test fixtures
async function createFixtures() {
  const manager = await User.create({
    name: "Nadia Manager",
    email: "nadia@test.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const dev = await User.create({
    name: "Sarah Dev",
    email: "sarah@test.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const otherDev = await User.create({
    name: "John Other",
    email: "john@test.dev",
    passwordHash: "hash",
    role: "developer",
  });

  const managerToken = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });
  const devToken = generateToken({
    id: dev._id.toString(),
    email: dev.email,
    role: "developer",
    name: dev.name,
  });
  const otherDevToken = generateToken({
    id: otherDev._id.toString(),
    email: otherDev.email,
    role: "developer",
    name: otherDev.name,
  });

  const project = await Project.create({
    title: "E-Commerce",
    description: "Main marketplace project",
    manager: manager._id,
    team: [dev._id],
    priority: "high",
  });

  const task = await Task.create({
    project: project._id,
    title: "Auth Module",
    description: "JWT logic",
    assignedDeveloper: dev._id,
    priority: "high",
    status: "in_progress",
    isCompleted: false,
  });

  const subtask = await Subtask.create({
    task: task._id,
    title: "Unit Tests",
    isCompleted: false,
  });

  const comment = await Comment.create({
    task: task._id,
    author: dev._id,
    body: "Working on tests",
  });

  const notification = await Notification.create({
    recipient: dev._id,
    kind: "task_assigned",
    title: "Assigned Auth",
    body: "Please implement auth",
    isRead: false,
  });

  const activity = await Activity.create({
    project: project._id,
    task: task._id,
    actor: dev._id,
    message: "started work",
  });

  return {
    manager,
    dev,
    otherDev,
    managerToken,
    devToken,
    otherDevToken,
    project,
    task,
    subtask,
    comment,
    notification,
    activity,
  };
}

// ---------------------------------------------------------------------------
// 1-4: Auth Endpoints
// ---------------------------------------------------------------------------
test("CHAR-AUTH: POST /api/auth/register success, validation errors, and activity side effect", async () => {
  // Success
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "New User", email: "new@test.dev", password: "password123" });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, "developer");

  // Verify Activity side effect
  const joinActivity = await Activity.findOne({
    actor: res.body.user.id,
    message: "joined Northpeak as developer",
  });
  assert.ok(joinActivity, "Registration must record a joined Northpeak activity");

  // Validation: missing fields
  const missing = await request(app).post("/api/auth/register").send({});
  assert.equal(missing.status, 400);
  assert.match(missing.body.message, /Name, email, and password are required/);

  // Validation: short password
  const shortPass = await request(app)
    .post("/api/auth/register")
    .send({ name: "A", email: "a@b.com", password: "123" });
  assert.equal(shortPass.status, 400);
  assert.match(shortPass.body.message, /Password must be at least 6 characters/);

  // Validation: duplicate email
  const duplicate = await request(app)
    .post("/api/auth/register")
    .send({ name: "Duplicate", email: "new@test.dev", password: "password123" });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.message, /Email is already registered/);
});

test("CHAR-AUTH: POST /api/auth/login success, 400, 401", async () => {
  const { dev } = await createFixtures();
  const { default: bcrypt } = await import("bcryptjs");
  dev.passwordHash = await bcrypt.hash("secret123", 10);
  await dev.save();

  // Success
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "sarah@test.dev", password: "secret123" });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);

  // 400 missing fields
  const empty = await request(app).post("/api/auth/login").send({});
  assert.equal(empty.status, 400);

  // 401 bad password
  const badPass = await request(app)
    .post("/api/auth/login")
    .send({ email: "sarah@test.dev", password: "wrong" });
  assert.equal(badPass.status, 401);

  // 401 non-existent user
  const noUser = await request(app)
    .post("/api/auth/login")
    .send({ email: "unknown@test.dev", password: "secret123" });
  assert.equal(noUser.status, 401);
});

test("CHAR-AUTH: GET /api/auth/me success, 401", async () => {
  const { devToken } = await createFixtures();

  // 401 without token
  const noToken = await request(app).get("/api/auth/me");
  assert.equal(noToken.status, 401);

  // 200 with token
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${devToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, "sarah@test.dev");
});

test("CHAR-AUTH: PATCH /api/auth/profile success, 401, 400", async () => {
  const { devToken } = await createFixtures();

  // 401 without token
  const noToken = await request(app).patch("/api/auth/profile").send({ name: "Updated" });
  assert.equal(noToken.status, 401);

  // 200 success
  const res = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${devToken}`)
    .send({ name: "Sarah Updated" });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Sarah Updated");

  // 400 short password
  const shortPass = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${devToken}`)
    .send({ password: "123" });
  assert.equal(shortPass.status, 400);
});

// ---------------------------------------------------------------------------
// 5-7: Members Endpoints
// ---------------------------------------------------------------------------
test("CHAR-MEMBERS: GET /api/members, /:id, /:id/workload success, 401, 400", async () => {
  const { dev, devToken, project } = await createFixtures();

  // 401 without token
  assert.equal((await request(app).get("/api/members")).status, 401);
  assert.equal((await request(app).get(`/api/members/${dev._id}`)).status, 401);
  assert.equal((await request(app).get(`/api/members/${dev._id}/workload`)).status, 401);

  // 200 list all
  const list = await request(app).get("/api/members").set("Authorization", `Bearer ${devToken}`);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body));

  // 200 single member
  const single = await request(app)
    .get(`/api/members/${dev._id}`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(single.status, 200);
  assert.equal(single.body.name, "Sarah Dev");

  // 200 workload
  const workload = await request(app)
    .get(`/api/members/${dev._id}/workload`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(workload.status, 200);
  assert.ok(workload.body.stats);

  // 400 invalid member ID
  const badId = await request(app)
    .get("/api/members/not-an-id")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(badId.status, 400);
});

// ---------------------------------------------------------------------------
// 8-13: Projects Endpoints
// ---------------------------------------------------------------------------
test("CHAR-PROJECTS: GET, POST, PATCH, DELETE /api/projects success, 401, 403, 404", async () => {
  const { managerToken, devToken, project, manager } = await createFixtures();
  const otherManager = await User.create({
    name: "Other Manager", email: "other-project-manager@test.dev", passwordHash: "hash", role: "manager",
  });
  const otherManagerToken = generateToken({
    id: otherManager._id.toString(), email: otherManager.email, role: "manager", name: otherManager.name,
  });
  const otherProject = await Project.create({
    title: "Other Manager Project", manager: otherManager._id, team: [], priority: "low",
  });

  // 401 without token
  assert.equal((await request(app).get("/api/projects")).status, 401);
  assert.equal((await request(app).get(`/api/projects/${project._id}`)).status, 401);
  assert.equal((await request(app).get(`/api/projects/${project._id}/members`)).status, 401);
  assert.equal((await request(app).post("/api/projects").send({ title: "Test" })).status, 401);
  assert.equal((await request(app).patch(`/api/projects/${project._id}`)).status, 401);
  assert.equal((await request(app).delete(`/api/projects/${project._id}`)).status, 401);

  // 403 Dev cannot create or delete projects
  const devCreate = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${devToken}`)
    .send({ title: "Dev Project" });
  assert.equal(devCreate.status, 403);

  // 200 GET all & single
  const list = await request(app).get("/api/projects").set("Authorization", `Bearer ${devToken}`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((item: { id: string }) => item.id), [project._id.toString()]);
  const managerList = await request(app).get("/api/projects").set("Authorization", `Bearer ${managerToken}`);
  assert.deepEqual(managerList.body.map((item: { id: string }) => item.id), [project._id.toString()]);
  const searchedProjects = await request(app)
    .get("/api/projects?search=E-Commerce")
    .set("Authorization", `Bearer ${managerToken}`);
  assert.deepEqual(searchedProjects.body.map((item: { id: string }) => item.id), [project._id.toString()]);
  assert.equal((await request(app).get(`/api/projects/${otherProject._id}`).set("Authorization", `Bearer ${managerToken}`)).status, 404);
  assert.equal((await request(app).get(`/api/projects/${otherProject._id}/members`).set("Authorization", `Bearer ${managerToken}`)).status, 404);
  assert.equal(manager._id.toString(), managerList.body[0].manager_id);
  const single = await request(app)
    .get(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(single.status, 200);

  // Slug lookup (case-insensitive & hyphenated title)
  const slugRes = await request(app)
    .get("/api/projects/e-commerce")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(slugRes.status, 200);
  assert.equal(slugRes.body.id, project._id.toString());
  assert.equal(slugRes.body.title, "E-Commerce");

  // Non-existent slug returns 404
  const unknownSlugRes = await request(app)
    .get("/api/projects/non-existent-project-slug")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(unknownSlugRes.status, 404);

  // GET /api/projects/:id/members
  const membersRes = await request(app)
    .get(`/api/projects/${project._id}/members`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(membersRes.status, 200);
  assert.ok(Array.isArray(membersRes.body));
  assert.equal(membersRes.body.length, 1);
  assert.equal(membersRes.body[0].email, "sarah@test.dev");
  assert.ok("id" in membersRes.body[0]);
  assert.ok("name" in membersRes.body[0]);
  assert.ok("role" in membersRes.body[0]);
  assert.ok("created_at" in membersRes.body[0]);

  // GET /api/projects/:id/members 404 for unknown project
  const unknownMembersRes = await request(app)
    .get("/api/projects/507f1f77bcf86cd799439011/members")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(unknownMembersRes.status, 404);

  // 201 Manager create project
  const create = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ title: "New Project", priority: "medium" });
  assert.equal(create.status, 201);
  const createAct = await Activity.findOne({ project: create.body.id, message: /created project/ });
  assert.ok(createAct, "Project creation must record activity");

  // 200 Manager patch project
  const update = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ title: "E-Commerce Updated" });
  assert.equal(update.status, 200);
  const updateAct = await Activity.findOne({ project: project._id, message: /updated project/ });
  assert.ok(updateAct, "Project update must record activity");

  // 200 Manager delete project
  const del = await request(app)
    .delete(`/api/projects/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`);
  assert.equal(del.status, 200);
  const remainingProjectActs = await Activity.find({ project: create.body.id });
  assert.equal(remainingProjectActs.length, 0, "Project deletion must cascade delete activities");
});

// ---------------------------------------------------------------------------
// 14-19: Tasks Endpoints
// ---------------------------------------------------------------------------
test("CHAR-TASKS: GET, POST, PATCH, PATCH /complete, DELETE /api/tasks", async () => {
  const { managerToken, devToken, otherDevToken, project, task, dev, otherDev, manager } =
    await createFixtures();

  // 401 without token
  assert.equal((await request(app).get("/api/tasks")).status, 401);
  assert.equal((await request(app).get(`/api/tasks/${task._id}`)).status, 401);
  assert.equal((await request(app).post("/api/tasks")).status, 401);
  assert.equal((await request(app).patch(`/api/tasks/${task._id}`)).status, 401);
  assert.equal((await request(app).patch(`/api/tasks/${task._id}/complete`)).status, 401);
  assert.equal((await request(app).delete(`/api/tasks/${task._id}`)).status, 401);

  // 200 GET tasks & single
  assert.equal(
    (await request(app).get("/api/tasks").set("Authorization", `Bearer ${devToken}`)).status,
    200,
  );
  const otherAssignedTask = await Task.create({
    project: project._id, title: "Other developer task", assignedDeveloper: (await User.findOne({ email: "john@test.dev" }))!._id,
    status: "todo", isCompleted: false,
  });
  const completedTask = await Task.create({
    project: project._id, title: "Completed assignment", assignedDeveloper: dev._id,
    status: "done", isCompleted: true,
  });
  const unassignedTask = await Task.create({ project: project._id, title: "Unassigned task" });
  const otherManager = await User.create({
    name: "Manager Outside Scope", email: "manager-outside-scope@test.dev", passwordHash: "hash", role: "manager",
  });
  const otherManagerToken = generateToken({
    id: otherManager._id.toString(), email: otherManager.email, role: "manager", name: otherManager.name,
  });
  const otherProject = await Project.create({ title: "Outside project", manager: otherManager._id, team: [] });
  const outsideTask = await Task.create({ project: otherProject._id, title: "Outside manager task" });
  assert.equal((await request(app).get(`/api/tasks/${outsideTask._id}`).set("Authorization", `Bearer ${managerToken}`)).status, 404);
  const managerTasks = await request(app).get("/api/tasks").set("Authorization", `Bearer ${managerToken}`);
  assert.ok(!managerTasks.body.some((item: { id: string }) => item.id === outsideTask.id));
  const scopedTasks = await request(app).get("/api/tasks").set("Authorization", `Bearer ${devToken}`);
  assert.ok(scopedTasks.body.some((item: { id: string }) => item.id === completedTask.id));
  assert.ok(!scopedTasks.body.some((item: { id: string }) => [otherAssignedTask.id, unassignedTask.id].includes(item.id)));
  assert.equal((await request(app).get(`/api/tasks/${otherAssignedTask._id}`).set("Authorization", `Bearer ${devToken}`)).status, 404);
  assert.equal((await request(app).get(`/api/tasks/${unassignedTask._id}`).set("Authorization", `Bearer ${devToken}`)).status, 404);
  assert.equal((await request(app).get("/api/tasks").query({ assigned_to: otherAssignedTask.assignedDeveloper.toString() }).set("Authorization", `Bearer ${devToken}`)).body.length, 0);
  assert.equal((await request(app).get("/api/tasks").query({ project_id: "507f1f77bcf86cd799439011" }).set("Authorization", `Bearer ${devToken}`)).body.length, 0);
  assert.equal(
    (await request(app).get(`/api/tasks/${task._id}`).set("Authorization", `Bearer ${devToken}`))
      .status,
    200,
  );

  // 201 Manager create task
  const create = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      project_id: project._id.toString(),
      title: "Second Task",
      assigned_developer_id: dev._id.toString(),
      created_by: dev._id.toString(),
      assigned_by: dev._id.toString(),
    });
  assert.equal(create.status, 201);
  assert.deepEqual(create.body.created_by, { id: manager._id.toString(), name: manager.name });
  assert.deepEqual(create.body.assigned_by, { id: manager._id.toString(), name: manager.name });
  const taskCreateAct = await Activity.findOne({ task: create.body.id, message: /created task/ });
  assert.ok(taskCreateAct, "Task creation must record activity");
  const taskAssignNotif = await Notification.findOne({
    recipient: dev._id,
    kind: "task_assigned",
    task: create.body.id,
  });
  assert.ok(taskAssignNotif, "Task creation with assignee must create notification");

  // Attribution is server-authored and unchanged by unrelated edits or forged identity fields.
  const createdAttribution = await request(app)
    .patch(`/api/tasks/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      title: "Second Task edited",
      created_by: dev._id.toString(),
      assigned_by: dev._id.toString(),
    });
  assert.equal(createdAttribution.status, 200);
  assert.equal(createdAttribution.body.created_by.id, manager._id.toString());
  assert.equal(createdAttribution.body.assigned_by.id, manager._id.toString());
  await Task.findByIdAndUpdate(create.body.id, { assignedBy: otherDev._id });
  const noOpAssignment = await request(app)
    .patch(`/api/tasks/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ assigned_developer_id: dev._id.toString() });
  assert.equal(noOpAssignment.body.assigned_by.id, otherDev._id.toString());

  await Project.findByIdAndUpdate(project._id, { $addToSet: { team: otherDev._id } });
  const reassigned = await request(app)
    .patch(`/api/tasks/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ assigned_developer_id: otherDev._id.toString() });
  assert.equal(reassigned.body.assigned_developer_id, otherDev._id.toString());
  assert.equal(reassigned.body.assigned_by.id, manager._id.toString());

  // 403 Developer not assigned cannot update
  const unauthPatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${otherDevToken}`)
    .send({ status: "done" });
  assert.equal(unauthPatch.status, 403);

  // 403 Assigned developer cannot reassign developer
  const devReassign = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ assigned_developer_id: otherDev._id.toString() });
  assert.equal(devReassign.status, 403);
  assert.equal(devReassign.body.message, "Not authorized to reassign this task");

  // 200 Manager unassigns task with 'unassigned' on separate task
  const tempTask = await Task.create({
    project: project._id,
    title: "Temp Assignee Task",
    assignedDeveloper: dev._id,
    priority: "low",
    status: "todo",
  });
  const unassignPatch = await request(app)
    .patch(`/api/tasks/${tempTask._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ assigned_developer_id: "unassigned" });
  assert.equal(unassignPatch.status, 200);
  assert.equal(unassignPatch.body.assigned_developer_id, null);
  assert.equal(unassignPatch.body.assignee, null);
  assert.equal(unassignPatch.body.assigned_by, null);
  await Task.findByIdAndDelete(tempTask._id);

  // 200 Assignee updates status
  const assigneePatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ status: "in_review" });
  assert.equal(assigneePatch.status, 200);
  assert.equal(assigneePatch.body.status, "in_review");
  const statusAct = await Activity.findOne({ task: task._id, message: /moved .* to in review/ });
  assert.ok(statusAct, "Status change must record move activity");

  // 200 Complete toggle (completed: true)
  const completeToggle = await request(app)
    .patch(`/api/tasks/${task._id}/complete`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ completed: true });
  assert.equal(completeToggle.status, 200);
  assert.equal(completeToggle.body.is_completed, true);
  assert.equal(completeToggle.body.status, "done");
  assert.ok(completeToggle.body.completed_at);
  const completeAct = await Activity.findOne({
    task: task._id,
    message: `completed ${task.title}`,
  });
  assert.ok(completeAct, "Completion must record activity");

  // 200 Reopen toggle (completed: false)
  const reopenToggle = await request(app)
    .patch(`/api/tasks/${task._id}/complete`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ completed: false });
  assert.equal(reopenToggle.status, 200);
  assert.equal(reopenToggle.body.is_completed, false);
  assert.equal(reopenToggle.body.status, "todo");
  assert.equal(reopenToggle.body.completed_at, null);
  const reopenAct = await Activity.findOne({
    task: task._id,
    message: `reopened ${task.title}`,
  });
  assert.ok(reopenAct, "Reopening must record activity");

  // 200 Setting status directly to 'done' sets is_completed and completed_at
  const donePatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ status: "done" });
  assert.equal(donePatch.status, 200);
  assert.equal(donePatch.body.status, "done");
  assert.equal(donePatch.body.is_completed, true);
  assert.ok(donePatch.body.completed_at);

  // 200 Setting status back to 'in_progress' clears is_completed and completed_at
  const reopenStatusPatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ status: "in_progress" });
  assert.equal(reopenStatusPatch.status, 200);
  assert.equal(reopenStatusPatch.body.status, "in_progress");
  assert.equal(reopenStatusPatch.body.is_completed, false);
  assert.equal(reopenStatusPatch.body.completed_at, null);

  // 200 Setting is_completed boolean via task update
  const boolPatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ is_completed: true });
  assert.equal(boolPatch.status, 200);
  assert.equal(boolPatch.body.is_completed, true);
  assert.equal(boolPatch.body.status, "done");
  const originalCompletedAt = boolPatch.body.completed_at;
  assert.ok(originalCompletedAt);

  // 200 Re-applying status 'done' preserves original completed_at timestamp
  const doneRepeat = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ status: "done" });
  assert.equal(doneRepeat.status, 200);
  assert.equal(
    doneRepeat.body.completed_at,
    originalCompletedAt,
    "Re-applying status done must preserve existing completion timestamp",
  );

  // 200 Re-applying completed: true via /complete preserves original completed_at timestamp
  const completeRepeat = await request(app)
    .patch(`/api/tasks/${task._id}/complete`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ completed: true });
  assert.equal(completeRepeat.status, 200);
  assert.equal(
    completeRepeat.body.completed_at,
    originalCompletedAt,
    "Duplicate complete toggle must preserve existing completion timestamp",
  );

  // 200 Moving status to 'in_review' clears completion timestamp
  const inReviewPatch = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ status: "in_review" });
  assert.equal(inReviewPatch.status, 200);
  assert.equal(inReviewPatch.body.status, "in_review");
  assert.equal(inReviewPatch.body.is_completed, false);
  assert.equal(
    inReviewPatch.body.completed_at,
    null,
    "Transitioning away from done must clear completed_at",
  );

  // 400 Invalid completion values must not change task state
  const invalidStringCompletion = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ is_completed: "false" });
  assert.equal(invalidStringCompletion.status, 400);
  assert.equal(invalidStringCompletion.body.message, "is_completed must be a boolean");

  const invalidEmptyCompletion = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ is_completed: "" });
  assert.equal(invalidEmptyCompletion.status, 400);
  assert.equal(invalidEmptyCompletion.body.message, "is_completed must be a boolean");

  const invalidCompleteToggle = await request(app)
    .patch(`/api/tasks/${task._id}/complete`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ completed: "true" });
  assert.equal(invalidCompleteToggle.status, 400);
  assert.equal(invalidCompleteToggle.body.message, "completed must be a boolean");

  const missingCompleteToggle = await request(app)
    .patch(`/api/tasks/${task._id}/complete`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({});
  assert.equal(missingCompleteToggle.status, 400);
  assert.equal(missingCompleteToggle.body.message, "completed must be a boolean");

  const invalidStatus = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ status: "completed" });
  assert.equal(invalidStatus.status, 400);
  assert.match(invalidStatus.body.message, /Invalid task status/);

  const unchangedAfterInvalidInput = await Task.findById(task._id);
  assert.ok(unchangedAfterInvalidInput);
  assert.equal(unchangedAfterInvalidInput.isCompleted, false);
  assert.equal(unchangedAfterInvalidInput.status, "in_review");
  assert.equal(unchangedAfterInvalidInput.completedAt, null);

  // Rejected workflow input must not touch the project or task through assignee resolution
  const projectBeforeInvalidCreate = await Project.findById(project._id).lean();
  assert.ok(projectBeforeInvalidCreate);
  const taskCountBeforeInvalidCreate = await Task.countDocuments({ project: project._id });
  const invalidCreate = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      project_id: project._id.toString(),
      title: "Rejected Task",
      assigned_developer_id: dev._id.toString(),
      status: "completed",
    });
  assert.equal(invalidCreate.status, 400);
  assert.match(invalidCreate.body.message, /Invalid task status/);
  const projectAfterInvalidCreate = await Project.findById(project._id).lean();
  assert.deepEqual(projectAfterInvalidCreate, projectBeforeInvalidCreate);
  assert.equal(await Task.countDocuments({ project: project._id }), taskCountBeforeInvalidCreate);

  const taskBeforeInvalidUpdate = await Task.findById(task._id).lean();
  const projectBeforeInvalidUpdate = await Project.findById(project._id).lean();
  assert.ok(taskBeforeInvalidUpdate);
  assert.ok(projectBeforeInvalidUpdate);
  const invalidUpdate = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      assigned_developer_id: dev._id.toString(),
      is_completed: "false",
    });
  assert.equal(invalidUpdate.status, 400);
  assert.equal(invalidUpdate.body.message, "is_completed must be a boolean");
  const taskAfterInvalidUpdate = await Task.findById(task._id).lean();
  const projectAfterInvalidUpdate = await Project.findById(project._id).lean();
  assert.deepEqual(taskAfterInvalidUpdate, taskBeforeInvalidUpdate);
  assert.deepEqual(projectAfterInvalidUpdate, projectBeforeInvalidUpdate);

  // 200 Manager delete task
  const del = await request(app)
    .delete(`/api/tasks/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`);
  assert.equal(del.status, 200);
  const deletedTaskActs = await Activity.find({ task: create.body.id });
  assert.equal(deletedTaskActs.length, 0, "Task deletion must cascade delete activities");
});

// ---------------------------------------------------------------------------
// 20-24: Subtasks Endpoints
// ---------------------------------------------------------------------------
test("CHAR-SUBTASKS: GET, POST, PATCH, DELETE /api/subtasks", async () => {
  const { devToken, task, subtask } = await createFixtures();

  // 401 without token
  assert.equal((await request(app).get("/api/subtasks")).status, 401);
  assert.equal((await request(app).get(`/api/subtasks/task/${task._id}`)).status, 401);
  assert.equal((await request(app).post(`/api/subtasks/task/${task._id}`)).status, 401);
  assert.equal((await request(app).patch(`/api/subtasks/${subtask._id}`)).status, 401);
  assert.equal((await request(app).delete(`/api/subtasks/${subtask._id}`)).status, 401);

  // 200 GET all & for task
  assert.equal(
    (await request(app).get("/api/subtasks").set("Authorization", `Bearer ${devToken}`)).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .get(`/api/subtasks/task/${task._id}`)
        .set("Authorization", `Bearer ${devToken}`)
    ).status,
    200,
  );

  // Approved deviation: malformed taskId now returns 400
  const malformed = await request(app)
    .get("/api/subtasks/task/not-an-id")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.message, "Invalid task ID format");

  // 201 Create subtask
  const create = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ title: "Subtask Two" });
  assert.equal(create.status, 201);
  const subtaskAct = await Activity.findOne({ task: task._id, message: /added subtask/ });
  assert.ok(subtaskAct, "Subtask creation must record activity");

  // 200 Patch subtask
  const patch = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ is_completed: true });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.is_completed, true);
  const patchSubNotif = await Notification.findOne({
    task: task._id,
    kind: "subtask_completed",
  });
  assert.ok(patchSubNotif, "Subtask completion must record manager notification");

  // Invalid completion input must not change the persisted subtask
  const subtaskBeforeInvalidPatch = await Subtask.findById(subtask._id).lean();
  assert.ok(subtaskBeforeInvalidPatch);
  const invalidSubtaskPatch = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ is_completed: "false" });
  assert.equal(invalidSubtaskPatch.status, 400);
  assert.equal(invalidSubtaskPatch.body.message, "is_completed must be a boolean");
  const subtaskAfterInvalidPatch = await Subtask.findById(subtask._id).lean();
  assert.deepEqual(subtaskAfterInvalidPatch, subtaskBeforeInvalidPatch);

  // 200 Delete subtask
  const del = await request(app)
    .delete(`/api/subtasks/${create.body.id}`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(del.status, 200);
});

// ---------------------------------------------------------------------------
// 25-28: Comments Endpoints
// ---------------------------------------------------------------------------
test("CHAR-COMMENTS: GET counts, GET /task, POST, DELETE /api/comments", async () => {
  const { devToken, managerToken, otherDevToken, task, comment } = await createFixtures();

  // 401 without token
  assert.equal((await request(app).get("/api/comments/counts")).status, 401);
  assert.equal((await request(app).get(`/api/comments/task/${task._id}`)).status, 401);
  assert.equal((await request(app).post(`/api/comments/task/${task._id}`)).status, 401);
  assert.equal((await request(app).delete(`/api/comments/${comment._id}`)).status, 401);

  // 200 counts & task comments
  const counts = await request(app)
    .get("/api/comments/counts")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(counts.status, 200);
  assert.equal(typeof counts.body, "object");

  const taskComments = await request(app)
    .get(`/api/comments/task/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(taskComments.status, 200);
  assert.equal(taskComments.body.length, 1);
  const foreignTask = await Task.create({ project: task.project, title: "Private other task", assignedDeveloper: (await User.findOne({ email: "john@test.dev" }))!._id });
  await Comment.create({ task: foreignTask._id, author: (await User.findOne({ email: "john@test.dev" }))!._id, body: "private comment" });
  assert.equal((await request(app).get(`/api/comments/task/${foreignTask._id}`).set("Authorization", `Bearer ${devToken}`)).status, 404);
  assert.equal((await request(app).post(`/api/comments/task/${foreignTask._id}`).set("Authorization", `Bearer ${devToken}`).send({ body: "forged access" })).status, 404);
  const scopedCounts = await request(app).get("/api/comments/counts").set("Authorization", `Bearer ${devToken}`);
  assert.equal(scopedCounts.body[foreignTask._id.toString()], undefined);

  // 201 Add comment
  const create = await request(app)
    .post(`/api/comments/task/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ body: "Another comment" });
  assert.equal(create.status, 201);
  const commentAct = await Activity.findOne({ task: task._id, message: "added a comment" });
  assert.ok(commentAct, "Comment creation must record activity");
  const commentNotif = await Notification.findOne({
    task: task._id,
    kind: "new_comment",
  });
  assert.ok(commentNotif, "Comment creation must record notification");

  // 403 Non-author developer cannot delete comment
  const unauthDevDel = await request(app)
    .delete(`/api/comments/${create.body.id}`)
    .set("Authorization", `Bearer ${otherDevToken}`);
  assert.equal(unauthDevDel.status, 404);

  // 403 Other manager cannot delete comment on this project's task
  const otherManager = await User.create({
    name: "Other Manager",
    email: "othermgr@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const otherManagerToken = generateToken({
    id: otherManager._id.toString(),
    email: otherManager.email,
    role: "manager",
    name: otherManager.name,
  });
  const crossManagerDel = await request(app)
    .delete(`/api/comments/${create.body.id}`)
    .set("Authorization", `Bearer ${otherManagerToken}`);
  assert.equal(crossManagerDel.status, 404);

  // 200 Project manager owning the project CAN delete developer's comment
  const managerDel = await request(app)
    .delete(`/api/comments/${create.body.id}`)
    .set("Authorization", `Bearer ${managerToken}`);
  assert.equal(managerDel.status, 200);
  assert.equal(
    await Comment.findById(create.body.id),
    null,
    "Project manager must be able to delete comment",
  );

  // 200 Comment author CAN delete their own comment
  const authorDel = await request(app)
    .delete(`/api/comments/${comment._id}`)
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(authorDel.status, 200);
  assert.equal(
    await Comment.findById(comment._id),
    null,
    "Comment author must be able to delete comment",
  );
});

// ---------------------------------------------------------------------------
// 29-32: Notifications, Activity, Barriers
// ---------------------------------------------------------------------------
test("CHAR-NOTIFS-ACTIVITY: Notifications, Activity, and Health", async () => {
  const { devToken, otherDevToken, notification, task, project } = await createFixtures();

  // 401 without token
  assert.equal((await request(app).get("/api/notifications")).status, 401);
  assert.equal((await request(app).patch("/api/notifications/mark-read")).status, 401);
  assert.equal((await request(app).get("/api/activity")).status, 401);

  // 200 Notifications list
  const notifs = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${devToken}`);
  assert.equal(notifs.status, 200);
  assert.ok(Array.isArray(notifs.body));

  // 200 Mark read
  const mark = await request(app)
    .patch("/api/notifications/mark-read")
    .set("Authorization", `Bearer ${devToken}`)
    .send({ ids: [notification._id.toString()] });
  assert.equal(mark.status, 200);
  const updatedNotif = await Notification.findById(notification._id);
  assert.equal(updatedNotif?.isRead, true, "Notification must be marked read in database");

  // 200 Activity
  const acts = await request(app).get("/api/activity").set("Authorization", `Bearer ${devToken}`);
  assert.equal(acts.status, 200);
  assert.ok(Array.isArray(acts.body));
  const foreignTask = await Task.create({ project: project._id, title: "Private activity task", assignedDeveloper: (await User.findOne({ email: "john@test.dev" }))!._id });
  await Activity.create({ project: project._id, task: foreignTask._id, actor: foreignTask.assignedDeveloper, message: "private activity" });
  assert.equal((await request(app).get(`/api/activity?taskId=${foreignTask._id}`).set("Authorization", `Bearer ${devToken}`)).status, 404);
  assert.equal((await request(app).get(`/api/activity?taskId=${task._id}`).set("Authorization", `Bearer ${otherDevToken}`)).status, 404);

  // 200 Health check (public)
  const health = await request(app).get("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
});
