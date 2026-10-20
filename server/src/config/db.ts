import mongoose from "mongoose";
import { config } from "./env.js";

let connectPromise: Promise<typeof mongoose> | null = null;

/**
 * Normalizes a MongoDB connection URI by ensuring a database name is present
 * (defaulting to "northpeak") without corrupting query strings or trailing slashes.
 */
export function resolveMongoUri(rawUri: string, defaultDbName = "northpeak"): string {
  const trimmed = rawUri.trim();
  const qIndex = trimmed.indexOf("?");
  const base = qIndex === -1 ? trimmed : trimmed.slice(0, qIndex);
  const query = qIndex === -1 ? "" : trimmed.slice(qIndex);

  const schemeEnd = base.indexOf("://");
  if (schemeEnd === -1) {
    return `${base.replace(/\/+$/, "")}/${defaultDbName}${query}`;
  }

  const afterScheme = base.slice(schemeEnd + 3);
  const slashIndex = afterScheme.indexOf("/");

  if (slashIndex === -1) {
    return `${base}/${defaultDbName}${query}`;
  }

  const dbPath = afterScheme.slice(slashIndex + 1).replace(/\/+$/, "");
  if (!dbPath) {
    return `${base.replace(/\/+$/, "")}/${defaultDbName}${query}`;
  }

  return `${base.slice(0, schemeEnd + 3 + slashIndex)}/${dbPath}${query}`;
}

export function sanitizeDatabaseErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) {
    return "Unknown connection error";
  }

  return String(rawMessage)
    // Redact full mongodb / mongodb+srv URIs
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[REDACTED_URI]")
    // Redact any remaining scheme://user:pass@host or bare user:pass@host authority segments
    .replace(/([a-z][a-z0-9+.-]*:\/\/)?[^/\s"':@]+:[^@\s"']+@/gi, "$1[REDACTED]@");
}

export function logSanitizedConnectError(error: any): void {
  console.error(
    JSON.stringify({
      level: "error",
      component: "database",
      message: "MongoDB connection failed",
      errorName: error?.name || "Error",
      errorCode: error?.code ?? error?.syscall ?? undefined,
      reason: sanitizeDatabaseErrorMessage(error?.message),
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Lazily ensures an active Mongoose connection for serverless / on-demand runtimes
 * while deduplicating concurrent connection attempts.
 */
export async function ensureDBConnection(overrideUri?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (connectPromise && !overrideUri) {
    await connectPromise;
    return;
  }

  const uri = resolveMongoUri(overrideUri || config.MONGODB_URI);

  const attempt = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  if (!overrideUri) {
    connectPromise = attempt;
  }

  try {
    const conn = await attempt;
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    logSanitizedConnectError(error);
    throw error;
  } finally {
    if (connectPromise === attempt) {
      connectPromise = null;
    }
  }
}

export async function connectDB(overrideUri?: string): Promise<void> {
  try {
    await ensureDBConnection(overrideUri);
  } catch {
    process.exit(1);
  }
}

