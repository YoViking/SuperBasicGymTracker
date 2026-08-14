import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Platform, ToastAndroid, Modal, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import { MoreVertical, Folder as FolderIcon, Plus, Sparkles } from 'lucide-react-native';
import { Workout, Folder } from '../types';
import { useRouter, useFocusEffect } from 'expo-router';
import WorkoutMenuModal from './WorkoutMenuModal';
import MoveToFolderModal from './MoveToFolderModal';
import CreateFolderModal from './CreateFolderModal';
import AiProgramWizard from './AiProgramWizard';
import { Image } from 'expo-image';
import { getMuscleGroupImage } from '../utils/images';
import { decode } from 'base64-arraybuffer';

export default function SavedWorkouts() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [aiWizardVisible, setAiWizardVisible] = useState(false);
  const [createOptionsVisible, setCreateOptionsVisible] = useState(false);
  
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchWorkoutsAndFolders();
    }, [])
  );

  const fetchWorkoutsAndFolders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch folders if user exists
      if (user) {
        const { data: foldersData, error: foldersError } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (!foldersError && foldersData) {
          setFolders(foldersData);
        }
      }

      // Fetch active workouts with their exercise_library info
      const { data: workoutsData, error: workoutsError } = await supabase
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
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (workoutsError) {
        console.error('Error fetching workouts:', workoutsError.message);
        return;
      }

      setWorkouts(workoutsData || []);
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
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte radera workout', ToastAndroid.SHORT);
    }
  };

  const handleEdit = () => {
    if (selectedWorkout) {
      handleCloseMenu();
      router.push(`/workout/edit/${selectedWorkout.id}`);
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!selectedWorkout) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ folder_id: folderId })
        .eq('id', selectedWorkout.id);
        
      if (error) throw error;
      
      setWorkouts(prev => prev.map(w => w.id === selectedWorkout.id ? { ...w, folder_id: folderId } : w));
      setMoveModalVisible(false);
      setSelectedWorkout(null);
      if (Platform.OS === 'android') ToastAndroid.show('Flyttad till program', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte flytta workout', ToastAndroid.SHORT);
    }
  };

  const handleCreateFolder = async (name: string, description: string, imageBase64: string | null) => {
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
          if (Platform.OS === 'android') ToastAndroid.show('Kunde inte ladda upp bilden', ToastAndroid.SHORT);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('program-images')
            .getPublicUrl(fileName);
          image_url = publicUrlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('folders')
        .insert([{ name, description, image_url, user_id: user.id }])
        .select()
        .single();
        
      if (error) throw error;
      
      setFolders(prev => [data, ...prev]);
      setCreateModalVisible(false);
      
      // If we had a selected workout, automatically move it to the new program
      if (selectedWorkout) {
        await handleMoveToFolder(data.id);
      }
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte skapa program', ToastAndroid.SHORT);
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
      const fallback = getMuscleGroupImage(undefined);
      images = [fallback, fallback, fallback, fallback];
    }

    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  };

  const renderWorkoutItem = (item: Workout) => {
    const formattedDate = new Date(item.created_at).toISOString().split('T')[0];
    const collage = getCollageImages(item);
    
    return (
      <TouchableOpacity 
        key={item.id.toString()}
        style={styles.workoutCard} 
        activeOpacity={0.7}
        onPress={() => router.push(`/workout/${item.id}`)}
      >
        <View style={styles.collageGrid}>
          <Image source={collage[0]} style={styles.collageImage} />
          <Image source={collage[1]} style={styles.collageImage} />
          <Image source={collage[2]} style={styles.collageImage} />
          <Image source={collage[3]} style={styles.collageImage} />
        </View>
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

  // Workouts without a folder
  const standaloneWorkouts = workouts.filter(w => !w.folder_id);

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
      
      <Text style={styles.headerTitle}>Träning</Text>

      <TouchableOpacity 
        style={styles.skapaButton}
        activeOpacity={0.8}
        onPress={() => setCreateOptionsVisible(true)}
      >
        <Plus size={18} color="#F8FAFC" style={{ marginRight: 6 }} />
        <Text style={styles.skapaButtonText}>Skapa...</Text>
      </TouchableOpacity>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foldersContainer} contentContainerStyle={{ paddingRight: 20 }}>
        {folders.map(folder => {
          return (
            <TouchableOpacity 
              key={folder.id} 
              style={styles.programCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id, name: folder.name } })}
            >
              {folder.image_url ? (
                <Image source={{ uri: folder.image_url }} style={styles.programImageBackground} contentFit="cover" />
              ) : (
                <View style={[styles.programImageBackground, { backgroundColor: '#3F3F46' }]} />
              )}
              <View style={styles.programOverlay}>
                <Text style={styles.programTitle} numberOfLines={1}>{folder.name.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.workoutsContainer}>
        {standaloneWorkouts.length === 0 && folders.length === 0 ? (
          <Text style={styles.emptyText}>Inga träningspass hittades.</Text>
        ) : (
          standaloneWorkouts.map(renderWorkoutItem)
        )}
      </View>

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
        onClose={() => {
          setCreateModalVisible(false);
          if (!selectedWorkout) {
            // Only clear selection if we didn't come from a workout menu
          }
        }}
        onCreate={handleCreateFolder}
      />

      {/* Selection Modal: Manual vs AI */}
      <Modal
        visible={createOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreateOptionsVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOptionsVisible(false)}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsModalTitle}>Skapa nytt program</Text>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setCreateOptionsVisible(false);
                setCreateModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.optionIconBg}>
                <FolderIcon size={22} color="#A3E635" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Skapa manuellt</Text>
                <Text style={styles.optionDesc}>Bygg programmet och lägg till pass för hand</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionItem, styles.optionItemAi]}
              onPress={() => {
                setCreateOptionsVisible(false);
                setAiWizardVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIconBg, styles.optionIconBgAi]}>
                <Sparkles size={22} color="#0A0A0A" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.optionTitleAi]}>Skapa med AI ✨</Text>
                <Text style={styles.optionDesc}>Få ett schema anpassat efter dina mål, skador och utrustning</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <AiProgramWizard
        visible={aiWizardVisible}
        onClose={() => setAiWizardVisible(false)}
        onSaved={fetchWorkoutsAndFolders}
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
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  skapaButton: {
    backgroundColor: '#272A34',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  skapaButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  foldersContainer: {
    marginBottom: 16,
  },
  programCard: {
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  programImageBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  programOverlay: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  programTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  programDescBadge: {
    backgroundColor: '#B9FF3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  programDescText: {
    color: '#0A0A0A',
    fontSize: 10,
    fontWeight: '800',
  },
  workoutsContainer: {
    marginBottom: 16,
  },
  workoutCard: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    marginBottom: 12,
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
    marginVertical: 20,
  },
  arkivButton: {
    backgroundColor: '#3F3F46', // Matched to workout cards
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  arkivButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModalContent: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  optionsModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  optionItemAi: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.02)',
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIconBgAi: {
    backgroundColor: '#A3E635',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionTitleAi: {
    color: '#A3E635',
  },
  optionDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
