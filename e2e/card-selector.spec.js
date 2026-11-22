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
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
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

  test('selects by id when the cached selector order differs from the cards order', async ({ page }) => {
    await mockSupabaseAuth(page);

    const cards = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Card A',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-03T00:00:00.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Card B',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Card C',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    // Il selettore restituisce A, B, C; CategoryView riceve B, C, A
    // (ordine created_at). Senza lookup per id, cliccare B apriva C.
    await page.route('**/rest/v1/user_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: categoryId,
            user_id: TEST_USER.id,
            name: 'Categoria Supabase',
            emoji: '☁️',
            created_at: '2026-01-01T00:00:00.000Z',
            user_cards: cards,
          },
        ]),
      })
    );
    await page.route('**/rest/v1/user_cards**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([cards[1], cards[2], cards[0]]),
      })
    );

    await signIn(page);

    // Cache del selettore con un ordine diverso da quello della categoria.
    await page.evaluate(
      ({ userId, categoryId, cards }) => {
        localStorage.setItem(
          `soundpad:db-cache:v1:selector:v3:${userId}`,
          JSON.stringify({
            ts: Date.now(),
            data: [
              {
                id: categoryId,
                label: 'Categoria Supabase',
                emoji: '☁️',
                items: cards.map((card) => ({
                  id: card.id,
                  image: card.image_url,
                  sound: card.sound_url,
                  name: card.name,
                })),
              },
            ],
          })
        );
      },
      { userId: TEST_USER.id, categoryId, cards }
    );

    await page.goto(`/category/${categoryId}`);
    await expect(page.locator('.item-name')).toHaveText('Card B');

    await openSelector(page);
    const cardB = page.locator('.item-row', { hasText: 'Card B' });
    await expect(cardB).toBeVisible();
    await cardB.click();

    // La card selezionata è B, non C (che sta all'indice 1 della lista API).
    await expect(page.locator('.item-name')).toHaveText('Card B');
  });

  test('ignores a stale selector card instead of selecting a neighbour', async ({ page }) => {
    await mockSupabaseAuth(page);

    const cards = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Card B',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Card C',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ];
    const staleCard = {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Card Cancellata',
      category_id: categoryId,
      image_url: '/animals-nocircle/lion.svg',
      sound_url: 'synth:pianoforte',
      created_at: '2026-01-03T00:00:00.000Z',
    };

    await page.route('**/rest/v1/user_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: categoryId,
            user_id: TEST_USER.id,
            name: 'Categoria Supabase',
            emoji: '☁️',
            created_at: '2026-01-01T00:00:00.000Z',
            user_cards: [...cards, staleCard],
          },
        ]),
      })
    );
    await page.route('**/rest/v1/user_cards**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cards),
      })
    );

    await signIn(page);

    // La cache contiene una card cancellata tra B e C.
    await page.evaluate(
      ({ userId, categoryId, items }) => {
        localStorage.setItem(
          `soundpad:db-cache:v1:selector:v3:${userId}`,
          JSON.stringify({
            ts: Date.now(),
            data: [
              {
                id: categoryId,
                label: 'Categoria Supabase',
                emoji: '☁️',
                items,
              },
            ],
          })
        );
      },
      {
        userId: TEST_USER.id,
        categoryId,
        items: [
          { id: cards[0].id, name: cards[0].name, image: cards[0].image_url, sound: cards[0].sound_url },
          { id: staleCard.id, name: staleCard.name, image: staleCard.image_url, sound: staleCard.sound_url },
          { id: cards[1].id, name: cards[1].name, image: cards[1].image_url, sound: cards[1].sound_url },
        ],
      }
    );

    await page.goto(`/category/${categoryId}`);
    await expect(page.locator('.item-name')).toHaveText('Card B');

    await openSelector(page);
    await page.locator('.item-row', { hasText: 'Card Cancellata' }).click();

    // Non deve cadere sull'indice 1 (Card C) solo perché l'id non esiste più.
    await expect(page.locator('.item-name')).toHaveText('Card B');
  });

  test('opening a card from another category selects that card, not the first one', async ({ page }) => {
    await mockSupabaseAuth(page);

    const cards = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Card A',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-03T00:00:00.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Card B',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Card C',
        category_id: categoryId,
        image_url: '/animals-nocircle/lion.svg',
        sound_url: 'synth:pianoforte',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    await page.route('**/rest/v1/user_categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: categoryId,
            user_id: TEST_USER.id,
            name: 'Categoria Supabase',
            emoji: '☁️',
            created_at: '2026-01-01T00:00:00.000Z',
            user_cards: cards,
          },
        ]),
      })
    );
    await page.route('**/rest/v1/user_cards**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([cards[1], cards[2], cards[0]]),
      })
    );

    await signIn(page);
    await page.goto('/animals');
    await openSelector(page);

    const remoteCategory = page.locator('.category-header', { hasText: 'Categoria Supabase' });
    await remoteCategory.click();
    await page.locator('.item-row', { hasText: 'Card C' }).click();

    await expect(page).toHaveURL(new RegExp(`/category/${categoryId}$`));
    await expect(page.locator('.item-name')).toHaveText('Card C');
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
