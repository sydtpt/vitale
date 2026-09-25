/**
 * A parede de capas, montada — a matriz de I/O da Story 2.4b sobre o núcleo.
 *
 * O que se prova aqui é **a montagem**: o que entra na parede, em que ordem, com
 * que manchete e com que tiras. Foto, rota e desenho não passam por aqui — são do
 * hospedeiro, que os lê em lote; o que este módulo promete é que a parede não
 * inventa período nenhum e não recalcula nada que já foi impresso.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_DA_PAREDE, MESES_DO_ANO, montarParede, motivoDoVazio, ponteirosDaParede, tirasDoAno,
  type AcervoDaParede, type ItemDaParede, type LadrilhoDaParede,
} from './parede';
import type { Capa } from '../data/edicoes-capa';
import type { EdicaoNoArquivo, TextosDaEdicao } from '../data/edicoes-ia';
import { CADERNO_IDS, type CadernoId } from '../period/cadernos';

/** O relógio de todos os casos: 15/09/2026. Agosto de 2026 é `offset` −1. */
const AGORA = new Date(2026, 8, 15, 10, 0, 0);

const ultimoDia = (ano: number, mes: number): string =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(new Date(ano, mes + 1, 0).getDate()).padStart(2, '0')}`;

/** Uma edição de mês no arquivo, com um caderno por métrica passada. */
function mes(
  ano: number,
  m: number,
  cadernos: readonly (readonly [CadernoId, string | null])[] = [['sono', 'sono.duracao']],
): EdicaoNoArquivo {
  return {
    tipoPeriodo: 'month',
    inicio: `${ano}-${String(m + 1).padStart(2, '0')}-01`,
    fim: ultimoDia(ano, m),
    cadernos: cadernos.map(([caderno, metricaLider], i) => ({
      caderno, posicao: i + 1, promptVersao: 6, pacoteVersao: 4, metricaLider,
    })),
  };
}

function anuario(ano: number): EdicaoNoArquivo {
  return {
    tipoPeriodo: 'year',
    inicio: `${ano}-01-01`,
    fim: `${ano}-12-31`,
    cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: 'sono.duracao' }],
  };
}

function textos(
  ano: number,
  m: number,
  cadernos: readonly (readonly [CadernoId, string])[],
): TextosDaEdicao {
  return {
    tipoPeriodo: 'month',
    inicio: `${ano}-${String(m + 1).padStart(2, '0')}-01`,
    fim: ultimoDia(ano, m),
    cadernos: cadernos.map(([caderno, texto], i) => ({ caderno, posicao: i + 1, texto })),
  };
}

function capaDe(over: Partial<Capa> & Pick<Capa, 'tipoPeriodo' | 'inicio' | 'fim'>): Capa {
  return {
    natureza: 'grade',
    fotoId: null,
    fotoTakenAt: null,
    rotaActivityId: null,
    legenda: 'Agosto de 2026',
    carimbadaEm: '2026-09-01T00:00:00.000Z',
    motivo: 'sem-foto',
    fotoActivityId: null,
    ...over,
  };
}

function acervo(over: Partial<AcervoDaParede> = {}): AcervoDaParede {
  return { arquivo: [], capas: [], textos: [], ...over };
}

const linhas = (itens: readonly ItemDaParede[]): LadrilhoDaParede[][] =>
  itens.filter((i): i is Extract<ItemDaParede, { tipo: 'linha' }> => i.tipo === 'linha')
    .map((i) => [...i.ladrilhos]);

const ladrilhos = (itens: readonly ItemDaParede[]): LadrilhoDaParede[] => linhas(itens).flat();

describe('montarParede — a parede abre', () => {
  it('fatia em fileiras de duas, do mês mais recente para trás', () => {
    const itens = montarParede(
      acervo({ arquivo: [mes(2026, 3), mes(2026, 7), mes(2026, 5), mes(2026, 6), mes(2026, 4)] }),
      { now: AGORA },
    );
    assert.deepEqual(linhas(itens).map((l) => l.map((t) => t.inicio)), [
      ['2026-08-01', '2026-07-01'],
      ['2026-06-01', '2026-05-01'],
      ['2026-04-01'],
    ]);
    // A última fileira fica com uma só — quem preenche o vão é a tela, e não a
    // montagem: um ladrilho fantasma aqui viraria um alvo de toque que não abre nada.
    assert.ok(linhas(itens).every((l) => l.length <= COLUNAS_DA_PAREDE));
  });

  it('a régua abre o ano, e o anuário vem antes dos meses dele', () => {
    const itens = montarParede(
      acervo({ arquivo: [mes(2026, 0), anuario(2025), mes(2025, 11), mes(2025, 0)] }),
      { now: AGORA },
    );
    assert.deepEqual(
      itens.map((i) => (i.tipo === 'linha' ? `linha:${i.ladrilhos.map((l) => l.inicio).join('+')}` : `${i.tipo}:${i.ano}`)),
      ['regua:2026', 'linha:2026-01-01', 'regua:2025', 'anuario:2025', 'linha:2025-12-01+2025-01-01'],
    );
  });

  it('a régua existe mesmo no ano sem anuário — 2026 ainda não fechou', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7)] }), { now: AGORA });
    assert.deepEqual(itens.map((i) => i.tipo), ['regua', 'linha']);
  });

  it('arquivo vazio é parede vazia — a tela é que diz a frase', () => {
    assert.deepEqual(montarParede(acervo(), { now: AGORA }), []);
  });

  it('o `offset` de cada ladrilho sai do relógio de quem monta', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7), mes(2025, 7)] }), { now: AGORA });
    assert.deepEqual(ladrilhos(itens).map((l) => [l.inicio, l.offset]), [
      ['2026-08-01', -1],
      ['2025-08-01', -13],
    ]);
  });

  it('o rótulo é o do núcleo — "Agosto de 2026", e o do anuário é o ano', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7), anuario(2025)] }), { now: AGORA });
    assert.equal(ladrilhos(itens)[0]?.rotulo, 'Agosto de 2026');
    const a = itens.find((i) => i.tipo === 'anuario');
    assert.equal(a?.tipo === 'anuario' ? a.rotulo : null, '2025');
  });
});

describe('montarParede — o que fica de fora', () => {
  /** *Abrir só lê*: um ladrilho vazio seria a parede convidando a imprimir. */
  it('período fechado que ninguém imprimiu não aparece — a parede é o arquivo', () => {
    const itens = montarParede(
      acervo({
        arquivo: [mes(2026, 7)],
        // A capa existe (carimbo antigo), a edição não está no arquivo.
        capas: [capaDe({ tipoPeriodo: 'month', inicio: '2026-06-01', fim: '2026-06-30' })],
      }),
      { now: AGORA },
    );
    assert.deepEqual(ladrilhos(itens).map((l) => l.inicio), ['2026-08-01']);
  });

  it('semana e trimestre não entram — decisão do dono, 24/09/2026', () => {
    const semana: EdicaoNoArquivo = {
      tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09',
      cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: null }],
    };
    const trimestre: EdicaoNoArquivo = {
      tipoPeriodo: 'season', inicio: '2026-07-01', fim: '2026-09-30',
      cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: null }],
    };
    const itens = montarParede(acervo({ arquivo: [semana, trimestre, mes(2026, 7)] }), { now: AGORA });
    assert.deepEqual(ladrilhos(itens).map((l) => [l.tipoPeriodo, l.inicio]), [['month', '2026-08-01']]);
  });

  /**
   * Impossível pela coluna `date` do Postgres — e por isso **não lança**: a
   * montagem roda dentro do render, e uma exceção aqui seria a parede inteira
   * caindo por uma linha. Sai da parede, e o motivo vai para o log.
   */
  it('início ilegível sai da parede sem derrubar a tela', () => {
    const torto: EdicaoNoArquivo = {
      tipoPeriodo: 'month', inicio: 'agosto', fim: '2026-08-31',
      cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: null }],
    };
    const itens = montarParede(acervo({ arquivo: [torto, mes(2026, 7)] }), { now: AGORA });
    assert.deepEqual(ladrilhos(itens).map((l) => l.inicio), ['2026-08-01']);
  });
});

describe('montarParede — a capa carimbada', () => {
  it('chega inteira no ladrilho, sem ser reinterpretada', () => {
    const capa = capaDe({
      tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
      natureza: 'foto', fotoId: 'f-1', fotoActivityId: 'a-1',
      legenda: 'Ittre · km 31,1 · 12:38', motivo: 'rajada',
    });
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7)], capas: [capa] }), { now: AGORA });
    assert.deepEqual(ladrilhos(itens)[0]?.capa, capa);
  });

  it('edição sem capa carimbada vira ladrilho de papel, e não some', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7)] }), { now: AGORA });
    assert.equal(ladrilhos(itens)[0]?.capa, null);
  });

  it('a capa de outro tipo de período não vaza para o ladrilho do mês', () => {
    const itens = montarParede(
      acervo({
        arquivo: [mes(2026, 7)],
        capas: [capaDe({ tipoPeriodo: 'week', inicio: '2026-08-01', fim: '2026-08-31', natureza: 'tracado' })],
      }),
      { now: AGORA },
    );
    assert.equal(ladrilhos(itens)[0]?.capa, null);
  });
});

describe('montarParede — a manchete', () => {
  const COM_TEXTO = acervo({
    arquivo: [mes(2026, 7, [['sono', 'sono.duracao'], ['movimento', 'movimento.km']])],
    textos: [textos(2026, 7, [['sono', 'O sono caiu 40 min. E a cerveja explica.'], ['movimento', 'Agosto teve 21 pedaladas.']])],
  });

  it('é a chamada do primeiro caderno impresso — a primeira frase, inteira', () => {
    const itens = montarParede(COM_TEXTO, { now: AGORA });
    assert.equal(ladrilhos(itens)[0]?.manchete, 'O sono caiu 40 min.');
  });

  /**
   * O critério de aceitação da story: *given um mês cujo caderno líder está
   * silenciado, then a manchete é a do primeiro caderno visível*. Procurar pelo
   * VALOR 1 da `posicao` devolveria vazio — o buraco na numeração é esperado,
   * porque silenciar nunca escreve no banco.
   */
  it('com o líder silenciado, é a do primeiro caderno VISÍVEL', () => {
    const visiveis = CADERNO_IDS.filter((c) => c !== 'sono');
    const itens = montarParede(COM_TEXTO, { now: AGORA, visiveis });
    assert.equal(ladrilhos(itens)[0]?.manchete, 'Agosto teve 21 pedaladas.');
  });

  it('com todos silenciados, é `null` — nunca string vazia', () => {
    const itens = montarParede(COM_TEXTO, { now: AGORA, visiveis: [] });
    assert.equal(ladrilhos(itens)[0]?.manchete, null);
  });

  it('sem texto lido para o período, é `null` e o ladrilho continua de pé', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7)] }), { now: AGORA });
    assert.equal(ladrilhos(itens)[0]?.manchete, null);
    assert.equal(ladrilhos(itens).length, 1);
  });

  it('texto sem conteúdo é `null`, pela mesma régua de `chamadaDoTexto`', () => {
    const itens = montarParede(
      acervo({ arquivo: [mes(2026, 7)], textos: [textos(2026, 7, [['sono', '1. 40']])] }),
      { now: AGORA },
    );
    assert.equal(ladrilhos(itens)[0]?.manchete, null);
  });

  /** O corte é o de `chamadaDoTexto`, e "1.210" não é fim de frase. */
  it('o milhar não corta a manchete ao meio', () => {
    const itens = montarParede(
      acervo({ arquivo: [mes(2026, 7)], textos: [textos(2026, 7, [['sono', '1.210 fotos em agosto. E nenhuma em 2023.']])] }),
      { now: AGORA },
    );
    assert.equal(ladrilhos(itens)[0]?.manchete, '1.210 fotos em agosto.');
  });
});

describe('tirasDoAno — as quatro tiras, lendo metrica_lider', () => {
  it('são sempre quatro, na ordem do catálogo, inclusive as de zero meses', () => {
    const tiras = tirasDoAno([mes(2025, 0, [['sono', 'sono.duracao']])], 2025);
    assert.deepEqual(tiras.map((t) => t.caderno), [...CADERNO_IDS]);
    assert.deepEqual(tiras.map((t) => t.meses), [1, 0, 0, 0]);
    assert.ok(tiras.every((t) => t.celulas.length === MESES_DO_ANO));
  });

  it('o mês em que o caderno não saiu é `ausente`; o mês com nulo é `sem-metrica`', () => {
    const tiras = tirasDoAno(
      [mes(2025, 0, [['sono', 'sono.duracao']]), mes(2025, 1, [['sono', null]])],
      2025,
    );
    const sono = tiras[0]!;
    assert.deepEqual(sono.celulas[0], { estado: 'metrica', metrica: 'sono.duracao', mudou: false });
    assert.deepEqual(sono.celulas[1], { estado: 'sem-metrica' });
    assert.deepEqual(sono.celulas[2], { estado: 'ausente' });
    assert.equal(sono.meses, 2, 'o mês calado saiu — ele conta');
  });

  it('`mudou` marca a troca de líder, e nunca o primeiro mês do ano', () => {
    const tiras = tirasDoAno(
      [
        mes(2025, 0, [['sono', 'sono.duracao']]),
        mes(2025, 1, [['sono', 'sono.duracao']]),
        mes(2025, 2, [['sono', 'sono.regularidade']]),
      ],
      2025,
    );
    assert.deepEqual(
      tiras[0]!.celulas.slice(0, 3).map((c) => (c.estado === 'metrica' ? c.mudou : c.estado)),
      [false, false, true],
    );
  });

  /**
   * Um mês calado no meio não é troca de líder: é um mês sem líder. Zerar a
   * comparação ali faria a tira anunciar uma troca que não houve.
   */
  it('o mês calado não conta como troca — a comparação é entre métricas', () => {
    const tiras = tirasDoAno(
      [
        mes(2025, 0, [['sono', 'sono.duracao']]),
        mes(2025, 1, [['sono', null]]),
        mes(2025, 2, [['sono', 'sono.duracao']]),
      ],
      2025,
    );
    assert.deepEqual(tiras[0]!.celulas[2], { estado: 'metrica', metrica: 'sono.duracao', mudou: false });
  });

  it('lê os MESES do ano, e não o anuário — a edição do ano tem um valor só', () => {
    const tiras = tirasDoAno([anuario(2025)], 2025);
    assert.deepEqual(tiras.map((t) => t.meses), [0, 0, 0, 0]);
  });

  it('não atravessa a fronteira do ano', () => {
    const tiras = tirasDoAno([mes(2024, 11, [['sono', 'sono.duracao']]), mes(2025, 0, [['sono', 'sono.duracao']])], 2025);
    assert.equal(tiras[0]!.meses, 1);
  });

  /** A tira é registro do que foi impresso; o silêncio é preferência de leitura. */
  it('o silêncio do dono não apaga a tira — ele não muda o que foi impresso', () => {
    const arquivo = [mes(2025, 0, [['sono', 'sono.duracao']] as const)];
    const itens = montarParede(
      acervo({ arquivo: [...arquivo, anuario(2025)] }),
      { now: AGORA, visiveis: CADERNO_IDS.filter((c) => c !== 'sono') },
    );
    const a = itens.find((i) => i.tipo === 'anuario');
    assert.equal(a?.tipo === 'anuario' ? a.tiras[0]?.meses : null, 1);
  });

  it('o ano na parede é quatro tiras e NENHUMA capa', () => {
    const itens = montarParede(
      acervo({
        arquivo: [anuario(2025)],
        capas: [capaDe({ tipoPeriodo: 'year', inicio: '2025-01-01', fim: '2025-12-31' })],
      }),
      { now: AGORA },
    );
    assert.deepEqual(ladrilhos(itens), []);
    const a = itens.find((i) => i.tipo === 'anuario');
    assert.equal(a?.tipo === 'anuario' ? a.tiras.length : 0, 4);
  });
});

describe('montarParede — as chaves da lista', () => {
  it('são únicas: a lista virtualizada não remonta célula por colisão', () => {
    const itens = montarParede(
      acervo({ arquivo: [mes(2026, 7), mes(2026, 6), anuario(2025), mes(2025, 11)] }),
      { now: AGORA },
    );
    const chaves = itens.map((i) => i.chave);
    assert.equal(new Set(chaves).size, chaves.length, chaves.join(', '));
  });
});

describe('ponteirosDaParede — o que a parede busca fora', () => {
  const COM_TUDO = acervo({
    arquivo: [mes(2026, 7), mes(2026, 6), mes(2026, 5)],
    capas: [
      capaDe({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', natureza: 'foto', fotoId: 'f-1', fotoActivityId: 'a-1' }),
      capaDe({ tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31', natureza: 'tracado', rotaActivityId: 'a-2' }),
      capaDe({ tipoPeriodo: 'month', inicio: '2026-06-01', fim: '2026-06-30', natureza: 'grade' }),
    ],
  });

  it('separa a foto (pelo `foto_id`) da rota (pela atividade), pela natureza carimbada', () => {
    assert.deepEqual(ponteirosDaParede(COM_TUDO), { fotos: ['f-1'], rotas: ['a-2'] });
  });

  it('não busca nada para a capa órfã, nem para a de semana — elas não viram ladrilho', () => {
    const p = ponteirosDaParede(acervo({
      arquivo: [mes(2026, 7)],
      capas: [
        capaDe({ tipoPeriodo: 'month', inicio: '2026-05-01', fim: '2026-05-31', natureza: 'foto', fotoId: 'f-9', fotoActivityId: 'a-9' }),
        capaDe({ tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09', natureza: 'tracado', rotaActivityId: 'a-8' }),
      ],
    }));
    assert.deepEqual(p, { fotos: [], rotas: [] });
  });

  /**
   * A capa anterior à Story 1.16 não guardou `foto_activity_id` — e por ler **por
   * id** a parede não se importa: ela continua achável. Era esta a degradação que
   * a leitura por atividade impunha sem precisar.
   */
  it('a capa de foto sem `fotoActivityId` continua na lista — a busca é por id', () => {
    const p = ponteirosDaParede(acervo({
      arquivo: [mes(2026, 7)],
      capas: [capaDe({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', natureza: 'foto', fotoId: 'f-1', fotoActivityId: null })],
    }));
    assert.deepEqual(p.fotos, ['f-1']);
  });

  it('deduplica e ordena — duas capas podem apontar para a mesma pedalada', () => {
    const p = ponteirosDaParede(acervo({
      arquivo: [mes(2026, 7), mes(2026, 6), mes(2026, 5)],
      capas: [
        capaDe({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', natureza: 'tracado', rotaActivityId: 'a-2' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31', natureza: 'tracado', rotaActivityId: 'a-1' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2026-06-01', fim: '2026-06-30', natureza: 'tracado', rotaActivityId: 'a-2' }),
      ],
    }));
    assert.deepEqual(p.rotas, ['a-1', 'a-2']);
  });
});

describe('montarParede — a legenda do ladrilho', () => {
  it('passa a legenda carimbada quando ela acrescenta', () => {
    const itens = montarParede(
      acervo({
        arquivo: [mes(2026, 7)],
        capas: [capaDe({
          tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
          natureza: 'foto', fotoId: 'f-1', legenda: 'Ittre · km 31,1 · 12:38',
        })],
      }),
      { now: AGORA },
    );
    assert.equal(ladrilhos(itens)[0]?.legenda, 'Ittre · km 31,1 · 12:38');
  });

  /**
   * A `grade` carimba o rótulo do período, porque o `CHECK` recusa legenda vazia.
   * Repeti-lo escreveria "Agosto de 2026" duas vezes no mesmo ladrilho — e o
   * VoiceOver o leria duas vezes. O carimbo fica intacto; o que some é a repetição.
   */
  it('suprime a legenda que só repete o rótulo do período', () => {
    const itens = montarParede(
      acervo({
        arquivo: [mes(2026, 7)],
        capas: [capaDe({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', legenda: ' Agosto de 2026 ' })],
      }),
      { now: AGORA },
    );
    assert.equal(ladrilhos(itens)[0]?.legenda, null);
    assert.equal(ladrilhos(itens)[0]?.capa?.legenda, ' Agosto de 2026 ', 'o carimbo tem de continuar cru');
  });

  it('sem capa carimbada não há legenda', () => {
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7)] }), { now: AGORA });
    assert.equal(ladrilhos(itens)[0]?.legenda, null);
  });
});

describe('a parede e os ponteiros leem o MESMO recorte', () => {
  /**
   * O defeito que este caso existe para não deixar voltar: as duas funções
   * filtravam o acervo cada uma por conta própria, e o modo de falha era mudo —
   * no dia em que o trimestre entrasse na parede, uma desenharia o ladrilho e a
   * outra não buscaria a foto dele. Quadro cinza para sempre, suíte verde.
   *
   * O caso não olha implementação: ele monta a parede, junta os ponteiros que os
   * ladrilhos **desenhados** exigem, e compara com o que `ponteirosDaParede`
   * devolveu. Qualquer divergência de recorte quebra a igualdade.
   */
  it('todo ladrilho desenhado tem o ponteiro dele buscado — e nada além', () => {
    const a = acervo({
      arquivo: [
        mes(2026, 7), mes(2026, 6), mes(2026, 5), anuario(2025), mes(2025, 11),
        // Os que NÃO entram: semana, trimestre e um início ilegível.
        { tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09', cadernos: mes(2026, 7).cadernos },
        { tipoPeriodo: 'season', inicio: '2026-07-01', fim: '2026-09-30', cadernos: mes(2026, 7).cadernos },
        { tipoPeriodo: 'month', inicio: 'agosto', fim: '2026-08-31', cadernos: mes(2026, 7).cadernos },
      ],
      capas: [
        capaDe({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', natureza: 'foto', fotoId: 'f-1' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31', natureza: 'tracado', rotaActivityId: 'a-2' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2026-06-01', fim: '2026-06-30', natureza: 'grade' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2025-12-01', fim: '2025-12-31', natureza: 'foto', fotoId: 'f-9' }),
        // As que a parede não desenha, e que portanto não podem ser buscadas.
        capaDe({ tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09', natureza: 'foto', fotoId: 'f-semana' }),
        capaDe({ tipoPeriodo: 'season', inicio: '2026-07-01', fim: '2026-09-30', natureza: 'tracado', rotaActivityId: 'a-trimestre' }),
        capaDe({ tipoPeriodo: 'year', inicio: '2025-01-01', fim: '2025-12-31', natureza: 'foto', fotoId: 'f-ano' }),
        capaDe({ tipoPeriodo: 'month', inicio: '2020-01-01', fim: '2020-01-31', natureza: 'foto', fotoId: 'f-orfa' }),
      ],
    });
    const desenhados = ladrilhos(montarParede(a, { now: AGORA }));
    const esperado = {
      fotos: [...new Set(desenhados.filter((l) => l.capa?.natureza === 'foto').map((l) => l.capa!.fotoId!))].sort(),
      rotas: [...new Set(desenhados.filter((l) => l.capa?.natureza === 'tracado').map((l) => l.capa!.rotaActivityId!))].sort(),
    };
    assert.deepEqual(ponteirosDaParede(a), esperado);
    // E o recorte não é vazio dos dois lados por acidente.
    assert.deepEqual(esperado, { fotos: ['f-1', 'f-9'], rotas: ['a-2'] });
  });
});

describe('motivoDoVazio — por que a parede não tem nada', () => {
  it('acervo sem edição nenhuma é `sem-edicao`', () => {
    assert.equal(motivoDoVazio(acervo()), 'sem-edicao');
  });

  /**
   * Doze semanas impressas e parede vazia: dizer "nenhuma edição foi escrita
   * ainda" faria o dono concluir que a impressão não funcionou.
   */
  it('só semanas e trimestres é `sem-ladrilho` — a impressão funcionou', () => {
    const a = acervo({
      arquivo: [
        { tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09', cadernos: mes(2026, 7).cadernos },
        { tipoPeriodo: 'season', inicio: '2026-07-01', fim: '2026-09-30', cadernos: mes(2026, 7).cadernos },
      ],
    });
    assert.deepEqual(montarParede(a, { now: AGORA }), []);
    assert.equal(motivoDoVazio(a), 'sem-ladrilho');
  });
});

describe('as chaves carregam o período inteiro', () => {
  /**
   * A chave primária de `edicoes_ia` admite dois meses com o mesmo `inicio` e
   * `fim` diferente. Com a chave pelo `inicio` só, a `FlatList` desenharia uma
   * célula no lugar da outra — sem erro e sem nada vermelho.
   */
  it('duas edições com o mesmo início e fim diferente não colidem', () => {
    const curto: EdicaoNoArquivo = { ...mes(2026, 7), fim: '2026-08-15' };
    const itens = montarParede(acervo({ arquivo: [mes(2026, 7), curto] }), { now: AGORA });
    const ls = ladrilhos(itens);
    assert.equal(ls.length, 2);
    assert.equal(new Set(ls.map((l) => l.chave)).size, 2, ls.map((l) => l.chave).join(' | '));
    const chaves = itens.map((i) => i.chave);
    assert.equal(new Set(chaves).size, chaves.length, chaves.join(' | '));
  });

  it('a chave do ladrilho leva tipo, início e fim', () => {
    const l = ladrilhos(montarParede(acervo({ arquivo: [mes(2026, 7)] }), { now: AGORA }))[0]!;
    assert.equal(l.chave, 'month\u00002026-08-01\u00002026-08-31');
  });
});

describe('tirasDoAno — duas edições no mesmo mês civil', () => {
  /**
   * Uma tira tem doze células, uma por mês; duas edições no mesmo mês não cabem
   * nas duas. A que vence é a do período que **termina depois** — critério
   * escrito, porque "a última que o laço encontrar" muda com a ordem em que o
   * PostgREST devolveu as linhas.
   */
  it('vence a que termina depois, e a ordem de entrada não muda a resposta', () => {
    const cheio = mes(2025, 0, [['sono', 'sono.duracao']]);
    const curto: EdicaoNoArquivo = {
      ...mes(2025, 0, [['sono', 'sono.regularidade']]), fim: '2025-01-15',
    };
    const daFrente = tirasDoAno([cheio, curto], 2025)[0]!.celulas[0];
    const deTras = tirasDoAno([curto, cheio], 2025)[0]!.celulas[0];
    assert.deepEqual(daFrente, { estado: 'metrica', metrica: 'sono.duracao', mudou: false });
    assert.deepEqual(deTras, daFrente, 'a ordem de entrada mudou a célula');
  });
});
