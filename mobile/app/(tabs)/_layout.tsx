import { Tabs } from 'expo-router';
import { Home, Dumbbell, Search, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavLayout } from '../../src/utils/layout';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { height, bottomPadding } = getBottomNavLayout(insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#1E222B', // Dark slate background for tab bar
          borderTopWidth: 0,
          elevation: 0,
          height,
          paddingTop: 10,
          paddingBottom: bottomPadding,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: '#A3E635', // Lime green active tint
        tabBarInactiveTintColor: '#94A3B8', // Slate 400 inactive tint
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hem',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Dumbbell size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

