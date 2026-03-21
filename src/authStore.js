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
        // Try to restore session from cookie
        const { data, error } = await supabaseClient.auth.setSession(cookieSession);
        if (!error && data.session) {
            sessionToUse = data.session;
            // Update cookie with fresh tokens
            setSessionCookie(data.session);
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
            setSessionCookie(session);
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
        setSessionCookie(data.session);
    }
    
    return { data, error };
}

export async function signIn(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Supabase non configurato' } };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Sync to cookie if successful
    if (!error && data.session) {
        setSessionCookie(data.session);
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
        setSessionCookie(session);
    }
    
    return session;
}
