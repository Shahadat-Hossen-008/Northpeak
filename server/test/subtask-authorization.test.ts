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

async function setupAuthTestFixtures() {
  // 1. Project Owner Manager
  const projectManager = await User.create({
    name: "Owner Manager",
    email: "owner.mgr@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const projectManagerToken = generateToken({
    id: projectManager._id.toString(),
    email: projectManager.email,
    role: "manager",
    name: projectManager.name,
  });

  // 2. Unrelated Manager (manages a different project)
  const otherManager = await User.create({
    name: "Other Manager",
    email: "other.mgr@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const otherManagerToken = generateToken({
    id: otherManager._id.toString(),
    email: otherManager.email,
    role: "manager",
    name: otherManager.name,
  });

  // 3. Assigned Developer
  const assignedDev = await User.create({
    name: "Assigned Dev",
    email: "assigned.dev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const assignedDevToken = generateToken({
    id: assignedDev._id.toString(),
    email: assignedDev.email,
    role: "developer",
    name: assignedDev.name,
  });

  // 4. Unassigned Developer
  const unassignedDev = await User.create({
    name: "Unassigned Dev",
    email: "unassigned.dev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const unassignedDevToken = generateToken({
    id: unassignedDev._id.toString(),
    email: unassignedDev.email,
    role: "developer",
    name: unassignedDev.name,
  });

  // Project owned by projectManager with assignedDev on team
  const project = await Project.create({
    title: "Security Core",
    description: "Authorization tests project",
    manager: projectManager._id,
    team: [assignedDev._id],
    priority: "high",
  });

  // Task assigned to assignedDev
  const task = await Task.create({
    project: project._id,
    title: "RBAC Module",
    description: "Subtask permission tests",
    assignedDeveloper: assignedDev._id,
    priority: "high",
    status: "in_progress",
    isCompleted: false,
  });

  // Existing subtask
  const subtask = await Subtask.create({
    task: task._id,
    title: "Initial Subtask",
    isCompleted: false,
  });

  return {
    projectManager,
    projectManagerToken,
    otherManager,
    otherManagerToken,
    assignedDev,
    assignedDevToken,
    unassignedDev,
    unassignedDevToken,
    project,
    task,
    subtask,
  };
}

// ---------------------------------------------------------------------------
// Subtask Mutation Authorization Tests (Stage 2 Row #1)
// ---------------------------------------------------------------------------

test("SUBTASK-AUTH: Unauthenticated requests are rejected with 401 Unauthorized", async () => {
  const { task, subtask } = await setupAuthTestFixtures();

  // Create
  const createRes = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .send({ title: "Unauthenticated Subtask" });
  assert.equal(createRes.status, 401);

  // Update
  const updateRes = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .send({ is_completed: true });
  assert.equal(updateRes.status, 401);

  // Delete
  const deleteRes = await request(app).delete(`/api/subtasks/${subtask._id}`);
  assert.equal(deleteRes.status, 401);
});

test("SUBTASK-AUTH: Assigned developer can create, update, and delete subtasks", async () => {
  const { assignedDevToken, task, subtask } = await setupAuthTestFixtures();

  // 1. Create subtask
  const createRes = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${assignedDevToken}`)
    .send({ title: "Dev Created Subtask" });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.title, "Dev Created Subtask");
  assert.equal(createRes.body.task_id, task._id.toString());

  // 2. Update subtask
  const updateRes = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${assignedDevToken}`)
    .send({ title: "Dev Updated Title", is_completed: true });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.title, "Dev Updated Title");
  assert.equal(updateRes.body.is_completed, true);

  // 3. Delete subtask
  const deleteRes = await request(app)
    .delete(`/api/subtasks/${createRes.body.id}`)
    .set("Authorization", `Bearer ${assignedDevToken}`);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.success, true);
});

