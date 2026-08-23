import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export const DEFAULT_BODY_WEIGHT = 100;

export interface BodyWeightEntry {
  id: string;
  weight: number;
  date: string; // ISO string
  created_at: string;
}

export function formatWeightDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const month = months[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Checks if an exercise relies on bodyweight based on equipment and naming patterns.
 */
export function isBodyweightExercise(exerciseName: string, equipment?: string): boolean {
  const eq = (equipment || '').toLowerCase().trim();
  if (eq === 'body only' || eq === 'bodyweight' || eq === 'body weight' || eq === 'calisthenics') {
    return true;
  }

  const name = (exerciseName || '').toLowerCase();
  const bodyweightKeywords = [
    'pull-up', 'pullup', 'chin-up', 'chinup', 'muscle-up',
    'push-up', 'pushup', 'armhävning', 'dip',
    'inverted row', 'australian pull',
    'bodyweight squat', 'air squat', 'pistol squat',
    'glute bridge', 'hanging leg raise', 'crunches', 'crunch', 'sit-up', 'situp'
  ];

  const hasKeyword = bodyweightKeywords.some(kw => name.includes(kw));
  if (hasKeyword) {
    // If not explicitly categorized with external weights
    if (!eq.includes('barbell') && !eq.includes('dumbbell') && !eq.includes('machine') && !eq.includes('cable') && !eq.includes('kettlebell')) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the estimated percentage of bodyweight lifted for a given bodyweight exercise (Option 1).
 */
export function getBodyweightMultiplier(exerciseName: string, equipment?: string): number {
  const name = (exerciseName || '').toLowerCase();

  // Static holds & planks (volume calculated as 0 kg since measured in time)
  if (name.includes('plank') || name.includes('static hold') || name.includes('hollow body') || name.includes('l-sit')) {
    return 0.0;
  }

  // Pull-ups / Chin-ups / Muscle-ups (~95% of bodyweight)
  if (name.includes('pull-up') || name.includes('chin-up') || name.includes('muscle-up') || name.includes('pullup') || name.includes('chinup')) {
    return 0.95;
  }

  // Dips (~90% of bodyweight)
  if (name.includes('dip')) {
    return 0.90;
  }

  // Push-ups (~65% of bodyweight, higher on decline, lower on incline/knees)
  if (name.includes('push-up') || name.includes('pushup') || name.includes('armhävning')) {
    if (name.includes('decline')) return 0.75;
    if (name.includes('incline') || name.includes('knee')) return 0.55;
    return 0.65;
  }

  // Inverted rows / Australian pull-ups (~60% of bodyweight)
  if (name.includes('inverted row') || name.includes('australian')) {
    return 0.60;
  }

  // Bodyweight squats / Lunges / Step-ups (~60% of bodyweight)
  if (name.includes('squat') || name.includes('lunge') || name.includes('step-up') || name.includes('step up')) {
    return 0.60;
  }

  // Calf raises (~95% of bodyweight above ankles)
  if (name.includes('calf raise') || name.includes('vadpress')) {
    return 0.95;
  }

  // Glute bridges / Bodyweight hip thrusts (~50% of bodyweight)
  if (name.includes('glute bridge') || name.includes('hip thrust')) {
    return 0.50;
  }

  // Core (crunches, sit-ups, leg raises ~40% of torso/legs weight)
  if (name.includes('crunch') || name.includes('sit-up') || name.includes('situp') || name.includes('leg raise')) {
    return 0.40;
  }

  // Standard fallback for any other bodyweight exercise
  return 0.65;
}

/**
 * Calculates lifted volume for an exercise set.
 * If bodyweight, volume = reps * ((userWeight * multiplier) + addedWeight).
 * If traditional weighted, volume = reps * weight.
 */
export function calculateSetVolume(
  reps: number,
  weight: number,
  exerciseName: string,
  equipment?: string,
  userWeight: number = DEFAULT_BODY_WEIGHT
): number {
  if (reps <= 0) return 0;

  if (isBodyweightExercise(exerciseName, equipment)) {
    const multiplier = getBodyweightMultiplier(exerciseName, equipment);
    const addedWeight = weight || 0;
    const effectiveWeight = (userWeight * multiplier) + addedWeight;
    return Math.round(reps * effectiveWeight);
  }

  return Math.round(reps * (weight || 0));
}

const getStorageKey = (userId?: string) => (userId ? `@user_body_weight_${userId}` : '@user_body_weight');
const getStorageHistoryKey = (userId?: string) => (userId ? `@user_body_weight_history_${userId}` : '@user_body_weight_history');

/**
 * Fetches the user's stored body weight from Supabase metadata or user-scoped local storage.
 * Returns default (75 kg) if not set.
 */
export async function getUserBodyWeight(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const storageKey = getStorageKey(user?.id);

    if (user?.user_metadata?.body_weight) {
      const weight = parseFloat(user.user_metadata.body_weight);
      if (!isNaN(weight) && weight > 0) {
        await AsyncStorage.setItem(storageKey, weight.toString());
        return weight;
      }
    }

    if (user?.id) {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        const parsed = parseFloat(cached);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  } catch (error) {
    console.error('Error fetching user body weight:', error);
  }
  return DEFAULT_BODY_WEIGHT;
}

/**
 * Saves the user's body weight to local storage and updates Supabase user metadata.
 */
export async function saveUserBodyWeight(weight: number): Promise<void> {
  if (isNaN(weight) || weight <= 0) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const storageKey = getStorageKey(user?.id);

    await AsyncStorage.setItem(storageKey, weight.toString());
    await supabase.auth.updateUser({
      data: { body_weight: weight },
    });
  } catch (error) {
    console.error('Error saving user body weight:', error);
  }
}

/**
 * Fetches the user's body weight history.
 */
export async function getBodyWeightHistory(): Promise<BodyWeightEntry[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const historyKey = getStorageHistoryKey(user?.id);

    if (user?.user_metadata?.body_weight_history && Array.isArray(user.user_metadata.body_weight_history)) {
      const history: BodyWeightEntry[] = user.user_metadata.body_weight_history;
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (user?.id) {
      const cached = await AsyncStorage.getItem(historyKey);
      if (cached) {
        const parsed: BodyWeightEntry[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }
    }

    // Seed with current weight if history is empty for this user
    const currentWeight = await getUserBodyWeight();
    const initialEntry: BodyWeightEntry = {
      id: Date.now().toString(),
      weight: currentWeight,
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    if (user?.id) {
      await AsyncStorage.setItem(historyKey, JSON.stringify([initialEntry]));
    }
    return [initialEntry];
  } catch (error) {
    console.error('Error getting body weight history:', error);
    return [];
  }
}

/**
 * Adds a new body weight measurement and updates current body weight.
 */
export async function addBodyWeightEntry(weight: number, date?: string): Promise<BodyWeightEntry[]> {
  if (isNaN(weight) || weight <= 0) return [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const storageKey = getStorageKey(user?.id);
    const historyKey = getStorageHistoryKey(user?.id);

    const history = await getBodyWeightHistory();
    const newEntry: BodyWeightEntry = {
      id: Date.now().toString(),
      weight,
      date: date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const updated = [newEntry, ...history.filter(h => h.id !== newEntry.id)];
    updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    await AsyncStorage.setItem(historyKey, JSON.stringify(updated));
    await AsyncStorage.setItem(storageKey, weight.toString());

    await supabase.auth.updateUser({
      data: {
        body_weight: weight,
        body_weight_history: updated,
      },
    });

    return updated;
  } catch (error) {
    console.error('Error adding body weight entry:', error);
    return [];
  }
}
