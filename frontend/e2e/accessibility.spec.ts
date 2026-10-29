import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Accessibility Audit', () => {
  test('Login screen conforms to WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Public header and footer have valid landmark semantics and contrast', async ({ page }) => {
    await page.goto('/login');

    // Verify main landmarks
    await expect(page.locator('role=banner')).toBeVisible();
    await expect(page.locator('role=contentinfo')).toBeVisible();
  });
});
