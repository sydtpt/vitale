/**
 * RotinaBackground — papéis de parede abstratos do app (camada de fundo).
 *
 * Recria, em React Native (react-native-svg), os 7 fundos mobile (retrato) da
 * paleta creme do Rotina + o fundo `flat` (creme sólido). As formas são
 * ancoradas no topo (header) e no rodapé (tab bar). Todas as cores vêm dos
 * tokens do tema (via `colors`/`baseBg`), então cada variante adapta
 * automaticamente ao esquema claro/escuro.
 *
 * Uso: preenche o ancestral posicionado (StyleSheet.absoluteFill) e fica atrás
 * do conteúdo. É decorativo (`pointerEvents="none"`).
 *
 * viewBox 232×478 (retrato). `slice` na maioria; `none` em `hills`/`contourV`
 * (as ondas/curvas podem esticar), igual à referência de design.
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  G,
} from 'react-native-svg';
import type { Wallpaper } from '@vitale/shared';
import { colors, baseBg, useTheme } from '../../theme';

interface Props {
  variant: Wallpaper;
  style?: StyleProp<ViewStyle>;
}

const VIEWBOX = '0 0 232 478';
const FILL = { x: 0, y: 0, width: 232, height: 478 } as const;

/** M01 — Header glow: brilho concentrado no topo, fundo limpo embaixo. */
function HeaderGlow({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="hg-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surfaceWarm} />
          <Stop offset="0.38" stopColor={bg} />
          <Stop offset="1" stopColor={bg} />
        </LinearGradient>
        <RadialGradient id="hg-p" cx="116" cy="-29" r="150" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.primarySoft} stopOpacity="1" />
          <Stop offset="0.7" stopColor={colors.primarySoft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="hg-y" cx="255" cy="19" r="130" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.yellowSoft} stopOpacity="1" />
          <Stop offset="0.7" stopColor={colors.yellowSoft} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect {...FILL} fill="url(#hg-base)" />
      <Rect {...FILL} fill="url(#hg-p)" />
      <Rect {...FILL} fill="url(#hg-y)" />
    </Svg>
  );
}

/** M02 — Bottom blob: blobs orgânicos subindo do rodapé + círculo e anel no topo. */
function BottomBlob({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bb-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bg} />
          <Stop offset="1" stopColor={colors.surfaceWarm} />
        </LinearGradient>
      </Defs>
      <Rect {...FILL} fill="url(#bb-base)" />
      <G opacity={0.95}>
        <Path
          d="M-20,360 C40,300 90,420 150,390 C210,360 250,420 252,478 L-20,478 Z"
          fill={colors.primarySoft}
        />
        <Path
          d="M-20,420 C50,380 110,470 180,440 C220,422 252,448 252,478 L-20,478 Z"
          fill={colors.yellowSoft}
        />
        <Circle cx="190" cy="70" r="34" fill={colors.greenSoft} />
        <Circle cx="44" cy="120" r="13" fill="none" stroke={colors.lineDeep} strokeWidth="2" />
      </G>
    </Svg>
  );
}

const CORNER_RINGS_TR = [60, 110, 160, 210, 260];
const CORNER_RINGS_BL = [44, 86];

/** M03 — Corner rings: anéis concêntricos saindo do canto superior direito. */
function CornerRings({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="cr-base" cx="232" cy="0" r="330" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.surfaceWarm} />
          <Stop offset="0.7" stopColor={bg} />
        </RadialGradient>
      </Defs>
      <Rect {...FILL} fill="url(#cr-base)" />
      <G opacity={0.7}>
        <G fill="none" stroke={colors.lineWarm} strokeWidth="1.6">
          {CORNER_RINGS_TR.map((r) => (
            <Circle key={`tr-${r}`} cx="232" cy="0" r={r} />
          ))}
        </G>
        <G fill="none" stroke={colors.lineDeep} strokeWidth="1.5">
          {CORNER_RINGS_BL.map((r) => (
            <Circle key={`bl-${r}`} cx="20" cy="430" r={r} />
          ))}
        </G>
      </G>
    </Svg>
  );
}

/** M04 — Colinas: camadas de ondas sobrepostas no rodapé. */
function Hills({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="hills-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surfaceWarm} />
          <Stop offset="0.55" stopColor={bg} />
        </LinearGradient>
      </Defs>
      <Rect {...FILL} fill="url(#hills-base)" />
      <G opacity={0.9}>
        <Path
          d="M0,300 C60,270 90,330 130,320 C180,308 200,280 232,300 L232,478 L0,478 Z"
          fill={colors.yellowSoft}
        />
        <Path
          d="M0,360 C50,335 100,390 150,372 C190,358 210,372 232,360 L232,478 L0,478 Z"
          fill={colors.primarySoft}
        />
        <Path
          d="M0,420 C60,400 110,440 160,428 C200,418 215,430 232,420 L232,478 L0,478 Z"
          fill={colors.greenSoft}
        />
      </G>
    </Svg>
  );
}

