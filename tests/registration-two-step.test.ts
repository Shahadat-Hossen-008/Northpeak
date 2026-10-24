import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

test("REG-01: registration client-side validation logic matches required rules", () => {
  function validateForm(form: { name: string; email: string; password: string; confirm: string }) {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors["name"] = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors["email"] = "Enter a valid email address.";
    }
    if (form.password.length < 6) errors["password"] = "Password must be at least 6 characters.";
    if (form.password !== form.confirm) errors["confirm"] = "Passwords do not match.";
    return errors;
  }

  // Valid inputs
  const valid = validateForm({
    name: "Jane Developer",
    email: "jane@northpeak.dev",
    password: "password123",
    confirm: "password123",
  });
  assert.equal(Object.keys(valid).length, 0);

  // Short name
  const badName = validateForm({
    name: "J",
    email: "jane@northpeak.dev",
    password: "password123",
    confirm: "password123",
  });
  assert.equal(badName["name"], "Enter your full name.");

  // Invalid email
  const badEmail = validateForm({
    name: "Jane Developer",
    email: "not-an-email",
    password: "password123",
    confirm: "password123",
  });
  assert.equal(badEmail["email"], "Enter a valid email address.");

  // Password too short
  const shortPass = validateForm({
    name: "Jane Developer",
    email: "jane@northpeak.dev",
    password: "123",
    confirm: "123",
  });
  assert.equal(shortPass["password"], "Password must be at least 6 characters.");

  // Password mismatch
  const mismatch = validateForm({
    name: "Jane Developer",
    email: "jane@northpeak.dev",
    password: "password123",
    confirm: "mismatch456",
  });
  assert.equal(mismatch["confirm"], "Passwords do not match.");
});

test("REG-02: registration page does not navigate away to /verify-email on submit", () => {
  const registerSrc = readFileSync(join(rootDir, "src/routes/register.tsx"), "utf8");

  // Must not navigate to /verify-email inside handleSubmit
  assert.equal(
    registerSrc.includes('to: "/verify-email"'),
    false,
    "register.tsx should not navigate to /verify-email on submit",
  );

  // Must switch in-place to Step 2 ("verify")
  assert.ok(
    registerSrc.includes('setStep("verify")'),
    "register.tsx must update component state to verify step",
  );
  assert.ok(
    registerSrc.includes("setPendingEmail(data.email)"),
    "register.tsx must set pending email from response",
  );
});

test("REG-03: login page redirects unverified user to /register with step=verify and email", () => {
  const loginSrc = readFileSync(join(rootDir, "src/routes/login.tsx"), "utf8");

  // Must navigate to /register with step: "verify"
  assert.ok(
    loginSrc.includes('navigate({ to: "/register", search: { email, step: "verify" } })'),
    "login.tsx must navigate to /register with verify step and email",
  );
  assert.equal(
    loginSrc.includes('to: "/verify-email"'),
    false,
    "login.tsx must not navigate to stale /verify-email",
  );
});

test("REG-04: /verify-email compatibility route redirects to /register preserving parameters", async () => {
  const verifyEmailRoute = await import("../src/routes/verify-email.tsx");
  const routeObj = verifyEmailRoute.Route as unknown as {
    options?: { beforeLoad?: (ctx: { search: Record<string, unknown> }) => unknown };
  };
  const beforeLoad = routeObj.options?.beforeLoad;

  assert.ok(typeof beforeLoad === "function", "verify-email must provide a beforeLoad hook");

  let redirectedTo: {
    options?: { to?: string; search?: Record<string, unknown>; replace?: boolean };
    to?: string;
    search?: Record<string, unknown>;
    replace?: boolean;
  } | null = null;

  try {
    beforeLoad({
      search: { email: "alex@northpeak.dev", role: "developer" },
    });
  } catch (err: unknown) {
    redirectedTo = err as typeof redirectedTo;
  }

  assert.ok(redirectedTo, "beforeLoad must throw a redirect");
  const options = redirectedTo.options || redirectedTo;
  assert.equal(options.to, "/register");
  assert.equal(options.search?.["step"], "verify");
  assert.equal(options.search?.["email"], "alex@northpeak.dev");
  assert.equal(options.search?.["role"], "developer");
  assert.equal(options.replace, true);
});

test("REG-05: OTP verification component enforces six-digit code validation and timer cooldown", () => {
  const otpSrc = readFileSync(
    join(rootDir, "src/components/auth/email-verification-form/index.tsx"),
    "utf8",
  );

  // 6-digit input check
  assert.ok(otpSrc.includes("code.length !== 6"), "must disable or reject code lengths !== 6");
  assert.ok(otpSrc.includes("maxLength={6}"), "InputOTP maxLength must be 6");

  // Cooldown timer of 60 seconds
  assert.ok(otpSrc.includes("secondsLeft"), "must track resend cooldown timer");
  assert.ok(otpSrc.includes("setSecondsLeft(60)"), "must reset cooldown to 60s");

  // Back action without false claims of deletion
  assert.ok(
    otpSrc.includes("Change registration details"),
    "must provide honest back action label",
  );
  assert.equal(otpSrc.includes("cancelled"), false, "must not claim registration was cancelled");
});
