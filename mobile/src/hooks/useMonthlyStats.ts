import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { cacheService } from '../services/cacheService';
import { calculateMuscleDistribution } from '../utils/muscleHierarchy';

export interface HeatmapDay {
  date: string;
  count: number; // For us, this will be volume to determine intensity
}

export interface PieChartData {
  value: number;
  color: string;
  text: string;
}

export interface MonthlyStats {
  monthName: string;
  heatmapData: HeatmapDay[];
  averageTimeSeconds: number;
  averageVolume: number;
  pieChartData: PieChartData[];
  loading: boolean;
}

const getMonthName = (date: Date) => {
  const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
  return months[date.getMonth()];
};

export function useMonthlyStats() {
  const [stats, setStats] = useState<MonthlyStats>({
    monthName: getMonthName(new Date()),
    heatmapData: [],
    averageTimeSeconds: 0,
    averageVolume: 0,
    pieChartData: [],
    loading: true,
  });

  const fetchStats = async (force = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      if (!force) {
        const memCached = cacheService.get<Omit<MonthlyStats, 'loading'>>('monthly_stats', userId);
        if (memCached) {
          setStats({ ...memCached, loading: false });
          return;
        }

        const asyncCached = await cacheService.getAsync<Omit<MonthlyStats, 'loading'>>('monthly_stats', userId);
        if (asyncCached) {
          setStats({ ...asyncCached, loading: false });
          return;
        }
      }

      setStats(prev => (prev.heatmapData.length > 0 ? prev : { ...prev, loading: true }));

      const now = new Date();
      // Start of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      // We also need the start of the week for the first day of the month so the heatmap pads correctly
      // But react-native-gifted-charts HeatMap handles dates directly, we just provide the data array for the days.
      // Wait, gifted-charts heatmap expects an array of {date: 'YYYY-MM-DD', count: number}.
      
      const { data: logsData, error: logsErr } = await supabase
        .from('workout_logs')
        .select('id, created_at, duration_seconds, total_volume')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (logsErr) throw logsErr;

      let totalDuration = 0;
      let totalVolume = 0;
      const heatmapMap = new Map<string, number>();
      
      const logIds = logsData.map(log => log.id);

      // Process logs for averages and heatmap
      logsData.forEach(log => {
        totalDuration += log.duration_seconds || 0;
        totalVolume += log.total_volume || 0;

        const date = new Date(log.created_at);
        const yearStr = date.getFullYear();
        const monthStr = String(date.getMonth() + 1).padStart(2, '0');
        const dayStr = String(date.getDate()).padStart(2, '0');
        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
        const currentCount = heatmapMap.get(dateStr) || 0;
        heatmapMap.set(dateStr, currentCount + (log.total_volume || 0));
      });

      const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries()).map(([date, count]) => ({
        date,
        count
      }));

      const avgTime = logsData.length > 0 ? totalDuration / logsData.length : 0;
      const avgVol = logsData.length > 0 ? totalVolume / logsData.length : 0;

      // Now fetch exercise logs for the pie chart using an indexed inner join (avoids HTTP 414 URI Too Long)
      let pieChartData: PieChartData[] = [];
      
      if (logsData.length > 0) {
        const { data: exLogs, error: exLogsErr } = await supabase
          .from('workout_exercise_logs')
          .select(`
            muscle_group,
            sets,
            workout_logs!inner(user_id, created_at)
          `)
          .eq('workout_logs.user_id', user.id)
          .gte('workout_logs.created_at', startOfMonth.toISOString());

        if (exLogsErr) throw exLogsErr;

        pieChartData = calculateMuscleDistribution(exLogs || []);
      }

      const result: Omit<MonthlyStats, 'loading'> = {
        monthName: getMonthName(now),
        heatmapData,
        averageTimeSeconds: avgTime,
        averageVolume: avgVol,
        pieChartData,
      };

      await cacheService.set('monthly_stats', userId, result);

      setStats({
        ...result,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching monthly stats:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const unsub = cacheService.subscribe((category) => {
      if (category === 'monthly_stats' || category === 'workouts' || category === 'all') {
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
