import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, ToastAndroid, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import ExerciseLibrary from '../../../../src/components/ExerciseLibrary';
import { supabase } from '../../../../src/lib/supabase';
import { ExerciseLibrary as Exercise } from '../../../../src/types';
import { useWorkoutSession } from '../../../../src/context/WorkoutSessionContext';

export default function ReplaceExerciseScreen() {
  const { workoutId, oldExerciseId, muscleGroup } = useLocalSearchParams<{
    workoutId: string;
    oldExerciseId: string;
    muscleGroup: string;
  }>();
  
  const router = useRouter();
  const { activeWorkout, refreshWorkoutExercises } = useWorkoutSession();
  const [isReplacing, setIsReplacing] = useState(false);

  const handleReplace = async (newExercise: Exercise) => {
    if (!workoutId || !oldExerciseId || isReplacing) return;
    
    // Prevent replacing with the exact same exercise to avoid redundant DB calls
    if (newExercise.id === oldExerciseId) {
      router.back();
      return;
    }

    try {
      setIsReplacing(true);
      
      const { error } = await supabase
        .from('workout_exercises')
        .update({
          exercise_id: newExercise.id,
          custom_name: null, // Reset custom name
          notes: null // Reset notes
        })
        .eq('workout_id', workoutId)
        .eq('exercise_id', oldExerciseId);

      if (error) throw error;

      if (activeWorkout && activeWorkout.id === workoutId) {
        await refreshWorkoutExercises(workoutId, newExercise.id);
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show('Övning utbytt', ToastAndroid.SHORT);
      }
      
      router.back();
    } catch (error) {
      console.error('Error replacing exercise:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte byta övning', ToastAndroid.SHORT);
      }
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Välj ny övning</Text>
      </View>
      
      <View style={styles.container}>
        <ExerciseLibrary 
          replaceMode={true} 
          defaultFilter={muscleGroup || 'Alla'} 
          onReplaceSelect={handleReplace}
        />
        
        {isReplacing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#A3E635" />
          </View>
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
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
