import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — route × auth-state matrix.
 *
 * Every protected route is checked in three states (unauth, employee, manager).
 * These flows exercise:
 *   - src/app/page.tsx        — root role-based redirect
 *   - proxy.ts                — middleware guard for /employee and /manager
 *   - /login                  — already-signed-in bounce in LoginForm/route
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

test("/employee as manager → /manager (role mismatch)", async ({ page }) => {
  await login(page, MANAGER.email, MANAGER.password);
  await page.goto("/employee");
  await expect(page).toHaveURL(/\/manager$/);
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
