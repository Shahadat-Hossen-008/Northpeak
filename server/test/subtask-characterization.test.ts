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
import { Activity } from "../src/models/Activity.ts";
import { Notification } from "../src/models/Notification.ts";
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

async function fixture() {
  const manager = await User.create({
    name: "Owner Manager",
    email: "owner.mgr@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const managerToken = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });
  const dev = await User.create({
    name: "Assigned Dev",
    email: "assigned.dev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const devToken = generateToken({
    id: dev._id.toString(),
    email: dev.email,
    role: "developer",
    name: dev.name,
  });
  const project = await Project.create({
    title: "Characterization",
    description: "Subtask characterization project",
    manager: manager._id,
    team: [dev._id],
    priority: "high",
  });
  const task = await Task.create({
    project: project._id,
    title: "Parent",
    assignedDeveloper: dev._id,
    priority: "high",
    status: "in_progress",
    isCompleted: false,
  });
  const subtask = await Subtask.create({ task: task._id, title: "Child" });
  return { manager, managerToken, dev, devToken, project, task, subtask };
}

test("SUBTASK-CHAR-01: createSubtask writes an 'added subtask' activity and returns the subtask", async () => {
  const { manager, managerToken, project, task } = await fixture();

  const res = await request(app)
    .post(`/api/subtasks/task/${task._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ title: "  Written Subtask  " });

  assert.equal(res.status, 201);
  assert.equal(res.body.title, "Written Subtask");

  const activities = await Activity.find({ task: task._id });
  assert.equal(activities.length, 1);
  assert.equal(activities[0].message, 'added subtask "Written Subtask"');
  assert.equal(activities[0].actor.toString(), manager._id.toString());
  assert.equal(activities[0].project.toString(), project._id.toString());
});

test("SUBTASK-CHAR-02: createSubtask leaves the subtask unassigned if the developer leaves the team after validation", async () => {
  const { dev, managerToken, project, task } = await fixture();

  const originalCreate = Subtask.create;
  (Subtask as any).create = async function (this: any, ...args: any[]) {
    const out = await (originalCreate as any).apply(this, args);
    await Project.updateOne({ _id: project._id }, { $set: { team: [] } });
    return out;
  };
  try {
    const res = await request(app)
      .post(`/api/subtasks/task/${task._id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Racy", assigned_developer_id: dev._id.toString() });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /does not belong/i);
  } finally {
    (Subtask as any).create = originalCreate;
  }

  const stored = await Subtask.findOne({ task: task._id, title: "Racy" });
  assert.ok(stored);
  assert.equal(stored.assignedDeveloper, null);
});

test("SUBTASK-CHAR-03: completing a subtask creates a subtask_completed notification", async () => {
  const { managerToken, task, subtask } = await fixture();

  const res = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ is_completed: true });

  assert.equal(res.status, 200);
  const notifications = await Notification.find({ kind: "subtask_completed", task: task._id });
  assert.equal(notifications.length, 1);
});

test("SUBTASK-CHAR-04: a developer sending assigned_developer_id gets 403 even when the title is invalid", async () => {
  const { dev, devToken, subtask } = await fixture();

  const res = await request(app)
    .patch(`/api/subtasks/${subtask._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ title: "   ", assigned_developer_id: dev._id.toString() });

  assert.equal(res.status, 403);
  assert.equal(res.body.message, "Not authorized to assign subtasks");
});

test("SUBTASK-CHAR-05: createSubtask validates the title (400) before looking up the parent task (404)", async () => {
  const { managerToken } = await fixture();
  const missingTaskId = new mongoose.Types.ObjectId().toString();

  const res = await request(app)
    .post(`/api/subtasks/task/${missingTaskId}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ title: "   " });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, "Subtask title is required");
});

// SUBTASK-CHAR-06: Table‑driven rule‑pair coverage for updateSubtask
test("SUBTASK-CHAR-06: table‑driven rule‑pair coverage for updateSubtask", async () => {
  const { manager, managerToken, dev, devToken, project, task, subtask } = await fixture();

  // extra unauthorized developer (neither manager nor assignee)
  const otherDev = await User.create({
    name: "Other Dev",
    email: "other.dev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const otherToken = generateToken({
    id: otherDev._id.toString(),
    email: otherDev.email,
    role: "developer",
    name: otherDev.name,
  });

  const cases = [
    // 1. Invalid ObjectId (not‑found) + auth failure – expect 404 Subtask not found
    {
      name: "invalidId_then_auth",
      subtaskId: "invalid-id",
      token: otherToken,
      payload: { title: "new" },
      expectedStatus: 404,
      expectedMessage: "Subtask not found",
    },
    // 2. Auth failure + parent‑change field – expect 403 Not authorized to modify this subtask
    {
      name: "auth_then_parentChange",
      subtaskId: subtask._id.toString(),
      token: otherToken,
      payload: { task: "someOtherTaskId", title: "new" },
      expectedStatus: 403,
      expectedMessage: "Not authorized to modify this subtask",
    },
    // 3. Parent‑change + assignment – expect 400 Subtask parent cannot be changed
    {
      name: "parentChange_then_assign",
      subtaskId: subtask._id.toString(),
      token: devToken,
      payload: { task: "someOtherTaskId", assigned_developer_id: dev._id.toString() },
      expectedStatus: 400,
      expectedMessage: "Subtask parent cannot be changed",
    },
    // 4. Assignment + title validation – expect 403 Not authorized to assign subtasks
    {
      name: "assign_then_title",
      subtaskId: subtask._id.toString(),
      token: devToken,
      payload: { assigned_developer_id: dev._id.toString(), title: "   " },
      expectedStatus: 403,
      expectedMessage: "Not authorized to assign subtasks",
    },
    // 5. Title validation + description validation – expect 400 Subtask title is required
    {
      name: "title_then_description",
      subtaskId: subtask._id.toString(),
      token: devToken,
      payload: { title: "   ", description: 123 },
      expectedStatus: 400,
      expectedMessage: "Subtask title is required",
    },
    // 6. Description validation + assignee validation – expect 400 Subtask description must be a string
    {
      name: "description_then_assignee",
      subtaskId: subtask._id.toString(),
      token: managerToken,
      payload: { title: "valid", description: 123, assigned_developer_id: dev._id.toString() },
      expectedStatus: 400,
      expectedMessage: "Subtask description must be a string",
    },
    // 7. Assignee validation (invalid ID) + is_completed validation – expect 400 Invalid developer ID
    {
      name: "assignee_then_completed",
      subtaskId: subtask._id.toString(),
      token: managerToken,
      payload: { title: "valid", assigned_developer_id: "invalid-id", is_completed: "yes" },
      expectedStatus: 400,
      expectedMessage: "Invalid developer ID",
    },
    // 8. is_completed validation alone – expect 400 is_completed must be a boolean
    {
      name: "completed_validation",
      subtaskId: subtask._id.toString(),
      token: devToken,
      payload: { title: "valid", is_completed: "yes" },
      expectedStatus: 400,
      expectedMessage: "is_completed must be a boolean",
    },
  ];

  for (const c of cases) {
    const res = await request(app)
      .patch(`/api/subtasks/${c.subtaskId}`)
      .set("Authorization", `Bearer ${c.token}`)
      .send(c.payload);
    assert.equal(res.status, c.expectedStatus, `${c.name} status`);
    assert.equal(res.body.message, c.expectedMessage, `${c.name} message`);
  }
});
