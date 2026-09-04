import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/common/Button';
import { DragSlider } from '@/components/common/DragSlider';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { saveDailyLog } from '@/services/database';

function insightIcon(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('sleep')) return '😴';
  if (t.includes('crash') || t.includes('pem') || t.includes('exertion')) return '⚡';
  if (t.includes('energy') || t.includes('pacing') || t.includes('envelope')) return '🔋';
  if (t.includes('cognitive') || t.includes('brain fog') || t.includes('memory')) return '🧠';
  if (t.includes('fatigue') || t.includes('tired')) return '😮‍💨';
  if (t.includes('medication') || t.includes('medicine')) return '💊';
  if (t.includes('heart') || t.includes('orthostatic') || t.includes('standing')) return '❤️';
  return '💡';
}

const ACCENT_COLORS = [Colors.primary, Colors.secondary, Colors.success, Colors.warning];

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProfileReadyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { saveProfile, profile } = useProfile();
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const params = useLocalSearchParams<{ welcome_message: string; insights: string; watch_summary: string }>();

  const welcomeMessage = params.welcome_message ?? '';
  const insights: string[] = params.insights ? JSON.parse(params.insights) : [];
  const watchSummary = params.watch_summary ?? '';

  const initBell = profile?.bell_score_baseline ?? 70;
  const [bellScore, setBellScore] = useState(initBell);
  const [logSkipped, setLogSkipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const cardBorder = isDark ? Colors.borderDark : Colors.border;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  const handleEnterApp = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const tasks: Promise<unknown>[] = [
        saveProfile({ onboarding_complete: true, welcome_message: welcomeMessage }),
      ];

      if (!logSkipped) {
        tasks.push(
          saveDailyLog({
            user_id: user.id,
            date: localDateString(),
            bell_score_today: bellScore,
            fatigue_score: null,
            cognitive_dysfunction_score: null,
            pain_score: null,
            woke_rested: null,
            pem_today: false,
            dizzy_on_standing: null,
            palpitations: null,
            unsteady_on_feet: null,
            cold_limbs: null,
            temperature_dysregulation: null,
            flu_like_symptoms: null,
            sensory_chemical_reaction: null,
            medications_taken: (profile?.medications?.length ?? 0) > 0 && !profile?.medications?.includes('no_medication') ? 'yes' : null,
            medications_taken_dose_1: null,
            medications_taken_dose_2: null,
            medications_taken_dose_3: null,
            notes: '',
          })
        );
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error('ProfileReadyScreen save error:', err);
      Alert.alert(t('common.error'), t('profile_ready.error_save'));
    } finally {
      setIsSaving(false);
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{t('profile_ready.title')}</Text>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>{welcomeMessage}</Text>
        </View>

        {!logSkipped ? (
          <View style={[styles.logCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.logTitle, { color: textPrimary }]}>{t('profile_ready.log_title')}</Text>
              <TouchableOpacity onPress={() => setLogSkipped(true)} activeOpacity={0.7}>
                <Text style={[styles.skipLink, { color: textSecondary }]}>{t('common.skip')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.logHint, { color: textSecondary }]}>{t('profile_ready.log_hint')}</Text>

            <Text style={[styles.logLabel, { color: textSecondary }]}>
              {t('dashboard.bell_score')}  <Text style={{ color: textPrimary, fontWeight: '700', fontFamily: FontFamily.bold }}>{bellScore}</Text>
            </Text>
            <DragSlider value={bellScore} onChange={setBellScore} isDark={isDark} min={0} max={100} step={10} invertColor />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setLogSkipped(false)} style={styles.undoSkip} activeOpacity={0.7}>
            <Text style={[styles.skipLink, { color: Colors.primary }]}>{t('profile_ready.log_instead')}</Text>
          </TouchableOpacity>
        )}

        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile_ready.insights_title')}</Text>
            {insights.map((insight, idx) => {
              const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
              return (
                <View key={idx} style={[styles.insightCard, { backgroundColor: cardBg, borderColor: cardBorder, borderLeftColor: accent }]}>
                  <Text style={styles.insightIcon}>{insightIcon(insight)}</Text>
                  <Text style={[styles.insightText, { color: textPrimary }]}>{insight}</Text>
                </View>
              );
            })}
          </View>
        )}

        {watchSummary.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile_ready.watch_title')}</Text>
            <View style={[styles.watchCard, { backgroundColor: isDark ? Colors.surfaceDark : '#EFF6FF', borderColor: Colors.secondary + '50' }]}>
              <Text style={styles.watchIcon}>👀</Text>
              <Text style={[styles.watchText, { color: isDark ? Colors.textPrimaryDark : '#0C4A6E' }]}>{watchSummary}</Text>
            </View>
          </View>
        )}

        <Button label={t('common.lets_go')} onPress={handleEnterApp} isLoading={isSaving} style={styles.cta} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.backgroundDark },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, textAlign: 'center' },
  titleDark: { color: Colors.textPrimaryDark },

  welcomeCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  welcomeText: { fontSize: FontSize.md, color: '#FFFFFF', lineHeight: 24, fontWeight: '500', fontFamily: FontFamily.medium },

  logCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  logTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold },
  logHint: { fontSize: FontSize.xs, marginBottom: Spacing.md },
  logLabel: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  skipLink: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
  undoSkip: { marginBottom: Spacing.xl, alignItems: 'center', paddingVertical: Spacing.sm },

  section: { marginBottom: Spacing.xl },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.8, marginBottom: Spacing.sm },
  insightCard: { borderWidth: 1, borderLeftWidth: 4, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  insightIcon: { fontSize: 20, width: 28, textAlign: 'center', marginTop: 1 },
  insightText: { fontSize: FontSize.sm, lineHeight: 20, flex: 1 },

  watchCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  watchIcon: { fontSize: 20, width: 28, textAlign: 'center', marginTop: 1 },
  watchText: { fontSize: FontSize.sm, lineHeight: 20, flex: 1 },

  cta: { marginTop: Spacing.md },
});
