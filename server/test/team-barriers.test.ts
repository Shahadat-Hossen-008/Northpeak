import test from "node:test";
import assert from "node:assert/strict";
import { concurrencyTestBarriers as barriers } from "../src/services/team.ts";
import { concurrencyTestBarriers as directBarriers } from "../src/services/team.barriers.ts";

test("team barriers retain one singleton and consume emitted events once", async () => {
  assert.strictEqual(barriers, directBarriers);
  barriers.reset();
  try {
    barriers.emit("already-emitted");
    assert.equal(await barriers.wait("already-emitted"), true);
    await assert.rejects(barriers.wait("already-emitted", 5), {
      message: "Timeout waiting for barrier event: already-emitted",
    });

    const firstWaiter = barriers.wait("release", 100);
    const secondWaiter = barriers.wait("release", 100);
    barriers.emit("release");
    assert.deepEqual(await Promise.all([firstWaiter, secondWaiter]), [true, true]);
  } finally {
    barriers.reset();
  }
});

test("team barrier hooks emit before waiting and can be cleared", async () => {
  barriers.reset();
  try {
    barriers.setHook("afterTaskCreateSave", { emit: "hook-entered", wait: "continue" });
    const hook = barriers.afterTaskCreateSave;
    assert.ok(hook);
    const runningHook = hook();
    assert.equal(await barriers.wait("hook-entered", 100), true);
    barriers.emit("continue");
    await runningHook;

    barriers.setHook("afterTaskCreateSave", null);
    assert.equal(barriers.afterTaskCreateSave, null);
  } finally {
    barriers.emit("continue");
    barriers.reset();
  }
});

test("reset leaves a pending barrier wait to reject on its original timeout", async () => {
  barriers.reset();
  try {
    const pendingWait = barriers.wait("reset-pending", 10);
    barriers.reset();
    await assert.rejects(pendingWait, {
      message: "Timeout waiting for barrier event: reset-pending",
    });
  } finally {
    barriers.reset();
  }
});
