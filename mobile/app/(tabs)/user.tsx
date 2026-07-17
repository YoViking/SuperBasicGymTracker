import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import WeeklyStats from '../../src/components/statistics/WeeklyStats';
import MonthlyStats from '../../src/components/statistics/MonthlyStats';

const { width } = Dimensions.get('window');
const TABS = ['Veckan', 'Månad', 'År'];

export default function UserScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || '');
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.userEmail}>{userEmail}</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === index && styles.activeTabButton]}
            onPress={() => setActiveTab(index)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipeable Content Area (can just be a ScrollView for now) */}
      <ScrollView 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: activeTab * width, y: 0 }}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          if (newIndex !== activeTab) {
            setActiveTab(newIndex);
          }
        }}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <View style={styles.page}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
             <WeeklyStats />
          </ScrollView>
        </View>

        <View style={styles.page}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
             <MonthlyStats />
          </ScrollView>
        </View>

        <View style={styles.page}>
          <View style={styles.placeholderContainer}>
             <Text style={styles.placeholderText}>År - Kommer snart</Text>
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  userEmail: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  signOutButton: {
    backgroundColor: '#27272A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  signOutText: {
    color: '#FF3B3E',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#D1D5DB', // Light grey for inactive
    borderRadius: 4,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#A3E635', // Green for active
  },
  tabText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#0A0A0A',
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width: width,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 16,
  }
});
