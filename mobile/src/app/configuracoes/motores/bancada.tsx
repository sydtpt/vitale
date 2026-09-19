import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SEM_MODELO,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  filterByRange,
  ler,
  localDateStr,
  type Desfecho,
  type EntradaDaSaude,
  type Medicao,
  type MotorId,
  type ProblemaDaConferencia,
  type SonoRange,
} from '@vitale/shared';
import { useSonoStore } from '../../../store/sono.store';
import { PeriodNav } from '../../../components/sono/PeriodNav';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { motivoDaFalha } from '../../../lib/assinatura';
import { motoresDoRecurso, nomeDoMotor, type EstadoDaPonte } from '../../../lib/motores/catalogo';
import { TETO_DO_ANEL, anel } from '../../../lib/motores/anel';
import { garantirListaAprovada, motorPara, ponteDoAparelho, testeDoPCC } from '../../../lib/motores';
import { chaveDaJanela } from '../../../lib/leitura-da-saude';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../../theme';

/**
 * /configuracoes/motores/bancada — os motores na mesma janela, lado a lado com o
 * template.
 *
 * É a tela de desenvolvimento do marco A, e o **único lugar do app onde o texto
 * cru do fornecedor aparece**: em produção o que se mostra é a frase montada, com
 * os marcadores já trocados pelos fatos. Aqui se vê o que o motor escreveu antes
 * disso — é assim que paráfrase e sinônimo que a conferência não pega aparecem
 * para o dono.
 *
 * **Modo `medicao`, um motor por vez** (AD-9): exatamente o motor pedido, sem
 * recuo e sem piso. Por isso a primeira passada é a régua — o template, que é
 * determinístico e de graça — e cada motor depois é uma tentativa isolada, com o
 * desfecho, o tempo, os tokens e os problemas da conferência. A frase do template
 * é repetida **dentro** de cada bloco de motor: num telefone não cabem duas
 * colunas de prosa, e o que faz a comparação é a adjacência, não a geometria.
 *
 * O `regimeMaximo` do recurso continua valendo aqui (dado de um recurso
 * só-aparelho não iria à nuvem nem para medir); o `grava.admite` não, porque medir
 * não grava.
 *
 * Nada é gravado, e nada do que esta tela mostra sai do aparelho.
 */
