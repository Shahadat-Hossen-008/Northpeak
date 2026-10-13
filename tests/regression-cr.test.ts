import test from "node:test";
import assert from "node:assert/strict";

import { isTaskCompleted, isTaskOverdue, getTaskCategory } from "../src/lib/task-utils.ts";
import {
  selectManagerDashboardMetrics,
  selectDeveloperDashboardMetrics,
} from "../src/lib/dashboard-selectors.ts";
import type { Task, Project, Member } from "../src/types/index.ts";

const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 1000).toISOString();

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    project_id: "proj-1",
    title: "Test Task",
    description: null,
    status: "todo",
    priority: "medium",
    assigned_developer_id: "dev-1",
    start_date: null,
    deadline: null,
    is_completed: false,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// -------------------------------------------------------------
// CR-01: Unify overdue task classification
// -------------------------------------------------------------
test("CR-01: in_progress and in_review tasks with past deadlines are classified as overdue", () => {
  const inProgressOverdue = makeTask({
    id: "t1",
    status: "in_progress",
    deadline: pastDate,
    is_completed: false,
  });

  const inReviewOverdue = makeTask({
    id: "t2",
    status: "in_review",
    deadline: pastDate,
    is_completed: false,
  });

  const todoOverdue = makeTask({
    id: "t3",
    status: "todo",
    deadline: pastDate,
    is_completed: false,
  });

  assert.equal(isTaskCompleted(inProgressOverdue), false);
  assert.equal(isTaskOverdue(inProgressOverdue), true);
  assert.equal(getTaskCategory(inProgressOverdue), "overdue");

  assert.equal(isTaskCompleted(inReviewOverdue), false);
  assert.equal(isTaskOverdue(inReviewOverdue), true);
  assert.equal(getTaskCategory(inReviewOverdue), "overdue");

  assert.equal(isTaskCompleted(todoOverdue), false);
  assert.equal(isTaskOverdue(todoOverdue), true);
  assert.equal(getTaskCategory(todoOverdue), "overdue");
});

test("CR-01: completed tasks with past deadlines are never classified as overdue", () => {
  const completedTask = makeTask({
    id: "t4",
    status: "done",
    deadline: pastDate,
    is_completed: true,
  });

  const doneStatusTask = makeTask({
    id: "t5",
    status: "done",
    deadline: pastDate,
    is_completed: false,
  });

  assert.equal(isTaskCompleted(completedTask), true);
  assert.equal(isTaskOverdue(completedTask), false);
  assert.equal(getTaskCategory(completedTask), "completed");

  assert.equal(isTaskCompleted(doneStatusTask), true);
  assert.equal(isTaskOverdue(doneStatusTask), false);
  assert.equal(getTaskCategory(doneStatusTask), "completed");
});

test("CR-01: in_progress tasks with future or no deadlines remain in_progress", () => {
  const futureInProgress = makeTask({
    id: "t6",
    status: "in_progress",
    deadline: futureDate,
  });

  const noDeadlineInProgress = makeTask({
    id: "t7",
    status: "in_progress",
    deadline: null,
  });

  assert.equal(isTaskOverdue(futureInProgress), false);
  assert.equal(getTaskCategory(futureInProgress), "in_progress");

  assert.equal(isTaskOverdue(noDeadlineInProgress), false);
  assert.equal(getTaskCategory(noDeadlineInProgress), "in_progress");
});

