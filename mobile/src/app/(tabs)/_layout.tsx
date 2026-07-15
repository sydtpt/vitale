import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, colors } from '../../theme';
import { TabBarScrollProvider, useTabBarCollapsed } from '../../lib/tab-bar-scroll';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';

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
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Registrar"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
      {TABS.slice(mid).map(renderTab)}
    </>
  );
}

function AdaptiveTabBar({ state, navigation, onQuickAdd }: BottomTabBarProps & { onQuickAdd: () => void }) {
  const { scheme, blurIntensity } = useTheme();
  const insets = useSafeAreaInsets();
  const collapsed = useTabBarCollapsed();
  const isDark = scheme === 'dark';

  const bottom = Math.max(insets.bottom, 16) + 8;
  const inactiveColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(31,27,22,0.45)';
  // tint "default" (UIBlurEffectStyleRegular) = material nativo translúcido,
  // sem a camada branca leitosa do "extraLight" que deixava a pill opaca.
  const borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)';
  const shadowOpacity = isDark ? 0.22 : 0.10;

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
      <BlurView
        tint={isDark ? 'dark' : 'default'}
        intensity={blurIntensity}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.pill}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth * 1.5, borderColor },
          ]}
        />
        <View style={styles.row}>
          <TabItems state={state} navigation={navigation} inactiveColor={inactiveColor} onQuickAdd={onQuickAdd} />
        </View>
      </BlurView>
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

const styles = StyleSheet.create({
  // Glass pill
  pillWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 20,
  },
  pill: {
    borderRadius: RADIUS,
    overflow: 'hidden',
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
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: {
    fontWeight: '700',
  },
});
