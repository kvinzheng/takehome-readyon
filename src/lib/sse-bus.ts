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

export interface BalanceUpdatePayload {
  employeeId: string;
  locationId: string;
  bonus: number;
  reason: string;
}

// ── Pub / sub helpers ─────────────────────────────────────────────────────

export function emitBalanceUpdate(payload: BalanceUpdatePayload): void {
  sseBus.emit("balance-update", payload);
}

/**
 * Subscribe to balance-update events.
 * Returns an unsubscribe function — call it when the SSE connection closes.
 */
export function onBalanceUpdate(
  listener: (payload: BalanceUpdatePayload) => void
): () => void {
  sseBus.on("balance-update", listener);
  return () => sseBus.off("balance-update", listener);
}
