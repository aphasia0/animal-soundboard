import { test, expect } from '@playwright/test';
import { mockPublicContent } from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test('opens from mode select and shows the 24-step grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /La Banda/ }).click();

  await expect(page).toHaveURL(/\/band$/);
  await expect(page.getByRole('heading', { name: /La Banda/ })).toBeVisible();
  await expect(page.locator('.lane')).toHaveCount(4);
  await expect(page.locator('.step')).toHaveCount(24);
  await expect(page.locator('.step[data-track="drums"][data-step="0"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Scegli Modalità' })).toBeVisible();
});

test('deep link /band works', async ({ page }) => {
  await page.goto('/band');
  await expect(page.getByRole('heading', { name: /La Banda/ })).toBeVisible();
  await expect(page.locator('.step')).toHaveCount(24);
});

test('tapping a cell toggles the step on and off', async ({ page }) => {
  await page.goto('/band');
  const cell = page.locator('.step[data-track="melody"][data-step="2"]');

  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(cell).toHaveClass(/step-on/);

  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
});

test('the transport starts, moves the playhead and stops', async ({ page }) => {
  await page.goto('/band');
  await page.locator('.step[data-track="drums"][data-step="0"]').click();

  await page.getByRole('button', { name: 'Suona la banda' }).click();
  await expect(page.locator('.play-button')).toHaveClass(/play-active/);

  const seen = await page.evaluate(async () => {
    const steps = new Set();
    const start = performance.now();
    while (performance.now() - start < 1000) {
      const head = document.querySelector('.step-head');
      if (head) steps.add(head.dataset.step);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return [...steps];
  });
  expect(seen.length).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Ferma la banda' }).click();
  await expect(page.locator('.play-button')).not.toHaveClass(/play-active/);
  await expect(page.locator('.step-head')).toHaveCount(0);
});

test('the loop actually synthesizes notes', async ({ page }) => {
  await page.addInitScript(() => {
    window.__oscillators = 0;
    const Context = window.AudioContext || window.webkitAudioContext;
    const createOscillator = Context.prototype.createOscillator;
    Context.prototype.createOscillator = function patched(...args) {
      window.__oscillators += 1;
      return createOscillator.apply(this, args);
    };
  });

  await page.goto('/band');
  await page.locator('.step[data-track="drums"][data-step="0"]').click();
  await page.getByRole('button', { name: 'Suona la banda' }).click();

  const playing = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return window.__oscillators;
  });
  expect(playing).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Ferma la banda' }).click();
  const afterStop = await page.evaluate(async () => {
    const before = window.__oscillators;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return window.__oscillators - before;
  });
  expect(afterStop).toBe(0);
});

test('tempo and mute controls toggle', async ({ page }) => {
  await page.goto('/band');

  await expect(page.getByRole('button', { name: 'Normale' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Veloce' }).click();
  await expect(page.getByRole('button', { name: 'Veloce' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Normale' })).toHaveAttribute('aria-pressed', 'false');

  const mute = page.getByRole('button', { name: 'Silenzia Batteria' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lane').first()).toHaveClass(/lane-muted/);
});

test('clear removes every active step', async ({ page }) => {
  await page.goto('/band');

  await page.locator('.step[data-track="drums"][data-step="0"]').click();
  await page.locator('.step[data-track="bass"][data-step="4"]').click();
  await expect(page.locator('.step-on')).toHaveCount(2);

  await page.getByRole('button', { name: 'Cancella tutto' }).click();
  await expect(page.locator('.step-on')).toHaveCount(0);
});

test('shuffle fills the grid and always gives the drums a hit', async ({ page }) => {
  await page.goto('/band');
  await expect(page.locator('.step-on')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mescola la griglia' }).click();

  const total = await page.locator('.step-on').count();
  expect(total).toBeGreaterThan(0);
  const drums = await page.locator('.step[data-track="drums"][aria-pressed="true"]').count();
  expect(drums).toBeGreaterThan(0);
});

test('exposes page metadata and crawler files for search engines', async ({ page }) => {
  await page.goto('/band');
  await expect(page).toHaveTitle(/La Banda/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://soundpad.antoniogiordano.dev/band',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://soundpad.antoniogiordano.dev/band',
  );
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toMatch(/musicale/i);

  const sitemap = await page.request.get('/sitemap.txt');
  expect(await sitemap.text()).toContain('https://soundpad.antoniogiordano.dev/band');

  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain(
    'Sitemap: https://soundpad.antoniogiordano.dev/sitemap.txt',
  );

  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page).toHaveTitle(/AAC/);
});

test('the grid fits the viewport without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/band');
  await expect(page.locator('.step').first()).toBeVisible();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
