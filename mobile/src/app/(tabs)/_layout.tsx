import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// O expo-router 56 trocou o `@react-navigation/*` por `standard-navigation` e
// internalizou o bottom-tabs, então o pacote de onde este tipo vinha deixou de
// ser instalado. O tipo é o mesmo, só mudou de casa; o index do expo-router não
// o reexporta, e `layouts/Tabs` é o módulo do próprio `Tabs` usado abaixo.
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { colors, fonts, themed, useTheme } from '../../theme';
import { TabBarScrollProvider, useTabBarCollapsed } from '../../lib/tab-bar-scroll';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';

/**
 * `UIGlassEffect` (o Liquid Glass do iOS 26) contra `UIBlurEffect` (o material
 * do `expo-blur`, que é o de sempre desde o iOS 7).
 *
 * São renderizadores **diferentes**, não dois ajustes do mesmo: só o primeiro
 * refrata o conteúdo atrás nos poucos pontos da beirada — como uma lente — e
 * desenha um realce especular que varia ao redor do formato e reage à
 * inclinação do aparelho. É por isso que a barra parecia "quase igual, menos na
 * borda": a borda é justamente onde os dois materiais divergem, e nenhum ajuste
 * de `borderColor` chega lá. O `PillSurface` abaixo usa o material do sistema
 * quando ele existe e imita o que dá no resto.
 *
 * Constant nativo lido uma vez — não muda em runtime. No Android e no iOS < 26 o
 * pacote cai no shim JS e isto é `false`.
 */
const LIQUID_GLASS = isLiquidGlassAvailable();

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDef[] = [
  { name: 'index',     label: 'Hoje',      icon: 'home-outline',                       iconActive: 'home' },
  { name: 'compras',   label: 'Compras',   icon: 'cart-outline',                       iconActive: 'cart' },
  { name: 'historico', label: 'Histórico', icon: 'barbell-outline',                    iconActive: 'barbell' },
  { name: 'mais',      label: 'Mais',      icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle' },
];

function TabItems({
  state,
  navigation,
  inactiveColor,
  onQuickAdd,
}: {
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
  inactiveColor: string;
  onQuickAdd: () => void;
}) {
  const renderTab = (tab: TabDef) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    if (routeIndex === -1) return null;
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(tab.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <Pressable
        key={tab.name}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={tab.label}
      >
        <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
          <Ionicons
            name={isFocused ? tab.iconActive : tab.icon}
            size={22}
            color={isFocused ? colors.primary : inactiveColor}
          />
          <Text
            style={[
              styles.label,
              { color: isFocused ? colors.primary : inactiveColor },
              isFocused && styles.labelActive,
            ]}
          >
            {tab.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  // 2 tabs · botão "+" central · 2 tabs
  const mid = Math.ceil(TABS.length / 2);
  return (
    <>
      {TABS.slice(0, mid).map(renderTab)}
      <Pressable
        onPress={onQuickAdd}
        style={({ pressed }) => [
          styles.fab,
          // O contorno é `transparent` nas marcas que não têm — desenhar sempre
          // evita o pulo de layout que apareceria ao trocar de marca.
          { borderColor: colors.primaryOutline },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Registrar"
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
      {TABS.slice(mid).map(renderTab)}
    </>
  );
}

/**
 * A superfície de vidro da pílula. Duas implementações, a mesma forma.
 */
function PillSurface({ children }: { children: React.ReactNode }) {
  const { scheme, blurIntensity } = useTheme();
  const isDark = scheme === 'dark';

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        /**
         * O app tem o próprio seletor de tema, então a aparência do material é
         * escolha nossa, não do sistema. Sem isto (o padrão é `auto`) voltaria o
         * mesmo defeito que o `tint="default"` tinha no `BlurView`: iPhone no
         * escuro e app no claro renderizavam uma pílula escura.
         */
        colorScheme={isDark ? 'dark' : 'light'}
        /**
         * Sem `overflow: 'hidden'` aqui de propósito: o `UIGlassEffect` desenha
         * o próprio aro e o próprio recorte, e recortar por fora comeria a
         * sombra do "+".
         */
        style={styles.pill}
      >
        {children}
      </GlassView>
    );
  }

  /**
   * Fallback (iOS < 26 e Android): `UIBlurEffect` com o realce especular
   * aproximado à mão.
   *
   * Material com aparência **fixa**, não `default` — `tint="default"` mapeia
   * para `UIBlurEffectStyleRegular`, que segue a aparência do SISTEMA. Era
   * invisível enquanto o `userInterfaceStyle: light` travava o app em claro, e
   * virou defeito quando ele passou a `automatic`. `systemChromeMaterial{Light,
   * Dark}` é o mesmo material de cromo com a aparência escolhida por nós.
   */
  return (
    <BlurView
      tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={blurIntensity}
      experimentalBlurMethod="dimezisBlurView"
      style={[styles.pill, styles.pillClip]}
    >
      {/* Brilho do topo: o especular do vidro é forte na aresta de cima e some
          na metade. Vai atrás do conteúdo. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          [
            isDark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.50)',
            'rgba(255,255,255,0)',
          ] as const
        }
        locations={[0, 0.5] as const}
        style={StyleSheet.absoluteFill}
      />
      {children}
      {/**
       * Aro CLARO, e é este o ponto. O aro escuro que vivia aqui
       * (`rgba(0,0,0,0.08)`) era o que mais destoava do material do sistema: o
       * vidro do iOS nunca se separa do fundo por um contorno escuro, e sim pelo
       * realce claro somado à sombra difusa lá do `pillWrapper`.
       */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.rim,
          { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.70)' },
        ]}
      />
    </BlurView>
  );
}

function AdaptiveTabBar({ state, navigation, onQuickAdd }: BottomTabBarProps & { onQuickAdd: () => void }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const collapsed = useTabBarCollapsed();
  const isDark = scheme === 'dark';

  const bottom = Math.max(insets.bottom, 16) + 8;
  const inactiveColor = colors.ink3;
  // Sombra larga e fraca. Sombra curta e forte "achata" o vidro — no material do
  // sistema ela é o que dá o descolamento do fundo, sem virar um contorno.
  const shadowOpacity = isDark ? 0.28 : 0.09;

  // Colapsa 25% ao rolar para baixo, ancorado na base (translateY compensa a
  // escala p/ a pill não "subir" ao encolher).
  const scale = collapsed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, COLLAPSED_SCALE],
  });
  const translateY = collapsed.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (PILL_HEIGHT * (1 - COLLAPSED_SCALE)) / 2],
  });
  const animatedStyle = { transform: [{ translateY }, { scale }] };

  return (
    <Animated.View style={[styles.pillWrapper, { bottom, shadowOpacity }, animatedStyle]}>
      <PillSurface>
        <View style={styles.row}>
          <TabItems state={state} navigation={navigation} inactiveColor={inactiveColor} onQuickAdd={onQuickAdd} />
        </View>
      </PillSurface>
    </Animated.View>
  );
}

