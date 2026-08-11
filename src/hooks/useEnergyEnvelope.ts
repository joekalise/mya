import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getExertionEventsForDate,
  saveExertionEvent,
  deleteExertionEvent,
  getDailyEnvelope,
  saveDailyEnvelope,
} from '@/services/database';
import { ExertionEvent, ExertionType } from '@/types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Jason's Energy Envelope method: available and spent energy are each a
// single 0-100 self-rating per day, not derived from logging every activity.
// Discrete exertion events are kept as an optional, occasional add (mainly
// useful for linking a likely trigger from the Crashes screen), not a
// requirement for the envelope itself.
export function useEnergyEnvelope(): {
  available: number | null;
  spent: number | null;
  events: ExertionEvent[];
  isLoading: boolean;
  saveEnvelope: (available: number, spent: number) => Promise<void>;
  addEvent: (type: ExertionType, intensity: number, durationMinutes: number | null, notes: string) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [available, setAvailable] = useState<number | null>(null);
  const [spent, setSpent] = useState<number | null>(null);
  const [events, setEvents] = useState<ExertionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const today = todayDateString();
      const [envelope, todayEvents] = await Promise.all([
        getDailyEnvelope(user.id, today),
        getExertionEventsForDate(user.id, today),
      ]);
      setAvailable(envelope?.budget_points ?? null);
      setSpent(envelope?.spent_points ?? null);
      setEvents(todayEvents);
    } catch (err) {
      console.error('useEnergyEnvelope load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const saveEnvelope = useCallback(
    async (nextAvailable: number, nextSpent: number) => {
      if (!user) throw new Error('No authenticated user');
      await saveDailyEnvelope({
        user_id: user.id,
        date: todayDateString(),
        budget_points: nextAvailable,
        spent_points: nextSpent,
      });
      setAvailable(nextAvailable);
      setSpent(nextSpent);
    },
    [user]
  );

  const addEvent = useCallback(
    async (type: ExertionType, intensity: number, durationMinutes: number | null, notes: string) => {
      if (!user) throw new Error('No authenticated user');
      const saved = await saveExertionEvent({
        user_id: user.id,
        occurred_at: new Date().toISOString(),
        exertion_type: type,
        intensity,
        duration_minutes: durationMinutes,
        notes,
      });
      setEvents((prev) => [saved, ...prev]);
    },
    [user]
  );

  const removeEvent = useCallback(async (id: string) => {
    await deleteExertionEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { available, spent, events, isLoading, saveEnvelope, addEvent, removeEvent, refresh: load };
}
