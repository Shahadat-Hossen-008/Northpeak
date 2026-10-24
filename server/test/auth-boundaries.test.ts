process.env.NODE_ENV = "test";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../src/app.ts";
import { config } from "../src/config/env.ts";
import { User } from "../src/models/User.ts";
import { PendingRegistration } from "../src/models/PendingRegistration.ts";
import { hashVerificationCode } from "../src/services/auth/auth.utils.ts";
import { generateToken } from "../src/middleware/auth.ts";

let mongod: MongoMemoryReplSet;

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongod.getUri());
});
after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});
beforeEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

const PROTECTED: Array<[string, string]> = [
  ["get", "/api/auth/me"],
  ["get", "/api/projects"],
  ["get", "/api/tasks"],
  ["get", "/api/members"],
  ["get", "/api/notifications"],
  ["get", "/api/activity"],
  ["get", "/api/comments/counts"],
  ["get", "/api/subtasks"],
  ["post", "/api/projects"],
  ["patch", "/api/auth/profile"],
];

test("AUTH-01: every protected endpoint rejects missing credentials with 401", async () => {
  for (const [method, path] of PROTECTED) {
    const res = await (request(app) as any)[method](path).send({});
    assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
  }
});

test("AUTH-02: malformed, tampered, wrong-secret and expired tokens are rejected with 401", async () => {
  const user = await User.create({
    name: "Auth User",
    email: "auth@x.invalid",
    passwordHash: "h",
    role: "developer",
  });
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: "developer",
    name: user.name,
  };

  const valid = generateToken(payload as any);
  const ok = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${valid}`);
  assert.equal(ok.status, 200);

  const expired = jwt.sign(payload, config.JWT_SECRET, { expiresIn: -60 });
  const wrongSecret = jwt.sign(payload, "a-completely-different-secret-value-0000");
  const tampered = valid.slice(0, -4) + (valid.endsWith("AAAA") ? "BBBB" : "AAAA");
  const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.`;

  for (const [label, token] of Object.entries({
    expired,
    wrongSecret,
    tampered,
    noneAlg,
    garbage: "not.a.jwt",
  })) {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 401, label);
    assert.match(res.body.message, /invalid or expired/i, label);
  }

  const basic = await request(app).get("/api/auth/me").set("Authorization", `Basic ${valid}`);
  assert.equal(basic.status, 401);
});

test("AUTH-03: a valid token for a deleted account is rejected", async () => {
  const user = await User.create({
    name: "Gone",
    email: "gone@x.invalid",
    passwordHash: "h",
    role: "developer",
  });
  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
    role: "developer",
    name: "Gone",
  });
  await User.deleteOne({ _id: user._id });
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
});

test("AUTH-04: role is taken from the database, not from a forged token claim", async () => {
  const dev = await User.create({
    name: "Dev",
    email: "dev@x.invalid",
    passwordHash: "h",
    role: "developer",
  });
  const forged = generateToken({
    id: dev._id.toString(),
    email: dev.email,
    role: "manager",
    name: "Dev",
  });
  const res = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${forged}`)
    .send({ title: "Should not be created" });
  assert.equal(res.status, 403);
});

test("AUTH-05: register -> login -> me -> change password -> old password rejected, new accepted", async () => {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ name: "New Person", email: "new@x.invalid", password: "first-pass-1" });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.requiresEmailVerification, true);
  assert.equal(reg.body.email, "new@x.invalid");
  assert.equal(
    JSON.stringify(reg.body).includes("passwordHash"),
    false,
    "hash must never be serialized",
  );
  assert.equal(await User.countDocuments({ email: "new@x.invalid" }), 0);

  await PendingRegistration.updateOne(
    { email: "new@x.invalid" },
    { $set: { codeHash: hashVerificationCode("new@x.invalid", "123456") } },
  );
  const planted = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: "new@x.invalid", code: "123456" });
  assert.equal(planted.status, 200);
  const verifiedUser = await User.findOne({ email: "new@x.invalid" });
  assert.equal(verifiedUser?.emailVerified, true);

  const dup = await request(app)
    .post("/api/auth/register")
    .send({ name: "New Person", email: "new@x.invalid", password: "first-pass-1" });
  assert.ok([400, 409].includes(dup.status));

  const bad = await request(app)
    .post("/api/auth/login")
    .send({ email: "new@x.invalid", password: "wrong-pass" });
  assert.equal(bad.status, 401);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "new@x.invalid", password: "first-pass-1" });
  assert.equal(login.status, 200);
  const token = login.body.token;

  const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(me.status, 200);

  const short = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ password: "123" });
  assert.equal(short.status, 400);

  const change = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ password: "second-pass-2" });
  assert.equal(change.status, 200);

  const oldLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "new@x.invalid", password: "first-pass-1" });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "new@x.invalid", password: "second-pass-2" });
  assert.equal(newLogin.status, 200);
});

test("AUTH-06: login does not reveal whether an email exists", async () => {
  await User.create({
    name: "Exists",
    email: "exists@x.invalid",
    passwordHash: "h",
    role: "developer",
  });
  const a = await request(app)
    .post("/api/auth/login")
    .send({ email: "exists@x.invalid", password: "nope-nope" });
  const b = await request(app)
    .post("/api/auth/login")
    .send({ email: "missing@x.invalid", password: "nope-nope" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.message, b.body.message);
});
