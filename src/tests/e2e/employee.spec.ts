/**
 * E2E tests — Employee view (http://localhost:3000/employee)
 *
 * Tests run against the real Next.js dev server with the in-memory HCM store.
 * Because the store is shared across tests, each test cleans up after itself
 * by navigating to a fresh page (which resets React state), and tests are
 * designed to be idempotent where possible.
 */

import { test, expect } from '@playwright/test';

const EMPLOYEE_URL = '/employee';

test.describe('Employee view — page load', () => {
  test('shows the page heading and balance section', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await expect(page.getByRole('heading', { name: 'My Time Off' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Balance overview' })).toBeVisible();
  });

  test('renders at least one balance card after data loads', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    // Wait for loading skeleton to disappear
    await expect(page.getByTestId('loading-skeleton')).not.toBeVisible({ timeout: 5_000 }).catch(() => {
      // Skeleton may have never been visible if data loaded instantly
    });
    await expect(page.getByTestId('balance-card').first()).toBeVisible({ timeout: 5_000 });
  });

  test('renders the time-off request form', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await expect(page.getByTestId('time-off-form')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Employee view — form validation', () => {
  test('shows validation error when submitting without dates', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await page.getByTestId('time-off-form').waitFor();
    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('form-error')).toBeVisible();
    await expect(page.getByTestId('form-error')).toContainText('date');
  });

  test('submit button is disabled while request is in flight', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await page.getByTestId('time-off-form').waitFor();

    // Fill in a valid request (3 days, well within the 10-day default balance)
    await page.getByLabel('Start date').fill('2026-10-01');
    await page.getByLabel('End date').fill('2026-10-03');

    // Click submit and immediately check that the button is disabled
    const submitBtn = page.getByTestId('submit-button');
    await submitBtn.click();

    // Button becomes disabled during submission
    await expect(submitBtn).toBeDisabled();
  });
});

test.describe('Employee view — happy path submission', () => {
  test('shows success banner after valid submission', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await page.getByTestId('time-off-form').waitFor();

    await page.getByLabel('Start date').fill('2026-11-01');
    await page.getByLabel('End date').fill('2026-11-02'); // 2 days
    await page.getByTestId('submit-button').click();

    await expect(page.getByTestId('success-banner')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('success-banner')).toContainText('2 day');
  });

  test('new request appears in request history after submit', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await page.getByTestId('time-off-form').waitFor();

    // Use dates unlikely to collide with other tests
    await page.getByLabel('Start date').fill('2026-12-01');
    await page.getByLabel('End date').fill('2026-12-01'); // 1 day
    await page.getByLabel(/reason/i).fill('E2E test request');
    await page.getByTestId('submit-button').click();

    await expect(page.getByTestId('success-banner')).toBeVisible({ timeout: 5_000 });

    // Request card should now appear in the history section
    const historySection = page.getByRole('region', { name: 'My requests' });
    await expect(historySection.getByTestId('request-card').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Employee view — accessibility', () => {
  test('page has no critical axe violations', async ({ page }) => {
    await page.goto(EMPLOYEE_URL);
    await page.getByTestId('time-off-form').waitFor({ timeout: 5_000 });

    // Run axe via injected script
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
