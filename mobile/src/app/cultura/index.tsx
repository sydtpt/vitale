/**
 * Cultura — a estante (entrada do módulo).
 * Spec: docs/specs/cultura/spec.md
 *
 * ESTA TELA É PARCIAL. A story 3 entrega só o suficiente para provar que o
 * item entrou: lista o que existe e leva ao fluxo de adicionar. A story 4 é
 * quem traz a máquina de estados, nota, edição e deleção — sem elas, tocar
 * num item aqui ainda não faz nada.
 */
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { metaDoTipo, rotuloEstado } from '@vitale/shared';
import { useCulturaStore } from '../../store/cultura.store';
import { colors, moduleColors, radii, shadows, spacing, useTheme } from '../../theme';

export default function CulturaScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const itens = useCulturaStore((s) => s.itens);
  const loading = useCulturaStore((s) => s.loading);
  const loaded = useCulturaStore((s) => s.loaded);
  const load = useCulturaStore((s) => s.load);

  const mc = moduleColors('cultura');

  useEffect(() => {
    void load();
  }, [load]);

  // Recarrega ao voltar de /cultura/adicionar, senão o item novo não aparece.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Cultura</Text>
        <Pressable onPress={() => router.push('/cultura/adicionar')} hitSlop={12}>
          <Ionicons name="add" size={26} color={mc.accent} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing['3xl'],
        }}
      >
        {loading && !loaded && <ActivityIndicator color={mc.accent} style={{ marginTop: spacing.xl }} />}

        {loaded && itens.length === 0 && (
          <View style={s.vazio}>
            <Ionicons name="library-outline" size={40} color={colors.ink4} />
            <Text style={s.vazioTxt}>
              Sua estante está vazia. Adicione um livro, filme, podcast ou álbum.
            </Text>
            <Pressable
              onPress={() => router.push('/cultura/adicionar')}
              style={[s.btn, { backgroundColor: mc.accent }]}
            >
              <Text style={s.btnTxt}>Adicionar o primeiro</Text>
            </Pressable>
          </View>
        )}

        {itens.map((i) => {
          const meta = metaDoTipo(i.tipo);
          return (
            <View key={i.id} style={s.card}>
              {i.capaUrl
                ? <Image source={{ uri: i.capaUrl }} style={s.capa} resizeMode="cover" />
                : <View style={[s.capa, s.capaVazia]}>
                    <Ionicons name="image-outline" size={20} color={colors.ink4} />
                  </View>}
              <View style={s.flex}>
                <Text style={s.cardTitulo} numberOfLines={2}>{i.titulo}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {i.criador ?? `Sem ${meta.rotuloCriador.toLowerCase()}`}
                </Text>
                <View style={s.metaRow}>
                  {/* Rótulo na língua da mídia (CAP-8): "Lido" para livro, "Ouvido" para álbum. */}
                  <View style={[s.pill, { backgroundColor: mc.tint }]}>
                    <Text style={[s.pillTxt, { color: mc.accent }]}>
                      {rotuloEstado(i.tipo, i.estado)}
                    </Text>
                  </View>
                  {i.indicadoPor && (
                    <Text style={s.indicado} numberOfLines={1}>por {i.indicadoPor}</Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  vazio: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md },
  vazioTxt: { fontSize: 14, color: colors.ink2, textAlign: 'center', paddingHorizontal: spacing.xl },
  btn: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  capa: { width: 44, height: 62, borderRadius: radii.sm, backgroundColor: colors.bg2 },
  capaVazia: { alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardSub: { fontSize: 13, color: colors.ink3, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill ?? 999 },
  pillTxt: { fontSize: 11, fontWeight: '600' },
  indicado: { fontSize: 11, color: colors.ink3, flexShrink: 1 },
});
