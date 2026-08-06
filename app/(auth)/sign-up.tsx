import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUpWithEmail } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      setConfirmationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.content}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Check your email</Text>
          <Text style={isDark ? styles.footerTextDark : styles.footerText}>
            We sent a confirmation link to {email.trim()}. Tap it to finish setting up your account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          {t('auth.sign_up_title')}
        </Text>

        {error && <ErrorMessage message={error} />}

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('auth.email_label')}
          placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('auth.password_label')}
          placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button label={t('auth.sign_up_button')} onPress={handleSignUp} isLoading={isLoading} />

        <View style={styles.footerRow}>
          <Text style={isDark ? styles.footerTextDark : styles.footerText}>
            {t('auth.have_account')}{' '}
          </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.linkText}>{t('auth.sign_in_link')}</Text>
          </Link>
        </View>
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
    marginBottom: Spacing.md,
  },
  titleDark: { color: Colors.textPrimaryDark },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
  },
  inputDark: {
    borderColor: Colors.borderDark,
    color: Colors.textPrimaryDark,
    backgroundColor: Colors.surfaceDark,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { color: Colors.textSecondary, fontFamily: FontFamily.regular },
  footerTextDark: { color: Colors.textSecondaryDark, fontFamily: FontFamily.regular },
  linkText: { color: Colors.primary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
});
