/**
 * Plain React hooks for balance data — no external query library.
 *
 * Strategy:
 * 1. useEmployeeBalances() — batch fetch with 60 s background poll,
 *    window-focus refetch, 30 s stale detection, and optimistic-update support.
 * 2. useBalance()          — single-cell authoritative read (manager view).
 *
 * Optimistic update contract (managed by the caller, not this hook):
 * - cancelFetch()       — abort any in-flight fetch before applying optimistic state.
 * - applyOptimistic()   — snapshot current data and apply a local update.
 * - rollback()          — restore the snapshot on error.
 * - refresh()           — trigger a background re-fetch to reconcile with HCM.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { fetchBalance, fetchBatchBalances } from "@/lib/hcm-api";
import type { HcmBalanceResponse, HcmBatchResponse } from "@/types";

const STALE_AFTER_MS = 30_000;
const POLL_INTERVAL_MS = 60_000;

/** All balance rows for one employee, with polling and optimistic-update support. */
export function useEmployeeBalances(employeeId: string) {
  const [raw, setRaw] = useState<HcmBatchResponse | null>(null);
  const [optimisticOverride, setOptimisticOverride] =
    useState<HcmBatchResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<HcmBatchResponse | null>(null);

  const doFetch = useCallback(async (isBackground = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isBackground) setIsLoading(true);
    setIsFetching(true);

    try {
      const result = await fetchBatchBalances();
      if (controller.signal.aborted) return;
      setRaw(result);
      setOptimisticOverride(null);
      setError(null);
      setIsStale(false);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => setIsStale(true), STALE_AFTER_MS);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => { doFetch(false); }, [doFetch]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    },
    []
  );

  // Background poll every 60 s
  useEffect(() => {
    const id = setInterval(() => doFetch(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [doFetch]);

  // Refetch on window focus (catches mid-session HCM changes)
  useEffect(() => {
    const handler = () => doFetch(true);
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [doFetch]);

  // Filtered view for this employee
  const data = useMemo(() => {
    const source = optimisticOverride ?? raw;
    return source ? source.balances.filter((b) => b.employeeId === employeeId) : null;
  }, [optimisticOverride, raw, employeeId]);

  /** Abort any in-flight fetch — call before applying an optimistic update. */
  const cancelFetch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsFetching(false);
  }, []);

  /** Snapshot current data and apply an optimistic transformation. */
  const applyOptimistic = useCallback(
    (updater: (prev: HcmBatchResponse) => HcmBatchResponse) => {
      const current = raw;
      if (!current) return;
      snapshotRef.current = current;
      setOptimisticOverride(updater(current));
    },
    [raw]
  );

  /** Restore the pre-optimistic snapshot. */
  const rollback = useCallback(() => {
    if (snapshotRef.current) {
      setRaw(snapshotRef.current);
      setOptimisticOverride(null);
      snapshotRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { data, error, isLoading, isFetching, isStale, refresh, cancelFetch, applyOptimistic, rollback };
}

/** Single authoritative cell — used in manager view at decision time. */
export function useBalance(employeeId: string, locationId: string) {
  const [data, setData] = useState<HcmBalanceResponse | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!employeeId || !locationId) return;
    let cancelled = false;
    setIsLoading(true);
    fetchBalance(employeeId, locationId)
      .then((result) => { if (!cancelled) { setData(result); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, locationId]);

  return { data, error, isLoading };
}
