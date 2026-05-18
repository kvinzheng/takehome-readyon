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
 */
const sseBus = new EventEmitter();
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
