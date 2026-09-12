import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import { descritorDaSaudeDoSono, entradaDaSaude, templateDaSaude, type EntradaDaSaude } from '../sleep/leitura';
import {
  DIMENSION_LABEL, SCORE_COVERAGE_FLOOR, coverageNote, nightScore, periodScore, type SleepCoverage,
  type SleepDimensionKey, type SleepScore,
} from '../sleep/score';
import type { PacoteDeFatos } from './pacote';
import {
  VOCABULARIO_PROIBIDO, casaPorPalavra, termosProibidosEm, verificarTexto, type SubconjuntoProibido,
} from './verificar';

/**
 * A lista de termos proibidos com dono (AD-6, stories 5.2 e 5.3).
 *
 * Quatro coisas se provam aqui: `causa` é a `CAUSA` de antes, sem tirar nem pôr
 * — é o que garante que a revista reprova exatamente o que reprovava —; os
 * subconjuntos são os da spec, com as flexões da 5.3; o casador de
 * `termosProibidosEm` é por palavra inteira, com o acento dobrado e o plural; e
 * nenhum termo casa com o texto que a Saúde do sono escreve — o de hoje e o do
 * template. Um termo que casasse com a frase do template reprovaria o próprio piso.
 */

const TODOS = Object.keys(VOCABULARIO_PROIBIDO) as SubconjuntoProibido[];

/** A `CAUSA` privada de `ia/verificar.ts` até a 5.2, copiada daquela versão. */
const CAUSA_DE_ANTES = [
  'porque', 'por causa', 'devido a', 'devido à', 'graças a', 'graças à',
  'resultou em', 'levou a', 'levou à', 'provocou', 'causou', 'causa disso',
  'em função de', 'em razão de', 'fez com que', 'por conta de',
];

/** Colidem com texto legítimo da Saúde do sono, e por isso ficaram de fora. */
const FORA_DE_PROPOSITO = ['nota', 'ponto', 'seguidas', 'máximo', 'comparar'];

/**
 * As flexões que a 5.3 deixou de fora de propósito (Design Notes): "precisa de 5
 * noites seguidas" é fato da Saúde, e "deve", "melhor" e "pior" são comparativo
 * e modal comuns demais para serem conselho ou tendência sozinhos.
 */
const FORA_DAS_FLEXOES = ['deve', 'precisa', 'melhor', 'pior'];

describe('VOCABULARIO_PROIBIDO', () => {
  it('causa é a CAUSA de antes, termo a termo e na mesma ordem', () => {
    assert.deepEqual([...VOCABULARIO_PROIBIDO.causa], CAUSA_DE_ANTES);
  });

  it('os subconjuntos são os seis da spec, com os termos da spec e as flexões da 5.3', () => {
    assert.deepEqual(Object.keys(VOCABULARIO_PROIBIDO), [
      'causa', 'conselho', 'elogio', 'placar', 'tendencia-e-meta', 'comparacao',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.conselho], [
      'continue assim', 'tente dormir mais', 'vale a pena acompanhar de perto', 'que tal', 'experimente',
      'verifique suas conexões', 'recomendo', 'sugiro',
      // 5.3, Design Notes: as flexões verbais e os plurais irregulares, que o casador não conjuga.
      'recomenda', 'recomendamos', 'recomendam', 'recomendar', 'recomendado', 'recomendável', 'recomendação',
      'recomendações', 'sugere', 'sugerimos', 'sugerir', 'sugerido', 'sugestão', 'sugestões', 'experimentar',
      'deveria', 'deveriam', 'evite', 'evitar', 'tente', 'tentar', 'procure', 'procurar', 'considere', 'considerar',
      'mantenha', 'o ideal', 'vale a pena',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.elogio], [
      'parabéns', 'continue assim', 'conquista',
      'ótimo', 'ótima', 'excelente', 'perfeito', 'perfeita', 'muito bem',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.placar], [
      'placar', 'score', 'pontuação', 'pontos', 'de 0 a 100', 'saldo', 'pontuações',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO['tendencia-e-meta']], [
      'melhorou', 'piorou', 'melhora', 'piora', 'streak', 'meta', 'seta',
      // "melhorias" saiu: o plural de "melhoria" já a casa.
      'melhorar', 'melhoram', 'melhoraram', 'melhorando', 'melhorado', 'melhore', 'melhoria',
      'piorar', 'pioram', 'pioraram', 'piorando', 'piorado', 'piore',
      'subiu', 'subiram', 'subir', 'caiu', 'caíram', 'cair', 'aumentou', 'aumentaram', 'aumentar',
      'diminuiu', 'diminuíram', 'diminuir', 'evoluiu', 'evoluir', 'em alta', 'em queda', 'tendência',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.comparacao], [
      'outras pessoas', 'a maioria das pessoas', 'média da população', 'norma clínica', 'para a sua idade',
    ]);
  });

  it('cada termo em minúsculas, sem espaço nas pontas, sem repetição no subconjunto', () => {
    // `causa` casa contra `texto.toLowerCase()`: um termo com maiúscula nunca casaria.
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO)) {
      assert.equal(new Set(termos).size, termos.length, nome);
      for (const t of termos) assert.equal(t, t.toLowerCase().trim(), `${nome}: "${t}"`);
    }
  });

  it('o que ficou de fora de propósito não está em subconjunto nenhum', () => {
    const todos = new Set(Object.values(VOCABULARIO_PROIBIDO).flat().map(dobrar));
    for (const t of [...FORA_DE_PROPOSITO, ...FORA_DAS_FLEXOES]) assert.equal(todos.has(dobrar(t)), false, t);
  });

  it('o nome de subconjunto é tipo', () => {
    const ok: SubconjuntoProibido = 'tendencia-e-meta';
    // @ts-expect-error — "nota" ficou de fora de propósito, e não é subconjunto.
    const fora: SubconjuntoProibido = 'nota';
    assert.ok(ok && fora);
  });

  it('é congelado, o objeto e cada subconjunto — quem importa não afrouxa a conferência', () => {
    assert.ok(Object.isFrozen(VOCABULARIO_PROIBIDO));
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO)) assert.ok(Object.isFrozen(termos), nome);
  });
});

