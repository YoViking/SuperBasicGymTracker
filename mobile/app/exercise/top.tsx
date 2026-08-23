import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  ToastAndroid,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, Plus, Dumbbell, Bookmark, EyeOff } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { ExerciseLibrary as Exercise } from '../../src/types';
import { useBookmarks } from '../../src/hooks/useBookmarks';

const MUSCLE_GROUP_DISPLAY: Record<string, string> = {
  Chest: 'Bröst',
  Back: 'Rygg',
  Legs: 'Ben',
  Arms: 'Armar',
  Shoulders: 'Axlar',
  Core: 'Core',
  Glutes: 'Glutes',
  Other: 'Övrigt',
  Bröst: 'Bröst',
  Rygg: 'Rygg',
  Ben: 'Ben',
  Armar: 'Armar',
  Axlar: 'Axlar',
};

const MUSCLE_GROUP_ORDER = ['Bröst', 'Rygg', 'Ben', 'Armar', 'Axlar', 'Core', 'Glutes', 'Övrigt'];

export default function TopExercisesScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    fetchTopExercises();
  }, []);

  const fetchTopExercises = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
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
      console.error('Error in fetchTopExercises:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTopExercises();
  };

  const getGroupedSections = () => {
    // Only include exercises with completions > 0
    const performedExercises = exercises.filter((ex) => (ex.completions_count || 0) > 0);

    // Group by Swedish muscle group name
    const groups: Record<string, Exercise[]> = {};

    performedExercises.forEach((ex) => {
      const rawGroup = ex.muscle_group || 'Other';
      const swedishGroup = MUSCLE_GROUP_DISPLAY[rawGroup] || rawGroup;
      if (!groups[swedishGroup]) {
        groups[swedishGroup] = [];
      }
      groups[swedishGroup].push(ex);
    });

    // Sort exercises within each group by completions_count descending and limit to top 10
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => (b.completions_count || 0) - (a.completions_count || 0));
      groups[key] = groups[key].slice(0, 10);
    });

    // Convert to SectionList array ordered by preferred muscle group order, excluding empty groups
    return Object.keys(groups)
      .filter((key) => groups[key].length > 0)
      .map((key) => ({
        title: key,
        data: groups[key],
      }))
      .sort((a, b) => {
        const indexA = MUSCLE_GROUP_ORDER.indexOf(a.title);
        const indexB = MUSCLE_GROUP_ORDER.indexOf(b.title);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.title.localeCompare(b.title);
      });
  };

  const openMenu = (exercise: Exercise) => {
    setSelectedExercise(exercise);
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

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <View style={styles.exerciseCard}>
      {item.gifUrl ? (
        <Image
          source={{ uri: item.gifUrl }}
          style={styles.exerciseThumbnail}
          contentFit="cover"
          autoplay={false}
        />
      ) : null}

      <View style={[styles.countContainer, !item.gifUrl && styles.countContainerNoImage]}>
        <Text style={styles.countText}>{item.completions_count || 0}</Text>
      </View>

      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseTitle} numberOfLines={1}>
          {item.name}
        </Text>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header navigation with back arrow and 'Top' */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#F8FAFC" />
            <Text style={styles.headerBackTitle}>Top</Text>
          </TouchableOpacity>
        </View>

        {/* Subtitle */}
        <Text style={styles.subTitle}>Populäraste övningarna</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#A3E635" style={{ marginTop: 40 }} />
        ) : (
          <SectionList
            sections={getGroupedSections()}
            keyExtractor={(item) => item.id}
            renderItem={renderExerciseItem}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeader}>{title}</Text>
            )}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Dumbbell size={40} color="#64748B" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Inga genomförda övningar än</Text>
                <Text style={styles.emptySubtitle}>
                  När träningspass slutförs kommer de mest populära övningarna (topp 10 per muskelgrupp) att rankas här!
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#A3E635"
                colors={['#A3E635']}
              />
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
                    router.push({
                      pathname: '/choose-workout',
                      params: { exerciseId: selectedExercise.id },
                    });
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
                  {selectedExercise && isBookmarked(selectedExercise.id)
                    ? 'Ta bort bokmärke'
                    : 'Bokmärk'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalItem} onPress={closeMenu}>
                <EyeOff size={24} color="#F8FAFC" style={styles.modalIcon} />
                <Text style={styles.modalText}>Dölj</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 10,
  },
  exerciseCard: {
    backgroundColor: '#2A2E35',
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    height: 70,
  },
  exerciseThumbnail: {
    width: 70,
    height: 70,
    backgroundColor: '#FFFFFF',
  },
  countContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countContainerNoImage: {
    width: 60,
    paddingLeft: 16,
    alignItems: 'flex-start',
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuButton: {
    padding: 16,
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
  },
  emptyContainer: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
