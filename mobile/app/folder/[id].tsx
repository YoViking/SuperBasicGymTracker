import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MoreVertical, Pencil, Dumbbell } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Workout, Folder } from '../../src/types';
import WorkoutMenuModal from '../../src/components/WorkoutMenuModal';
import MoveToFolderModal from '../../src/components/MoveToFolderModal';
import CreateFolderModal from '../../src/components/CreateFolderModal';
import EditFolderModal from '../../src/components/EditFolderModal';
import { Image } from 'expo-image';
import { getMuscleGroupImage, getDefaultWorkoutImage, isAiFolder, isAiWorkout } from '../../src/utils/images';
import { decode } from 'base64-arraybuffer';

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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const currentFolder = folders.find(f => f.id === folderId) || null;

  useEffect(() => {
    if (folderId) {
      fetchData();
    }
  }, [folderId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setWorkouts([]);
        setFolders([]);
        setLoading(false);
        return;
      }

      const { data: foldersData } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (foldersData) setFolders(foldersData);

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            order_index,
            created_at,
            exercise:exercise_library (
              gifUrl,
              muscle_group
            )
          )
        `)
        .eq('user_id', user.id)
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
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from('workouts')
        .update({ is_deleted: true })
        .eq('id', selectedWorkout.id);

      if (user) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      
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
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from('workouts')
        .update({ folder_id: newFolderId })
        .eq('id', selectedWorkout.id);

      if (user) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      
      if (error) throw error;
      
      // If we moved it to a DIFFERENT folder, remove it from this list
      if (newFolderId !== folderId) {
         setWorkouts(prev => prev.filter(w => w.id !== selectedWorkout.id));
      }
      if (Platform.OS === 'android') ToastAndroid.show('Flyttad till program', ToastAndroid.SHORT);
      setMoveModalVisible(false);
      setSelectedWorkout(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCreateFolder = async (folderName: string, description: string, imageBase64: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let image_url = null;
      if (imageBase64) {
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('program-images')
          .upload(fileName, decode(imageBase64), {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('program-images')
            .getPublicUrl(fileName);
          image_url = publicUrlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('folders')
        .insert([{ name: folderName, description, image_url, user_id: user.id }])
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

  const handleSaveFolder = async (newName: string, newDescription: string, imageBase64: string | null, imageDeleted: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let image_url = currentFolder?.image_url || null;

      if (imageDeleted) {
        image_url = null;
      } else if (imageBase64) {
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('program-images')
          .upload(fileName, decode(imageBase64), {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('program-images')
            .getPublicUrl(fileName);
          image_url = publicUrlData.publicUrl;
        }
      }

      let query = supabase
        .from('folders')
        .update({ name: newName, description: newDescription, image_url })
        .eq('id', folderId);

      if (user) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;

      if (error) throw error;

      // Update local state
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName, description: newDescription, image_url: image_url || undefined } : f));
      setEditModalVisible(false);
      if (Platform.OS === 'android') ToastAndroid.show('Programmet har uppdaterats', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte uppdatera program', ToastAndroid.SHORT);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 1. Update workouts to disassociate them from this folder
      let workoutsQuery = supabase
        .from('workouts')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      if (user) {
        workoutsQuery = workoutsQuery.eq('user_id', user.id);
      }

      const { error: workoutsError } = await workoutsQuery;

      if (workoutsError) throw workoutsError;

      // 2. Delete the folder from folders table
      let folderQuery = supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (user) {
        folderQuery = folderQuery.eq('user_id', user.id);
      }

      const { error: folderError } = await folderQuery;

      if (folderError) throw folderError;

      // 3. Update local state
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setEditModalVisible(false);

      if (Platform.OS === 'android') {
        ToastAndroid.show('Programmet har raderats', ToastAndroid.SHORT);
      }
      
      router.back();
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte radera programmet', ToastAndroid.SHORT);
      }
    }
  };

  const getCollageImages = (workout: Workout) => {
    const exercises = workout.workout_exercises || [];
    const sorted = [...exercises].sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return (a.order_index || 0) - (b.order_index || 0);
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    let images = sorted.map((we) => {
      const ex = we.exercise;
      if (!ex) return null;
      return ex.gifUrl ? { uri: ex.gifUrl } : getMuscleGroupImage(ex.muscle_group);
    }).filter(Boolean) as any[];

    if (images.length === 0) {
      return [];
    }

    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => {
    const formattedDate = new Date(item.created_at).toISOString().split('T')[0];
    const collage = getCollageImages(item);
    
    return (
      <TouchableOpacity 
        style={styles.workoutCard} 
        activeOpacity={0.7}
        onPress={() => router.push(`/workout/${item.id}`)}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.defaultThumbnail} contentFit="cover" />
        ) : (
          <Image
            source={getDefaultWorkoutImage(isAiWorkout(item, folders))}
            style={styles.defaultThumbnail}
            contentFit="cover"
          />
        )}
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

  const renderHeader = () => {
    if (!currentFolder) return null;
    return (
      <View style={styles.programHeaderContainer}>
        <View style={styles.imageWrapper}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setEditModalVisible(true)} style={styles.programImageCard}>
            {currentFolder.image_url && currentFolder.image_url !== 'ai-default' ? (
              <Image source={{ uri: currentFolder.image_url }} style={styles.programImage} contentFit="cover" />
            ) : (
              <Image
                source={getDefaultWorkoutImage(isAiFolder(currentFolder))}
                style={styles.programImage}
                contentFit="cover"
              />
            )}
            <View style={styles.imageOverlay}>
              <Text style={styles.imageTitle}>{currentFolder.name.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editIconWrapper} onPress={() => setEditModalVisible(true)}>
            <Pencil size={14} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
        {currentFolder.description ? (
          <Text style={styles.programDescription}>{currentFolder.description}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentFolder?.name || folderName || 'Program'}</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderWorkoutItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Programmet är tomt.</Text>
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

      <EditFolderModal
        visible={editModalVisible}
        folder={currentFolder}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveFolder}
        onDelete={handleDeleteFolder}
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
    backgroundColor: 'transparent',
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  collageGrid: {
    width: 48,
    height: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#18181B',
  },
  collageImage: {
    width: 24,
    height: 24,
    backgroundColor: '#18181B',
    borderWidth: 0.5,
    borderColor: '#0A0A0A',
  },
  emptyThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  workoutInfo: {
    flex: 1,
    marginLeft: 16,
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
  programHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  programImageCard: {
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  programImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
  },
  imageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  editIconWrapper: {
    position: 'absolute',
    bottom: 0,
    right: -8,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  programDescription: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
});
