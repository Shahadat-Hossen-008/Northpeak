import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { resolveMongoUri, sanitizeDatabaseErrorMessage } from "../src/config/db.js";

export interface RedundantIndexRule {
  collection: string;
  indexName: string;
  replacementNames: string[];
}

/**
 * Explicit allowlist of redundant and legacy indexes eligible for removal.
 * Every rule specifies the required replacement index(es) that must exist
 * on the collection before the redundant/legacy index is allowed to be dropped.
 */
export const REDUNDANT_INDEX_ALLOWLIST: readonly RedundantIndexRule[] = [
  // Task redundant & legacy indexes
  {
    collection: "tasks",
    indexName: "project_1_status_1_deadline_1",
    replacementNames: ["project_1_deadline_1"],
  },
  {
    collection: "tasks",
    indexName: "assignedDeveloper_1_status_1_deadline_1",
    replacementNames: ["assignedDeveloper_1_deadline_1_createdAt_-1"],
  },
  {
    collection: "tasks",
    indexName: "deadline_1",
    replacementNames: ["project_1_deadline_1", "assignedDeveloper_1_deadline_1_createdAt_-1"],
  },
  {
    collection: "tasks",
    indexName: "project_1_status_1",
    replacementNames: ["project_1_deadline_1"],
  },
  {
    collection: "tasks",
    indexName: "assignedDeveloper_1_status_1",
    replacementNames: ["assignedDeveloper_1_deadline_1_createdAt_-1"],
  },

  // Notification redundant indexes
  {
    collection: "notifications",
    indexName: "recipient_1_isRead_1_createdAt_-1",
    replacementNames: ["recipient_1_audience_1_createdAt_-1"],
  },
  {
    collection: "notifications",
    indexName: "audience_1_isRead_1_createdAt_-1",
    replacementNames: ["recipient_1_audience_1_createdAt_-1"],
  },

  // Activity redundant index (ActivityService always scopes by project or task)
  {
    collection: "activities",
    indexName: "createdAt_-1",
    replacementNames: ["project_1_createdAt_-1", "task_1_createdAt_-1"],
  },

  // Project legacy single-field indexes
  {
    collection: "projects",
    indexName: "manager_1",
    replacementNames: ["manager_1_createdAt_-1"],
  },
  {
    collection: "projects",
    indexName: "team_1",
    replacementNames: ["team_1_createdAt_-1"],
  },

  // Subtask & Comment legacy single-field indexes
  {
    collection: "subtasks",
    indexName: "task_1",
    replacementNames: ["task_1_createdAt_1"],
  },
  {
    collection: "comments",
    indexName: "task_1",
    replacementNames: ["task_1_createdAt_1"],
  },
];

export interface IndexActionRecord {
  collection: string;
  indexName: string;
  existsOnDisk: boolean;
  action: string;
  replacementPresent: boolean;
}

export async function runDropRedundantIndexes(options: {
  uri?: string;
  apply: boolean;
  allowProduction: boolean;
  nodeEnv?: string;
  allowlist?: readonly RedundantIndexRule[];
}): Promise<IndexActionRecord[]> {
  const env = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (env === "production" && !options.allowProduction) {
    throw new Error(
      "Refusing to run in NODE_ENV=production without --allow-production flag.",
    );
  }

  const rawUri =
    options.uri ||
    process.env.MONGODB_URI ||
    (env === "test"
      ? "mongodb://localhost:27017/northpeak_test"
      : "mongodb://localhost:27017/northpeak");
  const resolvedUri = resolveMongoUri(rawUri);

  const conn = await mongoose
    .createConnection(resolvedUri, { serverSelectionTimeoutMS: 5000 })
    .asPromise();

  const results: IndexActionRecord[] = [];
  const rules = options.allowlist ?? REDUNDANT_INDEX_ALLOWLIST;

  try {
    const db = conn.db!;
    const existingCollections = new Set(
      (await db.listCollections().toArray()).map((c) => c.name),
    );

    for (const rule of rules) {
      if (!existingCollections.has(rule.collection)) {
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: false,
          action: "not present",
          replacementPresent: false,
        });
        continue;
      }

      const coll = db.collection(rule.collection);
      const indexes = await coll.indexes();
      const byName = new Map(indexes.map((idx) => [idx.name, idx]));

      const target = byName.get(rule.indexName);
      const replacementPresent = rule.replacementNames.every((repName) =>
        byName.has(repName),
      );

      if (!target) {
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: false,
          action: "not present",
          replacementPresent,
        });
        continue;
      }

      // Safety guard: never touch _id_, unique, or TTL indexes
      if (
        target.name === "_id_" ||
        target.unique === true ||
        typeof target.expireAfterSeconds === "number"
      ) {
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: true,
          action: "skip (protected _id/unique/TTL index)",
          replacementPresent,
        });
        continue;
      }

      if (!replacementPresent) {
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: true,
          action: `skip (missing replacement: ${rule.replacementNames.join(", ")})`,
          replacementPresent: false,
        });
        continue;
      }

      if (!options.apply) {
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: true,
          action: "would drop (dry-run)",
          replacementPresent: true,
        });
      } else {
        await coll.dropIndex(rule.indexName);
        results.push({
          collection: rule.collection,
          indexName: rule.indexName,
          existsOnDisk: true,
          action: "dropped",
          replacementPresent: true,
        });
      }
    }
  } finally {
    await conn.close();
  }

  return results;
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!);

if (isMain) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const allowProduction = args.includes("--allow-production");
  const uriArg = args.find((a) => a.startsWith("--uri="))?.slice("--uri=".length);

  runDropRedundantIndexes({
    uri: uriArg,
    apply,
    allowProduction,
  })
    .then((records) => {
      console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
      for (const r of records) {
        console.log(
          `${r.collection} | ${r.indexName} | existsOnDisk=${r.existsOnDisk} | replacementPresent=${r.replacementPresent} | ${r.action}`,
        );
      }
    })
    .catch((err) => {
      console.error(sanitizeDatabaseErrorMessage(err?.message || err));
      process.exit(1);
    });
}
