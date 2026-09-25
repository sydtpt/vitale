import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FATOS_DO_POSTAL, TIPO_DO_POSTAL, montarPostal } from './postal';
import { buildRetroHighlights, buildRetrospective, type RetroInput, type RetroSummary } from '../period/retro';
import type { Activity, SleepPeriod } from '../models/index';
import type { WeekHighlight } from '../week/highlights';

/**
 * O postal da semana (Story 3.1) — a escolha dos três fatos, a matriz de I/O e a
 * propriedade que dá nome à decisão do dono: **sem comparação nenhuma**.
 *
 * Dois modos de medir, de propósito:
 *
 * - com os destaques **de verdade** (`buildRetroHighlights` sobre um resumo
 *   sintético): é o que prova que os ids declarados em `VALOR_DO_DESTAQUE`
 *   existem. Uma tabela apontando para ids que ninguém produz daria um postal
 *   sempre vazio, com a suíte verde;
 * - com destaques **à mão**: é o que prova a ordem, o corte em três e a recusa do
 *   que é comparação inteira, sem depender de o gerador continuar produzindo
 *   aquela combinação.
 *
 * Todo número aqui é sintético.
 */

/* ── a semana, montada pelo próprio núcleo ───────────────────────────────── */

/**
 * O resumo sai de **`buildRetrospective`**, e não de um literal com `as unknown
 * as RetroSummary`.
 *
 * Este é o único teste que prova que a tabela do postal não aponta para o vazio
 * — e um resumo fabricado por cast continuaria "provando" isso depois de o tipo
 * mudar por baixo. Com a entrada de verdade, o caminho inteiro roda: as
 * atividades viram contagem e distância, as noites viram a noite típica, e os
 * ids dos destaques são os que produção produz. É o molde de `retro.test.ts`.
 *
 * **Domingo, 06/09/2026, meio-dia local**: `offset: -1` é a semana de 24 a 30 de
 * agosto (segunda a domingo), e a de 17 a 23 é a anterior — a que dá os deltas
 * de que os destaques de saúde e de sono precisam para existir.
 */
const AGORA = new Date(2026, 8, 6, 12, 0, 0);

/** Os sete dias da semana medida, e os sete da anterior. */
const DIAS = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];
const DIAS_ANTES = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];

let n = 0;
function atividade(dia: string, distanceM: number): Activity {
  return {
    id: `a${n += 1}`, userId: 'u', activityId: 13, calories: 0,
    startAt: `${dia}T08:00:00`, endAt: `${dia}T09:00:00`, durationS: 3600,
    distanceM, hasRoute: false,
  };
}

/** Uma noite que acorda em `dia`, com as horas e os minutos de vigília pedidos. */
function noite(dia: string, asleepH: number, awakeMin: number): SleepPeriod {
  // Um despertar só, com a duração pedida: é dele que sai o `minMean`, e a conta
  // do núcleo é `to − from` (`awakeMinOf`), não um campo de minutos.
  const de = new Date(`${dia}T03:00:00.000Z`);
  const ate = new Date(de.getTime() + awakeMin * 60_000);
  return {
    userId: 'u',
    onsetAt: `${dia}T00:30:00.000Z`,
    wakeAt: `${dia}T07:30:00.000Z`,
    inBedAt: null, inBedEnd: null, tzOffset: 120,
    wakeDay: dia,
    asleepH,
    awakenings: [{ from: de.toISOString(), to: ate.toISOString() }],
    stages: null, stageSegments: null,
  };
}

interface Semana {
  /** Metros por atividade da semana medida. Lista vazia = nenhuma atividade. */
  distancias?: readonly number[];
  tarefas?: number;
  /** Preço de cada compra da semana. */
  compras?: readonly number[];
  fc?: boolean;
  /** Minutos de vigília média da semana medida. `null` = sem noites. */
  vigiliaMin?: number | null;
}

