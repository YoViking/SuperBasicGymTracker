import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Home, Dumbbell, Search, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavLayout } from '../utils/layout';

interface AppBottomNavProps {
  activeTab?: 'index' | 'workouts' | 'exercises' | 'user';
}

export default function AppBottomNav({ activeTab = 'workouts' }: AppBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleNavigate = (route: string) => {
    router.replace(route as any);
  };

  const { height: navHeight, bottomPadding } = getBottomNavLayout(insets.bottom);

  return (
    <View style={[styles.container, { height: navHeight, paddingBottom: bottomPadding }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleNavigate('/(tabs)')}
        activeOpacity={0.7}
      >
        <Home size={24} color={activeTab === 'index' ? '#A3E635' : '#94A3B8'} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleNavigate('/(tabs)/workouts')}
        activeOpacity={0.7}
      >
        <Dumbbell size={24} color={activeTab === 'workouts' ? '#A3E635' : '#94A3B8'} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleNavigate('/(tabs)/exercises')}
        activeOpacity={0.7}
      >
        <Search size={24} color={activeTab === 'exercises' ? '#A3E635' : '#94A3B8'} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleNavigate('/(tabs)/user')}
        activeOpacity={0.7}
      >
        <User size={24} color={activeTab === 'user' ? '#A3E635' : '#94A3B8'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1E222B',
    borderTopWidth: 0,
    elevation: 25,
    zIndex: 200,
    width: '100%',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
