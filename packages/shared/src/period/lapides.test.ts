/**
 * O detector de métrica morta — a matriz inteira (Story 2.7).
 *
 * ## O que é medido, e o que é fixture
 *
 * **Medido em produção, 23/09/2026**, rodando o SQL de verdade contra o banco e
 * alimentando o resultado em `lapidesDoAcervo`: o detector declara exatamente
 * respiração (10/07/2026), VO₂max (14/07), SpO₂ (16/07) e anéis (17/08), e nada
 * mais; o peso fica de fora pelas dez medidas. Medido também: `outra_chegou` é
 * **verdadeiro em todos os silêncios** do acervo — em 11/07–16/09/2025 só a
 * família de atividade emudeceu, e as métricas de pulso seguiram chegando —, e o
 * recorde próprio de sono, VFC, SpO₂ e respiração fica entre **15 e 17 dias**.
 *
 * **Fixture**: todas as grandezas deste acervo sintético. As **datas** das quatro
 * mortes e os **números acima** são os de produção; o tamanho de cada silêncio
 * construído aqui é escolha do teste, para exercitar cada metade da regra
 * isoladamente. Nada aqui reconstrói o acervo do dono — o que ele prende é a
 * **forma** da regra.
 *
 * ## As duas metades, e o que cada uma protege
 *
 * - o **recorde próprio** é quem trabalha no caso comum: uma *família* de
 *   sensores que para. A testemunha não ajuda ali, porque as outras famílias
 *   seguem chegando;
 * - a **testemunha** (`outraChegou`) protege o **blecaute**: troca de telefone,
 *   permissão revogada — nada chega, e sem ela a edição sairia com lápide em
 *   todas as métricas de uma vez. Esse caso nunca aconteceu no acervo, e é por
 *   isso que ele aqui é hipotético e está nomeado como tal.
 *
 * Os fatos chegam por {@link fatosDoSilencio}, a emulação da função do banco —
 * assim a matriz exercita a forma que o Postgres devolve, e não uma forma
 * escrita para caber na regra.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { montarPacote, lapideDoPeriodo } from '../ia/pacote';
import { buildRetrospective } from './retro';
import { SEM_DADOS_DA_RETRO, retroInputDe } from './retro-dados';
import {
  MINIMO_DE_MEDIDAS,
  PISO_DE_SILENCIO_DIAS,
  lapidesDoAcervo,
  maiorSilencioFechado,
  silencioCorrente,
  type MetricaNoAcervo,
} from './lapides';
import { diaMais, diasEntre, fatosDoSilencio } from './__tests__/silencio-do-banco';

/* ── o acervo ────────────────────────────────────────────────────────────── */

/** O dia da medição em produção que fixou as quatro mortes. */
const HOJE = '2026-09-23';
const AGORA = new Date(2026, 8, 23, 12, 0, 0);

const COMECO = '2025-01-01';

/**
 * A família de atividade emudece e volta — a data é a de produção
 * (11/07/2025), o **tamanho** é escolha da fixture.
 *
 * Medido: nesse período só a família de atividade calou; VFC, SpO₂, respiração,
 * sono e FC de repouso seguiram chegando. Daí `outraChegou` ser **verdadeiro**
 * no silêncio dela — e quem impede a lápide falsa ali é a métrica ter voltado,
 * com o tamanho do buraco virando o recorde próprio dela.
 *
 * O tamanho aqui é 30 dias porque o que o caso precisa provar é a **margem
 * apertada** dos anéis (37 dias de silêncio corrente contra o próprio recorde).
 * O tamanho de produção não foi medido, e a regra não depende dele.
 */
const FAMILIA_DE = '2025-07-11';
const FAMILIA_ATE = '2025-08-09';

/**
 * O recorde próprio das métricas de pulso: **15 a 17 dias**, medido em produção.
 *
 * É o número que moveu o piso de 14 para 30 (ADR 0055): com piso de 14, vinte
 * dias de interrupção — uma viagem, um relógio no conserto — matariam as quatro
 * de uma vez.
 */
const PAUSA_DO_PULSO_DE = '2025-11-01';
const PAUSA_DO_PULSO_ATE = '2025-11-17';

/** As mortes medidas em produção. */
const MORTES = {
  respiracao: '2026-07-10',
  vo2max: '2026-07-14',
  spo2: '2026-07-16',
  aneis: '2026-08-17',
} as const;

