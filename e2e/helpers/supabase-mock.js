/**
 * Helpers to run the auth flows deterministically without real credentials.
 * Supabase Auth / PostgREST calls are intercepted at the network level, so the
 * app still exercises its real client code (session storage, event listeners,
 * cookie persistence) — only the backend responses are faked.
 */

export const TEST_USER = {
  id: '3f2a6c1e-9b7d-4a55-8c21-2e6d0f4b8a11',
  email: 'e2e.tester@example.com',
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function buildFakeJwt({ expiresInSeconds = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'supabase',
    sub: TEST_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: TEST_USER.email,
    iat: now,
    exp: now + expiresInSeconds,
    session_id: 'e2e-session',
  };
  return `${base64url(header)}.${base64url(payload)}.e2e-signature`;
}

export function buildSession({ expiresInSeconds = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  return {
    access_token: buildFakeJwt({ expiresInSeconds }),
    token_type: 'bearer',
    expires_in: expiresInSeconds,
    expires_at: now + expiresInSeconds,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: TEST_USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: TEST_USER.email,
      email_confirmed_at: iso,
      confirmed_at: iso,
      phone: '',
      last_sign_in_at: iso,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { email: TEST_USER.email },
      identities: [],
      created_at: iso,
      updated_at: iso,
      is_anonymous: false,
    },
  };
}

/** Public card content shipped by scripts/seed-public-card-content.js. */
export const PUBLIC_CATEGORIES = [
  { id: '11111111-1111-4111-8111-111111111111', slug: 'animals', name: 'Animali', emoji: '🦁', sort_order: 0 },
  { id: '22222222-2222-4222-8222-222222222222', slug: 'work', name: 'Lavoro', emoji: '🔨', sort_order: 1 },
  { id: '33333333-3333-4333-8333-333333333333', slug: 'people', name: 'Persone', emoji: '👨‍👩‍👧‍👦', sort_order: 2 },
  { id: '44444444-4444-4444-8444-444444444444', slug: 'vehicles', name: 'Mezzi di trasporto', emoji: '🚗', sort_order: 3 },
  { id: '55555555-5555-4555-8555-555555555555', slug: 'games', name: 'Giochi', emoji: '🎮', sort_order: 4 },
  { id: '66666666-6666-4666-8666-666666666666', slug: 'music', name: 'Musica', emoji: '🎵', sort_order: 5 },
  { id: '77777777-7777-4777-8777-777777777777', slug: 'sentences', name: 'Frasi', emoji: '💬', sort_order: 6 },
  { id: '88888888-8888-4888-8888-888888888888', slug: 'instruments', name: 'Strumenti', emoji: '🎺', sort_order: 7 },
].map((category, index) => ({
  ...category,
  created_at: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
}));

/**
 * Two cards per category: the sound quiz needs at least two playable cards to
 * build a forced-choice round. Names stay distinct so the options are unique.
 */
export const PUBLIC_CARDS = PUBLIC_CATEGORIES.flatMap((category, index) =>
  [0, 1].map((variant) => ({
    id: `99999999-9999-4999-8999-9999999999${String(index * 2 + variant).padStart(2, '0')}`,
    category_id: category.id,
    name: variant === 0 ? `Card ${category.name}` : `Card ${category.name} 2`,
    image_url: variant === 0 ? '/animals-nocircle/lion.svg' : '/animals-nocircle/elephant.svg',
    sound_url: variant === 0 ? 'synth:pianoforte' : 'synth:xilofono',
    created_at: new Date(Date.UTC(2026, 0, 1, index, variant)).toISOString(),
  }))
);

/** Intercept the public categories/cards queries made on every app start. */
export async function mockPublicContent(page) {
  await page.route('**/rest/v1/soundpad_public_categories**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_CATEGORIES),
    })
  );
  await page.route('**/rest/v1/soundpad_public_cards**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_CARDS),
    })
  );
}

/** Intercept every Supabase call the app may make while signing in. */
export async function mockSupabaseAuth(page) {
  const session = buildSession();

  await mockPublicContent(page);

  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) })
  );

  await page.route('**/auth/v1/logout**', (route) =>
    route.fulfill({ status: 204, body: '' })
  );

  // `.maybeSingle()` maps the PGRST116 "no rows" response to `data: null`.
  await page.route('**/rest/v1/user_confs**', (route) =>
    route.fulfill({
      status: 406,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PGRST116',
        details: 'The result contains 0 rows',
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      }),
    })
  );

  await page.route('**/rest/v1/user_categories**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  return session;
}

/** Read the Supabase auth cookie out of the browser context. */
export async function getAuthCookie(context) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
}
