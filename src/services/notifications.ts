import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';
import { MedicationReminder } from '@/types';

const ANDROID_CHANNEL = 'mya-reminders';

function androidChannel() {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {};
}

export const NOTIFICATION_SCREEN = {
  dailyCheckin: '/(tabs)/pace',
  medication: '/(tabs)/pace',
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

// ─── Medication reminder ──────────────────────────────────────────────────────

export async function scheduleMedicationReminder(med: MedicationReminder): Promise<void> {
  if (!med.id) return;

  const identifier = `med-${med.id}`;
  await cancelNotification(identifier);

  // As-needed/PRN medications have no fixed schedule, nothing to remind about.
  if (!med.active || med.as_needed) return;

  const [hourStr, minuteStr] = med.reminder_time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (isNaN(hour) || isNaN(minute)) return;

  const content = {
    title: i18n.t('notifications.medication_title', { name: med.name }),
    body: i18n.t('notifications.medication_body', { dose: med.dose, name: med.name }),
    sound: true,
    data: { screen: NOTIFICATION_SCREEN.medication },
    ...androidChannel(),
  };

  // For daily: fire every day. For other frequencies, schedule daily and let the
  // app handle skipping (expo-notifications doesn't support weekly/fortnightly
  // native triggers on all platforms without a custom approach).
  if (med.frequency === 'daily') {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  } else if (med.frequency === 'weekly') {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour, minute },
    });
  } else {
    // Fortnightly and monthly, schedule daily reminder; app can filter logic
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  }
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
