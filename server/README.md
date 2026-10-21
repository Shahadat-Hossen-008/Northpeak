# Northpeak Backend API

Express.js and TypeScript REST API server for the Northpeak project management platform, backed by MongoDB and Mongoose ODM.

## Tech Stack

- **Runtime**: Node.js & Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (`jsonwebtoken`) with `bcryptjs` password hashing
- **Security & Utilities**: CORS, dotenv, typed middleware

## Directory Structure

```
server/
├── src/
│   ├── config/
│   │   └── db.ts             # Mongoose connection & MongoDB lifecycle
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication & requireRole middleware
│   ├── models/
│   │   ├── Activity.ts       # Audit trail activities
│   │   ├── Comment.ts        # Task comments
│   │   ├── Notification.ts   # User notification events
│   │   ├── Project.ts        # Projects schema
│   │   ├── Subtask.ts        # Task sub-items with completion tracking
│   │   ├── Task.ts           # Tasks with deadlines, priorities & assignees
│   │   ├── User.ts           # Users with hashed passwords and roles
│   │   └── index.ts          # Central model exports
│   ├── routes/
│   │   ├── activity.ts       # Activity audit log endpoints
│   │   ├── auth.ts           # Register, login, me, and profile update
│   │   ├── comments.ts       # Comment CRUD and task count maps
│   │   ├── members.ts        # Team member listing
│   │   ├── notifications.ts  # Notification retrieval and mark-read
│   │   ├── projects.ts       # Project CRUD with cascade delete
│   │   ├── subtasks.ts       # Subtask CRUD with completion toggling
│   │   └── tasks.ts          # Task CRUD, filters, and complete toggle
│   ├── seed/
│   │   └── seed.ts           # Database seeder script
│   ├── index.ts              # Vercel-compatible Express application entry point
│   └── start.ts              # Long-running Node.js server entry point
├── package.json
└── tsconfig.json
```

## Environment Variables

Configure these in `server/.env` (see `server/.env.example`) or pass via your backend hosting platform:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/northpeak
JWT_SECRET=northpeak_super_secret_jwt_key_2026_dev_fallback
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:8080
TRUST_PROXY=false
RECONCILE_INTERVAL_MS=300000
```

In `NODE_ENV=production`:

- `JWT_SECRET` must be explicitly defined and at least 32 characters.
- `MONGODB_URI` must be explicitly defined (and backed by a replica set / Atlas cluster for multi-document transactions).
- `CORS_ORIGIN` must be explicitly defined as one or more comma-separated HTTPS client origins (wildcard `*` is rejected).

## Available Scripts

From the repository root or inside `server/`:

```bash
# Start development server with hot-reload (port 5000)
npm run server            # From repository root
npm run dev               # Inside server/

# Build TypeScript to dist/
npm run server:build      # From repository root
npm run build             # Inside server/

# Start compiled production server (requires server/dist/ build)
npm run server:start      # From repository root
npm start                 # Inside server/

# Seed MongoDB with demo users, projects, tasks, and comments
npm run server:seed       # From repository root
npm run seed              # Inside server/

# Run backend test suite
npm --prefix server test  # From repository root
npm test                  # Inside server/
```

## Demo Seed Credentials

All seed accounts use the password: `password123`

| Name                | Role            | Email                  |
| :------------------ | :-------------- | :--------------------- |
| **Nadia Chowdhury** | Project Manager | `nadia@northpeak.dev`  |
| **Sarah Khan**      | Developer       | `sarah@northpeak.dev`  |
| **Rahim Ahmed**     | Developer       | `rahim@northpeak.dev`  |
| **John Doe**        | Developer       | `john@northpeak.dev`   |
| **Ayesha Siddiqua** | Developer       | `ayesha@northpeak.dev` |

## API Endpoints Reference

### Authentication (`/api/auth`)

- `POST /api/auth/register` — Register a new account (`name`, `email`, `password`, `role`). Returns `{ requiresEmailVerification: true, email }`; email verification is required before sign-in.
- `POST /api/auth/login` — Sign in (`email`, `password`). Returns JWT token & user object.
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Bearer` token required).
- `PATCH /api/auth/profile` — Update display name and/or password.

### Team Members (`/api/members`)

- `GET /api/members` — List all users in the workspace (excludes password hashes).

### Projects (`/api/projects`)

- `GET /api/projects` — List all projects.
- `GET /api/projects/:id` — Retrieve a single project by ID.
- `POST /api/projects` — Create a project (_Manager role only_).
- `PATCH /api/projects/:id` — Update project details, deadlines, and priorities (_Manager role only_).
- `DELETE /api/projects/:id` — Delete project and cascade-delete its associated tasks, subtasks, comments, and activities (_Manager role only_).

### Tasks (`/api/tasks`)

- `GET /api/tasks` — List tasks with optional query filters:
  - `projectId=<id>`
  - `assignedTo=<id>`
  - `priority=low|medium|high|critical`
  - `is_completed=true|false`
  - `search=<keyword>`
- `GET /api/tasks/:id` — Retrieve single task details with populated project and assignee.
- `POST /api/tasks` — Create a task (_Manager role only_).
- `PATCH /api/tasks/:id` — Update task fields (_Manager or assigned developer_).
- `PATCH /api/tasks/:id/complete` — Mark task completed or reopen (_Manager or assigned developer_).
- `DELETE /api/tasks/:id` — Delete task and cascade-delete subtasks and comments (_Manager role only_).

### Subtasks (`/api/subtasks`)

- `GET /api/subtasks` — List all subtasks across the workspace.
- `GET /api/subtasks/task/:taskId` — List subtasks for a specific task.
- `POST /api/subtasks/task/:taskId` — Add a new subtask to a task.
- `PATCH /api/subtasks/:id` — Update title or toggle `is_completed` status.
- `DELETE /api/subtasks/:id` — Delete a subtask.

### Comments (`/api/comments`)

- `GET /api/comments/task/:taskId` — Retrieve task discussion comments with author info.
- `GET /api/comments/counts` — Retrieve a mapping of task ID to total comment counts.
- `POST /api/comments/task/:taskId` — Post a new comment on a task.
- `PATCH /api/comments/:id` — Update a comment body (_Author only_).
- `DELETE /api/comments/:id` — Delete a comment (_Author or Manager only_).

### Notifications (`/api/notifications`)

- `GET /api/notifications` — Retrieve notifications for the current user.
- `PATCH /api/notifications/mark-read` — Mark an array of notification IDs as read.

### Activity Feed (`/api/activity`)

- `GET /api/activity` — Retrieve recent activity items (supports `projectId`, `taskId`, and `limit` query parameters).

## Data Integrity & Cascade Rules

- Deleting a **Project** automatically removes all associated **Tasks**, **Subtasks**, **Comments**, and **Activity** records.
- Deleting a **Task** automatically removes all associated **Subtasks** and **Comments**.
- Unassigning a developer sets `assigned_developer_id` to `null` while preserving the task.
