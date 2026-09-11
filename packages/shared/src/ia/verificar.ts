/**
 * As verificações mecânicas da §5 do spec — o que separa "confio no modelo"
 * de "conferi o modelo".
 *
 * O que NÃO se testa aqui: se a manchete escolhida é a boa. Isso é julgamento do
 * leitor, é uma pessoa só, e ela está disponível. Fingir que dá para automatizar
 * seria pior que não tentar.
 *
 * O que se testa é o que tem resposta binária:
 *   1. todo número citado existe no pacote
 *   2. nenhuma palavra de causa ligando duas medidas
 *   3. nenhuma correlação fora do portão promovida a afirmação
 *   4. toda ressalva obrigatória foi declarada
 *   5. todo número que é valor de BASE nomeia a base certa
 *
 * A quinta muda a pergunta que a conferência faz. As quatro primeiras perguntam
 * *"esse número existe?"*; a quinta pergunta *"esse número existe **como B2**, e
 * a frase diz **B2**?"*. Três bases sem nome são um alfabeto três vezes maior;
 * três bases com nome são uma **gramática** — o número tem que bater e a
 * preposição junto.
 *
 * Puro, sem rede, sem provedor — roda igual sobre a saída de qualquer modelo, o
 * que é justamente o que faz trocar de fornecedor custar uma tarde (ADR 0040).
 */
import type { PeriodKind } from '../period/bounds';
import { MONTHS_PT, periodProseLabel } from '../period/bounds';
import type { BaseId, PacoteDeFatos, UmOuMaisPacotes } from './pacote';
import {
  BASE_ROTULO, procedenciaDoPacote, ressalvasObrigatorias, valoresDoPacote,
} from './pacote';

export interface Problema {
  regra: 'numero' | 'causa' | 'correlacao' | 'ressalva' | 'base';
  detalhe: string;
}

export interface Veredito {
  ok: boolean;
  problemas: Problema[];
}

/**
 * Os termos proibidos, com um dono só (AD-6, story 5.2).
 *
 * Nenhum outro arquivo do núcleo declara lista de termo proibido — o
 * `architecture.test.ts` cobra. Cada recurso **compõe** os subconjuntos que
 * valem para ele: a revista compõe só `causa`, na regra 2 de
 * {@link verificarTexto}; a Saúde do sono compõe os seis, na 5.3. Cada termo
 * traz a fonte ao lado.
 *
 * ## Dois casamentos, e o subconjunto diz qual
 *
 * - **`causa` casa por trecho**, em minúsculas, como sempre casou. Mudar o
 *   casamento dela mudaria o que a revista reprova.
 * - **Os outros cinco têm de casar por palavra inteira**, com o acento dobrado.
 *   Por trecho, "tente" casa com "consistente", "meta" com "metade" e "piora"
 *   com "pioram" — falso positivo dentro de palavra legítima. O casamento deles
 *   é da 5.3, que os compõe; até lá nenhuma conferência os lê.
 *
 * ## O que ficou de fora de propósito
 *
 * Colidem com texto que a Saúde do sono já escreve (`docs/specs/sono/spec.md`,
 * CAP-13, e `sleep/score.ts`): "nota" (a percepção sai como `3.3/5 · 12
 * notas`), "ponto" no singular ("as quatro dimensões medidas estão no mesmo
 * ponto"), "seguidas" (`SRI 64 · 9 seguidas`), "máximo" ("só o horário está no
 * máximo") e "comparar" ("não há o que comparar"). Termo que casasse com a frase
 * do próprio template reprovaria o piso.
 *
 * ## Congelado
 *
 * O objeto e cada subconjunto, em tempo de execução: a lista sai pelo barril, e
 * um importador que fizesse `causa.length = 0` afrouxaria a conferência da
 * revista sem erro nenhum. Os arrays continuam literais — é neles que a barreira
 * do `architecture.test.ts` acha o dono.
 */
