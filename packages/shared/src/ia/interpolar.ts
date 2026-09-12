/**
 * O regime interpolado: o motor escreve palavras, e cada valor entra por
 * marcador (AD-6, ADR 0049, story 5.3).
 *
 * **A sintaxe tem dono aqui, e só aqui.** Um marcador é `{nome}`, com o nome em
 * letras minúsculas sem acento (`[a-z]+`): `{regularidade}`, `{medidas}`. O motor
 * o escreve exatamente como o pedido o deu, e o código o troca pelo fato já
 * formatado em pt-BR — o motor nunca escreve o número, então número errado não
 * tem por onde entrar. O que embrulha um nome de marcador em outra sintaxe
 * (`[nome]`, `${nome}`, `<nome>`, `｛nome｝`) é chave malformada.
 *
 * **A conferência lê o texto do motor, e a frase que ele vira**, e reprova:
 *
 *   forma        quebra de linha, marcação, lista ou citação no começo, caractere
 *                invisível ou de controle, rótulo no começo ("Frase:", "Resposta
 *                final:"), aspa que sobra na ponta, pontuação final antes do fim,
 *                mais de 280 caracteres na frase
 *   algarismo    qualquer `\p{N}` — "3,3", "٣", "½"
 *   extenso      fora de marcador, o numeral por extenso — salvo o que o próprio
 *                caso diz, e só no lugar dele; "um" e "uma" são artigo
 *   chave        chave malformada, marcador embrulhado, nome colado a `$ % @ :`,
 *                a chave sem acento solta na prosa
 *   marcador     marcador fora do conjunto, repetido ou fora do lugar; a coisa que
 *                só o marcador diz, dita de outro jeito na prosa
 *   a-mais       item que o caso não cita, pelo nome ou pelo marcador
 *   contradicao  expressão que afirma outro caso
 *   vocabulario  os subconjuntos de `VOCABULARIO_PROIBIDO` que o recurso compõe,
 *                no texto e no que só nasce na troca
 *
 * **E exige presença, não só ausência.** O que o caso exige — um item pelo nome,
 * um marcador ou uma palavra — e falta vira `ausente`; o sinal de recusa
 * ("desculpe", "não posso") vira `recusa`. O veredito é **recusa** quando há sinal,
 * ou quando a falta é o único problema: é assim que a recusa em texto livre, que
 * chega sem erro nenhum, deixa de passar por leitura — e o orquestrador a
 * classifica como `recusa-do-modelo`. Texto que erra **e** falta (nomeou a dimensão
 * que o caso não cita, e não nomeou a que ele exige) é `reprovada`: errar não é
 * recusar, e a bancada conta as duas coisas separadas.
 *
 * O que o **recurso** declarar errado — nome de valor fora de `[a-z]+`, exigência de
 * marcador que não está no conjunto, palavra exigida vazia, item que a regra não
 * declara — lança: é defeito dele, e viraria recusa calada em toda leitura do caso.
 *
 * Genérico de propósito: não sabe o que é dimensão de sono. Quem declara os
 * valores, os itens, o lugar de cada marcador, o que contradiz e o que é exigido
 * é o recurso (`sleep/leitura.ts`); aqui mora só a regra de como se lê o texto
 * contra essa declaração — e os sinais de recusa, que valem para qualquer um.
 */
import { porExtenso } from '../format/numero';
import type { Conferencia, ProblemaDaConferencia } from './orquestrar';
import { casaPorPalavra, termosProibidosEm, type SubconjuntoProibido, type TermoAchado } from './verificar';

/* ── a sintaxe ───────────────────────────────────────────────────────────── */

/** O nome de um marcador — só letras minúsculas sem acento. */
const NOME_DE_MARCADOR = /^[a-z]+$/;

/** Um marcador bem formado, onde quer que esteja. */
const MARCADOR = /\{([a-z]+)\}/g;

/**
 * Um nome de marcador embrulhado em outra sintaxe: `${nome}`, `[nome]`, `<nome>`
 * e as chaves de largura cheia `｛nome｝`. O `${…}` sai antes de se procurar
 * marcador, senão o `{nome}` de dentro passaria por bem formado e sobraria um
 * cifrão na frase.
 */
