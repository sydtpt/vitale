/**
 * A leitura da Saúde do sono em uma frase — a entrada, o template e o descritor
 * (CAP-13, story 5.3; AD-2, AD-6, AD-7, AD-11).
 *
 * ## A entrada é uma só
 *
 * {@link entradaDaSaude} é a função pura que a tela e a bancada chamam (AD-11):
 * as mesmas noites, as mesmas notas e o mesmo `{ range, offset, hoje }` dão a
 * mesma entrada, e portanto o mesmo pedido, pelo mesmo hash. Fora de `ultima`
 * ela é a fórmula que `/sono/saude` já roda (filtro da janela, noites esperadas,
 * histórico antes da janela, `periodScore`); em `ultima` é a noite, pela
 * `nightScore` do cartão da aba — quatro dimensões, sem regularidade.
 *
 * `hoje` é um **dia local** (`AAAA-MM-DD`), não um instante: o mesmo instante é
 * dia 10 em Bruxelas e dia 9 em São Paulo, e a janela mudaria com o fuso de quem
 * roda — a bancada no Mac e a tela no iPhone leriam semanas diferentes. **Nada
 * depois de `hoje` entra** — nem noite, nem nota: a bancada relê dias passados
 * contra o arquivo inteiro, e "hoje 01/09" não pode ler a noite de 10/09. A
 * entrada carrega `hoje` porque é contra ele que a data da janela leva o ano.
 *
 * As notas entram **recortadas à janela**: a entrada só depende das notas de
 * dentro dela, e é essa janela, explícita no resultado, que um hospedeiro tem de
 * ter carregado. A tela carrega 90 dias de nota; a bancada, tudo — sem o recorte,
 * os dois leriam períodos antigos diferentes sem nenhum erro.
 *
 * A entrada **não guarda o caso**: ele sai do `score`, por `casoDaSaude`, em cada
 * função do descritor. Um caso guardado ao lado da contagem é um caso que pode
 * discordar dela.
 *
 * ## O motor escreve palavras; o código escreve números
 *
 * O regime é o interpolado (ADR 0049): o pedido leva o caso em palavras, o
 * alcance, as dimensões a nomear e os marcadores do caso — **nunca os pontos**,
 * nem os fatos. O motor devolve uma frase sem número, com os marcadores; a
 * conferência de `ia/interpolar.ts` a julga contra a regra do caso; e só então
 * cada marcador vira o fato já formatado em pt-BR.
 *
 * O conjunto de cada caso: `{janela}` e `{quando}` sempre — o nome da janela, e o
 * mesmo nome com "em" contraído; `{medidas}` fora de `sem-contagem`, logo antes
 * de "dimensão" (uma) ou "dimensões" (mais); `{cobertura}` na falta de cobertura;
 * e o marcador de fato de uma dimensão **só em `uma`** — onde há uma dimensão só,
 * o fato de uma não tem como aparecer ao lado do nome de outra. A dimensão, o
 * motor a nomeia **pelo nome**: o fato ("± 22 min") não diz de que dimensão é.
 *
 * A regra de cada caso diz também o que a frase não pode afirmar — "mais alta" em
 * `uma`, "abaixo" em `tudo-no-maximo` —: o motor que contradiz o caso é
 * reprovado, e a leitura cai no template.
 *
 * ## O template é o piso
 *
 * Uma frase para cada caso, escrita com os mesmos marcadores e passada pelo
 * mesmo `interpolar`. É o que a tela mostra sem modelo e o texto contra o qual
 * cada motor vai ser julgado na bancada (story 5.4). A cadeia padrão é só
 * `sem-modelo` até a bancada aprovar um motor.
 *
 * Nenhuma frase soma dimensões, dá nota, aconselha, elogia ou diz "melhorou": as
 * seis regras da ADR 0036 valem inteiras, e a conferência compõe os seis
 * subconjuntos de `VOCABULARIO_PROIBIDO`.
 */
import type { SleepPeriod } from '../models';
import { localDateStr } from '../date/local';
import { formatarNumero, porExtenso } from '../format/numero';
import { SEM_MODELO } from '../ia/fio';
import {
  conferirInterpolado,
  interpolar,
  limparResposta,
  marcador,
  type Exigencia,
  type ItemInterpolado,
  type RegraInterpolada,
} from '../ia/interpolar';
import type { Descritor } from '../ia/orquestrar';
import type { SubconjuntoProibido } from '../ia/verificar';
import { casoDaSaude, type CasoDaSaude, type MotivoSemContagem } from './caso';
import { filterByRange, rangeBounds, rangeNights, type SonoRange } from './ranges';
import {
  DIMENSION_LABEL,
  nightScore,
  periodScore,
  type SleepCoverage,
  type SleepDimensionKey,
  type SleepScore,
} from './score';

/* ── a entrada ───────────────────────────────────────────────────────────── */

