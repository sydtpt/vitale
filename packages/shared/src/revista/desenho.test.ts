/**
 * Os dois desenhistas da capa (Story 2.4a) — a matriz de I/O do spec, linha a linha.
 *
 * O que se protege aqui é **forma e contagem, nunca pixel**. Um teste que fixasse
 * coordenadas quebraria na primeira vez que a margem mudasse, e passaria a ser o
 * carimbo de uma decisão de desenho em vez da garantia de uma projeção:
 *
 * - a **correção de latitude** (`cos φ`), que é o que impede a Bélgica de sair
 *   esticada em 56% — a prova é que um retângulo de lados iguais em graus sai com
 *   a largura encolhida na proporção do cosseno;
 * - a **proporção preservada** e a **independência de tamanho**: a mesma rota em
 *   173 px e em 346 px dá exatamente o dobro em cada ponto, que é o critério de
 *   aceitação da parede (2.4b);
 * - a **queda da rota curta** para a grade, que é o limiar existindo de verdade;
 * - a **extensão zero**, que é a divisão por zero que não acontece;
 * - a grade **parando em hoje**, e o dia sem marca sendo dado e não falta.
 *
 * As seis rotas reais entram como **fixture de forma**: os seis tamanhos de
 * overview carimbados no arquivo (10, 29, 52, 110, 129 e 135 pontos), para que o
 * limiar seja medido contra o acervo que existe e não contra um número inventado
 * no teste.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Activity } from '../models';
import {
  DIAS_DA_SEMANA,
  PONTOS_MINIMOS_DO_TRACADO,
  desenhoDaCapa,
  eixoDaGrade,
  gradeDoPeriodo,
  layoutDaGrade,
  margemDoDesenho,
  pontosDaRota,
  posicaoNaGrade,
  projetarTracado,
  temTracado,
  type CaixaDoDesenho,
  type EntradaDaGrade,
  type GradeDaCapa,
  type LeituraDaRota,
  type ParDaRota,
} from './desenho';

/**
 * A caixa da parede (2.4b): o tile de 173 px do mockup aprovado, **com a margem
 * que a produ\u00e7\u00e3o usa**.
 *
 * A margem sai de `margemDoDesenho`, e n\u00e3o de um n\u00famero escolhido aqui: com um
 * literal, o teste que cobra o respiro nos quatro lados exercitaria uma caixa que
 * nenhum componente monta \u2014 ele passaria com a margem de produ\u00e7\u00e3o quebrada.
 */
const PAREDE: CaixaDoDesenho = {
  largura: 173, altura: 168, margem: margemDoDesenho(173, 168),
};

/** A caixa da capa inteira, no iPhone \u2014 onde o eixo da grade foi medido. */
const CAPA = { largura: 390, altura: 320 } as const;

/** Os tamanhos de `route_overview` das seis rotas carimbadas no arquivo real. */
const ROTAS_REAIS = [10, 29, 52, 110, 129, 135] as const;

/**
 * Uma rota sintética de `n` pontos numa volta fechada perto de Ittre (50,64° N).
 *
 * Sintética de propósito: o que os testes cobram é **forma**, e uma volta de raio
 * conhecido dá extensão conhecida nos dois eixos. Os tamanhos, esses, são os
 * reais — é neles que o limiar é julgado.
 */
function volta(n: number, raio = 0.02): ParDaRota[] {
  const pts: ParDaRota[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([50.64 + raio * Math.sin(a), 4.26 + raio * Math.cos(a)]);
  }
  return pts;
}

/** Um retângulo de lados IGUAIS em graus — a régua do `cos φ`. */
function quadradoEmGraus(n: number, lado: number, lat: number): ParDaRota[] {
  const pts: ParDaRota[] = [];
  for (let i = 0; i < n; i += 1) {
    // Meio norte-sul, meio leste-oeste: os extremos dão exatamente `lado` nos dois.
    pts.push(i % 2 === 0 ? [lat, 4.26] : [lat + lado, 4.26 + lado]);
  }
  return pts;
}

/* ── o traçado ───────────────────────────────────────────────────────────── */

