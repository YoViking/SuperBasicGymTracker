import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useWeeklyStats } from '../../src/hooks/useWeeklyStats';
import { useHomeData } from '../../src/hooks/useHomeData';
import { getMuscleGroupImage } from '../../src/utils/images';
import { Workout } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const weeklyStats = useWeeklyStats();
  const homeData = useHomeData();

  const loading = weeklyStats.loading || homeData.loading;

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} tim ${minutes} min`;
    }
    return `${minutes} min`;
  };

  const formatVolume = (vol: number) => {
    if (!vol) return '0 kg';
    return `${vol.toLocaleString('sv-SE')} kg`;
  };

  const calcPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const passChange = calcPercentage(
    weeklyStats.completedThisWeekCount,
    weeklyStats.completedPreviousWeekCount
  );
  const timeChange = calcPercentage(
    weeklyStats.currentWeekTime,
    weeklyStats.previousWeekTime
  );
  const volumeChange = calcPercentage(
    weeklyStats.currentWeekVolume,
    weeklyStats.previousWeekVolume
  );

  const getCollageImages = (workout: Workout) => {
    const exercises = workout.workout_exercises || [];
    const sorted = [...exercises].sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return (a.order_index || 0) - (b.order_index || 0);
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    let images = sorted
      .map((we) => {
        const ex = we.exercise;
        if (!ex) return null;
        return ex.gifUrl ? { uri: ex.gifUrl } : getMuscleGroupImage(ex.muscle_group);
      })
      .filter(Boolean) as any[];

    if (images.length === 0) {
      const fallback = getMuscleGroupImage(undefined);
      images = [fallback, fallback, fallback, fallback];
    }

    while (images.length > 0 && images.length < 4) {
      images = [...images, ...images];
    }
    return images.slice(0, 4);
  };

  const renderTrendBadge = (change: number) => {
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
      <View style={styles.trendRow}>
        <Text style={styles.trendText}>
          ({isPositive ? '+' : ''}{change}%)
        </Text>

        <View
          style={[
            styles.triangle,
            isNegative ? styles.triangleDown : styles.triangleUp,
          ]}
        />
      </View>
    );
  };

  const folderToRender = homeData.latestFolder;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hem</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A3E635" />
          </View>
        ) : (
          <>
            {/* Section 1: Din vecka */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Din vecka</Text>
              <TouchableOpacity onPress={() => router.push('/user')}>
                <Text style={styles.seeMoreText}>Se mer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.statsRow}>
                {/* Metric 1: Träningspass */}
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>
                    {weeklyStats.completedThisWeekCount}
                  </Text>
                  <Text style={styles.statLabel}>Träningspass</Text>
                  {renderTrendBadge(passChange)}
                </View>

                {/* Metric 2: Tid */}
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>
                    {formatTime(weeklyStats.currentWeekTime)}
                  </Text>
                  <Text style={styles.statLabel}>Tid</Text>
                  {renderTrendBadge(timeChange)}
                </View>

                {/* Metric 3: Volym */}
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>
                    {formatVolume(weeklyStats.currentWeekVolume)}
                  </Text>
                  <Text style={styles.statLabel}>Volym</Text>
                  {renderTrendBadge(volumeChange)}
                </View>
              </View>
            </View>

            {/* Section 2: Nya rekord 🏆 */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nya rekord 🏆</Text>
            </View>

            <View style={styles.card}>
              {homeData.personalBests.length === 0 ? (
                <Text style={styles.emptyText}>Inga nya rekord än</Text>
              ) : (
                homeData.personalBests.map((pr, index) => (
                  <View
                    key={index}
                    style={[
                      styles.prRow,
                      index < homeData.personalBests.length - 1 && styles.rowDivider,
                    ]}
                  >
                    <Text style={styles.prName} numberOfLines={1}>
                      {pr.exerciseName}
                    </Text>
                    <View style={styles.prRight}>
                      <Text style={styles.prWeight}>{pr.currentWeight} kg</Text>
                      <Text style={styles.prDelta}>+ {pr.increase} kg</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Section 3: Senaste */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Senaste</Text>
            </View>

            <View style={styles.senasteRow}>
              {/* Program Folder Square Card (Left) */}
              <TouchableOpacity
                style={styles.programFolderCard}
                activeOpacity={0.8}
                onPress={() => {
                  if (folderToRender) {
                    router.push({
                      pathname: '/folder/[id]',
                      params: { id: folderToRender.id, name: folderToRender.name },
                    });
                  } else {
                    router.push('/workouts');
                  }
                }}
              >
                {folderToRender?.image_url ? (
                  <Image
                    source={{ uri: folderToRender.image_url }}
                    style={styles.folderImageBackground}
                    contentFit="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/images/bicep.png')}
                    style={styles.folderImageBackground}
                    contentFit="cover"
                  />
                )}
                <View style={styles.folderOverlay}>
                  <Text style={styles.folderOverlayTitle} numberOfLines={2}>
                    {folderToRender?.name ? folderToRender.name.toUpperCase() : 'HULK'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Workouts List with 2x2 collage thumbnail grid (Right) */}
              <View style={styles.programList}>
                {homeData.latestWorkouts.length === 0 ? (
                  <TouchableOpacity
                    style={styles.programItemCard}
                    onPress={() => router.push('/workouts')}
                  >
                    <View style={styles.collageGrid}>
                      <View style={[styles.collageImage, { backgroundColor: '#38BDF8' }]} />
                      <View style={[styles.collageImage, { backgroundColor: '#F472B6' }]} />
                      <View style={[styles.collageImage, { backgroundColor: '#A7F3D0' }]} />
                      <View style={[styles.collageImage, { backgroundColor: '#F87171' }]} />
                    </View>
                    <View style={styles.programTextContainer}>
                      <Text style={styles.programTitle}>A Basstyrka & Press</Text>
                      <Text style={styles.programSubtitle}>av dig</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  homeData.latestWorkouts.map((workout) => {
                    const collage = getCollageImages(workout);
                    return (
                      <TouchableOpacity
                        key={workout.id}
                        style={styles.programItemCard}
                        onPress={() => router.push(`/workout/${workout.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.collageGrid}>
                          <Image source={collage[0]} style={styles.collageImage} />
                          <Image source={collage[1]} style={styles.collageImage} />
                          <Image source={collage[2]} style={styles.collageImage} />
                          <Image source={collage[3]} style={styles.collageImage} />
                        </View>
                        <View style={styles.programTextContainer}>
                          <Text style={styles.programTitle} numberOfLines={1}>
                            {workout.name}
                          </Text>
                          <Text style={styles.programSubtitle}>av dig</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* Section 4: Dagens övning */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dagens övning</Text>
            </View>

            {homeData.dailyExercise && (
              <TouchableOpacity
                style={styles.dailyCard}
                onPress={() => router.push(`/exercise/${homeData.dailyExercise?.id}`)}
                activeOpacity={0.8}
              >
                <Image
                  source={
                    homeData.dailyExercise.gifUrl
                      ? { uri: homeData.dailyExercise.gifUrl }
                      : getMuscleGroupImage(homeData.dailyExercise.muscle_group)
                  }
                  style={styles.dailyImage}
                  contentFit="cover"
                />
                <View style={styles.dailyTextContainer}>
                  <Text style={styles.dailyTitle} numberOfLines={2}>
                    {homeData.dailyExercise.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => router.push(`/exercise/${homeData.dailyExercise?.id}`)}
                >
                  <MoreVertical size={20} color="#94A3B8" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
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
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: 'bold',
  },
  loadingContainer: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeMoreText: {
    color: '#A3E635',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E222B',
    borderRadius: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statColumn: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  triangleUp: {
    borderBottomColor: '#A3E635', // Green
  },
  triangleDown: {
    borderBottomColor: '#EF4444', // Red
    transform: [{ rotate: '180deg' }],
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A303C',
  },
  prName: {
    color: '#FFFFFF', // White
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  prRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  prWeight: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
  },
  prDelta: {
    color: '#B9FF3B', // Bright green increase color
    fontSize: 14,
    width: 56,
    textAlign: 'right',
  },
  senasteRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  programFolderCard: {
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E222B',
    position: 'relative',
  },
  folderImageBackground: {
    width: '100%',
    height: '100%',
  },
  folderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 6,
  },
  folderOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  programList: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  programItemCard: {
    backgroundColor: '#1E222B',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  collageGrid: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collageImage: {
    width: 20,
    height: 20,
  },
  programTextContainer: {
    flex: 1,
  },
  programTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  programSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  dailyCard: {
    backgroundColor: '#1E222B',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  dailyTextContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dailyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  moreButton: {
    padding: 8,
  },
});
