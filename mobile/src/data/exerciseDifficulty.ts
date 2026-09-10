import difficultyMapRaw from './exerciseDifficultyMap.json';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'expert';

export const exerciseDifficultyMap: Record<string, ExerciseDifficulty> = difficultyMapRaw as Record<string, ExerciseDifficulty>;

/**
 * Returns the official difficulty classification for any exercise from the database.
 */
export function getExerciseDifficulty(name?: string): ExerciseDifficulty {
  if (!name) return 'intermediate';
  return exerciseDifficultyMap[name.toLowerCase().trim()] || 'intermediate';
}

/**
 * Checks whether an exercise is allowed for a user's experience level.
 * - 'beginner': Only 'beginner' exercises are allowed.
 * - 'intermediate': 'beginner' and 'intermediate' exercises are allowed. 'expert' exercises are BLOCKED.
 * - 'advanced' / 'expert': All exercises are allowed.
 */
export function isExerciseAllowedForLevel(exerciseName: string, userLevel?: string): boolean {
  if (!userLevel) return true;
  const level = userLevel.toLowerCase();

  const difficulty = getExerciseDifficulty(exerciseName);

  if (level === 'beginner' || level === 'nybörjare') {
    return difficulty === 'beginner';
  }

  if (level === 'intermediate' || level === 'medelnivå') {
    // Intermediate users can do beginner and intermediate exercises, but NOT expert!
    return difficulty === 'beginner' || difficulty === 'intermediate';
  }

  // Advanced / Erfaren can do all exercises
  return true;
}
