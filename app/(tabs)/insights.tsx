import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Alert,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ProfileButton } from '@/components/common/ProfileButton';
import { InfoButton } from '@/components/common/InfoButton';
import { TrendChart } from '@/components/common/TrendChart';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getDailyLogs, getRecentExertionEvents, getCrashes, getLatestDsqSfScore, getStreak } from '@/services/database';
import { generateWeeklyInsight, WeeklyInsight } from '@/services/aiInsights';
import { useHealthHistory } from '@/hooks/useHealthHistory';
import { useRecoveryData } from '@/hooks/useRecoveryData';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/common/PremiumModal';
import { DsqSfScore, DailyLog } from '@/types';

type Period = 7 | 30 | 90 | 180;

// ─── DSQ-SF scoring ─────────────────────────────────────────────────────────────

// Frequency x severity per item, summed and normalised to 0-100. This is a
// composite symptom-burden indicator, not an official DSQ-SF classification
// score, the instrument itself doesn't reduce to one number in clinical use.
function computeDsqSfScore(score: DsqSfScore): number {
  let total = 0;
  for (let i = 1; i <= 14; i++) {
    const freq = (score as unknown as Record<string, number>)[`freq_${i}`] ?? 0;
    const sev = (score as unknown as Record<string, number>)[`sev_${i}`] ?? 0;
    total += freq * sev;
  }
  return Math.round((total / (14 * 4 * 4)) * 100);
}

function dsqSfInterpretation(score: number, t: (key: string) => string): { label: string; color: string } {
  if (score < 40) return { label: t('insights.dsq_sf_mild'), color: Colors.success };
  if (score < 60) return { label: t('insights.dsq_sf_moderate'), color: Colors.warning };
  return { label: t('insights.dsq_sf_severe'), color: Colors.error };
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
}

// ─── DSQ-SF hero card ─────────────────────────────────────────────────────────

