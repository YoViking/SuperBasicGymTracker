import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ToastAndroid, Dimensions, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, GripVertical, Edit2, Plus } from 'lucide-react-native';
import { supabase } from '../../../src/lib/supabase';
import { Workout } from '../../../src/types';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getMuscleGroupImage } from '../../../src/utils/images';

const { width } = Dimensions.get('window');

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
  };
}

interface GroupedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  gifUrl?: string;
  sets: FetchedWorkoutExercise[];
  order_index: number;
}

export default function WorkoutEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [workoutName, setWorkoutName] = useState<string>('');
  const [groupedExercises, setGroupedExercises] = useState<GroupedExercise[]>([]);
  const [loading, setLoading] = useState(true);

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
      setWorkoutName(workoutData.name);

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercise:exercise_library(name, muscle_group, "gifUrl")
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
            gifUrl: row.exercise.gifUrl,
            sets: [],
            order_index: row.order_index ?? 0
          };
          groupedMap.set(row.exercise_id, group);
        }
        group.sets.push(row);
      });
      
      const grouped = Array.from(groupedMap.values());
      grouped.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      grouped.forEach(g => g.sets.sort((a, b) => a.sets - b.sets));
      setGroupedExercises(grouped);

    } catch (error) {
      console.error('Error fetching workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateWorkoutName = async (newName: string) => {
    if (!id || !newName.trim()) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ name: newName.trim() })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating workout name:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Misslyckades att spara namn', ToastAndroid.SHORT);
      }
    }
  };

  const onDragEnd = async (newData: GroupedExercise[]) => {
    setGroupedExercises(newData);
    try {
      const updatePromises = newData.map((group, index) => {
        return supabase
          .from('workout_exercises')
          .update({ order_index: index })
          .eq('workout_id', id)
          .eq('exercise_id', group.exerciseId);
      });
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating order:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Misslyckades att spara ordningen', ToastAndroid.SHORT);
      }
    }
  };

  const collageImages = useMemo(() => {
    if (groupedExercises.length === 0) return [];
    let images = groupedExercises.slice(0, 4).map(g => 
      g.gifUrl ? { uri: g.gifUrl } : getMuscleGroupImage(g.muscleGroup)
    );
    
    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  }, [groupedExercises]);

  if (loading) {
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
          <Text style={styles.backText}>Redigera workout</Text>
        </TouchableOpacity>
      </View>
      
      {collageImages.length === 4 && (
        <View style={styles.collageContainer}>
          <View style={styles.collageGrid}>
            <Image source={collageImages[0]} style={styles.collageImage} />
            <Image source={collageImages[1]} style={styles.collageImage} />
            <Image source={collageImages[2]} style={styles.collageImage} />
            <Image source={collageImages[3]} style={styles.collageImage} />
          </View>
          <View style={styles.collageEditBadge}>
            <Edit2 size={16} color="#0A0A0A" />
          </View>
        </View>
      )}

      <TextInput
        style={styles.workoutTitleInput}
        value={workoutName}
        onChangeText={setWorkoutName}
        onEndEditing={(e) => updateWorkoutName(e.nativeEvent.text)}
        placeholder="Workout Name"
        placeholderTextColor="#94A3B8"
      />
      <View style={styles.exercisesCountRow}>
        <View style={styles.exercisesCountLine} />
        <Text style={styles.exercisesCountText}>{groupedExercises.length} ÖVNINGAR</Text>
        <View style={styles.exercisesCountLine} />
      </View>
    </View>
  );

  const renderGroup = ({ item: group, drag, isActive }: RenderItemParams<GroupedExercise>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity 
          style={[styles.exerciseCard, isActive && styles.activeCard]}
          onLongPress={drag}
          delayLongPress={200}
          disabled={isActive}
          activeOpacity={0.9}
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
              <TouchableOpacity style={styles.dragHandle} onLongPress={drag}>
                <GripVertical size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <View style={styles.setsList}>
               {group.sets.map((set) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setCountText}>{set.sets} × {set.reps}</Text>
                    <Text style={styles.setWeightText}>{set.weight} kg</Text>
                  </View>
               ))}
            </View>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };
  const renderEmptyState = () => (
    <TouchableOpacity
      style={styles.emptyContainer}
      activeOpacity={0.7}
      onPress={() => router.push('/(tabs)/exercises')}
    >
      <View style={styles.emptyIconCircle}>
        <Plus size={22} color="#A3E635" />
      </View>
      <Text style={styles.emptyText}>
        Denna workout är tom. Lägg till en övning genom att trycka på{' '}
        <Text style={styles.emptyHighlight}>"+ Lägg till i workout"</Text>
      </Text>
      <View style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>Bläddra bland övningar</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <DraggableFlatList
          data={groupedExercises}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyState()}
          onDragEnd={({ data }) => onDragEnd(data)}
          keyExtractor={(item, index) => item.exerciseId || index.toString()}
          renderItem={renderGroup}
          contentContainerStyle={styles.scrollContent}
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
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  backText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '500',
  },
  collageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  collageGrid: {
    width: 160,
    height: 160,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collageImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: '#0A0A0A',
  },
  collageEditBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#F8FAFC',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  workoutTitleInput: {
    color: '#A3E635',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    minWidth: '50%',
    padding: 4,
  },
  exercisesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
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
  scrollContent: {
    paddingBottom: 40,
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
  cardLeft: {
    width: 80,
  },
  thumbnail: {
    width: 80,
    height: 80,
  },
  cardRight: {
    flex: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dragHandle: {
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
  emptyContainer: {
    marginHorizontal: 24,
    marginTop: 20,
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
