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
import {
  reconcileAssignments,
  reconcileAssignmentsSafely,
} from "../src/services/reconcile.service.ts";

let replSet: MongoMemoryReplSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  concurrencyTestBarriers.reset();
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

async function fixture() {
  const manager = await User.create({
    name: "Mgr",
    email: "mgr@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const dev = await User.create({
    name: "Dev",
    email: "dev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const token = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });
  const project = await Project.create({
    title: "Consistency",
    manager: manager._id,
    team: [dev._id],
    priority: "high",
  });
  return { manager, dev, token, project };
}

/** Invariant: no OPEN task/subtask is assigned to a developer outside the project team. */
async function countInvariantViolations(): Promise<number> {
  let violations = 0;
  for (const project of await Project.find()) {
    const team = project.team;
    violations += await Task.countDocuments({
      project: project._id,
      isCompleted: false,
      assignedDeveloper: { $ne: null, $nin: team },
    });
    const taskIds = await Task.find({ project: project._id }).distinct("_id");
    violations += await Subtask.countDocuments({
      task: { $in: taskIds },
      isCompleted: false,
      assignedDeveloper: { $ne: null, $nin: team },
    });
  }
  return violations;
}

test("ASSIGN-01: reconciler unassigns open work of non-members, keeps completed attribution, is idempotent", async () => {
  const { dev, project, manager } = await fixture();
  await Project.updateOne({ _id: project._id }, { $set: { team: [] } });

  const open = await Task.create({
    project: project._id,
    title: "Open",
    assignedDeveloper: dev._id,
    assignedBy: manager._id,
  });
  const done = await Task.create({
    project: project._id,
    title: "Done",
    assignedDeveloper: dev._id,
    assignedBy: manager._id,
    isCompleted: true,
    status: "done",
    completedAt: new Date(),
  });
  const openSub = await Subtask.create({ task: open._id, title: "s1", assignedDeveloper: dev._id });
  const doneSub = await Subtask.create({
    task: open._id,
    title: "s2",
    assignedDeveloper: dev._id,
    isCompleted: true,
    completedAt: new Date(),
  });

  assert.equal(await countInvariantViolations(), 2);
  const first = await reconcileAssignments();
  assert.equal(first.tasks, 1);
  assert.equal(first.subtasks, 1);
  assert.equal(await countInvariantViolations(), 0);

  assert.equal((await Task.findById(open._id))?.assignedDeveloper, null);
  assert.equal((await Task.findById(open._id))?.assignedBy, null);
  assert.equal((await Task.findById(done._id))?.assignedDeveloper?.toString(), dev._id.toString());
  assert.equal((await Task.findById(done._id))?.assignedBy?.toString(), manager._id.toString());
  assert.equal((await Subtask.findById(openSub._id))?.assignedDeveloper, null);
  assert.equal(
    (await Subtask.findById(doneSub._id))?.assignedDeveloper?.toString(),
    dev._id.toString(),
  );

  const second = await reconcileAssignments();
  assert.deepEqual([second.tasks, second.subtasks], [0, 0]);
});

test("ASSIGN-02: reconciler leaves current team members' assignments untouched", async () => {
  const { dev, project } = await fixture();
  const task = await Task.create({
    project: project._id,
    title: "Keep",
    assignedDeveloper: dev._id,
  });
  await reconcileAssignments();
  assert.equal((await Task.findById(task._id))?.assignedDeveloper?.toString(), dev._id.toString());
});

test("ASSIGN-03: concurrent assignment and team removal never leaves an invalid open assignment", async () => {
  const { dev, token, project } = await fixture();

  for (let i = 0; i < 12; i += 1) {
    await Project.updateOne({ _id: project._id }, { $set: { team: [dev._id] } });
    const task = await Task.create({
      project: project._id,
      title: `Race ${i}`,
      createdBy: project.manager,
    });

    const patchTask = request(app)
      .patch(`/api/tasks/${task._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assigned_developer_id: dev._id.toString() });
    const createTask = request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        project_id: project._id.toString(),
        title: `Created ${i}`,
        assigned_developer_id: dev._id.toString(),
      });
    const removeTeam = request(app)
      .patch(`/api/projects/${project._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ team: [] });

    const responses = await Promise.all([patchTask, createTask, removeTeam]);
    for (const res of responses) {
      assert.ok(
        [200, 201, 400, 409].includes(res.status),
        `unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    assert.equal(await countInvariantViolations(), 0, `invariant violated in iteration ${i}`);
  }
});

test("ASSIGN-04: reconcile failure after committed removal is surfaced and later healed", async () => {
  const { dev, token, project } = await fixture();
  await Task.create({ project: project._id, title: "Assigned", assignedDeveloper: dev._id });

  concurrencyTestBarriers.simulateReconcileFailure = true;
  const res = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ team: [] });

  assert.equal(res.status, 200);
  assert.equal(res.body.assignment_reconciliation_pending, true);
  // The transactional unassignment already committed the primary cleanup.
  assert.equal((await Project.findById(project._id))?.team.length, 0);
  assert.equal(await countInvariantViolations(), 0);

  // Simulate a task that slipped in concurrently, then confirm the periodic reconciler heals it.
  await Task.create({ project: project._id, title: "Leftover", assignedDeveloper: dev._id });
  assert.equal(await countInvariantViolations(), 1);
  const failed = await reconcileAssignmentsSafely({}, 2);
  assert.equal(failed.ok, false, "failure must be reported, not swallowed");
  assert.equal(await countInvariantViolations(), 1);

  concurrencyTestBarriers.reset();
  const healed = await reconcileAssignmentsSafely();
  assert.equal(healed.ok, true);
  assert.equal(await countInvariantViolations(), 0);
});

test("ASSIGN-05: failed compensation on task create defers to reconciler (task ends unassigned)", async () => {
  const { dev, token, project } = await fixture();
  concurrencyTestBarriers.afterTaskCreateSave = async () => {
    await Project.updateOne({ _id: project._id }, { $set: { team: [] } });
  };
  const originalDelete = Task.findByIdAndDelete;
  (Task as any).findByIdAndDelete = async () => {
    throw new Error("Simulated cleanup failure");
  };
  try {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        project_id: project._id.toString(),
        title: "Cleanup fails",
        assigned_developer_id: dev._id.toString(),
      });
    assert.equal(res.status, 400);
  } finally {
    (Task as any).findByIdAndDelete = originalDelete;
  }
  const leftover = await Task.findOne({ title: "Cleanup fails" });
  assert.ok(leftover, "task remains because delete failed");
  assert.equal(leftover.assignedDeveloper, null, "reconciler must clear the invalid assignment");
  assert.equal(await countInvariantViolations(), 0);
});

test("ASSIGN-06: subtask assignment is rolled back if the developer leaves the team after validation", async () => {
  const { dev, token, project } = await fixture();
  const task = await Task.create({
    project: project._id,
    title: "Parent",
    assignedDeveloper: dev._id,
  });
  const subtask = await Subtask.create({ task: task._id, title: "Child" });

  const originalSave = Subtask.prototype.save;
  (Subtask.prototype as any).save = async function (this: any, ...args: any[]) {
    const out = await (originalSave as any).apply(this, args);
    await Project.updateOne({ _id: project._id }, { $set: { team: [] } });
    return out;
  };
  try {
    const res = await request(app)
      .patch(`/api/subtasks/${subtask._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assigned_developer_id: dev._id.toString() });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /does not belong/i);
  } finally {
    (Subtask.prototype as any).save = originalSave;
  }
  assert.equal((await Subtask.findById(subtask._id))?.assignedDeveloper, null);
});

test("ASSIGN-07: task PATCH by an unrelated manager and by a developer still returns 403", async () => {
  const { dev, project } = await fixture();
  const other = await User.create({
    name: "Other",
    email: "other@northpeak.dev",
    passwordHash: "h",
    role: "manager",
  });
  const otherToken = generateToken({
    id: other._id.toString(),
    email: other.email,
    role: "manager",
    name: other.name,
  });
  const devToken = generateToken({
    id: dev._id.toString(),
    email: dev.email,
    role: "developer",
    name: dev.name,
  });
  const task = await Task.create({
    project: project._id,
    title: "Guarded",
    assignedDeveloper: dev._id,
  });

  const r1 = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ assigned_developer_id: null });
  assert.equal(r1.status, 403);
  const r2 = await request(app)
    .patch(`/api/tasks/${task._id}`)
    .set("Authorization", `Bearer ${devToken}`)
    .send({ assigned_developer_id: null });
  assert.equal(r2.status, 403);
});
