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
import { UpdateBanner } from '@/components/common/UpdateBanner';
import { useLockPortraitOnPhones } from '@/hooks/useLockPortraitOnPhones';
import { registerBackgroundHealthSync } from '@/services/backgroundHealthSync';
import { scheduleDailyCheckIn, cancelLapseNotification, logLapseNotificationSent } from '@/services/notifications';
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
  const { profile, isOnboardingComplete, isLoading: profileLoading } = useProfile();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();

  const isLoading = authLoading || profileLoading;
  // isReady stays false until segments actually reflect the target route.
  // router.replace() is async — segments update on the NEXT render after the call,
  // so we must not show the Stack until we confirm arrival at the right place.
  const [isReady, setIsReady] = useState(false);
  const isFirstNavRef = useRef(true);
  const pendingNotificationScreenRef = useRef<string | null>(null);

  useLockPortraitOnPhones();

  useEffect(() => {
    registerBackgroundHealthSync().catch(() => {});
  }, []);

  // Route to the relevant screen when a notification is tapped, whether the
  // app was already running or launched cold from the tap.
  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse) {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (!screen) return;
      if (isReady) {
        router.push(screen);
      } else {
        pendingNotificationScreenRef.current = screen;
      }
    }

    // Clear after reading so a normal reopen days later doesn't re-trigger
    // navigation based on a stale cached tap.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleResponse(response);
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      }
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [isReady, router]);

  // Log lapse re-engagement notifications when they actually deliver, so
  // effectiveness (delivered vs cancelled by an earlier return) is measurable.
  // Delivery, not tap, is what we want here: most re-engagement value comes
  // from the notification pulling the user back, whether or not they tap it.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.identifier.startsWith('lapse-reengagement')) {
        logLapseNotificationSent(userId).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [session?.user?.id]);

  // Flush a notification tap that arrived before routing settled (cold start).
  useEffect(() => {
    if (!isReady || !pendingNotificationScreenRef.current) return;
    router.push(pendingNotificationScreenRef.current);
    pendingNotificationScreenRef.current = null;
  }, [isReady, router]);

  // Reschedule daily check-in for existing users if not already scheduled
  // (self-heals if the OS ever drops the underlying scheduled notification),
  // and cancel any pending lapse re-engagement now the user has opened the app.
  useEffect(() => {
    if (!session || !isOnboardingComplete || !profile?.notification_time) return;
    Notifications.getAllScheduledNotificationsAsync().then((scheduled) => {
      const hasCheckin = scheduled.some((n) => n.identifier === 'daily-checkin');
      if (!hasCheckin) scheduleDailyCheckIn(profile.notification_time).catch(() => {});
    }).catch(() => {});
    cancelLapseNotification().catch(() => {});
  }, [session?.user?.id, isOnboardingComplete, profile?.notification_time]);

  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === '(onboarding)';

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
      // Only correct if still stuck in the auth/onboarding groups while
      // already signed in and onboarded. Root-level modal routes like
      // ai-chat/dsq-sf are neither (tabs) nor auth/onboarding, and must be
      // left alone, not bounced back to (tabs) just for being outside it.
      if (inAuthGroup || inOnboardingGroup) router.replace('/(tabs)');
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
      <UpdateBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dsq-sf" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai-chat" options={{ presentation: 'modal' }} />
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
