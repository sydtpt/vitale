/**
 * Os quatro cadernos da revista — o vocabulário, com **dono único**.
 * Spec: docs/specs/revista-retrospectiva/cadernos.md · AD-2 da espinha do épico.
 *
 * ## Por que não é `RetroBlockId`
 *
 * A tentação é alargar `RetroBlockId` (`period/retro-blocks.ts`) com quatro
 * entradas novas e pronto. Não dá: o bloco carrega `order`, `kinds` e `fixed`, e
 * `order` é **a ordem escolhida pelo leitor** — exatamente o que o ranqueamento
 * do miolo (CAP-7) aposentou. Um caderno que herdasse `order` deixaria a ordem
 * antiga voltar pela porta dos fundos de `visibleBlocks`.
 *
 * Caderno é outro conceito: é uma seção da edição, com pacote de fatos próprio,
 * assinatura própria e posição **derivada do dado**, não do gosto do leitor.
 *
 * ## O catálogo é lei
 *
 * `cadernos.md` lista, campo a campo, a que caderno cada dado pertence. A lista
 * está transcrita aqui em {@link CadernoDef.fontes} com uma marca por linha —
 * `noPacote` — que diz se `montarPacotes` já a entrega. É assim que "nenhum dado
 * do balde fica órfão" deixa de ser promessa em prosa: ou o campo cai num
 * caderno, ou a ausência dele está declarada e visível.
 *
 * ## Nomeação
 *
 * Minúsculas sem acento (`coracao`), **igual do Postgres ao componente** — o
 * CHECK de `edicoes_ia.caderno` é esta mesma lista. Um id que precisasse de
 * tradução entre camadas seria um id a mais para manter em sincronia.
 */

/** Os quatro. A ordem aqui é o desempate do ranqueamento (Story 1.7). */
export type CadernoId = 'sono' | 'movimento' | 'coracao' | 'rotina';

/**
 * Uma linha do catálogo de `cadernos.md`.
 *
 * `noPacote: false` **não é pendência escondida** — é a ausência declarada que a
 * regra "nada órfão" exige. Quem trouxer o campo para o pacote vira a marca no
 * mesmo commit.
 *
 * **E a marca é cobrada, não prometida.** `cadernos.test.ts` liga cada linha a
 * um predicado sobre `montarPacotes` e reprova quando ela mente — nos dois
 * sentidos. Sem isso o catálogo é prosa com aparência de dado: a primeira versão
 * dele afirmava entregar "esforço duro" e o gasto do hábito, e nenhum dos dois
 * chegava ao pacote.
 */
export interface FonteDoCaderno {
  /** O campo, como `cadernos.md` o nomeia. */
  campo: string;
  /** De onde ele sai — função pura, tabela ou ADR. */
  fonte: string;
  /** `montarPacotes` já entrega este campo? */
  noPacote: boolean;
  /** Só quando a linha precisa de justificativa — ver `compras e gasto`. */
  nota?: string;
}

export interface CadernoDef {
  id: CadernoId;
  /** Como o caderno se chama na edição. */
  rotulo: string;
  fontes: readonly FonteDoCaderno[];
}

/**
 * O catálogo. A ordem é a de `cadernos.md`, e é **fixa**: ela é o desempate do
 * ranqueamento, e uma função de ordenação ambígua não é determinística.
 */
