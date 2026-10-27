import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, getAuthCookie, TEST_USER } from './helpers/supabase-mock.js';

test.describe('auth modal', () => {
  test('opens, switches to registration and closes', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Accedi' }).click();
    const modal = page.locator('.modal');
    await expect(modal.getByRole('heading', { name: 'Accedi' })).toBeVisible();

    await modal.getByRole('button', { name: /Non hai un account/ }).click();
    await expect(modal.getByRole('heading', { name: 'Registrati' })).toBeVisible();

    await modal.getByRole('button', { name: '✕' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('shows the backend error for wrong credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await page.fill('input[type=email]', 'definitely-not-a-user@example.com');
    await page.fill('input[type=password]', 'wrongpassword123');
    await page.locator('.submit-btn').click();

    await expect(page.locator('.error')).toHaveText(/invalid login credentials/i);
  });
});

test.describe('login session', () => {
  test('successful login persists across reload and can log out', async ({ page, context }) => {
    await mockSupabaseAuth(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.fill('input[type=email]', TEST_USER.email);
    await page.fill('input[type=password]', 'valid-password');
    await page.locator('.submit-btn').click();

    // Modal closes and the header switches to the account avatar.
    await expect(page.locator('.modal')).toHaveCount(0);
    const accountButton = page.locator('[data-tooltip="Account"]');
    await expect(accountButton).toBeVisible();

    // The session is stored in a cookie, so it must survive a reload.
    // The cookie must be host-only on localhost: the production build sets
    // DOMAIN=.antoniogiordano.dev, which browsers reject on localhost.
    const cookie = await getAuthCookie(context);
    expect(cookie, 'supabase auth cookie should be written').toBeTruthy();
    expect(cookie.domain).toBe('localhost');

    await page.reload();
    await expect(page.locator('[data-tooltip="Account"]')).toBeVisible();

    // Log out.
    await page.locator('[data-tooltip="Account"]').click();
    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
    expect(await getAuthCookie(context)).toBeFalsy();
  });
});
