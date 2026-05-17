"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Opens a persistent SSE connection to /api/pto/events and calls
 * router.refresh() whenever a "balance-update" frame arrives.
 *
 * This is how the anniversary bonus (and any future server-side balance
 * mutation) surfaces in already-rendered tabs without polling.
 *
 * Guards against jsdom / SSR environments where EventSource is undefined.
 */
export function useSSESync() {
  const router = useRouter();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/route/pto/events");
    es.addEventListener("balance-update", () => {
      router.refresh();
    });

    return () => es.close();
  }, [router]);
}
