import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';

const ANDROID_CHANNEL = 'mya-reminders';

function androidChannel() {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {};
}

export const NOTIFICATION_SCREEN = {
  dailyCheckin: '/(tabs)/pace',
} as const;

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelNotification(identifier: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((n) => n.identifier.startsWith(identifier));
  await Promise.all(matching.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleDailyCheckIn(timeString: string): Promise<void> {
  await cancelNotification('daily-checkin');

  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-checkin',
    content: {
      title: i18n.t('notifications.daily_checkin_title'),
      body: i18n.t('notifications.daily_checkin_body'),
      sound: true,
      data: { screen: NOTIFICATION_SCREEN.dailyCheckin },
      ...androidChannel(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