/* ── a revista compõe só causa ── */

/** Um caderno sem número nenhum: a conferência só tem palavras a julgar. */
const SEM_NUMERO: PacoteDeFatos = {
  versao: 2, caderno: 'rotina', rotulo: 'Rotina',
  periodo: {
    tipo: 'month', rotulo: 'Agosto 2026', rotuloAnterior: 'Julho 2026',
    inicioISO: '2026-08-01', fimISO: '2026-08-31', fechado: true, diasNoPeriodo: 31, luz: null,
  },
  metricas: [], tendencias: [], textos: [], lapides: [], cobertura: null, correlacoes: [], eventos: [], lacunas: [], semDado: true,
};

const daCausa = (texto: string) => verificarTexto(texto, SEM_NUMERO).problemas.filter((p) => p.regra === 'causa');

describe('verificarTexto compõe só causa', () => {
  it('cada termo de causa reprova, com o próprio termo no detalhe', () => {
    for (const termo of VOCABULARIO_PROIBIDO.causa) {
      const texto = `O vento mudou ${termo} a frente fria.`;
      assert.ok(!/\d/.test(texto));
      assert.ok(daCausa(texto).some((p) => p.detalhe === `afirma causa: "${termo}"`), termo);
    }
  });

  it('os outros subconjuntos não entram: metade, melhora, pioram, pontos, saldo e meta não são causa', () => {
    // Morde se a regra 2 passar a ler `Object.values(VOCABULARIO_PROIBIDO).flat()`:
    // por trecho, "meta" casaria com "metade" e os outros com eles mesmos.
    const texto = 'Metade das noites teve melhora, as tardes pioram, os pontos e o saldo ficaram longe da meta.';
    assert.deepEqual(daCausa(texto), []);
  });
});

/* ── o casador de termosProibidosEm (5.3) ── */

/** Minúsculas e sem acento — a dobra que o casamento por palavra faz. */
function dobrar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

