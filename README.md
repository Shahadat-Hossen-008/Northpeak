# Northpeak — Deadline-Aware Project Management SaaS

Northpeak is a modern, deadline-aware project management platform designed specifically for engineering teams. It keeps managers informed of delivery timelines and enables developers to organize, track, and complete granular tasks on a live Kanban board.

---

## Key Features

- **Role-Based Workspaces**:
  - **Project Manager**: Create and manage projects, assign tasks, prioritize work, set milestone dates, and monitor team workload capacity.
  - **Developer**: Kanban board view (To do, In progress, Completed), interactive subtask checklists, and task discussions.
- **Automated Deadline Health Engine**:
  - Automatically assesses task dates: `on_track`, `due_soon` (&le; 3 days remaining), `overdue`, `completed_on_time`, and `completed_late`.
- **Kanban Board & Tabular Views**:
  - Switch between visual columns and detailed sortable tables.
  - Filter tasks by project, assignee, priority (`low`, `medium`, `high`, `critical`), and status.
- **Granular Subtasks**:
  - Break tasks into actionable steps with inline progress calculation.
- **Team Discussions & Activity**:
  - Comment threads on every task.
  - Activity audit feed tracking project creations, task assignments, and completions.
- **Notification Hub**:
  - Alerts for task assignments, approaching deadlines, and comment replies.

---

## Architecture & Tech Stack

| Layer              | Technologies                                                                                                        |
| :----------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Frontend**       | React 19, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, Radix UI, Lucide icons, Sonner |
| **Backend**        | Express.js, TypeScript, MongoDB with Mongoose ODM                                                                   |
| **Authentication** | JWT (JSON Web Tokens) with bcrypt password hashing                                                                  |
| **Design System**  | `oklch` color tokens, responsive dark-mode surface cards, Plus Jakarta Sans typography                              |

---

## Project Structure

```
├── src/
│   ├── backend/                # Domain API modules and shared HTTP client
│   ├── builder/                # Layouts and assembled page builders
│   ├── components/             # Reusable UI components and primitives
│   ├── hooks/queries/          # Domain React Query hooks
│   ├── lib/                    # Deadline, dashboard, project, task and error utilities
│   ├── routes/                 # TanStack file routes; route guide is in routes/README.md
│   ├── sections/               # Feature UI and typed section registry
│   ├── types/                  # Shared backend contracts and frontend types
│   ├── router.tsx              # Router setup
│   ├── server.ts               # TanStack Start server entry
│   └── start.ts                # Nitro/TanStack Start entry
├── server/
│   ├── src/app.ts              # Express app and middleware pipeline
│   ├── src/routes/             # API route handlers
│   ├── src/services/           # Business logic and authorization
│   ├── src/serializers/        # API response mapping
│   ├── src/models/             # Mongoose models
│   ├── src/middleware/         # Auth, logging, security, errors and rate limits
│   ├── src/config/             # Environment validation and MongoDB connection
│   ├── src/server.ts           # Listener and lifecycle setup
│   ├── src/start.ts            # Executable backend entry point
│   └── test/                   # Backend tests
├── tests/                      # Root regression tests
├── package.json                # Frontend and workspace scripts
├── vite.config.ts              # Vite/TanStack/Nitro configuration and local API proxy
└── vercel.json                 # Vercel build command for the Nitro Vercel preset
```

---

## Getting Started

### Prerequisites

- **Node.js** (v20.19+ or v22.12+ for the Vite/Nitro frontend build)
- **MongoDB** running locally on port `27017` (e.g. `mongodb://localhost:27017/northpeak`)

### 1. Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Seed the Database

Populate MongoDB with demo projects, tasks, team members, subtasks, and comments:

```bash
npm run server:seed
```

### 3. Start the Backend Server

```bash
npm run server
```

The Express API will be running at `http://localhost:5000` with health check at `http://localhost:5000/api/health`.

### 4. Start the Frontend Application

In a separate terminal window:

```bash
npm run dev
```

Open `http://localhost:8080` in your browser.

### Public SEO Metadata

