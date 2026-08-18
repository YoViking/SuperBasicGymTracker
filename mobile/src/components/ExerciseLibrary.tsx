import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SectionList, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { Search, MoreVertical, Plus, Dumbbell, Bookmark, EyeOff, X } from 'lucide-react-native';
import { ExerciseLibrary as Exercise } from '../types';
import { useRouter } from 'expo-router';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Glutes', 'Other', 'Bookmarked'];

const EQUIPMENT_OPTIONS = [
  { id: 'All', label: 'All' },
  { id: 'Barbell', label: 'Barbell' },
  { id: 'Dumbbell', label: 'Dumbbell' },
  { id: 'Machine', label: 'Machine' },
  { id: 'Cable', label: 'Cable' },
  { id: 'Bodyweight', label: 'Bodyweight' },
  { id: 'Kettlebell', label: 'Kettlebell' },
  { id: 'Bands', label: 'Bands' },
  { id: 'Other', label: 'Other' },
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
      return 'Bodyweight';
    case 'e-z curl bar':
      return 'EZ Bar';
    case 'kettlebells':
      return 'Kettlebell';
    case 'bands':
      return 'Bands';
    case 'foam roll':
      return 'Foam Roll';
    case 'exercise ball':
      return 'Exercise Ball';
    case 'medicine ball':
      return 'Medicine Ball';
    default:
      return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
};

interface ExerciseLibraryProps {
  replaceMode?: boolean;
  defaultFilter?: string;
  onReplaceSelect?: (exercise: Exercise) => void;
}

