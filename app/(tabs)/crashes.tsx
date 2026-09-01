import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ProfileButton } from '@/components/common/ProfileButton';
import { InfoButton } from '@/components/common/InfoButton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useCrashes } from '@/hooks/useCrashes';
import { CrashSeverity, Crash } from '@/types';

const SEVERITIES: CrashSeverity[] = ['mild', 'moderate', 'severe'];
const CRASH_SYMPTOMS = [
  'fatigue',
  'pem',
  'cognitive_dysfunction',
  'pain',
  'orthostatic_intolerance',
  'sensory_sensitivity',
];

function toggleMulti<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000));
}

function dateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function severityColor(severity: CrashSeverity | null): string {
  if (severity === 'severe') return Colors.error;
  if (severity === 'moderate') return Colors.warning;
  return Colors.success;
}

// ─── EditCrashModal ─────────────────────────────────────────────────────────────

interface EditCrashModalProps {
  visible: boolean;
  crash: Crash | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Crash>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isDark: boolean;
}

function EditCrashModal({ visible, crash, onClose, onSave, onDelete, isDark }: EditCrashModalProps) {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState<CrashSeverity>('moderate');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (crash) {
      setSeverity(crash.severity ?? 'moderate');
      setSymptoms(crash.symptoms);
      setStartDate(crash.start_date);
      setEndDate(crash.end_date ?? '');
      setNotes(crash.notes ?? '');
    }
  }, [crash]);

  const handleSave = async () => {
    if (!crash?.id) return;
    setIsSaving(true);
    try {
      await onSave(crash.id, { severity, symptoms, start_date: startDate, end_date: endDate || null, notes });
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('crashes.error_save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!crash?.id) return;
    Alert.alert(t('crashes.delete_title'), t('crashes.delete_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('crashes.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete(crash.id!);
            onClose();
          } catch {
            Alert.alert(t('common.error'), t('crashes.error_save'));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalOverlay}>
        <View style={[styles.editModalSheet, isDark && styles.editModalSheetDark]}>
          <View style={styles.editModalHandle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.editModalTitle, isDark && styles.textPrimaryDark]}>{t('crashes.edit_title')}</Text>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.severity')}</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((v) => {
                const selected = severity === v;
                return (
                  <TouchableOpacity key={v} onPress={() => setSeverity(v)} style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>{t(`crashes.severity_${v}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.symptoms')}</Text>
            <View style={styles.chipRow}>
              {CRASH_SYMPTOMS.map((v) => {
                const selected = symptoms.includes(v);
                return (
                  <TouchableOpacity key={v} onPress={() => setSymptoms((arr) => toggleMulti(arr, v))} style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>{t(`crashes.symptom_${v}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.dates_label')}</Text>
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateInputLabel, isDark && styles.textSecDark]}>{t('crashes.start_label')}</Text>
                <TextInput
                  style={[styles.dateInput, isDark && styles.notesInputDark]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder={t('crashes.date_placeholder')}
                  placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateInputLabel, isDark && styles.textSecDark]}>{t('crashes.end_label')}</Text>
                <TextInput
                  style={[styles.dateInput, isDark && styles.notesInputDark]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder={t('crashes.date_placeholder')}
                  placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                />
              </View>
            </View>
            {endDate !== '' && (
              <TouchableOpacity onPress={() => setEndDate('')} style={styles.reopenLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.editLinkText}>{t('crashes.reopen_this_crash')}</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.notes_optional')}</Text>
            <TextInput
              style={[styles.notesInput, isDark && styles.notesInputDark]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Button label={t('common.save_changes')} onPress={handleSave} isLoading={isSaving} style={styles.editModalSaveBtn} />
            <Button label={t('crashes.delete_entry')} onPress={handleDelete} variant="ghost" textStyle={{ color: Colors.error }} />
            <Button label={t('common.cancel')} onPress={onClose} variant="ghost" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CrashesScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { crashes, activeCrash, recentExertionEvents, isLoading, startCrash, endActiveCrash, updateCrash, deleteCrash, refresh } = useCrashes();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [severity, setSeverity] = useState<CrashSeverity>('moderate');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [triggerEventId, setTriggerEventId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [editingCrash, setEditingCrash] = useState<Crash | null>(null);

  const handleStart = async () => {
    setIsSaving(true);
    try {
      await startCrash(severity, symptoms, notes, triggerEventId);
      setSymptoms([]);
      setNotes('');
      setTriggerEventId(null);
    } catch {
      Alert.alert('Failed to save crash');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnd = async () => {
    setIsEnding(true);
    try {
      await endActiveCrash();
    } catch {
      Alert.alert('Failed to end crash');
    } finally {
      setIsEnding(false);
    }
  };

  const pastCrashes = crashes.filter((c) => c.id !== activeCrash?.id);

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
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('crashes.title')}</Text>
            <InfoButton title={t('crashes.info_title')} message={t('crashes.info_message')} />
          </View>
          <ProfileButton />
        </View>

        {activeCrash ? (
          <View style={[styles.activeCard, isDark && styles.activeCardDark]}>
            <Text style={styles.activeTitle}>⚠ {t('crashes.active_title')}</Text>
            <Text style={[styles.activeSince, isDark && styles.textSecDark]}>
              {t('crashes.active_since')} {dateLabel(activeCrash.start_date)} · {t(
                daysSince(activeCrash.start_date) === 1 ? 'crashes.days_one' : 'crashes.days_other',
                { count: daysSince(activeCrash.start_date) }
              )}
            </Text>
            <Button label={t('crashes.end_crash')} onPress={handleEnd} isLoading={isEnding} variant="outline" />
          </View>
        ) : (
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('crashes.start_crash')}</Text>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.severity')}</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((v) => {
                const selected = severity === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setSeverity(v)}
                    style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                      {t(`crashes.severity_${v}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.symptoms')}</Text>
            <View style={styles.chipRow}>
              {CRASH_SYMPTOMS.map((v) => {
                const selected = symptoms.includes(v);
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setSymptoms((arr) => toggleMulti(arr, v))}
                    style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                      {t(`crashes.symptom_${v}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('crashes.likely_trigger')}</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                onPress={() => setTriggerEventId(null)}
                style={[styles.chip, isDark && styles.chipDark, triggerEventId === null && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isDark && triggerEventId !== null && styles.chipTextDark, triggerEventId === null && styles.chipTextSelected]}>
                  {t('crashes.no_trigger')}
                </Text>
              </TouchableOpacity>
              {recentExertionEvents.map((event) => {
                const selected = triggerEventId === event.id;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => setTriggerEventId(event.id ?? null)}
                    style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                      {t(`pace.type_${event.exertion_type}`)} · {new Date(event.occurred_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.notesInput, isDark && styles.notesInputDark]}
              placeholder={t('crashes.notes_optional')}
              placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
            />

            <Button label={t('crashes.save')} onPress={handleStart} isLoading={isSaving} />
          </View>
        )}

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('crashes.history')}</Text>
          {pastCrashes.length === 0 ? (
            <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('crashes.no_crashes_logged')}</Text>
          ) : (
            pastCrashes.map((crash: Crash) => (
              <TouchableOpacity
                key={crash.id}
                style={[styles.crashRow, isDark && styles.crashRowDark]}
                onPress={() => setEditingCrash(crash)}
                activeOpacity={0.7}
              >
                <View style={[styles.severityDot, { backgroundColor: severityColor(crash.severity) }]} />
                <View style={styles.crashInfo}>
                  <Text style={[styles.crashTitle, isDark && styles.textPrimaryDark]}>
                    {dateLabel(crash.start_date)}
                    {crash.end_date ? ` to ${dateLabel(crash.end_date)}` : ` (${t('crashes.ongoing')})`}
                  </Text>
                  {crash.pem_delay_hours !== null && (
                    <Text style={[styles.crashMeta, isDark && styles.textSecDark]}>
                      {t('crashes.delay_hours', { count: crash.pem_delay_hours })}
                    </Text>
                  )}
                </View>
                <Text style={styles.editLinkText}>{t('crashes.edit_link')}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <EditCrashModal
        visible={editingCrash !== null}
        crash={editingCrash}
        onClose={() => setEditingCrash(null)}
        onSave={updateCrash}
        onDelete={deleteCrash}
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

  activeCard: {
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error + '50',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  activeCardDark: { backgroundColor: Colors.error + '22' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, marginRight: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  activeTitle: { fontSize: FontSize.md, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.error },
  activeSince: { fontSize: FontSize.sm, color: Colors.textSecondary },

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
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  chipDark: { borderColor: Colors.borderDark },
  chipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  chipTextDark: { color: Colors.textPrimaryDark },
  chipTextSelected: { color: Colors.primaryDark, fontWeight: '700', fontFamily: FontFamily.bold },

  notesInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: FontSize.md, fontFamily: FontFamily.regular, color: Colors.textPrimary,
  },
  notesInputDark: { borderColor: Colors.borderDark, color: Colors.textPrimaryDark, backgroundColor: Colors.surfaceDark },

  crashRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  crashRowDark: { borderTopColor: Colors.borderDark },
  severityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  crashInfo: { flex: 1 },
  crashTitle: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textPrimary },
  crashMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  editLinkText: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.primary },

  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editModalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '85%' },
  editModalSheetDark: { backgroundColor: Colors.surfaceDark },
  editModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  editModalTitle: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  editModalSaveBtn: { marginTop: Spacing.md },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateInputLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  dateInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.sm, fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textPrimary,
  },
  reopenLink: { marginTop: Spacing.xs, marginBottom: Spacing.xs },

  bottomPad: { height: Spacing.xxl },
});
