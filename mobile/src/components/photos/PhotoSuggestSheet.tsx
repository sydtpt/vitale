/**
 * A folha de confirmação das fotos de uma pedalada (ADR 0037, prancha B).
 *
 * O desenho aprovado em 06/09/2026, e o porquê de cada escolha:
 *
 * - **Confirmação por grupo, não por foto.** Com 34 fotos, marcar uma a uma é
 *   castigo. O dono aprova "Na rota" num toque e só desce ao detalhe para tirar
 *   alguma. Tocar a miniatura ainda alterna uma foto isolada.
 * - **Só "Na rota" vem ligado.** O corredor de 40 m é o que separa "estava lá"
 *   de "caiu na janela": a foto de um documento tirada em casa quase nunca está
 *   a 40 m do traçado, e cai sozinha num grupo desligado.
 * - **A janela aparece escrita.** Sem isso, uma foto que entrou por causa da
 *   folga de 30 min / 1 h parece bug.
 * - **"Agora não" não é "nunca".** Nada é gravado, e a folha volta pelo cartão.
 *
 * Os estados que o mockup não mostrava, e que decidem se a feature parece
 * quebrada: varrendo, permissão negada, **acesso limitado** e zero fotos.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CandidateGroup } from '@vitale/shared';
import type { PhotoCandidate } from '../../lib/activity-photos';
import type { PhotoAccess, ScanResult } from '../../services/activity-photos';
import { colors, fonts, onMedia, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { formatClip } from '../../lib/workout-format';
import { useAssetUri } from '../../hooks/useAssetUri';

/** Miniaturas mostradas por grupo antes do "+N". */
const PREVIEW = 4;

/** Miniatura que resolve o endereço sozinha — ver `services/asset-uri.ts`. */
function Tile({ assetId, style, isVideo }: { assetId: string; style: object; isVideo: boolean }) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(assetId, isVideo);
  // Pôster de vídeo pode falhar com o clipe intacto; o quadro escuro sustenta o
  // crachá de play que vem por cima e não deixa a tira parecer quebrada.
  if (uri === null && isVideo) return <View style={[style, styles.film]} />;
  if (typeof uri !== 'string') return <View style={style} />;
  return <Image source={{ uri }} style={style} />;
}

const GROUP_LABEL: Record<CandidateGroup, string> = {
  'on-route': 'Na rota',
  'off-route': 'Fora da rota',
  before: 'Antes da largada',
  after: 'Depois da chegada',
};

/** Ordem de exibição: o que provavelmente entra vem primeiro. */
const GROUP_ORDER: CandidateGroup[] = ['on-route', 'before', 'after', 'off-route'];

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** A legenda de um grupo — o motivo pelo qual aquelas fotos estão juntas. */
function groupHint(group: CandidateGroup, photos: PhotoCandidate[]): string {
  const n = photos.length;
  const fotos = n === 1 ? '1 foto' : `${n} fotos`;
  if (group === 'on-route') return `${fotos} · a menos de 40 m do traçado`;
  if (group === 'off-route') return `${fotos} · longe do traçado`;
  const horas = photos.slice(0, 2).map((p) => hhmm(p.takenAtMs)).join(' e ');
  return n <= 2 ? `${fotos} · ${horas}` : `${fotos} · a partir de ${hhmm(photos[0].takenAtMs)}`;
}

interface Props {
  visible: boolean;
  scan: ScanResult | null;
  access: PhotoAccess;
  /** Enquanto a biblioteca é lida. */
  loading: boolean;
  onClose: () => void;
  onConfirm: (accepted: PhotoCandidate[], rejected: PhotoCandidate[]) => void;
  /** Abre os Ajustes do iOS quando o acesso é limitado ou negado. */
  onOpenSettings: () => void;
}

