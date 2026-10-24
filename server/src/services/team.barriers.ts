// Shared synchronization barriers for deterministic concurrency tests.
// Called by task, project, and reconciliation workflows plus test-only routes.
// This module owns no database access or request/response handling.

type BarrierAction = {
  emit?: string;
  wait?: string;
};

type BarrierHookName =
  | "afterTaskCreateSave"
  | "afterTaskCreateMembershipCheck"
  | "afterTaskPatchSave"
  | "afterTaskPatchMembershipCheck"
  | "duringProjectTeamRemoval"
  | "beforeProjectSave";

type BarrierHook = (() => Promise<void>) | null;

interface BarrierState {
  eventWaiters: Map<string, Array<() => void>>;
  emittedEvents: Set<string>;
  hooks: Record<BarrierHookName, BarrierHook>;
  simulateRemovalFailure: boolean;
  simulateReconcileFailure: boolean;
}

interface ConcurrencyTestBarriers {
  afterTaskCreateSave: BarrierHook;
  afterTaskCreateMembershipCheck: BarrierHook;
  afterTaskPatchSave: BarrierHook;
  afterTaskPatchMembershipCheck: BarrierHook;
  duringProjectTeamRemoval: BarrierHook;
  beforeProjectSave: BarrierHook;
  simulateRemovalFailure: boolean;
  simulateReconcileFailure: boolean;
  emit(eventName: string): void;
  wait(eventName: string, timeoutMs?: number): Promise<boolean>;
  setHook(hookName: BarrierHookName, action: BarrierAction | null): void;
  reset(): void;
}

const state: BarrierState = {
  eventWaiters: new Map(),
  emittedEvents: new Set(),
  hooks: {
    afterTaskCreateSave: null,
    afterTaskCreateMembershipCheck: null,
    afterTaskPatchSave: null,
    afterTaskPatchMembershipCheck: null,
    duringProjectTeamRemoval: null,
    beforeProjectSave: null,
  },
  simulateRemovalFailure: false,
  simulateReconcileFailure: false,
};

/** Emits a synchronization event and resolves all current waiters for it. */
function emit(eventName: string): void {
  state.emittedEvents.add(eventName);
  const waiters = state.eventWaiters.get(eventName);
  if (waiters && waiters.length > 0) {
    state.eventWaiters.delete(eventName);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

/** Consumes a pending event or waits until it arrives, rejecting after the existing timeout. */
function wait(eventName: string, timeoutMs = 10000): Promise<boolean> {
  if (state.emittedEvents.has(eventName)) {
    state.emittedEvents.delete(eventName);
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const arr = state.eventWaiters.get(eventName) || [];
      state.eventWaiters.set(
        eventName,
        arr.filter((callback) => callback !== onResolve),
      );
      reject(new Error(`Timeout waiting for barrier event: ${eventName}`));
    }, timeoutMs);

    const onResolve = () => {
      clearTimeout(timer);
      state.emittedEvents.delete(eventName);
      resolve(true);
    };

    const existing = state.eventWaiters.get(eventName) || [];
    existing.push(onResolve);
    state.eventWaiters.set(eventName, existing);
  });
}

/** Installs or clears one workflow hook while preserving its emit-before-wait order. */
function setHook(hookName: BarrierHookName, action: BarrierAction | null): void {
  if (!action) {
    state.hooks[hookName] = null;
    return;
  }
  state.hooks[hookName] = async () => {
    if (action.emit) {
      emit(action.emit);
    }
    if (action.wait) {
      await wait(action.wait);
    }
  };
}

/** Clears hook state and events without cancelling timers for already-pending waits. */
function reset(): void {
  state.hooks.afterTaskCreateSave = null;
  state.hooks.afterTaskCreateMembershipCheck = null;
  state.hooks.afterTaskPatchSave = null;
  state.hooks.afterTaskPatchMembershipCheck = null;
  state.hooks.duringProjectTeamRemoval = null;
  state.hooks.beforeProjectSave = null;
  state.simulateRemovalFailure = false;
  state.simulateReconcileFailure = false;
  state.emittedEvents.clear();
  state.eventWaiters.clear();
}

/**
 * Reads or updates the single barrier state shared by every service consumer.
 * Who may call it: concurrency test workflows and test-only routes. Side effects: mutates test synchronization state only.
 * Errors: wait rejects with "Timeout waiting for barrier event: <event>" when its timeout expires.
 */
export const concurrencyTestBarriers: ConcurrencyTestBarriers = {
  get afterTaskCreateSave() {
    return state.hooks.afterTaskCreateSave;
  },
  set afterTaskCreateSave(hook: BarrierHook) {
    state.hooks.afterTaskCreateSave = hook;
  },
  get afterTaskCreateMembershipCheck() {
    return state.hooks.afterTaskCreateMembershipCheck;
  },
  set afterTaskCreateMembershipCheck(hook: BarrierHook) {
    state.hooks.afterTaskCreateMembershipCheck = hook;
  },
  get afterTaskPatchSave() {
    return state.hooks.afterTaskPatchSave;
  },
  set afterTaskPatchSave(hook: BarrierHook) {
    state.hooks.afterTaskPatchSave = hook;
  },
  get afterTaskPatchMembershipCheck() {
    return state.hooks.afterTaskPatchMembershipCheck;
  },
  set afterTaskPatchMembershipCheck(hook: BarrierHook) {
    state.hooks.afterTaskPatchMembershipCheck = hook;
  },
  get duringProjectTeamRemoval() {
    return state.hooks.duringProjectTeamRemoval;
  },
  set duringProjectTeamRemoval(hook: BarrierHook) {
    state.hooks.duringProjectTeamRemoval = hook;
  },
  get beforeProjectSave() {
    return state.hooks.beforeProjectSave;
  },
  set beforeProjectSave(hook: BarrierHook) {
    state.hooks.beforeProjectSave = hook;
  },
  get simulateRemovalFailure() {
    return state.simulateRemovalFailure;
  },
  set simulateRemovalFailure(value: boolean) {
    state.simulateRemovalFailure = value;
  },
  get simulateReconcileFailure() {
    return state.simulateReconcileFailure;
  },
  set simulateReconcileFailure(value: boolean) {
    state.simulateReconcileFailure = value;
  },
  emit,
  wait,
  setHook,
  reset,
};
