/**
 * Cultura — a estante de uma mídia, com filtro de estado.
 * Spec: docs/specs/cultura/spec.md
 *
 * Os rótulos do filtro vêm do registro de tipos, não desta tela: em livro são
 * "Quero ler / Lendo / Lidos", em álbum "Quero ouvir / Ouvindo / Ouvidos".
 * É a CAP-8 em uso — nenhum vocabulário de mídia mora aqui.
 *
 * PARCIAL: lista e filtra. Transições de estado, nota, edição e deleção são a
 * story 4; tocar num item ainda não faz nada.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTipoConhecido, metaDoTipo, type CulturaEstado } from '@vitale/shared';
import { useCulturaStore } from '../../store/cultura.store';
import { colors, moduleColors, radii, shadows, spacing, useTheme } from '../../theme';

type Filtro = CulturaEstado | 'todos';
const ORDEM: CulturaEstado[] = ['quero', 'consumindo', 'concluido'];

export default function CulturaTipoScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo: string }>();

  const itens = useCulturaStore((s) => s.itens);
  const loading = useCulturaStore((s) => s.loading);
  const loaded = useCulturaStore((s) => s.loaded);
  const load = useCulturaStore((s) => s.load);

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const mc = moduleColors('cultura');
  const meta = useMemo(() => metaDoTipo(tipo ?? ''), [tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const doTipo = useMemo(() => itens.filter((i) => i.tipo === tipo), [itens, tipo]);

  /** Contagem por estado — alimenta os números nos chips do filtro. */
  const porEstado = useMemo(() => {
    const c: Record<CulturaEstado, number> = { quero: 0, consumindo: 0, concluido: 0 };
    for (const i of doTipo) c[i.estado] += 1;
    return c;
  }, [doTipo]);

  const visiveis = useMemo(
    () => (filtro === 'todos' ? doTipo : doTipo.filter((i) => i.estado === filtro)),
    [doTipo, filtro],
  );

  // Rota com tipo inexistente: acontece por link velho ou digitação na URL.
  if (tipo && !isTipoConhecido(tipo)) {
    return (
      <View style={[s.flex, s.centro, { paddingTop: insets.top }]}>
        <Text style={s.vazioTxt}>Mídia desconhecida: “{tipo}”.</Text>
        <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: mc.accent }]}>
          <Text style={s.btnTxt}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>{meta.rotulo}s</Text>
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
        <View style={s.filtros}>
          {(['todos', ...ORDEM] as Filtro[]).map((f) => {
            const ativo = f === filtro;
            const n = f === 'todos' ? doTipo.length : porEstado[f];
            return (
              <Pressable
                key={f}
                onPress={() => setFiltro(f)}
                style={[s.chip, ativo && { backgroundColor: mc.accent, borderColor: mc.accent }]}
              >
                <Text style={[s.chipTxt, ativo && { color: '#fff' }]}>
                  {/* Rótulo na língua da mídia (CAP-8) */}
                  {f === 'todos' ? 'Todos' : meta.estados[f]}
                  {n > 0 ? ` ${n}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading && !loaded && <ActivityIndicator color={mc.accent} style={{ marginTop: spacing.xl }} />}

        {loaded && visiveis.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioTxt}>
              {doTipo.length === 0
                ? `Nenhum ${meta.rotulo.toLowerCase()} na estante ainda.`
                : `Nada em “${filtro === 'todos' ? 'Todos' : meta.estados[filtro as CulturaEstado]}”.`}
            </Text>
          </View>
        )}

        {visiveis.map((i) => (
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
                <View style={[s.pill, { backgroundColor: mc.tint }]}>
                  <Text style={[s.pillTxt, { color: mc.accent }]}>{meta.estados[i.estado]}</Text>
                </View>
                {i.nota != null && (
                  <Text style={s.nota}>{'★'.repeat(i.nota)}</Text>
                )}
                {i.indicadoPor && (
                  <Text style={s.indicado} numberOfLines={1}>por {i.indicadoPor}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  centro: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill ?? 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipTxt: { fontSize: 13, color: colors.ink2, fontWeight: '500' },
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
  nota: { fontSize: 11, color: colors.yellow },
  indicado: { fontSize: 11, color: colors.ink3, flexShrink: 1 },
  vazio: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  vazioTxt: { fontSize: 14, color: colors.ink2, textAlign: 'center', paddingHorizontal: spacing.xl },
  btn: { borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
