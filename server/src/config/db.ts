import mongoose from "mongoose";
import { config } from "./env.js";

let connectPromise: Promise<typeof mongoose> | null = null;

const DEFAULT_DATABASE_NAME = "northpeak";
const SERVER_SELECTION_TIMEOUT_MS = 5000;
const MONGODB_URI_PATTERN = /mongodb(\+srv)?:\/\/[^\s"']+/gi;
const AUTHORITY_CREDENTIALS_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)?[^/\s"':@]+:[^@\s"']+@/gi;

interface ConnectionErrorContext {
  reqId?: string;
  readyStateBefore: number;
  readyStateAfter: number;
}

function splitUriQuery(uri: string): { base: string; query: string } {
  const queryIndex = uri.indexOf("?");
  if (queryIndex === -1) return { base: uri, query: "" };

  return {
    base: uri.slice(0, queryIndex),
    query: uri.slice(queryIndex),
  };
}

function appendDefaultDatabase(base: string, query: string, databaseName: string): string {
  return `${base.replace(/\/+$/, "")}/${databaseName}${query}`;
}

/**
 * Normalizes a MongoDB connection URI by ensuring a database name is present
 * (defaulting to "northpeak") without corrupting query strings or trailing slashes.
 */
export function resolveMongoUri(rawUri: string, defaultDbName = DEFAULT_DATABASE_NAME): string {
  const trimmed = rawUri.trim();
  const { base, query } = splitUriQuery(trimmed);

  const schemeEndIndex = base.indexOf("://");
  if (schemeEndIndex === -1) {
    return appendDefaultDatabase(base, query, defaultDbName);
  }

  const authorityAndPath = base.slice(schemeEndIndex + 3);
  const pathStartIndex = authorityAndPath.indexOf("/");

  if (pathStartIndex === -1) {
    return `${base}/${defaultDbName}${query}`;
  }

  const databasePath = authorityAndPath.slice(pathStartIndex + 1).replace(/\/+$/, "");
  if (!databasePath) {
    return appendDefaultDatabase(base, query, defaultDbName);
  }

  const authority = base.slice(0, schemeEndIndex + 3 + pathStartIndex);
  return `${authority}/${databasePath}${query}`;
}

export function sanitizeDatabaseErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) {
    return "Unknown connection error";
  }

  return (
    String(rawMessage)
      // Redact full mongodb / mongodb+srv URIs.
      .replace(MONGODB_URI_PATTERN, "[REDACTED_URI]")
      // Redact any remaining scheme://user:pass@host or bare user:pass@host authority segments.
      .replace(AUTHORITY_CREDENTIALS_PATTERN, "$1[REDACTED]@")
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

export function logSanitizedConnectError(error: any, context: ConnectionErrorContext): void {
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
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
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