export const VOCABULARIO_PROIBIDO = Object.freeze({
  /**
   * Termos que afirmam causa. "Depois de" e "quando" ficam de fora de propósito:
   * são temporais, e o texto precisa poder dizer que duas coisas coincidiram.
   *
   * Fonte de todos: a `CAUSA` que morava privada neste arquivo até a 5.2 — termo
   * a termo e na mesma ordem. Os marcados com "regra 6" são também citados na
   * regra 6 do `SISTEMA` (`ia/prompt.ts`).
   */
  causa: Object.freeze([
    'porque',           // regra 6
    'por causa',        // regra 6 ("por causa de")
    'devido a',         // regra 6
    'devido à',
    'graças a',         // regra 6
    'graças à',
    'resultou em',      // regra 6
    'levou a',          // regra 6
    'levou à',
    'provocou',
    'causou',
    'causa disso',
    'em função de',
    'em razão de',
    'fez com que',
    'por conta de',
  ] as const),
  /** O jornal informa, não aconselha. */
  conselho: Object.freeze([
    'continue assim',                   // SISTEMA de ia/prompt.ts, "nada de"
    'tente dormir mais',                // SISTEMA de ia/prompt.ts, "nada de"
    'vale a pena acompanhar de perto',  // SISTEMA de ia/prompt.ts, "nada de"
    'que tal',                          // story 1.5 (epics.md), "informa e não aconselha"
    'experimente',                      // story 1.5 (epics.md), "informa e não aconselha"
    'verifique suas conexões',          // story 1.5 (epics.md); revista-retrospectiva/bases-e-ranqueamento.md, "Ausência declarada"
    'recomendo',                        // SISTEMA de ia/prompt.ts, "você não recomenda"
    'sugiro',                           // SISTEMA de ia/prompt.ts, "não sugere"
  ] as const),
  /** Nem parabeniza, nem celebra — `tudo-no-maximo` diz isso sem elogio (CAP-13). */
  elogio: Object.freeze([
    'parabéns',         // SISTEMA de ia/prompt.ts ("parabéns pelo mês"); review-rubrica.md, A4
    'continue assim',   // SISTEMA de ia/prompt.ts; review-rubrica.md, A4
    'conquista',        // retrospectiva/v2-jornal.md §3 ("narrar um gap de firmware como conquista")
  ] as const),
  /** A Saúde do sono é contagem, não placar (ADR 0036). */
  placar: Object.freeze([
    'placar',           // sono/spec.md §2; ADR 0036, "Risco real"; v2-jornal.md §9
    'score',            // sono/spec.md CAP-5 e §5 ("score / nota de sono de qualquer tipo")
    'pontuação',        // ADR 0036 — o composto normalizado que ela proíbe
    'pontos',           // ADR 0036 — idem; "ponto" no singular fica de fora (ver acima)
    'de 0 a 100',       // sono/spec.md §2 ("nem nota de 0 a 100")
    'saldo',            // v2-jornal.md §9 ("saldo contra 7 h — tem cara de placar")
  ] as const),
  /** Nem direção, nem alvo: a regra 6 da ADR 0036. */
  'tendencia-e-meta': Object.freeze([
    'melhorou',         // sono/spec.md CAP-3 e CAP-13
    'piorou',           // sono/spec.md CAP-13
    'melhora',          // revista-retrospectiva/bases-e-ranqueamento.md, "Ausência declarada"
    'piora',            // o par de "melhora"
    'streak',           // sono/spec.md §2; ADR 0036, regra 6
    'meta',             // sono/spec.md §2; ADR 0036, regra 6
    'seta',             // sono/spec.md §2 e CAP-3; ADR 0036, regra 6 e "Risco real"
  ] as const),
  /**
   * Você contra você mesmo, nunca contra os outros. Só "outras pessoas" e "norma
   * clínica" têm fonte literal; os outros três são derivados do princípio.
   */
  comparacao: Object.freeze([
    'outras pessoas',          // ADR 0036, regra 6
    'a maioria das pessoas',   // derivado do princípio (sono/spec.md CAP-4) — sem fonte literal
    'média da população',      // derivado do princípio (sono/spec.md CAP-4) — sem fonte literal
    'norma clínica',           // sono/spec.md CAP-4; sleep/retro.ts, "nunca os compara com norma clínica"
    'para a sua idade',        // derivado do princípio (sono/spec.md CAP-4) — sem fonte literal
  ] as const),
});

/** O nome de um subconjunto — é o que cada recurso compõe. */
export type SubconjuntoProibido = keyof typeof VOCABULARIO_PROIBIDO;