describe('termosProibidosEm', () => {
  it('casa por palavra inteira, com o acento dobrado dos dois lados', () => {
    assert.ok('metade'.includes('meta'));
    assert.equal(casaPorPalavra('metade', 'meta'), false);
    assert.equal(casaPorPalavra('pioram', 'piora'), false);
    assert.equal(casaPorPalavra('consistente', 'tente dormir mais'), false);
    assert.equal(casaPorPalavra('Bateu a meta.', 'meta'), true);
    assert.equal(casaPorPalavra('PARABENS pelo mês', 'parabéns'), true);
    assert.equal(casaPorPalavra('uma recomendacao', 'recomendação'), true);
    assert.deepEqual(termosProibidosEm('Metade das noites; as tardes consistentes; o setor.', TODOS), []);
  });

  it('o plural em -s/-es é do casador, e só para termo de uma palavra — fora "melhore" e "piore"', () => {
    for (const [texto, termo] of [
      ['Sem metas aqui.', 'meta'], ['Duas setas.', 'seta'], ['As conquistas do mês.', 'conquista'],
      ['Os placares.', 'placar'], ['Os scores.', 'score'], ['Os saldos.', 'saldo'],
    ] as const) {
      assert.deepEqual(termosProibidosEm(texto, TODOS).map((a) => a.termo), [termo], texto);
    }
    // Sem plural: não é o plural nominal, e o casador não conjuga.
    assert.equal(casaPorPalavra('as outras pessoass', 'outras pessoas', { plural: true }), false);
    assert.equal(casaPorPalavra('metas', 'meta'), false, 'sem a opção, o plural não vale');
    assert.equal(casaPorPalavra('metas', 'meta', { plural: true }), true);
    // "Pioram" não é plural de "piora" — é flexão verbal, e por isso é termo próprio desde a 5.3.
    assert.deepEqual(termosProibidosEm('Os dias pioram.', TODOS), [{ subconjunto: 'tendencia-e-meta', termo: 'pioram' }]);
    // O plural de "melhore" e "piore" é o comparativo: "as piores noites" é fato, não tendência.
    assert.deepEqual(termosProibidosEm('As piores noites e as melhores tardes.', TODOS), []);
    assert.equal(casaPorPalavra('as piores', 'piore', { plural: true }), false);
    assert.equal(casaPorPalavra('as melhores', 'melhore', { plural: true }), false);
    assert.deepEqual(termosProibidosEm('Que a duração não piore.', TODOS), [{ subconjunto: 'tendencia-e-meta', termo: 'piore' }]);
    // "melhorias" casa pelo plural de "melhoria", uma vez só.
    assert.deepEqual(termosProibidosEm('As melhorias da semana.', TODOS), [{ subconjunto: 'tendencia-e-meta', termo: 'melhoria' }]);
  });

  it('a contração da preposição final é do casador, e só para termo de várias palavras terminado em a, à, de ou em', () => {
    for (const [texto, termo] of [
      ['Foi devido ao calor.', 'devido a'], ['Foi devido aos dias quentes.', 'devido a'],
      ['Foi devido às noites curtas.', 'devido a'], ['Foi devido as noites curtas.', 'devido a'],
      ['Foi devido àquilo.', 'devido a'], ['Foi devido àquela viagem.', 'devido a'], ['Foi devido àqueles treinos.', 'devido a'],
      ['Veio graças aos treinos.', 'graças a'], ['Veio graças ao descanso.', 'graças a'], ['Veio graças àquele descanso.', 'graças a'],
      ['Isso levou ao atraso.', 'levou a'], ['Isso levou às duas.', 'levou a'],
      ['Foi por conta do calor.', 'por conta de'], ['Foi por conta das viagens.', 'por conta de'],
      ['Foi por conta disso.', 'por conta de'], ['Foi por conta disto.', 'por conta de'], ['Foi por conta daquilo.', 'por conta de'],
      ['Foi por conta desse calor.', 'por conta de'], ['Foi por conta dessas viagens.', 'por conta de'],
      ['Foi por conta deste mês.', 'por conta de'], ['Foi por conta destas noites.', 'por conta de'],
      ['Foi por conta daquele treino.', 'por conta de'], ['Foi por conta daquelas noites.', 'por conta de'],
      ['Foi por conta dele.', 'por conta de'], ['Foi por conta delas.', 'por conta de'],
      ['Foi em função da viagem.', 'em função de'], ['Foi em razão dos treinos.', 'em razão de'],
      ['Isso resultou no atraso.', 'resultou em'], ['Isso resultou na troca.', 'resultou em'],
      ['Isso resultou nos atrasos.', 'resultou em'], ['Isso resultou nas trocas.', 'resultou em'],
      ['Isso resultou num atraso.', 'resultou em'], ['Isso resultou numa troca.', 'resultou em'],
      ['Isso resultou nisso.', 'resultou em'], ['Isso resultou nisto.', 'resultou em'],
      ['Isso resultou naquilo.', 'resultou em'], ['Isso resultou nesse atraso.', 'resultou em'],
      ['Isso resultou nessas trocas.', 'resultou em'], ['Isso resultou neste mês.', 'resultou em'],
      ['Isso resultou nestas noites.', 'resultou em'], ['Isso resultou naquele atraso.', 'resultou em'],
      ['Isso resultou naquelas noites.', 'resultou em'], ['Isso resultou nele.', 'resultou em'],
      ['Isso resultou nelas.', 'resultou em'],
      ['Foi por conta dum atraso.', 'por conta de'], ['Foi por conta duma troca.', 'por conta de'],
    ] as const) {
      assert.deepEqual(termosProibidosEm(texto, ['causa']).map((a) => a.termo), [termo], texto);
    }
    // Sem a opção, a contração não vale; e ela não inventa forma que não existe.
    assert.equal(casaPorPalavra('devido ao calor', 'devido a'), false);
    assert.equal(casaPorPalavra('devido ao calor', 'devido a', { contracao: true }), true);
    assert.equal(casaPorPalavra('devido do calor', 'devido a', { contracao: true }), false);
    assert.equal(casaPorPalavra('por conta ao calor', 'por conta de', { contracao: true }), false);
    assert.equal(casaPorPalavra('resultou do atraso', 'resultou em', { contracao: true }), false);
    // Termo de uma palavra não contrai; e o "a" solto no fim de uma palavra não é preposição.
    assert.equal(casaPorPalavra('metao', 'meta', { contracao: true }), false);
  });

  it('a contração é lida por Object.hasOwn: a última palavra não acha forma no protótipo', () => {
    for (const ultima of ['constructor', '__proto__', 'hasownproperty', 'valueof']) {
      const termo = `fez o ${ultima}`;
      assert.doesNotThrow(() => casaPorPalavra(`Ele ${termo} ontem.`, termo, { contracao: true }), ultima);
      assert.equal(casaPorPalavra(`Ele ${termo} ontem.`, termo, { contracao: true }), true, ultima);
      assert.equal(casaPorPalavra('Ele fez o resto.', termo, { contracao: true }), false, ultima);
    }
  });

  it('um achado por termo dobrado: "devido a" e "devido à" são um só', () => {
    assert.deepEqual(termosProibidosEm('Caiu devido a isso, e devido à chuva.', ['causa']), [
      { subconjunto: 'causa', termo: 'devido a' },
    ]);
    assert.deepEqual(termosProibidosEm('Subiu graças à folga.', ['causa']), [{ subconjunto: 'causa', termo: 'graças a' }]);
    assert.deepEqual(termosProibidosEm('Isso levou à troca.', ['causa']), [{ subconjunto: 'causa', termo: 'levou a' }]);
  });

  it('cada termo da lista casa consigo mesmo, em maiúsculas e sem acento — as flexões inclusive', () => {
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO) as [SubconjuntoProibido, readonly string[]][]) {
      for (const termo of termos) {
        for (const texto of [`Aqui: ${termo}.`, `AQUI ${dobrar(termo).toUpperCase()} AQUI`]) {
          // Pela forma dobrada: "devido à" sai como o achado de "devido a", a primeira grafia.
          const achou = termosProibidosEm(texto, [nome]).some((a) => dobrar(a.termo) === dobrar(termo));
          assert.ok(achou, `${nome}: "${termo}" em "${texto}"`);
        }
      }
    }
  });

  it('um achado por termo: repetido no texto, ou em dois subconjuntos compostos juntos', () => {
    assert.deepEqual(termosProibidosEm('A meta, a meta e as metas.', TODOS), [
      { subconjunto: 'tendencia-e-meta', termo: 'meta' },
    ]);
    // "continue assim" é conselho e elogio: aparece uma vez, com o primeiro da ordem pedida.
    assert.deepEqual(termosProibidosEm('Continue assim.', ['conselho', 'elogio']), [
      { subconjunto: 'conselho', termo: 'continue assim' },
    ]);
    assert.deepEqual(termosProibidosEm('Continue assim.', ['elogio', 'conselho']), [
      { subconjunto: 'elogio', termo: 'continue assim' },
    ]);
  });

  it('só os subconjuntos pedidos', () => {
    assert.deepEqual(termosProibidosEm('Bateu a meta, porque sim.', ['causa']), [{ subconjunto: 'causa', termo: 'porque' }]);
    assert.deepEqual(termosProibidosEm('Bateu a meta, porque sim.', []), []);
  });

  it('os termos da revisão 3 pegam o que passava: "vale a pena" e "tendência"', () => {
    for (const texto of [
      'Vale a pena deitar mais cedo.', 'Não vale a pena.', 'A tendência da semana.', 'As tendências do mês.',
    ]) {
      assert.ok(termosProibidosEm(texto, TODOS).length > 0, texto);
    }
    // "vale a pena acompanhar de perto" segue lá: a frase longa e a curta são termos.
    assert.deepEqual(
      termosProibidosEm('Vale a pena acompanhar de perto.', ['conselho']).map((a) => a.termo),
      ['vale a pena acompanhar de perto', 'vale a pena'],
    );
  });

  it('o casamento por palavra não usa lookbehind, e ocorrência adjacente não casa', () => {
    // O `index.ts` reexporta este módulo, e o padrão compila no boot do app: sem
    // lookbehind, que não tem precedente no Hermes. O grupo que consome um caractere
    // que não é de palavra é equivalente num teste booleano.
    assert.equal(casaPorPalavra('aa', 'a'), false);
    assert.equal(casaPorPalavra('metameta', 'meta'), false);
    assert.equal(casaPorPalavra('meta', 'meta'), true, 'no começo do texto, sem nada antes');
    assert.equal(casaPorPalavra('meta meta', 'meta'), true);
    assert.equal(casaPorPalavra('(meta)', 'meta'), true, 'o que vem antes não é palavra');
    assert.equal(casaPorPalavra('-meta', 'meta'), true);
    assert.equal(casaPorPalavra('ameta', 'meta'), false);
    // Duas ocorrências coladas de um termo de várias palavras também não casam.
    assert.equal(casaPorPalavra('devido adevido a', 'devido a'), false);
    assert.equal(casaPorPalavra('devido a isso', 'devido a'), true);
  });

  it('as flexões da 5.3 pegam o que o termo-raiz sozinho deixava passar', () => {
    for (const texto of [
      'Evite o café.', 'É bom evitar o café.', 'Tente deitar cedo.', 'Vale tentar deitar cedo.', 'Procure deitar cedo.',
      'Vale procurar um horário.', 'Considere deitar cedo.', 'Vale considerar a pausa.', 'Mantenha o horário.',
      'O ideal seria deitar cedo.', 'Uma semana ótima.', 'Uma noite perfeita.', 'A duração subiu.', 'As notas subiram.',
      'A duração pode subir.', 'A duração caiu.', 'As notas caíram.', 'A duração pode cair.', 'A duração aumentou.',
      'As notas aumentaram.', 'Vale aumentar a duração.', 'A vigília diminuiu.', 'As notas diminuíram.',
      'Vale diminuir a vigília.', 'A duração evoluiu.', 'A duração pode evoluir.', 'A duração em alta.', 'A nota em queda.',
      'O app recomenda dormir mais.', 'Recomendamos deitar cedo.', 'Os médicos recomendam deitar cedo.',
      'É bom recomendar a pausa.', 'O horário recomendado.', 'É recomendável deitar cedo.', 'Uma sugestão: deitar cedo.',
      'Vale sugerir a pausa.', 'O horário sugerido.', 'Vale experimentar deitar cedo.', 'Você deveria deitar cedo.',
      'As noites deveriam ser mais longas.', 'Um resultado ótimo.', 'Uma semana excelente.', 'Um sono perfeito.',
      'Muito bem, a duração subiu.', 'A regularidade está melhorando.', 'As noites melhoram.', 'Que a duração melhore.',
      'Uma melhoria na duração.', 'As melhorias da semana.', 'As noites pioraram.', 'As noites pioram.',
      'Que a duração não piore.', 'A duração pode melhorar.', 'As pontuações da semana.',
    ]) {
      assert.ok(termosProibidosEm(texto, TODOS).length > 0, texto);
    }
  });

  it('o que ficou de fora das flexões passa: deve, precisa, melhor e pior — e o plural de "melhore" e "piore"', () => {
    for (const texto of [
      'A noite deve ter sido curta.', 'A regularidade precisa de 5 noites seguidas.', 'A melhor noite.', 'A pior noite.',
      'As piores noites.', 'As melhores noites.',
    ]) {
      assert.deepEqual(termosProibidosEm(texto, TODOS), [], texto);
    }
  });
});

