import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { Button } from '@/components/common/Button';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { MultiSelectCard } from '@/components/onboarding/MultiSelectCard';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useHealthData } from '@/hooks/useHealthData';
import { useMedications } from '@/hooks/useMedications';
import { useMedicationTracking } from '@/hooks/useMedicationTracking';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/common/PremiumModal';
import { deleteAllUserData } from '@/services/database';
import { getAiConsent, setAiConsent } from '@/services/aiConsent';
import { requestNotificationPermissions, scheduleDailyCheckIn, cancelNotification } from '@/services/notifications';
import {
  AgeRange,
  BiologicalSex,
  DiagnosisCriteria,
  DiagnosisYears,
  PemOnsetDelay,
  PemDurationTypical,
  MobilityStatus,
  PrimarySymptom,
  Comorbidity,
  Medication,
  LifestyleChallenge,
  MedicationReminder,
} from '@/types';

const AGE_RANGES: AgeRange[] = ['under_25', '25_35', '35_45', '45_55', '55_plus'];
const BIOLOGICAL_SEXES: BiologicalSex[] = ['male', 'female', 'prefer_not_to_say'];
const DIAGNOSIS_CRITERIA: DiagnosisCriteria[] = ['fukuda', 'canadian_consensus_criteria', 'international_consensus_criteria', 'iom_seid', 'not_formally_diagnosed', 'other'];
const DIAGNOSIS_YEARS: DiagnosisYears[] = ['not_diagnosed', 'under_1', '1_3', '3_5', '5_10', '10_plus'];
const BELL_SCORES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
const PEM_ONSET_DELAYS: PemOnsetDelay[] = ['same_day', 'next_day', '24_72h', 'variable'];
const PEM_DURATIONS: PemDurationTypical[] = ['hours', 'one_day', 'several_days', 'week_plus', 'variable'];
const MOBILITY_STATUSES: MobilityStatus[] = ['none', 'mobility_aid', 'wheelchair_part_time', 'wheelchair_full_time', 'housebound', 'bedbound'];
const PRIMARY_SYMPTOMS: PrimarySymptom[] = ['fatigue', 'pem', 'unrefreshing_sleep', 'cognitive_dysfunction', 'orthostatic_intolerance', 'pain', 'sensory_sensitivity', 'temperature_dysregulation', 'immune_flulike', 'gi_issues'];
const COMORBIDITIES: Comorbidity[] = ['pots', 'fibromyalgia', 'mcas', 'eds', 'ibs', 'migraine', 'anxiety_depression', 'mold_illness', 'other'];
const MEDICATIONS: Medication[] = ['low_dose_naltrexone', 'beta_blockers', 'antihistamines_h1_h2', 'stimulants', 'antidepressants', 'anticoagulants', 'no_medication', 'other'];
const CHALLENGES: LifestyleChallenge[] = ['sleep', 'exercise', 'work', 'social_life', 'mental_health'];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function timeToDate(timeString: string): Date {
  const [h, m] = timeString.split(':').map((v) => parseInt(v, 10));
  const d = new Date();
  d.setHours(isNaN(h) ? 20 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── ProfileEditModal ───────────────────────────────────────────────────────────

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  initial: {
    age_range: AgeRange | null;
    biological_sex: BiologicalSex | null;
    diagnosis_criteria: DiagnosisCriteria | null;
    diagnosis_years: DiagnosisYears | null;
    bell_score_baseline: number | null;
    pem_onset_delay: PemOnsetDelay | null;
    pem_duration_typical: PemDurationTypical | null;
    mobility_status: MobilityStatus | null;
    primary_symptoms: PrimarySymptom[];
    comorbidities: Comorbidity[];
    medications: Medication[];
    challenges: LifestyleChallenge[];
    ai_context: string;
  };
  onSave: (updates: ProfileEditModalProps['initial']) => Promise<void>;
}

function EditSectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color, marginTop: Spacing.xl, marginBottom: Spacing.sm }}>
      {label}
    </Text>
  );
}

