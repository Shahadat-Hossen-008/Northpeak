process.env.NODE_ENV = "test";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/index.ts";
import { User } from "../src/models/User.ts";
import { PendingRegistration } from "../src/models/PendingRegistration.ts";
import { hashVerificationCode } from "../src/services/auth/auth.utils.ts";
import { Notification } from "../src/models/Notification.ts";

import { MongoMemoryReplSet } from "mongodb-memory-server";

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

// ---------------------------------------------------------------------------
// Public registration honors the selected role, defaulting to developer.
// ---------------------------------------------------------------------------
test("AUTH-REG: POST /api/auth/register honors client-supplied manager role", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Attacker Manager",
      email: "attacker@northpeak.dev",
      password: "password123",
      role: "manager",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.requiresEmailVerification, true);
  assert.equal(res.body.email, "attacker@northpeak.dev");

  assert.equal(await User.countDocuments({ email: "attacker@northpeak.dev" }), 0);
  await PendingRegistration.updateOne(
    { email: "attacker@northpeak.dev" },
    { $set: { codeHash: hashVerificationCode("attacker@northpeak.dev", "123456") } },
  );
  const planted = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: "attacker@northpeak.dev", code: "123456" });
  assert.equal(planted.status, 200);

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "attacker@northpeak.dev", password: "password123" });
  assert.equal(loginRes.status, 200);
  assert.equal(
    loginRes.body.user.role,
    "manager",
    `Expected manager role, but got: ${loginRes.body.user.role}`,
  );

  const userInDb = await User.findById(loginRes.body.user.id);
  assert.ok(userInDb);
  assert.equal(
    userInDb.role,
    "manager",
    `Expected database document to have manager role, but got: ${userInDb.role}`,
  );
});

// ---------------------------------------------------------------------------
// Issue B: PATCH /api/notifications/mark-read must scope updates to caller's notifications
// ---------------------------------------------------------------------------
test("SEC-B: PATCH /api/notifications/mark-read cannot mark another user's private notification as read", async () => {
  // 1. Create Victim (developer)
  const victimRes = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Victim Dev",
      email: "victim@northpeak.dev",
      password: "password123",
    });
  assert.equal(victimRes.status, 201);
  await PendingRegistration.updateOne(
    { email: "victim@northpeak.dev" },
    { $set: { codeHash: hashVerificationCode("victim@northpeak.dev", "123456") } },
  );
  const victimVerify = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: "victim@northpeak.dev", code: "123456" });
  assert.equal(victimVerify.status, 200);
  const victimUser = await User.findOne({ email: "victim@northpeak.dev" });
  assert.ok(victimUser);
  const victimId = victimUser._id.toString();

  // 2. Create Attacker (developer)
  const attackerRes = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Attacker Dev",
      email: "attacker_dev@northpeak.dev",
      password: "password123",
    });
  assert.equal(attackerRes.status, 201);
  await PendingRegistration.updateOne(
    { email: "attacker_dev@northpeak.dev" },
    { $set: { codeHash: hashVerificationCode("attacker_dev@northpeak.dev", "123456") } },
  );
  const attackerVerify = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: "attacker_dev@northpeak.dev", code: "123456" });
  assert.equal(attackerVerify.status, 200);
  const attackerUser = await User.findOne({ email: "attacker_dev@northpeak.dev" });
  assert.ok(attackerUser);
  const attackerLoginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "attacker_dev@northpeak.dev", password: "password123" });
  assert.equal(attackerLoginRes.status, 200);
  const attackerToken = attackerLoginRes.body.token;

  // 3. Create a private unread notification for the victim
  const victimNotification = await Notification.create({
    recipient: victimId,
    audience: null,
    kind: "task_assigned",
    title: "Confidential Victim Task",
    body: "Only victim should manage this notification",
    isRead: false,
  });

  // 4. Attacker attempts to mark victim's notification as read
  const markRes = await request(app)
    .patch("/api/notifications/mark-read")
    .set("Authorization", `Bearer ${attackerToken}`)
    .send({ ids: [victimNotification._id.toString()] });

  assert.equal(markRes.status, 200);

  // 5. Verify victim's notification remains unread
  const refreshed = await Notification.findById(victimNotification._id);
  assert.ok(refreshed);
  assert.equal(
    refreshed.isRead,
    false,
    "Vulnerability confirmed: attacker marked another user's notification as read!",
  );
  // 6. Positive verification (CR-04): Victim can mark their own notification as read
  const victimTokenRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "victim@northpeak.dev", password: "password123" });
  assert.equal(victimTokenRes.status, 200);

  const victimOwnMarkRes = await request(app)
    .patch("/api/notifications/mark-read")
    .set("Authorization", `Bearer ${victimTokenRes.body.token}`)
    .send({ ids: [victimNotification._id.toString()] });
  assert.equal(victimOwnMarkRes.status, 200);

  const victimReadRefreshed = await Notification.findById(victimNotification._id);
  assert.ok(victimReadRefreshed);
  assert.equal(victimReadRefreshed.isRead, true, "Victim should be able to mark their own notification as read");
});

// ---------------------------------------------------------------------------
// Issue D: /api/test/barriers/* must only be mounted when NODE_ENV === "test"
// ---------------------------------------------------------------------------
test("SEC-D: /api/test/barriers routes return 404 when NODE_ENV === 'production'", async () => {
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const res = await request(app).post("/api/test/barriers/reset").send();
    assert.equal(res.status, 404);
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});


