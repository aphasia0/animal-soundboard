import { writable } from 'svelte/store';
import { getSupabase } from './supabaseClient.js';

const STORAGE_KEY = 'user_settings';

const defaultSettings = {
    cardMode: null,
    shuffleMode: true,
    primaryColor: '#39ff14',
    secondaryColor: '#ff0000',
    maxTimeMs: 5000,           // null = infinite
    restartOnPress: true,      // true = restart from beginning each press; false = resume
    hasSettings: false
};

function createSettingsStore() {
    let initialValue = defaultSettings;

    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                initialValue = { ...defaultSettings, ...JSON.parse(saved), hasSettings: true };
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
                        primaryColor: data.primary_color || defaultSettings.primaryColor,
                        secondaryColor: data.secondary_color || defaultSettings.secondaryColor,
                        maxTimeMs: data.max_time_ms !== undefined ? data.max_time_ms : defaultSettings.maxTimeMs,
                        restartOnPress: data.restart_on_press !== undefined ? data.restart_on_press : defaultSettings.restartOnPress,
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
                        primary_color: updated.primaryColor,
                        secondary_color: updated.secondaryColor,
                        max_time_ms: updated.maxTimeMs,
                        restart_on_press: updated.restartOnPress,
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
