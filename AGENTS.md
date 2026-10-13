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

## Modular Frontend Architecture

The frontend follows a clean, modular architecture inspired by `lemonhive-nextjs`:

- **Dedicated Contracts**: Every atomic component, section, layout, and builder page is organized into its own folder containing `index.tsx` (implementation) and `interface.ts` (TypeScript types/props).
- **Typed Section Registry**: Feature sections are mapped in `src/sections/registry/` (`registry.ts`, `render.tsx`, `interface.ts`), allowing type-safe dynamic section rendering via `<SectionRenderer type="..." props={...} />` and `getSection(type)` with runtime component existence guards.
- **Domain-Driven React Query Hooks**: TanStack Query hooks are modularized into domain files under `src/hooks/queries/` (`tasks.ts`, `projects.ts`, `members.ts`, `subtasks.ts`, `comments.ts`, `notifications.ts`, `activity.ts`, `utils.ts`, `index.ts`), eliminating monolithic `queries.ts` files while providing optimistic UI updates and targeted query invalidations.
- **Dashboard Selectors**: Heavy dashboard metrics and developer workload calculations are extracted into `src/lib/dashboard-selectors.ts` (`selectManagerDashboardMetrics`, `selectDeveloperDashboardMetrics`), keeping page builders declarative. These selectors are pure functions; memoization can be added later if profiling shows it is needed.
- **Page Builders**: Standalone builder pages (`manager-dashboard`, `developer-dashboard`, `notifications`, `settings`) live in `src/builder/pages/`. Routes in `src/routes/` are thin wrappers that provide routing head metadata and invoke page builders.
- **Domain API Modularization**: The REST API layer is split by resource domain in `src/backend/`, backed by a typed HTTP client with token handling and error parsing.
- **Strict Type Separation**: Single source of truth for universal types in `src/types/backend.ts` (data schemas) and `src/types/frontend.ts` (UI enums, status badges, view modes), eliminating duplicate definitions.
- **Isolated Utilities & Fast Refresh Compliance**: Non-component functions (`homePathForRole`, `WORKFLOW_COLUMNS`, `subtaskProgress`, `projectStats`, deadline states) are housed in `src/lib/` or companion `.ts` files (`auth-utils.ts`, `auth-context.ts`, `columns.ts`) to guarantee React Fast Refresh compliance without warnings.
- **Defensive Data Handling & Null Safety**: Charts (`project-status-donut`, `task-status-donut`), task cards (`task-card`), and badge renderers include runtime fallbacks for `undefined`/null inputs (`tasks ?? []`, `projects ?? []`, `subtasks = []`, `href = "#"`, unassigned author fallbacks), preventing runtime crashes during loading and SSR states.
- **Direct Modular Imports**: All application routes and feature sections use direct modular imports; legacy compatibility barrels have been deprecated and cleaned up.

## Component & Section Registry Pattern

Feature sections can be rendered directly or dynamically through the typed registry:

```tsx
import { SectionRenderer } from "@/sections/registry";

// Type-safe rendering guaranteed by SectionPropsMap
<SectionRenderer
  type="project-status-donut"
  props={{ projects: allProjects, tasks: allTasks, isLoading: false }}
/>
```

Available registered sections:
- `task-filters`, `task-card`, `task-table`, `task-board`, `task-detail`
- `project-card`, `project-overview`, `project-tasks-list`, `member-detail-sheet`
- `comment-section`, `subtask-list`, `notification-panel`
- `project-status-donut`, `task-status-donut`

## Dashboard Selectors Architecture

To ensure separation of concerns and high rendering performance, metric calculations are decoupled from UI components:

```tsx
import { selectManagerDashboardMetrics } from "@/lib/dashboard-selectors";

const {
  allTasks,
  allProjects,
  completedTasks,
  inProgressTasks,
  overdueTasks,
  overallPercentage,
  developerWorkloads,
} = selectManagerDashboardMetrics({
  tasks: tasks.data,
  projects: projects.data,
  members: members.data,
});
```

## Route Builders Pattern

