// Safe logging for database connection failures.
// Driver error messages can contain the connection string (with the password), so every
// message goes through sanitizeDatabaseErrorMessage before it is logged.

/** Matches a whole connection string, e.g. mongodb+srv://user:pass@cluster.example.net/app */
const MONGODB_URI_PATTERN = /mongodb(\+srv)?:\/\/[^\s"']+/gi;

/** Matches credentials left in any text, e.g. "user:pass@" or "https://user:pass@". */
const AUTHORITY_CREDENTIALS_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)?[^/\s"':@]+:[^@\s"']+@/gi;

/** What we know about the failed attempt; it is added to the log line. */
export interface ConnectionErrorContext {
  reqId?: string;
  readyStateBefore: number;
  readyStateAfter: number;
}

// Anything can be thrown, so these list only the optional fields we read.
interface ErrorFields {
  name?: string;
  code?: unknown;
  syscall?: unknown;
  message?: unknown;
}
interface ServerFields {
  type?: unknown;
  error?: unknown;
}
interface TopologyFields {
  type?: unknown;
  setName?: unknown;
  servers?: unknown;
}
/** The extra fields MongoDB adds when it cannot reach any server. */
interface ServerSelectionFields extends ErrorFields {
  reason?: TopologyFields;
  cause?: unknown;
}

/** Treats a thrown value as an object with optional fields. Returns undefined for empty values. */
function readFields<T>(value: unknown): T | undefined {
  return value ? (value as T) : undefined;
}

/** Removes connection strings and "user:password@" parts so a message is safe to log. */
export function sanitizeDatabaseErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) {
    return "Unknown connection error";
  }

  return String(rawMessage)
    .replace(MONGODB_URI_PATTERN, "[REDACTED_URI]")
    .replace(AUTHORITY_CREDENTIALS_PATTERN, "$1[REDACTED]@");
}

/** Keeps only the safe, useful fields of one driver error. */
function summarizeDriverError(error: unknown): Record<string, unknown> | undefined {
  const fields = readFields<ErrorFields>(error);
  if (!fields) return undefined;

  return {
    name: fields.name || "Error",
    code: fields.code ?? undefined,
    syscall: fields.syscall ?? undefined,
    message: sanitizeDatabaseErrorMessage(fields.message),
  };
}

/** One entry per server the driver tried, with the error each one gave. */
function listServers(servers: Map<string, ServerFields | undefined>): Record<string, unknown>[] {
  return Array.from(servers.entries(), ([address, server]) => ({
    address: sanitizeDatabaseErrorMessage(address),
    type: server?.type,
    error: summarizeDriverError(server?.error),
  }));
}

/** Explains why no server could be reached (cluster type, each server's error, the cause). */
function describeServerSelectionFailure(error: unknown): Record<string, unknown> {
  const fields = readFields<ServerSelectionFields>(error);
  const topology = fields?.reason;
  const servers = topology?.servers;

  return {
    topologyType: topology?.type,
    setName: topology?.setName,
    servers: servers instanceof Map ? listServers(servers as Map<string, ServerFields | undefined>) : undefined,
    cause: summarizeDriverError(fields?.cause),
  };
}

/** Writes one JSON log line for a failed connection. Never logs a password or a full URI. */
export function logSanitizedConnectError(error: unknown, context: ConnectionErrorContext): void {
  const fields = readFields<ErrorFields>(error);

  console.error(
    JSON.stringify({
      level: "error",
      component: "database",
      message: "MongoDB connection failed",
      reqId: context.reqId,
      connectionAttempted: true,
      readyStateBefore: context.readyStateBefore,
      readyStateAfter: context.readyStateAfter,
      errorName: fields?.name || "Error",
      errorCode: fields?.code ?? undefined,
      syscall: fields?.syscall ?? undefined,
      reason: sanitizeDatabaseErrorMessage(fields?.message),
      details: describeServerSelectionFailure(error),
      timestamp: new Date().toISOString(),
    }),
  );
}
