import { getSupabase } from './supabaseClient.js';

export async function getBestTime(userId, gameId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('games_stat')
      .select('best_time_ms')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle();
    return data?.best_time_ms ?? null;
  } catch (e) {
    console.warn('getBestTime failed:', e);
    return null;
  }
}

export async function saveBestTime(userId, gameId, timeMs) {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const existing = await getBestTime(userId, gameId);
    if (existing !== null && existing <= timeMs) return false;
    const { error } = await supabase
      .from('games_stat')
      .upsert(
        { user_id: userId, game_id: gameId, best_time_ms: timeMs },
        { onConflict: 'user_id, game_id' }
      );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('saveBestTime failed:', e);
    return false;
  }
}
