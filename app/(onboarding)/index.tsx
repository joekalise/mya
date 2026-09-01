import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { StepHeader } from '@/components/onboarding/StepHeader';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { MultiSelectCard } from '@/components/onboarding/MultiSelectCard';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Colors } from '@/constants/colors';
import { Spacing, FontSize, FontFamily, BorderRadius } from '@/constants/theme';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateWelcomeContent } from '@/services/aiInsights';
import { setAiConsent } from '@/services/aiConsent';
import { getPrivacyPolicyUrl } from '@/utils/links';
import { WelcomeContent, PrimarySymptom, PemOnsetDelay, Medication } from '@/types';

const TOTAL_STEPS = 4;

const TOUR_SLIDES = [
  { icon: 'today-outline' as const, titleKey: 'onboarding.tour.today_title', bodyKey: 'onboarding.tour.today_body' },
  { icon: 'battery-charging-outline' as const, titleKey: 'onboarding.tour.pace_title', bodyKey: 'onboarding.tour.pace_body' },
  { icon: 'flash-outline' as const, titleKey: 'onboarding.tour.crashes_title', bodyKey: 'onboarding.tour.crashes_body' },
  { icon: 'stats-chart-outline' as const, titleKey: 'onboarding.tour.insights_title', bodyKey: 'onboarding.tour.insights_body' },
];

const PRIMARY_SYMPTOMS: PrimarySymptom[] = [
  'fatigue',
  'pem',
  'unrefreshing_sleep',
  'cognitive_dysfunction',
  'orthostatic_intolerance',
  'pain',
  'sensory_sensitivity',
  'temperature_dysregulation',
  'immune_flulike',
  'gi_issues',
];

const BELL_SCORES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

const PEM_ONSET_DELAYS: PemOnsetDelay[] = ['same_day', 'next_day', '24_72h', 'variable'];

const MEDICATIONS: Medication[] = ['low_dose_naltrexone', 'beta_blockers', 'antihistamines_h1_h2', 'stimulants', 'antidepressants', 'anticoagulants', 'no_medication', 'other'];