/**
 * Números pt-BR: ponto de milhar, vírgula decimal. `17.350` é dezessete mil e
 * trezentos e cinquenta; `40,1` é quarenta vírgula um.
 *
 * Anos e horas do relógio saem da conta: `2026` não é uma métrica citada, e
 * `7h02` é formatação de duração, não um número do pacote.
 */
const NUM = /\d{1,3}(?:\.\d{3})+|\d+,\d+|\d+/g;

function paraNumero(bruto: string): number | null {
  const limpo = bruto.replace(/\./g, '').replace(',', '.');
  const v = Number(limpo);
  return Number.isFinite(v) ? v : null;
}

/**
 * O vocabulário de cada base — as formas com que o texto de verdade a chama.
 *
 * Parte de {@link BASE_ROTULO} ("o período anterior", "o mesmo período do ano
 * anterior", "a normal do período") e acrescenta o que as sete primeiras edições
 * já escreveram sem que ninguém pedisse: *"o ciclo anterior"*, *"na etapa
 * anterior"*, *"na semana anterior"*.
 *
 * **B1 depende do tipo do período, e é a única que depende.** Numa edição de
 * ano, "o ano anterior" é B1; numa de mês, é B2 — a mesma frase, duas bases. Por
 * isso `vocabulario()` recebe o tipo, e por isso no período `year` a frase sai
 * como B1 **e** B2: a coincidência é real, e resolvê-la a favor de uma só
 * reprovaria a outra.
 *
 * **O vocabulário é aberto pelo nome próprio do período** (renegociado em
 * 09/09). *"21 atividades contra 17 em julho"* nomeia B1 tão bem quanto "no
 * período anterior" — melhor, até, e é a primeira das três formas que a Story
 * 1.5 é obrigada a ensinar ao prompt. Quem sabe que o anterior de agosto se
 * chama julho é o pacote: `periodo.rotuloAnterior`.
 *
 * **B2 já está coberto pela mesma máquina, e de propósito não ganha nome
 * próprio sozinho.** A forma prescrita é *"contra agosto do ano passado"* —
 * nome próprio **mais** marcador de ano —, e o marcador sozinho ("do ano
 * passado") já identifica B2 aqui. Aceitar o nome nu seria pior que não
 * aceitar: "em agosto", numa edição de agosto, nomeia o **período corrente**,
 * não uma base. Por isso o nome do período corrente entra como **neutro** —
 * nem nomeia base, nem conta como nome errado.
 *
 * **B3 não tem nome próprio.** A terceira forma prescrita é *"contra o que você
 * costuma fazer em agosto"*: o nome que aparece nela é o do período corrente, e
 * quem carrega o sentido de base é a perífrase, que está em {@link B3_VOCAB}.
 */
const B1_GENERICO = [
  'periodo anterior', 'periodo passado',
  'ciclo anterior', 'ciclo passado',
  'etapa anterior', 'etapa passada',
] as const;

const B1_POR_TIPO: Readonly<Record<PeriodKind, readonly string[]>> = {
  week: ['semana anterior', 'semana passada'],
  month: ['mes anterior', 'mes passado'],
  season: ['trimestre anterior', 'trimestre passado', 'estacao anterior'],
  year: ['ano anterior', 'ano passado'],
  // O histórico completo não tem período anterior — não há B1 a nomear.
  all: [],
};

const B2_VOCAB = [
  'ano anterior', 'ano passado', 'mesmo periodo do ano', 'um ano antes', 'ha um ano',
] as const;

/**
 * `'costuma fazer'` é a perífrase que o prompt v3 **prescreve** para B3 — e ela
 * entrou aqui em 09/09/2026 porque não estava.
 *
 * É o defeito de encaixe entre a Story 1.4 e a 1.5: a 1.4 registrou que as três
 * formas prescritas passavam, e o teste que se chamava *"a forma de B3 — 'o que
 * você costuma fazer em agosto'"* asseria **outra** frase. Com a forma do épico,
 * todo texto que citasse B3 reprovaria — a mesma janela que a 1.5 existe para
 * fechar, com o sinal invertido.
 *
 * O conserto é **vocabulário, não severidade**: a inversão continua sendo pega,
 * porque a regra compara a base nomeada com a base do valor. Escrever a
 * perífrase de B3 ao lado de um valor de B1 reprova igual.
 */
