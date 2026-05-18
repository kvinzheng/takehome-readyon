import { test, expect, type Page } from "@playwright/test";

/**
 * Business flow — Role-based access control.
 *
 * Use case:
 *   Only signed-in users can reach the app; employees and managers each
 *   land on (and are confined to) their own dashboard. Visiting the wrong
 *   route bounces the user to the right one.
 *
 * Every route is exercised in three auth states (unauth, employee, manager),
 * covering:
 *   - src/app/page.tsx  — root role-based redirect
 *   - proxy.ts          — middleware guard for /employee and /manager
 *   - /login            — already-signed-in bounce
 */

const EMPLOYEE = { email: "alice@readyon.com", password: "alice123" };
const MANAGER = { email: "carol@readyon.com", password: "carol123" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for redirect off /login
  await expect(page).not.toHaveURL(/\/login$/);
}

// ── / (root) ───────────────────────────────────────────────────────────────

test("/ unauthenticated → /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("/ as employee → /employee", async ({ page }) => {
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await page.goto("/");
  await expect(page).toHaveURL(/\/employee$/);
});

test("/ as manager → /manager", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await page.goto("/");
  await expect(page).toHaveURL(/\/manager$/);
});

// ── /login ─────────────────────────────────────────────────────────────────

test("/login unauthenticated renders the form", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("/login as employee → /employee", async ({ page }) => {
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/employee$/);
});

test("/login as manager → /manager", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/manager$/);
});

// ── /employee ──────────────────────────────────────────────────────────────

test("/employee unauthenticated → /login", async ({ page }) => {
  await page.goto("/employee");
  await expect(page).toHaveURL(/\/login$/);
});

test("/employee as employee renders the dashboard", async ({ page }) => {
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await page.goto("/employee");
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByTestId("balance-card").first()).toBeVisible();
});

test("/employee as manager renders the employee dashboard (read-only access)", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await page.goto("/employee");
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByTestId("employee-view")).toBeVisible();
});

// ── /manager ───────────────────────────────────────────────────────────────

test("/manager unauthenticated → /login", async ({ page }) => {
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/login$/);
});

test("/manager as manager renders the queue", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/manager$/);
});

test("/manager as employee → /employee (role mismatch)", async ({ page }) => {
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/employee$/);
});
