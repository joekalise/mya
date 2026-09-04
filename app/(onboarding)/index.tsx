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
import DateTimePicker from '@react-native-community/datetimepicker';

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
import { requestNotificationPermissions, scheduleDailyCheckIn } from '@/services/notifications';
import { getPrivacyPolicyUrl } from '@/utils/links';
import {
  WelcomeContent,
  PrimarySymptom,
  PemOnsetDelay,
  PemDurationTypical,
  Medication,
  AgeRange,
  BiologicalSex,
  DiagnosisCriteria,
  DiagnosisYears,
  MobilityStatus,
  Comorbidity,
  LifestyleChallenge,
} from '@/types';

const TOTAL_STEPS = 13;

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
const PEM_DURATIONS: PemDurationTypical[] = ['hours', 'one_day', 'several_days', 'week_plus', 'variable'];
const MEDICATIONS: Medication[] = ['low_dose_naltrexone', 'beta_blockers', 'antihistamines_h1_h2', 'stimulants', 'antidepressants', 'anticoagulants', 'no_medication', 'other'];
const AGE_RANGES: AgeRange[] = ['under_25', '25_35', '35_45', '45_55', '55_plus'];
const BIOLOGICAL_SEXES: BiologicalSex[] = ['male', 'female', 'prefer_not_to_say'];
const DIAGNOSIS_CRITERIA: DiagnosisCriteria[] = ['fukuda', 'canadian_consensus_criteria', 'international_consensus_criteria', 'iom_seid', 'not_formally_diagnosed', 'other'];
const DIAGNOSIS_YEARS: DiagnosisYears[] = ['not_diagnosed', 'under_1', '1_3', '3_5', '5_10', '10_plus'];
const MOBILITY_STATUSES: MobilityStatus[] = ['none', 'mobility_aid', 'wheelchair_part_time', 'wheelchair_full_time', 'housebound', 'bedbound'];
const COMORBIDITIES: Comorbidity[] = ['pots', 'fibromyalgia', 'mcas', 'eds', 'ibs', 'migraine', 'anxiety_depression', 'mold_illness', 'other'];
const CHALLENGES: LifestyleChallenge[] = ['sleep', 'exercise', 'work', 'social_life', 'mental_health'];

