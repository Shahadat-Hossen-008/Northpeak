# Data Model

The backend uses Mongoose schemas over MongoDB. Model definitions are under [`server/src/models/`](../src/models). `timestamps: true` adds `createdAt` and `updatedAt` unless a schema explicitly configures otherwise.

## User

Source: [`User.ts`](../src/models/User.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `name` | string | Required | Trimmed |
| `email` | string | Required | Lowercased, trimmed, unique index |
| `passwordHash` | string | Required | Stores bcrypt hash, not plaintext password |
| `role` | `"manager" \| "developer"` | Required, default `"developer"` | Mongoose enum |
| `createdAt` | Date | Automatic | Timestamp |
| `updatedAt` | Date | Automatic | Timestamp |

The public registration service always creates a developer, even if the request includes `role: "manager"`. Managers are created by seed/test setup or another trusted mechanism.

Used by [`auth.service.ts`](../src/services/auth.service.ts), [`member.service.ts`](../src/services/member.service.ts), [`task.service.ts`](../src/services/task.service.ts), and project/team services.

## Project

Source: [`Project.ts`](../src/models/Project.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `title` | string | Required | Trimmed |
| `description` | string | Default `""` | Trimmed |
| `manager` | ObjectId → User | Required | Project owner |
| `team` | ObjectId[] → User | Default `[]` | Explicit project team |
| `startDate` | Date or null | Default `null` | Project start |
| `deadline` | Date or null | Default `null` | Project deadline |
| `priority` | `"low" \| "medium" \| "high" \| "critical"` | Required, default `"medium"` | Mongoose enum |
| `createdAt` | Date | Automatic | Timestamp |
| `updatedAt` | Date | Automatic | Timestamp |

Schema options enable `optimisticConcurrency: true`. Indexes exist on `manager` and `team`.

Project updates can remove developers from `team`. [`project.service.ts`](../src/services/project.service.ts) then unassigns those developers from open tasks.

## Task

Source: [`Task.ts`](../src/models/Task.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `project` | ObjectId → Project | Required | Parent project |
| `title` | string | Required | Trimmed |
| `description` | string | Default `""` | Trimmed |
| `assignedDeveloper` | ObjectId → User or null | Default `null` | Optional developer assignment |
| `deadline` | Date or null | Default `null` | Task deadline |
| `priority` | Priority string | Required, default `"medium"` | Mongoose enum |
| `status` | Task workflow string | Required, default `"todo"` | `todo`, `in_progress`, `in_review`, `done` |
| `isCompleted` | boolean | Default `false` | Completion flag |
| `completedAt` | Date or null | Default `null` | Completion timestamp |
| `createdAt` | Date | Automatic | Timestamp |
| `updatedAt` | Date | Automatic | Timestamp |

Indexes:

- `{ project: 1, status: 1 }`
- `{ assignedDeveloper: 1, status: 1 }`
- `{ deadline: 1 }`

The service, rather than the schema alone, keeps `status`, `isCompleted`, and `completedAt` consistent.

## Subtask

Source: [`Subtask.ts`](../src/models/Subtask.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `task` | ObjectId → Task | Required | Parent task |
| `title` | string | Required | Trimmed |
| `isCompleted` | boolean | Default `false` | Subtask completion |
| `completedAt` | Date or null | Default `null` | Completion timestamp |
| `createdAt` | Date | Automatic | Timestamp |
| `updatedAt` | Date | Automatic | Timestamp |

`task` has an index for listing subtasks by task. Subtask authorization is enforced by [`subtask.service.ts`](../src/services/subtask.service.ts).

## Comment

Source: [`Comment.ts`](../src/models/Comment.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `task` | ObjectId → Task | Required | Commented task |
| `author` | ObjectId → User | Required | Comment author |
| `body` | string | Required | Trimmed |
| `createdAt` | Date | Automatic | Timestamp |
| `updatedAt` | Date | Automatic | Timestamp |

`task` has an index. The comment service populates `author` when returning comments.

## Notification

Source: [`Notification.ts`](../src/models/Notification.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `recipient` | ObjectId → User or null | Default `null` | Private recipient |
| `audience` | `"manager" \| "developer"` or null | Default `null` | Role-wide audience |
| `kind` | string | Required | Notification category |
| `title` | string | Required | Display title |
| `body` | string | Default `""` | Display body |
| `task` | ObjectId → Task or null | Default `null` | Optional task context |
| `project` | ObjectId → Project or null | Default `null` | Optional project context |
| `isRead` | boolean | Default `false` | Read state |
| `createdAt` | Date | Automatic | Timestamp |

There is no `updatedAt` because the schema configures `timestamps: { createdAt: true, updatedAt: false }`.

Indexes:

- `{ recipient: 1, isRead: 1, createdAt: -1 }`
- `{ audience: 1, isRead: 1, createdAt: -1 }`

## Activity

Source: [`Activity.ts`](../src/models/Activity.ts)

| Field | Type | Required/default | Validation or meaning |
|---|---|---|---|
| `_id` | ObjectId | Generated | MongoDB identifier |
| `project` | ObjectId → Project or null | Default `null` | Optional project context |
| `task` | ObjectId → Task or null | Default `null` | Optional task context |
| `actor` | ObjectId → User or null | Default `null` | User who caused the event |
| `message` | string | Required | Human-readable event |
| `createdAt` | Date | Automatic | Creation timestamp only |

Indexes:

- `{ project: 1, createdAt: -1 }`
- `{ task: 1, createdAt: -1 }`
- `{ createdAt: -1 }`

There is no `updatedAt` because activity records are append-only in the current model.

## Model registration

[`models/index.ts`](../src/models/index.ts) re-exports all seven models and their types. Services generally import models directly from their individual files.

## Validation ownership

Mongoose validates required fields, enum values, trimming, and ObjectId casting. Services add business validation such as:

- project ownership;
- developer role;
- project-team membership;
- task/subtask authorization;
- title/body length and presence;
- valid query identifiers.
