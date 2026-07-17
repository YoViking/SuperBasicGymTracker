import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Platform, ToastAndroid, Linking, Dimensions, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Minus } from 'lucide-react-native';
import { supabase } from '../../../../src/lib/supabase';
import ExerciseStats from '../../../../src/components/statistics/ExerciseStats';

const { width } = Dimensions.get('window');

interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
  is_done: boolean;
}

export default function WorkoutExerciseDetailScreen() {
  const { workoutId, exerciseId } = useLocalSearchParams<{ workoutId: string, exerciseId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const handleTabPress = (index: number) => {
    setActiveTab(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };
  
  const [setsData, setSetsData] = useState<ExerciseSet[]>([]);
  const [deletedSets, setDeletedSets] = useState<string[]>([]);
  
  const [customName, setCustomName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [notes, setNotes] = useState('');
  const [externalLink, setExternalLink] = useState('');

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
          exercise:exercise_library(name, link)
        `)
        .eq('workout_id', workoutId)
        .eq('exercise_id', exerciseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Sort explicitly by sets number
        const sortedData = data.sort((a, b) => a.sets - b.sets);
        
        setOriginalName(data[0].exercise.name);
        setExternalLink(data[0].exercise.link || '');
        setCustomName(data[0].custom_name || data[0].exercise.name);
        setNotes(data[0].notes || '');
        
        setSetsData(sortedData.map(row => ({
          id: row.id,
          reps: row.reps.toString(),
          weight: row.weight.toString(),
          is_done: row.is_done
        })));
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

  const handleAddSet = () => {
    setSetsData([...setsData, { id: `tmp-${Date.now()}`, reps: '', weight: '', is_done: false }]);
  };

  const handleRemoveSet = (id: string) => {
    if (setsData.length > 1) {
      setDeletedSets([...deletedSets, id]);
      setSetsData(setsData.filter(s => s.id !== id));
    }
  };

  const updateSet = (id: string, field: 'reps' | 'weight', value: string) => {
    setSetsData(setsData.map(set => 
      set.id === id ? { ...set, [field]: value } : set
    ));
  };

  const handleSave = async () => {
    if (!workoutId || !exerciseId || saving) return;

    try {
      setSaving(true);

      // 1. Delete removed sets
      const validDeletedIds = deletedSets.filter(id => !id.startsWith('tmp-'));
      if (validDeletedIds.length > 0) {
        const { error: delError } = await supabase
          .from('workout_exercises')
          .delete()
          .in('id', validDeletedIds);
        if (delError) throw delError;
      }

      // 2. Upsert existing/new sets
      for (let i = 0; i < setsData.length; i++) {
        const set = setsData[i];
        const payload = {
          workout_id: workoutId,
          exercise_id: exerciseId,
          sets: i + 1,
          reps: parseInt(set.reps) || 0,
          weight: parseFloat(set.weight) || 0,
          custom_name: customName.trim() ? customName.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
          is_done: set.is_done
        };

        if (set.id.startsWith('tmp-')) {
          const { error } = await supabase.from('workout_exercises').insert([payload]);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('workout_exercises').update(payload).eq('id', set.id);
          if (error) throw error;
        }
      }

      showToast('Sparad');
      router.back();

    } catch (error) {
      console.error('Error saving exercise:', error);
      showToast('Något gick fel');
    } finally {
      setSaving(false);
    }
  };



  const openLink = () => {
    if (externalLink) {
      Linking.openURL(externalLink);
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
        {/* Custom Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 0 && styles.activeTabButton]}
          onPress={() => handleTabPress(0)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
            Logga
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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{originalName}</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        pagingEnabled 
        keyboardShouldPersistTaps="always"
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
        {/* Logga Tab */}
        <View style={styles.page}>
          <ScrollView style={styles.container} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Main Editor Card */}
        <View style={styles.card}>
          <TextInput
            style={styles.nameInput}
            value={customName}
            onChangeText={setCustomName}
            placeholder="Custom Name"
            placeholderTextColor="#64748B"
          />

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
                    value={set.reps}
                    onChangeText={(val) => updateSet(set.id, 'reps', val)}
                    keyboardType="numeric"
                    placeholder="-"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={styles.colInput}>
                  <TextInput
                    style={styles.numberInput}
                    value={set.weight}
                    onChangeText={(val) => updateSet(set.id, 'weight', val)}
                    keyboardType="numeric"
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

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.disabledButton]} 
              onPress={handleSave} 
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* GIF Search Link */}
        <View style={styles.section}>
          <TouchableOpacity 
            onPress={() => Linking.openURL(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(originalName + ' exercise gif')}`)}
          >
            <Text style={{ color: '#A3E635', fontSize: 16, textDecorationLine: 'underline', textAlign: 'center', marginVertical: 8 }}>
              {originalName} exercise gif
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        {externalLink ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions:</Text>
            <TouchableOpacity style={styles.linkBox} onPress={openLink}>
              <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                {externalLink}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes:</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add personal notes here..."
            placeholderTextColor="#64748B"
            multiline
            textAlignVertical="top"
          />
        </View>
        
          </ScrollView>
        </View>

        {/* Statistik Tab */}
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
    backgroundColor: '#F8FAFC', // white for inactive
    borderRadius: 4,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#A3E635', // Green for active
  },
  tabText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#A3E635',
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
  card: {
    backgroundColor: '#2d3039',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  nameInput: {
    backgroundColor: '#0A0A0A',
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
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
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  section: {
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
    backgroundColor: '#D1D5DB', // Very light grey, per figma (almost white)
    color: '#0A0A0A',
    padding: 16,
    borderRadius: 8,
    minHeight: 120,
    fontSize: 14,
  },
});