/** Uma noite (`ultima`) ou um período (os outros alcances do seletor). */
export type AlcanceDaSaude = 'noite' | 'periodo';

/**
 * Os dias de acordar que a entrada leu — das noites e das notas.
 *
 * Numa noite, é o dia dela (os dois `null` quando não há noite). Num período, é
 * a janela de `rangeBounds`, com a janela corrente aberta: `until` nulo é a de
 * `offset` 0, que vai até hoje para caber a noite que o sync ainda vai trazer.
 */
export interface JanelaDaSaude {
  readonly since: string | null;
  readonly until: string | null;
}

/** O que a tela e a bancada leem — e o que o descritor recebe como fatos. O caso sai do `score`. */
export interface EntradaDaSaude {
  readonly alcance: AlcanceDaSaude;
  readonly range: SonoRange;
  /** O dia local da leitura. Nada depois dele entrou, e a data da janela leva o ano quando o dela é outro. */
  readonly hoje: string;
  readonly janela: JanelaDaSaude;
  readonly score: SleepScore;
}

export interface OpcoesDaEntrada {
  readonly range: SonoRange;
  /** Quantos passos do próprio tamanho para trás — o ◀ da tela. Inteiro ≥ 0; outra coisa lança. */
  readonly offset: number;
  /** Hoje, como dia local `AAAA-MM-DD`: a entrada nunca lê o relógio, nem o fuso de quem roda. */
  readonly hoje: string;
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * O meio-dia local do dia — a `Date` que `ranges.ts` espera. Só o calendário
 * dela importa (`rangeBounds` anda por `setDate`, `rangeNights` normaliza a hora),
 * então o mesmo dia dá a mesma janela em qualquer fuso. Dia inválido é defeito
 * de quem chamou, e lança.
 */
function meioDiaDe(hoje: string): Date {
  const m = DIA.exec(hoje);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (localDateStr(d) === hoje) return d;
  }
  throw new RangeError(`hoje tem de ser um dia AAAA-MM-DD, e veio ${JSON.stringify(hoje)}`);
}

/** As quatro dimensões de uma noite, na ordem de `nightScore`. */
const DIMENSOES_DA_NOITE: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'percepcao'];

/**
 * A noite que não existe: as quatro dimensões ausentes, sem contagem, e a
 * cobertura de uma noite esperada e nenhuma gravada. É o molde de `periodScore`
 * para o período vazio, no alcance de uma noite — e é a cobertura zerada que faz
 * o caso dizer `sem-noite`, não `sem-medida`.
 */
function semNoite(): SleepScore {
  return {
    dimensions: DIMENSOES_DA_NOITE.map((key) => ({
      key,
      label: DIMENSION_LABEL[key],
      points: null,
      fact: '—',
      absent: 'sem noite gravada',
    })),
    points: 0,
    max: 0,
    coverage: { nights: 0, expected: 1, ratio: 0 },
    scored: false,
  };
}

/** As notas cujo dia cai na janela. `null` numa ponta é a ponta aberta. */
function notasNaJanela(
  notas: Readonly<Record<string, number>>,
  since: string | null,
  until: string | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [dia, nota] of Object.entries(notas)) {
    if ((since === null || dia >= since) && (until === null || dia <= until)) out[dia] = nota;
  }
  return out;
}

/**
 * A entrada da leitura — pura, sem relógio, e a única da tela e da bancada.
 *
 * `notas` mapeia dia de acordar para a nota 1–5, como a store do sono a guarda.
 */
export function entradaDaSaude(
  noites: readonly SleepPeriod[],
  notas: Readonly<Record<string, number>>,
  { range, offset, hoje }: OpcoesDaEntrada,
): EntradaDaSaude {
  const dia = meioDiaDe(hoje);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError(`offset tem de ser um inteiro ≥ 0, e veio ${String(offset)}`);
  }
  // Nada depois de hoje: nem a noite que acorda depois dele, nem a nota.
  const ateHoje = noites.filter((p) => p.wakeDay <= hoje);
  const notasAteHoje = notasNaJanela(notas, null, hoje);

  if (range === 'ultima') {
    const [noite] = filterByRange(ateHoje, 'ultima', dia, offset);
    if (!noite) return { alcance: 'noite', range, hoje, janela: { since: null, until: null }, score: semNoite() };
    const nota = notasNaJanela(notasAteHoje, noite.wakeDay, noite.wakeDay)[noite.wakeDay] ?? null;
    // O histórico inteiro até hoje, como no cartão da aba: a linha de base corta
    // sozinha o que vem antes da noite.
    const score = nightScore(noite, ateHoje, nota);
    return { alcance: 'noite', range, hoje, janela: { since: noite.wakeDay, until: noite.wakeDay }, score };
  }

  // A fórmula de `/sono/saude`, sem tirar nem pôr — a 5.5 troca a da tela por esta.
  const { since, until } = rangeBounds(range, dia, offset);
  const doPeriodo = filterByRange(ateHoje, range, dia, offset);
  const esperadas = rangeNights(range, dia, offset);
  // A base olha para antes do período: se ele se comparasse consigo mesmo, a
  // continuidade seria sempre a própria mediana.
  const historico = since === null ? ateHoje : ateHoje.filter((p) => p.wakeDay < since);
  // O ano corrente também é janela aberta: `rangeBounds` o fecha em 31/12 porque,
  // para filtrar, tanto faz — mas é ele que se chama "este ano", não "o ano de…".
  // As notas saem da mesma janela que a entrada diz ter lido, até hoje.
  const aberta = offset === 0 ? null : until;
  const score = periodScore(doPeriodo, esperadas, notasNaJanela(notasAteHoje, since, aberta), historico);
  return { alcance: 'periodo', range, hoje, janela: { since, until: aberta }, score };
}

