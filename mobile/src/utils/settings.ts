import AsyncStorage from '@react-native-async-storage/async-storage';

export const REST_TIMER_INTERVAL_KEY = '@superbasic_settings_rest_timer_interval';
export const KEEP_AWAKE_KEY = '@superbasic_settings_keep_awake';

export interface RestTimerOption {
  label: string;
  value: number; // in seconds
  display: string;
}

export const REST_TIMER_OPTIONS: RestTimerOption[] = [
  { label: '15s', value: 15, display: '15 s' },
  { label: '30s', value: 30, display: '30 s' },
  { label: '45s', value: 45, display: '45 s' },
  { label: '1 min', value: 60, display: '1 min' },
  { label: '1 min 15s', value: 75, display: '1 min 15 s' },
  { label: '1 min 30s', value: 90, display: '1 min 30 s' },
];

export const DEFAULT_REST_TIMER_INTERVAL = 30;
export const DEFAULT_KEEP_AWAKE = true;

/**
 * Gets the saved rest timer interval in seconds.
 * Defaults to 30 seconds.
 */
export async function getRestTimerInterval(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(REST_TIMER_INTERVAL_KEY);
    if (value !== null) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error reading rest timer interval setting:', error);
  }
  return DEFAULT_REST_TIMER_INTERVAL;
}

/**
 * Saves the rest timer interval in seconds.
 */
export async function setRestTimerInterval(seconds: number): Promise<void> {
  try {
    await AsyncStorage.setItem(REST_TIMER_INTERVAL_KEY, seconds.toString());
  } catch (error) {
    console.error('Error saving rest timer interval setting:', error);
  }
}

/**
 * Gets the saved Keep Awake setting (boolean).
 * Defaults to true.
 */
export async function getKeepAwakeSetting(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEEP_AWAKE_KEY);
    if (value !== null) {
      return value === 'true';
    }
  } catch (error) {
    console.error('Error reading keep awake setting:', error);
  }
  return DEFAULT_KEEP_AWAKE;
}

/**
 * Saves the Keep Awake setting (boolean).
 */
export async function setKeepAwakeSetting(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEEP_AWAKE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving keep awake setting:', error);
  }
}

/**
 * Helper to format seconds into a friendly display string (e.g. '30 s', '1 min', '1 min 15 s').
 */
export function formatTimerIntervalDisplay(seconds: number): string {
  const match = REST_TIMER_OPTIONS.find(opt => opt.value === seconds);
  if (match) return match.display;

  if (seconds < 60) {
    return `${seconds} s`;
  }
  const mins = Math.floor(seconds / 60);
  const remainderSecs = seconds % 60;
  if (remainderSecs === 0) {
    return `${mins} min`;
  }
  return `${mins} min ${remainderSecs} s`;
}
