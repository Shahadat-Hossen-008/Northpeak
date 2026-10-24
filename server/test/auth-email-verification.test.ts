process.env.NODE_ENV = "test";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../src/index.ts";
import { User } from "../src/models/User.ts";
import { Activity } from "../src/models/Activity.ts";
import { PendingRegistration } from "../src/models/PendingRegistration.ts";
import { hashVerificationCode } from "../src/services/auth/auth.utils.ts";

let replSet: MongoMemoryReplSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
  await PendingRegistration.init();
  await User.init();
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

const EMAIL = "authv@northpeak.dev";
const CODE = "123456";

// In the test environment no email is sent, so the tests store a code they know.
async function plantCode(email: string, code = CODE, extra: Record<string, unknown> = {}) {
  await PendingRegistration.updateOne(
    { email },
    { $set: { codeHash: hashVerificationCode(email, code), ...extra } },
  );
}

async function expireCooldown(email: string) {
  await PendingRegistration.updateOne({ email }, { $set: { resendAvailableAt: new Date(0) } });
}

function signUp(body: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/auth/register")
    .send({ name: "Alex", email: EMAIL, password: "password123", ...body });
}

function verify(code = CODE, email = EMAIL) {
  return request(app).post("/api/auth/verify-email").send({ email, code });
}

test("AUTHV-01: register, verify, then login with the same password succeeds", async () => {
  assert.equal((await signUp()).status, 201);
  assert.equal(await User.countDocuments({ email: EMAIL }), 0);
  await plantCode(EMAIL);
  assert.equal((await verify()).status, 200);
  const login = await request(app).post("/api/auth/login").send({ email: EMAIL, password: "password123" });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
});

test("AUTHV-02: a second register after the cooldown replaces the data; inside it returns 429", async () => {
  assert.equal((await signUp({ name: "First", password: "firstpass1", role: "developer" })).status, 201);
  await plantCode(EMAIL, "111111");
  assert.equal((await signUp({ name: "Second" })).status, 429);

  await expireCooldown(EMAIL);
  assert.equal((await signUp({ name: "Second", password: "secondpass2", role: "manager" })).status, 201);
  await plantCode(EMAIL, "222222");

  assert.equal((await verify("111111")).status, 400);
  assert.equal((await verify("222222")).status, 200);
  const user = await User.findOne({ email: EMAIL });
  assert.equal(user?.name, "Second");
  assert.equal(user?.role, "manager");
  const ok = await request(app).post("/api/auth/login").send({ email: EMAIL, password: "secondpass2" });
  assert.equal(ok.status, 200);
  const old = await request(app).post("/api/auth/login").send({ email: EMAIL, password: "firstpass1" });
  assert.equal(old.status, 401);
});

test("AUTHV-03: an expired pending record does not block a new register", async () => {
  assert.equal((await signUp()).status, 201);
  await PendingRegistration.updateOne(
    { email: EMAIL },
    { $set: { expiresAt: new Date(Date.now() - 1000), resendAvailableAt: new Date(Date.now() - 1000) } },
  );
  assert.equal((await signUp({ name: "Again" })).status, 201);
  const pending = await PendingRegistration.findOne({ email: EMAIL });
  assert.equal(pending?.name, "Again");
  assert.ok(pending && pending.expiresAt.getTime() > Date.now());
});

test("AUTHV-04: resend replaces the code; a failed send restores the old code", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL, "111111");
  await expireCooldown(EMAIL);

  const resend = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  assert.equal(resend.status, 200);
  assert.equal((await verify("111111")).status, 400);
  await plantCode(EMAIL, "222222", { attempts: 0 });
  await expireCooldown(EMAIL);

  // Real delivery is not configured here, so the send fails and the old state must come back.
  const before = await PendingRegistration.findOne({ email: EMAIL }).select("+codeHash");
  // SMTP settings are blanked first so this can never reach a real mail server.
  const savedEnv = { ...process.env };
  process.env.NODE_ENV = "development";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  process.env.EMAIL_FROM = "";
  let failed;
  try {
    failed = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  } finally {
    process.env.NODE_ENV = savedEnv.NODE_ENV;
    for (const k of ["SMTP_USER", "SMTP_PASS", "EMAIL_FROM"]) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }
  assert.ok(failed.status >= 500, `status ${failed.status} ${JSON.stringify(failed.body)}`);
  const after = await PendingRegistration.findOne({ email: EMAIL }).select("+codeHash");
  assert.equal(after?.codeHash, before?.codeHash);
  assert.equal(after?.resendAvailableAt.getTime(), before?.resendAvailableAt.getTime());

  const retry = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  assert.equal(retry.status, 200);
  await plantCode(EMAIL, "222222");
  assert.equal((await verify("222222")).status, 200);
});

test("AUTHV-05: 20 parallel wrong codes leave attempts at exactly 5", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL);
  const results = await Promise.all(Array.from({ length: 20 }, () => verify("000000")));
  assert.ok(results.every((r) => r.status === 400));
  const pending = await PendingRegistration.findOne({ email: EMAIL });
  assert.equal(pending?.attempts, 5);
  assert.equal((await verify()).status, 400);
  assert.equal(await User.countDocuments({ email: EMAIL }), 0);
});

test("AUTHV-06: 5 parallel correct verifications give one 200, one User, one Activity", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL);
  const results = await Promise.all(Array.from({ length: 5 }, () => verify()));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(await User.countDocuments({ email: EMAIL }), 1);
  assert.equal(await Activity.countDocuments({ message: /^joined/ }), 1);
  assert.equal(await PendingRegistration.countDocuments({ email: EMAIL }), 0);
});

test("AUTHV-07: a User created meanwhile makes verification fail and keeps the pending record", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL);
  await User.create({ name: "Other", email: EMAIL, passwordHash: "x", role: "developer", emailVerified: true });
  const res = await verify();
  assert.ok(res.status >= 400);
  assert.equal(await PendingRegistration.countDocuments({ email: EMAIL }), 1);
  assert.equal(await User.countDocuments({ email: EMAIL }), 1);
});

test("AUTHV-08: register writes no Activity and GET /api/activity still returns 200", async () => {
  assert.equal((await signUp()).status, 201);
  assert.equal(await Activity.countDocuments({}), 0);
  await plantCode(EMAIL);
  const verified = await verify();
  assert.equal(verified.status, 200);
  const res = await request(app)
    .get("/api/activity")
    .set("Authorization", `Bearer ${verified.body.token}`);
  assert.equal(res.status, 200);
});