export default function TabLayout() {
  const [quickAdd, setQuickAdd] = useState(false);
  return (
    <TabBarScrollProvider>
      <Tabs
        tabBar={(props) => <AdaptiveTabBar {...props} onQuickAdd={() => setQuickAdd(true)} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="index"     options={{ title: 'Hoje' }} />
        <Tabs.Screen name="compras"   options={{ title: 'Compras' }} />
        <Tabs.Screen name="historico" options={{ title: 'Histórico' }} />
        <Tabs.Screen name="saude"     options={{ href: null }} />
        <Tabs.Screen name="semana"    options={{ href: null }} />
        <Tabs.Screen name="mais"      options={{ title: 'Mais' }} />
      </Tabs>
      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
    </TabBarScrollProvider>
  );
}

const RADIUS = 36;
const PILL_HEIGHT = 70;
const COLLAPSED_SCALE = 0.75;

const styles = themed(() =>
  StyleSheet.create({
    // Glass pill
    pillWrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 24,
      elevation: 20,
    },
    pill: {
      borderRadius: RADIUS,
    },
    // Só o fallback recorta: o `GlassView` recorta sozinho (ver `PillSurface`).
    pillClip: {
      overflow: 'hidden',
    },
    rim: {
      borderRadius: RADIUS,
      borderWidth: StyleSheet.hairlineWidth * 1.5,
    },

    // Shared
    row: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
    },
    fab: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginHorizontal: 6,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    tabInner: {
      alignItems: 'center',
      gap: 3,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 24,
    },
    tabInnerActive: {
      backgroundColor: 'rgba(242, 92, 43, 0.10)',
    },
    label: {
      fontSize: 10,
      fontFamily: fonts.sansMedium,
      letterSpacing: 0.2,
    },
    labelActive: {
      fontFamily: fonts.sansBold,
    },
  }),
);
