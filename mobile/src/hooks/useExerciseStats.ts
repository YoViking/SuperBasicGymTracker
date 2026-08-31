import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { cacheService } from '../services/cacheService';
import { isTimedExercise, isBodyweightExercise, getBodyweightMultiplier, getUserBodyWeight } from '../utils/volume';

export interface ExerciseChartData {
  value: number; // Max Estimated 1RM (kg) or Max time (seconds) for the week
  label: string; // "v18" or Date string
  dataPointText: string; // The value string to show above point
}

export interface ExerciseStats {
  currentPB: number;
  currentPBText?: string;
  unit: string;
  isTimed: boolean;
  isBodyweight: boolean;
  metricType: '1rm' | 'time' | 'reps';
  chartData: ExerciseChartData[];
  loading: boolean;
}

// Function to get ISO week number
const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export function useExerciseStats(exerciseName: string) {
  const [stats, setStats] = useState<ExerciseStats>({
    currentPB: 0,
    currentPBText: '',
    unit: 'kg',
    isTimed: false,
    isBodyweight: false,
    metricType: '1rm',
    chartData: [],
    loading: true,
  });

  const fetchStats = async (force = false) => {
    if (!exerciseName) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;
      const cacheKey = `exercise_stats_${exerciseName}`;

      if (!force) {
        const memCached = cacheService.get<Omit<ExerciseStats, 'loading'>>(cacheKey, userId);
        if (memCached) {
          setStats({ ...memCached, loading: false });
          return;
        }

        const asyncCached = await cacheService.getAsync<Omit<ExerciseStats, 'loading'>>(cacheKey, userId);
        if (asyncCached) {
          setStats({ ...asyncCached, loading: false });
          return;
        }
      }

      setStats(prev => (prev.chartData.length > 0 ? prev : { ...prev, loading: true }));

      // Fetch all exercise logs for this exercise, joining with workout_logs to get the date
      const { data: logsData, error: logsErr } = await supabase
        .from('workout_exercise_logs')
        .select(`
          weight,
          reps,
          workout_logs!inner(created_at, user_id)
        `)
        .eq('exercise_name', exerciseName)
        .eq('workout_logs.user_id', user.id)
        .order('workout_logs(created_at)', { ascending: true });

      if (logsErr) throw logsErr;

      const isTimed = isTimedExercise(exerciseName);
      const isBodyweight = isBodyweightExercise(exerciseName);
      const multiplier = getBodyweightMultiplier(exerciseName);
      const userWeight = await getUserBodyWeight();

      let maxWeight = 0;
      let maxReps = 0;
      const weeklyMaxProgression = new Map<string, number>();

      if (logsData && logsData.length > 0) {
        logsData.forEach((log: any) => {
          const weight = Number(log.weight) || 0;
          const reps = Number(log.reps) || 0;
          if (reps <= 0 && weight <= 0) return;

          if (weight > maxWeight) maxWeight = weight;
          if (reps > maxReps) maxReps = reps;

          let metricValue = 0;
          if (isTimed) {
            // Progression value is duration in seconds
            metricValue = reps;
          } else if (isBodyweight) {
            // Calculate effective weight including bodyweight percentage
            const effectiveWeight = (userWeight * multiplier) + weight;
            metricValue = reps === 1 ? effectiveWeight : effectiveWeight * (1 + reps / 30);
          } else {
            // Standard 1RM using Epley formula: W * (1 + R/30)
            metricValue = reps === 1 ? weight : weight * (1 + reps / 30);
          }

          const date = new Date(log.workout_logs.created_at);
          const weekStr = `v${getWeekNumber(date)}`;

          const currentWeeklyMax = weeklyMaxProgression.get(weekStr) || 0;
          if (metricValue > currentWeeklyMax) {
            weeklyMaxProgression.set(weekStr, metricValue);
          }
        });
      }

      // Prepare chart data
      const chartData: ExerciseChartData[] = Array.from(weeklyMaxProgression.entries()).map(([label, val]) => ({
        value: Number(val.toFixed(1)),
        label,
        dataPointText: Number(val.toFixed(1)).toString()
      }));

      let currentPB = 0;
      let currentPBText = '';
      let unit = 'kg';
      let metricType: '1rm' | 'time' | 'reps' = '1rm';

      if (isTimed) {
        unit = 'sek';
        metricType = 'time';
        currentPB = maxReps;
        currentPBText = maxWeight > 0 ? `${maxReps} sek (+${maxWeight} kg)` : `${maxReps} sek`;
      } else if (isBodyweight) {
        metricType = '1rm';
        unit = 'kg';
        if (maxWeight > 0) {
          currentPB = maxWeight;
          currentPBText = `${maxReps} reps (+${maxWeight} kg)`;
        } else {
          currentPB = maxReps;
          currentPBText = `${maxReps} reps (${Math.round(userWeight * multiplier)} kg kroppsvikt)`;
        }
      } else {
        unit = 'kg';
        metricType = '1rm';
        currentPB = maxWeight;
        currentPBText = `${maxWeight} kg`;
      }

      const result: Omit<ExerciseStats, 'loading'> = {
        currentPB,
        currentPBText,
        unit,
        isTimed,
        isBodyweight,
        metricType,
        chartData,
      };

      await cacheService.set(cacheKey, userId, result);

      setStats({
        ...result,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching exercise stats:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const unsub = cacheService.subscribe((category) => {
      if (category === 'exercise_stats' || category === 'workouts' || category === 'all') {
        fetchStats(true);
      }
    });
    return unsub;
  }, [exerciseName]);

  useFocusEffect(
    useCallback(() => {
      fetchStats(false);
    }, [exerciseName])
  );

  return stats;
}
