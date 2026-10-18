import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(
  new URL("../src/builder/pages/manager-dashboard/index.tsx", import.meta.url),
  "utf8",
);
const projectsPage = readFileSync(
  new URL("../src/routes/_authenticated/manager/projects.index.tsx", import.meta.url),
  "utf8",
);

test("manager dashboard omits duplicate project cards and keeps its independent summaries", () => {
  assert.doesNotMatch(dashboard, /Projects overview|<ProjectCard/);
  assert.match(dashboard, /DashboardMetricCard/);
  assert.match(dashboard, /type="project-status-donut"/);
  assert.match(dashboard, /type="task-status-donut"/);
  assert.match(dashboard, /SectionCard title="Overdue tasks"/);
  assert.match(dashboard, /SectionCard title="Upcoming deadlines"/);
  assert.match(dashboard, /SectionCard title="Developer workload"/);
  assert.match(dashboard, /SectionCard title="Recent activity"/);
});

test("manager Projects page retains cards, filtering, and project-detail navigation", () => {
  assert.match(projectsPage, /ProjectListFiltersBar/);
  assert.match(projectsPage, /filterProjects/);
  assert.match(projectsPage, /<ProjectCard/);
  assert.match(projectsPage, /\/manager\/projects\/\$\{projectSlug\(p\)\}/);
});
