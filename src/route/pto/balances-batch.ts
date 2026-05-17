import { getAllBalances } from "@/lib/pto-store";
import type { Balance } from "@/types";

export async function getBatchBalancesHandler(): Promise<{
  balances: Balance[];
  generatedAt: string;
}> {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  return {
    balances: getAllBalances(),
    generatedAt: new Date().toISOString(),
  };
}
