import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_CONSENT_KEY = '@mya_ai_consent';

// Default true (opt-out, not opt-in): existing users predate this consent
// screen and shouldn't be silently locked out of a feature they already
// had access to. New users set this explicitly during onboarding.
export async function getAiConsent(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(AI_CONSENT_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
}

export async function setAiConsent(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_CONSENT_KEY, value ? 'true' : 'false');
  } catch {}
}