/* ── os nomes ────────────────────────────────────────────────────────────── */

/** O artigo de cada dimensão na prosa. */
const ARTIGO: Readonly<Record<SleepDimensionKey, 'a' | 'o'>> = {
  duracao: 'a',
  continuidade: 'a',
  horario: 'o',
  regularidade: 'a',
  percepcao: 'a',
};

/** O nome da dimensão na prosa: "duração", "horário". */
function nome(k: SleepDimensionKey): string {
  return DIMENSION_LABEL[k].toLowerCase();
}

function comArtigo(k: SleepDimensionKey): string {
  return `${ARTIGO[k]} ${nome(k)}`;
}

/** "a duração", "a duração e a regularidade", "a duração, o horário e a percepção". */
function lista(ks: readonly SleepDimensionKey[]): string {
  const partes = ks.map(comArtigo);
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const anoDe = (dia: string): string => dia.slice(0, 4);

/** "28/08"; com o ano, "28/08/2025". */
function data(dia: string, comAno: boolean): string {
  const dm = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return comAno ? `${dm}/${anoDe(dia)}` : dm;
}

/** O nome da janela — o valor de `{janela}` — e o mesmo nome com "em" contraído — o de `{quando}`. */
interface NomesDaJanela {
  readonly janela: string;
  readonly quando: string;
}

/**
 * A janela de trás de um período contado em dias, semanas ou meses: "os 7 dias
 * de 28/08 a 03/09". As datas levam o ano quando a janela atravessa um, ou quando
 * o ano dela não é o de hoje — "os 12 meses de 11/09/2024 a 10/09/2025".
 */
function deTras(artigo: 'os' | 'as', contraido: 'nos' | 'nas', tamanho: string, since: string, until: string, hoje: string): NomesDaJanela {
  const comAno = anoDe(since) !== anoDe(hoje) || anoDe(until) !== anoDe(hoje);
  const resto = `${tamanho} de ${data(since, comAno)} a ${data(until, comAno)}`;
  return { janela: `${artigo} ${resto}`, quando: `${contraido} ${resto}` };
}

/**
 * Os nomes da janela lida. Sempre nome com artigo ou demonstrativo, e o gênero e
 * o número dependem **só do `range`** — é o que o pedido pode dizer ao motor sem
 * saber o passo:
 *
 *   ultima  a noite de 10/09 · a última noite (sem noite)      feminino singular
 *   7d      os últimos 7 dias · os 7 dias de 28/08 a 03/09      masculino plural
 *   4s      as últimas 4 semanas · as 4 semanas de 07/08 a 03/09 feminino plural
 *   12m     os últimos 12 meses · os 12 meses de …               masculino plural
 *   ano     este ano · o ano de 2025                            masculino singular
 */
function nomesDaJanela({ range, hoje, janela: { since, until } }: EntradaDaSaude): NomesDaJanela {
  switch (range) {
    case 'ultima': {
      if (since === null) return { janela: 'a última noite', quando: 'na última noite' };
      const dia = data(since, anoDe(since) !== anoDe(hoje));
      return { janela: `a noite de ${dia}`, quando: `na noite de ${dia}` };
    }
    case '7d':
      return since === null || until === null
        ? { janela: 'os últimos 7 dias', quando: 'nos últimos 7 dias' }
        : deTras('os', 'nos', '7 dias', since, until, hoje);
    case '4s':
      return since === null || until === null
        ? { janela: 'as últimas 4 semanas', quando: 'nas últimas 4 semanas' }
        : deTras('as', 'nas', '4 semanas', since, until, hoje);
    case '12m':
      return since === null || until === null
        ? { janela: 'os últimos 12 meses', quando: 'nos últimos 12 meses' }
        : deTras('os', 'nos', '12 meses', since, until, hoje);
    case 'ano':
      return since === null || until === null
        ? { janela: 'este ano', quando: 'neste ano' }
        : { janela: `o ano de ${anoDe(since)}`, quando: `no ano de ${anoDe(since)}` };
  }
}

/**
 * A cobertura como porcentagem, pelo piso, em aritmética inteira — e 1% quando há
 * noite. Arredondar escreveria "70%" abaixo do piso de 70% ("poucas para contar"
 * de um período que parece estar no piso), e "0%" de um ano com uma noite
 * gravada; a razão em ponto flutuante escreveria "28%" para 29 de 100.
 *
 * Cobertura incoerente lança: sem noites esperadas, ou com a razão discordando da
 * divisão, a conta daria `NaN%` — e um "NaN%" na tela é pior que um erro.
 */
function porcentagem({ nights, expected, ratio }: SleepCoverage): string {
  if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(nights) || nights < 0) {
    throw new RangeError(`cobertura sem noites esperadas: ${JSON.stringify({ nights, expected, ratio })}`);
  }
  if (!Number.isFinite(ratio) || Math.abs(Math.min(1, nights / expected) - ratio) > 1e-9) {
    throw new RangeError(`cobertura incoerente: ${JSON.stringify({ nights, expected, ratio })}`);
  }
  const cem = nights * 100;
  return `${formatarNumero(Math.max(1, (cem - (cem % expected)) / expected), 0)}%`;
}

