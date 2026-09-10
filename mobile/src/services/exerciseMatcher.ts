import { ExerciseLibrary } from '../types';
import { isExerciseAllowedForLevel } from '../data/exerciseDifficulty';

// Helper: Levenshtein distance algorithm for string similarity
function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp.push([i]);
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

// Helper: Similarity score between 0.0 and 1.0
function getSimilarityScore(a: string, b: string): number {
  const strA = a.toLowerCase().trim();
  const strB = b.toLowerCase().trim();
  if (strA === strB) return 1.0;
  if (!strA || !strB) return 0.0;

  // 1. Calculate word/token overlap similarity
  const wordsA = new Set(strA.split(/[\s-_,]+/));
  const wordsB = new Set(strB.split(/[\s-_,]+/));
  let intersection = 0;
  wordsA.forEach(w => {
    if (wordsB.has(w)) intersection++;
  });
  const tokenSim = intersection / Math.max(wordsA.size, wordsB.size);

  // 2. Calculate Levenshtein similarity
  const maxLength = Math.max(strA.length, strB.length);
  const levDist = getLevenshteinDistance(strA, strB);
  const levSim = maxLength === 0 ? 1.0 : 1.0 - levDist / maxLength;

  // Weighted score (40% word overlap, 60% edit distance)
  return 0.4 * tokenSim + 0.6 * levSim;
}

// Normalizer: Map target muscle names to DB muscle groups
export function normalizeMuscleGroup(muscle?: string): string {
  if (!muscle) return 'Other';
  const m = muscle.toLowerCase().trim();
  if (m.includes('chest') || m.includes('bröst')) return 'Chest';
  if (m.includes('back') || m.includes('rygg') || m.includes('lats')) return 'Back';
  if (m.includes('shoulder') || m.includes('axlar') || m.includes('axel') || m.includes('delt')) return 'Shoulders';
  if (m.includes('leg') || m.includes('ben') || m.includes('quad') || m.includes('hamstring') || m.includes('calf') || m.includes('calves')) return 'Legs';
  if (m.includes('arm') || m.includes('bicep') || m.includes('tricep') || m.includes('forearm')) return 'Arms';
  if (m.includes('core') || m.includes('abs') || m.includes('mage') || m.includes('oblique') || m.includes('ab') || m.includes('waist')) return 'Core';
  if (m.includes('glute') || m.includes('rumpa') || m.includes('butt') || m.includes('hip')) return 'Glutes';
  return 'Other';
}

// Normalizer: Map AI equipment names to DB equipment categories
export function normalizeEquipment(eq?: string | string[]): string[] {
  if (!eq) return [];
  const items = Array.isArray(eq) ? eq : [eq];
  const result = new Set<string>();

  for (const item of items) {
    if (!item) continue;
    const e = item.toLowerCase().trim();
    if (e.includes('barbell') || e.includes('skivstång')) {
      result.add('barbell');
      result.add('e-z curl bar');
    }
    if (e.includes('dumbbell') || e.includes('hantel')) {
      result.add('dumbbell');
    }
    if (e.includes('cable') || e.includes('kabel')) {
      result.add('cable');
    }
    if (e.includes('machine') || e.includes('maskin') || e.includes('smith')) {
      result.add('machine');
    }
    if (
      e.includes('bodyweight') ||
      e.includes('body weight') ||
      e.includes('body only') ||
      e.includes('kroppsvikt') ||
      e.includes('kropp') ||
      e === 'body'
    ) {
      result.add('body only');
      // allow null/empty equipment in DB which represents bodyweight exercises
      result.add('__null_equipment__');
    }
    if (e.includes('kettlebell')) {
      result.add('kettlebells');
    }
    if (e.includes('band') || e.includes('rubber') || e.includes('gummiband')) {
      result.add('bands');
    }
  }

  return Array.from(result);
}

export interface ExerciseMatchOptions {
  allowedEquipment?: string[];
  experienceLevel?: string;
}

/**
 * Fuzzy matches an AI-generated exercise name against the available exercise library.
 * Strictly respects the user's allowed equipment and experience level.
 */
