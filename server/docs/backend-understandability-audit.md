# Northpeak Backend Audit — Phase 1 Report

**Scope:** `server/` and directly relevant root configuration only.  
**Mode:** Read-only audit report. The report was produced before normalization changes.

## Verification status

| Check | Result |
|---|---|
| Backend TypeScript build | Passed: `npm --prefix server run build` |
| Backend tests | Passed: 33 tests, 0 failures |
| Frontend files | Not inspected or changed |
| Working tree | Existing changes preserved; no modifications made by the audit |

The tests passing confirms the current tested contract. It does not prove that all untested edge cases are correct.

---

# 1. Backend architecture map

## Request lifecycle

```text
HTTP request
  ↓
Express app setup
  ↓
Security headers / CORS / JSON body limit / request ID logging
  ↓
Optional auth rate limiter
  ↓
Route
  ↓
authenticate middleware
  ↓
requireRole middleware, where applicable
  ↓
asyncHandler
  ↓
Domain service
  ↓
Mongoose model/database operations
  ↓
Serializer
  ↓
JSON HTTP response
  ↓
Central error handler for thrown failures
```

The application is assembled in [`server/src/app.ts`](../src/app.ts). It exports the Express app without opening a network listener, which allows Supertest integration tests to mount it directly.

Startup is separated into:

- [`server/src/index.ts`](../src/index.ts) — entry point and direct-execution guard.
- [`server/src/server.ts`](../src/server.ts) — database connection, HTTP listener creation, and shutdown registration.
- [`server/src/services/shutdown.ts`](../src/services/shutdown.ts) — signal handling and graceful shutdown.

## Component inventory

| Component | Actual file(s) | Responsibility | Inputs | Outputs / dependencies |
|---|---|---|---|---|
| Configuration | [`config/env.ts`](../src/config/env.ts) | Loads `.env`, validates environment, builds typed config | `process.env` | `AppConfig`; throws on invalid boot configuration |
| Database connection | [`config/db.ts`](../src/config/db.ts) | Calls `mongoose.connect` | Mongo URI | Connected Mongoose process; currently exits on connection failure |
| App composition | [`app.ts`](../src/app.ts) | Registers middleware, routers, health endpoints, error handler | Express requests | Configured Express app |
| Server startup | [`server.ts`](../src/server.ts) | Connects DB and calls `app.listen` | Config and app | Node HTTP server |
| Authentication | [`middleware/auth.ts`](../src/middleware/auth.ts) | Verifies JWT and confirms the user still exists | `Authorization` header | `req.user`; 401/403 responses |
| Error handling | [`middleware/error.ts`](../src/middleware/error.ts) | Converts known failures into `{ message }` responses | Thrown errors | HTTP error response |
| Logging | [`middleware/logger.ts`](../src/middleware/logger.ts) | Adds request IDs and logs response timing | HTTP request/response | `req.id`, `X-Request-Id`, structured log |
| Security middleware | [`middleware/security.ts`](../src/middleware/security.ts) | Sets HTTP security headers | Response | Security headers |
| Rate limiting | [`middleware/rateLimit.ts`](../src/middleware/rateLimit.ts) | In-memory counter for auth endpoints | Client IP | 429 response when exceeded |
| Routes | [`routes/`](../src/routes) | HTTP parsing, middleware composition, response status | Request | Delegates to services |
| Services | [`services/`](../src/services) | Business rules, authorization, database writes, side effects | Input objects and auth user | Serialized domain responses or throws |
| Models | [`models/`](../src/models) | Mongoose schemas, validation, indexes, references | JavaScript/Mongoose documents | MongoDB collections and typed documents |
| Serializers | [`serializers/`](../src/serializers) | Maps Mongo/Mongoose documents to frontend snake_case contracts | Documents or populated documents | JSON-safe response objects |
| Shared utilities | [`lib/utils.ts`](../src/lib/utils.ts) | Regex escaping and slug generation | Strings | Normalized strings |
| Test barriers | [`routes/testBarriers.ts`](../src/routes/testBarriers.ts), [`services/team.ts`](../src/services/team.ts) | Deterministic concurrency-test synchronization | Test-only HTTP actions/hooks | Barrier events; mounted only in test mode |

