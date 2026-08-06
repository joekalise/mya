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
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getDailyLogs, getRecentExertionEvents, getCrashes, getLatestDsqSfScore } from '@/services/database';
import { generateWeeklyInsight, WeeklyInsight } from '@/services/aiInsights';
import { DsqSfScore } from '@/types';

export default function InsightsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const { profile } = useProfile();

  const [logCount, setLogCount] = useState(0);
  const [latestDsq, setLatestDsq] = useState<DsqSfScore | null>(null);
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

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
      const result = await generateWeeklyInsight({ logs, exertionEvents, crashes, profile });
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
        <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('insights.title')}</Text>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('insights.ai_card_title')}</Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.backgroundDark },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
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
