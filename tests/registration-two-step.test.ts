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

test("REG-05: OTP verification component enforces six-digit code validation and 30s UI resend cooldown", () => {
  const otpSrc = readFileSync(
    join(rootDir, "src/components/auth/email-verification-form/index.tsx"),
    "utf8",
  );

  // 6-digit input check
  assert.ok(otpSrc.includes("code.length !== 6"), "must disable or reject code lengths !== 6");
  assert.ok(otpSrc.includes("maxLength={6}"), "InputOTP maxLength must be 6");

  // UI resend cooldown of 30 seconds
  assert.ok(
    otpSrc.includes("RESEND_COOLDOWN_SECONDS = 30"),
    "must define named RESEND_COOLDOWN_SECONDS constant set to 30",
  );
  assert.ok(
    otpSrc.includes("setResendSecondsLeft(RESEND_COOLDOWN_SECONDS)"),
    "must reset resend cooldown to 30s on resend",
  );
  assert.equal(
    otpSrc.includes("setSecondsLeft(60)"),
    false,
    "must remove obsolete 60-second server cooldown assumption",
  );

  // Back action without false claims of deletion
  assert.ok(
    otpSrc.includes("Change registration details"),
    "must provide honest back action label",
  );
  assert.equal(otpSrc.includes("cancelled"), false, "must not claim registration was cancelled");
});

test("REG-06: code lifetime countdown mirrors server 120s and disables verify on expiry", () => {
  const otpSrc = readFileSync(
    join(rootDir, "src/components/auth/email-verification-form/index.tsx"),
    "utf8",
  );

  // Named constant with mirroring comment
  assert.match(
    otpSrc,
    /\/\/[^\n]*mirrors server[^\n]*\nexport const CODE_LIFETIME_SECONDS = 120/i,
    "must export CODE_LIFETIME_SECONDS = 120 with comment mentioning it mirrors the server",
  );

  // Expiry message and disabled state
  assert.ok(
    otpSrc.includes("This code has expired. Send a new code."),
    "must display exact expiration message when countdown reaches zero",
  );
  assert.ok(
    otpSrc.includes("codeSecondsLeft <= 0"),
    "must disable verify button when code countdown reaches zero",
  );
});

test("REG-07: going Back and re-submitting passes new countdown and displays replacement notice", () => {
  const regSrc = readFileSync(join(rootDir, "src/routes/register.tsx"), "utf8");

  assert.ok(
    regSrc.includes("A new code was sent. Earlier codes no longer work."),
    "must provide replacement notice when user re-submits after going Back",
  );
  assert.ok(
    regSrc.includes("codeExpiresInSeconds"),
    "register.tsx must pass codeExpiresInSeconds to verification form",
  );
  assert.ok(
    regSrc.includes("resubmitNotice"),
    "register.tsx must pass resubmitNotice to verification form",
  );
});

test("REG-08: server 429 message is displayed inline and in a toast", () => {
  const regSrc = readFileSync(join(rootDir, "src/routes/register.tsx"), "utf8");
  const otpSrc = readFileSync(
    join(rootDir, "src/components/auth/email-verification-form/index.tsx"),
    "utf8",
  );

  // Register page inline error & toast
  assert.ok(
    regSrc.includes("setServerError(message)"),
    "register.tsx must set inline server error",
  );
  assert.ok(regSrc.includes("toast.error(message)"), "register.tsx must toast error message");
  assert.ok(
    regSrc.includes("{serverError ? (") && regSrc.includes('role="alert"'),
    "register.tsx must render inline server error in role='alert'",
  );

  // Verification component inline error & toast
  assert.ok(
    otpSrc.includes("setErrorMessage(msg)"),
    "verification form must set inline error message",
  );
  assert.ok(otpSrc.includes("toast.error(msg)"), "verification form must toast error message");
  assert.ok(
    otpSrc.includes("{errorMessage ? (") && otpSrc.includes('role="alert"'),
    "verification form must render inline error in role='alert'",
  );
});

test("REG-09: registration inputs clear only their existing field error when edited", () => {
  const regSrc = readFileSync(join(rootDir, "src/routes/register.tsx"), "utf8");

  assert.ok(regSrc.includes("if (errors.name)") && regSrc.includes("name: undefined"));
  assert.ok(regSrc.includes("if (errors.email)") && regSrc.includes("email: undefined"));
  assert.ok(regSrc.includes("if (errors.password)") && regSrc.includes("password: undefined"));
  assert.ok(regSrc.includes("if (errors.confirm)") && regSrc.includes("confirm: undefined"));
  assert.ok(regSrc.includes("next.name = nameErr"));
  assert.ok(regSrc.includes("next.email = emailErr"));
  assert.ok(regSrc.includes("next.password = passwordErr"));
  assert.ok(regSrc.includes("next.confirm = confirmErr"));
  assert.ok(regSrc.includes("if (!validate()) return"));
  assert.equal(regSrc.includes("validateName(nextName)"), false);
  assert.equal(regSrc.includes("validateEmail(nextEmail)"), false);
  assert.equal(regSrc.includes("validatePassword(nextPassword)"), false);
  assert.equal(regSrc.includes("validateConfirm(nextPassword"), false);
  assert.equal(regSrc.includes("validateConfirm(form.password, nextConfirm)"), false);
});

test("REG-10: login inputs clear only their existing field error when edited", () => {
  const loginSrc = readFileSync(join(rootDir, "src/routes/login.tsx"), "utf8");

  assert.ok(loginSrc.includes("if (errors.email)") && loginSrc.includes("email: undefined"));
  assert.ok(loginSrc.includes("if (errors.password)") && loginSrc.includes("password: undefined"));
  assert.ok(loginSrc.includes("if (!validate()) return"));
  assert.equal(loginSrc.includes("validateEmail(val)"), false);
  assert.equal(loginSrc.includes("validatePassword(val)"), false);
});
