import { test, expect } from '@playwright/test';

test.describe('Officer Scrutiny Console & Bank Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as verifying officer
    await page.goto('/login');
    await page.fill('input[type="email"]', 'officer@aicte-india.org');
    await page.fill('input[type="password"]', 'OfficerSecret123!');
    await page.click('button:has-text("Sign In")');

    const autoFillBtn = page.locator('button:has-text("Auto-fill")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
    }
    await page.click('button:has-text("Verify & Access Portal")');
  });

  test('Officer can view scrutiny queue and inspect side-by-side bank reconciliation table', async ({ page }) => {
    await page.goto('/officer/queue');

    await expect(page.locator('h1')).toContainText('Verification Scrutiny Work Queue');
    await expect(page.locator('text=AICTE SLA standard')).toBeVisible();

    // Check if table renders queue rows
    const rows = page.locator('tbody tr');
    if ((await rows.count()) > 0) {
      await rows.first().click();
      // Should open scrutiny or detail view
      await expect(page.locator('text=Bank Verification Comparison')).toBeVisible();
    }
  });
});
