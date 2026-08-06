import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DragSlider } from '@/components/common/DragSlider';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useDailyLog } from '@/hooks/useDailyLog';
import { useAuth } from '@/contexts/AuthContext';
import { MedsTaken } from '@/types';

function todayDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const SYMPTOM_FLAGS = [
  'dizzy_on_standing',
  'palpitations',
  'unsteady_on_feet',
  'cold_limbs',
  'temperature_dysregulation',
  'flu_like_symptoms',
  'sensory_chemical_reaction',
] as const;

type SymptomFlag = (typeof SYMPTOM_FLAGS)[number];

export default function TodayScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const { todayLog, todayLogged, streak, isLoading, error, saveLog, refresh } = useDailyLog();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [editing, setEditing] = useState(false);
  const [bellScore, setBellScore] = useState(70);
  const [fatigueScore, setFatigueScore] = useState(0);
  const [cognitiveScore, setCognitiveScore] = useState(0);
  const [painScore, setPainScore] = useState(0);
  const [wokeRested, setWokeRested] = useState<boolean | null>(null);
  const [pemToday, setPemToday] = useState(false);
  const [flags, setFlags] = useState<Set<SymptomFlag>>(new Set());
  const [medsTaken, setMedsTaken] = useState<MedsTaken>('yes');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (todayLog) {
      setBellScore(todayLog.bell_score_today ?? 70);
      setFatigueScore(todayLog.fatigue_score);
      setCognitiveScore(todayLog.cognitive_dysfunction_score ?? 0);
      setPainScore(todayLog.pain_score ?? 0);
      setWokeRested(todayLog.woke_rested ?? null);
      setPemToday(todayLog.pem_today);
      const nextFlags = new Set<SymptomFlag>();
      SYMPTOM_FLAGS.forEach((f) => {
        if (todayLog[f]) nextFlags.add(f);
      });
      setFlags(nextFlags);
      setMedsTaken(todayLog.medications_taken ?? 'yes');
      setNotes(todayLog.notes ?? '');
    }
    setEditing(false);
    setSaved(false);
  }, [todayLog]);

  const toggleFlag = (flag: SymptomFlag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await saveLog({
        bell_score_today: bellScore,
        fatigue_score: fatigueScore,
        cognitive_dysfunction_score: cognitiveScore,
        pain_score: painScore,
        woke_rested: wokeRested,
        pem_today: pemToday,
        dizzy_on_standing: flags.has('dizzy_on_standing'),
        palpitations: flags.has('palpitations'),
        unsteady_on_feet: flags.has('unsteady_on_feet'),
        cold_limbs: flags.has('cold_limbs'),
        temperature_dysregulation: flags.has('temperature_dysregulation'),
        flu_like_symptoms: flags.has('flu_like_symptoms'),
        sensory_chemical_reaction: flags.has('sensory_chemical_reaction'),
        medications_taken: medsTaken,
        notes,
      });
      setEditing(false);
      setSaved(true);
    } catch {
      Alert.alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const showForm = !todayLogged || editing;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]} />
    );
  }

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <Text style={[styles.headerDate, isDark && styles.textPrimaryDark]}>
            {todayDateLabel()}
          </Text>
        </View>

        {error && <ErrorMessage message={error} />}

        {todayLogged && !editing && (
          <View style={[styles.loggedCard, isDark && styles.loggedCardDark]}>
            <View style={styles.loggedCardHeader}>
              <Text style={styles.loggedTick}>✓</Text>
              <View style={styles.loggedCardTextGroup}>
                <Text style={[styles.loggedTitle, isDark && styles.textPrimaryDark]}>
                  {t('tracker.already_logged_title')}
                </Text>
                <Text style={[styles.loggedSubtitle, isDark && styles.textSecDark]}>
                  {t('tracker.already_logged_subtitle')}
                </Text>
              </View>
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeText}>🔥 {streak}</Text>
                </View>
              )}
            </View>
            <Button label={t('tracker.edit_today')} onPress={() => setEditing(true)} variant="outline" />
          </View>
        )}

        {saved && !editing && (
          <View style={[styles.successCard, isDark && styles.successCardDark]}>
            <Text style={styles.successText}>{t('tracker.saved_success')}</Text>
          </View>
        )}

        {showForm && (
          <>
            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>
                {t('tracker.bell_score_today')}
              </Text>
              <DragSlider value={bellScore} onChange={setBellScore} isDark={isDark} min={0} max={100} step={10} invertColor />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.bell_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.fatigue_score')}</Text>
              <DragSlider value={fatigueScore} onChange={setFatigueScore} isDark={isDark} />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.fatigue_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.cognitive_dysfunction_score')}</Text>
              <DragSlider value={cognitiveScore} onChange={setCognitiveScore} isDark={isDark} />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.cognitive_dysfunction_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.pain_score')}</Text>
              <DragSlider value={painScore} onChange={setPainScore} isDark={isDark} />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.pain_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark, styles.pemSection]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, styles.pemLabel]}>
                  {t('tracker.pem_today')}
                </Text>
                <Switch
                  value={pemToday}
                  onValueChange={setPemToday}
                  trackColor={{ true: Colors.error, false: isDark ? Colors.borderDark : Colors.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.pem_today_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>
                  {t('tracker.woke_rested')}
                </Text>
                <Switch
                  value={wokeRested === true}
                  onValueChange={(v) => setWokeRested(v)}
                  trackColor={{ true: Colors.primary, false: isDark ? Colors.borderDark : Colors.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.woke_rested_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.other_symptoms_today')}</Text>
              <View style={styles.chipRow}>
                {SYMPTOM_FLAGS.map((flag) => {
                  const selected = flags.has(flag);
                  return (
                    <TouchableOpacity
                      key={flag}
                      onPress={() => toggleFlag(flag)}
                      activeOpacity={0.7}
                      style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                        {t(`tracker.${flag}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.medications_taken')}</Text>
              <View style={styles.medsRow}>
                {(['yes', 'partial', 'no'] as MedsTaken[]).map((opt) => {
                  const selected = medsTaken === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setMedsTaken(opt)}
                      style={[
                        styles.medsButton,
                        isDark && styles.medsButtonDark,
                        selected && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.optionLabel,
                        isDark && styles.textSecDark,
                        selected && { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold },
                      ]}>
                        {t(`tracker.medications_${opt}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.notes')}</Text>
              <TextInput
                style={[styles.notesInput, isDark && styles.notesInputDark]}
                placeholder={t('tracker.notes_placeholder')}
                placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, 500))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Button label={t('tracker.save')} onPress={handleSave} isLoading={isSaving} style={styles.saveButton} />
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
  header: { paddingBottom: Spacing.xs },
  headerDate: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.extraBold,
    color: Colors.textPrimary,
  },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  loggedCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  loggedCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  loggedCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loggedTick: { fontSize: FontSize.xl, color: Colors.success, fontWeight: '700', fontFamily: FontFamily.bold },
  loggedCardTextGroup: { flex: 1 },
  loggedTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  loggedSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  streakBadge: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  streakBadgeText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '700' },

  successCard: {
    backgroundColor: Colors.success + '18',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  successCardDark: { backgroundColor: Colors.success + '22' },
  successText: { color: Colors.success, fontWeight: '700', fontFamily: FontFamily.bold },

  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },

  pemSection: { borderColor: Colors.error + '50' },
  pemLabel: { marginBottom: 0 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipDark: { borderColor: Colors.borderDark },
  chipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  chipTextDark: { color: Colors.textPrimaryDark },
  chipTextSelected: { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold },

  medsRow: { flexDirection: 'row', gap: Spacing.sm },
  medsButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  medsButtonDark: { borderColor: Colors.borderDark },
  optionLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },

  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
    minHeight: 90,
  },
  notesInputDark: { borderColor: Colors.borderDark, color: Colors.textPrimaryDark, backgroundColor: Colors.surfaceDark },

  saveButton: { marginTop: Spacing.sm },
  bottomPad: { height: Spacing.xxl },
});
