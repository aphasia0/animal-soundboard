import { test, expect } from '@playwright/test';
import { mockPublicContent } from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test('opens from mode select and lists playable categories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Ascolta e indovina/ }).click();

  await expect(page).toHaveURL(/\/ascolta$/);
  await expect(page.getByRole('heading', { name: /Ascolta e indovina/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animali/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tutte/ })).toBeVisible();
});

test('a round shows two options and the correct answer advances', async ({ page }) => {
  await page.goto('/ascolta');
  await page.getByRole('button', { name: /Animali/ }).click();

  await expect(page.locator('.option')).toHaveCount(2);
  await expect(page.locator('.option[data-correct="true"]')).toHaveCount(1);
  await expect(page.locator('.option[data-correct="false"]')).toHaveCount(1);

  await page.locator('.option[data-correct="true"]').click();
  await expect(page.locator('.option-correct')).toBeVisible();
  await expect(page.locator('.score-value')).toHaveText('1');

  // Il round successivo ripropone due opzioni.
  await expect(page.locator('.option')).toHaveCount(2);
});

test('ends after the planned rounds and shows the result', async ({ page }) => {
  await page.goto('/ascolta');
  await page.getByRole('button', { name: /Animali/ }).click();

  for (let round = 0; round < 2; round++) {
    await page.locator('.option[data-correct="true"]').click();
    await page.waitForTimeout(1400);
  }

  await expect(page.locator('.done-panel')).toBeVisible();
  await expect(page.locator('.done-title')).toHaveText('2 su 2!');

  await page.getByRole('button', { name: 'Categorie' }).click();
  await expect(page.getByRole('button', { name: /Animali/ })).toBeVisible();
});

test('a wrong answer keeps the round open and hints after two tries', async ({ page }) => {
  await page.goto('/ascolta');
  await page.getByRole('button', { name: /Animali/ }).click();

  const wrong = page.locator('.option[data-correct="false"]');
  await wrong.click();

  await expect(page.locator('.option')).toHaveCount(2);
  await expect(page.locator('.option-hint')).toHaveCount(0);

  await wrong.click();
  await expect(page.locator('.option[data-correct="true"].option-hint')).toBeVisible();
});

test('repeats the sound and returns to the modes', async ({ page }) => {
  await page.goto('/ascolta');
  await page.getByRole('button', { name: /Animali/ }).click();

  await expect(page.getByRole('button', { name: 'Ripeti il suono' })).toBeVisible();
  await page.getByRole('button', { name: 'Ripeti il suono' }).click();

  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Scegli Modalità' })).toBeVisible();
});

test('exposes search metadata for the quiz', async ({ page }) => {
  await page.goto('/ascolta');
  await expect(page).toHaveTitle(/Ascolta e indovina/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://soundpad.antoniogiordano.dev/ascolta',
  );
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toMatch(/ascolto/i);

  const sitemap = await page.request.get('/sitemap.txt');
  expect(await sitemap.text()).toContain('https://soundpad.antoniogiordano.dev/ascolta');
});

test('fits the viewport without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ascolta');
  await expect(page.getByRole('button', { name: /Animali/ })).toBeVisible();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
