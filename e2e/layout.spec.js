import { test, expect } from '@playwright/test';
import { mockPublicContent } from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test('the installed iOS shell extends the app color behind the status bar', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');

  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBackground).toBe('rgb(102, 126, 234)');
});

test('exposes a valid standalone web app manifest', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon-180.png');

  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();

  const manifest = await response.json();
  expect(manifest.name).toBe('Sound Pad - Comunicazione CAA');
  expect(manifest.short_name).toBe('Sound Pad');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#667eea');
  expect(manifest.background_color).toBe('#667eea');

  const icons = manifest.icons.map((icon) => icon.sizes);
  expect(icons).toContain('192x192');
  expect(icons).toContain('512x512');
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBeTruthy();

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(icon.src);
    expect(iconResponse.ok(), `${icon.src} should be reachable`).toBeTruthy();
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }
});

test('Info and Accedi do not cover the mode title on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');

  const title = page.getByRole('heading', { name: 'Scegli Modalità' });
  const authArea = page.locator('.auth-area');
  await expect(title).toBeVisible();
  await expect(authArea).toBeVisible();

  const titleBox = await title.boundingBox();
  const authBox = await authArea.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(authBox).not.toBeNull();
  expect(titleBox.y).toBeGreaterThanOrEqual(authBox.y + authBox.height);
});

test('card mode keeps consistent vertical spacing and a 5% UI scale', async ({ page }) => {
  await page.goto('/animals');
  await expect(page.locator('.item-button.primary')).toBeVisible();
  await page.waitForTimeout(400); // let the card enter transition finish

  const layout = await page.evaluate(() => {
    const rect = (selector) =>
      document.querySelector(selector)?.getBoundingClientRect();

    const buttons = rect('.center-btns');
    const progress = rect('.progress-container');
    const item = rect('.item-button.primary');
    const board = rect('.soundboard');

    return {
      zoom: getComputedStyle(document.querySelector('.soundboard')).zoom,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      gapAfterButtons: progress.top - buttons.bottom,
      gapBeforeCard: item.top - progress.bottom,
      gapAtBottom: board.bottom - item.bottom,
    };
  });

  expect(Number.parseFloat(layout.zoom)).toBeCloseTo(1.05, 2);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.gapAfterButtons).toBeGreaterThan(0);
  expect(layout.gapBeforeCard).toBeGreaterThan(0);
  expect(layout.gapAtBottom).toBeGreaterThan(0);
  expect(layout.gapBeforeCard).toBeCloseTo(layout.gapAfterButtons, 0);
  expect(layout.gapAtBottom).toBeCloseTo(layout.gapAfterButtons, 0);
});

test('card lift is limited to hover-capable pointers', async ({ page }) => {
  await page.goto('/');

  const card = page.locator('.card').first();
  await expect(card).toBeVisible();

  const supportsHover = await page.evaluate(
    () => matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  await card.hover();
  await page.waitForTimeout(250);

  const transform = await card.evaluate((element) => getComputedStyle(element).transform);
  if (supportsHover) {
    expect(transform).not.toBe('none');
  } else {
    expect(transform).toBe('none');
  }
});

test('page backgrounds stay uniform during overscroll', async ({ page }) => {
  for (const path of ['/', '/home', '/animals', '/gameshub', '/stories', '/info']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const background = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('main'));
      return {
        color: style.backgroundColor,
        image: style.backgroundImage,
      };
    });

    expect(background.color, `${path} background color`).toBe('rgb(102, 126, 234)');
    expect(background.image, `${path} background image`).toBe('none');
  }
});

test('the app shell allows native document scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();

  const shell = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const main = getComputedStyle(document.querySelector('main'));

    return {
      htmlPosition: html.position,
      bodyPosition: body.position,
      bodyOverflowY: body.overflowY,
      mainOverflowY: main.overflowY,
      scrollingElement: document.scrollingElement?.tagName,
    };
  });

  expect(shell.htmlPosition).toBe('static');
  expect(shell.bodyPosition).toBe('static');
  expect(shell.bodyOverflowY).not.toBe('hidden');
  expect(shell.mainOverflowY).toBe('visible');
  expect(shell.scrollingElement).toBe('HTML');
});

test('home scrolls the document instead of an inner viewport', async ({ page }) => {
  await page.goto('/home');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.grid .card').first()).toBeVisible();

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(scrollHeight).toBeGreaterThan(viewportHeight);

  await page.evaluate(() => window.scrollTo(0, 200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const scroll = await page.evaluate(() => ({
    documentTop: document.documentElement.scrollTop,
    mainTop: document.querySelector('main').scrollTop,
  }));
  expect(scroll.documentTop).toBeGreaterThan(0);
  expect(scroll.mainTop).toBe(0);
});
