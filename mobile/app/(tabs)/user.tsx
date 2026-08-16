import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, ToastAndroid, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Scale, Settings, LogOut, X } from 'lucide-react-native';
import WeeklyStats from '../../src/components/statistics/WeeklyStats';
import MonthlyStats from '../../src/components/statistics/MonthlyStats';
import YearlyStats from '../../src/components/statistics/YearlyStats';
import { getUserBodyWeight, DEFAULT_BODY_WEIGHT } from '../../src/utils/volume';

const { width } = Dimensions.get('window');
const STATS_TABS = ['Veckan', 'Månad', 'År'];

export default function UserScreen() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<'oversikt' | 'du'>('oversikt');
  const [activeStatsTab, setActiveStatsTab] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [bodyWeightText, setBodyWeightText] = useState<string>('');
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
      }

      const weight = await getUserBodyWeight();
      setBodyWeightText(weight ? weight.toString() : DEFAULT_BODY_WEIGHT.toString());
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUserBodyWeight().then(weight => {
        setBodyWeightText(weight ? weight.toString() : DEFAULT_BODY_WEIGHT.toString());
      });
    }, [])
  );

  const initial = (userName || userEmail || 'J').trim().charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setIsSettingsModalVisible(false);
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarCircle} 
          onPress={() => setIsSettingsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setIsSettingsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Settings size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {/* Main Top-Level Tabs: Översikt & Du */}
      <View style={styles.mainTabsContainer}>
        <TouchableOpacity
          style={styles.mainTabItem}
          onPress={() => setMainTab('oversikt')}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainTabText, mainTab === 'oversikt' && styles.mainTabTextActive]}>
            Översikt
          </Text>
          {mainTab === 'oversikt' && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mainTabItem}
          onPress={() => setMainTab('du')}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainTabText, mainTab === 'du' && styles.mainTabTextActive]}>
            Du
          </Text>
          {mainTab === 'du' && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Tab 1: Översikt View */}
      {mainTab === 'oversikt' && (
        <View style={styles.tabContentContainer}>
          {/* Stats Sub Tabs: Veckan, Månad, År */}
          <View style={styles.tabsContainer}>
            {STATS_TABS.map((tab, index) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, activeStatsTab === index && styles.activeTabButton]}
                onPress={() => setActiveStatsTab(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeStatsTab === index && styles.activeTabText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Swipeable Content Area */}
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: activeStatsTab * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              if (newIndex !== activeStatsTab) {
                setActiveStatsTab(newIndex);
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
        </View>
      )}

      {/* Tab 2: Du View */}
      {mainTab === 'du' && (
        <ScrollView style={styles.tabContentContainer} contentContainerStyle={styles.scrollContent}>
          {/* Body Weight Card */}
          <TouchableOpacity 
            style={styles.weightCard} 
            onPress={() => router.push('/body-weight')}
            activeOpacity={0.8}
          >
            <View style={styles.weightIconWrapper}>
              <Scale size={22} color="#A3E635" />
            </View>
            <View style={styles.weightInfo}>
              <Text style={styles.weightTitle}>Min Kroppsvikt</Text>
              <Text style={styles.weightDesc}>Används för volymberäkning vid kroppsviktsövningar</Text>
            </View>
            <View style={styles.weightInputGroup}>
              <Text style={styles.weightInput}>{bodyWeightText}</Text>
              <Text style={styles.weightUnit}>kg</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Settings Modal */}
      <Modal
        visible={isSettingsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setIsSettingsModalVisible(false)} 
          />
          <View style={styles.settingsModal}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Inställningar</Text>
              <TouchableOpacity 
                onPress={() => setIsSettingsModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.accountSection}>
              <View style={styles.modalAvatarCircle}>
                <Text style={styles.modalAvatarText}>{initial}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountEmail} numberOfLines={1}>{userEmail || 'Inloggad användare'}</Text>
                <Text style={styles.accountLabel}>Inloggad</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.signOutModalButton} 
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.signOutModalText}>Logga ut</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  mainTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 28,
    marginBottom: 20,
  },
  mainTabItem: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  mainTabText: {
    color: '#94A3B8',
    fontSize: 19,
    fontWeight: '600',
  },
  mainTabTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  mainTabIndicator: {
    height: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: 2,
    marginTop: 6,
    alignSelf: 'stretch',
  },
  tabContentContainer: {
    flex: 1,
  },
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  weightIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  weightInfo: {
    flex: 1,
    marginRight: 12,
  },
  weightTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  weightDesc: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 15,
  },
  weightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  weightInput: {
    color: '#A3E635',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
    padding: 0,
  },
  weightUnit: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  accountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  modalAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  accountLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  signOutModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 12,
    borderRadius: 12,
  },
  signOutModalText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
