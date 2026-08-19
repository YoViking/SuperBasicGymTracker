import { supabase } from '../lib/supabase';

export interface ExerciseAchievement {
  exerciseName: string;
  muscleGroup?: string;
  type: 'max_weight' | 'max_reps';
  title: string;
  currentValue: number;
  previousValue?: number;
  diff?: number;
  unit: string;
  weightContext?: number; // e.g. weight in kg when reps record was achieved
}

export interface CurrentExerciseSet {
  reps: number;
  weight: number;
  is_done: boolean;
}

export interface CompletedExerciseData {
  exerciseName: string;
  muscleGroup: string;
  sets: CurrentExerciseSet[];
}

/**
 * Compares the completed exercises in the current session against the user's
 * historical workout_exercise_logs to detect genuine new personal records (PRs).
 * 
 * Only awards a PR if:
 * 1. Max Weight Record: The user lifted a strictly heavier weight than in any past log.
 * 2. Reps Record at Max Weight: The user performed strictly more reps on their previous max weight.
 */
export async function detectWorkoutRecords(
  userId: string,
  exercises: CompletedExerciseData[]
): Promise<ExerciseAchievement[]> {
  const achievements: ExerciseAchievement[] = [];

  try {
    for (const ex of exercises) {
      const doneSets = ex.sets.filter(s => s.is_done && s.reps > 0);
      if (doneSets.length === 0) continue;

      // Current session max weight and max reps at that max weight
      const currentMaxWeight = Math.max(...doneSets.map(s => s.weight || 0));
      const setsAtMaxWeight = doneSets.filter(s => (s.weight || 0) === currentMaxWeight);
      const currentMaxRepsAtMaxWeight = Math.max(...setsAtMaxWeight.map(s => s.reps || 0));

      if (currentMaxWeight <= 0 && currentMaxRepsAtMaxWeight <= 0) continue;

      // Query past logs for this exercise for this user
      const { data: pastLogs, error } = await supabase
        .from('workout_exercise_logs')
        .select(`
          weight,
          reps,
          workout_logs!inner(user_id)
        `)
        .eq('exercise_name', ex.exerciseName)
        .eq('workout_logs.user_id', userId);

      if (error) {
        console.error(`Error querying past logs for ${ex.exerciseName}:`, error);
        continue;
      }

      // If no past logs exist yet, this is the baseline / first time, not a broken record
      if (!pastLogs || pastLogs.length === 0) {
        continue;
      }

      // Compute historical max weight
      const pastWeights = pastLogs.map((l: any) => l.weight || 0);
      const pastMaxWeight = Math.max(...pastWeights, 0);

      // Compute historical max reps performed at the current max weight
      const pastLogsAtCurrentWeight = pastLogs.filter((l: any) => (l.weight || 0) === currentMaxWeight);
      const pastMaxRepsAtCurrentWeight = pastLogsAtCurrentWeight.length > 0
        ? Math.max(...pastLogsAtCurrentWeight.map((l: any) => l.reps || 0))
        : 0;

      // 1. Check for Strict Max Weight PB (strictly heavier weight)
      if (currentMaxWeight > pastMaxWeight && pastMaxWeight > 0) {
        const diff = Number((currentMaxWeight - pastMaxWeight).toFixed(1));
        achievements.push({
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          type: 'max_weight',
          title: 'Nytt Maxvikt PB',
          currentValue: currentMaxWeight,
          previousValue: pastMaxWeight,
          diff: diff > 0 ? diff : undefined,
          unit: 'kg',
        });
      } else if (
        currentMaxWeight === pastMaxWeight &&
        pastMaxWeight > 0 &&
        currentMaxRepsAtMaxWeight > pastMaxRepsAtCurrentWeight &&
        pastMaxRepsAtCurrentWeight > 0
      ) {
        // 2. Check for Reps Record at same max weight (more reps on previous max weight)
        const diff = currentMaxRepsAtMaxWeight - pastMaxRepsAtCurrentWeight;
        achievements.push({
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          type: 'max_reps',
          title: `Nytt Reps-rekord (${currentMaxWeight} kg)`,
          currentValue: currentMaxRepsAtMaxWeight,
          previousValue: pastMaxRepsAtCurrentWeight,
          diff: diff > 0 ? diff : undefined,
          unit: 'reps',
          weightContext: currentMaxWeight,
        });
      }
    }
  } catch (err) {
    console.error('Error detecting workout records:', err);
  }

  return achievements;
}