describe('pontosDaRota — o que chega do jsonb não é tipo, é promessa', () => {
  it('par bom passa, na ordem em que veio', () => {
    assert.deepEqual(pontosDaRota([[50.6, 4.2], [50.7, 4.3]]), [[50.6, 4.2], [50.7, 4.3]]);
  });

  it('nulo, buraco, NaN e par curto saem — um NaN no meio viraria um `d` inteiro sem desenho', () => {
    const sujo = [
      [50.6, 4.2], null, [NaN, 4.2], [50.6, Infinity], [50.6], 'x', [50.7, 4.3],
    ] as unknown as ParDaRota[];
    assert.deepEqual(pontosDaRota(sujo), [[50.6, 4.2], [50.7, 4.3]]);
  });

  it('coordenada fora do globo sai: um [lon, lat] trocado esticaria a caixa sozinho', () => {
    assert.deepEqual(pontosDaRota([[50.6, 4.2], [4.2, 500]] as ParDaRota[]), [[50.6, 4.2]]);
  });

  it('ausente e vazio dão lista vazia, sem explodir', () => {
    assert.deepEqual(pontosDaRota(null), []);
    assert.deepEqual(pontosDaRota(undefined), []);
    assert.deepEqual(pontosDaRota([]), []);
  });

  /**
   * O `jsonb` pode não ser lista. Um objeto ali fazia o `for…of` **lançar**, dentro
   * de uma função que o contrato promete pura — e a exceção subia do `useMemo` de
   * um componente, derrubando a edição inteira em vez de a capa cair no papel.
   */
  it('overview que não é lista não explode: objeto, número, texto', () => {
    for (const lixo of [{ a: 1 }, 7, 'rota', true]) {
      assert.deepEqual(pontosDaRota(lixo as unknown as ParDaRota[]), []);
    }
  });
});

describe('o limiar do traçado, medido contra as seis rotas reais', () => {
  it('o limiar cai no vão do acervo: reprova a de 10 pontos e aprova as outras cinco', () => {
    const aprovadas = ROTAS_REAIS.filter((n) => temTracado(volta(n)));
    assert.deepEqual([...aprovadas], [29, 52, 110, 129, 135]);
  });

  /**
   * O vão é o argumento: qualquer limiar em (10, 29] separa o acervo do mesmo
   * jeito, e 20 está no meio dele. Se alguém mover o número, que seja com o
   * veredito em tela — e não de passagem, num refactor.
   */
  it('o número escolhido está dentro do vão entre a menor rota e a segunda', () => {
    assert.ok(PONTOS_MINIMOS_DO_TRACADO > 10, 'o limiar aprovaria a rota de 10 pontos');
    assert.ok(PONTOS_MINIMOS_DO_TRACADO <= 29, 'o limiar reprovaria a rota de 29 pontos');
  });

  it('exatamente no limiar desenha; um ponto abaixo, não', () => {
    assert.equal(temTracado(volta(PONTOS_MINIMOS_DO_TRACADO)), true);
    assert.equal(temTracado(volta(PONTOS_MINIMOS_DO_TRACADO - 1)), false);
  });
});