const foraDaPausa = (d: string): boolean => d < PAUSA_DO_PULSO_DE || d > PAUSA_DO_PULSO_ATE;
const foraDaFamilia = (d: string): boolean => d < FAMILIA_DE || d > FAMILIA_ATE;

/** Uma métrica de pulso: todo dia, menos a pausa de 17 dias que é o recorde dela. */
function pulsoAte(ate: string): string[] {
  return diasEntre(COMECO, ate).filter(foraDaPausa);
}

/** Uma métrica de atividade: todo dia, menos o período em que a família calou. */
function atividadeAte(ate: string): string[] {
  return diasEntre(COMECO, ate).filter(foraDaFamilia);
}

/** Um dia a cada `n` — o ritmo do VO₂max, que só é medido em treino ao ar livre. */
function aCada(n: number, ate: string): string[] {
  return diasEntre(COMECO, ate).filter((d, k) => k % n === 0 && foraDaFamilia(d));
}

/**
 * O acervo como `health_daily` o tem: que dias cada métrica teve medida.
 *
 * As oito métricas que o app pede ao HealthKit e que nunca receberam dado nenhum
 * (pressão, IMC, gordura, massa magra, cintura, água, macros, proteína) não
 * aparecem — a função do banco agrega sobre medidas, e o que nunca teve linha
 * não tem linha de saída.
 */
function acervo(): Record<string, string[]> {
  return {
    // Pulso, vivas até hoje.
    sono: pulsoAte(HOJE),
    fcRepouso: pulsoAte(HOJE),
    // Parou no Apple Watch em 17/07 e VOLTOU pelo intervals.icu em 01/08.
    vfc: [...pulsoAte('2026-07-17'), ...diasEntre('2026-08-01', HOJE)],
    // Pulso, mortas.
    respiracao: pulsoAte(MORTES.respiracao),
    spo2: pulsoAte(MORTES.spo2),
    // Atividade: passos segue viva, anéis e VO₂max morreram.
    passos: atividadeAte(HOJE),
    aneis: atividadeAte(MORTES.aneis),
    vo2max: [...aCada(3, MORTES.vo2max), MORTES.vo2max],
    // Uma medida na vida inteira: nunca foi série.
    peso: ['2026-07-16'],
  };
}

function fatos(piso = PISO_DE_SILENCIO_DIAS): MetricaNoAcervo[] {
  return fatosDoSilencio(acervo(), HOJE, piso);
}

const mortas = (f: MetricaNoAcervo[], agora = AGORA): Record<string, string> =>
  Object.fromEntries(lapidesDoAcervo(f, agora).map((l) => [l.metrica, l.ultimaMedidaISO]));

// **As de produção**, e não uma cópia: um erro de sinal reimplementado aqui
// ficaria verde contra o mesmo erro lá (`silencioCorrente` compara `de` com a
// última medida; `maiorSilencioFechado` compara `ate`).
const de = (f: MetricaNoAcervo[], metrica: string) => f.find((x) => x.metrica === metrica)!;
const correnteDe = (f: MetricaNoAcervo[], metrica: string) => silencioCorrente(de(f, metrica));
const recordeDe = (f: MetricaNoAcervo[], metrica: string) => maiorSilencioFechado(de(f, metrica));

/* ── o acervo inteiro ────────────────────────────────────────────────────── */

