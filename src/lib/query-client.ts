/**
 * TanStack Query client — singleton for the app.
 * Configuration decisions:
 *
 * - staleTime: 30 s  — balance data is considered fresh for 30 s after fetch.
 *   Shorter than Workday's typical cache TTL so we stay close to HCM truth
 *   without hammering the real-time endpoint every render.
 *
 * - gcTime: 5 min    — keep unused data in cache to avoid flashes on tab switch.
 *
 * - retry: 2          — balance reads are cheap; retry transient failures twice
 *   before surfacing an error to the user.
 *
 * - refetchOnWindowFocus: true — crucial for the "mid-session balance change"
 *   scenario: when the user tabs back in after an anniversary bonus fired.
 */

import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,          // 30 s
          gcTime: 5 * 60_000,         // 5 min
          retry: 2,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
        mutations: {
          retry: 0, // mutations should not retry — idempotency is not guaranteed
        },
      },
    });
  }
  return client;
}

/** For tests: create a fresh client with no shared state */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
