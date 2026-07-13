import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SavedWorkouts from '../../src/components/SavedWorkouts';

export default function WorkoutsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logoText}>The Incredible Hulk App </Text>
      </View>
      <View style={styles.container}>
        <SavedWorkouts />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  logoText: {
    color: '#A3E635',
    fontSize: 32,
    fontFamily: 'Bangers_400Regular',
  },
  container: {
    flex: 1,
  },
});
