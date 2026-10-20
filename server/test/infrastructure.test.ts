process.env.NODE_ENV = "test";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app, createCorsOptions } from "../src/app.ts";
import { loadAndValidateConfig, config } from "../src/config/env.ts";
import {
  resolveMongoUri,
  ensureDBConnection,
  sanitizeDatabaseErrorMessage,
  logSanitizedConnectError,
} from "../src/config/db.ts";
import { redactSensitiveData } from "../src/middleware/logger.ts";
import { AppError, errorHandler } from "../src/middleware/error.ts";
import { createAuthRateLimiter } from "../src/middleware/rateLimit.js";
import express from "express";
import cors from "cors";

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
// 1. Config Validation Fail-Fast
// ---------------------------------------------------------------------------
test("INFRA-01: Validated config fails fast when NODE_ENV or secrets are invalid", () => {
  const origEnv = { ...process.env };
  try {
    // 1. Invalid NODE_ENV
    (process.env as any).NODE_ENV = "invalid_environment";
    assert.throws(() => loadAndValidateConfig(), /NODE_ENV must be defined and set to one of/);

    // 2. Production missing JWT_SECRET
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    process.env.MONGODB_URI = "mongodb://localhost:27017/prod";
    assert.throws(
      () => loadAndValidateConfig(),
      /JWT_SECRET must be explicitly defined and at least 32 characters in production/,
    );

    // 3. Production short JWT_SECRET
    process.env.JWT_SECRET = "too_short_secret";
    assert.throws(
      () => loadAndValidateConfig(),
      /JWT_SECRET must be at least 32 characters in production/,
    );

    // 4. Production missing MONGODB_URI
    process.env.JWT_SECRET = "a".repeat(32);
    delete process.env.MONGODB_URI;
    assert.throws(
      () => loadAndValidateConfig(),
      /MONGODB_URI environment variable is required in production/,
    );

    // 5. Production missing CORS_ORIGIN
    process.env.MONGODB_URI = "mongodb://localhost:27017/prod";
    delete process.env.CORS_ORIGIN;
    assert.throws(
      () => loadAndValidateConfig(),
      /CORS_ORIGIN environment variable is required in production/,
    );

    // 6. Wildcard CORS_ORIGIN rejected when credentials are enabled
    process.env.CORS_ORIGIN = "*";
    assert.throws(() => loadAndValidateConfig(), /Wildcard \(\*\) CORS_ORIGIN is not permitted/);

    process.env.CORS_ORIGIN = "http://client.northpeak.test";
    assert.throws(() => loadAndValidateConfig(), /Production CORS_ORIGIN entries must use HTTPS/);

    process.env.CORS_ORIGIN = "https://client.northpeak.test";
    assert.deepEqual(loadAndValidateConfig().CORS_ORIGINS, ["https://client.northpeak.test"]);
  } finally {
    process.env = origEnv;
  }
});

// ---------------------------------------------------------------------------
// 2. Structured Logging & Redaction
// ---------------------------------------------------------------------------
test("INFRA-02: Request ID header is attached and sensitive fields are redacted", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.ok(res.headers["x-request-id"]);

  // Test sensitive data redaction helper
  const sensitivePayload = {
    email: "test@northpeak.dev",
    password: "super_secret_password",
    token: "jwt.token.here",
    nested: {
      authorization: "Bearer secret_token",
      cookie: "session=123",
      safeField: "safe value",
    },
  };

  const redacted = redactSensitiveData(sensitivePayload);
  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.nested.authorization, "[REDACTED]");
  assert.equal(redacted.nested.cookie, "[REDACTED]");
  assert.equal(redacted.nested.safeField, "safe value");
  assert.equal(redacted.email, "test@northpeak.dev");
});

// ---------------------------------------------------------------------------
// 3. Security Headers & Payload Limit
// ---------------------------------------------------------------------------
test("INFRA-03: Security headers are present and X-Powered-By is suppressed", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "DENY");
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(res.headers["x-powered-by"], undefined);
});

test("INFRA-03: Request payloads exceeding 100kb are rejected with 413", async () => {
  const oversizedPayload = { data: "x".repeat(110 * 1024) };
  const res = await request(app).post("/api/auth/register").send(oversizedPayload);
  assert.equal(res.status, 413);
  assert.match(res.body.message, /too large|exceeds/i);
});