describe('projetarTracado — a projeção', () => {
  it('rota de 135 pontos: 135 pontos na caixa, todos dentro dela', () => {
    const t = projetarTracado(volta(135), PAREDE);
    assert.ok(t);
    assert.equal(t.degenerado, false);
    assert.equal(t.pontos.length, 135);
    for (const p of t.pontos) {
      assert.ok(p.x >= 0 && p.x <= PAREDE.largura, `x fora da caixa: ${p.x}`);
      assert.ok(p.y >= 0 && p.y <= PAREDE.altura, `y fora da caixa: ${p.y}`);
    }
  });

  it('a margem é respeitada nos quatro lados', () => {
    const t = projetarTracado(volta(135), PAREDE);
    assert.ok(t);
    const xs = t.pontos.map((p) => p.x);
    const ys = t.pontos.map((p) => p.y);
    assert.ok(Math.min(...xs) >= PAREDE.margem - 1e-9);
    assert.ok(Math.max(...xs) <= PAREDE.largura - PAREDE.margem + 1e-9);
    assert.ok(Math.min(...ys) >= PAREDE.margem - 1e-9);
    assert.ok(Math.max(...ys) <= PAREDE.altura - PAREDE.margem + 1e-9);
  });

  /**
   * A prova do `cos φ`: um quadrado de lados iguais **em graus** não é um quadrado
   * no chão. A 50,64° N, `cos φ` ≈ 0,6357 — a largura tem de sair nessa proporção
   * da altura. Sem a correção sairia 1:1, e a Bélgica inteira esticada em 56%.
   */
  it('corrige a latitude: lados iguais em graus saem na proporção do cosseno', () => {
    const lat = 50.64;
    const t = projetarTracado(quadradoEmGraus(40, 0.02, lat), { largura: 400, altura: 400, margem: 0 });
    assert.ok(t);
    const larg = Math.max(...t.pontos.map((p) => p.x)) - Math.min(...t.pontos.map((p) => p.x));
    const alt = Math.max(...t.pontos.map((p) => p.y)) - Math.min(...t.pontos.map((p) => p.y));
    const esperado = Math.cos((lat * Math.PI) / 180);
    assert.ok(
      Math.abs(larg / alt - esperado) < 0.002,
      `razão ${larg / alt} ≠ cos φ ${esperado} — a latitude não foi corrigida`,
    );
  });

  /**
   * O critério de aceitação da parede: *"desenhada em 173 px e em 346 px, a forma
   * é a mesma — a projeção não depende do tamanho"*. Dobrar a caixa **e a margem**
   * dobra cada coordenada, exatamente: escalar por potência de dois é exato em
   * ponto flutuante, então a igualdade aqui pode ser estrita.
   */
  it('dobrar a caixa dobra cada ponto — a forma não muda com o tamanho', () => {
    const rota = volta(129);
    const pequena = projetarTracado(rota, PAREDE);
    const grande = projetarTracado(rota, {
      largura: PAREDE.largura * 2, altura: PAREDE.altura * 2, margem: PAREDE.margem * 2,
    });
    assert.ok(pequena && grande);
    assert.deepEqual(
      grande.pontos,
      pequena.pontos.map((p) => ({ x: p.x * 2, y: p.y * 2 })),
    );
  });

  it('rota curta não projeta — devolve nulo, e quem chama cai para a grade', () => {
    assert.equal(projetarTracado(volta(10), PAREDE), null);
    assert.equal(projetarTracado([], PAREDE), null);
    assert.equal(projetarTracado(null, PAREDE), null);
  });

  /**
   * Margem maior que metade da caixa: a largura útil é zero, a escala sai zero e
   * **todos os pontos caem no mesmo lugar**. Sem esta guarda saíam N pontos
   * idênticos com `degenerado: false` — uma polilinha invisível que o componente
   * desenharia como se fosse rota, e cuja ausência ninguém saberia explicar.
   */
  it('escala zero é degenerada: um ponto, e não N pontos iguais dizendo que são linha', () => {
    const t = projetarTracado(volta(52), { largura: 40, altura: 40, margem: 30 });
    assert.ok(t);
    assert.equal(t.degenerado, true);
    assert.equal(t.pontos.length, 1);
  });

  it('rota degenerada: um ponto centrado, sem dividir por zero', () => {
    const parada: ParDaRota[] = Array.from({ length: 60 }, () => [50.64, 4.26] as ParDaRota);
    const t = projetarTracado(parada, PAREDE);
    assert.ok(t);
    assert.equal(t.degenerado, true);
    assert.deepEqual([...t.pontos], [{ x: PAREDE.largura / 2, y: PAREDE.altura / 2 }]);
  });

  /** Uma rota perfeitamente norte-sul tem extensão zero num eixo e desenha. */
  it('extensão zero num eixo só: a escala vem do outro, e nada vira NaN', () => {
    const norteSul: ParDaRota[] = Array.from(
      { length: 40 },
      (_, i) => [50.60 + i * 0.001, 4.26] as ParDaRota,
    );
    const t = projetarTracado(norteSul, PAREDE);
    assert.ok(t);
    assert.equal(t.degenerado, false);
    for (const p of t.pontos) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `ponto não finito: ${JSON.stringify(p)}`);
      assert.equal(p.x, PAREDE.largura / 2);
    }
    // Ocupa a altura útil inteira: a escala foi a do eixo que existe.
    const alt = Math.max(...t.pontos.map((p) => p.y)) - Math.min(...t.pontos.map((p) => p.y));
    assert.ok(Math.abs(alt - (PAREDE.altura - 2 * PAREDE.margem)) < 1e-9);
  });

  it('o norte fica em cima: o primeiro ponto mais ao norte tem o menor y', () => {
    const rota: ParDaRota[] = Array.from(
      { length: 40 },
      (_, i) => [50.60 + i * 0.001, 4.26 + i * 0.001] as ParDaRota,
    );
    const t = projetarTracado(rota, PAREDE);
    assert.ok(t);
    assert.ok(t.pontos[0].y > t.pontos[t.pontos.length - 1].y, 'a rota saiu espelhada na vertical');
  });
});

