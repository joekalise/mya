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
import { ProfileButton } from '@/components/common/ProfileButton';

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
  const { todayLog, todayLogged, streak, isLoading: logLoading, refresh: refreshLog } = useDailyLog();
  const { available, spent, isLoading: envelopeLoading, refresh: refreshEnvelope } = useEnergyEnvelope();
  const { activeCrash, isLoading: crashLoading, refresh: refreshCrashes } = useCrashes();

  useFocusEffect(useCallback(() => {
    refreshLog();
    refreshEnvelope();
    refreshCrashes();
  }, [refreshLog, refreshEnvelope, refreshCrashes]));

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
          <>
            <View style={[styles.statGrid]}>
              <View style={[styles.statCard, isDark && styles.statCardDark]}>
                <Text style={[styles.statValue, isDark && styles.textPrimaryDark]}>{todayLog?.bell_score_today ?? '—'}</Text>
                <Text style={[styles.statLabel, isDark && styles.textSecDark]}>{t('dashboard.bell_score')}</Text>
              </View>
              <View style={[styles.statCard, isDark && styles.statCardDark]}>
                <Text style={[styles.statValue, isDark && styles.textPrimaryDark]}>{todayLog?.fatigue_score ?? '—'}/10</Text>
                <Text style={[styles.statLabel, isDark && styles.textSecDark]}>{t('dashboard.fatigue')}</Text>
              </View>
              <View style={[styles.statCard, isDark && styles.statCardDark]}>
                <Text style={[styles.statValue, isDark && styles.textPrimaryDark]}>{todayLog?.cognitive_dysfunction_score ?? '—'}/10</Text>
                <Text style={[styles.statLabel, isDark && styles.textSecDark]}>{t('dashboard.cognitive')}</Text>
              </View>
              {streak > 0 && (
                <View style={[styles.statCard, isDark && styles.statCardDark]}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>🔥 {streak}</Text>
                  <Text style={[styles.statLabel, isDark && styles.textSecDark]}>{t('dashboard.streak')}</Text>
                </View>
              )}
            </View>

            {available !== null && (
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

            <TouchableOpacity onPress={() => router.push('/(tabs)/pace')}>
              <Text style={styles.editLink}>{t('tracker.edit_today')}</Text>
            </TouchableOpacity>
          </>
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

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flexGrow: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  statCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  statValue: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },

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
