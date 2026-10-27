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

/** Intercept every Supabase call the app may make while signing in. */
export async function mockSupabaseAuth(page) {
  const session = buildSession();

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
