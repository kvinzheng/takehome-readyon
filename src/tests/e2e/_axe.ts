import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Run axe-core against the current page and assert zero violations.
 *
 * Scoped to WCAG 2.0/2.1 A + AA — same level used by jest-axe in the
 * component/integration tests. Keeps a single accessibility bar across the
 * whole test pyramid.
 */
export async function expectNoA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join("\n");
    throw new Error(`A11y violations on ${label}:\n${summary}`);
  }

  expect(results.violations).toEqual([]);
}
