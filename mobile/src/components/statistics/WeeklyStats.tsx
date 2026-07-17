import React from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useWeeklyStats } from '../../hooks/useWeeklyStats';
import StatRow from './StatRow';
import { LineChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

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

      {/* Rewarding Badge */}
      <View style={styles.badgeContainer}>
        <LinearGradient
          colors={['#A3E635', '#F5D800']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badgeCircle}
        >
          <Text style={styles.badgeTopText}>Du har lyft {Math.abs(volumeDiff)} kg</Text>
          <Image 
            source={require('../../../assets/images/bicep.png')} 
            style={styles.badgeIcon} 
            contentFit="contain" 
          />
          <Text style={styles.badgeBottomText}>
            {volumeDiff >= 0 ? 'mer' : 'mindre'} än förra veckan
          </Text>
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
    marginBottom: 40,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  badgeCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  badgeTopText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  badgeBottomText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
