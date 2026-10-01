import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  ALFA_DO_GRUPO,
  APOIO_SEM_LEITURA,
  CADENCIA_DE_REEXECUCAO_NOITES,
  CADEIA_DO_PRE_REGISTRO,
  CICLOS_MINIMOS,
  FAMILIAS_EM_ORDEM,
  FASES_DA_FAMILIA,
  INICIO_DO_ACERVO_LUNAR,
  JANELA_LUNAR_VERSAO,
  MESES_ABREV,
  MODULO_DO_CADERNO,
  MOON_SHADE_ALPHA,
  MOTOR_LUNAR_VERSAO,
  NOITES_MINIMAS_POR_COLUNA,
  NOME_DA_FASE,
  PALAVRA_DO_VEREDITO,
  RAZAO_DO_GRUPO,
  SEM_LEITURA,
  TITULO_DO_GRUPO,
  apoioDoBloco,
  fraseColetivaDe,
  moonShadowPath,
  numeroDoBloco,
  operacionalizacaoLunar,
  ordinalDaExecucao,
  type ExecucaoLunar,
  type FamiliaLunar,
  type FraseColetiva,
  type LinhaDaFamilia,
  type LunarPhaseKind,
  type ResultadoDaFase,
} from '@vitale/shared';
import { useVereditoLunar } from '../../hooks/useVereditoLunar';
import { colors, fonts, moduleColors, radii, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * `/sono/lua` — **a página da lua** (CAP-12, Story 4.4).
 *
 * É a única tela filha da revista: chega-se a ela pela linha no pé do caderno
 * Sono, e o voltar devolve o caderno na posição em que estava, porque o `Stack`
 * mantém a tela do chamador montada.
 *
 * ## O que ela faz, e o que ela nunca faz
 *
 * Ela **lê a última execução gravada e nunca calcula um veredito ao abrir**:
 * `vereditoLunar()` não é chamado aqui. Uma execução é uma decisão do dono, não
 * um render — e abrir a página não move o contador da §7.4, que é a peça
 * anti-gaveta inteira da ADR 0045.
 *
 * E ela **não assina modelo**. Os cadernos assinam porque são texto narrado; a
 * lua imprime veredito calculado sob protocolo, e a procedência dela é a **cadeia
 * de pré-registros** — os dois documentos e as duas correções, com o hash de cada
 * um —, mais a **régua**, a **aritmética** e o contador. O rótulo é `aritmética`,
 * e não `motor`: neste app *motor* é a palavra de motor de IA
 * (`/configuracoes/motores`, ADRs 0047–0049), e `motor v1` num rodapé de
 * procedência leria como assinatura de modelo.
 *
 * ## A ordem, e por que ela é esta
 *
 * ```
 * cabeçalho de sub-página (sangrado, na cor do Sono, SEM ícone)
 * título da sub-página
 * a figura das quatro janelas                       (sem legenda)
 * a frase coletiva: linha da cheia · linha das três (placar + o quê/por quê)
 * a legenda da figura + a medida dos 68%
 * a moldura: cinco campos
 * grupo · bloco ×2 famílias
 * rodapé do método · procedência
 * ```
 *
 * A figura abre porque **é dado, não símbolo**; o primeiro **texto** é a frase
 * coletiva. A legenda e a medida vêm **depois** dela: elas são o texto que engorda
 * com o tipo dinâmico (80 px no padrão, 307 no AX1, 693 no AX3), e a figura, sendo
 * SVG, não engorda. Descendo as duas, o XXXL volta a caber com folga sem redecidir
 * a ordem que o dono aprovou para a figura.
 *
 * ## Dimensão fixa é proibida aqui — altura **e** largura
 *
 * Caixa congelada corta o veredito no tipo dinâmico grande, e quem lê em AX3 é
 * exatamente quem tem baixa visão: uma configuração de acessibilidade anularia em
 * silêncio a garantia da ADR 0045. Por isso **nenhum estilo de texto desta tela
 * tem `lineHeight`** — ele é dp fixo e não acompanha o tipo dinâmico, então a
 * letra cresce dentro de uma linha que não cresce. É o mesmo motivo do
 * `faixaNome` da revista, aplicado à tela inteira porque aqui o que seria cortado
 * é a palavra de veredito. E a coluna de rótulos da moldura dimensiona por
 * conteúdo, com teto, e **empilha** acima do valor a partir de AX1.
 *
 * ## Carregando não é "ainda não rodou"
 *
 * Os dois desenhariam quase a mesma coisa e são afirmações diferentes. O quarto
 * estado — *"A cheia não foi lida"* — é onde a página vive hoje; desenhá-lo
 * enquanto a leitura está em voo faria a página afirmar silêncio antes de saber,
 * em toda abertura. `useVereditoLunar` separa os dois, e `sem-leitura` é um
 * terceiro: *não deu para ler* não é *nunca rodou*.
 */
export default function SonoLuaScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ periodo?: string }>();
  // Cor no render, nunca na folha: `moduleColors` lê os eixos ativos no momento
  // da chamada, e no escopo do módulo isso seria o import — o cabeçalho
  // congelaria na paleta clara. A ponte caderno → módulo é do núcleo, e não um
  // literal aqui: o caderno Sono aponta para `agua` por obediência à gramática
  // de cor do sono, que já é azul em toda tela de sono.
  const sono = moduleColors(MODULO_DO_CADERNO.sono);

  const veredito = useVereditoLunar();
  const pronto = veredito.estado === 'pronto';
  const execucao = pronto ? veredito.execucao : null;
  const frase = useMemo<FraseColetiva | null>(
    () => (pronto ? fraseColetivaDe(execucao?.veredito ?? null) : null),
    [pronto, execucao],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* O cabeçalho de sub-página: sangrado de borda a borda, no `accent` do
          Sono, e **sem ícone** — o ícone é portador de identidade de caderno
          (CAP-7), e esta é sub-página. O `paddingTop` do recorte vai aqui dentro
          para a cor chegar à borda de cima; com ele no container, o topo ficaria
          numa faixa de outra cor. */}
      <View style={[styles.cabecalho, { backgroundColor: sono.accent, paddingTop: insets.top }]}>
        <View style={styles.cabecalhoLinha}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao caderno Sono"
            style={({ pressed }) => [styles.voltar, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={sono.onAccent} />
          </Pressable>
          {/* Para o leitor de tela é o cabeçalho da sub-página, com o nome do
              caderno de origem. Não é tocável fora do botão de voltar. */}
          <Text style={[styles.cabecalhoNome, { color: sono.onAccent }]} accessibilityRole="header">
            Sono
          </Text>
          {params.periodo ? (
            <Text style={[styles.cabecalhoPeriodo, { color: sono.onAccent }]}>{params.periodo}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titulo}>
          <Text style={styles.eyebrow}>Pré-registro · 07 set · 28 set 2026</Text>
          <Text style={styles.tituloTxt} accessibilityRole="header">A página da lua</Text>
        </View>

        <CicloSinodico accent={sono.accent} tint={sono.tint} />

        {frase ? <FraseColetivaNaPagina frase={frase} styles={styles} /> : null}
        {veredito.estado === 'carregando' ? (
          <View style={styles.aviso}>
            <ActivityIndicator size="small" color={colors.ink3} />
            <Text style={styles.avisoTxt}>Lendo as execuções gravadas…</Text>
          </View>
        ) : null}
        {veredito.estado === 'sem-leitura' ? (
          <View style={styles.aviso}>
            {/* **Não é o quarto estado.** "Não deu para ler" e "nunca rodou" são
                afirmações diferentes sobre a pilha de tentativas, e trocar uma
                pela outra é a gaveta aberta por um operador de coalescência. */}
            <Text style={styles.avisoTxt}>
              Não foi possível ler as execuções agora. Isto não diz que nenhuma rodou — diz que esta
              tela não conseguiu ler a tabela.
            </Text>
          </View>
        ) : null}

        {/* A legenda da figura e a medida, **depois** da frase coletiva. Os 68%
            viajam em prosa, aqui e de novo no rodapé do método: quem usa leitor de
            tela os recebe daqui, e o `alt` da figura não os carrega. */}
        <View style={styles.legendaDaFigura}>
          <Text style={styles.apoio}>
            Cada disco é uma noite, com o terminador real. As quatro janelas de cinco noites — as que
            antecedem cada fase — vêm destacadas, e a régua abaixo marca a extensão de cada uma. O
            traço marca o instante da fase, que fica fora da janela.
          </Text>
          <Text style={styles.medida}>
            Trinta noites desenhadas para um ciclo de 29,5: vinte delas caem dentro de uma janela —
            68% do ciclo.
          </Text>
        </View>

        {pronto ? (
          <>
            <MolduraDaLua execucao={execucao} execucoes={veredito.execucoes} styles={styles} />
            {FAMILIAS_EM_ORDEM.map((familia) => (
              <GrupoDaFamilia key={familia} familia={familia} execucao={execucao} styles={styles} />
            ))}
            <RodapeDoMetodo execucao={execucao} styles={styles} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/* ─────────────────────── A figura das quatro janelas ─────────────────────── */

/**
 * Trinta células desenhadas para um ciclo de 29,53 dias.
 *
 * O desenho arredonda para noites inteiras: quem contar discos obtém 20/30 = 67%,
 * e a medida em prosa diz 68% (20 / 29,53 = 67,7%). A legenda reconcilia as duas
 * em uma oração — sem ela o leitor não pode derivar 29,5 do que vê.
 *
 * O valor do ciclo é do **desenho**, e a autoridade sobre a lunação continua sendo
 * `astro/moon.ts`: a figura não classifica noite nenhuma, e nenhuma decisão do
 * teste passa por aqui.
 */
const CELULAS = 30;
const CICLO_DESENHADO_DIAS = 29.53;
/** A lua nova no índice 5,5 — é a âncora em que as quatro janelas caem inteiras no quadro. */
const NOVA_EM = 5.5;
/** A geometria do quadro, em unidades do `viewBox`. */
const FIG_LARGURA = 342;
const FIG_ALTURA = 86;
const PASSO = FIG_LARGURA / CELULAS;
const RAIO = 4.6;
const Y_DISCO = 30;
/** As quatro janelas têm cinco noites, como o protocolo as define. */
const NOITES_DA_JANELA = 5;

/** O centro, em `x`, da posição `p` medida em células. */
function xDe(p: number): number {
  return PASSO * (p + 0.5);
}

/** A posição, em células, do instante de cada fase — a lunação, não a importância. */
const POSICAO_DA_FASE: Readonly<Record<LunarPhaseKind, number>> = {
  new: NOVA_EM,
  firstQuarter: NOVA_EM + CICLO_DESENHADO_DIAS / 4,
  full: NOVA_EM + CICLO_DESENHADO_DIAS / 2,
  lastQuarter: NOVA_EM + (3 * CICLO_DESENHADO_DIAS) / 4,
};

/** O rótulo curto de cada janela, sob a grade. */
const ROTULO_CURTO: Readonly<Record<LunarPhaseKind, string>> = {
  new: 'nova',
  firstQuarter: 'crescente',
  full: 'cheia',
  lastQuarter: 'minguante',
};

const JANELAS = (Object.keys(POSICAO_DA_FASE) as LunarPhaseKind[]).map((fase) => {
  const p = POSICAO_DA_FASE[fase];
  return {
    fase,
    /** O instante da fase, que cai **fora** da janela: a exposição é *antes* dela. */
    x: xDe(p),
    de: xDe(p - NOITES_DA_JANELA),
    largura: NOITES_DA_JANELA * PASSO,
    rotulo: ROTULO_CURTO[fase],
  };
});

/**
 * Uma célula está dentro de alguma janela? **Dez das trinta não estão**, o que bate
 * com as ~9,5 noites por ciclo que ficam fora de todas (§7 de 28/09).
 *
 * A janela é `[fase − 5 d, fase)`, e a conta é sobre o **centro** da célula: a
 * banda vai de `xDe(p − 5)` a `xDe(p)`, e o centro de `i` cai dentro dela quando
 * `p − 5 ≤ i ≤ p`. Nenhuma posição de fase é inteira, então os extremos não
 * empatam — e cada janela marca exatamente cinco discos, que é a propriedade que o
 * desenho tem de preservar: *os discos marcados **são** as noites testadas*.
 */
function dentroDeJanela(i: number): boolean {
  return JANELAS.some((j) => {
    const p = POSICAO_DA_FASE[j.fase];
    return i > p - NOITES_DA_JANELA && i < p;
  });
}

/** As trinta noites, cada uma com a iluminação e o lado em que o terminador cai. */
const DISCOS = Array.from({ length: CELULAS }, (_, i) => {
  const d = i - NOVA_EM;
  const ciclo = ((d % CICLO_DESENHADO_DIAS) + CICLO_DESENHADO_DIAS) % CICLO_DESENHADO_DIAS;
  return {
    x: xDe(i),
    illuminated: (1 - Math.cos((2 * Math.PI * d) / CICLO_DESENHADO_DIAS)) / 2,
    waxing: ciclo < CICLO_DESENHADO_DIAS / 2,
    naJanela: dentroDeJanela(i),
  };
});

/**
 * O ciclo sinódico noite a noite, com as quatro janelas **destacadas igualmente**.
 *
 * Ela **não tem estado**: não destaca uma fase por vez, não acompanha a rolagem e
 * não é tocável. Uma figura com estado vira a coisa que o leitor olha em vez de
 * ler — e o que esta entrega é a **geometria** do protocolo (quatro janelas, 68%
 * do ciclo, e o que sobra fora), não os α, não a contaminação das colunas e não o
 * poder baixo: nenhuma das três é derivável de um desenho, e as três são texto.
 *
 * A sombra tende ao **fundo do tema**, não ao preto — o mesmo `moonShade` e as
 * mesmas opacidades por esquema do `MoonBadge`, e pela mesma razão: no claro ela
 * dissolve na página em vez de virar mancha, e no escuro deixa o crescente
 * sozinho.
 */
function CicloSinodico({ accent, tint }: { accent: string; tint: string }) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const { scheme } = useTheme();
  // A figura é SVG e **não** escala com o tipo dinâmico: é por isso que a legenda
  // e a medida desceram para depois da frase coletiva. A largura segue a tela.
  const largura = Math.max(0, width - 2 * spacing.xl);
  const altura = (largura * FIG_ALTURA) / FIG_LARGURA;

  return (
    <View style={styles.figura}>
      <Text style={styles.eyebrow}>O ciclo sinódico, noite a noite</Text>
      {/* O `alt` é **obrigatório** porque a figura é dado. Os 68% NÃO entram
          nele: eles viajam em prosa, na medida logo abaixo e no rodapé do
          método — quem "consertar" enfiando o número aqui e apagando o
          parágrafo tira o portador do número de quem lê por leitor de tela. */}
      <View accessible accessibilityRole="image" accessibilityLabel={ALT_DA_FIGURA}>
        <Svg width={largura} height={altura} viewBox={`0 0 ${FIG_LARGURA} ${FIG_ALTURA}`}>
          {JANELAS.map((j) => (
            <Rect key={`j-${j.fase}`} x={j.de} y={16} width={j.largura} height={28} rx={3} fill={tint} />
          ))}
          {DISCOS.map((d, i) => (
            <G key={`d-${String(i)}`} x={d.x} y={Y_DISCO}>
              <Circle r={RAIO} fill={accent} />
              <Path
                d={moonShadowPath(RAIO, { illuminated: d.illuminated, waxing: d.waxing })}
                fill={colors.moonShade}
                opacity={MOON_SHADE_ALPHA[scheme]}
              />
              <Circle
                r={RAIO}
                fill="none"
                stroke={d.naJanela ? colors.ink : colors.ink2}
                strokeWidth={d.naJanela ? 1 : 0.7}
              />
            </G>
          ))}
          {JANELAS.map((j) => (
            <G key={`i-${j.fase}`}>
              <Rect x={j.x - 1.75} y={6} width={3.5} height={3.5} fill={colors.ink} />
              <Line x1={j.x} y1={9} x2={j.x} y2={50} stroke={colors.ink} strokeWidth={1} />
              <SvgText
                x={j.x - j.largura / 2}
                y={60}
                textAnchor="middle"
                fontSize={9}
                fontFamily={fonts.mono}
                fill={colors.ink2}
              >
                {j.rotulo}
              </SvgText>
            </G>
          ))}
          <Rect x={0} y={72} width={FIG_LARGURA} height={3.5} rx={1.75} fill={colors.line} />
          {JANELAS.map((j) => (
            <Rect key={`r-${j.fase}`} x={j.de} y={72} width={j.largura} height={3.5} rx={1.75} fill={accent} />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const ALT_DA_FIGURA =
  'Um ciclo sinódico noite a noite, com as quatro janelas de cinco noites destacadas igualmente '
  + 'e o instante de cada fase marcado fora da janela dela.';

/* ─────────────────────────── A frase coletiva ─────────────────────────── */

/**
 * O **primeiro texto** da página: uma linha por família, dois compartimentos cada,
 * e nenhum deles some em tupla nenhuma.
 *
 * As duas linhas **nunca se somam num número**: os denominadores são 1 e 3, e um
 * placar sobre quatro é a forma-sentença de *"eu testei as quatro fases"*, que o
 * §2 do pré-registro de 28/09 proíbe por escrito. O texto sai da regra do núcleo
 * — aqui não há condicional nenhuma sobre veredito.
 */
function FraseColetivaNaPagina({ frase, styles }: { frase: FraseColetiva; styles: Styles }) {
  return (
    <View style={styles.coletiva}>
      <Text style={styles.eyebrow}>As duas famílias</Text>
      {frase.linhas.map((l, i) => (
        <LinhaColetiva key={l.familia} l={l} primeira={i === 0} styles={styles} />
      ))}
    </View>
  );
}

function LinhaColetiva({ l, primeira, styles }: { l: LinhaDaFamilia; primeira: boolean; styles: Styles }) {
  return (
    <View style={[styles.coletivaFam, !primeira && styles.coletivaFamSeguinte]}>
      <Text style={styles.familia}>{l.rotulo}</Text>
      <Text style={styles.placar}>{l.placar}</Text>
      {/* O segundo compartimento é o que carrega o resultado, e é por isso que ele
          nunca desaparece: *decidiu* não quer dizer *achou algo*, e é esta frase
          que desfaz isso na mesma linha. */}
      <Text style={styles.porque}>{l.porque}</Text>
    </View>
  );
}

/* ─────────────────────────── A moldura ─────────────────────────── */

/** Um campo da moldura: rótulo, valor e o sub-valor que o explica. */
interface CampoDaMoldura {
  rotulo: string;
  valor: string;
  sub?: string;
}

/**
 * A moldura é **invariável em campos, não em pixels**: cinco campos, sempre na
 * mesma ordem, nos quatro estados. Não existe variante curta da página para
 * quando não deu nada.
 *
 * Os cinco valem para as quatro fases — nenhum deles muda de fase para fase —, e é
 * por isso que ela é uma só, acima dos blocos, em vez de se repetir quatro vezes.
 *
 * **No quarto estado nenhum número é fabricado.** *Noites e ciclos* não pode
 * imprimir uma contagem que ninguém mediu, então ele imprime o que o protocolo
 * fixa: o começo do acervo e os dois portões que contam. E *Próxima leitura* vira
 * *Primeira leitura* e imprime a **condição**, não uma data: a cadência de +100
 * noites governa a **re**execução, documento nenhum fixa a primeira, e número de
 * story num campo de leitor faria o estado ler como *esperando o build* em vez de
 * *esperando dado*.
 */
function MolduraDaLua({ execucao, execucoes, styles }: {
  execucao: ExecucaoLunar | null;
  execucoes: number;
  styles: Styles;
}) {
  const campos = useMemo(() => camposDaMoldura(execucao, execucoes), [execucao, execucoes]);
  return (
    <View style={styles.moldura}>
      {campos.map((c, i) => (
        <CampoNaMoldura key={c.rotulo} campo={c} primeiro={i === 0} styles={styles} />
      ))}
    </View>
  );
}

function camposDaMoldura(execucao: ExecucaoLunar | null, execucoes: number): CampoDaMoldura[] {
  // A operacionalização da execução quando há uma; a vigente quando não há. Nos
  // dois casos ela é **medida**, nunca declarada — a borda sai da sonda.
  const op = execucao?.operacionalizacao ?? operacionalizacaoLunar();
  const fecha = op.bordaDireita === 'aberta' ? ')' : ']';
  const lido = execucao === null ? null : execucao.veredito;
  const acervo = lido === null ? null : lido.acervo;
  return [
    {
      rotulo: 'Janela testada',
      valor: `${String(op.janelaNoites)} noites antes de cada fase`,
      sub: `[fase − ${String(op.janelaNoites)} d, fase${fecha} · contra as demais noites`,
    },
    {
      rotulo: 'Desfecho',
      valor: 'hora de apagar',
      sub: 'minutos desde a meia-noite',
    },
    lido === null || acervo === null
      ? {
        // **Nenhum número fabricado aqui.** Sem execução não há contagem de
        // noites nem de ciclos, e imprimir uma seria inventar medida; o campo diz
        // o que o protocolo fixa — o começo do acervo e os dois portões que
        // contam —, que é conhecível sem consultar dado nenhum.
        rotulo: 'Noites e ciclos',
        valor: `o acervo desde ${dataCurta(INICIO_DO_ACERVO_LUNAR)}`,
        sub:
            `a execução conta as noites e os ciclos · os portões pedem ${String(NOITES_MINIMAS_POR_COLUNA)} `
            + `noites em cada coluna e ${String(CICLOS_MINIMOS)} ciclos sinódicos`,
      }
      : {
        rotulo: 'Noites e ciclos',
        valor: `${String(acervo.noites)} noites no acervo`,
        sub: `${ciclosPorFase(lido.fases)} · ${dataCurta(acervo.de)} → ${dataCurta(acervo.ate)}`,
      },
    execucao === null
      ? {
        rotulo: 'Primeira leitura',
        valor: 'quando a primeira execução autorizada rodar',
        sub: 'as quatro rodam juntas, ou nenhuma roda',
      }
      : {
        rotulo: 'Próxima leitura',
        valor: `a cada +${String(CADENCIA_DE_REEXECUCAO_NOITES)} noites`,
        sub: 'por cadência pré-fixada, não por vontade',
      },
    { rotulo: 'Execuções', valor: ordinalDaExecucao(execucoes) },
  ];
}

/** `'2025-04-23'` → `23 abr 2025`. Sem `Date`: o fuso do aparelho não entra num rótulo. */
function dataCurta(iso: string | null): string {
  if (iso === null) return '—';
  const [a, m, d] = iso.split('-');
  const mes = MESES_ABREV[Number(m) - 1];
  return mes === undefined ? iso : `${d} ${mes} ${a}`;
}

/**
 * Os ciclos que contribuíram, **por fase** — e o intervalo quando elas discordam.
 *
 * As quatro janelas não pegam o mesmo número de ciclos, então um número só seria
 * uma média disfarçada de contagem. Quando as quatro concordam, o número é um.
 */
function ciclosPorFase(fases: readonly ResultadoDaFase[]): string {
  const todos = fases.map((f) => f.ciclos);
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const n = min === max ? String(min) : `${String(min)} a ${String(max)}`;
  return `${n} ciclos sinódicos por fase`;
}

function CampoNaMoldura({ campo, primeiro, styles }: {
  campo: CampoDaMoldura;
  primeiro: boolean;
  styles: Styles;
}) {
  const { fontScale } = useWindowDimensions();
  // **Largura fixa é proibida, e `max-content` sem teto troca um defeito por
  // outro:** medido, a coluna vai a 281 px no AX3, come a do valor e transborda.
  // O teto é 40% da moldura, e a partir de AX1 o rótulo empilha ACIMA do valor
  // em vez de disputar a linha com ele. XXXL é 1,353 e AX1 é 1,786 — 1,5 separa
  // os dois.
  const empilha = fontScale >= EMPILHA_A_PARTIR_DE;
  return (
    <View style={[styles.campo, empilha && styles.campoEmpilhado, !primeiro && styles.campoSeguinte]}>
      <Text style={[styles.campoRotulo, empilha ? styles.campoRotuloEmpilhado : styles.campoRotuloAoLado]}>
        {campo.rotulo}
      </Text>
      <View style={styles.campoValor}>
        <Text style={styles.valor}>{campo.valor}</Text>
        {campo.sub ? <Text style={styles.subValor}>{campo.sub}</Text> : null}
      </View>
    </View>
  );
}

const EMPILHA_A_PARTIR_DE = 1.5;

/* ─────────────────── Os grupos e os blocos de fase ─────────────────── */

/**
 * Um grupo por família, e o cabeçalho dele carrega **o α e a razão da separação**.
 *
 * O α é propriedade de família, não de fase: agrupando, cada um aparece **uma**
 * vez e a fronteira é a própria disposição. Imprimir os quatro resultados com a
 * mesma tipografia, sem dizer que um vale a 5% e três a 1,67%, *"desfaz no leitor
 * a distinção que a §3 pagou para manter"* (§11 de 28/09).
 *
 * A razão existe para que a posição da cheia não seja lida como **hierarquia**: a
 * precedência dela é de procedência, não de importância. E o grupo é uma região
 * rotulada para o leitor de tela — quem entra num bloco chega nele pelo cabeçalho
 * que diz o α.
 */
function GrupoDaFamilia({ familia, execucao, styles }: {
  familia: FamiliaLunar;
  execucao: ExecucaoLunar | null;
  styles: Styles;
}) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.eyebrow}>Família</Text>
      <Text style={styles.familia} accessibilityRole="header">{TITULO_DO_GRUPO[familia]}</Text>
      <Text style={styles.alfa}>{ALFA_DO_GRUPO[familia]}</Text>
      <Text style={styles.razao}>{RAZAO_DO_GRUPO[familia]}</Text>
      {FASES_DA_FAMILIA[familia].map((fase) => (
        <BlocoDaFase
          key={fase}
          fase={fase}
          resultado={execucao?.veredito.fases.find((f) => f.fase === fase) ?? null}
          styles={styles}
        />
      ))}
    </View>
  );
}

/**
 * Um bloco por fase, **sempre os quatro**, com os mesmos campos nas quatro: nome ·
 * palavra de veredito · o número com a unidade dele · a legenda do número · as
 * linhas de apoio.
 *
 * No quarto estado o bloco existe igual e diz **"sem leitura"** — não travessão,
 * que leria como nulo *medido* —, e *"sem leitura"* ocupa a **vaga da palavra de
 * veredito**, no degrau dela e na tinta dela. Imprimi-lo em corpo menor e em
 * `ink2` são duas das três atenuações que a ADR 0045 §3 proíbe por nome, no estado
 * em que a página passa a maior parte do tempo.
 *
 * Sem caixa: filete acima, e nada mais. Quatro blocos encaixotados na mesma tela
 * leriam como quatro cartões concorrentes, e a página é uma ficha contínua.
 */
function BlocoDaFase({ fase, resultado, styles }: {
  fase: LunarPhaseKind;
  resultado: ResultadoDaFase | null;
  styles: Styles;
}) {
  const numero = resultado === null ? null : numeroDoBloco(resultado);
  const apoio = resultado === null ? [APOIO_SEM_LEITURA] : apoioDoBloco(resultado);
  return (
    <View style={styles.bloco}>
      <Text style={styles.faseNome}>{NOME_DA_FASE[fase]}</Text>
      <Text style={styles.veredito}>
        {resultado === null ? SEM_LEITURA : PALAVRA_DO_VEREDITO[resultado.veredito]}
      </Text>
      {numero ? (
        <>
          <Text style={styles.numero}>{numero.valor}</Text>
          <Text style={styles.legendaDoNumero}>{numero.legenda}</Text>
        </>
      ) : null}
      {apoio.map((l, i) => (
        <Text key={String(i)} style={styles.apoio}>{l}</Text>
      ))}
    </View>
  );
}

/* ─────────────────── O rodapé do método e a procedência ─────────────────── */

/**
 * O rodapé do método, e a **procedência** — que não é assinatura de modelo.
 *
 * A covariável vive aqui: as horas de luz do dia são pré-requisito do teste, não
 * ressalva, e ela **sobe** para o bloco de cada fase e para as duas linhas da
 * frase coletiva quando é o portão da luz que reprova, porque esse portão é global
 * às quatro.
 *
 * A cadeia impressa é a da **execução** quando há uma — é ela que diz sob que
 * autoridade aquele veredito saiu —, e a vigente quando não há. As duas versões
 * carimbadas vêm ao lado: **régua** (qual noite entra em qual coluna) e
 * **aritmética** (Hodges–Lehmann, Mann–Whitney e a conta de poder).
 */
function RodapeDoMetodo({ execucao, styles }: { execucao: ExecucaoLunar | null; styles: Styles }) {
  const cadeia = execucao?.cadeia ?? CADEIA_DO_PRE_REGISTRO;
  const regua = execucao?.janelaVersao ?? JANELA_LUNAR_VERSAO;
  const aritmetica = execucao?.motorVersao ?? MOTOR_LUNAR_VERSAO;
  return (
    <View style={styles.metodo}>
      <Text style={styles.eyebrow}>Método</Text>
      <Text style={styles.metodoTxt}>
        Desfecho, janela, direção e o limiar de 15 minutos foram fixados antes de qualquer consulta
        ao dado: a cheia em 07 set 2026, as outras três em 28 set. Esta página não afirma causa.
      </Text>
      <Text style={styles.metodoTxt}>
        Horas de luz do dia na latitude do sujeito (~50,8° N) são pré-requisito do teste, não
        ressalva: a janela lunar anda pelo calendário, e sem a luz nenhuma fase roda.
      </Text>
      <Text style={styles.metodoTxt}>
        Quatro janelas de cinco noites ocupam 68% do ciclo, e sobram ~9,5 noites fora de todas. Cada
        fase é comparada contra todas as outras noites, então a coluna de controle contém as janelas
        das outras três: o viés é para o nulo.
      </Text>
      <Text style={styles.metodoTxt}>
        As quatro rodam juntas, ou nenhuma roda. Não existe “eu testei as quatro fases”: são dois
        testes de proveniência diferente.
      </Text>
      <View style={styles.procedencia}>
        <Text style={styles.eyebrow}>Procedência</Text>
        {cadeia.map((e) => (
          <Text key={e.arquivo} style={styles.procedenciaLinha}>
            {nomeDoArquivo(e.arquivo)} · {e.sha256.slice(0, DIGITOS_DO_SHA)}
          </Text>
        ))}
        <Text style={styles.procedenciaLinha}>
          régua v{String(regua)} · aritmética v{String(aritmetica)}
        </Text>
      </View>
    </View>
  );
}

/** Quantos hexadecimais do sha256 o rodapé imprime — o bastante para comparar duas execuções. */
const DIGITOS_DO_SHA = 8;

/** Só o nome do arquivo: o caminho inteiro não cabe, e o nome é o que identifica o elo. */
function nomeDoArquivo(caminho: string): string {
  const partes = caminho.split('/');
  return partes[partes.length - 1] ?? caminho;
}

/* ─────────────────────────── A folha ─────────────────────────── */

/**
 * **Nenhum estilo de texto daqui tem `lineHeight`**, e isso é regra desta tela.
 *
 * `lineHeight` é dp fixo e não acompanha o tipo dinâmico: a letra cresce dentro de
 * uma linha que não cresce, e o que seria cortado aqui é a **palavra de veredito**
 * — exatamente o que a ADR 0045 existe para proteger, e exatamente para quem tem
 * baixa visão. Sem a propriedade, o RN usa a métrica da fonte, que escala junto. É
 * o mesmo motivo do `faixaNome` da revista, aplicado à tela inteira.
 *
 * Os corpos são a rampa do `DESIGN.md` §A rampa da página da lua.
 */
const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.7 },

    // Sangra de borda a borda, sem raio: um canto arredondado sangrando é
    // contradição. `minHeight` e nunca `height` — o nome cresce com o tipo.
    cabecalho: { paddingHorizontal: spacing.xl },
    cabecalhoLinha: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      minHeight: 52, paddingVertical: spacing.sm,
    },
    voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    cabecalhoNome: { flex: 1, fontSize: 17, fontFamily: fonts.sansBold, letterSpacing: 0.2 },
    // O período em mono: é carimbo de medida, do mesmo tipo da assinatura.
    cabecalhoPeriodo: { fontSize: 11, fontFamily: fonts.mono, opacity: 0.78 },

    titulo: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    tituloTxt: { fontSize: 26, fontFamily: fonts.serif, color: colors.ink, marginTop: 5 },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansSemiBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2,
    },

    figura: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
    legendaDaFigura: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: 7 },
    medida: { fontSize: 11, fontFamily: fonts.mono, color: colors.ink },

    aviso: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg,
    },

    /**
     * A frase coletiva: filete de 2 px em `ink` abre o conjunto, 1 px em `line`
     * divide os dois compartimentos de cada linha e as duas linhas entre si.
     */
    coletiva: {
      marginHorizontal: spacing.xl, marginTop: spacing.xl,
      borderTopWidth: 2, borderTopColor: colors.ink,
      borderBottomWidth: 1, borderBottomColor: colors.line,
      paddingTop: spacing.md, paddingBottom: spacing.lg,
    },
    coletivaFam: { marginTop: 7 },
    coletivaFamSeguinte: {
      marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line,
    },
    familia: { fontSize: 14, fontFamily: fonts.sansBold, color: colors.ink },
    // 24 e 17: o degrau que faz os dois compartimentos lerem como um PAR, e não
    // como manchete e legenda — o segundo é o que carrega o resultado.
    placar: { fontSize: 24, fontFamily: fonts.serif, color: colors.ink, marginTop: 5 },
    porque: {
      fontSize: 17, fontFamily: fonts.serif, color: colors.ink,
      marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line,
    },

    // A moldura é uma ficha técnica: contorno, nunca sombra.
    moldura: {
      marginHorizontal: spacing.xl, marginTop: spacing.xl,
      borderWidth: 1, borderColor: colors.line, borderRadius: radii.md,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    campo: { flexDirection: 'row', alignItems: 'flex-start' },
    campoEmpilhado: { flexDirection: 'column' },
    campoSeguinte: { borderTopWidth: 1, borderTopColor: colors.line },
    campoRotulo: {
      fontSize: 10.5, fontFamily: fonts.sansSemiBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2,
      paddingTop: 11, paddingBottom: 11, paddingLeft: 14, paddingRight: 12,
    },
    // Ao lado: a coluna dimensiona por conteúdo, com TETO de 40% da moldura.
    campoRotuloAoLado: { flexShrink: 0, maxWidth: '40%' },
    // Empilhado: o rótulo ocupa a linha dele e o valor começa abaixo, sem disputa.
    campoRotuloEmpilhado: { paddingBottom: 2 },
    campoValor: { flex: 1, paddingTop: 11, paddingBottom: 11, paddingRight: 14 },
    valor: { fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink },
    subValor: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink2, marginTop: 2 },

    // Filete de 2 px em `ink` abre cada família; 1 px em `line` abre cada bloco.
    // Nunca caixa: quatro blocos encaixotados leriam como cartões concorrentes.
    grupo: {
      marginHorizontal: spacing.xl, marginTop: spacing['2xl'],
      borderTopWidth: 2, borderTopColor: colors.ink, paddingTop: spacing.md,
    },
    alfa: { fontSize: 12, fontFamily: fonts.mono, color: colors.ink, marginTop: 4 },
    razao: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2, marginTop: 6 },
    bloco: {
      marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md,
    },
    faseNome: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    // 21 serifada em `ink` — a vaga do veredito, e é ela que "sem leitura" ocupa.
    veredito: { fontSize: 21, fontFamily: fonts.serif, color: colors.ink, marginTop: 7 },
    // O número no MESMO degrau do veredito: é a ADR 0045 em tipografia.
    numero: { fontSize: 21, fontFamily: fonts.mono, letterSpacing: -0.3, color: colors.ink, marginTop: 6 },
    legendaDoNumero: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink2, marginTop: 3 },
    // As linhas de apoio: informação obrigatória, então `ink2` e nunca `ink3`.
    // **Sem `flex`**: numa coluna, `flex: 1` faria as linhas dividirem a altura
    // entre si em vez de crescerem com o texto.
    apoio: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2, marginTop: 7 },
    // O mesmo corpo, numa linha: aí o `flex` é o que faz a frase quebrar ao lado
    // do indicador em vez de empurrá-lo para fora.
    avisoTxt: { flex: 1, fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },

    metodo: {
      marginHorizontal: spacing.xl, marginTop: spacing['2xl'],
      borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md,
    },
    metodoTxt: { fontSize: 13, fontFamily: fonts.serif, color: colors.ink2, marginTop: 7 },
    procedencia: { marginTop: spacing.lg },
    procedenciaLinha: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink2, marginTop: 3 },
  });
