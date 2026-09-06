import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { surfaceLegend, surfaceRamp, surfaceShares, type SurfaceMix } from '@vitale/shared';
import { colors, fonts, moduleColors, radii, shadows, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * O cartão de piso — o mesmo objeto na página de Ciclismo (soma de um período)
 * e no detalhe de uma pedalada (uma rota só). Herói em %, barra de proporção
 * com vão de superfície entre os degraus, legenda com km e %.
 *
 * A cor é a rampa ordinal do módulo (ADR 0035, `surface/colors.ts`): quatro
 * degraus de um tom só, do liso ao áspero, e neutro para o "não especificado",
 * que aparece SÓ quando existe — mas quando existe, aparece: é a classe que a
 * Strava escondeu e somou 61%.
 */
export function SurfaceCard({
  mix,
  title = 'Piso',
  caption,
}: {
  mix: SurfaceMix;
  title?: string;
  /** Linha discreta no rodapé: cobertura, inferido, período. */
  caption?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useTheme();
  const ramp = surfaceRamp(scheme, moduleColors('treino').accent, colors.surface, colors.ink, colors.ink4);

  if (mix.total <= 0) return null;
  const shares = surfaceShares(mix);
  const paved = shares.liso + shares.blocos + shares.pave;
  const offroad = shares.cascalho + shares.terra;
  const rows = surfaceLegend(mix);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.hero}>
        <Text style={styles.big}>{pct(paved)}</Text>
        <Text style={styles.cap}>
          pavimentado · {pct(offroad)} fora do asfalto
        </Text>
      </View>

      <View style={styles.bar} accessibilityRole="image" accessibilityLabel="Distribuição do piso">
        {rows
          .filter((r) => r.share > 0)
          .map((r) => (
            <View key={r.key} style={[styles.seg, { flex: r.share, backgroundColor: ramp[r.key] }]} />
          ))}
      </View>

      <View style={styles.legend}>
        {rows.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: ramp[r.key] }]} />
            <Text style={styles.name}>{r.label}</Text>
            <Text style={styles.km}>{fmtKm(r.meters)}</Text>
            <Text style={styles.share}>{pct(r.share)}</Text>
          </View>
        ))}
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** "4.183 km" nas somas; "12,4 km" numa pedalada curta. */
function fmtKm(m: number): string {
  const km = m / 1000;
  const digits = km >= 100 ? 0 : 1;
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: 14,
      gap: spacing.sm,
      ...shadows.card,
    },
    title: {
      fontSize: 11,
      color: colors.ink3,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      fontFamily: fonts.sansSemiBold,
    },
    hero: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
    big: { fontSize: 34, fontFamily: fonts.monoBold, color: colors.ink, letterSpacing: -0.5 },
    cap: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink2, flexShrink: 1 },
    bar: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMute,
      gap: 2,
      marginTop: 2,
    },
    seg: { height: '100%' },
    legend: { gap: 7, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    name: { flex: 1, fontSize: 13, fontFamily: fonts.sans, color: colors.ink2 },
    km: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink, fontVariant: ['tabular-nums'] },
    share: { width: 38, textAlign: 'right', fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink3, fontVariant: ['tabular-nums'] },
    caption: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  });
