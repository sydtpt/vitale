/**
 * O **postal da semana** — os três fatos que a semana mostra (Story 3.1).
 *
 * ```
 * montarPostal(resumo, destaques) → { fatos: 0..3, trajetoria: [] }   // pura
 * ```
 *
 * ## A semana não é uma edição pequena
 *
 * O mês, o trimestre e o ano ganham **edição**: sumário, quatro cadernos, capa e
 * o texto que um motor escreveu e a conferência aprovou — tudo gravado em
 * `edicoes_ia`. A semana não: o contrato do Épico 2 é *"a semana não grava
 * edição; o postal calcula na hora"*, e a porta que gravava está fechada desde
 * esta story, no núcleo (`ia/imprimir-sequencia.ts`, estado `semana`).
 *
 * O que sobra para a semana é este módulo: **três fatos apurados na hora**, sem
 * nada persistido e sem nada a reimprimir. Abrir a mesma semana duas vezes dá o
 * mesmo postal, porque ele é função dos dados e de mais nada.
 *
 * ## Sem comparação nenhuma — e por quê (decisão do dono, 25/09/2026)
 *
 * Valor absoluto: sem base, sem delta, sem percentual. A comparação que o
 * critério de aceite admitia era a **trajetória** (a direção ao longo de vários
 * períodos, {@link FatoTendencia}), e não a semana contra a semana anterior —
 * que ele recusa por ser ruído: sete dias contra sete dias oscilam por feriado,
 * por chuva e por uma viagem.
 *
 * Como **ninguém produz trajetória** hoje (ver {@link PostalDaSemana.trajetoria}),
 * a leitura honesta do critério é *nenhuma comparação*. É por isso que os
 * destaques entram aqui pelo **valor** e nunca pelo texto: a frase que
 * `buildRetroHighlights` escreve já carrega o delta (`"3 treinos nesta semana ·
 * +1 vs. semana anterior"`), e cortá-la seria cirurgia em prosa gerada — o
 * primeiro `·` que mudasse de lugar traria a comparação de volta, calada.
 *
 * ## Por que os destaques escolhem, e o resumo responde
 *
 * Duas perguntas diferentes, com dois donos diferentes:
 *
 * - **quais três?** — os destaques da Retrospectiva (`buildRetroHighlights`).
 *   Eles já existem, já vêm ordenados por classe (`compareHighlights`: o insight
 *   cruzado pesa mais que a estatística de volume) e `buildRetroLede` já corta em
 *   três — *um jornal tem uma manchete, não um índice*. O que o postal descarta
 *   deles é o `deltaPct`;
 * - **quanto?** — o `RetroSummary`, que é onde o número mora. O código escreve
 *   números ([ADR 0049](../../../../docs/decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md)),
 *   e um número lido da estrutura não pode carregar a comparação por engano.
 *
 * **`liderDoCaderno` não serve**, e não é questão de gosto: ele ranqueia por
 * afastamento de base (`ia/ranqueamento.ts`), e o postal não tem bases. O
 * próprio arquivo já declara que *"a semana é postal — não grava edição — e por
 * isso não ordena"*.
 *
 * ## O que não entra
 *
 * Destaque cujo conteúdo **é** a comparação não vira fato: o insight cruzado
 * (*"nos dias com cerveja, sono −8%"*) e o retrato nota × medição são
 * comparações inteiras — não há valor absoluto a extrair deles. Eles continuam
 * existindo na Retrospectiva, que é onde comparação cabe.
 *
 * O **silêncio de cadernos** (Story 2.5) também não alcança o postal: ele não tem
 * cadernos. A preferência cala seções da edição impressa, e a semana não tem
 * edição — calar o Sono na Diagramação não apaga as noites que a semana teve.
 */
import type { TipoComEdicao } from '../data/edicoes-ia';
import type { FatoTendencia } from '../ia/pacote';
import type { RetroSummary } from '../period/retro';
import type { WeekHighlight } from '../week/highlights';
import { formatarNumero } from '../format/numero';
import { fmtMoney } from '../format/money';
import { formatHm } from '../sleep/facts';

