import { test, expect } from '@playwright/test';

/**
 * Bug: At Fajr time (05:12), the countdown showed time until
 * NEXT DAY'S FAJR (23+ hours) instead of DHUHR (~7 hours).
 * 
 * Chourouk (sunrise) is skipped because it's not a prayer with countdown.
 * The countdown should show time until the next actual prayer (Dhuhr).
 * 
 * This test verifies the fix: countdown shows Dhuhr, not tomorrow's Fajr.
 */

test.describe('Countdown at Fajr time', () => {
  test.beforeEach(async ({ page }) => {
    // Mock time to 05:12 Casablanca time (just after Fajr at ~05:11)
    // At this time:
    // - Fajr is current prayer (05:11)
    // - Chourouk is at ~06:40 (skipped - no countdown)
    // - Dhuhr is at ~12:21, so countdown should be ~7 hours
    // Bug was: countdown showed ~23 hours (tomorrow's Fajr)
    await page.clock.setFixedTime(new Date('2026-03-12T05:12:00Z'));
    
    // Complete onboarding
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('countdown shows Dhuhr, not next day Fajr', async ({ page }) => {
    // Get the countdown text
    const countdown = page.locator('#inline-countdown');
    await expect(countdown).toBeVisible();
    
    const countdownText = await countdown.textContent();
    console.log('Countdown text at Fajr:', countdownText);
    
    // Parse the countdown (format: HH:MM:SS)
    const [hours, minutes, seconds] = countdownText.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + seconds / 60;
    
    // Expected: ~7 hours until Dhuhr (~12:21 - 05:12 = 7h 9m = 429 min)
    // Bug would show: ~23 hours (tomorrow's Fajr)
    // 
    // So the countdown should be:
    // - Between 5-10 hours (until Dhuhr)
    // - NOT greater than 20 hours (which would indicate next day)
    
    expect(totalMinutes).toBeLessThan(10 * 60); // Less than 10 hours
    expect(totalMinutes).toBeGreaterThan(5 * 60); // More than 5 hours
    
    // Also verify Fajr is highlighted as current prayer
    const fajrRow = page.locator('#prayer-list li').nth(0); // Fajr is index 0
    await expect(fajrRow).toHaveClass(/current-prayer/);
    
    // Dhuhr should be the next-prayer (index 2, since Chourouk at index 1 is skipped)
    const dhuhrRow = page.locator('#prayer-list li').nth(2); // Dhuhr is index 2
    await expect(dhuhrRow).toHaveClass(/next-prayer/);
  });
});
