import "server-only";

import { EventEmitter } from "events";

/**
 * Module-singleton event bus for Server-Sent Events.
 *
 * All route handlers in the same Node.js process (dev server or single-instance
 * prod) share this emitter. Each connected browser tab registers one listener.
 *
 * In a multi-instance deployment you would replace this with Redis pub/sub
 * or a similar external channel.
 *
 * NOTE: stashed on globalThis so HMR / Turbopack module re-evaluation in dev
 * (and the separate module graphs Next builds for route handlers vs. server
 * actions in prod) all share the *same* emitter instance. Without this, an
 * emit from a Server Action never reaches the listener registered by the SSE
 * route handler.
 */
const globalForSse = globalThis as unknown as { __ptoSseBus?: EventEmitter };
const sseBus =
  globalForSse.__ptoSseBus ??
  (globalForSse.__ptoSseBus = new EventEmitter());
sseBus.setMaxListeners(200); // one per open browser tab

// ── Payload types ─────────────────────────────────────────────────────────

export type PtoUpdateReason =
  | "submit"
  | "approve"
  | "deny"
  | "anniversary";

export interface PtoUpdatePayload {
  /** Employee whose data changed. */
  employeeId: string;
  /** Optional location for balance-affecting events. */
  locationId?: string;
  /** Days added (anniversary) or null when not applicable. */
  bonus?: number;
  /** What caused the emit — useful for client-side filtering and logs. */
  reason: PtoUpdateReason;
}

/** @deprecated use PtoUpdatePayload — retained for back-compat with grant path. */
export type BalanceUpdatePayload = PtoUpdatePayload;

// ── Pub / sub helpers ─────────────────────────────────────────────────────

export function emitPtoUpdate(payload: PtoUpdatePayload): void {
  sseBus.emit("pto-update", payload);
}

/** @deprecated use emitPtoUpdate. Kept so existing callers keep compiling. */
export function emitBalanceUpdate(payload: PtoUpdatePayload): void {
  emitPtoUpdate(payload);
}

/**
 * Subscribe to pto-update events.
 * Returns an unsubscribe function — call it when the SSE connection closes.
 */
export function onPtoUpdate(
  listener: (payload: PtoUpdatePayload) => void
): () => void {
  sseBus.on("pto-update", listener);
  return () => sseBus.off("pto-update", listener);
}

export const onBalanceUpdate = onPtoUpdate;
