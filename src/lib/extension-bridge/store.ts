/**
 * ShortStack OS — Chrome Extension Bridge Server Store
 *
 * In-memory store for the extension-bridge transport. Implements the
 * "simpler alternative" called out in the brief: rather than running a
 * Supabase Realtime channel + RLS + dedicated infra, we use authenticated
 * HTTP long-poll + ack.
 *
 *   Web app             Server (this store)            Extension (BG SW)
 *   ─────────           ───────────────────            ──────────────────
 *   POST /commands ───▶ enqueue(userId, cmd) ◀── long-poll /pending
 *                         │                             │
 *   GET /poll/:id  ◀──── result waits ◀────── POST /ack │
 *                                                       │
 *                       recordHeartbeat(userId) ◀── POST /heartbeat
 *
 * Trade-offs (acknowledged in the brief):
 *   - Not durable across redeploys — fine for MVP.
 *   - Not shared across serverless instances — fine because the extension
 *     is a single client per user and will rebind to whichever instance
 *     handles the next long-poll within ~2s.
 *   - Heartbeat-based "connected" signal is eventually consistent; a user
 *     whose extension crashed silently may show "Connected" for up to one
 *     HEARTBEAT_TTL_MS window. Good enough for a dashboard pill.
 *
 * Wire shapes (unchanged from bridge.js protocol):
 *   cmd:    { id, target, action, params, created_at }
 *   result: { id, ok, data?, error?, received_at }
 *   event:  { kind, data?, received_at }
 */

export type BridgeCommand = {
  id: string;
  target: "tab" | "bg";
  action: string;
  params: Record<string, unknown>;
  created_at: number;
};

export type BridgeResult = {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  received_at: number;
};

export type BridgeEvent = {
  kind: string;
  data?: unknown;
  received_at: number;
};

type UserQueue = {
  pending: BridgeCommand[];
  results: Map<string, BridgeResult>;
  events: BridgeEvent[];
  // Resolve functions for waiting long-pollers. Resolving them delivers
  // freshly-enqueued commands without having to wait for the next poll.
  waiters: Array<(cmds: BridgeCommand[]) => void>;
  lastHeartbeatAt: number;
  lastExtensionVersion?: string;
};

const queues = new Map<string, UserQueue>();

// How long a result sticks around for the web app to fetch via /poll/:id.
// 60s matches the brief.
const RESULT_TTL_MS = 60_000;
// Extension heartbeats every 25s (per bridge.js HEARTBEAT_MS). If we go
// 70s without a heartbeat we consider the extension offline.
const HEARTBEAT_TTL_MS = 70_000;
// Max events buffered before the oldest are dropped.
const EVENT_BUFFER = 50;

function getQueue(userId: string): UserQueue {
  let q = queues.get(userId);
  if (!q) {
    q = {
      pending: [],
      results: new Map(),
      events: [],
      waiters: [],
      lastHeartbeatAt: 0,
    };
    queues.set(userId, q);
  }
  return q;
}

function pruneResults(q: UserQueue) {
  const cutoff = Date.now() - RESULT_TTL_MS;
  // Use forEach (Map.prototype.forEach) rather than `for (... of map)` because
  // tsc's default target doesn't enable downlevel iteration for Map.
  q.results.forEach((r, id) => {
    if (r.received_at < cutoff) q.results.delete(id);
  });
}

export function enqueueCommand(
  userId: string,
  cmd: Omit<BridgeCommand, "created_at">,
): BridgeCommand {
  const q = getQueue(userId);
  const full: BridgeCommand = { ...cmd, created_at: Date.now() };
  q.pending.push(full);
  // Wake any waiters so the extension gets the cmd immediately.
  if (q.waiters.length > 0) {
    const drained = q.pending.splice(0);
    const callbacks = q.waiters.splice(0);
    for (const cb of callbacks) cb(drained);
  }
  return full;
}

/**
 * Drain pending commands. If there are none, wait up to `timeoutMs` for
 * new commands to arrive. This is how the extension's long-poll works.
 */
export function drainPending(
  userId: string,
  timeoutMs: number,
): Promise<BridgeCommand[]> {
  const q = getQueue(userId);
  if (q.pending.length > 0) {
    const drained = q.pending.splice(0);
    return Promise.resolve(drained);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = q.waiters.indexOf(resolveFn);
      if (idx >= 0) q.waiters.splice(idx, 1);
      resolve([]);
    }, timeoutMs);
    const resolveFn = (cmds: BridgeCommand[]) => {
      clearTimeout(timer);
      resolve(cmds);
    };
    q.waiters.push(resolveFn);
  });
}

export function recordResult(userId: string, result: Omit<BridgeResult, "received_at">) {
  const q = getQueue(userId);
  pruneResults(q);
  q.results.set(result.id, { ...result, received_at: Date.now() });
}

export function getResult(userId: string, cmdId: string): BridgeResult | null {
  const q = getQueue(userId);
  pruneResults(q);
  return q.results.get(cmdId) || null;
}

export function recordEvent(userId: string, event: Omit<BridgeEvent, "received_at">) {
  const q = getQueue(userId);
  q.events.push({ ...event, received_at: Date.now() });
  if (q.events.length > EVENT_BUFFER) {
    q.events.splice(0, q.events.length - EVENT_BUFFER);
  }
}

export function drainEvents(userId: string): BridgeEvent[] {
  const q = getQueue(userId);
  const out = q.events.splice(0);
  return out;
}

export function recordHeartbeat(userId: string, extensionVersion?: string) {
  const q = getQueue(userId);
  q.lastHeartbeatAt = Date.now();
  if (extensionVersion) q.lastExtensionVersion = extensionVersion;
}

export function getConnectionStatus(userId: string): {
  connected: boolean;
  lastHeartbeatAt: number;
  extensionVersion?: string;
} {
  const q = queues.get(userId);
  if (!q || !q.lastHeartbeatAt) {
    return { connected: false, lastHeartbeatAt: 0 };
  }
  const connected = Date.now() - q.lastHeartbeatAt < HEARTBEAT_TTL_MS;
  return {
    connected,
    lastHeartbeatAt: q.lastHeartbeatAt,
    extensionVersion: q.lastExtensionVersion,
  };
}

/**
 * Remember that this user has EVER connected. Used by the dashboard pill
 * to feature-detect — we only show the pill for users who have installed
 * the extension at least once.
 */
const everConnected = new Set<string>();
export function markEverConnected(userId: string) {
  everConnected.add(userId);
}
export function hasEverConnected(userId: string): boolean {
  return everConnected.has(userId);
}

// Expose constants for tests / debugging. Not used by routes directly.
export const _constants = { RESULT_TTL_MS, HEARTBEAT_TTL_MS, EVENT_BUFFER };
