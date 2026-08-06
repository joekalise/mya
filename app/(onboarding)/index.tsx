import React, { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';

// Placeholder onboarding — the real flow (diagnosis criteria, Bell score
// baseline, PEM onset delay/duration, mobility status, primary symptoms,
// comorbidities) still needs to be designed and built. This stub exists so
// routing works end to end during early development.
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { saveProfile } = useProfile();
  const isDark = useColorScheme() === 'dark';
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await saveProfile({ onboarding_complete: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          {t('onboarding.placeholder_title')}
        </Text>
        <Text style={isDark ? styles.bodyDark : styles.body}>
          {t('onboarding.placeholder_body')}
        </Text>
        <Button
          label={t('onboarding.continue_button')}
          onPress={handleContinue}
          isLoading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerDark: { backgroundColor: Colors.backgroundDark },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.extraBold,
    color: Colors.textPrimary,
  },
  titleDark: { color: Colors.textPrimaryDark },
  body: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  bodyDark: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondaryDark,
    marginBottom: Spacing.md,
  },
});
