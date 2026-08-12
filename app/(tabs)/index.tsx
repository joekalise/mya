import React, { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useDailyLog } from '@/hooks/useDailyLog';
import { useEnergyEnvelope } from '@/hooks/useEnergyEnvelope';
import { useCrashes } from '@/hooks/useCrashes';
import { useHealthData } from '@/hooks/useHealthData';
import { ProfileButton } from '@/components/common/ProfileButton';

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

function todayDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000));
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { todayLog, todayLogged, isLoading: logLoading, refresh: refreshLog } = useDailyLog();
  const { available, spent, isLoading: envelopeLoading, refresh: refreshEnvelope } = useEnergyEnvelope();
  const { activeCrash, isLoading: crashLoading, refresh: refreshCrashes } = useCrashes();
  const { isConnected: healthConnected, todayData: healthData, recheck: recheckHealth } = useHealthData();

  useFocusEffect(useCallback(() => {
    refreshLog();
    refreshEnvelope();
    refreshCrashes();
    recheckHealth();
  }, [refreshLog, refreshEnvelope, refreshCrashes, recheckHealth]));

  const isLoading = logLoading || envelopeLoading || crashLoading;

  if (isLoading) {
    return <SafeAreaView style={[styles.screen, isDark && styles.screenDark]} />;
  }

  const overBudget = spent !== null && available !== null && spent > available;
  const fillPct = available && available > 0 ? Math.min(100, ((spent ?? 0) / available) * 100) : 0;

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerDate, isDark && styles.textPrimaryDark]}>{todayDateLabel()}</Text>
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
              <TouchableOpacity onPress={() => router.push('/(tabs)/pace')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.todaySummaryEdit}>{t('dashboard.edit')}</Text>
              </TouchableOpacity>
            </View>
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
                  todayLog?.fatigue_score !== null && todayLog?.fatigue_score !== undefined
                    ? { color: severityScoreColor(todayLog.fatigue_score) }
                    : (isDark && styles.textPrimaryDark),
                ]}>{todayLog?.fatigue_score ?? '—'}</Text>
                <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.fatigue')}</Text>
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

        {/* Independent of manual logging — HealthKit syncs on its own */}
        {healthConnected && healthData && (
          <View style={[styles.healthCard, isDark && styles.healthCardDark]}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.health_title')}</Text>
            <View style={styles.todaySummaryRow}>
              {healthData.steps !== null && (
                <>
                  <View style={styles.todaySummaryItem}>
                    <Text style={[styles.healthStatValue, { color: stepsColor(healthData.steps) }]}>{(healthData.steps / 1000).toFixed(1)}k</Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_steps')}</Text>
                  </View>
                  {(healthData.sleep_duration !== null || healthData.hrv !== null) && (
                    <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                  )}
                </>
              )}
              {healthData.sleep_duration !== null && (
                <>
                  <View style={styles.todaySummaryItem}>
                    <Text style={[styles.healthStatValue, { color: sleepColor(healthData.sleep_duration) }]}>{healthData.sleep_duration}h</Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_sleep')}</Text>
                  </View>
                  {healthData.hrv !== null && (
                    <View style={[styles.todaySummaryDivider, isDark && styles.todaySummaryDividerDark]} />
                  )}
                </>
              )}
              {healthData.hrv !== null && (
                <View style={styles.todaySummaryItem}>
                  <Text style={[styles.healthStatValue, { color: hrvColor(healthData.hrv) }]}>{healthData.hrv}</Text>
                  <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_hrv')}</Text>
                </View>
              )}
            </View>
            {healthData.resting_heart_rate !== null && (
              <>
                <View style={[styles.healthRowDivider, isDark && styles.healthRowDividerDark]} />
                <View style={styles.todaySummaryRow}>
                  <View style={styles.todaySummaryItem}>
                    <Text style={[styles.healthStatValue, { color: restingHRColor(healthData.resting_heart_rate) }]}>{healthData.resting_heart_rate}bpm</Text>
                    <Text style={[styles.todaySummaryItemLabel, isDark && styles.textSecDark]}>{t('dashboard.health_resting_hr')}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {todayLogged && available !== null && (
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('dashboard.energy')}</Text>
            <View style={[styles.progressTrack, isDark && styles.progressTrackDark]}>
              <View style={[styles.progressFill, { width: `${fillPct}%`, backgroundColor: overBudget ? Colors.error : Colors.success }]} />
            </View>
            <Text style={[styles.hint, isDark && styles.textSecDark]}>
              {spent ?? 0} / {available}
            </Text>
          </View>
        )}

        {todayLogged && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/pace')}>
            <Text style={styles.editLink}>{t('tracker.edit_today')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
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
  todaySummaryItemLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', fontFamily: FontFamily.medium },
  todaySummaryDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  todaySummaryDividerDark: { backgroundColor: Colors.borderDark },

  healthCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  healthCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  healthRowDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  healthRowDividerDark: { backgroundColor: Colors.borderDark },
  healthStatValue: { fontSize: FontSize.xxl, fontWeight: '900', fontFamily: FontFamily.extraBold, lineHeight: 30, color: Colors.textPrimary },

  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  sectionDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: Colors.borderDark },
  progressFill: { height: '100%', borderRadius: 4 },

  editLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', textAlign: 'center' },

  bottomPad: { height: Spacing.xxl },
});
