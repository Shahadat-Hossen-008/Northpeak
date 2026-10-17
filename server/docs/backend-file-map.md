# Backend File Map

## Directory overview

```text
server/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── index.ts
│   ├── config/
│   ├── lib/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── serializers/
│   ├── services/
│   └── seed/
├── test/
├── docs/
├── package.json
└── tsconfig.json
```

## Startup and configuration

| File | Responsibility | Debug here when |
|---|---|---|
| [`src/index.ts`](../src/index.ts) | Starts the server when run directly outside tests; exports `app` and `startServer` | The process does not start or startup errors are not visible |
| [`src/app.ts`](../src/app.ts) | Creates Express app and registers middleware/routes/health endpoints | A route is missing, middleware order is wrong, or test-only routes are exposed |
| [`src/server.ts`](../src/server.ts) | Connects to MongoDB, listens on configured port, registers shutdown | The listener or database startup fails |
| [`src/config/env.ts`](../src/config/env.ts) | Loads and validates `NODE_ENV`, port, Mongo URI, JWT secret, CORS, proxy setting | Environment configuration is rejected |
| [`src/config/db.ts`](../src/config/db.ts) | Calls `mongoose.connect` | MongoDB connection fails |
| [`src/services/shutdown.ts`](../src/services/shutdown.ts) | Closes HTTP and database resources | SIGTERM/SIGINT shutdown hangs |

## Models

All model definitions are under [`src/models/`](../src/models):

| File | Model | Main dependencies |
|---|---|---|
| [`User.ts`](../src/models/User.ts) | Users and roles | Referenced by projects, tasks, comments, notifications, activities |
| [`Project.ts`](../src/models/Project.ts) | Projects, manager, team | Referenced by tasks, notifications, activities |
| [`Task.ts`](../src/models/Task.ts) | Task fields and workflow state | References project and assigned user |
| [`Subtask.ts`](../src/models/Subtask.ts) | Task child items | References task |
| [`Comment.ts`](../src/models/Comment.ts) | Task discussion entries | References task and author |
| [`Notification.ts`](../src/models/Notification.ts) | Direct and role-wide notifications | Optional task/project context |
| [`Activity.ts`](../src/models/Activity.ts) | Audit-style activity entries | Optional project/task/actor context |
| [`index.ts`](../src/models/index.ts) | Re-exports all models/types | Convenience barrel |

## Middleware

| File | Key functions | Purpose |
|---|---|---|
| [`auth.ts`](../src/middleware/auth.ts) | `authenticate`, `requireRole`, `generateToken` | JWT authentication, role checks, token creation |
| [`error.ts`](../src/middleware/error.ts) | `AppError`, `asyncHandler`, `errorHandler` | Async error forwarding and consistent error responses |
| [`logger.ts`](../src/middleware/logger.ts) | `requestLogger`, `redactSensitiveData` | Request IDs, timing logs, redaction helper |
| [`security.ts`](../src/middleware/security.ts) | `securityHeaders` | HTTP security headers |
| [`rateLimit.ts`](../src/middleware/rateLimit.ts) | `createAuthRateLimiter` | In-memory auth endpoint throttling |

When a protected request returns 401 or 403, inspect [`auth.ts`](../src/middleware/auth.ts) first, then the target service for resource-specific authorization.

## Routes

Routes parse HTTP input, attach middleware, call services, and choose response status codes. They should not contain the main business rules.

| File | Mounted path | Main endpoints |
|---|---|---|
| [`auth.ts`](../src/routes/auth.ts) | `/api/auth` | register, login, me, profile |
| [`members.ts`](../src/routes/members.ts) | `/api/members` | list, profile, workload |
| [`projects.ts`](../src/routes/projects.ts) | `/api/projects` | list, details, members, CRUD |
| [`tasks.ts`](../src/routes/tasks.ts) | `/api/tasks` | list, details, CRUD, complete |
| [`subtasks.ts`](../src/routes/subtasks.ts) | `/api/subtasks` | list, task list, CRUD |
| [`comments.ts`](../src/routes/comments.ts) | `/api/comments` | counts, task comments, create/delete |
| [`notifications.ts`](../src/routes/notifications.ts) | `/api/notifications` | list and mark read |
| [`activity.ts`](../src/routes/activity.ts) | `/api/activity` | filtered activity feed |
| [`testBarriers.ts`](../src/routes/testBarriers.ts) | `/api/test/barriers` | Test-only concurrency controls |

