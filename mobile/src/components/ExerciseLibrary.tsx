import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  ToastAndroid,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import {
  Search,
  MoreVertical,
  Plus,
  Dumbbell,
  Bookmark,
  EyeOff,
  X,
  Trophy,
  SlidersHorizontal,
  Check,
} from 'lucide-react-native';
import { ExerciseLibrary as Exercise } from '../types';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBookmarks } from '../hooks/useBookmarks';
import { useWorkoutSession } from '../context/WorkoutSessionContext';
import { cacheService } from '../services/cacheService';
import {
  getExerciseTarget,
  getSubMusclesForGroup,
  normalizeTargetKey,
  TARGET_DISPLAY_SV,
} from '../utils/muscleHierarchy';
import { getMuscleCardImage } from '../utils/images';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Glutes', 'Other', 'Bookmarked'];

const MUSCLE_GROUP_DISPLAY: Record<string, string> = {
  All: 'Alla',
  Alla: 'Alla',
  Chest: 'Bröst',
  Back: 'Rygg',
  Legs: 'Ben',
  Arms: 'Armar',
  Shoulders: 'Axlar',
  Core: 'Core',
  Glutes: 'Glutes',
  Other: 'Övrigt',
  Bookmarked: 'Bokmärkta',
  Bröst: 'Bröst',
  Rygg: 'Rygg',
  Ben: 'Ben',
  Armar: 'Armar',
  Axlar: 'Axlar',
};

const CATEGORY_MUSCLE_GROUPS = [
  { id: 'Chest', label: 'Bröst', sub: 'Pectoralis' },
  { id: 'Back', label: 'Rygg', sub: 'Lats, Traps m.fl.' },
  { id: 'Legs', label: 'Ben', sub: 'Framsida, Baksida, Vader' },
  { id: 'Arms', label: 'Armar', sub: 'Biceps, Triceps, Underarmar' },
  { id: 'Shoulders', label: 'Axlar', sub: 'Deltoideus' },
  { id: 'Core', label: 'Core / Mage', sub: 'Abdominals' },
  { id: 'Glutes', label: 'Glutes / Rumpa', sub: 'Sätesmuskler' },
  { id: 'Other', label: 'Övrigt', sub: 'Nacke, Adduktorer' },
  { id: 'Bookmarked', label: 'Bokmärkta', sub: 'Dina favoriter' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'All', label: 'Alla' },
  { id: 'Barbell', label: 'Skivstång' },
  { id: 'Dumbbell', label: 'Hantlar' },
  { id: 'Machine', label: 'Maskin' },
  { id: 'Cable', label: 'Kabel' },
  { id: 'Bodyweight', label: 'Kroppsvikt' },
  { id: 'Kettlebell', label: 'Kettlebell' },
  { id: 'Bands', label: 'Gummiband' },
  { id: 'Other', label: 'Övrigt' },
];

const matchesEquipmentFilter = (exercise: Exercise, filter: string): boolean => {
  if (filter === 'All' || filter === 'Alla') return true;
  const eq = (exercise.equipment || '').toLowerCase().trim();

  switch (filter) {
    case 'Barbell':
      return eq === 'barbell' || eq === 'e-z curl bar';
    case 'Dumbbell':
      return eq === 'dumbbell';
    case 'Machine':
      return eq === 'machine';
    case 'Cable':
      return eq === 'cable';
    case 'Bodyweight':
      return eq === 'body only';
    case 'Kettlebell':
      return eq === 'kettlebells' || eq === 'kettlebell';
    case 'Bands':
      return eq === 'bands' || eq === 'band';
    case 'Other':
      return (
        !eq ||
        eq === 'other' ||
        eq === 'foam roll' ||
        eq === 'exercise ball' ||
        eq === 'medicine ball' ||
        !['barbell', 'e-z curl bar', 'dumbbell', 'machine', 'cable', 'body only', 'kettlebells', 'kettlebell', 'bands', 'band'].includes(eq)
      );
    default:
      return true;
  }
};

