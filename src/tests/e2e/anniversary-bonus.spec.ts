import { test, expect, type Page } from "@playwright/test";

/**
 * Business flow — Anniversary bonus.
 *
 * Two trigger paths share a single store mutation:
 *
 *   1. Manager grants explicitly from the Approvals page.
 *   2. Employee opens their dashboard on their actual anniversary
 *      (auto-grant). Not e2e-covered here because seed hireDates are
 *      fixed and don't match today; covered indirectly via the manager
 *      flow which exercises the same `grantAnniversaryBonus` store path.
 *
 * What this spec verifies:
 *  - Manager sees an Anniversary panel listing every employee.
 *  - Clicking Grant +5 days flips the row state to "Granted this year"
 *    and disables further grants for that calendar year.
 *  - An employee with their dashboard open in a separate browser context
 *    receives a Server-Sent-Events balance-update and re-renders with
 *    the +5 days without manually refreshing.
 */

const EMPLOYEE = { email: "alice@readyon.com", password: "alice123" };
const MANAGER = { email: "carol@readyon.com", password: "carol123" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("manager grants anniversary bonus → employee sees +5 live via SSE", async ({ browser }) => {
  // ── Employee dashboard open in tab A ────────────────────────────────────
  const employeeCtx = await browser.newContext();
  const employee = await employeeCtx.newPage();
  await login(employee, EMPLOYEE.email, EMPLOYEE.password);
  await expect(employee).toHaveURL(/\/employee$/);

  // Snapshot the starting available days for the primary (first) balance card.
  const firstBalanceCard = employee.getByTestId("balance-card").first();
  await expect(firstBalanceCard).toBeVisible();
  const before = await firstBalanceCard.innerText();
  const beforeAvailable = parseInt(before.match(/\d+/)?.[0] ?? "0", 10);

  // ── Manager grants in tab B ─────────────────────────────────────────────
  const managerCtx = await browser.newContext();
  const manager = await managerCtx.newPage();
  await login(manager, MANAGER.email, MANAGER.password);
  await expect(manager).toHaveURL(/\/manager$/);

  await expect(manager.getByTestId("anniversary-panel")).toBeVisible();

  const aliceRow = manager.getByTestId("anniversary-row-emp-1");
  await expect(aliceRow).toBeVisible();
  const grantBtn = manager.getByTestId("grant-bonus-emp-1");
  await expect(grantBtn).toBeEnabled();
  await grantBtn.click();

  // Row updates: Granted-this-year badge and button is now disabled.
  await expect(aliceRow.getByText(/granted this year/i)).toBeVisible();
  await expect(grantBtn).toBeDisabled();

  // ── Employee tab receives SSE → router.refresh() → new balance ──────────
  await expect
    .poll(
      async () => {
        const txt = await firstBalanceCard.innerText();
        const n = parseInt(txt.match(/\d+/)?.[0] ?? "0", 10);
        return n;
      },
      { timeout: 10_000, message: "employee balance never bumped" }
    )
    .toBe(beforeAvailable + 5);

  await employeeCtx.close();
  await managerCtx.close();
});

test("manager can also view the employee dashboard via nav link", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await expect(page).toHaveURL(/\/manager$/);

  await page.getByTestId("nav-employee").click();
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByTestId("employee-view")).toBeVisible();
});