## Models and relationships

- [`User.ts`](../src/models/User.ts)
  - Stores `name`, normalized unique `email`, `passwordHash`, and `role`.
- [`Project.ts`](../src/models/Project.ts)
  - References one manager and an array of team users.
  - Enables `optimisticConcurrency`.
- [`Task.ts`](../src/models/Task.ts)
  - References one project and optional assigned developer.
  - Stores both workflow `status` and contract-facing `isCompleted`.
  - Stores `completedAt`.
- [`Subtask.ts`](../src/models/Subtask.ts)
  - References a parent task.
- [`Comment.ts`](../src/models/Comment.ts)
  - References a task and author.
- [`Activity.ts`](../src/models/Activity.ts)
  - Optional project, task, and actor references; immutable creation timestamp.
- [`Notification.ts`](../src/models/Notification.ts)
  - Either targets a specific recipient or a role audience.

There are no Mongoose population hooks or model middleware. Population is performed explicitly in services.

---

# 2. Task feature file-by-file map

## Primary Task files

| Concern | File | Main functions |
|---|---|---|
| HTTP routes | [`routes/tasks.ts`](../src/routes/tasks.ts) | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/complete`, `DELETE /:id` |
| Business logic | [`services/task.service.ts`](../src/services/task.service.ts) | `getTasks`, `getTaskById`, `createTask`, `updateTask`, `toggleComplete`, `deleteTask` |
| Workflow normalization | [`services/task.service.ts`](../src/services/task.service.ts) | `applyTaskWorkflowState` |
| Assignment validation | [`services/task.service.ts`](../src/services/task.service.ts) | `validateAndResolveAssignee` |
| Persistence | [`models/Task.ts`](../src/models/Task.ts) | Task schema and indexes |
| Response mapping | [`serializers/task.serializer.ts`](../src/serializers/task.serializer.ts) | `serializeTask` |
| Team membership | [`services/team.ts`](../src/services/team.ts) | Team lookup helpers and test barriers |
| Project synchronization | [`services/project.service.ts`](../src/services/project.service.ts) | Removed-member task unassignment |
| Side effects | [`models/Activity.ts`](../src/models/Activity.ts), [`models/Notification.ts`](../src/models/Notification.ts) | Activity and notification records |
| Task tests | [`test/characterization.test.ts`](../test/characterization.test.ts), [`test/concurrency.test.ts`](../test/concurrency.test.ts) | Normal CRUD and concurrent team changes |

## Task response shape

`serializeTask` emits:

```ts
{
  id,
  project_id,
  title,
  description,
  assigned_developer_id,
  deadline,
  priority,
  status,
  is_completed,
  completed_at,
  created_at,
  project,
  assignee
}
```

The public API uses snake_case while the Mongoose model uses camelCase.

---

# 3. Task lifecycle traces

## 3.1 Create a task

```text
POST /api/tasks
  → tasksRouter.post("/")
  → authenticate
  → requireRole("manager")
  → taskService.createTask(req.user, req.body)
  → Project.findById(project_id)
  → validateAndResolveAssignee(...)
  → Project.findOneAndUpdate({ _id, team: developer })
  → new Task(...)
  → task.save()
  → concurrency membership re-check
  → Activity.create(...)
  → Notification.create(...) if assigned
  → fetchPopulatedTask(...)
  → serializeTask(...)
  → HTTP 201
```

Implementation details:

1. The route requires a valid JWT and a `manager` role.
2. [`createTask`](../src/services/task.service.ts) validates that the project ID exists and the title is at least three characters.
3. It confirms that the authenticated manager owns the project.
4. If an assignee is supplied:
   - The ID must be valid.
   - The user must exist.
   - The user must have role `developer`.
   - The developer must currently be in the project’s `team`.
5. `validateAndResolveAssignee` uses `Project.findOneAndUpdate` with `{ team: devUser._id }`. The update only changes `updatedAt`; its purpose is to make the membership check participate in a database write.
6. The task is saved with:
   - `status: "todo"` initially.
   - `isCompleted: false`.
   - `completedAt: null`.
7. The service performs a second membership check after save. If the developer was removed concurrently, it deletes the newly created task and returns a 400 error.
8. Activity is recorded.
9. An assignment notification is created when applicable.
10. The task is re-read with populated project and assignee fields before serialization.

Covered by:

- `CHAR-TASKS` in [`characterization.test.ts`](../test/characterization.test.ts)
- `CONC-02` in [`concurrency.test.ts`](../test/concurrency.test.ts)

## 3.2 Read/list tasks

### List

```text
GET /api/tasks?...
  → authenticate
  → taskService.getTasks(req.query)
  → build Mongo filter
  → Task.find(filter)
  → populate project and assignee
  → sort by deadline
  → serializeTask for every document
  → HTTP 200
