import { test, expect } from '@playwright/test';

// Main public pages. Each test clicks the way a visitor would, so a broken
// link, button or page shows up in CI before it ships.

test('home page loads with the call button and Book Now @mobile', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Wont Stop Moving/i);
  await expect(page.locator('header a[href="tel:+18887416683"]:visible').first()).toBeVisible();
  // On phones, Book Now and the full call button live in the menu.
  if (isMobile) await page.locator('header button:has(svg.lucide-menu)').click();
  await expect(page.getByRole('link', { name: /book now/i }).locator('visible=true').first()).toBeVisible();
});

test('Find Movers in the nav opens the mover search', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Find Movers' }).first().click();
  await expect(page).toHaveURL(/\/movers/);
  await expect(page.getByRole('heading', { name: /find your moving crew/i })).toBeVisible();
});

test('quote form: step 1 validates, then moves on to move size', async ({ page }) => {
  await page.goto('/quote');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Invalid Zip').first()).toBeVisible();
  await page.getByPlaceholder('e.g. 75201').fill('94110');
  await page.getByPlaceholder('e.g. 10001').fill('94607');
  await page.getByLabel('Move Date').fill('2030-06-15');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'What are we moving?' })).toBeVisible();
});

test('marketplace address search returns an answer @mobile', async ({ page }) => {
  await page.goto('/marketplace');
  await page.getByLabel('Your address').fill('San Francisco, CA');
  await page.getByRole('button', { name: /show providers/i }).click();
  await expect(page.getByText(/(provider|providers) near|No providers within/i)).toBeVisible({ timeout: 20_000 });
});

test('login portal opens the customer sign-in form', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /customer sign in/i }).first().click();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('unknown pages show the 404 with a way home @mobile', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /this page moved out/i })).toBeVisible();
  await page.getByRole('link', { name: /back to homepage/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('contact and terms pages render', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByText('REGIONAL HEADQUARTERS')).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText(/Effective November \d+, 2026/)).toBeVisible();
});