/** A entrada de uma semana de agosto/2026 — tipada, sem cast nenhum. */
function entradaDe(o: Semana = {}): RetroInput {
  const { distancias = [12_000, 10_100, 9_000, 11_000], tarefas = 9, compras = [60, 40, 20], fc = true } = o;
  const vigiliaMin = o.vigiliaMin === undefined ? 23 : o.vigiliaMin;
  return {
    now: AGORA,
    kind: 'week',
    offset: -1,
    activities: [
      ...distancias.map((m, i) => atividade(DIAS[i % DIAS.length], m)),
      // A semana anterior existe para os deltas: ela não entra em fato nenhum.
      ...DIAS_ANTES.slice(0, 3).map((d) => atividade(d, 10_000)),
    ],
    health: fc
      ? [{
        metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart',
        decimals: 0, unit: ' bpm',
        valuesByDay: new Map([
          ...DIAS.map((d) => [d, 48] as const),
          ...DIAS_ANTES.map((d) => [d, 52] as const),
        ]),
      }]
      : [],
    habits: [],
    registros: [],
    tasks: [
      ...Array.from({ length: tarefas }, (_, i) => ({ doneDay: DIAS[i % DIAS.length], module: 'geral' })),
      ...DIAS_ANTES.slice(0, 6).map((d) => ({ doneDay: d, module: 'geral' })),
    ],
    purchases: compras.map((price, i) => ({ doneDay: DIAS[i % DIAS.length], price, name: `c${i}` })),
    ...(vigiliaMin === null ? {} : {
      sleepPeriods: [
        // 7h12 por noite agora, 7h30 antes: o delta passa o piso de 5 min, e a
        // vigília média sai do despertar único de cada noite.
        ...DIAS.map((d) => noite(d, 7.2, vigiliaMin)),
        ...DIAS_ANTES.map((d) => noite(d, 7.5, 17)),
      ],
    }),
  };
}

/** O resumo tipado da semana — pelo núcleo, como a tela o monta. */
function semana(o: Semana = {}): RetroSummary {
  const resumo = buildRetrospective(entradaDe(o));
  assert.equal(resumo.startISO, '2026-08-24', 'o fixture caiu em outra semana');
  assert.equal(resumo.endISO, '2026-08-30', 'o fixture caiu em outra semana');
  return resumo;
}

/** Os destaques de verdade, sobre a mesma entrada — a ordem e os ids de produção. */
function destaquesDe(o: Semana = {}): WeekHighlight[] {
  const entrada = entradaDe(o);
  return buildRetroHighlights(buildRetrospective(entrada), entrada);
}

/** O destaque à mão — para medir a escolha sem depender do gerador. */
const destaque = (id: string, kind: WeekHighlight['kind'], priority = 10): WeekHighlight => ({
  id, kind, priority, tone: 'neutral', icon: 'workout', text: `texto de ${id}`,
});

/**
 * As marcas de comparação que o postal **não pode** escrever: base, delta,
 * percentual e as palavras que a Retrospectiva usa para comparar.
 *
 * É a decisão do dono de 25/09 virada em teste. O sinal de menos entra porque é
 * o que `fmtMoney` e os deltas da retro usam (o traço unicode, não o hífen).
 */
const COMPARACAO = /vs\.|anterior|melhor|pior|est[áa]vel|igual\s|%|\+|−/i;

/* ── a matriz ────────────────────────────────────────────────────────────── */

/** Nada: a semana em que não se mediu coisa alguma. */
const VAZIA: Semana = { distancias: [], tarefas: 0, compras: [], fc: false, vigiliaMin: null };

describe('o fixture', () => {
  it('os ids declarados existem de verdade: o gerador produz cada um deles', () => {
    const ids = new Set(destaquesDe().map((h) => h.id));
    for (const id of ['workouts', 'distance', 'tasks', 'spend', 'sleep-asleep', 'sleep-awake', 'health-fcRepouso']) {
      assert.ok(ids.has(id), `buildRetroHighlights não produziu "${id}" — a tabela do postal aponta para o vazio`);
    }
  });
});