/* ── o corpus da Saúde do sono ── */

const BXL = 120;

/**
 * Noite que acorda em `wakeDay`, apagando às `onsetH` locais. No molde de
 * `sleep/awake-shape.test.ts`: `onsetH >= 12` cai na véspera; abaixo disso é a
 * madrugada do próprio `wakeDay` — senão uma noite que apaga à 0h24 acordaria no
 * dia anterior ao que ela diz.
 */
function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin: number | null = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + (awakeMin ?? 0) / 60) * 3_600_000;
  const awakenings: SleepPeriod['awakenings'] = awakeMin === null
    ? null
    : awakeMin === 0
      ? []
      : [{
        from: new Date(onsetMs + 3_600_000).toISOString(),
        to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
      }];
  return {
    userId: 'u', onsetAt: new Date(onsetMs).toISOString(), wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null, inBedEnd: null, tzOffset: BXL, wakeDay, asleepH: durH, awakenings,
    stages: null, stageSegments: null,
  };
}

/** `n` noites terminando em `ultimo`, uma por dia. */
function noites(ultimo: string, n: number, onsetH = 23.5, durH = 7.5, awakeMin: number | null = 0): SleepPeriod[] {
  const d = new Date(`${ultimo}T12:00:00Z`);
  return Array.from({ length: n }, (_, k) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - (n - 1 - k));
    return noite(x.toISOString().slice(0, 10), onsetH, durH, awakeMin);
  });
}