const B3_VOCAB = [
  'normal do periodo', 'a normal', 'normal historica', 'media historica',
  'media dos anos', 'costuma fazer',
] as const;

type Vocabulario = ReadonlyArray<readonly [BaseId, readonly string[]]>;

/**
 * O que a regra sabe sobre como este período se chama.
 *
 * `anterior` e `atual` chegam já em forma de **prosa**: "julho", não "Julho
 * 2026" — é o que o leitor escreve.
 */
interface Nomes {
  tipo: PeriodKind;
  vocab: Vocabulario;
  /** O nome próprio do período anterior. Nomeá-lo é nomear B1. */
  anterior: string | null;
  /** O nome próprio do período corrente. Nomeá-lo não é nomear base nenhuma. */
  atual: string | null;
}

/**
 * O rótulo do período em forma de prosa, **normalizado** para a busca.
 *
 * A redução em si (`"Julho 2026"` → `"julho"`) não mora aqui: ela é de
 * `periodProseLabel`, em `period/bounds.ts`, que é o dono único do rótulo de
 * período. Aqui só se tira o acento, porque a varredura opera sobre texto
 * normalizado — o prompt precisa da mesma frase **com** acento, e duas cópias da
 * redução divergiriam calado.
 */
function nomeEmProsa(tipo: PeriodKind, rotulo: string | null): string | null {
  const prosa = periodProseLabel(tipo, rotulo);
  if (prosa == null) return null;
  const n = normalizar(prosa);
  return n === '' ? null : n;
}

function nomesDoPeriodo(p: PacoteDeFatos | undefined): Nomes {
  const tipo = p?.periodo.tipo ?? 'month';
  return {
    tipo,
    vocab: [
      ['B1', [...B1_GENERICO, ...B1_POR_TIPO[tipo]]],
      ['B2', B2_VOCAB],
      ['B3', B3_VOCAB],
    ],
    anterior: nomeEmProsa(tipo, p?.periodo.rotuloAnterior ?? null),
    atual: nomeEmProsa(tipo, p?.periodo.rotulo ?? null),
  };
}

/**
 * Onde um termo aparece num trecho, **como palavra** e não como pedaço de outra.
 *
 * Achado pela própria medição das 7 edições: *"o ciclismo concentrou a **maio**r
 * parte do volume"* casava com o mês de maio, e numa edição de mês isso é um
 * nome próprio errado colado num número — uma edição inteira reprovada por uma
 * palavra que não é um mês. Vale para o vocabulário também: `'a normal'` casava
 * dentro de "um**a normal**idade".
 *
 * O texto e os termos já chegam normalizados (minúsculas, sem acento), então
 * `\b` opera sobre ASCII e não tem surpresa de unicode. A fronteira só é exigida
 * na ponta que é caractere de palavra: `"27/07 – 02/08"` começa e termina em
 * dígito, mas um termo com pontuação na ponta não ganha fronteira que não tem.
 */
function ocorrencias(trecho: string, termo: string): number[] {
  const out: number[] = [];
  if (termo === '') return out;
  const esc = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ini = /\w/.test(termo[0]) ? '\\b' : '';
  const fim = /\w/.test(termo[termo.length - 1]) ? '\\b' : '';
  for (const m of trecho.matchAll(new RegExp(`${ini}${esc}${fim}`, 'g'))) out.push(m.index ?? 0);
  return out;
}

/**
 * Os nomes próprios de período que aparecem num trecho.
 *
 * O léxico é fechado só onde a prosa tem um: os **doze meses** (dono único em
 * `period/bounds.ts`) e os **anos de quatro dígitos**. Semana e trimestre ficam
 * de fora porque não têm forma de prosa enumerável — ninguém escreve "contra
 * 27/07 – 02/08" nem "contra Q1 2026" —, e inventar uma seria fabricar o léxico
 * que se quer conferir. Nesses dois tipos a regra fica com o vocabulário
 * genérico, e o nome próprio nem aprova nem reprova.
 */
function nomesProprios(trecho: string, tipo: PeriodKind): string[] {
  if (tipo === 'month') {
    return MONTHS_PT.map((m) => normalizar(m)).filter((m) => ocorrencias(trecho, m).length > 0);
  }
  if (tipo === 'year') return [...trecho.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => m[0]);
  return [];
}