```

Supported aliases include:

- `project_id` and `projectId`
- `assigned_to` and `assignedTo`
- `priority`
- `status`
- `is_completed`
- `search`

Search input is passed through [`escapeRegex`](../src/lib/utils.ts), preventing user input from becoming an unintended regular expression.

### Single task

```text
GET /api/tasks/:id
  → authenticate
  → taskService.getTaskById(id)
  → isValidObjectId
  → Task.findById
  → populate project and assignee
  → serializeTask
  → HTTP 200
```

Invalid or missing IDs become a 404 `AppError`.

Covered by the `CHAR-TASKS` test.

## 3.3 Update task fields

```text
PATCH /api/tasks/:id
  → authenticate
  → taskService.updateTask(id, req.user, req.body)
  → Task.findById
  → authorization check
  → Project.findById
  → assignment validation, if requested
  → applyTaskWorkflowState
  → task.save()
  → concurrent membership re-check
  → Activity.create
  → Notification.create for new assignment
  → fetchPopulatedTask
  → serializeTask
  → HTTP 200
```

Authorization behavior:

- Project manager:
  - Must have `role === "manager"`.
  - Must own the project.
  - May edit title, description, deadline, priority, assignment, and workflow state.
- Assigned developer:
  - May update workflow state.
  - May not reassign the task.
  - May not edit the manager-controlled fields.
- Unassigned or unrelated users are rejected.

The task captures the previous assignee and status to decide whether to notify the new assignee and whether to write a “moved task” activity message.

## 3.4 Assign or unassign a developer

Assignment occurs through the same `PATCH /api/tasks/:id` route using `assigned_developer_id`.

### Assign

```text
PATCH /api/tasks/:id
  → updateTask
  → require manager authorization
  → validateAndResolveAssignee
  → verify developer role
  → atomically check project.team membership
  → assign task
  → save task
  → re-check team membership
  → notify developer
```

### Unassign

A value of `null`, an empty value, or `"unassigned"` resolves to no assignee.

The task remains in the database and `assignedDeveloper` becomes `null`.

The current implementation does not create a specific “unassigned” notification or activity message; it records a generic task update activity.

## 3.5 Change status

Workflow normalization is centralized in [`applyTaskWorkflowState`](../src/services/task.service.ts).

Valid workflow statuses are:

```text
todo
in_progress
in_review
done
```

When status is `"done"`:

```text
status = "done"
isCompleted = true
completedAt = current time, if not already set
```

When status is any other valid workflow status:

```text
isCompleted = false
completedAt = null
```

An invalid status is currently ignored by `applyTaskWorkflowState` rather than immediately rejected. This is one of the normalization opportunities described later.

## 3.6 Complete and reopen a task

```text
PATCH /api/tasks/:id/complete
  → authenticate
  → taskService.toggleComplete(id, req.user, req.body.completed)
  → Task.findById
  → Project.findById
  → allow project manager or assigned developer
  → applyTaskWorkflowState(..., completed)
  → task.save()
  → Activity.create("completed ..." / "reopened ...")
  → fetchPopulatedTask
  → serializeTask
  → HTTP 200
```

Completion behavior:

- `true`:
  - `isCompleted = true`
  - `status = "done"`
  - `completedAt` set only if it was previously empty
- `false`:
  - `isCompleted = false`
  - `status = "todo"`
  - `completedAt = null`

The original completion timestamp is therefore preserved if a task is repeatedly updated as `"done"` without being reopened.

Covered by `CHAR-TASKS`.

## 3.7 Create, update, and delete subtasks

### Create

```text
POST /api/subtasks/task/:taskId
  → authenticate
  → subtaskService.createSubtask
  → validate title
  → validate parent task ID
  → Task.findById
  → Project.findById
  → allow owning manager or assigned developer
  → Subtask.create
  → Activity.create
  → serializeSubtask
  → HTTP 201
