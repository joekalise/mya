import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, useColorScheme, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithApple } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    try {
      await signInWithApple();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple sign in failed');
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          {t('auth.sign_in_title')}
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

        <Button label={t('auth.sign_in_button')} onPress={handleSignIn} isLoading={isLoading} />

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={BorderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        <Link href="/(auth)/reset-password" style={styles.link}>
          <Text style={styles.linkText}>{t('auth.forgot_password')}</Text>
        </Link>

        <View style={styles.footerRow}>
          <Text style={isDark ? styles.footerTextDark : styles.footerText}>
            {t('auth.no_account')}{' '}
          </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.linkText}>{t('auth.create_account_link')}</Text>
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
  appleButton: { height: 52, width: '100%' },
  link: { alignSelf: 'center', marginTop: Spacing.sm },
  linkText: { color: Colors.primary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { color: Colors.textSecondary, fontFamily: FontFamily.regular },
  footerTextDark: { color: Colors.textSecondaryDark, fontFamily: FontFamily.regular },
});
