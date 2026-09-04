import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

function storageKey(userId: string) {
  return `@mya_tracks_medication_${userId}`;
}

export function useMedicationTracking(): {
  tracks: boolean;
  isLoading: boolean;
  setTracks: (value: boolean) => Promise<void>;
} {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [tracks, setTracksState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks the previous "no medication" answer so we can tell a real onboarding/profile
  // change (which should flip tracking automatically) apart from a normal re-render.
  const prevNoMeds = useRef<boolean | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    const key = storageKey(user.id);
    const noMeds = profile.medications?.includes('no_medication') ?? false;
    const noMedsJustChanged = prevNoMeds.current !== null && prevNoMeds.current !== noMeds;
    prevNoMeds.current = noMeds;

    if (noMeds) {
      setTracksState(false);
      AsyncStorage.setItem(key, 'false').catch(() => {});
      setIsLoading(false);
      return;
    }

    if (noMedsJustChanged) {
      // Went from "no medication" to listing real medications, so turn tracking back on
      // automatically rather than leaving the earlier "off" preference in place.
      setTracksState(true);
      AsyncStorage.setItem(key, 'true').catch(() => {});
      setIsLoading(false);
      return;
    }

    AsyncStorage.getItem(key).then((raw) => {
      if (raw !== null) {
        setTracksState(raw === 'true');
      } else {
        setTracksState(true);
        AsyncStorage.setItem(key, 'true').catch(() => {});
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [user?.id, profile?.medications]);

  const setTracks = useCallback(async (value: boolean) => {
    if (!user) return;
    setTracksState(value);
    await AsyncStorage.setItem(storageKey(user.id), String(value));
  }, [user]);

  return { tracks, isLoading, setTracks };
}
