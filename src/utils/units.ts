import * as Localization from 'expo-localization';

let cachedUseFahrenheit: boolean | null = null;

// Device region's measurement system decides the unit, not a manual toggle,
// matching how the OS itself displays temperature (Settings > Region on iOS).
export function deviceUsesFahrenheit(): boolean {
  if (cachedUseFahrenheit !== null) return cachedUseFahrenheit;
  try {
    cachedUseFahrenheit = Localization.getLocales()[0]?.measurementSystem === 'us';
  } catch {
    cachedUseFahrenheit = false;
  }
  return cachedUseFahrenheit;
}

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

// Weather data is always fetched and stored in Celsius, this only converts
// for display so thresholds/colour-coding elsewhere stay in one unit.
export function formatTemperature(celsius: number): string {
  return deviceUsesFahrenheit() ? `${celsiusToFahrenheit(celsius)}°F` : `${Math.round(celsius)}°C`;
}
