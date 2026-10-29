import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

const VIEWPORTS = [
  { width: 1920, height: 1080, name: '1080p' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1280, height: 720, name: '720p' },
];

test.describe('Single-Screen No-Scroll Landing Page Tests', () => {
  for (const vp of VIEWPORTS) {
    test(`fits exactly in viewport with NO vertical scrolling at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Wait for main content to stabilize
      await page.waitForSelector('#main-content');

      // Assert document.scrollingElement.scrollHeight <= window.innerHeight (no vertical scroll)
      const isNoScroll = await page.evaluate(() => {
        const scroller = document.scrollingElement || document.documentElement;
        return scroller.scrollHeight <= window.innerHeight;
      });

      expect(isNoScroll).toBe(true);

      // Verify header, hero, and highlights are all simultaneously visible in the viewport
      await expect(page.locator('role=banner')).toBeVisible();
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('role=region[name="System Capabilities Highlights"]')).toBeVisible();

      // Verify headline lines and both action buttons are inside viewport
      await expect(page.locator('text=Streamlining')).toBeVisible();
      await expect(page.locator('text=Security Deposits')).toBeVisible();
      await expect(page.locator('text=& FDRs')).toBeVisible();
      await expect(page.locator('role=button[name="Login"]').first()).toBeVisible();
      await expect(page.locator('role=button[name="How it works"]')).toBeVisible();
    });
  }

  test('Captures screenshots at target viewports', async ({ page }) => {
    // 1920x1080 Screenshot
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('#main-content');
    await page.screenshot({ path: path.join(__dirname, '../public/screenshot-1920x1080.png') });

    // 1440x900 Screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(__dirname, '../public/screenshot-1440x900.png') });

    // 1366x768 Screenshot
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(__dirname, '../public/screenshot-1366x768.png') });

    // 390px Mobile Viewport Screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, '../public/screenshot-390px-mobile.png') });
  });

  test('Nav links open lightweight modals without scrolling the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Click "How it works"
    await page.click('button:has-text("How it works")');
    const modal = page.locator('role=dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('How Saksham Works: End-to-End Lifecycle');

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Click "About" in navbar
    await page.click('header button:has-text("About")');
    await expect(page.locator('role=dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // Assert page still has no vertical scroll
    const isNoScroll = await page.evaluate(() => {
      const scroller = document.scrollingElement || document.documentElement;
      return scroller.scrollHeight <= window.innerHeight;
    });
    expect(isNoScroll).toBe(true);
  });

  test('axe-core accessibility audit on desktop and mobile', async ({ page }) => {
    // Desktop audit
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const desktopResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(desktopResults.violations).toEqual([]);

    // Mobile audit
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(mobileResults.violations).toEqual([]);
  });
});