test("SEC-D: /api/test/barriers is mounted conditionally only when NODE_ENV === 'test'", async () => {
  // 1. Verify in-memory mount in test environment
  const hasBarrierLayer = (app as any)._router?.stack?.some(
    (layer: any) => layer.regexp && layer.regexp.test("/api/test/barriers"),
  );
  assert.equal(hasBarrierLayer, true, "Barrier route must be mounted in test environment");

  // 2. Verify source code strictly guards mounting with process.env.NODE_ENV === 'test'
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  assert.match(
    src,
    /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*["']test["']\s*\)\s*\{\s*app\.use\(\s*["']\/api\/test\/barriers["']/,
    "app.ts must conditionally mount test barriers only when NODE_ENV === 'test'",
  );
});

test("SEC-D: /api/test/barriers routes are functional when NODE_ENV === 'test'", async () => {
  // Promote a user to manager directly in DB for testing barriers (CR-03: clean auth setup)
  const managerUser = await User.create({
    name: "Barrier Admin",
    email: "barrier_admin@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });

  const { generateToken } = await import("../src/middleware/auth.ts");
  const managerToken = generateToken({
    id: managerUser._id.toString(),
    email: managerUser.email,
    role: "manager",
    name: managerUser.name,
  });

  const res = await request(app)
    .post("/api/test/barriers/reset")
    .set("Authorization", `Bearer ${managerToken}`)
    .send();

  assert.equal(res.status, 200);
  assert.equal(res.body.reset, true);
});

// ---------------------------------------------------------------------------
// Index cleanup script safety guards (isolated replica set)
// ---------------------------------------------------------------------------
test("IDX-SAFE-A: drop-redundant-indexes skips indexes that do not exist and reports 'not present'", async () => {
  const { runDropRedundantIndexes } = await import("../scripts/drop-redundant-indexes.ts");
  const records = await runDropRedundantIndexes({
    uri: replSet.getUri("northpeak_idx_safe_a"),
    apply: true,
    allowProduction: false,
    nodeEnv: "test",
  });
  assert.ok(records.length > 0);
  for (const r of records) {
    assert.equal(r.existsOnDisk, false);
    assert.equal(r.action, "not present");
  }
});

test("IDX-SAFE-B: drop-redundant-indexes refuses NODE_ENV=production without --allow-production", async () => {
  const { runDropRedundantIndexes } = await import("../scripts/drop-redundant-indexes.ts");
  await assert.rejects(
    () =>
      runDropRedundantIndexes({
        uri: replSet.getUri("northpeak_idx_safe_b"),
        apply: false,
        allowProduction: false,
        nodeEnv: "production",
      }),
    /Refusing to run in NODE_ENV=production without --allow-production flag/,
  );
});

test("IDX-SAFE-C: drop-redundant-indexes never drops _id_, unique, or TTL indexes", async () => {
  const { runDropRedundantIndexes } = await import("../scripts/drop-redundant-indexes.ts");
  const uri = replSet.getUri("northpeak_idx_safe_c");
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    const coll = conn.db!.collection("tasks");
    await coll.createIndex({ project: 1, deadline: 1 });
    await coll.createIndex({ email: 1 }, { name: "unique_idx", unique: true });
    await coll.createIndex({ expiresAt: 1 }, { name: "ttl_idx", expireAfterSeconds: 0 });

    const records = await runDropRedundantIndexes({
      uri,
      apply: true,
      allowProduction: false,
      nodeEnv: "test",
      allowlist: [
        { collection: "tasks", indexName: "_id_", replacementNames: ["project_1_deadline_1"] },
        { collection: "tasks", indexName: "unique_idx", replacementNames: ["project_1_deadline_1"] },
        { collection: "tasks", indexName: "ttl_idx", replacementNames: ["project_1_deadline_1"] },
      ],
    });

    assert.equal(records.length, 3);
    for (const r of records) {
      assert.equal(r.action, "skip (protected _id/unique/TTL index)");
    }

    const remaining = new Set((await coll.indexes()).map((i) => i.name));
    assert.equal(remaining.has("_id_"), true);
    assert.equal(remaining.has("unique_idx"), true);
    assert.equal(remaining.has("ttl_idx"), true);
  } finally {
    await conn.close();
  }
});

test("IDX-SAFE-D: drop-redundant-indexes refuses to drop a legacy index whose replacement is missing", async () => {
  const { runDropRedundantIndexes } = await import("../scripts/drop-redundant-indexes.ts");
  const uri = replSet.getUri("northpeak_idx_safe_d");
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    const coll = conn.db!.collection("tasks");
    await coll.createIndex({ project: 1, status: 1 }, { name: "project_1_status_1" });

    const records = await runDropRedundantIndexes({
      uri,
      apply: true,
      allowProduction: false,
      nodeEnv: "test",
      allowlist: [
        {
          collection: "tasks",
          indexName: "project_1_status_1",
          replacementNames: ["project_1_deadline_1"],
        },
      ],
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].existsOnDisk, true);
    assert.equal(records[0].replacementPresent, false);
    assert.equal(records[0].action, "skip (missing replacement: project_1_deadline_1)");

    const remaining = new Set((await coll.indexes()).map((i) => i.name));
    assert.equal(remaining.has("project_1_status_1"), true);
  } finally {
    await conn.close();
  }
});
