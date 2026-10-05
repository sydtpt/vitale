/**
 * Presença — onde o dia foi.
 *
 * Irmã do detalhe de Hábitos e do de Registros: mesmo eixo de período, mesmas peças,
 * e **a tela só renderiza**. Toda derivação vem de `buildPresenceDetail` no núcleo,
 * sobre o que o banco devolveu — por isso o que esta tela mostra está cobrado por teste
 * contra o acervo real, sem abrir aparelho nenhum.
 *
 * ## Lugar é dimensão, não módulo (ADR 0059)
 *
 * Por isso ela vive pelo Mais e não na barra, e por isso não tem cor própria: casa usa o
 * acento do módulo `casa`, o trabalho o de `tarefa`, e "fora" fica na tinta neutra.
 *
 * ## O que ela se recusa a dizer
 *
 * - **Dia sem medição aparece vazado, nunca como dia em casa.** São três estados no ano
 *   — saiu, não saiu, sem cobertura — e nunca um quarto: saída curta vive no detalhe do
 *   dia, porque um quarto estado obriga legenda e legenda mata o heatmap.
 * - A cobertura vem escrita embaixo da manchete (*"sobre 23 dos 25 dias"*), e a borda
 *   estimada é contada à parte. Número menor e buraco são coisas diferentes.
 * - Mediana sem amostra é um traço, nunca `0,0 h`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildPresenceDetail,
  diasDePresenca,
  emCasaPorDiaDaSemana,
  fetchLugares,
  fetchPlaceDays,
  fetchVisitas,
  fraseDoDiaEmCasa,
  janelaDasVisitas,
  rollupDoBanco,
  visitasDoBanco,
  DIAS_ABREV_SEG,
  type DetalheDaPresenca,
  type EstadoDoDia,
  type Lugar,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';
import { mensagemDeErro } from '../lib/erro';
import {
  confirmarQueEstaCerto,
  duvidasDaPresenca,
  registrarChegada,
  type Duvida,
} from '../services/presence-correcoes';
import { Segmented } from '../components/ui/Segmented';
import { colors, fonts, moduleColors, radii, spacing, themed, useTheme } from '../theme';

type Janela = '7d' | '30d' | '90d' | 'tudo';

/** A lista dos dias em casa para aqui; o resto vira "e mais N dias". */
const MAX_DIAS_NA_LISTA = 15;

const JANELAS: { key: Janela; label: string; dias: number | null }[] = [
  { key: '7d', label: '7d', dias: 7 },
  { key: '30d', label: '30d', dias: 30 },
  { key: '90d', label: '90d', dias: 90 },
  { key: 'tudo', label: 'Tudo', dias: null },
];

