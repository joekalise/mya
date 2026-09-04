import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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
import { MedsTaken, ExertionType, DailyLog } from '@/types';
import { getDailyLog, getDailyLogs, getDailyEnvelope, saveDailyLog, saveDailyEnvelope } from '@/services/database';
import i18n from '@/i18n';

function todayDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function localDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabelShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
}

function dateLabelFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function deriveMedicationsTaken(doses: MedsTaken[]): MedsTaken {
  if (doses.every((d) => d === 'yes')) return 'yes';
  if (doses.every((d) => d === 'no')) return 'no';
  return 'partial';
}

const EXERTION_TYPES: ExertionType[] = ['physical', 'cognitive', 'emotional', 'social'];
const DURATION_PRESETS = [15, 30, 45, 60, 90];
const MEDS_OPTIONS: MedsTaken[] = ['yes', 'partial', 'no'];

// ─── Day Log Modal (edit a past day) ───────────────────────────────────────

interface DayLogModalProps {
  date: string;
  initialLog: DailyLog | null;
  userId: string;
  tracksMedication: boolean;
  medicationDosesPerDay: number;
  isDark: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onSaved: (log: DailyLog) => void;
  onClose: () => void;
}

function DayLogModal({ date, initialLog, userId, tracksMedication, medicationDosesPerDay, isDark, t, onSaved, onClose }: DayLogModalProps) {
  const modalScrollRef = useRef<ScrollView>(null);
  const [isLoadingEnvelope, setIsLoadingEnvelope] = useState(true);
  const [energyAvailable, setEnergyAvailable] = useState(70);
  const [energySpent, setEnergySpent] = useState(0);
  const [bellScore, setBellScore] = useState(initialLog?.bell_score_today ?? 70);
  const [cognitiveScore, setCognitiveScore] = useState(initialLog?.cognitive_dysfunction_score ?? 0);
  const [wokeRested, setWokeRested] = useState<boolean | null>(initialLog?.woke_rested ?? null);
  const [medsTaken, setMedsTaken] = useState<MedsTaken>(initialLog?.medications_taken ?? 'yes');
  const [medsTakenDose1, setMedsTakenDose1] = useState<MedsTaken>(initialLog?.medications_taken_dose_1 ?? 'yes');
  const [medsTakenDose2, setMedsTakenDose2] = useState<MedsTaken>(initialLog?.medications_taken_dose_2 ?? 'yes');
  const [medsTakenDose3, setMedsTakenDose3] = useState<MedsTaken>(initialLog?.medications_taken_dose_3 ?? 'yes');
  const [notes, setNotes] = useState(initialLog?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDailyEnvelope(userId, date).then((env) => {
      if (cancelled) return;
      setEnergyAvailable(env?.budget_points ?? 70);
      setEnergySpent(env?.spent_points ?? 0);
      setIsLoadingEnvelope(false);
    }).catch(() => setIsLoadingEnvelope(false));
    return () => { cancelled = true; };
  }, [userId, date]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [saved] = await Promise.all([
        saveDailyLog({
          user_id: userId,
          date,
          bell_score_today: bellScore,
          fatigue_score: null,
          cognitive_dysfunction_score: cognitiveScore,
          pain_score: null,
          woke_rested: wokeRested,
          pem_today: false,
          dizzy_on_standing: null,
          palpitations: null,
          unsteady_on_feet: null,
          cold_limbs: null,
          temperature_dysregulation: null,
          flu_like_symptoms: null,
          sensory_chemical_reaction: null,
          medications_taken: !tracksMedication
            ? null
            : medicationDosesPerDay > 1
              ? deriveMedicationsTaken([medsTakenDose1, medsTakenDose2, medsTakenDose3].slice(0, medicationDosesPerDay))
              : medsTaken,
          medications_taken_dose_1: tracksMedication && medicationDosesPerDay > 1 ? medsTakenDose1 : null,
          medications_taken_dose_2: tracksMedication && medicationDosesPerDay > 1 ? medsTakenDose2 : null,
          medications_taken_dose_3: tracksMedication && medicationDosesPerDay > 2 ? medsTakenDose3 : null,
          notes,
        }),
        saveDailyEnvelope({ user_id: userId, date, budget_points: energyAvailable, spent_points: energySpent }),
      ]);
      onSaved(saved);
      onClose();
    } catch {
      Alert.alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[modalStyles.modalScreen, isDark && modalStyles.modalScreenDark]}>
        <View style={[modalStyles.modalHeader, isDark && modalStyles.modalHeaderDark]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.modalCancel}>
            <Text style={[modalStyles.modalCancelText, isDark && styles.textSecDark]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[modalStyles.modalTitle, isDark && styles.textPrimaryDark]}>{dateLabelFull(date)}</Text>
          <View style={modalStyles.modalCancel} />
        </View>

        {isLoadingEnvelope ? (
          <LoadingSpinner fullScreen message={t('common.loading')} />
        ) : (
          <ScrollView
            ref={modalScrollRef}
            contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.md }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('pace.energy_envelope')}</Text>
              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.available')}</Text>
              <DragSlider value={energyAvailable} onChange={setEnergyAvailable} isDark={isDark} min={0} max={100} step={10} invertColor />
              <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.spent')}</Text>
              <DragSlider value={energySpent} onChange={setEnergySpent} isDark={isDark} min={0} max={100} step={10} />
            </View>

            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.symptoms_today')}</Text>
              <View style={styles.symptomSubSection}>
                <Text style={[styles.symptomSubLabel, isDark && styles.textSecDark]}>{t('tracker.bell_score_today')}</Text>
                <DragSlider value={bellScore} onChange={setBellScore} isDark={isDark} min={0} max={100} step={10} invertColor />
                <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.bell_score_hint')}</Text>
              </View>
              <View style={[styles.symptomDivider, isDark && styles.symptomDividerDark]} />
              <View style={styles.symptomSubSection}>
                <Text style={[styles.symptomSubLabel, isDark && styles.textSecDark]}>{t('tracker.brain_fog_score')}</Text>
                <DragSlider value={cognitiveScore} onChange={setCognitiveScore} isDark={isDark} />
                <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.brain_fog_score_hint')}</Text>
              </View>
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
                onFocus={() => modalScrollRef.current?.scrollToEnd({ animated: true })}
              />
            </View>

            <Button label={t('tracker.save')} onPress={handleSave} isLoading={isSaving} style={styles.saveButton} />
            <View style={styles.bottomPad} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Date Picker Modal (browse older entries) ──────────────────────────────

