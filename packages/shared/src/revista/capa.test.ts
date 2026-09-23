/**
 * A escolha da capa e as suas legendas (Story 1.13).
 *
 * O que se protege aqui é a matriz do spec, linha a linha:
 *
 * - **a cascata das três naturezas** — foto, senão traçado, senão grade —, e em
 *   particular a terceira, que é a que faz 2023 parecer 2023. Inverter a ordem ou
 *   esquecer a `grade` deixaria edições inteiras sem capa, e o sintoma só
 *   apareceria na tela;
 * - **a identidade que acompanha a natureza**, que é o que o `CHECK`
 *   `capa_identidade_bate_com_natureza` exige do outro lado: uma foto sem
 *   instante é uma capa que a cura da ADR 0037 não reencontra;
 * - **os três campos da legenda, cada um opcional, com a hora sempre de pé** — é
 *   o `CHECK` de legenda não-vazia que está por trás disso, e a legenda é também
 *   a descrição textual da imagem;
 * - **o desempate da rota mais longa**, que existe para dois hospedeiros
 *   escolherem a mesma rota sem depender da ordem que o banco devolveu.
 *
 * Os instantes são montados por componentes locais (`new Date(a, m, d, h, min)`)
 * de propósito: a hora da legenda é hora de parede, e um `Z` faria o caso das
 * 12:38 virar outra hora em todo fuso que não o de quem escreveu o teste.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Capa } from '../data/edicoes-capa';
import type { Activity, ActivityPhoto, CityMark } from '../models';
import {
  atividadesDoPeriodo, capaTrocada, cidadesDoPeriodo, escolherCapa, fichaDaCapa, FotoRecusadaNaTroca,
  legendaDaFoto, legendaDaRota, nomeDaAtividadeNaCapa, podeSerCapaNaTroca, rotuloDaEdicao,
  secoesDoSeletor, type PeriodoDaCapa,
} from './capa';

const PERIODO: PeriodoDaCapa = {
  tipoPeriodo: 'month',
  inicio: '2026-08-01',
  fim: '2026-08-31',
  rotulo: 'Agosto de 2026',
};

/** 14/08/2026, 12:38 na hora de parede de quem roda o teste. */
const AS_12_38 = new Date(2026, 7, 14, 12, 38, 0).getTime();

const ITTRE: CityMark = { name: 'Ittre', lat: 50.64, lng: 4.26 };
const LEUVEN: CityMark = { name: 'Leuven', lat: 50.88, lng: 4.70 };

function foto(over: Partial<ActivityPhoto> = {}): ActivityPhoto {
  return {
    id: 'p-1',
    activityId: 'a-1',
    assetId: 'ph-1',
    takenAt: AS_12_38,
    lat: 50.641,
    lng: 4.262,
    mediaType: 'photo',
    durationS: null,
    routeIndex: 120,
    routeDistanceM: 31_100,
    offsetM: 4,
    onRoute: true,
    state: 'linked',
    isCover: false,
    ...over,
  };
}

function atividade(over: Partial<Activity> = {}): Activity {
  return {
    id: 'a-1',
    userId: 'u-1',
    activityId: 13,
    calories: 900,
    startAt: '2026-08-14T09:00:00.000Z',
    endAt: '2026-08-14T12:00:00.000Z',
    durationS: 10_800,
    distanceM: 62_400,
    hasRoute: true,
    cities: [ITTRE, LEUVEN],
    ...over,
  };
}

/* ── as legendas ─────────────────────────────────────────────────────────── */

describe('legendaDaFoto — três campos, cada um opcional', () => {
  it('a frase inteira: parada, quilômetro e hora', () => {
    assert.equal(legendaDaFoto(foto(), [ITTRE, LEUVEN]), 'Ittre · km 31,1 · 12:38');
  });

  it('a cidade é a mais próxima da foto, não a primeira da rota', () => {
    // A coordenada da foto está em cima de Leuven; Ittre é a primeira da lista.
    assert.equal(
      legendaDaFoto(foto({ lat: 50.879, lng: 4.701 }), [ITTRE, LEUVEN]),
      'Leuven · km 31,1 · 12:38',
    );
  });

  it('foto sem coordenada perde a cidade, e só ela', () => {
    assert.equal(legendaDaFoto(foto({ lat: null, lng: null }), [ITTRE]), 'km 31,1 · 12:38');
  });

  it('período sem acervo de cidade também perde a cidade', () => {
    assert.equal(legendaDaFoto(foto(), []), 'km 31,1 · 12:38');
  });

  it('foto fora do traçado perde o quilômetro', () => {
    assert.equal(legendaDaFoto(foto({ routeDistanceM: null }), [ITTRE]), 'Ittre · 12:38');
  });

  /**
   * A linha "Legenda incompleta" da matriz: **nunca legenda vazia**. A hora é a
   * chave da própria feature (ADR 0037 §2) e é o que impede o `CHECK` de
   * `edicoes_capa.legenda` de recusar a linha.
   */
  it('sem cidade e sem quilômetro sobra a hora — nunca o vazio', () => {
    assert.equal(
      legendaDaFoto(foto({ lat: null, lng: null, routeDistanceM: null }), []),
      '12:38',
    );
  });

  it('o quilômetro sai em pt-BR, com vírgula decimal e ponto de milhar', () => {
    assert.match(legendaDaFoto(foto({ routeDistanceM: 1_234_560 }), []), /^km 1\.234,6 · /);
  });

  /**
   * `takenAt` vem de `Date.parse(taken_at)`, que devolve `NaN` para uma data que
   * não se lê. Sem a guarda, a legenda carimbada sairia `"NaN:NaN"` — e ficaria
   * assim para sempre, porque período fechado congela.
   */
  it('instante que não se lê não vira hora "NaN:NaN"', () => {
    assert.equal(legendaDaFoto(foto({ takenAt: NaN }), [ITTRE]), 'Ittre · km 31,1');
  });
});

