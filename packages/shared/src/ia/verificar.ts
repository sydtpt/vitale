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
 *   6. o texto não é o pedido de volta
 *   7. a relação afirmada sobre o número concorda com o delta
 *   8. o período se chama pelo que é
 *
 * A quinta muda a pergunta que a conferência faz. As quatro primeiras perguntam
 * *"esse número existe?"*; a quinta pergunta *"esse número existe **como B2**, e
 * a frase diz **B2**?"*. Três bases sem nome são um alfabeto três vezes maior;
 * três bases com nome são uma **gramática** — o número tem que bater e a
 * preposição junto.
 *
 * ## A sexta, e por que ela teve de existir (25/09/2026)
 *
 * As cinco primeiras eram todas sobre **o que o texto afirma**, e havia uma
 * estratégia que passava em todas sem escrever nada: **copiar o pedido**. Todo
 * número de uma cópia vem do pacote por definição, nenhuma palavra de causa
 * aparece, nenhuma correlação é promovida, a ressalva está copiada junto e cada
 * base vem colada ao valor dela — porque foi o prompt que a colou.
 *
 * A corrida de 25/09, cinco motores sobre o mesmo caderno Movimento, mediu o
 * portão ao contrário:
 *
 * | motor | antes | o que escreveu |
 * |---|---|---|
 * | modelo do aparelho (Apple) | **reprovada** | prosa de revista, números certos |
 * | Qwen3 1.7B | reprovada | prosa ruim, fatos errados |
 * | Tucano2 1.5B | **ok** | o pedido de volta, linha de instrução inclusive |
 * | Qwen3 4B | **ok** | o pedido de volta, em negrito |
 * | Qwen3 4B misto | reprovada | truncado em 9 tokens |
 *
 * As duas cópias aprovadas e o melhor texto reprovado. A sexta regra fecha a
 * porta por onde as duas passaram, e as duas correções abaixo — a máscara das
 * datas e a aproximação marcada — tiram do caminho as duas reprovações que eram
 * **nossas**, não do modelo.
 *
 * ## A sétima e a oitava: um `ok` não queria dizer o que parecia (25/09, à tarde)
 *
 * A corrida rodou de novo com o portão consertado, agora com a nuvem na mesa. As
 * duas cópias reprovaram por eco e os dois textos de prosa passaram — as correções
 * funcionaram. Mas **ler os textos aprovados** achou o que faltava: as seis regras
 * conferem se o **número** está no pacote, e nenhuma conferia se a **relação**
 * afirmada sobre ele é verdadeira.
 *
 * | motor | veredito das 6 | o que o texto afirmava |
 * |---|---|---|
 * | modelo do aparelho | **ok**, 11,7 s | *"as atividades dobrou"* (1 → 3 é +200%), *"66,7% do total do mês anterior"* (é o crescimento), semana chamada de "mês" 5× |
 * | Qwen3 1.7B | **ok**, 38,8 s | *"a distância permaneceu estática"* (0 → 56 km), *"o tempo foi reduzido"* (1,0 → 2,8 h) — e **nenhum número citado**, então nada a conferir |
 * | a nuvem | ok, 24,3 s | tudo certo, e o pacote em voz alta |
 *
 * O 1.7B é o caso que prova a necessidade: ele passa **porque** não cita número.
 * `numerosDoPacote` guarda `Math.abs(v)` — *"deltas citados sem o sinal"* —, então
 * o sinal do delta nunca teve leitor. A sétima regra é esse leitor; a oitava lê o
 * `periodo.tipo`, que está no pacote desde a versão 1 e também nunca teve um.
 *
 * As duas foram medidas contra **as sete edições reais de produção** antes de
 * entrar, e a primeira forma delas — julgar a frase inteira — dava **cinco falsos
 * positivos** em prosa boa. A forma que entrou exige **unanimidade** na janela de
 * decisão e dá **zero**, sem perder nenhuma das reprovações verdadeiras. A
 * medição está em `verificar-corrida.test.ts` e em `verificar-relacao.test.ts`.
 *
 * Puro, sem rede, sem provedor — roda igual sobre a saída de qualquer modelo, o
 * que é justamente o que faz trocar de fornecedor custar uma tarde (ADR 0040).
 */
import { terminaFrase } from '../format/frase';
import type { PeriodKind } from '../period/bounds';
import { MONTHS_PT, periodProseLabel } from '../period/bounds';
import type { BaseId, PacoteDeFatos, UmOuMaisPacotes } from './pacote';
import {
  BASE_ROTULO, procedenciaDoPacote, ressalvasObrigatorias, valoresDoPacote,
} from './pacote';

export interface Problema {
  regra: 'numero' | 'causa' | 'correlacao' | 'ressalva' | 'base' | 'eco' | 'relacao' | 'periodo';
  detalhe: string;
}

/**
 * Uma aproximação que a regra 1 **aceitou** — o registro que o dono pediu para
 * poder rever a forma da exceção com casos reais (25/09/2026).
 *
 * Ele abriu a exceção lendo dois textos, e disse que precisaria de mais exemplos
 * para ter convicção sobre a forma dela. Sem registro, o custo de revisá-la
 * depois seria rodar tudo de novo; com registro, cada edição impressa deixa a
 * lista do que passou por aqui e por quê — a marca, o número que o texto
 * afirmou, o número do pacote e a granularidade do arredondamento.
 *
 * **Fora dos `problemas`, de propósito.** Aproximação aceita não é defeito; se
 * ela entrasse na lista de problemas, `ok` viraria `false` e a exceção
 * reprovaria o que existe para aprovar.
 */
export interface AproximacaoAceita {
  /** Como o texto escreveu o número — `"12"` em *"mais de 12 mil"*. */
  readonly bruto: string;
  /** A marca que a autorizou — `"mais de"`. */
  readonly marca: string;
  /** O que o texto afirma, já com a escala da palavra ao lado: `12 mil` → 12000. */
  readonly valor: number;
  /** O número do pacote de que ele é arredondamento — 12338. */
  readonly doPacote: number;
  /** A granularidade do arredondamento: 0,1 · 1 · 10 · 100 · 1000. */
  readonly granularidade: number;
}

export interface Veredito {
  ok: boolean;
  problemas: Problema[];
  /**
   * As aproximações marcadas que a regra 1 aceitou — **ausente** quando não
   * houve nenhuma, para o caminho de sucesso continuar sendo `{ ok, problemas }`
   * e nada mais.
   */
  aproximacoes?: readonly AproximacaoAceita[];
}

