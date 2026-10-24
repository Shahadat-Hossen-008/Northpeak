// See docs/frontend-data-caching.md
export const STALE = {
  // Member and session identity data rarely changes during a session.
  static: 10 * 60_000,
  // Projects, tasks, subtasks, and workloads change through edits, so one minute limits repeat reads.
  normal: 60_000,
  // Collaboration feeds can change between visits, so keep their cached window shorter.
  live: 30_000,
} as const;
