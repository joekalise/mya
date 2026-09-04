import React, { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useProfile } from '@/contexts/ProfileContext';
import { useDailyLog } from '@/hooks/useDailyLog';
import { useEnergyEnvelope } from '@/hooks/useEnergyEnvelope';
import { useCrashes } from '@/hooks/useCrashes';
import { useHealthData } from '@/hooks/useHealthData';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useWeeklyData, ScoreBreakdown } from '@/hooks/useWeeklyData';
import { useCrashRisk } from '@/hooks/useCrashRisk';
import { useHealthHistory } from '@/hooks/useHealthHistory';
import { useMedicationTracking } from '@/hooks/useMedicationTracking';
import { useSubscription } from '@/hooks/useSubscription';
import { ProfileButton } from '@/components/common/ProfileButton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InfoButton } from '@/components/common/InfoButton';
import { PremiumModal } from '@/components/common/PremiumModal';
import { formatTemperature } from '@/utils/units';
import { DailyLog } from '@/types';

function stepsColor(steps: number): string {
  if (steps < 3000 || steps > 12000) return Colors.error;
  if (steps < 6000) return Colors.warning;
  return Colors.success;
}

function sleepColor(hours: number): string {
  if (hours < 5.5 || hours > 9) return Colors.error;
  if (hours < 7) return Colors.warning;
  return Colors.success;
}

function hrvColor(hrv: number): string {
  if (hrv < 25) return Colors.error;
  if (hrv < 40) return Colors.warning;
  return Colors.success;
}

function restingHRColor(bpm: number): string {
  if (bpm >= 100 || bpm < 45) return Colors.error;
  if (bpm >= 90 || bpm < 50) return Colors.warning;
  return Colors.success;
}

// Heat worsens autonomic symptoms (POTS/orthostatic intolerance) and general
// crash risk in ME/CFS, cold intolerance is also common, hence the U-shape.
function temperatureColor(celsius: number): string {
  if (celsius >= 30 || celsius <= 0) return Colors.error;
  if (celsius >= 25 || celsius <= 5) return Colors.warning;
  return Colors.success;
}

function uvIndexColor(uv: number): string {
  if (uv >= 8) return Colors.error;
  if (uv >= 3) return Colors.warning;
  return Colors.success;
}

// US AQI bands (EPA)
function airQualityColor(aqi: number): string {
  if (aqi > 150) return Colors.error;
  if (aqi > 100) return Colors.warning;
  return Colors.success;
}

// Bell scale: 100 is normal function, 0 is bedridden — higher is better.
function bellScoreColor(score: number): string {
  if (score >= 70) return Colors.success;
  if (score >= 40) return Colors.warning;
  return Colors.error;
}

// Fatigue / cognitive dysfunction: 0-10, higher is worse.
function severityScoreColor(score: number): string {
  if (score >= 7) return Colors.error;
  if (score >= 4) return Colors.warning;
  return Colors.success;
}

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'greeting_morning';
  if (hour < 17) return 'greeting_afternoon';
  return 'greeting_evening';
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000));
}

const SIGNAL_LABEL_KEYS: Record<string, string> = {
  envelope_overspent: 'dashboard.signal.envelope_overspent',
  functional_declining: 'dashboard.signal.functional_declining',
  brain_fog_rising: 'dashboard.signal.brain_fog_rising',
  missed_medication: 'dashboard.signal.missed_medication',
  hrv_dropping: 'dashboard.signal.hrv_dropping',
  poor_sleep: 'dashboard.signal.poor_sleep',
  hr_elevated: 'dashboard.signal.hr_elevated',
  low_activity: 'dashboard.signal.low_activity',
};

// ─── Signals to watch card ──────────────────────────────────────────────────

