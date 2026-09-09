import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bookmark } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { ExerciseLibrary } from '../../src/types';
import { useBookmarks } from '../../src/hooks/useBookmarks';
import ExerciseDetailView from '../../src/components/ExerciseDetailView';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<ExerciseLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    fetchExerciseDetails();
  }, [id]);

  const bookmarked = id ? isBookmarked(id) : false;

  const handleToggleBookmark = async () => {
    if (!id) return;
    const nowBookmarked = await toggleBookmark(id);
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        nowBookmarked ? 'Bokmärke sparat ⭐' : 'Bokmärke borttaget',
        ToastAndroid.SHORT
      );
    }
  };

  const fetchExerciseDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching exercise:', error.message);
        return;
      }
      setExercise(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWorkout = () => {
    router.push({
      pathname: '/choose-workout',
      params: { 
        exerciseId: id,
        notes: notes.trim() ? notes.trim() : undefined
      }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Övningsdetaljer</Text>
        </View>
        <TouchableOpacity 
          onPress={handleToggleBookmark} 
          style={styles.bookmarkButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Bookmark 
            size={24} 
            color={bookmarked ? "#A3E635" : "#94A3B8"} 
            fill={bookmarked ? "#A3E635" : "transparent"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : exercise ? (
          <>
            <ExerciseDetailView
              exercise={exercise}
              showAddToWorkout={true}
              onAddToWorkout={handleAddToWorkout}
              notes={notes}
              onNotesChange={setNotes}
              notesPlaceholder="Skriv dina anteckningar här (sparas i passet)..."
            />
            <View style={{ height: 40 }} />
          </>
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center' }}>Övningen hittades inte.</Text>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  bookmarkButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#A3E635',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