const EMBRULHO = /\$\{[^{}]*\}|\[\s*[\p{L}\p{M}]+\s*\]|<\s*[\p{L}\p{M}]+\s*>|｛[^｛｝]*｝/gu;

/** O que sobra de chave depois de tirar os marcadores bem formados: `{Duração}`, `{}`, `{a`, `}`. */
const CHAVE_SOLTA = /\{[^{}]*\}|[{}｛｝]/gu;

/**
 * O sinal que só aparece na frase como sintaxe de chave: `$`, `%` e `@` — soltos
 * ou colados a um nome (`$percepcao`, `%percepcao%`, `{cobertura}%`) — e o
 * dois-pontos colado ao nome que vem depois dele (`:percepcao`). Na prosa de uma
 * frase sem número nenhum, nenhum deles tem uso: a porcentagem já vem dentro do
 * valor.
 */
const SINAL_DE_CHAVE = /[\p{L}\p{M}]*[$%@]+(?:[\p{L}\p{M}]+[$%@]*)?|:[\p{L}\p{M}]+/gu;

/**
 * Onde o marcador estava, na prosa: não é espaço — "duas {x} dimensões" não tem
 * "duas" logo antes de "dimensões" —, nem letra, nem sinal de chave.
 */
const NO_LUGAR_DO_MARCADOR = '¤';