## Services

Services combine input checks, resource lookup, authorization, database writes, side effects, and serialization.

| File | Key functions/responsibility |
|---|---|
| [`auth.service.ts`](../src/services/auth.service.ts) | Registration, login, profile lookup/update, bcrypt, tokens |
| [`member.service.ts`](../src/services/member.service.ts) | Workspace members and workload calculations |
| [`project.service.ts`](../src/services/project.service.ts) | Project CRUD, team validation, team-removal task synchronization, cascades |
| [`task.service.ts`](../src/services/task.service.ts) | Task queries, creation, updates, assignment, workflow state, completion, cascades |
| [`subtask.service.ts`](../src/services/subtask.service.ts) | Subtask CRUD and parent-task authorization |
| [`comment.service.ts`](../src/services/comment.service.ts) | Comment counts, CRUD, activity, notifications |
| [`notification.service.ts`](../src/services/notification.service.ts) | Notification visibility and read state |
| [`activity.service.ts`](../src/services/activity.service.ts) | Activity filtering, population, and limits |
| [`team.ts`](../src/services/team.ts) | Project team lookup helpers and test synchronization barriers |
| [`shutdown.ts`](../src/services/shutdown.ts) | Process shutdown lifecycle |

For a Task bug, start with `routes/tasks.ts`, then `services/task.service.ts`, then `models/Task.ts` and `serializers/task.serializer.ts`. Inspect `project.service.ts` when the issue involves team membership.

## Serializers

Serializers convert Mongoose documents from camelCase into the public snake_case API shape.

| File | Output |
|---|---|
| [`user.serializer.ts`](../src/serializers/user.serializer.ts) | Auth users and profiles |
| [`member.serializer.ts`](../src/serializers/member.serializer.ts) | Members and workload task objects |
| [`project.serializer.ts`](../src/serializers/project.serializer.ts) | Projects |
| [`task.serializer.ts`](../src/serializers/task.serializer.ts) | Tasks, populated project, populated assignee |
| [`subtask.serializer.ts`](../src/serializers/subtask.serializer.ts) | Subtasks |
| [`comment.serializer.ts`](../src/serializers/comment.serializer.ts) | Comments and author |
| [`notification.serializer.ts`](../src/serializers/notification.serializer.ts) | Notifications |
| [`activity.serializer.ts`](../src/serializers/activity.serializer.ts) | Activities and actor |

## Utilities and tests

| File/group | Responsibility |
|---|---|
| [`src/lib/utils.ts`](../src/lib/utils.ts) | `escapeRegex` and `slugify` |
| [`src/seed/seed.ts`](../src/seed/seed.ts) | Demo data creation |
| [`test/characterization.test.ts`](../test/characterization.test.ts) | Endpoint behavior and response contracts |
| [`test/concurrency.test.ts`](../test/concurrency.test.ts) | Team/task race and rollback behavior |
| [`test/infrastructure.test.ts`](../test/infrastructure.test.ts) | Configuration and middleware behavior |
| [`test/phase1-hardening.test.ts`](../test/phase1-hardening.test.ts) | Security regressions and test route isolation |
| [`test/subtask-authorization.test.ts`](../test/subtask-authorization.test.ts) | Subtask authorization matrix |

## Debugging by symptom

| Symptom | First files to inspect |
|---|---|
| 401 | `middleware/auth.ts`, then route ordering in `app.ts` |
| 403 | Route `requireRole`, then owning service authorization |
| Wrong JSON field names | Relevant serializer |
| Task assignment rejected | `task.service.ts`, `services/team.ts`, `project.service.ts` |
| Task remains assigned after team removal | `project.service.ts`, `concurrency.test.ts` |
| Missing activity or notification | Domain service after the main save |
| 500 without details | `middleware/error.ts` and server logs |
| MongoDB connection failure | `config/env.ts`, `config/db.ts`, `server.ts` |
