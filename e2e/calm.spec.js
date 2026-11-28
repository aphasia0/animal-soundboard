import { test, expect } from '@playwright/test';
import { mockPublicContent } from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test('opens from mode select', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Calma/ }).click();

  await expect(page).toHaveURL(/\/calma$/);
  await expect(page.getByRole('heading', { name: /Calma/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inizia la musica calma' })).toBeVisible();
  await expect(page.getByRole('button', { name: '5 min' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Scegli Modalità' })).toBeVisible();
});

test('starts the ambient session and synthesizes notes', async ({ page }) => {
  await page.addInitScript(() => {
    window.__oscillators = 0;
    const Context = window.AudioContext || window.webkitAudioContext;
    const createOscillator = Context.prototype.createOscillator;
    Context.prototype.createOscillator = function patched(...args) {
      window.__oscillators += 1;
      return createOscillator.apply(this, args);
    };
  });

  await page.goto('/calma');
  await page.getByRole('button', { name: '3 min' }).click();
  await page.getByRole('button', { name: 'Inizia la musica calma' }).click();

  await expect(page.locator('.calm')).toHaveClass(/calm-running/);
  await expect(page.locator('.countdown')).not.toHaveText('∞');

  const oscillators = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return window.__oscillators;
  });
  expect(oscillators).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Ferma la musica' }).click();
  await expect(page.getByRole('heading', { name: 'Bravo' })).toBeVisible();
});

test('duration pills select the session length', async ({ page }) => {
  await page.goto('/calma');

  await page.getByRole('button', { name: '10 min' }).click();
  await expect(page.getByRole('button', { name: '10 min' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '∞' }).click();
  await expect(page.getByRole('button', { name: '∞' })).toHaveAttribute('aria-pressed', 'true');
});

test('exposes search metadata for the calm mode', async ({ page }) => {
  await page.goto('/calma');
  await expect(page).toHaveTitle(/Calma/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://soundpad.antoniogiordano.dev/calma',
  );
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toMatch(/rilassante/i);

  const sitemap = await page.request.get('/sitemap.txt');
  expect(await sitemap.text()).toContain('https://soundpad.antoniogiordano.dev/calma');
});

test('fits the viewport without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/calma');
  await expect(page.getByRole('button', { name: 'Inizia la musica calma' })).toBeVisible();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
