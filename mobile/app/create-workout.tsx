import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ToastAndroid, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Minus } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

export default function CreateWorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [workoutName, setWorkoutName] = useState('');
  const [saving, setSaving] = useState(false);

  const [isNameLocked, setIsNameLocked] = useState(false);
  const [exerciseName, setExerciseName] = useState('');
  const [setsData, setSetsData] = useState([{ id: Date.now().toString(), reps: '', weight: '' }]);

  useEffect(() => {
    const fetchExerciseName = async () => {
      if (!exerciseId) return;
      try {
        const { data } = await supabase
          .from('exercise_library')
          .select('name')
          .eq('id', exerciseId)
          .single();
        
        if (data) {
          setExerciseName(data.name);
        }
      } catch (err) {
        console.error('Failed to fetch exercise name:', err);
      }
    };
    fetchExerciseName();
  }, [exerciseId]);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      console.log(message);
    }
  };

  const handleLockName = () => {
    if (workoutName.trim()) {
      setIsNameLocked(true);
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

  const handleCreate = async () => {
    if (!workoutName.trim() || !user || !exerciseId || saving) return;

    try {
      setSaving(true);

      // 1. Create the workout
      const { data: newWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert([{ 
          name: workoutName.trim(),
          user_id: user.id
        }])
        .select()
        .single();

      if (workoutError) throw workoutError;

      // 2. Add the exercise sets to the newly created workout
      const setsToInsert = setsData.map((set, index) => ({
        workout_id: newWorkout.id, 
        exercise_id: exerciseId,
        sets: index + 1,
        reps: parseInt(set.reps) || 0,
        weight: parseFloat(set.weight) || 0,
        is_done: false
      }));

      const { error: exerciseError } = await supabase
        .from('workout_exercises')
        .insert(setsToInsert);

      if (exerciseError) throw exerciseError;

      showToast('Workout skapad');
      
      // Navigate back to the tabs, dismissing both modals
      router.navigate('/(tabs)/exercises');

    } catch (error) {
      console.error('Error creating workout:', error);
      showToast('Något gick fel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create new workout</Text>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {!isNameLocked ? (
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Name (eg. Back & Core)"
                placeholderTextColor="#94A3B8"
                value={workoutName}
                onChangeText={setWorkoutName}
                autoFocus
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.goButton, (!workoutName.trim()) && styles.goButtonDisabled]}
              onPress={handleLockName}
              disabled={!workoutName.trim()}
            >
              <Text style={styles.goButtonText}>GO!</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.lockedContainer}>
            <View style={styles.inputRow}>
               <View style={styles.inputContainerLocked}>
                  <Text style={styles.lockedNameText}>{workoutName}</Text>
               </View>
            </View>

            <View style={styles.exerciseCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>{exerciseName}</Text>
              </View>

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
                      <TouchableOpacity onPress={() => handleRemoveSet(set.id)} style={styles.removeButton}>
                        <Minus size={20} color="#F8FAFC" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addButton} onPress={handleAddSet}>
                <Plus size={20} color="#F8FAFC" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <Text style={styles.saveButtonText}>Add to workout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  closeButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 4,
    marginRight: 16,
  },
  inputContainerLocked: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    backgroundColor: '#0A0A0A',
  },
  input: {
    color: '#F8FAFC',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lockedContainer: {
    flex: 1,
  },
  lockedNameText: {
    color: '#94A3B8',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  goButton: {
    backgroundColor: '#A3E635',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  goButtonDisabled: {
    opacity: 0.5,
  },
  goButtonText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
  exerciseCard: {
    backgroundColor: '#27272A',
    borderRadius: 8,
    padding: 16,
    marginTop: 32,
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
  removeButton: {
    padding: 4,
  },
  addButton: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#A3E635',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
});
