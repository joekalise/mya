import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { saveDsqSfScore } from '@/services/database';
import { scheduleDsqSfReminder } from '@/services/notifications';
import { DSQ_SF_ITEMS } from '@/types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function ScaleRow({
  value,
  onChange,
  isDark,
}: {
  value: number;
  onChange: (n: number) => void;
  isDark: boolean;
}) {
  return (
    <View style={styles.scaleRow}>
      {[0, 1, 2, 3, 4].map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[styles.scaleBtn, isDark && styles.scaleBtnDark, selected && styles.scaleBtnSelected]}
            activeOpacity={0.7}
          >
            <Text style={[styles.scaleBtnText, isDark && !selected && styles.textPrimaryDark, selected && styles.scaleBtnTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function DsqSfScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const [freq, setFreq] = useState<number[]>(new Array(14).fill(0));
  const [sev, setSev] = useState<number[]>(new Array(14).fill(0));
  const [isSaving, setIsSaving] = useState(false);

  const setFreqAt = (i: number, v: number) => setFreq((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  const setSevAt = (i: number, v: number) => setSev((arr) => arr.map((x, idx) => (idx === i ? v : x)));

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload: Record<string, number | string> = {
        user_id: user.id,
        date: todayDateString(),
      };
      DSQ_SF_ITEMS.forEach((_, i) => {
        payload[`freq_${i + 1}`] = freq[i];
        payload[`sev_${i + 1}`] = sev[i];
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await saveDsqSfScore(payload as any);
      await scheduleDsqSfReminder(payload.date as string).catch(() => {});
      router.back();
    } catch {
      Alert.alert('Failed to save assessment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.headerCancel, isDark && styles.textSecDark]}>Close</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textPrimaryDark]}>{t('dsq_sf.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, isDark && styles.textSecDark]}>{t('dsq_sf.subtitle')}</Text>

        <View style={[styles.legendCard, isDark && styles.legendCardDark]}>
          <Text style={[styles.legendLabel, isDark && styles.textPrimaryDark]}>{t('dsq_sf.frequency_label')}</Text>
          <Text style={[styles.legendText, isDark && styles.textSecDark]}>{t('dsq_sf.frequency_legend')}</Text>
          <Text style={[styles.legendLabel, isDark && styles.textPrimaryDark, { marginTop: Spacing.sm }]}>{t('dsq_sf.severity_label')}</Text>
          <Text style={[styles.legendText, isDark && styles.textSecDark]}>{t('dsq_sf.severity_legend')}</Text>
        </View>

        {DSQ_SF_ITEMS.map((item, i) => (
          <View key={item} style={[styles.itemCard, isDark && styles.itemCardDark]}>
            <Text style={[styles.itemLabel, isDark && styles.textPrimaryDark]}>
              {i + 1}. {t(`dsq_sf.item_${item}`)}
            </Text>
            <Text style={[styles.scaleCaption, isDark && styles.textSecDark]}>{t('dsq_sf.frequency_label')}</Text>
            <ScaleRow value={freq[i]} onChange={(v) => setFreqAt(i, v)} isDark={isDark} />
            <Text style={[styles.scaleCaption, isDark && styles.textSecDark]}>{t('dsq_sf.severity_label')}</Text>
            <ScaleRow value={sev[i]} onChange={(v) => setSevAt(i, v)} isDark={isDark} />
          </View>
        ))}

        <Button label={t('dsq_sf.save')} onPress={handleSave} isLoading={isSaving} style={styles.saveButton} />

        <Text style={[styles.attribution, isDark && styles.textSecDark]}>{t('dsq_sf.attribution')}</Text>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.backgroundDark },
  textPrimaryDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  headerDark: { borderBottomColor: Colors.borderDark },
  headerCancel: { fontSize: FontSize.md, color: Colors.textSecondary, minWidth: 60 },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  headerSpacer: { minWidth: 60 },

  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  legendCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  legendCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  legendLabel: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  itemCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs,
  },
  itemCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  itemLabel: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  scaleCaption: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scaleRow: { flexDirection: 'row', gap: Spacing.sm },
  scaleBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleBtnDark: { borderColor: Colors.borderDark },
  scaleBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  scaleBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  scaleBtnTextSelected: { color: '#FFFFFF' },

  saveButton: { marginTop: Spacing.sm },
  attribution: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16, fontStyle: 'italic' },
  bottomPad: { height: Spacing.xxl },
});
