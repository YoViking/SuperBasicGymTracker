import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SectionList, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { Search, MoreVertical, Plus, Dumbbell, Bookmark, EyeOff } from 'lucide-react-native';
import { ExerciseLibrary as Exercise } from '../types';
import { useRouter } from 'expo-router';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Glutes', 'Other', 'Bookmarked'];
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
  const [activeFilter, setActiveFilter] = useState(defaultFilter);
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
      setExercises(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    let filtered = exercises;

    if (searchQuery) {
      filtered = filtered.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (activeFilter !== 'All' && activeFilter !== 'Bookmarked') {
      filtered = filtered.filter(e => e.muscle_group === activeFilter);
    }

    // TODO: Handle Bookmarked logic when user bookmarks are implemented

    // Group by muscle_group for the SectionList
    const grouped = filtered.reduce((acc, curr) => {
      const group = curr.muscle_group || 'Övrigt';
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
      <Text style={styles.exerciseTitle} numberOfLines={2}>{item.name}</Text>
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
          placeholder=""
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <Text style={styles.title}>Övningar</Text>

      <View style={styles.filtersContainer}>
        {MUSCLE_GROUPS.map(group => (
          <TouchableOpacity
            key={group}
            style={[styles.filterChip, activeFilter === group && styles.activeFilterChip]}
            onPress={() => setActiveFilter(group)}
          >
            <Text style={[styles.filterText, activeFilter === group && styles.activeFilterText]}>
              {group}
            </Text>
          </TouchableOpacity>
        ))}
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
    marginBottom: 20,
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
    marginBottom: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#2A2E35',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  activeFilterChip: {
    borderColor: '#A3E635',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#A3E635',
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
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
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  menuButton: {
    padding: 16, // Increase padding to make the dots icon well-spaced on the right
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