const notas = (periodos: readonly SleepPeriod[], nota: number) =>
  Object.fromEntries(periodos.map((p) => [p.wakeDay, nota]));

/**
 * O que a Saúde escreve hoje, gerado pelas funções dela e não copiado delas: os
 * rótulos, os fatos e as ausências de `nightScore`/`periodScore` (os dois ramos
 * de cada dimensão) e a nota de cobertura.
 */
function textosDaSaude(): { scores: SleepScore[]; textos: string[] } {
  const historico = noites('2026-08-19', 20, 23.5, 7.5, 12);
  const semana = noites('2026-08-31', 7, 23.6, 6.4, 25);
  const scores = [
    nightScore(noite('2026-08-20', 23.5, 7.5, null), [], null),        // sem despertares, sem base, sem nota
    nightScore(noite('2026-08-20', 23.5, 6.2, 0), [], 3),              // sem base; "0 despertares"; nota
    nightScore(noite('2026-08-20', 0.4, 7.9, 15), historico, 4),       // com base: "1 despertar", "meio"
    periodScore([], 7),                                                // "sem noites no período"
    periodScore(noites('2026-08-07', 3), 7),                           // abaixo do piso; sem regularidade
    periodScore(semana, 7, notas(semana, 4), [...historico, ...semana]), // "seguidas", "notas", "≥ 7h"
    periodScore(semana, 7, { [semana[0].wakeDay]: 2 }),               // "1 nota"
  ];
  const textos = [
    ...Object.values(DIMENSION_LABEL),
    ...scores.flatMap((s) => s.dimensions.flatMap((d) => [d.label, d.fact, d.absent ?? ''])),
    ...scores.map((s) => coverageNote(s) ?? ''),
  ].filter((t) => t !== '' && t !== '—');
  return { scores, textos };
}