describe('montarPostal — a semana cheia', () => {
  it('corta em três, na ordem dos destaques, e nunca mais que isso', () => {
    const destaques = destaquesDe();
    const { fatos } = montarPostal(semana(), destaques);
    assert.equal(fatos.length, FATOS_DO_POSTAL);
    // A ordem é a que chegou: o postal filtra e corta, nunca reordena.
    const ordemDosDestaques = destaques.map((h) => h.id);
    const posicoes = fatos.map((f) => ordemDosDestaques.indexOf(f.id));
    assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b), JSON.stringify(fatos));
  });

  it('cada fato é valor absoluto — nenhuma base, nenhum delta, nenhum percentual', () => {
    for (const f of montarPostal(semana(), destaquesDe()).fatos) {
      assert.equal(COMPARACAO.test(`${f.rotulo} ${f.valor}`), false, `o fato "${f.rotulo}: ${f.valor}" compara`);
    }
  });

  it('o valor escrito é o do resumo, e não o do texto do destaque', () => {
    const resumo = semana();
    // Um a um, forçando cada fonte a ser o primeiro fato: é assim que se lê o
    // que cada linha da tabela escreve, sem depender da ordem do ranqueamento.
    const so = (id: string) => montarPostal(resumo, [destaque(id, 'volume')]).fatos;
    assert.deepEqual(so('workouts'), [{ id: 'workouts', rotulo: 'Treinos', valor: '4' }]);
    assert.deepEqual(so('distance'), [{ id: 'distance', rotulo: 'Distância', valor: '42,1 km' }]);
    assert.deepEqual(so('tasks'), [{ id: 'tasks', rotulo: 'Tarefas concluídas', valor: '9' }]);
    assert.deepEqual(so('spend'), [{ id: 'spend', rotulo: 'Compras', valor: '€120' }]);
    assert.deepEqual(so('sleep-asleep'), [{ id: 'sleep-asleep', rotulo: 'Sono por noite', valor: '7h12' }]);
    assert.deepEqual(so('sleep-awake'), [{ id: 'sleep-awake', rotulo: 'Acordado por noite', valor: '23 min' }]);
    // A saúde vem pelo padrão `health-<métrica>`, e o rótulo e a unidade saem da
    // linha do resumo — o destaque dela é uma comparação inteira ("pior: +3 bpm").
    assert.deepEqual(so('health-fcRepouso'), [{ id: 'health-fcRepouso', rotulo: 'FC de repouso', valor: '48 bpm' }]);
  });

  it('o singular concorda: um treino é "Treino", uma tarefa é "Tarefa concluída"', () => {
    const resumo = semana({ distancias: [12_000], tarefas: 1 });
    const fatos = montarPostal(resumo, [destaque('workouts', 'volume'), destaque('tasks', 'volume')]).fatos;
    assert.deepEqual(fatos.map((f) => f.rotulo), ['Treino', 'Tarefa concluída']);
  });
});

describe('montarPostal — o que não vira fato', () => {
  it('o insight cruzado é comparação inteira: não há valor a extrair, e ele não entra', () => {
    const cruzado = destaque('trigger-cerveja-sono', 'cross', 900);
    const { fatos } = montarPostal(semana(), [cruzado, destaque('workouts', 'volume')]);
    assert.deepEqual(fatos.map((f) => f.id), ['workouts']);
  });

  it('a nota × medição do sono também é comparação: fora', () => {
    assert.deepEqual(montarPostal(semana(), [destaque('sleep-rating', 'cross', 900)]).fatos, []);
  });

  it('destaque cujo id o postal não conhece não aparece — o padrão é não mostrar', () => {
    assert.deepEqual(montarPostal(semana(), [destaque('inventado-amanha', 'volume')]).fatos, []);
  });

  /**
   * **`Object.freeze({…})` herdaria de `Object.prototype`.** Um destaque chamado
   * `toString` acharia o método herdado, seria chamado com o resumo e empurraria
   * um fato com rótulo e valor `undefined`. É inalcançável hoje (todo id dinâmico
   * é prefixado) — e é a única coisa que o tipo do mapa não garantia.
   */
  it('id com nome de método de Object não acha nada — o mapa não herda', () => {
    const resumo = semana();
    for (const id of ['toString', 'valueOf', 'hasOwnProperty', 'constructor', '__proto__']) {
      assert.deepEqual(montarPostal(resumo, [destaque(id, 'volume')]).fatos, [], id);
    }
  });

  it('métrica de saúde que o resumo não tem não vira fato', () => {
    assert.deepEqual(montarPostal(semana({ fc: false }), [destaque('health-fcRepouso', 'health')]).fatos, []);
  });

  it('zero não é fato: é a ausência dele', () => {
    const resumo = semana(VAZIA);
    const ids = ['workouts', 'distance', 'tasks', 'spend'].map((id) => destaque(id, 'volume'));
    assert.deepEqual(montarPostal(resumo, ids).fatos, []);
  });

  /**
   * **O que seria escrito como zero também não é fato** — e é aqui que a régua
   * deixa de ser "o valor é zero" e passa a ser "o número já arredondado lê
   * zero". Um postal que diz `0,0 km`, `€0` ou `0 min` é pior que um fato a
   * menos: sem comparação, o leitor não distingue "quase nada" de "não medido".
   */
  it('quase-zero não é fato: 40 m, €0,40 e meio minuto de vigília somem', () => {
    // 40 m: `0,0 km` a uma casa. A semana tem UMA atividade, e ela é curta.
    const curta = montarPostal(semana({ distancias: [40] }), [destaque('distance', 'volume')]).fatos;
    assert.deepEqual(curta, []);
    // E a 50 m ele volta, porque aí o número escrito deixa de ser zero.
    assert.deepEqual(
      montarPostal(semana({ distancias: [50] }), [destaque('distance', 'volume')]).fatos,
      [{ id: 'distance', rotulo: 'Distância', valor: '0,1 km' }],
    );

    // €0,40 arredonda para "€0" — e €0,60 vira "€1", que é medida de verdade.
    assert.deepEqual(montarPostal(semana({ compras: [0.4] }), [destaque('spend', 'volume')]).fatos, []);
    assert.deepEqual(
      montarPostal(semana({ compras: [0.6] }), [destaque('spend', 'volume')]).fatos,
      [{ id: 'spend', rotulo: 'Compras', valor: '€1' }],
    );

    // Meio minuto de vigília média lê "0 min", que soa como "não acordou".
    assert.deepEqual(montarPostal(semana({ vigiliaMin: 0.4 }), [destaque('sleep-awake', 'health')]).fatos, []);
    assert.deepEqual(
      montarPostal(semana({ vigiliaMin: 0.6 }), [destaque('sleep-awake', 'health')]).fatos,
      [{ id: 'sleep-awake', rotulo: 'Acordado por noite', valor: '1 min' }],
    );
  });

  it('sem noites, nenhum fato de sono', () => {
    const resumo = semana({ vigiliaMin: null });
    const ids = ['sleep-asleep', 'sleep-awake'].map((id) => destaque(id, 'health'));
    assert.deepEqual(montarPostal(resumo, ids).fatos, []);
  });

  it('id repetido conta uma vez — chave de render é única', () => {
    const fatos = montarPostal(semana(), [destaque('workouts', 'volume'), destaque('workouts', 'volume')]).fatos;
    assert.deepEqual(fatos.map((f) => f.id), ['workouts']);
  });
});