/**
 * O tipo de período que vira postal — **a semana, e só ela**.
 *
 * O nome que as telas conferem para saber que ali não há edição a desenhar nem
 * botão de escrever a oferecer. A recusa de verdade é do núcleo
 * (`ia/imprimir-sequencia.ts`, que devolve o estado `semana` antes de buscar,
 * chamar ou gravar qualquer coisa); esta constante existe para nenhuma tela ter
 * de escrever `'week'` à mão e para a intenção ficar legível onde ela é lida.
 *
 * **`as const satisfies`, e não uma anotação larga**: anotada como
 * `TipoComEdicao` ela seria a união inteira para o compilador, e
 * `periodo.tipo === TIPO_DO_POSTAL` não estreitaria nada — o ramo da edição
 * continuaria aceitando semana, calado. Com o literal preservado, quem ramifica
 * por ela ganha o estreitamento de graça.
 *
 * `TipoComEdicao`, e não `PeriodKind`: a **tabela** aceita semana — as cinco
 * semanas impressas antes de a porta fechar continuam lá, e o postal leva até o
 * texto delas. O que a semana não faz é *gravar* dali em diante.
 */
export const TIPO_DO_POSTAL = 'week' as const satisfies TipoComEdicao;

/** Os tipos que **têm** edição a desenhar — os três que não são o postal. */
export type TipoComRevista = Exclude<TipoComEdicao, typeof TIPO_DO_POSTAL>;

/**
 * Quantos fatos o postal mostra, no máximo — o mesmo corte de `buildRetroLede`.
 *
 * Três porque o postal é um cartão, não um relatório: o quarto fato empurra o
 * terceiro para fora da dobra no telefone, e a semana passa a competir com a
 * edição do mês, que é exatamente o que esta story desfaz.
 */
export const FATOS_DO_POSTAL = 3;

/**
 * Um fato do postal — **o valor, e o que ele mede**. Nunca um delta.
 *
 * `id` é o do destaque que o escolheu (`workouts`, `distance`, `health-vfc`…):
 * ele é a chave de render e a única ponte de volta até a razão pela qual este
 * fato está aqui e não outro.
 */
export interface FatoDoPostal {
  /** O id do {@link WeekHighlight} que trouxe este fato. Único dentro do postal. */
  readonly id: string;
  /** O que se mede — `"Treinos"`, `"Sono por noite"`. Já em português, pronto para a tela. */
  readonly rotulo: string;
  /** O número já formatado, com unidade — `"3"`, `"42,1 km"`, `"7h12"`, `"€120"`. */
  readonly valor: string;
}

/** O postal de uma semana: o que ela tem a dizer sem comparar com nada. */
export interface PostalDaSemana {
  /**
   * De zero a {@link FATOS_DO_POSTAL} fatos, na ordem de relevância dos
   * destaques.
   *
   * **Semana magra mostra o que tem.** Um fato só é um fato só: o postal não
   * inventa um terceiro nem enche o resto de vazio — a tela desenha o que
   * chegar, e três caixas onde havia um número seriam a afirmação de que faltou
   * medida.
   */
  readonly fatos: readonly FatoDoPostal[];
  /**
   * O lugar da trajetória — **sempre vazio, e declarado assim**.
   *
   * {@link FatoTendencia} existe como forma desde o pacote (`ia/pacote.ts`):
   * direção ao longo de N períodos, sem valor bruto, *"sobe desde junho"*. Ela é
   * a única comparação que o critério de aceite desta story admitia — e **nenhum
   * código a produz**: `montarEntradaDaEdicao` devolve `{ resumo, agora,
   * lapides }`, e nada mais.
   *
   * O campo fica aqui, vazio, no molde do que a 2.4b fez com as tiras do ano: o
   * estreitamento é **declarado** em vez de escondido, para a story que produzir
   * trajetória não ter de reabrir a decisão de 25/09 nem reinventar onde ela
   * entra. Produzi-la é *Ask First* — é story própria, e serve também ao
   * caderno Rotina, que é o que menos base tem.
   */
  readonly trajetoria: readonly FatoTendencia[];
}