/**
 * As frases dos casos da CAP-13 (`docs/specs/sono/spec.md`), como o template as
 * vai escrever — as citadas entre aspas na spec e as descrições de cada caso.
 * A palavra de proibição da própria spec ("sem elogio") não entra: não é texto
 * que a Saúde escreve.
 */
const FRASES_DOS_CASOS = [
  'os últimos 12 meses têm 53% das noites gravadas — poucas para contar',  // sem-contagem
  'menos de duas dimensões medidas: não há o que comparar',               // medidas-insuficientes
  'tudo no máximo',                                                       // tudo-no-maximo
  'todas as medidas no mesmo ponto abaixo de 2',                          // todas-iguais
  'as quatro dimensões medidas estão no mesmo ponto',                     // todas-iguais
  'a dimensão mais baixa, com o fato cru dela',                           // uma
  'as duas empatadas',                                                    // duas
  'três ou mais empatadas no mínimo',                                     // fora-do-empate
  'só o horário está no máximo',                                          // fora-do-empate
];

/** Todas as combinações de ponto × presença em `n` dimensões. */
function combinacoes(n: number): (number | null)[][] {
  if (n === 0) return [[]];
  return combinacoes(n - 1).flatMap((resto) => [null, 0, 1, 2].map((v) => [...resto, v]));
}