/**
 * Nome próprio de período que não é nem o anterior nem o corrente.
 *
 * **Sem `anterior` não há acusação.** Se o pacote não sabe como o período
 * anterior se chama, nenhum nome de mês pode ser declarado errado — não há
 * âncora contra a qual errar, e acusar aí seria adivinhar. A regra volta ao
 * vocabulário genérico, que é o comportamento de semana e trimestre.
 */
function nomesErrados(trecho: string, n: Nomes): string[] {
  if (n.anterior == null) return [];
  return nomesProprios(trecho, n.tipo).filter((x) => x !== n.anterior && x !== n.atual);
}

/**
 * Uma nomeação encontrada no texto, com onde ela está.
 *
 * A posição importa porque **quem se liga ao número é a nomeação mais próxima**.
 * Num trecho como *"contra 17 em julho — e 435 km no lugar de 862 em junho"*, os
 * dois nomes cabem na janela do 862; o que fala dele é o colado, não o que já
 * está preso ao 17. Sem posição, o conjunto diria "há uma nomeação certa por
 * aqui" e absolveria a troca.
 */
interface Marca {
  ini: number;
  fim: number;
  texto: string;
  /** As bases que ela nomeia. Vazio ⇒ nome próprio de outro período. */
  ids: ReadonlySet<BaseId>;
}

function marcasNoTrecho(trecho: string, deslocamento: number, n: Nomes): Marca[] {
  const out: Marca[] = [];
  const todas = (agulha: string, ids: readonly BaseId[]) => {
    for (const i of ocorrencias(trecho, agulha)) {
      out.push({
        ini: deslocamento + i,
        fim: deslocamento + i + agulha.length,
        texto: agulha,
        ids: new Set(ids),
      });
    }
  };
  for (const [id, frases] of n.vocab) for (const f of frases) todas(f, [id]);
  // "contra 17 em julho": o nome próprio do anterior nomeia B1. Num período de
  // ano ele nomeia B2 junto, pela mesma razão que "o ano anterior" nomeia as
  // duas ali — para um ano, as duas bases são o mesmo período.
  if (n.anterior != null) todas(n.anterior, n.tipo === 'year' ? ['B1', 'B2'] : ['B1']);
  // Nome próprio de outro período: não nomeia base nenhuma, e por isso acusa.
  for (const x of nomesErrados(trecho, n)) todas(x, []);
  return out;
}

/** Distância entre uma marca e o número, em caracteres. Zero se encostam. */
function distancia(m: Marca, ini: number, fim: number): number {
  if (m.fim <= ini) return ini - m.fim;
  if (m.ini >= fim) return m.ini - fim;
  return 0;
}

const ACENTO: Readonly<Record<string, string>> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', í: 'i', ì: 'i', î: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/**
 * Minúsculas e sem acento, **sem mudar o comprimento**.
 *
 * As posições dos números vêm do texto original e é por elas que a janela é
 * recortada; um normalizador que desloca índices faz a janela olhar para o lugar
 * errado, calado. `normalize('NFD')` é exatamente isso: separa o acento em dois
 * code points e empurra tudo à frente. Por isso a troca é caractere a caractere,
 * e o caractere fica como está se a versão minúscula tiver outro tamanho.
 */
function normalizar(s: string): string {
  let out = '';
  for (const c of s) {
    const b = c.toLowerCase();
    const u = b.length === c.length ? b : c;
    out += ACENTO[u] ?? u;
  }
  return out;
}

/**
 * O **parágrafo** em que o número vive — o alcance da absolvição.
 *
 * A prosa de jornal estabelece a comparação uma vez e segue com ela implícita:
 * *"21 atividades contra 17 em julho — e, ainda assim, 435 km no lugar de 862 …
 * A nota de sono subiu de 3,39 para 3,72"* nomeia a base **uma vez** e cobre
 * quatro valores dela. Exigir a nomeação em cada frase reprovaria o parágrafo
 * escrito à mão da §6 do spec, que é justamente o alvo de prosa da frente.
 *
 * Trocar de parágrafo é trocar de assunto, e aí a nomeação não viaja junto.
 */
