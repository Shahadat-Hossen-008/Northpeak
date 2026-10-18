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
import { concurrencyTestBarriers } from "../src/services/team.ts";
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
  concurrencyTestBarriers.reset();
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

test("CONC-01: Removing developer from project team unassigns active tasks", async () => {
  const manager = await User.create({
    name: "Team Lead",
    email: "lead@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const dev = await User.create({
    name: "Dev One",
    email: "dev1@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });

  const managerToken = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });

  const project = await Project.create({
    title: "Alpha Project",
    manager: manager._id,
    team: [dev._id],
    priority: "high",
  });

  const task = await Task.create({
    project: project._id,
    title: "Alpha Task 1",
    assignedDeveloper: dev._id,
    assignedBy: manager._id,
    isCompleted: false,
    status: "in_progress",
  });
  const openSubtask = await Subtask.create({
    task: task._id,
    title: "Open child",
    assignedDeveloper: dev._id,
    isCompleted: false,
  });
  const completedSubtask = await Subtask.create({
    task: task._id,
    title: "Completed child",
    assignedDeveloper: dev._id,
    isCompleted: true,
    completedAt: new Date(),
  });

  // Manager removes Dev One from project team
  const res = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ team: [] });

  assert.equal(res.status, 200);
  assert.equal(res.body.unassigned_open_tasks_count, 1);

  const updatedTask = await Task.findById(task._id);
  assert.ok(updatedTask);
  assert.equal(updatedTask.assignedDeveloper, null);
  assert.equal(updatedTask.assignedBy, null);
  assert.equal((await Subtask.findById(openSubtask._id))?.assignedDeveloper, null);
  assert.equal(
    (await Subtask.findById(completedSubtask._id))?.assignedDeveloper?.toString(),
    dev._id.toString(),
  );
});

test("CONC-02: Task creation aborted when developer is concurrently removed from team", async () => {
  const manager = await User.create({
    name: "Project Lead",
    email: "lead2@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const dev = await User.create({
    name: "Dev Two",
    email: "dev2@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });

  const managerToken = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });

  const project = await Project.create({
    title: "Beta Project",
    manager: manager._id,
    team: [dev._id],
    priority: "medium",
  });

  // Configure barrier: after task is initially saved, simulate concurrent removal of Dev Two from team
  concurrencyTestBarriers.afterTaskCreateSave = async () => {
    await Project.findByIdAndUpdate(project._id, { $set: { team: [] } });
  };

  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      project_id: project._id.toString(),
      title: "Concurrent Assignment Task",
      assigned_developer_id: dev._id.toString(),
    });

  // Should detect membership loss and abort with 400
  assert.equal(res.status, 400);
  assert.match(res.body.message, /does not belong to the selected project/i);

  // Verify task was deleted by the concurrency guard
  const count = await Task.countDocuments({ title: "Concurrent Assignment Task" });
  assert.equal(count, 0);
});

test("CONC-03: Team removal failure rolls back and preserves project team", async () => {
  const manager = await User.create({
    name: "Project Manager",
    email: "pm@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const dev = await User.create({
    name: "Dev Three",
    email: "dev3@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });

  const managerToken = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });

  const project = await Project.create({
    title: "Gamma Project",
    manager: manager._id,
    team: [dev._id],
    priority: "high",
  });

  await Task.create({
    project: project._id,
    title: "Gamma Task",
    assignedDeveloper: dev._id,
    isCompleted: false,
  });

  // Enable simulated removal failure
  concurrencyTestBarriers.simulateRemovalFailure = true;

  const res = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ team: [] });

  assert.equal(res.status, 500);

  // Verify project team was rolled back
  const refreshedProject = await Project.findById(project._id);
  assert.ok(refreshedProject);
  assert.equal(refreshedProject.team.length, 1);
  assert.equal(refreshedProject.team[0].toString(), dev._id.toString());
});