/**
 * Toda frase que o template sabe escrever — com os marcadores e já interpolada
 * com fatos de verdade. Gerada, não copiada: cada combinação de ponto ×
 * presença, na noite e no período, sob cada cobertura, passa pelo
 * `casoDaSaude` (dentro do descritor) e pelo template.
 */
function frasesDoTemplate(periodo: SleepScore, noiteS: SleepScore): string[] {
  const out = new Set<string>();
  const coberturas: readonly SleepCoverage[] = [
    { nights: 0, expected: 7, ratio: 0 },
    { nights: 3, expected: 7, ratio: 3 / 7 },
    { nights: 7, expected: 7, ratio: 1 },
  ];
  const casos: [EntradaDaSaude['alcance'], EntradaDaSaude['range'], SleepScore, readonly (SleepCoverage | null)[]][] = [
    // A noite: a que existe (sem cobertura) e a que não existe (uma esperada, nenhuma gravada).
    ['noite', 'ultima', noiteS, [null, { nights: 0, expected: 1, ratio: 0 }]],
    ['periodo', '7d', periodo, coberturas],
  ];
  for (const [alcance, range, base, covs] of casos) {
    for (const coverage of covs) {
      for (const pontos of combinacoes(base.dimensions.length)) {
        const dimensions = base.dimensions.map((d, i) => ({ ...d, points: pontos[i] }));
        const medidas = dimensions.filter((d) => d.points !== null);
        const score: SleepScore = {
          dimensions,
          points: medidas.reduce((s, d) => s + (d.points ?? 0), 0),
          max: medidas.length * 2,
          coverage,
          scored: medidas.length > 0 && (coverage === null || coverage.ratio >= SCORE_COVERAGE_FLOOR),
        };
        const e: EntradaDaSaude = { alcance, range, hoje: '2026-09-10', janela: { since: null, until: null }, score };
        out.add(templateDaSaude(e));
        const piso = descritorDaSaudeDoSono.semModelo(e);
        if ('frase' in piso) out.add(piso.frase);
      }
    }
  }
  return [...out];
}

