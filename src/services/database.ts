import { supabase } from '@/services/supabase';
import { DailyLog, ExertionEvent, DailyEnvelope } from '@/types';

// ─── Daily Logs ─────────────────────────────────────────────────────────────

export async function saveDailyLog(log: Omit<DailyLog, 'id'>): Promise<DailyLog> {
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(log, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) throw error;
    return data as DailyLog;
  } catch (err) {
    console.error('saveDailyLog error:', err);
    throw err;
  }
}

export async function getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data as DailyLog;
  } catch (err) {
    console.error('getDailyLog error:', err);
    throw err;
  }
}

export async function getDailyLogs(userId: string, days: number): Promise<DailyLog[]> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceDate = since.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', sinceDate)
      .order('date', { ascending: true });

    if (error) throw error;
    return (data ?? []) as DailyLog[];
  } catch (err) {
    console.error('getDailyLogs error:', err);
    throw err;
  }
}

// ─── Exertion Events ───────────────────────────────────────────────────────────

export async function saveExertionEvent(event: Omit<ExertionEvent, 'id'>): Promise<ExertionEvent> {
  const { data, error } = await supabase
    .from('exertion_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data as ExertionEvent;
}

export async function getExertionEventsForDate(userId: string, date: string): Promise<ExertionEvent[]> {
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from('exertion_events')
    .select('*')
    .eq('user_id', userId)
    .gte('occurred_at', dayStart)
    .lte('occurred_at', dayEnd)
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ExertionEvent[];
}

export async function deleteExertionEvent(id: string): Promise<void> {
  const { error } = await supabase.from('exertion_events').delete().eq('id', id);
  if (error) throw error;
}

// ─── Daily Envelope ─────────────────────────────────────────────────────────────

export async function getDailyEnvelope(userId: string, date: string): Promise<DailyEnvelope | null> {
  const { data, error } = await supabase
    .from('daily_envelope')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data as DailyEnvelope;
}

export async function saveDailyEnvelope(envelope: Omit<DailyEnvelope, 'id'>): Promise<DailyEnvelope> {
  const { data, error } = await supabase
    .from('daily_envelope')
    .upsert(envelope, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return data as DailyEnvelope;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export async function getStreak(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(90);

    if (error) throw error;
    if (!data || data.length === 0) return 0;

    const loggedDates = new Set<string>(data.map((d: { date: string }) => d.date));

    let streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const cursor = new Date(today);

    if (!loggedDates.has(todayStr)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (!loggedDates.has(dateStr)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  } catch (err) {
    console.error('getStreak error:', err);
    return 0;
  }
}
