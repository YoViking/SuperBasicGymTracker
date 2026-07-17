import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';

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

// Map muscle groups to colors
const COLORS: Record<string, string> = {
  Chest: '#A3E635',     // Lime
  Back: '#3B82F6',      // Blue
  Legs: '#8B5CF6',      // Purple
  Arms: '#EF4444',      // Red
  Shoulders: '#F59E0B', // Orange
  Core: '#10B981',      // Emerald
  Other: '#6B7280',     // Gray
};

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

  const fetchStats = async () => {
    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

        const dateStr = new Date(log.created_at).toISOString().split('T')[0];
        const currentCount = heatmapMap.get(dateStr) || 0;
        heatmapMap.set(dateStr, currentCount + (log.total_volume || 0));
      });

      const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries()).map(([date, count]) => ({
        date,
        count
      }));

      const avgTime = logsData.length > 0 ? totalDuration / logsData.length : 0;
      const avgVol = logsData.length > 0 ? totalVolume / logsData.length : 0;

      // Now fetch exercise logs for the pie chart
      let pieChartData: PieChartData[] = [];
      
      if (logIds.length > 0) {
        const { data: exLogs, error: exLogsErr } = await supabase
          .from('workout_exercise_logs')
          .select('muscle_group, sets')
          .in('workout_log_id', logIds);

        if (exLogsErr) throw exLogsErr;

        const muscleCounts: Record<string, number> = {};
        const swedishToEnglish: Record<string, string> = {
          'Bröst': 'Chest',
          'Rygg': 'Back',
          'Ben': 'Legs',
          'Rumpa': 'Legs', // Group glutes into Legs for simplicity
          'Armar': 'Arms',
          'Arm': 'Arms',
          'Axlar': 'Shoulders',
          'Axel': 'Shoulders',
          'Mage': 'Core',
        };

        exLogs.forEach(ex => {
          let mg = ex.muscle_group || 'Other';
          // Translate to English if it's in the dictionary
          mg = swedishToEnglish[mg] || mg;
          muscleCounts[mg] = (muscleCounts[mg] || 0) + (ex.sets || 0);
        });

        pieChartData = Object.entries(muscleCounts)
          .map(([mg, count]) => ({
            value: count,
            text: mg,
            color: COLORS[mg] || COLORS['Other'],
          }))
          .sort((a, b) => b.value - a.value);
      }

      setStats({
        monthName: getMonthName(now),
        heatmapData,
        averageTimeSeconds: avgTime,
        averageVolume: avgVol,
        pieChartData,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching monthly stats:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  return stats;
}