describe('legendaDaRota — a mesma frase sem hora', () => {
  it('cidade e quilômetro, sem hora: o traçado não fala de um instante', () => {
    assert.equal(legendaDaRota(atividade()), 'Ittre · km 62,4');
  });

  it('a cidade é a PRIMEIRA do percurso — não há ponto de onde medir a mais próxima', () => {
    assert.equal(legendaDaRota(atividade({ cities: [LEUVEN, ITTRE] })), 'Leuven · km 62,4');
  });

  it('rota sem cidade fica só com o quilômetro', () => {
    assert.equal(legendaDaRota(atividade({ cities: undefined })), 'km 62,4');
  });

  it('rota sem distância fica só com a cidade', () => {
    assert.equal(legendaDaRota(atividade({ distanceM: undefined })), 'Ittre');
  });

  it('sem nenhum dos dois não há frase — e quem chama cai no rótulo', () => {
    assert.equal(legendaDaRota(atividade({ cities: [], distanceM: undefined })), null);
  });
});

/* ── a cascata ───────────────────────────────────────────────────────────── */

describe('escolherCapa — foto, senão traçado, senão grade', () => {
  it('com foto vinculada: natureza foto, identidade da coverOf e a legenda de três campos', () => {
    const c = escolherCapa({
      fotos: [foto({ id: 'p-42' })],
      atividades: [atividade()],
      periodo: PERIODO,
      cidades: [ITTRE, LEUVEN],
    });
    assert.equal(c.natureza, 'foto');
    assert.equal(c.fotoId, 'p-42');
    assert.equal(c.fotoTakenAt, new Date(AS_12_38).toISOString());
    assert.equal(c.rotaActivityId, null);
    assert.equal(c.legenda, 'Ittre · km 31,1 · 12:38');
    // Uma foto só no período: não houve escolha, e o porquê diz isso (1.16).
    assert.equal(c.motivo, 'unica');
    assert.equal(c.fotoActivityId, 'a-1');
    assert.deepEqual(
      { tipoPeriodo: c.tipoPeriodo, inicio: c.inicio, fim: c.fim },
      { tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' },
    );
  });

  /**
   * A regra é `coverOf`, inteira — inclusive a estrela, que vence a maior rajada.
   * Reescrevê-la aqui faria a capa da edição divergir da tira da Retrospectiva e
   * do compositor, que é exatamente o que o contrato proíbe.
   */
  it('a estrela do dono vence, porque a regra é a coverOf e não uma cópia dela', () => {
    const c = escolherCapa({
      fotos: [
        foto({ id: 'p-1', takenAt: AS_12_38 }),
        foto({ id: 'p-2', takenAt: AS_12_38 + 60_000 }),
        foto({ id: 'p-3', takenAt: AS_12_38 + 120_000 }),
        foto({ id: 'p-estrela', takenAt: AS_12_38 + 9_000_000, isCover: true }),
      ],
      atividades: [],
      periodo: PERIODO,
      cidades: [],
    });
    assert.equal(c.fotoId, 'p-estrela');
  });

  /**
   * O pôster de vídeo é defeito aberto desde 07/09/2026: o quadro sai em branco.
   * Uma capa carimbada num clipe ficaria congelada e vazia, sem conserto a não ser
   * reimprimindo a edição inteira — então vídeo não é capa, e a cascata segue.
   */
  it('vídeo não vira capa, mesmo sendo a escolha da coverOf', () => {
    const c = escolherCapa({
      fotos: [foto({ id: 'clipe', mediaType: 'video', durationS: 12, isCover: true })],
      atividades: [atividade()],
      periodo: PERIODO,
      cidades: [ITTRE],
    });
    assert.equal(c.natureza, 'tracado');
    assert.equal(c.fotoId, null);
  });

  it('entre vídeo e foto, a foto é que concorre', () => {
    const c = escolherCapa({
      fotos: [
        foto({ id: 'clipe', mediaType: 'video', durationS: 12, isCover: true }),
        foto({ id: 'quadro', takenAt: AS_12_38 + 60_000 }),
      ],
      atividades: [],
      periodo: PERIODO,
      cidades: [],
    });
    assert.equal(c.natureza, 'foto');
    assert.equal(c.fotoId, 'quadro');
  });

  /**
   * `new Date(NaN).toISOString()` **lança** — dentro de uma função que o contrato
   * promete pura, e no meio de uma impressão que já pagou pelo texto. Sem instante
   * não há chave de cura (ADR 0037), então a foto simplesmente não é capa.
   */
  it('foto sem instante legível não vira capa, e não explode', () => {
    const c = escolherCapa({
      fotos: [foto({ id: 'sem-hora', takenAt: NaN })],
      atividades: [atividade()],
      periodo: PERIODO,
      cidades: [ITTRE],
    });
    assert.equal(c.natureza, 'tracado');
    assert.equal(c.fotoTakenAt, null);
  });

  it('sem foto elegível e sem rota, a cascata chega à grade', () => {
    const c = escolherCapa({
      fotos: [foto({ mediaType: 'video', durationS: 3 }), foto({ id: 'x', takenAt: NaN })],
      atividades: [],
      periodo: PERIODO,
      cidades: [],
    });
    assert.equal(c.natureza, 'grade');
    assert.equal(c.legenda, 'Agosto de 2026');
  });

  it('foto desligada não é foto: a capa cai para o traçado', () => {
    const c = escolherCapa({
      fotos: [foto({ state: 'dismissed' })],
      atividades: [atividade()],
      periodo: PERIODO,
      cidades: [ITTRE],
    });
    assert.equal(c.natureza, 'tracado');
    assert.equal(c.fotoId, null);
    assert.equal(c.fotoTakenAt, null);
    assert.equal(c.rotaActivityId, 'a-1');
    assert.equal(c.legenda, 'Ittre · km 62,4');
  });

  it('sem foto, a rota é a MAIS LONGA do período', () => {
    const c = escolherCapa({
      fotos: [],
      atividades: [
        atividade({ id: 'curta', distanceM: 12_000 }),
        atividade({ id: 'longa', distanceM: 88_000, cities: [LEUVEN] }),
        atividade({ id: 'media', distanceM: 40_000 }),
      ],
      periodo: PERIODO,
      cidades: [],
    });
    assert.equal(c.natureza, 'tracado');
    assert.equal(c.rotaActivityId, 'longa');
    assert.equal(c.legenda, 'Leuven · km 88,0');
  });

  it('atividade sem rota não vira capa de traçado', () => {
    const c = escolherCapa({
      fotos: [],
      atividades: [atividade({ id: 'academia', hasRoute: false, distanceM: undefined })],
      periodo: PERIODO,
      cidades: [],
    });
    assert.equal(c.natureza, 'grade');
    assert.equal(c.rotaActivityId, null);
  });

  /**
   * O desempate não é gosto: dois hospedeiros (o iPhone e o script do arquivo)
   * têm de escolher a MESMA rota, e a ordem em que o banco devolveu a lista não é
   * promessa nenhuma.
   */
  it('empate de distância desempata pela mais antiga, e depois pelo id', () => {
    const base = { distanceM: 50_000, cities: [] as CityMark[] };
    const embaralhadas = [
      atividade({ ...base, id: 'z', startAt: '2026-08-20T09:00:00.000Z' }),
      atividade({ ...base, id: 'a', startAt: '2026-08-10T09:00:00.000Z' }),
      atividade({ ...base, id: 'b', startAt: '2026-08-10T09:00:00.000Z' }),
    ];
    assert.equal(escolherCapa({ fotos: [], atividades: embaralhadas, periodo: PERIODO, cidades: [] }).rotaActivityId, 'a');
    assert.equal(
      escolherCapa({ fotos: [], atividades: [...embaralhadas].reverse(), periodo: PERIODO, cidades: [] }).rotaActivityId,
      'a',
    );
  });

  /**
   * A terceira natureza **não é sobra**: sem ela 2023 — sem foto e sem rota —
   * não teria capa nenhuma, e é a textura das capas que registra quando o dono
   * passou a fotografar.
   */
  it('sem foto e sem rota: grade, identidades nulas, e o período por extenso na legenda', () => {
    const c = escolherCapa({ fotos: [], atividades: [], periodo: PERIODO, cidades: [] });
    assert.equal(c.natureza, 'grade');
    assert.equal(c.fotoId, null);
    assert.equal(c.fotoTakenAt, null);
    assert.equal(c.rotaActivityId, null);
    assert.equal(c.legenda, 'Agosto de 2026');
  });

  it('nenhuma natureza sai com legenda vazia — o CHECK do banco recusaria a linha', () => {
    const casos = [
      escolherCapa({
        fotos: [foto({ lat: null, lng: null, routeDistanceM: null })],
        atividades: [], periodo: PERIODO, cidades: [],
      }),
      escolherCapa({
        fotos: [], atividades: [atividade({ cities: [], distanceM: undefined })],
        periodo: PERIODO, cidades: [],
      }),
      escolherCapa({ fotos: [], atividades: [], periodo: PERIODO, cidades: [] }),
    ];
    for (const c of casos) assert.ok(c.legenda.trim().length > 0, `${c.natureza} saiu sem legenda`);
  });

  it('rótulo em branco cai no início do período, e não no vazio', () => {
    const c = escolherCapa({
      fotos: [], atividades: [], periodo: { ...PERIODO, rotulo: '   ' }, cidades: [],
    });
    assert.equal(c.legenda, '2026-08-01');
  });
});

/* ── o porquê carimbado (Story 1.16) ─────────────────────────────────────── */

/**
 * A matriz do porquê, linha a linha. O motivo sai **da escolha**, no instante
 * dela — `coverOf` não muda, e o que se prende aqui é qual ramo dela decidiu.
 */
describe('escolherCapa — o motivo e a atividade da foto', () => {
  it('escolha com estrela: motivo estrela, e a atividade da foto preenchida', () => {
    const c = escolherCapa({
      fotos: [
        foto({ id: 'p-1', takenAt: AS_12_38 }),
        foto({ id: 'p-2', takenAt: AS_12_38 + 60_000 }),
        foto({ id: 'p-estrela', activityId: 'a-7', takenAt: AS_12_38 + 9_000_000, isCover: true }),
      ],
      atividades: [], periodo: PERIODO, cidades: [],
    });
    assert.equal(c.fotoId, 'p-estrela');
    assert.equal(c.motivo, 'estrela');
    assert.equal(c.fotoActivityId, 'a-7');
  });

  /** A estrela vence mesmo sendo a única: o porquê é o do primeiro ramo de `coverOf`. */
  it('a única foto, com estrela, é estrela — e não única', () => {
    const c = escolherCapa({
      fotos: [foto({ isCover: true })], atividades: [], periodo: PERIODO, cidades: [],
    });
    assert.equal(c.motivo, 'estrela');
  });

  it('escolha de uma foto só: única', () => {
    const c = escolherCapa({ fotos: [foto()], atividades: [], periodo: PERIODO, cidades: [] });
    assert.equal(c.motivo, 'unica');
  });

  /**
   * "Única" é entre as **elegíveis e vinculadas**: o vídeo, a foto sem instante e a
   * desligada não concorreram, então não tiram a escolha da única que sobrou.
   */
  it('a única elegível e vinculada é única, mesmo com vídeo, desligada e sem instante ao lado', () => {
    const c = escolherCapa({
      fotos: [
        foto({ id: 'quadro' }),
        foto({ id: 'clipe', mediaType: 'video', durationS: 4, takenAt: AS_12_38 + 30_000 }),
        foto({ id: 'desligada', state: 'dismissed', takenAt: AS_12_38 + 60_000 }),
        foto({ id: 'sem-hora', takenAt: NaN }),
      ],
      atividades: [], periodo: PERIODO, cidades: [],
    });
    assert.equal(c.fotoId, 'quadro');
    assert.equal(c.motivo, 'unica');
  });

  it('escolha por rajada: várias, nenhuma estrela', () => {
    const c = escolherCapa({
      fotos: [
        foto({ id: 'p-1', takenAt: AS_12_38 }),
        foto({ id: 'p-2', takenAt: AS_12_38 + 60_000 }),
        foto({ id: 'p-3', takenAt: AS_12_38 + 120_000 }),
      ],
      atividades: [], periodo: PERIODO, cidades: [],
    });
    assert.equal(c.fotoId, 'p-2');
    assert.equal(c.motivo, 'rajada');
    assert.equal(c.fotoActivityId, 'a-1');
  });

  it('escolha sem foto — traçado: sem-foto, e nenhuma atividade de foto', () => {
    const c = escolherCapa({ fotos: [], atividades: [atividade()], periodo: PERIODO, cidades: [] });
    assert.equal(c.natureza, 'tracado');
    assert.equal(c.motivo, 'sem-foto');
    assert.equal(c.fotoActivityId, null);
  });

  it('escolha sem foto — grade: sem-foto, e nenhuma atividade de foto', () => {
    const c = escolherCapa({ fotos: [], atividades: [], periodo: PERIODO, cidades: [] });
    assert.equal(c.natureza, 'grade');
    assert.equal(c.motivo, 'sem-foto');
    assert.equal(c.fotoActivityId, null);
  });
});

/* ── a troca (Story 1.16) ────────────────────────────────────────────────── */

describe('capaTrocada — a foto que o dono escolheu, pronta para o carimbo', () => {
  it('recarimba a capa: identidade nova, legenda recalculada com as cidades do período, motivo trocada', () => {
    const c = capaTrocada(PERIODO, foto({ id: 'p-9', activityId: 'a-3', lat: 50.879, lng: 4.701 }), [ITTRE, LEUVEN]);
    assert.deepEqual(c, {
      tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
      natureza: 'foto',
      fotoId: 'p-9',
      fotoTakenAt: new Date(AS_12_38).toISOString(),
      rotaActivityId: null,
      // A legenda é a que a impressão carimbaria para esta foto — nunca a da velha.
      legenda: 'Leuven · km 31,1 · 12:38',
      motivo: 'trocada',
      fotoActivityId: 'a-3',
    });
  });

  it('é a mesma legenda que o carimbo da impressão faria', () => {
    const f = foto({ id: 'p-9' });
    assert.equal(capaTrocada(PERIODO, f, [ITTRE]).legenda, legendaDaFoto(f, [ITTRE]));
  });

  /** A linha "Foto inválida na troca" da matriz, na parte que é pura. Nada volta: lança. */
  it('recusa vídeo, instante ilegível, foto desligada e foto sem arquivo — antes do banco', () => {
    const casos: [Partial<ActivityPhoto>, string][] = [
      [{ mediaType: 'video', durationS: 12 }, 'video'],
      [{ takenAt: NaN }, 'instante'],
      [{ state: 'dismissed' }, 'desligada'],
      [{ assetId: null }, 'sem-arquivo'],
      [{ assetId: '' }, 'sem-arquivo'],
    ];
    for (const [over, recusa] of casos) {
      assert.throws(
        () => capaTrocada(PERIODO, foto(over), [ITTRE]),
        (e: unknown) => e instanceof FotoRecusadaNaTroca && e.recusa === recusa && e.message.length > 0,
        `aceitou ${JSON.stringify(over)}`,
      );
    }
  });

  it('podeSerCapaNaTroca é a mesma régua da recusa', () => {
    assert.equal(podeSerCapaNaTroca(foto()), true);
    for (const over of [
      { mediaType: 'video' as const }, { takenAt: NaN }, { state: 'dismissed' as const }, { assetId: null },
    ]) {
      assert.equal(podeSerCapaNaTroca(foto(over)), false, JSON.stringify(over));
    }
  });
});

describe('secoesDoSeletor — as fotos do período, agrupadas por atividade', () => {
  const julho = (dia: number, h = 9) => new Date(2026, 6, dia, h, 0, 0).toISOString();
  const tour = atividade({ id: 'tour', startAt: julho(18) });
  const ronde = atividade({ id: 'ronde', startAt: julho(11) });
  const corrida = atividade({ id: 'corrida', startAt: julho(6) });
  const ts = (dia: number, min: number) => new Date(2026, 6, dia, 12, min, 0).getTime();

  it('a atividade mais recente primeiro, e as fotos em ordem cronológica dentro dela', () => {
    const s = secoesDoSeletor(
      [
        foto({ id: 'r2', activityId: 'ronde', takenAt: ts(11, 20) }),
        foto({ id: 't2', activityId: 'tour', takenAt: ts(18, 40) }),
        foto({ id: 'c1', activityId: 'corrida', takenAt: ts(6, 5) }),
        foto({ id: 't1', activityId: 'tour', takenAt: ts(18, 10) }),
        foto({ id: 'r1', activityId: 'ronde', takenAt: ts(11, 5) }),
      ],
      [corrida, ronde, tour],
    );
    assert.deepEqual(s.map((x) => x.atividade.id), ['tour', 'ronde', 'corrida']);
    assert.deepEqual(s.map((x) => x.fotos.map((f) => f.id)), [['t1', 't2'], ['r1', 'r2'], ['c1']]);
  });

  /** O que aparece é o que troca: nada que a troca recusaria entra na lista. */
  it('só o que pode ser capa: vídeo, desligada, sem arquivo e sem instante ficam de fora', () => {
    const s = secoesDoSeletor(
      [
        foto({ id: 'ok', activityId: 'tour' }),
        foto({ id: 'clipe', activityId: 'tour', mediaType: 'video', durationS: 3 }),
        foto({ id: 'desligada', activityId: 'tour', state: 'dismissed' }),
        foto({ id: 'sem-arquivo', activityId: 'tour', assetId: null }),
        foto({ id: 'sem-hora', activityId: 'tour', takenAt: NaN }),
      ],
      [tour],
    );
    assert.deepEqual(s.map((x) => x.fotos.map((f) => f.id)), [['ok']]);
  });

  it('foto de atividade fora do período não aparece — a troca a recusaria', () => {
    const s = secoesDoSeletor(
      [foto({ id: 'de-junho', activityId: 'junho' }), foto({ id: 'ok', activityId: 'tour' })],
      [tour],
    );
    assert.deepEqual(s.map((x) => x.atividade.id), ['tour']);
  });

  it('atividade sem foto que sirva não vira seção vazia', () => {
    const s = secoesDoSeletor([foto({ activityId: 'tour', mediaType: 'video', durationS: 3 })], [tour, ronde]);
    assert.deepEqual(s, []);
  });

  it('a ordem não depende da ordem em que o banco devolveu', () => {
    const fotos = [
      foto({ id: 'a', activityId: 'tour', takenAt: ts(18, 1) }),
      foto({ id: 'b', activityId: 'ronde', takenAt: ts(11, 1) }),
    ];
    const ida = secoesDoSeletor(fotos, [tour, ronde]);
    const volta = secoesDoSeletor([...fotos].reverse(), [ronde, tour]);
    assert.deepEqual(ida.map((x) => x.atividade.id), volta.map((x) => x.atividade.id));
  });
});

/* ── a ficha (Story 1.16) ────────────────────────────────────────────────── */

describe('fichaDaCapa — por que, quando, em que atividade e por onde', () => {
  /** 18/07/2026, 17:09 na hora de parede de quem roda o teste. */
  const AS_17_09 = new Date(2026, 6, 18, 17, 9, 0);
  const TOUR = atividade({
    id: 'tour',
    activityName: 'Cycling',
    routeName: 'Tour de la Meuse-Rhin',
    distanceM: 114_400,
    cities: [
      { name: 'Liège', lat: 50.63, lng: 5.57 },
      { name: 'Herstal', lat: 50.66, lng: 5.62 },
      { name: 'Liège', lat: 50.63, lng: 5.57 },
      { name: 'Visé', lat: 50.73, lng: 5.69 },
    ],
  });

  function capa(over: Partial<Capa> = {}): Capa {
    return {
      tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31',
      natureza: 'foto', fotoId: 'p-1', fotoTakenAt: AS_17_09.toISOString(), rotaActivityId: null,
      legenda: 'Vijlen · km 80,7 · 17:09',
      // Meio-dia local de 18/09: o mesmo dia de parede em qualquer fuso.
      carimbadaEm: new Date(2026, 8, 18, 12, 0, 0).toISOString(),
      motivo: 'rajada', fotoActivityId: 'tour',
      ...over,
    };
  }

  it('a ficha inteira: o porquê da rajada, a nota, o quando, a atividade e a rota', () => {
    assert.deepEqual(fichaDaCapa(capa(), TOUR, 'Ciclismo'), {
      porque: 'A do meio da maior rajada do período — fotografa-se mais onde valeu a pena parar.',
      nota: { texto: 'Nenhuma foto do período tinha estrela.', mono: false },
      quando: '18/07/2026 · 17:09',
      atividade: { nome: 'Tour de la Meuse-Rhin', distancia: '114,4 km' },
      // Em ordem, sem repetir a cidade por onde a rota voltou.
      rota: 'Liège · Herstal · Visé',
    });
  });

  it('estrela: a frase e a nota da estrela', () => {
    const f = fichaDaCapa(capa({ motivo: 'estrela' }), TOUR, 'Ciclismo');
    assert.equal(f.porque, 'A que você marcou com a estrela.');
    assert.deepEqual(f.nota, { texto: 'A estrela vence a escolha do app.', mono: false });
  });

  it('única: a frase, sem nota', () => {
    const f = fichaDaCapa(capa({ motivo: 'unica' }), TOUR, 'Ciclismo');
    assert.equal(f.porque, 'A única foto do período.');
    assert.equal(f.nota, null);
  });

  /**
   * "Você escolheu esta." — e não "…no lugar da que o app tinha escolhido", que
   * seria falso na segunda troca. A nota é a data da troca, em mono: é medida.
   */
  it('trocada: "Você escolheu esta.", com a data da troca em mono', () => {
    const f = fichaDaCapa(capa({ motivo: 'trocada' }), TOUR, 'Ciclismo');
    assert.equal(f.porque, 'Você escolheu esta.');
    assert.deepEqual(f.nota, { texto: 'trocada em 18/09/2026', mono: true });
  });

  it('trocada com a data do carimbo ilegível: a frase fica, a nota some', () => {
    const f = fichaDaCapa(capa({ motivo: 'trocada', carimbadaEm: 'não é data' }), TOUR, 'Ciclismo');
    assert.equal(f.porque, 'Você escolheu esta.');
    assert.equal(f.nota, null);
  });

  /** A linha "Capa anterior à 1.16" da matriz: as duas capas de produção. */
  it('capa anterior à 1.16 (motivo nulo): diz que foi impressa antes do porquê, e não inventa um', () => {
    const f = fichaDaCapa(capa({ motivo: null }), TOUR, 'Ciclismo');
    assert.equal(f.porque, 'Impressa antes de o app guardar o porquê.');
    assert.equal(f.nota, null);
    // O resto da ficha é lido ao vivo, e continua lá.
    assert.equal(f.atividade?.nome, 'Tour de la Meuse-Rhin');
  });

  /** A linha "Atividade não achada" da matriz, nas três formas que ela chega. */
  it('atividade não achada: porquê e quando, sem atividade e sem rota', () => {
    const esperado = {
      porque: 'A do meio da maior rajada do período — fotografa-se mais onde valeu a pena parar.',
      quando: '18/07/2026 · 17:09',
      atividade: null,
      rota: null,
    };
    for (const [c, a] of [
      [capa(), null],
      [capa({ fotoActivityId: null }), TOUR],
      // Outra atividade não é a da foto: a ficha não diz "na atividade X" sobre ela.
      [capa({ fotoActivityId: 'outra' }), TOUR],
    ] as const) {
      const f = fichaDaCapa(c, a, 'Ciclismo');
      assert.deepEqual(
        { porque: f.porque, quando: f.quando, atividade: f.atividade, rota: f.rota },
        esperado,
      );
    }
  });

  it('o nome segue a precedência de sempre, e cai no rótulo do tipo por último', () => {
    const semNome = atividade({ id: 'tour', activityName: undefined, routeName: undefined });
    assert.equal(fichaDaCapa(capa(), semNome, 'Ciclismo').atividade?.nome, 'Ciclismo');
    const editado = atividade({ id: 'tour', activityName: 'Volta de sábado', nameEdited: true, routeName: 'Rota' });
    assert.equal(fichaDaCapa(capa(), editado, 'Ciclismo').atividade?.nome, 'Volta de sábado');
  });

  it('atividade sem distância: o nome sem quilômetros; sem cidade: sem rota', () => {
    const f = fichaDaCapa(capa(), atividade({ id: 'tour', distanceM: undefined, cities: [] }), 'Ciclismo');
    assert.equal(f.atividade?.distancia, null);
    assert.equal(f.rota, null);
  });

  /** Atividade sem GPS chega com distância zero — e "0,0 km" afirmaria uma medida que não houve. */
  it('distância zero, negativa ou não finita: sem quilômetros', () => {
    for (const distanceM of [0, -5, NaN, Infinity]) {
      assert.equal(
        fichaDaCapa(capa(), atividade({ id: 'tour', distanceM }), 'Ciclismo').atividade?.distancia,
        null,
        String(distanceM),
      );
    }
  });

  /**
   * `nomeDaAtividade` cai no rótulo por `??`, e o `??` não pega string vazia: um
   * nome da fonte que é só espaço sairia `''`, e a linha "Na atividade" ficaria em
   * branco.
   */
  it('nome da fonte só com espaço: cai no rótulo do tipo, e não no vazio', () => {
    const branco = atividade({ id: 'tour', activityName: '   ', routeName: undefined });
    assert.equal(fichaDaCapa(capa(), branco, 'Ciclismo').atividade?.nome, 'Ciclismo');
  });

  it('a distância em pt-BR, com ponto de milhar', () => {
    const f = fichaDaCapa(capa(), atividade({ id: 'tour', distanceM: 1_234_560 }), 'Ciclismo');
    assert.equal(f.atividade?.distancia, '1.234,6 km');
  });

  it('instante da foto ilegível: sem quando — nunca "NaN/NaN"', () => {
    assert.equal(fichaDaCapa(capa({ fotoTakenAt: 'não é data' }), TOUR, 'Ciclismo').quando, null);
    assert.equal(fichaDaCapa(capa({ fotoTakenAt: null }), TOUR, 'Ciclismo').quando, null);
  });

  it('o Record é exaustivo: todo motivo tem frase, e nenhuma é vazia', () => {
    for (const motivo of ['estrela', 'rajada', 'unica', 'trocada', 'sem-foto', null] as const) {
      assert.ok(fichaDaCapa(capa({ motivo }), TOUR, 'Ciclismo').porque.trim().length > 0, String(motivo));
    }
  });
});

describe('nomeDaAtividadeNaCapa — o nome da ficha e do título da seção do seletor', () => {
  it('a precedência de sempre: o nome da rota vence o genérico da fonte', () => {
    assert.equal(
      nomeDaAtividadeNaCapa(atividade({ activityName: 'Cycling', routeName: 'Tour de la Meuse-Rhin' }), 'Ciclismo'),
      'Tour de la Meuse-Rhin',
    );
  });

  it('sem nome nenhum, o rótulo do tipo', () => {
    assert.equal(nomeDaAtividadeNaCapa(atividade({ activityName: undefined }), 'Ciclismo'), 'Ciclismo');
  });

  it('nome da fonte só com espaço — o que o `??` deixa passar — também cai no rótulo', () => {
    assert.equal(nomeDaAtividadeNaCapa(atividade({ activityName: ' \t ' }), 'Ciclismo'), 'Ciclismo');
  });
});

/* ── o que entra na escolha (Story 2.3) ──────────────────────────────────── */

/**
 * As três peças que subiram do celular na Story 2.3. Elas decidem **sobre o que**
 * a capa é escolhida, e por isso valem tanto quanto a escolha: uma atividade a
 * mais ou a menos aqui muda a foto que fica carimbada para sempre.
 *
 * `agora` é dado em componentes locais — 10 de setembro de 2026, meio-dia —, para
 * o mês que `periodBounds` resolve não depender do `TZ` de quem roda a suíte.
 */
const AGORA_EM_SETEMBRO = new Date(2026, 8, 10, 12, 0, 0);
/** Agosto de 2026 visto de {@link AGORA_EM_SETEMBRO}. */
const DE_AGOSTO = { resumo: { kind: 'month' as const, offset: -1 }, agora: AGORA_EM_SETEMBRO };

/** Um instante local, na forma que o PostgREST devolve. */
const emPonto = (a: number, m: number, d: number, h: number, min = 0): string =>
  new Date(a, m - 1, d, h, min).toISOString();

describe('atividadesDoPeriodo — a fronteira do período, que a capa congela', () => {
  it('pega o que começa dentro, e deixa o que começa antes ou depois', () => {
    const antes = atividade({ id: 'antes', startAt: emPonto(2026, 7, 31, 23, 59) });
    const dentro = atividade({ id: 'dentro', startAt: emPonto(2026, 8, 14, 9) });
    const depois = atividade({ id: 'depois', startAt: emPonto(2026, 9, 1, 9) });
    assert.deepEqual(
      atividadesDoPeriodo([antes, dentro, depois], DE_AGOSTO).map((a) => a.id),
      ['dentro'],
    );
  });

  it('o primeiro instante do mês entra, e o primeiro do mês SEGUINTE não', () => {
    // A borda que a 2.3 consertou: `end` é a meia-noite do dia seguinte ao
    // último, e uma pedalada às 00:00 de 1º de setembro virava a capa de agosto.
    const primeiro = atividade({ id: 'primeiro', startAt: emPonto(2026, 8, 1, 0, 0) });
    const daVirada = atividade({ id: 'virada', startAt: emPonto(2026, 9, 1, 0, 0) });
    const ultimo = atividade({ id: 'ultimo', startAt: emPonto(2026, 8, 31, 23, 59) });
    assert.deepEqual(
      atividadesDoPeriodo([primeiro, daVirada, ultimo], DE_AGOSTO).map((a) => a.id),
      ['primeiro', 'ultimo'],
    );
  });

  it('a mesma régua de `periodosFechadosDesde`: o fim do período é exclusivo', () => {
    // Setembro reclama a atividade que agosto recusou — nenhuma fica sem dono,
    // e nenhuma fica com dois.
    const daVirada = atividade({ id: 'virada', startAt: emPonto(2026, 9, 1, 0, 0) });
    const deSetembro = { resumo: { kind: 'month' as const, offset: 0 }, agora: AGORA_EM_SETEMBRO };
    assert.deepEqual(atividadesDoPeriodo([daVirada], deSetembro).map((a) => a.id), ['virada']);
  });

  it('instante que não se lê fica de fora — ele não tem dia onde cair', () => {
    assert.deepEqual(atividadesDoPeriodo([atividade({ startAt: 'não é data' })], DE_AGOSTO), []);
  });
});

describe('cidadesDoPeriodo — o acervo da legenda, sem repetir', () => {
  it('junta as cidades das rotas e guarda a primeira marca de cada nome', () => {
    const a = atividade({ id: 'a', cities: [ITTRE, LEUVEN] });
    const b = atividade({ id: 'b', cities: [{ name: 'Ittre', lat: 1, lng: 2 }] });
    const r = cidadesDoPeriodo([a, b]);
    assert.deepEqual(r.map((c) => c.name), ['Ittre', 'Leuven']);
    assert.equal(r[0]?.lat, ITTRE.lat, 'a segunda marca de Ittre sobrescreveu a primeira');
  });

  it('atividade sem cidade não contribui, e a lista pode ser vazia', () => {
    assert.deepEqual(cidadesDoPeriodo([atividade({ cities: undefined })]), []);
    assert.deepEqual(cidadesDoPeriodo([]), []);
  });
});

describe('rotuloDaEdicao — a legenda da natureza `grade`', () => {
  it('o mês ganha o "de"; os outros ficam com o rótulo da Retrospectiva', () => {
    assert.equal(rotuloDaEdicao('month', '2026-08-01'), 'Agosto de 2026');
    assert.equal(rotuloDaEdicao('month', '2026-03-01'), 'Março de 2026');
    assert.equal(rotuloDaEdicao('year', '2025-01-01'), '2025');
    assert.equal(rotuloDaEdicao('season', '2026-04-01'), 'Q2 2026');
    assert.equal(rotuloDaEdicao('week', '2026-09-07'), '07/09 – 13/09');
  });

  it('o dia é lido no relógio LOCAL — `new Date(inicio)` daria o mês anterior a oeste', () => {
    // 1º de janeiro é o caso que mais dói: em UTC−3 ele voltaria como 31 de dezembro.
    assert.equal(rotuloDaEdicao('month', '2026-01-01'), 'Janeiro de 2026');
  });
});
