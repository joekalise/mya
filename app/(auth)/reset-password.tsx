import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const { resetPassword } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Reset password</Text>

        {error && <ErrorMessage message={error} />}

        {sent ? (
          <Text style={isDark ? styles.footerTextDark : styles.footerText}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
        ) : (
          <>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder="Email"
              placeholderTextColor={isDark ? Colors.textSecondaryDark : Colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Button label="Send reset link" onPress={handleReset} isLoading={isLoading} />
          </>
        )}
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
  footerText: { color: Colors.textSecondary, fontFamily: FontFamily.regular },
  footerTextDark: { color: Colors.textSecondaryDark, fontFamily: FontFamily.regular },
});
