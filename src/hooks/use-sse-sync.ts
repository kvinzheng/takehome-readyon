"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Opens a persistent SSE connection to /route/pto/events and calls
 * router.refresh() whenever a "balance-update" frame arrives.
 *
 * Returns:
 *   isStale   — true from the moment a balance-update event fires until the
 *               parent clears it (i.e. fresh initialBalances have arrived).
 *   clearStale — call when fresh server data has landed to reset isStale.
 *   refresh    — manually trigger router.refresh() (e.g. from a StaleWarning
 *               "Refresh" button).
 *
 * Guards against jsdom / SSR environments where EventSource is undefined.
 */
export function useSSESync() {
  const router = useRouter();
  const [isStale, setIsStale] = useState(false);

  const clearStale = useCallback(() => setIsStale(false), []);
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/route/pto/events");
    es.addEventListener("balance-update", () => {
      setIsStale(true);
      router.refresh();
    });

    return () => es.close();
  }, [router]);

  return { isStale, clearStale, refresh };
}
