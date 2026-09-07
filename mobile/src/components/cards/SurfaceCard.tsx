import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  seasonAccessibilityLabel,
  surfaceLegend,
  surfaceRamp,
  surfaceShares,
  type SeasonBucket,
  type SurfaceMix,
} from '@vitale/shared';
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
 *
 * **O miolo tem duas formas, e a janela escolhe qual** — não há chip para isso.
 * Uma barra quando o período contém uma estação; uma coluna por estação quando
 * contém mais de uma. Medido em produção: 4 e 12 semanas contêm UMA estação, o
 * ano contém quatro. Herói, legenda e rodapé são os mesmos nos dois casos, então
 * a leitura sazonal não custa cromo novo nem um segundo cartão.
 */
export function SurfaceCard({
  mix,
  title = 'Piso',
  caption,
  seasons,
  onTogglePaint,
  painted = false,
}: {
  mix: SurfaceMix;
  /** Vazio esconde a linha: sob a aba "Piso", o rótulo "PISO" é eco. */
  title?: string;
  /** Linha discreta no rodapé: cobertura, inferido, período. */
  caption?: string;
  /**
   * As estações que a janela contém (`surfaceBySeason`). Com duas ou mais, o
   * miolo vira colunas; com uma ou nenhuma, segue a barra única. Ausente no
   * detalhe de uma pedalada, que é um dia só.
   */
  seasons?: readonly SeasonBucket[];
  /**
   * Liga e desliga a pintura da rota no mapa (T3.2). Ausente onde não há mapa —
   * na tela de Ciclismo o cartão soma um período e não há um traçado só para
   * pintar.
   */
  onTogglePaint?: () => void;
  painted?: boolean;
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
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.hero}>
        <Text style={styles.big}>{pct(paved)}</Text>
        <Text style={styles.cap}>
          pavimentado · {pct(offroad)} fora do asfalto
        </Text>
      </View>

      {seasons && seasons.length > 1 ? (
        <View style={styles.seasons}>
          {seasons.map((b) => {
            // A escada é desenhada de baixo para cima: `flexDirection: 'column-reverse'`
            // põe o liso — que é ~80% — na base, onde a barra empilhada o espera.
            const steps: { key: 'liso' | 'blocos' | 'cascalho' | 'terra'; share: number }[] = [
              { key: 'liso', share: b.shares.liso },
              { key: 'blocos', share: b.shares.blocos + b.shares.pave },
              { key: 'cascalho', share: b.shares.cascalho },
              { key: 'terra', share: b.shares.terra },
            ];
            return (
              <View
                key={b.season}
                style={styles.seasonCol}
                accessible
                accessibilityRole="image"
                accessibilityLabel={seasonAccessibilityLabel(b)}
              >
                <View style={styles.stack}>
                  {steps
                    .filter((s) => s.share > 0)
                    .map((s) => (
                      <View
                        key={s.key}
                        style={{ height: `${s.share * 100}%`, backgroundColor: ramp[s.key] }}
                      />
                    ))}
                </View>
                <Text style={styles.seasonName} numberOfLines={1}>
                  {b.label}
                </Text>
                {/* A amostra fica visível: uma coluna feita de 3 pedaladas não
                    afirma o mesmo que uma feita de 56, e esconder isso seria a
                    mesma mentira que derrubou a série mês a mês. */}
                <Text style={styles.seasonN}>{b.rides}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.bar} accessibilityRole="image" accessibilityLabel="Distribuição do piso">
          {rows
            .filter((r) => r.share > 0)
            .map((r) => (
              <View key={r.key} style={[styles.seg, { flex: r.share, backgroundColor: ramp[r.key] }]} />
            ))}
        </View>
      )}

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

      {onTogglePaint ? (
        <Pressable
          onPress={onTogglePaint}
          accessibilityRole="switch"
          accessibilityState={{ checked: painted }}
          accessibilityLabel="Pintar a rota por tipo de piso no mapa"
          style={({ pressed }) => [styles.paintRow, pressed && styles.paintPressed]}
        >
          <Text style={[styles.paintText, painted && styles.paintTextOn]}>
            {painted ? 'Rota pintada por piso' : 'Pintar a rota por piso'}
          </Text>
        </Pressable>
      ) : null}
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
    // As colunas por estação. A altura é a mesma da barra × 6 — o suficiente
    // para o cascalho da primavera (11,7%) ser visível como degrau, e não como
    // fio: abaixo de ~80 pt a menor classe some.
    seasons: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
    seasonCol: { flex: 1, gap: 5 },
    stack: {
      height: 88,
      flexDirection: 'column-reverse',
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMute,
    },
    seasonName: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink2, textAlign: 'center' },
    seasonN: {
      fontSize: 10.5,
      fontFamily: fonts.mono,
      color: colors.ink3,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    legend: { gap: 7, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    name: { flex: 1, fontSize: 13, fontFamily: fonts.sans, color: colors.ink2 },
    km: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink, fontVariant: ['tabular-nums'] },
    share: { width: 38, textAlign: 'right', fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink3, fontVariant: ['tabular-nums'] },
    caption: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
    // Ação discreta: linha de texto, sem botão desenhado. O cartão é leitura, e
    // um botão cheio aqui competiria com o herói por atenção.
    paintRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, marginTop: 2 },
    paintPressed: { opacity: 0.6 },
    paintText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },
    // Ligado é `ink3` → `ink`, não o acento: a catraca da ADR 0024 não deixa o
    // acento crescer como cor de letra (garante 3,0, e texto precisa de 4,5) —
    // a mesma razão pela qual a aba ativa do `PanelTabs` também não o usa.
    paintTextOn: { color: colors.ink },
  });
