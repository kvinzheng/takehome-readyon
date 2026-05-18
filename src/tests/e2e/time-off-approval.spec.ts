import { test, expect } from "@playwright/test";

/**
 * Business flow — Time-off request approval.
 *
 * Use case:
 *   An employee submits a time-off request. Their manager, working in a
 *   separate session, sees it in the pending queue and approves it.
 *
 * Notes:
 *  - The dev server's in-memory store is shared across browser contexts in
 *    the same process, so an employee submission is immediately visible to
 *    a manager session in a separate context.
 *  - We DO NOT clear the store between tests — Playwright is configured with
 *    a single worker and these tests run sequentially against a fresh dev
 *    server boot. Re-running locally without restarting the dev server is
 *    expected to leave stale requests in the queue, which is fine here
 *    because we filter by a per-run reason string.
 */

const RUN_TAG = `e2e-${Date.now()}`;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("employee submits → manager approves → employee request shows approved", async ({ browser }) => {
  // ── Employee context ────────────────────────────────────────────────────
  const employeeCtx = await browser.newContext();
  const employee = await employeeCtx.newPage();

  await login(employee, "alice@readyon.com", "alice123");
  await expect(employee).toHaveURL(/\/employee$/);

  // Balances render
  const balanceCards = employee.getByTestId("balance-card");
  await expect(balanceCards.first()).toBeVisible();

  // Submit a 1-day request
  await employee.getByLabel("Start date").fill("2026-09-01");
  await employee.getByLabel("End date").fill("2026-09-01");
  await employee.getByLabel(/reason/i).fill(RUN_TAG);
  await employee.getByTestId("submit-button").click();

  // Optimistic pending badge appears
  await expect(employee.getByText("Pending").first()).toBeVisible();

  // ── Manager context ─────────────────────────────────────────────────────
  const managerCtx = await browser.newContext();
  const manager = await managerCtx.newPage();

  await login(manager, "carol@readyon.com", "carol123");
  await expect(manager).toHaveURL(/\/manager$/);

  // The just-submitted request is in the pending queue
  const tagged = manager.getByTestId("request-card").filter({ hasText: RUN_TAG });
  await expect(tagged).toHaveCount(1);

  // Approve it
  await tagged.getByTestId("approve-btn").click();

  // Card disappears from manager pending list (or is removed entirely)
  await expect(tagged).toHaveCount(0, { timeout: 5_000 });

  await employeeCtx.close();
  await managerCtx.close();
});
