import { Router } from "express";
import { concurrencyTestBarriers } from "../services/team.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const testBarriersRouter = Router();

// Test-only endpoints: strictly unavailable in production environments
testBarriersRouter.use((_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ message: "Test barrier endpoints are disabled in production" });
    return;
  }
  next();
});

// Require authenticated Manager role
testBarriersRouter.use(authenticate, requireRole("manager"));

testBarriersRouter.post("/configure", (req, res) => {
  const { hooks, simulateRemovalFailure, reset } = req.body;
  if (reset) {
    concurrencyTestBarriers.reset();
  }
  if (hooks) {
    for (const [hookName, action] of Object.entries(hooks)) {
      if (
        hookName === "afterTaskCreateSave" ||
        hookName === "afterTaskCreateMembershipCheck" ||
        hookName === "afterTaskPatchSave" ||
        hookName === "afterTaskPatchMembershipCheck" ||
        hookName === "duringProjectTeamRemoval" ||
        hookName === "beforeProjectSave"
      ) {
        concurrencyTestBarriers.setHook(hookName, action as any);
      }
    }
  }
  if (typeof simulateRemovalFailure === "boolean") {
    concurrencyTestBarriers.simulateRemovalFailure = simulateRemovalFailure;
  }
  res.json({ ok: true });
});

testBarriersRouter.post("/emit", (req, res) => {
  const { event } = req.body;
  if (!event) {
    res.status(400).json({ error: "Missing event" });
    return;
  }
  concurrencyTestBarriers.emit(event);
  res.json({ ok: true, emitted: event });
});

testBarriersRouter.post("/wait", async (req, res) => {
  const { event, timeoutMs } = req.body;
  if (!event) {
    res.status(400).json({ error: "Missing event" });
    return;
  }
  try {
    await concurrencyTestBarriers.wait(event, timeoutMs || 10000);
    res.json({ ok: true, received: event });
  } catch (err: any) {
    res.status(408).json({ error: err.message });
  }
});

testBarriersRouter.post("/reset", (_req, res) => {
  concurrencyTestBarriers.reset();
  res.json({ ok: true, reset: true });
});
