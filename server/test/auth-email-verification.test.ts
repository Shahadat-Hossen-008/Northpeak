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

test("AUTHV-02: 5 registers succeed, 6th returns 429 with 'Try again in'", async () => {
  for (let i = 1; i <= 5; i++) {
    const res = await signUp({ name: `User ${i}` });
    assert.equal(res.status, 201);
  }
  const pending = await PendingRegistration.findOne({ email: EMAIL });
  assert.equal(pending?.sendCount, 5);
  assert.equal(pending?.name, "User 5");

  const sixth = await signUp({ name: "User 6" });
  assert.equal(sixth.status, 429);
  assert.match(sixth.body.message, /Try again in \d+ minute/);
});

test("AUTHV-03: an expired pending record does not block a new register", async () => {
  assert.equal((await signUp()).status, 201);
  await PendingRegistration.updateOne(
    { email: EMAIL },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal((await signUp({ name: "Again" })).status, 201);
  const pending = await PendingRegistration.findOne({ email: EMAIL });
  assert.equal(pending?.name, "Again");
  assert.equal(pending?.sendCount, 1);
  assert.ok(pending && pending.expiresAt.getTime() > Date.now());
});

test("AUTHV-04: resend counts toward 5; failed send restores code, codeExpiresAt, sendCount", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL, "111111");

  const resend1 = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  assert.equal(resend1.status, 200);
  assert.equal((await verify("111111")).status, 400);

  const before = await PendingRegistration.findOne({ email: EMAIL }).select("+codeHash");
  assert.equal(before?.sendCount, 2);

  // Real delivery is not configured here, so the send fails and the old state must come back.
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
  assert.equal(after?.codeExpiresAt.getTime(), before?.codeExpiresAt.getTime());
  assert.equal(after?.sendCount, before?.sendCount);

  // 3 more resends reach the limit (total 5: 1 signup + 1 resend + 3 resends)
  assert.equal((await request(app).post("/api/auth/resend-verification").send({ email: EMAIL })).status, 200);
  assert.equal((await request(app).post("/api/auth/resend-verification").send({ email: EMAIL })).status, 200);
  assert.equal((await request(app).post("/api/auth/resend-verification").send({ email: EMAIL })).status, 200);

  const sixth = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  assert.equal(sixth.status, 429);
  assert.match(sixth.body.message, /Try again in \d+ minute/);
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

test("AUTHV-09: expired codeExpiresAt returns 400; resend still works", async () => {
  assert.equal((await signUp()).status, 201);
  await plantCode(EMAIL, CODE);
  await PendingRegistration.updateOne(
    { email: EMAIL },
    { $set: { codeExpiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal((await verify(CODE)).status, 400);

  const resend = await request(app).post("/api/auth/resend-verification").send({ email: EMAIL });
  assert.equal(resend.status, 200);
  await plantCode(EMAIL, "654321");
  assert.equal((await verify("654321")).status, 200);
  assert.equal(await User.countDocuments({ email: EMAIL }), 1);
});

test("AUTHV-10: 10 parallel registers give <= 5 successes, rest 429, sendCount <= 5", async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => signUp({ name: `Concurrent ${i}` })),
  );
  const successes = results.filter((r) => r.status === 201);
  const rateLimited = results.filter((r) => r.status === 429);
  assert.equal(successes.length + rateLimited.length, 10, "every request must be 201 or 429");
  assert.ok(successes.length <= 5, `expected <= 5 successes, got ${successes.length}`);
  assert.ok(rateLimited.length >= 5, `expected >= 5 rate-limited, got ${rateLimited.length}`);
  const pending = await PendingRegistration.findOne({ email: EMAIL });
  assert.ok(pending && pending.sendCount <= 5, `sendCount must be <= 5, got ${pending?.sendCount}`);
});

test("AUTHV-11: second party register replaces password & first code stops verifying", async () => {
  assert.equal(
    (await signUp({ name: "Alice", password: "firstPassword1", role: "developer" })).status,
    201,
  );
  await plantCode(EMAIL, "111111");

  assert.equal(
    (await signUp({ name: "Bob", password: "secondPassword2", role: "manager" })).status,
    201,
  );
  await plantCode(EMAIL, "222222");

  assert.equal((await verify("111111")).status, 400);
  assert.equal((await verify("222222")).status, 200);

  const user = await User.findOne({ email: EMAIL });
  assert.equal(user?.name, "Bob");
  assert.equal(user?.role, "manager");

  const loginBob = await request(app)
    .post("/api/auth/login")
    .send({ email: EMAIL, password: "secondPassword2" });
  assert.equal(loginBob.status, 200);

  const loginAlice = await request(app)
    .post("/api/auth/login")
    .send({ email: EMAIL, password: "firstPassword1" });
  assert.equal(loginAlice.status, 401);
});