/* ── a grade ─────────────────────────────────────────────────────────────── */

function atividade(startAt: string, over: Partial<Activity> = {}): Activity {
  return {
    id: `a-${startAt}`,
    userId: 'u-1',
    activityId: 13,
    calories: 500,
    startAt,
    endAt: startAt,
    durationS: 3_600,
    distanceM: 20_000,
    hasRoute: true,
    ...over,
  };
}

/** Meio-dia local de um dia — nunca `Z`: a grade é de dia de calendário local. */
function aoMeioDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12, 0, 0).toISOString();
}

function entrada(over: Partial<EntradaDaGrade> = {}): EntradaDaGrade {
  return {
    now: new Date(2026, 8, 24, 10, 0, 0),
    kind: 'month',
    offset: 0,
    activities: [],
    registros: [],
    ...over,
  };
}

describe('gradeDoPeriodo — uma célula por dia, marcada por atividade OU registro', () => {
  /** jun/2023 fechado: 30 células, 21 marcadas — a linha "grade densa" da matriz. */
  it('grade densa: 30 células e 21 marcadas em junho de 2023', () => {
    const dias = Array.from({ length: 21 }, (_, i) => `2023-06-${String(i + 1).padStart(2, '0')}`);
    const g = gradeDoPeriodo(entrada({
      now: new Date(2026, 8, 24),
      kind: 'month',
      // junho/2023 visto de setembro/2026: 39 meses atrás.
      offset: -39,
      activities: dias.map((d) => atividade(aoMeioDia(d))),
    }));
    assert.equal(g.celulas.length, 30);
    assert.equal(g.marcados, 21);
    assert.equal(g.celulas.filter(Boolean).length, 21);
  });

  /** jan/2024: 0 atividades e 1 registro — esparso é a informação, não uma falta. */
  it('grade esparsa: 31 células e UMA marcada, vinda de um registro', () => {
    const g = gradeDoPeriodo(entrada({
      now: new Date(2026, 8, 24),
      kind: 'month',
      offset: -32,
      registros: [{ days: ['2024-01-17'] }],
    }));
    assert.equal(g.celulas.length, 31);
    assert.equal(g.marcados, 1);
    assert.equal(g.celulas[16], true);
  });

  it('atividade e registro no mesmo dia contam UMA célula', () => {
    const g = gradeDoPeriodo(entrada({
      kind: 'month',
      offset: -1,
      activities: [atividade(aoMeioDia('2026-08-03'))],
      registros: [{ days: ['2026-08-03'] }],
    }));
    assert.equal(g.celulas.length, 31);
    assert.equal(g.marcados, 1);
  });

  it('período sem nada: a grade inteira existe, vazia — não vira papel liso', () => {
    const g = gradeDoPeriodo(entrada({ kind: 'month', offset: -1 }));
    assert.equal(g.celulas.length, 31);
    assert.equal(g.marcados, 0);
    assert.ok(g.celulas.every((c) => c === false));
  });

  /** O dia que ainda não chegou não é dia sem dado — ele não tem célula. */
  it('período em curso para em HOJE: setembro visto do dia 24 tem 24 células', () => {
    const g = gradeDoPeriodo(entrada({ now: new Date(2026, 8, 24, 10, 0, 0), kind: 'month', offset: 0 }));
    assert.equal(g.celulas.length, 24);
  });

  it('marca fora do período não entra: a lista chega de uma janela mais larga', () => {
    const g = gradeDoPeriodo(entrada({
      kind: 'month',
      offset: -1,
      activities: [atividade(aoMeioDia('2026-07-31')), atividade(aoMeioDia('2026-08-10'))],
      registros: [{ days: ['2026-09-02'] }],
    }));
    assert.equal(g.marcados, 1);
    assert.equal(g.celulas[9], true);
  });

  it('a semana dá 7 células, e o ano fechado dá 365', () => {
    assert.equal(gradeDoPeriodo(entrada({ kind: 'week', offset: -1 })).celulas.length, 7);
    assert.equal(gradeDoPeriodo(entrada({ kind: 'year', offset: -1 })).celulas.length, 365);
  });

  it('atividade com data que não se lê não marca dia nenhum', () => {
    const g = gradeDoPeriodo(entrada({
      kind: 'month',
      offset: -1,
      activities: [atividade('nem data é')],
    }));
    assert.equal(g.marcados, 0);
  });

  /**
   * O `pad` é o dia da semana do primeiro dia, segunda = 0 — o mesmo do `Heatmap`.
   * Agosto de 2026 começa num **sábado**: 5.
   */
  it('o pad é o dia da semana do primeiro dia, com segunda = 0', () => {
    assert.equal(gradeDoPeriodo(entrada({ kind: 'month', offset: -1 })).pad, 5);
    // Setembro de 2026 começa numa terça: 1.
    assert.equal(gradeDoPeriodo(entrada({ kind: 'month', offset: 0 })).pad, 1);
    // A semana começa na segunda por construção: pad sempre 0.
    assert.equal(gradeDoPeriodo(entrada({ kind: 'week', offset: -1 })).pad, 0);
  });

  it('grade sem célula nenhuma tem pad zero — não há o que alinhar', () => {
    // Um período inteiramente no futuro: nada a mostrar, e nenhum deslocamento.
    const g = gradeDoPeriodo(entrada({ kind: 'month', offset: 1 }));
    assert.deepEqual([...g.celulas], []);
    assert.equal(g.pad, 0);
  });

  it('o eixo vem do período, e viaja na grade', () => {
    assert.equal(gradeDoPeriodo(entrada({ kind: 'week', offset: -1 })).eixo, 'colunas');
    assert.equal(gradeDoPeriodo(entrada({ kind: 'month', offset: -1 })).eixo, 'colunas');
    assert.equal(gradeDoPeriodo(entrada({ kind: 'season', offset: -1 })).eixo, 'linhas');
    assert.equal(gradeDoPeriodo(entrada({ kind: 'year', offset: -1 })).eixo, 'linhas');
  });

  /** O trimestre civil, que a matriz não cobria: Q2/2026 tem 91 dias. */
  it('o trimestre fechado dá os dias do trimestre civil', () => {
    const g = gradeDoPeriodo(entrada({ now: new Date(2026, 8, 24), kind: 'season', offset: -1 }));
    assert.equal(g.celulas.length, 91);
  });

  /**
   * O bissexto, e o teto junto: 2024 tem 366 dias, e o passeio para exatamente
   * ali. É também o caso que prova que o teto não corta um ano legítimo.
   */
  it('o ano bissexto dá 366 células, e o teto não o corta', () => {
    const g = gradeDoPeriodo(entrada({ now: new Date(2026, 8, 24), kind: 'year', offset: -2 }));
    assert.equal(g.celulas.length, 366);
  });
});

