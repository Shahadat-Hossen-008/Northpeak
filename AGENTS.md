# Northpeak — Project Management SaaS

Northpeak is a deadline-aware project management platform built for software engineering teams.

## Overview & Architecture

- **Frontend**: React 19, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, Radix UI.
- **Backend**: Express.js, TypeScript, MongoDB with Mongoose ODM.
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing stored in `localStorage` (`northpeak_token`).
- **Data Engine**: Automatic deadline health calculations (`on_track`, `due_soon`, `overdue`, `completed_on_time`, `completed_late`).

## Workspaces & Roles

1. **Project Manager**:
   - Create, edit, and delete projects.
   - Assign tasks with priority, start dates, and deadlines.
   - Monitor team workload capacity, project completion, and overdue work.
   - Global task filters, search, and activity tracking.

2. **Developer**:
   - Kanban board view (To do, In progress, Completed).
   - Check off and manage granular subtasks with instant progress updates.
   - Collaborate via task comments and discussion threads.
   - Real-time deadline awareness with color-coded status badges.

## Project Structure

```
├── server/                    # Express.js + TypeScript + MongoDB backend
│   ├── src/
│   │   ├── config/            # Database connection (Mongoose)
│   │   ├── models/            # Typed Mongoose schemas (User, Project, Task, Subtask, Comment, Notification, Activity)
│   │   ├── middleware/        # JWT auth, role authorization, and request validation
│   │   ├── routes/            # REST API endpoints (/auth, /projects, /tasks, /subtasks, /comments, /notifications, /activity, /members)
│   │   ├── seed/              # Database demo data seeder
│   │   └── index.ts           # Express server entry point (port 5000)
│   ├── package.json
│   └── tsconfig.json
├── src/                       # Frontend application
│   ├── components/            # UI components, dialogs, badges, and layout
│   ├── hooks/                 # TanStack Query hooks, useAuth, and React context
│   ├── lib/                   # API client (fetch wrapper), deadline engine, utilities
│   ├── routes/                # TanStack Router file-based routes
│   └── styles.css             # Tailwind v4 theme and styling
├── package.json               # Root scripts (Vite frontend, proxy configuration)
└── vite.config.ts             # Vite configuration with /api proxy to http://localhost:5000
```

## REST API Specification

- `POST /api/auth/register` — Create new account (Manager or Developer)
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Retrieve current authenticated user profile
- `PATCH /api/auth/profile` — Update name or change password
- `GET /api/members` — List all workspace team members
- `GET /api/projects` — List all projects
- `GET /api/projects/:id` — Get single project details
- `POST /api/projects` — Create project (Manager only)
- `PATCH /api/projects/:id` — Update project details/status/priority
- `DELETE /api/projects/:id` — Delete project (Cascade deletes tasks, subtasks, comments, activity)
- `GET /api/tasks` — List tasks (supports `projectId`, `assignedTo`, `priority`, `search` query filters)
- `GET /api/tasks/:id` — Get single task details
- `POST /api/tasks` — Create task
- `PATCH /api/tasks/:id` — Update task fields
- `PATCH /api/tasks/:id/complete` — Toggle task completion status
- `DELETE /api/tasks/:id` — Delete task (Cascade deletes subtasks and comments)
- `GET /api/subtasks` & `GET /api/subtasks/task/:taskId` — List subtasks
- `POST /api/subtasks/task/:taskId` — Add subtask
- `PATCH /api/subtasks/:id` — Update subtask title or toggle completion
- `DELETE /api/subtasks/:id` — Delete subtask
- `GET /api/comments/task/:taskId` — List comments for a task
- `GET /api/comments/counts` — Retrieve comment count map grouped by task ID
- `POST /api/comments/task/:taskId` — Post a new comment
- `DELETE /api/comments/:id` — Delete comment (author or manager)
- `GET /api/notifications` — List user notifications
- `PATCH /api/notifications/mark-read` — Mark notifications as read
- `GET /api/activity` — Workspace activity feed audit log

## Demo Seed Credentials

All seed accounts use the default password: `password123`

- **Project Manager**: `nadia@northpeak.dev`
- **Developers**:
  - `sarah@northpeak.dev`
  - `rahim@northpeak.dev`
  - `john@northpeak.dev`
  - `ayesha@northpeak.dev`

## Running the Application

- **Database**: Ensure MongoDB is running locally on `mongodb://localhost:27017/northpeak`.
- **Seed Data**: Run database seeder (`npm run server:seed`).
- **Backend**: Run Express server (`npm run server` or `cd server && npm run dev`) on port 5000.
- **Frontend**: Run Vite frontend (`npm run dev`) on port 8080 (proxies `/api` &rarr; `http://localhost:5000`).