function toggleMulti<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { saveProfile } = useProfile();
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const [currentStep, setCurrentStep] = useState(1);
  const [primarySymptoms, setPrimarySymptoms] = useState<PrimarySymptom[]>([]);
  const [bellScore, setBellScore] = useState<number | null>(null);
  const [pemOnsetDelay, setPemOnsetDelay] = useState<PemOnsetDelay | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [aiConsented, setAiConsented] = useState<boolean | null>(null);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return primarySymptoms.length > 0;
      case 2:
        return bellScore !== null;
      case 3:
        return pemOnsetDelay !== null;
      case 4:
        return medications.length > 0;
      default:
        return false;
    }
  }, [currentStep, primarySymptoms, bellScore, pemOnsetDelay, medications]);

  const handleComplete = async () => {
    if (!user) return;
    setIsCompleting(true);

    let welcomeContent: WelcomeContent = {
      welcome_message:
        "Welcome to Mya. We're glad you're here. This app will help you track and understand your ME/CFS, and build the record you need to be believed.",
      insights: [
        'Consistent daily tracking is one of the most powerful tools for building evidence of your condition, for yourself and for others.',
        "Pacing within your energy envelope, not overspending it, is one of the most effective tools for reducing the frequency and severity of crashes.",
        'Logging PEM (crashes) separately from your daily check-in makes it possible to see the delay between exertion and crash clearly over time.',
      ],
      watch_summary:
        'Mya will monitor your functional level, exertion, and crash patterns to help you and your doctor see the connection between what you do and how you feel.',
    };

    try {
      await setAiConsent(aiConsented ?? true);
    } catch {}

    if (aiConsented) {
      try {
        welcomeContent = await generateWelcomeContent({ primarySymptoms, bellScore, pemOnsetDelay, medications }, i18n.language);
      } catch (err) {
        console.warn('Claude API failed, using fallback content:', err);
      }
    }

    try {
      await saveProfile({
        primary_symptoms: primarySymptoms,
        bell_score_baseline: bellScore,
        pem_onset_delay: pemOnsetDelay,
        medications,
        notification_time: '20:00',
        ai_context: '',
        onboarding_complete: false,
        welcome_message: welcomeContent.welcome_message,
      });
    } catch (err) {
      console.error('Failed to save profile during onboarding:', err);
    }

    // Keep isCompleting = true; the loading screen stays up while this
    // component remains mounted behind profile-ready.
    router.push({
      pathname: '/(onboarding)/profile-ready',
      params: {
        welcome_message: welcomeContent.welcome_message,
        insights: JSON.stringify(welcomeContent.insights),
        watch_summary: welcomeContent.watch_summary,
      },
    });
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      setShowTour(true);
    }
  };

  const handleTourNext = () => {
    if (tourStep < TOUR_SLIDES.length - 1) {
      setTourStep((s) => s + 1);
    } else {
      setShowTour(false);
      setShowConsent(true);
    }
  };

  const handleConsentAgree = () => {
    setAiConsented(true);
    setShowConsent(false);
    handleComplete();
  };

  const handleConsentDecline = () => {
    setAiConsented(false);
    setShowConsent(false);
    handleComplete();
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  if (isCompleting) {
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <View style={styles.completingContainer}>
          <LoadingSpinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (showConsent) {
    const textPrimary = isDark ? Colors.textPrimaryDark : Colors.textPrimary;
    const textSecondary = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
    const cardBg = isDark ? Colors.surfaceDark : Colors.surface;
    const cardBorder = isDark ? Colors.borderDark : Colors.border;

    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentEmoji}>🤖</Text>
            <Text style={[styles.consentTitle, { color: textPrimary }]}>{t('onboarding.ai_consent.title')}</Text>
            <Text style={[styles.consentSubtitle, { color: textSecondary }]}>{t('onboarding.ai_consent.subtitle')}</Text>
          </View>

          <View style={[styles.consentCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.consentSectionTitle, { color: textPrimary }]}>{t('onboarding.ai_consent.what_shared_title')}</Text>
            {(['what_shared_1', 'what_shared_2', 'what_shared_3'] as const).map((key) => (
              <View key={key} style={styles.consentBulletRow}>
                <Text style={[styles.consentBullet, { color: Colors.primary }]}>•</Text>
                <Text style={[styles.consentBulletText, { color: textSecondary }]}>{t(`onboarding.ai_consent.${key}`)}</Text>
              </View>
            ))}

            <View style={[styles.consentDivider, { backgroundColor: cardBorder }]} />

            <Text style={[styles.consentSectionTitle, { color: textPrimary }]}>{t('onboarding.ai_consent.how_used_title')}</Text>
            <Text style={[styles.consentBodyText, { color: textSecondary }]}>{t('onboarding.ai_consent.how_used_body')}</Text>

            <TouchableOpacity onPress={() => Linking.openURL(getPrivacyPolicyUrl()).catch(() => {})}>
              <Text style={[styles.consentPrivacyLink, { color: Colors.primary }]}>{t('onboarding.ai_consent.view_privacy_policy')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.consentActions}>
            <Button label={t('onboarding.ai_consent.agree_cta')} onPress={handleConsentAgree} />
            <TouchableOpacity onPress={handleConsentDecline} style={styles.consentDeclineBtn} activeOpacity={0.7}>
              <Text style={[styles.consentDeclineText, { color: textSecondary }]}>{t('onboarding.ai_consent.decline_cta')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showTour) {
    const slide = TOUR_SLIDES[tourStep];
    const isLastTourSlide = tourStep === TOUR_SLIDES.length - 1;
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <View style={styles.tourContainer}>
          <TouchableOpacity onPress={() => { setShowTour(false); setShowConsent(true); }} style={styles.tourSkip}>
            <Text style={styles.tourSkipText}>{t('onboarding.tour.skip')}</Text>
          </TouchableOpacity>

          <View style={styles.tourContent}>
            <View style={styles.tourIconCircle}>
              <Ionicons name={slide.icon} size={40} color={Colors.primary} />
            </View>
            <Text style={[styles.tourTitle, isDark && styles.titleDark]}>{t(slide.titleKey)}</Text>
            <Text style={[styles.tourBody, isDark && styles.tourBodyDark]}>{t(slide.bodyKey)}</Text>
          </View>

          <View style={styles.tourDots}>
            {TOUR_SLIDES.map((_, i) => (
              <View key={i} style={[styles.tourDot, i === tourStep && styles.tourDotActive]} />
            ))}
          </View>

          <Button
            label={isLastTourSlide ? t('onboarding.tour.get_started') : t('onboarding.tour.next')}
            onPress={handleTourNext}
          />
        </View>
      </SafeAreaView>
    );
  }

  const stepTitle = ({
    1: t('onboarding.primary_symptoms.title'),
    2: t('onboarding.bell_score_baseline.title'),
    3: t('onboarding.pem_onset_delay.title'),
    4: t('onboarding.medications.title'),
  } as Record<number, string>)[currentStep] ?? '';

  const stepSubtitle = ({
    1: t('onboarding.primary_symptoms.subtitle'),
    2: t('onboarding.bell_score_baseline.subtitle'),
    3: t('onboarding.pem_onset_delay.subtitle'),
    4: t('onboarding.medications.subtitle'),
  } as Record<number, string>)[currentStep] ?? '';

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            {PRIMARY_SYMPTOMS.map((v) => (
              <MultiSelectCard
                key={v}
                label={t(`onboarding.primary_symptoms.${v}`)}
                isSelected={primarySymptoms.includes(v)}
                onPress={() => setPrimarySymptoms((arr) => toggleMulti(arr, v))}
              />
            ))}
          </>
        );
      case 2:
        return (
          <>
            {BELL_SCORES.map((v) => (
              <OptionCard
                key={v}
                label={t(`onboarding.bell_score_baseline.${v}`)}
                isSelected={bellScore === v}
                onPress={() => setBellScore(v)}
              />
            ))}
          </>
        );
      case 3:
        return (
          <>
            {PEM_ONSET_DELAYS.map((v) => (
              <OptionCard
                key={v}
                label={t(`onboarding.pem_onset_delay.${v}`)}
                isSelected={pemOnsetDelay === v}
                onPress={() => setPemOnsetDelay(v)}
              />
            ))}
          </>
        );
      case 4:
        return (
          <>
            {MEDICATIONS.map((v) => (
              <MultiSelectCard
                key={v}
                label={t(`onboarding.medications.${v}`)}
                isSelected={medications.includes(v)}
                onPress={() => setMedications((arr) => toggleMulti(arr, v))}
              />
            ))}
          </>
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepHeader
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title={stepTitle}
            subtitle={stepSubtitle}
          />

          <View style={styles.content}>{renderStepContent()}</View>

          <View style={styles.navRow}>
            {currentStep > 1 ? (
              <Button
                label={t('onboarding.back')}
                onPress={handleBack}
                variant="outline"
                fullWidth={false}
                style={styles.backButton}
              />
            ) : (
              <View style={styles.backPlaceholder} />
            )}

            <Button
              label={isLastStep ? t('onboarding.finish') : t('onboarding.next')}
              onPress={handleNext}
              disabled={!canProceed()}
              fullWidth={false}
              style={styles.nextButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.backgroundDark },
  keyboardAvoid: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  content: { flex: 1, marginBottom: Spacing.xl },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  backButton: { minWidth: 100 },
  nextButton: { flex: 1 },
  backPlaceholder: { minWidth: 100 },
  completingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tourContainer: { flex: 1, padding: Spacing.lg, justifyContent: 'space-between' },
  tourSkip: { alignSelf: 'flex-end' },
  tourSkipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  tourContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  tourIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  tourTitle: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  titleDark: { color: Colors.textPrimaryDark },
  tourBody: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  tourBodyDark: { color: Colors.textSecondaryDark },
  tourDots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.lg },
  tourDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  tourDotActive: { backgroundColor: Colors.primary, width: 20 },

  consentHeader: { alignItems: 'center', paddingVertical: Spacing.xl },
  consentEmoji: { fontSize: 48, marginBottom: Spacing.md },
  consentTitle: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, textAlign: 'center', marginBottom: Spacing.sm },
  consentSubtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md },
  consentCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm },
  consentSectionTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, marginBottom: 2 },
  consentBulletRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  consentBullet: { fontSize: FontSize.sm, lineHeight: 20 },
  consentBulletText: { fontSize: FontSize.sm, lineHeight: 20, flex: 1 },
  consentDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
  consentBodyText: { fontSize: FontSize.sm, lineHeight: 20 },
  consentPrivacyLink: { fontSize: FontSize.sm, textDecorationLine: 'underline', marginTop: Spacing.xs },
  consentActions: { gap: Spacing.md },
  consentDeclineBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  consentDeclineText: { fontSize: FontSize.sm, fontWeight: '600', fontFamily: FontFamily.semiBold },
});
