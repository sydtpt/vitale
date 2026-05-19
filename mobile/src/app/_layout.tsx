import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth.store';
import { colors } from '../theme';

export default function RootLayout() {
  const router = useRouter();
  const { initialize, session } = useAuthStore();

  useEffect(() => {
    initialize().then(() => {
      if (useAuthStore.getState().session) {
        router.replace('/(tabs)/');
      } else {
        router.replace('/(auth)/login');
      }
    });
  }, []);

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  );
}