/** O fato cru de uma dimensão, como o `SleepScore` o formatou. */
function fatoDe(score: SleepScore, k: SleepDimensionKey): string {
  const d = score.dimensions.find((x) => x.key === k);
  if (!d || d.points === null) throw new RangeError(`a dimensão ${k} não está medida nesta contagem`);
  return d.fact;
}

/* ── o que cada caso deixa dizer ─────────────────────────────────────────── */

/** Os marcadores que a Saúde conhece. O `switch` sobre eles é exaustivo. */
type MarcadorDaSaude = 'janela' | 'quando' | 'medidas' | 'cobertura' | SleepDimensionKey;

/**
 * Os marcadores do caso, com o valor de cada um, na ordem do pedido — o conjunto
 * que o motor pode usar e o que `interpolar` troca. Todo valor sai em pt-BR,
 * pelo formatador do núcleo ou já formatado no `fact` da dimensão.
 */
function marcadoresDe(e: EntradaDaSaude, caso: CasoDaSaude): readonly (readonly [MarcadorDaSaude, string])[] {
  const { janela, quando } = nomesDaJanela(e);
  const comuns = [['janela', janela], ['quando', quando]] as const;
  switch (caso.caso) {
    case 'sem-contagem': {
      if (caso.motivo !== 'cobertura') return comuns;
      // A noite não tem cobertura (o `nightScore` passa `null`), então não há como
      // ela chegar aqui: se chegasse, a frase chamaria uma noite de "período". E sem
      // cobertura não há valor para `{cobertura}`, que o template exige — o piso
      // morreria com marcador sem valor.
      if (e.alcance === 'noite' || e.score.coverage === null) {
        throw new RangeError(`sem-contagem por cobertura sem cobertura de período: alcance ${e.alcance}`);
      }
      return [...comuns, ['cobertura', porcentagem(e.score.coverage)]];
    }
    case 'uma': {
      const [k] = caso.nomear;
      return [...comuns, ['medidas', porExtenso(caso.medidas, 'feminino')], [k, fatoDe(e.score, k)]];
    }
    case 'medidas-insuficientes':
    case 'tudo-no-maximo':
    case 'todas-iguais':
    case 'duas':
    case 'fora-do-empate':
      return [...comuns, ['medidas', porExtenso(caso.medidas, 'feminino')]];
  }
}

function valoresDe(e: EntradaDaSaude, caso: CasoDaSaude): Record<string, string> {
  return Object.fromEntries(marcadoresDe(e, caso));
}

/**
 * As dimensões que a frase **pode** nomear. Nos casos que nomeiam, só as
 * nomeadas; nos que falam das medidas como um todo, qualquer medida; sem
 * contagem, nenhuma.
 */
function citaveis(caso: CasoDaSaude): readonly SleepDimensionKey[] {
  switch (caso.caso) {
    case 'uma':
    case 'duas':
    case 'fora-do-empate':
      return caso.nomear;
    case 'medidas-insuficientes':
    case 'tudo-no-maximo':
    case 'todas-iguais':
      return caso.dimensoes;
    case 'sem-contagem':
      return [];
  }
}

/** A palavra do alcance — o que a frase sem contagem nem cobertura tem de dizer. */
function palavraDoAlcance(alcance: AlcanceDaSaude): string {
  return alcance === 'noite' ? 'noite' : 'período';
}

/**
 * O que a frase tem de trazer — e cuja falta é recusa. Todo caso exige algo: é o
 * que fecha a recusa em texto livre, que não tem nome de dimensão, marcador nem
 * a palavra do alcance. A dimensão, pelo nome — o marcador dela não conta.
 */
