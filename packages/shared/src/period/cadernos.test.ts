import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RetroSummary } from './retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import { montarPacotes } from '../ia/pacote';
import type { PacoteDeFatos } from '../ia/pacote';
import {
  CADERNOS,
  CADERNO_IDS,
  LAPIDES,
  METRICAS_COM_LAPIDE,
  cadernoDaMetricaDeSaude,
  cadernoDef,
  isCadernoId,
  isMetricaComLapide,
  rotuloDoCaderno,
} from './cadernos';
import type { CadernoId, MetricaComLapide } from './cadernos';
import { MONTHS_PT } from './bounds';

/**
 * O catálogo é lei — e lei que ninguém cobra é prosa.
 *
 * `cadernos.md` diz, campo a campo, a que caderno cada dado pertence, e
 * `CADERNOS` transcreve isso com uma marca por linha: `noPacote`. Este arquivo
 * liga cada marca a um **predicado sobre a montagem real**, para que ela não
 * possa mentir.
 *
 * Não é zelo abstrato: a primeira versão do catálogo afirmava entregar "esforço
 * duro" (`RetroFitness.hardMin`) e "o gasto derivado por unit_price", e nenhum
 * dos dois chegava ao pacote. As duas linhas passaram meses de revisão humana
 * sem que ninguém notasse, porque `noPacote` era um booleano que ninguém lia.
 */

/* ── fábricas ── */

function recap(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function metrica(current: number, prior: number, n = 30): MetricRecap {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n };
}

const VAZIO = recap(0, 0);

/**
 * Um período **cheio**: cada linha marcada `noPacote: true` tem dado aqui.
 *
 * É de propósito mais rico que o agosto real de `ia/pacote.test.ts` — agosto não
 * tem hábito nem registro nenhum, e um catálogo conferido contra um período sem
 * hábitos aprovaria a linha "hábitos" sem nunca a exercitar.
 */
function periodoCheio(): RetroSummary {
  const esporte = (id: number) => ({
    activityId: id,
    sessions: recap(7, 11),
    distanceM: recap(333_000, 820_000),
    movingS: recap(81_720, 190_000),
    elevationM: recap(2_140, 1_800),
    calories: VAZIO,
    speedMps: { current: null, prior: null },
    longest: null,
    bestEfforts: [],
  });
  const habito = (id: string, name: string, bad: boolean) => ({
    id, name, bad, unit: 'L', unitPrice: 11,
    recap: recap(12, 9), total: recap(6, 4), perDay: 0.2, perDayDays: 31,
  });
  return {
    kind: 'month',
    offset: -1,
    label: 'Agosto',
    startISO: '2026-08-01',
    endISO: '2026-08-31',
    tasks: { total: recap(44, 39), byModule: [] },
    habits: {
      good: [habito('h-agua', 'Água', false)],
      bad: [habito('h-cerveja', 'Cerveja', true)],
    },
    registros: [{ id: 'r-corte', name: 'Corte de cabelo', recap: recap(1, 2), everyDays: 31 }],
    fitness: {
      count: recap(21, 17),
      distanceM: recap(435_000, 862_000),
      durationS: recap(144_360, 245_520),
      calories: VAZIO,
      hardMin: recap(310, 480),
      floors: recap(539, 500),
      steps: recap(537_847, 500_000),
      byType: [],
    },
    sports: { cycling: esporte(13), running: esporte(37) },
    health: [
      {
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'moon' as never,
        decimals: 2, unit: 'h', recap: metrica(7.03, 6.89, 27), trend: 'up',
      },
      {
        metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
        decimals: 1, unit: 'bpm', recap: metrica(48.1, 49, 29), trend: 'down',
      },
      {
        metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv' as never,
        decimals: 0, unit: 'ms', recap: metrica(64, 61, 22), trend: 'up',
      },
    ],
    ratings: { sleep: metrica(3.72, 3.39, 30), day: metrica(4, 3.82, 30) },
    purchases: { count: recap(9, 6), spend: recap(214.5, 180), byCat: [] },
    adherence: { done: 44, total: 51 },
    sleep: null,
    sleepTriggers: null,
  } as RetroSummary;
}

/**
 * As quatro mortes reais de 2026 (respiração 10/07, VO₂max 14/07, SpO₂ 16/07,
 * anéis 17/08). Todas até o fim de agosto, então todas entram no pacote do
 * período cheio — três como antigas, a dos anéis como do período.
 */
