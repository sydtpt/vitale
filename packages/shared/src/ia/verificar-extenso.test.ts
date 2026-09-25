/**
 * A regra 9 — o numeral por extenso.
 *
 * `citacoes()` só vê **dígito**. Em 25/09/2026, na corrida das 08:40 no iPhone, o
 * modelo do aparelho escreveu o caderno todo por extenso: sobraram cinco corridas de
 * dígito no texto, e **todas as cinco eram data**, que a máscara remove. A regra 1
 * não teve nada para conferir e aprovou por vacuidade — sobre um texto que dizia
 * *"os passos diários somaram doze mil, três trêscentos e oitenta"* quando o pacote
 * diz **12.338**.
 *
 * A forma é sorte: o mesmo motor, com o mesmo pedido, usou dígito às 07:10 e extenso
 * às 08:40. Ver `PALAVRAS_DE_NUMERO`.
 *
 * ## O que este arquivo mede
 *
 * O parser (a gramática do numeral em português) e as **quatro exclusões**, que são
 * onde o falso positivo mora: a data por extenso, o solteiro miúdo, o multiplicador
 * sozinho e as locuções.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_ROTULO, PACOTE_VERSAO } from './pacote';
import type { Base, BaseId, FatoNumero, PacoteDeFatos } from './pacote';
import { verificarTexto } from './verificar';

function ausente(id: BaseId): Base {
  return {
    id, rotulo: BASE_ROTULO[id], existe: false, valor: null, delta: null, deltaPct: null,
    motivo: 'não há',
  };
}

function fato(rotulo: string, atual: number, casas = 0): FatoNumero {
  return {
    chave: rotulo.toLowerCase(),
    rotulo,
    atual,
    bases: [ausente('B1'), ausente('B2'), ausente('B3')],
    unidade: '',
    casas,
    amostra: null,
    comparavel: true,
  };
}

/** O recorte real do caderno Movimento de 14–20/09, nos valores que o texto citou. */
function pacote(...metricas: FatoNumero[]): PacoteDeFatos {
  return {
    versao: PACOTE_VERSAO,
    caderno: 'movimento',
    rotulo: 'Movimento',
    periodo: {
      tipo: 'week',
      rotulo: '14/09 – 20/09',
      rotuloAnterior: '07/09 – 13/09',
      inicioISO: '2026-09-14',
      fimISO: '2026-09-20',
      fechado: true,
      diasNoPeriodo: 7,
      luz: null,
    },
    metricas,
    tendencias: [],
    textos: [],
    lapides: [
      { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
      { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
    ],
    cobertura: null,
    correlacoes: [],
    eventos: [],
    lacunas: [],
    semDado: false,
  };
}

/** Só as reprovações da regra 9 — a marca é o sufixo que ela põe no detalhe. */
function extenso(texto: string, p: PacoteDeFatos): string[] {
  return verificarTexto(texto, p).problemas
    .filter((x) => x.detalhe.includes('numeral por extenso'))
    .map((x) => x.detalhe);
}

/* ─────────────────────────── a gramática ─────────────────────────── */

describe('regra 9 — o parser do numeral', () => {
  it('"cinquenta e seis" é 56, e passa quando 56 está no pacote', () => {
    assert.deepEqual(extenso('A distância atingiu cinquenta e seis quilômetros.', pacote(fato('Distância', 56))), []);
  });

  it('"cento e quinze" é 115', () => {
    assert.deepEqual(extenso('Os andares totalizaram cento e quinze.', pacote(fato('Andares', 115))), []);
  });

  it('"doze mil trezentos e trinta e oito" é 12.338 — a soma de grupos', () => {
    const p = pacote(fato('Passos por dia', 12338));
    assert.deepEqual(extenso('Os passos somaram doze mil trezentos e trinta e oito.', p), []);
  });

  it('e o mesmo numeral errado reprova', () => {
    const p = pacote(fato('Passos por dia', 12338));
    const d = extenso('Os passos somaram doze mil trezentos e oitenta.', p);
    assert.equal(d.length, 1);
    assert.match(d[0], /\(12380\) não está no pacote/);
  });

  it('o caso medido: "doze mil, três trêscentos e oitenta" — a grafia errada PARA a corrida', () => {
    // O parser não adivinha o que o modelo quis dizer. "trêscentos" não é palavra de
    // numeral, então a corrida fecha em "doze mil, três" (12.003) e "oitenta" abre
    // outra. Os dois reprovam, que é o veredito certo.
    const p = pacote(fato('Passos por dia', 12338));
    const d = extenso('Os passos diários somaram doze mil, três trêscentos e oitenta.', p);
    assert.deepEqual(d.map((x) => x.match(/\((\d+)\)/)?.[1]), ['12003', '80']);
  });

  it('"mil" com multiplicando e sem: "três mil" é 3.000', () => {
    assert.match(extenso('Foram três mil passos.', pacote(fato('Passos por dia', 12338)))[0], /\(3000\)/);
  });

  it('o "e" final não entra: "trinta e poucos" fecha em trinta', () => {
    const d = extenso('Foram trinta e poucos andares.', pacote(fato('Andares', 115)));
    assert.deepEqual(d.map((x) => x.match(/\((\d+)\)/)?.[1]), ['30']);
  });

  it('não junta através de "ou": "um ou dois" não é 3', () => {
    assert.deepEqual(extenso('Houve um ou dois momentos.', pacote(fato('Andares', 115))), []);
  });
});

/* ──────────────────── as quatro exclusões ──────────────────── */

describe('regra 9 — as exclusões são onde o falso positivo mora', () => {
  const p = pacote(fato('Andares', 115));

  it('a DATA por extenso fica fora — é a lápide que o pedido manda copiar', () => {
    // Reprovar aqui repetiria a reprovação que a máscara das datas acabou de tirar
    // do caminho. As duas lápides do caderno, como o modelo as escreveu:
    assert.deepEqual(extenso(
      'O consumo máximo de oxigênio deixou de ser registrado em quatorze de julho de 2026. '
      + 'Os anéis interromperam a coleta em dezessete de agosto de 2026.', p,
    ), []);
  });

  it('e a data com a outra grafia de 14 — "catorze"', () => {
    assert.deepEqual(extenso('Parou em catorze de julho de 2026.', p), []);
  });

  it('o SOLTEIRO abaixo de onze fica fora — "um" é artigo antes de ser número', () => {
    for (const frase of [
      'O que se viu foi um contraste claro.',
      'Houve uma transição sutil.',
      'Foram dois momentos.',
      'O ciclismo teve três sessões.',
      'Foram dez dias assim.',
    ]) {
      assert.deepEqual(extenso(frase, p), [], frase);
    }
  });

  it('mas de onze para cima o solteiro é quantidade, e é conferido', () => {
    // O caso real: "dois horas e trinta minutos" para 2,6 h. O "dois" escapa por ser
    // miúdo; o "trinta" não, e é ele que denuncia a frase.
    const d = extenso('O tempo foi de dois horas e trinta minutos.', p);
    assert.deepEqual(d.map((x) => x.match(/\((\d+)\)/)?.[1]), ['30']);
  });

  it('o MULTIPLICADOR NU fica fora — "mil vezes melhor" não é 1.000', () => {
    assert.deepEqual(extenso('Ficou mil vezes melhor.', p), []);
    assert.deepEqual(extenso('Foram milhões de passos.', p), []);
  });

  it('mas com multiplicando ele é quantidade: "um milhão" é conferido', () => {
    // O preço da exclusão anterior, dito dos dois lados. `milhões` nu escapa; `um
    // milhão` não, porque aí a frase afirma um número — e em texto de dado ela está
    // afirmando mesmo, não fazendo hipérbole.
    assert.match(extenso('Foram um milhão de passos.', p)[0], /\(1000000\)/);
  });

  it('as LOCUÇÕES ficam fora', () => {
    for (const frase of [
      'A cobertura foi de cem por cento.',
      'Em vinte e quatro horas o quadro mudou.',
      'Acontecia de dois em dois dias.',
    ]) {
      assert.deepEqual(extenso(frase, p), [], frase);
    }
  });
});

/* ──────────────────── a aproximação marcada vale igual ──────────────────── */

describe('regra 9 — a aproximação marcada não depende da grafia', () => {
  it('"mais de doze mil" para 12.338 é aceito, como "mais de 12 mil"', () => {
    const p = pacote(fato('Passos por dia', 12338));
    const v = verificarTexto('Os passos passaram de mais de doze mil por dia.', p);
    assert.deepEqual(v.problemas, []);
    assert.equal(v.aproximacoes?.length, 1);
    assert.equal(v.aproximacoes?.[0].doPacote, 12338);
    assert.equal(v.aproximacoes?.[0].valor, 12000);
  });

  it('e sem a marca o mesmo numeral reprova', () => {
    const p = pacote(fato('Passos por dia', 12338));
    assert.match(extenso('Os passos somaram doze mil por dia.', p)[0], /\(12000\)/);
  });
});

/* ────────────────────────── a evidência do iPhone ────────────────────────── */

/**
 * A corrida das **08:40 no iPhone**, com as oito regras já instaladas no aparelho.
 * O relatório é o que a bancada escreveu, sem edição.
 *
 * Ela existe porque foi ali que o buraco apareceu: o aparelho **aprovou nas oito** um
 * texto que erra dois números, porque os escreveu por extenso. E o mesmo relatório
 * prova que a régua do aparelho e a do Mac eram a mesma nas oito — nas outras cinco
 * colunas o veredito é idêntico ao que o Mac dá.
 */
describe('a corrida no iPhone — o texto por extenso que as oito aprovaram', () => {
  const CORRIDA = JSON.parse(readFileSync(
    join(import.meta.dirname, '__fixtures__', 'corrida-movimento-2026-09-25-no-iphone.json'),
    'utf8',
  )) as {
    readonly colunas: ReadonlyArray<{
      readonly motor: string;
      readonly desfecho: string;
      readonly cru?: string;
      readonly problemas?: ReadonlyArray<{ readonly regra: string }>;
    }>;
  };

  const APPLE = 'aparelho:sistema';
  const coluna = (motor: string) => {
    const c = CORRIDA.colunas.find((x) => x.motor === motor);
    assert.ok(c, `o motor ${motor} saiu do relatório`);
    return c;
  };

  /** O recorte do caderno nos valores que este texto cita. */
  const PACOTE = pacote(
    fato('Atividades', 3),
    fato('Sessões', 3),
    fato('Distância', 56),
    fato('Tempo em movimento', 2.6, 1),
    fato('Passos por dia', 12338),
    fato('Andares', 115),
    fato('Elevação', 218),
  );

  it('o aparelho aprovou pelas oito, e só reprovou pelo período', () => {
    // Lido do JSON: é o veredito que rodou no iPhone, não uma reconstrução.
    assert.deepEqual(coluna(APPLE).problemas?.map((p) => p.regra), ['periodo']);
  });

  it('e o texto não tem número de dado em dígito — só as datas', () => {
    const t = coluna(APPLE).cru ?? '';
    const digitos = [...t.matchAll(/\d[\d.,]*/g)].map((m) => m[0]);
    assert.deepEqual(digitos, ['14', '20', '2026', '2026', '2026,']);
  });

  it('a nona pega os dois números errados que ele escreveu por extenso', () => {
    const d = extenso(coluna(APPLE).cru ?? '', PACOTE);
    const valores = d.map((x) => x.match(/\((\d+)\)/)?.[1]);
    // 12.003 e 80 são as duas metades de "doze mil, três trêscentos e oitenta"
    // (o pacote diz 12.338); 30 é o "trinta minutos" de um tempo que é 2,6 h.
    assert.deepEqual(valores.sort(), ['12003', '30', '80']);
  });

  it('e os numerais CERTOS do mesmo texto passam', () => {
    // "cinquenta e seis quilômetros" (56), "cento e quinze" (115), e as duas datas
    // de lápide por extenso. Se algum deles reprovasse, a regra seria pior que o
    // buraco que ela fecha.
    const t = coluna(APPLE).cru ?? '';
    for (const certo of ['cinquenta e seis', 'cento e quinze', 'quatorze de julho', 'dezessete de agosto']) {
      assert.ok(t.includes(certo), `o texto precisa conter "${certo}"`);
      assert.deepEqual(
        extenso(t, PACOTE).filter((x) => x.includes(certo)), [],
        `"${certo}" está certo e não pode reprovar`,
      );
    }
  });
});
