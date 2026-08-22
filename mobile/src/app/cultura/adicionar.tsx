/**
 * Cultura — adicionar item (story 3).
 * Spec: docs/specs/cultura/spec.md
 *
 * Fluxo: escolher tipo → buscar → escolher candidato → confirmar e salvar.
 * O cadastro manual NÃO é tela separada: é o mesmo formulário de confirmação
 * sem candidato por trás, oferecido quando a cadeia de provedores se esgota
 * (CAP-1). Sem ele, livro obscuro ou celular offline travam o cadastro.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CULTURA_TIPOS, localDateStr, metaDoTipo, type CulturaEstado } from '@vitale/shared';
import { buscarCultura, type CulturaCandidato } from '../../lib/cultura-search';
import { useCulturaStore } from '../../store/cultura.store';
import { colors, moduleColors, radii, shadows, spacing, useTheme } from '../../theme';

/** Rótulos genéricos dos estados na escolha inicial; o específico vem do tipo. */
const ESTADOS: CulturaEstado[] = ['quero', 'consumindo', 'concluido'];

export default function CulturaAdicionarScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const adicionar = useCulturaStore((s) => s.adicionar);
  const jaNaEstante = useCulturaStore((s) => s.jaNaEstante);
  const convergir = useCulturaStore((s) => s.convergir);
  const indicadores = useCulturaStore((s) => s.indicadores);
  const load = useCulturaStore((s) => s.load);

  const [tipo, setTipo] = useState<string>(CULTURA_TIPOS[0]!.tipo);
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [candidatos, setCandidatos] = useState<CulturaCandidato[]>([]);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [degradada, setDegradada] = useState(false);

  // Etapa 2: confirmação. `escolhido === null` com `manual` ligado é cadastro à mão.
  const [escolhido, setEscolhido] = useState<CulturaCandidato | null>(null);
  const [manual, setManual] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [criador, setCriador] = useState('');
  const [indicadoPor, setIndicadoPor] = useState('');
  const [estado, setEstado] = useState<CulturaEstado>('quero');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const meta = useMemo(() => metaDoTipo(tipo), [tipo]);
  const mc = moduleColors('cultura');
  const confirmando = escolhido !== null || manual;

  useEffect(() => {
    void load();
  }, [load]);

  const onBuscar = useCallback(async () => {
    const termo = q.trim();
    if (termo.length === 0 || buscando) return;
    setBuscando(true);
    setErroBusca(null);
    try {
      const r = await buscarCultura(tipo, termo);
      setCandidatos(r.candidatos);
      setDegradada(r.degradada);
    } catch (e) {
      setCandidatos([]);
      setDegradada(false);
      setErroBusca(e instanceof Error ? e.message : 'falha na busca');
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  }, [q, tipo, buscando]);

  /** Trocar de tipo invalida o resultado: cada mídia tem cadeia própria. */
  const onTrocarTipo = (t: string) => {
    setTipo(t);
    setCandidatos([]);
    setBuscou(false);
    setErroBusca(null);
    setDegradada(false);
  };

  const onEscolher = async (c: CulturaCandidato) => {
    const existente = await jaNaEstante(c.fonte, c.fonteId);
    if (existente) {
      // Já está na estante: levar ao item é resposta útil; erro de unique não é.
      setAviso(`"${existente.titulo}" já está na sua estante.`);
      return;
    }
    setEscolhido(c);
    setTitulo(c.titulo);
    setCriador(c.criador ?? '');
  };

  const onManual = () => {
    setManual(true);
    setTitulo(q.trim());
    setCriador('');
  };

  const voltarParaBusca = () => {
    setEscolhido(null);
    setManual(false);
    setAviso(null);
  };

  const onSalvar = async () => {
    if (titulo.trim().length === 0 || salvando) return;
    setSalvando(true);
    try {
      const hoje = localDateStr();
      // Datas seguem a máquina de estados: `quero` não tem início, `concluido`
      // tem os dois. Aqui o item nasce hoje; o backfill com data escolhida é da
      // tela da estante (story 4).
      const datas =
        estado === 'quero'
          ? {}
          : estado === 'consumindo'
            ? { iniciadoEm: hoje }
            : { iniciadoEm: hoje, concluidoEm: hoje };

      await adicionar({
        tipo,
        titulo: titulo.trim(),
        estado,
        criador: criador.trim() || undefined,
        indicadoPor: indicadoPor.trim() || undefined,
        fonte: escolhido?.fonte,
        fonteId: escolhido?.fonteId,
        capaUrl: escolhido?.capaUrl,
        extra: escolhido?.extra,
        ...datas,
      });
      router.back();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'não foi possível salvar');
      setSalvando(false);
    }
  };

  /** Sugestões do autocomplete: prefixo, sem distinção de caixa (CAP-11). */
  const sugestoes = useMemo(() => {
    const t = indicadoPor.trim().toLocaleLowerCase('pt-BR');
    if (t.length === 0) return [];
    return indicadores
      .filter((i) => i.toLocaleLowerCase('pt-BR').startsWith(t) && i.toLocaleLowerCase('pt-BR') !== t)
      .slice(0, 4);
  }, [indicadoPor, indicadores]);

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (confirmando ? voltarParaBusca() : router.back())} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>{confirmando ? 'Confirmar' : 'Adicionar'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {!confirmando && (
          <>
            <View style={s.tipos}>
              {CULTURA_TIPOS.map((t) => {
                const ativo = t.tipo === tipo;
                return (
                  <Pressable
                    key={t.tipo}
                    onPress={() => onTrocarTipo(t.tipo)}
                    style={[s.chip, ativo && { backgroundColor: mc.accent, borderColor: mc.accent }]}
                  >
                    <Text style={[s.chipTxt, ativo && { color: '#fff' }]}>{t.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.buscaRow}>
              <TextInput
                value={q}
                onChangeText={setQ}
                onSubmitEditing={onBuscar}
                placeholder={`Buscar ${meta.rotulo.toLowerCase()}…`}
                placeholderTextColor={colors.ink3}
                style={s.input}
                returnKeyType="search"
                autoFocus
              />
              <Pressable
                onPress={onBuscar}
                style={[s.btnBusca, { backgroundColor: mc.accent }]}
                disabled={buscando}
              >
                {buscando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="search" size={18} color="#fff" />}
              </Pressable>
            </View>

            {aviso && <Text style={s.aviso}>{aviso}</Text>}
            {erroBusca && <Text style={s.aviso}>Busca falhou: {erroBusca}</Text>}

            {/*
              O catálogo principal caiu e quem respondeu foi o reserva. Sem
              este aviso a pessoa lê resultado irrelevante como "não existe" —
              foi exatamente o que aconteceu com "Bom dia, inverno".
            */}
            {degradada && (
              <View style={s.degradada}>
                <Ionicons name="warning-outline" size={15} color={colors.ink2} />
                <Text style={s.degradadaTxt}>
                  O catálogo principal não respondeu. Estes resultados vêm do reserva e
                  podem não ter o que você procura — vale buscar de novo.
                </Text>
              </View>
            )}

            {candidatos.map((c) => (
              <Pressable key={`${c.fonte}:${c.fonteId}`} onPress={() => onEscolher(c)} style={s.card}>
                {c.capaUrl
                  ? <Image source={{ uri: c.capaUrl }} style={s.capa} resizeMode="cover" />
                  : <View style={[s.capa, s.capaVazia]}>
                      <Ionicons name="image-outline" size={20} color={colors.ink4} />
                    </View>}
                <View style={s.flex}>
                  <Text style={s.cardTitulo} numberOfLines={2}>{c.titulo}</Text>
                  <Text style={s.cardSub} numberOfLines={1}>
                    {c.criador ?? `Sem ${meta.rotuloCriador.toLowerCase()}`}
                    {typeof c.extra?.['ano'] === 'number' ? ` · ${c.extra['ano']}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
              </Pressable>
            ))}

            {/*
              Ramo terminal da CAP-1. Fica visível sempre que houve busca, NÃO
              só quando a lista voltou vazia: provedor que devolve resultado
              irrelevante é tão terminal quanto provedor que não devolve nada,
              e a primeira versão escondia a saída justamente aí. Descoberto no
              uso real — "Bom dia, inverno" traz 53 livros religiosos da Open
              Library, e o botão nunca aparecia.
            */}
            {buscou && (
              <View style={s.vazio}>
                {candidatos.length === 0 && (
                  <Text style={s.vazioTxt}>Nenhum catálogo conhece “{q.trim()}”.</Text>
                )}
                {candidatos.length > 0 && (
                  <Text style={s.vazioTxt}>Não é nenhum desses?</Text>
                )}
                <Pressable onPress={onManual} style={[s.btnManual, { borderColor: mc.accent }]}>
                  <Ionicons name="create-outline" size={16} color={mc.accent} />
                  <Text style={[s.btnManualTxt, { color: mc.accent }]}>Cadastrar à mão</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {confirmando && (
          <>
            <Text style={s.label}>Título</Text>
            <TextInput value={titulo} onChangeText={setTitulo} style={s.input} />

            <Text style={s.label}>{meta.rotuloCriador}</Text>
            <TextInput
              value={criador}
              onChangeText={setCriador}
              placeholder="Opcional"
              placeholderTextColor={colors.ink3}
              style={s.input}
            />

            <Text style={s.label}>Indicado por</Text>
            <TextInput
              value={indicadoPor}
              onChangeText={setIndicadoPor}
              onBlur={() => setIndicadoPor((v) => (v.trim() ? convergir(v) : ''))}
              placeholder="Opcional — quem recomendou"
              placeholderTextColor={colors.ink3}
              style={s.input}
              autoCapitalize="words"
            />
            {sugestoes.length > 0 && (
              <View style={s.sugestoes}>
                {sugestoes.map((i) => (
                  <Pressable key={i} onPress={() => setIndicadoPor(i)} style={s.sugestao}>
                    <Text style={s.sugestaoTxt}>{i}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={s.label}>Estado</Text>
            <View style={s.tipos}>
              {ESTADOS.map((e) => {
                const ativo = e === estado;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setEstado(e)}
                    style={[s.chip, ativo && { backgroundColor: mc.accent, borderColor: mc.accent }]}
                  >
                    <Text style={[s.chipTxt, ativo && { color: '#fff' }]}>{meta.estados[e]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {aviso && <Text style={s.aviso}>{aviso}</Text>}

            <Pressable
              onPress={onSalvar}
              disabled={titulo.trim().length === 0 || salvando}
              style={[
                s.btnSalvar,
                { backgroundColor: mc.accent },
                (titulo.trim().length === 0 || salvando) && s.btnDisabled,
              ]}
            >
              {salvando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnSalvarTxt}>Adicionar à estante</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill ?? 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipTxt: { fontSize: 13, color: colors.ink2, fontWeight: '500' },
  buscaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
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
  btnBusca: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  vazio: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  vazioTxt: { fontSize: 14, color: colors.ink2, textAlign: 'center' },
  btnManual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  btnManualTxt: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 13, color: colors.ink2, marginBottom: spacing.xs, marginTop: spacing.md },
  sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  sugestao: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill ?? 999,
    backgroundColor: colors.bg2,
  },
  sugestaoTxt: { fontSize: 13, color: colors.ink2 },
  aviso: { fontSize: 13, color: colors.ink2, marginBottom: spacing.sm },
  degradada: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  degradadaTxt: { flex: 1, fontSize: 12, color: colors.ink2, lineHeight: 17 },
  btnSalvar: {
    marginTop: spacing.xl,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnSalvarTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