function limitesDoParagrafo(texto: string, pos: number): readonly [number, number] {
  let ini = 0;
  let fim = texto.length;
  for (const m of texto.matchAll(/\n[ \t]*\n/g)) {
    const a = m.index ?? 0;
    const b = a + m[0].length;
    // `pos` cai sempre num dígito, nunca dentro do separador.
    if (b <= pos) ini = b;
    else if (a >= pos) { fim = a; break; }
  }
  return [ini, fim];
}

/**
 * A **frase** em que o número vive — o alcance da reprovação por inversão.
 *
 * Absolver é coisa de parágrafo; acusar de troca é coisa de frase. Um nome de
 * base colado ao número, na frase dele, é o que caracteriza a inversão; o mesmo
 * nome dois períodos adiante do parágrafo é de outro número.
 */
function limitesDaFrase(texto: string, pos: number): readonly [number, number] {
  const corta = (i: number): boolean => {
    const c = texto[i];
    if (c === '\n' || c === '!' || c === '?') return true;
    if (c !== '.') return false;
    // Ponto de milhar não termina frase: "16.315" é um número, não duas frases.
    const a = texto[i - 1] ?? '';
    const b = texto[i + 1] ?? '';
    return !(/\d/.test(a) && /\d/.test(b));
  };
  let ini = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (corta(i)) { ini = i + 1; break; }
  }
  let fim = texto.length;
  for (let i = pos; i < texto.length; i += 1) {
    if (corta(i)) { fim = i; break; }
  }
  return [ini, fim];
}

/**
 * A janela de **decisão**: 64 caracteres de cada lado do número, recortados
 * dentro da frase.
 *
 * É onde a regra decide **quem fala deste número**. O que cai aqui julga — para
 * o bem e para o mal: a nomeação mais próxima absolve se for a certa e reprova
 * se for outra. Fora daqui, só o parágrafo pode absolver, e nunca acusar.
 *
 * O tamanho é medido, não escolhido no ar. A oração que carrega a nomeação nas
 * edições reais tem esta ordem de grandeza — *"enquanto o ciclo anterior reuniu
 * 45 km em 3 sessões"* põe o nome 8 caracteres antes do número, e *"os 131 km do
 * período anterior"* o põe 8 depois; a folga cobre a oração inteira dos dois
 * lados. Nas três edições reais que nomeiam a base, é aqui que elas são
 * absolvidas — não no parágrafo.
 *
 * Os dois lados custam, e por isso o valor é **bracketado por teste**: janela
 * grande demais deixa a nomeação de um número absolver o vizinho; pequena demais
 * joga fora prosa boa, ao preço de uma edição inteira e uma chamada paga. Ver
 * "a janela de decisão tem tamanho, e ele é medido" em `verificar.test.ts`.
 */
const JANELA_DECISAO = 64;

/**
 * As bases que um trecho nomeia — pelo vocabulário **ou** pelo nome próprio do
 * período anterior, que é nomear B1.
 */
function basesNomeadas(trecho: string, n: Nomes): Set<BaseId> {
  const out = new Set<BaseId>();
  for (const [id, frases] of n.vocab) {
    for (const f of frases) {
      if (ocorrencias(trecho, f).length > 0) { out.add(id); break; }
    }
  }
  // "contra 17 em julho": o nome próprio do anterior nomeia B1. Num período de
  // ano ele nomeia B2 junto, pela mesma razão que "o ano anterior" nomeia as
  // duas ali — para um ano, as duas bases são o mesmo período.
  if (n.anterior != null && ocorrencias(trecho, n.anterior).length > 0) {
    out.add('B1');
    if (n.tipo === 'year') out.add('B2');
  }
  return out;
}

function nomear(ids: Iterable<BaseId>): string {
  return [...ids].map((i) => `${i} (${BASE_ROTULO[i]})`).join(' ou ');
}

/** Números que o texto pode citar sem estarem no pacote. */
function ignoravel(bruto: string, texto: string, pos: number): boolean {
  const v = paraNumero(bruto);
  if (v == null) return true;
  // Ano: 1900–2100 e escrito sem separador.
  if (/^\d{4}$/.test(bruto) && v >= 1900 && v <= 2100) return true;
  // Hora de relógio: "7h02", "22h".
  const antes = texto.slice(Math.max(0, pos - 3), pos);
  const depois = texto.slice(pos + bruto.length, pos + bruto.length + 6);
  if (/h$/i.test(antes) || /^h/i.test(depois)) return true;
  // Dia do mês num "30 de agosto" — a data vem do pacote, não é métrica.
  if (/^\s*de\s/i.test(depois) && v >= 1 && v <= 31) return true;
  return false;
}

