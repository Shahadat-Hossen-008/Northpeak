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

- **Node.js** (v18 or later)
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
| `npm run build`        | Builds the frontend application for production             |
| `npm run server`       | Starts the Express backend development server on port 5000 |
| `npm run server:build` | Compiles the backend TypeScript into `server/dist/`        |
| `npm run server:seed`  | Populates the MongoDB database with demo data              |
| `npm run lint`         | Runs ESLint across the codebase                            |
| `npm run format`       | Formats all files using Prettier                           |
