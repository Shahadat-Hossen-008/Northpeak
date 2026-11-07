// MongoDB connection for the server: builds the connection string and connects on demand.
// Failure logging lives in db.errors.ts (re-exported below so importers keep using "./db.js").

import mongoose from "mongoose";
import { config } from "./env.js";
import { logSanitizedConnectError } from "./db.errors.js";

export { sanitizeDatabaseErrorMessage, logSanitizedConnectError } from "./db.errors.js";

const DEFAULT_DATABASE_NAME = "northpeak";
const SERVER_SELECTION_TIMEOUT_MS = 5000;

/** The connection attempt in progress, so parallel requests wait for one attempt instead of starting many. */
let connectPromise: Promise<typeof mongoose> | null = null;

// ---------- Connection string ----------

/** Splits "mongodb://host/db?a=1" into base "mongodb://host/db" and query "?a=1". */
function splitUriQuery(uri: string): { base: string; query: string } {
  const queryIndex = uri.indexOf("?");
  if (queryIndex === -1) return { base: uri, query: "" };

  return {
    base: uri.slice(0, queryIndex),
    query: uri.slice(queryIndex),
  };
}

/** Puts the database name at the end of the base, without doubling the slash. */
function appendDefaultDatabase(base: string, query: string, databaseName: string): string {
  return `${base.replace(/\/+$/, "")}/${databaseName}${query}`;
}

/**
 * Makes sure the connection string names a database ("northpeak" if none is given).
 * The query string (?retryWrites=true ...) is kept as it is.
 *
 *   mongodb://localhost:27017                    -> mongodb://localhost:27017/northpeak
 *   mongodb://localhost:27017/?retryWrites=true  -> mongodb://localhost:27017/northpeak?retryWrites=true
 *   mongodb+srv://user:pass@host/app/            -> mongodb+srv://user:pass@host/app
 *   mongodb://localhost:27017/mydb               -> unchanged
 */
export function resolveMongoUri(rawUri: string, defaultDbName = DEFAULT_DATABASE_NAME): string {
  const { base, query } = splitUriQuery(rawUri.trim());

  // 1. No "scheme://" at all: just add the database name
  const schemeEndIndex = base.indexOf("://");
  if (schemeEndIndex === -1) {
    return appendDefaultDatabase(base, query, defaultDbName);
  }

  // 2. Nothing after the host: add "/<database>"
  const afterScheme = base.slice(schemeEndIndex + 3);
  const slashIndex = afterScheme.indexOf("/");
  if (slashIndex === -1) {
    return `${base}/${defaultDbName}${query}`;
  }

  // 3. A slash but no database name after it: add the name
  const databasePath = afterScheme.slice(slashIndex + 1).replace(/\/+$/, "");
  if (!databasePath) {
    return appendDefaultDatabase(base, query, defaultDbName);
  }

  // 4. A database name is already there: keep it, only drop trailing slashes
  const hostPart = base.slice(0, schemeEndIndex + 3 + slashIndex);
  return `${hostPart}/${databasePath}${query}`;
}

// ---------- Connecting ----------

/**
 * Connects to MongoDB if there is no open connection (for serverless runtimes that start on demand).
 * Parallel calls share one attempt. A call with overrideUri always makes its own attempt and
 * does not store it. Logs a sanitized line and rethrows if the attempt fails.
 */
export async function ensureDBConnection(overrideUri?: string, reqId?: string): Promise<void> {
  // 1. Already connected
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // 2. Another call is already connecting: wait for it
  if (connectPromise && !overrideUri) {
    await connectPromise;
    return;
  }

  // 3. Start a new attempt
  const uri = resolveMongoUri(overrideUri || config.MONGODB_URI);
  const readyStateBefore = mongoose.connection.readyState;
  const attempt = mongoose.connect(uri, {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  });

  if (!overrideUri) {
    connectPromise = attempt;
  }

  // 4. Log the result. The finally block clears the stored attempt so a later call can try again.
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

/** Connects at server start. If it fails the process exits (the error was already logged above). */
export async function connectDB(overrideUri?: string): Promise<void> {
  try {
    await ensureDBConnection(overrideUri);
  } catch {
    process.exit(1);
  }
}
