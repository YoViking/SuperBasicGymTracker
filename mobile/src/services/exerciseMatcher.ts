import { ExerciseLibrary } from '../types';

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
export function normalizeEquipment(eq?: string): string[] {
  if (!eq) return [];
  const e = eq.toLowerCase().trim();
  if (e.includes('barbell') || e.includes('skivstång')) return ['barbell', 'e-z curl bar'];
  if (e.includes('dumbbell') || e.includes('hantel')) return ['dumbbell'];
  if (e.includes('cable') || e.includes('kabel')) return ['cable'];
  if (e.includes('machine') || e.includes('maskin') || e.includes('smith')) return ['machine'];
  if (e.includes('bodyweight') || e.includes('body weight') || e.includes('body only') || e.includes('kroppsvikt') || e.includes('kropp') || e.includes('bodyweight')) return ['body only'];
  if (e.includes('kettlebell')) return ['kettlebells'];
  if (e.includes('band') || e.includes('rubber') || e.includes('gummiband')) return ['bands'];
  return [];
}

/**
 * Fuzzy matches an AI-generated exercise name against the available exercise library.
 */
export function findBestExerciseMatch(
  aiName: string,
  targetMuscle: string,
  equipment: string,
  exerciseLibrary: ExerciseLibrary[]
): ExerciseLibrary | null {
  if (!aiName) return null;
  if (!exerciseLibrary || exerciseLibrary.length === 0) return null;

  const normalizedMuscle = normalizeMuscleGroup(targetMuscle);
  const normalizedEqList = normalizeEquipment(equipment);

  // 1. Filter by muscle group and equipment to narrow search
  let candidates = exerciseLibrary.filter(ex => {
    const muscleMatch = ex.muscle_group === normalizedMuscle;
    
    // Equipment match (if specified, we try to match)
    let eqMatch = true;
    if (normalizedEqList.length > 0 && ex.equipment) {
      eqMatch = normalizedEqList.includes(ex.equipment.toLowerCase());
    }
    
    return muscleMatch && eqMatch;
  });

  // 2. If no exact match with constraints, broaden to muscle group only
  if (candidates.length === 0) {
    candidates = exerciseLibrary.filter(ex => ex.muscle_group === normalizedMuscle);
  }

  // 3. If still empty, search across the entire library
  if (candidates.length === 0) {
    candidates = exerciseLibrary;
  }

  // 4. Calculate similarity scores and find the best candidate
  let bestMatch: ExerciseLibrary | null = null;
  let highestScore = 0.0;

  for (const candidate of candidates) {
    // Exact match (ignoring case)
    if (candidate.name.toLowerCase().trim() === aiName.toLowerCase().trim()) {
      return candidate;
    }

    const score = getSimilarityScore(aiName, candidate.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }

  // Only return match if it passes a minimum similarity threshold (e.g. 30%)
  // otherwise fallback to the first candidate or null
  if (highestScore >= 0.3) {
    return bestMatch;
  }

  // Fallback: If we have muscle group candidates, pick the first one, otherwise null
  const muscleCandidates = exerciseLibrary.filter(ex => ex.muscle_group === normalizedMuscle);
  return muscleCandidates.length > 0 ? muscleCandidates[0] : (exerciseLibrary[0] || null);
}