describe('o corpus da Saúde do sono', () => {
  const { scores, textos } = textosDaSaude();
  // A noite com base e nota, e a semana com as cinco medidas: os fatos de verdade.
  const [, , noiteComBase, , , semana] = scores;
  const template = frasesDoTemplate(semana, noiteComBase);
  // A noite que não existe também escreve: o motivo da ausência.
  const semNoite = entradaDaSaude([], {}, { range: 'ultima', offset: 0, hoje: '2026-09-10' });
  // E o nome de cada janela, que o motor põe na frase por `{janela}` e `{quando}`:
  // as correntes, as de trás, a que atravessa o ano, a inteira no ano passado, a
  // noite e a noite que falta.
  const arquivo = noites('2026-01-09', 400);
  const janelas = (['ultima', '7d', '4s', '12m', 'ano'] as const).flatMap((range) =>
    [0, 1, 2].map((offset) => entradaDaSaude(arquivo, {}, { range, offset, hoje: '2026-01-09' })),
  );
  const nomesDasJanelas = [...janelas, semNoite].flatMap((e) =>
    ['— {janela}', '— {quando}'].map((m) => descritorDaSaudeDoSono.montarFrase(m, e).slice(2)),
  );
  /**
   * Frases que a conferência da Saúde **aprova** — e que um termo a mais reprovaria.
   * São o que prova a exclusão de "deve", "melhor" e "pior": eles não aparecem no
   * texto que o código escreve, aparecem no que o motor pode escrever sem errar. O
   * teste abaixo confere que a Saúde as aceita de verdade.
   */
  const FRASES_APROVADAS = [
    'Esta noite não foi gravada, e deve ter sido curta.',
    'Esta noite não foi gravada, e nada diz se foi noite melhor ou pior.',
  ];

  const corpus = [
    ...textos,
    ...semNoite.score.dimensions.flatMap((d) => [d.absent ?? '']).filter((t) => t !== ''),
    ...template,
    ...nomesDasJanelas,
    ...FRASES_DOS_CASOS,
    ...FRASES_APROVADAS,
  ];

  it('não é vácuo: cada dimensão aparece medida e não medida, com o fato e o motivo', () => {
    for (const key of Object.keys(DIMENSION_LABEL) as SleepDimensionKey[]) {
      const ds = scores.flatMap((s) => s.dimensions).filter((d) => d.key === key);
      assert.ok(ds.some((d) => d.absent), `${key}: nenhuma ausência no corpus`);
      assert.ok(ds.some((d) => d.points !== null && d.fact !== '—'), `${key}: nenhum fato medido no corpus`);
    }
    assert.ok(scores.some((s) => coverageNote(s)?.includes('abaixo do piso')), 'a nota de cobertura baixa');
    assert.equal(semana.dimensions.filter((d) => d.points !== null).length, 5, 'a semana tem as cinco medidas');
    assert.equal(noiteComBase.dimensions.filter((d) => d.points !== null).length, 4, 'a noite tem as quatro medidas');
  });

  it('não é vácuo: o template escreve cada caso e cada variante', () => {
    for (const trecho of [
      'A dimensão mais baixa é', 'empatam no ponto mais baixo', 'está no máximo', 'estão acima das outras',
      'dimensões medidas estão no mesmo ponto', 'dimensões medidas estão no máximo', 'foi medida nesta noite',
      'foi medida neste período', 'das noites gravadas', 'não tem noite gravada', 'Esta noite não tem medida',
      'Este período não tem medida', 'Não há noite gravada', '{regularidade}', '{medidas}', '{cobertura}', 'SRI ', '/5 · ',
    ]) {
      assert.ok(template.some((f) => f.includes(trecho)), `o template não escreve "${trecho}"`);
    }
  });

  it('não é vácuo: os nomes das janelas estão no corpus', () => {
    for (const nome of [
      'os últimos 7 dias', 'as últimas 4 semanas', 'os últimos 12 meses', 'este ano', 'o ano de 2025',
      'os 7 dias de 27/12/2025 a 02/01/2026', 'os 7 dias de 20/12/2025 a 26/12/2025', 'as 4 semanas de 15/11/2025 a 12/12/2025',
      'os 12 meses de 10/01/2024 a 09/01/2025', 'a noite de 09/01', 'a última noite',
      'nos últimos 7 dias', 'nas 4 semanas de 15/11/2025 a 12/12/2025', 'neste ano', 'no ano de 2025', 'na noite de 09/01',
      'na última noite',
    ]) {
      assert.ok(nomesDasJanelas.includes(nome), `"${nome}" — há: ${nomesDasJanelas.join(' | ')}`);
    }
  });

  it('as frases aprovadas são aprovadas mesmo — é nelas que "deve", "melhor" e "pior" vivem', () => {
    for (const frase of FRASES_APROVADAS) {
      assert.deepEqual(descritorDaSaudeDoSono.conferir(frase, semNoite), { ok: true }, frase);
    }
  });

  it('o que ficou de fora de propósito casa, sim, com o corpus — é por isso que ficou de fora', () => {
    // O controle positivo: sem ele, um corpus que não contivesse as frases da
    // Saúde passaria o teste abaixo sem medir nada. E cada termo excluído tem de
    // aparecer: exclusão que não colide com nada não prova nada.
    for (const t of [...FORA_DE_PROPOSITO, ...FORA_DAS_FLEXOES]) {
      assert.ok(corpus.some((texto) => casaPorPalavra(texto, t)), `"${t}" não aparece no corpus`);
    }
  });

  it('nenhum termo proibido casa, pelo casador de produção, com o texto que a Saúde escreve', () => {
    const colisoes: string[] = [];
    for (const texto of corpus) {
      for (const { subconjunto, termo } of termosProibidosEm(texto, TODOS)) {
        colisoes.push(`${subconjunto}: "${termo}" em "${texto}"`);
      }
    }
    assert.deepEqual(colisoes, []);
  });
});
