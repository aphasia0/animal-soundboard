import { test, expect } from '@playwright/test';
import {
  mockPublicContent,
  PUBLIC_CARDS,
  PUBLIC_CATEGORIES,
} from './helpers/supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await mockPublicContent(page);
});

test.describe('mode select', () => {
  test('renders all seven modes', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Scegli Modalità' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Una Card/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Due Card/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cantastorie/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /La Banda/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ascolta e indovina/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Calma/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Giochi/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
  });
});

test.describe('single card mode', () => {
  test('mode select → home → animals → back home', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Una Card/ }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Sound Pad' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Animali/ })).toBeVisible();

    await page.getByRole('button', { name: /Animali/ }).click();
    await expect(page).toHaveURL(/\/animals$/);

    const card = page.locator('.item-button.primary');
    await expect(card).toBeVisible();
    await expect(page.locator('.item-name').first()).not.toBeEmpty();

    await page.locator('.palette-btn[title="Indietro"]').click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('every category opens its own card deck', async ({ page }) => {
    await page.goto('/home');

    const categories = [
      { name: /Animali/, url: '/animals' },
      { name: /Lavoro/, url: '/work' },
      { name: /Persone/, url: '/people' },
      { name: /Mezzi di trasporto/, url: '/vehicles' },
      { name: /Giochi/, url: '/games' },
      { name: /Musica/, url: '/music' },
      { name: /Frasi/, url: '/sentences' },
      { name: /Strumenti/, url: '/instruments' },
    ];

    for (const category of categories) {
      await page.goto('/home');
      await page.getByRole('button', { name: category.name }).click();
      await expect(page).toHaveURL(new RegExp(`${category.url}$`));
      await expect(page.locator('.item-button.primary')).toBeVisible();
    }
  });
  test('random category opens the giant deck', async ({ page }) => {
    await page.goto('/home');

    const randomCard = page.locator('.random-card');
    await expect(randomCard).toBeVisible();
    await expect(randomCard.locator('.random-preview .random-thumb')).toHaveCount(4);

    await randomCard.click();
    await expect(page).toHaveURL(/\/random$/);
    await expect(page.locator('.item-button.primary')).toBeVisible();
  });
});

test.describe('dual card mode', () => {
  test('shows two independent cards', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Due Card/ }).click();

    await expect(page).toHaveURL(/\/home$/);
    await page.getByRole('button', { name: /Animali/ }).click();
    await expect(page).toHaveURL(/\/animals$/);

    await expect(page.locator('.item-button.primary')).toBeVisible();
    await expect(page.locator('.item-button.secondary')).toBeVisible();
  });
});

test.describe('deep links and history', () => {
  test('direct URL opens the right view', async ({ page }) => {
    await page.goto('/animals');

    await expect(page).toHaveURL(/\/animals$/);
    await expect(page.locator('.item-button.primary')).toBeVisible();
  });

  test('browser back restores the previous view', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Una Card/ }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole('button', { name: /Animali/ }).click();
    await expect(page).toHaveURL(/\/animals$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Sound Pad' })).toBeVisible();
  });

  test('public category with slug opens from /:slug', async ({ page }) => {
    const verbCategory = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      slug: 'verbi',
      name: 'Verbi',
      emoji: '🏃',
      sort_order: 8,
      created_at: new Date().toISOString(),
    };
    const verbCard = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      category_id: verbCategory.id,
      name: 'Correre',
      image_url: '/animals-nocircle/lion.svg',
      sound_url: 'synth:pianoforte',
      created_at: new Date().toISOString(),
    };
    await page.route('**/rest/v1/soundpad_public_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...PUBLIC_CATEGORIES, verbCategory]),
      })
    );
    await page.route('**/rest/v1/soundpad_public_cards**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...PUBLIC_CARDS, verbCard]),
      })
    );

    await page.goto('/verbi');
    await expect(page.locator('.item-name')).toHaveText('Correre');
    await page.reload();
    await expect(page.locator('.item-name')).toHaveText('Correre');
  });

  test('public category without slug opens from /category/:id', async ({ page }) => {
    const verbCategory = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      slug: null,
      name: 'Verbi',
      emoji: '🏃',
      sort_order: 8,
      created_at: new Date().toISOString(),
    };
    const verbCard = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      category_id: verbCategory.id,
      name: 'Correre',
      image_url: '/animals-nocircle/lion.svg',
      sound_url: 'synth:pianoforte',
      created_at: new Date().toISOString(),
    };
    await page.route('**/rest/v1/soundpad_public_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...PUBLIC_CATEGORIES, verbCategory]),
      })
    );
    await page.route('**/rest/v1/soundpad_public_cards**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...PUBLIC_CARDS, verbCard]),
      })
    );

    // Le categorie migrate da user_categories non hanno slug: l'UUID deve
    // comunque risolvere la categoria pubblica e non quella personale.
    await page.goto(`/category/${verbCategory.id}`);
    await expect(page.locator('.item-name')).toHaveText('Correre');

    await page.locator('.palette-btn[title="Indietro"]').click();
    await expect(page.getByRole('button', { name: /Verbi/ })).toBeVisible();
  });
});