/** Um número que o texto cita, e onde. */
interface Citacao {
  /** Como o texto o escreveu — `"16.315"`, `"40,1"`. */
  bruto: string;
  /** Posição no texto já sem as datas ISO. */
  pos: number;
  valor: number;
}

/**
 * Os números que o texto cita e que a conferência tem que responder por.
 *
 * Uma varredura só, lida por duas regras: a primeira pergunta se o valor existe,
 * a quinta pergunta se ele existe **como o que a frase diz**. Duas varreduras
 * seriam duas chances de divergirem no que consideram um número.
 */
function citacoes(texto: string): Citacao[] {
  const out: Citacao[] = [];
  for (const m of texto.matchAll(NUM)) {
    const bruto = m[0];
    const pos = m.index ?? 0;
    if (ignoravel(bruto, texto, pos)) continue;
    const valor = paraNumero(bruto);
    if (valor == null) continue;
    out.push({ bruto, pos, valor });
  }
  return out;
}

/**
 * Confere um texto contra o pacote que o gerou.
 * `ok: false` significa **não gravar a edição** — não "avisar o usuário".
 *
 * Aceita **um caderno ou o conjunto**, e o grão importa: conferir o texto de um
 * caderno contra o alfabeto dos quatro é justamente a frouxidão que o pacote por
 * caderno existe para acabar. Passe a união só enquanto o texto for um só —
 * até a sequência da impressão por caderno (Story 1.10).
 */
