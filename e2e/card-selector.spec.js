import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, TEST_USER } from './helpers/supabase-mock.js';

const categoryId = 'b6bbbe43-4f4d-4e70-bc18-530591997121';
const remoteCategories = [
  {
    id: categoryId,
    user_id: TEST_USER.id,
    name: 'Categoria Supabase',
    emoji: '☁️',
    created_at: new Date().toISOString(),
    user_cards: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Card Supabase',
        category_id: categoryId,
        image_url: '/animals/lion.svg',
        sound_url: '/sounds/lion.wav',
        created_at: new Date().toISOString(),
      },
    ],
  },
];

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.fill('input[type=email]', TEST_USER.email);
  await page.fill('input[type=password]', 'valid-password');
  await page.locator('.submit-btn').click();
  await expect(page.locator('[data-tooltip="Account"]')).toBeVisible();
}

async function openSelector(page) {
  await page.locator('.palette-btn[title="Seleziona card"]').click();
  await expect(page.getByRole('heading', { name: 'Seleziona Card' })).toBeVisible();
}

test.describe('card selector Supabase categories', () => {
  test('loads remote categories when auth finishes after the selector is opened', async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.route('**/rest/v1/user_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(remoteCategories),
      })
    );
    await signIn(page);

    // Rende deterministico il caso reale: il selettore viene aperto mentre
    // initAuth() sta ancora ripristinando la sessione dal cookie.
    await page.addInitScript(() => {
      let supabaseGlobal;
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        get: () => supabaseGlobal,
        set: (value) => {
          const createClient = value.createClient.bind(value);
          value.createClient = (...args) => {
            const client = createClient(...args);
            const getSession = client.auth.getSession.bind(client.auth);
            client.auth.getSession = async (...sessionArgs) => {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              return getSession(...sessionArgs);
            };
            return client;
          };
          supabaseGlobal = value;
        },
      });
    });

    await page.goto('/animals');
    await openSelector(page);

    const remoteCategory = page.locator('.category-header', { hasText: 'Categoria Supabase' });
    await expect(remoteCategory).toBeVisible();
    await remoteCategory.click();
    await expect(page.locator('.item-row', { hasText: 'Card Supabase' })).toBeVisible();
  });

  test('retries a failed fetch and restores item names from the cache', async ({ page }) => {
    await mockSupabaseAuth(page);
    let requests = 0;
    await page.route('**/rest/v1/user_categories**', (route) => {
      requests += 1;
      if (requests === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'temporary error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(remoteCategories),
      });
    });
    await signIn(page);

    // Una cache vuota prodotta dalla versione precedente non deve bloccare il recupero.
    await page.evaluate((userId) => {
      localStorage.setItem(
        `soundpad:db-cache:v1:selector:${userId}`,
        JSON.stringify({ ts: Date.now(), data: [] })
      );
    }, TEST_USER.id);
    await page.goto('/animals');

    const firstResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/rest/v1/user_categories')
    );
    await openSelector(page);
    const firstResponse = await firstResponsePromise;
    await firstResponse.finished();
    await page.locator('.close-btn').click();

    // L'errore non deve essere conservato come elenco vuoto: si riprova.
    await openSelector(page);
    const remoteCategory = page.locator('.category-header', { hasText: 'Categoria Supabase' });
    await expect(remoteCategory).toBeVisible();
    expect(requests).toBe(2);
    await page.locator('.close-btn').click();

    // Alla riapertura si usa la cache JSON, che non contiene funzioni.
    await openSelector(page);
    await expect(remoteCategory).toBeVisible();
    await remoteCategory.click();
    await expect(page.locator('.item-row', { hasText: 'Card Supabase' })).toBeVisible();
    expect(requests).toBe(2);
  });
});
