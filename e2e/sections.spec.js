import { test, expect } from '@playwright/test';

test.describe('stories', () => {
  test('lists stories and opens one', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Cantastorie/ }).click();

    await expect(page).toHaveURL(/\/stories$/);
    await expect(page.getByRole('heading', { name: /Cantastorie/ })).toBeVisible();

    const stories = page.locator('.grid .card');
    await expect(stories.first()).toBeVisible();
    expect(await stories.count()).toBeGreaterThan(0);

    await stories.first().click();
    await expect(page.locator('.story-container')).toBeVisible();
    await expect(page.locator('.text-overlay p')).not.toBeEmpty();

    await page.locator('.story-container .back-button').click();
    await expect(page.getByRole('heading', { name: /Cantastorie/ })).toBeVisible();
  });
});

test.describe('games hub', () => {
  test('lists games and starts "Tocca la Scatola"', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Giochi/ }).click();

    await expect(page).toHaveURL(/\/gameshub$/);
    await expect(page.getByRole('heading', { name: 'Giochi' })).toBeVisible();

    const games = page.locator('.grid .card');
    expect(await games.count()).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Tocca la Scatola/ }).click();
    await expect(page.getByText(/Livello 1\/10/)).toBeVisible();

    await page.locator('.back-btn').click();
    await expect(page.getByRole('heading', { name: 'Giochi' })).toBeVisible();
  });
});

test.describe('info view', () => {
  test('opens from mode select and goes back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Info' }).click();

    await expect(page).toHaveURL(/\/info$/);
    await expect(page.getByRole('heading', { name: 'Sound Pad', level: 1 })).toBeVisible();

    // Build info is injected at build time and always visible.
    const buildRow = page.locator('.version-row', { hasText: 'Build' });
    await expect(buildRow).toBeVisible();
    await expect(buildRow.locator('.value')).toHaveText(/\d{4}/);

    await page.locator('.back-button').click();
    await expect(page.getByRole('heading', { name: 'Scegli Modalità' })).toBeVisible();
  });
});