function exigidos(e: EntradaDaSaude, caso: CasoDaSaude): readonly Exigencia[] {
  switch (caso.caso) {
    case 'uma':
    case 'duas':
    case 'fora-do-empate':
      return caso.nomear.map((item) => ({ item }));
    case 'medidas-insuficientes':
    case 'tudo-no-maximo':
    case 'todas-iguais':
      return [{ marcador: 'medidas' }];
    case 'sem-contagem':
      return caso.motivo === 'cobertura' ? [{ marcador: 'cobertura' }] : [{ palavra: palavraDoAlcance(e.alcance) }];
  }
}

/**
 * As formas que nomeiam cada dimensão na prosa, além do rótulo: o plural, e o
 * adjetivo que diz a regularidade pelo avesso. Valem para a presença e para a
 * dimensão a mais.
 */
const OUTRAS_FORMAS: Readonly<Record<SleepDimensionKey, readonly string[]>> = {
  duracao: ['durações'],
  continuidade: ['continuidades'],
  horario: ['horários'],
  regularidade: ['regularidades', 'irregular', 'irregulares'],
  percepcao: ['percepções'],
};

/** Todo item que a frase poderia nomear: as cinco dimensões, sempre — é contra elas que se acha a dimensão a mais. */
const ITENS: readonly ItemInterpolado[] = (Object.keys(DIMENSION_LABEL) as SleepDimensionKey[]).map((k) => ({
  chave: k,
  rotulo: nome(k),
  formas: [nome(k), ...OUTRAS_FORMAS[k]],
}));

/**
 * O que a Saúde compõe de `VOCABULARIO_PROIBIDO`: os seis. Um mapa, e não uma
 * lista, para que um subconjunto novo não compile até alguém decidir se ele
 * vale aqui.
 */
const COMPOE: Readonly<Record<SubconjuntoProibido, boolean>> = {
  causa: true,
  conselho: true,
  elogio: true,
  placar: true,
  'tendencia-e-meta': true,
  comparacao: true,
};

const VOCABULARIO = (Object.keys(COMPOE) as SubconjuntoProibido[]).filter((s) => COMPOE[s]);

/**
 * As palavras depois das quais `{janela}` e `{quando}` não valem.
 *
 * - As cinco preposições que contraem com o artigo ("em os últimos 7 dias" é
 *   "nos").
 * - O que já traz artigo ou demonstrativo — as contrações delas, os artigos,
 *   "este", "neste", "deste" —, que dobraria o do valor ("nos os últimos").
 * - O radical das locuções de causa que terminam na preposição que o valor não
 *   traz ("devido a", "graças a", "em função de", "em razão de", "por conta
 *   de"): "devido {janela}" vira "devido os últimos 7 dias", que não forma o
 *   termo — e a causa passaria calada pelo vocabulário. Pelo mesmo motivo entram
 *   os verbos cuja causa só existe com a preposição ("levou a", "resultou em"):
 *   "o que resultou {janela}" afirma causa e não forma termo nenhum. "Provocou" e
 *   "causou" ficam de fora desta lista de propósito: são termos de uma palavra do
 *   `VOCABULARIO_PROIBIDO`, já pegos no texto do motor — e repeti-los aqui é
 *   justamente a segunda lista que a barreira do vocabulário proíbe (AD-6).
 */
const NAO_DEPOIS_DA_JANELA: readonly string[] = [
  'em', 'de', 'a', 'à', 'por',
  'o', 'os', 'as', 'um', 'uns', 'uma', 'umas',
  'no', 'na', 'nos', 'nas', 'num', 'numa', 'do', 'da', 'dos', 'das', 'dum', 'duma', 'ao', 'aos', 'às',
  'pelo', 'pela', 'pelos', 'pelas',
  'este', 'esta', 'estes', 'estas', 'neste', 'nesta', 'nestes', 'nestas', 'deste', 'desta', 'destes', 'destas',
  'devido', 'graças', 'função', 'razão', 'conta', 'levou', 'resultou',
];

/**
 * A janela dita de outro jeito: na prosa, estas palavras (e o plural) nomeiam o
 * tempo que só `{janela}` e `{quando}` nomeiam — "nesta semana" numa janela de 12
 * meses. "Noite" e "período" ficam de fora: são as palavras do alcance.
 */
const A_JANELA_DE_OUTRO_JEITO: readonly string[] = [
  'hoje', 'ontem', 'anteontem', 'amanhã', 'dia', 'semana', 'quinzena', 'mês', 'meses', 'ano',
];

/** O que afirma posição relativa entre dimensões. */
const MAIS_ALTA_OU_BAIXA: readonly string[] = [
  'mais alta', 'mais altas', 'mais alto', 'mais altos', 'mais baixa', 'mais baixas', 'mais baixo', 'mais baixos',
];

