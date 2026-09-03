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
import { ProfileButton } from '@/components/common/ProfileButton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InfoButton } from '@/components/common/InfoButton';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useDailyLog } from '@/hooks/useDailyLog';
import { useEnergyEnvelope } from '@/hooks/useEnergyEnvelope';
import { useMedicationTracking } from '@/hooks/useMedicationTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { MedsTaken, ExertionType } from '@/types';

function todayDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function deriveMedicationsTaken(doses: MedsTaken[]): MedsTaken {
  if (doses.every((d) => d === 'yes')) return 'yes';
  if (doses.every((d) => d === 'no')) return 'no';
  return 'partial';
}

const EXERTION_TYPES: ExertionType[] = ['physical', 'cognitive', 'emotional', 'social'];
const DURATION_PRESETS = [15, 30, 45, 60, 90];
const MEDS_OPTIONS: MedsTaken[] = ['yes', 'partial', 'no'];

export default function PaceScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const { profile } = useProfile();
  const { todayLog, todayLogged, streak, isLoading: logLoading, error, saveLog, refresh: refreshLog } = useDailyLog();
  const {
    available, spent, events, isLoading: envelopeLoading,
    saveEnvelope, addEvent, removeEvent, refresh: refreshEnvelope,
  } = useEnergyEnvelope();
  const { tracks: tracksMedication } = useMedicationTracking();
  const medicationDosesPerDay = profile?.medication_doses_per_day ?? 1;

  useFocusEffect(useCallback(() => { refreshLog(); refreshEnvelope(); }, [refreshLog, refreshEnvelope]));

  const [editing, setEditing] = useState(false);
  const [energyAvailable, setEnergyAvailable] = useState(70);
  const [energySpent, setEnergySpent] = useState(0);
  const [bellScore, setBellScore] = useState(70);
  const [fatigueScore, setFatigueScore] = useState(0);
  const [cognitiveScore, setCognitiveScore] = useState(0);
  const [wokeRested, setWokeRested] = useState<boolean | null>(null);
  const [pemToday, setPemToday] = useState(false);
  const [medsTaken, setMedsTaken] = useState<MedsTaken>('yes');
  const [medsTakenDose1, setMedsTakenDose1] = useState<MedsTaken>('yes');
  const [medsTakenDose2, setMedsTakenDose2] = useState<MedsTaken>('yes');
  const [medsTakenDose3, setMedsTakenDose3] = useState<MedsTaken>('yes');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExertionForm, setShowExertionForm] = useState(false);
  const [exertionType, setExertionType] = useState<ExertionType>('physical');
  const [exertionIntensity, setExertionIntensity] = useState(3);
  const [exertionDuration, setExertionDuration] = useState<number | null>(30);
  const [exertionNotes, setExertionNotes] = useState('');
  const [isAddingExertion, setIsAddingExertion] = useState(false);

  useEffect(() => {
    if (todayLog) {
      setBellScore(todayLog.bell_score_today ?? 70);
      setFatigueScore(todayLog.fatigue_score);
      setCognitiveScore(todayLog.cognitive_dysfunction_score ?? 0);
      setWokeRested(todayLog.woke_rested ?? null);
      setPemToday(todayLog.pem_today);
      setMedsTaken(todayLog.medications_taken ?? 'yes');
      setMedsTakenDose1(todayLog.medications_taken_dose_1 ?? 'yes');
      setMedsTakenDose2(todayLog.medications_taken_dose_2 ?? 'yes');
      setMedsTakenDose3(todayLog.medications_taken_dose_3 ?? 'yes');
      setNotes(todayLog.notes ?? '');
    }
    setEditing(false);
    setSaved(false);
  }, [todayLog]);

  useEffect(() => {
    setEnergyAvailable(available ?? 70);
    setEnergySpent(spent ?? 0);
  }, [available, spent]);

  const alreadyLoggedToday = todayLogged && available !== null;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        saveLog({
          bell_score_today: bellScore,
          fatigue_score: fatigueScore,
          cognitive_dysfunction_score: cognitiveScore,
          pain_score: null,
          woke_rested: wokeRested,
          pem_today: pemToday,
          dizzy_on_standing: null,
          palpitations: null,
          unsteady_on_feet: null,
          cold_limbs: null,
          temperature_dysregulation: null,
          flu_like_symptoms: null,
          sensory_chemical_reaction: null,
          medications_taken: medicationDosesPerDay > 1
            ? deriveMedicationsTaken([medsTakenDose1, medsTakenDose2, medsTakenDose3].slice(0, medicationDosesPerDay))
            : medsTaken,
          medications_taken_dose_1: medicationDosesPerDay > 1 ? medsTakenDose1 : null,
          medications_taken_dose_2: medicationDosesPerDay > 1 ? medsTakenDose2 : null,
          medications_taken_dose_3: medicationDosesPerDay > 2 ? medsTakenDose3 : null,
          notes,
        }),
        saveEnvelope(energyAvailable, energySpent),
      ]);
      setEditing(false);
      setSaved(true);
    } catch {
      Alert.alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExertion = async () => {
    setIsAddingExertion(true);
    try {
      await addEvent(exertionType, exertionIntensity, exertionDuration, exertionNotes);
      setExertionNotes('');
      setShowExertionForm(false);
    } catch {
      Alert.alert('Failed to save exertion');
    } finally {
      setIsAddingExertion(false);
    }
  };

  const showForm = !alreadyLoggedToday || editing;
  const isLoading = logLoading || envelopeLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <LoadingSpinner fullScreen message={t('common.loading')} />
      </SafeAreaView>
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
        <View style={styles.headerRow}>
          <Text style={[styles.headerDate, isDark && styles.textPrimaryDark]}>{todayDateLabel()}</Text>
          <ProfileButton />
        </View>

        {error && <ErrorMessage message={error} />}

        {alreadyLoggedToday && !editing && (
          <View style={[styles.loggedCard, isDark && styles.loggedCardDark]}>
            <View style={styles.loggedCardHeader}>
              <Text style={styles.loggedTick}>✓</Text>
              <View style={styles.loggedCardTextGroup}>
                <Text style={[styles.loggedTitle, isDark && styles.textPrimaryDark]}>{t('tracker.already_logged_title')}</Text>
                <Text style={[styles.loggedSubtitle, isDark && styles.textSecDark]}>{t('tracker.already_logged_subtitle')}</Text>
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
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>{t('pace.energy_envelope')}</Text>
                <InfoButton title={t('pace.energy_envelope')} message={t('pace.envelope_info')} />
              </View>
              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.available')}</Text>
              <DragSlider value={energyAvailable} onChange={setEnergyAvailable} isDark={isDark} min={0} max={100} step={10} invertColor />
              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.spent')}</Text>
              <DragSlider value={energySpent} onChange={setEnergySpent} isDark={isDark} min={0} max={100} step={10} />
              {energySpent > energyAvailable && (
                <Text style={styles.overBudgetText}>⚠ {t('pace.over_budget')}</Text>
              )}
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>{t('tracker.bell_score_today')}</Text>
                <InfoButton title={t('tracker.bell_score_info_title')} message={t('tracker.bell_score_info_message')} />
              </View>
              <DragSlider value={bellScore} onChange={setBellScore} isDark={isDark} min={0} max={100} step={10} invertColor />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.bell_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>{t('tracker.fatigue_score')}</Text>
                <InfoButton title={t('tracker.fatigue_score_info_title')} message={t('tracker.fatigue_score_info_message')} />
              </View>
              <DragSlider value={fatigueScore} onChange={setFatigueScore} isDark={isDark} />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.fatigue_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.cognitive_dysfunction_score')}</Text>
              <DragSlider value={cognitiveScore} onChange={setCognitiveScore} isDark={isDark} />
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.cognitive_dysfunction_score_hint')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark, styles.pemSection]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, styles.pemLabel]}>{t('tracker.pem_today')}</Text>
                <Switch
                  value={pemToday}
                  onValueChange={setPemToday}
                  trackColor={{ true: Colors.error, false: isDark ? Colors.borderDark : Colors.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.pem_today_hint')}</Text>
              <Text style={styles.pemSignpost}>{t('tracker.pem_today_signpost')}</Text>
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>{t('tracker.woke_rested')}</Text>
                <Switch
                  value={wokeRested === true}
                  onValueChange={(v) => setWokeRested(v)}
                  trackColor={{ true: Colors.primary, false: isDark ? Colors.borderDark : Colors.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.woke_rested_hint')}</Text>
            </View>

            {tracksMedication && (
              <View style={[styles.section, isDark && styles.sectionDark]}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.medications_taken')}</Text>
                {medicationDosesPerDay > 1 ? (
                  (medicationDosesPerDay === 3
                    ? [
                        { label: t('tracker.medications_morning'), value: medsTakenDose1, onSelect: setMedsTakenDose1 },
                        { label: t('tracker.medications_afternoon'), value: medsTakenDose2, onSelect: setMedsTakenDose2 },
                        { label: t('tracker.medications_evening'), value: medsTakenDose3, onSelect: setMedsTakenDose3 },
                      ]
                    : [
                        { label: t('tracker.medications_morning'), value: medsTakenDose1, onSelect: setMedsTakenDose1 },
                        { label: t('tracker.medications_evening'), value: medsTakenDose2, onSelect: setMedsTakenDose2 },
                      ]
                  ).map((dose, i) => (
                    <View key={dose.label} style={i > 0 ? { marginTop: Spacing.md } : undefined}>
                      <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{dose.label}</Text>
                      <View style={styles.medsRow}>
                        {MEDS_OPTIONS.map((opt) => {
                          const selected = dose.value === opt;
                          return (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => dose.onSelect(opt)}
                              style={[styles.medsButton, isDark && styles.medsButtonDark, selected && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.optionLabel, isDark && styles.textSecDark, selected && { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold }]}>
                                {t(`tracker.medications_${opt}`)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.medsRow}>
                    {MEDS_OPTIONS.map((opt) => {
                      const selected = medsTaken === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setMedsTaken(opt)}
                          style={[styles.medsButton, isDark && styles.medsButtonDark, selected && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.optionLabel, isDark && styles.textSecDark, selected && { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold }]}>
                            {t(`tracker.medications_${opt}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

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

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <TouchableOpacity onPress={() => setShowExertionForm((v) => !v)} activeOpacity={0.7}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>
              {showExertionForm ? '− ' : '+ '}{t('pace.log_exertion_optional')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('pace.log_exertion_hint')}</Text>

          {showExertionForm && (
            <>
              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.exertion_type')}</Text>
              <View style={styles.chipRow}>
                {EXERTION_TYPES.map((v) => {
                  const selected = exertionType === v;
                  return (
                    <TouchableOpacity key={v} onPress={() => setExertionType(v)} style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>{t(`pace.type_${v}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.intensity')}</Text>
              <View style={styles.chipRow}>
                {[1, 2, 3, 4, 5].map((v) => {
                  const selected = exertionIntensity === v;
                  return (
                    <TouchableOpacity key={v} onPress={() => setExertionIntensity(v)} style={[styles.intensityBtn, isDark && styles.chipDark, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.duration_minutes')}</Text>
              <View style={styles.chipRow}>
                {DURATION_PRESETS.map((m) => {
                  const selected = exertionDuration === m;
                  return (
                    <TouchableOpacity key={m} onPress={() => setExertionDuration(selected ? null : m)} style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={[styles.notesInput, isDark && styles.notesInputDark]}
                placeholder={t('pace.notes_optional')}
                placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
                value={exertionNotes}
                onChangeText={setExertionNotes}
              />
              <Button label={t('pace.add')} onPress={handleAddExertion} isLoading={isAddingExertion} />
            </>
          )}

          {events.length > 0 && (
            <View style={styles.eventList}>
              {events.map((event) => (
                <View key={event.id} style={[styles.eventRow, isDark && styles.eventRowDark]}>
                  <Text style={[styles.eventTitle, isDark && styles.textPrimaryDark]}>
                    {t(`pace.type_${event.exertion_type}`)} · {t('pace.intensity')} {event.intensity}
                    {event.duration_minutes ? ` · ${event.duration_minutes}min` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => event.id && removeEvent(event.id)}>
                    <Text style={styles.removeText}>{t('pace.remove')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerDate: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  loggedCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  loggedCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  loggedCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loggedTick: { fontSize: FontSize.xl, color: Colors.success, fontWeight: '700', fontFamily: FontFamily.bold },
  loggedCardTextGroup: { flex: 1 },
  loggedTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  loggedSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  streakBadge: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  streakBadgeText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '700' },

  successCard: { backgroundColor: Colors.success + '18', borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' },
  successCardDark: { backgroundColor: Colors.success + '22' },
  successText: { color: Colors.success, fontWeight: '700', fontFamily: FontFamily.bold },

  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  sectionDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  overBudgetText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },

  pemSection: { borderColor: Colors.error + '50' },
  pemLabel: { marginBottom: 0 },
  pemSignpost: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600', marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  intensityBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  chipDark: { borderColor: Colors.borderDark },
  chipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  chipTextDark: { color: Colors.textPrimaryDark },
  chipTextSelected: { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold },

  medsRow: { flexDirection: 'row', gap: Spacing.sm },
  medsButton: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  medsButtonDark: { borderColor: Colors.borderDark },
  optionLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },

  notesInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, fontFamily: FontFamily.regular, color: Colors.textPrimary },
  notesInputDark: { borderColor: Colors.borderDark, color: Colors.textPrimaryDark, backgroundColor: Colors.surfaceDark },

  saveButton: { marginTop: Spacing.sm },

  eventList: { gap: Spacing.xs, marginTop: Spacing.sm },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  eventRowDark: { borderTopColor: Colors.borderDark },
  eventTitle: { fontSize: FontSize.sm, color: Colors.textPrimary },
  removeText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },

  bottomPad: { height: Spacing.xxl },
});
