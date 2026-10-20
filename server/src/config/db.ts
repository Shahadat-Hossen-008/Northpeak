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

  return (
    String(rawMessage)
      // Redact full mongodb / mongodb+srv URIs
      .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[REDACTED_URI]")
      // Redact any remaining scheme://user:pass@host or bare user:pass@host authority segments
      .replace(/([a-z][a-z0-9+.-]*:\/\/)?[^/\s"':@]+:[^@\s"']+@/gi, "$1[REDACTED]@")
  );
}

function summarizeDriverError(error: any): Record<string, unknown> | undefined {
  if (!error) return undefined;

  return {
    name: error.name || "Error",
    code: error.code ?? undefined,
    syscall: error.syscall ?? undefined,
    message: sanitizeDatabaseErrorMessage(error.message),
  };
}

function describeServerSelectionFailure(error: any): Record<string, unknown> {
  const topology = error?.reason;
  const servers = topology?.servers;

  return {
    topologyType: topology?.type,
    setName: topology?.setName,
    servers:
      servers instanceof Map
        ? Array.from(servers.entries(), ([address, server]: [string, any]) => ({
            address: sanitizeDatabaseErrorMessage(address),
            type: server?.type,
            error: summarizeDriverError(server?.error),
          }))
        : undefined,
    cause: summarizeDriverError(error?.cause),
  };
}

export function logSanitizedConnectError(
  error: any,
  context: {
    reqId?: string;
    readyStateBefore: number;
    readyStateAfter: number;
  },
): void {
  console.error(
    JSON.stringify({
      level: "error",
      component: "database",
      message: "MongoDB connection failed",
      reqId: context.reqId,
      connectionAttempted: true,
      readyStateBefore: context.readyStateBefore,
      readyStateAfter: context.readyStateAfter,
      errorName: error?.name || "Error",
      errorCode: error?.code ?? undefined,
      syscall: error?.syscall ?? undefined,
      reason: sanitizeDatabaseErrorMessage(error?.message),
      details: describeServerSelectionFailure(error),
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Lazily ensures an active Mongoose connection for serverless / on-demand runtimes
 * while deduplicating concurrent connection attempts.
 */
export async function ensureDBConnection(overrideUri?: string, reqId?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (connectPromise && !overrideUri) {
    await connectPromise;
    return;
  }

  const uri = resolveMongoUri(overrideUri || config.MONGODB_URI);
  const readyStateBefore = mongoose.connection.readyState;
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
    logSanitizedConnectError(error, {
      reqId,
      readyStateBefore,
      readyStateAfter: mongoose.connection.readyState,
    });
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