/** O que afirma empate. */
const EMPATE: readonly string[] = ['empata', 'empatam', 'empate', 'empatada', 'empatado', 'mesmo ponto', 'iguais'];

/** O que contradiz `tudo-no-maximo`: nada fica acima nem abaixo de nada. */
const CONTRADIZ_TUDO_NO_MAXIMO: readonly string[] = [
  ...MAIS_ALTA_OU_BAIXA, 'acima', 'abaixo', 'mínimo', 'a pior', 'o pior', 'a melhor', 'o melhor',
];

/**
 * As expressões que afirmam outro caso, ou um nível que o pedido não deu. Em
 * `uma` o motor sabe que uma dimensão está abaixo das outras — não se as outras
 * empatam nem se chegam ao máximo; "mais alta" só no singular, porque "as outras
 * são mais altas" é verdade.
 */
function contradizDe(caso: CasoDaSaude): readonly string[] {
  switch (caso.caso) {
    case 'uma':
      return ['máximo', 'mínimo', ...EMPATE, 'mais alta', 'mais alto', 'a melhor', 'o melhor', 'está acima', 'fica acima'];
    case 'duas':
      return [
        'máximo', 'mínimo', 'mais alta', 'mais alto', 'a mais baixa', 'o mais baixo', 'a melhor', 'o melhor',
        'a pior', 'o pior', 'está acima', 'fica acima',
      ];
    case 'fora-do-empate':
      return ['mínimo', 'a mais baixa', 'o mais baixo', 'a pior', 'o pior', ...(caso.noMaximo ? [] : ['máximo'])];
    case 'tudo-no-maximo':
      return CONTRADIZ_TUDO_NO_MAXIMO;
    case 'todas-iguais':
      return [...CONTRADIZ_TUDO_NO_MAXIMO, 'máximo'];
    case 'medidas-insuficientes':
    case 'sem-contagem':
      return [...CONTRADIZ_TUDO_NO_MAXIMO, 'máximo', ...EMPATE];
  }
}

function regraDe(e: EntradaDaSaude, caso: CasoDaSaude): RegraInterpolada {
  const valores = valoresDe(e, caso);
  return {
    valores,
    // `{medidas}` é a contagem por extenso: "uma" antes de "dimensão", o resto antes de "dimensões".
    antesDe: { medidas: [caso.medidas === 1 ? 'dimensão' : 'dimensões'] },
    naoDepoisDe: { janela: NAO_DEPOIS_DA_JANELA, quando: NAO_DEPOIS_DA_JANELA },
    soPeloMarcador: { janela: A_JANELA_DE_OUTRO_JEITO },
    itens: ITENS,
    citaveis: citaveis(caso),
    exigidos: exigidos(e, caso),
    contradiz: contradizDe(caso),
    vocabulario: VOCABULARIO,
    // O empate de duas é a contagem que o próprio caso diz — e só em "duas dimensões".
    numerais: caso.caso === 'duas' ? { [porExtenso(2, 'feminino')]: ['dimensões'] } : {},
  };
}

/* ── o template ──────────────────────────────────────────────────────────── */

function semContagem(motivo: MotivoSemContagem, alcance: AlcanceDaSaude): string {
  switch (motivo) {
    case 'cobertura':
      return `Este período tem ${marcador('cobertura')} das noites gravadas — poucas para contar.`;
    case 'sem-noite':
      return alcance === 'noite' ? 'Não há noite gravada.' : 'Este período não tem noite gravada.';
    case 'sem-medida':
      return alcance === 'noite' ? 'Esta noite não tem medida para contar.' : 'Este período não tem medida para contar.';
  }
}

function templateDe({ alcance }: EntradaDaSaude, caso: CasoDaSaude): string {
  switch (caso.caso) {
    case 'sem-contagem':
      return semContagem(caso.motivo, alcance);
    case 'medidas-insuficientes':
      return `Só ${marcador('medidas')} dimensão foi medida ${alcance === 'noite' ? 'nesta noite' : 'neste período'} — não há o que comparar.`;
    case 'tudo-no-maximo':
      return `As ${marcador('medidas')} dimensões medidas estão no máximo.`;
    case 'todas-iguais':
      return `As ${marcador('medidas')} dimensões medidas estão no mesmo ponto.`;
    case 'uma': {
      const [k] = caso.nomear;
      return `A dimensão mais baixa é ${comArtigo(k)}: ${marcador(k)}.`;
    }
    case 'duas':
      return `${maiuscula(lista(caso.nomear))} empatam no ponto mais baixo.`;
    case 'fora-do-empate':
      return `Só ${lista(caso.nomear)} ${caso.nomear.length === 1 ? 'está' : 'estão'} ${
        caso.noMaximo ? 'no máximo' : 'acima das outras'
      }.`;
  }
}