/** M05 — Mesh: malha de 5 glows soft difusos. O mais colorido. */
function Mesh({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="mesh-y" cx="42" cy="57" r="105" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.yellowSoft} stopOpacity="1" />
          <Stop offset="0.65" stopColor={colors.yellowSoft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mesh-p" cx="209" cy="143" r="115" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.primarySoft} stopOpacity="1" />
          <Stop offset="0.65" stopColor={colors.primarySoft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mesh-g" cx="35" cy="335" r="125" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.greenSoft} stopOpacity="1" />
          <Stop offset="0.65" stopColor={colors.greenSoft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mesh-b" cx="220" cy="440" r="115" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.blueSoft} stopOpacity="1" />
          <Stop offset="0.65" stopColor={colors.blueSoft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mesh-r" cx="116" cy="239" r="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.roseSoft} stopOpacity="1" />
          <Stop offset="0.7" stopColor={colors.roseSoft} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect {...FILL} fill={bg} />
      <Rect {...FILL} fill="url(#mesh-y)" />
      <Rect {...FILL} fill="url(#mesh-p)" />
      <Rect {...FILL} fill="url(#mesh-g)" />
      <Rect {...FILL} fill="url(#mesh-b)" />
      <Rect {...FILL} fill="url(#mesh-r)" />
    </Svg>
  );
}

/** M06 — Curvas verticais: curvas de nível correndo de cima a baixo. */
function ContourV({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="cv-base" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={bg} />
          <Stop offset="0.6" stopColor={colors.surfaceWarm} />
          <Stop offset="1" stopColor={colors.bg2} />
        </LinearGradient>
      </Defs>
      <Rect {...FILL} fill="url(#cv-base)" />
      <G opacity={0.5}>
        <G fill="none" stroke={colors.lineDeep} strokeWidth="1.4">
          <Path d="M30,0 C10,120 50,240 20,360 C5,420 30,460 24,478" />
          <Path d="M70,0 C50,120 90,240 60,360 C45,420 70,460 64,478" />
          <Path d="M110,0 C90,120 130,240 100,360 C85,420 110,460 104,478" />
          <Path d="M150,0 C130,120 170,240 140,360 C125,420 150,460 144,478" />
          <Path d="M190,0 C170,120 210,240 180,360 C165,420 190,460 184,478" />
          <Path d="M230,0 C210,120 250,240 220,360 C205,420 230,460 224,478" />
        </G>
        <G fill="none" stroke={colors.lineWarm} strokeWidth="1.5">
          <Path d="M50,0 C30,120 70,240 40,360 C25,420 50,460 44,478" />
          <Path d="M170,0 C150,120 190,240 160,360 C145,420 170,460 164,478" />
        </G>
      </G>
    </Svg>
  );
}

/** M07 — Barras flutuantes: pílulas arredondadas soltas, sangrando pelas laterais. */
function Bars({ bg }: { bg: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bars-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bg} />
          <Stop offset="1" stopColor={colors.surfaceWarm} />
        </LinearGradient>
      </Defs>
      <Rect {...FILL} fill="url(#bars-base)" />
      <G opacity={0.9}>
        <Rect x="-30" y="40" width="180" height="26" rx="13" fill={colors.primarySoft} />
        <Rect x="120" y="100" width="160" height="22" rx="11" fill={colors.yellowSoft} />
        <Rect x="-10" y="300" width="150" height="24" rx="12" fill={colors.greenSoft} />
        <Rect x="150" y="360" width="130" height="20" rx="10" fill={colors.blueSoft} />
        <Rect x="40" y="420" width="120" height="22" rx="11" fill={colors.roseSoft} />
      </G>
    </Svg>
  );
}

export function RotinaBackground({ variant, style }: Props) {
  // Reconstrói ao trocar de esquema (cores adaptam ao claro/escuro).
  const { scheme } = useTheme();
  // Base sempre opaca (ignora a transparência de `bg` quando há wallpaper ativo),
  // para o fundo aparecer cheio tanto na camada raiz quanto nos previews.
  const bg = baseBg(scheme);

  let inner: React.ReactNode;
  switch (variant) {
    case 'headerGlow':
      inner = <HeaderGlow bg={bg} />;
      break;
    case 'bottomBlob':
      inner = <BottomBlob bg={bg} />;
      break;
    case 'cornerRings':
      inner = <CornerRings bg={bg} />;
      break;
    case 'hills':
      inner = <Hills bg={bg} />;
      break;
    case 'mesh':
      inner = <Mesh bg={bg} />;
      break;
    case 'contourV':
      inner = <ContourV bg={bg} />;
      break;
    case 'bars':
      inner = <Bars bg={bg} />;
      break;
    case 'flat':
    default:
      inner = null;
      break;
  }

  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: bg, overflow: 'hidden' }, style]}
    >
      {inner}
    </View>
  );
}
