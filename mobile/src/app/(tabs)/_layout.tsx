import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type LayoutRectangle,
} from 'react-native';
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
 *
 * O `try` não é decoração: `isLiquidGlassAvailable()` faz `requireNativeModule`,
 * que **lança** se o módulo não estiver no binário. Como isto roda no escopo do
 * módulo do layout das abas, um OTA caindo num build antigo demais viraria
 * crash de boot em vez de barra sem vidro.
 */
const LIQUID_GLASS = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

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

/** Retângulo do realce de uma aba, em coordenadas da pílula. */
type TabRect = { x: number; y: number; width: number; height: number };

/**
 * O "+" — **vazado**: um furo no vidro da pílula, com a marca só no aro e no
 * glifo.
 *
 * Era tinta cheia, e a tinta cheia era defensável: dentro de uma superfície de
 * vidro o iOS 26 desenha a ação principal como preenchimento tingido (o
 * `.glassProminent`). O que derrubou aquele desenho não foi a tinta, foi o aro.
 * Ele carregava duas intenções na mesma linha — realce especular quando a marca
 * não declarava contorno, cor da marca quando declarava — e por isso só o
 * `laranja` e a `tinta` pareciam de vidro; `azul` e `verde` trocavam a luz da
 * beirada por um anel `#000000` opaco, que sumia por completo no escuro.
 *
 * Sem preenchimento o botão fica mais quieto do que era, e isso é o custo
 * aceito: numa barra cuja função é registrar rápido, a ação principal deixa de
 * gritar. O que compensa é que ele passa a ser o **único** controle da barra com
 * enclausuramento — nenhuma aba tem aro —, e o glifo continua em 28px contra os
 * 22px dos ícones de aba.
 *
 * Nada disto é `GlassView`: o furo mostra o vidro que já existe. Um material
 * novo aqui seria `UIVisualEffectView` dentro de `UIVisualEffectView`, que
 * amostraria o backdrop já borrado pelo de fora.
 */