/**
 * A frase do template, **com os marcadores** — antes de `interpolar`. Sai daqui
 * para o piso e para a bancada, que a lê ao lado da frase de cada motor.
 */
export function templateDaSaude(e: EntradaDaSaude): string {
  return templateDe(e, casoDaSaude(e.score));
}

/* ── o pedido ────────────────────────────────────────────────────────────── */

/**
 * As regras, iguais para todo caso. Sem algarismo, sem nome de dimensão e sem
 * nome de marcador: o que o motor pode nomear e usar vem só do pedido, e o que
 * cada marcador traz está dito ao lado dele.
 */
const SISTEMA = [
  'Você escreve uma frase só, em português do Brasil, no registro de um jornal: ela informa, não opina.',
  '',
  'A frase lê a Saúde do sono de uma noite ou de um período. O caso que a contagem diz já foi decidido pelo código; você só o redige.',
  '',
  'Regras:',
  '- Uma frase só, curta, sem quebra de linha e sem marcação. Responda só com ela.',
  '- Nenhum número, nem em algarismo nem por extenso: a contagem, quando houver, vem por marcador.',
  '- Onde a frase precisar de um valor, escreva o marcador exatamente como o pedido o dá, com as chaves e sem unidade acrescentada: o que cada marcador traz está dito ao lado dele.',
  '- Use só os marcadores do pedido, cada um no máximo uma vez.',
  '- Nomeie as dimensões que o pedido manda nomear, pelo nome, e nenhuma além das que ele deixa citar.',
  '- Não diga nada que o caso não diga.',
  '- Sem conselho, sem elogio, sem placar, sem tendência nem meta, sem comparação com outras pessoas e sem afirmar causa.',
  '- Não some as dimensões nem transforme a contagem em nota.',
].join('\n');

/** Sem contagem, em palavras: por quê, e o que a frase diz no lugar. */
function semContagemEmPalavras(motivo: MotivoSemContagem, alcance: AlcanceDaSaude): string {
  switch (motivo) {
    case 'cobertura':
      return 'sem contagem — o período tem poucas noites gravadas. Diga a fração gravada, sem falar das dimensões.';
    case 'sem-noite':
      return alcance === 'noite'
        ? 'sem contagem — não há noite gravada. Diga isso, sem falar das dimensões.'
        : 'sem contagem — o período não tem noite gravada. Diga isso, sem falar das dimensões.';
    case 'sem-medida':
      return `sem contagem — não há medida para contar ${alcance === 'noite' ? 'nesta noite' : 'neste período'}. Diga isso, sem falar das dimensões.`;
  }
}

/** O caso em palavras — sem ponto, sem número (nem por extenso), sem fato. */
function casoEmPalavras(alcance: AlcanceDaSaude, caso: CasoDaSaude): string {
  const aqui = alcance === 'noite' ? 'nesta noite' : 'neste período';
  switch (caso.caso) {
    case 'sem-contagem':
      return semContagemEmPalavras(caso.motivo, alcance);
    case 'medidas-insuficientes':
      return `A dimensão medida ${aqui} é a única: não há o que comparar.`;
    case 'tudo-no-maximo':
      return 'Todas as dimensões medidas estão no máximo. Diga isso sem elogiar.';
    case 'todas-iguais':
      return 'Todas as dimensões medidas estão no mesmo ponto.';
    case 'uma':
      return `Só ${lista(caso.nomear)} está abaixo de todas as outras dimensões; o caso não diz como as outras estão entre si.`;
    case 'duas':
      return `Empatam no ponto mais baixo: ${lista(caso.nomear)}.`;
    case 'fora-do-empate':
      return `As outras dimensões empatam no ponto mais baixo, e só ${lista(caso.nomear)} ${
        caso.nomear.length === 1 ? 'fica' : 'ficam'
      } fora do empate, ${caso.noMaximo ? 'no máximo' : 'acima das outras'}.`;
  }
}

/** O gênero e o número do nome da janela — dependem só do `range`. */
const FORMA_DA_JANELA: Readonly<Record<SonoRange, string>> = {
  ultima: 'no feminino singular',
  '7d': 'no masculino plural',
  '4s': 'no feminino plural',
  '12m': 'no masculino plural',
  ano: 'no masculino singular',
};

/** Como começa o nome com "em" contraído — também só do `range`. */
const COMECO_DO_QUANDO: Readonly<Record<SonoRange, string>> = {
  ultima: 'começa por "na"',
  '7d': 'começa por "nos"',
  '4s': 'começa por "nas"',
  '12m': 'começa por "nos"',
  ano: 'começa por "neste" ou por "no"',
};

