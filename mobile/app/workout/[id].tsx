import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ToastAndroid, Dimensions, FlatList, ListRenderItemInfo, Modal, AppState } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical, Edit2, Dumbbell, Repeat, Trash2, X, Plus } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Workout } from '../../src/types';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getMuscleGroupImage } from '../../src/utils/images';
import WorkoutPlayer from '../../src/components/WorkoutPlayer';
import { calculateSetVolume, getUserBodyWeight } from '../../src/utils/volume';
import WorkoutSummaryModal, { WorkoutSummaryData } from '../../src/components/WorkoutSummaryModal';
import { detectWorkoutRecords } from '../../src/services/recordDetector';

const { width } = Dimensions.get('window');

// Type representing the shape of the data we get from the DB
interface FetchedWorkoutExercise {
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

// Grouped exercise type for UI
interface GroupedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  equipment?: string;
  gifUrl?: string;
  sets: FetchedWorkoutExercise[];
  order_index: number;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [groupedExercises, setGroupedExercises] = useState<GroupedExercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Player State
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [workoutTimeElapsed, setWorkoutTimeElapsed] = useState(0);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Summary Modal State
  const [summaryData, setSummaryData] = useState<WorkoutSummaryData | null>(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  // Options Modal State
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [optionsExerciseId, setOptionsExerciseId] = useState<string | null>(null);

  const openExerciseOptions = (exerciseId: string) => {
    setOptionsExerciseId(exerciseId);
    setOptionsModalVisible(true);
  };

  const closeExerciseOptions = () => {
    setOptionsModalVisible(false);
    setOptionsExerciseId(null);
  };

  const handleGoToExercise = () => {
    if (optionsExerciseId) {
      router.push(`/workout/exercise/${id}/${optionsExerciseId}`);
      closeExerciseOptions();
    }
  };

  const handleChangeExercise = () => {
    if (optionsExerciseId && id) {
      const activeEx = groupedExercises.find(g => g.exerciseId === optionsExerciseId);
      const muscleGroup = activeEx ? activeEx.muscleGroup : '';
      
      router.push(`/workout/replace/${id}/${optionsExerciseId}?muscleGroup=${encodeURIComponent(muscleGroup)}`);
      closeExerciseOptions();
    }
  };

  const handleRemoveExerciseFromWorkout = async () => {
    if (!id || !optionsExerciseId) return;
    try {
      setIsSaving(true);
      const exId = optionsExerciseId;
      closeExerciseOptions();
      
      const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', id)
        .eq('exercise_id', exId);
        
      if (error) throw error;
      
      setGroupedExercises(prev => prev.filter(g => g.exerciseId !== exId));
      
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
  };

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isWorkoutActive) {
      timerRef.current = setInterval(() => {
        setWorkoutTimeElapsed(prev => prev + 1);
      }, 1000) as unknown as ReturnType<typeof setInterval>;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isWorkoutActive]);

  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [id])
  );

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id)
        .single();
        
      if (workoutError) throw workoutError;
      setWorkout(workoutData);

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercise:exercise_library(name, muscle_group, "gifUrl", equipment)
        `)
        .eq('workout_id', id)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (exercisesError) throw exercisesError;

      setGroupedExercises((currentGrouped) => {
        const isDoneMap = new Map<string, boolean>();
        currentGrouped.forEach(g => {
          g.sets.forEach(s => isDoneMap.set(s.id, s.is_done));
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
          const wasDone = isDoneMap.get(row.id) || false;
          group.sets.push({ ...row, is_done: wasDone });
        });
        
        const grouped = Array.from(groupedMap.values());
        grouped.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        grouped.forEach(g => g.sets.sort((a, b) => a.sets - b.sets));
        return grouped;
      });

    } catch (error) {
      console.error('Error fetching workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetStatus = async (setId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    const newState = groupedExercises.map(group => ({
      ...group,
      sets: group.sets.map(s => s.id === setId ? { ...s, is_done: newStatus } : s)
    }));

    setGroupedExercises(newState);

    // Check if ALL exercises in the entire workout are now fully complete
    const totalSets = newState.reduce((sum, g) => sum + g.sets.length, 0);
    const completedSets = newState.reduce((sum, g) => sum + g.sets.filter(s => s.is_done).length, 0);
    
    if (totalSets > 0 && completedSets === totalSets && newStatus === true) {
      // Small delay to let the checkbox animation finish
      setTimeout(() => {
        setIsPlayerExpanded(false);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Alla övningar klara! Scrolla ner och Slutför för att spara.', ToastAndroid.LONG);
        }
      }, 600);
    }
  };

  const handleUpdateSet = async (setId: string, reps: number, weight: number) => {
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
  };

  const finishWorkout = async () => {
    if (!workout || !id) return;
    try {
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

      // Detect PR achievements before inserting new logs
      const exercisesForDetection = groupedExercises.map(g => ({
        exerciseName: g.exerciseName,
        muscleGroup: g.muscleGroup,
        sets: g.sets.map(s => ({ reps: s.reps, weight: s.weight, is_done: s.is_done }))
      }));

      const achievements = await detectWorkoutRecords(user.id, exercisesForDetection);

      const { data: logData, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id, // Use current user ID for RLS policy
          workout_id: workout.id,
          workout_name: workout.name,
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

        // Increment completions_count in exercise_library for completed exercises
        for (const log of exerciseLogs) {
          try {
            const { data: exData } = await supabase
              .from('exercise_library')
              .select('id, completions_count')
              .eq('name', log.exercise_name)
              .maybeSingle();

            if (exData) {
              await supabase
                .from('exercise_library')
                .update({ completions_count: (exData.completions_count || 0) + 1 })
                .eq('id', exData.id);
            }
          } catch (e) {
            console.log('Error updating completions_count:', e);
          }
        }
      }

      setSummaryData({
        workoutName: workout.name,
        durationSeconds: workoutTimeElapsed,
        totalReps,
        totalVolume,
        completedSetsCount,
        completedExercisesCount: exerciseLogs.length,
        achievements,
      });

      setIsSaving(false);
      setSummaryModalVisible(true);
    } catch (error: any) {
      console.error('Error saving workout:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Kunde inte spara: ${error.message || 'Ett fel inträffade'}`, ToastAndroid.LONG);
      }
      setIsSaving(false);
    }
  };

  const handleCloseSummary = () => {
    setSummaryModalVisible(false);
    router.replace('/(tabs)/user');
  };

  // Collage Logic
  const collageImages = useMemo(() => {
    if (groupedExercises.length === 0) return [];
    
    let images = groupedExercises.slice(0, 4).map(g => 
      g.gifUrl ? { uri: g.gifUrl } : getMuscleGroupImage(g.muscleGroup)
    );
    
    // Fill to 4 slots by repeating if there are fewer than 4 exercises
    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  }, [groupedExercises]);

  // Player Navigation
  const activeExerciseIndex = groupedExercises.findIndex(g => g.exerciseId === activeExerciseId);
  const activeExercise = activeExerciseIndex >= 0 ? groupedExercises[activeExerciseIndex] : null;

  const handleNextExercise = () => {
    if (activeExerciseIndex >= 0 && activeExerciseIndex < groupedExercises.length - 1) {
      setActiveExerciseId(groupedExercises[activeExerciseIndex + 1].exerciseId);
    }
  };

  const handlePreviousExercise = () => {
    if (activeExerciseIndex > 0) {
      setActiveExerciseId(groupedExercises[activeExerciseIndex - 1].exerciseId);
    }
  };

  const totalSetsCount = groupedExercises.reduce((sum, group) => sum + group.sets.length, 0);
  const completedSetsCount = groupedExercises.reduce((sum, group) => sum + group.sets.filter(s => s.is_done).length, 0);
  const progressPercentage = totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0;

  if (loading || isSaving) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={28} color="#F8FAFC" />
        </TouchableOpacity>
      </View>
      
      {collageImages.length === 4 && (
        <View style={styles.collageGrid}>
          <Image source={collageImages[0]} style={styles.collageImage} />
          <Image source={collageImages[1]} style={styles.collageImage} />
          <Image source={collageImages[2]} style={styles.collageImage} />
          <Image source={collageImages[3]} style={styles.collageImage} />
        </View>
      )}

      <Text style={styles.workoutTitle}>{workout?.name}</Text>
      <View style={styles.exercisesCountRow}>
        <View style={styles.exercisesCountLine} />
        <Text style={styles.exercisesCountText}>{groupedExercises.length} ÖVNINGAR</Text>
        <View style={styles.exercisesCountLine} />
        <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/workout/edit/${id}`)}>
          <Edit2 size={20} color="#F8FAFC" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGroup = ({ item: group }: ListRenderItemInfo<GroupedExercise>) => {
    const isPlaying = activeExerciseId === group.exerciseId;

    return (
      <TouchableOpacity 
        style={[styles.exerciseCard, isPlaying && styles.playingCard]}
        activeOpacity={0.9}
        onPress={() => setActiveExerciseId(group.exerciseId)}
      >
        <View style={styles.cardLeft}>
            {group.gifUrl ? (
              <Image source={{ uri: group.gifUrl }} style={styles.thumbnail} contentFit="cover" autoplay={false} />
            ) : (
              <Image source={getMuscleGroupImage(group.muscleGroup)} style={styles.thumbnail} contentFit="contain" autoplay={false} />
            )}
          </View>
          <View style={styles.cardRight}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>{group.sets[0]?.custom_name || group.exerciseName}</Text>
              <TouchableOpacity style={styles.kebabMenu} onPress={() => openExerciseOptions(group.exerciseId)}>
                <MoreVertical size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
      </TouchableOpacity>
    );
  };
  const renderEmptyState = () => (
    <TouchableOpacity
      style={styles.emptyContainer}
      activeOpacity={0.7}
      onPress={() => router.push(`/workout/edit/${id}`)}
    >
      <View style={styles.emptyIconCircle}>
        <Plus size={22} color="#A3E635" />
      </View>
      <Text style={styles.emptyText}>
        Denna workout är tom. Lägg till en övning genom att trycka på{' '}
        <Text style={styles.emptyHighlight}>"+ Lägg till i workout"</Text>
      </Text>
      <View style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>Gå till Redigera & Övningar</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    const hasStartedWorkout = isWorkoutActive || workoutTimeElapsed > 0 || completedSetsCount > 0;
    if (groupedExercises.length === 0 || !hasStartedWorkout) {
      return null;
    }

    return (
      <View style={styles.footerContainer}>
        <TouchableOpacity style={styles.finishButton} onPress={finishWorkout}>
          <Text style={styles.finishButtonText}>Slutför Workout</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={groupedExercises}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          keyExtractor={(item, index) => item.exerciseId || index.toString()}
          renderItem={renderGroup}
          extraData={activeExerciseId}
          contentContainerStyle={styles.scrollContent}
        />

        {activeExercise && (
          <WorkoutPlayer 
            activeExercise={activeExercise}
            isExpanded={isPlayerExpanded}
            setIsExpanded={setIsPlayerExpanded}
            onNext={handleNextExercise}
            onPrevious={handlePreviousExercise}
            onToggleSet={toggleSetStatus}
            onUpdateSet={handleUpdateSet}
            workoutTimeElapsed={workoutTimeElapsed}
            isWorkoutActive={isWorkoutActive}
            setIsWorkoutActive={setIsWorkoutActive}
            progressPercentage={progressPercentage}
            onOptionsPress={() => openExerciseOptions(activeExercise.exerciseId)}
          />
        )}

        {/* Options Bottom Sheet */}
        <Modal
          visible={optionsModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeExerciseOptions}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={closeExerciseOptions} />
            <View style={styles.bottomSheet}>
              <View style={styles.bottomSheetHeader}>
                <View style={styles.bottomSheetHandle} />
              </View>

              <TouchableOpacity style={styles.optionRow} onPress={handleGoToExercise}>
                <Dumbbell size={24} color="#A3E635" />
                <Text style={styles.optionText}>Gå till övning</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionRow} onPress={handleChangeExercise}>
                <Repeat size={24} color="#F8FAFC" />
                <Text style={styles.optionTextWhite}>Byt övning</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionRow} onPress={handleRemoveExerciseFromWorkout}>
                <Trash2 size={24} color="#FF3B3E" />
                <Text style={styles.optionTextRed}>Ta bort övning från workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Workout Completion Summary Card */}
        <WorkoutSummaryModal
          visible={summaryModalVisible}
          summary={summaryData}
          onClose={handleCloseSummary}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  topNav: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  collageGrid: {
    width: 160,
    height: 160,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  collageImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: '#0A0A0A',
  },
  workoutTitle: {
    color: '#A3E635',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  exercisesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
    position: 'relative',
  },
  exercisesCountLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3F3F46',
  },
  exercisesCountText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 8,
    letterSpacing: 1,
  },
  editButton: {
    position: 'absolute',
    right: -40, // push it to the right of the 60% container
    padding: 8,
  },
  footerContainer: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 40,
  },
  finishButton: {
    backgroundColor: '#A3E635',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 32,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishButtonText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Space for mini player
  },
  exerciseCard: {
    backgroundColor: '#27272A',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  activeCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  playingCard: {
    borderColor: '#A3E635',
    borderWidth: 1,
  },
  cardLeft: {
    width: 80,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
  },
  cardRight: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  kebabMenu: {
    padding: 4,
  },
  setsList: {
    gap: 4,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 24,
  },
  setCountText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
    width: 60,
  },
  setWeightText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  bottomSheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  optionText: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextWhite: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextRed: {
    color: '#FF3B3E',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    marginHorizontal: 24,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyHighlight: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  emptyButton: {
    backgroundColor: '#272A34',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  emptyButtonText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '700',
  },
});
