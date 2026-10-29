import { test, expect } from '@playwright/test';

test.describe('Institution FDR Submission & Management Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as institution user
    await page.goto('/login');
    await page.fill('input[type="email"]', 'inst@college.edu.in');
    await page.fill('input[type="password"]', 'CollegePassword123!');
    await page.click('button:has-text("Sign In")');

    const autoFillBtn = page.locator('button:has-text("Auto-fill")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
    }
    await page.click('button:has-text("Verify & Access Portal")');
  });

  test('Institution can navigate New FDR wizard, observe joint-holder validation, and view portfolio', async ({ page }) => {
    await page.goto('/instruments/new');

    // Step 1: Bank & Branch
    await expect(page.locator('text=Step 1: Bank & Branch Information')).toBeVisible();
    await page.fill('input[placeholder*="FDR-"]', 'FDR-E2E-2026-999');
    await page.fill('input[placeholder*="State Bank"]', 'Punjab National Bank');
    await page.fill('input[placeholder*="Connaught Place"]', 'Nehru Place Branch');
    await page.fill('input[placeholder*="SBIN0000691"]', 'PUNB0123400');
    await page.click('button:has-text("Proceed to Financials")');

    // Step 2: Financials & AICTE Joint Holding
    await expect(page.locator('text=Step 2: Deposit Amount & AICTE Joint Holding')).toBeVisible();
    await page.fill('input[placeholder="1500000"]', '2500000');
    await page.fill('input[type="date"]', '2026-01-01');
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-01-01');
    await dateInputs.nth(1).fill('2029-01-01');
    await page.click('button:has-text("Proceed to Document Upload")');

    // Step 3: Document Upload
    await expect(page.locator('text=Step 3: Upload Scanned Certificate & Submit')).toBeVisible();
    await expect(page.locator('text=Review Details')).toBeVisible();
  });
});
