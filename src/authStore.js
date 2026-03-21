import { writable } from 'svelte/store';
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js';
import { 
    setSessionCookie, 
    getSessionCookie, 
    clearSessionCookie,
    hasSharedSession 
} from './authCookie.js';

export const user = writable(null);
export const authLoading = writable(true);

let supabaseClient = null;
let authStateChangeHandler = null;

export async function initAuth() {
    if (!isSupabaseConfigured()) {
        authLoading.set(false);
        return;
    }

    supabaseClient = getSupabase();
    if (!supabaseClient) {
        authLoading.set(false);
        return;
    }

    // Check existing session from Supabase
    const { data: { session: localSession } } = await supabaseClient.auth.getSession();
    
    // Check for shared session from cookie (cross-domain)
    const cookieSession = getSessionCookie();
    
    // Priority: local session > cookie session
    let sessionToUse = localSession;
    
    if (!sessionToUse && cookieSession) {
        // Try to restore session from cookie (convert camelCase to snake_case)
        const { data, error } = await supabaseClient.auth.setSession({
            access_token: cookieSession.accessToken,
            refresh_token: cookieSession.refreshToken,
        });
        if (!error && data.session) {
            sessionToUse = data.session;
            // Update cookie with fresh tokens
            setSessionCookie({
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
            });
        } else {
            // Cookie session invalid, clear it
            clearSessionCookie();
        }
    }
    
    user.set(sessionToUse?.user ?? null);
    authLoading.set(false);

    // Listen for auth changes
    if (authStateChangeHandler) {
        supabaseClient.auth.offAuthStateChange(authStateChangeHandler);
    }
    
    authStateChangeHandler = async (_event, session) => {
        if (session) {
            // Session created/updated - sync to cookie
            setSessionCookie({
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
            });
        } else {
            // Session cleared - remove from cookie
            clearSessionCookie();
        }
        user.set(session?.user ?? null);
    };
    
    supabaseClient.auth.onAuthStateChange(authStateChangeHandler);
}

export async function signUp(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Supabase non configurato' } };

    const { data, error } = await supabase.auth.signUp({ email, password });
    
    // Sync to cookie if successful
    if (!error && data.session) {
        setSessionCookie({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        });
    }
    
    return { data, error };
}

export async function signIn(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Supabase non configurato' } };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Sync to cookie if successful
    if (!error && data.session) {
        setSessionCookie({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        });
    }
    
    return { data, error };
}

export async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;

    // Clear cookie first
    clearSessionCookie();
    
    await supabase.auth.signOut();
    user.set(null);
}

export async function refreshSession() {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        setSessionCookie({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        });
    }
    
    return session;
}
