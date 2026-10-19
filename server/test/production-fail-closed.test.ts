// Runs the real app module under NODE_ENV=production against a STANDALONE MongoDB (no replica
// set) to prove the fail-closed behaviour. Values below are throwaway test fixtures, not real
// configuration or secrets.
process.env.NODE_ENV = "production";
process.env.JWT_SECRET = "test-only-".padEnd(48, "x");
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/never-used-in-this-test";
process.env.CORS_ORIGIN = "https://example.invalid";

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let app: any;
let models: { User: any; Project: any; Task: any };
let generateToken: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import("../src/app.ts")).app;
  models = {
    User: (await import("../src/models/User.ts")).User,
    Project: (await import("../src/models/Project.ts")).Project,
    Task: (await import("../src/models/Task.ts")).Task,
  };
  generateToken = (await import("../src/middleware/auth.ts")).generateToken;
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});

async function seed() {
  const { User, Project, Task } = models;
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
  const manager = await User.create({
    name: "M",
    email: "m@x.invalid",
    passwordHash: "h",
    role: "manager",
  });
  const dev = await User.create({
    name: "D",
    email: "d@x.invalid",
    passwordHash: "h",
    role: "developer",
  });
  const project = await Project.create({
    title: "P",
    manager: manager._id,
    team: [dev._id],
    priority: "low",
  });
  const task = await Task.create({ project: project._id, title: "T", assignedDeveloper: dev._id });
  const token = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: "M",
  });
  return { manager, dev, project, task, token };
}

test("PROD-01: production fails closed (503, nothing mutated) when transactions are unavailable", async () => {
  const { project, task, dev, token } = await seed();
  const res = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ team: [] });

  assert.equal(res.status, 503);
  const body = JSON.stringify(res.body);
  assert.doesNotMatch(
    body,
    /transaction numbers|replica set member|mongos|stack/i,
    "no database internals leaked",
  );

  const freshProject = await models.Project.findById(project._id);
  assert.equal(freshProject.team.length, 1, "team must be unchanged");
  const freshTask = await models.Task.findById(task._id);
  assert.equal(
    freshTask.assignedDeveloper?.toString(),
    dev._id.toString(),
    "assignment must be unchanged",
  );
});

test("PROD-02: non-team project updates do not require transactions and still succeed", async () => {
  const { project, token } = await seed();
  const res = await request(app)
    .patch(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Renamed" });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, "Renamed");
});

test("PROD-03: test-only barrier endpoints are not reachable in the real production app", async () => {
  const { token } = await seed();
  for (const path of ["/api/test/barriers/reset", "/api/test/barriers/configure"]) {
    const res = await request(app).post(path).set("Authorization", `Bearer ${token}`).send({});
    assert.equal(res.status, 404, path);
  }
});

test("PROD-04: production error responses do not leak stack traces or DB details", async () => {
  const res = await request(app)
    .get("/api/projects/not-an-object-id")
    .set("Authorization", "Bearer garbage");
  assert.equal(res.status, 401);
  assert.doesNotMatch(JSON.stringify(res.body), /node_modules|at .*\(.*:\d+:\d+\)/);
});

test("PROD-05: CORS permits configured client origins and rejects unapproved origins", async () => {
  const { token } = await seed();

  // Allowed origin succeeds and receives explicit CORS headers
  const allowedRes = await request(app)
    .get("/api/projects")
    .set("Origin", "https://example.invalid")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(allowedRes.status, 200);
  assert.equal(allowedRes.headers["access-control-allow-origin"], "https://example.invalid");
  assert.equal(allowedRes.headers["access-control-allow-credentials"], "true");

  // Allowed preflight OPTIONS succeeds
  const preflightOk = await request(app)
    .options("/api/projects")
    .set("Origin", "https://example.invalid")
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "Authorization,Content-Type");
  assert.equal(preflightOk.status, 204);
  assert.equal(preflightOk.headers["access-control-allow-origin"], "https://example.invalid");

  // Unapproved origin is rejected with 403 and receives no Access-Control-Allow-Origin header
  const rejectedRes = await request(app)
    .get("/api/projects")
    .set("Origin", "https://unapproved.example.com")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(rejectedRes.status, 403);
  assert.equal(rejectedRes.headers["access-control-allow-origin"], undefined);

  const rejectedPreflight = await request(app)
    .options("/api/projects")
    .set("Origin", "https://unapproved.example.com")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(rejectedPreflight.status, 403);
  assert.equal(rejectedPreflight.headers["access-control-allow-origin"], undefined);
});