describe('o detector sobre o acervo', () => {
  it('declara mortas exatamente as quatro, com a data da última medida', () => {
    assert.deepEqual(mortas(fatos()), MORTES);
  });

  it('a ordem é a da morte — a mais antiga primeiro', () => {
    assert.deepEqual(
      lapidesDoAcervo(fatos(), AGORA).map((l) => l.metrica),
      ['respiracao', 'vo2max', 'spo2', 'aneis'],
    );
  });

  it('a VFC não morre: ela parou no relógio e voltou por outra fonte', () => {
    // A regra olha a MÉTRICA, nunca a fonte — o detector não sabe nem tem como
    // saber quem gravou a linha. O que ele vê é que ela voltou a chegar.
    assert.equal(de(fatos(), 'vfc').ultimaISO, HOJE);
    assert.equal(Object.keys(mortas(fatos())).includes('vfc'), false);
  });

  it('o peso não morre: uma medida na vida inteira nunca foi série', () => {
    const peso = de(fatos(), 'peso');
    assert.equal(peso.medidas, 1);
    assert.ok(peso.medidas < MINIMO_DE_MEDIDAS);
    assert.equal(Object.keys(mortas(fatos())).includes('peso'), false);
  });

  it('as vivas não morrem, e as que nunca tiveram dado não chegam a existir', () => {
    for (const viva of ['sono', 'fcRepouso', 'passos']) {
      assert.ok(fatos().some((m) => m.metrica === viva), `${viva} sumiu do acervo`);
    }
    assert.equal(fatos().some((m) => m.metrica === 'pressao'), false, 'métrica sem nenhuma medida voltou do banco');
  });

  /**
   * O caso apertado, e o que ele diz sobre a régua: os anéis pararam por último
   * e são os que menos tempo calaram — 37 dias em 23/09/2026, contra 69 da SpO₂
   * e 75 da respiração. O recorde deles neste acervo é o período em que a
   * família de atividade calou, cujo tamanho é escolha da fixture.
   *
   * Com um limiar fixo de 60 dias os anéis não teriam lápide nenhuma; com um de
   * 7, qualquer pausa da família os mataria.
   */
  it('os anéis morrem com pouca margem sobre o buraco da própria família', () => {
    assert.equal(correnteDe(fatos(), 'aneis')!.dias, 37);
    assert.equal(recordeDe(fatos(), 'aneis'), 30);
    assert.equal(correnteDe(fatos(), 'aneis')!.outraChegou, true);
  });
});

/* ── a família que para, e o blecaute ────────────────────────────────────── */

describe('a testemunha não vê família parando — quem segura isso é o recorde', () => {
  /**
   * Medido em 23/09/2026: `outra_chegou` é verdadeiro em **todos** os silêncios
   * do acervo, inclusive no de 11/07–16/09/2025. Ela não distingue "uma família
   * de sensores parou" de "a métrica morreu" — pelo dado, as duas coisas são o
   * mesmo evento.
   */
  it('no silêncio da família de atividade a testemunha é verdadeira, porque o pulso seguiu chegando', () => {
    const daFamilia = de(fatos(), 'passos').silencios.find((s) => s.de === FAMILIA_DE)!;
    assert.equal(daFamilia.outraChegou, true);
    // E ainda assim passos não morre: ela voltou, e o buraco virou recorde dela.
    assert.equal(Object.keys(mortas(fatos())).includes('passos'), false);
  });

  it('a testemunha é verdadeira em todo silêncio deste acervo — como em produção', () => {
    const todos = fatos().flatMap((m) => m.silencios);
    assert.ok(todos.length > 0, 'nenhum silêncio no acervo — o teste não mediu nada');
    assert.deepEqual(todos.filter((s) => !s.outraChegou), []);
  });

  /**
   * O caso que a testemunha protege, e que **nunca aconteceu neste acervo**:
   * troca de telefone, permissão do HealthKit revogada — nada chega. Sem ela, a
   * edição sairia com lápide em todas as métricas de uma vez.
   */
  it('blecaute: nada chega, e nenhuma morte é declarada', () => {
    // Todas param no **mesmo dia** — é o que "o sync quebrou" quer dizer. Uma
    // métrica que parasse um dia depois das outras seria testemunha delas, com
    // um dia de prova; essa borda irregular está no `deferred-work.md`.
    const CORTE = '2026-01-31';
    const blecaute: Record<string, string[]> = {};
    for (const metrica of Object.keys(acervo())) blecaute[metrica] = diasEntre(COMECO, CORTE);
    const f = fatosDoSilencio(blecaute, HOJE, PISO_DE_SILENCIO_DIAS);
    assert.deepEqual(mortas(f), {});
    // A prova de que o teste mede algo: o silêncio passa de todo recorde e do
    // piso — só a testemunha o segura.
    const corrente = correnteDe(f, 'spo2')!;
    assert.ok(corrente.dias > 200);
    assert.ok(corrente.dias > recordeDe(f, 'spo2'));
    assert.equal(corrente.outraChegou, false);
  });
});

/* ── as quatro regras, uma a uma ─────────────────────────────────────────── */