Set `VITE_SITE_URL` to the site's real HTTPS origin in the frontend build environment before deployment, with no path. Vite embeds this value in the built app, so setting it only at runtime is too late. The public marketing routes (`/`, `/features`, `/roles`, and `/get-started`) use it to generate absolute canonical and social URLs. When it is unset or invalid—including local HTTP development—the canonical, `og:url`, `og:image`, and `twitter:image` URL tags are intentionally omitted; page titles, descriptions, Open Graph text, and Twitter card text remain available. No production domain is assumed. Authenticated and account routes remain `noindex, nofollow` and do not receive canonical tags.

---

## Production Deployment (Separated Client & Server)

Northpeak deploys as two independent services:

### 1. Backend API Service (`server/`)

- **Working directory**: `server`
- **Install command**: `npm ci`
- **Build command**: `npm run build` (or `npm run server:build` from repo root)
- **Output directory**: `server/dist/`
- **Production start command**: `npm start` (`node dist/start.js`, or `npm run server:start` from repo root)
- **Health check endpoints**:
  - `GET /api/health` — Base health status
  - `GET /api/health/live` — Liveness probe with process uptime
  - `GET /api/health/ready` — Readiness probe verifying MongoDB connection (`200` when connected, `503` when disconnected)

**Required Server Environment Variables (configure on the backend hosting platform only):**

| Variable                | Required              | Description                                                                                                                |
| :---------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | Yes                   | Set to `production`                                                                                                        |
| `PORT`                  | Host-provided         | HTTP listener port assigned by the backend host (defaults to `5000` locally)                                               |
| `MONGODB_URI`           | Yes (in `production`) | MongoDB connection string. Production requires a replica set or MongoDB Atlas cluster supporting transactions              |
| `JWT_SECRET`            | Yes (in `production`) | Cryptographically random secret of at least 32 characters (`openssl rand -hex 32`)                                         |
| `CORS_ORIGIN`           | Yes (in `production`) | Comma-separated allowlist of exact deployed frontend HTTPS origins. Wildcard `*` and HTTP production origins are forbidden |
| `TRUST_PROXY`           | Optional              | Set to `true` only when the host places the API behind a trusted one-hop reverse proxy/load balancer                       |
| `RECONCILE_INTERVAL_MS` | Optional              | Periodic assignment reconciler interval in ms (defaults to `300000`; `0` disables)                                         |

### 2. Frontend Client Application (Vercel, Repository Root)

The frontend uses TanStack Start + Vite + Nitro. Public marketing pages are server-rendered with SEO metadata; authenticated workspace data loads from the API after authentication. This is an SSR application, not a static SPA. The root `vercel.json` selects Nitro's Vercel preset and emits the Vercel Build Output API. The client contains no MongoDB credentials or JWT signing secret.

- **Vercel Root Directory**: repository root (`.`)
- **Install command**: `npm ci`
- **Build command**: `npm run build:vercel` (set by `vercel.json`)
- **Output**: leave the output directory unset; Nitro writes `.vercel/output` with SSR functions and static assets.
- **Health check**: `GET /` (public marketing page)

For a non-Vercel Node host, use `npm run build:client` and `npm run start:client`; that path emits the `.output/` Node server bundle.

**Required Client Environment Variables (configure on the frontend hosting platform at build time):**

| Variable            | Required              | Description                                                                                           |
| :------------------ | :-------------------- | :---------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Yes (in `production`) | HTTPS origin of the deployed backend API; normalized to `<origin>/api`. May include an API base path. |
| `VITE_SITE_URL`     | Optional (SEO)        | Real public HTTPS frontend origin (no path) for canonical and social metadata                         |

> Never expose `MONGODB_URI`, `JWT_SECRET`, or any server secret in `VITE_*` variables.

### Recommended Deployment Order

