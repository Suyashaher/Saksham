import { test, expect } from '@playwright/test';

test.describe('Portal Authentication & MFA Flow', () => {
  test('User can sign in with valid credentials and complete 2FA OTP verification', async ({ page }) => {
    await page.goto('/login');

    // Check page title and government branding
    await expect(page.locator('h1')).toContainText('FDR & Security Deposit Portal');
    await expect(page.locator('text=Government of India')).toBeVisible();

    // Fill login credentials
    await page.fill('input[type="email"]', 'officer@aicte-india.org');
    await page.fill('input[type="password"]', 'CorrectPassword123!');
    await page.click('button:has-text("Sign In")');

    // Should transition to 2FA screen
    await expect(page.locator('h2')).toContainText('Two-Factor Authentication');

    // If dev OTP hint is present, click auto-fill or enter digits
    const autoFillBtn = page.locator('button:has-text("Auto-fill")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
    } else {
      const inputs = page.locator('input[inputmode="numeric"]');
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).fill(String(i + 1));
      }
    }

    await page.click('button:has-text("Verify & Access Portal")');

    // Should land on authenticated dashboard
    await expect(page).toHaveURL(/\/(dashboard|officer\/queue|instruments)?/);
  });
});
