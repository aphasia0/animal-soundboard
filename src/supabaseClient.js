// Supabase client - uses the global `supabase` loaded via CDN in index.html
// Environment variables are injected by @rollup/plugin-replace at build time

const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

let client = null;

export function getSupabase() {

    if (client) return client;

    if (typeof window !== 'undefined' && window.supabase) {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
}
