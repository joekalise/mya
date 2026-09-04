import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDailyLogs, getDailyEnvelopes, getCrashes } from '@/services/database';
import { DailyLog, DailyEnvelope, Crash, MedsTaken } from '@/types';

// How many days after a crash ends its score penalty and cap keep relaxing,
// instead of vanishing the instant it's marked resolved.
const CRASH_TAPER_DAYS = 10;

// 1.0 while still active, tapering linearly to 0 by CRASH_TAPER_DAYS after end_date.
function crashRecencyWeight(endDate: string | null): number {
  if (!endDate) return 1;
  const daysSinceEnd = Math.floor((Date.now() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceEnd <= 0) return 1;
  if (daysSinceEnd >= CRASH_TAPER_DAYS) return 0;
  return 1 - daysSinceEnd / CRASH_TAPER_DAYS;
}

export interface ScoreBreakdown {
  base: number;
  functionalPoints: number;
  brainFogPoints: number;
  activeCrashPenalty: number;
  recentCrashPenalty: number;
  consistencyBonus: number;
  envelopePoints: number;
  medPoints: number;
  logCount: number;
}

function medicationToPoints(taken: MedsTaken | null | undefined): number {
  switch (taken) {
    case 'yes': return 15;
    case 'partial': return 7.5;
    default: return 0;
  }
}

// Bell (functional level) 0-100, higher is better — bonus above 70, growing
// penalty below it.
function functionalContribution(avgBell: number): number {
  if (avgBell >= 70) return Math.round(((avgBell - 70) / 30) * 15);
  return Math.round(-((70 - avgBell) / 70) * 30);
}

// Brain fog 0-10, higher is worse — small bonus when low, growing penalty when high.
function brainFogContribution(avgBrainFog: number): number {
  if (avgBrainFog <= 3) return Math.round((3 - avgBrainFog) * 2);
  return Math.round(-((avgBrainFog - 3) / 7) * 25);
}

function crashPenaltyForSeverity(crash: Crash): number {
  const severityPenalty = crash.severity === 'severe' ? 45 : crash.severity === 'moderate' ? 32 : 20;
  return Math.round(severityPenalty * crashRecencyWeight(crash.end_date));
}

function crashPenalties(crashes: Crash[]): { active: number; recent: number } {
  let active = 0;
  let recent = 0;
  for (const crash of crashes) {
    const penalty = crashPenaltyForSeverity(crash);
    if (crash.end_date === null) active += penalty;
    else recent += penalty;
  }
  return { active, recent };
}

// Caps the score while a crash is active or recently ended, blending back to
// 100 as its recency weight tapers to 0 rather than releasing all at once.
function scoreUpperCap(crashes: Crash[]): number {
  const weighted = crashes
    .map((c) => ({ crash: c, weight: crashRecencyWeight(c.end_date) }))
    .filter((x) => x.weight > 0);
  if (weighted.length === 0) return 100;

  const hasSevere = weighted.some((x) => x.crash.severity === 'severe');
  let rawCap: number;
  if (weighted.length >= 2) {
    rawCap = hasSevere ? 40 : 50;
  } else if (hasSevere) {
    rawCap = 55;
  } else {
    const severityOrder: Record<string, number> = { severe: 0, moderate: 1, mild: 2 };
    const worst = [...weighted.map((x) => x.crash)].sort(
      (a, b) => (severityOrder[a.severity ?? 'mild'] ?? 2) - (severityOrder[b.severity ?? 'mild'] ?? 2)
    )[0];
    rawCap = worst?.severity === 'moderate' ? 65 : 80;
  }

  const maxWeight = Math.max(0, ...weighted.map((x) => x.weight));
  return Math.round(100 - (100 - rawCap) * maxWeight);
}

function computeScore(
  logs: DailyLog[],
  envelopes: DailyEnvelope[],
  recentCrashes: Crash[],
  tracksMedication: boolean
): { score: number | null; breakdown: ScoreBreakdown | null } {
  if (logs.length === 0) return { score: null, breakdown: null };

  const count = logs.length;
  const bellLogs = logs.filter((l) => l.bell_score_today !== null);
  const avgBell = bellLogs.length > 0
    ? bellLogs.reduce((s, l) => s + (l.bell_score_today ?? 70), 0) / bellLogs.length
    : 70;
  // 3 is brainFogContribution's neutral pivot (bonus below it, penalty above),
  // not 0 — falling back to 0 when nobody logged brain fog would otherwise
  // read as "perfectly clear-headed" and hand out an undeserved bonus.
  const brainFogLogs = logs.filter((l) => l.cognitive_dysfunction_score !== null);
  const avgBrainFog = brainFogLogs.length > 0
    ? brainFogLogs.reduce((s, l) => s + (l.cognitive_dysfunction_score ?? 0), 0) / brainFogLogs.length
    : 3;
  const avgMedRaw = tracksMedication
    ? logs.reduce((s, l) => s + medicationToPoints(l.medications_taken), 0) / count
    : 0;

  const envelopeDays = envelopes.filter((e) => e.budget_points !== null && e.spent_points !== null);
  const withinEnvelopeDays = envelopeDays.filter((e) => (e.spent_points ?? 0) <= (e.budget_points ?? 0)).length;
  const envelopePts = envelopeDays.length > 0
    ? Math.round((withinEnvelopeDays / envelopeDays.length) * 10 - 5)
    : 0;

  const base = 75;
  const functionalPts = functionalContribution(avgBell);
  const brainFogPts = brainFogContribution(avgBrainFog);
  const { active: activeCrashPen, recent: recentCrashPen } = crashPenalties(recentCrashes);
  const consistencyBonus = Math.round((count / 7) * 8);
  const medPts = Math.round(avgMedRaw * 0.5);
  const cap = scoreUpperCap(recentCrashes);

  const score = Math.round(
    Math.min(
      cap,
      Math.max(
        0,
        base + functionalPts + brainFogPts - activeCrashPen - recentCrashPen + consistencyBonus + envelopePts + medPts
      )
    )
  );

  const breakdown: ScoreBreakdown = {
    base,
    functionalPoints: functionalPts,
    brainFogPoints: brainFogPts,
    activeCrashPenalty: activeCrashPen,
    recentCrashPenalty: recentCrashPen,
    consistencyBonus,
    envelopePoints: envelopePts,
    medPoints: medPts,
    logCount: count,
  };

  return { score, breakdown };
}

export function useWeeklyData(tracksMedication = true): {
  logs: DailyLog[];
  envelopes: DailyEnvelope[];
  isLoading: boolean;
  myaScore: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [envelopes, setEnvelopes] = useState<DailyEnvelope[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myaScore, setMyaScore] = useState<number | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const taperSince = new Date(Date.now() - CRASH_TAPER_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [weekLogs, weekEnvelopes, allRecentCrashes] = await Promise.all([
        getDailyLogs(user.id, 7),
        getDailyEnvelopes(user.id, 7),
        getCrashes(user.id, 20),
      ]);
      const recentCrashes = allRecentCrashes.filter((c) => c.end_date === null || c.end_date >= taperSince);
      setLogs(weekLogs);
      setEnvelopes(weekEnvelopes);
      const { score, breakdown } = computeScore(weekLogs, weekEnvelopes, recentCrashes, tracksMedication);
      setMyaScore(score);
      setScoreBreakdown(breakdown);
    } catch (err) {
      console.error('useWeeklyData load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, tracksMedication]);

  useEffect(() => {
    load();
  }, [load]);

  return { logs, envelopes, isLoading, myaScore, scoreBreakdown, refresh: load };
}
