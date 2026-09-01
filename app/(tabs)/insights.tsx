import React, { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ProfileButton } from '@/components/common/ProfileButton';
import { InfoButton } from '@/components/common/InfoButton';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getDailyLogs, getRecentExertionEvents, getCrashes, getLatestDsqSfScore } from '@/services/database';
import { generateWeeklyInsight, WeeklyInsight } from '@/services/aiInsights';
import { useHealthHistory } from '@/hooks/useHealthHistory';
import { useRecoveryData } from '@/hooks/useRecoveryData';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/common/PremiumModal';
import { DsqSfScore } from '@/types';

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
      const [logs, dsq] = await Promise.all([
        getDailyLogs(user.id, 28),
        getLatestDsqSfScore(user.id),
      ]);
      setLogCount(logs.length);
      setLatestDsq(dsq);
    } catch (err) {
      console.error('Insights loadMeta error:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));

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

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('insights.title')}</Text>
          <ProfileButton />
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('insights.ai_card_title')}</Text>
            <InfoButton title={t('insights.info_title')} message={t('insights.info_message')} />
          </View>

          {!subLoading && !isSubscribed ? (
            <>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('insights.premium_hint')}</Text>
              <Button label={t('insights.unlock')} onPress={() => setShowPremiumModal(true)} variant="primary" />
            </>
          ) : (
            <>
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
                <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('insights.not_enough_data')}</Text>
              ) : null}

              <Button
                label={isGenerating ? t('insights.generating') : t('insights.generate')}
                onPress={handleGenerate}
                isLoading={isGenerating}
                disabled={logCount < 3}
                variant={insight ? 'outline' : 'primary'}
              />
            </>
          )}
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('insights.chat_card_title')}</Text>
          <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('insights.chat_card_body')}</Text>
          <Button label={t('insights.chat_card_button')} onPress={() => router.push('/ai-chat')} variant="outline" />
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('insights.dsq_sf_card_title')}</Text>
          <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('insights.dsq_sf_card_body')}</Text>
          <Text style={[styles.hint, isDark && styles.textSecDark]}>
            {latestDsq
              ? t('insights.dsq_sf_last_taken', { date: new Date(latestDsq.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) })
              : t('insights.dsq_sf_never_taken')}
          </Text>
          <Button label={t('insights.take_assessment')} onPress={() => router.push('/dsq-sf')} variant="outline" />
        </View>

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
  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },

  insightBody: { gap: Spacing.sm },
  insightSummary: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.textPrimary },
  insightPoint: { gap: 2 },
  insightPointTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  insightPointDetail: { fontSize: FontSize.sm, lineHeight: 19, color: Colors.textSecondary },

  bottomPad: { height: Spacing.xxl },
});
