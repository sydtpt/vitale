import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/auth.store';
import { startActivitySync, stopActivitySync } from '../services/healthkit-observer';
import { startNotifications, stopNotifications } from '../services/notifications';
import { ThemeProvider, useTheme, baseBg } from '../theme';
import { RotinaBackground } from '../components/ui/RotinaBackground';
import { SplashOverlay } from '../components/ui/SplashOverlay';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';

// Primeira migalha, no escopo do módulo: é o carimbo de "o processo subiu",
// antes de qualquer render ou porta de sessão. Quando o iOS acorda o app em
// background por causa do HealthKit, esta é a única evidência de que o JS
// chegou a rodar — `AppState` diz se foi despertar silencioso ou abertura pelo
// usuário. Ver `sync-breadcrumbs.ts`.
void recordBreadcrumb('app-launch', `state=${AppState.currentState}`);

// Segura o splash nativo; o overlay de marca assume assim que o JS pinta.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Tempo mínimo do splash de marca em tela, para não “piscar” em cold starts rápidos.
const MIN_SPLASH_MS = 1100;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { initialize, session, isLoading } = useAuthStore();

  /**
   * Chave estável da sessão para os efeitos que ligam e desligam assinaturas
   * de vida longa.
   *
   * `session` é um objeto NOVO a cada renovação de token do Supabase, mesmo
   * sendo o mesmo usuário. Efeitos com `[session]` na dependência rodavam a
   * limpeza e o setup de novo a cada renovação — e o diagnóstico em device
   * mostrou o efeito colateral já no cold start, com `sync-start` e `bg-config`
   * saindo duas vezes seguidas.
   *
   * Não é só ruído: `stopActivitySync()` remove o observer de treino, e o
   * `tearDown()` da lib nativa **para as HKObserverQuery**. Uma renovação de
   * token com o app em background derrubaria os observers exatamente quando
   * eles precisam estar vivos.
   *
   * O id do usuário é o que esses efeitos realmente observam: entrou alguém,
   * saiu alguém. Renovar credencial do mesmo usuário não é evento pra eles.
   */
  const userId = session?.user.id ?? null;

  // Splash de marca: visível até o app inicializar (respeitando um tempo mínimo).
  const mountedAt = useRef(Date.now());
  const [keepSplash, setKeepSplash] = useState(true);
  const [splashUnmounted, setSplashUnmounted] = useState(false);

  useEffect(() => {
    initialize();
    // Esconde o splash nativo: o overlay de marca já cobre a tela.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const t = setTimeout(() => setKeepSplash(false), remaining);
    return () => clearTimeout(t);
  }, [isLoading]);

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
    if (!userId) return;
    startActivitySync();
    return () => stopActivitySync();
  }, [userId]);

  // Digest diário local: agenda/reagenda enquanto há sessão.
  useEffect(() => {
    if (!userId) return;
    startNotifications();
    return () => stopNotifications();
  }, [userId]);

  // Volta para home se o app ficou em background por mais de 5 minutos.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) return;
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
  }, [userId]);

  return (
    <ThemeProvider>
      <AppShell />
      {!splashUnmounted && (
        <SplashOverlay visible={keepSplash} onHidden={() => setSplashUnmounted(true)} />
      )}
    </ThemeProvider>
  );
}

/** Casca visual dentro do ThemeProvider: papel de parede atrás da navegação. */
function AppShell() {
  const { scheme, wallpaper } = useTheme();
  const base = baseBg(scheme);

  return (
    <View style={[styles.root, { backgroundColor: base }]}>
      {/* Sem `backgroundColor`: a expo-status-bar 56 removeu a prop, que já era
          no-op desde a 55 (só valia no Android, e nem lá surtia efeito). O fundo
          continua vindo do `View` acima. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
        <Stack.Screen name="cultura/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cultura/adicionar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cultura/[tipo]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cultura/item/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habitos/dia" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="metas/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="metas/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="registros/marcar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="treinos/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="treinos/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="recuperacao/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="retrospectiva/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico/[label]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico/[label]/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="compras/editor" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/perfil" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/app" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/notificacoes" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/objetivos" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/dados" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="configuracoes/conexoes" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