/** Um acervo mínimo: uma métrica com lápide que cala, e uma viva ao lado dela. */
function acervoDe(diasDaMetrica: readonly string[], piso = PISO_DE_SILENCIO_DIAS): MetricaNoAcervo[] {
  return fatosDoSilencio({ spo2: [...diasDaMetrica], sono: diasEntre(COMECO, HOJE) }, HOJE, piso);
}

describe('(1) o silêncio, o recorde próprio e o piso', () => {
  it('silêncio menor que o recorde da métrica: o ritmo dela, não a morte', () => {
    // Medida a cada 40 dias desde 2025, e a última há 30: passa do piso, e é
    // como ela sempre foi. Só o recorde próprio a salva.
    const dias = diasEntre(COMECO, HOJE).filter((_, k) => k % 40 === 0)
      .filter((d) => d <= diaMais(HOJE, -30));
    const f = acervoDe(dias);
    const corrente = correnteDe(f, 'spo2')!;
    assert.ok(corrente.dias >= PISO_DE_SILENCIO_DIAS, 'o silêncio nem chegou ao piso — o caso não é este');
    assert.ok(corrente.outraChegou, 'o vizinho vivo sumiu — o caso não é este');
    assert.ok(corrente.dias <= recordeDe(f, 'spo2'));
    assert.deepEqual(mortas(f), {});
  });

  it('acima do recorde, mas abaixo do piso de trinta dias: nada', () => {
    // Todo dia desde 2025 (recorde próprio zero) e calada há vinte e nove.
    assert.equal(PISO_DE_SILENCIO_DIAS, 30);
    assert.deepEqual(mortas(acervoDe(diasEntre(COMECO, diaMais(HOJE, -29)))), {});
  });

  it('no piso exato, com o recorde superado: morre', () => {
    assert.deepEqual(
      mortas(acervoDe(diasEntre(COMECO, diaMais(HOJE, -30)))),
      { spo2: diaMais(HOJE, -30) },
    );
  });

  /**
   * **O caso que moveu o piso de 14 para 30** (medição de 23/09/2026).
   *
   * Sono, VFC, SpO₂ e respiração têm recorde próprio de 15 a 17 dias. Uma pausa
   * de vinte dias — uma viagem, um relógio no conserto — **passa desse recorde**,
   * e por isso só o piso a segura: com 14 as quatro morreriam de uma vez.
   *
   * O "com 14 seria morte" é provado nos **fatos**, e não chamando a regra com
   * 14: um piso menor que o dos fatos é recusado (ver abaixo), justamente porque
   * seria a régua mais frouxa sobre um recorde já truncado.
   */
  it('pausa de vinte dias numa métrica de recorde dezessete: só o piso de 30 a segura', () => {
    const dias = diasEntre(COMECO, diaMais(HOJE, -20)).filter(foraDaPausa);
    const f = acervoDe(dias);

    // A pausa de 17 dias **existe no dado** — e o piso de 30 a esconde do núcleo.
    // É a verdade que o docblock de `PISO_DE_SILENCIO_DIAS` declara: o recorde
    // que a regra vê é sempre uma cota inferior do real.
    const comoOBancoVeria = fatosDoSilencio({ spo2: dias, sono: diasEntre(COMECO, HOJE) }, HOJE, 14);
    assert.equal(recordeDe(comoOBancoVeria, 'spo2'), 17, 'o recorde da fixture deixou de ser o medido');
    assert.equal(recordeDe(f, 'spo2'), 0, 'um buraco menor que o piso chegou ao núcleo');

    // Como seria com o piso de 14: o silêncio corrente de 20 dias chega ao núcleo,
    // passa do recorde de 17 e tem testemunha — as três condições da regra 1.
    const corrente = correnteDe(comoOBancoVeria, 'spo2')!;
    assert.equal(corrente.dias, 20);
    assert.equal(corrente.outraChegou, true);
    assert.ok(corrente.dias > recordeDe(comoOBancoVeria, 'spo2'));

    // Com 30, o piso age **antes da regra**: o silêncio de 20 dias nem volta do
    // banco. Não há o que julgar, e é assim que a pausa curta deixa de matar.
    assert.equal(correnteDe(f, 'spo2'), undefined);
    assert.ok(corrente.dias < PISO_DE_SILENCIO_DIAS);
    assert.deepEqual(mortas(f), {}, 'com o piso de 30 a pausa curta virou lápide');
  });

  it('o piso é parâmetro, e só sobe: 60 apaga a lápide dos anéis, 14 é recusado', () => {
    // Para cima, ele morde: os 37 dias dos anéis não alcançam 60.
    assert.deepEqual(
      lapidesDoAcervo(fatos(), AGORA, 60).map((l) => l.metrica),
      ['respiracao', 'vo2max', 'spo2'],
    );
    // Para baixo, é recusado: os silêncios abaixo do piso dos fatos nem vieram
    // do banco, então o recorde próprio viria subestimado.
    assert.throws(() => lapidesDoAcervo(fatos(), AGORA, PISO_DE_SILENCIO_DIAS - 1), RangeError);
    assert.throws(() => lapidesDoAcervo(fatos(), AGORA, 14), /menor que o dos fatos/);
    assert.throws(() => lapidesDoAcervo(fatos(), AGORA, Number.NaN), RangeError);
  });
});