/**
 * O **eixo**, que é a decisão do dono de 24/09/2026 — e a asserção é de **fração
 * da caixa**, não de "positivo e dentro".
 *
 * A medição que motivou a decisão: com sete colunas fixas, o ano numa capa de
 * 390 × 320 saía com **31 px de bloco — 8% da largura, célula de 3,7 px** —, e o
 * trimestre com 30%; semana e mês, que são as únicas formas quase quadradas,
 * ficavam em 79%. Um teste que só perguntasse "cabe e é positivo" passava nos
 * quatro. O que separa os casos é **quanto da caixa o desenho ocupa**.
 */
describe('a grade ocupa a caixa nos quatro períodos', () => {
  /** A largura do bloco como fração da caixa — a medida que pegou o defeito. */
  function fracaoDaLargura(grade: GradeDaCapa, largura: number, altura: number): number {
    const l = layoutDaGrade(grade, largura, altura);
    assert.ok(l, 'a grade não coube');
    return (l.colunas * l.lado + (l.colunas - 1) * l.vao) / largura;
  }

  function grade(celulas: number, pad: number, kind: EntradaDaGrade['kind']): GradeDaCapa {
    return {
      celulas: Array.from({ length: celulas }, () => false),
      marcados: 0,
      pad,
      eixo: eixoDaGrade(kind),
    };
  }

  /** Os quatro períodos, com o ano bissexto ao lado do comum. */
  const CASOS = [
    { nome: 'semana', celulas: 7, kind: 'week' as const },
    { nome: 'mês', celulas: 31, kind: 'month' as const },
    { nome: 'trimestre', celulas: 92, kind: 'season' as const },
    { nome: 'ano', celulas: 365, kind: 'year' as const },
    { nome: 'ano bissexto', celulas: 366, kind: 'year' as const },
  ];

  /**
   * O piso medido é 0,757 na parede e 0,795 na capa — os dois são a largura útil
   * (a caixa menos as duas margens) sobre a caixa. 0,70 deixa folga para a margem
   * mudar sem o teste virar carimbo, e reprova em cheio os 0,08 e os 0,30 que a
   * versão de sete colunas fixas dava.
   */
  const PISO = 0.7;

  for (const caso of CASOS) {
    it(`${caso.nome}: o bloco ocupa ≥ ${PISO * 100}% da largura, nas duas caixas`, () => {
      // O `pad` percorre a semana inteira: o dia da semana em que o período
      // começa muda quantas faixas ele tem, e é aí que a conta erraria.
      for (let pad = 0; pad < DIAS_DA_SEMANA; pad += 1) {
        const g = grade(caso.celulas, pad, caso.kind);
        const naCapa = fracaoDaLargura(g, CAPA.largura, CAPA.altura);
        const naParede = fracaoDaLargura(g, PAREDE.largura, PAREDE.altura);
        assert.ok(naCapa >= PISO, `${caso.nome} pad ${pad}: ${(naCapa * 100).toFixed(1)}% na capa`);
        assert.ok(naParede >= PISO, `${caso.nome} pad ${pad}: ${(naParede * 100).toFixed(1)}% na parede`);
      }
    });
  }

  it('o eixo sai do período: semana e mês em pé, trimestre e ano deitados', () => {
    assert.equal(eixoDaGrade('week'), 'colunas');
    assert.equal(eixoDaGrade('month'), 'colunas');
    assert.equal(eixoDaGrade('season'), 'linhas');
    assert.equal(eixoDaGrade('year'), 'linhas');
  });

  it('deitado, o ano tem SETE linhas e ~53 colunas — e não o contrário', () => {
    const l = layoutDaGrade(grade(365, 0, 'year'), CAPA.largura, CAPA.altura);
    assert.ok(l);
    assert.equal(l.linhas, DIAS_DA_SEMANA);
    assert.equal(l.colunas, Math.ceil(365 / DIAS_DA_SEMANA));
  });
});