/** Uma palavra da prosa. O hífen une: "meia-noite" é uma palavra. */
const PALAVRA = /[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu;

/** O marcador de um nome: `marcador('medidas')` é `{medidas}`. Nome fora da sintaxe é defeito, e lança. */
export function marcador(nome: string): string {
  if (!NOME_DE_MARCADOR.test(nome)) {
    throw new TypeError(`nome de marcador fora da sintaxe [a-z]+: ${JSON.stringify(nome)}`);
  }
  return `{${nome}}`;
}

/** Os nomes dos marcadores bem formados de um texto, sem repetição, na ordem em que aparecem. */
export function marcadoresEm(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(MARCADOR)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** O primeiro caractere em maiúscula, se for letra — "os últimos 7 dias…" abre frase como "Os últimos". */
function comMaiuscula(s: string): string {
  const [primeiro] = s;
  if (primeiro === undefined || !/\p{Ll}/u.test(primeiro)) return s;
  return primeiro.toUpperCase() + s.slice(primeiro.length);
}

/**
 * Troca cada marcador que tem valor, numa passada só. O que não tem valor fica
 * como está — ou lança, quando quem troca é a frase final.
 */
function trocar(texto: string, valores: Readonly<Record<string, string>>, semValor: 'fica' | 'lança'): string {
  return texto.replace(MARCADOR, (inteiro: string, nome: string) => {
    if (Object.hasOwn(valores, nome)) return valores[nome];
    if (semValor === 'fica') return inteiro;
    throw new RangeError(`o marcador {${nome}} não tem valor`);
  });
}

/**
 * Troca cada marcador pelo seu valor, numa passada só — um valor que contenha
 * chaves não é interpolado de novo —, e põe em maiúscula a primeira letra da
 * frase: um marcador que abre a frase vira valor em minúscula ("os últimos 7
 * dias"), e a frase não pode começar assim. Só a primeira letra, e só se o texto
 * começa por ela: "7h20 …" continua "7h20".
 *
 * Marcador sem valor lança: quem chama `interpolar` já conferiu o texto contra
 * o conjunto (o do motor, por {@link conferirInterpolado}; o do template, por
 * teste), e o conjunto é exatamente o que `valores` cobre. Chegar aqui com um
 * marcador sem valor é defeito do recurso, não do motor.
 */
export function interpolar(texto: string, valores: Readonly<Record<string, string>>): string {
  return comMaiuscula(trocar(texto, valores, 'lança'));
}

/**
 * Os pares de aspas, numa fonte só: é por eles que {@link limparResposta}
 * desembrulha a resposta e que `aspaQueSobra` acha o resto de embrulho malfeito.
 * Duas listas deixavam um par (`‚…‘`) que não era desembrulhado e ainda reprovava,
 * e as aspas iam para a frase.
 */
const PARES_DE_ASPAS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['‘', '’'],
  ['«', '»'],
  ['„', '“'],
  ['‚', '‘'],
];

/**
 * A resposta sem o espaço e as aspas que a embrulham — `"A duração…"` vira `A
 * duração…`. Aspas só saem quando embrulham o texto inteiro: se a mesma aspa
 * aparece dentro, ela é do texto, e fica.
 */
export function limparResposta(texto: string): string {
  let t = texto.trim();
  for (;;) {
    const par = PARES_DE_ASPAS.find(
      ([abre, fecha]) =>
        t.length >= abre.length + fecha.length &&
        t.startsWith(abre) &&
        t.endsWith(fecha) &&
        !t.slice(abre.length, t.length - fecha.length).includes(abre) &&
        !t.slice(abre.length, t.length - fecha.length).includes(fecha),
    );
    if (!par) return t;
    t = t.slice(par[0].length, t.length - par[1].length).trim();
  }
}

/* ── a regra ─────────────────────────────────────────────────────────────── */

/** Um item que o texto pode nomear — por extenso ou pelo marcador `{chave}`. */
export interface ItemInterpolado {
  /** A chave do item. É também o nome do marcador dele. */
  readonly chave: string;
  /** Como o texto o nomeia por extenso. */
  readonly rotulo: string;
  /**
   * Todas as formas que nomeiam o item na prosa — o rótulo, o plural e o que mais
   * o recurso declarar. Casam por palavra inteira, com o acento dobrado, e cada
   * uma como está: o casador não conjuga. Sem elas, só o rótulo.
   */
  readonly formas?: readonly string[];
}

/**
 * O que o caso exige que o texto traga — e cuja falta é recusa.
 *
 * - `item`: o item, **pelo nome**, na prosa. O marcador dele não conta: o valor
 *   ("± 22 min") não diz de que item é.
 * - `marcador`: o marcador, bem formado e do conjunto.
 * - `palavra`: a palavra, inteira, com o acento dobrado, na prosa.
 */
export type Exigencia =
  | { readonly item: string }
  | { readonly marcador: string }
  | { readonly palavra: string };

/**
 * O que o recurso declara para um texto: os valores do caso (o conjunto é o das
 * chaves deles), o lugar de cada marcador, os itens que o texto poderia nomear,
 * quais deles pode citar, o que tem de trazer, o que contradiz o caso, o
 * vocabulário que compõe e os numerais que o caso deixa escrever.
 */
export interface RegraInterpolada {
  /**
   * O valor de cada marcador do caso, já formatado. O conjunto de marcadores é o
   * das chaves, e cada chave tem de ser nome de marcador (`[a-z]+`) — senão ela
   * entraria no conjunto sem ser alcançável pelo texto.
   */
  readonly valores: Readonly<Record<string, string>>;
  /**
   * Onde um marcador vale: só logo antes de uma destas palavras. Sem entrada, o
   * marcador vale antes de qualquer coisa.
   */
  readonly antesDe?: Readonly<Record<string, readonly string[]>>;
  /** Onde um marcador não vale: logo depois de uma destas palavras. */
  readonly naoDepoisDe?: Readonly<Record<string, readonly string[]>>;
  /**
   * O que só o marcador diz: as palavras que, na prosa, o diriam de outro jeito —
   * e que por isso reprovam. Casam por palavra inteira, com o plural.
   */
  readonly soPeloMarcador?: Readonly<Record<string, readonly string[]>>;
  /** Todo item nomeável — é contra ele que se acha o item a mais. */
  readonly itens: readonly ItemInterpolado[];
  /** As chaves dos itens que o texto pode nomear. Os itens exigidos contam como citáveis. */
  readonly citaveis: readonly string[];
  /** O que o texto tem de trazer. A falta é recusa. */
  readonly exigidos: readonly Exigencia[];
  /**
   * As expressões que afirmam outro caso, ou um nível que o pedido não deu. Na
   * prosa, por palavra; a de uma palavra casa também com o plural, a de várias só
   * como está escrita.
   */
  readonly contradiz?: readonly string[];
  /** Os subconjuntos de `VOCABULARIO_PROIBIDO` que o recurso compõe. */
  readonly vocabulario: readonly SubconjuntoProibido[];
  /**
   * Os numerais por extenso que o caso deixa escrever fora de marcador, cada um
   * com as palavras de que ele tem de vir logo antes: a contagem que o próprio
   * caso diz ("duas", só em "duas dimensões"). Sem eles, nenhum.
   */
  readonly numerais?: Readonly<Record<string, readonly string[]>>;
}

/** Uma frase só, e curta: cabe numa linha da tela e na leitura em voz alta. */
export const TAMANHO_MAXIMO_DA_FRASE = 280;

/** Número de qualquer escrita, com o separador de milhar ou de decimal que vier colado. */
const ALGARISMO = /\p{N}+(?:[.,]\p{N}+)*/gu;

const QUEBRA_DE_LINHA = /[\r\n\u0085\u2028\u2029]/u;
const MARCACAO = /[*_#`~]/g;
/** O marcador de lista ou de citação que abre a resposta: "- ", "• ", "> ", "– ", "— ". */
const ABRE_COMO_LISTA = /^\s*[-•>–—]/u;
/** O caractere de formatação que não se vê: U+200B, U+FEFF, U+00AD… */
const INVISIVEL = /\p{Cf}/gu;
/** Caractere de controle: U+0000, tabulação, U+000B, U+000C. A quebra de linha tem regra própria. */
const CONTROLE = /\p{Cc}/gu;
/** Uma palavra só, com dois-pontos, abrindo a resposta: "Frase:", "Caso:". */
const ABRE_COM_ROTULO = /^\s*[\p{L}\p{M}]+\s*:/u;
/** O que vem antes de um dois-pontos no começo da resposta, se for curto — "Resposta final:". */
const ANTES_DO_DOIS_PONTOS = /^\s*([^:\r\n]{1,24}):/u;
/** As palavras que fazem de um começo curto um rótulo, e não uma frase. */
const PALAVRAS_DE_ROTULO: readonly string[] = ['frase', 'resposta', 'caso', 'leitura', 'saída', 'texto'];

/** A aspa que abre, e a que a fecha — derivadas dos pares, para não haver duas verdades. */
const FECHA_DA_ASPA: ReadonlyMap<string, string> = new Map(PARES_DE_ASPAS.map(([abre, fecha]) => [abre, fecha]));
/** A aspa que fecha, e as que a abrem. */
const ABRE_DA_ASPA: ReadonlyMap<string, readonly string[]> = PARES_DE_ASPAS.reduce((m, [abre, fecha]) => {
  m.set(fecha, [...(m.get(fecha) ?? []), abre]);
  return m;
}, new Map<string, string[]>());

/**
 * Sobra aspa numa ponta? As que embrulhavam a resposta inteira, `limparResposta`
 * já tirou; a que fica na ponta sem par — a reta em número ímpar, a curva que
 * abre sem fechar (ou fecha sem abrir) — é resto de embrulho malfeito. A aspa
 * na ponta que tem par dentro ("“Duração” e “horário” empatam") é do texto.
 */
function aspaQueSobra(texto: string): boolean {
  const t = texto.trim();
  if (t === '') return false;
  const primeira = t[0];
  const ultima = t[t.length - 1];
  const vezes = (a: string) => [...t].filter((c) => c === a).length;

  const fechaDaPrimeira = FECHA_DA_ASPA.get(primeira);
  // Aspa que só fecha, abrindo o texto.
  if (fechaDaPrimeira === undefined && ABRE_DA_ASPA.has(primeira)) return true;
  if (fechaDaPrimeira !== undefined) {
    if (fechaDaPrimeira === primeira ? vezes(primeira) % 2 === 1 : !t.slice(1).includes(fechaDaPrimeira)) return true;
  }

  const abremAUltima = ABRE_DA_ASPA.get(ultima);
  // Aspa que só abre, fechando o texto.
  if (abremAUltima === undefined && FECHA_DA_ASPA.has(ultima)) return true;
  if (abremAUltima !== undefined) {
    if (abremAUltima.includes(ultima) ? vezes(ultima) % 2 === 1 : !abremAUltima.some((a) => t.slice(0, -1).includes(a))) {
      return true;
    }
  }
  return false;
}

/** O fim da frase: a pontuação final, e o que pode fechar depois dela (aspas, parêntese). */
const FIM_DA_FRASE = /[.!?…]+[\s"'“”‘’«»)\]]*$/u;
const PONTUACAO_FINAL = /[.!?…]/u;

/**
 * Os numerais por extenso que a frase nunca escreve fora de marcador. De dois a
 * dez saem de {@link porExtenso}, nos dois gêneros — o dono da contagem por
 * extenso é um só; "um" e "uma" ficam de fora porque são artigo. Os de uma
 * palavra casam também com o plural ("dezenas", "terços").
 */
const NUMERAIS: readonly string[] = [
  'zero',
  ...new Set(
    Array.from({ length: 9 }, (_, i) => i + 2).flatMap((n) => [porExtenso(n, 'masculino'), porExtenso(n, 'feminino')]),
  ),
  'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
  'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa',
  'cem', 'cento',
  'duzentos', 'duzentas', 'trezentos', 'trezentas', 'quatrocentos', 'quatrocentas', 'quinhentos', 'quinhentas',
  'seiscentos', 'seiscentas', 'setecentos', 'setecentas', 'oitocentos', 'oitocentas', 'novecentos', 'novecentas',
  'mil', 'milhão', 'milhões', 'bilhão', 'bilhões',
  'dezena', 'dúzia', 'metade', 'dobro', 'triplo', 'terço',
  'meia hora', 'meia-noite', 'meio-dia', 'por cento',
];

/**
 * Os sinais de recusa — o modelo dizendo que não vai redigir, ou falando de si
 * no lugar da frase. Casam por palavra, na prosa, com o plural ("desculpas").
 * Um só já é recusa, com o que o caso exige presente ou não: "Desculpe, não posso
 * analisar a percepção" nomeia a percepção e não é leitura.
 */
const SINAIS_DE_RECUSA: readonly string[] = [
  'desculpe', 'desculpa', 'lamento', 'sinto muito', 'não posso', 'não consigo', 'não sou capaz',
  'não tenho acesso', 'como modelo', 'como assistente', 'modelo de linguagem', 'inteligência artificial',
  'sorry', 'unable', 'as an ai', 'i cannot',
];

interface Palavra {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
}

function palavrasDe(s: string): Palavra[] {
  return [...s.matchAll(PALAVRA)].map((m) => ({ texto: m[0], inicio: m.index, fim: m.index + m[0].length }));
}

/** A palavra que vem logo depois, separada só por espaço — ou nenhuma. */
function palavraDepois(s: string, fim: number): string | null {
  return /^\s+([\p{L}\p{M}]+)/u.exec(s.slice(fim))?.[1] ?? null;
}

/** A palavra que vem logo antes, separada só por espaço (ou colada) — ou nenhuma. */
function palavraAntes(s: string, inicio: number): string | null {
  return /([\p{L}\p{M}]+)\s*$/u.exec(s.slice(0, inicio))?.[1] ?? null;
}

/** `U+200B` — o código de um caractere, para o detalhe dizer qual é o que não se vê. */
function codigoDe(c: string): string {
  return `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * A resposta abre com rótulo? Uma palavra só com dois-pontos ("Frase:", "Caso:"),
 * ou um começo curto que traz uma palavra de rótulo ("Resposta final:"). O
 * dois-pontos no meio da frase não conta: é pontuação ("A dimensão mais baixa é a
 * regularidade: SRI 50").
 */
function ehRotulo(texto: string): boolean {
  if (ABRE_COM_ROTULO.test(texto)) return true;
  const antes = ANTES_DO_DOIS_PONTOS.exec(texto)?.[1];
  return antes !== undefined && PALAVRAS_DE_ROTULO.some((p) => casaPorPalavra(antes, p));
}

/** As duas são a mesma palavra, com o acento dobrado: "DIMENSOES" é "dimensões", "duas-feiras" não é "duas". */
function mesmaPalavra(a: string, b: string): boolean {
  return casaPorPalavra(a, b) && casaPorPalavra(b, a);
}

/** A palavra é uma destas. */
function ehUmaDe(palavra: string, lista: readonly string[]): boolean {
  return lista.some((p) => mesmaPalavra(palavra, p));
}

/**
 * Os termos de uma lista, sem o que o plural de um anterior já casa: "meses" é o
 * plural de "mês", e a mesma palavra da prosa daria dois achados.
 */
function semRedundantes(termos: readonly string[]): string[] {
  return termos.filter((t, i) => !termos.slice(0, i).some((antes) => casaPorPalavra(t, antes, { plural: true })));
}

/** As formas que nomeiam um item. */
function formasDe(item: ItemInterpolado): readonly string[] {
  return item.formas && item.formas.length > 0 ? item.formas : [item.rotulo];
}

const chaveDoAchado = ({ subconjunto, termo }: TermoAchado) => `${subconjunto}:${termo}`;

/**
 * Confere o texto de um motor contra a regra do caso. Lê o texto como o motor o
 * escreveu — é nele que um algarismo seria dele — e a frase em que ele vira: o
 * tamanho e o termo proibido que só nasce na troca são dela.
 */
export function conferirInterpolado(texto: string, regra: RegraInterpolada): Conferencia {
  const problemas: ProblemaDaConferencia[] = [];
  const achar = (r: string, detalhe: string) => {
    if (!problemas.some((p) => p.regra === r && p.detalhe === detalhe)) problemas.push({ regra: r, detalhe });
  };
  let sinalDeRecusa = false;

  const conjunto = new Set(Object.keys(regra.valores));
  // O que o recurso declarou errado é defeito dele, não do motor: nome de valor
  // fora da sintaxe ficaria inalcançável, e exigência que não se pode cumprir
  // viraria recusa-do-modelo em **toda** leitura do caso, calada.
  for (const nome of conjunto) {
    if (!NOME_DE_MARCADOR.test(nome)) {
      throw new TypeError(`o valor ${JSON.stringify(nome)} não tem nome de marcador ([a-z]+)`);
    }
  }
  const itemDe = new Map(regra.itens.map((i) => [i.chave, i]));
  for (const x of regra.exigidos) {
    if ('item' in x && !itemDe.has(x.item)) throw new TypeError(`a regra exige o item ${x.item}, que ela não declara`);
    if ('marcador' in x && !conjunto.has(x.marcador)) {
      throw new TypeError(`a regra exige o marcador {${x.marcador}}, que não está no conjunto dela`);
    }
    if ('palavra' in x && x.palavra.trim() === '') throw new TypeError('a regra exige uma palavra vazia');
  }
  // O texto em três leituras. O embrulho sai primeiro: o `{nome}` de dentro de um
  // `${nome}` não é marcador. A prosa é o que o motor escreveu por extenso — o
  // nome de um marcador não é prosa, e `{duracao}` não nomeia a duração.
  const semEmbrulho = texto.replace(EMBRULHO, ' ');
  const usados = marcadoresEm(semEmbrulho);
  const prosa = semEmbrulho.replace(MARCADOR, NO_LUGAR_DO_MARCADOR);
  const palavras = palavrasDe(prosa);
  // A frase como ela sairia: é nela que se mede o tamanho e se acha o termo que só
  // a troca forma. O marcador fora do conjunto fica como está — ele já reprova.
  const frase = comMaiuscula(trocar(texto, regra.valores, 'fica'));

  if (texto.trim() === '') {
    sinalDeRecusa = true;
    achar('recusa', 'o texto veio vazio');
  }

  // A forma: uma frase só, curta, sem nada em volta.
  if (QUEBRA_DE_LINHA.test(texto)) achar('forma', 'quebra de linha');
  for (const m of texto.match(MARCACAO) ?? []) achar('forma', `marcação: "${m}"`);
  if (ABRE_COMO_LISTA.test(texto)) achar('forma', 'abre como item de lista ou citação');
  for (const c of texto.match(INVISIVEL) ?? []) achar('forma', `caractere invisível ${codigoDe(c)}`);
  // O controle que a quebra de linha já pega tem a regra dela; o resto (U+0000,
  // tabulação, U+000B, U+000C) é forma.
  for (const c of texto.match(CONTROLE) ?? []) {
    if (!QUEBRA_DE_LINHA.test(c)) achar('forma', `caractere de controle ${codigoDe(c)}`);
  }
  if (ehRotulo(texto)) achar('forma', 'abre com rótulo e dois-pontos');
  if (aspaQueSobra(texto)) achar('forma', 'aspa que sobra na ponta');
  if (PONTUACAO_FINAL.test(texto.replace(FIM_DA_FRASE, ''))) achar('forma', 'mais de uma frase: pontuação final antes do fim');
  if ([...frase].length > TAMANHO_MAXIMO_DA_FRASE) achar('forma', `a frase passa de ${TAMANHO_MAXIMO_DA_FRASE} caracteres`);

  // O número: nenhum algarismo; e, fora de marcador, nenhum numeral por extenso
  // além dos que o caso diz — e esses, só no lugar deles.
  for (const n of new Set(texto.match(ALGARISMO) ?? [])) achar('algarismo', `o texto escreve "${n}"`);
  const numeraisDoCaso = regra.numerais ?? {};
  for (const numeral of NUMERAIS) {
    if (Object.hasOwn(numeraisDoCaso, numeral)) {
      const lugar = numeraisDoCaso[numeral];
      for (const p of palavras) {
        if (!mesmaPalavra(p.texto, numeral)) continue;
        const depois = palavraDepois(prosa, p.fim);
        if (depois === null || !ehUmaDe(depois, lugar)) {
          achar('extenso', `o texto escreve "${numeral}" fora de ${lugar.map((w) => `"${numeral} ${w}"`).join(' ou ')}`);
        }
      }
    } else if (casaPorPalavra(prosa, numeral, { plural: true })) {
      achar('extenso', `o texto escreve "${numeral}" por extenso`);
    }
  }

  // As chaves: o marcador embrulhado, o que sobra de chave fora dos bem formados,
  // o sinal de chave e a chave sem acento solta na prosa.
  for (const e of texto.match(EMBRULHO) ?? []) achar('chave', `marcador embrulhado: "${e}"`);
  for (const solta of prosa.match(CHAVE_SOLTA) ?? []) achar('chave', `chave malformada: "${solta}"`);
  for (const s of semEmbrulho.replace(MARCADOR, ' ').match(SINAL_DE_CHAVE) ?? []) achar('chave', `sinal de chave: "${s}"`);
  for (const item of regra.itens) {
    const rotulo = item.rotulo.normalize('NFC').toLowerCase();
    // A chave que é o rótulo sem acento ("duracao" de "duração") é chave, não nome.
    if (item.chave === rotulo || !casaPorPalavra(item.chave, rotulo)) continue;
    if (palavras.some((p) => p.texto.normalize('NFC').toLowerCase() === item.chave)) {
      achar('chave', `a chave "${item.chave}" solta na prosa, sem as chaves e sem o acento`);
    }
  }

  // O conjunto, a repetição e o lugar de cada marcador.
  for (const nome of usados) {
    if (!conjunto.has(nome)) achar('marcador', `{${nome}} não é marcador deste caso`);
  }
  const vezes = new Map<string, number>();
  for (const m of semEmbrulho.matchAll(MARCADOR)) vezes.set(m[1], (vezes.get(m[1]) ?? 0) + 1);
  for (const [nome, n] of vezes) if (n > 1) achar('marcador', `{${nome}} aparece ${n} vezes — cada marcador vai uma vez só`);
  for (const m of semEmbrulho.matchAll(MARCADOR)) {
    const nome = m[1];
    const antesDe = regra.antesDe && Object.hasOwn(regra.antesDe, nome) ? regra.antesDe[nome] : null;
    if (antesDe) {
      const depois = palavraDepois(semEmbrulho, m.index + m[0].length);
      if (depois === null || !ehUmaDe(depois, antesDe)) {
        achar('marcador', `{${nome}} só vale logo antes de ${antesDe.map((p) => `"${p}"`).join(' ou ')}`);
      }
    }
    const naoDepoisDe = regra.naoDepoisDe && Object.hasOwn(regra.naoDepoisDe, nome) ? regra.naoDepoisDe[nome] : null;
    if (naoDepoisDe) {
      const antes = palavraAntes(semEmbrulho, m.index);
      if (antes !== null && ehUmaDe(antes, naoDepoisDe)) achar('marcador', `{${nome}} não vale logo depois de "${antes}"`);
    }
  }
  // O que só o marcador diz: a palavra, e **todos** os marcadores que a dizem —
  // `{janela}` e `{quando}` nomeiam a mesma janela, e o detalhe não pode apontar só
  // um deles quando o texto usou o outro.
  const quemDiz = new Map<string, string[]>();
  for (const [nome, ditas] of Object.entries(regra.soPeloMarcador ?? {})) {
    for (const dita of ditas) {
      const nomes = quemDiz.get(dita) ?? [];
      if (!nomes.includes(nome)) nomes.push(nome);
      quemDiz.set(dita, nomes);
    }
  }
  for (const dita of semRedundantes([...quemDiz.keys()])) {
    if (!casaPorPalavra(prosa, dita, { plural: true })) continue;
    const nomes = quemDiz.get(dita)!;
    const lista = nomes.map((n) => `{${n}}`).join(' e ');
    achar('marcador', `a prosa diz "${dita}", que só ${lista} ${nomes.length > 1 ? 'dizem' : 'diz'}`);
  }

  // Os itens: o que não é citável não aparece, pelo nome nem pelo marcador.
  const itensExigidos = regra.exigidos.flatMap((x) => ('item' in x ? [x.item] : []));
  const podem = new Set([...regra.citaveis, ...itensExigidos]);
  const nomeado = (item: ItemInterpolado) => formasDe(item).some((f) => casaPorPalavra(prosa, f));
  for (const item of regra.itens) {
    if (!podem.has(item.chave) && (nomeado(item) || usados.includes(item.chave))) {
      achar('a-mais', `nomeia ${item.rotulo}, que este caso não cita`);
    }
  }

  // O que afirma outro caso.
  for (const termo of semRedundantes(regra.contradiz ?? [])) {
    if (casaPorPalavra(prosa, termo, { plural: true })) achar('contradicao', `"${termo}" afirma o que o caso não diz`);
  }

  // O vocabulário: o do texto, e o que só nasce na troca — o termo da frase que
  // nenhum valor sozinho traz ("devido {janela}" vira "devido as últimas…"). Só os
  // valores que o texto **usou** descontam: um valor que ficou de fora esconderia
  // um termo que a troca formou.
  const dosValores = new Set(
    usados
      .filter((n) => conjunto.has(n))
      .flatMap((n) => termosProibidosEm(regra.valores[n], regra.vocabulario).map(chaveDoAchado)),
  );
  const vocabulario = [
    ...termosProibidosEm(texto, regra.vocabulario),
    ...termosProibidosEm(frase, regra.vocabulario).filter((a) => !dosValores.has(chaveDoAchado(a))),
  ];
  for (const { subconjunto, termo } of vocabulario) achar('vocabulario', `${subconjunto}: "${termo}"`);

  // A recusa pelo sinal: basta um.
  for (const sinal of SINAIS_DE_RECUSA) {
    if (casaPorPalavra(prosa, sinal, { plural: true })) {
      sinalDeRecusa = true;
      achar('recusa', `sinal de recusa: "${sinal}"`);
    }
  }

  // A presença: o que o caso exige tem de estar lá.
  for (const x of regra.exigidos) {
    let achado: boolean;
    let oQue: string;
    if ('item' in x) {
      const item = itemDe.get(x.item)!;
      achado = nomeado(item);
      oQue = `não nomeia ${item.rotulo}`;
    } else if ('marcador' in x) {
      achado = usados.includes(x.marcador);
      oQue = `não usa {${x.marcador}}`;
    } else {
      achado = casaPorPalavra(prosa, x.palavra);
      oQue = `não diz "${x.palavra}"`;
    }
    if (!achado) achar('ausente', `${oQue}, que o caso exige`);
  }

  if (problemas.length === 0) return { ok: true };
  // **Recusa é o sinal, ou a falta e nada mais.** O motor que nomeia a dimensão
  // errada acumula `a-mais` e `ausente`: isso é texto errado, não recusa — e a
  // bancada da 5.4 contaria troca de dimensão como modelo que se recusou.
  const recusa = sinalDeRecusa || problemas.every((p) => p.regra === 'ausente');
  return recusa ? { ok: false, problemas, recusa: true } : { ok: false, problemas };
}
