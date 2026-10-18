import type { DeadlineStateInfo, PrototypeTask, SprintCheckpoint } from "./interface";

export const INITIAL_TASKS: PrototypeTask[] = [
  {
    id: "task-1",
    title: "Stripe Webhook Idempotency & Replay Shield",
    assignee: { name: "Sarah Chen", role: "Senior Backend Eng", handle: "@sarah" },
    priority: "critical",
    workflowState: "in_progress",
    dueDay: 6,
    subtasks: [
      { id: "s1", title: "Redis distributed lock with TTL jitter", completed: true },
      { id: "s2", title: "Idempotency-Key HTTP header validation", completed: true },
      { id: "s3", title: "Dead-letter queue backoff exponential retry", completed: false },
    ],
  },
  {
    id: "task-2",
    title: "Kafka Consumer Partition Rebalance Grace Period",
    assignee: { name: "Rahim Khan", role: "Distributed Systems Eng", handle: "@rahim" },
    priority: "high",
    workflowState: "in_progress",
    dueDay: 9,
    subtasks: [
      { id: "s4", title: "CooperativeStickyAssignor configuration", completed: true },
      { id: "s5", title: "Heartbeat timeout latency benchmarks", completed: false },
    ],
  },
  {
    id: "task-3",
    title: "OpenTelemetry Distributed Trace Headers for gRPC",
    assignee: { name: "John Doe", role: "Platform Engineer", handle: "@john" },
    priority: "medium",
    workflowState: "todo",
    dueDay: 12,
    subtasks: [
      { id: "s6", title: "W3C traceparent context propagator", completed: false },
      { id: "s7", title: "Jaeger ingestion span sampling filter", completed: false },
    ],
  },
  {
    id: "task-4",
    title: "RBAC Token Invalidation & Ephemeral Key Rotation",
    assignee: { name: "Ayesha Patel", role: "Security Architect", handle: "@ayesha" },
    priority: "high",
    workflowState: "done",
    dueDay: 4,
    completedAtDay: 4,
    subtasks: [
      { id: "s8", title: "JWT blacklist caching in Redis cluster", completed: true },
      { id: "s9", title: "Automated rotation cron test suite", completed: true },
    ],
  },
];

export const SPRINT_CHECKPOINTS: SprintCheckpoint[] = [
  { day: 2, label: "Day 2", phase: "Sprint Kickoff" },
  { day: 6, label: "Day 6", phase: "Mid-Sprint Sync" },
  { day: 10, label: "Day 10", phase: "Feature Freeze" },
  { day: 14, label: "Day 14", phase: "Sprint Release" },
];

export const DEADLINE_STATES_INFO: DeadlineStateInfo[] = [
  {
    state: "on_track",
    title: "On Track",
    rule: "> 3 days remaining",
    description: "Deadline is safely ahead. Normal delivery velocity without blockers.",
    badgeTone: "bg-info-soft text-info border-info/30",
  },
  {
    state: "due_soon",
    title: "Due Soon",
    rule: "≤ 3 days remaining",
    description: "Urgency window active. Amber alert badge triggered automatically.",
    badgeTone: "bg-warning-soft text-warning-foreground border-warning/30",
  },
  {
    state: "overdue",
    title: "Overdue",
    rule: "Deadline timestamp passed",
    description: "Target breached without completion. Escalated immediately on manager board.",
    badgeTone: "bg-danger-soft text-danger border-danger/30",
  },
  {
    state: "completed_on_time",
    title: "Completed On Time",
    rule: "Marked done before deadline",
    description: "Successfully shipped within the promised delivery window.",
    badgeTone: "bg-success-soft text-success border-success/30",
  },
  {
    state: "completed_late",
    title: "Completed Late",
    rule: "Marked done after deadline",
    description: "Delivered, but flagged in retrospective metrics for capacity planning.",
    badgeTone: "bg-muted text-muted-foreground border-border",
  },
];