describe('layoutDaGrade — célula quadrada, bloco centrado, nada estourando', () => {
  function grade(celulas: number, pad: number, eixo: 'colunas' | 'linhas'): GradeDaCapa {
    return { celulas: Array.from({ length: celulas }, () => false), marcados: 0, pad, eixo };
  }

  function bloco(g: GradeDaCapa, largura: number, altura: number) {
    const l = layoutDaGrade(g, largura, altura);
    assert.ok(l);
    return {
      l,
      larguraDoBloco: l.colunas * l.lado + (l.colunas - 1) * l.vao,
      alturaDoBloco: l.linhas * l.lado + (l.linhas - 1) * l.vao,
    };
  }

  it('um mês na capa inteira: dentro da caixa e centrado nos dois eixos', () => {
    const { l, larguraDoBloco, alturaDoBloco } = bloco(grade(31, 5, 'colunas'), CAPA.largura, CAPA.altura);
    assert.ok(l.esquerda >= 0 && l.topo >= 0);
    assert.ok(l.esquerda + larguraDoBloco <= CAPA.largura + 1e-9);
    assert.ok(l.topo + alturaDoBloco <= CAPA.altura + 1e-9);
    assert.ok(Math.abs(l.esquerda - (CAPA.largura - larguraDoBloco - l.esquerda)) < 1e-9);
    assert.ok(Math.abs(l.topo - (CAPA.altura - alturaDoBloco - l.topo)) < 1e-9);
  });

  /**
   * Agosto de 2026 começa num **sábado** (`pad` 5): 5 + 31 = 36 dias de grade, que
   * são SEIS faixas. `ceil(31 / 7)` daria cinco, e a última semana do mês sumiria
   * do desenho sem nada reclamar.
   */
  it('o pad entra na contagem de faixas: agosto de 2026 pede seis linhas, não cinco', () => {
    assert.equal(layoutDaGrade(grade(31, 5, 'colunas'), CAPA.largura, CAPA.altura)?.linhas, 6);
    assert.equal(layoutDaGrade(grade(31, 0, 'colunas'), CAPA.largura, CAPA.altura)?.linhas, 5);
  });

  it('respeita a margem: o bloco nunca invade o oitavo do menor lado', () => {
    const { l } = bloco(grade(31, 0, 'colunas'), CAPA.largura, CAPA.altura);
    const margem = margemDoDesenho(CAPA.largura, CAPA.altura);
    assert.ok(l.esquerda >= margem - 1e-9);
    assert.ok(l.topo >= margem - 1e-9);
  });

  /**
   * A semana em curso: três dias só. Sete colunas fixas deixariam o bloco
   * encostado à esquerda, com quatro vazias à direita fingindo dias que ainda não
   * existem.
   */
  it('só reserva as faixas que existem: três dias dão três colunas, centradas', () => {
    const l = layoutDaGrade(grade(3, 0, 'colunas'), CAPA.largura, CAPA.altura);
    assert.ok(l);
    assert.equal(l.colunas, 3);
    assert.equal(l.linhas, 1);
    assert.ok(l.esquerda > margemDoDesenho(CAPA.largura, CAPA.altura) - 1e-9);
  });

  it('caixa sem área, ou grade sem célula, não tem layout', () => {
    assert.equal(layoutDaGrade(grade(0, 0, 'colunas'), CAPA.largura, CAPA.altura), null);
    assert.equal(layoutDaGrade(grade(31, 0, 'colunas'), 0, CAPA.altura), null);
    assert.equal(layoutDaGrade(grade(31, 0, 'colunas'), CAPA.largura, 0), null);
  });
});

