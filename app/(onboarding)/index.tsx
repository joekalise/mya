import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { StepHeader } from '@/components/onboarding/StepHeader';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { MultiSelectCard } from '@/components/onboarding/MultiSelectCard';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/contexts/ProfileContext';
import { PrimarySymptom, PemOnsetDelay } from '@/types';

const TOTAL_STEPS = 3;

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

function toggleMulti<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { saveProfile } = useProfile();
  const isDark = useColorScheme() === 'dark';

  const [currentStep, setCurrentStep] = useState(1);
  const [primarySymptoms, setPrimarySymptoms] = useState<PrimarySymptom[]>([]);
  const [bellScore, setBellScore] = useState<number | null>(null);
  const [pemOnsetDelay, setPemOnsetDelay] = useState<PemOnsetDelay | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return primarySymptoms.length > 0;
      case 2:
        return bellScore !== null;
      case 3:
        return pemOnsetDelay !== null;
      default:
        return false;
    }
  }, [currentStep, primarySymptoms, bellScore, pemOnsetDelay]);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await saveProfile({
        primary_symptoms: primarySymptoms,
        bell_score_baseline: bellScore,
        pem_onset_delay: pemOnsetDelay,
        notification_time: '20:00',
        ai_context: '',
        onboarding_complete: true,
      });
    } catch (err) {
      console.error('Failed to save profile during onboarding:', err);
      setIsCompleting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
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

  const stepTitle = ({
    1: t('onboarding.primary_symptoms.title'),
    2: t('onboarding.bell_score_baseline.title'),
    3: t('onboarding.pem_onset_delay.title'),
  } as Record<number, string>)[currentStep] ?? '';

  const stepSubtitle = ({
    1: t('onboarding.primary_symptoms.subtitle'),
    2: t('onboarding.bell_score_baseline.subtitle'),
    3: t('onboarding.pem_onset_delay.subtitle'),
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
});