/** O que cada marcador vale, em palavras — o que ele traz e a forma dele, nunca o valor. */
function sentidoDoMarcador(m: MarcadorDaSaude, caso: CasoDaSaude, range: SonoRange): string {
  switch (m) {
    case 'janela':
      return `o nome da janela lida, ${FORMA_DA_JANELA[range]} e já com o artigo; use-o onde a frase pede um nome, nunca depois de preposição ou de artigo, e não diga a janela de outro jeito`;
    case 'quando':
      return `o mesmo nome, com a preposição "em" já contraída (${COMECO_DO_QUANDO[range]}); use-o onde a frase diz quando, nunca depois de preposição ou de artigo`;
    case 'medidas':
      return `quantas dimensões foram medidas, já por extenso e no feminino; escreva-o logo antes de "${caso.medidas === 1 ? 'dimensão' : 'dimensões'}"`;
    case 'cobertura':
      return 'a fração das noites do período que foram gravadas, já com o sinal de porcentagem';
    case 'duracao':
    case 'continuidade':
    case 'horario':
    case 'regularidade':
    case 'percepcao':
      return `o valor medido d${ARTIGO[m]} ${nome(m)}, já com a unidade; ele não diz o nome da dimensão`;
  }
}

/**
 * O pedido do motor: função só do alcance, do `range`, do caso e das dimensões —
 * nunca de fato, de ponto, do passo ou de `hoje`. Semanas no mesmo caso têm o
 * mesmo pedido, e o mesmo hash.
 */
function usuarioDe(e: EntradaDaSaude, caso: CasoDaSaude): string {
  const regra = regraDe(e, caso);
  // As nomeadas são as exigidas; as outras citáveis, o motor cita se quiser.
  const exigidas: readonly SleepDimensionKey[] = caso.nomear;
  const soCitaveis = citaveis(caso).filter((k) => !exigidas.includes(k));
  const marcadoresExigidos = regra.exigidos.flatMap((x) => ('marcador' in x ? [x.marcador] : []));
  const palavrasExigidas = regra.exigidos.flatMap((x) => ('palavra' in x ? [x.palavra] : []));

  const linhas = [
    `Alcance: ${e.alcance === 'noite' ? 'uma noite' : 'um período'}.`,
    `Janela: ${marcador('janela')}.`,
    `Caso: ${casoEmPalavras(e.alcance, caso)}`,
    exigidas.length > 0 ? `Nomeie, pelo nome: ${lista(exigidas)}.` : 'Não é preciso nomear dimensão.',
  ];
  if (soCitaveis.length > 0) linhas.push(`Pode citar, se quiser: ${lista(soCitaveis)}.`);
  for (const m of marcadoresExigidos) linhas.push(`A frase tem de usar ${marcador(m)}.`);
  for (const p of palavrasExigidas) linhas.push(`A frase tem de dizer "${p}".`);
  linhas.push('Marcadores:');
  for (const [m] of marcadoresDe(e, caso)) linhas.push(`- ${marcador(m)}: ${sentidoDoMarcador(m, caso, e.range)}`);
  return linhas.join('\n');
}

/* ── o descritor ─────────────────────────────────────────────────────────── */

/** Sobe a cada mudança no pedido ou na leitura. Vai na assinatura e no hash. */
const VERSAO = 1;

/**
 * A Saúde do sono como recurso (AD-2, AD-7).
 *
 * - **Interpolado**, com amostragem gulosa e saída em texto: a mesma entrada dá
 *   o mesmo pedido, e o mesmo motor, a mesma frase.
 * - **Não grava**: é leitura efêmera, sob pedido — por isso lê período em curso.
 * - **Admite até a nuvem**, só por escolha explícita: a cadeia padrão é só
 *   `sem-modelo` até a bancada aprovar um motor (AD-11).
 * - **Todo caso gera pedido**: não há caso em que o template diga algo e o motor
 *   não tenha o que redigir.
 * - **O caso sai do `score` em cada passo** — o pedido, a conferência, a frase e
 *   o piso nunca leem um caso guardado.
 */
export const descritorDaSaudeDoSono: Descritor<EntradaDaSaude, string> = {
  recurso: 'saude-do-sono',
  versao: VERSAO,
  regimeDeNumeros: 'interpolado',
  regimeMaximo: 'nuvem',
  cadeiaPadrao: [SEM_MODELO],
  grava: false,

  montarPedido: (e) => ({
    sistema: SISTEMA,
    usuario: usuarioDe(e, casoDaSaude(e.score)),
    amostragem: 'gulosa',
    saida: { tipo: 'texto' },
    guardrails: 'padrao',
  }),

  interpretar: (resposta) => limparResposta(resposta.texto),

  conferir: (texto, e) => conferirInterpolado(texto, regraDe(e, casoDaSaude(e.score))),

  montarFrase: (texto, e) => interpolar(texto, valoresDe(e, casoDaSaude(e.score))),

  semModelo: (e) => {
    const caso = casoDaSaude(e.score);
    return { frase: interpolar(templateDe(e, caso), valoresDe(e, caso)) };
  },
};
