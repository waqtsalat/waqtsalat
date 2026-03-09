import { test, expect } from '@playwright/test';

test.describe('Onboarding wizard', () => {
  test('displays language selection step', async ({ page }) => {
    await page.goto('/');
    const onboarding = page.locator('#onboarding');
    await expect(onboarding).toBeVisible();

    // Language buttons are visible
    const langButtons = onboarding.locator('.lang-choices button');
    await expect(langButtons).toHaveCount(3);

    // Exactly one language button is selected (depends on browser locale)
    const selectedButtons = onboarding.locator('.lang-choices button.selected');
    await expect(selectedButtons).toHaveCount(1);

    // "Next" button is visible
    await expect(page.locator('#ob-lang-next')).toBeVisible();
  });

  test('advances to city selection step', async ({ page }) => {
    await page.goto('/');
    await page.locator('#ob-lang-next').click();

    // City select dropdown is visible
    await expect(page.locator('#ob-city-select')).toBeVisible();

    // City select has options
    const options = page.locator('#ob-city-select option');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);

    // GPS button is visible
    await expect(page.locator('#ob-gps-btn')).toBeVisible();
  });

  test('completes onboarding and shows app', async ({ page }) => {
    await page.goto('/');

    // Step 1: language
    await page.locator('#ob-lang-next').click();

    // Step 2: city — select a city and advance
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();

    // Step 3: done
    await page.locator('#ob-done-btn').click();

    // Onboarding is hidden, app is visible
    await expect(page.locator('#onboarding')).toBeHidden();
    await expect(page.locator('#app')).toBeVisible();
  });
});

test.describe('Prayer Times tab', () => {
  test.beforeEach(async ({ page }) => {
    // Complete onboarding first
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('shows prayer list with 5 prayers', async ({ page }) => {
    const prayerList = page.locator('#prayer-list li');
    // At least 5 prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) + possibly tomorrow Fajr
    const count = await prayerList.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('shows inline countdown in prayer list', async ({ page }) => {
    // Countdown is displayed inline within the next prayer row
    await expect(page.locator('#inline-countdown')).toBeAttached();
  });

  test('shows city name', async ({ page }) => {
    const cityName = page.locator('#city-name');
    await expect(cityName).toBeVisible();
    await expect(cityName).not.toBeEmpty();
  });
});

test.describe('Reload button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('reload FAB is visible', async ({ page }) => {
    await expect(page.locator('#reload-fab')).toBeVisible();
  });
});

test.describe('Navigation tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#ob-lang-next').click();
    await page.locator('#ob-city-select').selectOption({ index: 0 });
    await page.locator('#ob-city-next').click();
    await page.locator('#ob-done-btn').click();
  });

  test('three navigation buttons are visible', async ({ page }) => {
    await expect(page.locator('#nav-prayers')).toBeVisible();
    await expect(page.locator('#nav-qibla')).toBeVisible();
    await expect(page.locator('#nav-settings')).toBeVisible();
  });

  test('prayer times tab is active by default', async ({ page }) => {
    await expect(page.locator('#nav-prayers')).toHaveClass(/active/);
    await expect(page.locator('#view-prayers')).toBeVisible();
  });

  test('can switch to Qibla tab', async ({ page }) => {
    await page.locator('#nav-qibla').click();

    await expect(page.locator('#nav-qibla')).toHaveClass(/active/);
    await expect(page.locator('#view-qibla')).toBeVisible();
    await expect(page.locator('#view-prayers')).toBeHidden();

    // Qibla compass is present
    await expect(page.locator('#compass-svg')).toBeVisible();
  });

  test('can switch to Settings tab', async ({ page }) => {
    await page.locator('#nav-settings').click();

    await expect(page.locator('#nav-settings')).toHaveClass(/active/);
    await expect(page.locator('#view-settings')).toBeVisible();
    await expect(page.locator('#view-prayers')).toBeHidden();

    // Settings has city select and language select
    await expect(page.locator('#s-city-select')).toBeVisible();
    await expect(page.locator('#s-lang-select')).toBeVisible();
  });

  test('no theme selector in settings', async ({ page }) => {
    await page.locator('#nav-settings').click();
    await expect(page.locator('#s-theme-select')).toHaveCount(0);
  });
});
