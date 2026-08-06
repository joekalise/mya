import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useEnergyEnvelope } from '@/hooks/useEnergyEnvelope';
import { ExertionType, ExertionEvent } from '@/types';

const EXERTION_TYPES: ExertionType[] = ['physical', 'cognitive', 'emotional', 'social'];
const DURATION_PRESETS = [15, 30, 45, 60, 90];

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function PaceScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { events, budget, spent, isLoading, addEvent, removeEvent, setBudget, refresh } = useEnergyEnvelope();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [type, setType] = useState<ExertionType>('physical');
  const [intensity, setIntensity] = useState(3);
  const [duration, setDuration] = useState<number | null>(30);
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      await addEvent(type, intensity, duration, notes);
      setNotes('');
    } catch {
      Alert.alert('Failed to save exertion');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (event: ExertionEvent) => {
    if (!event.id) return;
    try {
      await removeEvent(event.id);
    } catch {
      Alert.alert('Failed to remove');
    }
  };

  const overBudget = spent > budget;
  const fillPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  if (isLoading) {
    return <SafeAreaView style={[styles.screen, isDark && styles.screenDark]} />;
  }

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('pace.title')}</Text>

        <View style={[styles.envelopeCard, isDark && styles.envelopeCardDark]}>
          <View style={styles.envelopeRow}>
            <View style={styles.envelopeStat}>
              <Text style={[styles.envelopeLabel, isDark && styles.textSecDark]}>{t('pace.available')}</Text>
              <View style={styles.budgetStepperRow}>
                <TouchableOpacity
                  onPress={() => setBudget(Math.max(0, budget - 10))}
                  style={[styles.stepperBtn, isDark && styles.stepperBtnDark]}
                >
                  <Text style={[styles.stepperText, isDark && styles.textPrimaryDark]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.envelopeValue, isDark && styles.textPrimaryDark]}>{budget}</Text>
                <TouchableOpacity
                  onPress={() => setBudget(budget + 10)}
                  style={[styles.stepperBtn, isDark && styles.stepperBtnDark]}
                >
                  <Text style={[styles.stepperText, isDark && styles.textPrimaryDark]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.envelopeStat}>
              <Text style={[styles.envelopeLabel, isDark && styles.textSecDark]}>{t('pace.spent')}</Text>
              <Text style={[styles.envelopeValue, { color: overBudget ? Colors.error : Colors.success }]}>
                {spent}
              </Text>
            </View>
          </View>

          <View style={[styles.progressTrack, isDark && styles.progressTrackDark]}>
            <View
              style={[
                styles.progressFill,
                { width: `${fillPct}%`, backgroundColor: overBudget ? Colors.error : Colors.success },
              ]}
            />
          </View>

          {overBudget ? (
            <Text style={styles.overBudgetText}>⚠ {t('pace.over_budget')}</Text>
          ) : (
            <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('pace.budget_hint')}</Text>
          )}
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('pace.log_exertion')}</Text>

          <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.exertion_type')}</Text>
          <View style={styles.chipRow}>
            {EXERTION_TYPES.map((v) => {
              const selected = type === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setType(v)}
                  style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                    {t(`pace.type_${v}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.intensity')}</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map((v) => {
              const selected = intensity === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setIntensity(v)}
                  style={[styles.intensityBtn, isDark && styles.chipDark, selected && styles.chipSelected]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, isDark && styles.textSecDark]}>{t('pace.duration_minutes')}</Text>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((m) => {
              const selected = duration === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setDuration(selected ? null : m)}
                  style={[styles.chip, isDark && styles.chipDark, selected && styles.chipSelected]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isDark && !selected && styles.chipTextDark, selected && styles.chipTextSelected]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={[styles.notesInput, isDark && styles.notesInputDark]}
            placeholder={t('pace.notes_optional')}
            placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
          />

          <Button label={t('pace.add')} onPress={handleAdd} isLoading={isAdding} />
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionLabel, isDark && styles.textPrimaryDark]}>{t('pace.todays_exertion')}</Text>
          {events.length === 0 ? (
            <Text style={[styles.hint, isDark && styles.textSecDark]}>{t('pace.no_exertion_logged')}</Text>
          ) : (
            events.map((event) => (
              <View key={event.id} style={[styles.eventRow, isDark && styles.eventRowDark]}>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, isDark && styles.textPrimaryDark]}>
                    {t(`pace.type_${event.exertion_type}`)} · {t('pace.intensity')} {event.intensity}
                    {event.duration_minutes ? ` · ${event.duration_minutes}min` : ''}
                  </Text>
                  <Text style={[styles.eventTime, isDark && styles.textSecDark]}>{timeLabel(event.occurred_at)}</Text>
                  {event.notes ? (
                    <Text style={[styles.eventNotes, isDark && styles.textSecDark]}>{event.notes}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => handleRemove(event)}>
                  <Text style={styles.removeText}>{t('pace.remove')}</Text>
                </TouchableOpacity>
              </View>
            ))
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
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  envelopeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  envelopeCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  envelopeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  envelopeStat: { alignItems: 'center', gap: Spacing.xs },
  envelopeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  envelopeValue: { fontSize: 32, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  budgetStepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDark: { borderColor: Colors.borderDark },
  stepperText: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: Colors.borderDark },
  progressFill: { height: '100%', borderRadius: 4 },
  overBudgetText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },

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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  intensityBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
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

  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  eventRowDark: { borderTopColor: Colors.borderDark },
  eventInfo: { flex: 1, gap: 2 },
  eventTitle: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textPrimary },
  eventTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  eventNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  removeText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },

  bottomPad: { height: Spacing.xxl },
});