function ProfileEditModal({ visible, onClose, isDark, initial, onSave }: ProfileEditModalProps) {
  const { t } = useTranslation();
  const { top: topInset } = useSafeAreaInsets();
  const bg = isDark ? Colors.backgroundDark : Colors.background;
  const cardBorder = isDark ? Colors.borderDark : Colors.border;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null);
  const [diagnosisCriteria, setDiagnosisCriteria] = useState<DiagnosisCriteria | null>(null);
  const [diagnosisYears, setDiagnosisYears] = useState<DiagnosisYears | null>(null);
  const [bellScore, setBellScore] = useState<number | null>(null);
  const [pemOnsetDelay, setPemOnsetDelay] = useState<PemOnsetDelay | null>(null);
  const [pemDuration, setPemDuration] = useState<PemDurationTypical | null>(null);
  const [mobilityStatus, setMobilityStatus] = useState<MobilityStatus | null>(null);
  const [primarySymptoms, setPrimarySymptoms] = useState<PrimarySymptom[]>([]);
  const [comorbidities, setComorbidities] = useState<Comorbidity[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [challenges, setChallenges] = useState<LifestyleChallenge[]>([]);
  const [aiContext, setAiContext] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAgeRange(initial.age_range);
      setBiologicalSex(initial.biological_sex);
      setDiagnosisCriteria(initial.diagnosis_criteria);
      setDiagnosisYears(initial.diagnosis_years);
      setBellScore(initial.bell_score_baseline);
      setPemOnsetDelay(initial.pem_onset_delay);
      setPemDuration(initial.pem_duration_typical);
      setMobilityStatus(initial.mobility_status);
      setPrimarySymptoms(initial.primary_symptoms);
      setComorbidities(initial.comorbidities);
      setMedications(initial.medications);
      setChallenges(initial.challenges);
      setAiContext(initial.ai_context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        age_range: ageRange,
        biological_sex: biologicalSex,
        diagnosis_criteria: diagnosisCriteria,
        diagnosis_years: diagnosisYears,
        bell_score_baseline: bellScore,
        pem_onset_delay: pemOnsetDelay,
        pem_duration_typical: pemDuration,
        mobility_status: mobilityStatus,
        primary_symptoms: primarySymptoms,
        comorbidities,
        medications,
        challenges,
        ai_context: aiContext,
      });
      onClose();
    } catch (err) {
      console.error('ProfileEditModal save error:', err);
      Alert.alert(t('common.error'), t('profile.error_save'));
    } finally {
      setIsSaving(false);
    }
  }

  const compactCard = { paddingVertical: 8, marginBottom: 4 } as const;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: topInset }}>
        <View style={[styles.editModalHeader, { borderBottomColor: cardBorder }]}>
          <Text style={[styles.editModalTitle, { color: textPrimary }]}>{t('profile.edit_title')}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <Text style={[styles.editModalClose, { color: textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.editModalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EditSectionHeader label={t('profile.section_about')} color={textSecondary} />

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_age_range')}</Text>
          {AGE_RANGES.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.age_range.${v}`)} isSelected={ageRange === v} onPress={() => setAgeRange(v)} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_biological_sex')}</Text>
          {BIOLOGICAL_SEXES.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.biological_sex.${v}`)} isSelected={biologicalSex === v} onPress={() => setBiologicalSex(v)} />
          ))}

          <EditSectionHeader label={t('profile.section_diagnosis')} color={textSecondary} />

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_diagnosis_criteria')}</Text>
          {DIAGNOSIS_CRITERIA.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.diagnosis_criteria.${v}`)} isSelected={diagnosisCriteria === v} onPress={() => setDiagnosisCriteria(v)} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_diagnosis_years')}</Text>
          {DIAGNOSIS_YEARS.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.diagnosis_years.${v}`)} isSelected={diagnosisYears === v} onPress={() => setDiagnosisYears(v)} />
          ))}

          <EditSectionHeader label={t('profile.section_pacing')} color={textSecondary} />

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_bell_baseline')}</Text>
          {BELL_SCORES.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.bell_score_baseline.${v}`)} isSelected={bellScore === v} onPress={() => setBellScore(v)} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_pem_onset_delay')}</Text>
          {PEM_ONSET_DELAYS.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.pem_onset_delay.${v}`)} isSelected={pemOnsetDelay === v} onPress={() => setPemOnsetDelay(v)} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_pem_duration')}</Text>
          {PEM_DURATIONS.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.pem_duration_typical.${v}`)} isSelected={pemDuration === v} onPress={() => setPemDuration(v)} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_mobility_status')}</Text>
          {MOBILITY_STATUSES.map((v) => (
            <OptionCard key={v} style={compactCard} label={t(`onboarding.mobility_status.${v}`)} isSelected={mobilityStatus === v} onPress={() => setMobilityStatus(v)} />
          ))}

          <EditSectionHeader label={t('profile.section_symptoms')} color={textSecondary} />

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_primary_symptoms')}</Text>
          {PRIMARY_SYMPTOMS.map((v) => (
            <MultiSelectCard key={v} style={compactCard} label={t(`onboarding.primary_symptoms.${v}`)} isSelected={primarySymptoms.includes(v)} onPress={() => setPrimarySymptoms((arr) => toggle(arr, v))} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_comorbidities')}</Text>
          {COMORBIDITIES.map((v) => (
            <MultiSelectCard key={v} style={compactCard} label={t(`onboarding.comorbidities.${v}`)} isSelected={comorbidities.includes(v)} onPress={() => setComorbidities((arr) => toggle(arr, v))} />
          ))}

          <EditSectionHeader label={t('profile.section_lifestyle')} color={textSecondary} />

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_medications')}</Text>
          {MEDICATIONS.map((v) => (
            <MultiSelectCard key={v} style={compactCard} label={t(`onboarding.medications.${v}`)} isSelected={medications.includes(v)} onPress={() => setMedications((arr) => toggle(arr, v))} />
          ))}

          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_challenges')}</Text>
          {CHALLENGES.map((v) => (
            <MultiSelectCard key={v} style={compactCard} label={t(`onboarding.challenges.${v}`)} isSelected={challenges.includes(v)} onPress={() => setChallenges((arr) => toggle(arr, v))} />
          ))}

          <EditSectionHeader label={t('profile.section_ai')} color={textSecondary} />
          <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.field_ai_context')}</Text>
          <TextInput
            style={[styles.aiContextInput, { color: textPrimary, borderColor: cardBorder }]}
            value={aiContext}
            onChangeText={setAiContext}
            placeholder={t('profile.ai_context_placeholder')}
            placeholderTextColor={textSecondary}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity onPress={handleSave} disabled={isSaving} activeOpacity={0.8} style={[styles.modalSaveBtn, { marginTop: Spacing.xl, opacity: isSaving ? 0.6 : 1 }]}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSaveText}>{t('common.save_changes')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── AddMedicationModal ─────────────────────────────────────────────────────────

interface AddMedicationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (med: Omit<MedicationReminder, 'id' | 'user_id'>) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<MedicationReminder>) => Promise<void>;
  onOpenEditProfile?: () => void;
  editingMed?: MedicationReminder | null;
  isDark: boolean;
  profileMeds?: Medication[];
}

const FREQUENCIES: MedicationReminder['frequency'][] = ['daily', 'weekly', 'fortnightly', 'monthly'];

function AddMedicationModal({ visible, onClose, onSave, onUpdate, onOpenEditProfile, editingMed, isDark, profileMeds }: AddMedicationModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState<MedicationReminder['frequency']>('daily');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [asNeeded, setAsNeeded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!editingMed;

  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const cardBorder = isDark ? Colors.borderDark : Colors.border;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const inputBg = isDark ? Colors.backgroundDark : Colors.background;

  function reset() {
    setName('');
    setDose('');
    setFrequency('daily');
    setReminderTime('08:00');
    setAsNeeded(false);
  }

  useEffect(() => {
    if (visible && editingMed) {
      setName(editingMed.name);
      setDose(editingMed.dose ?? '');
      setFrequency(editingMed.frequency);
      setReminderTime(editingMed.reminder_time);
      setAsNeeded(editingMed.as_needed ?? false);
    } else if (visible && !editingMed) {
      reset();
    }
  }, [visible, editingMed]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('', t('profile.error_med_name'));
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing && editingMed && onUpdate) {
        await onUpdate(editingMed.id!, {
          name: name.trim(),
          dose: dose.trim(),
          frequency,
          reminder_time: reminderTime,
          as_needed: asNeeded,
        });
      } else {
        await onSave({
          name: name.trim(),
          dose: dose.trim(),
          frequency,
          reminder_time: reminderTime,
          as_needed: asNeeded,
          active: true,
        });
      }
      reset();
      onClose();
    } catch (err) {
      console.error('Add medication error:', err);
      Alert.alert(t('common.error'), t('profile.error_save'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  const freqLabels: Record<MedicationReminder['frequency'], string> = {
    daily: t('profile.medications.daily'),
    weekly: t('profile.medications.weekly'),
    fortnightly: t('profile.medications.fortnightly'),
    monthly: t('profile.medications.monthly'),
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.medModalOverlay}>
        <View style={[styles.medModalContainer, { backgroundColor: cardBg, borderColor: cardBorder, maxHeight: screenHeight - topInset - Spacing.md }]}>
          <Text style={[styles.medModalTitle, { color: textPrimary }]}>
            {isEditing ? t('profile.medications.edit_title') : t('profile.medications.add_title')}
          </Text>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {!isEditing && (
              <View style={{ marginBottom: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs, marginTop: Spacing.sm }}>
                  <Text style={[styles.editFieldLabel, { color: textSecondary, marginBottom: 0, marginTop: 0 }]}>{t('profile.medications.from_your_treatment')}</Text>
                  {onOpenEditProfile && (
                    <TouchableOpacity onPress={() => { handleClose(); onOpenEditProfile(); }} activeOpacity={0.8}>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', fontFamily: FontFamily.semiBold }}>{t('profile.medications.edit_treatment_link')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {profileMeds && profileMeds.filter((m) => m !== 'no_medication').length > 0 ? (
                  <>
                    <View style={styles.medChipsRow}>
                      {profileMeds.filter((m) => m !== 'no_medication').map((med) => {
                        const label = t(`onboarding.medications.${med}`);
                        return (
                          <TouchableOpacity
                            key={med}
                            onPress={() => setName(label)}
                            activeOpacity={0.8}
                            style={[styles.medChip, { backgroundColor: name === label ? Colors.primary : inputBg, borderColor: name === label ? Colors.primary : cardBorder }]}
                          >
                            <Text style={[styles.medChipText, { color: name === label ? '#FFFFFF' : textSecondary }]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styles.medHelperText, { color: textSecondary, marginBottom: 0, marginTop: 4 }]}>{t('profile.medications.tap_to_fill')}</Text>
                  </>
                ) : (
                  <Text style={[styles.medHelperText, { color: textSecondary, marginBottom: 0 }]}>{t('profile.medications.no_treatment_yet')}</Text>
                )}
              </View>
            )}

            <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.medications.name')}</Text>
            <TextInput
              style={[styles.medTextInput, { backgroundColor: inputBg, borderColor: cardBorder, color: textPrimary }]}
              placeholder={t('profile.medications.name_placeholder')}
              placeholderTextColor={textSecondary}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.medications.dose')}</Text>
            <TextInput
              style={[styles.medTextInput, { backgroundColor: inputBg, borderColor: cardBorder, color: textPrimary }]}
              placeholder={t('profile.medications.dose_placeholder')}
              placeholderTextColor={textSecondary}
              value={dose}
              onChangeText={setDose}
            />

            <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.medications.frequency')}</Text>
            <View style={styles.medChipsRow}>
              {FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq}
                  onPress={() => { setFrequency(freq); setAsNeeded(false); }}
                  activeOpacity={0.8}
                  style={[styles.medChip, { backgroundColor: !asNeeded && frequency === freq ? Colors.primary : inputBg, borderColor: !asNeeded && frequency === freq ? Colors.primary : cardBorder }]}
                >
                  <Text style={[styles.medChipText, { color: !asNeeded && frequency === freq ? '#FFFFFF' : textSecondary }]}>{freqLabels[freq]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setAsNeeded(true)}
                activeOpacity={0.8}
                style={[styles.medChip, { backgroundColor: asNeeded ? Colors.primary : inputBg, borderColor: asNeeded ? Colors.primary : cardBorder }]}
              >
                <Text style={[styles.medChipText, { color: asNeeded ? '#FFFFFF' : textSecondary }]}>{t('profile.medications.as_needed')}</Text>
              </TouchableOpacity>
            </View>

            {!asNeeded && (
              <>
                <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.medications.reminder_time')}</Text>
                {Platform.OS === 'android' ? (
                  (() => {
                    const [hStr, mStr] = reminderTime.split(':');
                    const hVal = parseInt(hStr, 10);
                    const mVal = parseInt(mStr, 10);
                    const adjustTime = (hDelta: number, mDelta: number) => {
                      const newH = ((hVal + hDelta) + 24) % 24;
                      const newM = ((mVal + mDelta) + 60) % 60;
                      setReminderTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
                    };
                    return (
                      <View style={styles.androidTimeRow}>
                        <View style={styles.androidTimeCol}>
                          <TouchableOpacity style={[styles.androidTimeBtn, { backgroundColor: inputBg, borderColor: cardBorder }]} onPress={() => adjustTime(1, 0)} activeOpacity={0.7}>
                            <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▲</Text>
                          </TouchableOpacity>
                          <Text style={[styles.androidTimeValue, { color: textPrimary }]}>{String(hVal).padStart(2, '0')}</Text>
                          <TouchableOpacity style={[styles.androidTimeBtn, { backgroundColor: inputBg, borderColor: cardBorder }]} onPress={() => adjustTime(-1, 0)} activeOpacity={0.7}>
                            <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▼</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.androidTimeColon, { color: textPrimary }]}>:</Text>
                        <View style={styles.androidTimeCol}>
                          <TouchableOpacity style={[styles.androidTimeBtn, { backgroundColor: inputBg, borderColor: cardBorder }]} onPress={() => adjustTime(0, 5)} activeOpacity={0.7}>
                            <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▲</Text>
                          </TouchableOpacity>
                          <Text style={[styles.androidTimeValue, { color: textPrimary }]}>{String(mVal).padStart(2, '0')}</Text>
                          <TouchableOpacity style={[styles.androidTimeBtn, { backgroundColor: inputBg, borderColor: cardBorder }]} onPress={() => adjustTime(0, -5)} activeOpacity={0.7}>
                            <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▼</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()
                ) : (
                  <DateTimePicker
                    value={timeToDate(reminderTime)}
                    mode="time"
                    display="spinner"
                    onChange={(_event, date) => { if (date) setReminderTime(dateToTime(date)); }}
                    textColor={textPrimary}
                    style={{ width: '100%', height: 150 }}
                  />
                )}
              </>
            )}

          </ScrollView>

          <View style={styles.medModalActions}>
            <TouchableOpacity onPress={handleClose} style={[styles.medModalCancelBtn, { borderColor: cardBorder }]} activeOpacity={0.8}>
              <Text style={[styles.medModalCancelText, { color: textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.modalSaveBtn, { flex: 1, opacity: isSaving ? 0.6 : 1 }]} disabled={isSaving} activeOpacity={0.8}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSaveText}>{isEditing ? t('common.save_changes') : t('profile.medications.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── SummaryRow ─────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, isDark && styles.textSecDark]}>{label}</Text>
      <Text style={[styles.summaryValue, isDark && styles.textPrimaryDark]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── ProfileScreen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { user, signOut } = useAuth();
  const { profile, saveProfile } = useProfile();
  const { isAvailable: healthAvailable, isConnected: healthConnected, connect: connectHealth, disconnect: disconnectHealth } = useHealthData();
  const { medications, isLoading: medsLoading, addMedication, updateMedication, deleteMedication } = useMedications();
  const { tracks: tracksMedication, setTracks: setTracksMedication } = useMedicationTracking();
  const { isSubscribed, isLoading: subLoading, monthlyPrice, trialDays, purchase, restore } = useSubscription();

  const [showEditModal, setShowEditModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isTogglingHealth, setIsTogglingHealth] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationReminder | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [aiConsented, setAiConsented] = useState<boolean | null>(null);

  useEffect(() => {
    getAiConsent().then(setAiConsented);
  }, []);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const success = await purchase();
      if (!success) Alert.alert('', t('profile.purchase_unavailable'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsPurchasing(false);
    }
  }, [purchase, t]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (!success) Alert.alert('', t('profile.no_purchases'));
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setIsRestoring(false);
    }
  }, [restore, t]);

  const handleManageSubscription = useCallback(() => {
    const url = Platform.OS === 'android'
      ? 'https://play.google.com/store/account/subscriptions?package=com.myaapp.app'
      : 'https://apps.apple.com/account/subscriptions';
    Linking.openURL(url).catch(() => {});
  }, []);

  const medicationDosesPerDay = profile?.medication_doses_per_day ?? 1;

  const handleSetMedicationDosesPerDay = useCallback(async (value: number) => {
    try {
      await saveProfile({ medication_doses_per_day: value });
    } catch (err) {
      console.error('Update medication doses per day error:', err);
      Alert.alert(t('common.error'), t('profile.error_save'));
    }
  }, [saveProfile, t]);

  const handleDeleteMed = useCallback((id: string, name: string) => {
    Alert.alert(name, t('profile.medications.remove_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.medications.remove_btn'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMedication(id);
          } catch (err) {
            console.error('Delete medication error:', err);
          }
        },
      },
    ]);
  }, [deleteMedication, t]);

  const freqLabel = (freq: MedicationReminder['frequency']): string => t(`profile.medications.${freq}`);

  const checkScheduled = useCallback(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    setNotificationsEnabled(scheduled.some((n) => n.identifier === 'daily-checkin'));
  }, []);

  useFocusEffect(useCallback(() => { checkScheduled(); }, [checkScheduled]));

  const notificationTime = profile?.notification_time ?? '20:00';

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setNotificationsEnabled(false);
        Alert.alert(t('profile.notifications_denied_title'), t('profile.notifications_denied_body'));
        return;
      }
      await scheduleDailyCheckIn(notificationTime);
    } else {
      await cancelNotification('daily-checkin');
    }
  };

  const handleTimeChange = async (_: unknown, selected?: Date) => {
    setShowTimePicker(false);
    if (!selected) return;
    const timeString = dateToTime(selected);
    await saveProfile({ notification_time: timeString });
    if (notificationsEnabled) await scheduleDailyCheckIn(timeString);
  };

  const handleToggleAiConsent = async (value: boolean) => {
    setAiConsented(value);
    await setAiConsent(value);
  };

  const handleToggleHealth = async (value: boolean) => {
    setIsTogglingHealth(true);
    try {
      if (value) {
        await connectHealth();
      } else {
        await disconnectHealth();
      }
    } finally {
      setIsTogglingHealth(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out_confirm_title'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.sign_out'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.delete_account_confirm_title'), t('profile.delete_account_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_account'),
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setIsDeletingAccount(true);
          try {
            await deleteAllUserData(user.id);
            await signOut();
          } catch (err) {
            console.error('Delete account error:', err);
            Alert.alert(t('common.error'), t('profile.error_delete_account'));
          } finally {
            setIsDeletingAccount(false);
          }
        },
      },
    ]);
  };

  const labelOrNotSet = (key: string | null, ns: string): string => (key ? t(`onboarding.${ns}.${key}`) : t('profile.not_set'));
  const listOrNotSet = (arr: string[] | undefined, ns: string): string =>
    arr && arr.length > 0 ? arr.map((v) => t(`onboarding.${ns}.${v}`)).join(', ') : t('profile.not_set');

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.email ?? 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.email, isDark && styles.textPrimaryDark]} numberOfLines={1}>{user?.email}</Text>
        </View>

        {!subLoading && (
          isSubscribed ? (
            <View style={[styles.section, { borderColor: Colors.primary }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('subscription.already_subscribed')}</Text>
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleManageSubscription} activeOpacity={0.8}>
                <Text style={styles.editLink}>{t('subscription.manage')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowPremiumModal(true)}
              activeOpacity={0.85}
              style={[styles.section, styles.premiumTeaser, isDark && styles.sectionDark, { borderColor: Colors.primary + '50' }]}
            >
              <View style={styles.premiumTeaserRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                  <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('premium_modal.header_title')}</Text>
                  <Text style={[styles.hint, isDark && styles.textSecDark]}>
                    {monthlyPrice && trialDays
                      ? t('premium_modal.after_trial', { days: trialDays, price: monthlyPrice })
                      : t('premium_modal.header_subtitle')}
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize.lg, color: Colors.primary }}>›</Text>
              </View>
            </TouchableOpacity>
          )
        )}

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.section_your_profile')}</Text>
            <TouchableOpacity onPress={() => setShowEditModal(true)}>
              <Text style={styles.editLink}>{t('profile.edit')}</Text>
            </TouchableOpacity>
          </View>
          <SummaryRow isDark={isDark} label={t('profile.field_diagnosis_criteria')} value={labelOrNotSet(profile?.diagnosis_criteria ?? null, 'diagnosis_criteria')} />
          <SummaryRow isDark={isDark} label={t('profile.field_diagnosis_years')} value={labelOrNotSet(profile?.diagnosis_years ?? null, 'diagnosis_years')} />
          <SummaryRow isDark={isDark} label={t('profile.field_bell_baseline')} value={profile?.bell_score_baseline !== null && profile?.bell_score_baseline !== undefined ? String(profile.bell_score_baseline) : t('profile.not_set')} />
          <SummaryRow isDark={isDark} label={t('profile.field_pem_onset_delay')} value={labelOrNotSet(profile?.pem_onset_delay ?? null, 'pem_onset_delay')} />
          <SummaryRow isDark={isDark} label={t('profile.field_pem_duration')} value={labelOrNotSet(profile?.pem_duration_typical ?? null, 'pem_duration_typical')} />
          <SummaryRow isDark={isDark} label={t('profile.field_mobility_status')} value={labelOrNotSet(profile?.mobility_status ?? null, 'mobility_status')} />
          <SummaryRow isDark={isDark} label={t('profile.field_primary_symptoms')} value={listOrNotSet(profile?.primary_symptoms, 'primary_symptoms')} />
          <SummaryRow isDark={isDark} label={t('profile.field_comorbidities')} value={listOrNotSet(profile?.comorbidities, 'comorbidities')} />
          <SummaryRow isDark={isDark} label={t('profile.field_medications')} value={listOrNotSet(profile?.medications, 'medications')} />
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowTextGroup}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.medications.section_title')}</Text>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>
                {tracksMedication ? t('profile.medications.tracking_on') : t('profile.medications.tracking_off')}
              </Text>
            </View>
            <Switch value={tracksMedication} onValueChange={setTracksMedication} trackColor={{ true: Colors.primary }} />
          </View>

          {tracksMedication && (
            <View style={styles.rowBetween}>
              <Text style={[styles.editFieldLabel, isDark && styles.textSecDark, { marginTop: 0 }]}>{t('profile.medications.doses_per_day')}</Text>
              <View style={styles.medChipsRow}>
                {[1, 2, 3].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => handleSetMedicationDosesPerDay(n)}
                    activeOpacity={0.8}
                    style={[
                      styles.medDoseChip,
                      { backgroundColor: medicationDosesPerDay === n ? Colors.primary : 'transparent', borderColor: medicationDosesPerDay === n ? Colors.primary : (isDark ? Colors.borderDark : Colors.border) },
                    ]}
                  >
                    <Text style={[styles.medChipText, { color: medicationDosesPerDay === n ? '#FFFFFF' : (isDark ? Colors.textSecondaryDark : Colors.textSecondary) }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {medsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.sm }} />
          ) : (
            medications.map((med) => (
              <TouchableOpacity key={med.id} style={styles.medListRow} onPress={() => { setEditingMed(med); setShowAddMed(true); }} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, isDark && styles.textPrimaryDark]}>{med.name}</Text>
                  <View style={styles.medMetaRow}>
                    {med.dose ? <Text style={[styles.medDose, isDark && styles.textSecDark]}>{med.dose}</Text> : null}
                    {med.as_needed ? (
                      <Text style={[styles.medFreqBadge, { color: Colors.warning }]}>{t('profile.medications.as_needed')}</Text>
                    ) : (
                      <Text style={[styles.medFreqBadge, isDark && styles.textSecDark]}>{freqLabel(med.frequency)} · {med.reminder_time}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMed(med.id!, med.name)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.medDeleteIcon}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          {tracksMedication && (
            <TouchableOpacity onPress={() => { setEditingMed(null); setShowAddMed(true); }} activeOpacity={0.7}>
              <Text style={styles.editLink}>{t('profile.medications.add_btn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowTextGroup}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.section_reminders')}</Text>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('profile.reminder_hint')}</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ true: Colors.primary }} />
          </View>
          {notificationsEnabled && (
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeRow}>
              <Text style={styles.editLink}>{t('profile.reminder_time', { time: notificationTime })}</Text>
            </TouchableOpacity>
          )}
          {showTimePicker && (
            <DateTimePicker value={timeToDate(notificationTime)} mode="time" display="spinner" onChange={handleTimeChange} />
          )}
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowTextGroup}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.section_health')}</Text>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>
                {healthAvailable ? t('profile.health_hint') : t('profile.health_unavailable')}
              </Text>
            </View>
            {healthAvailable && (
              isTogglingHealth
                ? <ActivityIndicator color={Colors.primary} />
                : <Switch value={healthConnected} onValueChange={handleToggleHealth} trackColor={{ true: Colors.primary }} />
            )}
          </View>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowTextGroup}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.ai_data_sharing')}</Text>
              <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('profile.ai_data_sharing_hint')}</Text>
            </View>
            {aiConsented === null
              ? <ActivityIndicator color={Colors.primary} />
              : <Switch value={aiConsented} onValueChange={handleToggleAiConsent} trackColor={{ true: Colors.primary }} />}
          </View>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('profile.section_account')}</Text>
          <Button label={t('profile.sign_out')} onPress={handleSignOut} variant="secondary" />
          <Button
            label={isDeletingAccount ? t('profile.deleting') : t('profile.delete_account')}
            onPress={handleDeleteAccount}
            variant="outline"
            isLoading={isDeletingAccount}
            style={styles.deleteButton}
            textStyle={{ color: Colors.error }}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <ProfileEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        isDark={isDark}
        initial={{
          age_range: profile?.age_range ?? null,
          biological_sex: profile?.biological_sex ?? null,
          diagnosis_criteria: profile?.diagnosis_criteria ?? null,
          diagnosis_years: profile?.diagnosis_years ?? null,
          bell_score_baseline: profile?.bell_score_baseline ?? null,
          pem_onset_delay: profile?.pem_onset_delay ?? null,
          pem_duration_typical: profile?.pem_duration_typical ?? null,
          mobility_status: profile?.mobility_status ?? null,
          primary_symptoms: profile?.primary_symptoms ?? [],
          comorbidities: profile?.comorbidities ?? [],
          medications: profile?.medications ?? [],
          challenges: profile?.challenges ?? [],
          ai_context: profile?.ai_context ?? '',
        }}
        onSave={async (updates) => { await saveProfile(updates); }}
      />

      <AddMedicationModal
        visible={showAddMed}
        onClose={() => { setShowAddMed(false); setEditingMed(null); }}
        onSave={addMedication}
        onUpdate={updateMedication}
        onOpenEditProfile={() => setShowEditModal(true)}
        editingMed={editingMed}
        isDark={isDark}
        profileMeds={profile?.medications}
      />

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
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  header: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.primaryDark },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary },

  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  sectionDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  editLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 4 },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flexShrink: 0 },
  summaryValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  rowTextGroup: { flex: 1 },
  timeRow: { marginTop: Spacing.xs },


  deleteButton: { borderColor: Colors.error },

  premiumTeaser: { borderWidth: 1.5 },
  premiumTeaserRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  premiumBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  premiumBadgeText: { fontSize: 10, fontWeight: '800', fontFamily: FontFamily.extraBold, color: '#FFFFFF', letterSpacing: 0.5 },

  bottomPad: { height: Spacing.xxl },

  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  editModalTitle: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.extraBold },
  editModalClose: { fontSize: FontSize.md, fontWeight: '600' },
  editModalContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  editFieldLabel: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  aiContextInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, fontSize: FontSize.sm, minHeight: 90, textAlignVertical: 'top' },
  modalSaveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: '600', fontFamily: FontFamily.semiBold },

  medListRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  medName: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  medMetaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  medDose: { fontSize: FontSize.xs, color: Colors.textSecondary },
  medFreqBadge: { fontSize: FontSize.xs, color: Colors.textSecondary },
  medDeleteIcon: { fontSize: FontSize.md, color: Colors.error },
  medDoseChip: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  medModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  medModalContainer: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg },
  medModalTitle: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.extraBold, marginBottom: Spacing.md },
  medChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  medChip: { paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  medChipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },
  medHelperText: { fontSize: FontSize.xs },
  medTextInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, fontSize: FontSize.sm, marginTop: Spacing.xs, marginBottom: Spacing.sm },
  medModalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  medModalCancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center' },
  medModalCancelText: { fontSize: FontSize.md, fontWeight: '600', fontFamily: FontFamily.semiBold },

  androidTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  androidTimeCol: { alignItems: 'center', gap: Spacing.xs },
  androidTimeBtn: { width: 44, height: 36, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  androidTimeArrow: { fontSize: FontSize.sm, fontWeight: '700' },
  androidTimeValue: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold },
  androidTimeColon: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold },
});
