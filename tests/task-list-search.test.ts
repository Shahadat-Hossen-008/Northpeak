import test from "node:test";
import assert from "node:assert/strict";
import {
  getTaskFilterProjects,
  taskMatchesSearch,
  taskFiltersFromSearch,
  taskFiltersToSearch,
} from "../src/lib/task-utils";

test("task search matches titles case-insensitively, not descriptions or project names", () => {
  const task = {
    title: "Fix billing retry",
    description: "Update the settlement webhook",
    project: { title: "Website Redesign" },
  } as never;
  assert.equal(taskMatchesSearch(task, "BILLING"), true);
  assert.equal(taskMatchesSearch(task, "settlement"), false);
  assert.equal(taskMatchesSearch(task, "website"), false);
});

test("task list URL state restores supported manager filters and normalizes unsupported values", () => {
  const filters = taskFiltersFromSearch(
    {
      q: "  billing  ",
      project: "project-slug",
      status: "overdue",
      developer: "0123456789abcdef01234567",
      priority: "critical",
      sort: "progress",
      unrelated: "keep-me",
    },
    true,
  );

  assert.deepEqual(filters, {
    search: "billing",
    project: "project-slug",
    status: "overdue",
    developer: "0123456789abcdef01234567",
    priority: "critical",
    sort: "progress",
  });
  assert.equal(
    taskFiltersFromSearch({ status: "unknown", sort: "invalid", developer: "nope" }, true).status,
    "all",
  );
  assert.equal(
    taskFiltersFromSearch({ status: "unknown", developer: "0123456789abcdef01234567" }, false)
      .developer,
    "all",
  );
});

test("task list URL state omits defaults and excludes developer filter for developer lists", () => {
  assert.deepEqual(
    taskFiltersToSearch(
      {
        search: "  ",
        project: "all",
        status: "all",
        developer: "0123456789abcdef01234567",
        priority: "all",
        sort: "deadline",
      },
      false,
    ),
    {
      q: undefined,
      project: undefined,
      projectName: undefined,
      status: undefined,
      developer: undefined,
      priority: undefined,
      sort: undefined,
    },
  );
});

test("task filter URLs retain a canonical ID and generate a readable authorized project name", () => {
  const project = {
    id: "6acb7ed95aa295c2a074c984",
    title: "Website Redesign",
    manager_id: "m",
    description: "",
    team: [],
    start_date: null,
    deadline: null,
    priority: "high",
    created_at: "",
  } as const;
  const filters = {
    search: "web",
    project: project.id,
    status: "all",
    developer: "all",
    priority: "high",
    sort: "deadline",
  };
  assert.deepEqual(taskFiltersToSearch(filters, true, "website-redesign"), {
    q: "web",
    project: project.id,
    projectName: "website-redesign",
    status: undefined,
    developer: undefined,
    priority: "high",
    sort: undefined,
  });
  assert.equal(
    taskFiltersFromSearch({ project: project.id, projectName: "old-name" }, true).project,
    project.id,
  );
  assert.equal(
    taskFiltersToSearch({ ...filters, project: "all" }, true, undefined).projectName,
    undefined,
  );
});

test("task filter projects are role scoped and completed assignments remain eligible", () => {
  const projects = [
    {
      id: "owned",
      title: "Owned project",
      manager_id: "manager",
      description: "",
      team: [],
      start_date: null,
      deadline: null,
      priority: "low",
      created_at: "",
    },
    {
      id: "assigned",
      title: "Assigned project",
      manager_id: "manager",
      description: "",
      team: [],
      start_date: null,
      deadline: null,
      priority: "low",
      created_at: "",
    },
    {
      id: "other",
      title: "Other project",
      manager_id: "someone-else",
      description: "",
      team: ["developer"],
      start_date: null,
      deadline: null,
      priority: "low",
      created_at: "",
    },
  ] as const;
  const tasks = [
    { project_id: "assigned", assigned_developer_id: "developer", is_completed: true },
    { project_id: "other", assigned_developer_id: "another-developer", is_completed: false },
  ] as never[];

  assert.deepEqual(
    getTaskFilterProjects([...projects], tasks as never[], "developer", "developer").map(
      (project) => project.id,
    ),
    ["assigned"],
  );
  assert.deepEqual(
    getTaskFilterProjects([...projects], tasks as never[], "manager", "manager").map(
      (project) => project.id,
    ),
    ["owned", "assigned"],
  );
});
