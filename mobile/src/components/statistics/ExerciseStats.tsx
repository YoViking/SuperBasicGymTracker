import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useExerciseStats } from '../../hooks/useExerciseStats';
import { LineChart } from 'react-native-gifted-charts';
import { Trophy } from 'lucide-react-native';

interface ExerciseStatsProps {
  exerciseName: string;
}

const { width } = Dimensions.get('window');

export default function ExerciseStats({ exerciseName }: ExerciseStatsProps) {
  const stats = useExerciseStats(exerciseName);

  if (stats.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  // Format the chart data - exactly 7 weeks
  const chartData = stats.chartData.map((d) => ({
    value: d.value,
    label: d.label,
    dataPointText: d.dataPointText,
    labelTextStyle: { color: '#94A3B8', fontSize: 10 },
  }));

  // Available chart plot width calculation:
  // Outer page padding: 16 * 2 = 32
  // Card padding: 16 * 2 = 32
  // Card inner width = width - 64
  // Y-axis label column = 35 + 1 = 36
  // Available width for plot = (width - 64) - 36 - 6 = width - 106
  // initialSpacing = 16, endSpacing = 26 (leaves 26px margin after last point so label and dot are never clipped)
  const initialSpacing = 16;
  const endSpacing = 26;
  const numIntervals = Math.max(chartData.length - 1, 1);
  const spacing = Math.max(28, Math.floor((width - 106 - initialSpacing - endSpacing) / numIntervals));
  const chartWidth = initialSpacing + (chartData.length - 1) * spacing + endSpacing;

  return (
    <View style={styles.container}>
      <View style={styles.pbContainer}>
        <Trophy size={24} color="#F5D800" />
        <Text style={styles.pbText}>
          Current PB: <Text style={styles.pbValue}>{stats.currentPBText || `${stats.currentPB} ${stats.unit}`}</Text>
        </Text>
      </View>

      <View style={styles.chartCard}>
        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>
            {stats.metricType === 'time'
              ? 'Max tid (sekunder)'
              : stats.metricType === 'reps'
              ? 'Max reps'
              : 'Maxvikt (kg)'}
          </Text>
        </View>

        {chartData.length > 0 ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={220}
            thickness={2}
            color="#A3E635"
            noOfSections={5}
            hideRules
            disableScroll
            spacing={spacing}
            initialSpacing={initialSpacing}
            endSpacing={endSpacing}
            yAxisLabelWidth={35}
            yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
            xAxisColor="#E2E8F0"
            yAxisColor="#E2E8F0"
            xAxisThickness={1}
            yAxisThickness={1}
            dataPointsColor="#A3E635"
            dataPointsRadius={4}
            hideDataPoints={false}
            isAnimated
            areaChart
            startFillColor="#A3E635"
            endFillColor="#A3E635"
            startOpacity={0.4}
            endOpacity={0.05}
            yAxisLabelSuffix=" "
            // Optional: Set a min value so the chart doesn't start from 0 if weights are high
            yAxisOffset={Math.max(0, Math.min(...chartData.map(d => d.value)) - 10)}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Ingen historik än</Text>
          </View>
        )}
        <Text style={styles.xAxisTitle}>Vecka / Datum</Text>

        {/* Y Axis title rotated */}
        <Text style={styles.yAxisTitle}>
          {stats.metricType === 'time' ? 'Tid (sek)' : stats.metricType === 'reps' ? 'Reps' : 'Vikt (kg)'}
        </Text>
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
  pbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  pbText: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  pbValue: {
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#F8FAFC', // Mockup shows a white background for the chart area
    borderRadius: 8,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 24,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  legendText: {
    color: '#475569',
    fontSize: 12,
  },
  xAxisTitle: {
    position: 'absolute',
    bottom: 8,
    color: '#475569',
    fontSize: 12,
  },
  yAxisTitle: {
    position: 'absolute',
    left: -10,
    top: '50%',
    transform: [{ rotate: '-90deg' }],
    color: '#475569',
    fontSize: 12,
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
  }
});
