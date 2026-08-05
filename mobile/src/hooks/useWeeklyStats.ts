import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { WorkoutLog } from '../types';

export interface WeeklyStats {
  activeWorkoutsCount: number;
  completedThisWeekCount: number;
  completedPreviousWeekCount: number;
  daysCompleted: boolean[]; // Mon - Sun
  currentWeekVolume: number;
  currentWeekTime: number; // in seconds
  previousWeekVolume: number;
  previousWeekTime: number; // in seconds
  volumeTrend: { value: number; label: string }[]; // Last 5 weeks, oldest first
  loading: boolean;
}

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export function useWeeklyStats() {
  const [stats, setStats] = useState<WeeklyStats>({
    activeWorkoutsCount: 0,
    completedThisWeekCount: 0,
    completedPreviousWeekCount: 0,
    daysCompleted: Array(7).fill(false),
    currentWeekVolume: 0,
    currentWeekTime: 0,
    previousWeekVolume: 0,
    previousWeekTime: 0,
    volumeTrend: [],
    loading: true,
  });

  const fetchStats = async () => {
    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch active workouts in the currently used program/folder
      let activeWorkoutsCount = 0;
      let currentFolderId: string | null = null;

      // Find the most recently logged workout to see what folder it belongs to
      const { data: recentLogs, error: recentLogsErr } = await supabase
        .from('workout_logs')
        .select('workout_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!recentLogsErr && recentLogs && recentLogs.length > 0 && recentLogs[0].workout_id) {
        const { data: workoutData } = await supabase
          .from('workouts')
          .select('folder_id')
          .eq('id', recentLogs[0].workout_id)
          .maybeSingle();

        if (workoutData && workoutData.folder_id) {
          currentFolderId = workoutData.folder_id;
        }
      }

      // Fallback if no logs: Find the most recently created folder
      if (!currentFolderId) {
        const { data: recentFolders } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (recentFolders && recentFolders.length > 0) {
          currentFolderId = recentFolders[0].id;
        }
      }

      // If we found a folder, count workouts inside it
      if (currentFolderId) {
        const { data: folderWorkouts, error: folderWorkoutsErr } = await supabase
          .from('workouts')
          .select('id')
          .eq('user_id', user.id)
          .eq('folder_id', currentFolderId)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .or('is_archived.is.null,is_archived.eq.false');

        if (!folderWorkoutsErr && folderWorkouts) {
          activeWorkoutsCount = folderWorkouts.length;
        }
      }

      // Fallback: If no folder workouts or no folder was found, count all active workouts
      if (activeWorkoutsCount === 0) {
        const { data: activeWorkouts, error: activeErr } = await supabase
          .from('workouts')
          .select('id')
          .eq('user_id', user.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .or('is_archived.is.null,is_archived.eq.false');

        if (activeErr) throw activeErr;
        activeWorkoutsCount = activeWorkouts ? activeWorkouts.length : 0;
      }


      // 2. Fetch workout logs for the last 5 weeks
      const today = new Date();
      const startOfCurrentWeek = getStartOfWeek(today);
      const startOf5WeeksAgo = new Date(startOfCurrentWeek);
      startOf5WeeksAgo.setDate(startOf5WeeksAgo.getDate() - 4 * 7);

      const { data: logsData, error: logsErr } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOf5WeeksAgo.toISOString())
        .order('created_at', { ascending: true });

      if (logsErr) throw logsErr;
      const logs = logsData as WorkoutLog[];

      // Variables to populate
      let currentWeekVolume = 0;
      let currentWeekTime = 0;
      let completedThisWeekCount = 0;
      let previousWeekVolume = 0;
      let previousWeekTime = 0;
      let completedPreviousWeekCount = 0;
      const daysCompleted = Array(7).fill(false);
      
      const weeklyVolumes = [0, 0, 0, 0, 0]; // 0 is oldest, 4 is current

      logs.forEach((log) => {
        const completedDate = new Date(log.created_at);
        const diffTime = completedDate.getTime() - startOf5WeeksAgo.getTime();
        const weekIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

        if (weekIndex >= 0 && weekIndex <= 4) {
          weeklyVolumes[weekIndex] += log.total_volume || 0;
        }

        if (weekIndex === 4) {
          // Current week
          currentWeekVolume += log.total_volume || 0;
          currentWeekTime += log.duration_seconds || 0;
          completedThisWeekCount += 1;

          // Figure out which day it was (0 = Monday, 6 = Sunday)
          let dayOfWeek = completedDate.getDay();
          // JS getDay: 0=Sun, 1=Mon. We want 0=Mon, 6=Sun
          dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          daysCompleted[dayOfWeek] = true;
        } else if (weekIndex === 3) {
          // Previous week
          previousWeekVolume += log.total_volume || 0;
          previousWeekTime += log.duration_seconds || 0;
          completedPreviousWeekCount += 1;
        }
      });

      const trend = weeklyVolumes.map((vol, i) => {
        const d = new Date(startOf5WeeksAgo);
        d.setDate(d.getDate() + i * 7);
        return {
          value: vol,
          label: `v.${getWeekNumber(d)}`,
        };
      });

      setStats({
        activeWorkoutsCount,
        completedThisWeekCount,
        completedPreviousWeekCount,
        daysCompleted,
        currentWeekVolume,
        currentWeekTime,
        previousWeekVolume,
        previousWeekTime,
        volumeTrend: trend,
        loading: false,
      });

    } catch (e) {
      console.error('Error fetching stats:', e);
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

// Helper to get ISO week number
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return weekNo;
}
