import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeatherSnapshot {
  temperature: number; // degrees C
  apparentTemperature: number; // degrees C, "feels like"
  uvIndex: number;
  airQualityIndex: number | null; // US AQI, 0-500
  fetchedAt: string; // YYYY-MM-DD
}

const CACHE_KEY = '@mya_weather_cache';

export async function getCachedWeather(): Promise<WeatherSnapshot | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed: WeatherSnapshot = JSON.parse(cached);
    const today = new Date().toISOString().split('T')[0];
    return parsed.fetchedAt === today ? parsed : null;
  } catch {
    return null;
  }
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    fetch(url)
      .then((r) => { clearTimeout(timer); resolve(r); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

async function getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const services: Array<() => Promise<{ latitude: number; longitude: number } | null>> = [
    async () => {
      const res = await fetchWithTimeout('https://ipapi.co/json/', 6000);
      const j = await res.json();
      if (typeof j.latitude === 'number' && typeof j.longitude === 'number') {
        return { latitude: j.latitude, longitude: j.longitude };
      }
      return null;
    },
    async () => {
      const res = await fetchWithTimeout('https://ipwho.is/', 6000);
      const j = await res.json();
      if (j.success && typeof j.latitude === 'number' && typeof j.longitude === 'number') {
        return { latitude: j.latitude, longitude: j.longitude };
      }
      return null;
    },
  ];

  for (const service of services) {
    try {
      const coords = await service();
      if (coords) return coords;
    } catch {
      // try next
    }
  }
  return null;
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const cached = await getCachedWeather();
  if (cached) return cached;

  const coords = await getCoordinates();
  if (!coords) throw new Error('Could not determine location');

  const { latitude, longitude } = coords;
  const todayPrefix = new Date().toISOString().split('T')[0];

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    `&current=temperature_2m,apparent_temperature,uv_index&timezone=auto`;

  const airQualityUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    `&current=us_aqi&timezone=auto`;

  const [forecastRes, airQualityRes] = await Promise.all([
    fetchWithTimeout(forecastUrl, 10000),
    fetchWithTimeout(airQualityUrl, 10000).catch(() => null),
  ]);

  const forecastJson = await forecastRes.json();
  const temperature: number = forecastJson.current?.temperature_2m;
  const apparentTemperature: number = forecastJson.current?.apparent_temperature;
  const uvIndex: number = forecastJson.current?.uv_index;

  if (temperature === undefined || temperature === null) {
    throw new Error(`Bad forecast response: ${JSON.stringify(forecastJson).slice(0, 200)}`);
  }

  let airQualityIndex: number | null = null;
  if (airQualityRes) {
    try {
      const airQualityJson = await airQualityRes.json();
      const aqi = airQualityJson.current?.us_aqi;
      if (typeof aqi === 'number') airQualityIndex = Math.round(aqi);
    } catch {
      // air quality is a bonus field, missing it shouldn't fail the whole fetch
    }
  }

  const data: WeatherSnapshot = {
    temperature: Math.round(temperature),
    apparentTemperature: Math.round(apparentTemperature ?? temperature),
    uvIndex: Math.round((uvIndex ?? 0) * 10) / 10,
    airQualityIndex,
    fetchedAt: todayPrefix,
  };

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return data;
}
