import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
  ToastAndroid,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  MoreVertical,
  Folder as FolderIcon,
  Plus,
  Sparkles,
  Dumbbell,
  Layers,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import { Workout, Folder } from '../types';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { decode } from 'base64-arraybuffer';

import WorkoutMenuModal from './WorkoutMenuModal';
import MoveToFolderModal from './MoveToFolderModal';
import CreateFolderModal from './CreateFolderModal';
import EditFolderModal from './EditFolderModal';
import CreateWorkoutModal from './CreateWorkoutModal';
import AiProgramWizard from './AiProgramWizard';
import AiWorkoutWizard from './AiWorkoutWizard';
import CreationChoiceModal from './CreationChoiceModal';

import { getMuscleGroupImage, getDefaultWorkoutImage, isAiFolder, isAiWorkout } from '../utils/images';
import { getWorkoutExerciseCount, formatExerciseCount } from '../utils/workout';
import { cacheService } from '../services/cacheService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 20;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function SavedWorkouts() {
  const router = useRouter();

  // Tab state: 'programs' | 'workouts'
  const [activeTab, setActiveTab] = useState<'programs' | 'workouts'>('programs');

  // Workouts & Folders data
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sub-filter for workouts tab: 'all' | 'standalone'
  const [workoutFilter, setWorkoutFilter] = useState<'all' | 'standalone'>('all');

  // Workouts view mode: 'grid' | 'list'
  const [workoutViewMode, setWorkoutViewMode] = useState<'grid' | 'list'>('grid');

  // Modals state
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [editFolderVisible, setEditFolderVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);

  const [createWorkoutVisible, setCreateWorkoutVisible] = useState(false);
  const [aiProgramWizardVisible, setAiProgramWizardVisible] = useState(false);
  const [aiWorkoutWizardVisible, setAiWorkoutWizardVisible] = useState(false);

  // Choice modal: Manuellt vs Få hjälp av WP Wizard
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);
  const [choiceModalType, setChoiceModalType] = useState<'program' | 'workout'>('program');

  const [menuVisible, setMenuVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  // Map folder ID to folder name for quick lookup in workouts
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  // Workout counts per folder
  const workoutCountsByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    workouts.forEach((w) => {
      if (w.folder_id) {
        counts.set(w.folder_id, (counts.get(w.folder_id) || 0) + 1);
      }
    });
    return counts;
  }, [workouts]);

  const fetchWorkoutsAndFolders = async (force = false) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || 'anon';

      if (!force) {
        // Fast in-memory cache check
        const memCached = cacheService.get<{ workouts: Workout[]; folders: Folder[] }>('workouts', userId);
        if (memCached) {
          const validWorkouts = (memCached.workouts || []).filter((w) => w.user_id === userId);
          const validFolders = (memCached.folders || []).filter((f) => f.user_id === userId);
          setWorkouts(validWorkouts);
          setFolders(validFolders);
          setLoading(false);
          return;
        }

        // Async storage check
        const asyncCached = await cacheService.getAsync<{ workouts: Workout[]; folders: Folder[] }>(
          'workouts',
          userId
        );
        if (asyncCached) {
          const validWorkouts = (asyncCached.workouts || []).filter((w) => w.user_id === userId);
          const validFolders = (asyncCached.folders || []).filter((f) => f.user_id === userId);
          setWorkouts(validWorkouts);
          setFolders(validFolders);
          setLoading(false);
          return;
        }
      }

      if (force) {
        setRefreshing(true);
      } else {
        setLoading(prev => (workouts.length > 0 || folders.length > 0 ? false : true));
      }

      let foldersData: Folder[] = [];
      if (!user) {
        setWorkouts([]);
        setFolders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch folders for user
      const { data: fData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!foldersError && fData) {
        foldersData = fData;
        setFolders(fData);
      }

      // Fetch active workouts for user with their exercise_library info
      const { data: workoutsData, error: workoutsError } = await supabase
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
        .order('created_at', { ascending: false });

      if (workoutsError) {
        console.error('Error fetching workouts:', workoutsError.message);
        return;
      }

      const finalWorkouts = workoutsData || [];
      setWorkouts(finalWorkouts);

      if (user?.id) {
        await cacheService.set('workouts', user.id, { workouts: finalWorkouts, folders: foldersData });
      }
    } catch (error) {
      console.error('Error in fetchWorkoutsAndFolders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkoutsAndFolders(false);
    const unsub = cacheService.subscribe((category) => {
      if (category === 'workouts' || category === 'all') {
        fetchWorkoutsAndFolders(true);
      }
    });
    return unsub;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchWorkoutsAndFolders(false);
    }, [])
  );

  // -------------------------------------------------------------
  // Folder / Program Actions
  // -------------------------------------------------------------
  const handleCreateFolder = async (name: string, description: string, imageBase64: string | null) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      setFolders((prev) => [data, ...prev]);
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      setCreateFolderVisible(false);

      if (Platform.OS === 'android') ToastAndroid.show('Program skapat', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte skapa program', ToastAndroid.SHORT);
    }
  };

  const handleEditFolderSave = async (
    newName: string,
    newDescription: string,
    imageBase64: string | null,
    imageDeleted: boolean
  ) => {
    if (!selectedFolder) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let image_url = selectedFolder.image_url || null;

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
        .eq('id', selectedFolder.id);

      if (user) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;

      setFolders((prev) =>
        prev.map((f) =>
          f.id === selectedFolder.id
            ? { ...f, name: newName, description: newDescription, image_url: image_url || undefined }
            : f
        )
      );

      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      setEditFolderVisible(false);
      setSelectedFolder(null);

      if (Platform.OS === 'android') ToastAndroid.show('Program uppdaterat', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte uppdatera program', ToastAndroid.SHORT);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Disassociate workouts from folder
      let workoutsQuery = supabase
        .from('workouts')
        .update({ folder_id: null })
        .eq('folder_id', selectedFolder.id);

      if (user) workoutsQuery = workoutsQuery.eq('user_id', user.id);
      const { error: workoutsError } = await workoutsQuery;
      if (workoutsError) throw workoutsError;

      // Delete folder
      let folderQuery = supabase.from('folders').delete().eq('id', selectedFolder.id);
      if (user) folderQuery = folderQuery.eq('user_id', user.id);
      const { error } = await folderQuery;
      if (error) throw error;

      setFolders((prev) => prev.filter((f) => f.id !== selectedFolder.id));
      setWorkouts((prev) =>
        prev.map((w) => (w.folder_id === selectedFolder.id ? { ...w, folder_id: null } : w))
      );

      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      setEditFolderVisible(false);
      setSelectedFolder(null);

      if (Platform.OS === 'android') ToastAndroid.show('Program raderat', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte radera program', ToastAndroid.SHORT);
    }
  };

  // -------------------------------------------------------------
  // Workout Actions
  // -------------------------------------------------------------
  const handleCreateWorkout = async (name: string, folderId: string | null) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('workouts')
        .insert([
          {
            name,
            folder_id: folderId,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setCreateWorkoutVisible(false);
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      if (Platform.OS === 'android') ToastAndroid.show('Pass skapat', ToastAndroid.SHORT);

      setWorkouts((prev) => [data, ...prev]);
      router.push(`/workout/edit/${data.id}`);
    } catch (e: any) {
      console.error('Error creating workout:', e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte skapa pass', ToastAndroid.SHORT);
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

  const handleDeleteWorkout = async () => {
    if (!selectedWorkout) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let query = supabase
        .from('workouts')
        .update({ is_deleted: true })
        .eq('id', selectedWorkout.id);

      if (user) query = query.eq('user_id', user.id);

      const { error } = await query;
      if (error) throw error;

      setWorkouts((prev) => prev.filter((w) => w.id !== selectedWorkout.id));
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      if (Platform.OS === 'android') ToastAndroid.show('Pass raderat', ToastAndroid.SHORT);
      handleCloseMenu();
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte radera pass', ToastAndroid.SHORT);
    }
  };

  const handleEditWorkout = () => {
    if (selectedWorkout) {
      handleCloseMenu();
      router.push(`/workout/edit/${selectedWorkout.id}`);
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!selectedWorkout) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let query = supabase
        .from('workouts')
        .update({ folder_id: folderId })
        .eq('id', selectedWorkout.id);

      if (user) query = query.eq('user_id', user.id);

      const { error } = await query;
      if (error) throw error;

      setWorkouts((prev) =>
        prev.map((w) => (w.id === selectedWorkout.id ? { ...w, folder_id: folderId } : w))
      );
      cacheService.invalidate('workouts');
      cacheService.invalidate('home');
      setMoveModalVisible(false);
      setSelectedWorkout(null);
      if (Platform.OS === 'android') ToastAndroid.show('Flyttad till program', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') ToastAndroid.show('Kunde inte flytta pass', ToastAndroid.SHORT);
    }
  };

  // -------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------
  const standaloneWorkouts = useMemo(() => workouts.filter((w) => !w.folder_id), [workouts]);

  const displayedWorkouts = useMemo(() => {
    if (workoutFilter === 'standalone') return standaloneWorkouts;
    return workouts;
  }, [workoutFilter, workouts, standaloneWorkouts]);

  const renderWorkoutItem = (item: Workout) => {
    const formattedDate = new Date(item.created_at).toISOString().split('T')[0];
    const exerciseCount = getWorkoutExerciseCount(item);
    const parentFolderName = item.folder_id ? folderMap.get(item.folder_id) : null;

    return (
      <TouchableOpacity
        key={item.id.toString()}
        style={styles.workoutCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/workout/${item.id}`)}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.workoutThumbnail} contentFit="cover" />
        ) : (
          <Image
            source={getDefaultWorkoutImage(isAiWorkout(item, folders))}
            style={styles.workoutThumbnail}
            contentFit="cover"
          />
        )}

        <View style={styles.workoutInfo}>
          <Text style={styles.workoutTitle} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.workoutMetaRow}>
            {parentFolderName && (
              <View style={styles.programTag}>
                <FolderIcon size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                <Text style={styles.programTagText} numberOfLines={1}>
                  {parentFolderName}
                </Text>
              </View>
            )}
            <Text style={styles.workoutDate}>
              {exerciseCount > 0 ? `${formatExerciseCount(exerciseCount)} • ` : ''}
              {formattedDate}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuIconWrapper}
          onPress={() => handleOpenMenu(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical size={20} color="#94A3B8" />
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
    <View style={styles.container}>
      {/* Header Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Träning</Text>

        {/* Tab Switcher: Program vs Pass */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'programs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('programs')}
            activeOpacity={0.8}
          >
            <Layers
              size={15}
              color={activeTab === 'programs' ? '#0A0A0A' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'programs' && styles.tabButtonTextActive]}>
              Program ({folders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'workouts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('workouts')}
            activeOpacity={0.8}
          >
            <Dumbbell
              size={15}
              color={activeTab === 'workouts' ? '#0A0A0A' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'workouts' && styles.tabButtonTextActive]}>
              Pass ({workouts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchWorkoutsAndFolders(true)}
            tintColor="#A3E635"
            colors={['#A3E635']}
          />
        }
      >
        {/* ========================================================= */}
        {/* TAB 1: PROGRAM (GRID) */}
        {/* ========================================================= */}
        {activeTab === 'programs' && (
          <View>
            {/* Programs 2-Column Grid */}
            <View style={styles.gridContainer}>
              {/* Action Tile: Nytt program */}
              <TouchableOpacity
                style={styles.newActionCard}
                activeOpacity={0.8}
                onPress={() => {
                  setChoiceModalType('program');
                  setChoiceModalVisible(true);
                }}
              >
                <Text style={styles.newActionCardTitle}>Nytt program</Text>
                <Plus size={36} color="#94A3B8" strokeWidth={2.5} />
              </TouchableOpacity>

              {/* Saved Program Folders */}
              {folders.map((folder) => {
                const passCount = workoutCountsByFolder.get(folder.id) || 0;
                const isAi = folder.is_ai || isAiFolder(folder);

                return (
                  <TouchableOpacity
                    key={folder.id}
                    style={styles.gridCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: '/folder/[id]',
                        params: { id: folder.id, name: folder.name },
                      })
                    }
                  >
                    {/* Cover Image */}
                    {folder.image_url && folder.image_url !== 'ai-default' ? (
                      <Image
                        source={{ uri: folder.image_url }}
                        style={styles.gridCardImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Image
                        source={getDefaultWorkoutImage(isAi)}
                        style={styles.gridCardImage}
                        contentFit="cover"
                      />
                    )}

                    {/* Gradient Overlay for Readable Text */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
                      style={styles.gridCardGradient}
                    />

                    {/* Top Badges & Menu */}
                    <View style={styles.gridCardTopRow}>
                      <View style={styles.passCountBadge}>
                        <Text style={styles.passCountText}>
                          {passCount} {passCount === 1 ? 'pass' : 'pass'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.gridCardMenuBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedFolder(folder);
                          setEditFolderVisible(true);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MoreVertical size={16} color="#F8FAFC" />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom Info */}
                    <View style={styles.gridCardBottom}>
                      <Text style={styles.gridCardTitle} numberOfLines={2}>
                        {folder.name.toUpperCase()}
                      </Text>
                      {folder.description ? (
                        <Text style={styles.gridCardDesc} numberOfLines={1}>
                          {folder.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PASS (WORKOUTS GRID / LIST) */}
        {/* ========================================================= */}
        {activeTab === 'workouts' && (
          <View>
            {/* Sub-filter chips: All vs Standalone & View toggle */}
            <View style={styles.filterRow}>
              <View style={styles.filterChipsLeft}>
                <TouchableOpacity
                  style={[styles.filterChip, workoutFilter === 'all' && styles.filterChipActive]}
                  onPress={() => setWorkoutFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.filterChipText, workoutFilter === 'all' && styles.filterChipTextActive]}
                  >
                    Alla pass ({workouts.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    workoutFilter === 'standalone' && styles.filterChipActive,
                  ]}
                  onPress={() => setWorkoutFilter('standalone')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      workoutFilter === 'standalone' && styles.filterChipTextActive,
                    ]}
                  >
                    Fristående ({standaloneWorkouts.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* View toggle (Grid / List) */}
              <View style={styles.viewToggleGroup}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, workoutViewMode === 'grid' && styles.viewToggleBtnActive]}
                  onPress={() => setWorkoutViewMode('grid')}
                  activeOpacity={0.7}
                >
                  <LayoutGrid size={16} color={workoutViewMode === 'grid' ? '#A3E635' : '#64748B'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, workoutViewMode === 'list' && styles.viewToggleBtnActive]}
                  onPress={() => setWorkoutViewMode('list')}
                  activeOpacity={0.7}
                >
                  <List size={16} color={workoutViewMode === 'list' ? '#A3E635' : '#64748B'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Grid View */}
            {workoutViewMode === 'grid' ? (
              <View style={styles.gridContainer}>
                {/* Action Tile: Nytt pass */}
                <TouchableOpacity
                  style={styles.newActionCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setChoiceModalType('workout');
                    setChoiceModalVisible(true);
                  }}
                >
                  <Text style={styles.newActionCardTitle}>Nytt pass</Text>
                  <Plus size={36} color="#94A3B8" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Workouts Grid */}
                {displayedWorkouts.map((workout) => {
                  const isAi = isAiWorkout(workout, folders);
                  const exerciseCount = getWorkoutExerciseCount(workout);
                  const parentFolderName = workout.folder_id ? folderMap.get(workout.folder_id) : null;
                  const formattedDate = new Date(workout.created_at).toISOString().split('T')[0];

                  return (
                    <TouchableOpacity
                      key={workout.id.toString()}
                      style={styles.gridCard}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/workout/${workout.id}`)}
                    >
                      {/* Cover Image */}
                      {workout.image_url ? (
                        <Image
                          source={{ uri: workout.image_url }}
                          style={styles.gridCardImage}
                          contentFit="cover"
                        />
                      ) : (
                        <Image
                          source={getDefaultWorkoutImage(isAi)}
                          style={styles.gridCardImage}
                          contentFit="cover"
                        />
                      )}

                      {/* Gradient Overlay for Readable Text */}
                      <LinearGradient
                        colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']}
                        style={styles.gridCardGradient}
                      />

                      {/* Top Badges & Menu */}
                      <View style={styles.gridCardTopRow}>
                        <View style={styles.passCountBadge}>
                          <Text style={styles.passCountText}>
                            {formatExerciseCount(exerciseCount)}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.gridCardMenuBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOpenMenu(workout);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MoreVertical size={16} color="#F8FAFC" />
                        </TouchableOpacity>
                      </View>

                      {/* Bottom Info */}
                      <View style={styles.gridCardBottom}>
                        {parentFolderName && (
                          <View style={[styles.programTag, { marginBottom: 4 }]}>
                            <FolderIcon size={9} color="#38BDF8" style={{ marginRight: 3 }} />
                            <Text style={styles.programTagText} numberOfLines={1}>
                              {parentFolderName}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.gridCardTitle} numberOfLines={2}>
                          {workout.name.toUpperCase()}
                        </Text>
                        <Text style={styles.gridCardDesc} numberOfLines={1}>
                          {formattedDate}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              /* List View */
              <View style={styles.workoutsList}>
                {/* List Action: Nytt pass */}
                <TouchableOpacity
                  style={styles.newWorkoutListCard}
                  onPress={() => {
                    setChoiceModalType('workout');
                    setChoiceModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Plus size={18} color="#A3E635" style={{ marginRight: 8 }} />
                  <Text style={styles.newWorkoutListCardText}>Nytt pass</Text>
                </TouchableOpacity>

                {displayedWorkouts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconCircle}>
                      <Dumbbell size={32} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>Inga träningspass hittades</Text>
                  </View>
                ) : (
                  displayedWorkouts.map(renderWorkoutItem)
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* 0. Creation Choice Modal (Manuellt vs Få hjälp av WP Wizard) */}
      <CreationChoiceModal
        visible={choiceModalVisible}
        type={choiceModalType}
        onClose={() => setChoiceModalVisible(false)}
        onSelectManual={() => {
          if (choiceModalType === 'program') {
            setCreateFolderVisible(true);
          } else {
            setCreateWorkoutVisible(true);
          }
        }}
        onSelectAiWizard={() => {
          if (choiceModalType === 'program') {
            setAiProgramWizardVisible(true);
          } else {
            setAiWorkoutWizardVisible(true);
          }
        }}
      />

      {/* 1. Manual Program (Folder) Creation */}
      <CreateFolderModal
        visible={createFolderVisible}
        onClose={() => setCreateFolderVisible(false)}
        onCreate={handleCreateFolder}
      />

      {/* 2. Edit Program (Folder) Modal */}
      <EditFolderModal
        visible={editFolderVisible}
        folder={selectedFolder}
        onClose={() => {
          setEditFolderVisible(false);
          setSelectedFolder(null);
        }}
        onSave={handleEditFolderSave}
        onDelete={handleDeleteFolder}
      />

      {/* 3. AI Program Wizard (Full Program Generation) */}
      <AiProgramWizard
        visible={aiProgramWizardVisible}
        onClose={() => setAiProgramWizardVisible(false)}
        onSaved={() => fetchWorkoutsAndFolders(true)}
      />

      {/* 4. Manual Workout Creation */}
      <CreateWorkoutModal
        visible={createWorkoutVisible}
        folders={folders}
        onClose={() => setCreateWorkoutVisible(false)}
        onCreate={handleCreateWorkout}
      />

      {/* 5. AI Workout Wizard (Single Workout Session Generation) */}
      <AiWorkoutWizard
        visible={aiWorkoutWizardVisible}
        folders={folders}
        onClose={() => setAiWorkoutWizardVisible(false)}
        onSaved={() => fetchWorkoutsAndFolders(true)}
      />

      {/* 6. Workout Action Menu Modal */}
      <WorkoutMenuModal
        visible={menuVisible}
        workoutName={selectedWorkout?.name || ''}
        onClose={handleCloseMenu}
        onDelete={handleDeleteWorkout}
        onMoveToFolder={() => {
          setMenuVisible(false);
          setMoveModalVisible(true);
        }}
        onEdit={handleEditWorkout}
      />

      {/* 7. Move Workout to Folder Modal */}
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
          setCreateFolderVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#A3E635',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#0A0A0A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#22252F',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#303442',
  },
  primaryActionButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  aiActionButton: {
    flex: 1,
    backgroundColor: 'rgba(163, 230, 53, 0.09)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A3E635',
  },
  aiActionButtonText: {
    color: '#A3E635',
    fontSize: 14,
    fontWeight: '800',
  },
  aiFullActionButton: {
    flex: 1,
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A3E635',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: GRID_GAP,
  },
  newActionCard: {
    width: CARD_WIDTH,
    height: 165,
    borderRadius: 16,
    backgroundColor: '#22252F',
    borderWidth: 1.5,
    borderColor: '#303442',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  newActionCardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
    height: 165,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  gridCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gridCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gridCardTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardMenuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  passCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  passCountText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  gridCardBottom: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  gridCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 2,
  },
  gridCardDesc: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterChipsLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 4,
  },
  viewToggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
  },
  viewToggleBtnActive: {
    backgroundColor: '#27272A',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterChipActive: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#A3E635',
    fontWeight: '700',
  },
  newWorkoutListCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#303442',
    borderStyle: 'dashed',
  },
  newWorkoutListCardText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  workoutsList: {
    paddingBottom: 20,
  },
  workoutCard: {
    backgroundColor: '#121215',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222226',
  },
  workoutThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  workoutInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 6,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 5,
  },
  workoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  programTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 140,
  },
  programTagText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  workoutDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  menuIconWrapper: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptySmallBtn: {
    backgroundColor: '#272A34',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptySmallBtnAi: {
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    borderWidth: 1,
    borderColor: '#A3E635',
  },
  emptySmallBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