```

### Update

```text
PATCH /api/subtasks/:id
  → authenticate
  → Subtask.findById
  → Task.findById
  → Project.findById
  → allow owning manager or assigned developer
  → mutate title/completion
  → save
  → Notification.create when completed
  → serializeSubtask
  → HTTP 200
```

### Delete

```text
DELETE /api/subtasks/:id
  → authenticate
  → Subtask.findById
  → Task.findById
  → Project.findById
  → authorization check
  → subtask.deleteOne()
  → HTTP 200
```

The authorization rule is stronger than the route comment alone suggests:

- Owning project manager: allowed.
- Developer assigned to the parent task: allowed.
- Unassigned developer: rejected.
- Unrelated manager: rejected.
- Unauthenticated user: rejected.

Covered extensively by [`subtask-authorization.test.ts`](../test/subtask-authorization.test.ts).

## 3.8 Add and delete comments

### Add

```text
POST /api/comments/task/:taskId
  → authenticate
  → commentService.createComment
  → validate body
  → Task.findById
  → Comment.create
  → Activity.create
  → notification to assigned developer when author differs
  → manager-audience notification
  → re-read comment with populated author
  → serializeComment
  → HTTP 201
```

### Delete

```text
DELETE /api/comments/:id
  → authenticate
  → Comment.findById
  → allow comment author
  → otherwise require manager role and owning project
  → comment.deleteOne()
  → HTTP 200
```

Comment serialization is handled by [`comment.serializer.ts`](../src/serializers/comment.serializer.ts).

## 3.9 Remove developer from a project team

```text
PATCH /api/projects/:id
  → authenticate
  → requireRole("manager")
  → projectService.updateProject
  → verify project exists and caller owns it
  → validate new team
  → calculate removed developer IDs
  → start MongoDB session and transaction
  → save project with new team
  → Task.updateMany(open tasks assigned to removed developers)
  → commit transaction
  → post-commit Task.updateMany sweep
  → Activity.create
  → serializeProject
  → HTTP 200
