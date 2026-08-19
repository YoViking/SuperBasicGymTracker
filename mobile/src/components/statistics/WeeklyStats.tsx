import React from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useWeeklyStats } from '../../hooks/useWeeklyStats';
import StatRow from './StatRow';
import { LineChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const daysOfWeek = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function WeeklyStats() {
  const stats = useWeeklyStats();

  if (stats.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  // Format time (hours and minutes)
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} tim ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Calculate percentage changes
  const calcPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const timeChange = calcPercentage(stats.currentWeekTime, stats.previousWeekTime);
  const volumeChange = calcPercentage(stats.currentWeekVolume, stats.previousWeekVolume);

  // Chart data
  const chartData = stats.volumeTrend.map(t => ({
    value: t.value,
    label: t.label,
    labelTextStyle: { color: '#94A3B8', fontSize: 10 },
  }));

  // Difference in volume for the badge
  const volumeDiff = stats.currentWeekVolume - stats.previousWeekVolume;

  return (
    <View style={styles.container}>
      {/* Top Grey Card */}
      <View style={styles.topCard}>
        {/* Days of the week circles */}
        <View style={styles.daysRow}>
          {daysOfWeek.map((day, index) => (
            <View key={day} style={styles.dayContainer}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={[styles.dayCircle, stats.daysCompleted[index] && styles.dayCircleCompleted]} />
            </View>
          ))}
        </View>

        {/* Stats List */}
        <View style={styles.statsList}>
          <Text style={styles.antalPassText}>Antal pass: {stats.completedThisWeekCount}/{stats.activeWorkoutsCount}</Text>
          
          <StatRow 
            label="Total tid" 
            value={formatTime(stats.currentWeekTime)} 
            percentageChange={timeChange}
          />
          
          <StatRow 
            label="Total volym" 
            value={`${stats.currentWeekVolume} kg`} 
            percentageChange={volumeChange}
          />
        </View>

        {/* Line Chart */}
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={width - 80}
            height={160}
            thickness={2}
            color="#F8FAFC"
            noOfSections={4}
            hideRules
            hideYAxisText
            yAxisColor="transparent"
            xAxisColor="#F8FAFC"
            xAxisThickness={1}
            dataPointsColor="#A3E635"
            dataPointsRadius={4}
            hideDataPoints={false}
            isAnimated
          />
        </View>
      </View>

      {/* Rewarding Progression Card */}
      <View style={styles.progressionCardWrapper}>
        <LinearGradient
          colors={volumeDiff >= 0 ? ['#1A2416', '#14181B'] : ['#1C1E26', '#14181B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.progressionCard,
            volumeDiff >= 0 ? styles.progressionCardPositive : styles.progressionCardNeutral,
          ]}
        >
          {/* Ambient Glow */}
          <View style={[styles.glowOrb, volumeDiff >= 0 ? styles.glowOrbLime : styles.glowOrbNeutral]} />

          {/* Top Header Row */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconBadge, volumeDiff >= 0 ? styles.iconBadgeLime : styles.iconBadgeNeutral]}>
                {volumeDiff >= 0 ? (
                  <TrendingUp size={18} color="#A3E635" />
                ) : volumeDiff < 0 ? (
                  <TrendingDown size={18} color="#94A3B8" />
                ) : (
                  <Zap size={18} color="#38BDF8" />
                )}
              </View>
              <Text style={styles.cardHeaderLabel}>VECKOJÄMFÖRELSE</Text>
            </View>

            {volumeChange !== 0 && (
              <View style={[styles.percentagePill, volumeDiff >= 0 ? styles.pillLime : styles.pillMuted]}>
                <Text style={[styles.percentageText, volumeDiff >= 0 ? styles.percentageTextLime : styles.percentageTextMuted]}>
                  {volumeDiff >= 0 ? '+' : ''}{Math.round(volumeChange)}%
                </Text>
              </View>
            )}
          </View>

          {/* Hero Numbers & Text */}
          <View style={styles.heroSection}>
            <Text style={styles.heroPrefixText}>Du har lyft</Text>
            <View style={styles.heroNumberRow}>
              <Text style={[styles.heroValue, volumeDiff >= 0 ? styles.heroValueLime : styles.heroValueMuted]}>
                {volumeDiff >= 0 ? '+' : ''}{Math.abs(volumeDiff).toLocaleString('sv-SE')}
              </Text>
              <Text style={styles.heroUnit}>kg</Text>
            </View>
            <Text style={styles.heroSuffixText}>
              {volumeDiff > 0
                ? 'mer än förra veckan! Grym progression 💪'
                : volumeDiff < 0
                ? 'mindre än förra veckan (återhämtningsfas)'
                : 'samma volym som förra veckan'}
            </Text>
          </View>

          {/* Visual Comparison Progress Bars */}
          <View style={styles.comparisonSection}>
            {/* Current Week */}
            <View style={styles.barRow}>
              <View style={styles.barLabelGroup}>
                <Text style={styles.barTitle}>Denna vecka</Text>
                <Text style={styles.barValueText}>{stats.currentWeekVolume.toLocaleString('sv-SE')} kg</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    styles.barFillLime,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(
                          8,
                          Math.max(stats.currentWeekVolume, stats.previousWeekVolume) > 0
                            ? (stats.currentWeekVolume / Math.max(stats.currentWeekVolume, stats.previousWeekVolume)) * 100
                            : 0
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Previous Week */}
            <View style={styles.barRow}>
              <View style={styles.barLabelGroup}>
                <Text style={styles.barTitleMuted}>Förra veckan</Text>
                <Text style={styles.barValueTextMuted}>{stats.previousWeekVolume.toLocaleString('sv-SE')} kg</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    styles.barFillMuted,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(
                          8,
                          Math.max(stats.currentWeekVolume, stats.previousWeekVolume) > 0
                            ? (stats.previousWeekVolume / Math.max(stats.currentWeekVolume, stats.previousWeekVolume)) * 100
                            : 0
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  topCard: {
    backgroundColor: '#2D3039',
    borderRadius: 8,
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: 24,
    marginHorizontal: 8,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  dayContainer: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  dayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
  },
  dayCircleCompleted: {
    backgroundColor: '#A3E635',
  },
  statsList: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  antalPassText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressionCardWrapper: {
    marginHorizontal: 8,
    marginBottom: 40,
  },
  progressionCard: {
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
  },
  progressionCardPositive: {
    borderColor: 'rgba(163, 230, 53, 0.35)',
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  progressionCardNeutral: {
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  glowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.2,
  },
  glowOrbLime: {
    backgroundColor: '#A3E635',
  },
  glowOrbNeutral: {
    backgroundColor: '#38BDF8',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeLime: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
  },
  iconBadgeNeutral: {
    backgroundColor: '#27272A',
  },
  cardHeaderLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  percentagePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillLime: {
    backgroundColor: 'rgba(163, 230, 53, 0.18)',
    borderWidth: 1,
    borderColor: '#A3E635',
  },
  pillMuted: {
    backgroundColor: '#27272A',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '800',
  },
  percentageTextLime: {
    color: '#A3E635',
  },
  percentageTextMuted: {
    color: '#94A3B8',
  },
  heroSection: {
    marginBottom: 20,
  },
  heroPrefixText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroValueLime: {
    color: '#A3E635',
  },
  heroValueMuted: {
    color: '#F8FAFC',
  },
  heroUnit: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSuffixText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  comparisonSection: {
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 16,
    gap: 12,
  },
  barRow: {
    gap: 6,
  },
  barLabelGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  barTitleMuted: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  barValueText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '700',
  },
  barValueTextMuted: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#27272A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barFillLime: {
    backgroundColor: '#A3E635',
  },
  barFillMuted: {
    backgroundColor: '#64748B',
  },
});