1. **Provision MongoDB**: Create a production replica set or Atlas cluster that supports transactions; put its URI only in the backend service environment.
2. **Reserve the frontend HTTPS origin**: Create the Vercel project from the repository root and note its production domain.
3. **Deploy the backend API (`server/`)**: Configure a separate Node web service with working directory `server`, install command `npm ci`, build command `npm run build`, start command `npm start`, and health check `/api/health/ready`. Set production server variables from `server/.env.example`; set `CORS_ORIGIN` to the exact frontend HTTPS origin. Set `TRUST_PROXY=true` only if required by the host's trusted proxy topology. Confirm readiness returns `200`.
4. **Configure and deploy the frontend**: Set Vercel's build-time `VITE_API_BASE_URL` to the backend HTTPS origin and `VITE_SITE_URL` to the frontend HTTPS origin, then deploy. Confirm API calls work from the deployed site. Add any needed preview origin explicitly to the backend CORS allowlist.

### Hosting Dashboard Settings

Deploy the frontend as a Vercel project and the API as a separate Node web service. Do not configure either service to build or serve the other app.

| Setting           | Frontend on Vercel                                               | Backend API service                                                                                                             |
| :---------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| Root directory    | Repository root                                                   | `server`                                                                                                                        |
| Install command   | `npm ci`                                                          | `npm ci`                                                                                                                        |
| Build command     | `npm run build:vercel` (from `vercel.json`)                      | `npm run build`                                                                                                                 |
| Start command     | Managed by Vercel/Nitro                                           | `npm start`                                                                                                                     |
| Health check path | `/`                                                               | `/api/health/ready`                                                                                                             |
| Environment       | `VITE_API_BASE_URL`, `VITE_SITE_URL` (build time)                | `NODE_ENV`, `PORT` (host provided), `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, optional `TRUST_PROXY`, `RECONCILE_INTERVAL_MS` |

Use a Node host that supports long-running Nitro/Express services and supplies `PORT`. On hosts that require a single `Root Directory`, configure one service for the repository root and a second for `server`. Keep the two environment groups separate. Configure MongoDB network access to allow the backend host, never the frontend build or browser.

---

## Seed Accounts

All demo accounts use the password: `password123`

| Name                | Role            | Email                  | Best For                                              |
| :------------------ | :-------------- | :--------------------- | :---------------------------------------------------- |
| **Nadia Chowdhury** | Project Manager | `nadia@northpeak.dev`  | Planning projects, assigning tasks, capacity tracking |
| **Sarah Khan**      | Developer       | `sarah@northpeak.dev`  | Kanban board, checking off subtasks, posting comments |
| **Rahim Ahmed**     | Developer       | `rahim@northpeak.dev`  | Developer workflow                                    |
| **John Doe**        | Developer       | `john@northpeak.dev`   | Developer workflow                                    |
| **Ayesha Siddiqua** | Developer       | `ayesha@northpeak.dev` | Developer workflow                                    |

---

## Available Scripts

| Command                | Description                                                |
| :--------------------- | :--------------------------------------------------------- |
| `npm run dev`          | Starts the Vite development server on port 8080            |
| `npm run build`        | Builds the frontend application for production (`.output`) |
| `npm run build:vercel` | Builds the SSR application using Nitro's Vercel preset      |
| `npm run build:client` | Builds the independent Nitro Node SSR client (`.output/`)  |
| `npm run start:client` | Starts the built Node SSR client using `PORT`              |
| `npm run server`       | Starts the Express backend development server on port 5000 |
| `npm run server:build` | Compiles the backend TypeScript into `server/dist/`        |
| `npm run server:start` | Starts the compiled production backend (`server/dist/`)    |
| `npm run server:seed`  | Populates the MongoDB database with demo data              |
| `npm test`             | Runs frontend, SEO, and client/server boundary tests       |
| `npm run lint`         | Runs ESLint across the codebase                            |
| `npm run format`       | Formats all files using Prettier                           |

For Vercel, use the repository's `vercel.json`, which runs `npm run build:vercel` and selects Nitro's `vercel` preset. Do not set an output directory or deploy only `.output/public`: Nitro emits the Vercel Build Output API under `.vercel/output`, including the SSR server function and static assets. The generic Node.js service uses `npm run build:client` and `npm run start:client` instead; it intentionally emits `.output/` with Nitro's `node-server` preset.
