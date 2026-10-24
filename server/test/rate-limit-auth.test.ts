process.env.NODE_ENV = "test";

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { REGISTER_RATE_LIMIT, RESEND_RATE_LIMIT, VERIFY_RATE_LIMIT } from "../src/app.ts";

let mongod: MongoMemoryServer;

before(async () => {
  // The limiters are off in the test environment unless TEST_RATE_LIMIT is set, as in INFRA-04.
  process.env.TEST_RATE_LIMIT = "1";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  delete process.env.TEST_RATE_LIMIT;
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});

// The existing verification limiter is shared by verify-email, resend-verification and google
// and its counts live inside the app module. Each test loads its own copy of the app so that
// the counts of one endpoint do not leak into another.
let appCopy = 0;
async function freshApp() {
  const mod = await import(`../src/app.ts?rate-auth=${++appCopy}`);
  return mod.app as import("express").Express;
}

// Empty bodies are rejected or answered generically by the service, so no email is sent.
async function assertLimit(path: string, limit: number) {
  const app = await freshApp();
  for (let i = 0; i < limit; i++) {
    const res = await request(app).post(path).send({});
    assert.notEqual(res.status, 429, `request ${i + 1} must not be limited`);
  }
  const over = await request(app).post(path).send({});
  assert.equal(over.status, 429);
  assert.equal(typeof over.body.message, "string");
  assert.ok(over.headers["retry-after"]);
}

test("RATE-AUTH-01: POST /api/auth/register returns 429 after its limit", async () => {
  await assertLimit("/api/auth/register", REGISTER_RATE_LIMIT.maxRequests);
});

test("RATE-AUTH-02: POST /api/auth/resend-verification returns 429 after its limit", async () => {
  await assertLimit("/api/auth/resend-verification", RESEND_RATE_LIMIT.maxRequests);
});

test("RATE-AUTH-03: POST /api/auth/verify-email returns 429 after its limit", async () => {
  await assertLimit("/api/auth/verify-email", VERIFY_RATE_LIMIT.maxRequests);
});
