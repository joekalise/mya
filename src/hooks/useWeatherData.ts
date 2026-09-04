import { useState, useEffect, useCallback } from 'react';
import { getCachedWeather, fetchWeather, WeatherSnapshot } from '@/services/weather';
import { saveWeatherData } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';

export function useWeatherData() {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    getCachedWeather()
      .then((cached) => {
        if (cached) {
          setWeather(cached);
          setIsLoading(false);
        } else {
          // No cache — fetch immediately, no tap required
          setIsLoading(false);
          setIsFetching(true);
          fetchWeather()
            .then((data) => setWeather(data))
            .catch(() => setFetchError(true))
            .finally(() => setIsFetching(false));
        }
      })
      .catch(() => {
        setWeather(null);
        setIsLoading(false);
      });
  }, []);

  const refresh = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);
    setFetchError(false);
    try {
      const data = await fetchWeather();
      setWeather(data);
    } catch {
      setFetchError(true);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching]);

  // Persist each day's reading so it can be correlated against crashes and
  // functional level at a lag later — a same-day cache alone can't answer
  // "was it hot a few days before this crash?".
  useEffect(() => {
    if (!user || !weather) return;
    saveWeatherData(user.id, weather.fetchedAt, {
      temperature: weather.temperature,
      apparent_temperature: weather.apparentTemperature,
      uv_index: weather.uvIndex,
      air_quality_index: weather.airQualityIndex,
    }).catch(() => {});
  }, [user, weather]);

  return { weather, isLoading, isFetching, fetchError, refresh };
}
