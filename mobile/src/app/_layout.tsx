import { useEffect, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth.store';
import { startActivitySync, stopActivitySync } from '../services/healthkit-observer';
import { ThemeProvider, useTheme, baseBg } from '../theme';
import { RotinaBackground } from '../components/ui/RotinaBackground';

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

  // Sincronização incremental dos tipos inscritos enquanto há sessão.
  useEffect(() => {
    if (!session) return;
    startActivitySync();
    return () => stopActivitySync();
  }, [session]);

  // Volta para home se o app ficou em background por mais de 5 minutos.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!session) return;
    const TIMEOUT = 5 * 60 * 1000;
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= TIMEOUT) {
          router.replace('/');
        }
        backgroundedAt.current = null;
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [session]);

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

/** Casca visual dentro do ThemeProvider: papel de parede atrás da navegação. */
function AppShell() {
  const { scheme, wallpaper } = useTheme();
  const base = baseBg(scheme);

  return (
    <View style={[styles.root, { backgroundColor: base }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} backgroundColor={base} />
      {wallpaper !== 'flat' && <RotinaBackground variant={wallpaper} />}
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="fitness/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="fitness/[label]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="fitness/workout/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="saude/[metric]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/dia" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/marcar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico/[label]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico/[label]/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="compras/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="compras/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/perfil" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/app" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/objetivos" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/dados" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
