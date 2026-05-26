import { test, expect, type Page } from "@playwright/test";

/**
 * Business flow — Time-off request denial.
 *
 * Complements time-off-approval.spec.ts by exercising the opposite branch:
 *   1. Employee submits a request (optimistic deduction visible).
 *   2. Manager denies the request from the pending queue.
 *   3. Employee's tab receives the SSE update and the balance is restored
 *      to its pre-submission value without a manual refresh.
 *
 * Why this matters:
 *   The approval path leaves the balance deducted; the deny path must call
 *   `restoreBalance` in the store. That restore is only covered by unit and
 *   integration tests today — this spec proves the entire denial-to-restore
 *   pipeline works through real Next.js + NextAuth + SSE.
 */

const RUN_TAG = `e2e-deny-${Date.now()}`;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

function parseAvailable(text: string): number {
  return parseInt(text.match(/\d+/)?.[0] ?? "0", 10);
}

test("employee submits → manager denies → employee balance is restored via SSE", async ({
  browser,
}) => {
  // ── Employee context ────────────────────────────────────────────────────
  const employeeCtx = await browser.newContext();
  const employee = await employeeCtx.newPage();
  await login(employee, "alice@readyon.com", "alice123");
  await expect(employee).toHaveURL(/\/employee$/);

  // Snapshot the starting available days on the primary balance card.
  const firstBalanceCard = employee.getByTestId("balance-card").first();
  await expect(firstBalanceCard).toBeVisible();
  const beforeAvailable = parseAvailable(await firstBalanceCard.innerText());

  // Submit a 2-day request tagged for this run.
  await employee.getByLabel("Start date").fill("2026-10-05");
  await employee.getByLabel("End date").fill("2026-10-06");
  await employee.getByLabel(/reason/i).fill(RUN_TAG);
  await employee.getByTestId("submit-button").click();

  // Optimistic deduction is visible immediately.
  await expect(employee.getByText("Pending").first()).toBeVisible();
  await expect
    .poll(async () => parseAvailable(await firstBalanceCard.innerText()), {
      timeout: 5_000,
      message: "optimistic deduction never appeared",
    })
    .toBe(beforeAvailable - 2);

  // ── Manager context ─────────────────────────────────────────────────────
  const managerCtx = await browser.newContext();
  const manager = await managerCtx.newPage();
  await login(manager, "carol@readyon.com", "carol123");
  await expect(manager).toHaveURL(/\/manager$/);

  // Find the just-submitted request by its run tag and deny it.
  const tagged = manager.getByTestId("request-card").filter({ hasText: RUN_TAG });
  await expect(tagged).toHaveCount(1);
  await tagged.getByTestId("deny-btn").click();

  // The card leaves the manager's pending queue.
  await expect(tagged).toHaveCount(0, { timeout: 5_000 });

  // ── Employee tab: SSE → router.refresh() → balance restored ─────────────
  await expect
    .poll(async () => parseAvailable(await firstBalanceCard.innerText()), {
      timeout: 10_000,
      message: "employee balance never returned to pre-submission value",
    })
    .toBe(beforeAvailable);

  await employeeCtx.close();
  await managerCtx.close();
});