// ---------------------------------------------------------------------------
// 4. Rate Limiting on Auth Endpoints
// ---------------------------------------------------------------------------
test("INFRA-04: Rate limiter throttles excessive requests with 429", async () => {
  const testApp = express();
  const limiter = createAuthRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 2,
    message: "Rate limit reached",
  });

  const origEnv = process.env.NODE_ENV;
  try {
    process.env.TEST_RATE_LIMIT = "1";
    testApp.use("/test-login", limiter, (_req, res) => res.json({ ok: true }));

    const r1 = await request(testApp).get("/test-login");
    assert.equal(r1.status, 200);

    const r2 = await request(testApp).get("/test-login");
    assert.equal(r2.status, 200);

    const r3 = await request(testApp).get("/test-login");
    assert.equal(r3.status, 429);
    assert.equal(r3.body.message, "Rate limit reached");
    assert.ok(r3.headers["retry-after"]);
  } finally {
    process.env.NODE_ENV = origEnv;
    delete process.env.TEST_RATE_LIMIT;
  }
});

// ---------------------------------------------------------------------------
// 5. Liveness and Readiness Probes
// ---------------------------------------------------------------------------
test("INFRA-05: /api/health/live and /api/health/ready report system health", async () => {
  // Liveness
  const liveRes = await request(app).get("/api/health/live");
  assert.equal(liveRes.status, 200);
  assert.equal(liveRes.body.status, "ok");
  assert.equal(typeof liveRes.body.uptime, "number");

  // Readiness (connected)
  const readyRes = await request(app).get("/api/health/ready");
  assert.equal(readyRes.status, 200);
  assert.equal(readyRes.body.status, "ready");
  assert.equal(readyRes.body.database, "connected");
});

test("INFRA-05B: resolveMongoUri safely normalizes Atlas SRV, trailing slashes, and encoded credentials", () => {
  assert.equal(
    resolveMongoUri("mongodb+srv://user:pass@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority"),
    "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/northpeak?retryWrites=true&w=majority",
  );
  assert.equal(
    resolveMongoUri("mongodb+srv://user:pass@cluster0.abcde.mongodb.net?retryWrites=true"),
    "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/northpeak?retryWrites=true",
  );
  assert.equal(
    resolveMongoUri("mongodb+srv://user:pass@cluster0.abcde.mongodb.net/northpeak?retryWrites=true"),
    "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/northpeak?retryWrites=true",
  );
  assert.equal(
    resolveMongoUri("mongodb+srv://user:pass@cluster0.abcde.mongodb.net/custom_db/?retryWrites=true"),
    "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/custom_db?retryWrites=true",
  );
  // Multiple trailing slashes and percent-encoded credentials
  assert.equal(
    resolveMongoUri("mongodb+srv://my%40user:p%40ss%231%3A2@cluster0.abcde.mongodb.net///?retryWrites=true&w=majority"),
    "mongodb+srv://my%40user:p%40ss%231%3A2@cluster0.abcde.mongodb.net/northpeak?retryWrites=true&w=majority",
  );
  assert.equal(
    resolveMongoUri("mongodb+srv://my%40user:p%40ss%231%3A2@cluster0.abcde.mongodb.net/northpeak///?tls=true"),
    "mongodb+srv://my%40user:p%40ss%231%3A2@cluster0.abcde.mongodb.net/northpeak?tls=true",
  );
  assert.equal(
    resolveMongoUri("mongodb://localhost:27017"),
    "mongodb://localhost:27017/northpeak",
  );
  assert.equal(
    resolveMongoUri("mongodb://localhost:27017/northpeak"),
    "mongodb://localhost:27017/northpeak",
  );
});

