import test from "node:test";
import assert from "node:assert/strict";
import {
  filterProjects,
  projectListFiltersFromSearch,
  projectListFiltersToSearch,
} from "../src/lib/project-list-filters";

const projects = [
  {
    id: "alpha",
    title: "Website Redesign",
    description: "Customer portal",
    manager_id: "m",
    team: [],
    start_date: null,
    deadline: "2099-01-01",
    priority: "high",
    created_at: "",
  },
  {
    id: "beta",
    title: "Mobile App",
    description: "Website companion",
    manager_id: "m",
    team: [],
    start_date: null,
    deadline: null,
    priority: "low",
    created_at: "",
  },
] as never[];

test("project title search is case-insensitive and combines with priority", () => {
  const results = filterProjects(projects, [], {
    search: "WEBSITE",
    priority: "high",
    status: "all",
  });
  assert.deepEqual(
    results.map((project) => project.id),
    ["alpha"],
  );
  assert.deepEqual(
    filterProjects(projects, [], { search: "companion", priority: "all", status: "all" }),
    [],
  );
});

test("project deadline health uses the card calculation and URL filters normalize unsupported values", () => {
  assert.deepEqual(
    filterProjects(projects, [], {
      search: "website",
      priority: "high",
      status: "on_track",
    }).map((project) => project.id),
    ["alpha"],
  );
  assert.deepEqual(
    filterProjects(projects, [], { search: "", priority: "all", status: "no_deadline" }).map(
      (project) => project.id,
    ),
    ["beta"],
  );
  assert.deepEqual(
    projectListFiltersFromSearch({ q: "  web ", priority: "bogus", status: "overdue" }),
    { search: "web", priority: "all", status: "overdue" },
  );
  assert.deepEqual(projectListFiltersToSearch({ search: " ", priority: "all", status: "all" }), {
    q: undefined,
    priority: undefined,
    status: undefined,
  });
});
