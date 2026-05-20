import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth.store';
import { colors } from '../theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { initialize, session, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, segments, isLoading]);

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="fitness/[label]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="fitness/workout/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
