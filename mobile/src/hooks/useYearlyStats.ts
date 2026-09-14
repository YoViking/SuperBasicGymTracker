import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { cacheService } from '../services/cacheService';
import { calculateMuscleDistribution } from '../utils/muscleHierarchy';

export interface BarChartData {
  value: number; // Volume
  label: string; // Month name
  frontColor: string;
  barWidth?: number; // Dynamic width based on workouts
  spacing?: number; // Needed to center bars if widths are different
}

export interface PieChartData {
  value: number;
  color: string;
  text: string;
}

export interface YearlyStats {
  year: string;
  barChartData: BarChartData[];
  totalTimeSeconds: number;
  totalWorkouts: number;
  totalVolume: number;
  pieChartData: PieChartData[];
  loading: boolean;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export function useYearlyStats() {
  const [stats, setStats] = useState<YearlyStats>({
    year: new Date().getFullYear().toString(),
    barChartData: [],
    totalTimeSeconds: 0,
    totalWorkouts: 0,
    totalVolume: 0,
    pieChartData: [],
    loading: true,
  });

  const fetchStats = async (force = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      if (!force) {
        const memCached = cacheService.get<Omit<YearlyStats, 'loading'>>('yearly_stats', userId);
        if (memCached) {
          setStats({ ...memCached, loading: false });
          return;
        }

        const asyncCached = await cacheService.getAsync<Omit<YearlyStats, 'loading'>>('yearly_stats', userId);
        if (asyncCached) {
          setStats({ ...asyncCached, loading: false });
          return;
        }
      }

      setStats(prev => (prev.barChartData.length > 0 ? prev : { ...prev, loading: true }));

      const now = new Date();
      const currentYear = now.getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      
      const { data: logsData, error: logsErr } = await supabase
        .from('workout_logs')
        .select('id, created_at, duration_seconds, total_volume')
        .eq('user_id', user.id)
        .gte('created_at', startOfYear.toISOString());

      if (logsErr) throw logsErr;

      let totalDuration = 0;
      let totalVolume = 0;
      let totalWorkouts = logsData.length;
      
      // Initialize monthly data
      const monthVolumes = new Array(12).fill(0);
      const monthWorkoutCounts = new Array(12).fill(0);

      const logIds = logsData.map(log => log.id);

      // Process logs for averages and heatmap
      logsData.forEach(log => {
        totalDuration += log.duration_seconds || 0;
        totalVolume += log.total_volume || 0;

        const date = new Date(log.created_at);
        const monthIndex = date.getMonth(); // 0-11
        
        monthVolumes[monthIndex] += log.total_volume || 0;
        monthWorkoutCounts[monthIndex] += 1;
      });

      // Calculate max workouts for bar width calculation
      const maxWorkouts = Math.max(...monthWorkoutCounts, 1); // avoid div by 0
      const MIN_BAR_WIDTH = 4;
      const MAX_BAR_WIDTH = 16;
      const BASE_SPACING = 12; // Base spacing when widths vary

      const barChartData: BarChartData[] = MONTH_LABELS.map((label, index) => {
        const count = monthWorkoutCounts[index];
        // Calculate dynamic width based on ratio of workouts
        const widthRatio = count / maxWorkouts;
        const width = count === 0 ? MIN_BAR_WIDTH : MIN_BAR_WIDTH + (MAX_BAR_WIDTH - MIN_BAR_WIDTH) * widthRatio;
        
        // Adjust spacing to keep bars visually centered if their width changes
        // Normal spacing + half of the missing width from max width
        const spacingAdjust = (MAX_BAR_WIDTH - width) / 2;

        return {
          value: monthVolumes[index],
          label,
          frontColor: '#A3E635', // Lime color for all bars
          barWidth: width,
          spacing: BASE_SPACING + spacingAdjust * 2, // Multiply by 2 to compensate for both sides
        };
      });

      // Now fetch exercise logs for the pie chart using an indexed inner join (avoids HTTP 414 URI Too Long)
      let pieChartData: PieChartData[] = [];
      
      if (totalWorkouts > 0) {
        const { data: exLogs, error: exLogsErr } = await supabase
          .from('workout_exercise_logs')
          .select(`
            muscle_group,
            sets,
            workout_logs!inner(user_id, created_at)
          `)
          .eq('workout_logs.user_id', user.id)
          .gte('workout_logs.created_at', startOfYear.toISOString());

        if (exLogsErr) throw exLogsErr;

        pieChartData = calculateMuscleDistribution(exLogs || []);
      }

      const result: Omit<YearlyStats, 'loading'> = {
        year: currentYear.toString(),
        barChartData,
        totalTimeSeconds: totalDuration,
        totalWorkouts,
        totalVolume,
        pieChartData,
      };

      await cacheService.set('yearly_stats', userId, result);

      setStats({
        ...result,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching yearly stats:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const unsub = cacheService.subscribe((category) => {
      if (category === 'yearly_stats' || category === 'workouts' || category === 'all') {
        fetchStats(true);
      }
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats(false);
    }, [])
  );

  return stats;
}