const LAPIDES_DE_2026 = [
  { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10' },
  { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
  { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' },
  { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
] as const;

const PACOTES = montarPacotes({
  resumo: periodoCheio(), agora: new Date('2026-09-06T19:00:00'), lapides: LAPIDES_DE_2026,
});

function pacote(id: CadernoId): PacoteDeFatos {
  return PACOTES.find((p) => p.caderno === id)!;
}

const temChave = (id: CadernoId, chave: string) => () =>
  pacote(id).metricas.some((f) => f.chave === chave);

const temPrefixo = (id: CadernoId, prefixo: string) => () =>
  pacote(id).metricas.some((f) => f.chave.startsWith(prefixo));

/** As lápides de um caderno são EXATAMENTE estas — nem a mais, nem no vizinho. */
const lapidesSao = (id: CadernoId, esperadas: readonly MetricaComLapide[]) => () =>
  JSON.stringify(pacote(id).lapides.map((l) => l.metrica).sort()) === JSON.stringify([...esperadas].sort());

/**
 * Um predicado por linha marcada `noPacote: true`. A chave é o `campo` do
 * catálogo, para que renomear a linha sem acertar o predicado também reprove.
 */
const ENTREGUE: Readonly<Record<string, () => boolean>> = {
  // Sono
  'nota × medição': () => temChave('sono', 'nota_sono')() && temChave('sono', 'sono')(),
  // Movimento
  'km · tempo': () => temChave('movimento', 'distancia')() && temChave('movimento', 'tempo')(),
  'elevação': temPrefixo('movimento', 'ciclismo.elevacao'),
  'passos e andares': () => temChave('movimento', 'passos_dia')() && temChave('movimento', 'andares')(),
  // As duas lápides do Movimento — pela rota única da métrica. Se VO₂max ou
  // anéis caíssem no padrão do mapa de saúde (Coração), este predicado reprova.
  'lápides de VO₂max e anéis': lapidesSao('movimento', ['vo2max', 'aneis']),
  // Coração
  'FC de repouso': temChave('coracao', 'fcRepouso'),
  'VFC': temChave('coracao', 'vfc'),
  'lápides de respiração e SpO₂': lapidesSao('coracao', ['respiracao', 'spo2']),
  // Rotina
  'hábitos — dias com registro': temPrefixo('rotina', 'habito.'),
  'registros': temPrefixo('rotina', 'registro.'),
  'notas do dia': temChave('rotina', 'nota_dia'),
  'compras e gasto do período': () =>
    temChave('rotina', 'compras')() && temChave('rotina', 'gasto')(),
};

/**
 * O outro sentido da mentira, para as duas linhas que já mentiram uma vez.
 *
 * Uma marca `false` que na verdade está no pacote é tão errada quanto o
 * contrário, e o teste das marcas `true` nunca a pegaria.
 */
const AUSENTE: Readonly<Record<string, () => boolean>> = {
  // `hardMin` existe no RetroSummary e o fixture o preenche; se um dia alguém o
  // montar, esta linha reprova até a marca virar.
  'esforço duro': () => pacote('movimento').metricas.every(
    (f) => !/esfor|hard|duro/i.test(f.chave) && !/esfor|duro/i.test(f.rotulo),
  ),
  // `unitPrice` está no fixture (11 €/L). Um gasto derivado apareceria como
  // fato novo em Rotina, com euro na unidade.
  'hábitos — o gasto derivado por unit_price': () => pacote('rotina').metricas.every(
    (f) => !(f.chave.startsWith('habito.') && f.unidade !== 'dias'),
  ),
};

/* ── vocabulário ── */

describe('CadernoId — o vocabulário com dono único', () => {
  it('são quatro, minúsculas sem acento, na ordem do catálogo', () => {
    assert.deepEqual([...CADERNO_IDS], ['sono', 'movimento', 'coracao', 'rotina']);
    for (const id of CADERNO_IDS) assert.match(id, /^[a-z]+$/);
  });

  it('isCadernoId recusa o que não é caderno — inclusive a lua', () => {
    for (const bom of CADERNO_IDS) assert.equal(isCadernoId(bom), true);
    // `caderno='lua'` é o que a AD-5 manda para `lua_execucoes`, não para cá.
    for (const mau of ['lua', 'coração', 'Sono', 'saude', '', null, 7]) {
      assert.equal(isCadernoId(mau), false, `"${String(mau)}" não é caderno`);
    }
  });

  it('cadernoDef e rotuloDoCaderno respondem por todos', () => {
    for (const id of CADERNO_IDS) {
      assert.equal(cadernoDef(id).id, id);
      assert.ok(rotuloDoCaderno(id).length > 0);
    }
    assert.equal(rotuloDoCaderno('coracao'), 'Coração');
  });

  it('saúde se parte pelo mapa, e o padrão é Coração', () => {
    assert.equal(cadernoDaMetricaDeSaude('sono'), 'sono');
    assert.equal(cadernoDaMetricaDeSaude('fcRepouso'), 'coracao');
    assert.equal(cadernoDaMetricaDeSaude('vfc'), 'coracao');
    // A exceção nomeada: `cadernos.md` põe VO₂max e anéis em Movimento.
    assert.equal(cadernoDaMetricaDeSaude('vo2max'), 'movimento');
    assert.equal(cadernoDaMetricaDeSaude('aneis'), 'movimento');
    // O que resta de health_daily depois que o sono sai é assunto do Coração.
    assert.equal(cadernoDaMetricaDeSaude('metrica-que-ainda-nao-existe'), 'coracao');
  });
});

/* ── a lápide: mapa próprio, nome sem dígito ── */

describe('LAPIDES — as quatro do catálogo, cada uma no seu caderno', () => {
  it('são exatamente quatro, com os ids do catálogo de métricas', () => {
    assert.deepEqual([...METRICAS_COM_LAPIDE].sort(), ['aneis', 'respiracao', 'spo2', 'vo2max']);
    for (const m of METRICAS_COM_LAPIDE) assert.equal(isMetricaComLapide(m), true);
    // Outra métrica de saúde não vira lápide só por ser de saúde.
    for (const mau of ['vfc', 'fcRepouso', 'sono', 'VO2max', '', null, 7]) {
      assert.equal(isMetricaComLapide(mau), false, `"${String(mau)}" não tem lápide`);
    }
    assert.ok(Object.isFrozen(LAPIDES), 'o barril exporta o mapa — sem freeze, um consumidor o reescreve');
  });

  it('VO₂max e anéis são de MOVIMENTO; respiração e SpO₂, de Coração', () => {
    assert.equal(LAPIDES.vo2max.caderno, 'movimento');
    assert.equal(LAPIDES.aneis.caderno, 'movimento');
    assert.equal(LAPIDES.respiracao.caderno, 'coracao');
    assert.equal(LAPIDES.spo2.caderno, 'coracao');
  });

  it('UMA rota só: para toda métrica com lápide, o mapa dela e o de saúde dão o mesmo caderno', () => {
    // Duas rotas para a mesma métrica é o dia em que a lápide do VO₂max mora
    // num caderno e a linha de VO₂max, no outro — e em julho/2026 o Coração
    // lideraria por uma morte que é do Movimento.
    for (const m of METRICAS_COM_LAPIDE) {
      assert.equal(LAPIDES[m].caderno, cadernoDaMetricaDeSaude(m), `${m}: as duas rotas se separaram`);
    }
  });

  it('o verbo concorda com o nome — "anéis de atividade pararam", os outros "parou"', () => {
    // A FORMA manda COPIAR a frase da linha: um verbo fixo no singular seria o
    // prompt ensinando o erro de concordância.
    assert.deepEqual(
      METRICAS_COM_LAPIDE.map((m) => [m, LAPIDES[m].verbo]),
      [['vo2max', 'parou'], ['aneis', 'pararam'], ['respiracao', 'parou'], ['spo2', 'parou']],
    );
    for (const m of METRICAS_COM_LAPIDE) {
      const plural = LAPIDES[m].nome.split(' ')[0].endsWith('s');
      assert.equal(LAPIDES[m].verbo, plural ? 'pararam' : 'parou', `${m}: verbo não concorda com "${LAPIDES[m].nome}"`);
    }
  });

  it('o nome é prosa SEM DÍGITO — nem ASCII nem subscrito', () => {
    // O `NUM` da conferência lê o "2" de "VO2" como número fora do alfabeto. O
    // subscrito é inerte para o regex, mas o modelo o normaliza ao copiar.
    for (const m of METRICAS_COM_LAPIDE) {
      const nome = LAPIDES[m].nome;
      assert.equal(/\d/.test(nome), false, `"${nome}" tem dígito`);
      assert.equal(/\p{N}/u.test(nome), false, `"${nome}" tem dígito subscrito ou sobrescrito`);
      assert.equal(nome, nome.toLowerCase(), `"${nome}" não é prosa minúscula`);
    }
    assert.deepEqual(
      METRICAS_COM_LAPIDE.map((m) => LAPIDES[m].nome),
      ['consumo máximo de oxigênio', 'anéis de atividade', 'frequência respiratória', 'saturação de oxigênio'],
    );
  });

  it('a frase inteira — nome e verbo, singular e plural — não carrega mês, dígito nem vocabulário de base', () => {
    // A lápide vai ao texto em parágrafo próprio, e o parágrafo é o alcance da
    // quinta regra: nome de mês ou "ano passado" dentro dele nomeariam base. A
    // varredura é da frase que o texto escreve, com o verbo de cada uma.
    const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const VOCAB = ['anterior', 'passad', 'normal', 'costuma', 'media', 'ha um ano', 'um ano antes'];
    for (const m of METRICAS_COM_LAPIDE) {
      const frase = norm(`${LAPIDES[m].nome} ${LAPIDES[m].verbo} de chegar em`);
      assert.deepEqual(MONTHS_PT.map(norm).filter((mes) => new RegExp(`\\b${mes}\\b`).test(frase)), [], frase);
      assert.deepEqual(VOCAB.filter((v) => frase.includes(v)), [], frase);
      assert.equal(/\p{N}/u.test(frase), false, frase);
    }
  });

  it('as duas linhas de lápide do catálogo dizem que ninguém produz a lápide ainda', () => {
    for (const c of CADERNOS) {
      for (const f of c.fontes.filter((x) => x.campo.startsWith('lápides'))) {
        assert.equal(f.noPacote, true, f.campo);
        assert.match(f.nota ?? '', /ninguém a produz ainda/, `${f.campo}: entregue sem dizer que a entrada ainda vem vazia`);
        assert.match(f.nota ?? '', /deferred-work/);
      }
    }
  });
});

/* ── o catálogo contra a montagem ── */

describe('o catálogo é cobrado, não prometido', () => {
  const todas = CADERNOS.flatMap((c) => c.fontes.map((f) => ({ caderno: c.id, ...f })));

  it('nenhum campo aparece em dois cadernos — dono único vale para o dado também', () => {
    const campos = todas.map((f) => f.campo);
    assert.equal(new Set(campos).size, campos.length, `campo repetido em ${campos.join(' · ')}`);
  });

  it('todo caderno declara pelo menos uma fonte', () => {
    for (const c of CADERNOS) assert.ok(c.fontes.length > 0, `${c.id} sem fonte`);
  });

  it('toda linha marcada `noPacote: true` tem predicado — marca nova sem prova reprova', () => {
    const semPredicado = todas.filter((f) => f.noPacote && !(f.campo in ENTREGUE));
    assert.deepEqual(
      semPredicado.map((f) => f.campo), [],
      'acrescentar uma linha entregue sem ligá-la à montagem devolve o catálogo à prosa',
    );
  });

  it('toda linha marcada `noPacote: true` REALMENTE está no pacote', () => {
    const mentindo = todas
      .filter((f) => f.noPacote && !ENTREGUE[f.campo]())
      .map((f) => `${f.caderno}: "${f.campo}"`);
    assert.deepEqual(
      mentindo, [],
      'o catálogo afirma entregar campo que a montagem não emite — '
      + 'ausência declarada vale mais que entrega falsamente afirmada',
    );
  });

  it('as duas linhas que já mentiram continuam ausentes, e declaradas', () => {
    for (const campo of Object.keys(AUSENTE)) {
      const linha = todas.find((f) => f.campo === campo);
      assert.ok(linha, `a linha "${campo}" sumiu do catálogo`);
      assert.equal(linha!.noPacote, false, `"${campo}" foi marcada como entregue`);
      assert.ok(linha!.nota, 'ausência sem nota não diz ao próximo por que ela é ausência');
      assert.equal(AUSENTE[campo](), true, `"${campo}" está no pacote e a marca não virou`);
    }
  });

  it('toda linha `noPacote: false` que não é uma delas ao menos tem fonte nomeada', () => {
    for (const f of todas.filter((x) => !x.noPacote)) {
      assert.ok(f.fonte.length > 0, `"${f.campo}" sem fonte`);
    }
  });
});