/**
 * Os termos proibidos, com um dono só (AD-6, story 5.2).
 *
 * Nenhum outro arquivo do núcleo declara lista de termo proibido — o
 * `architecture.test.ts` cobra. Cada recurso **compõe** os subconjuntos que
 * valem para ele: a revista compõe só `causa`, na regra 2 de
 * {@link verificarTexto}; a Saúde do sono compõe os seis, por
 * {@link termosProibidosEm} (story 5.3). Cada termo traz a fonte ao lado.
 *
 * ## Dois casamentos, e quem compõe diz qual
 *
 * - **A revista casa `causa` por trecho**, em minúsculas, como sempre casou.
 *   Mudar o casamento dela mudaria o que a revista reprova.
 * - **{@link termosProibidosEm} casa por palavra inteira**, com o acento dobrado,
 *   o plural em -s/-es do termo de uma palavra ("metas", "placares") e a
 *   contração da preposição com que termina o termo de várias palavras ("devido
 *   ao", "graças aos", "por conta disso", "resultou na", "resultou nele"). Por trecho, "tente"
 *   casa com "consistente" e "meta" com "metade" — falso positivo dentro de
 *   palavra legítima. É o casamento de todo recurso novo, `causa` inclusive
 *   quando ele a compõe.
 *
 * ## As flexões são termo, não regra
 *
 * O casador só sabe o plural nominal e a contração da preposição final. A flexão
 * verbal ("recomenda", "pioram") e o plural irregular ("pontuações",
 * "sugestões") entram na lista como termo próprio (story 5.3): um casador que
 * conjugasse verbo seria uma segunda gramática, e erraria calado. "Melhore" e
 * "piore" casam sem o plural, porque o plural deles é o comparativo ("as piores
 * noites"). "Deve", "precisa", "melhor" e "pior" ficam de fora: "precisa de 5
 * noites seguidas" é fato que a Saúde escreve.
 *
 * ## O que ficou de fora de propósito
 *
 * Colidem com texto que a Saúde do sono já escreve (`docs/specs/sono/spec.md`,
 * CAP-13, e `sleep/score.ts`): "nota" (a percepção sai como `3,3/5 · 12
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
    'recomenda',                        // flexão de "recomendo" — story 5.3, Design Notes
    'recomendamos',                     // flexão de "recomendo" — story 5.3
    'recomendam',                       // flexão de "recomendo" — story 5.3
    'recomendar',                       // flexão de "recomendo" — story 5.3
    'recomendado',                      // flexão de "recomendo" — story 5.3
    'recomendável',                     // flexão de "recomendo" — story 5.3
    'recomendação',                     // flexão de "recomendo" — story 5.3
    'recomendações',                    // plural irregular de "recomendação" — story 5.3
    'sugere',                           // flexão de "sugiro"; SISTEMA de ia/prompt.ts, "não sugere"
    'sugerimos',                        // flexão de "sugiro" — story 5.3
    'sugerir',                          // flexão de "sugiro" — story 5.3
    'sugerido',                         // flexão de "sugiro" — story 5.3
    'sugestão',                         // flexão de "sugiro" — story 5.3
    'sugestões',                        // plural irregular de "sugestão" — story 5.3
    'experimentar',                     // flexão de "experimente" — story 5.3
    'deveria',                          // conselho no condicional — story 5.3; "deve" fica de fora
    'deveriam',                         // idem — story 5.3
    'evite',                            // o imperativo do conselho — story 5.3, Design Notes
    'evitar',                           // story 5.3
    'tente',                            // story 5.3 — "tente dormir mais" sem o resto
    'tentar',                           // story 5.3
    'procure',                          // story 5.3
    'procurar',                         // story 5.3
    'considere',                        // story 5.3
    'considerar',                       // story 5.3
    'mantenha',                         // story 5.3
    'o ideal',                          // story 5.3 — "o ideal seria deitar mais cedo"
    'vale a pena',                      // revisão 3 da 5.3 — a frase longa não pega "vale a pena deitar mais cedo"
  ] as const),
  /** Nem parabeniza, nem celebra — `tudo-no-maximo` diz isso sem elogio (CAP-13). */
  elogio: Object.freeze([
    'parabéns',         // SISTEMA de ia/prompt.ts ("parabéns pelo mês"); review-rubrica.md, A4
    'continue assim',   // SISTEMA de ia/prompt.ts; review-rubrica.md, A4
    'conquista',        // retrospectiva/v2-jornal.md §3 ("narrar um gap de firmware como conquista")
    'ótimo',            // story 5.3, Design Notes — o elogio que a frase de tudo-no-maximo convida
    'ótima',            // story 5.3 — o feminino: "uma semana ótima"
    'excelente',        // story 5.3
    'perfeito',         // story 5.3
    'perfeita',         // story 5.3 — o feminino
    'muito bem',        // story 5.3
  ] as const),
  /** A Saúde do sono é contagem, não placar (ADR 0036). */
  placar: Object.freeze([
    'placar',           // sono/spec.md §2; ADR 0036, "Risco real"; v2-jornal.md §9
    'score',            // sono/spec.md CAP-5 e §5 ("score / nota de sono de qualquer tipo")
    'pontuação',        // ADR 0036 — o composto normalizado que ela proíbe
    'pontos',           // ADR 0036 — idem; "ponto" no singular fica de fora (ver acima)
    'de 0 a 100',       // sono/spec.md §2 ("nem nota de 0 a 100")
    'saldo',            // v2-jornal.md §9 ("saldo contra 7 h — tem cara de placar")
    'pontuações',       // plural irregular de "pontuação" — story 5.3, Design Notes
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
    'melhorar',         // flexão de "melhorou" — story 5.3, Design Notes
    'melhoram',         // flexão de "melhorou" — story 5.3
    'melhoraram',       // flexão de "melhorou" — story 5.3
    'melhorando',       // flexão de "melhorou" — story 5.3
    'melhorado',        // flexão de "melhorou" — story 5.3
    'melhore',          // flexão de "melhorou" — story 5.3; casa sem o plural ("as melhores noites" passa)
    'melhoria',         // o nome de "melhorou" — story 5.3; o plural do casador pega "melhorias"
    'piorar',           // flexão de "piorou" — story 5.3
    'pioram',           // flexão de "piorou" — story 5.3
    'pioraram',         // flexão de "piorou" — story 5.3
    'piorando',         // flexão de "piorou" — story 5.3
    'piorado',          // flexão de "piorou" — story 5.3
    'piore',            // flexão de "piorou" — story 5.3; casa sem o plural ("as piores noites" passa)
    'subiu',            // direção — story 5.3, Design Notes
    'subiram',          // story 5.3
    'subir',            // story 5.3
    'caiu',             // story 5.3
    'caíram',           // story 5.3
    'cair',             // story 5.3
    'aumentou',         // story 5.3
    'aumentaram',       // story 5.3
    'aumentar',         // story 5.3
    'diminuiu',         // story 5.3
    'diminuíram',       // story 5.3
    'diminuir',         // story 5.3
    'evoluiu',          // story 5.3
    'evoluir',          // story 5.3
    'em alta',          // story 5.3
    'em queda',         // story 5.3
    'tendência',        // revisão 3 da 5.3 — o subconjunto tem o nome e não proibia a palavra
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

/** Um termo proibido que apareceu num texto, e o subconjunto que o proíbe. */
export interface TermoAchado {
  readonly subconjunto: SubconjuntoProibido;
  readonly termo: string;
}

/**
 * Minúsculas e sem acento, para o casamento por palavra. Diferente de
 * `normalizar`, lá embaixo, esta pode mudar o comprimento: ninguém recorta
 * janela por posição sobre ela.
 */
function dobrar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** O termo na forma em que se compara: dobrado, com o espaço colapsado. "Devido à" e "devido a" são um só. */
function formaDobrada(termo: string): string {
  return dobrar(termo).replace(/\s+/g, ' ').trim();
}

/**
 * Letra ou algarismo de qualquer escrita — o que continua uma palavra.
 *
 * **Sem lookbehind de propósito.** O `index.ts` reexporta este módulo, então
 * `PADROES_DO_VOCABULARIO` compila no boot do app, e não há precedente de
 * lookbehind em código que roda no Hermes (nem binário dele aqui para medir). Um
 * grupo que casa o começo ou um caractere que não é de palavra é equivalente para
 * um teste booleano: o que ele consome a mais não é palavra, e ocorrências
 * adjacentes continuam sem casar ("aa" não casa "a").
 */
const FORA_DA_PALAVRA_ANTES = '(?:^|[^\\p{L}\\p{N}])';
const FORA_DA_PALAVRA_DEPOIS = '(?![\\p{L}\\p{N}])';

/**
 * As formas da preposição com que termina um termo de várias palavras, já
 * dobradas — "à", "às" e "àquele" viram "a", "as" e "aquele". "Devido a" casa
 * também "devido ao", "graças aos", "levou àquilo"; "por conta de", "por conta
 * do", "por conta disso"; "resultou em", "resultou na", "resultou num".
 *
 * Lida por `Object.hasOwn`: a última palavra de um termo não pode achar forma no
 * protótipo ("constructor", "toString").
 */
const CONTRACOES: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'ao', 'aos', 'as', 'aquele', 'aqueles', 'aquela', 'aquelas', 'aquilo'],
  de: [
    'de', 'do', 'da', 'dos', 'das', 'dum', 'duma', 'disso', 'disto', 'daquilo', 'desse', 'desses',
    'dessa', 'dessas', 'deste', 'destes', 'desta', 'destas', 'daquele', 'daqueles', 'daquela',
    'daquelas', 'dele', 'deles', 'dela', 'delas',
  ],
  em: [
    'em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'nisso', 'nisto', 'naquilo', 'nesse', 'nesses',
    'nessa', 'nessas', 'neste', 'nestes', 'nesta', 'nestas', 'naquele', 'naqueles', 'naquela',
    'naquelas', 'nele', 'neles', 'nela', 'nelas',
  ],
};

/**
 * Os termos de uma palavra que casam **sem** o plural: o plural de "melhore" e
 * "piore" é o comparativo — "as melhores noites", "as piores noites" —, que a
 * Saúde pode escrever. Já dobrados.
 */
