import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Workout, Folder, ExerciseLibrary } from '../types';

export interface PersonalBestAchievement {
  exerciseName: string;
  currentWeight: number;
  increase: number;
  type?: 'max_weight' | 'max_reps';
  reps?: number;
  unit: string;
  achievedAt: string;
  dateDisplay: string;
}

export function formatRecordDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    
    // Check if same calendar day
    const isToday = d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) return 'Idag';

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return 'Igår';

    const day = d.getDate();
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const month = months[d.getMonth()] || '';
    const isThisYear = d.getFullYear() === now.getFullYear();
    
    return isThisYear ? `${day} ${month}` : `${day} ${month} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
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

      // 2. Fetch Latest Active Workouts with exercise info based on recently logged workouts
      let latestWorkouts: Workout[] = [];
      let recentLogWorkoutIds: string[] = [];

      if (user) {
        // Fetch recently logged workouts
        const { data: recentLogs, error: recentLogsErr } = await supabase
          .from('workout_logs')
          .select('workout_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!recentLogsErr && recentLogs) {
          const ids = recentLogs
            .map((log) => log.workout_id)
            .filter((id): id is string => !!id);
          recentLogWorkoutIds = Array.from(new Set(ids));
        }

        if (recentLogWorkoutIds.length > 0) {
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
            .in('id', recentLogWorkoutIds.slice(0, 2))
            .or('is_deleted.is.null,is_deleted.eq.false');

          if (!workoutsErr && workoutsData) {
            // Sort to match the order in recentLogWorkoutIds (most recently completed first)
            latestWorkouts = workoutsData.sort((a, b) => {
              const indexA = recentLogWorkoutIds.indexOf(a.id);
              const indexB = recentLogWorkoutIds.indexOf(b.id);
              return indexA - indexB;
            });
          }
        }

        // Fallback: If fewer than 2 recent workouts, fetch the latest created ones for this user
        if (latestWorkouts.length < 2) {
          const limitCount = 2 - latestWorkouts.length;
          const { data: fallbackData, error: fallbackErr } = await supabase
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
            .eq('user_id', user.id)
            .or('is_deleted.is.null,is_deleted.eq.false')
            .order('created_at', { ascending: false })
            .limit(10); // Fetch a few to filter duplicates in memory

          if (!fallbackErr && fallbackData) {
            const excludeIds = new Set(latestWorkouts.map((w) => w.id));
            const filteredFallback = fallbackData
              .filter((w) => !excludeIds.has(w.id))
              .slice(0, limitCount);
            latestWorkouts = [...latestWorkouts, ...filteredFallback];
          }
        }
      }

      // 1. Fetch Latest Program Folder (based on the most recently trained workout)
      let latestFolder: Folder | null = null;
      if (user) {
        // First, try to get the folder of the most recently trained workout
        if (latestWorkouts.length > 0) {
          const firstWorkout = latestWorkouts[0];
          if (firstWorkout.folder_id) {
            const { data: folderData, error: folderErr } = await supabase
              .from('folders')
              .select('*')
              .eq('id', firstWorkout.folder_id)
              .single();

            if (!folderErr && folderData) {
              latestFolder = folderData;
            }
          }
        }

        // Fallback: If no folder found from recent workouts, get the most recently created folder
        if (!latestFolder) {
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
      }

      // 3. Fetch Personal Best Achievements (Chronological progression to detect genuine PR events)
      const personalBests: PersonalBestAchievement[] = [];
      if (user) {
        const { data: logsData, error: logsErr } = await supabase
          .from('workout_exercise_logs')
          .select(`
            weight,
            reps,
            exercise_name,
            workout_logs!inner(created_at, user_id)
          `)
          .eq('workout_logs.user_id', user.id)
          .gt('weight', 0)
          .order('workout_logs(created_at)', { ascending: true });

        if (!logsErr && logsData) {
          // Track highest weight and reps achieved up to each workout session
          const historyMap = new Map<string, { maxWeight: number; maxRepsAtMax: number }>();
          const allPBEvents: PersonalBestAchievement[] = [];

          logsData.forEach((log: any) => {
            const name = log.exercise_name;
            const weight = Number(log.weight) || 0;
            const reps = Number(log.reps) || 0;
            const createdAt = log.workout_logs?.created_at;
            if (!name || weight <= 0 || !createdAt) return;

            const existing = historyMap.get(name);
            if (!existing) {
              // Baseline establishment for this exercise
              historyMap.set(name, { maxWeight: weight, maxRepsAtMax: reps });
            } else {
              if (weight > existing.maxWeight) {
                // Strict Max Weight PB!
                const increase = Number((weight - existing.maxWeight).toFixed(1));
                allPBEvents.push({
                  exerciseName: name,
                  currentWeight: weight,
                  increase,
                  type: 'max_weight',
                  unit: 'kg',
                  achievedAt: createdAt,
                  dateDisplay: formatRecordDate(createdAt),
                });
                historyMap.set(name, { maxWeight: weight, maxRepsAtMax: reps });
              } else if (weight === existing.maxWeight && reps > existing.maxRepsAtMax && existing.maxRepsAtMax > 0) {
                // Reps PB at same max weight!
                const increase = reps - existing.maxRepsAtMax;
                allPBEvents.push({
                  exerciseName: name,
                  currentWeight: weight,
                  increase,
                  reps,
                  type: 'max_reps',
                  unit: 'reps',
                  achievedAt: createdAt,
                  dateDisplay: formatRecordDate(createdAt),
                });
                historyMap.set(name, { maxWeight: weight, maxRepsAtMax: reps });
              }
            }
          });

          // Sort by most recently achieved PRs first
          allPBEvents.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());

          // Show the latest distinct PRs
          const seenExercises = new Set<string>();
          for (const pr of allPBEvents) {
            if (!seenExercises.has(pr.exerciseName)) {
              seenExercises.add(pr.exerciseName);
              personalBests.push(pr);
            }
            if (personalBests.length >= 5) break;
          }
        }
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

        if (dailyExercise) {
          const { count } = await supabase
            .from('workout_exercise_logs')
            .select('*', { count: 'exact', head: true })
            .eq('exercise_name', dailyExercise.name);

          dailyExercise = {
            ...dailyExercise,
            completions_count: Math.max(dailyExercise.completions_count || 0, count || 0),
          };
        }
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