function toggleMulti<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function timeStringToDate(t: string): Date {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(isNaN(h) ? 20 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { saveProfile } = useProfile();
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const [currentStep, setCurrentStep] = useState(1);
  const [primarySymptoms, setPrimarySymptoms] = useState<PrimarySymptom[]>([]);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null);
  const [diagnosisCriteria, setDiagnosisCriteria] = useState<DiagnosisCriteria | null>(null);
  const [diagnosisYears, setDiagnosisYears] = useState<DiagnosisYears | null>(null);
  const [bellScore, setBellScore] = useState<number | null>(null);
  const [pemOnsetDelay, setPemOnsetDelay] = useState<PemOnsetDelay | null>(null);
  const [pemDurationTypical, setPemDurationTypical] = useState<PemDurationTypical | null>(null);
  const [mobilityStatus, setMobilityStatus] = useState<MobilityStatus | null>(null);
  const [comorbidities, setComorbidities] = useState<Comorbidity[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [challenges, setChallenges] = useState<LifestyleChallenge[]>([]);
  const [notificationTime, setNotificationTime] = useState('20:00');
  const [isCompleting, setIsCompleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [aiConsented, setAiConsented] = useState<boolean | null>(null);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1: return primarySymptoms.length > 0;
      case 2: return ageRange !== null;
      case 3: return biologicalSex !== null;
      case 4: return diagnosisCriteria !== null;
      case 5: return diagnosisYears !== null;
      case 6: return bellScore !== null;
      case 7: return pemOnsetDelay !== null;
      case 8: return pemDurationTypical !== null;
      case 9: return mobilityStatus !== null;
      case 10: return true; // comorbidities — optional, "none" is a valid answer
      case 11: return medications.length > 0;
      case 12: return true; // challenges — optional
      case 13: return true; // notification time — has a default
      default: return false;
    }
  }, [currentStep, primarySymptoms, ageRange, biologicalSex, diagnosisCriteria, diagnosisYears, bellScore, pemOnsetDelay, pemDurationTypical, mobilityStatus, medications]);

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
        welcomeContent = await generateWelcomeContent({
          primarySymptoms,
          bellScore,
          pemOnsetDelay,
          pemDurationTypical,
          medications,
          ageRange,
          diagnosisCriteria,
          diagnosisYears,
          mobilityStatus,
          comorbidities,
          challenges,
        }, i18n.language);
      } catch (err) {
        console.warn('Claude API failed, using fallback content:', err);
      }
    }

    try {
      await saveProfile({
        primary_symptoms: primarySymptoms,
        age_range: ageRange,
        biological_sex: biologicalSex,
        diagnosis_criteria: diagnosisCriteria,
        diagnosis_years: diagnosisYears,
        bell_score_baseline: bellScore,
        pem_onset_delay: pemOnsetDelay,
        pem_duration_typical: pemDurationTypical,
        mobility_status: mobilityStatus,
        comorbidities,
        medications,
        challenges,
        notification_time: notificationTime,
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
    if (currentStep === TOTAL_STEPS) {
      requestNotificationPermissions().then((granted) => {
        if (granted) scheduleDailyCheckIn(notificationTime).catch(() => {});
      }).catch(() => {});
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      setShowPreview(true);
      setPreviewStep(0);
    }
  };

  const handlePreviewNext = () => {
    if (previewStep < PREVIEW_SLIDES.length - 1) {
      setPreviewStep((s) => s + 1);
    } else {
      setShowPreview(false);
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
    if (showConsent) {
      setShowConsent(false);
      setShowPreview(true);
      setPreviewStep(PREVIEW_SLIDES.length - 1);
    } else if (showPreview) {
      if (previewStep > 0) {
        setPreviewStep((s) => s - 1);
      } else {
        setShowPreview(false);
      }
    } else if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const mockTextSec = isDark ? styles.mockTextSecDark : undefined;

  const PREVIEW_SLIDES = [
    {
      title: t('onboarding.preview.slide1_title'),
      content: (
        <View style={[styles.mockCard, isDark && styles.mockCardDark]}>
          <View style={styles.mockScoreRow}>
            <View>
              <Text style={[styles.mockCardTitle, isDark && styles.mockCardTitleDark]}>{t('dashboard.bell_score')}</Text>
              <Text style={[styles.mockScoreHint, mockTextSec]}>{t('onboarding.preview.score_hint')}</Text>
            </View>
            <View style={[styles.mockScoreCircle, { borderColor: Colors.success }]}>
              <Text style={[styles.mockScoreNum, { color: Colors.success }]}>65</Text>
              <Text style={[styles.mockScoreOut, { color: Colors.success }]}>/100</Text>
            </View>
          </View>

          <View style={styles.mockWeekBars}>
            {[55, 48, 62, 70, 58, 68, 65].map((h, i) => (
              <View key={i} style={styles.mockBarWrap}>
                <View style={styles.mockBarTrack}>
                  <View style={[styles.mockBarFill, { height: `${h}%`, backgroundColor: h >= 60 ? Colors.success : Colors.warning }]} />
                </View>
                <Text style={[styles.mockBarLabel, mockTextSec]}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.mockDivider, isDark && { backgroundColor: Colors.borderDark }]} />

          {[
            { label: t('onboarding.preview.stat_avg_brain_fog'), value: '3.1 / 10', color: Colors.success },
            { label: t('onboarding.preview.stat_streak'), value: t('onboarding.preview.stat_streak_value'), color: Colors.primary },
            { label: t('onboarding.preview.stat_envelope'), value: t('onboarding.preview.stat_envelope_value'), color: Colors.success },
          ].map((s) => (
            <View key={s.label} style={styles.mockFactorRow}>
              <Text style={[styles.mockFactor, mockTextSec]}>{s.label}</Text>
              <Text style={[styles.mockFactorVal, { color: s.color }]}>{s.value}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      title: t('onboarding.preview.slide2_title'),
      content: (
        <View style={{ gap: Spacing.sm }}>
          <View style={[styles.mockWarningCard, isDark && styles.mockWarningCardDark]}>
            <View style={styles.mockScoreRow}>
              <Text style={styles.mockWarningTitle}>⚠️ {t('onboarding.preview.heads_up')}</Text>
              <View style={[styles.mockChip, { borderColor: Colors.warning + '80' }]}>
                <Text style={[styles.mockChipText, { color: Colors.warning }]}>{t('onboarding.preview.elevated_risk')}</Text>
              </View>
            </View>
            <Text style={[styles.mockWarningBody, mockTextSec]}>{t('onboarding.preview.warning_body')}</Text>

            <View style={styles.mockWeekBars}>
              {[3, 3, 4, 5, 6, 8, 9].map((h, i) => (
                <View key={i} style={styles.mockBarWrap}>
                  <View style={styles.mockBarTrack}>
                    <View style={[styles.mockBarFill, { height: `${(h / 10) * 100}%`, backgroundColor: i >= 5 ? Colors.error : Colors.success }]} />
                  </View>
                  <Text style={[styles.mockBarLabel, mockTextSec]}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.mockChipsRow}>
              {[
                t('onboarding.preview.chip_overspent'),
                t('onboarding.preview.chip_hrv_dropping'),
                t('onboarding.preview.chip_less_sleep'),
              ].map((chip) => (
                <View key={chip} style={[styles.mockChip, { borderColor: Colors.warning + '60' }]}>
                  <Text style={[styles.mockChipText, { color: Colors.warning }]}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ),
    },
    {
      title: t('onboarding.preview.slide3_title'),
      content: (
        <View style={[styles.mockCard, isDark && styles.mockCardDark]}>
          <View style={styles.mockAIHeader}>
            <Text style={[styles.mockCardTitle, isDark && styles.mockCardTitleDark]}>{t('onboarding.preview.weekly_insight')}</Text>
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>{t('common.premium')}</Text>
            </View>
          </View>

          <View style={styles.mockChatBubbleUser}>
            <Text style={styles.mockChatTextUser}>{t('onboarding.preview.chat_question')}</Text>
          </View>
          <View style={styles.mockChatBubbleAI}>
            <Text style={[styles.mockChatTextAI, isDark && { backgroundColor: Colors.borderDark, color: Colors.textPrimaryDark }]}>
              {t('onboarding.preview.chat_answer')}
            </Text>
          </View>

          <View style={[styles.mockDivider, isDark && { backgroundColor: Colors.borderDark }]} />

          {[
            { label: t('onboarding.preview.row_sleep'), value: t('onboarding.preview.row_sleep_value') },
            { label: t('onboarding.preview.row_exertion'), value: t('onboarding.preview.row_exertion_value') },
            { label: t('onboarding.preview.row_envelope'), value: t('onboarding.preview.row_envelope_value') },
          ].map((r) => (
            <View key={r.label} style={styles.mockFactorRow}>
              <Text style={[styles.mockFactor, mockTextSec]}>{r.label}</Text>
              <Text style={[styles.mockFactorVal, { color: Colors.primary }]}>{r.value}</Text>
            </View>
          ))}
        </View>
      ),
    },
  ];

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

  if (showPreview) {
    const slide = PREVIEW_SLIDES[previewStep];
    const isLastPreview = previewStep === PREVIEW_SLIDES.length - 1;
    return (
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoid}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.previewDots}>
              {PREVIEW_SLIDES.map((_, i) => (
                <View key={i} style={[styles.previewDot, i === previewStep && styles.previewDotActive]} />
              ))}
            </View>

            <Text style={[styles.previewTitle, isDark && styles.titleDark]}>{slide.title}</Text>

            <View style={styles.previewMockContainer}>{slide.content}</View>

            <View style={styles.navRow}>
              <TouchableOpacity onPress={handleBack} style={styles.previewBackBtn}>
                <Text style={[styles.previewBackText, isDark && styles.textSecDark]}>{t('onboarding.back')}</Text>
              </TouchableOpacity>
              <Button
                label={isLastPreview ? t('onboarding.tour.get_started') : t('onboarding.tour.next')}
                onPress={handlePreviewNext}
                fullWidth={false}
                style={styles.nextButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const stepTitle = ({
    1: t('onboarding.primary_symptoms.title'),
    2: t('onboarding.age_range.title'),
    3: t('onboarding.biological_sex.title'),
    4: t('onboarding.diagnosis_criteria.title'),
    5: t('onboarding.diagnosis_years.title'),
    6: t('onboarding.bell_score_baseline.title'),
    7: t('onboarding.pem_onset_delay.title'),
    8: t('onboarding.pem_duration_typical.title'),
    9: t('onboarding.mobility_status.title'),
    10: t('onboarding.comorbidities.title'),
    11: t('onboarding.medications.title'),
    12: t('onboarding.challenges.title'),
    13: t('onboarding.notification_time.title'),
  } as Record<number, string>)[currentStep] ?? '';

  const stepSubtitle = ({
    1: t('onboarding.primary_symptoms.subtitle'),
    2: t('onboarding.age_range.subtitle'),
    3: t('onboarding.biological_sex.subtitle'),
    4: t('onboarding.diagnosis_criteria.subtitle'),
    5: t('onboarding.diagnosis_years.subtitle'),
    6: t('onboarding.bell_score_baseline.subtitle'),
    7: t('onboarding.pem_onset_delay.subtitle'),
    8: t('onboarding.pem_duration_typical.subtitle'),
    9: t('onboarding.mobility_status.subtitle'),
    10: t('onboarding.comorbidities.subtitle'),
    11: t('onboarding.medications.subtitle'),
    12: t('onboarding.challenges.subtitle'),
    13: t('onboarding.notification_time.subtitle'),
  } as Record<number, string>)[currentStep] ?? '';

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            {PRIMARY_SYMPTOMS.map((v) => (
              <MultiSelectCard key={v} label={t(`onboarding.primary_symptoms.${v}`)} isSelected={primarySymptoms.includes(v)} onPress={() => setPrimarySymptoms((arr) => toggleMulti(arr, v))} />
            ))}
          </>
        );
      case 2:
        return (
          <>
            {AGE_RANGES.map((v) => (
              <OptionCard key={v} label={t(`onboarding.age_range.${v}`)} isSelected={ageRange === v} onPress={() => setAgeRange(v)} />
            ))}
          </>
        );
      case 3:
        return (
          <>
            {BIOLOGICAL_SEXES.map((v) => (
              <OptionCard key={v} label={t(`onboarding.biological_sex.${v}`)} isSelected={biologicalSex === v} onPress={() => setBiologicalSex(v)} />
            ))}
          </>
        );
      case 4:
        return (
          <>
            {DIAGNOSIS_CRITERIA.map((v) => (
              <OptionCard key={v} label={t(`onboarding.diagnosis_criteria.${v}`)} isSelected={diagnosisCriteria === v} onPress={() => setDiagnosisCriteria(v)} />
            ))}
          </>
        );
      case 5:
        return (
          <>
            {DIAGNOSIS_YEARS.map((v) => (
              <OptionCard key={v} label={t(`onboarding.diagnosis_years.${v}`)} isSelected={diagnosisYears === v} onPress={() => setDiagnosisYears(v)} />
            ))}
          </>
        );
      case 6:
        return (
          <>
            {BELL_SCORES.map((v) => (
              <OptionCard key={v} label={t(`onboarding.bell_score_baseline.${v}`)} isSelected={bellScore === v} onPress={() => setBellScore(v)} />
            ))}
          </>
        );
      case 7:
        return (
          <>
            {PEM_ONSET_DELAYS.map((v) => (
              <OptionCard key={v} label={t(`onboarding.pem_onset_delay.${v}`)} isSelected={pemOnsetDelay === v} onPress={() => setPemOnsetDelay(v)} />
            ))}
          </>
        );
      case 8:
        return (
          <>
            {PEM_DURATIONS.map((v) => (
              <OptionCard key={v} label={t(`onboarding.pem_duration_typical.${v}`)} isSelected={pemDurationTypical === v} onPress={() => setPemDurationTypical(v)} />
            ))}
          </>
        );
      case 9:
        return (
          <>
            {MOBILITY_STATUSES.map((v) => (
              <OptionCard key={v} label={t(`onboarding.mobility_status.${v}`)} isSelected={mobilityStatus === v} onPress={() => setMobilityStatus(v)} />
            ))}
          </>
        );
      case 10:
        return (
          <>
            {COMORBIDITIES.map((v) => (
              <MultiSelectCard key={v} label={t(`onboarding.comorbidities.${v}`)} isSelected={comorbidities.includes(v)} onPress={() => setComorbidities((arr) => toggleMulti(arr, v))} />
            ))}
          </>
        );
      case 11:
        return (
          <>
            {MEDICATIONS.map((v) => (
              <MultiSelectCard key={v} label={t(`onboarding.medications.${v}`)} isSelected={medications.includes(v)} onPress={() => setMedications((arr) => toggleMulti(arr, v))} />
            ))}
          </>
        );
      case 12:
        return (
          <>
            {CHALLENGES.map((v) => (
              <MultiSelectCard key={v} label={t(`onboarding.challenges.${v}`)} isSelected={challenges.includes(v)} onPress={() => setChallenges((arr) => toggleMulti(arr, v))} />
            ))}
          </>
        );
      case 13:
        return Platform.OS === 'android' ? (
          (() => {
            const [hStr, mStr] = notificationTime.split(':');
            const hVal = parseInt(hStr, 10);
            const mVal = parseInt(mStr, 10);
            const adjustTime = (hDelta: number, mDelta: number) => {
              const newH = ((hVal + hDelta) + 24) % 24;
              const newM = ((mVal + mDelta) + 60) % 60;
              setNotificationTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
            };
            return (
              <View style={styles.androidTimeRow}>
                <View style={styles.androidTimeCol}>
                  <TouchableOpacity style={[styles.androidTimeBtn, isDark && styles.androidTimeBtnDark]} onPress={() => adjustTime(1, 0)} activeOpacity={0.7}>
                    <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▲</Text>
                  </TouchableOpacity>
                  <Text style={[styles.androidTimeValue, isDark && styles.textPrimaryDark]}>{String(hVal).padStart(2, '0')}</Text>
                  <TouchableOpacity style={[styles.androidTimeBtn, isDark && styles.androidTimeBtnDark]} onPress={() => adjustTime(-1, 0)} activeOpacity={0.7}>
                    <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▼</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.androidTimeColon, isDark && styles.textPrimaryDark]}>:</Text>
                <View style={styles.androidTimeCol}>
                  <TouchableOpacity style={[styles.androidTimeBtn, isDark && styles.androidTimeBtnDark]} onPress={() => adjustTime(0, 5)} activeOpacity={0.7}>
                    <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▲</Text>
                  </TouchableOpacity>
                  <Text style={[styles.androidTimeValue, isDark && styles.textPrimaryDark]}>{String(mVal).padStart(2, '0')}</Text>
                  <TouchableOpacity style={[styles.androidTimeBtn, isDark && styles.androidTimeBtnDark]} onPress={() => adjustTime(0, -5)} activeOpacity={0.7}>
                    <Text style={[styles.androidTimeArrow, { color: Colors.primary }]}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()
        ) : (
          <View style={styles.timePickerContainer}>
            <DateTimePicker
              value={timeStringToDate(notificationTime)}
              mode="time"
              display="spinner"
              onChange={(_event, date) => { if (date) setNotificationTime(dateToTimeString(date)); }}
              textColor={isDark ? Colors.textPrimaryDark : Colors.textPrimary}
              style={styles.timePicker}
            />
          </View>
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoid}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <StepHeader currentStep={currentStep} totalSteps={TOTAL_STEPS} title={stepTitle} subtitle={stepSubtitle} />

          <View style={styles.content}>{renderStepContent()}</View>

          <View style={styles.navRow}>
            {currentStep > 1 ? (
              <Button label={t('onboarding.back')} onPress={handleBack} variant="outline" fullWidth={false} style={styles.backButton} />
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
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  backButton: { minWidth: 100 },
  nextButton: { flex: 1 },
  backPlaceholder: { minWidth: 100 },
  completingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleDark: { color: Colors.textPrimaryDark },
  textSecDark: { color: Colors.textSecondaryDark },
  textPrimaryDark: { color: Colors.textPrimaryDark },

  timePickerContainer: { alignItems: 'center' },
  timePicker: { width: '100%', height: 180 },
  androidTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl, marginTop: Spacing.xl },
  androidTimeCol: { alignItems: 'center', gap: Spacing.sm },
  androidTimeBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  androidTimeBtnDark: { borderColor: Colors.borderDark },
  androidTimeArrow: { fontSize: FontSize.lg, fontWeight: '700', fontFamily: FontFamily.bold },
  androidTimeValue: { fontSize: 52, fontWeight: '700', fontFamily: FontFamily.bold, textAlign: 'center', minWidth: 80, color: Colors.textPrimary },
  androidTimeColon: { fontSize: 52, fontWeight: '700', fontFamily: FontFamily.bold, alignSelf: 'center', paddingBottom: 28, color: Colors.textPrimary },

  // Preview
  previewDots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.lg },
  previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  previewDotActive: { backgroundColor: Colors.primary, width: 20 },
  previewTitle: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.extraBold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  previewMockContainer: { marginBottom: Spacing.xl },
  previewBackBtn: { minWidth: 100, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm },
  previewBackText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', fontFamily: FontFamily.semiBold },

  // Mock cards
  mockCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  mockCardDark: { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark },
  mockCardTitle: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.textPrimary },
  mockCardTitleDark: { color: Colors.textPrimaryDark },
  mockTextSecDark: { color: Colors.textSecondaryDark },
  mockScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  mockScoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  mockScoreNum: { fontSize: FontSize.xl, fontWeight: '900', fontFamily: FontFamily.extraBold, lineHeight: 28 },
  mockScoreOut: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold, opacity: 0.7 },
  mockScoreHint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  mockFactorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mockFactor: { fontSize: FontSize.xs, color: Colors.textSecondary },
  mockFactorVal: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: FontFamily.bold },
  mockWarningCard: { backgroundColor: Colors.warning + '12', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.warning + '50', padding: Spacing.md, gap: Spacing.sm },
  mockWarningCardDark: { backgroundColor: '#3A2500' },
  mockWarningTitle: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.warning },
  mockWarningBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  mockChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  mockChip: { borderWidth: 1, borderColor: Colors.warning + '60', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  mockChipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: FontFamily.semiBold, color: Colors.warning },
  mockAIHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mockBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  mockBadgeText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '700', fontFamily: FontFamily.bold },
  mockWeekBars: { flexDirection: 'row', alignItems: 'flex-end', height: 52, gap: 5, marginVertical: Spacing.sm },
  mockBarWrap: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  mockBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 3 },
  mockBarFill: { width: '100%', borderRadius: 3, minHeight: 4 },
  mockBarLabel: { fontSize: 9, color: Colors.textSecondary },
  mockDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  mockChatBubbleUser: { alignItems: 'flex-end', marginBottom: Spacing.xs },
  mockChatBubbleAI: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  mockChatTextUser: { fontSize: FontSize.sm, backgroundColor: Colors.primary, color: '#FFFFFF', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxWidth: '80%', overflow: 'hidden', lineHeight: 19 },
  mockChatTextAI: { fontSize: FontSize.sm, backgroundColor: Colors.border, color: Colors.textPrimary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxWidth: '88%', overflow: 'hidden', lineHeight: 19 },

  // AI consent
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