const SEM_PLURAL: ReadonlySet<string> = new Set(['melhore', 'piore']);

/** As formas além da palavra exata que o casador sabe. Nenhuma, se não pedidas. */
export interface FormasDoTermo {
  /** O plural em -s/-es — só para termo de uma palavra: "metas", "placares". */
  readonly plural?: boolean;
  /** A contração da preposição final — só para termo de várias palavras terminado em a/à, de ou em. */
  readonly contracao?: boolean;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * O padrão de um termo já dobrado. O plural nominal só vale para a palavra
 * sozinha — "outras pessoass" não é forma de nada — e fora de {@link SEM_PLURAL};
 * a contração só para a preposição que fecha um termo de várias palavras: "a"
 * sozinho é artigo.
 */
function compilar(dobrado: string, formas: FormasDoTermo): RegExp {
  const palavras = dobrado.split(' ');
  const partes = palavras.map(escapar);
  const ultima = palavras[palavras.length - 1];
  if (palavras.length === 1 && formas.plural && !SEM_PLURAL.has(dobrado)) {
    partes[0] = `${partes[0]}(?:s|es)?`;
  } else if (palavras.length > 1 && formas.contracao && Object.hasOwn(CONTRACOES, ultima)) {
    partes[partes.length - 1] = `(?:${CONTRACOES[ultima].join('|')})`;
  }
  return new RegExp(`${FORA_DA_PALAVRA_ANTES}${partes.join('\\s+')}${FORA_DA_PALAVRA_DEPOIS}`, 'u');
}

/**
 * O termo aparece no texto **como palavra inteira**, com o acento dobrado dos
 * dois lados? "meta" não casa com "metade", nem "piora" com "pioram"; "PARABENS"
 * casa com "parabéns". As {@link FormasDoTermo} acrescentam o plural e a
 * contração — só quando pedidas.
 *
 * É o casador de {@link termosProibidosEm}, da presença de um item e dos
 * numerais no regime interpolado (`ia/interpolar.ts`) — um casador só. Não
 * guarda nada entre chamadas: quem o chama com termos que não são do vocabulário
 * (o rótulo de uma dimensão, uma palavra do alcance) não faz memória crescer.
 */
export function casaPorPalavra(texto: string, termo: string, formas: FormasDoTermo = {}): boolean {
  const dobrado = formaDobrada(termo);
  if (dobrado === '') return false;
  return compilar(dobrado, formas).test(dobrar(texto));
}

/**
 * Os padrões do vocabulário, compilados uma vez, pela forma dobrada. A lista é
 * congelada, então o mapa tem o tamanho dela e não cresce; "devido a" e "devido
 * à" caem na mesma chave.
 */
const PADROES_DO_VOCABULARIO: ReadonlyMap<string, RegExp> = new Map(
  Object.values(VOCABULARIO_PROIBIDO)
    .flat()
    .map((termo) => formaDobrada(termo))
    .map((dobrado) => [dobrado, compilar(dobrado, { plural: true, contracao: true })] as const),
);

/**
 * Os termos proibidos que um texto usa, dos subconjuntos que o recurso compõe.
 *
 * Casa por palavra inteira, com o acento dobrado, o plural em -s/-es do termo de
 * uma palavra e a contração da preposição final do termo de várias
 * ({@link casaPorPalavra}). Um achado por termo **dobrado**: o termo repetido no
 * texto, o par que só difere no acento ("devido a", "devido à") e o que mora em
 * dois subconjuntos compostos juntos ("continue assim" é conselho e elogio)
 * aparecem uma vez, com a primeira grafia e o primeiro subconjunto da ordem
 * pedida.
 *
 * Não é o casamento da revista: {@link verificarTexto} segue casando `causa` por
 * trecho, como sempre casou.
 */
export function termosProibidosEm(
  texto: string,
  subconjuntos: readonly SubconjuntoProibido[],
): TermoAchado[] {
  const alvo = dobrar(texto);
  const achados: TermoAchado[] = [];
  const vistos = new Set<string>();
  for (const subconjunto of subconjuntos) {
    for (const termo of VOCABULARIO_PROIBIDO[subconjunto]) {
      const dobrado = formaDobrada(termo);
      // A mesma forma dobrada tem o mesmo padrão: se não casou antes, não casa agora.
      if (vistos.has(dobrado)) continue;
      vistos.add(dobrado);
      if (PADROES_DO_VOCABULARIO.get(dobrado)!.test(alvo)) achados.push({ subconjunto, termo });
    }
  }
  return achados;
}

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
  // O que termina uma frase tem dono único em `format/frase.ts` (story 1.8): a
  // chamada da revista lê a mesma regra, e as duas nunca discordam sobre onde a
  // frase acaba. Mudar a regra lá muda o que esta conferência reprova.
  let ini = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (terminaFrase(texto, i)) { ini = i + 1; break; }
  }
  let fim = texto.length;
  for (let i = pos; i < texto.length; i += 1) {
    if (terminaFrase(texto, i)) { fim = i; break; }
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
 * Um dia do período desmontado nas peças de que as grafias são feitas.
 *
 * `dias` traz as duas formas com que a prosa escreve o dia: a do ISO (`"01"`) e
 * a sem zero (`"1"`), que é a que `dataPorExtenso` usa em `ia/prompt.ts`. Acima
 * de nove as duas coincidem e o `Set` as junta.
 */
interface DiaDoPeriodo {
  readonly dd: string;
  readonly mm: string;
  readonly ano: string;
  readonly dias: readonly string[];
  /** `"setembro"` — minúsculo, como o prompt o escreve; o casamento é sem caixa. */
  readonly mes: string;
}

function diaDoPeriodo(iso: string): DiaDoPeriodo | null {
  const [ano, mm, dd] = iso.split('-');
  if (ano === undefined || mm === undefined || dd === undefined) return null;
  const nome = MONTHS_PT[Number(mm) - 1];
  if (nome === undefined) return null;
  return { dd, mm, ano, mes: nome.toLowerCase(), dias: [...new Set([dd, String(Number(dd))])] };
}

/** O que a prosa põe entre os dois dias de um intervalo contraído. */
const ENTRE_OS_DIAS: readonly string[] = [
  ' a ', ' e ', ' até ',
  '-', ' - ', '–', ' – ', '—', ' — ',
];

/**
 * As datas do período em **toda grafia que a prosa admite** — para saírem de
 * cena antes da varredura de números.
 *
 * ## O que a máscara cobre, e por quê
 *
 * - **ISO** (`2026-09-14`): pelo regex, em {@link semAsDatasDoPeriodo}.
 * - **`dd/mm` e `dd/mm/aaaa`** (22/09/2026): é como o cabeçalho do caderno
 *   imprime o intervalo — `# 14/09 - 20/09`. Medido no iPhone: todo modelo que
 *   repetia o cabeçalho era reprovado por quatro números — "14", "09", "20",
 *   "09" — que são o próprio período que o pacote deu, e **metade da reprovação
 *   era nossa**.
 * - **por extenso** (`14 de setembro de 2026`, `14 de setembro`) e **o intervalo
 *   contraído** (`14 a 20 de setembro de 2026`), acrescentados em 25/09/2026. A
 *   forma por extenso tinha ficado de fora, e o mesmo erro voltou: o melhor dos
 *   cinco textos da corrida — o do modelo do aparelho — foi reprovado por
 *   escrever *"Movimento – 14 a 20 de setembro de 2026"*. O período **é** 14 a 20
 *   de setembro. O `ignoravel()` já dispensa `20`, porque vem seguido de "de"; o
 *   `14` não vem, e era ele o `"14" não está no pacote`.
 *
 * O intervalo de **meses diferentes** (`28 de agosto a 3 de setembro de 2026`)
 * não precisa de forma própria: as duas datas sozinhas o cobrem, uma de cada
 * lado do "a". Só o contraído precisa, porque nele o primeiro dia não vem
 * seguido de "de".
 *
 * ## O que a máscara NÃO cobre, e por quê
 *
 * - **Nunca um `\d{2}/\d{2}` genérico.** Mascara-se só o que o pacote conhece:
 *   um "7/7" escrito por engano continua sendo número a conferir, e o modelo não
 *   ganha um buraco por onde inventar par de algarismos. Há teste provando que
 *   `7/7` e `03/07` seguem reprovando.
 * - **A forma sem zero da barra** (`1/8`): `1/8` casa **dentro** de `21/8`, e
 *   comeria o dígito de outro número. O cabeçalho que o modelo copia sai sempre
 *   com zero, então a forma não existe no que se quer dispensar.
 * - **A data de uma lápide e a do período anterior**, embora o pacote as conheça.
 *   Mascará-las apagaria o **nome do mês** junto — e é ele que a quinta regra lê:
 *   numa edição de agosto, "14 de julho" nomeia B1, e há teste provando que
 *   apagá-lo muda o veredito de um valor de base citado sem nome. A data de
 *   lápide por extenso já passa sem máscara, pela dispensa do "de" em
 *   `ignoravel()`.
 */
function grafiasDasDatas(pacotes: readonly PacoteDeFatos[]): readonly string[] {
  const fora = new Set<string>();
  for (const p of pacotes) {
    const i = diaDoPeriodo(p.periodo.inicioISO);
    const f = diaDoPeriodo(p.periodo.fimISO);
    for (const d of [i, f]) {
      if (d == null) continue;
      fora.add(`${d.dd}/${d.mm}/${d.ano}`);
      fora.add(`${d.dd}/${d.mm}`);
      for (const dia of d.dias) {
        fora.add(`${dia} de ${d.mes} de ${d.ano}`);
        fora.add(`${dia} de ${d.mes}`);
      }
    }
    if (i != null && f != null && i.mm === f.mm && i.ano === f.ano) {
      for (const a of i.dias) {
        for (const b of f.dias) {
          for (const entre of ENTRE_OS_DIAS) {
            fora.add(`${a}${entre}${b} de ${f.mes} de ${f.ano}`);
            fora.add(`${a}${entre}${b} de ${f.mes}`);
          }
        }
      }
    }
  }
  // As mais longas primeiro: mascarar `14/09` antes de `14/09/2026` deixaria o
  // ano solto no texto, e ele voltaria como número inventado. Numa alternação, a
  // ordem das alternativas é a ordem em que o casador as tenta.
  return [...fora].sort((a, b) => b.length - a.length);
}

/**
 * O texto sem as datas do período, em qualquer grafia e em qualquer caixa.
 *
 * Um casador só, com `\b` nas duas pontas. A fronteira entrou junto com as
 * grafias por extenso, e é o que impede a máscara de comer dígito alheio:
 * `\b01/08\b` não casa dentro de `101/08`, e `\b14 de setembro\b` não casa dentro
 * de `114 de setembro`. Sem lookbehind — `\b` resolve as duas pontas, e o
 * arquivo inteiro evita lookbehind por não haver precedente dele no Hermes.
 *
 * A substituição é por **um espaço**, e não pelo mesmo número de caracteres: nada
 * aqui compara posição com o texto original — `citacoes` e a quinta regra leem as
 * duas o resultado desta função.
 */
function semAsDatasDoPeriodo(texto: string, pacotes: readonly PacoteDeFatos[]): string {
  const semISO = texto.replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  const grafias = grafiasDasDatas(pacotes);
  if (grafias.length === 0) return semISO;
  return semISO.replace(new RegExp(`\\b(?:${grafias.map(escapar).join('|')})\\b`, 'gi'), ' ');
}

/* ───────────────────────── a aproximação marcada ───────────────────────── */

/**
 * Para que lado a marca aponta: o número do pacote tem de ser maior, menor, ou
 * qualquer um dos dois.
 */
type LadoDaMarca = 'maior' | 'menor' | 'ambos';

/**
 * As marcas de aproximação, e o lado que cada uma exige — **a lista do dono,
 * literal** (25/09/2026).
 *
 * A regra 1 é comparação exata, e o comentário dela diz por quê: arredondar
 * aprovaria a média que o modelo fez de cabeça. Só que a régua exata, sozinha,
 * **proíbe prosa natural**: um jornalista escreve *"mais de 12 mil passos"* onde
 * o pacote diz 12.338, e isso reprovava. O dono abriu uma exceção estreita, com
 * três condições que valem juntas — a marca, o arredondamento e o lado.
 *
 * A lista não cresce por dedução. "Por cima de", "em média" e "algo como" são
 * candidatos óbvios e não estão aqui porque ele não os nomeou: cada marca nova é
 * uma linha que o portão passa a deixar entrar, e quem decide isso é ele, lendo
 * o registro de {@link AproximacaoAceita}.
 */
const MARCAS_DE_APROXIMACAO: ReadonlyArray<readonly [string, LadoDaMarca]> = [
  ['mais de', 'maior'],
  ['quase', 'menor'],
  ['perto de', 'menor'],
  ['cerca de', 'ambos'],
  ['aproximadamente', 'ambos'],
  ['uns', 'ambos'],
  ['por volta de', 'ambos'],
];

/**
 * A janela em que a marca é procurada, **antes** do número. A mais longa —
 * "aproximadamente" — tem 15 caracteres; 48 cobrem ela e o espaço com folga, e
 * qualificar um número com uma marca 48 caracteres atrás não é português.
 */
const JANELA_DA_MARCA = 48;

const PADROES_DAS_MARCAS: ReadonlyArray<readonly [string, LadoDaMarca, RegExp]> =
  MARCAS_DE_APROXIMACAO.map(([marca, lado]) => [
    marca, lado, new RegExp(`${FORA_DA_PALAVRA_ANTES}${escapar(marca)}$`, 'u'),
  ] as const);

/**
 * A marca que qualifica este número, ou nada — e sem marca a comparação segue
 * exata.
 *
 * A marca tem de ser **palavra inteira** e vir colada ao número, separada dele só
 * por espaço: "alguns 100" não é "uns 100". Por isso o caractere **anterior** à
 * janela entra nela quando existe — é ele que diz se a marca no começo do recorte
 * é palavra ou o rabo de outra. Sem ele, o `^` de {@link FORA_DA_PALAVRA_ANTES}
 * leria o corte da janela como começo de palavra.
 */
function marcaAntesDe(texto: string, pos: number): readonly [string, LadoDaMarca] | null {
  const ini = Math.max(0, pos - JANELA_DA_MARCA);
  const antes = dobrar(texto.slice(ini === 0 ? 0 : ini - 1, pos)).replace(/\s+$/, '');
  for (const [marca, lado, padrao] of PADROES_DAS_MARCAS) {
    if (padrao.test(antes)) return [marca, lado];
  }
  return null;
}

/**
 * A escala que a palavra ao lado do número dá: *"12 mil"* afirma 12.000.
 *
 * Só `mil`. "Milhão" e "bilhão" ficam de fora porque nenhum caso medido precisa
 * deles — passos, km, andares e euros não chegam lá num período — e porque cada
 * escala a mais é uma forma a mais de o número dito se afastar do número escrito.
 *
 * **Isto vale só dentro da exceção**, depois de a comparação exata ter falhado. A
 * regra 1 continua lendo algarismos: *"mais de 3 mil"* num pacote que tem o
 * número 3 passa pela comparação exata e nunca chega aqui. É buraco anterior a
 * esta exceção, e ela não o fecha — fechá-lo é mudar o que a regra 1 considera
 * um número, e isso mexe nos cinco anos de texto que ela já julga.
 */
function escalaDepoisDe(texto: string, fim: number): number {
  return /^\s*mil(?![\p{L}\p{N}])/u.test(texto.slice(fim, fim + 8)) ? 1000 : 1;
}

/**
 * As granularidades em que um arredondamento é "redondo" — **a escada do dono**:
 * uma casa decimal, unidade, dezena, centena, milhar.
 *
 * Ela para no milhar de propósito. Com a dezena de milhar, *"mais de 10 mil"*
 * passaria para os 12.338 passos — verdade, mas uma verdade grossa, e o dono
 * fixou a escada onde fixou.
 */
const GRANULARIDADES: readonly number[] = [0.1, 1, 10, 100, 1000];

/**
 * O número dito é arredondamento de algum número do pacote, para o lado que a
 * marca promete?
 *
 * A granularidade tem de ser **menor ou igual ao número do pacote**: arredondar
 * 56 ao milhar não é arredondar, é substituir. Sem essa linha, *"cerca de 100
 * km"* passaria para os 56 km do caderno Movimento — a marca simétrica não tem
 * lado para barrar isso, e a distância seria de 44%.
 *
 * As granularidades são tentadas da mais fina para a mais grossa, para o registro
 * guardar o arredondamento mais apertado que explica o número.
 */
function aproximacaoDe(
  bruto: string, valor: number, marca: string, lado: LadoDaMarca,
  autorizados: ReadonlySet<number>,
): AproximacaoAceita | null {
  for (const granularidade of GRANULARIDADES) {
    for (const doPacote of autorizados) {
      if (granularidade > Math.abs(doPacote)) continue;
      if (Math.abs(Math.round(doPacote / granularidade) * granularidade - valor) > 1e-9) continue;
      if (lado === 'maior' && !(doPacote > valor)) continue;
      if (lado === 'menor' && !(doPacote < valor)) continue;
      return { bruto, marca, valor, doPacote, granularidade };
    }
  }
  return null;
}

/* ─────────────────────────────── o eco ─────────────────────────────── */

/**
 * As palavras do texto para a conta do eco: sem acento, sem caixa, sem
 * pontuação e **sem marcação**.
 *
 * Tirar a marcação é o que faz a régua morder: o Qwen3 4B devolveu o pedido com
 * tudo em `**negrito**` e com um `#### **C omparações**` partido no meio, e uma
 * comparação literal de caracteres o teria chamado de texto novo.
 */
function palavrasDoEco(s: string): string[] {
  return dobrar(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter((w) => w !== '');
}

/**
 * O tamanho da janela do eco, em palavras.
 *
 * Quatro é o ponto em que a coincidência deixa de acontecer por acaso em
 * português e ainda é curto o bastante para sobreviver a linha trocada de lugar e
 * a negrito no meio. Medido nos cinco textos da corrida, contra os n-gramas de 3,
 * 4 e 5: a margem entre o pior caso legítimo e a melhor cópia foi de 53,1 pt em
 * 3, **56,6 pt em 4** e 58,9 pt em 5. O 5 mede um tico melhor e é mais frágil em
 * texto curto; o 4 ficou.
 */
const PALAVRAS_DA_JANELA = 4;

/**
 * A fração do texto que já estava no pedido: **quantas das janelas de quatro
 * palavras do texto aparecem no pedido**.
 *
 * Não julga estilo — o dono pediu explicitamente que não se tentasse. Julga
 * repetição literal, que é contável.
 *
 * Zero quando o texto não tem quatro palavras: uma fração sobre zero janelas não
 * é uma medida.
 */
export function ecoDoPedido(texto: string, pedido: string): number {
  const janelas = (ws: readonly string[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i + PALAVRAS_DA_JANELA <= ws.length; i += 1) {
      out.push(ws.slice(i, i + PALAVRAS_DA_JANELA).join(' '));
    }
    return out;
  };
  const doTexto = janelas(palavrasDoEco(texto));
  if (doTexto.length === 0) return 0;
  const noPedido = new Set(janelas(palavrasDoEco(pedido)));
  return doTexto.filter((j) => noPedido.has(j)).length / doTexto.length;
}

/**
 * O limiar do eco: **metade do texto já estava no pedido**.
 *
 * ## A margem medida, nos cinco textos da corrida de 25/09
 *
 * | texto | palavras | eco |
 * |---|---|---|
 * | modelo do aparelho (prosa boa) | 255 | **0,4%** |
 * | Qwen3 1.7B (prosa ruim, mas prosa) | 331 | **21,0%** |
 * | Qwen3 4B (cópia em negrito) | 222 | **77,6%** |
 * | Tucano2 1.5B (cópia literal) | 211 | **98,1%** |
 * | Qwen3 4B misto (truncado em 9 tokens) | 2 | — (abaixo do piso) |
 *
 * Entre o pior caso legítimo (21,0%) e a melhor cópia (77,6%) há **56,6 pontos**.
 * O limiar em 50% fica 29,0 pt acima do pior legítimo e 27,6 pt abaixo da melhor
 * cópia — quase no meio, e não é número bonito escolhido no ar: é o meio de um
 * vão medido.
 *
 * **A margem é larga porque o Qwen3 1.7B é um caso forçado**, não um caso
 * benigno: ele copia a seção das lápides inteira, repete "cobertura desigual" e
 * "dias em transição", e ainda assim fica em 21%. Prosa de verdade — a do modelo
 * do aparelho — fica em 0,4%.
 */
const LIMIAR_DO_ECO = 0.5;

/**
 * O piso: abaixo de 100 palavras a fração não é medida, é ruído — e o que a
 * domina ali é justamente o que a FORMA **manda** o texto repetir.
 *
 * Medido: as duas linhas de lápide do caderno Movimento, copiadas literalmente
 * como a FORMA prescreve, são 31 palavras e dão **100%** de eco sozinhas. Com um
 * parágrafo de prosa ao lado caem para 39,4% (74 palavras) e com dois para 24,3%
 * (118 palavras). Um caderno **não pode** ter mais de duas lápides — as quatro
 * métricas de `LAPIDES` se dividem duas em Movimento e duas em Coração —, então
 * 100 palavras deixam a repetição prescrita sempre abaixo do piso.
 *
 * O preço, dito: uma cópia mais curta que 100 palavras passa por aqui. Os quatro
 * textos não truncados da corrida tinham 211, 222, 255 e 331 palavras; um caderno
 * de 90 palavras seria curto para a revista antes de ser cópia.
 */
const PISO_DO_ECO = 100;

// ─────────────────────────────────────────────────────────────
// 7 — a relação: o verbo concorda com o delta?
// ─────────────────────────────────────────────────────────────

/**
 * O que uma palavra de comparação afirma sobre o delta.
 *
 * `para` é a afirmação de que **não mudou** — a mais perigosa das três, porque é
 * a única que o silêncio do pacote também produziria. Ver `PALAVRAS_DE_RELACAO`.
 */
type Direcao = 'sobe' | 'desce' | 'para';

/** Uma palavra de comparação, e o que ela promete sobre o delta. */
interface PalavraDeRelacao {
  readonly termo: string;
  readonly afirma: Direcao;
  /**
   * Só no múltiplo: a razão `atual / anterior` que a palavra promete. `dobrou`
   * promete 2 — e `deltaPct` de 200 é 3, que foi exatamente o erro medido.
   */
  readonly razao?: number;
}

/**
 * O vocabulário de comparação, e o que cada palavra afirma.
 *
 * ## Por que esta regra existe
 *
 * As seis regras anteriores conferem se o **número** está no pacote, nunca se a
 * **relação** afirmada sobre ele é verdadeira. Medido na corrida de 25/09/2026,
 * caderno Movimento, logo depois das correções do eco e da máscara:
 *
 * - **O Qwen3 1.7B foi aprovado** com *"a distância permaneceu estática"* (0 →
 *   56 km), *"o tempo foi reduzido"* (1,0 → 2,8 h) e *"a elevação permaneceu
 *   inalterada"* (0 → 218 m). Passou porque **não cita número nenhum**: sem
 *   número não há o que conferir, e a paráfrase não ecoa o pedido.
 * - **O modelo do aparelho** escreveu *"o número de atividades dobrou"* com
 *   `deltaPct` de 200 — triplicou.
 *
 * `numerosDoPacote` faz `out.add(String(Math.abs(v)))` com o comentário *"deltas
 * citados sem o sinal"*, então `66,7` está no alfabeto permitido
 * independentemente do que o texto afirme sobre ele. O sinal nunca teve leitor —
 * esta regra é o leitor.
 *
 * ## Os termos são poucos, e de propósito
 *
 * Vale aqui o que a regra 5 já diz de si: *falso positivo joga fora uma edição
 * inteira e uma chamada paga; um escape o leitor corrige*. Então o vocabulário
 * só tem forma **inequívoca**. `foi mantida` fica **fora** — em *"a elevação foi
 * mantida acima de 200 m"* ela não afirma estase nenhuma, e o 1.7B a usou uma vez
 * (*"A elevação foi mantida"*) que esta regra deixa passar de propósito. Ela pega
 * as outras três.
 *
 * Os termos vão **sem acento**, porque a varredura roda sobre `normalizar()`.
 */
const PALAVRAS_DE_RELACAO: readonly PalavraDeRelacao[] = Object.freeze([
  // ── estase — só a forma que não tem segunda leitura ──
  { termo: 'inalterado', afirma: 'para' },
  { termo: 'inalterada', afirma: 'para' },
  { termo: 'inalterados', afirma: 'para' },
  { termo: 'inalteradas', afirma: 'para' },
  { termo: 'estatico', afirma: 'para' },
  { termo: 'estatica', afirma: 'para' },
  { termo: 'estaticos', afirma: 'para' },
  { termo: 'estaticas', afirma: 'para' },
  { termo: 'nao mudou', afirma: 'para' },
  { termo: 'nao variou', afirma: 'para' },
  { termo: 'nao se alterou', afirma: 'para' },
  { termo: 'sem mudanca', afirma: 'para' },
  { termo: 'sem variacao', afirma: 'para' },
  { termo: 'permaneceu igual', afirma: 'para' },
  { termo: 'permaneceu estavel', afirma: 'para' },
  { termo: 'permaneceu a mesma', afirma: 'para' },
  { termo: 'permaneceu o mesmo', afirma: 'para' },
  { termo: 'continuou igual', afirma: 'para' },
  { termo: 'continuou estavel', afirma: 'para' },
  { termo: 'manteve-se igual', afirma: 'para' },
  { termo: 'manteve-se estavel', afirma: 'para' },
  // ── subiu ──
  { termo: 'aumentou', afirma: 'sobe' },
  { termo: 'aumentaram', afirma: 'sobe' },
  { termo: 'subiu', afirma: 'sobe' },
  { termo: 'subiram', afirma: 'sobe' },
  { termo: 'cresceu', afirma: 'sobe' },
  { termo: 'cresceram', afirma: 'sobe' },
  { termo: 'saltou', afirma: 'sobe' },
  { termo: 'saltaram', afirma: 'sobe' },
  { termo: 'superou', afirma: 'sobe' },
  { termo: 'avancou', afirma: 'sobe' },
  { termo: 'dobrou', afirma: 'sobe', razao: 2 },
  { termo: 'triplicou', afirma: 'sobe', razao: 3 },
  { termo: 'quadruplicou', afirma: 'sobe', razao: 4 },
  // ── desceu ──
  { termo: 'caiu', afirma: 'desce' },
  { termo: 'cairam', afirma: 'desce' },
  { termo: 'diminuiu', afirma: 'desce' },
  { termo: 'diminuiram', afirma: 'desce' },
  { termo: 'reduziu', afirma: 'desce' },
  { termo: 'reduziram', afirma: 'desce' },
  { termo: 'reduzido', afirma: 'desce' },
  { termo: 'reduzida', afirma: 'desce' },
  { termo: 'encolheu', afirma: 'desce' },
  { termo: 'recuou', afirma: 'desce' },
  { termo: 'recuaram', afirma: 'desce' },
  { termo: 'desceu', afirma: 'desce' },
  { termo: 'desceram', afirma: 'desce' },
]);

/**
 * O que **apaga** a palavra de comparação: com uma destas colada antes, ela
 * afirma o contrário, ou não afirma nada. A regra fica calada — inverter seria
 * adivinhar.
 */
const NEGACOES_DE_RELACAO: readonly string[] = Object.freeze([
  'nao ', 'nem ', 'deixou de ', 'deixaram de ', 'longe de ', 'em vez de ', 'ao contrario de ',
]);

/** Quantos caracteres antes da palavra a negação pode estar e ainda ser dela. */
const ALCANCE_DA_NEGACAO = 18;

/**
 * O movimento mínimo para a estase ser mentira: **10%**.
 *
 * Abaixo disso *"praticamente inalterada"* é prosa honesta, e reprovar seria
 * cobrar do texto uma precisão que o próprio pacote arredonda. Não vale para o
 * delta que o `deltaPct` não sabe medir: quando o anterior é **zero** — 0 → 56 km
 * —, não há percentual, e aí qualquer movimento é material. Foi justamente esse o
 * caso que o 1.7B chamou de estático.
 */
const PISO_DO_MOVIMENTO = 10;

/**
 * A banda de um múltiplo: `dobrou` aceita razão em `[1,75 · 2,5)`.
 *
 * Assimétrica de propósito. Para baixo a prosa tem pouco espaço — ninguém chama
 * +60% de "dobrou" —; para cima ela tem um pouco mais, porque "dobrou" sobre
 * +140% é exagero de jornal, não erro de leitura. Em +200% (razão 3) a palavra
 * certa é `triplicou`, e é aí que a regra morde.
 */
const BANDA_DO_MULTIPLO = Object.freeze({ abaixo: 0.25, acima: 0.5 });

/** O que o pacote diz que aconteceu com uma métrica nomeada na frase. */
interface RelacaoDoPacote {
  readonly rotulo: string;
  readonly afirma: Direcao;
  /** `atual / anterior`. `null` quando o anterior é 0 — não há razão. */
  readonly razao: number | null;
  /** O movimento é grande o bastante para a prosa não ter margem? */
  readonly material: boolean;
}

/**
 * As métricas nomeadas na vizinhança da palavra de comparação, com o que o pacote
 * diz de cada uma.
 *
 * ## A janela, e por que não é a frase
 *
 * A primeira versão julgava a **frase inteira**, e a medição contra as sete
 * edições reais de produção achou falso positivo em prosa boa: o verbo de uma
 * oração cobrado contra a métrica de outra. *"O tempo de sono subiu para 7,1 h e a
 * variabilidade da frequência cardíaca alcançou 71 ms"* punha `Tempo` na conta do
 * `subiu` que era do sono. A janela é a mesma da regra 5 — `JANELA_DECISAO`, 64
 * caracteres de cada lado, recortados dentro da frase.
 *
 * ## Tudo o que está na janela entra, e o desacordo é decidido depois
 *
 * Não se escolhe uma métrica. Escolher seria adivinhar qual delas o verbo governa,
 * e a medição mostrou que a mais próxima **não** é a resposta: em *"a distância
 * total percorrida em atividades caiu"* quem está colado no verbo é `Atividades`,
 * e o sujeito é `Distância`. Quem decide o que fazer com várias é
 * {@link desacordoDeRelacao}, que exige **unanimidade**.
 *
 * Rótulo curto fica de fora: `ocorrencias` casa por palavra inteira, mas `Nota`
 * ou `Km` numa frase de jornal não provam que a frase fala daquela métrica.
 */
function relacoesJuntoDe(
  norm: string, ini: number, fim: number, pacotes: readonly PacoteDeFatos[],
): readonly RelacaoDoPacote[] {
  const [fIni, fFim] = limitesDaFrase(norm, ini);
  const jIni = Math.max(fIni, ini - JANELA_DECISAO);
  const janela = norm.slice(jIni, Math.min(fFim, fim + JANELA_DECISAO));

  const out: RelacaoDoPacote[] = [];
  const vistos = new Set<string>();
  for (const p of pacotes) {
    for (const f of p.metricas) {
      const rot = normalizar(f.rotulo);
      if (rot.length < ROTULO_MINIMO) continue;
      if (!ocorrencias(janela, rot).some((pos) => !dentroDeIdioma(janela, pos, rot))) continue;
      const b1 = f.bases.find((b) => b.id === 'B1');
      // Métrica sem base comparável não vota — mas o rótulo dela conta como
      // nomeado, e é o que impede a unanimidade de se apoiar num voto só.
      if (b1 == null || !b1.existe || b1.valor == null || f.atual == null || b1.delta == null) {
        vistos.add(rot);
        continue;
      }
      vistos.add(rot);
      out.push({
        rotulo: f.rotulo,
        afirma: b1.delta > 0 ? 'sobe' : b1.delta < 0 ? 'desce' : 'para',
        razao: b1.valor === 0 ? null : f.atual / b1.valor,
        material: b1.delta !== 0
          && (b1.deltaPct == null || Math.abs(b1.deltaPct) >= PISO_DO_MOVIMENTO),
      });
    }
  }
  // Rótulo nomeado sem base comparável na janela: há mais de um assunto ali, e
  // reprovar pelos que sobraram seria decidir que o verbo é de um deles.
  const rotulosQueVotam = new Set(out.map((r) => normalizar(r.rotulo)));
  return vistos.size === rotulosQueVotam.size ? out : [];
}

/**
 * As locuções em que uma palavra de métrica **não é** a métrica.
 *
 * *"ao mesmo tempo em que a média de sono caiu"* não fala do `Tempo` do caderno, e
 * a medição achou esse exato caso na edição do Trimestre Q2. A lista é fechada e
 * curta de propósito: ela cobre locução consagrada do português, não sinônimo.
 */
const IDIOMAS_QUE_NAO_SAO_METRICA: readonly string[] = Object.freeze([
  'ao mesmo tempo', 'ao longo do tempo', 'com o tempo', 'a tempo', 'em tempo',
  'de tempo em tempo', 'tempo real', 'ao mesmo passo', 'a passos',
]);

/** A ocorrência do rótulo cai dentro de uma locução? */
function dentroDeIdioma(janela: string, pos: number, rotulo: string): boolean {
  return IDIOMAS_QUE_NAO_SAO_METRICA.some((frase) => {
    const dentro = frase.indexOf(rotulo);
    if (dentro < 0) return false;
    const ini = pos - dentro;
    return ini >= 0 && janela.startsWith(frase, ini);
  });
}

/**
 * Quatro letras. Mede o rótulo mais curto que o caderno usa e que ainda é
 * inequívoco numa frase — `Sono`, `Peso`. Abaixo disso o casamento é ruído.
 */
const ROTULO_MINIMO = 4;

/**
 * O que dizer quando o texto e o pacote discordam — ou `null` quando a regra não
 * tem como decidir.
 *
 * **Três silêncios, e os três são desenho:** a frase não nomeia métrica alguma
 * com base comparável; as métricas que ela nomeia **discordam** entre si (o
 * caderno Movimento tem três `Distância`, e escolher uma seria adivinhar); ou o
 * movimento é pequeno demais para a palavra ser mentira.
 */
function desacordoDeRelacao(
  palavra: PalavraDeRelacao, relacoes: readonly RelacaoDoPacote[],
): string | null {
  if (relacoes.length === 0) return null;
  // **Unanimidade.** Basta uma métrica da janela concordar com a palavra para a
  // regra calar: a frase pode estar falando dela. Foi a medição que impôs isto —
  // em *"a distância total percorrida em atividades caiu"* a `Distância` caiu de
  // verdade, e é só a `Atividades` da mesma janela que subiu.
  const direcoes = new Set(relacoes.map((r) => r.afirma));
  if (direcoes.size > 1) return null;
  const [doPacote] = [...direcoes];
  const rotulos = [...new Set(relacoes.map((r) => r.rotulo))].join(', ');

  // O múltiplo é conferido ANTES da direção: `dobrou` acerta a direção e erra o
  // tamanho, e é o tamanho que o torna falso.
  const prometida = palavra.razao;
  if (prometida != null && doPacote === 'sobe') {
    const cumpre = (r: RelacaoDoPacote): boolean => r.razao != null
      && r.razao >= prometida - BANDA_DO_MULTIPLO.abaixo
      && r.razao < prometida + BANDA_DO_MULTIPLO.acima;
    // Uma que cumpra já absolve: a frase pode estar falando dela. Reprovar com
    // uma candidata cumprindo seria escolher a outra, que é adivinhar.
    if (relacoes.some(cumpre)) return null;
    const contra = relacoes.filter((r) => !cumpre(r));
    const nomes = [...new Set(contra.map((r) => r.rotulo))].join(', ');
    const real = contra.every((r) => r.razao == null)
      ? 'o anterior é zero, e zero não se multiplica'
      : `a razão real é ${[...new Set(contra.map((r) => (r.razao == null ? '—' : `${r.razao.toFixed(1)}×`)))].join(' · ')}`;
    return `"${palavra.termo}" promete ${prometida}× em ${nomes}, mas ${real}`;
  }

  if (doPacote === palavra.afirma) return null;
  if (!relacoes.some((r) => r.material) && doPacote !== 'para') return null;
  if (palavra.afirma === 'para' && doPacote === 'para') return null;
  if (doPacote === 'para' && !relacoes.some((r) => r.afirma === 'para')) return null;

  const diz = doPacote === 'sobe' ? 'subiu' : doPacote === 'desce' ? 'caiu' : 'não mudou';
  return `"${palavra.termo}" afirma ${DITO[palavra.afirma]} em ${rotulos}, mas o pacote diz que ${diz}`;
}

const DITO: Readonly<Record<Direcao, string>> = Object.freeze({
  sobe: 'alta', desce: 'queda', para: 'estabilidade',
});

/**
 * As palavras de comparação que um texto usa, sem sobreposição e sem as negadas.
 *
 * O termo mais longo ganha: `nao mudou` é estase declarada, e deixar `mudou`
 * disparar dentro dele seria julgar duas vezes a mesma oração.
 */
function palavrasDeRelacaoEm(norm: string): readonly { palavra: PalavraDeRelacao; pos: number }[] {
  const ordem = [...PALAVRAS_DE_RELACAO].sort((a, b) => b.termo.length - a.termo.length);
  const out: { palavra: PalavraDeRelacao; pos: number }[] = [];
  const tomados: [number, number][] = [];
  for (const palavra of ordem) {
    for (const pos of ocorrencias(norm, palavra.termo)) {
      const fim = pos + palavra.termo.length;
      if (tomados.some(([i, f]) => pos < f && i < fim)) continue;
      const antes = norm.slice(Math.max(0, pos - ALCANCE_DA_NEGACAO), pos);
      if (NEGACOES_DE_RELACAO.some((n) => antes.includes(n))) { tomados.push([pos, fim]); continue; }
      tomados.push([pos, fim]);
      out.push({ palavra, pos });
    }
  }
  return out;
}

/**
 * A confusão entre **crescimento** e **fração**: *"115 andares, representando
 * 66,7% do total do mês anterior"*.
 *
 * Os 66,7% são o `deltaPct` (69 → 115), não uma parte do anterior — e a frase
 * contradiz o próprio *"subiu para 115"*. A regra 1 aprova porque o número está
 * no pacote; nada conferia o que ele **é**.
 *
 * Duas condições juntas, e as duas estreitas: o número tem de ser `deltaPct` de
 * alguém e **de mais ninguém** (senão não se sabe em que papel a frase o citou),
 * e o enquadramento tem de nomear um **total** ou um **valor**. *"66,7% acima do
 * mês anterior"* não casa com nenhuma marca, e é justamente a prosa certa.
 *
 * O caso vizinho que ela também pega — texto que calcula uma **participação**
 * ("o ciclismo respondeu por 66,7% do total") — é reprovável pela mesma porta: o
 * pacote não carrega participação, e a conta é do código, não do motor (ADR 0049).
 */
const MARCAS_DE_FRACAO: readonly string[] = Object.freeze([
  '% do total', '% da soma', '% do valor', '% do que', '% do montante',
  '% do acumulado', '% daquele', '% daquilo',
]);
// `"% dos"` ficou de fora: *"em 92% dos dias"* é prosa de cobertura legítima, e
// bastaria o 92 ser `deltaPct` de alguma métrica para a regra reprovar uma frase
// certa. Nenhum caso medido precisava dela.

/** Até onde depois do número o enquadramento ainda é dele. */
const ALCANCE_DA_FRACAO = 48;

/** Os `deltaPct` do pacote que não são valor de mais nada — em módulo. */
function soDeltaPct(pacotes: readonly PacoteDeFatos[]): ReadonlySet<number> {
  const pcts = new Set<number>();
  const outros = new Set<number>();
  for (const p of pacotes) {
    for (const f of p.metricas) {
      if (f.atual != null) outros.add(Math.abs(f.atual));
      for (const b of f.bases) {
        if (b.valor != null) outros.add(Math.abs(b.valor));
        if (b.delta != null) outros.add(Math.abs(b.delta));
        if (b.deltaPct != null) pcts.add(Math.abs(b.deltaPct));
      }
    }
  }
  for (const v of outros) pcts.delete(v);
  return pcts;
}

// ─────────────────────────────────────────────────────────────
// 8 — o período se chama pelo que é
// ─────────────────────────────────────────────────────────────

/**
 * O caderno de **semana** que se diz mensal.
 *
 * O modelo do aparelho escreveu *"em relação ao mês anterior"* e *"deste mês"*
 * **seis vezes** num caderno de 14 a 20 de setembro, e nenhuma das seis regras
 * tinha como ver: `periodo.tipo` está no pacote desde a versão 1 e nunca teve
 * leitor.
 *
 * ## Só `semana` ⇄ `mês`, e só num sentido
 *
 * `ano` e `estação` têm leitura legítima em **qualquer** caderno — B2 é *"o mesmo
 * período do ano anterior"*, e o contexto de estação existe na semana também —,
 * então cobrá-los inventaria falso positivo. E num caderno de **mês** *"a semana
 * anterior"* pode ser uma semana de dentro dele, o que é prosa boa. Sobra o
 * sentido que nunca é legítimo: a semana não tem mês anterior para comparar. As
 * três bases dela são a semana anterior, a mesma semana do ano anterior e a
 * normal do período — nenhuma é um mês.
 */
const SEMANA_QUE_SE_DIZ_MES: readonly RegExp[] = Object.freeze([
  /\bmes (anterior|passado|retrasado)\b/g,
  /\b(este|deste|neste) mes\b/g,
  /\bdo mes (corrente|atual)\b/g,
]);

/**
 * Confere um texto contra o pacote que o gerou.
 * `ok: false` significa **não gravar a edição** — não "avisar o usuário".
 *
 * Aceita **um caderno ou o conjunto**, e o grão importa: conferir o texto de um
 * caderno contra o alfabeto dos quatro é justamente a frouxidão que o pacote por
 * caderno existe para acabar. Passe a união só enquanto o texto for um só —
 * até a sequência da impressão por caderno (Story 1.10).
 *
 * ## `pedido`, e o que acontece sem ele
 *
 * A sexta regra compara o texto com o **pedido** que o produziu, então ela só
 * roda quando o pedido chega. Quem o tem é o descritor da revista
 * (`ia/retrospectiva.ts`), que o remonta com a mesma função pura que montou o
 * pedido de verdade — e há teste provando que o caminho de produção o passa. Sem
 * ele a conferência roda as outras sete: é o que as centenas de frases sintéticas
 * dos testes querem, porque elas nunca foram o pedido de volta.
 */
export function verificarTexto(texto: string, pacote: UmOuMaisPacotes, pedido?: string): Veredito {
  const problemas: Problema[] = [];
  const pacotes: readonly PacoteDeFatos[] = Array.isArray(pacote)
    ? pacote
    : [pacote as PacoteDeFatos];
  const autorizados = valoresDoPacote(pacotes);
  const baixo = texto.toLowerCase();

  // As datas do período saem de cena antes da varredura, em toda grafia que a
  // prosa admite — ISO, `dd/mm`, `dd/mm/aaaa`, por extenso e o intervalo
  // contraído. O porquê de cada forma, e o que fica de fora, está em
  // `grafiasDasDatas`.
  const semDatas = semAsDatasDoPeriodo(texto, pacotes);
  const citados = citacoes(semDatas);

  // 1 — números
  //
  // Comparação EXATA, com epsilon só para o ruído de ponto flutuante — nunca
  // para tolerar arredondamento. Arredondar aqui aprovaria a média que o modelo
  // fez de cabeça sempre que ela caísse perto de um valor real.
  //
  // A UMA exceção é a **aproximação marcada** (decisão do dono, 25/09): quando o
  // texto se declara aproximado, o número é arredondamento de um número do pacote
  // numa granularidade redonda, E o lado bate com a marca. As três condições
  // valem juntas; falhando uma, a comparação volta a ser exata. Ver
  // `MARCAS_DE_APROXIMACAO`.
  const aproximacoes: AproximacaoAceita[] = [];
  for (const { bruto, pos, valor } of citados) {
    if ([...autorizados].some((a) => Math.abs(a - valor) < 1e-9)) continue;
    const marca = marcaAntesDe(semDatas, pos);
    const aceita = marca == null ? null : aproximacaoDe(
      bruto, valor * escalaDepoisDe(semDatas, pos + bruto.length),
      marca[0], marca[1], autorizados,
    );
    if (aceita != null) { aproximacoes.push(aceita); continue; }
    problemas.push({ regra: 'numero', detalhe: `"${bruto}" não está no pacote` });
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

  // 6 — o eco: o texto é o pedido de volta?
  //
  // Copiar era a estratégia perfeita para passar nas cinco regras acima, porque
  // **todo número de uma cópia vem do pacote por definição** — e as duas cópias
  // da corrida de 25/09 foram aprovadas enquanto o melhor texto era reprovado.
  //
  // A régua é objetiva e não toca em estilo: a fração das janelas de quatro
  // palavras do texto que já estavam no pedido. Limiar e piso saem de medição
  // sobre os cinco textos reais — ver `LIMIAR_DO_ECO` e `PISO_DO_ECO`.
  if (pedido !== undefined && palavrasDoEco(texto).length >= PISO_DO_ECO) {
    const eco = ecoDoPedido(texto, pedido);
    if (eco >= LIMIAR_DO_ECO) {
      problemas.push({
        regra: 'eco',
        detalhe: `${Math.round(eco * 100)}% do texto já estava no pedido — é cópia, não leitura`,
      });
    }
  }

  // 7 — a relação: o verbo concorda com o delta?
  //
  // As seis acima conferem se o NÚMERO está no pacote. Nenhuma conferia se a
  // RELAÇÃO afirmada sobre ele é verdadeira — e foi por aí que o texto pior da
  // corrida de 25/09 passou: sem citar número nenhum, ele afirmou estase sobre
  // quatro métricas que subiram. Ver `PALAVRAS_DE_RELACAO`.
  // A prosa ruim repete: o 1.7B afirmou estase sete vezes com a mesma palavra
  // sobre as mesmas métricas. Uma linha por desacordo DISTINTO, com a contagem ao
  // lado — a lista serve para o dono ler, e sete cópias da mesma frase escondem
  // as outras.
  const vezes = new Map<string, number>();
  const conta = (detalhe: string): void => { vezes.set(detalhe, (vezes.get(detalhe) ?? 0) + 1); };

  for (const { palavra, pos } of palavrasDeRelacaoEm(norm)) {
    const relacoes = relacoesJuntoDe(norm, pos, pos + palavra.termo.length, pacotes);
    const desacordo = desacordoDeRelacao(palavra, relacoes);
    if (desacordo != null) conta(desacordo);
  }
  for (const [detalhe, n] of vezes) {
    problemas.push({ regra: 'relacao', detalhe: n === 1 ? detalhe : `${detalhe} (${n}×)` });
  }

  // 7b — o crescimento vestido de fração, na mesma regra porque é o mesmo erro:
  // o número está certo e o que se afirma dele, não.
  const soPct = soDeltaPct(pacotes);
  for (const { bruto, pos, valor } of citados) {
    if (![...soPct].some((v) => Math.abs(v - Math.abs(valor)) < 1e-9)) continue;
    const fim = pos + bruto.length;
    const depois = norm.slice(fim, Math.min(norm.length, fim + ALCANCE_DA_FRACAO));
    const marca = MARCAS_DE_FRACAO.find((m) => depois.startsWith(m) || depois.includes(m));
    if (marca == null) continue;
    problemas.push({
      regra: 'relacao',
      detalhe: `"${bruto}" é o crescimento, não uma fração — a frase o cita como "${marca.trim()}"`,
    });
  }

  // 8 — o período se chama pelo que é
  //
  // `periodo.tipo` está no pacote desde a versão 1 e nunca teve leitor. Ver
  // `SEMANA_QUE_SE_DIZ_MES` para o porquê de só a semana ser cobrada.
  if (pacotes[0]?.periodo.tipo === 'week') {
    const ditas = new Map<string, number>();
    for (const re of SEMANA_QUE_SE_DIZ_MES) {
      for (const m of norm.matchAll(re)) ditas.set(m[0], (ditas.get(m[0]) ?? 0) + 1);
    }
    for (const [frase, n] of ditas) {
      problemas.push({
        regra: 'periodo',
        detalhe: `o caderno é de semana, e o texto diz "${frase}"${n === 1 ? '' : ` (${n}×)`}`,
      });
    }
  }

  // As aproximações aceitas ficam FORA dos problemas, e o campo só aparece quando
  // houve alguma: o caminho de sucesso continua sendo `{ ok, problemas }` e nada
  // mais. Elas existem para o dono rever a forma da exceção com casos reais.
  return aproximacoes.length === 0
    ? { ok: problemas.length === 0, problemas }
    : { ok: problemas.length === 0, problemas, aproximacoes };
}
