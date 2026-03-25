// Supabase client - uses the global `supabase` loaded via CDN in index.html
// Environment variables are injected by @rollup/plugin-replace at build time
import Cookies from "js-cookie";
const SUPABASE_URL = __SUPABASE_URL__;
const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__;
const DOMAIN = __DOMAIN__;

let client = null;

export function getSupabase() {
  if (client) return client;

  if (typeof window !== "undefined" && window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: (key) => {
            const value = Cookies.get(key);
            console.log(`Value retrieved: ${value}`);
            // Se non c'è, restituisci esplicitamente null, non undefined
            return value === undefined ? null : value;
          },
          setItem: (key, value) => {
            Cookies.set(key, value, {
              domain: DOMAIN || undefined,
              path: "/",
              sameSite: "Lax",
              secure: true,
            });
          },
          removeItem: (key) => {
            Cookies.remove(key, {
              domain: DOMAIN || undefined,
              path: "/",
            });
          },
        },
      },
    });
  }
  return client;
}