export function verificarTexto(texto: string, pacote: UmOuMaisPacotes): Veredito {
  const problemas: Problema[] = [];
  const pacotes: readonly PacoteDeFatos[] = Array.isArray(pacote)
    ? pacote
    : [pacote as PacoteDeFatos];
  const autorizados = valoresDoPacote(pacotes);
  const baixo = texto.toLowerCase();

  // Datas ISO saem de cena antes da varredura. `2026-08-01` vira "2026", "08" e
  // "01" para o regex de número, e o "01" é reprovado como métrica inventada —
  // sendo que a data veio do próprio pacote. Mascarar é mais honesto que
  // remendar o regex de número para entender datas.
  const semDatas = texto.replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  const citados = citacoes(semDatas);

  // 1 — números
  for (const { bruto, valor } of citados) {
    // Comparação EXATA, com epsilon só para o ruído de ponto flutuante — nunca
    // para tolerar arredondamento. Arredondar aqui aprovaria a média que o
    // modelo fez de cabeça sempre que ela caísse perto de um valor real.
    const existe = [...autorizados].some((a) => Math.abs(a - valor) < 1e-9);
    if (!existe) {
      problemas.push({ regra: 'numero', detalhe: `"${bruto}" não está no pacote` });
    }
  }

  // 2 — causa. A revista compõe só este subconjunto, e por trecho.
  for (const termo of VOCABULARIO_PROIBIDO.causa) {
    if (baixo.includes(termo)) {
      problemas.push({ regra: 'causa', detalhe: `afirma causa: "${termo}"` });
    }
  }

  // 3 — correlação fora do portão
  for (const c of pacotes.flatMap((p) => p.correlacoes)) {
    if (c.dentroDoPortao) continue;
    const rotulo = c.rotulo.toLowerCase();
    const citada = rotulo.length > 3 && baixo.includes(rotulo);
    const ressalvada = /amostra|poucos dias|poucas noites|insuficiente/.test(baixo);
    if (citada && !ressalvada) {
      problemas.push({
        regra: 'correlacao',
        detalhe: `"${c.rotulo}" está fora do portão (${c.nCom} com, ${c.nSem} sem) e foi citada sem ressalva`,
      });
    }
  }

  // 4 — ressalva obrigatória
  for (const r of ressalvasObrigatorias(pacotes)) {
    const declarou = /cobertura|dias com dado|noites registradas|registrad|apenas \d|só \d/.test(baixo);
    if (!declarou) {
      problemas.push({
        regra: 'ressalva',
        detalhe: `cobertura desigual em "${r}" não foi declarada no texto`,
      });
    }
  }

  // 5 — a base citada tem que ser nomeada, e nomeada CERTO
  //
  // O caso perigoso não é a ausência de nome: é a **inversão**. "435 km, contra
  // 380 no ano passado", com 380 sendo o período anterior, é uma frase
  // bem-formada, passa nas quatro regras anteriores e está errada. Um teste que
  // só cubra a ausência deixa passar justamente a metade que importa.
  //
  // A regra não adivinha. Falso positivo aqui joga fora uma edição inteira e uma
  // chamada paga; um escape o leitor corrige. Por isso ela cala em três casos, e
  // os três estão escritos abaixo.
  const proc = procedenciaDoPacote(pacotes);
  const basesDoValor = new Map<number, Set<BaseId>>();
  const naoBase = new Set<number>();
  for (const x of proc) {
    if (x.base == null) { naoBase.add(x.valor); continue; }
    const s = basesDoValor.get(x.valor) ?? new Set<BaseId>();
    s.add(x.base);
    basesDoValor.set(x.valor, s);
  }
  const nomes = nomesDoPeriodo(pacotes[0]);
  const norm = normalizar(semDatas);

  for (const { bruto, pos, valor } of citados) {
    const ids = basesDoValor.get(valor);
    // Cala 1: não é valor de base. `atual` não exige nomeação nenhuma.
    if (!ids || ids.size === 0) continue;
    // Cala 2: o mesmo valor também é `atual`, delta ou cobertura de algum fato —
    // não dá para saber em que papel a frase o citou, e chutar é adivinhar.
    if (naoBase.has(valor)) continue;

    // ── 1º: o que está COLADO no número, que é quem fala dele ──
    //
    // A ordem é a regra. Absolver antes de olhar a vizinhança faria a primeira
    // nomeação certa do parágrafo cobrir todos os valores seguintes, inclusive
    // os rotulados errado — e é justamente essa a forma que a Story 1.5 vai
    // ensinar (nomear uma vez, seguir implícito). A inversão pararia de existir
    // exatamente na prosa para a qual o pipeline está sendo dirigido.
    const [fIni, fFim] = limitesDaFrase(norm, pos);
    const jIni = Math.max(fIni, pos - JANELA_DECISAO);
    const jFim = Math.min(fFim, pos + bruto.length + JANELA_DECISAO);
    const marcas = marcasNoTrecho(norm.slice(jIni, jFim), jIni, nomes);
    if (marcas.length > 0) {
      let melhor = marcas[0];
      let melhorD = Infinity;
      let casa = false;
      for (const m of marcas) {
        const d = distancia(m, pos, pos + bruto.length);
        const bate = [...m.ids].some((id) => ids.has(id));
        // Empate a favor de quem nomeia certo: falso positivo custa mais.
        if (d < melhorD || (d === melhorD && bate && !casa)) {
          melhor = m; melhorD = d; casa = bate;
        }
      }
      if (casa) continue;
      const disse = melhor.ids.size > 0 ? nomear(melhor.ids) : `"${melhor.texto}"`;
      problemas.push({
        regra: 'base',
        detalhe: `"${bruto}" é valor de ${nomear(ids)}, mas a frase nomeia ${disse}`,
      });
      continue;
    }

    // ── 2º: nada colado. Aí sim o parágrafo pode absolver ──
    //
    // A prosa de jornal nomeia a base uma vez e segue com ela implícita. Isso
    // absolve o número que ninguém contradisse — e só ele, porque quem tinha
    // nomeação colada já foi julgado acima.
    const [pIni, pFim] = limitesDoParagrafo(norm, pos);
    const noParagrafo = basesNomeadas(norm.slice(pIni, pFim), nomes);
    if ([...noParagrafo].some((id) => ids.has(id))) continue;
    // Cala 3: o parágrafo nomeia OUTRA base, longe demais para ser deste número.
    // Indecidível — a regra não adivinha. Nome próprio de outro período não
    // entra aqui: ele não nomeia base nenhuma, então não é indício de que este
    // número tenha sido nomeado; longe do número, ele simplesmente não conta.
    if (noParagrafo.size > 0) continue;
    problemas.push({
      regra: 'base',
      detalhe: `"${bruto}" é valor de ${nomear(ids)} e foi citado sem nomear a base`,
    });
  }

  return { ok: problemas.length === 0, problemas };
}
