import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, ToastAndroid, Dimensions, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../../../src/lib/supabase';
import { ExerciseLibrary } from '../../../../src/types';
import ExerciseStats from '../../../../src/components/statistics/ExerciseStats';
import ExerciseDetailView from '../../../../src/components/ExerciseDetailView';
import { useWorkoutSession } from '../../../../src/context/WorkoutSessionContext';

const { width } = Dimensions.get('window');

export default function WorkoutExerciseDetailScreen() {
  const { workoutId, exerciseId } = useLocalSearchParams<{ workoutId: string, exerciseId: string }>();
  const router = useRouter();
  const { activeWorkout, refreshWorkoutExercises } = useWorkoutSession();

  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const [exercise, setExercise] = useState<ExerciseLibrary | null>(null);
  const [originalName, setOriginalName] = useState('');
  const [notes, setNotes] = useState('');

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!workoutId || !exerciseId) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercise:exercise_library(*)
        `)
        .eq('workout_id', workoutId)
        .eq('exercise_id', exerciseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setExercise(data[0].exercise);
        setOriginalName(data[0].exercise?.name || '');
        setNotes(data[0].notes || '');
      }

    } catch (error) {
      console.error('Error fetching exercise details:', error);
      showToast('Kunde inte ladda övningen');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      console.log(message);
    }
  };

  const handleSaveNotes = async () => {
    if (!workoutId || !exerciseId) return;
    try {
      setSavingNotes(true);
      const { error } = await supabase
        .from('workout_exercises')
        .update({ notes: notes.trim() ? notes.trim() : null })
        .eq('workout_id', workoutId)
        .eq('exercise_id', exerciseId);

      if (error) throw error;

      if (activeWorkout && activeWorkout.id === workoutId) {
        await refreshWorkoutExercises(workoutId);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      showToast('Kunde inte spara anteckningar');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        {/* Custom Tabs (Övning / Statistik) */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 0 && styles.activeTabButton]}
            onPress={() => handleTabPress(0)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
              Övning
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 1 && styles.activeTabButton]}
            onPress={() => handleTabPress(1)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
              Statistik
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {originalName}
          </Text>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          pagingEnabled 
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            if (newIndex !== activeTab) {
              setActiveTab(newIndex);
            }
          }}
          scrollEventThrottle={16}
          style={styles.swipeContainer}
        >
          {/* Tab 1: Övning Tab */}
          <View style={styles.page}>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {exercise ? (
                <ExerciseDetailView
                  exercise={exercise}
                  showAddToWorkout={false}
                  notes={notes}
                  onNotesChange={setNotes}
                  onNotesBlur={handleSaveNotes}
                  notesPlaceholder="Skriv personliga anteckningar för denna övning..."
                  savingNotes={savingNotes}
                />
              ) : (
                <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
              )}
            </ScrollView>
          </View>

          {/* Tab 2: Statistik Tab */}
          <View style={styles.page}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
              <ExerciseStats exerciseName={originalName} />
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#A3E635',
  },
  tabText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#A3E635',
    flex: 1,
  },
  swipeContainer: {
    flex: 1,
  },
  page: {
    width: width,
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