/** Hora local do instante, como a lista de eventos a escreve. */
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Horas com uma casa, e vírgula — nunca "4.2". */
function h(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1).replace('.', ',')} h`;
}

function dma(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, cor ? { color: cor } : null]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {rotulo}
      </Text>
    </View>
  );
}

export default function PresencaScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [janela, setJanela] = useState<Janela>('30d');
  const [lugares, setLugares] = useState<Lugar[] | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheDaPresenca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [diasAbertos, setDiasAbertos] = useState(false);

  const carregar = useCallback(async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    try {
      setErro(null);
      const ls = await fetchLugares(supabase, userId);
      setLugares(ls);

      // A janela da consulta é larga de propósito: o pareamento e a regra da noite
      // virada precisam do dia anterior ao primeiro que a tela mostra.
      const hoje = new Date();
      const de = new Date(hoje);
      de.setDate(de.getDate() - 400);
      const ymd = (d: Date) => d.toISOString().slice(0, 10);

      const [vs, ds] = await Promise.all([
        fetchVisitas(supabase, userId, ymd(de), ymd(hoje)),
        fetchPlaceDays(supabase, userId, ymd(de), ymd(hoje)),
      ]);

      const identidadePorLugar = new Map(ls.map((l) => [l.id, l.identidade]));
      const visitas = visitasDoBanco(vs, identidadePorLugar);
      const rollup = rollupDoBanco(ds);
      if (rollup.length === 0) {
        setDetalhe(null);
        return;
      }

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const trabalho = ls.find((l) => l.kind === 'work')?.identidade;
      // Sem a janela, o primeiro e o último dia com dado contavam como dias em casa.
      const janelaObservada = janelaDasVisitas(visitas) ?? undefined;
      const dias = diasDePresenca(visitas, { casa: 'casa', tz, rollup, janela: janelaObservada });
      setDetalhe(buildPresenceDetail(dias, rollup, { casa: 'casa', trabalho }));
      setDuvidas(await duvidasDaPresenca(userId));
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  /** O recorte é uma fatia do que já foi derivado — não uma segunda derivação. */
  const visao = useMemo(() => {
    if (!detalhe) return null;
    const n = JANELAS.find((j) => j.key === janela)?.dias;
    if (n === null || n === undefined) return detalhe;
    const barras = detalhe.foraDeCasa.barras.slice(-n);
    const ano = detalhe.ano.slice(-n);
    const desde = ano[0]?.dia ?? '';
    const medidos = ano.filter((c) => c.estado !== 'sem-cobertura');
    return {
      ...detalhe,
      cobertura: { dias: ano.length, medidos: medidos.length },
      contagem: {
        ...detalhe.contagem,
        semSair: ano.filter((c) => c.estado === 'nao-saiu').length,
        saiu: ano.filter((c) => c.estado === 'saiu').length,
        semCobertura: ano.length - medidos.length,
      },
      foraDeCasa: { ...detalhe.foraDeCasa, barras },
      ano,
      emCasa: detalhe.emCasa.filter((d) => d.dia >= desde),
    };
  }, [detalhe, janela]);

  const responder = useCallback(
    (d: Duvida, cheguei: boolean) => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      setRespondendo(d.chave);
      const acao = cheguei ? registrarChegada(userId, d) : confirmarQueEstaCerto(d.chave);
      acao
        .then(() => carregar())
        .catch((e: unknown) => setErro(mensagemDeErro(e)))
        .finally(() => setRespondendo(null));
    },
    [carregar],
  );

  const casa = moduleColors('casa');
  const corCasa = casa.accent;
  const corTrabalho = moduleColors('tarefa').accent;
  // Três degraus da MESMA cor, e não três cores: saiu é o acento, não saiu é o tint, e
  // sem cobertura não tem preenchimento nenhum. Matiz diferente para estados de uma só
  // grandeza faria o olho procurar significado onde só há intensidade.
  const corSemSair = casa.tint;

  const corDoEstado = (e: EstadoDoDia): string =>
    e === 'saiu' ? corCasa : e === 'nao-saiu' ? corSemSair : 'transparent';

  const larguraBarra = Math.max(
    2,
    Math.floor((width - spacing.lg * 2 - 32 - (visao?.foraDeCasa.barras.length ?? 1) * 2) /
      Math.max(1, visao?.foraDeCasa.barras.length ?? 1)),
  );
  const maiorBarra = Math.max(1, ...(visao?.foraDeCasa.barras.map((b) => b.horas) ?? [1]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.ink2} />
        </Pressable>
        <Text style={styles.title}>Presença</Text>
        <Pressable
          onPress={() => router.push('/configuracoes/presenca')}
          hitSlop={12}
          accessibilityLabel="Lugares e observação"
        >
          <Ionicons name="options-outline" size={20} color={colors.ink3} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <View style={styles.segmentWrap}>
          <Segmented
            options={JANELAS.map((j) => ({ key: j.key, label: j.label }))}
            value={janela}
            onChange={(k) => setJanela(k as Janela)}
          />
        </View>

        {erro ? (
          <View style={styles.card}>
            <Text style={styles.vazio}>{erro}</Text>
          </View>
        ) : !visao ? (
          <View style={styles.card}>
            {detalhe === null && lugares !== null ? (
              <Text style={styles.vazio}>
                Nada medido ainda. Cadastre um lugar e ligue a observação em Configurações ›
                Presença.
              </Text>
            ) : (
              <ActivityIndicator color={colors.ink3} />
            )}
          </View>
        ) : (
          <>
            {/* a manchete — tocar abre os dias em casa */}
            <Pressable
              onPress={() => setDiasAbertos((v) => !v)}
              disabled={visao.emCasa.length === 0}
              accessibilityRole="button"
              accessibilityState={{ expanded: diasAbertos }}
              accessibilityLabel={`${visao.contagem.semSair} dias sem sair de casa. ${diasAbertos ? 'Fechar' : 'Ver'} os dias`}
              style={styles.card}
            >
              <View style={styles.mancheteRow}>
                <Text style={[styles.mancheteNum, { color: corCasa }]}>
                  {visao.contagem.semSair}
                </Text>
                <Text style={styles.mancheteLabel}>
                  {visao.contagem.semSair === 1 ? 'dia sem sair' : 'dias sem sair'}
                  {'\n'}de casa
                </Text>
                {visao.emCasa.length > 0 ? (
                  <Ionicons
                    name={diasAbertos ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={colors.ink3}
                    style={styles.mancheteChevron}
                  />
                ) : null}
              </View>

              {/* em que dia da semana caíram — sete números, mesmo tamanho em qualquer período */}
              <View style={styles.faixa}>
                {emCasaPorDiaDaSemana(visao.emCasa).map((n, i) => (
                  <View key={i} style={styles.faixaDia}>
                    <Text style={[styles.faixaNome, n > 0 && { color: colors.ink2 }]}>
                      {DIAS_ABREV_SEG[(i + 6) % 7]}
                    </Text>
                    <Text style={[styles.faixaNum, n > 0 && { color: corCasa }]}>{n}</Text>
                  </View>
                ))}
              </View>

              {diasAbertos && visao.emCasa.length > 0 ? (
                <View style={styles.lista}>
                  {visao.emCasa.slice(0, MAX_DIAS_NA_LISTA).map((d) => (
                    <View key={d.dia} style={styles.listaLinha}>
                      <Text style={styles.listaData}>
                        {DIAS_ABREV_SEG[(d.indice + 6) % 7]}{' '}
                        <Text style={styles.listaDataDia}>{dma(d.dia)}</Text>
                      </Text>
                      <Text style={styles.listaFrase}>{fraseDoDiaEmCasa(d)}</Text>
                    </View>
                  ))}
                  {visao.emCasa.length > MAX_DIAS_NA_LISTA ? (
                    <Text style={styles.listaMais}>
                      e mais {visao.emCasa.length - MAX_DIAS_NA_LISTA}{' '}
                      {visao.emCasa.length - MAX_DIAS_NA_LISTA === 1 ? 'dia' : 'dias'}.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.cobertura}>
                Sobre {visao.cobertura.medidos} dos {visao.cobertura.dias} dias
                {visao.bordasEstimadas > 0
                  ? ` · ${visao.bordasEstimadas} borda${visao.bordasEstimadas > 1 ? 's' : ''} estimada${visao.bordasEstimadas > 1 ? 's' : ''}`
                  : ''}
                .
              </Text>
            </Pressable>

            {/* três números */}
            <View style={styles.tilesRow}>
              <Numero valor={h(visao.foraDeCasa.medianaH)} rotulo={'fora de casa\npor dia'} />
              <Numero
                valor={visao.escritorio ? String(visao.escritorio.dias) : '—'}
                rotulo={'dias de\nescritório'}
                cor={visao.escritorio ? corTrabalho : undefined}
              />
              <Numero
                valor={visao.escritorio ? h(visao.escritorio.medianaH) : '—'}
                rotulo={'por dia de\nescritório'}
              />
            </View>

            {/* horas fora, por dia */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Horas fora de casa</Text>
                <Text style={styles.cardNota}>{h(visao.foraDeCasa.totalH)} no total</Text>
              </View>
              <View style={styles.barras}>
                {visao.foraDeCasa.barras.map((b) => (
                  <View
                    key={b.dia}
                    style={[
                      styles.barra,
                      {
                        width: larguraBarra,
                        height: Math.max(2, (b.horas / maiorBarra) * 90),
                        backgroundColor:
                          b.estado === 'sem-cobertura' ? colors.line : b.horas > 0 ? corCasa : corSemSair,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.cardHead}>
                <Text style={styles.eixo}>{dma(visao.foraDeCasa.barras[0]?.dia ?? '')}</Text>
                <Text style={styles.eixo}>
                  {dma(visao.foraDeCasa.barras[visao.foraDeCasa.barras.length - 1]?.dia ?? '')}
                </Text>
              </View>
            </View>

            {/* por dia da semana */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Por dia da semana</Text>
              <Text style={styles.cardNota}>mediana de horas fora</Text>
              <View style={{ marginTop: spacing.md }}>
                {visao.porDiaDaSemana.map((d) => {
                  const maior = Math.max(
                    0.1,
                    ...visao.porDiaDaSemana.map((x) => x.medianaH ?? 0),
                  );
                  return (
                    <View key={d.indice} style={styles.semanaRow}>
                      <Text style={styles.semanaNome}>
                        {DIAS_ABREV_SEG[(d.indice + 6) % 7]}
                      </Text>
                      <View style={styles.semanaTrilho}>
                        <View
                          style={{
                            height: '100%',
                            width: `${((d.medianaH ?? 0) / maior) * 100}%`,
                            backgroundColor: corCasa,
                            borderRadius: 4,
                          }}
                        />
                      </View>
                      <Text style={styles.semanaValor}>{h(d.medianaH)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* o período, em três estados */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>O período</Text>
              <Text style={styles.cardNota}>saiu · não saiu · sem cobertura</Text>
              <View style={styles.grade}>
                {visao.ano.map((c) => (
                  <View
                    key={c.dia}
                    style={[
                      styles.celula,
                      c.estado === 'sem-cobertura'
                        ? { borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' }
                        : { backgroundColor: corDoEstado(c.estado) },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.legenda}>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, { backgroundColor: corCasa }]} />
                  <Text style={styles.legendaTexto}>saiu</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, { backgroundColor: corSemSair }]} />
                  <Text style={styles.legendaTexto}>não saiu</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View
                    style={[
                      styles.legendaCor,
                      { borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
                    ]}
                  />
                  <Text style={styles.legendaTexto}>sem cobertura</Text>
                </View>
              </View>
            </View>

            {/* a caixa de correções */}
            {duvidas.length > 0 ? (
              <View style={[styles.card, { borderColor: casa.tint }]}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>
                    {duvidas.length === 1 ? 'Uma coisa para conferir' : `${duvidas.length} coisas para conferir`}
                  </Text>
                </View>
                <Text style={styles.cardNota}>
                  o app levanta a dúvida; quem responde é você
                </Text>
                {duvidas.slice(0, 6).map((d) => (
                  <View key={d.chave} style={styles.duvida}>
                    <Text style={styles.duvidaTitulo}>
                      {d.motivo === 'descartada'
                        ? `A chegada de ${dataCurta(d.ate)} não foi contada.`
                        : d.motivo === 'sono'
                          ? `Você dormiu em ${dataCurta(d.de)} e não há presença em casa nesse dia.`
                          : d.motivo === 'atividade'
                            ? `${dataCurta(d.de)} diz que você não saiu, e tem uma atividade com rota.`
                            : `Falta uma borda em ${dataCurta(d.ate)} · ${d.lugar}.`}
                    </Text>
                    <Text style={styles.duvidaSub}>
                      {d.chegadaProposta && d.saidaProposta
                        ? `Há um registro às ${hhmm(d.chegadaProposta)} que o app descartou. Você teria saído às ${hhmm(d.saidaProposta)}.`
                        : d.motivo === 'sono'
                          ? 'Ou você dormiu fora, ou a chegada se perdeu — só você sabe qual.'
                          : d.motivo === 'atividade'
                            ? `A atividade começou às ${hhmm(d.de)}.`
                            : `Entre ${hhmm(d.de)} e ${hhmm(d.ate)} o aparelho perdeu uma travessia.`}
                    </Text>
                    <View style={styles.duvidaBotoes}>
                      {d.chegadaProposta && d.saidaProposta ? (
                        <Pressable
                          onPress={() => responder(d, true)}
                          disabled={respondendo !== null}
                          style={({ pressed }) => [
                            styles.botaoPrimario,
                            { backgroundColor: corCasa },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          {respondendo === d.chave ? (
                            <ActivityIndicator size="small" color={casa.onAccent} />
                          ) : (
                            <Text style={[styles.botaoPrimarioTexto, { color: casa.onAccent }]}>
                              Cheguei {hhmm(d.chegadaProposta)}
                            </Text>
                          )}
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => responder(d, false)}
                        disabled={respondendo !== null}
                        style={({ pressed }) => [styles.botaoSecundario, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.botaoSecundarioTexto}>Está certo</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {duvidas.length > 6 ? (
                  <Text style={styles.cardNota}>e mais {duvidas.length - 6}.</Text>
                ) : null}
              </View>
            ) : null}

            {/* rodapé honesto */}
            <Text style={styles.rodape}>
              {h(visao.emCasaH)} em casa
              {visao.escritorio ? ` · ${h(visao.escritorio.totalH)} no escritório` : ''}.{'\n'}
              Dia sem medição aparece vazado, nunca como dia em casa.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
    segmentWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    card: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
    },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
    cardNota: { fontSize: 11, color: colors.ink3, marginTop: 2 },
    mancheteRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
    mancheteNum: { fontFamily: fonts.monoBold, fontSize: 52, lineHeight: 54 },
    mancheteLabel: { fontSize: 16, fontWeight: '600', color: colors.ink, lineHeight: 21 },
    mancheteChevron: { marginLeft: 'auto', alignSelf: 'center' },
    faixa: { flexDirection: 'row', marginTop: spacing.md },
    faixaDia: { flex: 1, alignItems: 'center', gap: 2 },
    faixaNome: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink3 },
    faixaNum: { fontFamily: fonts.monoBold, fontSize: 20, lineHeight: 24, color: colors.ink3 },
    lista: { marginTop: spacing.sm },
    listaLinha: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.md,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    listaData: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink, width: 84 },
    listaDataDia: { color: colors.ink3 },
    listaFrase: { flex: 1, fontSize: 12.5, color: colors.ink2 },
    listaMais: {
      fontSize: 12,
      color: colors.ink3,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    cobertura: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      fontSize: 12,
      color: colors.ink3,
    },
    tilesRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    tile: {
      flex: 1,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 3,
    },
    tileValue: { fontFamily: fonts.monoBold, fontSize: 19, color: colors.ink },
    tileLabel: { fontSize: 11, color: colors.ink2, lineHeight: 14 },
    barras: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
      height: 90,
      marginVertical: spacing.md,
    },
    barra: { borderRadius: 2 },
    eixo: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink3 },
    semanaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
    semanaNome: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink2, width: 28 },
    semanaTrilho: {
      flex: 1,
      height: 8,
      backgroundColor: colors.line,
      borderRadius: 4,
      overflow: 'hidden',
    },
    semanaValor: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.ink,
      width: 44,
      textAlign: 'right',
    },
    grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: spacing.md },
    celula: { width: 11, height: 11, borderRadius: 2 },
    legenda: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
    legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendaCor: { width: 9, height: 9, borderRadius: 2 },
    legendaTexto: { fontSize: 11, color: colors.ink2 },
    rodape: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      fontSize: 11,
      color: colors.ink3,
      lineHeight: 17,
    },
    vazio: { fontSize: 13, color: colors.ink3, lineHeight: 19 },
    duvida: { paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
    duvidaTitulo: { fontSize: 13, color: colors.ink, lineHeight: 19 },
    duvidaSub: { fontSize: 12, color: colors.ink2, lineHeight: 18, marginTop: 3 },
    duvidaBotoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    botaoPrimario: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
    botaoPrimarioTexto: { fontSize: 13, fontWeight: '600' },
    botaoSecundario: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.line,
    },
    botaoSecundarioTexto: { fontSize: 13, color: colors.ink2 },
  }),
);
