import { test, expect } from '@playwright/test';

/**
 * Bug: When a prayer time is reached (e.g., Asr at 15:59), the countdown
 * shows time until NEXT DAY'S same prayer (23+ hours) instead of the
 * NEXT prayer of today (Maghrib).
 * 
 * This test reproduces and verifies the fix for this bug.
 */

test.describe('Countdown to next prayer', () => {
  test.beforeEach(async ({ page }) => {
    // Mock time to 16:00 Casablanca time (just after Asr at ~15:59)
    // At this time:
    // - Asr has started (15:59) but hasn't "passed" yet (needs 30 min buffer until 16:29)
    // - Maghrib is at ~18:37, so countdown should be ~2:37:00
    // Bug: countdown shows ~23:30:00 (tomorrow's Asr)
    await page.clock.setFixedTime(new Date('2026-03-12T16:00:00Z'));
    
    // Complete onboarding
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('countdown shows next prayer (Maghrib), not next day same prayer', async ({ page }) => {
    // Get the countdown text
    const countdown = page.locator('#inline-countdown');
    await expect(countdown).toBeVisible();
    
    const countdownText = await countdown.textContent();
    console.log('Countdown text:', countdownText);
    
    // Parse the countdown (format: HH:MM:SS)
    const [hours, minutes, seconds] = countdownText.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + seconds / 60;
    
    // Expected: ~2.5 hours until Maghrib (~18:37 - 16:00 = 2h 37m)
    // Bug would show: ~23.5 hours (tomorrow's Asr)
    // 
    // So the countdown should be:
    // - Less than 4 hours (until Maghrib)
    // - NOT greater than 20 hours (which would indicate next day)
    
    expect(totalMinutes).toBeLessThan(4 * 60); // Less than 4 hours
    expect(totalMinutes).toBeGreaterThan(60); // More than 1 hour (sanity check)
    
    // Also verify Asr is highlighted as current prayer
    const asrRow = page.locator('#prayer-list li').nth(3); // Asr is index 3
    await expect(asrRow).toHaveClass(/current-prayer/);
    
    // And Maghrib should be the next-prayer (white highlight)
    const maghribRow = page.locator('#prayer-list li').nth(4); // Maghrib is index 4
    await expect(maghribRow).toHaveClass(/next-prayer/);
  });

});
