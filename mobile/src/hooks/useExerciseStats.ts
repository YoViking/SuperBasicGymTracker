import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';

export interface ExerciseChartData {
  value: number; // Max Estimated 1RM for the week/date
  label: string; // "v18" or Date string
  dataPointText: string; // The value string to show above point
}

export interface ExerciseStats {
  currentPB: number;
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
    chartData: [],
    loading: true,
  });

  const fetchStats = async () => {
    if (!exerciseName) return;

    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        .order('workout_logs(created_at)', { ascending: true }); // Make sure it's ordered by date

      if (logsErr) throw logsErr;

      let maxWeight = 0;
      const weeklyMax1RM = new Map<string, number>();

      // We might have multiple logs per workout, or multiple workouts per week
      logsData.forEach((log: any) => {
        const weight = log.weight || 0;
        const reps = log.reps || 0;

        if (weight > maxWeight) {
          maxWeight = weight;
        }

        // Calculate Estimated 1RM using Epley formula: W * (1 + R/30)
        // If reps is 1, 1RM is just weight. 
        const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);

        const date = new Date(log.workout_logs.created_at);
        const weekStr = `v${getWeekNumber(date)}`;

        const currentWeeklyMax = weeklyMax1RM.get(weekStr) || 0;
        if (e1rm > currentWeeklyMax) {
          weeklyMax1RM.set(weekStr, e1rm);
        }
      });

      // Prepare chart data
      const chartData: ExerciseChartData[] = Array.from(weeklyMax1RM.entries()).map(([label, max1rm]) => ({
        value: Number(max1rm.toFixed(1)),
        label,
        dataPointText: Number(max1rm.toFixed(1)).toString()
      }));

      // Sort by the original chronological order
      // (Since we iterated chronologically and used a Map, it generally preserves insertion order,
      // but let's make sure it's correct. Map keys follow insertion order).

      setStats({
        currentPB: maxWeight,
        chartData,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching exercise stats:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [exerciseName])
  );

  return stats;
}
