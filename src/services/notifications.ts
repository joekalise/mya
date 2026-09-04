import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';
import { supabase } from '@/services/supabase';
import { DailyLog, HealthData, MedicationReminder } from '@/types';

const ANDROID_CHANNEL = 'mya-reminders';

function androidChannel() {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {};
}

export const NOTIFICATION_SCREEN = {
  dailyCheckin: '/(tabs)/pace',
  medication: '/(tabs)/pace',
  lapse: '/(tabs)/pace',
  crash: '/(tabs)',
  dsqSfReminder: '/dsq-sf',
  nudge: '/(tabs)',
} as const;

// ─── Permissions ─────────────────────────────────────────────────────────────

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

// ─── Daily check-in reminder ─────────────────────────────────────────────────

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
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export interface CheckInContext {
  bellScore: number;
  brainFog: number;
  wokeRested: boolean | null;
  streak: number;
}

function buildPersonalizedCheckInContent(ctx: CheckInContext): { title: string; body: string } {
  const { bellScore, brainFog, wokeRested, streak } = ctx;
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;

  if (streak >= 7) {
    return { title: `🔥 ${t('notifications.streak_title', { count: streak })}`, body: t('notifications.streak_body') };
  }
  if (wokeRested === false) {
    return { title: t('notifications.poor_rest_title'), body: t('notifications.poor_rest_body') };
  }
  if (bellScore <= 40) {
    return { title: t('notifications.low_function_title'), body: t('notifications.low_function_body') };
  }
  if (brainFog >= 7) {
    return { title: t('notifications.high_brainfog_title'), body: t('notifications.high_brainfog_body') };
  }
  if (bellScore >= 80 && brainFog <= 2) {
    return { title: t('notifications.good_day_title'), body: t('notifications.good_day_body') };
  }
  if (streak >= 3) {
    return { title: t('notifications.streak_short_title', { count: streak }), body: t('notifications.streak_short_body') };
  }
  return { title: t('notifications.daily_checkin_title'), body: t('notifications.daily_checkin_body') };
}

// Cancels today's check-in and schedules a personalized one-time trigger for tomorrow.
// Called after saving today's log so the reminder doesn't fire when already logged.
export async function scheduleDailyCheckInFromTomorrow(
  timeString: string,
  ctx?: CheckInContext
): Promise<void> {
  await cancelNotification('daily-checkin');

  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, minute, 0, 0);

  const content = ctx ? buildPersonalizedCheckInContent(ctx) : {
    title: i18n.t('notifications.daily_checkin_title'),
    body: i18n.t('notifications.daily_checkin_body'),
  };

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-checkin',
    content: { ...content, sound: true, data: { screen: NOTIFICATION_SCREEN.dailyCheckin }, ...androidChannel() },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow },
  });
}

// Schedules a re-engagement push 48h from now. Cancel on next app open.
// Fires only if the user goes quiet after logging today.
export async function scheduleLapseNotification(): Promise<void> {
  await cancelNotification('lapse-reengagement');
  const fireAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: 'lapse-reengagement',
    content: {
      title: i18n.t('notifications.lapse_title'),
      body: i18n.t('notifications.lapse_body'),
      sound: true,
      data: { screen: NOTIFICATION_SCREEN.lapse },
      ...androidChannel(),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
}

export async function cancelLapseNotification(): Promise<void> {
  await cancelNotification('lapse-reengagement');
}

// Called from the notification-received listener in app/_layout.tsx when a
// lapse notification actually delivers (as opposed to being cancelled first
// because the user came back within 48h), so its effectiveness is measurable
// the same way the crash notice suppression is.
export async function logLapseNotificationSent(userId: string): Promise<void> {
  await saveNudgeToDb(userId, 'lapse_reengagement', i18n.t('notifications.lapse_body'));
}

// ─── DSQ-SF monthly reassessment reminder ─────────────────────────────────────

// Fires 30 days after lastScoreDate, matching the in-app "due" threshold (see
// isDue = daysSince >= 30 in insights.tsx). Anchored to the actual last score
// date rather than "now" so it's safe to call repeatedly (e.g. on every insights
// load) — it cancels and reschedules each time, self-healing if the OS ever
// drops the underlying scheduled notification.
export async function scheduleDsqSfReminder(lastScoreDate: string): Promise<void> {
  await cancelNotification('dsq-sf-reminder');

  const fireAt = new Date(lastScoreDate);
  fireAt.setDate(fireAt.getDate() + 30);

  const now = new Date();
  if (fireAt <= now) {
    fireAt.setTime(now.getTime() + 24 * 60 * 60 * 1000);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: 'dsq-sf-reminder',
    content: {
      title: i18n.t('notifications.dsq_sf_reminder_title'),
      body: i18n.t('notifications.dsq_sf_reminder_body'),
      sound: true,
      data: { screen: NOTIFICATION_SCREEN.dsqSfReminder },
      ...androidChannel(),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
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

// ─── Crash early warning notification ─────────────────────────────────────────

export async function sendCrashWarningIfNeeded(
  userId: string,
  level: 'watch' | 'warning'
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `@mya_crash_alert_${userId}_${today}`;

  const lastSent = await AsyncStorage.getItem(key);
  // Don't downgrade or repeat at the same level today
  if (lastSent === 'warning') return;
  if (lastSent === 'watch' && level === 'watch') return;

  const title = level === 'warning' ? `⚠️ ${i18n.t('notifications.crash_warning_title')}` : `👀 ${i18n.t('notifications.crash_watch_title')}`;
  const body = level === 'warning' ? i18n.t('notifications.crash_warning_body') : i18n.t('notifications.crash_watch_body');

  await sendNudge(title, body, NOTIFICATION_SCREEN.crash);
  await saveNudgeToDb(userId, `crash_${level}`, body);
  await AsyncStorage.setItem(key, level);
}

// Free users don't get the specific crash warning (that stays behind the
// paywall), but they still get a generic nudge back into the app, gated by
// the same once-per-day-total budget as evaluateAndSendNudges so this can't
// stack with another nudge already sent today. Always logs to nudges either
// way, so suppression volume is measurable even on days the push is skipped.
export async function sendSoftCrashNoticeIfNeeded(
  userId: string,
  level: 'watch' | 'warning'
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `@mya_crash_alert_suppressed_${userId}_${today}`;

  const lastLogged = await AsyncStorage.getItem(key);
  if (lastLogged === 'warning') return;
  if (lastLogged === 'watch' && level === 'watch') return;

  const todayCount = await getTodayNudgeCount(userId);
  if (todayCount === 0) {
    await sendNudge(i18n.t('notifications.crash_soft_title'), i18n.t('notifications.crash_soft_body'), NOTIFICATION_SCREEN.crash);
  }
  await saveNudgeToDb(userId, `crash_${level}_locked`, 'Free user hit elevated crash risk, generic notice sent instead of the gated warning');
  await AsyncStorage.setItem(key, level);
}

// ─── Nudge ────────────────────────────────────────────────────────────────────

export async function sendNudge(title: string, body: string, screen: string = NOTIFICATION_SCREEN.nudge): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { screen }, ...androidChannel() },
    trigger: null, // fire immediately
  });
}

