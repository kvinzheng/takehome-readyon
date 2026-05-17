import { NextRequest, NextResponse } from "next/server";
import { getAllBalances } from "@/lib/pto-store";

/**
 * GET /api/hcm/balances/batch
 * Returns all balance rows across all employees and locations.
 * Expensive — use for initial hydration and periodic reconciliation.
 */
export async function GET(req: NextRequest) {
  // Simulate variable latency (batch is "expensive")
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  // Simulate occasional slow response (but not a failure)
  const balances = getAllBalances();

  return NextResponse.json({
    balances,
    generatedAt: new Date().toISOString(),
  });
}
