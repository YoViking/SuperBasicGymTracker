import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, Platform, ToastAndroid } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Workout } from '../types';
import { calculateSetVolume, getUserBodyWeight } from '../utils/volume';
import { detectWorkoutRecords } from '../services/recordDetector';
import { cacheService } from '../services/cacheService';
import { WorkoutSummaryData } from '../components/WorkoutSummaryModal';

export interface FetchedWorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
  is_done: boolean;
  order_index: number;
  custom_name?: string;
  exercise: {
    name: string;
    muscle_group: string;
    gifUrl?: string;
    equipment?: string;
  };
}

export interface GroupedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  equipment?: string;
  gifUrl?: string;
  sets: FetchedWorkoutExercise[];
  order_index: number;
}

interface WorkoutSessionContextType {
  activeWorkout: Workout | null;
  groupedExercises: GroupedExercise[];
  activeExerciseId: string | null;
  activeExercise: GroupedExercise | null;
  isPlayerExpanded: boolean;
  isWorkoutActive: boolean;
  workoutTimeElapsed: number;
  isSaving: boolean;
  summaryData: WorkoutSummaryData | null;
  summaryModalVisible: boolean;
  optionsModalVisible: boolean;
  optionsExerciseId: string | null;
  optionsWorkoutId: string | null;
  progressPercentage: number;
  startWorkout: (workout: Workout, exercises: GroupedExercise[], initialExerciseId?: string) => void;
  setGroupedExercises: React.Dispatch<React.SetStateAction<GroupedExercise[]>>;
  setActiveExerciseId: (id: string | null) => void;
  setIsPlayerExpanded: (expanded: boolean) => void;
  setIsWorkoutActive: React.Dispatch<React.SetStateAction<boolean>>;
  handleNextExercise: () => void;
  handlePreviousExercise: () => void;
  toggleSetStatus: (setId: string, currentStatus: boolean) => void;
  handleUpdateSet: (setId: string, reps: number, weight: number) => Promise<void>;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  openExerciseOptions: (exerciseId: string, workoutId?: string, muscleGroup?: string) => void;
  closeExerciseOptions: () => void;
  handleGoToExercise: () => void;
  handleChangeExercise: () => void;
  handleRemoveExerciseFromWorkout: () => Promise<void>;
  handleCloseSummary: () => void;
  refreshWorkoutExercises: (targetWorkoutId?: string, nextExerciseId?: string) => Promise<void>;
  workoutUpdateSeq: number;
  triggerWorkoutUpdate: () => void;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextType | undefined>(undefined);

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [groupedExercises, setGroupedExercises] = useState<GroupedExercise[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [workoutTimeElapsed, setWorkoutTimeElapsed] = useState(0);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [summaryData, setSummaryData] = useState<WorkoutSummaryData | null>(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [optionsExerciseId, setOptionsExerciseId] = useState<string | null>(null);
  const [optionsWorkoutId, setOptionsWorkoutId] = useState<string | null>(null);
  const [optionsMuscleGroup, setOptionsMuscleGroup] = useState<string | null>(null);
  const [workoutUpdateSeq, setWorkoutUpdateSeq] = useState(0);

  const triggerWorkoutUpdate = useCallback(() => {
    setWorkoutUpdateSeq(prev => prev + 1);
  }, []);

  // Timer reference & handling
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isWorkoutActive) {
      timerRef.current = setInterval(() => {
        setWorkoutTimeElapsed(prev => prev + 1);
      }, 1000) as unknown as ReturnType<typeof setInterval>;
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isWorkoutActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (backgroundTimeRef.current && isWorkoutActive) {
          const timeAway = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
          setWorkoutTimeElapsed(prev => prev + timeAway);
        }
        backgroundTimeRef.current = null;
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isWorkoutActive]);

  const activeExerciseIndex = useMemo(() => {
    return groupedExercises.findIndex(g => g.exerciseId === activeExerciseId);
  }, [groupedExercises, activeExerciseId]);

  const activeExercise = useMemo(() => {
    return activeExerciseIndex >= 0 ? groupedExercises[activeExerciseIndex] : null;
  }, [groupedExercises, activeExerciseIndex]);

