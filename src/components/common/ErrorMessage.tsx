import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: Colors.error,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    backgroundColor: '#FEF2F2',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