test("SUBTASK-AUTH: Authorized project manager can create, update, and delete subtasks", async () => {
  const { projectManagerToken, task, subtask } = await setupAuthTestFixtures();

  // 1. Create subtask
  const createRes = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${projectManagerToken}`)
    .send({ title: "Manager Created Subtask" });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.title, "Manager Created Subtask");

  // 2. Update subtask
  const updateRes = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${projectManagerToken}`)
    .send({ is_completed: true });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.is_completed, true);

  // 3. Delete subtask
  const deleteRes = await request(app)
    .delete(`/api/subtasks/${createRes.body.id}`)
    .set("Authorization", `Bearer ${projectManagerToken}`);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.success, true);
});

test("SUBTASK-AUTH: Unassigned developer cannot mutate subtasks (403 Forbidden)", async () => {
  const { unassignedDevToken, task, subtask } = await setupAuthTestFixtures();

  // 1. Deny create
  const createRes = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${unassignedDevToken}`)
    .send({ title: "Unauthorized Create" });
  assert.equal(createRes.status, 403);
  assert.match(createRes.body.message, /Not authorized/i);

  // 2. Deny update
  const updateRes = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${unassignedDevToken}`)
    .send({ is_completed: true });
  assert.equal(updateRes.status, 403);
  assert.match(updateRes.body.message, /Not authorized/i);

  // 3. Deny delete
  const deleteRes = await request(app)
    .delete(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${unassignedDevToken}`);
  assert.equal(deleteRes.status, 403);
  assert.match(deleteRes.body.message, /Not authorized/i);

  // Ensure subtask was NOT deleted
  const stillExists = await Subtask.findById(subtask._id);
  assert.ok(stillExists, "Subtask must not be deleted by unauthorized developer");
});

test("SUBTASK-AUTH: Unrelated manager cannot mutate subtasks of another project (403 Forbidden)", async () => {
  const { otherManagerToken, task, subtask } = await setupAuthTestFixtures();

  // 1. Deny create
  const createRes = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${otherManagerToken}`)
    .send({ title: "Other Manager Subtask" });
  assert.equal(createRes.status, 403);
  assert.match(createRes.body.message, /Not authorized/i);

  // 2. Deny update
  const updateRes = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${otherManagerToken}`)
    .send({ is_completed: true });
  assert.equal(updateRes.status, 403);
  assert.match(updateRes.body.message, /Not authorized/i);

  // 3. Deny delete
  const deleteRes = await request(app)
    .delete(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${otherManagerToken}`);
  assert.equal(deleteRes.status, 403);
  assert.match(deleteRes.body.message, /Not authorized/i);

  // Ensure subtask was NOT modified or deleted
  const unchanged = await Subtask.findById(subtask._id);
  assert.equal(unchanged?.isCompleted, false, "Subtask must remain uncompleted");
});

test("SUBTASK-AUTH: Missing parent task or subtask returns 404 Not Found", async () => {
  const { projectManagerToken } = await setupAuthTestFixtures();

  const nonExistentTaskId = new mongoose.Types.ObjectId().toString();
  const nonExistentSubtaskId = new mongoose.Types.ObjectId().toString();

  // Create on non-existent task
  const createRes = await request(app)
    .post(`/api/subtasks/task/${nonExistentTaskId}`)
    .set("Authorization", `Bearer ${projectManagerToken}`)
    .send({ title: "Subtask on Ghost Task" });
  assert.equal(createRes.status, 404);
  assert.equal(createRes.body.message, "Task not found");

  // Update non-existent subtask
  const updateRes = await request(app)
    .patch(`/api/subtasks/${nonExistentSubtaskId}`)
    .set("Authorization", `Bearer ${projectManagerToken}`)
    .send({ is_completed: true });
  assert.equal(updateRes.status, 404);
  assert.equal(updateRes.body.message, "Subtask not found");

  // Delete non-existent subtask
  const deleteRes = await request(app)
    .delete(`/api/subtasks/${nonExistentSubtaskId}`)
    .set("Authorization", `Bearer ${projectManagerToken}`);
  assert.equal(deleteRes.status, 404);
  assert.equal(deleteRes.body.message, "Subtask not found");
});