  const progressPercentage = useMemo(() => {
    const totalSetsCount = groupedExercises.reduce((sum, group) => sum + group.sets.length, 0);
    const completedSetsCount = groupedExercises.reduce((sum, group) => sum + group.sets.filter(s => s.is_done).length, 0);
    return totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0;
  }, [groupedExercises]);

  const startWorkout = useCallback((workout: Workout, exercises: GroupedExercise[], initialExerciseId?: string) => {
    setActiveWorkout(workout);
    setGroupedExercises(exercises);
    const targetExerciseId = initialExerciseId || (exercises.length > 0 ? exercises[0].exerciseId : null);
    setActiveExerciseId(targetExerciseId);
    setWorkoutTimeElapsed(0);
    setIsWorkoutActive(true);
    setIsPlayerExpanded(true);
  }, []);

  const discardWorkout = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveWorkout(null);
    setGroupedExercises([]);
    setActiveExerciseId(null);
    setIsPlayerExpanded(false);
    setIsWorkoutActive(false);
    setWorkoutTimeElapsed(0);
    setOptionsModalVisible(false);
    setOptionsExerciseId(null);
    setOptionsWorkoutId(null);
  }, []);

  const handleNextExercise = useCallback(() => {
    if (activeExerciseIndex >= 0 && activeExerciseIndex < groupedExercises.length - 1) {
      setActiveExerciseId(groupedExercises[activeExerciseIndex + 1].exerciseId);
    }
  }, [activeExerciseIndex, groupedExercises]);

  const handlePreviousExercise = useCallback(() => {
    if (activeExerciseIndex > 0) {
      setActiveExerciseId(groupedExercises[activeExerciseIndex - 1].exerciseId);
    }
  }, [activeExerciseIndex, groupedExercises]);

  const toggleSetStatus = useCallback((setId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setGroupedExercises(prev => {
      const newState = prev.map(group => ({
        ...group,
        sets: group.sets.map(s => s.id === setId ? { ...s, is_done: newStatus } : s)
      }));

      const totalSets = newState.reduce((sum, g) => sum + g.sets.length, 0);
      const completedSets = newState.reduce((sum, g) => sum + g.sets.filter(s => s.is_done).length, 0);
      
      if (totalSets > 0 && completedSets === totalSets && newStatus === true) {
        setTimeout(() => {
          setIsPlayerExpanded(false);
          if (Platform.OS === 'android') {
            ToastAndroid.show('Alla övningar klara! Scrolla ner och Slutför för att spara.', ToastAndroid.LONG);
          }
        }, 600);
      }
      return newState;
    });
  }, []);

  const handleUpdateSet = useCallback(async (setId: string, reps: number, weight: number) => {
    setGroupedExercises(prev => prev.map(group => ({
      ...group,
      sets: group.sets.map(s => s.id === setId ? { ...s, reps, weight } : s)
    })));

    try {
      if (!setId.startsWith('tmp-')) {
        const { error } = await supabase
          .from('workout_exercises')
          .update({ reps, weight })
          .eq('id', setId);
        
        if (error) {
          console.error('Error updating set in database:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleUpdateSet:', error);
    }
  }, []);

  const refreshWorkoutExercises = useCallback(async (targetWorkoutId?: string, nextExerciseId?: string) => {
    const wId = targetWorkoutId || activeWorkout?.id;
    if (!wId) return;

    try {
      const { data: exercisesData, error } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercise:exercise_library(name, muscle_group, "gifUrl", equipment)
        `)
        .eq('workout_id', wId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Collect previously completed set IDs from current in-memory groupedExercises
      const doneSetIds = new Set<string>();
      groupedExercises.forEach(group => {
        group.sets.forEach(set => {
          if (set.is_done) {
            doneSetIds.add(set.id);
          }
        });
      });

      const groupedMap = new Map<string, GroupedExercise>();
      (exercisesData as any[]).forEach((row: FetchedWorkoutExercise) => {
        let group = groupedMap.get(row.exercise_id);
        if (!group) {
          group = {
            exerciseId: row.exercise_id,
            exerciseName: row.exercise.name,
            muscleGroup: row.exercise.muscle_group,
            equipment: row.exercise.equipment,
            gifUrl: row.exercise.gifUrl,
            sets: [],
            order_index: row.order_index ?? 0
          };
          groupedMap.set(row.exercise_id, group);
        }
        group.sets.push({
          ...row,
          is_done: doneSetIds.has(row.id) || row.is_done || false
        });
      });

      const grouped = Array.from(groupedMap.values());
      grouped.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      grouped.forEach(g => g.sets.sort((a, b) => a.sets - b.sets));

      setGroupedExercises(grouped);

      if (nextExerciseId) {
        setActiveExerciseId(nextExerciseId);
      } else if (activeExerciseId && !grouped.some(g => g.exerciseId === activeExerciseId)) {
        setActiveExerciseId(grouped.length > 0 ? grouped[0].exerciseId : null);
      }
    } catch (err) {
      console.error('Error refreshing workout exercises:', err);
    }
  }, [activeWorkout?.id, groupedExercises, activeExerciseId]);

  const openExerciseOptions = useCallback((exerciseId: string, workoutId?: string, muscleGroup?: string) => {
    setOptionsExerciseId(exerciseId);
    setOptionsWorkoutId(workoutId || activeWorkout?.id || null);
    setOptionsMuscleGroup(muscleGroup || null);
    setOptionsModalVisible(true);
  }, [activeWorkout?.id]);

  const closeExerciseOptions = useCallback(() => {
    setOptionsModalVisible(false);
    setOptionsExerciseId(null);
    setOptionsWorkoutId(null);
    setOptionsMuscleGroup(null);
  }, []);

  const handleGoToExercise = useCallback(() => {
    const targetWorkoutId = optionsWorkoutId || activeWorkout?.id;
    if (optionsExerciseId && targetWorkoutId) {
      setIsPlayerExpanded(false);
      closeExerciseOptions();
      router.push(`/workout/exercise/${targetWorkoutId}/${optionsExerciseId}`);
    }
  }, [optionsExerciseId, optionsWorkoutId, activeWorkout, router, closeExerciseOptions]);

  const handleChangeExercise = useCallback(() => {
    const targetWorkoutId = optionsWorkoutId || activeWorkout?.id;
    if (optionsExerciseId && targetWorkoutId) {
      const activeEx = groupedExercises.find(g => g.exerciseId === optionsExerciseId);
      const muscleGroup = optionsMuscleGroup || activeEx?.muscleGroup || '';
      setIsPlayerExpanded(false);
      closeExerciseOptions();
      router.push(`/workout/replace/${targetWorkoutId}/${optionsExerciseId}?muscleGroup=${encodeURIComponent(muscleGroup)}`);
    }
  }, [optionsExerciseId, optionsWorkoutId, optionsMuscleGroup, activeWorkout, groupedExercises, router, closeExerciseOptions]);

  const handleRemoveExerciseFromWorkout = useCallback(async () => {
    const targetWorkoutId = optionsWorkoutId || activeWorkout?.id;
    if (!targetWorkoutId || !optionsExerciseId) return;
    try {
      setIsSaving(true);
      const exId = optionsExerciseId;
      closeExerciseOptions();
      
      const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', targetWorkoutId)
        .eq('exercise_id', exId);
        
      if (error) throw error;
      
      if (activeWorkout && activeWorkout.id === targetWorkoutId) {
        setGroupedExercises(prev => {
          const nextList = prev.filter(g => g.exerciseId !== exId);
          return nextList;
        });

        if (activeExerciseId === exId) {
          const remaining = groupedExercises.filter(g => g.exerciseId !== exId);
          setActiveExerciseId(remaining.length > 0 ? remaining[0].exerciseId : null);
        }
      }

      setWorkoutUpdateSeq(prev => prev + 1);
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Övning borttagen', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Error removing exercise:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Något gick fel', ToastAndroid.SHORT);
      }
    } finally {
      setIsSaving(false);
    }
  }, [optionsWorkoutId, activeWorkout, optionsExerciseId, activeExerciseId, groupedExercises, closeExerciseOptions]);

  const isSavingRef = useRef(false);

  const finishWorkout = useCallback(async () => {
    if (isSavingRef.current || !activeWorkout) return;
    try {
      isSavingRef.current = true;
      setIsSaving(true);
      setIsWorkoutActive(false);

      let totalVolume = 0;
      let totalReps = 0;
      let completedSetsCount = 0;
      const userWeight = await getUserBodyWeight();
      const exerciseLogs: any[] = [];
      
      groupedExercises.forEach(group => {
        const doneSets = group.sets.filter(s => s.is_done);
        if (doneSets.length > 0) {
          doneSets.forEach(set => {
            totalVolume += calculateSetVolume(
              set.reps,
              set.weight,
              group.exerciseName,
              group.equipment,
              userWeight
            );
            totalReps += (set.reps || 0);
            completedSetsCount += 1;
          });
          const maxWeight = Math.max(...doneSets.map(s => s.weight || 0));
          const setsAtMax = doneSets.filter(s => (s.weight || 0) === maxWeight);
          const maxRepsAtMax = Math.max(...setsAtMax.map(s => s.reps || 0), 0);

          exerciseLogs.push({
            exercise_name: group.exerciseName,
            muscle_group: group.muscleGroup,
            sets: doneSets.length,
            weight: maxWeight,
            reps: maxRepsAtMax
          });
        }
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Du är inte inloggad");

      const exercisesForDetection = groupedExercises.map(g => ({
        exerciseName: g.exerciseName,
        muscleGroup: g.muscleGroup,
        sets: g.sets.map(s => ({ reps: s.reps, weight: s.weight, is_done: s.is_done }))
      }));

      const achievements = await detectWorkoutRecords(user.id, exercisesForDetection);

      const { data: logData, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          workout_id: activeWorkout.id,
          workout_name: activeWorkout.name,
          duration_seconds: workoutTimeElapsed,
          total_volume: totalVolume
        })
        .select()
        .single();

      if (logError) throw logError;

      if (exerciseLogs.length > 0) {
        const insertData = exerciseLogs.map(log => ({
          ...log,
          workout_log_id: logData.id
        }));
        
        const { error: exError } = await supabase
          .from('workout_exercise_logs')
          .insert(insertData);
          
        if (exError) throw exError;
      }

      setSummaryData({
        workoutName: activeWorkout.name,
        durationSeconds: workoutTimeElapsed,
        totalReps,
        totalVolume,
        completedSetsCount,
        completedExercisesCount: exerciseLogs.length,
        achievements,
      });

      cacheService.invalidate('all');

      setIsPlayerExpanded(false);
      setOptionsModalVisible(false);
      setSummaryModalVisible(true);
    } catch (error: any) {
      console.error('Error saving workout:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Kunde inte spara: ${error.message || 'Ett fel inträffade'}`, ToastAndroid.LONG);
      }
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [activeWorkout, groupedExercises, workoutTimeElapsed]);

  const handleCloseSummary = useCallback(() => {
    setSummaryModalVisible(false);
    discardWorkout();
    router.replace('/(tabs)/user');
  }, [discardWorkout, router]);

  return (
    <WorkoutSessionContext.Provider
      value={{
        activeWorkout,
        groupedExercises,
        activeExerciseId,
        activeExercise,
        isPlayerExpanded,
        isWorkoutActive,
        workoutTimeElapsed,
        isSaving,
        summaryData,
        summaryModalVisible,
        optionsModalVisible,
        optionsExerciseId,
        optionsWorkoutId,
        progressPercentage,
        startWorkout,
        setGroupedExercises,
        setActiveExerciseId,
        setIsPlayerExpanded,
        setIsWorkoutActive,
        handleNextExercise,
        handlePreviousExercise,
        toggleSetStatus,
        handleUpdateSet,
        finishWorkout,
        discardWorkout,
        openExerciseOptions,
        closeExerciseOptions,
        handleGoToExercise,
        handleChangeExercise,
        handleRemoveExerciseFromWorkout,
        handleCloseSummary,
        refreshWorkoutExercises,
        workoutUpdateSeq,
        triggerWorkoutUpdate,
      }}
    >
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession() {
  const context = useContext(WorkoutSessionContext);
  if (!context) {
    throw new Error('useWorkoutSession must be used within a WorkoutSessionProvider');
  }
  return context;
}