export const CADERNOS: readonly CadernoDef[] = [
  {
    id: 'sono',
    rotulo: 'Sono',
    fontes: [
      { campo: 'relógios deitou / apagou / acordou', fonte: 'SleepRetro (sleep/retro.ts)', noPacote: false },
      { campo: 'duração mediana', fonte: 'SleepRetro', noPacote: false },
      { campo: 'continuidade — despertares e sua duração', fonte: 'SleepRetro', noPacote: false },
      { campo: 'regularidade e jetlag social', fonte: 'regularityByWeek, weekendShift', noPacote: false },
      { campo: 'as 5 dimensões da Saúde do sono', fonte: 'ADR 0036', noPacote: false },
      { campo: 'nota × medição', fonte: 'ratingsSplit · RetroSummary.ratings.sleep e health[sono]', noPacote: true },
      { campo: 'gatilhos sob a regra das duas colunas', fonte: 'sleepTriggers (sleep/triggers.ts)', noPacote: false },
      { campo: 'extremos com data', fonte: 'SleepExtremes', noPacote: false },
      { campo: 'a página da lua', fonte: 'CAP-12 · pre-registro-lua.md', noPacote: false },
    ],
  },
  {
    id: 'movimento',
    rotulo: 'Movimento',
    fontes: [
      // A linha de `cadernos.md` é "km · tempo · esforço duro", e ela vale meia:
      // os dois primeiros estão no pacote, o terceiro não. Uma marca só para as
      // três seria mentira nos dois sentidos, então a linha se parte.
      { campo: 'km · tempo', fonte: 'RetroFitness, RetroSports', noPacote: true },
      {
        campo: 'esforço duro',
        fonte: 'RetroFitness.hardMin',
        noPacote: false,
        nota: 'está em cadernos.md e NÃO está no pacote. Trazê-lo é acrescentar número ao alfabeto da verificação — "Ask First" da story 1.3, e o dono ainda não foi perguntado',
      },
      { campo: 'zonas de FC', fonte: 'hr_zones', noPacote: false },
      { campo: 'recordes', fonte: 'best_efforts', noPacote: false },
      { campo: 'elevação', fonte: 'activity_routes · SportStats.elevationM', noPacote: true },
      { campo: 'cidades como fato de texto', fonte: 'CityMark', noPacote: false },
      { campo: 'piso das rotas como fato de texto', fonte: 'ADR 0043', noPacote: false },
      {
        campo: 'lápides de VO₂max e anéis',
        fonte: 'CAP-11 · EntradaPacote.lapides · LAPIDES',
        noPacote: true,
        nota: 'o pacote carrega a lápide que CHEGA na entrada — ninguém a produz ainda. Detectar a métrica morta é consulta ao banco com limiar de silêncio, fora do núcleo; o detector está no deferred-work (Story 1.7)',
      },
      {
        campo: 'passos e andares',
        fonte: 'RetroFitness.steps, RetroFitness.floors',
        noPacote: true,
        nota: 'cadernos.md os declara subproduto de Movimento, na seção do Coração',
      },
    ],
  },
  {
    id: 'coracao',
    rotulo: 'Coração',
    fontes: [
      { campo: 'FC de repouso', fonte: 'health_daily', noPacote: true },
      { campo: 'VFC', fonte: 'health_daily (ponte intervals.icu)', noPacote: true },
      { campo: 'a série intradiária — curva do dia, Noites, dia × hora', fonte: 'health_series · ADR 0033', noPacote: false },
      {
        campo: 'lápides de respiração e SpO₂',
        fonte: 'CAP-11 · EntradaPacote.lapides · LAPIDES',
        noPacote: true,
        nota: 'o pacote carrega a lápide que CHEGA na entrada — ninguém a produz ainda. Detectar a métrica morta é consulta ao banco com limiar de silêncio, fora do núcleo; o detector está no deferred-work (Story 1.7)',
      },
    ],
  },
  {
    id: 'rotina',
    rotulo: 'Rotina',
    fontes: [
      {
        campo: 'aderência de tarefas',
        fonte: 'todo_occurrences · RetroSummary.adherence',
        noPacote: false,
        nota: 'o pacote leva hoje só a CONTAGEM de tarefas concluídas (RetroSummary.tasks.total); a razão feito/total é número novo e precisa de aval',
      },
      // Mesma partição que "km · tempo · esforço duro": o hábito está no pacote,
      // o gasto dele não. `habitos()` passa só `recap` — dias com registro.
      { campo: 'hábitos — dias com registro', fonte: 'habit_logs · RetroHabitRow.recap', noPacote: true },
      {
        campo: 'hábitos — o gasto derivado por unit_price',
        fonte: 'RetroHabitRow.unitPrice · habitCost()',
        noPacote: false,
        nota: 'está em cadernos.md e NÃO está no pacote. É um euro por hábito no alfabeto — "Ask First" da story 1.3, e o dono ainda não foi perguntado',
      },
      { campo: 'registros', fonte: 'registro_logs · RetroRegistroRow', noPacote: true },
      { campo: 'notas do dia', fonte: 'daily_ratings · RetroSummary.ratings.day', noPacote: true },
      {
        campo: 'compras e gasto do período',
        fonte: 'RetroSummary.purchases',
        noPacote: true,
        nota: 'NÃO está no catálogo de cadernos.md. Já vinha no pacote único (módulo `dia-a-dia`) e cai aqui porque Rotina é o caderno do que o dono DECIDIU — e porque o gasto do hábito já mora nele. DESTINO APROVADO PELO DONO EM 09/09/2026, com a ressalva dele: compras e gasto "ainda não estão implementados e mal uso". Hoje custam ZERO no alfabeto (a fixture de agosto traz os dois vazios), então ficam ligados sem preço. Se um dia houver dado de verdade, o custo aparece na medição por caderno e a decisão de mantê-los se reabre ali — não aqui.',
      },
    ],
  },
];

const POR_ID = new Map<CadernoId, CadernoDef>(CADERNOS.map((c) => [c.id, c]));

/** Os ids na ordem do catálogo. */
export const CADERNO_IDS: readonly CadernoId[] = CADERNOS.map((c) => c.id);

export function isCadernoId(v: unknown): v is CadernoId {
  return typeof v === 'string' && POR_ID.has(v as CadernoId);
}

export function cadernoDef(id: CadernoId): CadernoDef {
  const d = POR_ID.get(id);
  // Impossível pelo tipo; explode alto se alguém contornar com `as`.
  if (!d) throw new Error(`caderno desconhecido: ${id}`);
  return d;
}

