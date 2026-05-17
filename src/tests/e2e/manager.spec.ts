/**
 * E2E tests — Manager view (http://localhost:3000/manager)
 *
 * Requires at least one pending request to exist in the HCM store.
 * The employee.spec.ts happy-path tests create requests, so run the full
 * suite together; or seed a request via the API before running this file alone.
 */

import { test, expect } from '@playwright/test';

const MANAGER_URL = '/manager';
const EMPLOYEE_URL = '/employee';

/** Create a pending request so the manager view has something to act on. */
async function seedPendingRequest(page: import('@playwright/test').Page) {
  await page.goto(EMPLOYEE_URL);
  await page.getByTestId('time-off-form').waitFor({ timeout: 5_000 });
  await page.getByLabel('Start date').fill('2026-09-15');
  await page.getByLabel('End date').fill('2026-09-15'); // 1 day
  await page.getByLabel(/reason/i).fill('Manager E2E seed');
  await page.getByTestId('submit-button').click();
  await page.getByTestId('success-banner').waitFor({ timeout: 5_000 });
}

test.describe('Manager view — page load', () => {
  test('shows the page heading', async ({ page }) => {
    await page.goto(MANAGER_URL);
    await expect(
      page.getByRole('heading', { name: /pending/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Manager view — approve a request', () => {
  test.beforeEach(async ({ page }) => {
    await seedPendingRequest(page);
  });

  test('approve button marks request as approved', async ({ page }) => {
    await page.goto(MANAGER_URL);

    const approveBtn = page.getByTestId('approve-btn').first();
    await approveBtn.waitFor({ timeout: 5_000 });
    await approveBtn.click();

    // After approval the request card should show "Approved" status
    await expect(
      page.getByTestId('request-card').first().getByText(/approved/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Manager view — deny a request', () => {
  test.beforeEach(async ({ page }) => {
    await seedPendingRequest(page);
  });

  test('deny button marks request as denied', async ({ page }) => {
    await page.goto(MANAGER_URL);

    const denyBtn = page.getByTestId('deny-btn').first();
    await denyBtn.waitFor({ timeout: 5_000 });
    await denyBtn.click();

    await expect(
      page.getByTestId('request-card').first().getByText(/denied/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Manager view — accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await seedPendingRequest(page);
  });

  test('page has no critical axe violations', async ({ page }) => {
    await page.goto(MANAGER_URL);
    await page.getByTestId('approve-btn').first().waitFor({ timeout: 5_000 });

    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js',
    });

    const violations = await page.evaluate(async () => {
      // @ts-ignore — axe is injected via script tag
      const results = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      });
      return results.violations;
    });

    if (violations.length > 0) {
      const summary = violations
        .map((v: { id: string; description: string; nodes: unknown[] }) =>
          `[${v.id}] ${v.description} (${v.nodes.length} node${v.nodes.length !== 1 ? 's' : ''})`
        )
        .join('\n');
      throw new Error(`Accessibility violations found:\n${summary}`);
    }

    expect(violations).toHaveLength(0);
  });
});
