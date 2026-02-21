import { writable } from 'svelte/store';
import { getSupabase } from './supabaseClient.js';

export const user = writable(null);
export const authLoading = writable(true);

export async function initAuth() {
    alert('initAuth');
    console.log('initAuth');
    const supabase = getSupabase();
    if (!supabase) {
        authLoading.set(false);
        return;
    }

    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    user.set(session?.user ?? null);
    authLoading.set(false);

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
        user.set(session?.user ?? null);
    });
}

export async function signUp(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Supabase non configurato' } };

    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
}

export async function signIn(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Supabase non configurato' } };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

export async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.auth.signOut();
    user.set(null);
}