describe('montarPostal — a semana magra', () => {
  it('um fato só é um fato só: mostra o que tem, sem inventar terceiro nem encher de vazio', () => {
    const so = { ...VAZIA, tarefas: 9 };
    assert.deepEqual(
      montarPostal(semana(so), destaquesDe(so)).fatos,
      [{ id: 'tasks', rotulo: 'Tarefas concluídas', valor: '9' }],
    );
  });

  it('semana sem nada devolve lista vazia, e não três lugares reservados', () => {
    assert.deepEqual(montarPostal(semana(VAZIA), destaquesDe(VAZIA)).fatos, []);
  });

  it('sem destaque nenhum, o postal é vazio — e continua sendo um postal', () => {
    const p = montarPostal(semana(), []);
    assert.deepEqual(p.fatos, []);
    assert.deepEqual(p.trajetoria, []);
  });
});

describe('o silêncio da 2.5 não alcança o postal', () => {
  /**
   * **A ausência é que é a decisão, e por isso ela tem teste.**
   *
   * `cadernosVisiveis` cala **cadernos** de uma edição, e o postal não tem
   * cadernos: ele mostra fatos, que são métricas. Um "conserto" que passasse a
   * lista de visíveis por aqui não teria o que filtrar — e escolheria, sem
   * dizer, que "Sono por noite" pertence ao caderno Sono.
   */
  it('montarPostal recebe dois argumentos, e nenhum deles é lista de cadernos', () => {
    assert.equal(montarPostal.length, 2);
  });

  it('nenhum fato é identificado por caderno — as unidades do postal são métricas', () => {
    const ids = montarPostal(semana(), destaquesDe()).fatos.map((f) => f.id);
    assert.ok(ids.length > 0, 'a semana cheia ficou sem fato — o fixture mudou?');
    for (const caderno of ['sono', 'movimento', 'coracao', 'rotina']) {
      assert.ok(!ids.includes(caderno), `o fato "${caderno}" é um caderno, e o postal não tem cadernos`);
    }
  });
});

describe('o lugar declarado da trajetória', () => {
  /**
   * O estreitamento que a story declarou: {@link FatoTendencia} existe como
   * forma e **ninguém a produz**. O campo fica escrito e vazio para a story que
   * a produzir não ter de reabrir a decisão de 25/09.
   *
   * Se um dia alguém a preencher, este teste cai — e é exatamente o que ele
   * deve fazer: produzir trajetória é *Ask First*.
   */
  it('está sempre vazia, em qualquer combinação', () => {
    for (const o of [{}, { vigiliaMin: null } as Semana, VAZIA]) {
      assert.deepEqual(montarPostal(semana(o), destaquesDe(o)).trajetoria, []);
    }
  });

  it('é congelada: o lugar não se preenche por engano de quem lê o postal', () => {
    const p = montarPostal(semana(), []);
    assert.ok(Object.isFrozen(p.trajetoria));
  });
});

describe('o tipo que vira postal', () => {
  it('é a semana, e o resumo do postal é o dela', () => {
    assert.equal(TIPO_DO_POSTAL, 'week');
    assert.equal(semana().kind, TIPO_DO_POSTAL);
  });
});
