import { supabase } from '../lib/supabase';
import { isTimedExercise, isBodyweightExercise } from '../utils/volume';

export interface ExerciseAchievement {
  exerciseName: string;
  muscleGroup?: string;
  type: 'max_weight' | 'max_reps' | 'max_time';
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
 * Detects:
 * 1. Max Weight Record: The user lifted a strictly heavier weight than in any past log.
 * 2. Reps / Time Record: The user performed strictly more reps (or seconds) at their max weight / bodyweight.
 */
export async function detectWorkoutRecords(
  userId: string,
  exercises: CompletedExerciseData[]
): Promise<ExerciseAchievement[]> {
  const achievements: ExerciseAchievement[] = [];

  try {
    // 1. Filter exercises that have completed sets with reps
    const exercisesToEvaluate = exercises.filter(ex => {
      const doneSets = ex.sets.filter(s => s.is_done && s.reps > 0);
      if (doneSets.length === 0) return false;
      const maxWeight = Math.max(...doneSets.map(s => s.weight || 0));
      const maxReps = Math.max(...doneSets.map(s => s.reps || 0));
      return maxWeight > 0 || maxReps > 0;
    });

    if (exercisesToEvaluate.length === 0) {
      return achievements;
    }

    const uniqueExerciseNames = Array.from(new Set(exercisesToEvaluate.map(ex => ex.exerciseName)));

    // 2. Batch-query past logs for all exercises in this workout session in a single database request
    const { data: allPastLogs, error } = await supabase
      .from('workout_exercise_logs')
      .select(`
        exercise_name,
        weight,
        reps,
        workout_logs!inner(user_id)
      `)
      .in('exercise_name', uniqueExerciseNames)
      .eq('workout_logs.user_id', userId);

    if (error) {
      console.error('Error batch querying past logs for record detection:', error);
      return achievements;
    }

    // 3. Group past logs by exercise_name in memory (Map)
    const logsByExercise = new Map<string, Array<{ weight: number; reps: number }>>();
    for (const name of uniqueExerciseNames) {
      logsByExercise.set(name, []);
    }
    if (allPastLogs) {
      for (const log of allPastLogs) {
        const list = logsByExercise.get(log.exercise_name);
        if (list) {
          list.push({ weight: log.weight || 0, reps: log.reps || 0 });
        }
      }
    }

    // 4. In-memory record evaluation (0 network calls in loop)
    for (const ex of exercisesToEvaluate) {
      const doneSets = ex.sets.filter(s => s.is_done && s.reps > 0);
      const isTimed = isTimedExercise(ex.exerciseName);
      const isBodyweight = isBodyweightExercise(ex.exerciseName);

      // Current session max weight and max reps at that max weight
      const currentMaxWeight = Math.max(...doneSets.map(s => s.weight || 0));
      const setsAtMaxWeight = doneSets.filter(s => (s.weight || 0) === currentMaxWeight);
      const currentMaxRepsAtMaxWeight = Math.max(...setsAtMaxWeight.map(s => s.reps || 0));

      const pastLogs = logsByExercise.get(ex.exerciseName) || [];

      // If no past logs exist yet, this is the baseline / first time, not a broken record
      if (pastLogs.length === 0) {
        continue;
      }

      // Compute historical max weight
      const pastWeights = pastLogs.map(l => l.weight);
      const pastMaxWeight = Math.max(...pastWeights, 0);

      // Compute historical max reps performed at the current max weight
      const pastLogsAtCurrentWeight = pastLogs.filter(l => l.weight === currentMaxWeight);
      const pastMaxRepsAtCurrentWeight = pastLogsAtCurrentWeight.length > 0
        ? Math.max(...pastLogsAtCurrentWeight.map(l => l.reps))
        : 0;

      // 1. Check for Strict Max Weight PB (strictly heavier weight)
      if (currentMaxWeight > pastMaxWeight) {
        const diff = pastMaxWeight > 0
          ? Number((currentMaxWeight - pastMaxWeight).toFixed(1))
          : currentMaxWeight;

        achievements.push({
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          type: 'max_weight',
          title: isBodyweight && pastMaxWeight === 0
            ? `Nytt Vikt-PB (+${currentMaxWeight} kg)`
            : 'Nytt Maxvikt PB',
          currentValue: currentMaxWeight,
          previousValue: pastMaxWeight > 0 ? pastMaxWeight : undefined,
          diff: diff > 0 ? diff : undefined,
          unit: 'kg',
        });
      } else if (currentMaxWeight === pastMaxWeight) {
        // 2. Check for Reps / Time Record at same max weight / bodyweight
        if (currentMaxRepsAtMaxWeight > pastMaxRepsAtCurrentWeight && pastMaxRepsAtCurrentWeight > 0) {
          const diff = currentMaxRepsAtMaxWeight - pastMaxRepsAtCurrentWeight;
          const achievementType = isTimed ? 'max_time' : 'max_reps';
          const unit = isTimed ? 'sek' : 'reps';

          let title = 'Nytt Reps-rekord';
          if (isTimed) {
            title = currentMaxWeight > 0 ? `Nytt Tidsrekord (${currentMaxWeight} kg)` : 'Nytt Tidsrekord';
          } else if (isBodyweight && currentMaxWeight === 0) {
            title = 'Nytt Reps-rekord (kroppsvikt)';
          } else if (currentMaxWeight > 0) {
            title = `Nytt Reps-rekord (${currentMaxWeight} kg)`;
          }

          achievements.push({
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            type: achievementType,
            title,
            currentValue: currentMaxRepsAtMaxWeight,
            previousValue: pastMaxRepsAtCurrentWeight,
            diff: diff > 0 ? diff : undefined,
            unit,
            weightContext: currentMaxWeight,
          });
        }
      } else if (currentMaxWeight < pastMaxWeight && currentMaxWeight === 0) {
        // 3. Check for bodyweight reps/time PB even if previously done weighted
        if (currentMaxRepsAtMaxWeight > pastMaxRepsAtCurrentWeight && pastMaxRepsAtCurrentWeight > 0) {
          const diff = currentMaxRepsAtMaxWeight - pastMaxRepsAtCurrentWeight;
          const achievementType = isTimed ? 'max_time' : 'max_reps';
          const unit = isTimed ? 'sek' : 'reps';
          const title = isTimed ? 'Nytt Tidsrekord' : 'Nytt Reps-rekord (kroppsvikt)';

          achievements.push({
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            type: achievementType,
            title,
            currentValue: currentMaxRepsAtMaxWeight,
            previousValue: pastMaxRepsAtCurrentWeight,
            diff: diff > 0 ? diff : undefined,
            unit,
            weightContext: 0,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error detecting workout records:', err);
  }

  return achievements;
}
