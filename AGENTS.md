# Northpeak Project Guide

Northpeak is a deadline-aware project management app for software engineering teams. Keep this guide aligned with the code; verify paths and scripts before documenting them.

## Stack and runtime

- Frontend: React 19, TypeScript, TanStack Start/Router, TanStack Query, Vite, Nitro, Tailwind CSS v4, and Radix UI.
- Backend: Express 4, TypeScript, MongoDB, and Mongoose in `server/`.
- Frontend API calls use `src/backend/client.ts`; the browser stores the JWT as `northpeak_token` in local storage and sends it as a bearer token.
- The frontend and API are independently deployable. Do not put backend secrets in client `VITE_*` variables.
- Local frontend runs with `npm run dev` (Vite serves port 8080 and proxies `/api` to port 5000). Backend runs with `npm run server`.

## Code organization

- `src/routes/`: file-based TanStack routes. Keep route modules focused on route configuration and page composition; route conventions are documented in `src/routes/README.md`.
- `src/builder/layout/` and `src/builder/pages/`: shared layouts and assembled pages.
- `src/components/`: reusable UI components and Radix-based primitives. Many feature components have a sibling `interface.ts`; this is a convention, not a requirement for every file.
- `src/sections/`: feature-level UI such as task boards, task details, comments, notifications, and charts. The typed section registry is in `src/sections/registry/`.
- `src/backend/`: domain API modules and shared HTTP client.
- `src/hooks/queries/`: domain React Query hooks and invalidation helpers.
- `src/lib/`: pure utilities, deadline and project calculations, dashboard selectors, and error helpers.
- `src/types/`: shared backend data contracts and frontend UI types.
- `server/src/routes/`: HTTP routing and request handling; `services/` owns business logic; `serializers/` maps database records to API responses.
- `server/src/models/`, `middleware/`, `config/`, and `seed/`: Mongoose models, Express middleware, runtime configuration/database connection, and demo data.
- `server/src/app.ts` builds the Express app; `server/src/server.ts` starts the listener and lifecycle handlers; `server/src/start.ts` is the executable entry point.

## Frontend conventions

- Prefer the domain API modules and query hooks over direct `fetch` calls in page components.
- Keep shared calculations pure and outside React components where practical. Dashboard selectors live in `src/lib/dashboard-selectors.ts`.
- Use the shared contracts in `src/types/`; avoid duplicating backend entity or UI enum definitions.
- Preserve loading, empty, error, and nullable-data states in UI components.
- Use direct module imports when practical. Do not add compatibility barrels unless a feature needs them.
- Keep route metadata and public SEO behavior consistent with `src/builder/layout/meta.ts` and the existing route modules.

## Backend and security conventions

- Keep the backend layered: routes parse/validate HTTP input, services implement domain behavior and authorization, serializers whitelist output fields.
- Enforce authorization in services for every mutation; do not rely on the frontend to enforce access.
- Production configuration is validated in `server/src/config/env.ts`. Production requires `NODE_ENV`, `MONGODB_URI`, a 32-character `JWT_SECRET`, and an HTTPS `CORS_ORIGIN` allowlist.
- `CORS_ORIGIN` accepts comma-separated exact origins (scheme and host, optional port; no path). Wildcard origins are rejected because credential support is enabled. Development has localhost defaults.
- Keep secrets in backend environment configuration. Never commit real credentials or move them to frontend environment variables.
- Preserve request ID correlation, redacted structured logging, security headers, payload limits, rate limits, and sanitized production errors.
- Test-only barrier routes must remain mounted only when `NODE_ENV === "test"`.
- MongoDB transaction behavior requires a replica set, including Atlas or a local replica-set test configuration.

## Deployment

- Root `vercel.json` runs `npm run build:vercel`; this selects Nitro's Vercel preset. Do not set a static output directory for this SSR deployment.
- For a standalone Node frontend host, use `npm run build:client` and `npm run start:client`.
- Backend deployment uses `server/`: `npm ci`, `npm run build`, and `npm start` (compiled entry is `dist/start.js`).
- Set `VITE_API_BASE_URL` to the backend HTTPS origin at frontend build time; the client appends `/api`.
- Set backend `CORS_ORIGIN` to the exact frontend HTTPS origin(s). Add localhost origins only when a local browser needs to call that deployed API.
- See `README.md`, `server/README.md`, and environment examples for deployment variables and commands.

## Verification commands

- `npm test`: root regression tests.
- `npm --prefix server test`: backend tests.
- `npm --prefix server run build`: backend TypeScript build.
- `npm run lint`: ESLint.
- `npm run build:vercel`: frontend Vercel/Nitro build.

Do not claim a command passed unless it was run in the current change review. Do not add or run tests unless the user asks for tests or verification.
