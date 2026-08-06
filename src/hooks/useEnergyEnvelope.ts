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

const DEFAULT_BUDGET = 100;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Exertion cost heuristic: intensity (1-5) scaled by duration in 10-minute
// units, so a 30-minute moderate (3) exertion costs 9 points against the
// day's budget. Not a clinical formula, just a consistent relative scale.
function pointsForEvent(intensity: number, durationMinutes: number | null): number {
  return Math.round(intensity * ((durationMinutes ?? 10) / 10));
}

export function useEnergyEnvelope(): {
  events: ExertionEvent[];
  budget: number;
  spent: number;
  isLoading: boolean;
  addEvent: (type: ExertionType, intensity: number, durationMinutes: number | null, notes: string) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  setBudget: (n: number) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [events, setEvents] = useState<ExertionEvent[]>([]);
  const [budget, setBudgetState] = useState(DEFAULT_BUDGET);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const today = todayDateString();
      const [todayEvents, envelope] = await Promise.all([
        getExertionEventsForDate(user.id, today),
        getDailyEnvelope(user.id, today),
      ]);
      setEvents(todayEvents);
      setBudgetState(envelope?.budget_points ?? DEFAULT_BUDGET);
    } catch (err) {
      console.error('useEnergyEnvelope load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const persistSpent = useCallback(
    async (currentEvents: ExertionEvent[], currentBudget: number) => {
      if (!user) return;
      const spentPoints = currentEvents.reduce(
        (sum, e) => sum + pointsForEvent(e.intensity, e.duration_minutes),
        0
      );
      await saveDailyEnvelope({
        user_id: user.id,
        date: todayDateString(),
        budget_points: currentBudget,
        spent_points: spentPoints,
      });
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
      const nextEvents = [saved, ...events];
      setEvents(nextEvents);
      await persistSpent(nextEvents, budget);
    },
    [user, events, budget, persistSpent]
  );

  const removeEvent = useCallback(
    async (id: string) => {
      await deleteExertionEvent(id);
      const nextEvents = events.filter((e) => e.id !== id);
      setEvents(nextEvents);
      await persistSpent(nextEvents, budget);
    },
    [events, budget, persistSpent]
  );

  const setBudget = useCallback(
    async (n: number) => {
      setBudgetState(n);
      await persistSpent(events, n);
    },
    [events, persistSpent]
  );

  const spent = events.reduce((sum, e) => sum + pointsForEvent(e.intensity, e.duration_minutes), 0);

  return { events, budget, spent, isLoading, addEvent, removeEvent, setBudget, refresh: load };
}