// ─── Nudge evaluation ─────────────────────────────────────────────────────────

let nudgeCheckInFlight = false;

export async function evaluateAndSendNudges(
  userId: string,
  logs: DailyLog[],
  healthHistory?: HealthData[]
): Promise<void> {
  if (logs.length < 3) return;
  if (nudgeCheckInFlight) return;

  nudgeCheckInFlight = true;
  try {
    await evaluateAndSendNudgesInternal(userId, logs, healthHistory);
  } finally {
    nudgeCheckInFlight = false;
  }
}

async function evaluateAndSendNudgesInternal(
  userId: string,
  logs: DailyLog[],
  healthHistory?: HealthData[]
): Promise<void> {
  // Check max 1 nudge per day
  const todayCount = await getTodayNudgeCount(userId);
  if (todayCount > 0) return;

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-3); // last 3 days

  // Rule 1: didn't wake rested on all of the last 3 logged days
  const poorRestDays = recent.filter((l) => l.woke_rested === false).length;
  if (recent.length === 3 && poorRestDays === 3) {
    const message = i18n.t('notifications.nudge_rest_body');
    await sendNudge(i18n.t('notifications.nudge_rest_title'), message);
    await saveNudgeToDb(userId, 'poor_rest', message);
    return;
  }

  // Rule 2: brain fog >= 7 on 3+ of the last 3 days
  const highBrainFogDays = recent.filter((l) => (l.cognitive_dysfunction_score ?? 0) >= 7).length;
  if (highBrainFogDays >= 3) {
    const message = i18n.t('notifications.nudge_brainfog_body');
    await sendNudge(i18n.t('notifications.nudge_brainfog_title'), message);
    await saveNudgeToDb(userId, 'brain_fog', message);
    return;
  }

  // Rule 3: functional level (Bell score) sustained low, <= 40, for 3+ of the last 3 days
  const lowFunctionDays = recent.filter((l) => (l.bell_score_today ?? 70) <= 40).length;
  if (lowFunctionDays >= 3) {
    const message = i18n.t('notifications.nudge_functional_body');
    await sendNudge(i18n.t('notifications.nudge_functional_title'), message);
    await saveNudgeToDb(userId, 'low_function', message);
    return;
  }

  // Rule 4: dizziness on standing logged 3+ of the last 3 days
  const dizzyDays = recent.filter((l) => l.dizzy_on_standing === true).length;
  if (dizzyDays >= 3) {
    const message = i18n.t('notifications.nudge_orthostatic_body');
    await sendNudge(i18n.t('notifications.nudge_orthostatic_title'), message);
    await saveNudgeToDb(userId, 'orthostatic', message);
    return;
  }

  // Rule 5: short sleep (from HealthKit/Health Connect) on 3+ recent days
  if (healthHistory && healthHistory.length >= 3) {
    const recentHealth = [...healthHistory].sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
    const shortSleepDays = recentHealth.filter((d) => d.sleep_duration !== null && d.sleep_duration < 5.5).length;
    if (shortSleepDays >= 3) {
      const message = i18n.t('notifications.nudge_sleep_body');
      await sendNudge(i18n.t('notifications.nudge_sleep_title'), message);
      await saveNudgeToDb(userId, 'short_sleep', message);
      return;
    }
  }

  // Rule 6: a genuinely good day, positive reinforcement rather than a risk signal
  const latest = sorted[sorted.length - 1];
  if (latest && (latest.bell_score_today ?? 0) >= 80 && (latest.cognitive_dysfunction_score ?? 10) <= 2) {
    const message = i18n.t('notifications.good_day_body');
    await sendNudge(i18n.t('notifications.good_day_title'), message);
    await saveNudgeToDb(userId, 'good_day', message);
    return;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getTodayNudgeCount(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count, error } = await supabase
    .from('nudges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', `${today}T00:00:00.000Z`);

  if (error) return 0;
  return count ?? 0;
}

async function saveNudgeToDb(userId: string, triggerType: string, message: string): Promise<void> {
  await supabase.from('nudges').insert({
    user_id: userId,
    sent_at: new Date().toISOString(),
    trigger_type: triggerType,
    message,
  });
}
