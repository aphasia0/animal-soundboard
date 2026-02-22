import { writable } from 'svelte/store';
import { getSupabase } from './supabaseClient.js';

const STORAGE_KEY = 'user_settings';

const defaultSettings = {
    cardMode: null, // null means not set yet
    shuffleMode: true,
    hasSettings: false
};

function createSettingsStore() {
    let initialValue = defaultSettings;

    // Try to load from local storage
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                initialValue = { ...JSON.parse(saved), hasSettings: true };
            } catch (e) {
                console.error("Error parsing local settings:", e);
            }
        }
    }

    const { subscribe, set, update } = writable(initialValue);

    return {
        subscribe,
        loadFromSupabase: async (userId) => {
            const supabase = getSupabase();
            if (!supabase || !userId) return;

            try {
                const { data, error } = await supabase
                    .from('user_confs')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (data && !error) {
                    const settings = {
                        cardMode: data.card_mode,
                        shuffleMode: data.shuffle_mode,
                        hasSettings: true
                    };
                    set(settings);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                    return settings;
                }
            } catch (e) {
                console.error("Supabase settings fetch failed:", e);
            }
            return null;
        },
        updateSettings: async (changes, userId) => {
            let updated;
            update(current => {
                updated = { ...current, ...changes, hasSettings: true };
                if (typeof window !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                }
                return updated;
            });

            const supabase = getSupabase();
            if (supabase && userId) {
                try {
                    await supabase.from('user_confs').upsert({
                        user_id: userId,
                        card_mode: updated.cardMode,
                        shuffle_mode: updated.shuffleMode,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {
                    console.error("Supabase settings sync failed:", e);
                }
            }
        }
    };
}

export const settingsStore = createSettingsStore();