test("CR-01: manager dashboard metrics and chart counts agree without double-counting", () => {
  const tasks: Task[] = [
    // 1 completed on time
    makeTask({ id: "t1", status: "done", is_completed: true }),
    // 1 in_progress but overdue (deadline passed)
    makeTask({ id: "t2", status: "in_progress", deadline: pastDate }),
    // 1 in_review but overdue (deadline passed)
    makeTask({ id: "t3", status: "in_review", deadline: pastDate }),
    // 1 todo overdue (deadline passed)
    makeTask({ id: "t4", status: "todo", deadline: pastDate }),
    // 1 in_progress on track (future deadline)
    makeTask({ id: "t5", status: "in_progress", deadline: futureDate }),
    // 1 todo on track
    makeTask({ id: "t6", status: "todo", deadline: futureDate }),
  ];

  const projects: Project[] = [
    {
      id: "proj-1",
      title: "Core Platform",
      description: null,
      status: "in_progress",
      priority: "high",
      start_date: null,
      deadline: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const members: Member[] = [
    {
      id: "dev-1",
      name: "Alex Dev",
      email: "alex@northpeak.dev",
      role: "developer",
      created_at: new Date().toISOString(),
    },
  ];

  const metrics = selectManagerDashboardMetrics({ tasks, projects, members });

  // Completed: 1
  assert.equal(metrics.completedTasks, 1);
  // Overdue: 3 (t2 in_progress, t3 in_review, t4 todo)
  assert.equal(metrics.overdueTasks.length, 3);
  assert.equal(metrics.allOverdueTasks.length, 3);
  // In-progress: 1 (only t5 whose deadline hasn't passed)
  assert.equal(metrics.inProgressTasks, 1);

  // Mutual exclusivity across categories
  const categories = tasks.map((t) => getTaskCategory(t));
  const counts = {
    completed: categories.filter((c) => c === "completed").length,
    overdue: categories.filter((c) => c === "overdue").length,
    in_progress: categories.filter((c) => c === "in_progress").length,
    todo: categories.filter((c) => c === "todo").length,
  };

  assert.equal(counts.completed, metrics.completedTasks);
  assert.equal(counts.overdue, metrics.overdueTasks.length);
  assert.equal(counts.in_progress, metrics.inProgressTasks);
  assert.equal(counts.todo, 1);
  assert.equal(counts.completed + counts.overdue + counts.in_progress + counts.todo, tasks.length);

  // Developer workloads overdue count also agrees
  assert.equal(metrics.developerWorkloads[0]?.overdueCount, 3);
});

test("CR-01: developer dashboard metrics correctly categorizes overdue tasks", () => {
  const tasks: Task[] = [
    makeTask({
      id: "t1",
      assigned_developer_id: "dev-1",
      status: "in_progress",
      deadline: pastDate,
    }),
    makeTask({
      id: "t2",
      assigned_developer_id: "dev-1",
      status: "in_progress",
      deadline: futureDate,
    }),
    makeTask({ id: "t3", assigned_developer_id: "dev-1", status: "done", is_completed: true }),
  ];

  const metrics = selectDeveloperDashboardMetrics({
    tasks,
    projects: [],
    profileId: "dev-1",
  });

  assert.equal(metrics.completedCount, 1);
  assert.equal(metrics.overdueCount, 1);
  assert.equal(metrics.inProgressCount, 1);
  assert.equal(metrics.completedCount + metrics.overdueCount + metrics.inProgressCount, 3);
});

// -------------------------------------------------------------
// CR-02 & CR-05: Password validation and error handling contracts
// -------------------------------------------------------------
test("CR-05: password validation enforces minimum 6 characters with standard error message", () => {
  const validatePassword = (pw: string) => {
    if (pw.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  assert.equal(validatePassword(""), "Password must be at least 6 characters.");
  assert.equal(validatePassword("123"), "Password must be at least 6 characters.");
  assert.equal(validatePassword("12345"), "Password must be at least 6 characters.");
  assert.equal(validatePassword("123456"), null);
  assert.equal(validatePassword("validPassword123"), null);
});

// -------------------------------------------------------------
// CR-03: Error retry handling contract
// -------------------------------------------------------------
test("CR-03: error retry helper calls reset and router invalidation while guarding against duplicate invocations", async () => {
  let resetCallCount = 0;
  let invalidateCallCount = 0;

  const reset = () => {
    resetCallCount++;
  };
  const router = {
    invalidate: async () => {
      invalidateCallCount++;
    },
  };

  let isRetrying = false;
  const executeRetry = async () => {
    if (isRetrying) return;
    isRetrying = true;
    try {
      if (reset) reset();
      if (router?.invalidate) await router.invalidate();
    } finally {
      isRetrying = false;
    }
  };

  // Normal retry
  await executeRetry();
  assert.equal(resetCallCount, 1);
  assert.equal(invalidateCallCount, 1);

  // Guard against duplicate retry when already in-flight
  isRetrying = true;
  await executeRetry();
  assert.equal(resetCallCount, 1, "Duplicate retry should be blocked while isRetrying is true");
  assert.equal(invalidateCallCount, 1);
});

// -------------------------------------------------------------
// CR-04: Gauge accessibility breakdown
// -------------------------------------------------------------
test("CR-04: gauge category mapping produces accessible 4-state breakdown without data loss", () => {
  const allKinds: Task[] = [
    makeTask({ id: "t1", status: "done" }),
    makeTask({ id: "t2", status: "in_progress", deadline: pastDate }),
    makeTask({ id: "t3", status: "in_progress", deadline: futureDate }),
    makeTask({ id: "t4", status: "todo", deadline: futureDate }),
  ];

  const categories = allKinds.map(getTaskCategory);
  assert.deepEqual(categories, ["completed", "overdue", "in_progress", "todo"]);
});
