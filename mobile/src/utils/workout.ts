import { Workout } from '../types';

/**
 * Calculates the number of unique exercises in a workout.
 * 
 * In the database, the `workout_exercises` table stores individual sets as rows.
 * Multiple rows therefore belong to the same exercise.
 * This helper calculates distinct exercises by `exercise_id`, with fallbacks to
 * `exercise.id` or `order_index` (which also correctly groups legacy cached data).
 */
export function getWorkoutExerciseCount(workout?: Workout | null): number {
  if (!workout?.workout_exercises || workout.workout_exercises.length === 0) {
    return 0;
  }

  const uniqueExerciseKeys = new Set<string>();
  let hasValidIdentifier = false;

  for (const item of workout.workout_exercises) {
    if (item.exercise_id) {
      uniqueExerciseKeys.add(String(item.exercise_id));
      hasValidIdentifier = true;
    } else if (item.exercise && (item.exercise as any).id) {
      uniqueExerciseKeys.add(String((item.exercise as any).id));
      hasValidIdentifier = true;
    } else if (item.order_index !== undefined && item.order_index !== null) {
      uniqueExerciseKeys.add(`order_${item.order_index}`);
      hasValidIdentifier = true;
    }
  }

  if (hasValidIdentifier) {
    return uniqueExerciseKeys.size;
  }

  return workout.workout_exercises.length;
}

/**
 * Formats the exercise count text with correct Swedish grammar:
 * 1 -> "1 övning"
 * N -> "N övningar"
 */
export function formatExerciseCount(count: number): string {
  return `${count} ${count === 1 ? 'övning' : 'övningar'}`;
}