describe('posicaoNaGrade — a coluna É o dia da semana', () => {
  it('em pé: o pad desloca a primeira célula, e a semana vira coluna', () => {
    // Sábado (5): a primeira célula cai na sexta coluna da primeira linha.
    const g = { pad: 5, eixo: 'colunas' as const };
    assert.deepEqual(posicaoNaGrade(g, 0), { coluna: 5, linha: 0 });
    assert.deepEqual(posicaoNaGrade(g, 1), { coluna: 6, linha: 0 });
    assert.deepEqual(posicaoNaGrade(g, 2), { coluna: 0, linha: 1 });
  });

  it('deitado: o pad desloca a LINHA, e a semana vira coluna inteira', () => {
    const g = { pad: 3, eixo: 'linhas' as const };
    assert.deepEqual(posicaoNaGrade(g, 0), { coluna: 0, linha: 3 });
    assert.deepEqual(posicaoNaGrade(g, 3), { coluna: 0, linha: 6 });
    assert.deepEqual(posicaoNaGrade(g, 4), { coluna: 1, linha: 0 });
  });

  /**
   * A propriedade que a coluna promete: **dias com sete de distância caem no mesmo
   * dia da semana**, qualquer que seja o eixo. É isto que a versão sem `pad` não
   * cumpria, e é isto que o TSDoc de `DIAS_DA_SEMANA` afirmava sem provar.
   */
  it('a cada sete células, o mesmo dia da semana', () => {
    for (const eixo of ['colunas', 'linhas'] as const) {
      const g = { pad: 4, eixo };
      const daSemana = (i: number) => (eixo === 'colunas' ? posicaoNaGrade(g, i).coluna : posicaoNaGrade(g, i).linha);
      for (let i = 0; i < 30; i += 1) assert.equal(daSemana(i), daSemana(i + DIAS_DA_SEMANA));
    }
  });
});

describe('margemDoDesenho — a mesma caixa para as duas naturezas', () => {
  it('é um oitavo do menor lado', () => {
    assert.equal(margemDoDesenho(390, 320), 40);
    assert.equal(margemDoDesenho(173, 168), 21);
  });

  it('o piso levanta a margem quando o traço é mais grosso que ela', () => {
    assert.equal(margemDoDesenho(16, 16, 5), 5);
    assert.equal(margemDoDesenho(390, 320, 5), 40);
  });
});

