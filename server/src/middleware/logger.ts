import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export interface LoggedRequest extends Request {
  id?: string;
}

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "secret",
  "cookie",
  "jwt",
  "passwordhash",
  "code",
  "credential",
]);

export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = redactSensitiveData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export function requestLogger(req: LoggedRequest, res: Response, next: NextFunction): void {
  const reqId =
    (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"]) ||
    crypto.randomUUID();

  req.id = reqId;
  res.setHeader("X-Request-Id", reqId);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    // Keep test logs clean during automated runs
    if (process.env.NODE_ENV === "test") return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      reqId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