export default function ExerciseLibrary({
  replaceMode = false,
  defaultFilter = 'All',
  onReplaceSelect
}: ExerciseLibraryProps = {}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMuscleFilter, setActiveMuscleFilter] = useState(defaultFilter);
  const [activeEquipmentFilter, setActiveEquipmentFilter] = useState('All');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchExercises();
  }, []);

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

      // Fetch count from workout_exercise_logs to ensure historical counts are included
      const { data: logsData } = await supabase
        .from('workout_exercise_logs')
        .select('exercise_name');

      const logCounts = new Map<string, number>();
      if (logsData) {
        logsData.forEach((log: any) => {
          if (log.exercise_name) {
            logCounts.set(log.exercise_name, (logCounts.get(log.exercise_name) || 0) + 1);
          }
        });
      }

      const merged = (data || []).map((ex: Exercise) => {
        const loggedCount = logCounts.get(ex.name) || 0;
        const colCount = ex.completions_count || 0;
        return {
          ...ex,
          completions_count: Math.max(colCount, loggedCount),
        };
      });

      setExercises(merged);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMuscleSelect = (group: string) => {
    if (activeMuscleFilter === group) {
      setActiveMuscleFilter('All');
    } else {
      setActiveMuscleFilter(group);
    }
  };

  const handleEquipmentSelect = (eqId: string) => {
    if (activeEquipmentFilter === eqId) {
      setActiveEquipmentFilter('All');
    } else {
      setActiveEquipmentFilter(eqId);
    }
  };

  const getFilteredData = () => {
    let filtered = exercises;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
    }

    if (activeMuscleFilter !== 'All' && activeMuscleFilter !== 'Alla' && activeMuscleFilter !== 'Bookmarked') {
      filtered = filtered.filter(e => e.muscle_group === activeMuscleFilter);
    }

    if (activeEquipmentFilter !== 'All' && activeEquipmentFilter !== 'Alla') {
      filtered = filtered.filter(e => matchesEquipmentFilter(e, activeEquipmentFilter));
    }

    // TODO: Handle Bookmarked logic when user bookmarks are implemented

    // Group by muscle_group for the SectionList
    const grouped = filtered.reduce((acc, curr) => {
      const group = curr.muscle_group || 'Other';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(curr);
      return acc;
    }, {} as Record<string, Exercise[]>);

    return Object.keys(grouped).map(key => ({
      title: key,
      data: grouped[key],
    })).sort((a, b) => a.title.localeCompare(b.title));
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

  const renderExercise = ({ item }: { item: Exercise }) => (
    <View style={styles.exerciseCard}>
      {item.gifUrl ? (
        <Image 
          source={{ uri: item.gifUrl }} 
          style={styles.exerciseThumbnail} 
          contentFit="cover" 
          autoplay={false}
        />
      ) : (
        <View style={[styles.exerciseThumbnail, styles.placeholderThumbnail]}>
          <Dumbbell size={24} color="#94A3B8" />
        </View>
      )}
      <View style={styles.exerciseTextContainer}>
        <Text style={styles.exerciseTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.exerciseMetaRow}>
          {item.equipment ? (
            <View style={styles.equipmentBadge}>
              <Text style={styles.equipmentBadgeText} numberOfLines={1}>
                {formatEquipmentLabel(item.equipment)}
              </Text>
            </View>
          ) : null}
          <Text style={styles.completionCountText}>
            {item.completions_count || 0}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.menuButton} 
        onPress={() => openMenu(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MoreVertical size={20} color="#F8FAFC" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      
      {/* Full width search bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#000" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Sök övning..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={18} color="#475569" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>Övningar</Text>

      {/* Filter Sections */}
      <View style={styles.filtersWrapper}>
        {/* Muscle Group Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterCategoryLabel}>MUSKELGRUPP</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {MUSCLE_GROUPS.map(group => {
              const isActive = activeMuscleFilter === group || (group === 'All' && activeMuscleFilter === 'Alla');
              return (
                <TouchableOpacity
                  key={group}
                  style={[styles.filterChip, isActive && styles.activeFilterChip]}
                  onPress={() => handleMuscleSelect(group)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                    {group}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Equipment Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterCategoryLabel}>UTRUSTNING</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {EQUIPMENT_OPTIONS.map(eq => {
              const isActive = activeEquipmentFilter === eq.id || (eq.id === 'All' && activeEquipmentFilter === 'Alla');
              return (
                <TouchableOpacity
                  key={eq.id}
                  style={[styles.filterChip, isActive && styles.activeFilterChip]}
                  onPress={() => handleEquipmentSelect(eq.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                    {eq.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
      ) : (
        <SectionList
          sections={getFilteredData()}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Dumbbell size={40} color="#475569" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Inga övningar hittades</Text>
              <Text style={styles.emptySubtitle}>Prova att justera sökning eller filter</Text>
              {(activeMuscleFilter !== 'All' || activeEquipmentFilter !== 'All' || searchQuery !== '') && (
                <TouchableOpacity
                  style={styles.resetFiltersButton}
                  onPress={() => {
                    setActiveMuscleFilter('All');
                    setActiveEquipmentFilter('All');
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.resetFiltersButtonText}>Återställ filter</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={!!selectedExercise}
        transparent={true}
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <View style={styles.modalContent}>
            
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

            <TouchableOpacity style={styles.modalItem}>
              <Bookmark size={24} color="#F8FAFC" style={styles.modalIcon} />
              <Text style={styles.modalText}>Bokmärk</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalItem}>
              <EyeOff size={24} color="#F8FAFC" style={styles.modalIcon} />
              <Text style={styles.modalText}>Dölj</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Modal>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1D5DB', // Light gray background
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    width: '100%',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 16,
    padding: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  filtersWrapper: {
    marginBottom: 16,
    gap: 12,
  },
  filterSection: {
    gap: 6,
  },
  filterCategoryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    backgroundColor: '#2A2E35',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterChip: {
    backgroundColor: '#1E2B1E',
    borderColor: '#A3E635',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#A3E635',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#2A2E35',
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden', // Ensures the image respects the border radius on the left side
    height: 70, // Fixed height so the image is perfectly square and touches top/bottom
  },
  exerciseThumbnail: {
    width: 70,
    height: 70,
    backgroundColor: '#FFFFFF', // White background for the API images
    marginRight: 16,
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equipmentBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  completionCountText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748B',
  },
  menuButton: {
    padding: 16, // Increase padding to make the dots icon well-spaced on the right
  },
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
  resetFiltersButton: {
    backgroundColor: '#2A2E35',
    borderColor: '#A3E635',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resetFiltersButtonText: {
    color: '#A3E635',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#0F1115',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
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
  }
});

