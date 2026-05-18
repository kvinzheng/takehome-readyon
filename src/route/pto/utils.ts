import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export interface RouteOptions {
  /** Extra response headers to merge onto successful responses. */
  headers?: Record<string, string>;
}

export async function handleRoute(
  fn: () => Promise<unknown>,
  options: RouteOptions = {}
): Promise<NextResponse> {
  try {
    const data = await fn();
    const res = NextResponse.json(data);
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        res.headers.set(k, v);
      }
    }
    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// ─── Common cache policies ────────────────────────────────────────────────────

/** Per-user / mutable data. Never cache anywhere. */
export const NO_STORE = { "Cache-Control": "private, no-store" };

/** Stable reference data. Browser may cache for 5 min, revalidate up to 1h. */
export const REFERENCE_DATA = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
};