function QuickAddButton({ onPress }: { onPress: () => void }) {
  const { scheme } = useTheme();
  // O toque AFUNDA, não desbota. `opacity: 0.85` é o gesto do Android; o iOS
  // responde com escala, e com mola — driver nativo, como o resto da barra.
  const press = useRef(new Animated.Value(0)).current;
  const spring = (toValue: number) =>
    Animated.spring(press, {
      toValue,
      useNativeDriver: true,
      damping: 16,
      stiffness: 340,
      mass: 0.6,
    }).start();

  return (
    <Animated.View
      style={[
        styles.fabWrap,
        {
          transform: [
            { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(1)}
        onPressOut={() => spring(0)}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Registrar"
      >
        {/* A aresta interna do corte. É ela que faz o círculo ler como um furo
            no vidro e não como um anel desenhado por cima dele: vidro cortado
            pega luz na beirada. Fica DENTRO do aro da marca — o `absoluteFill`
            de um filho já mede a partir da borda, não da caixa externa. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.fabCut,
            { borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)' },
          ]}
        />
        {/* `primaryGraphic`, não `primary`: sem preenchimento, o traço é a única
            coisa que separa o botão do fundo, e o piso que vale para ele é o de
            objeto gráfico. O `verde` claro reprovava em 2,11. */}
        <Ionicons name="add" size={28} color={colors.primaryGraphic} />
      </Pressable>
    </Animated.View>
  );
}

function TabItems({
  state,
  navigation,
  inactiveColor,
  onQuickAdd,
  onMeasure,
}: {
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
  inactiveColor: string;
  onQuickAdd: () => void;
  onMeasure: (name: string, part: 'outer' | 'inner', layout: LayoutRectangle) => void;
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
        onLayout={(e) => onMeasure(tab.name, 'outer', e.nativeEvent.layout)}
        style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={tab.label}
      >
        {/* O realce da aba ativa NÃO mora mais aqui: é a `SelectionRail`, uma
            só, que desliza entre as abas. Este `onLayout` é o que diz a ela onde
            cada aba começa e quão larga ela é. */}
        <View
          style={styles.tabInner}
          onLayout={(e) => onMeasure(tab.name, 'inner', e.nativeEvent.layout)}
        >
          {/* `primaryText` e não `primary`. O rótulo é letra de 10px, então o
              piso é o de texto (4,5) e não o gráfico — e `primary` é uma cor
              escolhida para PREENCHER, não para escrever: a marca `verde` no
              claro media 2,11 aqui. O ícone acompanha o rótulo em vez de usar o
              piso gráfico mais frouxo, porque os dois formam um bloco só e duas
              cores quase iguais lado a lado leem como defeito. */}
          <Ionicons
            name={isFocused ? tab.iconActive : tab.icon}
            size={22}
            color={isFocused ? colors.primaryText : inactiveColor}
          />
          <Text
            style={[
              styles.label,
              { color: isFocused ? colors.primaryText : inactiveColor },
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
      <QuickAddButton onPress={onQuickAdd} />
      {TABS.slice(mid).map(renderTab)}
    </>
  );
}

/**
 * O realce da aba ativa — uma **régua** de 3px sob o par ícone+rótulo, uma só,
 * que desliza de aba em aba com mola.
 *
 * Era uma cápsula preenchida a 10% da marca, e duas coisas a derrubaram. A
 * primeira é que sobre vidro borrado aquele preenchimento não chegava a formar
 * degrau: quatro sinais fracos ao mesmo tempo — ícone cheio, cor, negrito e
 * cápsula — e nenhum decisivo. A segunda é que a largura vinha do rótulo
 * medido, e o rótulo engorda para `sansBold` justamente ao ficar ativo: o
 * `onLayout` disparava com a mola em voo e mexia no `outputRange` no meio do
 * caminho.
 *
 * A régua tem largura fixa — a mesma do ícone acima dela —, e isso resolve as
 * duas de uma vez. Some a interpolação de largura, e com ela some a segunda
 * mola: sobrou `translateX`, que roda no driver nativo, que é o que segura a
 * animação quando a troca de aba monta a tela nova e trava a thread JS. O
 * negrito também deixa de importar: o `tabInner` é centrado dentro de um
 * `Pressable` com `flex: 1`, então quando ele alarga o `x` recua metade e o
 * CENTRO fica parado — e é o centro que a régua persegue.
 */
function SelectionRail({
  rects,
  activeIndex,
}: {
  rects: Record<string, TabRect>;
  activeIndex: number;
}) {
  // Mola só depois que as quatro abas se mediram: o `interpolate` exige as
  // faixas completas, e antes disso não há posição para onde deslizar.
  const ready = TABS.every((t) => rects[t.name]);

  const posX = useRef(new Animated.Value(Math.max(activeIndex, 0))).current;
  const opacity = useRef(new Animated.Value(activeIndex >= 0 ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      ...(activeIndex >= 0
        ? [
            Animated.spring(posX, {
              toValue: activeIndex,
              useNativeDriver: true,
              damping: 20,
              stiffness: 220,
              mass: 0.9,
            }),
          ]
        : []),
      Animated.timing(opacity, {
        toValue: activeIndex >= 0 ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex, posX, opacity]);

  if (!ready) return null;

  const inputRange = TABS.map((_, i) => i);
  // A geometria vertical é a mesma nas quatro (mesmo `tabInner`), então sai da
  // primeira; só o eixo X muda de aba para aba.
  const { y, height } = rects[TABS[0].name];

  /**
   * A travessia por baixo do "+".
   *
   * Enquanto o botão era tinta cheia ele escondia a régua nesse trecho, e o
   * defeito passava despercebido. Vazado, ele não esconde mais nada: a régua
   * atravessaria VISÍVEL por dentro do furo ao ir de Compras para Histórico.
   * Some no meio do caminho — e some saindo da própria mola, por interpolação
   * do mesmo valor, então continua tudo nativo e não há segunda animação para
   * dessincronizar. `clamp` segura os extremos em 1: 0→3 também cruza o furo, e
   * também mergulha.
   */
  const gap = TABS.length / 2 - 0.5;
  const crossing = posX.interpolate({
    inputRange: [gap - 0.5, gap - 0.15, gap + 0.15, gap + 0.5],
    outputRange: [1, 0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.rail,
          {
            // Dentro do respiro de baixo do `tabInner`, colada no rótulo.
            top: y + height - RAIL_H - 3,
            opacity: Animated.multiply(opacity, crossing),
            transform: [
              {
                translateX: posX.interpolate({
                  inputRange,
                  outputRange: TABS.map(
                    (t) => rects[t.name].x + rects[t.name].width / 2 - RAIL_W / 2,
                  ),
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * A superfície de vidro da pílula. Duas implementações, a mesma forma.
 */
function PillSurface({ children }: { children: React.ReactNode }) {
  const { scheme, blurIntensity } = useTheme();
  const isDark = scheme === 'dark';

  if (LIQUID_GLASS) {
    /**
     * A intensidade é a OPACIDADE da camada de vidro, e não mais um estado do
     * material.
     *
     * Trocar `none` → `clear` → `regular` nunca ia dar uma rampa: o `clear` do
     * `UIGlassEffect` é muito menos transparente do que o nome sugere, então o
     * slider caía de "nada" direto para "quase fosco" entre 9% e 10%. Os
     * estados do material são três; o que o usuário quer é um contínuo.
     *
     * Atenuar a `UIVisualEffectView` pelo alfa mistura o resultado do efeito com
     * o fundo cru — enfraquece borrão, refração e realce juntos, na proporção
     * certa. Em 100% o material fica intacto, que é o vidro do iOS 26 de
     * verdade; em 0% não há vidro nenhum.
     */
    const glassOpacity = Math.min(Math.max(blurIntensity, 0), 100) / 100;
    return (
      <View style={styles.pill}>
        {/**
         * O vidro é uma CAMADA, sem filhos dentro. Enquanto os ícones moravam
         * dentro dele, baixar a opacidade apagaria a barra inteira junto — é o
         * que obriga esta inversão.
         */}
        {glassOpacity > 0 && (
          <GlassView
            glassEffectStyle="regular"
            /**
             * O app tem o próprio seletor de tema, então a aparência do material
             * é escolha nossa, não do sistema. Sem isto (o padrão é `auto`)
             * voltaria o mesmo defeito que o `tint="default"` tinha no
             * `BlurView`: iPhone no escuro e app no claro renderizavam uma
             * pílula escura.
             */
            colorScheme={isDark ? 'dark' : 'light'}
            pointerEvents="none"
            style={[styles.pillLayer, { opacity: glassOpacity }]}
          />
        )}
        {children}
      </View>
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

  /**
   * Onde cada aba está, para a `SelectionCapsule` deslizar até lá.
   *
   * São duas medidas por aba: o `Pressable` dá o X dentro da linha, e o
   * `tabInner` dá o recorte que o realce abraça (o `Pressable` é `flex: 1`, bem
   * mais largo que o conteúdo). Ficam no ref até o par fechar — só então o
   * estado muda, e só se o retângulo mudou de fato, senão cada `onLayout`
   * viraria um render.
   */
  const [rects, setRects] = useState<Record<string, TabRect>>({});
  const parts = useRef<Record<string, { outer?: LayoutRectangle; inner?: LayoutRectangle }>>({});
  const measure = useCallback((name: string, part: 'outer' | 'inner', layout: LayoutRectangle) => {
    const entry = (parts.current[name] ??= {});
    entry[part] = layout;
    const { outer, inner } = entry;
    if (!outer || !inner) return;
    const next: TabRect = {
      x: outer.x + inner.x,
      y: outer.y + inner.y,
      width: inner.width,
      height: inner.height,
    };
    setRects((prev) => {
      const cur = prev[name];
      if (
        cur &&
        cur.x === next.x &&
        cur.y === next.y &&
        cur.width === next.width &&
        cur.height === next.height
      ) {
        return prev;
      }
      return { ...prev, [name]: next };
    });
  }, []);

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

  const activeIndex = TABS.findIndex((t) => t.name === state.routes[state.index]?.name);

  return (
    <Animated.View style={[styles.pillWrapper, { bottom, shadowOpacity }, animatedStyle]}>
      <PillSurface>
        {/* Antes da `row`, para ficar ATRÁS dos ícones. A `row` é o único filho
            em fluxo da pílula, então as medidas das abas já são coordenadas da
            pílula e a régua pode usá-las direto. */}
        <SelectionRail rects={rects} activeIndex={activeIndex} />
        <View style={styles.row}>
          <TabItems
            state={state}
            navigation={navigation}
            inactiveColor={inactiveColor}
            onQuickAdd={onQuickAdd}
            onMeasure={measure}
          />
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

const FAB_SIZE = 50;
/** Espessura do aro do "+". Era 1,6; sem preenchimento, o traço é tudo o que há. */
const FAB_RING = 2;

/** A régua da aba ativa. Largura igual à do ícone que ela sublinha. */
const RAIL_W = 22;
const RAIL_H = 3;

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
    // A camada de vidro, atrás de tudo. Sem `overflow: 'hidden'` no pai: o
    // `UIGlassEffect` recorta a si mesmo, e recortar por fora comeria a sombra
    // do "+".
    pillLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: RADIUS,
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
    fabWrap: {
      marginHorizontal: 6,
      alignSelf: 'center',
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      /**
       * Vazado: o furo mostra o vidro da pílula que já está atrás. Sem
       * preenchimento não há mais o que recortar, então caiu o
       * `overflow: 'hidden'` junto — e com ele a briga que ele tinha com
       * `shadow*` na mesma view no iOS.
       */
      backgroundColor: 'transparent',
      /**
       * `primaryGraphic`, e não mais o par `primary` / `primaryOutline`.
       *
       * O aro antigo carregava duas intenções: realce especular branco quando a
       * marca não declarava contorno, `#000000` quando declarava. Era o que
       * fazia só o `laranja` e a `tinta` parecerem de vidro — e o que sumia por
       * completo no escuro, onde preto sobre quase-preto não tem contraste.
       * Agora o aro tem um trabalho só: separar o botão do fundo, no piso de
       * objeto gráfico. O `primaryOutline` continua vivo no `CheckButton`, que
       * ainda é preenchido.
       */
      borderWidth: FAB_RING,
      borderColor: colors.primaryGraphic,
    },
    fabCut: {
      borderRadius: FAB_SIZE / 2 - FAB_RING,
      borderWidth: StyleSheet.hairlineWidth * 1.5,
    },
    tabInner: {
      alignItems: 'center',
      gap: 3,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    rail: {
      position: 'absolute',
      left: 0,
      width: RAIL_W,
      height: RAIL_H,
      borderRadius: RAIL_H / 2,
      // A mesma cor do ícone e do rótulo que ela sublinha: os três são um bloco
      // só, e a régua é o traço mais grosso dele, não um objeto à parte.
      backgroundColor: colors.primaryText,
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
