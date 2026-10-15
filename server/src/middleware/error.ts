import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  // 1. Mongoose CastError (invalid ObjectId format) -> 400 Bad Request
  if (err.name === "CastError") {
    res.status(400).json({ message: "Invalid resource identifier format" });
    return;
  }

  if (err.name === "ValidationError") {
    const firstMsg = (Object.values(err.errors || {})[0] as any)?.message || "Validation failed";
    res.status(400).json({ message: String(firstMsg) });
    return;
  }

  // 3. MongoDB Duplicate Key (E11000) -> 400 Bad Request
  if (err.code === 11000) {
    res.status(400).json({ message: "Resource already exists with this unique identifier" });
    return;
  }

  // 4. Custom AppError / Operational status codes
  const status =
    typeof err.statusCode === "number"
      ? err.statusCode
      : typeof err.status === "number"
        ? err.status
        : undefined;
  if (status) {
    res.status(status).json({ message: err.message });
    return;
  }

  // 5. Payload too large (from body-parser / express.json limit)
  if (err.type === "entity.too.large" || err.status === 413) {
    res.status(413).json({ message: err.message || "Request payload exceeds size limit" });
    return;
  }

  // 6. Generic unhandled error: log structured JSON in all environments
  const isDev = process.env.NODE_ENV === "development";
  console.error(
    JSON.stringify({
      level: "error",
      reqId: (req as any)?.id || "system",
      message: err?.message || "Internal server error",
      stack: isDev ? err?.stack : undefined,
      timestamp: new Date().toISOString(),
    }),
  );

  res.status(500).json({ message: "Internal server error" });
}
