import { test, expect } from '@playwright/test';

/**
 * Bug: At Fajr time (05:12), the countdown shows time until
 * NEXT DAY'S FAJR (01:27:02 = 1h 27m) instead of CHOUROUK (06:40).
 * 
 * This test reproduces and verifies the fix for this bug.
 */

test.describe('Countdown at Fajr time', () => {
  test.beforeEach(async ({ page }) => {
    // Mock time to 05:12 Casablanca time (just after Fajr at ~05:11)
    // At this time:
    // - Fajr has started (05:11) but hasn't "passed" yet (needs 30 min buffer until 05:41)
    // - Chourouk is at ~06:40, so countdown should be ~1:28:00
    // Bug: countdown shows ~23:30:00 (tomorrow's Fajr)
    await page.clock.setFixedTime(new Date('2026-03-12T05:12:00Z'));
    
    // Complete onboarding
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('countdown shows Chourouk, not next day Fajr', async ({ page }) => {
    // Get the countdown text
    const countdown = page.locator('#inline-countdown');
    await expect(countdown).toBeVisible();
    
    const countdownText = await countdown.textContent();
    console.log('Countdown text at Fajr:', countdownText);
    
    // Parse the countdown (format: HH:MM:SS)
    const [hours, minutes, seconds] = countdownText.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + seconds / 60;
    
    // Expected: ~1.5 hours until Chourouk (~06:40 - 05:12 = 1h 28m)
    // Bug would show: ~23.5 hours (tomorrow's Fajr)
    // 
    // So the countdown should be:
    // - Less than 3 hours (until Chourouk)
    // - NOT greater than 20 hours (which would indicate next day)
    
    expect(totalMinutes).toBeLessThan(3 * 60); // Less than 3 hours
    expect(totalMinutes).toBeGreaterThan(30); // More than 30 min (sanity check)
    
    // Also verify Fajr is highlighted as current prayer
    const fajrRow = page.locator('#prayer-list li').nth(0); // Fajr is index 0
    await expect(fajrRow).toHaveClass(/current-prayer/);
    
    // And Chourouk should be the next-prayer (white highlight)
    const chouroukRow = page.locator('#prayer-list li').nth(1); // Chourouk is index 1
    await expect(chouroukRow).toHaveClass(/next-prayer/);
  });
});