test("INFRA-05C: logSanitizedConnectError redacts credentials across valid, malformed, and bare authority strings", () => {
  const syntheticUser = "synth_atlas_admin_99";
  const syntheticPass = "Sup3r$ecr3tP%40ssw0rd!";

  const samples = [
    `connect ECONNREFUSED mongodb+srv://${syntheticUser}:${syntheticPass}@cluster0.test.mongodb.net/northpeak?retryWrites=true`,
    `Invalid scheme in mongo://${syntheticUser}:${syntheticPass}@cluster0.test.mongodb.net/northpeak`,
    `Authentication failed for authority ${syntheticUser}:${syntheticPass}@cluster0.test.mongodb.net:27017`,
  ];

  const capturedLogs: string[] = [];
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    capturedLogs.push(args.map(String).join(" "));
  };

  try {
    for (const msg of samples) {
      const sanitized = sanitizeDatabaseErrorMessage(msg);
      assert.ok(!sanitized.includes(syntheticUser), `Sanitized message leaked username: ${sanitized}`);
      assert.ok(!sanitized.includes(syntheticPass), `Sanitized message leaked password: ${sanitized}`);

      logSanitizedConnectError(new Error(msg), {
        readyStateBefore: 0,
        readyStateAfter: 0,
      });
    }
  } finally {
    console.error = origConsoleError;
  }

  assert.equal(capturedLogs.length, samples.length);
  for (const logLine of capturedLogs) {
    assert.ok(!logLine.includes(syntheticUser), `Log output leaked username: ${logLine}`);
    assert.ok(!logLine.includes(syntheticPass), `Log output leaked password: ${logLine}`);
    const parsed = JSON.parse(logLine);
    assert.equal(parsed.level, "error");
    assert.equal(parsed.component, "database");
  }
});

test("INFRA-05E: connection diagnostics include sanitized topology and underlying network errors", () => {
  const syntheticUser = "nested_diag_user";
  const syntheticPass = "nested_diag_password";
  const networkError = Object.assign(
    new Error(`getaddrinfo EAI_AGAIN mongodb+srv://${syntheticUser}:${syntheticPass}@cluster0.example.mongodb.net`),
    { code: "EAI_AGAIN", syscall: "getaddrinfo" },
  );
  const error = Object.assign(new Error("Server selection timed out"), {
    name: "MongooseServerSelectionError",
    cause: networkError,
    reason: {
      type: "ReplicaSetNoPrimary",
      setName: "atlas-shard-0",
      servers: new Map([
        [
          `mongodb://${syntheticUser}:${syntheticPass}@cluster0.example.mongodb.net:27017`,
          { type: "Unknown", error: networkError },
        ],
      ]),
    },
  });

  const capturedLogs: string[] = [];
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    capturedLogs.push(args.map(String).join(" "));
  };

  try {
    logSanitizedConnectError(error, {
      reqId: "diagnostic-request-id",
      readyStateBefore: 0,
      readyStateAfter: 0,
    });
  } finally {
    console.error = origConsoleError;
  }

  assert.equal(capturedLogs.length, 1);
  assert.ok(!capturedLogs[0].includes(syntheticUser));
  assert.ok(!capturedLogs[0].includes(syntheticPass));
  const parsed = JSON.parse(capturedLogs[0]);
  assert.equal(parsed.reqId, "diagnostic-request-id");
  assert.equal(parsed.connectionAttempted, true);
  assert.equal(parsed.details.topologyType, "ReplicaSetNoPrimary");
  assert.equal(parsed.details.servers[0].error.code, "EAI_AGAIN");
  assert.equal(parsed.details.servers[0].error.syscall, "getaddrinfo");
  assert.equal(parsed.details.cause.code, "EAI_AGAIN");
});

