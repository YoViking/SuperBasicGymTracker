import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Workout, Folder, ExerciseLibrary } from '../types';

export interface PersonalBestAchievement {
  exerciseName: string;
  currentWeight: number;
  increase: number;
}

export interface HomeData {
  personalBests: PersonalBestAchievement[];
  latestWorkouts: Workout[];
  latestFolder: Folder | null;
  dailyExercise: ExerciseLibrary | null;
  loading: boolean;
}

export function useHomeData() {
  const [data, setData] = useState<HomeData>({
    personalBests: [],
    latestWorkouts: [],
    latestFolder: null,
    dailyExercise: null,
    loading: true,
  });

  const fetchHomeData = async () => {
    try {
      setData((prev) => ({ ...prev, loading: true }));
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Fetch Latest Program Folder
      let latestFolder: Folder | null = null;
      if (user) {
        const { data: folderData, error: folderErr } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!folderErr && folderData && folderData.length > 0) {
          latestFolder = folderData[0];
        }
      }

      // 2. Fetch Latest Active Workouts with exercise info
      let latestWorkouts: Workout[] = [];
      const { data: workoutsData, error: workoutsErr } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            order_index,
            created_at,
            exercise:exercise_library (
              gifUrl,
              muscle_group
            )
          )
        `)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false })
        .limit(2);

      if (!workoutsErr && workoutsData) {
        latestWorkouts = workoutsData;
      }

      // 3. Fetch Personal Best Achievements
      const personalBests: PersonalBestAchievement[] = [];
      if (user) {
        const { data: logsData, error: logsErr } = await supabase
          .from('workout_exercise_logs')
          .select(`
            weight,
            exercise_name,
            workout_logs!inner(created_at, user_id)
          `)
          .eq('workout_logs.user_id', user.id)
          .gt('weight', 0)
          .order('workout_logs(created_at)', { ascending: true });

        if (!logsErr && logsData) {
          // Group by exercise to track max weight progression
          const exerciseProgression = new Map<string, { maxBefore: number; currentMax: number }>();

          logsData.forEach((log: any) => {
            const name = log.exercise_name;
            const weight = Number(log.weight) || 0;
            if (!name || weight <= 0) return;

            const existing = exerciseProgression.get(name);
            if (!existing) {
              exerciseProgression.set(name, { maxBefore: weight, currentMax: weight });
            } else {
              if (weight > existing.currentMax) {
                exerciseProgression.set(name, {
                  maxBefore: existing.currentMax,
                  currentMax: weight,
                });
              }
            }
          });

          exerciseProgression.forEach((val, name) => {
            const increase = val.currentMax - val.maxBefore;
            if (increase > 0) {
              personalBests.push({
                exerciseName: name,
                currentWeight: val.currentMax,
                increase,
              });
            }
          });
        }
      }

      // Fallback sample PRs if user doesn't have logged PR increases yet
      if (personalBests.length === 0) {
        personalBests.push(
          { exerciseName: 'Leg Extensions', currentWeight: 70, increase: 4 },
          { exerciseName: 'Romanian Deadlift', currentWeight: 80, increase: 5 }
        );
      }

      // 4. Fetch Daily Randomized Exercise from exercise_library
      let dailyExercise: ExerciseLibrary | null = null;
      const { data: exercisesData, error: exercisesErr } = await supabase
        .from('exercise_library')
        .select('*')
        .limit(200);

      if (!exercisesErr && exercisesData && exercisesData.length > 0) {
        // Use today's date string as a seed so the exercise stays consistent for the day
        const todayStr = new Date().toISOString().slice(0, 10);
        let charSum = 0;
        for (let i = 0; i < todayStr.length; i++) {
          charSum += todayStr.charCodeAt(i);
        }
        const randomIndex = charSum % exercisesData.length;
        dailyExercise = exercisesData[randomIndex];
      }

      setData({
        personalBests: personalBests.slice(0, 5),
        latestWorkouts,
        latestFolder,
        dailyExercise,
        loading: false,
      });
    } catch (e) {
      console.error('Error fetching home data:', e);
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, [])
  );

  return { ...data, refetch: fetchHomeData };
}
