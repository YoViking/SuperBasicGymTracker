import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { Poppins_900Black } from '@expo-google-fonts/poppins';
import { ActivityIndicator, View, LogBox } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useEffect } from 'react';

LogBox.ignoreLogs([
  'Android Push notifications (remote notifications) functionality',
]);

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/user');
    }
  }, [session, loading, segments]);

  return (
    <Stack>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="exercise/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/edit/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/exercise/[workoutId]/[exerciseId]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/replace/[workoutId]/[oldExerciseId]" options={{ headerShown: false }} />
      <Stack.Screen name="archive" options={{ headerShown: false }} />
      <Stack.Screen name="folder/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="choose-workout" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="create-workout" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Bangers_400Regular,
    Poppins_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#A3E635" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