test("INFRA-05D: Connection lifecycle handles failure retry, disconnect-reconnect, concurrent deduplication, and 503 middleware", async () => {
  const origConfigUri = config.MONGODB_URI;
  const origConnect = mongoose.connect;

  try {
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);

    // 1. In test mode without active connection, /api/health/ready reports 503 disconnected
    const disconnectedRes = await request(app).get("/api/health/ready");
    assert.equal(disconnectedRes.status, 503);
    assert.equal(disconnectedRes.body.status, "not_ready");
    assert.equal(disconnectedRes.body.database, "disconnected");

    // 2. Simulated initial connection failure clears connectPromise and requireDatabase returns 503
    let connectCallCount = 0;
    const origConsoleError = console.error;
    const errorLogs: string[] = [];
    console.error = (...args: any[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    try {
      mongoose.connect = (async () => {
        connectCallCount += 1;
        throw new Error(
          "Could not connect to mongodb+srv://leak_user:leak_pass@cluster0.example.mongodb.net/northpeak",
        );
      }) as typeof mongoose.connect;

      // API route protected by requireDatabase returns 503 when DB connection fails
      const apiFailRes = await request(app).get("/api/projects");
      assert.equal(apiFailRes.status, 503);
      assert.equal(apiFailRes.body.message, "Database unavailable");
      assert.equal(connectCallCount, 1);

      // Liveness and base health remain 200 OK even while DB is unavailable
      const healthRes = await request(app).get("/api/health");
      assert.equal(healthRes.status, 200);
      const liveRes = await request(app).get("/api/health/live");
      assert.equal(liveRes.status, 200);

      // Verify credentials were never logged during the failure
      assert.ok(errorLogs.length >= 1);
      for (const entry of errorLogs) {
        assert.ok(!entry.includes("leak_user"));
        assert.ok(!entry.includes("leak_pass"));
      }
    } finally {
      console.error = origConsoleError;
      mongoose.connect = origConnect;
    }

    // 3. Subsequent retry after failed connection succeeds and deduplicates concurrent callers
    config.MONGODB_URI = replSet.getUri();
    let realConnectCalls = 0;
    mongoose.connect = (async (...args: Parameters<typeof origConnect>) => {
      realConnectCalls += 1;
      return origConnect.apply(mongoose, args);
    }) as typeof mongoose.connect;

    await Promise.all([ensureDBConnection(), ensureDBConnection(), ensureDBConnection()]);
    assert.equal(realConnectCalls, 1, "Concurrent calls while disconnected must share a single mongoose.connect attempt");
    assert.equal(mongoose.connection.readyState, 1);

    const readyRes = await request(app).get("/api/health/ready");
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.status, "ready");
    assert.equal(readyRes.body.database, "connected");

    // 4. Warm container disconnect -> subsequent request reconnects cleanly (connectPromise was cleared)
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);

    await ensureDBConnection();
    assert.equal(realConnectCalls, 2, "Must initiate a fresh mongoose.connect after disconnect");
    assert.equal(mongoose.connection.readyState, 1);
  } finally {
    mongoose.connect = origConnect;
    config.MONGODB_URI = origConfigUri;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(replSet.getUri());
    }
  }
});

test("INFRA-05A: CORS accepts configured frontend origins and rejects other origins", async () => {
  const corsProbe = express();
  corsProbe.use(cors(createCorsOptions(["https://client.northpeak.test"])));
  corsProbe.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  corsProbe.use(errorHandler);

  const allowed = await request(corsProbe)
    .options("/api/health")
    .set("Origin", "https://client.northpeak.test")
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "authorization");
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers["access-control-allow-origin"], "https://client.northpeak.test");
  assert.equal(allowed.headers["access-control-allow-credentials"], "true");
  assert.match(allowed.headers["access-control-allow-headers"], /Authorization/i);

  const rejected = await request(corsProbe)
    .get("/api/health")
    .set("Origin", "https://unapproved.northpeak.test");
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers["access-control-allow-origin"], undefined);
});

// ---------------------------------------------------------------------------
// 6. Approved Deviations
// ---------------------------------------------------------------------------
test("INFRA-06 (Approved Deviation): Non-string login credentials return 400 instead of 500", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: { $ne: null }, password: "password123" });
  assert.equal(res.status, 400);
  assert.equal(res.body.message, "Email and password must be strings");
});

test("INFRA-06 (Approved Deviation): Search input is regex-escaped and matches literally", async () => {
  const { generateToken } = await import("../src/middleware/auth.ts");
  const { User } = await import("../src/models/User.ts");
  const { Project } = await import("../src/models/Project.ts");

  const manager = await User.create({
    name: "Search PM",
    email: "searchpm@northpeak.dev",
    passwordHash: "hash",
    role: "manager",
  });
  const token = generateToken({
    id: manager._id.toString(),
    email: manager.email,
    role: "manager",
    name: manager.name,
  });

  await Project.create({
    title: "Special [Project] (Beta) *",
    manager: manager._id,
    priority: "high",
  });

  // Searching for literal special regex characters "[Project]" does not crash with 500
  const res = await request(app)
    .get("/api/projects?search=[Project]")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, "Special [Project] (Beta) *");
});

test("INFRA-06 (Approved Deviation): Activity limit parameter is capped at 100", async () => {
  const { generateToken } = await import("../src/middleware/auth.ts");
  const { User } = await import("../src/models/User.ts");
  const dev = await User.create({
    name: "Activity Dev",
    email: "actdev@northpeak.dev",
    passwordHash: "hash",
    role: "developer",
  });
  const token = generateToken({
    id: dev._id.toString(),
    email: dev.email,
    role: "developer",
    name: dev.name,
  });

  const res = await request(app)
    .get("/api/activity?limit=5000")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
});
