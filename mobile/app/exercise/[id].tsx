import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Minus } from 'lucide-react-native';
import { Image } from 'expo-image';
import { supabase } from '../../src/lib/supabase';
import { ExerciseLibrary } from '../../src/types';

interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
}

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<ExerciseLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [setsData, setSetsData] = useState<ExerciseSet[]>([{ id: Date.now().toString(), reps: '', weight: '' }]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchExerciseDetails();
  }, [id]);

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

  const handleAddSet = () => {
    setSetsData([...setsData, { id: Date.now().toString(), reps: '', weight: '' }]);
  };

  const handleRemoveSet = (id: string) => {
    if (setsData.length > 1) {
      setSetsData(setsData.filter(set => set.id !== id));
    }
  };

  const updateSet = (id: string, field: 'reps' | 'weight', value: string) => {
    setSetsData(setsData.map(set => 
      set.id === id ? { ...set, [field]: value } : set
    ));
  };

  const handleAddToWorkout = () => {
    router.push({
      pathname: '/choose-workout',
      params: { 
        exerciseId: id,
        setsData: JSON.stringify(setsData),
        notes: notes.trim() ? notes.trim() : undefined
      }
    });
  };

  const openLink = () => {
    if (exercise?.link) {
      Linking.openURL(exercise.link);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Detail</Text>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : exercise ? (
          <>
            <View style={styles.card}>
              {exercise.gifUrl && (
                <Image 
                  source={{ uri: exercise.gifUrl }} 
                  style={styles.detailImage} 
                  contentFit="cover"
                  autoplay={true}
                />
              )}
              <View style={styles.cardHeader}>
                 <Text style={styles.cardHeaderTitle}>{exercise.name}</Text>
              </View>
              
              <View style={styles.setsContainer}>
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.headerBox, styles.colSet]}>
                    <Text style={styles.headerBoxText}>Set</Text>
                  </View>
                  <View style={[styles.headerBox, styles.colInput]}>
                    <Text style={styles.headerBoxText}>Reps</Text>
                  </View>
                  <View style={[styles.headerBox, styles.colInput]}>
                    <Text style={styles.headerBoxText}>Vikt</Text>
                  </View>
                  <View style={styles.colAction} />
                </View>

                {setsData.map((set, index) => (
                  <View key={set.id} style={styles.tableRow}>
                    <View style={styles.colSet}>
                      <Text style={styles.setText}>{index + 1}</Text>
                    </View>
                    <View style={styles.colInput}>
                      <TextInput 
                        style={styles.numberInput} 
                        keyboardType="numeric" 
                        value={set.reps}
                        onChangeText={(val) => updateSet(set.id, 'reps', val)}
                        placeholder="-"
                        placeholderTextColor="#475569"
                      />
                    </View>
                    <View style={styles.colInput}>
                      <TextInput 
                        style={styles.numberInput} 
                        keyboardType="numeric"
                        value={set.weight}
                        onChangeText={(val) => updateSet(set.id, 'weight', val)}
                        placeholder="-"
                        placeholderTextColor="#475569"
                      />
                    </View>
                    <View style={styles.colAction}>
                      {setsData.length > 1 && (
                        <TouchableOpacity onPress={() => handleRemoveSet(set.id)} style={styles.removeButtonIcon}>
                          <Minus size={20} color="#F8FAFC" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addButton} onPress={handleAddSet}>
                  <Plus size={20} color="#F8FAFC" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.addToWorkoutButton} onPress={handleAddToWorkout}>
                <Text style={styles.addToWorkoutButtonText}>Add to workout</Text>
              </TouchableOpacity>
            </View>

            {/* GIF Search Link */}
            <View style={styles.infoSection}>
              <TouchableOpacity 
                onPress={() => Linking.openURL(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(exercise.name + ' exercise gif')}`)}
              >
                <Text style={{ color: '#A3E635', fontSize: 16, textDecorationLine: 'underline', textAlign: 'center', marginVertical: 8 }}>
                  {exercise.name} exercise gif
                </Text>
              </TouchableOpacity>
            </View>

            {exercise.link && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Instructions:</Text>
                <TouchableOpacity style={styles.linkBox} onPress={openLink}>
                  <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                    {exercise.link}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Notes:</Text>
              <TextInput 
                style={styles.notesInput}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Add your notes here..."
                placeholderTextColor="#64748B"
                textAlignVertical="top"
              />
            </View>
            <View style={{ height: 40 }} />
          </>
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center' }}>Exercise not found.</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
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
  card: {
    backgroundColor: '#2d3039',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  cardHeader: {
    backgroundColor: '#0A0A0A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  cardHeaderTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 16,
  },
  setsContainer: {
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  headerBox: {
    backgroundColor: '#0A0A0A',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colSet: {
    flex: 1,
  },
  colInput: {
    flex: 1.5,
  },
  colAction: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBoxText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  setText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  numberInput: {
    backgroundColor: '#0A0A0A',
    color: '#F8FAFC',
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 16,
  },
  removeButtonIcon: {
    padding: 4,
  },
  addButton: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 12,
  },
  addToWorkoutButton: {
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToWorkoutButtonText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  linkBox: {
    backgroundColor: '#2d3039',
    padding: 16,
    borderRadius: 8,
  },
  linkText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: '#2d3039',
    color: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    minHeight: 120,
    fontSize: 14,
  },
});
