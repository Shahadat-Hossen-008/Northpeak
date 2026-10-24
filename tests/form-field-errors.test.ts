import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(rootDir, path), "utf8");
}

test("task forms clear only edited field errors and retain submit validation", () => {
  const createTask = readSource("src/components/dialogs/create-task-dialog/index.tsx");
  const editTask = readSource("src/components/dialogs/edit-task-dialog/index.tsx");

  assert.ok(createTask.includes("delete nextErrors.projectId"));
  assert.ok(createTask.includes("delete nextErrors.title"));
  assert.ok(createTask.includes("delete nextErrors.deadline"));
  assert.ok(createTask.includes('nextErrors.title = "Enter a title for this task."'));
  assert.ok(createTask.includes('nextErrors.deadline = "Choose a due date to track this task."'));
  assert.equal(createTask.includes("const message = !title.trim()"), false);
  assert.equal(createTask.includes('deadline: e.target.value ? ""'), false);
  assert.ok(editTask.includes('setError("Task title must be at least 3 characters.")'));
  assert.ok(editTask.includes("setError(null);\n              }}"));
});

test("project forms clear related field errors on edit and retain submit validation", () => {
  const createProject = readSource("src/components/dialogs/create-project-dialog/index.tsx");
  const editProject = readSource("src/components/dialogs/edit-project-dialog/index.tsx");

  assert.ok(createProject.includes("delete nextErrors.title"));
  assert.ok(createProject.includes("delete nextErrors.deadline"));
  assert.ok(createProject.includes('nextErrors.title = "Enter a name for this project."'));
  assert.ok(
    createProject.includes('nextErrors.deadline = "Choose a deadline on or after the start date."'),
  );
  assert.ok(createProject.includes("new Date(form.deadline) < new Date(form.start)"));
  assert.equal(createProject.includes("const message = !title.trim()"), false);
  assert.ok(editProject.includes('setError("Project name must be at least 3 characters.")'));
  assert.ok(editProject.includes("setError(null);\n              }}"));
});
