import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Platform, ToastAndroid } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Scale } from 'lucide-react-native';
import WeeklyStats from '../../src/components/statistics/WeeklyStats';
import MonthlyStats from '../../src/components/statistics/MonthlyStats';
import YearlyStats from '../../src/components/statistics/YearlyStats';
import { getUserBodyWeight, saveUserBodyWeight, DEFAULT_BODY_WEIGHT } from '../../src/utils/volume';

const { width } = Dimensions.get('window');
const TABS = ['Veckan', 'Månad', 'År'];

export default function UserScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');
  const [bodyWeightText, setBodyWeightText] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || '');
    });

    getUserBodyWeight().then(weight => {
      setBodyWeightText(weight ? weight.toString() : DEFAULT_BODY_WEIGHT.toString());
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveWeight = async () => {
    const parsed = parseFloat(bodyWeightText.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed < 400) {
      await saveUserBodyWeight(parsed);
      setBodyWeightText(parsed.toString());
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Kroppsvikt sparad: ${parsed} kg`, ToastAndroid.SHORT);
      }
    }
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

      {/* Body Weight Setting Card */}
      <View style={styles.weightCard}>
        <View style={styles.weightIconWrapper}>
          <Scale size={20} color="#A3E635" />
        </View>
        <View style={styles.weightInfo}>
          <Text style={styles.weightTitle}>Min Kroppsvikt</Text>
          <Text style={styles.weightDesc}>Används för volymberäkning vid kroppsviktsövningar</Text>
        </View>
        <View style={styles.weightInputGroup}>
          <TextInput
            style={styles.weightInput}
            value={bodyWeightText}
            onChangeText={setBodyWeightText}
            onEndEditing={handleSaveWeight}
            keyboardType="numeric"
            placeholder="75"
            placeholderTextColor="#64748B"
            maxLength={5}
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
             <YearlyStats />
          </ScrollView>
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
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  weightIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  weightInfo: {
    flex: 1,
    marginRight: 12,
  },
  weightTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  weightDesc: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  weightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  weightInput: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'right',
    padding: 0,
  },
  weightUnit: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
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
