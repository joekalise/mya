import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCrashes,
  saveCrash as dbSaveCrash,
  updateCrash as dbUpdateCrash,
  deleteCrash as dbDeleteCrash,
  getRecentExertionEvents,
} from '@/services/database';
import { Crash, CrashSeverity, ExertionEvent } from '@/types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useCrashes(): {
  crashes: Crash[];
  activeCrash: Crash | null;
  recentExertionEvents: ExertionEvent[];
  isLoading: boolean;
  startCrash: (
    severity: CrashSeverity,
    symptoms: string[],
    notes: string,
    triggerEventId: string | null
  ) => Promise<void>;
  endActiveCrash: () => Promise<void>;
  updateCrash: (id: string, updates: Partial<Crash>) => Promise<void>;
  deleteCrash: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [crashes, setCrashes] = useState<Crash[]>([]);
  const [recentExertionEvents, setRecentExertionEvents] = useState<ExertionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [allCrashes, exertionEvents] = await Promise.all([
        getCrashes(user.id, 50),
        getRecentExertionEvents(user.id, 5),
      ]);
      setCrashes(allCrashes);
      setRecentExertionEvents(exertionEvents);
    } catch (err) {
      console.error('useCrashes load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCrash = crashes.find((c) => !c.end_date) ?? null;

  const startCrash = useCallback(
    async (severity: CrashSeverity, symptoms: string[], notes: string, triggerEventId: string | null) => {
      if (!user) throw new Error('No authenticated user');

      let pemDelayHours: number | null = null;
      if (triggerEventId) {
        const triggerEvent = recentExertionEvents.find((e) => e.id === triggerEventId);
        if (triggerEvent) {
          const delayMs = Date.now() - new Date(triggerEvent.occurred_at).getTime();
          pemDelayHours = Math.round(delayMs / (1000 * 60 * 60));
        }
      }

      const saved = await dbSaveCrash({
        user_id: user.id,
        start_date: todayDateString(),
        end_date: null,
        severity,
        symptoms,
        likely_trigger_exertion_event_id: triggerEventId,
        pem_delay_hours: pemDelayHours,
        notes,
      });
      setCrashes((prev) => [saved, ...prev]);
    },
    [user, recentExertionEvents]
  );

  const endActiveCrash = useCallback(async () => {
    if (!activeCrash?.id) throw new Error('No active crash');
    const updated = await dbUpdateCrash(activeCrash.id, { end_date: todayDateString() });
    setCrashes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, [activeCrash]);

  const updateCrash = useCallback(async (id: string, updates: Partial<Crash>) => {
    const updated = await dbUpdateCrash(id, updates);
    setCrashes((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteCrash = useCallback(async (id: string) => {
    await dbDeleteCrash(id);
    setCrashes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { crashes, activeCrash, recentExertionEvents, isLoading, startCrash, endActiveCrash, updateCrash, deleteCrash, refresh: load };
}