```

The synchronization method is [`syncRemovedTeamTaskAssignments`](../src/services/project.service.ts).

Only open tasks are unassigned:

```text
project = current project
assignedDeveloper ∈ removed developers
isCompleted = false
```

Completed tasks preserve their historical assignment.

Concurrency behavior:

- A transaction is used when MongoDB supports transactions.
- A compensating fallback exists for standalone MongoDB.
- Project optimistic concurrency catches version conflicts.
- A post-commit sweep tries to catch tasks created during the transaction snapshot.
- The concurrency tests use [`concurrencyTestBarriers`](../src/services/team.ts) to make races deterministic.

Covered by:

- `CONC-01`
- `CONC-02`
- `CONC-03`

in [`concurrency.test.ts`](../test/concurrency.test.ts).

---

# 4. Middleware and error behavior

## Authentication

[`authenticate`](../src/middleware/auth.ts):

1. Requires `Bearer <token>`.
2. Verifies the token with the configured JWT secret.
3. Looks up the user by the token’s ID.
4. Rebuilds `req.user` from current database values rather than trusting the token’s role/name.
5. Returns 401 for missing, invalid, expired, or deleted-user tokens.

[`requireRole`](../src/middleware/auth.ts) performs coarse role checks. Resource ownership and assignment checks remain in services.

## Error handling

[`errorHandler`](../src/middleware/error.ts) handles:

- Mongoose `CastError` → 400
- Mongoose validation errors → 400
- Duplicate key errors → 400
- `AppError` and status-bearing errors → their status
- Oversized request bodies → 413
- Unknown errors → logged and returned as generic 500

All normal API errors use:

```json
{
  "message": "..."
}
```

## Logging and request IDs

[`requestLogger`](../src/middleware/logger.ts) assigns or preserves `X-Request-Id`, records duration, and suppresses response logs in test mode.

The redaction helper exists and is tested, but the request logger currently logs metadata only; it does not log request bodies.

---

# 5. Most confusing implementation areas

## P1 — Important maintainability/reliability issues

### P1.1 Multi-document Task operations are not consistently transactional

Task creation, update, and deletion perform several independent writes:

- Task
- Activity
- Notification
- Subtasks
- Comments

For example, [`createTask`](../src/services/task.service.ts) saves the task before creating activity and notification records. If a later write fails, the task remains but the operation returns an error.

Likewise, [`deleteTask`](../src/services/task.service.ts) performs multiple deletes sequentially. A failure halfway through can leave partial cascade state.

**Risk:** orphaned activity/notification data or incomplete cascades.  
**Benefit of change:** clearer all-or-nothing semantics.  
**Caution:** requires preserving standalone MongoDB behavior and existing tests.

### P1.2 Project team-removal post-commit failures are swallowed

In [`updateProject`](../src/services/project.service.ts), the post-commit task-unassignment sweep catches errors, logs them, and still returns success.

This means the API may report a successful team removal while some open tasks remain assigned to removed developers.

**Risk:** task assignment invariant is temporarily or permanently violated.  
**Benefit of change:** explicit failure, retry state, or stronger repair behavior.  
**Caution:** returning an error after a committed project change requires a documented response contract.

### P1.3 Tasks do not enable Mongoose optimistic concurrency

[`Project.ts`](../src/models/Project.ts) enables `optimisticConcurrency: true`, but [`Task.ts`](../src/models/Task.ts) does not.

Two concurrent `PATCH /api/tasks/:id` operations can read the same task and overwrite one another. The existing barriers protect assignment/team membership races, not general task field races.

**Risk:** lost updates.  
**Recommended response:** add an explicit test first, then decide whether task version conflicts should return 409 or whether field-level updates should use atomic operators.

### P1.4 Boolean input coercion is unsafe

`is_completed` is typed as `any` in both task and subtask inputs. Code uses:

```ts
Boolean(is_completed)
```

Therefore the string `"false"` becomes `true`.

This affects:

- [`applyTaskWorkflowState`](../src/services/task.service.ts)
- [`updateSubtask`](../src/services/subtask.service.ts)

**Risk:** clients can unintentionally complete tasks or subtasks through string-valued payloads.  
**Recommended response:** validate that the value is actually boolean, or explicitly parse accepted wire values.

### P1.5 Authentication hides database failures as invalid tokens

[`authenticate`](../src/middleware/auth.ts) catches both JWT failures and database lookup failures and returns:

```json
{ "message": "Invalid or expired token" }
```

If MongoDB is temporarily unavailable, clients see an authentication error instead of a server/database failure, and the underlying error is not logged there.

**Risk:** poor diagnosis and misleading client behavior.  
**Recommended response:** handle JWT verification separately from user lookup, and pass database errors to centralized error handling.

### P1.6 Input validation is distributed and incomplete

Services accept many `any` values:

- `priority?: any`
- `is_completed?: any`
- `email?: any`
- query objects as `any`

Some invalid values are rejected by Mongoose later, while others are silently ignored. For example, invalid workflow status is not rejected by `applyTaskWorkflowState`.

**Risk:** inconsistent API behavior and difficult debugging.  
**Recommended response:** introduce small, local parsing helpers or typed request validators, not a new framework-wide abstraction.

### P1.7 `connectDB` exits the process inside a reusable function

[`connectDB`](../src/config/db.ts) calls `process.exit(1)` when connection fails.

This is acceptable for the executable startup path but makes the function difficult to reuse or unit test in isolation.

**Risk:** callers cannot choose recovery or error reporting behavior.  
**Recommended response:** log and rethrow; let [`index.ts`](../src/index.ts) decide process termination.

## P2 — Readability and normalization improvements

### P2.1 Serializers use `any` and current-time fallbacks

The serializers, including the tagged [`activity.serializer.ts`](../src/serializers/activity.serializer.ts), use `any`.

Several serializers also use:

```ts
new Date().toISOString()
```

when a persisted timestamp is missing.

That produces a response that looks valid but contains invented data. A missing `createdAt` should generally be a detectable serialization/data-integrity problem rather than silently becoming “now.”

### P2.2 Project lookup/slug logic is duplicated

Slug matching exists in:

- [`project.service.ts`](../src/services/project.service.ts)
- [`member.service.ts`](../src/services/member.service.ts)

The implementations are similar but not identical. The project service uses [`slugify`](../src/lib/utils.ts), while the member service repeats the transformation inline.

### P2.3 Test synchronization code lives in a production domain module

[`services/team.ts`](../src/services/team.ts) combines:

- real project-team membership helpers
- the `BarrierManager` used only by tests

The test route is correctly mounted only under `NODE_ENV === "test"`, but the production service module still contains the barrier implementation.

A later normalization could separate production team helpers from test coordination without changing behavior.

### P2.4 Repeated route parameter normalization

Many routes repeat:

```ts
Array.isArray(req.params.id)
  ? req.params.id[0] ?? ""
  : req.params.id ?? ""
