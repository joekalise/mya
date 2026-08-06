import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, useColorScheme, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed');
    } finally {
      setIsGoogleLoading(false);
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

        <TouchableOpacity
          style={[styles.googleButton, isDark && styles.googleButtonDark]}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
          activeOpacity={0.8}
        >
          <Svg width={20} height={20} viewBox="0 0 48 48">
            <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </Svg>
          <Text style={[styles.googleLabel, isDark && styles.googleLabelDark]}>
            {t('auth.google_button')}
          </Text>
        </TouchableOpacity>

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
  googleButton: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  googleButtonDark: {
    backgroundColor: '#1F1F1F',
    borderColor: '#5F6368',
  },
  googleLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    fontFamily: FontFamily.semiBold,
    color: '#3C4043',
  },
  googleLabelDark: {
    color: '#E8EAED',
  },
  link: { alignSelf: 'center', marginTop: Spacing.sm },
  linkText: { color: Colors.primary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { color: Colors.textSecondary, fontFamily: FontFamily.regular },
  footerTextDark: { color: Colors.textSecondaryDark, fontFamily: FontFamily.regular },
});
