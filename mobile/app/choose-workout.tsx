import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ToastAndroid, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { Workout } from '../src/types';
import { useAuth } from '../src/context/AuthContext';

export default function ChooseWorkoutScreen() {
  const { exerciseId, setsData, notes } = useLocalSearchParams<{ exerciseId: string, setsData?: string, notes?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      // Just a simple alert for iOS if Toast is not available natively
      // In a real app, you'd use a toast library for cross-platform
      console.log(message);
    }
  };

  const addToWorkout = async (workoutId: string) => {
    if (!exerciseId || saving) return;
    
    try {
      setSaving(true);
      let setsToInsert = [];
      if (setsData) {
        const parsedSets = JSON.parse(setsData);
        setsToInsert = parsedSets.map((set: any, index: number) => ({
          workout_id: workoutId,
          exercise_id: exerciseId,
          sets: index + 1,
          reps: parseInt(set.reps) || 0,
          weight: parseFloat(set.weight) || 0,
          notes: notes || null,
          is_done: false
        }));
      } else {
        setsToInsert = [{ 
          workout_id: workoutId, 
          exercise_id: exerciseId,
          sets: 1,
          reps: 0,
          weight: 0,
          is_done: false
        }];
      }

      const { error } = await supabase
        .from('workout_exercises')
        .insert(setsToInsert);

      if (error) throw error;
      
      showToast('Tillagd i workout');
      router.navigate('/(tabs)/exercises');
    } catch (error) {
      console.error('Error adding to workout:', error);
      showToast('Kunde inte lägga till i workout');
    } finally {
      setSaving(false);
    }
  };

  const renderWorkout = ({ item }: { item: Workout }) => (
    <TouchableOpacity 
      style={styles.workoutCard}
      onPress={() => addToWorkout(item.id)}
      disabled={saving}
    >
      <Text style={styles.workoutTitle}>{item.name}</Text>
      <Text style={styles.workoutDate}>
        {new Date(item.created_at).toISOString().split('T')[0]}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Välj workout</Text>
      </View>

      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push({ pathname: '/create-workout', params: { exerciseId } })}
        >
          <Plus size={20} color="#F8FAFC" style={styles.createIcon} />
          <Text style={styles.createText}>Create new workout</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            renderItem={renderWorkout}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Inga workouts skapade ännu.</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2E35',
    borderRadius: 24,
    paddingVertical: 12,
    marginBottom: 24,
  },
  createIcon: {
    marginRight: 8,
  },
  createText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 40,
  },
  workoutCard: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2E35',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
  }
});