```

This is technically defensive but visually noisy. A small route utility could improve readability, provided it does not hide validation.

### P2.5 Service methods do authorization, validation, persistence, side effects, and serialization

`TaskService.updateTask` is a particularly large orchestration method. It owns many responsibilities:

- resource lookup
- authorization
- assignment validation
- field mutation
- workflow normalization
- concurrency checks
- activity creation
- notification creation
- response loading
- serialization

This is not automatically wrong. It is a candidate for carefully extracting named helpers, not for introducing another broad abstraction layer.

## P3 — Optional or policy-level observations

### P3.1 Security header documentation does not fully match implementation

The project guidance mentions CSP, `no-referrer`, and `X-XSS-Protection: 0`, while [`security.ts`](../src/middleware/security.ts) currently sets a different header set.

This is a documentation/intent mismatch that should be resolved deliberately rather than fixed opportunistically.

### P3.2 API query behavior could be documented more explicitly

Invalid `projectId` or `assignedTo` filters in [`getTasks`](../src/services/task.service.ts) are ignored rather than rejected. That may be intentional, but it should be an explicit API decision.

---

# 6. Prioritized normalization plan

The following plan intentionally avoids a rewrite.

## Phase A — Establish Task input and workflow contracts

### A1. Normalize Task input parsing

**Files affected**

- [`server/src/services/task.service.ts`](../src/services/task.service.ts)
- Potentially a small helper under [`server/src/lib/`](../src/lib)
- [`server/test/characterization.test.ts`](../test/characterization.test.ts)

**Current problem**

Input types contain `any`, invalid workflow statuses can be ignored, and string booleans are coerced incorrectly.

**Proposed structure**

Use small explicit parsing functions:

- `parseTaskStatus`
- `parseBooleanField`
- `parsePriority`
- `parseOptionalDate`

Keep the existing request field names and response shapes.

**Behavior impact**

Invalid values should return clear 400 responses instead of silently changing or being ignored.

**Regression tests**

- `"false"` is rejected or interpreted according to the selected contract.
- Invalid status returns 400.
- Invalid priority returns 400.
- Completion timestamp remains stable while completed.
- Reopen clears `completedAt`.

**Acceptance criteria**

- No task workflow method uses `Boolean(value)` on unvalidated input.
- All accepted statuses and priorities are explicit.
- Existing valid requests produce identical responses.

### A2. Separate workflow mutation from Task orchestration

**Files affected**

- [`task.service.ts`](../src/services/task.service.ts)
- Task tests

**Current problem**

Workflow rules are correct but embedded inside a large service.

**Proposed structure**

Keep `applyTaskWorkflowState`, but make its input/output contract explicit and test it directly or through focused service tests.

**Behavior impact**

No intended API change.

**Acceptance criteria**

- One clearly documented function owns status/completion/completedAt invariants.
- Create, update, and complete routes all use that function.

## Phase B — Normalize Task authorization and assignment

### B1. Name authorization decisions explicitly

**Files affected**

- [`task.service.ts`](../src/services/task.service.ts)
- [`subtask.service.ts`](../src/services/subtask.service.ts)

**Current problem**

Authorization checks are repeated in slightly different forms.

**Proposed structure**

Introduce narrow helpers such as:

- `assertProjectManager`
- `assertCanModifyTask`
- `assertCanModifySubtask`

Do not move ownership rules into generic middleware because authorization depends on loaded resources.

**Regression tests**

- Owning manager allowed.
- Assigned developer allowed only for permitted fields.
- Unassigned developer rejected.
- Unrelated manager rejected.
- Deleted user token rejected.

### B2. Decide and test general Task concurrency semantics

**Files affected**

- [`models/Task.ts`](../src/models/Task.ts)
- [`task.service.ts`](../src/services/task.service.ts)
- [`concurrency.test.ts`](../test/concurrency.test.ts)

**Current problem**

Project writes use optimistic concurrency; Task writes do not.

**Proposed structure**

First add a failing characterization test for concurrent task updates. Then choose one:

1. Enable task optimistic concurrency and return 409 on version conflict, or
2. Use targeted atomic updates where last-write-wins is acceptable.

**Acceptance criteria**

- Concurrent Task behavior is documented and tested.
- Assignment/team-removal safeguards continue to pass.

## Phase C — Make side effects and cascade behavior explicit

### C1. Document and test failure behavior for side effects

**Files affected**

- [`task.service.ts`](../src/services/task.service.ts)
- [`project.service.ts`](../src/services/project.service.ts)
- Relevant tests

**Current problem**

Task operations are multi-write workflows without consistent transaction boundaries.

**Proposed structure**

Do not immediately add transactions everywhere. First document which writes are required for a successful operation:

- Core entity write
- Activity write
- Notification write
- Cascade deletes

Then add targeted failure tests.

**Acceptance criteria**

- Failure behavior is intentional and visible.
- No silently successful response after known invariant failure.
- Existing transaction behavior for team removal is preserved.

### C2. Make team-removal repair semantics explicit

**Files affected**

- [`project.service.ts`](../src/services/project.service.ts)
- [`concurrency.test.ts`](../test/concurrency.test.ts)

**Current problem**

Post-commit sweep failures are logged but converted into success.

**Proposed structure**

Choose and document one behavior:

- return a 500/409 with an explicit repair status,
- retry the sweep,
- or record a durable repair-needed event.

**Acceptance criteria**

- A failed sweep cannot be mistaken for a fully synchronized project.
- Existing rollback and successful transaction behavior remain unchanged.

## Phase D — Normalize serializers and shared utilities

### D1. Type serializer inputs

**Files affected**

- [`serializers/`](../src/serializers)
- Relevant service return types

**Current problem**

Serializers accept `any` and invent timestamps when values are missing.

**Proposed structure**

Use a shared minimal document type for `_id`, timestamps, and references. Preserve the current output interfaces.

**Acceptance criteria**

- No serializer needs `any` for normal Mongoose documents.
- Missing required persisted timestamps are handled explicitly.
- Response shapes remain unchanged.

### D2. Consolidate slug and ID normalization

**Files affected**

- [`lib/utils.ts`](../src/lib/utils.ts)
- [`project.service.ts`](../src/services/project.service.ts)
- [`member.service.ts`](../src/services/member.service.ts)

**Acceptance criteria**

- One slug implementation is used everywhere.
- Existing slug and title lookup behavior remains unchanged.

## Phase E — Apply conventions to other domains

Apply the proven Task conventions to:

1. Project
2. Team/members
3. Subtasks
4. Comments
5. Notifications
6. Activity

For each domain:

- Parse inputs at the service boundary.
- Keep ownership checks close to the loaded resource.
- Keep database mutation names explicit.
- Serialize once at the response boundary.
- Test success, invalid input, unauthorized input, missing resources, and side effects.

---

# 7. Existing tests and recommended additions

## Existing tests

### Characterization

[`characterization.test.ts`](../test/characterization.test.ts) covers:

- Registration, login, current user, profile
- Members and workload
- Project CRUD
- Task CRUD and completion
- Subtasks
- Comments
- Notifications
- Activity
- Health endpoints

### Concurrency

[`concurrency.test.ts`](../test/concurrency.test.ts) covers:

- Removing a developer unassigns open tasks
- Concurrent task creation versus team removal
- Team-removal failure rollback

### Infrastructure

[`infrastructure.test.ts`](../test/infrastructure.test.ts) covers:

- Environment validation
- Request IDs
- Sensitive data redaction
- Security headers
- Payload size limits
- Rate limiting
- Health probes
- Non-string credential handling
- Regex-safe search
- Activity limit capping

### Security and authorization

[`phase1-hardening.test.ts`](../test/phase1-hardening.test.ts) covers:

- Public registration cannot self-select manager role
- Notification updates are scoped to the caller
- Test barriers are not mounted in production

[`subtask-authorization.test.ts`](../test/subtask-authorization.test.ts) covers:

- Unauthenticated subtask mutation rejection
- Assigned developer permissions
- Owning manager permissions
- Unassigned developer rejection
- Unrelated manager rejection
- Missing resource handling

## Recommended regression tests

1. `PATCH /api/tasks/:id` with `is_completed: "false"` must have an explicit expected result.
2. `PATCH /api/subtasks/:id` with `is_completed: "false"` must have an explicit expected result.
3. Invalid task status must be rejected rather than silently ignored.
4. Invalid dates must return a stable 400 response.
5. Concurrent updates to different Task fields must define whether conflicts are rejected or last-write-wins.
6. Activity creation failure after Task creation must have documented behavior.
7. Notification creation failure must have documented behavior.
8. Partial Task cascade deletion must be tested.
9. Post-commit team-removal sweep failure must not appear as an unqualified success.
10. Database outage during authentication must not be reported as “invalid token.”
11. Serializer behavior when `createdAt` is absent should be explicit.
12. Comment authorization should be tested for the intended policy: any authenticated workspace user versus project/team membership.

---

# 8. Relevant instructions and skills found

## Repository instructions found

- [`AGENTS.md`](../../AGENTS.md) — applicable root project guidance.
- No nested `server/AGENTS.md` was found.
- No `.github/copilot-instructions.md` was found.
- [`server/README.md`](../README.md) — backend structure, API reference, environment variables, and scripts.
- [`backend-ci.yml`](../../.github/workflows/backend-ci.yml) — CI build, backend tests, root tests, and lint commands.

## Applicable installed skill

- `nodejs-backend-patterns` was found and loaded.
  - It applies to Express request lifecycle, TypeScript boundaries, authentication, error handling, database integration, testing, rate limiting, health checks, and graceful shutdown.
  - Its guidance supports the recommendations above, particularly explicit validation, typed boundaries, structured errors, and targeted tests.
- `code-review` is installed, but it is primarily designed for reviewing changes since a fixed commit or branch. This task was a read-only architecture and understandability audit, not a diff review, so it was not used as the primary workflow.
- No repository-specific backend-refactoring or documentation skill was found.

---

# 9. Proposed later documentation structure

This report is the first documentation artifact. A later small documentation set could be added without changing runtime architecture:

```text
server/docs/
├── architecture.md
├── request-lifecycle.md
├── tasks.md
├── authorization.md
├── concurrency-and-transactions.md
├── errors-and-validation.md
├── testing.md
└── api-contracts.md
```

Suggested contents:

- `architecture.md` — app startup and routes → services → models → serializers.
- `request-lifecycle.md` — one generic authenticated request.
- `tasks.md` — complete Task lifecycle and state invariants.
- `authorization.md` — role authorization versus resource ownership.
- `concurrency-and-transactions.md` — project team removal and Task update behavior.
- `errors-and-validation.md` — `AppError`, Mongoose errors, and input parsing.
- `testing.md` — fixtures, MongoMemoryReplSet, barriers, and commands.
- `api-contracts.md` — request/response field mapping, especially camelCase to snake_case.

---

# Final assessment

The backend already has a coherent, traceable structure:

- Routes are generally thin.
- Services contain the important business rules.
- Models clearly express relationships and indexes.
- Serializers protect the public response shape.
- Task assignment and team-removal concurrency have meaningful safeguards.
- Authorization coverage is strongest around subtasks and project ownership.
- The current backend build and all 33 backend tests pass.

The highest-value normalization work is not a rewrite. It is:

1. Make input parsing explicit, especially booleans, statuses, priorities, and dates.
2. Define general Task concurrency behavior.
3. Make multi-write failure semantics explicit.
4. Stop silently reporting successful team synchronization when the repair sweep fails.
5. Reduce `any`, invented serializer defaults, duplicated slug logic, and test-only coupling.
6. Add regression tests before extracting helpers.

No implementation changes are included in this report.
