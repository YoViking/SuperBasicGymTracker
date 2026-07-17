import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Triangle } from 'lucide-react-native'; // We'll build our own triangle if lucide doesn't have a solid one

interface StatRowProps {
  label: string;
  value: string;
  percentageChange?: number;
}

export default function StatRow({ label, value, percentageChange }: StatRowProps) {
  const isPositive = percentageChange !== undefined && percentageChange > 0;
  const isNegative = percentageChange !== undefined && percentageChange < 0;

  // Let's create a custom simple Triangle using a View trick or SVG since lucide's Triangle is not filled by default unless we pass fill
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}: </Text>
      <Text style={styles.value}>{value}</Text>
      
      {percentageChange !== undefined && percentageChange !== 0 && (
        <View style={styles.changeContainer}>
          <Text style={styles.changeText}>
            ({isPositive ? '+' : ''}{percentageChange.toFixed(0)}%)
          </Text>
          <View style={[styles.triangle, isPositive ? styles.triangleUp : styles.triangleDown]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '400',
  },
  value: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  changeText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  triangleUp: {
    borderBottomColor: '#A3E635', // Green
  },
  triangleDown: {
    borderBottomColor: '#FF3B3E', // Red
    transform: [{ rotate: '180deg' }],
  }
});
