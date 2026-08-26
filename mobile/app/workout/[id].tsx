import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, FlatList, ListRenderItemInfo } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical, Edit2, Plus, Play } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Workout } from '../../src/types';
import { getMuscleGroupImage, getDefaultWorkoutImage } from '../../src/utils/images';
import AppBottomNav from '../../src/components/AppBottomNav';
import { useWorkoutSession, GroupedExercise, FetchedWorkoutExercise } from '../../src/context/WorkoutSessionContext';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    activeWorkout,
    groupedExercises: sessionExercises,
    activeExerciseId,
    startWorkout,
    setActiveExerciseId,
    setIsPlayerExpanded,
    finishWorkout,
    openExerciseOptions,
    refreshWorkoutExercises,
    isSaving: sessionSaving,
    isWorkoutActive,
    setIsWorkoutActive,
    workoutTimeElapsed,
  } = useWorkoutSession();

  const [localWorkout, setLocalWorkout] = useState<Workout | null>(null);
  const [localExercises, setLocalExercises] = useState<GroupedExercise[]>([]);
  const [loading, setLoading] = useState(true);

  // If this workout is the actively running one, use session data; otherwise use local data
  const isCurrentActiveWorkout = activeWorkout?.id === id;
  const currentWorkout = isCurrentActiveWorkout ? activeWorkout : localWorkout;
  const displayGroupedExercises = isCurrentActiveWorkout ? sessionExercises : localExercises;

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

      if (workoutData?.folder_id) {
        const { data: folderData } = await supabase
          .from('folders')
          .select('id, image_url, description, is_ai')
          .eq('id', workoutData.folder_id)
          .maybeSingle();
        if (folderData && (folderData.is_ai || folderData.image_url === 'ai-default' || (folderData.description && folderData.description.toLowerCase().includes('skräddarsytt')))) {
          workoutData.is_ai = true;
        }
      }

      setLocalWorkout(workoutData);

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
        group.sets.push({ ...row, is_done: false });
      });
      
      const grouped = Array.from(groupedMap.values());
      grouped.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      grouped.forEach(g => g.sets.sort((a, b) => a.sets - b.sets));

      setLocalExercises(grouped);

      if (isCurrentActiveWorkout) {
        await refreshWorkoutExercises(id);
      }
    } catch (error) {
      console.error('Error fetching workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrResumeWorkout = () => {
    if (!isCurrentActiveWorkout) {
      if (localWorkout && localExercises.length > 0) {
        startWorkout(localWorkout, localExercises);
        setIsPlayerExpanded(true);
      }
    } else {
      if (!isWorkoutActive) {
        setIsWorkoutActive(true);
      }
      setIsPlayerExpanded(true);
    }
  };

  // Collage Logic
  const collageImages = useMemo(() => {
    if (displayGroupedExercises.length === 0) return [];
    
    let images = displayGroupedExercises.slice(0, 4).map(g => 
      g.gifUrl ? { uri: g.gifUrl } : getMuscleGroupImage(g.muscleGroup)
    );
    
    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  }, [displayGroupedExercises]);

  const completedSetsCount = displayGroupedExercises.reduce((sum, group) => sum + group.sets.filter(s => s.is_done).length, 0);

  if (loading || sessionSaving) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A3E635" />
          <Text style={styles.loadingText}>
            {sessionSaving ? 'Sparar träningspass...' : 'Laddar träningspass...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={28} color="#F8FAFC" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.defaultHeroWrapper}>
        <Image
          source={currentWorkout?.image_url ? { uri: currentWorkout.image_url } : getDefaultWorkoutImage(currentWorkout?.is_ai)}
          style={styles.defaultHeroImage}
          contentFit="cover"
        />
      </View>

      <Text style={styles.workoutTitle}>{currentWorkout?.name}</Text>
      <View style={styles.exercisesCountRow}>
        <View style={styles.exercisesCountLine} />
        <Text style={styles.exercisesCountText}>{displayGroupedExercises.length} ÖVNINGAR</Text>
        <View style={styles.exercisesCountLine} />
        <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/workout/edit/${id}`)}>
          <Edit2 size={20} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {displayGroupedExercises.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.playWorkoutButton}
            onPress={handleStartOrResumeWorkout}
            activeOpacity={0.8}
          >
            <Play size={20} color="#0A0A0A" fill="#0A0A0A" />
            <Text style={styles.playWorkoutButtonText}>
              {isCurrentActiveWorkout ? (isWorkoutActive ? 'Öppna Spelare' : 'Fortsätt Workout') : 'Starta Workout'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderGroup = ({ item: group }: ListRenderItemInfo<GroupedExercise>) => {
    const isPlaying = activeExerciseId === group.exerciseId;

    return (
      <TouchableOpacity 
        style={[styles.exerciseCard, isPlaying && styles.playingCard]}
        activeOpacity={0.9}
        onPress={() => {
          if (!isCurrentActiveWorkout) {
            if (localWorkout && localExercises.length > 0) {
              startWorkout(localWorkout, localExercises, group.exerciseId);
            }
          } else {
            setActiveExerciseId(group.exerciseId);
          }
          setIsPlayerExpanded(true);
        }}
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
            <TouchableOpacity 
              style={styles.kebabMenu} 
              onPress={() => openExerciseOptions(group.exerciseId, id)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
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
    if (displayGroupedExercises.length === 0) {
      return null;
    }

    const handleFinish = () => {
      if (!isCurrentActiveWorkout && localWorkout && displayGroupedExercises.length > 0) {
        startWorkout(localWorkout, displayGroupedExercises);
      }
      finishWorkout();
    };

    return (
      <View style={styles.footerContainer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish} activeOpacity={0.8}>
          <Text style={styles.finishButtonText}>Slutför Workout</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <FlatList
          data={displayGroupedExercises}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          keyExtractor={(item, index) => item.exerciseId || index.toString()}
          renderItem={renderGroup}
          extraData={activeExerciseId}
          contentContainerStyle={styles.scrollContent}
        />
      </View>

      <AppBottomNav activeTab="workouts" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
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
  defaultHeroWrapper: {
    width: 160,
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
  },
  defaultHeroImage: {
    width: '100%',
    height: '100%',
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
  actionRow: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  playWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A3E635',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  playWorkoutButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    paddingBottom: 160, // Space for mini player and bottom nav bar
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