export default function BancadaScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const periods = useSonoStore((st) => st.periods);
  const ratings = useSonoStore((st) => st.sleepRatings);
  const loaded = useSonoStore((st) => st.loaded);
  const load = useSonoStore((st) => st.load);
  const carregarNotasDesde = useSonoStore((st) => st.carregarNotasDesde);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const [range, setRange] = useState<SonoRange>('7d');
  const [offset, setOffset] = useState(0);
  const [rodando, setRodando] = useState<MotorId | null>(null);
  const [linhas, setLinhas] = useState<readonly Linha[]>([]);
  // O diagnóstico da ponte, cru (5.9): relido ao abrir enquanto não for "disponível".
  const [ponte, setPonte] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  useEffect(() => {
    let vivo = true;
    void ponteDoAparelho.reconsultar().then((p) => {
      if (vivo) setPonte(p);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const hoje = useMemo(() => localDateStr(), []);
  const today = useMemo(() => new Date(), []);
  const nights = useMemo(() => filterByRange(periods, range, today, offset), [periods, range, offset, today]);
  const entrada = useMemo(
    () => entradaDaSaude(periods, ratings, { range, offset, hoje }),
    [periods, ratings, range, offset, hoje],
  );

  const desde = entrada.janela.since;
  useEffect(() => {
    if (desde !== null) void carregarNotasDesde(desde);
  }, [desde, carregarNotasDesde]);

  // Trocar a janela apaga o que já foi medido: comparar a frase de um motor numa
  // janela com a de outro motor em outra janela é exatamente o erro que a bancada
  // existe para não cometer.
  useEffect(() => {
    setLinhas([]);
  }, [range, offset]);

  // A janela que o cabeçalho está mostrando agora. O laço a compara a cada volta:
  // ele leva ~14 s por motor, e nesse tempo o dono troca o período.
  const chaveCorrente = chaveDaJanela(entrada);
  const chaveRef = useRef(chaveCorrente);
  chaveRef.current = chaveCorrente;

  const medir = useCallback(async () => {
    const chaveDoLaco = chaveDaJanela(entrada);
    setRodando(SEM_MODELO);
    const feitas: Linha[] = [];
    try {
      // A lista do servidor antes do laço (5.6): uma variante nomeada que o dono
      // pode **escolher** no seletor tem de ser mensurável aqui, senão a tela que
      // existe para comparar motores esconde justamente o motor novo.
      // E a ponte do aparelho (5.9): com o módulo no build, o aparelho é medido aqui
      // ao lado da nuvem, com o texto cru dele — é a comparação que o dono pediu.
      const [lista, estadoDaPonte] = await Promise.all([garantirListaAprovada(), ponteDoAparelho.reconsultar()]);
      setPonte(estadoDaPonte);
      const conhecidos = motoresDoRecurso(descritorDaSaudeDoSono.recurso, estadoDaPonte, lista);
      if (chaveRef.current !== chaveDoLaco) return;
      for (const m of conhecidos) {
        // **Abandona o que é de outra janela.** O efeito de limpeza apaga as linhas
        // quando o período muda, mas o laço já capturou `entrada` e continuaria
        // pintando medições da janela velha sob o cabeçalho novo — que é exatamente
        // o erro que esta tela existe para não cometer (comparar a frase de um motor
        // numa janela com a de outro motor em outra).
        if (chaveRef.current !== chaveDoLaco) return;
        setRodando(m.id);
        const linha = await medirUm(entrada, m.id);
        if (chaveRef.current !== chaveDoLaco) return;
        feitas.push(linha);
        // Publica a cada motor: a nuvem leva ~14 s na mediana, e esperar todas as
        // colunas para mostrar a primeira deixaria a tela vazia por meio minuto.
        setLinhas([...feitas]);
      }
    } finally {
      setRodando(null);
    }
  }, [entrada]);

  const template = linhas.find((l) => l.motor === SEM_MODELO)?.frase;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader titulo="Bancada" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <PeriodNav
            range={range}
            offset={offset}
            periods={periods}
            nights={nights}
            onRange={(r) => {
              setRange(r);
              setOffset(0);
            }}
            onOffset={setOffset}
          />
          <Pressable
            onPress={() => void medir()}
            disabled={rodando !== null}
            accessibilityRole="button"
            accessibilityLabel="Medir todos os motores nesta janela"
            accessibilityState={rodando !== null ? { disabled: true, busy: true } : {}}
            style={({ pressed }) => [s.botao, rodando !== null && s.botaoOff, pressed && s.pressed]}
          >
            {rodando !== null ? <ActivityIndicator size="small" color={colors.onPrimary} /> : null}
            <Text style={s.botaoTexto}>
              {rodando === null ? 'Medir os motores' : `medindo ${nomeDoMotor(rodando)}…`}
            </Text>
          </Pressable>
          <Text style={s.aviso}>
            Modo medição: um motor por vez, sem recuo e sem piso. A frase do template é a régua. O
            texto cru só aparece aqui, e nada disto sai do aparelho.
          </Text>
          <Text style={s.rotulo}>diagnóstico da ponte</Text>
          <Text style={s.meta}>{diagnosticoCru(ponte)}</Text>
        </View>

        {linhas.map((l) => (
          <BlocoDoMotor key={l.motor} linha={l} template={template} s={s} />
        ))}

        <TesteDoPCC s={s} />

        <Anel s={s} />
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/** Uma medição, já reduzida ao que a tela mostra. */
interface Linha {
  readonly motor: MotorId;
  /**
   * O `Desfecho` do núcleo, mais os dois que só a medição produz. Tipado, e não
   * `string`: é exatamente aqui que um desfecho novo no orquestrador tem de quebrar
   * a compilação, em vez de aparecer como texto cru numa linha do relatório.
   */
  readonly desfecho: Desfecho | 'template' | 'mudo';
  readonly ms: number;
  readonly hash?: string;
  /** A frase montada — do template, na régua; do motor, nas outras colunas. */
  readonly frase?: string;
  /** O texto como o motor o escreveu, antes da interpolação. */
  readonly cru?: string;
  readonly tokens?: { readonly entrada: number; readonly saida: number };
  /** Quem forneceu os pesos, como a resposta assinou. */
  readonly provedor?: string;
  /** O modelo que assinou esta medição — no aparelho, a variante ("AFM 3 Core"). */
  readonly modelo?: string;
  readonly problemas?: readonly ProblemaDaConferencia[];
  readonly detalhe?: string;
  /** O motivo em palavras, pela mesma função que a `/sono/saude` usa. */
  readonly motivo?: string | null;
}

/**
 * Mede um motor.
 *
 * Nenhuma falha derruba a varredura: a porta nunca rejeita, e a exceção que
 * sobraria vem de função pura do descritor — defeito, que tem de virar linha em
 * vez de apagar as outras colunas.
 */
async function medirUm(entrada: EntradaDaSaude, motor: MotorId): Promise<Linha> {
  let m: Medicao<string>;
  try {
    m = await ler(descritorDaSaudeDoSono, entrada, {
      modo: 'medicao',
      motor,
      motorPara,
      registrar: anel.registrar,
      agora: () => new Date(),
    });
  } catch (e) {
    return {
      motor,
      desfecho: 'defeito',
      ms: 0,
      detalhe: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }

  if (m.tipo === 'template') {
    return {
      motor,
      desfecho: 'template',
      ms: 0,
      ...('frase' in m ? { frase: m.frase } : { detalhe: `sem frase: ${m.ausencia}` }),
    };
  }
  if (m.tipo === 'mudo') return { motor, desfecho: 'mudo', ms: 0 };

  const ms = m.trilha.reduce((soma, t) => soma + t.ms, 0);
  const problemas = m.trilha.flatMap((t) => t.problemas ?? []);
  const ultima = m.trilha[m.trilha.length - 1];
  const assinatura = m.resposta?.assinatura;
  const desfecho = m.desfecho;
  // O texto cru é o que a interpretação leu (`valor`); o `resposta.texto` é o
  // recuo para quando a conferência reprovou antes de haver valor.
  const cru = m.valor ?? m.resposta?.texto;
  return {
    motor,
    desfecho,
    ms,
    hash: m.hash,
    ...(m.frase !== undefined ? { frase: m.frase } : {}),
    ...(cru !== undefined ? { cru } : {}),
    ...(m.resposta?.tokens ? { tokens: m.resposta.tokens } : {}),
    ...(assinatura ? { provedor: assinatura.provedor, modelo: assinatura.modelo } : {}),
    ...(problemas.length > 0 ? { problemas } : {}),
    ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
    // A mesma tradução que a `/sono/saude` mostra — a tela de desenvolvimento não
    // tem um segundo vocabulário de falha.
    ...(desfecho === 'ok' ? {} : { motivo: motivoDaFalha(desfecho, motor) }),
  };
}

function BlocoDoMotor({ linha, template, s }: { linha: Linha; template?: string; s: Styles }) {
  const daRegua = linha.motor === SEM_MODELO;
  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.motor}>{linha.motor}</Text>
        <Text style={s.desfecho}>
          {linha.desfecho}
          {linha.ms > 0 ? ` · ${(linha.ms / 1000).toFixed(1)} s` : ''}
        </Text>
      </View>

      {/* A régua ao lado do motor, na mesma janela. No bloco do próprio template
          ela não se repete. */}
      {!daRegua && template !== undefined ? (
        <>
          <Text style={s.rotulo}>template</Text>
          <Text style={s.fraseFraca}>{template}</Text>
        </>
      ) : null}

      {linha.frase !== undefined ? (
        <>
          {!daRegua ? <Text style={s.rotulo}>motor</Text> : null}
          <Text style={s.frase}>{linha.frase}</Text>
        </>
      ) : null}
      {linha.motivo ? <Text style={s.motivo}>{linha.motivo}</Text> : null}

      {linha.cru !== undefined && linha.cru !== linha.frase ? (
        <>
          <Text style={s.rotulo}>texto cru</Text>
          <Text style={s.cru}>{linha.cru}</Text>
        </>
      ) : null}

      {linha.modelo !== undefined ? (
        <Text style={s.meta}>
          assinado por {linha.provedor} · modelo {linha.modelo}
          {linha.tokens ? ` · ${linha.tokens.entrada}→${linha.tokens.saida} tokens` : ''}
        </Text>
      ) : null}
      {linha.hash !== undefined ? <Text style={s.meta}>hash {linha.hash.slice(0, 12)}</Text> : null}
      {linha.detalhe !== undefined ? <Text style={s.meta}>{linha.detalhe}</Text> : null}

      {linha.problemas?.map((p, i) => (
        <Text key={`${p.regra}-${i}`} style={s.problema}>
          {p.regra}: {p.detalhe}
        </Text>
      ))}
    </View>
  );
}

/**
 * EXPERIMENTO DESCARTÁVEL — o teste do Private Cloud Compute (story 5.9). **Apagar
 * ou promover depois do veredito do dono**, junto com `ExperimentoDoPCC.swift` e a
 * terceira função da cola (exceção à AD-3 decidida por ele em 19/09/2026).
 *
 * Um botão, e o que voltou **cru**: disponibilidade, cota, a resposta a "Diga olá."
 * ou o erro com o código. Nenhum dado do dono vai — o texto é fixo, e mora no Swift.
 * Não é motor: não entra no seletor, no catálogo nem na medição acima. Só responde se
 * o iPhone tem acesso ao PCC, que é o que decide se a 5.12 volta.
 */
function TesteDoPCC({ s }: { s: Styles }) {
  // Aberto só quando não há chamada nativa viva: o prazo estourado **não** reabre o
  // botão — a chamada segue na ponte, e um segundo toque não abre outra.
  const [emCurso, setEmCurso] = useState(() => testeDoPCC.emCurso());
  const [cru, setCru] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const testar = useCallback(async () => {
    setEmCurso(true);
    // `rodar` nunca rejeita: erro é resultado, e vira o texto abaixo. Com um teste
    // anterior ainda vivo, ele não chama a ponte — só diz isso.
    const r = await testeDoPCC.rodar();
    if (vivo.current) setCru(legivel(r.texto));
    if (r.tarde) {
      const tarde = await r.tarde;
      if (vivo.current) setCru(`${legivel(tarde)}\n\n(chegou depois do prazo)`);
    }
    if (vivo.current) setEmCurso(testeDoPCC.emCurso());
  }, []);

  return (
    <View style={s.card}>
      <Text style={s.rotulo}>experimento · private cloud compute</Text>
      <Text style={s.meta}>Manda só "Diga olá." e mostra cru o que voltou. Nenhum dado seu vai.</Text>
      <View style={s.acoesDoAnel}>
        <Pressable
          onPress={() => void testar()}
          disabled={emCurso}
          accessibilityRole="button"
          accessibilityLabel="Testar Private Cloud Compute"
          accessibilityState={emCurso ? { disabled: true, busy: true } : {}}
          style={({ pressed }) => [s.acao, emCurso && s.botaoOff, pressed && s.pressed]}
        >
          <Text style={s.acaoTexto}>{emCurso ? 'testando… (a chamada segue na ponte)' : 'Testar Private Cloud Compute'}</Text>
        </Pressable>
      </View>
      {cru !== null ? <Text style={s.cru}>{cru}</Text> : null}
    </View>
  );
}

/** O diagnóstico como a ponte o escreveu — ou o estado, quando não houve linha. */
function diagnosticoCru(p: EstadoDaPonte): string {
  switch (p.tipo) {
    case 'ausente':
      return 'ausente — o módulo OnDeviceEngine não está neste build';
    case 'fora-do-ios':
      return 'fora do iOS — o modelo do sistema só existe no iPhone';
    case 'consultando':
      return 'consultando…';
    case 'lido':
      return p.cru ?? (p.diagnostico.estado === 'ilegivel' ? `ilegível: ${p.diagnostico.detalhe}` : JSON.stringify(p.diagnostico));
  }
}

/** O JSON da ponte em linhas, para caber no telefone; o que não é JSON, como veio. */
function legivel(cru: string): string {
  try {
    return JSON.stringify(JSON.parse(cru), null, 2);
  } catch {
    return cru;
  }
}

/**
 * A trilha das execuções — o anel, que é memória e nunca sai do aparelho.
 *
 * **Alcançável e limpável**, porque ele é o único diagnóstico de uma leitura que caiu
 * no piso em produção: mostrar oito de quarenta eventos sem jeito de ver o resto é
 * ter o diagnóstico e não poder lê-lo, e sem `limpar` uma sessão de bancada enterra
 * sob relatório o evento da leitura que realmente interessa.
 */
function Anel({ s }: { s: Styles }) {
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const [, setGeracao] = useState(0);
  // Lido a cada render, **sem memo**: o anel não é reativo, e quem o atualiza na
  // tela é a própria medição, que re-renderiza a cada motor. Um `useMemo` aqui
  // congelava a lista entre as colunas — o diagnóstico da leitura que acabou de
  // rodar não aparecia. O `setGeracao` existe só para o `limpar` repintar.
  const todos = anel.ler();
  const eventos = mostrarTudo ? todos : todos.slice(0, 8);
  // As notas do hospedeiro (5.9): o que aconteceu fora de uma leitura — hoje, a vez
  // do aparelho solta à força por uma chamada nativa que não voltou.
  const notas = anel.notas();

  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.rotulo}>anel (em memória, não sai do aparelho)</Text>
        <Text style={s.desfecho}>
          {todos.length}/{TETO_DO_ANEL}
        </Text>
      </View>

      {notas.map((n, i) => (
        <Text key={`nota-${n.instante}-${i}`} style={s.problema}>
          {n.instante.slice(11, 19)} · hospedeiro · {n.texto}
        </Text>
      ))}

      {eventos.length === 0 ? (
        <Text style={s.meta}>nenhuma leitura nesta sessão</Text>
      ) : (
        eventos.map((e, i) => (
          <Text key={`${e.instante}-${i}`} style={s.meta}>
            {e.instante.slice(11, 19)} · {e.modo} · {e.causa ?? 'motor'} ·{' '}
            {e.trilha.map((t) => `${t.motor}:${t.desfecho}`).join(' → ') || '—'}
          </Text>
        ))
      )}

      <View style={s.acoesDoAnel}>
        {todos.length > 8 ? (
          <Pressable
            onPress={() => setMostrarTudo((v) => !v)}
            accessibilityRole="button"
            style={({ pressed }) => [s.acao, pressed && s.pressed]}
          >
            <Text style={s.acaoTexto}>{mostrarTudo ? 'mostrar só as 8 últimas' : `ver todas as ${todos.length}`}</Text>
          </Pressable>
        ) : null}
        {todos.length > 0 || notas.length > 0 ? (
          <Pressable
            onPress={() => {
              anel.limpar();
              setMostrarTudo(false);
              setGeracao((g) => g + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Limpar o anel"
            style={({ pressed }) => [s.acao, pressed && s.pressed]}
          >
            <Text style={s.acaoTexto}>limpar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },
    content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 4,
      ...shadows.card,
    },
    botao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: spacing.md,
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    botaoOff: { opacity: 0.6 },
    botaoTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },
    aviso: { marginTop: spacing.sm, fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink3 },

    linhaTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    motor: { fontSize: 13, fontFamily: fonts.monoSemiBold, color: colors.ink },
    desfecho: { fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink2 },
    frase: { fontSize: 15, lineHeight: 21, fontFamily: fonts.serif, color: colors.ink },
    fraseFraca: { fontSize: 14, lineHeight: 20, fontFamily: fonts.serif, color: colors.ink3 },
    motivo: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },
    rotulo: { marginTop: 6, fontSize: 10.5, fontFamily: fonts.sansBold, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
    cru: { fontSize: 12, lineHeight: 17, fontFamily: fonts.mono, color: colors.ink2 },
    meta: { fontSize: 11, lineHeight: 15.5, fontFamily: fonts.mono, color: colors.ink3 },
    problema: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    acoesDoAnel: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    acao: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, backgroundColor: colors.surfaceMute },
    acaoTexto: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  });