/* ── quem desenha o quê ──────────────────────────────────────────────────── */

describe('desenhoDaCapa — a decisão, e não o desenho', () => {
  const GRADE_CHEIA: GradeDaCapa = {
    celulas: Array.from({ length: 31 }, () => false), marcados: 0, pad: 0, eixo: 'colunas',
  };
  const GRADE_VAZIA: GradeDaCapa = { celulas: [], marcados: 0, pad: 0, eixo: 'colunas' };
  const pronta = (overview: ParDaRota[]): LeituraDaRota => ({ estado: 'pronta', overview });
  const NAO_PEDIDA: LeituraDaRota = { estado: 'nao-pedida' };

  it('capa `grade` desenha a grade, sempre', () => {
    assert.deepEqual(desenhoDaCapa('grade', NAO_PEDIDA, GRADE_CHEIA), { tipo: 'grade', grade: GRADE_CHEIA });
    assert.deepEqual(
      desenhoDaCapa('grade', pronta(volta(135)), GRADE_CHEIA),
      { tipo: 'grade', grade: GRADE_CHEIA },
    );
  });

  /**
   * Grade **sem célula** não é grade: é um período que ainda não começou. Desenhar
   * um quadro vazio ali reservaria 45% da tela para nada — o mesmo "espaço
   * reservado para a imagem que não veio" que a 1.13 proibiu.
   */
  it('grade de zero células é papel, e não um quadro vazio', () => {
    assert.deepEqual(desenhoDaCapa('grade', NAO_PEDIDA, GRADE_VAZIA), { tipo: 'papel' });
    assert.deepEqual(desenhoDaCapa('grade', NAO_PEDIDA, null), { tipo: 'papel' });
  });

  it('capa `tracado` com rota que serve desenha o traçado', () => {
    const rota = volta(135);
    assert.deepEqual(desenhoDaCapa('tracado', pronta(rota), GRADE_CHEIA), { tipo: 'tracado', overview: rota });
  });

  /**
   * **A leitura em voo reserva**, e é isto que impede o salto: sem o estado
   * próprio, "ainda procurando" e "não existe" davam a mesma resposta, a capa
   * nascia baixa e pulava para 45% da janela quando a rota chegava — empurrando o
   * miolo com a edição já na tela.
   */
  it('capa `tracado` com a leitura em voo reserva a altura, sem desenhar', () => {
    assert.deepEqual(
      desenhoDaCapa('tracado', { estado: 'procurando' }, GRADE_CHEIA),
      { tipo: 'reservando' },
    );
  });

  it('capa `tracado` com rota CURTA cai para a grade — sem risco de virar um risco', () => {
    assert.deepEqual(desenhoDaCapa('tracado', pronta(volta(10)), GRADE_CHEIA), { tipo: 'grade', grade: GRADE_CHEIA });
  });

  /**
   * A linha existe com o traçado **vazio**: é rota curta levada ao extremo, e cai
   * na grade como a de 1 a 19 pontos. Era o caso em que `fetchRouteSurface`
   * devolvia `null` e a capa ia para o papel — zero pontos tratado com mais
   * deferência do que um ponto.
   */
  it('linha existente com overview vazio cai na grade, como a rota de um ponto', () => {
    assert.deepEqual(desenhoDaCapa('tracado', pronta([]), GRADE_CHEIA), { tipo: 'grade', grade: GRADE_CHEIA });
  });

  it('capa `tracado` sem linha, ou com leitura que falhou, cai para o papel', () => {
    assert.deepEqual(desenhoDaCapa('tracado', { estado: 'sem-linha' }, GRADE_CHEIA), { tipo: 'papel' });
    assert.deepEqual(desenhoDaCapa('tracado', { estado: 'falhou' }, GRADE_CHEIA), { tipo: 'papel' });
    assert.deepEqual(desenhoDaCapa('tracado', NAO_PEDIDA, GRADE_CHEIA), { tipo: 'papel' });
  });

  it('foto e capa nenhuma caem no papel: a foto tem caminho próprio', () => {
    assert.deepEqual(desenhoDaCapa('foto', NAO_PEDIDA, GRADE_CHEIA), { tipo: 'papel' });
    assert.deepEqual(desenhoDaCapa(null, NAO_PEDIDA, GRADE_CHEIA), { tipo: 'papel' });
  });
});
