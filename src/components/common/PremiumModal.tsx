import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius, FontFamily } from '@/constants/theme';
import { getPrivacyPolicyUrl } from '@/utils/links';

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: () => void;
  onRestore: () => void;
  monthlyPrice: string | null;
  trialDays: number | null;
  isPurchasing: boolean;
  isRestoring: boolean;
  isDark: boolean;
}

// ─── Mock renders ─────────────────────────────────────────────────────────────

function MockInsightCard({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const cardBg = isDark ? '#2D1A0E' : '#FFF7ED';
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  return (
    <View style={[mock.card, { backgroundColor: cardBg, borderColor: Colors.primary + '40' }]}>
      <View style={mock.row}>
        <Text style={[mock.cardTitle, { color: textPrimary }]}>{t('premium_modal.mock_insight_title')}</Text>
        <View style={mock.badge}><Text style={mock.badgeText}>AI</Text></View>
      </View>
      <Text style={[mock.body, { color: textSecondary }]}>{t('premium_modal.mock_insight_body')}</Text>
      <View style={mock.chipRow}>
        {[t('premium_modal.mock_insight_chip_1'), t('premium_modal.mock_insight_chip_2'), t('premium_modal.mock_insight_chip_3')].map((chip) => (
          <View key={chip} style={[mock.chip, { borderColor: Colors.primary + '60' }]}>
            <Text style={[mock.chipText, { color: Colors.primary }]}>{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MockChatCard({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const userBg = Colors.primary;
  const aiBg = isDark ? '#3a3330' : '#F5F5F4';

  return (
    <View style={[mock.card, { backgroundColor: cardBg, borderColor: isDark ? Colors.borderDark : Colors.border }]}>
      <View style={mock.row}>
        <Text style={[mock.cardTitle, { color: textPrimary }]}>{t('premium_modal.mock_chat_title')}</Text>
        <View style={mock.badge}><Text style={mock.badgeText}>AI</Text></View>
      </View>
      <View style={mock.chatBubbleUser}>
        <Text style={[mock.chatText, { color: '#FFFFFF', backgroundColor: userBg }]}>{t('premium_modal.mock_chat_user')}</Text>
      </View>
      <View style={mock.chatBubbleAi}>
        <Text style={[mock.chatText, { color: textPrimary, backgroundColor: aiBg }]}>{t('premium_modal.mock_chat_ai')}</Text>
      </View>
      <Text style={[mock.chatPrompt, { color: textSecondary }]}>{t('premium_modal.mock_chat_prompt')}</Text>
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function PremiumModal({
  visible,
  onClose,
  onPurchase,
  onRestore,
  monthlyPrice,
  trialDays,
  isPurchasing,
  isRestoring,
  isDark,
}: PremiumModalProps) {
  const { t } = useTranslation();
  const bg = isDark ? Colors.backgroundDark : Colors.background;
  const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
  const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
  const cardBorder = isDark ? Colors.borderDark : Colors.border;

  const features: { icon: string; title: string }[] = [
    { icon: '📊', title: t('premium_modal.feature_1_title') },
    { icon: '💬', title: t('premium_modal.feature_2_title') },
    { icon: '📅', title: t('premium_modal.feature_3_title') },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      {/* React Native's Modal renders its content in a separate native view
          hierarchy on iOS, which doesn't reliably inherit insets measured by
          the app-level SafeAreaProvider in _layout.tsx. A fresh SafeAreaProvider
          re-measures insets for this specific window. */}
      <SafeAreaProvider>
      <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Text style={[styles.closeText, { color: textSecondary }]}>✕</Text>
        </TouchableOpacity>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>✦</Text>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('premium_modal.header_title')}</Text>
            <Text style={[styles.headerSubtitle, { color: textSecondary }]}>{t('premium_modal.header_subtitle')}</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('premium_modal.section_see_in_action')}</Text>
          <MockInsightCard isDark={isDark} />
          <MockChatCard isDark={isDark} />

          <Text style={[styles.sectionLabel, { color: textSecondary }]}>{t('premium_modal.section_whats_included')}</Text>
          <View style={[styles.featureCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {features.map((f, i) => (
              <View key={f.title} style={[styles.featureRowCompact, i < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: cardBorder }]}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[styles.featureTitle, { color: textPrimary }]}>{f.title}</Text>
              </View>
            ))}
          </View>

          {/* Pricing — price must be most prominent per App Store guideline 3.1.2(c) */}
          {monthlyPrice && (
            <Text style={[styles.priceAmount, { color: textPrimary }]}>
              {monthlyPrice}{t('premium_modal.price_per_month')}
            </Text>
          )}
          {trialDays && (
            <Text style={[styles.trialLabel, { color: textSecondary }]}>{t('subscription.trial_sublabel', { days: trialDays })}</Text>
          )}
          <Text style={[styles.pricingNote, { color: textSecondary }]}>
            {trialDays && monthlyPrice
              ? `${t('premium_modal.after_trial', { days: trialDays, price: monthlyPrice })} ${Platform.OS === 'ios' ? t('subscription.cancel_note') : t('subscription.cancel_note_android')}`
              : Platform.OS === 'ios' ? t('subscription.cancel_note') : t('subscription.cancel_note_android')}
          </Text>
          <View style={styles.legalRow}>
            <Text style={[styles.legalLink, { color: textSecondary }]} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              {t('subscription.terms_of_use')}
            </Text>
            <Text style={[styles.legalDot, { color: textSecondary }]}> · </Text>
            <Text style={[styles.legalLink, { color: textSecondary }]} onPress={() => Linking.openURL(getPrivacyPolicyUrl()).catch(() => {})}>
              {t('subscription.privacy_policy')}
            </Text>
          </View>

          <TouchableOpacity onPress={onPurchase} disabled={isPurchasing} activeOpacity={0.85} style={[styles.primaryBtn, { opacity: isPurchasing ? 0.7 : 1 }]}>
            {isPurchasing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('premium_modal.start_free_trial')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onRestore} disabled={isRestoring} activeOpacity={0.7} style={styles.restoreBtn}>
            {isRestoring ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={[styles.restoreText, { color: textSecondary }]}>{t('premium_modal.restore_purchases')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mock = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, flex: 1 },
  badge: { backgroundColor: Colors.primary + '20', borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.primary },
  body: { fontSize: FontSize.sm, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  chipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold },
  chatBubbleUser: { alignItems: 'flex-end', marginBottom: Spacing.xs },
  chatBubbleAi: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  chatText: { fontSize: FontSize.sm, lineHeight: 20, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxWidth: '85%', overflow: 'hidden' },
  chatPrompt: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.xs },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  closeBtn: {
    // Kept clear of the screen's extreme top-right corner — that's iOS's
    // Control Center swipe zone, and a touchable flush against it loses touch
    // arbitration to the system gesture, making it feel unpressable.
    alignSelf: 'flex-end',
    marginTop: Spacing.md,
    marginRight: Spacing.lg,
    padding: Spacing.md,
  },
  closeText: { fontSize: 20, fontWeight: '500', fontFamily: FontFamily.medium },
  scrollContainer: {
    // ScrollView needs its own flex: 1, not just a contentContainerStyle, to get
    // a bounded height from its flex parent — otherwise Android sizes it to its
    // content instead of the viewport and scrolling silently does nothing.
    flex: 1,
  },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 48 },
  header: { alignItems: 'center', paddingVertical: Spacing.xl },
  headerEmoji: { fontSize: 36, color: Colors.primary, marginBottom: Spacing.sm },
  headerTitle: { fontSize: 28, fontWeight: '800', fontFamily: FontFamily.extraBold, marginBottom: Spacing.sm, textAlign: 'center' },
  headerSubtitle: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.8, marginBottom: Spacing.sm, marginTop: Spacing.md },
  featureCard: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.lg },
  featureRowCompact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  featureIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  featureTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, flex: 1 },
  priceAmount: { fontSize: 28, fontWeight: '800', fontFamily: FontFamily.extraBold, marginBottom: 4 },
  trialLabel: { fontSize: FontSize.xs, marginBottom: 4, fontWeight: '500', fontFamily: FontFamily.medium },
  pricingNote: { fontSize: FontSize.xs, lineHeight: 18, marginBottom: Spacing.sm },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.xl },
  legalLink: { fontSize: FontSize.xs, textDecorationLine: 'underline' },
  legalDot: { fontSize: FontSize.xs },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  primaryBtnText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold },
  restoreBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  restoreText: { fontSize: FontSize.sm },
});