/* ── o caso degenerado da testemunha ─────────────────────────────────────── */

describe('acervo de uma métrica só: não há quem testemunhe, e isso não é prova de vida', () => {
  /**
   * Sem este ramo, `outra_chegou` seria falsa para sempre num acervo de uma
   * métrica só — e nenhuma morte seria declarada nunca. "Não há mais ninguém
   * para testemunhar" viraria "não morreu", que é o oposto do que a condição
   * quer dizer.
   */
  it('a única métrica do acervo morre, porque não existe outra que pudesse chegar', () => {
    const so = fatosDoSilencio({ spo2: diasEntre(COMECO, '2026-07-16') }, HOJE, PISO_DE_SILENCIO_DIAS);
    assert.equal(correnteDe(so, 'spo2')!.outraChegou, true);
    assert.deepEqual(mortas(so), { spo2: '2026-07-16' });
  });

  it('com uma segunda métrica que também calou, a testemunha volta a valer — e ninguém morre', () => {
    const duas = fatosDoSilencio(
      { spo2: diasEntre(COMECO, '2026-07-16'), sono: diasEntre(COMECO, '2026-07-16') },
      HOJE,
      PISO_DE_SILENCIO_DIAS,
    );
    assert.equal(correnteDe(duas, 'spo2')!.outraChegou, false);
    assert.deepEqual(mortas(duas), {});
  });
});

describe('(2) a lápide é do período da última medida', () => {
  const lapide = lapidesDoAcervo(fatos(), AGORA).find((l) => l.metrica === 'aneis')!;

  it('agosto/2026 é o mês da morte dos anéis; setembro não é', () => {
    assert.equal(lapideDoPeriodo(lapide, { inicioISO: '2026-08-01', fimISO: '2026-08-31' }), true);
    assert.equal(lapideDoPeriodo(lapide, { inicioISO: '2026-09-01', fimISO: '2026-09-30' }), false);
  });

  /**
   * A linha da matriz "período anterior à morte": a edição de 2023 não vê nada.
   * Quem corta é `montarPacotes` — o detector não conhece período nenhum, e é
   * assim que a mesma lista serve a toda edição.
   */
  it('a edição de um período anterior à morte sai sem lápide — o pacote a corta', () => {
    // Setembro de 2023, pela mesma conta que o script usa. O acervo é vazio:
    // o que se mede aqui é o corte da lápide, não os números do mês.
    const resumo = buildRetrospective(
      retroInputDe(SEM_DADOS_DA_RETRO, [], new Date(2023, 9, 15, 12, 0, 0), 'month', -1),
    );
    assert.deepEqual([resumo.startISO, resumo.endISO], ['2023-09-01', '2023-09-30']);
    const pacote = montarPacote({ resumo, agora: AGORA, lapides: lapidesDoAcervo(fatos(), AGORA) }, 'movimento');
    assert.deepEqual(pacote.lapides, []);
  });
});

