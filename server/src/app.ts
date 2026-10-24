import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { config } from "./config/env.js";
import { ensureDBConnection } from "./config/db.js";
import { securityHeaders } from "./middleware/security.js";
import { requestLogger } from "./middleware/logger.js";
import type { LoggedRequest } from "./middleware/logger.js";
import { createAuthRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, AppError } from "./middleware/error.js";

import { authRouter } from "./routes/auth.js";
import { membersRouter } from "./routes/members.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { subtasksRouter } from "./routes/subtasks.js";
import { commentsRouter } from "./routes/comments.js";
import { notificationsRouter } from "./routes/notifications.js";
import { activityRouter } from "./routes/activity.js";
import { testBarriersRouter } from "./routes/testBarriers.js";

// Stricter per-IP limits for the unauthenticated auth endpoints that send email or write data.
export const REGISTER_RATE_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 5 };
export const RESEND_RATE_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 5 };
export const VERIFY_RATE_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 20 };

export function createCorsOptions(
  allowedOrigins: string[] = config.CORS_ORIGINS,
): cors.CorsOptions {
  const normalizedAllowed = new Set(
    allowedOrigins.map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean),
  );

  return {
    origin(requestOrigin, callback) {
      if (!requestOrigin) {
        callback(null, false);
        return;
      }

      const normalizedOrigin = requestOrigin.trim().replace(/\/+$/, "");
      if (normalizedAllowed.has(normalizedOrigin)) {
        callback(null, requestOrigin);
        return;
      }

      callback(new AppError("Origin not allowed by CORS", 403));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
  };
}

export const app = express();

if (config.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// 1. Security headers & CORS
app.use(securityHeaders);
app.use(cors(createCorsOptions()));

// 2. Body parser with 100kb payload limit
app.use(express.json({ limit: "100kb" }));

// 3. Structured request logging with request IDs and redaction
app.use(requestLogger);

// 4. Rate limiting on auth endpoints
const authLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});
app.use(
  "/api/auth/register",
  createAuthRateLimiter({
    ...REGISTER_RATE_LIMIT,
    message: "Too many registration attempts, please try again later",
  }),
);
app.use(
  "/api/auth/resend-verification",
  createAuthRateLimiter({
    ...RESEND_RATE_LIMIT,
    message: "Too many verification email requests, please try again later",
  }),
);
app.use(
  "/api/auth/verify-email",
  createAuthRateLimiter({
    ...VERIFY_RATE_LIMIT,
    message: "Too many verification attempts, please try again later",
  }),
);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
const authVerificationLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
});
app.use("/api/auth/verify-email", authVerificationLimiter);
app.use("/api/auth/resend-verification", authVerificationLimiter);
app.use("/api/auth/google", authVerificationLimiter);

// 5. Ensure database connection for API routes (supports serverless entrypoints like Vercel)
const requireDatabase: express.RequestHandler = async (req, _res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
    return;
  }
  try {
    await ensureDBConnection(undefined, (req as LoggedRequest).id);
    next();
  } catch {
    next(new AppError("Database unavailable", 503));
  }
};

// 6. REST API routes
app.use("/api/auth", requireDatabase, authRouter);
app.use("/api/members", requireDatabase, membersRouter);
app.use("/api/projects", requireDatabase, projectsRouter);
app.use("/api/tasks", requireDatabase, tasksRouter);
app.use("/api/subtasks", requireDatabase, subtasksRouter);
app.use("/api/comments", requireDatabase, commentsRouter);
app.use("/api/notifications", requireDatabase, notificationsRouter);
app.use("/api/activity", requireDatabase, activityRouter);

// 7. Test-only barrier routes (strictly mounted in test environment)
if (process.env.NODE_ENV === "test") {
  app.use("/api/test/barriers", testBarriersRouter);
}

// 8. Health check endpoints
// Base health check (preserves existing contract)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Northpeak API",
    timestamp: new Date().toISOString(),
  });
});

// Liveness probe (additive)
app.get("/api/health/live", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (additive)
app.get("/api/health/ready", async (req, res) => {
  if (mongoose.connection.readyState !== 1 && process.env.NODE_ENV !== "test") {
    try {
      await ensureDBConnection(undefined, (req as LoggedRequest).id);
    } catch {
      // Fall through to 503 response below; sanitized reason is logged by ensureDBConnection
    }
  }

  const isDbReady = mongoose.connection.readyState === 1;
  if (!isDbReady) {
    res.status(503).json({
      status: "not_ready",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    status: "ready",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
});

// 9. Centralized 4-argument error handler (must be mounted last)
app.use(errorHandler);

export default app;
