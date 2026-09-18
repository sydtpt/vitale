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
import type { Activity, ActivityPhoto, CityMark } from '../models';
import { escolherCapa, legendaDaFoto, legendaDaRota, type PeriodoDaCapa } from './capa';

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
