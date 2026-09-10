import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform, ToastAndroid } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import { getWorkoutExerciseCount, formatExerciseCount } from '../../src/utils/workout';
import { decode } from 'base64-arraybuffer';
import { cacheService } from '../../src/services/cacheService';

export default function FolderScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const folderId = Array.isArray(id) ? id[0] : id;
  const folderName = Array.isArray(name) ? name[0] : name;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const [isScrolled, setIsScrolled] = useState(false);
  
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
            exercise_id,
            order_index,
            created_at,
            exercise:exercise_library (
              id,
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
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
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
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
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
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
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
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
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

      // Invalidate cache immediately so all screens (SavedWorkouts, Home, etc.) reflect the deletion
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');

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
    const exerciseCount = getWorkoutExerciseCount(item);
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
          <Text style={styles.workoutDate}>
            {exerciseCount > 0 ? `${formatExerciseCount(exerciseCount)} • ` : ''}
            {formattedDate}
          </Text>
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
      <View style={styles.programTopSection}>
        <View style={styles.topOverscrollFiller} pointerEvents="none" />
        <LinearGradient
          colors={['#2A303A', '#1E232B', '#13161A', '#0A0A0A']}
          locations={[0, 0.45, 0.8, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
          pointerEvents="none"
        />

        {/* Top Header Row with back arrow and program title */}
        <View style={[styles.header, { paddingTop: (insets.top || 0) + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {currentFolder?.name || folderName || 'Program'}
          </Text>
        </View>

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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A3E635" />
          </View>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderWorkoutItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            onScroll={(e) => {
              const offsetY = e.nativeEvent.contentOffset.y;
              if (offsetY > 40 && !isScrolled) {
                setIsScrolled(true);
              } else if (offsetY <= 40 && isScrolled) {
                setIsScrolled(false);
              }
            }}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Programmet är tomt.</Text>
            }
          />
        )}
      </View>

      {isScrolled && insets.top > 0 && (
        <View style={[styles.statusBarScrolledCover, { height: insets.top }]} pointerEvents="none" />
      )}

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
  programTopSection: {
    width: '100%',
    position: 'relative',
    paddingBottom: 16,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topOverscrollFiller: {
    position: 'absolute',
    top: -600,
    left: 0,
    right: 0,
    height: 600,
    backgroundColor: '#2A303A',
  },
  statusBarScrolledCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0A',
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  workoutCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
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
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  workoutInfo: {
    flex: 1,
    marginLeft: 12,
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
