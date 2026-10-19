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
├── server/                    # Express.js + TypeScript + MongoDB backend
│   ├── src/
│   │   ├── config/            # Database connection (Mongoose)
│   │   ├── models/            # Mongoose schemas (User, Project, Task, Subtask, Comment, Notification, Activity)
│   │   ├── middleware/        # JWT auth and role authorization
│   │   ├── routes/            # REST API endpoints
│   │   ├── seed/              # Database demo data seeder
│   │   └── index.ts           # Express server entry point (port 5000)
│   ├── package.json
│   └── README.md              # Backend API documentation
├── src/                       # React 19 frontend application
│   ├── components/            # UI components, dialogs, badges, and layout
│   ├── hooks/                 # TanStack Query hooks, useAuth, and React context
│   ├── lib/                   # API client (fetch wrapper), deadline engine, utilities
│   ├── routes/                # TanStack Router file-based routes
│   │   └── README.md          # Route map & conventions documentation
│   └── styles.css             # Tailwind v4 theme and styling
├── package.json               # Root scripts & Vite proxy configuration
└── vite.config.ts             # Vite configuration (/api proxied to port 5000)
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
- **Production start command**: `npm start` (`node dist/index.js`, or `npm run server:start` from repo root)
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

### 2. Frontend Client Application (Repository Root)

The frontend uses TanStack Start + Vite + Nitro. Public marketing pages are server-rendered with SEO metadata; the authenticated workspace has SSR disabled and loads its private data through the API after authentication. This is an SSR application, not a static SPA: deploy the Node Nitro server and its full build output. The client contains no MongoDB credentials or JWT signing secret.

- **Working directory**: `/` (repository root)
- **Install command**: `npm ci`
- **Build command**: `npm run build:client` (selects Nitro's `node-server` preset)
- **Start command**: `npm run start:client` (`node .output/server/index.mjs`; Nitro reads the host-provided `PORT`)
- **Output directory**: `.output/` — deploy this whole directory; Nitro serves SSR routes and the assets under `.output/public/` (including `northpeak-social.png`, icons, and `robots.txt`). Do not deploy only the static directory.
- **Health check**: `GET /` (public marketing page)

**Required Client Environment Variables (configure on the frontend hosting platform at build time):**

| Variable            | Required              | Description                                                                                           |
| :------------------ | :-------------------- | :---------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Yes (in `production`) | HTTPS origin of the deployed backend API; normalized to `<origin>/api`. May include an API base path. |
| `VITE_SITE_URL`     | Optional (SEO)        | Real public HTTPS frontend origin (no path) for canonical and social metadata                         |

> Never expose `MONGODB_URI`, `JWT_SECRET`, or any server secret in `VITE_*` variables.

### Recommended Deployment Order

1. **Provision MongoDB**: Create a production replica set or Atlas cluster that supports transactions; put its URI only in the backend service environment.
2. **Create the frontend service and reserve its HTTPS origin**: Configure the host's Node service using the repository root, `npm ci`, `npm run build:client`, `npm run start:client`, and `/` as its health check. Set the build-time `VITE_API_BASE_URL` to the planned backend HTTPS origin and `VITE_SITE_URL` to this frontend's real HTTPS origin.
3. **Deploy the backend API (`server/`)**: Configure a separate Node web service with working directory `server`, install command `npm ci`, build command `npm run build`, start command `npm start`, and health check `/api/health/ready`. Set production server variables from `server/.env.example`; set `CORS_ORIGIN` to the exact frontend HTTPS origin. Set `TRUST_PROXY=true` only if required by the host's trusted proxy topology. Confirm readiness returns `200`.
4. **Build and deploy the frontend**: Build the frontend service after the backend is available, and confirm it can reach the API health endpoint from the service environment. Check that the final CORS allowlist contains only the deployed frontend origin or origins.

### Hosting Dashboard Settings

Create two independent Node web services from the same repository. Do not configure the frontend service to run the Express API, or the API service to build or serve the frontend.

| Setting           | Frontend SSR service                              | Backend API service                                                                                                             |
| :---------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| Working directory | Repository root                                   | `server`                                                                                                                        |
| Install command   | `npm ci`                                          | `npm ci`                                                                                                                        |
| Build command     | `npm run build:client`                            | `npm run build`                                                                                                                 |
| Start command     | `npm run start:client`                            | `npm start`                                                                                                                     |
| Health check path | `/`                                               | `/api/health/ready`                                                                                                             |
| Environment       | `VITE_API_BASE_URL`, `VITE_SITE_URL` (build time) | `NODE_ENV`, `PORT` (host provided), `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, optional `TRUST_PROXY`, `RECONCILE_INTERVAL_MS` |

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
| `npm run build:client` | Builds the independent Nitro Node SSR client (`.output/`)  |
| `npm run start:client` | Starts the built Node SSR client using `PORT`              |
| `npm run server`       | Starts the Express backend development server on port 5000 |
| `npm run server:build` | Compiles the backend TypeScript into `server/dist/`        |
| `npm run server:start` | Starts the compiled production backend (`server/dist/`)    |
| `npm run server:seed`  | Populates the MongoDB database with demo data              |
| `npm test`             | Runs frontend, SEO, and client/server boundary tests       |
| `npm run lint`         | Runs ESLint across the codebase                            |
| `npm run format`       | Formats all files using Prettier                           |

For the documented independent Node frontend service, use `npm run build:client`; the existing `npm run build` keeps the Vite/Nitro preset selected by the build environment (Cloudflare by default in this project).
