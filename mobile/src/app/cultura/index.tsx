/**
 * Cultura — hub das mídias (entrada do módulo).
 * Spec: docs/specs/cultura/spec.md
 *
 * Não lista itens: lista as quatro mídias, cada uma levando à própria estante.
 * Uma lista só, com livro, filme, podcast e álbum misturados, obriga a
 * escanear tudo para achar qualquer coisa — e a mídia é justamente o eixo
 * pelo qual o usuário pensa ("o que estou lendo?", não "o que está em curso?").
 *
 * Os quatro tipos aparecem sempre, mesmo zerados: o hub mostra a estrutura do
 * módulo, e uma mídia que some quando está vazia esconde que ela existe.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CULTURA_TIPOS } from '@vitale/shared';
import { useCulturaStore } from '../../store/cultura.store';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';

/** Ícone por mídia. Fora do registro do núcleo de propósito: Ionicons é do mobile. */
const ICONE: Record<string, keyof typeof Ionicons.glyphMap> = {
  livro: 'book-outline',
  filme: 'film-outline',
  podcast: 'mic-outline',
  album: 'disc-outline',
};

export default function CulturaHubScreen() {
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

  // Recarrega ao voltar de adicionar ou de uma estante, senão as contagens mentem.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const contagens = useMemo(() => {
    const por: Record<string, { total: number; emCurso: number }> = {};
    for (const t of CULTURA_TIPOS) por[t.tipo] = { total: 0, emCurso: 0 };
    for (const i of itens) {
      const c = por[i.tipo];
      if (!c) continue; // tipo desconhecido não inventa linha no hub (CAP-13)
      c.total += 1;
      if (i.estado === 'consumindo') c.emCurso += 1;
    }
    return por;
  }, [itens]);

  const vazio = loaded && itens.length === 0;

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
        {loading && !loaded && (
          <ActivityIndicator color={mc.accent} style={{ marginTop: spacing.xl }} />
        )}

        {loaded && CULTURA_TIPOS.map((t) => {
          const c = contagens[t.tipo] ?? { total: 0, emCurso: 0 };
          return (
            <Pressable
              key={t.tipo}
              onPress={() => router.push(`/cultura/${t.tipo}`)}
              style={s.card}
            >
              <View style={[s.icone, { backgroundColor: mc.tint }]}>
                <Ionicons name={ICONE[t.tipo] ?? 'ellipse-outline'} size={20} color={mc.accent} />
              </View>
              <View style={s.flex}>
                <Text style={s.cardTitulo}>{t.rotulo}s</Text>
                <Text style={s.cardSub}>
                  {c.total === 0
                    ? 'Nada por aqui ainda'
                    : c.emCurso > 0
                      ? `${c.total} ${c.total === 1 ? 'item' : 'itens'} · ${c.emCurso} ${t.estados.consumindo.toLowerCase()}`
                      : `${c.total} ${c.total === 1 ? 'item' : 'itens'}`}
                </Text>
              </View>
              {c.total > 0 && <Text style={[s.contagem, { color: mc.accent }]}>{c.total}</Text>}
              <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
            </Pressable>
          );
        })}

        {vazio && (
          <View style={s.vazio}>
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
      </ScrollView>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: { fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
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
    icone: { width: 40, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
    cardTitulo: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    cardSub: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
    contagem: { fontSize: 15, fontFamily: fonts.sansSemiBold },
    vazio: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
    vazioTxt: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink2, textAlign: 'center', paddingHorizontal: spacing.xl },
    btn: { borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    btnTxt: { color: '#fff', fontSize: 14, fontFamily: fonts.sansSemiBold },
  }),
);
