import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApiUrl, request, resolveApiBaseUrl } from "../src/backend/client.ts";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test("API-URL-01: constructs normalized production URLs for representative endpoints without double /api", () => {
  const prodOrigin = "https://api.northpeak.example.com";
  const endpoints: Array<[string, string]> = [
    ["/auth/login", "https://api.northpeak.example.com/api/auth/login"],
    ["/auth/register", "https://api.northpeak.example.com/api/auth/register"],
    ["/auth/me", "https://api.northpeak.example.com/api/auth/me"],
    ["/projects", "https://api.northpeak.example.com/api/projects"],
    ["/api/api/projects", "https://api.northpeak.example.com/api/projects"],
    ["/api/api?ready=true", "https://api.northpeak.example.com/api?ready=true"],
    ["/projects/proj-1", "https://api.northpeak.example.com/api/projects/proj-1"],
    ["/tasks?projectId=proj-1", "https://api.northpeak.example.com/api/tasks?projectId=proj-1"],
    ["/tasks/task-1/complete", "https://api.northpeak.example.com/api/tasks/task-1/complete"],
    ["/subtasks/task/task-1", "https://api.northpeak.example.com/api/subtasks/task/task-1"],
    ["/comments/task/task-1", "https://api.northpeak.example.com/api/comments/task/task-1"],
    ["/members?projectId=proj-1", "https://api.northpeak.example.com/api/members?projectId=proj-1"],
    ["/notifications/mark-read", "https://api.northpeak.example.com/api/notifications/mark-read"],
    ["/activity?limit=20", "https://api.northpeak.example.com/api/activity?limit=20"],
  ];

  for (const [endpoint, expected] of endpoints) {
    assert.equal(buildApiUrl(endpoint, { VITE_API_BASE_URL: prodOrigin, PROD: true }), expected);
  }
});

test("API-URL-02: handles trailing slashes and /api suffixes consistently without producing /api/api", () => {
  const baseVariants = [
    "https://api.northpeak.example.com",
    "https://api.northpeak.example.com/",
    "https://api.northpeak.example.com///",
    "https://api.northpeak.example.com/api",
    "https://api.northpeak.example.com/api/",
  ];

  for (const base of baseVariants) {
    assert.equal(
      resolveApiBaseUrl({ VITE_API_BASE_URL: base, PROD: true }),
      "https://api.northpeak.example.com/api",
      base,
    );
    assert.equal(
      buildApiUrl("/projects", { VITE_API_BASE_URL: base, PROD: true }),
      "https://api.northpeak.example.com/api/projects",
      base,
    );
    assert.equal(
      buildApiUrl("projects", { VITE_API_BASE_URL: base, PROD: true }),
      "https://api.northpeak.example.com/api/projects",
      base,
    );
    assert.equal(
      buildApiUrl("/api/projects", { VITE_API_BASE_URL: base, PROD: true }),
      "https://api.northpeak.example.com/api/projects",
      base,
    );
  }
});

test("API-URL-03: rejects missing, relative, localhost, and HTTP production API URLs", () => {
  for (const invalidProdValue of [
    undefined,
    "",
    "   ",
    "/api",
    "/api/",
    "http://localhost:5000",
    "http://api.northpeak.test",
    "http://127.0.0.1:5000",
    "http://[::1]:5000",
  ]) {
    assert.throws(
      () => resolveApiBaseUrl({ VITE_API_BASE_URL: invalidProdValue, PROD: true }),
      /ConfigError/,
      `Expected production error for VITE_API_BASE_URL=${String(invalidProdValue)}`,
    );
  }
});

test("API-URL-04: supports local development via Vite /api proxy or explicit local API URL", () => {
  assert.equal(resolveApiBaseUrl({ DEV: true }), "/api");
  assert.equal(buildApiUrl("/projects", { DEV: true }), "/api/projects");
  assert.equal(
    buildApiUrl("/projects", { VITE_API_BASE_URL: "http://localhost:5000", DEV: true }),
    "http://localhost:5000/api/projects",
  );
  assert.equal(
    buildApiUrl("/projects", { VITE_API_BASE_URL: "http://localhost:5000/api/", DEV: true }),
    "http://localhost:5000/api/projects",
  );
});

test("API-URL-05: requests retain the stored JWT as a Bearer authorization header", async () => {
  const previousEnv = process.env.NODE_ENV;
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const token = "unit-test-jwt";
  const values = new Map([["northpeak_token", token]]);
  let requestedUrl: RequestInfo | URL | undefined;
  let requestedHeaders: Headers | undefined;

  process.env.NODE_ENV = "test";
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = input;
      requestedHeaders = new Headers(init?.headers);
      return Response.json({ ok: true });
    },
  });

  try {
    assert.deepEqual(await request<{ ok: boolean }>("/projects"), { ok: true });
    assert.equal(requestedUrl, "/api/projects");
    assert.equal(requestedHeaders?.get("Authorization"), `Bearer ${token}`);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
    for (const [key, descriptor] of [
      ["fetch", previousFetch],
      ["window", previousWindow],
      ["localStorage", previousStorage],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("API-URL-06: client source files contain no hardcoded localhost URLs or server imports", () => {
  const files = walk(srcDir).filter((f) => /\.(ts|tsx)$/.test(f));
  for (const file of files) {
    const rel = relative(srcDir, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /https?:\/\/(localhost|127\.0\.0\.1)\b/i,
      `${rel} must not hardcode localhost URLs`,
    );
    assert.doesNotMatch(
      content,
      /from\s+["'](\.\.\/)+server\//,
      `${rel} must not import backend server modules`,
    );
  }
});