export function findBestExerciseMatch(
  aiName: string,
  targetMuscle: string,
  equipment: string,
  exerciseLibrary: ExerciseLibrary[],
  options?: ExerciseMatchOptions
): ExerciseLibrary | null {
  if (!aiName) return null;
  if (!exerciseLibrary || exerciseLibrary.length === 0) return null;

  const normalizedMuscle = normalizeMuscleGroup(targetMuscle);
  const normalizedEqList = normalizeEquipment(equipment);
  const allowedEqList = options?.allowedEquipment && options.allowedEquipment.length > 0
    ? normalizeEquipment(options.allowedEquipment)
    : [];

  const isBeginnerOrIntermediate =
    !options?.experienceLevel ||
    options.experienceLevel.toLowerCase() === 'beginner' ||
    options.experienceLevel.toLowerCase() === 'intermediate' ||
    options.experienceLevel.toLowerCase() === 'nybörjare' ||
    options.experienceLevel.toLowerCase() === 'medelnivå';

  // 1. Check if an exercise is allowed based on user's equipment constraint
  const isEquipmentPermitted = (ex: ExerciseLibrary): boolean => {
    if (allowedEqList.length === 0) return true; // No restriction passed
    if (!ex.equipment) {
      return allowedEqList.includes('__null_equipment__') || allowedEqList.includes('body only');
    }
    const dbEq = ex.equipment.toLowerCase().trim();
    return allowedEqList.includes(dbEq);
  };

  // Filter strictly by user equipment
  const equipmentPool = allowedEqList.length > 0
    ? exerciseLibrary.filter(isEquipmentPermitted)
    : exerciseLibrary;

  // 2. Filter strictly by user experience level using official database classifications
  const levelFilteredPool = equipmentPool.filter(ex =>
    isExerciseAllowedForLevel(ex.name, options?.experienceLevel)
  );

  // Use level filtered pool if available, otherwise stay strictly within equipment pool
  const pool = levelFilteredPool.length > 0 ? levelFilteredPool : equipmentPool;

  if (pool.length === 0) {
    // If no exercises in library match user equipment, return null rather than illegal equipment
    return null;
  }

  // 2. Filter by target muscle group and generated equipment within permitted pool
  let candidates = pool.filter(ex => {
    const muscleMatch = ex.muscle_group === normalizedMuscle;
    let eqMatch = true;
    if (normalizedEqList.length > 0) {
      if (!ex.equipment) {
        eqMatch = normalizedEqList.includes('__null_equipment__') || normalizedEqList.includes('body only');
      } else {
        eqMatch = normalizedEqList.includes(ex.equipment.toLowerCase());
      }
    }
    return muscleMatch && eqMatch;
  });

  // 3. If no exact match with generated equipment, broaden to muscle group WITHIN PERMITTED POOL ONLY
  if (candidates.length === 0) {
    candidates = pool.filter(ex => ex.muscle_group === normalizedMuscle);
  }

  // 4. If still empty, search across entire permitted pool (NEVER jump to forbidden equipment!)
  if (candidates.length === 0) {
    candidates = pool;
  }

  // 5. Score candidates
  let bestMatch: ExerciseLibrary | null = null;
  let highestScore = 0.0;

  for (const candidate of candidates) {
    // Exact match (ignoring case)
    if (candidate.name.toLowerCase().trim() === aiName.toLowerCase().trim()) {
      bestMatch = candidate;
      highestScore = 1.0;
      break;
    }

    const score = getSimilarityScore(aiName, candidate.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }

  // Helper to downgrade extreme exercises (Handstand Push-Ups) for non-advanced users
  const applyDifficultyGuard = (ex: ExerciseLibrary | null): ExerciseLibrary | null => {
    if (!ex) return null;
    if (isBeginnerOrIntermediate && ex.name.toLowerCase().includes('handstand')) {
      // Substitute with Decline Push-Up or regular Push-Up
      const alt = pool.find(c => c.name.toLowerCase().includes('decline push-up'))
        || pool.find(c => c.name.toLowerCase().includes('push-up') || c.name.toLowerCase() === 'pushups')
        || pool.find(c => c.muscle_group === 'Chest' || c.muscle_group === 'Shoulders');
      return alt || ex;
    }
    return ex;
  };

  // Only return match if it passes threshold
  if (highestScore >= 0.3 && bestMatch) {
    return applyDifficultyGuard(bestMatch);
  }

  // Fallback: Pick candidate in same muscle group from permitted pool
  const muscleCandidates = pool.filter(ex => ex.muscle_group === normalizedMuscle);
  const fallback = muscleCandidates.length > 0 ? muscleCandidates[0] : (pool[0] || null);

  return applyDifficultyGuard(fallback);
}