function SignalsToWatchCard({
  level, signals, isDark, isSubscribed, onChatPress, onUpgradePress, t,
}: {
  level: 'watch' | 'warning';
  signals: string[];
  isDark: boolean;
  isSubscribed: boolean;
  onChatPress: () => void;
  onUpgradePress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isWarning = level === 'warning';
  const accentColor = isWarning ? Colors.error : Colors.warning;
  const bgColor = isWarning
    ? (isDark ? '#450A0A' : Colors.error + '12')
    : (isDark ? '#3A2500' : Colors.warning + '12');
  const borderColor = isWarning ? Colors.error + '50' : Colors.warning + '50';

  return (
    <View style={[styles.riskCard, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.riskTitleRow}>
        <Text style={[styles.riskTitle, { color: accentColor }]}>
          {isWarning ? `⚠️ ${t('dashboard.crash_building_title')}` : `👀 ${t('dashboard.symptoms_to_watch_title')}`}
        </Text>
        {!isSubscribed && (
          <View style={styles.riskPremiumBadge}>
            <Text style={styles.riskPremiumBadgeText}>{t('common.premium')}</Text>
          </View>
        )}
      </View>
      {isSubscribed ? (
        <>
          <Text style={[styles.riskBody, isDark && styles.textSecDark]}>
            {isWarning ? t('dashboard.crash_building_body') : t('dashboard.symptoms_to_watch_body')}
          </Text>
          <View style={styles.riskSignals}>
            {signals.map((s) => (
              <View key={s} style={[styles.riskChip, { borderColor: accentColor + '60' }]}>
                <Text style={[styles.riskChipText, { color: accentColor }]}>
                  {SIGNAL_LABEL_KEYS[s] ? t(SIGNAL_LABEL_KEYS[s]) : s}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.riskChatRow}>
            <TouchableOpacity onPress={onChatPress} style={[styles.riskChatBtn, { backgroundColor: accentColor }]} activeOpacity={0.8}>
              <Text style={styles.riskChatBtnText}>{t('dashboard.chat_about_this')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.riskBody, isDark && styles.textSecDark]}>{t('dashboard.crash_risk_locked_body')}</Text>
          <View style={styles.riskChatRow}>
            <TouchableOpacity onPress={onUpgradePress} style={[styles.riskChatBtn, { backgroundColor: accentColor }]} activeOpacity={0.8}>
              <Text style={styles.riskChatBtnText}>{t('dashboard.crash_risk_unlock_cta')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Mya Score card ─────────────────────────────────────────────────────────

function MyaScoreCard({
  score, breakdown, logs, isDark, t,
}: {
  score: number | null;
  breakdown: ScoreBreakdown | null;
  logs: DailyLog[];
  isDark: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const color = score !== null ? bellScoreColor(score) : Colors.textSecondary;
  const textSec = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  function FactorRow({ label, value }: { label: string; value: number }) {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '−';
    const col = value > 0 ? Colors.success : Colors.error;
    return (
      <View style={styles.factorRow}>
        <Text style={[styles.factorLabel, { color: textSec }]}>{label}</Text>
        <Text style={[styles.factorValue, { color: col }]}>{sign}{Math.abs(value)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.healthCard, isDark && styles.healthCardDark]}>
      <View style={styles.todaySummaryHeader}>
        <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.mya_score')}</Text>
        {score !== null && (
          <TouchableOpacity onPress={() => setShowBreakdown((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Text style={[styles.infoIcon, { color: showBreakdown ? Colors.primary : textSec }]}>ⓘ</Text>
          </TouchableOpacity>
        )}
      </View>

      {score !== null ? (
        <>
          <View style={styles.scoreHorizontalRow}>
            <View style={styles.scoreNumberBlock}>
              <Text style={[styles.scoreNumberLarge, { color }]}>{score}</Text>
              <Text style={[styles.scoreOutOf, { color: textSec }]}>/100</Text>
            </View>
            <View style={styles.scoreBarBlock}>
              <View style={[styles.scoreBarTrack, isDark && styles.scoreBarTrackDark]}>
                <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: color }]} />
              </View>
              <Text style={[styles.scoreBarLabel, { color }]}>
                {score >= 70 ? t('dashboard.score_managing_well') : score >= 40 ? t('dashboard.score_moderate_symptoms') : t('dashboard.score_high_symptom_load')}
              </Text>
              <Text style={[styles.scoreHint, { color: textSec }]}>
                {breakdown?.logCount === 1 ? t('dashboard.score_based_on_days_one', { count: 1 }) : t('dashboard.score_based_on_days_other', { count: breakdown?.logCount ?? 0 })}
              </Text>
            </View>
          </View>

          {showBreakdown && breakdown && (
            <View style={[styles.breakdownBox, isDark && styles.breakdownBoxDark]}>
              <Text style={[styles.breakdownTitle, { color: textSec }]}>{t('score.breakdown')}</Text>
              <FactorRow label={t('score.factor_base')} value={breakdown.base} />
              <FactorRow label={t('score.factor_functional')} value={breakdown.functionalPoints} />
              <FactorRow label={t('score.factor_brain_fog')} value={breakdown.brainFogPoints} />
              {breakdown.activeCrashPenalty > 0 && <FactorRow label={t('score.factor_active_crash')} value={-breakdown.activeCrashPenalty} />}
              {breakdown.recentCrashPenalty > 0 && <FactorRow label={t('score.factor_recent_crash')} value={-breakdown.recentCrashPenalty} />}
              <FactorRow label={t('score.factor_streak')} value={breakdown.consistencyBonus} />
              <FactorRow label={t('score.factor_envelope')} value={breakdown.envelopePoints} />
              <FactorRow label={t('score.factor_medication')} value={breakdown.medPoints} />
            </View>
          )}
        </>
      ) : (
        <Text style={[styles.noDataText, isDark && styles.textSecDark]}>
          {logs.length === 0 ? t('dashboard.mya_score_no_data') : t('dashboard.mya_score_no_data')}
        </Text>
      )}
    </View>
  );
}

// ─── 7-day overview ─────────────────────────────────────────────────────────

function SevenDayOverview({ logs, isDark, t }: { logs: DailyLog[]; isDark: boolean; t: (key: string) => string }) {
  const days: { dayLabel: string; log: DailyLog | null }[] = [];
  const DAY_ABBR_KEYS = ['common.day_short.sun', 'common.day_short.mon', 'common.day_short.tue', 'common.day_short.wed', 'common.day_short.thu', 'common.day_short.fri', 'common.day_short.sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = logs.find((l) => l.date === dateStr) ?? null;
    days.push({ dayLabel: t(DAY_ABBR_KEYS[d.getDay()]), log });
  }

  const hasAnyData = days.some((d) => d.log !== null && d.log.bell_score_today !== null);
  const textSec = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  return (
    <View style={[styles.healthCard, isDark && styles.healthCardDark]}>
      <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.this_week')}</Text>
      {!hasAnyData ? (
        <Text style={[styles.noDataText, isDark && styles.textSecDark]}>{t('dashboard.no_data_yet')}</Text>
      ) : (
        <View style={styles.weekDotRow}>
          {days.map(({ dayLabel, log }, idx) => {
            const bellScore = log?.bell_score_today ?? null;
            const dotColor = bellScore !== null ? bellScoreColor(bellScore) : (isDark ? '#3A3330' : '#F5F5F4');
            const textColor = bellScore !== null ? '#FFFFFF' : textSec;
            return (
              <View key={idx} style={styles.weekDotItem}>
                <View style={[styles.weekDot, { backgroundColor: dotColor }]}>
                  <Text style={[styles.weekDotNumber, { color: textColor }]}>{bellScore !== null ? bellScore : '·'}</Text>
                </View>
                <Text style={[styles.weekDotDay, { color: textSec }]}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>
      )}
      {hasAnyData && (
        <View style={styles.weekLegendRow}>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: Colors.success }]} />
            <Text style={[styles.weekLegendText, { color: textSec }]}>{t('dashboard.legend_good')}</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: Colors.warning }]} />
            <Text style={[styles.weekLegendText, { color: textSec }]}>{t('dashboard.legend_reduced')}</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: Colors.error }]} />
            <Text style={[styles.weekLegendText, { color: textSec }]}>{t('dashboard.legend_low')}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { profile } = useProfile();
  const { todayLog, todayLogged, isLoading: logLoading, refresh: refreshLog } = useDailyLog();
  const { available, spent, isLoading: envelopeLoading, refresh: refreshEnvelope } = useEnergyEnvelope();
  const { activeCrash, isLoading: crashLoading, refresh: refreshCrashes } = useCrashes();
  const { isConnected: healthConnected, todayData: healthData, recheck: recheckHealth } = useHealthData();
  const { weather } = useWeatherData();
  const { tracks: tracksMedication } = useMedicationTracking();
  const { logs: weekLogs, envelopes: weekEnvelopes, myaScore, scoreBreakdown, refresh: refreshWeekly } = useWeeklyData(tracksMedication);
  const { history: healthHistory } = useHealthHistory(7);
  const { isSubscribed, isLoading: subLoading, monthlyPrice, trialDays, purchase, restore } = useSubscription();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const crashRisk = useCrashRisk(weekLogs, weekEnvelopes, activeCrash, healthHistory, tracksMedication);

  useFocusEffect(useCallback(() => {
    refreshLog();
    refreshEnvelope();
    refreshCrashes();
    recheckHealth();
    refreshWeekly();
  }, [refreshLog, refreshEnvelope, refreshCrashes, recheckHealth, refreshWeekly]));

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      await purchase();
    } catch (err) {
      console.error('Purchase error:', err);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restore();
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const isLoading = logLoading || envelopeLoading || crashLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <LoadingSpinner fullScreen message={t('common.loading')} />
      </SafeAreaView>
    );
  }

  const overBudget = spent !== null && available !== null && spent > available;
  const fillPct = available && available > 0 ? Math.min(100, ((spent ?? 0) / available) * 100) : 0;
  const greetingKey = getGreetingKey();
  const firstName = profile?.preferred_name || '';

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerDate, isDark && styles.textPrimaryDark]} numberOfLines={2}>
            {t(`dashboard.${greetingKey}`)}{firstName ? `, ${firstName}` : ''}
          </Text>
          <ProfileButton />
        </View>

        {activeCrash && (
          <TouchableOpacity
            style={[styles.crashBanner, isDark && styles.crashBannerDark]}
            onPress={() => router.push('/(tabs)/crashes')}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.crashBannerTitle}>⚠ {t('dashboard.active_crash_title')}</Text>
              <Text style={[styles.crashBannerSubtitle, isDark && styles.textSecDark]}>
                {daysSince(activeCrash.start_date)} {daysSince(activeCrash.start_date) === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <Text style={styles.crashBannerLink}>{t('dashboard.view_crashes')} ›</Text>
          </TouchableOpacity>
        )}

        {!activeCrash && !subLoading && crashRisk.level !== 'none' && (
          <SignalsToWatchCard
            level={crashRisk.level as 'watch' | 'warning'}
            signals={crashRisk.signals}
            isDark={isDark}
            isSubscribed={isSubscribed}
            onChatPress={() => router.push('/ai-chat')}
            onUpgradePress={() => setShowPremiumModal(true)}
            t={t}
          />
        )}

        {!todayLogged ? (
          <View style={[styles.promptCard, isDark && styles.promptCardDark]}>
            <Text style={[styles.promptTitle, isDark && styles.textPrimaryDark]}>{t('dashboard.not_logged_title')}</Text>
            <Text style={[styles.promptBody, isDark && styles.textSecDark]}>{t('dashboard.not_logged_body')}</Text>
            <Button label={t('dashboard.log_now')} onPress={() => router.push('/(tabs)/pace')} />
          </View>
        ) : (
          <View style={[styles.todaySummaryCard, isDark && styles.todaySummaryCardDark]}>
            <View style={styles.todaySummaryHeader}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.todays_log')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/pace?edit=true')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.todaySummaryEdit}>{t('dashboard.edit')}</Text>
              </TouchableOpacity>
            </View>

            {available !== null && (
              <>
                <View style={styles.energyBarBlock}>
                  <View style={styles.energyBarHeaderRow}>
                    <Text style={[styles.energyBarLabel, isDark && styles.textSecDark]}>{t('dashboard.energy')}</Text>
                    <Text style={[styles.energyBarValue, { color: overBudget ? Colors.error : Colors.success }]}>{spent ?? 0} / {available}</Text>
                  </View>
                  <View style={[styles.progressTrack, isDark && styles.progressTrackDark]}>
                    <View style={[styles.progressFill, { width: `${fillPct}%`, backgroundColor: overBudget ? Colors.error : Colors.success }]} />
                  </View>
                </View>
                <View style={styles.energyBarDividerSpacer}>
                  <View style={[styles.todaySummaryDividerH, isDark && styles.todaySummaryDividerHDark]} />
                </View>
              </>
            )}

            <View style={styles.todaySummaryRow}>
              <View style={styles.todaySummaryItem}>
                <Text style={[
                  styles.todaySummaryValue,
                  todayLog?.bell_score_today !== null && todayLog?.bell_score_today !== undefined
                    ? { color: bellScoreColor(todayLog.bell_score_today) }
                    : (isDark && styles.textPrimaryDark),
                ]}>{todayLog?.bell_score_today ?? '—'}</Text>
                <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.bell_score')}</Text>
              </View>
              <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
              <View style={styles.todaySummaryItem}>
                <Text style={[
                  styles.todaySummaryValue,
                  todayLog?.cognitive_dysfunction_score !== null && todayLog?.cognitive_dysfunction_score !== undefined
                    ? { color: severityScoreColor(todayLog.cognitive_dysfunction_score) }
                    : (isDark && styles.textPrimaryDark),
                ]}>{todayLog?.cognitive_dysfunction_score ?? '—'}</Text>
                <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.cognitive')}</Text>
              </View>
              {todayLog?.medications_taken && (
                <>
                  <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                  <View style={styles.todaySummaryItem}>
                    <Text style={[
                      styles.todaySummaryValue,
                      { color: todayLog.medications_taken === 'yes' ? Colors.success : todayLog.medications_taken === 'partial' ? Colors.warning : Colors.error },
                    ]}>
                      {todayLog.medications_taken === 'yes' ? '✓' : todayLog.medications_taken === 'partial' ? '~' : '✗'}
                    </Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.meds')}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Independent of manual logging — HealthKit and weather sync on their own */}
        {((healthConnected && healthData) || weather) && (
          <View style={[styles.healthCard, isDark && styles.healthCardDark]}>
            <View style={styles.todaySummaryHeader}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.health_title')}</Text>
              <InfoButton title={t('dashboard.health_title')} message={t('dashboard.health_info_message')} />
            </View>
            {healthData && (() => {
              const hasSleep = healthData.sleep_duration !== null;
              const hasHrv = healthData.hrv !== null;
              const hasRestingHR = healthData.resting_heart_rate !== null;
              return (
                <View style={styles.todaySummaryRow}>
                  {healthData.steps !== null && (
                    <>
                      <View style={styles.todaySummaryItem}>
                        <Text style={[styles.healthStatValue, { color: stepsColor(healthData.steps) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{(healthData.steps / 1000).toFixed(1)}k</Text>
                        <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_steps')}</Text>
                      </View>
                      {(hasSleep || hasHrv || hasRestingHR) && (
                        <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                      )}
                    </>
                  )}
                  {hasSleep && (
                    <>
                      <View style={styles.todaySummaryItem}>
                        <Text style={[styles.healthStatValue, { color: sleepColor(healthData.sleep_duration!) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{healthData.sleep_duration}h</Text>
                        <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_sleep')}</Text>
                      </View>
                      {(hasHrv || hasRestingHR) && (
                        <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                      )}
                    </>
                  )}
                  {hasHrv && (
                    <>
                      <View style={styles.todaySummaryItem}>
                        <Text style={[styles.healthStatValue, { color: hrvColor(healthData.hrv!) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{healthData.hrv}</Text>
                        <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_hrv')}</Text>
                      </View>
                      {hasRestingHR && (
                        <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                      )}
                    </>
                  )}
                  {hasRestingHR && (
                    <View style={styles.todaySummaryItem}>
                      <Text style={[styles.healthStatValue, { color: restingHRColor(healthData.resting_heart_rate!) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{healthData.resting_heart_rate}bpm</Text>
                      <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_resting_hr')}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {weather && (
              <>
                {healthData && <View style={[styles.healthRowDivider, isDark && styles.healthRowDividerDark]} />}
                <View style={styles.todaySummaryRow}>
                  <View style={styles.todaySummaryItem}>
                    <Text style={[styles.healthStatValue, { color: temperatureColor(weather.apparentTemperature) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatTemperature(weather.apparentTemperature)}</Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_temperature')}</Text>
                  </View>
                  <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                  <View style={styles.todaySummaryItem}>
                    <Text style={[styles.healthStatValue, { color: uvIndexColor(weather.uvIndex) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{weather.uvIndex}</Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_uv_index')}</Text>
                  </View>
                  {weather.airQualityIndex !== null && (
                    <>
                      <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                      <View style={styles.todaySummaryItem}>
                        <Text style={[styles.healthStatValue, { color: airQualityColor(weather.airQualityIndex) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{weather.airQualityIndex}</Text>
                        <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_air_quality')}</Text>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        )}

        <MyaScoreCard score={myaScore} breakdown={scoreBreakdown} logs={weekLogs} isDark={isDark} t={t} />
        <SevenDayOverview logs={weekLogs} isDark={isDark} t={t} />

        <View style={styles.bottomPad} />
      </ScrollView>

      <PremiumModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onPurchase={handlePurchase}
        onRestore={handleRestore}
        monthlyPrice={monthlyPrice}
        trialDays={trialDays}
        isPurchasing={isPurchasing}
        isRestoring={isRestoring}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.backgroundDark },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerDate: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  crashBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.error + '15', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.error + '50',
    padding: Spacing.md,
  },
  crashBannerDark: { backgroundColor: Colors.error + '22' },
  crashBannerTitle: { fontSize: FontSize.sm, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.error },
  crashBannerSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  crashBannerLink: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.error },

  promptCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center',
  },
  promptCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  promptTitle: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, textAlign: 'center' },
  promptBody: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },

  todaySummaryCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  todaySummaryCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  todaySummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todaySummaryEdit: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.primary },
  todaySummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  todaySummaryItem: { alignItems: 'center', flex: 1, gap: 4 },
  todaySummaryValue: { fontSize: FontSize.xxl, fontWeight: '900', fontFamily: FontFamily.extraBold, lineHeight: 30, color: Colors.textPrimary },
  todaySummaryItemLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', fontFamily: FontFamily.medium, textAlign: 'center' },
  todaySummaryDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  todaySummaryDividerDark: { backgroundColor: Colors.borderDark },
  todaySummaryDividerH: { height: 1, backgroundColor: Colors.border },
  todaySummaryDividerHDark: { backgroundColor: Colors.borderDark },
  energyBarDividerSpacer: { paddingVertical: Spacing.xs },

  energyBarBlock: { gap: Spacing.sm },
  energyBarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  energyBarLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', fontFamily: FontFamily.semiBold },
  energyBarValue: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold },

  healthCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  healthCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  healthRowDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  healthRowDividerDark: { backgroundColor: Colors.borderDark },
  healthStatValue: { fontSize: FontSize.xl, fontWeight: '900', fontFamily: FontFamily.extraBold, lineHeight: 24, color: Colors.textPrimary },

  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: Colors.borderDark },
  progressFill: { height: '100%', borderRadius: 4 },

  bottomPad: { height: Spacing.xxl },

  // Signals to watch card
  riskCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  riskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  riskTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, flex: 1 },
  riskBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  riskSignals: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 },
  riskChip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  riskChipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },
  riskChatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  riskChatBtn: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  riskChatBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
  riskPremiumBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  riskPremiumBadgeText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '700', fontFamily: FontFamily.bold },

  // Mya Score card
  infoIcon: { fontSize: FontSize.lg },
  scoreHorizontalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreNumberBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  scoreNumberLarge: { fontSize: 48, fontWeight: '900', fontFamily: FontFamily.extraBold, lineHeight: 52 },
  scoreOutOf: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, paddingBottom: 6 },
  scoreBarBlock: { flex: 1, gap: 4 },
  scoreBarTrack: { height: 10, borderRadius: 5, backgroundColor: Colors.border, overflow: 'hidden' },
  scoreBarTrackDark: { backgroundColor: Colors.borderDark },
  scoreBarFill: { height: '100%', borderRadius: 5 },
  scoreBarLabel: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, marginTop: 2 },
  scoreHint: { fontSize: FontSize.xs, lineHeight: 16 },
  breakdownBox: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm, gap: 4 },
  breakdownBoxDark: { backgroundColor: '#2A2420' },
  breakdownTitle: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, marginBottom: 4 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  factorLabel: { fontSize: FontSize.xs },
  factorValue: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold },
  noDataText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // 7-day overview
  weekDotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekDotItem: { alignItems: 'center', gap: 4, flex: 1 },
  weekDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  weekDotNumber: { fontSize: FontSize.xs, fontWeight: '800', fontFamily: FontFamily.extraBold },
  weekDotDay: { fontSize: 10, fontWeight: '600', fontFamily: FontFamily.semiBold, textAlign: 'center' },
  weekLegendRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs },
  weekLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekLegendDot: { width: 8, height: 8, borderRadius: 4 },
  weekLegendText: { fontSize: 10 },
});
