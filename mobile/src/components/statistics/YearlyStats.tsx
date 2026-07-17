import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useYearlyStats } from '../../hooks/useYearlyStats';
import { BarChart, PieChart } from 'react-native-gifted-charts';

export default function YearlyStats() {
  const stats = useYearlyStats();

  if (stats.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    return `${hours} tim`;
  };

  const formatWeight = (kg: number) => {
    if (kg >= 1000) {
      const tons = kg / 1000;
      // Convert to 1 decimal place using Swedish locale (comma)
      return `${tons.toFixed(1).replace('.', ',')} ton`;
    }
    return `${kg.toFixed(0)} kg`;
  };

  return (
    <View style={styles.container}>
      {/* Grey Box for Bar Chart and Summaries */}
      <View style={styles.chartCard}>
        <Text style={styles.yearTitle}>{stats.year}</Text>

        <View style={styles.barChartWrapper}>
          <BarChart
            data={stats.barChartData}
            barWidth={12} // Default if not provided
            spacing={12}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: 'transparent' }} // Hide Y axis labels to keep it clean
            noOfSections={4}
            maxValue={Math.max(...stats.barChartData.map(d => d.value), 1) * 1.1} // 10% headroom
            xAxisLabelTextStyle={styles.xAxisLabel}
            dashGap={0}
            height={160}
          />
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            Total träningstid: {formatTime(stats.totalTimeSeconds)}
          </Text>
          <Text style={styles.summaryText}>
            Totalt antal pass: {stats.totalWorkouts} st
          </Text>
          <Text style={styles.summaryText}>
            Totalt vikt: {formatWeight(stats.totalVolume)}
          </Text>
        </View>
      </View>

      {/* Pie Chart Section */}
      <View style={styles.pieChartSection}>
        <Text style={styles.pieChartTitle}>Tränade muskelgrupper</Text>
        {stats.pieChartData.length > 0 ? (
          <View style={styles.pieChartContainer}>
            <PieChart
              data={stats.pieChartData}
              donut
              showText={false}
              radius={80}
              innerRadius={40}
              innerCircleColor="#0A0A0A"
              focusOnPress
            />
            {/* Custom Legend */}
            <View style={styles.legendContainer}>
              {stats.pieChartData.map((item, index) => (
                <View key={`legend-${index}`} style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>
                    {item.text} ({item.value} set)
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyPie}>
            <Text style={styles.emptyPieText}>Ingen data</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  chartCard: {
    backgroundColor: '#2D3039',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
  },
  yearTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  barChartWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  xAxisLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  summaryContainer: {
    width: '100%',
    paddingLeft: 8,
    gap: 12,
  },
  summaryText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  pieChartSection: {
    alignItems: 'center',
    paddingBottom: 40,
    backgroundColor: '#2D3039',
    borderRadius: 8,
    padding: 16,
  },
  pieChartTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 24,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  emptyPie: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#3F3F46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPieText: {
    color: '#94A3B8',
  }
});