const formatEquipmentLabel = (eq?: string): string => {
  if (!eq) return '';
  const clean = eq.toLowerCase().trim();
  switch (clean) {
    case 'body only':
      return 'Kroppsvikt';
    case 'barbell':
      return 'Skivstång';
    case 'dumbbell':
      return 'Hantlar';
    case 'machine':
      return 'Maskin';
    case 'cable':
      return 'Kabel';
    case 'e-z curl bar':
      return 'EZ Bar';
    case 'kettlebells':
    case 'kettlebell':
      return 'Kettlebell';
    case 'bands':
    case 'band':
      return 'Gummiband';
    case 'foam roll':
      return 'Foam Roll';
    case 'exercise ball':
      return 'Träningsboll';
    case 'medicine ball':
      return 'Medicinboll';
    default:
      return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
};

export type ExerciseLibraryMode = 'default' | 'replace' | 'quick_start' | 'add_to_workout' | 'add_to_template';

interface ExerciseLibraryProps {
  replaceMode?: boolean;
  mode?: ExerciseLibraryMode;
  defaultFilter?: string;
  defaultSubFilter?: string;
  onReplaceSelect?: (exercise: Exercise) => void;
}

export default function ExerciseLibrary({
  replaceMode = false,
  mode,
  defaultFilter = 'All',
  defaultSubFilter,
  onReplaceSelect,
}: ExerciseLibraryProps = {}) {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ mode?: string; t?: string; target_workout_id?: string }>();
  const { startQuickWorkout, addExerciseToActiveWorkout, isSaving, activeExercise, isPlayerExpanded } = useWorkoutSession();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const lastToastTimestamp = useRef<string | null>(null);

  const showToast = useCallback((message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      setToastMessage(message);
      toastAnim.setValue(0);
      Animated.sequence([
        Animated.timing(toastAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastMessage(null);
      });
    }
  }, [toastAnim]);

  const [activeMode, setActiveMode] = useState<ExerciseLibraryMode>(() => {
    if (mode) return mode;
    if (replaceMode) return 'replace';
    if (searchParams.mode === 'quick_start') return 'quick_start';
    if (searchParams.mode === 'add_to_workout') return 'add_to_workout';
    if (searchParams.mode === 'add_to_template') return 'add_to_template';
    return 'default';
  });

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
    } else if (replaceMode) {
      setActiveMode('replace');
    } else if (searchParams.mode === 'quick_start') {
      setActiveMode('quick_start');
    } else if (searchParams.mode === 'add_to_workout') {
      setActiveMode('add_to_workout');
    } else if (searchParams.mode === 'add_to_template') {
      setActiveMode('add_to_template');
    } else {
      setActiveMode('default');
    }
  }, [mode, replaceMode, searchParams.mode]);

  useEffect(() => {
    const isSpecialSelect =
      (activeMode === 'quick_start' && searchParams.mode === 'quick_start') ||
      (activeMode === 'add_to_template' && searchParams.mode === 'add_to_template');

    if (isSpecialSelect) {
      const currentT = searchParams.t || 'initial';
      if (lastToastTimestamp.current !== currentT) {
        lastToastTimestamp.current = currentT;
        showToast(
          activeMode === 'add_to_template'
            ? 'Välj en övning att lägga till i passet'
            : 'Välj en övning för att starta passet'
        );
      }
    } else {
      lastToastTimestamp.current = null;
    }
  }, [activeMode, searchParams.mode, searchParams.t, showToast]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMuscleFilter, setActiveMuscleFilter] = useState(defaultFilter);
  const [activeSubFilter, setActiveSubFilter] = useState<string>(
    defaultSubFilter ? normalizeTargetKey(defaultSubFilter) : 'All'
  );
  const [activeEquipmentFilter, setActiveEquipmentFilter] = useState('All');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Control whether we are in 'filters' view (selecting muscle group / equipment) or 'exercises' view
  const [viewMode, setViewMode] = useState<'filters' | 'exercises'>(() => {
    if ((defaultFilter && defaultFilter !== 'All' && defaultFilter !== 'Alla') || replaceMode) {
      return 'exercises';
    }
    return 'filters';
  });

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    if (defaultFilter && defaultFilter !== 'All') {
      setActiveMuscleFilter(defaultFilter);
      setViewMode('exercises');
    }
  }, [defaultFilter]);

  useEffect(() => {
    if (defaultSubFilter) {
      setActiveSubFilter(normalizeTargetKey(defaultSubFilter));
    }
  }, [defaultSubFilter]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .order('name', { ascending: true })
        .limit(3000);

      if (error) {
        console.error('Error fetching exercises:', error.message);
        return;
      }

      const enriched = (data || []).map((ex: Exercise) => {
        const info = getExerciseTarget(ex.id, ex.name);
        const target = ex.target_muscle || info.target;
        return {
          ...ex,
          target_muscle: target,
          target_muscle_sv: ex.target_muscle_sv || TARGET_DISPLAY_SV[target] || info.targetSv,
          muscle_group: ex.muscle_group || info.mainGroup,
        };
      });

      setExercises(enriched);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMuscleSelect = (group: string) => {
    if (activeMuscleFilter === group) {
      setActiveMuscleFilter('All');
      setActiveSubFilter('All');
    } else {
      setActiveMuscleFilter(group);
      setActiveSubFilter('All');
    }
    // Note: User stays in filter view! Does NOT automatically switch away.
  };

  const handleSubMuscleSelect = (subId: string) => {
    if (activeSubFilter === subId) {
      setActiveSubFilter('All');
    } else {
      setActiveSubFilter(subId);
    }
  };

  const handleEquipmentSelect = (eqId: string) => {
    if (activeEquipmentFilter === eqId) {
      setActiveEquipmentFilter('All');
    } else {
      setActiveEquipmentFilter(eqId);
    }
    // Note: User stays in filter view! Does NOT automatically switch away.
  };

  const handleResetFilters = () => {
    setActiveMuscleFilter('All');
    setActiveSubFilter('All');
    setActiveEquipmentFilter('All');
    setSearchQuery('');
  };

  const currentSubMuscles = useMemo(() => {
    if (activeMuscleFilter === 'All' || activeMuscleFilter === 'Alla' || activeMuscleFilter === 'Bookmarked') {
      return [];
    }
    const subs = getSubMusclesForGroup(activeMuscleFilter);
    // Om det bara finns 1 (eller 0) submuskel, t.ex. Bröst -> Bröst, är det överflödigt att visa subfilter
    if (subs.length <= 1) {
      return [];
    }
    return subs;
  }, [activeMuscleFilter]);

  const isMuscleGroupActive = (group: string) => {
    if (activeMuscleFilter === group) return true;
    if (group === 'All' && (activeMuscleFilter === 'Alla' || !activeMuscleFilter)) return true;
    if (MUSCLE_GROUP_DISPLAY[group] && MUSCLE_GROUP_DISPLAY[group] === activeMuscleFilter) return true;
    if (MUSCLE_GROUP_DISPLAY[activeMuscleFilter] && MUSCLE_GROUP_DISPLAY[activeMuscleFilter] === group) return true;
    return false;
  };

  // Calculate active filter count for the search bar filter holder badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla') count += 1;
    if (activeSubFilter !== 'All' && activeSubFilter !== 'Alla') count += 1;
    if (activeEquipmentFilter !== 'All' && activeEquipmentFilter !== 'Alla') count += 1;
    return count;
  }, [activeMuscleFilter, activeSubFilter, activeEquipmentFilter]);

  const hasActiveFilters = activeFilterCount > 0;

  const isMiniPlayerActive = Boolean(
    activeExercise &&
    !isPlayerExpanded &&
    activeMode !== 'add_to_workout' &&
    searchParams.mode !== 'add_to_workout'
  );

  const filteredSections = useMemo(() => {
    let filtered = exercises;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
    }

    if (activeMuscleFilter === 'Bookmarked') {
      filtered = filtered.filter(e => isBookmarked(e.id));
    } else if (activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla') {
      filtered = filtered.filter(e => {
        const g = e.muscle_group || 'Other';
        return g === activeMuscleFilter || MUSCLE_GROUP_DISPLAY[g] === activeMuscleFilter;
      });
    }

    if (activeSubFilter !== 'All' && activeSubFilter !== 'Alla') {
      const targetQuery = activeSubFilter.toLowerCase().trim();
      filtered = filtered.filter(e => {
        const t = (e.target_muscle || '').toLowerCase().trim();
        return t === targetQuery;
      });
    }

    if (activeEquipmentFilter !== 'All' && activeEquipmentFilter !== 'Alla') {
      filtered = filtered.filter(e => matchesEquipmentFilter(e, activeEquipmentFilter));
    }

    const isSingleMainGroup =
      activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla' && activeMuscleFilter !== 'Bookmarked';

    const grouped = filtered.reduce((acc, curr) => {
      let groupTitle = '';
      if (isSingleMainGroup && curr.target_muscle_sv) {
        groupTitle = curr.target_muscle_sv;
      } else {
        const rawGroup = curr.muscle_group || 'Other';
        groupTitle = MUSCLE_GROUP_DISPLAY[rawGroup] || rawGroup;
      }

      if (!acc[groupTitle]) {
        acc[groupTitle] = [];
      }
      acc[groupTitle].push(curr);
      return acc;
    }, {} as Record<string, Exercise[]>);

    return Object.keys(grouped)
      .map(key => ({
        title: key,
        data: grouped[key],
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [exercises, searchQuery, activeMuscleFilter, activeSubFilter, activeEquipmentFilter, isBookmarked]);

  const totalFilteredCount = useMemo(() => {
    return filteredSections.reduce((sum, s) => sum + s.data.length, 0);
  }, [filteredSections]);

  const removeIndividualFilter = (type: 'muscle' | 'sub' | 'equipment') => {
    if (type === 'muscle') {
      setActiveMuscleFilter('All');
      setActiveSubFilter('All');
      if (
        (activeEquipmentFilter === 'All' || activeEquipmentFilter === 'Alla') &&
        !searchQuery.trim()
      ) {
        setViewMode('filters');
      }
    } else if (type === 'sub') {
      setActiveSubFilter('All');
    } else if (type === 'equipment') {
      setActiveEquipmentFilter('All');
      if (
        (activeMuscleFilter === 'All' || activeMuscleFilter === 'Alla') &&
        !searchQuery.trim()
      ) {
        setViewMode('filters');
      }
    }
  };

  const openMenu = (exercise: Exercise) => {
    if (replaceMode && onReplaceSelect) {
      onReplaceSelect(exercise);
    } else {
      setSelectedExercise(exercise);
    }
  };

  const closeMenu = () => {
    setSelectedExercise(null);
  };

  const navigateToDetail = () => {
    if (selectedExercise) {
      router.push(`/exercise/${selectedExercise.id}`);
      closeMenu();
    }
  };

  const handleCardPress = async (exercise: Exercise) => {
    if (activeMode === 'quick_start') {
      setActiveMode('default');
      router.setParams({ mode: 'default' });
      await startQuickWorkout(exercise);
    } else if (activeMode === 'add_to_workout') {
      setActiveMode('default');
      router.setParams({ mode: 'default' });
      await addExerciseToActiveWorkout(exercise);
      router.back();
    } else if (activeMode === 'add_to_template' && searchParams.target_workout_id) {
      const workoutId = searchParams.target_workout_id;
      setActiveMode('default');
      router.setParams({ mode: 'default', target_workout_id: undefined });

      try {
        const { data: existing } = await supabase
          .from('workout_exercises')
          .select('order_index')
          .eq('workout_id', workoutId)
          .order('order_index', { ascending: false })
          .limit(1);

        const nextOrderIndex = existing && existing.length > 0 ? (existing[0].order_index ?? 0) + 1 : 0;

        const setsToInsert = [1, 2, 3].map(setNum => ({
          workout_id: workoutId,
          exercise_id: exercise.id,
          sets: setNum,
          reps: 10,
          weight: 0,
          is_done: false,
          order_index: nextOrderIndex,
        }));

        const { error: insError } = await supabase
          .from('workout_exercises')
          .insert(setsToInsert);

        if (insError) throw insError;

        cacheService.invalidate('workouts');
        if (Platform.OS === 'android') {
          ToastAndroid.show(`${exercise.name} tillagd i passet!`, ToastAndroid.SHORT);
        }

        router.replace(`/workout/edit/${workoutId}`);
      } catch (err) {
        console.error('Error adding exercise to template:', err);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Kunde inte lägga till övning', ToastAndroid.SHORT);
        }
      }
    } else if (replaceMode && onReplaceSelect) {
      onReplaceSelect(exercise);
    } else {
      router.push(`/exercise/${exercise.id}`);
    }
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    const isSpecialMode =
      activeMode === 'quick_start' ||
      activeMode === 'add_to_workout' ||
      activeMode === 'add_to_template';
    return (
      <TouchableOpacity
        style={styles.exerciseCard}
        activeOpacity={0.75}
        onPress={() => handleCardPress(item)}
      >
        {item.gifUrl ? (
          <Image
            source={{ uri: item.gifUrl }}
            style={styles.exerciseThumbnail}
            contentFit="cover"
            autoplay={false}
          />
        ) : (
          <View style={[styles.exerciseThumbnail, styles.placeholderThumbnail]}>
            <Dumbbell size={26} color="#64748B" />
          </View>
        )}
        <View style={styles.exerciseTextContainer}>
          <View style={styles.exerciseTitleRow}>
            <Text style={styles.exerciseTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {isBookmarked(item.id) && (
              <Bookmark size={14} color="#A3E635" fill="#A3E635" style={{ marginLeft: 6 }} />
            )}
          </View>
          <Text style={styles.completionCountText}>
            {item.completions_count || 0}
          </Text>
        </View>

        {isSpecialMode ? (
          <View style={styles.actionIconPill}>
            <Plus size={20} color="#0A0A0A" strokeWidth={3} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => openMenu(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MoreVertical size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Search Bar with Integrated Filter Holder */}
      <View style={styles.headerRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#475569" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök övning..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim().length > 0) {
                setViewMode('exercises');
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.clearSearchBtn}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}

          {/* Filterhållare inuti sökrutan - växlar smidigt mellan filtervy och övningslista */}
          <TouchableOpacity
            style={[
              styles.filterHolderBtn,
              (hasActiveFilters || viewMode === 'filters') && styles.filterHolderBtnActive,
            ]}
            onPress={() => setViewMode(viewMode === 'filters' ? 'exercises' : 'filters')}
            activeOpacity={0.7}
          >
            <SlidersHorizontal
              size={14}
              color={hasActiveFilters || viewMode === 'filters' ? '#A3E635' : '#475569'}
            />
            <Text
              style={[
                styles.filterHolderBtnText,
                (hasActiveFilters || viewMode === 'filters') && styles.filterHolderBtnTextActive,
              ]}
            >
              Filter
            </Text>
            {hasActiveFilters && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Top / Leaderboard button */}
        {!replaceMode && (
          <TouchableOpacity
            style={styles.topNavButton}
            onPress={() => router.push('/exercise/top')}
            activeOpacity={0.7}
          >
            <Trophy size={20} color="#F8FAFC" />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filter Chips Bar (Shown when in exercise list mode with filters) */}
      {viewMode === 'exercises' && hasActiveFilters && (
        <View style={styles.activeChipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsScroll}
          >
            {activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla' && (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => removeIndividualFilter('muscle')}
                activeOpacity={0.7}
              >
                <Text style={styles.activeChipText}>
                  {MUSCLE_GROUP_DISPLAY[activeMuscleFilter] || activeMuscleFilter}
                </Text>
                <X size={13} color="#A3E635" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}

            {activeSubFilter !== 'All' && activeSubFilter !== 'Alla' && (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => removeIndividualFilter('sub')}
                activeOpacity={0.7}
              >
                <Text style={styles.activeChipText}>
                  {TARGET_DISPLAY_SV[activeSubFilter.toLowerCase()] || activeSubFilter}
                </Text>
                <X size={13} color="#A3E635" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}

            {activeEquipmentFilter !== 'All' && activeEquipmentFilter !== 'Alla' && (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => removeIndividualFilter('equipment')}
                activeOpacity={0.7}
              >
                <Text style={styles.activeChipText}>
                  {EQUIPMENT_OPTIONS.find(e => e.id === activeEquipmentFilter)?.label || activeEquipmentFilter}
                </Text>
                <X size={13} color="#A3E635" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modifyActiveChip}
              onPress={() => setViewMode('filters')}
              activeOpacity={0.7}
            >
              <SlidersHorizontal size={12} color="#94A3B8" style={{ marginRight: 4 }} />
              <Text style={styles.modifyActiveChipText}>Ändra</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetActiveChip}
              onPress={() => {
                handleResetFilters();
                setViewMode('filters');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetActiveChipText}>Rensa alla</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Main Content Area */}
      {loading ? (
        <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 60 }} />
      ) : viewMode === 'exercises' ? (
        /* Filtrerat övningsläge: Visar övningar över hela skärmen */
        <SectionList
          sections={filteredSections}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          contentContainerStyle={[
            styles.listContent,
            isMiniPlayerActive && { paddingBottom: 110 },
          ]}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bookmark
                size={40}
                color={activeMuscleFilter === 'Bookmarked' ? '#A3E635' : '#475569'}
                fill={activeMuscleFilter === 'Bookmarked' ? 'rgba(163, 230, 53, 0.2)' : 'transparent'}
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>
                {activeMuscleFilter === 'Bookmarked'
                  ? 'Inga bokmärkta övningar än'
                  : 'Inga övningar hittades'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeMuscleFilter === 'Bookmarked'
                  ? 'Tryck på (⋮) vid en övning och välj "Bokmärk" för att spara dina favoriter här!'
                  : 'Prova att justera dina filter eller sökning'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setViewMode('filters')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyActionBtnText}>Ändra filter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetFiltersButton}
                  onPress={() => {
                    handleResetFilters();
                    setViewMode('filters');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetFiltersButtonText}>Återställ</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      ) : (
        /* Filtervy: Stanna kvar här och välj muskelgrupp och utrustning fram tills användaren trycker "Visa xx övningar" */
        <View style={styles.filterViewWrapper}>
          <ScrollView
            style={styles.initialContainer}
            contentContainerStyle={[
              styles.initialContent,
              isMiniPlayerActive && { paddingBottom: 80 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.initialHero}>
              <Text style={styles.initialHeroTitle}>Övningar</Text>
              <Text style={styles.initialHeroSubtitle}>
                Välj muskelgrupp och utrustning – tryck sedan på knappen längst ner för att visa övningar
              </Text>
            </View>

            {/* Sektion 1: Muskelgrupper */}
            <View style={styles.initialSection}>
              <View style={styles.initialSectionHeader}>
                <Text style={styles.initialSectionCategory}>MUSKELGRUPPER</Text>
                <Text style={styles.initialSectionHint}>
                  {activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla'
                    ? MUSCLE_GROUP_DISPLAY[activeMuscleFilter] || activeMuscleFilter
                    : 'Välj fokusområde'}
                </Text>
              </View>

              <View style={styles.muscleGrid}>
                {CATEGORY_MUSCLE_GROUPS.map((mg) => {
                  const isBookmark = mg.id === 'Bookmarked';
                  const isActive = isMuscleGroupActive(mg.id);
                  return (
                    <TouchableOpacity
                      key={mg.id}
                      style={[
                        styles.muscleCard,
                        isBookmark && styles.muscleCardBookmark,
                        isActive && styles.muscleCardActive,
                        isBookmark && !isActive && styles.bookmarkCard,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleMuscleSelect(mg.id)}
                    >
                      <View
                        style={[
                          styles.muscleCardTextContainer,
                          isBookmark && styles.bookmarkCardTextContainer,
                        ]}
                      >
                        <Text
                          style={[
                            styles.muscleCardName,
                            isActive && styles.muscleCardNameActive,
                            isBookmark && !isActive && styles.bookmarkCardName,
                          ]}
                          numberOfLines={1}
                        >
                          {mg.label}
                        </Text>
                        <Text
                          style={[
                            styles.muscleCardSub,
                            isActive && styles.muscleCardSubActive,
                          ]}
                          numberOfLines={2}
                        >
                          {mg.sub}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.muscleCardImageWrapper,
                          isBookmark && styles.bookmarkCardImageWrapper,
                        ]}
                      >
                        <Image
                          source={getMuscleCardImage(mg.id, isActive)}
                          style={styles.muscleCardImage}
                          contentFit="contain"
                          transition={150}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Submuskler (visas direkt om vald muskelgrupp har specifika muskler) */}
            {currentSubMuscles.length > 0 && (
              <View style={styles.initialSection}>
                <View style={styles.initialSectionHeader}>
                  <Text style={styles.initialSectionCategory}>SPECIFIK MUSKEL (VALFRITT)</Text>
                  <Text style={styles.initialSectionHint}>Fokusera ytterligare</Text>
                </View>

                <View style={styles.subMuscleChipsWrap}>
                  <TouchableOpacity
                    style={[
                      styles.subMuscleChip,
                      (activeSubFilter === 'All' || activeSubFilter === 'Alla') && styles.subMuscleChipActive,
                    ]}
                    onPress={() => setActiveSubFilter('All')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subMuscleChipText,
                        (activeSubFilter === 'All' || activeSubFilter === 'Alla') && styles.subMuscleChipTextActive,
                      ]}
                    >
                      Alla
                    </Text>
                  </TouchableOpacity>
                  {currentSubMuscles.map((sub) => {
                    const isActive = activeSubFilter.toLowerCase() === sub.id.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.subMuscleChip, isActive && styles.subMuscleChipActive]}
                        onPress={() => handleSubMuscleSelect(sub.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.subMuscleChipText, isActive && styles.subMuscleChipTextActive]}>
                          {sub.label}
                        </Text>
                        {isActive && <Check size={13} color="#A3E635" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sektion 2: Utrustning */}
            <View style={styles.initialSection}>
              <View style={styles.initialSectionHeader}>
                <Text style={styles.initialSectionCategory}>UTRUSTNING</Text>
                <Text style={styles.initialSectionHint}>
                  {activeEquipmentFilter !== 'All' && activeEquipmentFilter !== 'Alla'
                    ? EQUIPMENT_OPTIONS.find(e => e.id === activeEquipmentFilter)?.label || activeEquipmentFilter
                    : 'Filtrera efter redskap'}
                </Text>
              </View>

              <View style={styles.equipmentGrid}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const isActive =
                    activeEquipmentFilter === eq.id ||
                    (eq.id === 'All' && (activeEquipmentFilter === 'All' || activeEquipmentFilter === 'Alla'));
                  return (
                    <TouchableOpacity
                      key={eq.id}
                      style={[
                        styles.equipmentGridChip,
                        isActive && styles.equipmentGridChipActive,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => handleEquipmentSelect(eq.id)}
                    >
                      <Text
                        style={[
                          styles.equipmentGridText,
                          isActive && styles.equipmentGridTextActive,
                        ]}
                      >
                        {eq.label}
                      </Text>
                      {isActive && eq.id !== 'All' && (
                        <Check size={13} color="#A3E635" style={{ marginLeft: 6 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Bar - stanna kvar i filtervyn fram tills användaren trycker här! */}
          <View
            style={[
              styles.stickyBottomBar,
              isMiniPlayerActive && { marginBottom: 66 },
            ]}
          >
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.bottomBarResetBtn}
                onPress={handleResetFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.bottomBarResetText}>Rensa</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.bottomBarApplyBtn}
              onPress={() => setViewMode('exercises')}
              activeOpacity={0.8}
            >
              <Text style={styles.bottomBarApplyText}>
                {hasActiveFilters
                  ? `Visa ${totalFilteredCount} övningar`
                  : `Visa alla övningar (${totalFilteredCount})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Exercise Options Bottom Sheet Modal */}
      <Modal
        visible={!!selectedExercise}
        transparent={true}
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuModalOverlay} onPress={closeMenu}>
          <View style={styles.menuModalContent}>
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                if (selectedExercise) {
                  closeMenu();
                  router.push({ pathname: '/choose-workout', params: { exerciseId: selectedExercise.id } });
                }
              }}
            >
              <Plus size={24} color="#F8FAFC" style={styles.modalIcon} />
              <Text style={styles.modalText}>Lägg till i workout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalItem} onPress={navigateToDetail}>
              <Dumbbell size={24} color="#F8FAFC" style={styles.modalIcon} />
              <Text style={styles.modalText}>Gå till övning</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalItem}
              onPress={async () => {
                if (selectedExercise) {
                  const nowBookmarked = await toggleBookmark(selectedExercise.id);
                  if (Platform.OS === 'android') {
                    ToastAndroid.show(
                      nowBookmarked ? 'Bokmärke sparat ⭐' : 'Bokmärke borttaget',
                      ToastAndroid.SHORT
                    );
                  }
                  closeMenu();
                }
              }}
            >
              <Bookmark
                size={24}
                color={selectedExercise && isBookmarked(selectedExercise.id) ? '#A3E635' : '#F8FAFC'}
                fill={selectedExercise && isBookmarked(selectedExercise.id) ? '#A3E635' : 'transparent'}
                style={styles.modalIcon}
              />
              <Text
                style={[
                  styles.modalText,
                  selectedExercise && isBookmarked(selectedExercise.id) && styles.modalTextHighlight,
                ]}
              >
                {selectedExercise && isBookmarked(selectedExercise.id) ? 'Ta bort bokmärke' : 'Bokmärk'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalItem}>
              <EyeOff size={24} color="#F8FAFC" style={styles.modalIcon} />
              <Text style={styles.modalText}>Dölj</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Floating Toast for iOS / Web */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.floatingToastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1D5DB', // Light gray background
    borderRadius: 22,
    paddingLeft: 12,
    paddingRight: 6,
    height: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 15,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
    marginRight: 4,
  },
  filterHolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 5,
  },
  filterHolderBtnActive: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#A3E635',
  },
  filterHolderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterHolderBtnTextActive: {
    color: '#F8FAFC',
  },
  filterCountBadge: {
    backgroundColor: '#A3E635',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountBadgeText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '800',
  },
  topNavButton: {
    backgroundColor: '#1E222B',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D333F',
  },
  activeChipsRow: {
    marginBottom: 12,
  },
  activeChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2B1E',
    borderColor: '#A3E635',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  activeChipText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '700',
  },
  modifyActiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderColor: '#374151',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  modifyActiveChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  resetActiveChip: {
    backgroundColor: '#2A2E35',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  resetActiveChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 40,
  },
  /* Större övningskort */
  exerciseCard: {
    backgroundColor: '#1E222B',
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    height: 88, // Större kort: ökat från 70 till 88
    borderWidth: 1,
    borderColor: '#2D333F',
  },
  exerciseThumbnail: {
    width: 88, // Större thumbnail: ökat från 70 till 88
    height: 88,
    backgroundColor: '#FFFFFF',
    marginRight: 14,
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141820',
  },
  exerciseTextContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingRight: 8,
  },
  exerciseTitle: {
    fontSize: 17, // Större titel: ökat från 16 till 17
    fontWeight: '700',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetBadge: {
    backgroundColor: '#18251B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.35)',
  },
  targetBadgeText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '600',
  },
  equipmentBadge: {
    backgroundColor: '#181C24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#2D333F',
  },
  equipmentBadgeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  completionCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  actionIconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#A3E635',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginRight: 14,
  },
  menuButton: {
    padding: 16,
  },
  /* Filter View Wrapper & Content */
  filterViewWrapper: {
    flex: 1,
  },
  initialContainer: {
    flex: 1,
  },
  initialContent: {
    paddingBottom: 24,
  },
  initialHero: {
    marginBottom: 18,
  },
  initialHeroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  initialHeroSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  initialSection: {
    marginBottom: 20,
  },
  initialSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  initialSectionCategory: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  initialSectionHint: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '600',
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  muscleCard: {
    width: '48.5%',
    height: 114,
    backgroundColor: '#161920',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#262C38',
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  muscleCardBookmark: {
    width: '100%',
    height: 72,
    alignItems: 'center',
  },
  muscleCardActive: {
    backgroundColor: '#142017',
    borderColor: '#A3E635',
    borderWidth: 1.5,
  },
  bookmarkCard: {
    borderColor: '#262C38',
  },
  muscleCardTextContainer: {
    flex: 1,
    paddingLeft: 14,
    paddingTop: 14,
    paddingRight: 56,
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  bookmarkCardTextContainer: {
    paddingTop: 0,
    justifyContent: 'center',
    paddingRight: 70,
  },
  muscleCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  muscleCardNameActive: {
    color: '#A3E635',
  },
  bookmarkCardName: {
    color: '#FFFFFF',
  },
  muscleCardSub: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 14,
  },
  muscleCardSubActive: {
    color: '#CBD5E1',
  },
  muscleCardImageWrapper: {
    position: 'absolute',
    right: -6,
    top: 0,
    bottom: 0,
    width: 104,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkCardImageWrapper: {
    width: 64,
    right: 10,
  },
  muscleCardImage: {
    width: '100%',
    height: '100%',
  },
  /* Sub-muscles */
  subMuscleChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subMuscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderWidth: 1,
    borderColor: '#2D333F',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  subMuscleChipActive: {
    backgroundColor: '#152417',
    borderColor: '#A3E635',
    borderWidth: 1.5,
  },
  subMuscleChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  subMuscleChipTextActive: {
    color: '#A3E635',
    fontWeight: '700',
  },
  /* Equipment */
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentGridChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderWidth: 1,
    borderColor: '#2D333F',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  equipmentGridChipActive: {
    backgroundColor: '#152417',
    borderColor: '#A3E635',
    borderWidth: 1.5,
  },
  equipmentGridText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  equipmentGridTextActive: {
    color: '#A3E635',
    fontWeight: '700',
  },
  /* Sticky Bottom Bar */
  stickyBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#1E222B',
  },
  bottomBarResetBtn: {
    backgroundColor: '#1E222B',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBarResetText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBarApplyBtn: {
    flex: 1,
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBarApplyText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
  /* Empty State */
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyActionBtn: {
    backgroundColor: '#1E222B',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  resetFiltersButton: {
    backgroundColor: '#1E222B',
    borderColor: '#A3E635',
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  resetFiltersButtonText: {
    color: '#A3E635',
    fontWeight: '700',
    fontSize: 14,
  },
  /* Exercise Menu Bottom Sheet */
  menuModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuModalContent: {
    backgroundColor: '#0F1115',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2D333F',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalIcon: {
    marginRight: 16,
  },
  modalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  modalTextHighlight: {
    color: '#A3E635',
  },
  /* Floating Toast */
  floatingToast: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3F3F46',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  floatingToastText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
