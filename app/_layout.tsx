import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, useColorScheme, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { FontFamily } from '@/constants/theme';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';

// Set up Android notification channel with HIGH importance so Doze mode
// doesn't batch or delay daily reminders.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('mya-reminders', {
    name: 'Mya reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => {});
}

// Keep the native splash up until we've confirmed the correct route is showing.
SplashScreen.preventAutoHideAsync().catch(() => {});

import '@/i18n';
import { configureRevenueCat } from '@/services/revenuecat';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Configure RevenueCat immediately — before auth resolves
configureRevenueCat();
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://45eca0df6774afa2e0db96fa3ea87f75@o4511371993350144.ingest.de.sentry.io/4511863958274128',
  // Session replay disabled — health app with sensitive user data
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Show notifications when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootNavigator() {
  const { session, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete, isLoading: profileLoading } = useProfile();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();

  const isLoading = authLoading || profileLoading;
  // isReady stays false until segments actually reflect the target route.
  // router.replace() is async — segments update on the NEXT render after the call,
  // so we must not show the Stack until we confirm arrival at the right place.
  const [isReady, setIsReady] = useState(false);
  const isFirstNavRef = useRef(true);

  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === '(onboarding)';
  const inTabsGroup = segments[0] === '(tabs)';

  // Check for OTA update on every cold start and apply immediately if available
  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(({ isAvailable }) => {
        if (!isAvailable) return;
        return Updates.fetchUpdateAsync().then(() => Updates.reloadAsync());
      })
      .catch(() => {});
  }, []);

  // Route guard: fires whenever auth/profile state or segments change.
  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-up');
    } else if (!isOnboardingComplete) {
      if (!inOnboardingGroup) router.replace('/(onboarding)');
    } else {
      if (!inTabsGroup) router.replace('/(tabs)');
    }

    if (isFirstNavRef.current) {
      const target = !session ? '(auth)' : !isOnboardingComplete ? '(onboarding)' : '(tabs)';
      const arrived = segments[0] === target;
      if (arrived) {
        isFirstNavRef.current = false;
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
      // Not arrived yet: segments will update → effect re-fires → we check again
    }
  }, [session, isOnboardingComplete, isLoading, segments, router]);

  if (!isReady) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  // Set synchronously before the tree renders so every Text picks it up
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps.style = { fontFamily: FontFamily.regular };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <RootNavigator />
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