TanStack Router files in `src/routes/` act as thin wrappers providing page title metadata and mounting builder pages:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ManagerDashboardPage } from "@/builder/pages/manager-dashboard";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () =>
    meta(
      "Manager dashboard",
      "Project progress, overdue work, developer workload and upcoming deadlines."
    ),
  component: () => <ManagerDashboardPage />,
});
```

## Brand Identity & Error Architecture

- **Brand Assets**: Authentic brand marks (`public/logo-mark.png`, `public/logo.png`, `public/logo-on-dark.png`) and `public/favicon.ico` (multi-resolution icon resource generated directly from `logo-mark.png`) are configured in root metadata (`rel="icon"`, `og:image`, `twitter:image`, `apple-touch-icon`). The `<Brand />` primitive in `src/builder/layout/app-shell/` renders the official logo mark.
- **Error Handling Architecture**: Standalone React builder pages (`src/builder/pages/not-found/` and `src/builder/pages/server-error/`) serve as the TanStack Router `notFoundComponent` and `errorComponent` handlers in `src/routes/__root.tsx`. They present a focused, high-clarity error card with a single action button ("Back to Dashboard" or "Back to Home") that dynamically resolves to the user's role workspace. Static error files have been removed from `public/` in favor of application page builders.

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
├── src/                       # Frontend application (Modular Architecture)
│   ├── backend/               # Domain-driven REST API clients
│   │   ├── client.ts          # Base fetch client with JWT authentication & error handling
│   │   ├── auth.ts            # Auth & profile endpoints
│   │   ├── projects.ts        # Projects endpoints
│   │   ├── tasks.ts           # Tasks endpoints
│   │   ├── subtasks.ts        # Subtasks endpoints
│   │   ├── comments.ts        # Task comments & counts
│   │   ├── members.ts         # Team members & workload
│   │   ├── notifications.ts   # Notification alerts & mark-read
│   │   ├── activity.ts        # Workspace activity feed audit log
│   │   └── index.ts           # Re-exports all domain API clients
│   ├── builder/               # Layouts and Page Assembly Layer
│   │   ├── layout/            # Layout builders (app-shell/, auth-layout/, meta.ts)
│   │   ├── pages/             # Page builders (manager-dashboard/, developer-dashboard/, notifications/, settings/, not-found/, server-error/)
│   │   └── index.ts           # Builder layer exports
│   ├── components/            # Atomic Primitives (each with index.tsx + interface.ts)
│   │   ├── avatar/            # UserAvatar component
│   │   ├── badges/            # Status, priority, deadline & workflow badges
│   │   ├── cards/             # StatCard, SectionCard, MetricCard
│   │   ├── dialogs/           # Task & Project modal dialogs, TeamSelector, ConfirmDelete
│   │   ├── feedback/          # EmptyState, LoadingState, ErrorState
│   │   ├── page-header/       # PageHeader with title, description, and actions
│   │   ├── progress/          # ProgressBar & CircularProgress
│   │   ├── task-view-switcher/# Table / Kanban switcher toggle
│   │   ├── ui/                # Radix UI primitives
│   │   └── index.ts           # Central components barrel
│   ├── hooks/                 # Modular Query hooks, useAuth, and AuthProvider
│   │   ├── auth-context.ts    # AuthContext & useAuth hook
│   │   ├── auth-provider.tsx  # AuthProvider React component
│   │   ├── useAuth.ts         # Re-exports auth hook & context
│   │   └── queries/           # Domain-driven TanStack Query modules
│   │       ├── activity.ts    # Activity feed queries
│   │       ├── comments.ts    # Task comment queries & mutations
│   │       ├── members.ts     # Team member & workload queries
│   │       ├── notifications.ts # User notifications & mark-read mutations
│   │       ├── projects.ts    # Project CRUD mutations & queries
│   │       ├── subtasks.ts    # Subtask mutations & queries
│   │       ├── tasks.ts       # Task queries & optimistic status mutations
│   │       ├── utils.ts       # Query invalidation helpers
│   │       └── index.ts       # Central re-export of all domain queries & types
│   ├── lib/                   # Utilities, deadline engine, task & project metrics
│   │   ├── api.ts             # Facade re-exporting @/backend and @/types
│   │   ├── auth-utils.ts      # Auth route navigation helpers
│   │   ├── dashboard-selectors.ts # Metric selectors for manager and developer dashboards
│   │   ├── deadline.ts        # Automatic deadline status engine
│   │   ├── project-utils.ts   # Project stats & progress calculations
│   │   ├── task-utils.ts      # Task filtering, subtask & progress calculations
│   │   └── utils.ts           # Tailwind cn() class merge helper
│   ├── routes/                # Thin TanStack Router file-based route wrappers
│   ├── sections/              # Feature Sections (each with index.tsx + interface.ts)
│   │   ├── charts/            # ProjectStatusDonutChart, TaskStatusDonutChart
│   │   ├── comment-section/   # Comment thread & reply composer
│   │   ├── member-detail-sheet/# Team member detail slide-over
│   │   ├── notification-panel/# Activity notifications listing
│   │   ├── project-card/      # Project summary card
│   │   ├── project-deliverables/# Project task list & progress section
│   │   ├── registry/          # Typed section registry & SectionRenderer
│   │   │   ├── index.ts       # Re-exports SectionRenderer, registry, and types
│   │   │   ├── interface.ts   # SectionPropsMap & SectionType contracts
│   │   │   ├── registry.ts    # SECTION_REGISTRY & getSection() resolver
│   │   │   └── render.tsx     # <SectionRenderer /> component with runtime guards
│   │   ├── subtask-list/      # Checkable subtask list
│   │   ├── task-board/        # Kanban board view
│   │   ├── task-card/         # Draggable / viewable task card (null-safe)
│   │   ├── task-detail/       # Full task details sheet
│   │   ├── task-filters/      # Global filter bar for tasks
│   │   ├── task-table/        # Data table view for tasks
│   │   └── index.ts           # Barrel export for all sections
│   ├── styles.css             # Tailwind v4 theme and styling
│   └── types/                 # Universal type definitions
│       ├── backend.ts         # Backend entity models (AuthUser, Profile, Project, Task, etc.)
│       ├── frontend.ts        # Frontend enums, badges, and view states (AppRole, Priority, etc.)
│       └── index.ts           # Central types barrel
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
