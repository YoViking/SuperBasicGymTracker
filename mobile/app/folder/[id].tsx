import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Workout, Folder } from '../../src/types';
import WorkoutMenuModal from '../../src/components/WorkoutMenuModal';
import MoveToFolderModal from '../../src/components/MoveToFolderModal';
import CreateFolderModal from '../../src/components/CreateFolderModal';

export default function FolderScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const folderId = Array.isArray(id) ? id[0] : id;
  const folderName = Array.isArray(name) ? name[0] : name;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (folderId) {
      fetchData();
    }
  }, [folderId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: foldersData } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (foldersData) setFolders(foldersData);
      }

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching folder workouts:', error);
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

  const handleMoveToFolder = async (newFolderId: string) => {
    if (!selectedWorkout) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ folder_id: newFolderId })
        .eq('id', selectedWorkout.id);
      
      if (error) throw error;
      
      // If we moved it to a DIFFERENT folder, remove it from this list
      if (newFolderId !== folderId) {
         setWorkouts(prev => prev.filter(w => w.id !== selectedWorkout.id));
      }
      
      if (Platform.OS === 'android') ToastAndroid.show('Flyttad till mapp', ToastAndroid.SHORT);
      setMoveModalVisible(false);
      setSelectedWorkout(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('folders')
        .insert([{ name: folderName, user_id: user.id }])
        .select()
        .single();
        
      if (error) throw error;
      
      setFolders(prev => [data, ...prev]);
      setCreateModalVisible(false);
      
      if (selectedWorkout) {
        await handleMoveToFolder(data.id);
      }
    } catch (e: any) {
      console.error(e);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{folderName || 'Mapp'}</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderWorkoutItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Mappen är tom.</Text>
            }
          />
        )}
      </View>

      <WorkoutMenuModal
        visible={menuVisible}
        workoutName={selectedWorkout?.name || ''}
        onClose={handleCloseMenu}
        onDelete={handleDelete}
        onMoveToFolder={() => {
          setMenuVisible(false);
          setMoveModalVisible(true);
        }}
        onEdit={handleEdit}
      />

      <MoveToFolderModal
        visible={moveModalVisible}
        folders={folders}
        onClose={() => {
          setMoveModalVisible(false);
          setSelectedWorkout(null);
        }}
        onSelectFolder={handleMoveToFolder}
        onCreateNew={() => {
          setMoveModalVisible(false);
          setCreateModalVisible(true);
        }}
      />

      <CreateFolderModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateFolder}
      />
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
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 40,
  },
  workoutCard: {
    backgroundColor: '#3F3F46', // Matched to Figma
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
    marginTop: 40,
  },
});
