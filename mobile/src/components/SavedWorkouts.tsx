import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, Platform, ToastAndroid } from 'react-native';
import { supabase } from '../lib/supabase';
import { MoreVertical } from 'lucide-react-native';
import { Workout } from '../types';
import { useRouter, useFocusEffect } from 'expo-router';
import WorkoutMenuModal from './WorkoutMenuModal';

export default function SavedWorkouts() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchWorkouts();
    }, [])
  );

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching workouts:', error.message);
        return;
      }

      setWorkouts(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMenu = (workout: Workout) => {
    setSelectedWorkout(workout);
    setMenuVisible(true);
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
    setSelectedWorkout(null);
  };

  const handleDelete = async () => {
    if (!selectedWorkout) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ is_deleted: true })
        .eq('id', selectedWorkout.id);
      
      if (error) throw error;
      setWorkouts(prev => prev.filter(w => w.id !== selectedWorkout.id));
      if (Platform.OS === 'android') ToastAndroid.show('Workout raderad', ToastAndroid.SHORT);
      handleCloseMenu();
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Ett fel inträffade', ToastAndroid.SHORT);
    }
  };

  const handleToggleArchive = async () => {
    if (!selectedWorkout) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ is_archived: true })
        .eq('id', selectedWorkout.id);
      
      if (error) throw error;
      setWorkouts(prev => prev.filter(w => w.id !== selectedWorkout.id));
      if (Platform.OS === 'android') ToastAndroid.show('Borttagen från veckans', ToastAndroid.SHORT);
      handleCloseMenu();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleEdit = () => {
    if (selectedWorkout) {
      router.push(`/workout/edit/${selectedWorkout.id}`);
      handleCloseMenu();
    }
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => {
    const formattedDate = new Date(item.created_at).toISOString().split('T')[0];
    
    return (
      <TouchableOpacity 
        style={styles.workoutCard} 
        activeOpacity={0.7}
        onPress={() => router.push(`/workout/${item.id}`)}
      >
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutTitle}>{item.name}</Text>
          <Text style={styles.workoutDate}>{formattedDate}</Text>
        </View>
        <TouchableOpacity style={styles.menuIconWrapper} onPress={() => handleOpenMenu(item)}>
          <MoreVertical size={20} color="#F8FAFC" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.content, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
      {/* Grey box containing the recent workouts */}
      <View style={styles.greyBox}>
        <Text style={styles.sectionTitle}>Veckans</Text>
        
        {workouts.length === 0 ? (
          <Text style={styles.emptyText}>Inga träningspass hittades.</Text>
        ) : (
          <View>
            {workouts.map((item) => (
              <React.Fragment key={item.id.toString()}>
                {renderWorkoutItem({ item })}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Arkiv button */}
      <TouchableOpacity 
        style={styles.arkivButton}
        activeOpacity={0.7}
        onPress={() => router.push('/archive')}
      >
        <Text style={styles.arkivButtonText}>Arkiv</Text>
      </TouchableOpacity>

      <WorkoutMenuModal
        visible={menuVisible}
        workoutName={selectedWorkout?.name || ''}
        isArchived={false}
        onClose={handleCloseMenu}
        onDelete={handleDelete}
        onToggleArchive={handleToggleArchive}
        onEdit={handleEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  greyBox: {
    backgroundColor: '#2d3039',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  workoutCard: {
    backgroundColor: '#0F1115',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  workoutDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  menuIconWrapper: {
    padding: 8,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
  },
  arkivButton: {
    backgroundColor: '#2d3039',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arkivButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
});
