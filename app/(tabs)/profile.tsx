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
import Constants from 'expo-constants';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { MultiSelectCard } from '@/components/onboarding/MultiSelectCard';
import { InfoButton } from '@/components/common/InfoButton';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useHealthData } from '@/hooks/useHealthData';
import { useMedications } from '@/hooks/useMedications';
import { useMedicationTracking } from '@/hooks/useMedicationTracking';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/common/PremiumModal';
import { supabase } from '@/services/supabase';
import { deleteAllUserData, getDailyLogs, getCrashes, getDailyEnvelopes, getDsqSfScores } from '@/services/database';
import { generateAndShareReport } from '@/services/pdfExport';
import { getAiConsent, setAiConsent } from '@/services/aiConsent';
import { requestNotificationPermissions, scheduleDailyCheckIn, cancelNotification } from '@/services/notifications';
import { getPrivacyPolicyUrl } from '@/utils/links';
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
const FREQUENCIES: MedicationReminder['frequency'][] = ['daily', 'weekly', 'fortnightly', 'monthly'];

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

// ─── ProfileScreen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { user, signOut } = useAuth();
  const { profile, saveProfile } = useProfile();
  const {
    isAvailable: healthAvailable, isConnected: healthConnected, isLoading: healthLoading,
    connect: connectHealth, disconnect: disconnectHealth,
  } = useHealthData();
  const { medications, isLoading: medsLoading, addMedication, updateMedication, deleteMedication } = useMedications();
  const { tracks: tracksMedication, setTracks: setTracksMedication } = useMedicationTracking();
  const { isSubscribed, isLoading: subLoading, monthlyPrice, trialDays, purchase, restore } = useSubscription();

  const bg = isDark ? Colors.backgroundDark : Colors.background;
  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const cardBorder = isDark ? Colors.borderDark : Colors.border;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const inputBg = isDark ? Colors.backgroundDark : Colors.background;

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.preferred_name ?? '');
  const [editingAiContext, setEditingAiContext] = useState(false);
  const [aiContext, setAiContext] = useState(profile?.ai_context ?? '');
  const [isSavingAiContext, setIsSavingAiContext] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingTime, setPendingTime] = useState<Date | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationReminder | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [aiConsented, setAiConsented] = useState<boolean | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportFromDate, setReportFromDate] = useState('');
  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [pendingReportDate, setPendingReportDate] = useState('');

  useEffect(() => { getAiConsent().then(setAiConsented); }, []);
  useEffect(() => { setNameValue(profile?.preferred_name ?? ''); }, [profile?.preferred_name]);
  useEffect(() => { if (profile?.ai_context) setAiContext(profile.ai_context); }, [profile?.ai_context]);

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
          try { await deleteMedication(id); } catch (err) { console.error('Delete medication error:', err); }
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

  const handleUpdateTime = useCallback(() => {
    setPendingTime(timeToDate(notificationTime));
    setShowTimePicker(true);
  }, [notificationTime]);

  const handleSaveTime = useCallback(async () => {
    if (!pendingTime) return;
    setShowTimePicker(false);
    const timeString = dateToTime(pendingTime);
    try {
      await saveProfile({ notification_time: timeString });
      if (notificationsEnabled) await scheduleDailyCheckIn(timeString);
    } catch (err) {
      console.error('Update notification time error:', err);
      Alert.alert(t('common.error'), t('profile.error_save'));
    }
  }, [pendingTime, notificationsEnabled, saveProfile, t]);

  const handleToggleAiConsent = useCallback((value: boolean) => {
    if (value) {
      Alert.alert(
        t('profile_privacy.ai_consent_alert_title'),
        t('profile_privacy.ai_consent_alert_body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile_privacy.ai_consent_alert_agree'),
            onPress: () => { setAiConsent(true); setAiConsented(true); },
          },
        ]
      );
    } else {
      setAiConsent(false);
      setAiConsented(false);
    }
  }, [t]);

  const handleToggleHealth = async (value: boolean) => {
    if (value) await connectHealth();
    else await disconnectHealth();
  };

  const handleSaveAiContext = useCallback(async () => {
    setIsSavingAiContext(true);
    try {
      await saveProfile({ ai_context: aiContext });
      setEditingAiContext(false);
    } catch (err) {
      console.error('Save AI context error:', err);
      Alert.alert(t('common.error'), t('profile.error_save'));
    } finally {
      setIsSavingAiContext(false);
    }
  }, [aiContext, saveProfile, t]);

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out_confirm_title'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.sign_out'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.delete_all_title'), t('profile.delete_all_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_everything'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('profile.delete_confirm_title'), t('profile.delete_confirm_body'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('profile.delete_confirm_cta'),
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
        },
      },
    ]);
  };

  const isEmailAuth = user?.app_metadata?.provider === 'email' ||
    user?.identities?.some((i: { provider: string }) => i.provider === 'email');

  const handleChangeEmail = useCallback(() => {
    Alert.prompt(
      t('common.change_email'),
      t('common.enter_new_email'),
      async (newEmail) => {
        if (!newEmail?.trim()) return;
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        if (error) Alert.alert(t('common.error'), t('profile.error_update_email'));
        else Alert.alert('', t('profile.confirm_email_change'));
      },
      'plain-text',
      user?.email ?? ''
    );
  }, [user?.email, t]);

  const handleChangePassword = useCallback(() => {
    Alert.prompt(
      t('common.new_password'),
      t('common.password_hint'),
      async (newPassword) => {
        if (!newPassword || newPassword.length < 8) {
          Alert.alert('', t('profile.error_password_short'));
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) Alert.alert(t('common.error'), t('profile.error_update_password'));
        else Alert.alert('', t('profile.password_updated'));
      },
      'secure-text'
    );
  }, [t]);

  const handleSendFeedback = useCallback(() => {
    if (!feedbackText.trim()) return;
    const subject = encodeURIComponent('Mya Feedback');
    const body = encodeURIComponent(feedbackText.trim() + (user?.email ? `\n\n- ${user.email}` : ''));
    Linking.openURL(`mailto:joseph.brockbank@gmail.com?subject=${subject}&body=${body}`);
    setFeedbackText('');
    setShowFeedback(false);
  }, [feedbackText, user?.email]);

  const handleGenerateReport = useCallback(async () => {
    if (!user || !profile) return;
    setIsGeneratingReport(true);
    try {
      const daysBack = reportFromDate
        ? Math.ceil((Date.now() - new Date(reportFromDate + 'T00:00:00').getTime()) / 86400000) + 1
        : 365;
      const [logs, crashes, envelopes, dsqSfScores] = await Promise.all([
        getDailyLogs(user.id, daysBack),
        getCrashes(user.id, 200),
        getDailyEnvelopes(user.id, daysBack),
        getDsqSfScores(user.id, 50),
      ]);
      await generateAndShareReport({
        logs,
        crashes,
        envelopes,
        medications,
        profile,
        dsqSfScores,
        fromDate: reportFromDate || undefined,
      });
    } catch (err) {
      console.error('Generate report error:', err);
      Alert.alert('', t('profile.error_save'));
    } finally {
      setIsGeneratingReport(false);
    }
  }, [user, profile, medications, reportFromDate, t]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── User header ─────────────────────────────────────────────────── */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(nameValue || user?.email)?.charAt(0).toUpperCase() ?? 'U'}</Text>
            </View>
            {editingName ? (
              <TextInput
                style={[styles.nameInput, { color: textPrimary, borderColor: Colors.primary }]}
                value={nameValue}
                onChangeText={setNameValue}
                placeholder={t('profile.first_name_placeholder')}
                placeholderTextColor={textSecondary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={async () => {
                  setEditingName(false);
                  try { await saveProfile({ preferred_name: nameValue.trim() || null }); }
                  catch { Alert.alert(t('common.error'), t('profile.error_save_name')); }
                }}
                onBlur={async () => {
                  setEditingName(false);
                  try { await saveProfile({ preferred_name: nameValue.trim() || null }); }
                  catch { Alert.alert(t('common.error'), t('profile.error_save_name')); }
                }}
              />
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
                <Text style={[styles.nameDisplay, { color: nameValue ? textPrimary : textSecondary }]}>
                  {nameValue || t('profile.add_your_name')}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.emailText, { color: textSecondary }]}>{user?.email ?? ''}</Text>
          </View>

          {/* ── Profile ─────────────────────────────────────────────────────── */}
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowEditModal(true)} activeOpacity={0.7}>
              <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.edit_title')}</Text>
              <Text style={[styles.chevron, { color: textSecondary }]}>›</Text>
            </TouchableOpacity>

            {isSubscribed && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                <TouchableOpacity style={styles.settingsRow} onPress={() => setEditingAiContext(!editingAiContext)} activeOpacity={0.7}>
                  <View style={styles.settingsRowLeft}>
                    <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.about_me')}</Text>
                    {!editingAiContext && (
                      <Text style={[styles.settingsRowSub, { color: textSecondary }]} numberOfLines={1}>
                        {aiContext || t('profile.about_me_placeholder')}
                      </Text>
                    )}
                  </View>
                  {!editingAiContext && <Text style={[styles.chevron, { color: textSecondary }]}>›</Text>}
                </TouchableOpacity>
              </>
            )}

            {editingAiContext && (
              <View style={styles.aiContextExpanded}>
                <TextInput
                  style={[styles.aiContextInput, { backgroundColor: inputBg, borderColor: Colors.primary, color: textPrimary }]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholder={t('profile.ai_context_placeholder')}
                  placeholderTextColor={textSecondary}
                  value={aiContext}
                  onChangeText={setAiContext}
                  autoFocus
                />
                <Text style={[styles.helperText, { color: textSecondary }]}>{t('profile.ai_context_helper')}</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => { setAiContext(profile?.ai_context ?? ''); setEditingAiContext(false); }}
                    activeOpacity={0.8}
                    style={[styles.cancelContextBtn, { borderColor: cardBorder }]}
                  >
                    <Text style={[styles.cancelContextText, { color: textSecondary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveAiContext}
                    disabled={isSavingAiContext}
                    activeOpacity={0.8}
                    style={[styles.saveContextBtn, { flex: 2, opacity: isSavingAiContext ? 0.6 : 1 }]}
                  >
                    {isSavingAiContext ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveContextText}>{t('profile.save_ai_context')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ── Subscription ────────────────────────────────────────────────── */}
          {!subLoading && (
            isSubscribed ? (
              <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: Colors.primary }]}>
                <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
                  <Text style={[styles.settingsRowLabel, { color: textPrimary, fontSize: FontSize.md }]}>{t('subscription.already_subscribed')}</Text>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>{t('common.premium')}</Text>
                  </View>
                </View>
                <View style={[styles.rowDivider, { backgroundColor: Colors.primary + '30' }]} />
                <TouchableOpacity onPress={handleManageSubscription} activeOpacity={0.8} style={styles.settingsRow}>
                  <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('subscription.manage')}</Text>
                  <Text style={[styles.chevron, { color: Colors.primary }]}>›</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPremiumModal(true)}
                activeOpacity={0.85}
                style={[styles.card, styles.premiumTeaser, { backgroundColor: cardBg, borderColor: Colors.primary + '50' }]}
              >
                <View style={styles.premiumTeaserRow}>
                  <View style={styles.premiumTeaserLeft}>
                    <View style={styles.premiumBadge}>
                      <Text style={styles.premiumBadgeText}>{t('common.premium')}</Text>
                    </View>
                    <Text style={[styles.premiumTeaserTitle, { color: textPrimary }]}>{t('premium_modal.header_title')}</Text>
                    <Text style={[styles.premiumTeaserBody, { color: textSecondary }]}>
                      {monthlyPrice && trialDays
                        ? t('premium_modal.after_trial', { days: trialDays, price: monthlyPrice })
                        : t('premium_modal.header_subtitle')}
                    </Text>
                  </View>
                  <Text style={[styles.premiumTeaserArrow, { color: Colors.primary }]}>→</Text>
                </View>
              </TouchableOpacity>
            )
          )}

          {/* ── Notifications & Medications ─────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile.notifications')}</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
              <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.daily_reminder')}</Text>
              <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ true: Colors.primary, false: cardBorder }} thumbColor="#FFFFFF" />
            </View>

            {notificationsEnabled && !showTimePicker && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                <TouchableOpacity onPress={handleUpdateTime} activeOpacity={0.7} style={styles.settingsRow}>
                  <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.medications.reminder_time')}</Text>
                  <Text style={[styles.settingsRowValue, { color: Colors.primary }]}>{notificationTime} ›</Text>
                </TouchableOpacity>
              </>
            )}

            {notificationsEnabled && showTimePicker && (
              <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
                <DateTimePicker
                  value={pendingTime ?? timeToDate(notificationTime)}
                  mode="time"
                  display="spinner"
                  onChange={(_event, date) => { if (date) setPendingTime(date); }}
                  textColor={textPrimary}
                  style={{ width: '100%', height: 150 }}
                />
                <View style={styles.timePickerActions}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.timePickerCancel, { borderColor: cardBorder }]} activeOpacity={0.8}>
                    <Text style={{ color: textSecondary, fontWeight: '500', fontFamily: FontFamily.medium }}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveTime} style={styles.timePickerSave} activeOpacity={0.8}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontFamily: FontFamily.semiBold }}>{t('common.set')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />

            <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
              <View style={styles.settingsRowLeft}>
                <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.medications.tracking_toggle_label')}</Text>
                <Text style={[styles.settingsRowSub, { color: textSecondary }]}>
                  {tracksMedication ? t('profile.medications.tracking_shown') : t('profile.medications.tracking_hidden')}
                </Text>
              </View>
              <Switch value={tracksMedication} onValueChange={setTracksMedication} trackColor={{ true: Colors.primary, false: cardBorder }} thumbColor="#FFFFFF" />
            </View>

            {tracksMedication && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                <View style={styles.settingsRow}>
                  <View style={styles.settingsRowLeft}>
                    <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.medications.doses_per_day')}</Text>
                  </View>
                  <View style={styles.chipsRow}>
                    {[1, 2, 3].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => handleSetMedicationDosesPerDay(n)}
                        activeOpacity={0.8}
                        style={[styles.chip, { backgroundColor: medicationDosesPerDay === n ? Colors.primary : cardBg, borderColor: medicationDosesPerDay === n ? Colors.primary : cardBorder }]}
                      >
                        <Text style={[styles.chipText, { color: medicationDosesPerDay === n ? '#FFFFFF' : textSecondary }]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {medsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : (
              medications.map((med) => (
                <React.Fragment key={med.id}>
                  <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                  <TouchableOpacity style={styles.medListRow} onPress={() => { setEditingMed(med); setShowAddMed(true); }} activeOpacity={0.7}>
                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, { color: textPrimary }]}>{med.name}</Text>
                      <View style={styles.medMeta}>
                        {med.dose ? <Text style={[styles.medDose, { color: textSecondary }]}>{med.dose}</Text> : null}
                        {med.as_needed ? (
                          <View style={[styles.freqBadge, { backgroundColor: Colors.warning + '20' }]}>
                            <Text style={[styles.freqBadgeText, { color: Colors.warning }]}>{t('profile.medications.as_needed')}</Text>
                          </View>
                        ) : (
                          <>
                            <View style={styles.freqBadge}>
                              <Text style={styles.freqBadgeText}>{freqLabel(med.frequency)}</Text>
                            </View>
                            <Text style={[styles.medTime, { color: textSecondary }]}>{med.reminder_time}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteMed(med.id!, med.name)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.deleteIcon}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </React.Fragment>
              ))
            )}

            {tracksMedication && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                <TouchableOpacity onPress={() => { setEditingMed(null); setShowAddMed(true); }} activeOpacity={0.7} style={styles.settingsRow}>
                  <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>+ {t('profile.medications.add_btn')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Health data ──────────────────────────────────────────────────── */}
          {healthAvailable && (
            <>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile.health_data')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                    <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>
                      {Platform.OS === 'ios' ? t('profile.apple_health_label') : t('profile.health_connect_label')}
                    </Text>
                    <InfoButton
                      title={Platform.OS === 'ios' ? t('profile.apple_health_label') : t('profile.health_connect_label')}
                      message={Platform.OS === 'ios' ? t('profile.apple_health_info_message') : t('profile.health_connect_info_message')}
                      color={textSecondary}
                    />
                  </View>
                  {healthLoading ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : (
                    <Switch value={healthConnected} onValueChange={handleToggleHealth} trackColor={{ true: Colors.primary, false: cardBorder }} thumbColor="#FFFFFF" />
                  )}
                </View>
              </View>
            </>
          )}

          {/* ── Treatment ───────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile.treatment')}</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
              <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.share_report_title')}</Text>
              <InfoButton title={t('profile.report_info_title')} message={t('profile.report_info_message')} color={textSecondary} />
            </View>
            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
            {!showReportDatePicker ? (
              <TouchableOpacity
                onPress={() => { setPendingReportDate(reportFromDate); setShowReportDatePicker(true); }}
                activeOpacity={0.7}
                style={styles.settingsRow}
              >
                <Text style={[styles.settingsRowSub, { color: textSecondary }]}>{t('profile.from_last_appointment')}</Text>
                <Text style={[styles.reportDateValue, { color: reportFromDate ? textPrimary : Colors.primary }]}>
                  {reportFromDate
                    ? new Date(reportFromDate + 'T12:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
                    : t('profile.last_12_months')} ›
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
                <DateTimePicker
                  value={pendingReportDate ? new Date(pendingReportDate + 'T12:00:00') : new Date()}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_event, date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setPendingReportDate(`${y}-${m}-${d}`);
                    }
                  }}
                  textColor={textPrimary}
                  style={{ width: '100%', height: 150 }}
                />
                <View style={styles.timePickerActions}>
                  <TouchableOpacity onPress={() => setShowReportDatePicker(false)} style={[styles.timePickerCancel, { borderColor: cardBorder }]} activeOpacity={0.8}>
                    <Text style={{ color: textSecondary, fontWeight: '500', fontFamily: FontFamily.medium }}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setReportFromDate(pendingReportDate); setShowReportDatePicker(false); }} style={styles.timePickerSave} activeOpacity={0.8}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontFamily: FontFamily.semiBold }}>{t('common.set')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
            <TouchableOpacity onPress={handleGenerateReport} disabled={isGeneratingReport} activeOpacity={0.8} style={[styles.settingsRow, { opacity: isGeneratingReport ? 0.6 : 1 }]}>
              {isGeneratingReport ? (
                <View style={styles.reportBtnRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('profile.share_report_generating')}</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('profile.share_report_cta')}</Text>
                  <Text style={[styles.chevron, { color: Colors.primary }]}>›</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Account ─────────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('profile.account')}</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowFeedback(true)} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile.share_feedback_title')}</Text>
                <Text style={[styles.settingsRowSub, { color: textSecondary }]}>{t('profile.feedback_row_subtitle')}</Text>
              </View>
              <Text style={[styles.chevron, { color: textSecondary }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />

            <TouchableOpacity style={styles.settingsRow} onPress={handleChangeEmail} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('common.email')}</Text>
                <Text style={[styles.settingsRowSub, { color: textSecondary }]} numberOfLines={1}>{user?.email}</Text>
              </View>
              <Text style={[styles.settingsRowValue, { color: Colors.primary }]}>{t('common.change')}</Text>
            </TouchableOpacity>

            {isEmailAuth && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
                <TouchableOpacity style={styles.settingsRow} onPress={handleChangePassword} activeOpacity={0.7}>
                  <View style={styles.settingsRowLeft}>
                    <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('common.password')}</Text>
                    <Text style={[styles.settingsRowSub, { color: textSecondary }]}>••••••••</Text>
                  </View>
                  <Text style={[styles.settingsRowValue, { color: Colors.primary }]}>{t('common.change')}</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />

            <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut} activeOpacity={0.7}>
              <Text style={[styles.settingsRowLabel, { color: Colors.error }]}>{t('profile.sign_out')}</Text>
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />

            <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteAccount} activeOpacity={0.7} disabled={isDeletingAccount}>
              {isDeletingAccount ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <Text style={[styles.settingsRowLabel, { color: Colors.error, opacity: 0.7 }]}>{t('profile.delete_data_button')}</Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.deleteDataNote, { color: textSecondary, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }]}>
              {t('profile.delete_data_note')}
            </Text>
          </View>

          {/* ── AI privacy ──────────────────────────────────────────────────── */}
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.settingsRow, { paddingRight: Spacing.md }]}>
              <View style={styles.settingsRowLeft}>
                <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile_privacy.ai_consent_toggle_label')}</Text>
                <Text style={[styles.settingsRowSub, { color: textSecondary }]}>{t('profile_privacy.ai_consent_toggle_subtitle')}</Text>
              </View>
              {aiConsented === null ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Switch value={aiConsented} onValueChange={handleToggleAiConsent} trackColor={{ true: Colors.primary, false: cardBorder }} thumbColor="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.aiPrivacyBody, { color: textSecondary, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs }]}>{t('profile_privacy.ai_body_1')}</Text>
            <Text style={[styles.aiPrivacyBody, { color: textSecondary, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }]}>{t('profile_privacy.ai_body_2')}</Text>
          </View>

          {/* ── Medical Sources & Disclaimer ─────────────────────────────────── */}
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsRowLabel, { color: textPrimary }]}>{t('profile_privacy.sources_title')}</Text>
            </View>
            <Text style={[styles.aiPrivacyBody, { color: textSecondary, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }]}>{t('profile_privacy.sources_disclaimer')}</Text>
            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
            <TouchableOpacity onPress={() => Linking.openURL('https://www.meaction.net')} activeOpacity={0.7} style={styles.settingsRow}>
              <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('profile_privacy.sources_meaction')}</Text>
              <Text style={[styles.chevron, { color: Colors.primary }]}>›</Text>
            </TouchableOpacity>
            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
            <TouchableOpacity onPress={() => Linking.openURL('https://meassociation.org.uk')} activeOpacity={0.7} style={styles.settingsRow}>
              <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('profile_privacy.sources_meassociation')}</Text>
              <Text style={[styles.chevron, { color: Colors.primary }]}>›</Text>
            </TouchableOpacity>
            <View style={[styles.rowDivider, { backgroundColor: cardBorder }]} />
            <TouchableOpacity onPress={() => Linking.openURL('https://www.leonardjason.com/cfsme_measures-2/')} activeOpacity={0.7} style={styles.settingsRow}>
              <Text style={[styles.settingsRowLabel, { color: Colors.primary }]}>{t('profile_privacy.sources_dsq_sf')}</Text>
              <Text style={[styles.chevron, { color: Colors.primary }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy policy + version */}
          <TouchableOpacity onPress={() => Linking.openURL(getPrivacyPolicyUrl()).catch(() => {})} activeOpacity={0.7} style={styles.privacyLink}>
            <Text style={[styles.privacyLinkText, { color: textSecondary }]}>{t('subscription.privacy_policy')}</Text>
          </TouchableOpacity>
          <Text style={[styles.version, { color: textSecondary }]}>v{version}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

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
        }}
        onSave={async (updates) => { await saveProfile(updates); }}
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

      <Modal visible={showFeedback} animationType="slide" transparent onRequestClose={() => setShowFeedback(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.medModalOverlay}>
            <View style={[styles.medModalContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.medModalTitle, { color: textPrimary }]}>{t('profile.share_feedback_title')}</Text>
              <Text style={[styles.editFieldLabel, { color: textSecondary }]}>{t('profile.feedback_prompt')}</Text>
              <TextInput
                style={[styles.feedbackInput, { backgroundColor: inputBg, borderColor: cardBorder, color: textPrimary }]}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder={t('profile.feedback_placeholder')}
                placeholderTextColor={textSecondary}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />
              <View style={styles.medModalActions}>
                <TouchableOpacity onPress={() => setShowFeedback(false)} style={[styles.medModalCancelBtn, { borderColor: cardBorder }]} activeOpacity={0.8}>
                  <Text style={[styles.medModalCancelText, { color: textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendFeedback} style={[styles.modalSaveBtn, { flex: 1 }]} activeOpacity={0.8}>
                  <Text style={styles.modalSaveText}>{t('profile.send_feedback')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  profileHeader: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFFFFF' },
  nameDisplay: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold },
  nameInput: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, borderBottomWidth: 1.5, paddingVertical: 2, paddingHorizontal: 4, minWidth: 120, textAlign: 'center' },
  emailText: { fontSize: FontSize.sm },

  settingsCard: { borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, minHeight: 52 },
  settingsRowLeft: { flex: 1, marginRight: Spacing.sm },
  settingsRowLabel: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
  settingsRowSub: { fontSize: FontSize.xs, marginTop: 2 },
  settingsRowValue: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
  chevron: { fontSize: 20, fontWeight: '300' },
  rowDivider: { height: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.xs, paddingHorizontal: Spacing.xs },

  card: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  premiumTeaser: { borderWidth: 1.5 },
  premiumTeaserRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  premiumTeaserLeft: { flex: 1, gap: Spacing.xs },
  premiumTeaserTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold },
  premiumTeaserBody: { fontSize: FontSize.sm, lineHeight: 20 },
  premiumTeaserArrow: { fontSize: 20, fontWeight: '600', fontFamily: FontFamily.semiBold },
  premiumBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  premiumBadgeText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '700', fontFamily: FontFamily.bold },

  aiContextExpanded: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  aiContextInput: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.sm, minHeight: 90, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  helperText: { fontSize: FontSize.xs, lineHeight: 16, marginBottom: Spacing.md },
  saveContextBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  saveContextText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold },
  cancelContextBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelContextText: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },

  medListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  medInfo: { flex: 1 },
  medName: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold },
  medMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2, flexWrap: 'wrap' },
  medDose: { fontSize: FontSize.xs },
  medTime: { fontSize: FontSize.xs },
  freqBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  freqBadgeText: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: '600', fontFamily: FontFamily.semiBold },
  deleteIcon: { fontSize: FontSize.sm, color: Colors.error, paddingLeft: Spacing.sm },

  reportBtnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reportDateValue: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },
  timePickerActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  timePickerCancel: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  timePickerSave: { flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },

  deleteDataNote: { fontSize: FontSize.xs, marginTop: Spacing.xs, lineHeight: 16 },
  aiPrivacyBody: { fontSize: FontSize.xs, lineHeight: 18 },
  version: { fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.sm },
  privacyLink: { alignItems: 'center', paddingVertical: Spacing.xs, marginTop: Spacing.sm },
  privacyLinkText: { fontSize: FontSize.xs, textDecorationLine: 'underline' },

  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  editModalTitle: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.extraBold },
  editModalClose: { fontSize: FontSize.md, fontWeight: '600' },
  editModalContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  editFieldLabel: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  modalSaveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: '600', fontFamily: FontFamily.semiBold },

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
  feedbackInput: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.sm, minHeight: 120, marginTop: Spacing.xs, marginBottom: Spacing.md },

  androidTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  androidTimeCol: { alignItems: 'center', gap: Spacing.xs },
  androidTimeBtn: { width: 44, height: 36, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  androidTimeArrow: { fontSize: FontSize.sm, fontWeight: '700' },
  androidTimeValue: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold },
  androidTimeColon: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold },
});
