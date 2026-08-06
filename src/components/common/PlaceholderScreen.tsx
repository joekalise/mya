import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';

interface PlaceholderScreenProps {
  title: string;
  body?: string;
}

export function PlaceholderScreen({ title, body }: PlaceholderScreenProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
      {body ? (
        <Text style={[styles.body, isDark && styles.bodyDark]}>{body}</Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  containerDark: {
    backgroundColor: Colors.backgroundDark,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  titleDark: {
    color: Colors.textPrimaryDark,
  },
  body: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  bodyDark: {
    color: Colors.textSecondaryDark,
  },
});
