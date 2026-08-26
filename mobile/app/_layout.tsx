import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { Poppins_900Black } from '@expo-google-fonts/poppins';
import { ActivityIndicator, View, LogBox, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { WorkoutSessionProvider } from '../src/context/WorkoutSessionContext';
import GlobalWorkoutPlayer from '../src/components/GlobalWorkoutPlayer';
import { useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { isRecoveryUrl, handleAuthUrl } from '../src/services/auth';

LogBox.ignoreLogs([
  'Android Push notifications (remote notifications) functionality',
]);

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    const checkUrl = async (url: string | null) => {
      if (url && isRecoveryUrl(url)) {
        const res = await handleAuthUrl(url);
        if (res.success) {
          router.replace('/reset-password');
        }
      }
    };

    Linking.getInitialURL().then(checkUrl);
    const sub = Linking.addEventListener('url', (e) => checkUrl(e.url));

    return () => {
      authListener.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'reset-password' || segments[0] === 'terms';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && segments[0] === 'auth') {
      router.replace('/(tabs)/user');
    }
  }, [session, loading, segments]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/top" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="workout/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="workout/exercise/[workoutId]/[exerciseId]" options={{ headerShown: false }} />
        <Stack.Screen name="workout/replace/[workoutId]/[oldExerciseId]" options={{ headerShown: false }} />
        <Stack.Screen name="folder/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="body-weight" options={{ headerShown: false }} />
        <Stack.Screen name="choose-workout" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="create-workout" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <GlobalWorkoutPlayer />
      </View>
    </View>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <WorkoutSessionProvider>
          <RootLayoutNav />
          <StatusBar style="light" />
        </WorkoutSessionProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