function DsqSfHeroCard({ isDark, latest }: { isDark: boolean; latest: DsqSfScore | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  const daysSince = latest
    ? Math.floor((Date.now() - new Date(latest.date + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isDue = daysSince !== null && daysSince >= 30;
  const score = latest ? computeDsqSfScore(latest) : null;
  const interp = score !== null ? dsqSfInterpretation(score, t) : null;

  return (
    <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: isDue ? Colors.warning + '50' : Colors.border }, isDark && !isDue && { borderColor: Colors.borderDark }]}>
      <View style={styles.heroTitleRow}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>
          {isDue ? t('insights.dsq_sf_reassessment_due') : t('insights.dsq_sf_card_title')}
        </Text>
        <InfoButton title={t('insights.dsq_sf_card_title')} message={t('insights.dsq_sf_card_body')} color={textSecondary} />
      </View>

      {latest && isDue ? (
        <>
          <Text style={[styles.cardBody, { color: textSecondary }]}>
            {t('insights.dsq_sf_last_score_due', { score, label: interp!.label, days: daysSince })}
          </Text>
          <TouchableOpacity onPress={() => router.push('/dsq-sf')} activeOpacity={0.8} style={styles.heroTakeBtn}>
            <Text style={styles.heroTakeBtnText}>{t('insights.take_assessment')}</Text>
          </TouchableOpacity>
        </>
      ) : latest ? (
        <View style={styles.heroCompactRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroCompactLabel, { color: textSecondary }]}>{t('insights.dsq_sf_score_label')}</Text>
            <Text style={[styles.heroCompactScore, { color: interp!.color }]}>
              {score}<Text style={[styles.heroCompactLabel, { color: textSecondary }]}>/100</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.heroCompactInterp, { color: interp!.color }]}>{interp!.label}</Text>
            <Text style={[styles.heroCompactDate, { color: textSecondary }]}>
              {new Date(latest.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => router.push('/dsq-sf')} activeOpacity={0.8} style={[styles.heroRetakeBtn, { borderColor: Colors.primary }]}>
              <Text style={[styles.heroRetakeBtnText, { color: Colors.primary }]}>{t('insights.dsq_sf_retake')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.cardBody, { color: textSecondary }]}>{t('insights.dsq_sf_card_body')}</Text>
          <TouchableOpacity onPress={() => router.push('/dsq-sf')} activeOpacity={0.8} style={styles.heroTakeBtn}>
            <Text style={styles.heroTakeBtnText}>{t('insights.take_assessment')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── StatRow ────────────────────────────────────────────────────────────────────

function StatRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: isDark ? Colors.textSecondaryDark : Colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: isDark ? Colors.textPrimaryDark : Colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ─── InsightsScreen ─────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const { profile } = useProfile();
  const { history: healthHistory } = useHealthHistory(28);
  const { data: recoveryData } = useRecoveryData();
  const { isSubscribed, isLoading: subLoading, monthlyPrice, trialDays, purchase, restore } = useSubscription();

  const [logCount, setLogCount] = useState(0);
  const [latestDsq, setLatestDsq] = useState<DsqSfScore | null>(null);
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [period, setPeriod] = useState<Period>(30);
  const [periodLogs, setPeriodLogs] = useState<DailyLog[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [streak, setStreak] = useState(0);
  const [chartWidth, setChartWidth] = useState(300);

  function onCardLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  }

  const handlePurchase = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const success = await purchase();
      if (!success) Alert.alert('', t('profile.purchase_unavailable'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : String(err));
    } finally {
      setIsPurchasing(false);
    }
  }, [purchase, t]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (!success) Alert.alert('', t('profile.no_purchases'));
    } finally {
      setIsRestoring(false);
    }
  }, [restore, t]);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    setIsLoadingMeta(true);
    try {
      const [logs, dsq, s] = await Promise.all([
        getDailyLogs(user.id, 180),
        getLatestDsqSfScore(user.id),
        getStreak(user.id),
      ]);
      setLogCount(logs.length);
      setLatestDsq(dsq);
      setStreak(s);
    } catch (err) {
      console.error('Insights loadMeta error:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));

  useEffect(() => {
    if (!user) return;
    setIsLoadingChart(true);
    getDailyLogs(user.id, period)
      .then(setPeriodLogs)
      .catch((err) => console.error('Insights chart load error:', err))
      .finally(() => setIsLoadingChart(false));
  }, [user, period]);

  const handleGenerate = async () => {
    if (!user || !profile) return;
    setIsGenerating(true);
    try {
      const [logs, exertionEvents, crashes] = await Promise.all([
        getDailyLogs(user.id, 28),
        getRecentExertionEvents(user.id, 28),
        getCrashes(user.id, 20),
      ]);
      const result = await generateWeeklyInsight({ logs, exertionEvents, crashes, profile, healthHistory, recoveryData });
      setInsight(result);
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setIsGenerating(false);
    }
  };

  const axisLabel = (dateStr: string) =>
    period <= 7 ? dayLabel(dateStr) : new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const bellData = periodLogs.filter((l) => l.bell_score_today !== null).map((l) => l.bell_score_today as number);
  const bellLabels = periodLogs.filter((l) => l.bell_score_today !== null).map((l) => axisLabel(l.date));
  const cognitiveRaw = periodLogs.filter((l) => l.cognitive_dysfunction_score !== null);
  const cognitiveData = cognitiveRaw.map((l) => l.cognitive_dysfunction_score as number);
  const cognitiveLabels = cognitiveRaw.map((l) => axisLabel(l.date));

  const avgBell = bellData.length > 0 ? Math.round(bellData.reduce((a, b) => a + b, 0) / bellData.length) : null;
  const avgCognitive = cognitiveData.length > 0 ? (cognitiveData.reduce((a, b) => a + b, 0) / cognitiveData.length).toFixed(1) : null;

  let bestDay: string | null = null;
  if (periodLogs.length >= 14) {
    const dayMap: Record<string, number[]> = {};
    periodLogs.forEach((l) => {
      if (l.bell_score_today === null) return;
      const d = dayLabel(l.date);
      if (!dayMap[d]) dayMap[d] = [];
      dayMap[d].push(l.bell_score_today);
    });
    let maxAvg = -Infinity;
    for (const [day, scores] of Object.entries(dayMap)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestDay = day;
      }
    }
  }

  const hasEnoughDataForReport = logCount >= 7;

  const aiCardBg = isDark ? '#2D1A0E' : '#FFF7ED';
  const aiCardBorder = Colors.primary + '40';

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('insights.title')}</Text>
          <ProfileButton />
        </View>

        {!isLoadingMeta && <DsqSfHeroCard isDark={isDark} latest={latestDsq} />}

        {!subLoading && (
          isSubscribed ? (
            <>
              <View style={[styles.aiCard, { backgroundColor: aiCardBg, borderColor: aiCardBorder }]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.aiTitleRow}>
                    <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('insights.ai_card_title')}</Text>
                    <View style={styles.premiumBadge}>
                      <Text style={styles.premiumBadgeText}>{t('insights.premium_badge')}</Text>
                    </View>
                  </View>
                  <InfoButton title={t('insights.info_title')} message={t('insights.info_message')} />
                </View>

                {insight ? (
                  <View style={styles.insightBody}>
                    <Text style={[styles.insightSummary, isDark && styles.textPrimaryDark]}>{insight.summary}</Text>
                    {insight.points.map((p) => (
                      <View key={p.title} style={styles.insightPoint}>
                        <Text style={[styles.insightPointTitle, isDark && styles.textPrimaryDark]}>{p.title}</Text>
                        <Text style={[styles.insightPointDetail, isDark && styles.textSecDark]}>{p.detail}</Text>
                      </View>
                    ))}
                  </View>
                ) : logCount < 3 && !isLoadingMeta ? (
                  <Text style={[styles.cardBody, isDark && styles.textSecDark]}>{t('insights.not_enough_data')}</Text>
                ) : null}

                <Button
                  label={isGenerating ? t('insights.generating') : t('insights.generate')}
                  onPress={handleGenerate}
                  isLoading={isGenerating}
                  disabled={logCount < 3}
                  variant={insight ? 'outline' : 'primary'}
                />
              </View>

              <TouchableOpacity
                onPress={() => router.push('/ai-chat')}
                activeOpacity={0.8}
                style={[styles.aiCard, { backgroundColor: aiCardBg, borderColor: aiCardBorder }]}
              >
                <View style={styles.aiTitleRow}>
                  <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('insights.chat_card_title')}</Text>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>{t('insights.premium_badge')}</Text>
                  </View>
                </View>
                <Text style={[styles.cardBody, isDark && styles.textSecDark]}>{t('insights.chat_card_body')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.aiCard, { backgroundColor: aiCardBg, borderColor: Colors.primary + '50', borderWidth: 1.5 }]}>
              <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>
                {hasEnoughDataForReport ? t('insights.trial_prompt_title') : t('insights.trial_prompt_early_title')}
              </Text>
              <Text style={[styles.cardBody, isDark && styles.textSecDark]}>
                {hasEnoughDataForReport ? t('insights.trial_prompt_body') : t('insights.trial_prompt_early_body')}
              </Text>
              <View style={styles.benefitRow}>
                <View style={[styles.benefitChip, { borderColor: Colors.primary + '50' }]}>
                  <Text style={styles.benefitIcon}>📊</Text>
                  <Text style={[styles.benefitText, isDark && styles.textPrimaryDark]}>{t('insights.benefit_insight')}</Text>
                </View>
                <View style={[styles.benefitChip, { borderColor: Colors.primary + '50' }]}>
                  <Text style={styles.benefitIcon}>💬</Text>
                  <Text style={[styles.benefitText, isDark && styles.textPrimaryDark]}>{t('insights.benefit_chat')}</Text>
                </View>
              </View>
              <Button label={t('insights.unlock')} onPress={() => setShowPremiumModal(true)} variant="primary" />
            </View>
          )
        )}

        <View style={[styles.sectionDivider, { backgroundColor: isDark ? Colors.borderDark : Colors.border }]} />

        {logCount >= 10 && (
          <View style={styles.periodRow}>
            {([7, 30, 90, 180] as Period[]).map((p) => {
              const minLogs: Record<Period, number> = { 7: 1, 30: 10, 90: 30, 180: 60 };
              if (logCount < minLogs[p] && p !== 7) return null;
              const label = p === 7 ? '7d' : p === 30 ? '1m' : p === 90 ? '3m' : '6m';
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.8}
                  style={[
                    styles.periodBtn,
                    { backgroundColor: period === p ? Colors.primary : (isDark ? Colors.surfaceDark : Colors.surface), borderColor: period === p ? Colors.primary : (isDark ? Colors.borderDark : Colors.border) },
                  ]}
                >
                  <Text style={[styles.periodBtnText, { color: period === p ? '#FFFFFF' : (isDark ? Colors.textSecondaryDark : Colors.textSecondary) }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {isLoadingChart ? (
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('common.loading')}</Text>
          </View>
        ) : periodLogs.length === 0 ? (
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <Text style={[styles.emptyText, isDark && styles.textSecDark]}>{t('insights.no_data')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.section, isDark && styles.sectionDark]} onLayout={onCardLayout}>
              <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('insights.bell_score_trend')}</Text>
              {periodLogs.length < 7 && (
                <Text style={[styles.chartHint, isDark && styles.textSecDark]}>{t('insights.chart_fills_out')}</Text>
              )}
              <TrendChart
                series={[{ data: bellData, color: Colors.success, label: 'bell' }]}
                labels={bellLabels}
                height={100}
                minVal={0}
                maxVal={100}
                width={Math.max(10, chartWidth - Spacing.md * 2)}
              />
            </View>

            {cognitiveData.length > 0 && (
              <View style={[styles.section, isDark && styles.sectionDark]}>
                <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('insights.brain_fog_trend')}</Text>
                {periodLogs.length < 7 && (
                  <Text style={[styles.chartHint, isDark && styles.textSecDark]}>{t('insights.chart_fills_out')}</Text>
                )}
                <TrendChart
                  series={[{ data: cognitiveData, color: '#8B5CF6', label: t('insights.legend_cognitive') }]}
                  labels={cognitiveLabels}
                  height={100}
                  minVal={0}
                  maxVal={10}
                  width={Math.max(10, chartWidth - Spacing.md * 2)}
                />
              </View>
            )}

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.cardTitle, isDark && styles.textPrimaryDark]}>{t('insights.patterns')}</Text>
              {periodLogs.length < 7 && (
                <Text style={[styles.chartHint, isDark && styles.textSecDark]}>{t('insights.patterns_clearer')}</Text>
              )}
              <View style={styles.statsGrid}>
                <StatRow label={t('insights.avg_bell')} value={avgBell !== null ? `${avgBell}/100` : '—'} isDark={isDark} />
                {avgCognitive !== null && <StatRow label={t('insights.avg_cognitive')} value={`${avgCognitive}/10`} isDark={isDark} />}
                {bestDay && <StatRow label={t('insights.best_day')} value={bestDay} isDark={isDark} />}
                {streak > 0 && (
                  <StatRow
                    label={t('insights.log_streak')}
                    value={t(streak === 1 ? 'insights.streak_days_one' : 'insights.streak_days_other', { count: streak })}
                    isDark={isDark}
                  />
                )}
              </View>
            </View>
          </>
        )}

        <Text style={[styles.disclaimer, isDark && styles.textSecDark]}>{t('insights.disclaimer')}</Text>

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
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  section: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  cardBody: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.md, lineHeight: 20, color: Colors.textSecondary },
  chartHint: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, opacity: 0.85 },

  aiCard: { borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.md, gap: Spacing.sm },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  premiumBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  premiumBadgeText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '700', fontFamily: FontFamily.bold },

  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  benefitChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  benefitIcon: { fontSize: FontSize.sm },
  benefitText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textPrimary },

  insightBody: { gap: Spacing.sm },
  insightSummary: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.textPrimary },
  insightPoint: { gap: 2 },
  insightPointTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  insightPointDetail: { fontSize: FontSize.sm, lineHeight: 19, color: Colors.textSecondary },

  sectionDivider: { height: StyleSheet.hairlineWidth, marginTop: -Spacing.xs },

  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  periodBtnText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },

  legend: { flexDirection: 'row', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  statsGrid: { gap: Spacing.xs },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  statLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statValue: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },

  disclaimer: { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 17, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, opacity: 0.7, color: Colors.textSecondary },

  heroCard: { borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.md, gap: Spacing.sm },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  heroTakeBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  heroTakeBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold },
  heroCompactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xs },
  heroCompactLabel: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold },
  heroCompactScore: { fontSize: FontSize.xl, fontWeight: '900', fontFamily: FontFamily.extraBold },
  heroCompactInterp: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
  heroCompactDate: { fontSize: FontSize.xs, marginTop: 2 },
  heroRetakeBtn: { borderWidth: 1.5, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: Spacing.xs },
  heroRetakeBtnText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },

  bottomPad: { height: Spacing.xxl },
});
