import { useState, useEffect, useCallback } from "react";
import { fetchRequests } from "@/lib/hcm-api";
import type { TimeOffRequest } from "@/types";

export function useRequests(employeeId?: string) {
  const [data, setData] = useState<TimeOffRequest[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetchRequests(employeeId);
      setData(result.requests);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { doFetch(); }, [doFetch]);

  useEffect(() => {
    const id = setInterval(doFetch, 30_000);
    return () => clearInterval(id);
  }, [doFetch]);

  return { data, error, isLoading, refresh: doFetch };
}

export function usePendingRequests() {
  const [data, setData] = useState<TimeOffRequest[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetchRequests();
      setData(result.requests.filter((r) => r.status === "pending_approval"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { doFetch(); }, [doFetch]);

  useEffect(() => {
    const id = setInterval(doFetch, 15_000);
    return () => clearInterval(id);
  }, [doFetch]);

  return { data, error, isLoading, refresh: doFetch };
}
