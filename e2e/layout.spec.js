import { test, expect } from '@playwright/test';
import { mockPublicContent } from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test('the app shell allows native document scrolling', async ({ page }) => {
  await page.goto('/');

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
