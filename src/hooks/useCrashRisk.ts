import { useMemo } from 'react';
import { DailyLog, DailyEnvelope, Crash, HealthData } from '@/types';

export type CrashRiskLevel = 'none' | 'watch' | 'warning';

export interface CrashRisk {
  level: CrashRiskLevel;
  signals: string[];
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function computeCrashRisk(
  logs: DailyLog[],
  envelopes: DailyEnvelope[],
  activeCrash: Crash | null,
  healthHistory?: HealthData[],
  tracksMedication = true
): CrashRisk {
  // Already in a crash — no separate warning needed
  if (activeCrash) return { level: 'none', signals: [] };
  if (logs.length < 3) return { level: 'none', signals: [] };

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const recentLogs = sortedLogs.slice(-3);
  const earlierLogs = sortedLogs.slice(-6, -3);

  const signals: string[] = [];

  // 1. Functional level (Bell score) declining — lower is worse
  const recentBell = avg(recentLogs.map((l) => l.bell_score_today ?? 70));
  if (earlierLogs.length >= 2) {
    const earlierBell = avg(earlierLogs.map((l) => l.bell_score_today ?? 70));
    if (earlierBell - recentBell >= 15 && recentBell <= 60) signals.push('functional_declining');
  } else if (recentBell <= 40) {
    signals.push('functional_declining');
  }

  // 2. Brain fog rising
  const brainFogLogs = recentLogs.filter((l) => l.cognitive_dysfunction_score !== null);
  if (brainFogLogs.length > 0) {
    const recentBrainFog = avg(brainFogLogs.map((l) => l.cognitive_dysfunction_score ?? 0));
    const earlierBrainFogLogs = earlierLogs.filter((l) => l.cognitive_dysfunction_score !== null);
    if (earlierBrainFogLogs.length >= 2) {
      const earlierBrainFog = avg(earlierBrainFogLogs.map((l) => l.cognitive_dysfunction_score ?? 0));
      if (recentBrainFog - earlierBrainFog >= 1.5 && recentBrainFog >= 5) signals.push('brain_fog_rising');
    } else if (recentBrainFog >= 7) {
      signals.push('brain_fog_rising');
    }
  }

  // 3. Energy envelope overspent 2+ of the last 3 days
  const sortedEnvelopes = [...envelopes].sort((a, b) => a.date.localeCompare(b.date));
  const recentEnvelopes = sortedEnvelopes.slice(-3);
  const overspentDays = recentEnvelopes.filter(
    (e) => e.spent_points !== null && e.budget_points !== null && e.spent_points > e.budget_points
  ).length;
  if (overspentDays >= 2) signals.push('envelope_overspent');

  // 4. Missed medication 2+ of last 3 days
  if (tracksMedication) {
    const missedMeds = recentLogs.filter((l) => l.medications_taken === 'no').length;
    if (missedMeds >= 2) signals.push('missed_medication');
  }

  // ── HealthKit signals (best-effort, only fire when we have enough data) ──────

  if (healthHistory && healthHistory.length >= 3) {
    const sortedHealth = [...healthHistory].sort((a, b) => a.date.localeCompare(b.date));
    const recentHealth = sortedHealth.slice(-3);
    const earlierHealth = sortedHealth.slice(-6, -3);

    // 5. HRV dropping — a 15%+ drop from baseline signals autonomic strain
    const recentHRVs = recentHealth.map((d) => d.hrv).filter((v): v is number => v !== null);
    const earlierHRVs = earlierHealth.map((d) => d.hrv).filter((v): v is number => v !== null);
    if (recentHRVs.length >= 2 && earlierHRVs.length >= 2) {
      const recentHRV = avg(recentHRVs);
      const earlierHRV = avg(earlierHRVs);
      if (earlierHRV > 0 && (earlierHRV - recentHRV) / earlierHRV >= 0.15) {
        signals.push('hrv_dropping');
      }
    }

    // 6. Poor sleep: < 5.5h on 2+ recent days
    const poorSleepDays = recentHealth.filter(
      (d) => d.sleep_duration !== null && d.sleep_duration < 5.5
    ).length;
    if (poorSleepDays >= 2) signals.push('poor_sleep');

    // 7. Elevated resting heart rate (+5 bpm vs earlier baseline) — relevant to
    // orthostatic intolerance/POTS, common in ME/CFS
    const recentHRs = recentHealth.map((d) => d.resting_heart_rate).filter((v): v is number => v !== null);
    const earlierHRs = earlierHealth.map((d) => d.resting_heart_rate).filter((v): v is number => v !== null);
    if (recentHRs.length >= 2 && earlierHRs.length >= 2) {
      const recentHR = avg(recentHRs);
      const earlierHR = avg(earlierHRs);
      if (recentHR - earlierHR >= 5) signals.push('hr_elevated');
    }

    // 8. Sudden drop in activity — can reflect the body forcing rest before a crash
    const lowStepDays = recentHealth.filter(
      (d) => d.steps !== null && d.steps < 3000
    ).length;
    if (lowStepDays >= 2) signals.push('low_activity');
  }

  if (signals.length >= 3) return { level: 'warning', signals };
  if (signals.length >= 2) return { level: 'watch', signals };
  return { level: 'none', signals };
}

export function useCrashRisk(
  logs: DailyLog[],
  envelopes: DailyEnvelope[],
  activeCrash: Crash | null,
  healthHistory?: HealthData[],
  tracksMedication = true
): CrashRisk {
  return useMemo(
    () => computeCrashRisk(logs, envelopes, activeCrash, healthHistory, tracksMedication),
    [logs, envelopes, activeCrash, healthHistory, tracksMedication]
  );
}
