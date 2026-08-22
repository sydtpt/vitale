/**
 * Cultura — item da estante: ciclo de vida, nota, edição e deleção (story 4).
 * Spec: docs/specs/cultura/spec.md · máquina de estados em data-model.md
 *
 * Três coisas que esta tela deliberadamente NÃO decide, porque são do núcleo:
 *
 * - **Quais transições existem** — vem de `podeTransitar`. A tela desenha um
 *   botão por destino permitido, então as arestas menos óbvias (ler de uma vez,
 *   reler, voltar para a fila) aparecem sem ninguém lembrar delas aqui.
 * - **Que datas gravar** — vem de `datasAposTransicao`, via store. Reler grava
 *   data nova e preserva a nota; voltar para `quero` limpa as duas datas.
 * - **Se o resultado é coerente** — `cultura.ts` valida antes de escrever, e a
 *   mensagem que volta é legível. O usuário nunca vê erro de `check`.
 *
 * A data é escolhida a cada transição, com hoje como padrão: sem isso o
 * backfill gravaria o passado como presente.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localDateStr, metaDoTipo, podeTransitar, type CulturaEstado } from '@vitale/shared';
import { MonthCalendar } from '../../../components/MonthCalendar';
import { useCulturaStore } from '../../../store/cultura.store';
import { colors, moduleColors, radii, shadows, spacing, useTheme } from '../../../theme';

const ESTADOS: CulturaEstado[] = ['quero', 'consumindo', 'concluido'];

export default function CulturaItemScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const itens = useCulturaStore((s) => s.itens);
  const loaded = useCulturaStore((s) => s.loaded);
  const load = useCulturaStore((s) => s.load);
  const transitar = useCulturaStore((s) => s.transitar);
  const atualizar = useCulturaStore((s) => s.atualizar);
  const deletar = useCulturaStore((s) => s.deletar);
  const convergir = useCulturaStore((s) => s.convergir);

  const item = useMemo(() => itens.find((i) => i.id === id), [itens, id]);
  const meta = useMemo(() => metaDoTipo(item?.tipo ?? ''), [item?.tipo]);
  const mc = moduleColors('cultura');

  const [pendente, setPendente] = useState<CulturaEstado | null>(null);
  const [data, setData] = useState(localDateStr());
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [criador, setCriador] = useState('');
  const [indicadoPor, setIndicadoPor] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  /** Hidrata os campos de edição a partir do item, sem sobrescrever digitação. */
  const abrirEdicao = useCallback(() => {
    if (!item) return;
    setTitulo(item.titulo);
    setCriador(item.criador ?? '');
    setIndicadoPor(item.indicadoPor ?? '');
    setEditando(true);
    setErro(null);
  }, [item]);

  const executar = async (fn: () => Promise<void>) => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      // `cultura.ts` devolve mensagem legível; erro do Postgres não chega aqui.
      setErro(e instanceof Error ? e.message : 'não foi possível salvar');
    } finally {
      setOcupado(false);
    }
  };

  const confirmarTransicao = () =>
    executar(async () => {
      if (!item || !pendente) return;
      await transitar(item, pendente, data);
      setPendente(null);
      setData(localDateStr());
    });

  const salvarEdicao = () =>
    executar(async () => {
      if (!item) return;
      await atualizar(item, {
        titulo: titulo.trim(),
        criador: criador.trim() || null,
        indicadoPor: indicadoPor.trim() ? convergir(indicadoPor) : null,
      });
      setEditando(false);
    });

  const definirNota = (n: number) =>
    executar(async () => {
      if (!item) return;
      // Tocar na mesma estrela limpa a nota — sem isso, uma nota dada por
      // engano seria irremovível.
      await atualizar(item, { nota: item.nota === n ? null : n });
    });

  const confirmarDelecao = () => {
    if (!item) return;
    Alert.alert(
      'Remover da estante?',
      `"${item.titulo}" será apagado. Não há como desfazer, e o app não guarda que ele existiu.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => void executar(async () => {
            await deletar(item.id);
            router.back();
          }),
        },
      ],
    );
  };

  if (!item) {
    return (
      <View style={[s.flex, s.centro, { paddingTop: insets.top }]}>
        {loaded
          ? <Text style={s.sub}>Item não encontrado.</Text>
          : <ActivityIndicator color={mc.accent} />}
      </View>
    );
  }

  const destinos = ESTADOS.filter((e) => podeTransitar(item.estado, e));

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>{meta.rotulo}</Text>
        <Pressable onPress={confirmarDelecao} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={colors.red} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.topo}>
          {item.capaUrl
            ? <Image source={{ uri: item.capaUrl }} style={s.capa} resizeMode="cover" />
            : <View style={[s.capa, s.capaVazia]}>
                <Ionicons name="image-outline" size={26} color={colors.ink4} />
              </View>}
          <View style={s.flex}>
            <Text style={s.titulo}>{item.titulo}</Text>
            <Text style={s.sub}>{item.criador ?? `Sem ${meta.rotuloCriador.toLowerCase()}`}</Text>
            <View style={[s.pill, { backgroundColor: mc.tint, alignSelf: 'flex-start', marginTop: spacing.xs }]}>
              <Text style={[s.pillTxt, { color: mc.accent }]}>{meta.estados[item.estado]}</Text>
            </View>
          </View>
        </View>

        {(item.iniciadoEm || item.concluidoEm) && (
          <Text style={s.datas}>
            {item.iniciadoEm && `Começou em ${br(item.iniciadoEm)}`}
            {item.iniciadoEm && item.concluidoEm && ' · '}
            {item.concluidoEm && `Terminou em ${br(item.concluidoEm)}`}
          </Text>
        )}

        {erro && <Text style={s.erro}>{erro}</Text>}

        {/* ── Nota (CAP-4): editável em QUALQUER estado, não só ao concluir ── */}
        <Text style={s.label}>Nota</Text>
        <View style={s.estrelas}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => void definirNota(n)} hitSlop={6} disabled={ocupado}>
              <Ionicons
                name={item.nota != null && n <= item.nota ? 'star' : 'star-outline'}
                size={28}
                color={item.nota != null && n <= item.nota ? colors.yellow : colors.ink4}
              />
            </Pressable>
          ))}
          {item.nota != null && <Text style={s.dica}>toque na mesma estrela para limpar</Text>}
        </View>

        {/* ── Transições (CAP-2): destinos vêm de podeTransitar, não daqui ── */}
        {pendente === null ? (
          <>
            <Text style={s.label}>Mudar para</Text>
            <View style={s.acoes}>
              {destinos.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => { setPendente(e); setData(localDateStr()); }}
                  style={[s.btnAcao, { borderColor: mc.accent }]}
                  disabled={ocupado}
                >
                  <Text style={[s.btnAcaoTxt, { color: mc.accent }]}>{meta.estados[e]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={s.painel}>
            <Text style={s.label}>
              Marcar como “{meta.estados[pendente]}” em qual data?
            </Text>
            <Text style={s.dica}>
              Hoje já está escolhido. Mude se estiver registrando algo do passado.
            </Text>
            <MonthCalendar selected={data} onSelect={setData} />
            <View style={s.acoes}>
              <Pressable onPress={() => setPendente(null)} style={s.btnAcao} disabled={ocupado}>
                <Text style={s.btnAcaoTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmarTransicao()}
                style={[s.btnAcao, s.btnCheio, { backgroundColor: mc.accent }]}
                disabled={ocupado}
              >
                {ocupado
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[s.btnAcaoTxt, { color: '#fff' }]}>Confirmar</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Edição (CAP-12): tipo fora, porque invalidaria fonte e rótulos ── */}
        <Text style={s.label}>Detalhes</Text>
        {!editando ? (
          <Pressable onPress={abrirEdicao} style={s.linhaEdit} disabled={ocupado}>
            <View style={s.flex}>
              {item.indicadoPor
                ? <Text style={s.sub}>Indicado por {item.indicadoPor}</Text>
                : <Text style={s.dica}>Sem indicação registrada</Text>}
            </View>
            <Ionicons name="create-outline" size={18} color={mc.accent} />
          </Pressable>
        ) : (
          <View>
            <TextInput value={titulo} onChangeText={setTitulo} style={s.input} placeholder="Título" placeholderTextColor={colors.ink3} />
            <TextInput value={criador} onChangeText={setCriador} style={s.input} placeholder={meta.rotuloCriador} placeholderTextColor={colors.ink3} />
            <TextInput
              value={indicadoPor}
              onChangeText={setIndicadoPor}
              style={s.input}
              placeholder="Indicado por"
              placeholderTextColor={colors.ink3}
              autoCapitalize="words"
            />
            <View style={s.acoes}>
              <Pressable onPress={() => setEditando(false)} style={s.btnAcao} disabled={ocupado}>
                <Text style={s.btnAcaoTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void salvarEdicao()}
                style={[s.btnAcao, s.btnCheio, { backgroundColor: mc.accent }]}
                disabled={titulo.trim().length === 0 || ocupado}
              >
                <Text style={[s.btnAcaoTxt, { color: '#fff' }]}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA'. Sem `new Date`, que desloca por fuso. */
function br(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  topo: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  capa: { width: 76, height: 108, borderRadius: radii.sm, backgroundColor: colors.bg2 },
  capaVazia: { alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 18, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, marginTop: 2 },
  dica: { fontSize: 12, color: colors.ink3 },
  datas: { fontSize: 13, color: colors.ink3, marginBottom: spacing.sm },
  erro: { fontSize: 13, color: colors.red, marginBottom: spacing.sm },
  label: { fontSize: 13, color: colors.ink2, marginTop: spacing.lg, marginBottom: spacing.sm },
  estrelas: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill ?? 999 },
  pillTxt: { fontSize: 11, fontWeight: '600' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  btnAcao: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 104,
    alignItems: 'center',
  },
  btnCheio: { borderColor: 'transparent' },
  btnAcaoTxt: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  painel: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  linhaEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
});