/** O vazio declarado — uma instância só, congelada (ver {@link PostalDaSemana.trajetoria}). */
const SEM_TRAJETORIA: readonly FatoTendencia[] = Object.freeze([]);

/** O que um destaque mede, quando ele mede um valor absoluto. */
interface ValorDoFato {
  readonly rotulo: string;
  readonly valor: string;
}

/**
 * O que o postal escreve **não pode ler zero**.
 *
 * Um fato que diz `0 min`, `0,0 km` ou `€0` é pior que um fato a menos: o postal
 * não compara, então o leitor não tem como saber se aquilo é "quase nada" ou
 * "nada medido" — e a regra da story é não inventar terceiro fato, muito menos
 * um que afirma zero. O piso é sobre o **número já arredondado para a casa em
 * que ele vai ser escrito**, e não sobre o valor cru: 40 m são `0,0 km` na tela
 * mesmo não sendo zero no dado.
 */
function escreveZero(valor: number, casas: number): boolean {
  return Math.round(Math.abs(valor) * 10 ** casas) === 0;
}

/**
 * O número, pela função que tem dono (AD-6, `format/numero.ts`).
 *
 * **Não é `toLocaleString('pt-BR')`**, e a diferença não é de estilo:
 * `formatarNumero` existe justamente para não depender do ICU do Hermes, e o
 * sinal de menos dela é o U+2212 que o resto do app escreve — o hífen do
 * `toLocaleString` poria dois traços diferentes na mesma tela, e passaria por
 * baixo das verificações que procuram o U+2212.
 */
const fmt = formatarNumero;

/** A casa decimal de cada grandeza que o postal escreve. */
const INTEIRO = 0;
const UMA_CASA = 1;

/**
 * A tabela dos destaques que **têm valor absoluto**, por id — e é ela que
 * define o que o postal pode mostrar.
 *
 * Fechada de propósito, e o padrão é *não mostrar*: um destaque novo em
 * `buildRetroHighlights` não aparece no postal até alguém dizer, aqui, qual é o
 * número dele e como se escreve. A alternativa — adivinhar pelo texto — é a
 * cirurgia em prosa que o cabeçalho recusa, e ela falharia calada no dia em que
 * a frase mudasse.
 *
 * Cada função devolve `null` quando o valor não existe, é zero, **ou seria
 * escrito como zero** ({@link escreveZero}).
 *
 * **É um `Map`, e não um objeto literal.** `Object.freeze({…})[id]` continua
 * herdando de `Object.prototype`: um destaque chamado `toString`, `valueOf` ou
 * `hasOwnProperty` acharia o método herdado, seria chamado com o resumo e
 * empurraria um fato com rótulo e valor `undefined`. Hoje nenhum id dinâmico
 * cai nesses nomes (todos são prefixados), mas o tipo promete que um miss dá
 * `undefined`, e o objeto literal é a única coisa que não cumpre essa promessa.
 */
const VALOR_DO_DESTAQUE = new Map<string, (r: RetroSummary) => ValorDoFato | null>([
  ['workouts', (r) => {
    const n = r.fitness.count.current;
    return n > 0 ? { rotulo: n === 1 ? 'Treino' : 'Treinos', valor: fmt(n, INTEIRO) } : null;
  }],
  ['distance', (r) => {
    const km = r.fitness.distanceM.current / 1000;
    // Abaixo de 50 m a uma casa dá "0,0 km" — número que afirma zero.
    return escreveZero(km, UMA_CASA) ? null : { rotulo: 'Distância', valor: `${fmt(km, UMA_CASA)} km` };
  }],
  ['tasks', (r) => {
    const n = r.tasks.total.current;
    return n > 0 ? { rotulo: n === 1 ? 'Tarefa concluída' : 'Tarefas concluídas', valor: fmt(n, INTEIRO) } : null;
  }],
  ['spend', (r) => {
    // `fmtMoney` arredonda para o euro inteiro: abaixo de meio euro sai "€0".
    const v = r.purchases.spend.current;
    return escreveZero(v, INTEIRO) ? null : { rotulo: 'Compras', valor: fmtMoney(v) };
  }],
  // As noites vêm de `sleep_periods`, e não da soma diária: é a mesma fonte que
  // o destaque usa, e a única que mede a noite como evento.
  ['sleep-asleep', (r) => (r.sleep ? { rotulo: 'Sono por noite', valor: formatHm(r.sleep.cur.asleepH) } : null)],
  ['sleep-awake', (r) => {
    const min = r.sleep?.cur.awake?.minMean;
    // Meio minuto de vigília média vira "0 min", que lê como "não acordou".
    if (min === undefined || escreveZero(min, INTEIRO)) return null;
    return { rotulo: 'Acordado por noite', valor: `${fmt(min, INTEIRO)} min` };
  }],
]);

