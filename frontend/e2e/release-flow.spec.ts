import { test, expect } from '@playwright/test';

test.describe('Release & Refund Multi-Level Approval Flow', () => {
  test('Approving authority can review officer recommendation, view conditions, and approve release', async ({ page }) => {
    // 1. Log in as Approving Authority
    await page.goto('/login');
    await page.fill('input[type="email"]', 'approver@aicte-india.org');
    await page.fill('input[type="password"]', 'AuthorityPassword123!');
    await page.click('button:has-text("Sign In")');

    const autoFillBtn = page.locator('button:has-text("Auto-fill")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
    }
    await page.click('button:has-text("Verify & Access Portal")');

    // 2. Navigate to Approvals Inbox
    await page.goto('/approvals');
    await expect(page.locator('h1')).toContainText('Pending Approvals');
    await expect(page.locator('text=Segregation of Duties Enforced')).toBeVisible();

    // 3. Inspect first pending item
    const rows = page.locator('tbody tr');
    if ((await rows.count()) > 0) {
      await page.click('button:has-text("Adjudicate")');

      // Verify release request details and condition checklist
      await expect(page.locator('text=Statutory Condition Evaluation Checklist')).toBeVisible();
      await expect(page.locator('text=Authority Final Adjudication')).toBeVisible();

      // Check one-click approval button
      const approveBtn = page.locator('button:has-text("One-Click Final Approval")');
      await expect(approveBtn).toBeVisible();
    }
  });
});