export function PhotoSuggestSheet({
  visible,
  scan,
  access,
  loading,
  onClose,
  onConfirm,
  onOpenSettings,
}: Props) {
  const styles = useThemedStyles(createStyles);

  /** Os instantes marcados para entrar. `null` = ainda não mexeram no padrão. */
  const [picked, setPicked] = useState<Set<number> | null>(null);

  const groups = useMemo(() => {
    const by = new Map<CandidateGroup, PhotoCandidate[]>();
    for (const c of scan?.candidates ?? []) {
      const list = by.get(c.group);
      if (list) list.push(c);
      else by.set(c.group, [c]);
    }
    return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ group: g, photos: by.get(g)! }));
  }, [scan]);

  /** O padrão da ADR: só "na rota" entra sozinha. */
  const selected = useMemo(() => {
    if (picked) return picked;
    return new Set((scan?.candidates ?? []).filter((c) => c.group === 'on-route').map((c) => c.takenAtMs));
  }, [picked, scan]);

  const toggleOne = (c: PhotoCandidate) => {
    const next = new Set(selected);
    if (next.has(c.takenAtMs)) next.delete(c.takenAtMs);
    else next.add(c.takenAtMs);
    setPicked(next);
  };

  const toggleGroup = (photos: PhotoCandidate[]) => {
    const allOn = photos.every((p) => selected.has(p.takenAtMs));
    const next = new Set(selected);
    for (const p of photos) {
      if (allOn) next.delete(p.takenAtMs);
      else next.add(p.takenAtMs);
    }
    setPicked(next);
  };

  const confirm = () => {
    const all = scan?.candidates ?? [];
    onConfirm(
      all.filter((c) => selected.has(c.takenAtMs)),
      all.filter((c) => !selected.has(c.takenAtMs)),
    );
  };

  const count = selected.size;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grab} />

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Procurando fotos dessa pedalada…</Text>
          </View>
        ) : access === 'denied' ? (
          <View style={styles.state}>
            <Ionicons name="lock-closed-outline" size={26} color={colors.ink3} />
            <Text style={styles.stateTitle}>Sem acesso às fotos</Text>
            <Text style={styles.stateText}>
              O Orbe precisa ver sua biblioteca para achar as fotos tiradas durante a pedalada.
              As imagens continuam no seu iPhone.
            </Text>
            <Pressable style={styles.cta} onPress={onOpenSettings}>
              <Text style={styles.ctaText}>Abrir Ajustes</Text>
            </Pressable>
          </View>
        ) : access === 'limited' ? (
          <View style={styles.state}>
            <Ionicons name="albums-outline" size={26} color={colors.ink3} />
            <Text style={styles.stateTitle}>Acesso limitado</Text>
            <Text style={styles.stateText}>
              Com "Selecionar fotos", o iPhone só mostra o que você escolheu à mão — e a busca
              pelo horário da pedalada não enxerga o resto. Libere o acesso completo para o Orbe
              encontrar sozinho.
            </Text>
            <Pressable style={styles.cta} onPress={onOpenSettings}>
              <Text style={styles.ctaText}>Abrir Ajustes</Text>
            </Pressable>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="images-outline" size={26} color={colors.ink3} />
            <Text style={styles.stateTitle}>Nenhuma foto nova</Text>
            <Text style={styles.stateText}>
              {scan
                ? `Nada entre ${hhmm(scan.windowFromMs)} e ${hhmm(scan.windowToMs)}${
                    scan.knownCount > 0 ? ' que você já não tenha decidido.' : '.'
                  }`
                : 'Esta atividade não tem janela de busca.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.head}>
              <Text style={styles.title}>
                {scan!.candidates.length === 1 ? '1 foto nessa janela' : `${scan!.candidates.length} fotos nessa janela`}
              </Text>
              <Text style={styles.sub}>
                {hhmm(scan!.windowFromMs)} → {hhmm(scan!.windowToMs)} · 30 min antes, 1 h depois
              </Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
            >
              {groups.map(({ group, photos }) => {
                const allOn = photos.every((p) => selected.has(p.takenAtMs));
                return (
                  <View key={group} style={styles.group}>
                    <View style={styles.groupHead}>
                      <View style={styles.groupText}>
                        <Text style={styles.groupTitle}>{GROUP_LABEL[group]}</Text>
                        <Text style={styles.groupHint}>{groupHint(group, photos)}</Text>
                      </View>
                      <Pressable
                        onPress={() => toggleGroup(photos)}
                        hitSlop={8}
                        style={[styles.toggle, allOn && styles.toggleOn]}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: allOn }}
                        accessibilityLabel={`${GROUP_LABEL[group]}: ${allOn ? 'ligado' : 'desligado'}`}
                      >
                        <View style={[styles.knob, allOn && styles.knobOn]} />
                      </Pressable>
                    </View>

                    <View style={styles.strip}>
                      {photos.slice(0, PREVIEW).map((p) => {
                        const on = selected.has(p.takenAtMs);
                        return (
                          <Pressable key={p.takenAtMs} onPress={() => toggleOne(p)} style={styles.thumbWrap}>
                            <Tile assetId={p.assetId} style={styles.thumb} isVideo={p.mediaType === 'video'} />
                            {!on && <View style={styles.veil} />}
                            <View style={[styles.check, on && styles.checkOn]}>
                              {on && <Ionicons name="checkmark" size={11} color={colors.onPrimary} />}
                            </View>
                            {p.mediaType === 'video' && (
                              <View style={styles.badge}>
                                <Ionicons name="play" size={8} color={onMedia} />
                                {p.durationS !== null && (
                                  <Text style={styles.badgeText}>{formatClip(p.durationS)}</Text>
                                )}
                              </View>
                            )}
                            {p.inCloud && (
                              <View style={styles.cloud}>
                                <Ionicons name="cloud-outline" size={10} color={onMedia} />
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                      {photos.length > PREVIEW && (
                        <View style={styles.more}>
                          <Text style={styles.moreText}>+{photos.length - PREVIEW}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable style={[styles.cta, count === 0 && styles.ctaOff]} onPress={confirm}>
              <Text style={styles.ctaText}>
                {count === 0 ? 'Não ligar nenhuma' : count === 1 ? 'Ligar 1 foto' : `Ligar ${count} fotos`}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={onClose} hitSlop={8}>
              <Text style={styles.secondaryText}>Agora não</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii['2xl'],
      borderTopRightRadius: radii['2xl'],
      paddingBottom: spacing.xl,
      maxHeight: '85%',
      ...shadows.card,
    },
    grab: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.ink4,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },

    head: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    sub: { fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink3, marginTop: 2 },

    scroll: { flexGrow: 0 },
    scrollBody: { paddingBottom: spacing.sm },

    group: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      gap: spacing.sm,
    },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    groupText: { flex: 1 },
    groupTitle: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink },
    groupHint: { fontSize: 11, fontFamily: fonts.sansMedium, color: colors.ink3, marginTop: 1 },

    toggle: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.ink4,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleOn: { backgroundColor: colors.primary },
    knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.onPrimary },
    knobOn: { alignSelf: 'flex-end' },

    strip: { flexDirection: 'row', gap: 7 },
    thumbWrap: { width: 60, height: 60, borderRadius: radii.md, overflow: 'hidden' },
    thumb: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    /** Escuro nos dois esquemas, como o crachá de play que fica sobre ele. */
    film: { backgroundColor: 'rgba(0,0,0,0.55)' },
    veil: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(20,17,13,0.42)',
    },
    check: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: 'rgba(0,0,0,0.32)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.primary },
    badge: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 4,
      height: 15,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 9, fontFamily: fonts.monoSemiBold, color: onMedia },
    cloud: {
      position: 'absolute',
      left: 4,
      top: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    more: {
      width: 60,
      height: 60,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderColor: colors.lineDeep,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { fontSize: 13, fontFamily: fonts.monoSemiBold, color: colors.ink3 },

    cta: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaOff: { backgroundColor: colors.ink4 },
    ctaText: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.onPrimary },
    secondary: { marginTop: spacing.sm, alignItems: 'center', paddingVertical: 4 },
    secondaryText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },

    state: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
    stateTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink },
    stateText: {
      fontSize: 13,
      fontFamily: fonts.sansMedium,
      color: colors.ink2,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
