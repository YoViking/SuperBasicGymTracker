import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useMonthlyStats } from '../../hooks/useMonthlyStats';
import { PieChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');
const daysOfWeek = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

export default function MonthlyStats() {
  const stats = useMonthlyStats();

  // Generate calendar grid for the current month
  const calendarGrid = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    // JS getDay(): Sun=0, Mon=1. Convert to Mon=0, Sun=6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const maxVolume = Math.max(...stats.heatmapData.map(d => d.count), 1); // Avoid div by 0

    const grid = [];
    let currentWeek = [];

    // Pad beginning of month
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ day: null, color: '#18181B' }); // empty darker background
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const dayData = stats.heatmapData.find(d => d.date === dateStr);
      const volume = dayData ? dayData.count : 0;

      let color = '#27272A'; // Default empty day
      if (volume > 0) {
        const ratio = volume / maxVolume;
        if (ratio < 0.33) color = '#D9F99D'; // Lightest
        else if (ratio < 0.66) color = '#A3E635'; // Mid
        else color = '#4D7C0F'; // Darkest
      }

      currentWeek.push({ day, color });

      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }

    // Pad end of month
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ day: null, color: '#18181B' });
      }
      grid.push(currentWeek);
    }

    return grid;
  }, [stats.heatmapData]);

  if (stats.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} tim ${minutes} min`;
    return `${minutes} min`;
  };

  return (
    <View style={styles.container}>
      {/* Grey Box for Calendar */}
      <View style={styles.calendarCard}>
        <Text style={styles.monthTitle}>{stats.monthName}</Text>
        
        <View style={styles.calendarWrapper}>
          {calendarGrid.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((dayItem, dayIndex) => (
                <View 
                  key={`day-${weekIndex}-${dayIndex}`} 
                  style={[styles.daySquare, { backgroundColor: dayItem.color }]} 
                />
              ))}
            </View>
          ))}
          
          <View style={styles.daysHeader}>
            {daysOfWeek.map(day => (
              <Text key={day} style={styles.dayHeaderText}>{day}</Text>
            ))}
          </View>
        </View>

        <Text style={styles.averageText}>
          Average training: {formatTime(stats.averageTimeSeconds)}, {stats.averageVolume.toFixed(0)} kg
        </Text>
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
    paddingHorizontal: 8, // Closer to the edge as requested
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  calendarCard: {
    backgroundColor: '#2D3039',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
  },
  monthTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  calendarWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  daySquare: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  dayHeaderText: {
    width: 32,
    textAlign: 'center',
    color: '#F8FAFC',
    fontSize: 12,
  },
  averageText: {
    color: '#F8FAFC',
    fontSize: 14,
    marginTop: 24,
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
