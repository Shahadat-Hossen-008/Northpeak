# Northpeak Frontend Routes Architecture

Northpeak utilizes **TanStack Router** file-based routing. Every route is statically typed and declared under `src/routes/`.

---

## Route Map & Access Levels

### 1. Root & Public Routes

| Route File                                                                                                               | URL Path          | Access | Description                                                                             |
| :----------------------------------------------------------------------------------------------------------------------- | :---------------- | :----- | :-------------------------------------------------------------------------------------- |
| [`__root.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/__root.tsx)                 | App Shell         | Public | Injects `QueryClientProvider`, `AuthProvider`, `Toaster`, 404 and Error components      |
| [`index.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/index.tsx)                   | `/`               | Public | Landing page. Authenticated users are automatically redirected to their role workspace. |
| [`login.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/login.tsx)                   | `/login`          | Public | Sign in form. On success, stores JWT and redirects to role dashboard.                   |
| [`register.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/register.tsx)             | `/register`       | Public | Account creation with role selection (`manager` or `developer`).                        |
| [`reset-password.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/reset-password.tsx) | `/reset-password` | Public | Password update form.                                                                   |
| [`welcome.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/welcome.tsx)               | `/welcome`        | Public | Post-auth onboarding / redirect gateway.                                                |

---

### 2. Protected Layout Guard

- **File**: [`_authenticated/route.tsx`](file:///media/shahadat/New%20Volume/Project/screenshot-showcase-37/src/routes/_authenticated/route.tsx)
- **Behavior**: Uses TanStack Router's `beforeLoad` hook to check `getAuthToken()` and validate user via `api.getMe()`. If no valid session exists, it throws a redirect to `/login`.

---

### 3. Project Manager Workspace (`/manager/*`)

Routes specifically tailored for project management and capacity tracking:

| Route File                                       | URL Path                       | Description                                                                                                       |
| :----------------------------------------------- | :----------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `_authenticated/manager/dashboard.tsx`           | `/manager/dashboard`           | Executive dashboard with project counts, overdue alerts, and quick actions                                        |
| `_authenticated/manager/projects.index.tsx`      | `/manager/projects`            | All projects grid with Create Project dialog and progress bars                                                    |
| `_authenticated/manager/projects.$projectId.tsx` | `/manager/projects/:projectId` | Detailed project view with 5 tabs (Overview, Progress, Tasks, Team, Activity), plus Edit & Delete project dialogs |
| `_authenticated/manager/tasks.index.tsx`         | `/manager/tasks`               | Global task table across all projects with filters, sorting, and deletion                                         |
| `_authenticated/manager/tasks.$taskId.tsx`       | `/manager/tasks/:taskId`       | Detailed task view with subtask management, discussions, status badge, and edit dialog                            |
| `_authenticated/manager/team.tsx`                | `/manager/team`                | Team capacity overview, workload distribution, and active assignments                                             |
| `_authenticated/manager/notifications.tsx`       | `/manager/notifications`       | Notifications center with mark-all-as-read                                                                        |
| `_authenticated/manager/settings.tsx`            | `/manager/settings`            | Account profile (name) and password update                                                                        |

---

### 4. Developer Workspace (`/developer/*`)

Routes optimized for developer execution, task completion, and deadlines:

| Route File                                   | URL Path                   | Description                                                                            |
| :------------------------------------------- | :------------------------- | :------------------------------------------------------------------------------------- |
| `_authenticated/developer/dashboard.tsx`     | `/developer/dashboard`     | Interactive Kanban board (To do, In progress, Completed) with quick completion toggles |
| `_authenticated/developer/projects.tsx`      | `/developer/projects`      | Projects containing assigned developer work                                            |
| `_authenticated/developer/tasks.index.tsx`   | `/developer/tasks`         | Assigned tasks table with deadline warnings and filter tools                           |
| `_authenticated/developer/tasks.$taskId.tsx` | `/developer/tasks/:taskId` | Task execution page with granular subtask checklists and discussion comments           |
| `_authenticated/developer/notifications.tsx` | `/developer/notifications` | Personal notifications center                                                          |
| `_authenticated/developer/settings.tsx`      | `/developer/settings`      | Account profile (name) and password update                                             |

---

## Route File Conventions

1. **Route Declaration**:
   Always export the route definition using `createFileRoute`:

   ```tsx
   export const Route = createFileRoute("/_authenticated/manager/tasks/")({
     head: () => meta("All tasks", "Search and filter tasks."),
     component: ManagerTasks,
   });
   ```

2. **Dynamic Segments**:
   Use dollar signs for dynamic URL params (e.g. `$taskId.tsx` &rarr; `/tasks/:taskId`). Retrieve params via `Route.useParams()`:

   ```tsx
   const { taskId } = Route.useParams();
   ```

3. **Auto-Generated Route Tree**:
   TanStack Router generates `src/routeTree.gen.ts` automatically when files under `src/routes/` are added or changed. Do not edit `routeTree.gen.ts` manually.
