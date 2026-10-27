// Supabase client - uses the global `supabase` loaded via CDN in index.html
// Environment variables are injected by @rollup/plugin-replace at build time
import Cookies from "js-cookie";
const SUPABASE_URL = __SUPABASE_URL__;
const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__;
const DOMAIN = __DOMAIN__;

let client = null;

/**
 * The cookie domain has to match the host we are actually served from.
 * A production build (DOMAIN=.antoniogiordano.dev) served on localhost would
 * otherwise get every cookie rejected by the browser, silently losing the
 * session right after a successful login.
 */
function getCookieDomain() {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  const configured = String(DOMAIN || "").replace(/^\./, "");
  if (!configured) return undefined;
  if (host === configured || host.endsWith(`.${configured}`)) return configured;
  return undefined;
}

function isSecureContext() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function writeOptions() {
  const options = {
    path: "/",
    sameSite: "Lax",
    secure: isSecureContext(),
    expires: 30,
  };
  const domain = getCookieDomain();
  if (domain) options.domain = domain;
  return options;
}

function removeOptions() {
  const options = { path: "/" };
  const domain = getCookieDomain();
  if (domain) options.domain = domain;
  return options;
}

const cookieStorage = {
  getItem: (key) => {
    const value = Cookies.get(key);
    return value === undefined ? null : value;
  },
  setItem: (key, value) => {
    Cookies.set(key, value, writeOptions());
  },
  removeItem: (key) => {
    Cookies.remove(key, removeOptions());
  },
};

export function getSupabase() {
  if (client) return client;

  if (typeof window !== "undefined" && window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: cookieStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