describe('(3) a morte antiga é repassada por doze meses', () => {
  const f = fatos();

  it('onze meses depois, a lápide dos anéis ainda vai', () => {
    assert.ok(Object.keys(mortas(f, new Date(2027, 6, 17, 12, 0, 0))).includes('aneis'));
  });

  it('doze meses e um dia depois, ela some da edição', () => {
    assert.equal(Object.keys(mortas(f, new Date(2027, 7, 18, 12, 0, 0))).includes('aneis'), false);
  });

  it('no dia exato dos doze meses ela ainda vai — "mais de doze meses" é que a tira', () => {
    assert.ok(Object.keys(mortas(f, new Date(2027, 7, 17, 12, 0, 0))).includes('aneis'));
  });

  it('em 2028 nenhuma das quatro é repassada', () => {
    assert.deepEqual(mortas(f, new Date(2028, 0, 1, 12, 0, 0)), {});
  });

  /**
   * A borda bissexta: doze meses antes de **29/02/2028** é 28/02/2027, porque
   * 29/02/2027 não existe. `Date.UTC(2028, -11, 29)` transbordaria para
   * 01/03/2027 — um dia a mais de repasse, justo na borda que o cálculo existe
   * para achar.
   */
  it('29 de fevereiro: doze meses antes é o último dia de fevereiro, não 1º de março', () => {
    const bissexto = new Date(2028, 1, 29, 12, 0, 0);
    const deUmAnoEUmDia: MetricaNoAcervo = {
      metrica: 'spo2', ultimaISO: '2027-02-27', medidas: 400,
      silencios: [{ de: '2027-02-28', ate: '2028-02-29', dias: 367, outraChegou: true }],
    };
    const deUmAnoCravado: MetricaNoAcervo = {
      ...deUmAnoEUmDia,
      ultimaISO: '2027-02-28',
      silencios: [{ de: '2027-03-01', ate: '2028-02-29', dias: 366, outraChegou: true }],
    };
    assert.deepEqual(lapidesDoAcervo([deUmAnoCravado], bissexto).map((l) => l.metrica), ['spo2']);
    assert.deepEqual(lapidesDoAcervo([deUmAnoEUmDia], bissexto), []);
  });
});

describe('(4) métrica com menos de dez medidas nunca ganha lápide', () => {
  // Dez dias seguidos e depois o silêncio — dentro dos doze meses do repasse,
  // para a única coisa que muda entre os dois casos ser a contagem.
  const PRIMEIRO = '2026-07-01';

  it('nove medidas e dois meses de silêncio: nada', () => {
    const f = acervoDe(diasEntre(PRIMEIRO, diaMais(PRIMEIRO, 8)));
    assert.equal(de(f, 'spo2').medidas, 9);
    assert.deepEqual(mortas(f), {});
  });

  it('dez medidas, nas mesmas condições: morre', () => {
    const f = acervoDe(diasEntre(PRIMEIRO, diaMais(PRIMEIRO, 9)));
    assert.equal(de(f, 'spo2').medidas, MINIMO_DE_MEDIDAS);
    assert.deepEqual(mortas(f), { spo2: diaMais(PRIMEIRO, 9) });
  });
});

/* ── a métrica que volta, e o banco que não responde ─────────────────────── */

describe('a métrica que volta perde a lápide', () => {
  it('a mesma métrica, morta e depois de volta: a lápide desaparece', () => {
    const morta = diasEntre(COMECO, '2026-07-16');
    assert.deepEqual(mortas(acervoDe(morta)), { spo2: '2026-07-16' });
    const voltou = [...morta, ...diasEntre('2026-09-01', HOJE)];
    assert.deepEqual(mortas(acervoDe(voltou)), {});
  });
});

describe('sem os fatos, a edição sai como saía antes desta story', () => {
  it('acervo ausente, vazio, ou sem nenhuma das quatro do catálogo: lápide nenhuma', () => {
    assert.deepEqual(lapidesDoAcervo(undefined, AGORA), []);
    assert.deepEqual(lapidesDoAcervo([], AGORA), []);
    assert.deepEqual(lapidesDoAcervo(fatosDoSilencio({ sono: ['2025-01-01'] }, HOJE, PISO_DE_SILENCIO_DIAS), AGORA), []);
  });

  it('fato malformado é descartado, e não derruba a edição', () => {
    const bom = de(fatos(), 'aneis');
    const podre: MetricaNoAcervo = { ...bom, metrica: 'spo2', ultimaISO: '2026-02-30' };
    assert.deepEqual(lapidesDoAcervo([podre, bom], AGORA).map((l) => l.metrica), ['aneis']);
  });

  it('a mesma métrica duas vezes nos fatos vira uma lápide só — o pacote recusaria duas', () => {
    const bom = de(fatos(), 'aneis');
    assert.deepEqual(lapidesDoAcervo([bom, bom], AGORA).length, 1);
  });
});