interface DatePickerModalProps {
  isDark: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  maxDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

function DatePickerModal({ isDark, t, maxDate, onSelect, onClose }: DatePickerModalProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const maxD = new Date(maxDate + 'T12:00:00');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= maxD) {
      if (month === 11) { setYear((y) => y + 1); setMonth(0); }
      else setMonth((m) => m + 1);
    }
  };

  const cells: (number | null)[] = [
    ...Array(firstDay === 0 ? 6 : firstDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isFuture = (day: number) => new Date(year, month, day) > maxD;

  const handleDay = (day: number) => {
    if (isFuture(day)) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(dateStr);
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[modalStyles.modalScreen, isDark && modalStyles.modalScreenDark]}>
        <View style={[modalStyles.modalHeader, isDark && modalStyles.modalHeaderDark]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.modalCancel}>
            <Text style={[modalStyles.modalCancelText, isDark && styles.textSecDark]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[modalStyles.modalTitle, isDark && styles.textPrimaryDark]}>{t('tracker.browse_entries_title')}</Text>
          <View style={modalStyles.modalCancel} />
        </View>

        <View style={modalStyles.calendarContainer}>
          <View style={modalStyles.calendarNav}>
            <TouchableOpacity onPress={prevMonth} style={modalStyles.calNavBtn}>
              <Text style={[modalStyles.calNavText, isDark && styles.textPrimaryDark]}>‹</Text>
            </TouchableOpacity>
            <Text style={[modalStyles.calMonthLabel, isDark && styles.textPrimaryDark]}>{monthName}</Text>
            <TouchableOpacity onPress={nextMonth} style={modalStyles.calNavBtn}>
              <Text style={[modalStyles.calNavText, isDark && styles.textPrimaryDark]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.calDayHeaders}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={[modalStyles.calDayHeader, isDark && styles.textSecDark]}>{d}</Text>
            ))}
          </View>

          <View style={modalStyles.calGrid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={modalStyles.calCell} />;
              const disabled = isFuture(day);
              return (
                <TouchableOpacity
                  key={i}
                  style={[modalStyles.calCell, modalStyles.calDay, disabled && modalStyles.calDayDisabled]}
                  onPress={() => handleDay(day)}
                  activeOpacity={disabled ? 1 : 0.7}
                >
                  <Text style={[modalStyles.calDayText, isDark && !disabled && styles.textPrimaryDark, disabled && modalStyles.calDayTextDisabled]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Recent Logs Card ───────────────────────────────────────────────────────

interface RecentLogsCardProps {
  recentDays: string[];
  logsByDate: Record<string, DailyLog>;
  isDark: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  hasOlderLogs: boolean;
  onOpenDay: (date: string, log: DailyLog | null) => void;
  onBrowseOlder: () => void;
}

function RecentLogsCard({ recentDays, logsByDate, isDark, t, hasOlderLogs, onOpenDay, onBrowseOlder }: RecentLogsCardProps) {
  return (
    <View style={[modalStyles.recentCard, isDark && modalStyles.recentCardDark]}>
      <Text style={[modalStyles.recentCardTitle, isDark && styles.textPrimaryDark]}>{t('tracker.recent_check_ins')}</Text>

      {recentDays.map((date) => {
        const log = logsByDate[date];
        const statParts: string[] = [];
        if (log?.bell_score_today !== null && log?.bell_score_today !== undefined) {
          statParts.push(t('tracker.recent_bell_stat', { value: log.bell_score_today }));
        }
        if (log?.cognitive_dysfunction_score !== null && log?.cognitive_dysfunction_score !== undefined) {
          statParts.push(t('tracker.recent_brain_fog_stat', { value: log.cognitive_dysfunction_score }));
        }
        return (
          <TouchableOpacity
            key={date}
            style={[modalStyles.recentRow, isDark && modalStyles.recentRowDark]}
            onPress={() => onOpenDay(date, log ?? null)}
            activeOpacity={0.7}
          >
            <View style={modalStyles.recentRowLeft}>
              <Text style={[modalStyles.recentDate, isDark && styles.textPrimaryDark]}>{dateLabelShort(date)}</Text>
              {statParts.length > 0 ? (
                <Text style={[modalStyles.recentStats, isDark && styles.textSecDark]}>{statParts.join(' · ')}</Text>
              ) : (
                <Text style={[modalStyles.recentStats, { color: Colors.primary }]}>{t('tracker.log_this_day')}</Text>
              )}
            </View>
            <Text style={[modalStyles.recentChevron, isDark && styles.textSecDark]}>›</Text>
          </TouchableOpacity>
        );
      })}

      {hasOlderLogs && (
        <TouchableOpacity style={modalStyles.browseOlderBtn} onPress={onBrowseOlder} activeOpacity={0.7}>
          <Text style={modalStyles.browseOlderText}>{t('tracker.browse_older')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
  const params = useLocalSearchParams<{ edit?: string }>();

  useFocusEffect(useCallback(() => { refreshLog(); refreshEnvelope(); }, [refreshLog, refreshEnvelope]));

  const todayStr = localDateString(0);

  // Recent logs (last 7 days, excluding today) + whether older entries exist
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [hasOlderLogs, setHasOlderLogs] = useState(false);
  const loadRecentLogs = useCallback(async () => {
    if (!user) return;
    try {
      const logs = await getDailyLogs(user.id, 100);
      const cutoff = localDateString(7);
      setRecentLogs(logs.filter((l) => l.date !== todayStr && l.date >= cutoff));
      setHasOlderLogs(logs.some((l) => l.date < cutoff));
    } catch {}
  }, [user, todayStr]);

  useFocusEffect(useCallback(() => { loadRecentLogs(); }, [loadRecentLogs]));

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalLog, setModalLog] = useState<DailyLog | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const openEntryForDate = useCallback(async (date: string, knownLog?: DailyLog | null) => {
    if (!user) return;
    if (knownLog !== undefined) {
      setModalLog(knownLog);
      setModalDate(date);
      return;
    }
    try {
      const log = await getDailyLog(user.id, date);
      setModalLog(log);
      setModalDate(date);
    } catch {
      setModalLog(null);
      setModalDate(date);
    }
  }, [user]);

  const recentDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => localDateString(i + 1)),
    [todayStr],
  );

  const logsByDate = useMemo(() => {
    const map: Record<string, DailyLog> = {};
    recentLogs.forEach((l) => { map[l.date] = l; });
    return map;
  }, [recentLogs]);

  // Captured once at mount so a later refresh (e.g. after saving) doesn't keep forcing edit mode back on.
  const forceEditOnLoad = useRef(params.edit === 'true');

  const [editing, setEditing] = useState(false);
  const [energyAvailable, setEnergyAvailable] = useState(70);
  const [energySpent, setEnergySpent] = useState(0);
  const [bellScore, setBellScore] = useState(70);
  const [cognitiveScore, setCognitiveScore] = useState(0);
  const [wokeRested, setWokeRested] = useState<boolean | null>(null);
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
      setCognitiveScore(todayLog.cognitive_dysfunction_score ?? 0);
      setWokeRested(todayLog.woke_rested ?? null);
      setMedsTaken(todayLog.medications_taken ?? 'yes');
      setMedsTakenDose1(todayLog.medications_taken_dose_1 ?? 'yes');
      setMedsTakenDose2(todayLog.medications_taken_dose_2 ?? 'yes');
      setMedsTakenDose3(todayLog.medications_taken_dose_3 ?? 'yes');
      setNotes(todayLog.notes ?? '');
    }
    setEditing(forceEditOnLoad.current);
    forceEditOnLoad.current = false;
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
          fatigue_score: null,
          cognitive_dysfunction_score: cognitiveScore,
          pain_score: null,
          woke_rested: wokeRested,
          pem_today: false,
          dizzy_on_standing: null,
          palpitations: null,
          unsteady_on_feet: null,
          cold_limbs: null,
          temperature_dysregulation: null,
          flu_like_symptoms: null,
          sensory_chemical_reaction: null,
          medications_taken: !tracksMedication
            ? null
            : medicationDosesPerDay > 1
              ? deriveMedicationsTaken([medsTakenDose1, medsTakenDose2, medsTakenDose3].slice(0, medicationDosesPerDay))
              : medsTaken,
          medications_taken_dose_1: tracksMedication && medicationDosesPerDay > 1 ? medsTakenDose1 : null,
          medications_taken_dose_2: tracksMedication && medicationDosesPerDay > 1 ? medsTakenDose2 : null,
          medications_taken_dose_3: tracksMedication && medicationDosesPerDay > 2 ? medsTakenDose3 : null,
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
              <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('tracker.symptoms_today')}</Text>

              <View style={styles.symptomSubSection}>
                <View style={styles.symptomSubHeader}>
                  <Text style={[styles.symptomSubLabel, isDark && styles.textSecDark]}>{t('tracker.bell_score_today')}</Text>
                  <InfoButton title={t('tracker.bell_score_info_title')} message={t('tracker.bell_score_info_message')} />
                </View>
                <DragSlider value={bellScore} onChange={setBellScore} isDark={isDark} min={0} max={100} step={10} invertColor />
                <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.bell_score_hint')}</Text>
              </View>

              <View style={[styles.symptomDivider, isDark && styles.symptomDividerDark]} />

              <View style={styles.symptomSubSection}>
                <Text style={[styles.symptomSubLabel, isDark && styles.textSecDark]}>{t('tracker.brain_fog_score')}</Text>
                <DragSlider value={cognitiveScore} onChange={setCognitiveScore} isDark={isDark} />
                <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('tracker.brain_fog_score_hint')}</Text>
              </View>
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
              <TouchableOpacity onPress={() => setShowExertionForm((v) => !v)} activeOpacity={0.7} style={styles.exertionHeaderRow}>
                <View style={styles.exertionHeaderLeft}>
                  <Ionicons name="flash-outline" size={18} color={isDark ? Colors.textPrimaryDark : Colors.textPrimary} />
                  <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark, { marginBottom: 0 }]}>{t('pace.log_exertion_optional')}</Text>
                  {events.length > 0 && (
                    <View style={styles.exertionCountBadge}>
                      <Text style={styles.exertionCountBadgeText}>{events.length}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name={showExertionForm ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? Colors.textSecondaryDark : Colors.textSecondary} />
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

        {recentLogs.length > 0 && (
          <RecentLogsCard
            recentDays={recentDays}
            logsByDate={logsByDate}
            isDark={isDark}
            t={t}
            hasOlderLogs={hasOlderLogs}
            onOpenDay={(date, log) => openEntryForDate(date, log)}
            onBrowseOlder={() => setShowDatePicker(true)}
          />
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {modalDate && user && (
        <DayLogModal
          date={modalDate}
          initialLog={modalLog}
          userId={user.id}
          tracksMedication={tracksMedication}
          medicationDosesPerDay={medicationDosesPerDay}
          isDark={isDark}
          t={t}
          onSaved={(saved) => {
            setRecentLogs((prev) => {
              const filtered = prev.filter((l) => l.date !== saved.date);
              return [...filtered, saved].sort((a, b) => b.date.localeCompare(a.date));
            });
          }}
          onClose={() => { setModalDate(null); setModalLog(null); }}
        />
      )}

      {showDatePicker && (
        <DatePickerModal
          isDark={isDark}
          t={t}
          maxDate={localDateString(8)}
          onSelect={(date) => openEntryForDate(date, undefined)}
          onClose={() => setShowDatePicker(false)}
        />
      )}
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

  symptomSubSection: { gap: Spacing.sm },
  symptomSubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symptomSubLabel: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textSecondary },
  symptomDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  symptomDividerDark: { backgroundColor: Colors.borderDark },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  exertionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exertionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  exertionCountBadge: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  exertionCountBadgeText: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.primaryDark },

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

const modalStyles = StyleSheet.create({
  recentCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  recentCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  recentCardTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  recentRowDark: { borderTopColor: Colors.borderDark },
  recentRowLeft: { flex: 1, gap: 2 },
  recentDate: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textPrimary },
  recentStats: { fontSize: FontSize.xs, color: Colors.textSecondary },
  recentChevron: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300' },
  browseOlderBtn: { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: Spacing.md, alignItems: 'center' },
  browseOlderText: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.primary },

  modalScreen: { flex: 1, backgroundColor: Colors.background },
  modalScreenDark: { backgroundColor: Colors.backgroundDark },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalHeaderDark: { borderBottomColor: Colors.borderDark },
  modalCancel: { width: 64 },
  modalCancelText: { fontSize: FontSize.md, color: Colors.textSecondary },
  modalTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary, textAlign: 'center' },

  calendarContainer: { padding: Spacing.md },
  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  calNavBtn: { padding: Spacing.sm },
  calNavText: { fontSize: 28, fontWeight: '300', color: Colors.textPrimary, lineHeight: 28 },
  calMonthLabel: { fontSize: FontSize.lg, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  calDayHeaders: { flexDirection: 'row', marginBottom: Spacing.xs },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textSecondary, paddingVertical: Spacing.xs },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDay: { borderRadius: BorderRadius.sm },
  calDayDisabled: { opacity: 0.25 },
  calDayText: { fontSize: FontSize.md, fontWeight: '500', fontFamily: FontFamily.medium, color: Colors.textPrimary },
  calDayTextDisabled: { color: Colors.textSecondary },
});