export function rotuloDoCaderno(id: CadernoId): string {
  return cadernoDef(id).rotulo;
}

/**
 * A que caderno pertence uma métrica de `health_daily`.
 *
 * **É aqui que o "não é renomeação" mora.** O módulo `saude` de hoje se parte:
 * sono vai para o caderno Sono, FC e VFC vão para Coração. Quem tratar a
 * migração como um `rename` produz um caderno de Sono com FC dentro — e nenhum
 * teste de tamanho pega isso.
 *
 * O padrão é `coracao` porque, nas palavras de `cadernos.md`, ele é o que
 * **resta** de `health_daily` depois que o sono sai e passos/andares viram
 * subproduto de Movimento.
 *
 * **VO₂max e anéis são exceção nomeada**: `cadernos.md` os põe em Movimento, e o
 * padrão os jogaria no Coração. Estão aqui para que a métrica tenha **uma rota
 * só** — a mesma de {@link LAPIDES}, que `cadernos.test.ts` confere métrica a
 * métrica. Duas rotas para a mesma métrica é o dia em que a lápide do VO₂max
 * mora num caderno e a linha de VO₂max, no outro.
 */
const SAUDE_POR_METRICA: Readonly<Record<string, CadernoId>> = {
  sono: 'sono',
  sleep: 'sono',
  sleepPerc: 'sono',
  fcRepouso: 'coracao',
  vfc: 'coracao',
  respiracao: 'coracao',
  spo2: 'coracao',
  vo2max: 'movimento',
  aneis: 'movimento',
};

export function cadernoDaMetricaDeSaude(metric: string): CadernoId {
  return SAUDE_POR_METRICA[metric] ?? 'coracao';
}

// ── A lápide ───────────────────────────────────────────────

/**
 * As métricas que a revista sabe declarar mortas — **só as quatro do catálogo**,
 * com os ids de `health/metric-catalog.ts`.
 *
 * São as quatro que pararam em 2026 (respiração 10/07, VO₂max 14/07, SpO₂ 16/07,
 * anéis 17/08) e que nenhuma tela avisou. Quem **decide** que uma delas morreu
 * não é o núcleo: a lápide chega pronta em `EntradaPacote.lapides`, com a data
 * da última medida. Detectar a morte é consulta ao banco com limiar de silêncio,
 * e isso está fora do núcleo por construção.
 */
export type MetricaComLapide = 'vo2max' | 'aneis' | 'respiracao' | 'spo2';

export interface DefDaLapide {
  /** O caderno da métrica — o mesmo de {@link cadernoDaMetricaDeSaude}. */
  caderno: CadernoId;
  /**
   * Como o texto a nomeia — em prosa, minúsculo, **sem dígito**.
   *
   * Sem dígito porque o `NUM` da conferência (`ia/verificar.ts`) lê o "2" de
   * "VO2" como número fora do alfabeto e reprova a edição inteira. "VO₂" copiado
   * com o subscrito é inerte para o regex; normalizado para "VO2" por quem o
   * copia, reprova. O nome por extenso não tem essa porta.
   */
  nome: string;
  /**
   * O verbo que concorda com o nome — *"anéis de atividade **pararam**"*, e não
   * *"parou"*. Vai junto porque a FORMA manda **copiar** a frase da linha: um
   * verbo fixo no singular seria o prompt ensinando o erro de concordância.
   */
  verbo: 'parou' | 'pararam';
}

/**
 * O mapa da lápide: caderno, nome e verbo de cada uma.
 *
 * O caderno é o mesmo que {@link cadernoDaMetricaDeSaude} devolve — VO₂max e
 * anéis em **Movimento** (`cadernos.md`), pelas duas rotas. `cadernos.test.ts`
 * confere, métrica a métrica, que elas não se separem: se se separassem, a
 * lápide do consumo máximo de oxigênio moraria num caderno e a linha dele, no
 * outro — e em julho/2026 o Coração lideraria por uma morte que não é dele.
 */
export const LAPIDES: Readonly<Record<MetricaComLapide, Readonly<DefDaLapide>>> = Object.freeze({
  vo2max: Object.freeze({ caderno: 'movimento', nome: 'consumo máximo de oxigênio', verbo: 'parou' }),
  aneis: Object.freeze({ caderno: 'movimento', nome: 'anéis de atividade', verbo: 'pararam' }),
  respiracao: Object.freeze({ caderno: 'coracao', nome: 'frequência respiratória', verbo: 'parou' }),
  spo2: Object.freeze({ caderno: 'coracao', nome: 'saturação de oxigênio', verbo: 'parou' }),
});

/** As quatro, na ordem do mapa — o desempate entre lápides do mesmo dia. */
export const METRICAS_COM_LAPIDE: readonly MetricaComLapide[] =
  Object.freeze(Object.keys(LAPIDES) as MetricaComLapide[]);

export function isMetricaComLapide(v: unknown): v is MetricaComLapide {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LAPIDES, v);
}