/** `health-vfc` → `vfc`, e `null` para qualquer outro id. */
const ID_DE_SAUDE = /^health-(.+)$/;

/**
 * A métrica de saúde, pelo id do destaque — o rótulo, as casas e a unidade saem
 * da **linha do resumo**, que é o catálogo (`health/metric-catalog.ts`) já
 * resolvido. Nada de unidade escrita à mão aqui: `bpm`, `ms` e `h` moram num
 * lugar só.
 *
 * O destaque de saúde é uma comparação inteira (*"FC de repouso pior: +3 bpm
 * (+5%)"*) — o postal ignora a frase e fica com `recap.current`, que é a medida.
 */
function valorDeSaude(r: RetroSummary, id: string): ValorDoFato | null {
  const metrica = ID_DE_SAUDE.exec(id)?.[1];
  if (metrica === undefined) return null;
  const linha = r.health.find((h) => h.metric === metrica);
  const atual = linha?.recap.current;
  if (linha === undefined || atual == null || !Number.isFinite(atual)) return null;
  return { rotulo: linha.label, valor: `${fmt(atual, linha.decimals)}${linha.unit}` };
}

/**
 * O postal de um período — os três fatos e o lugar vazio da trajetória.
 *
 * `destaques` chega **já ordenado** por `buildRetroHighlights` (classe primeiro,
 * `|deltaPct|` depois): este módulo não reordena nada, só filtra e corta. É a
 * mesma promessa de `buildRetroLede`, pelo mesmo motivo — reordenar aqui daria
 * ao postal uma relevância que discorda da Retrospectiva logo ao lado.
 *
 * **Pura e determinística**: não olha o relógio, não lê banco, não muta nada, e
 * o mesmo par (resumo, destaques) dá sempre o mesmo postal.
 *
 * Nada aqui é específico da semana — a função é do *postal*, e a semana é quem o
 * usa. O que torna a semana semana é a rota não desenhar edição e o núcleo
 * recusar a impressão dela; nenhuma das duas coisas mora neste arquivo.
 */
export function montarPostal(
  resumo: RetroSummary,
  destaques: readonly WeekHighlight[],
): PostalDaSemana {
  const fatos: FatoDoPostal[] = [];
  const vistos = new Set<string>();
  for (const d of destaques) {
    if (fatos.length >= FATOS_DO_POSTAL) break;
    // Id repetido é chamada errada, e não meio fato: o primeiro fica, porque a
    // lista chega em ordem de relevância. (Chave de render tem de ser única.)
    if (vistos.has(d.id)) continue;
    // A tabela responde pelos ids fixos; a saúde é por padrão (`health-<métrica>`),
    // e devolve `null` para todo id que não seja dela. Um id fixo cujo valor não
    // existe (zero treinos) cai no segundo e continua sendo `null`.
    const valor = VALOR_DO_DESTAQUE.get(d.id)?.(resumo) ?? valorDeSaude(resumo, d.id);
    if (valor === null) continue;
    vistos.add(d.id);
    fatos.push({ id: d.id, rotulo: valor.rotulo, valor: valor.valor });
  }
  return { fatos, trajetoria: SEM_TRAJETORIA };
}
