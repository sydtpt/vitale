/**
 * O retrato da última corrida da bancada — a montagem, que é pura.
 *
 * Mora aqui e não num teste de tela porque é só isto: entra o que a corrida produziu, sai o
 * objeto e o texto JSON. A escrita em disco (`motores/arquivo.ts`) não é exercitada — ela é
 * um `try`, um `write` e uma nota, e mockear o `expo-file-system` provaria o mock.
 *
 * O que estes casos protegem é o que o dono não consegue ver na tela e lê no arquivo: o
 * desfecho, o tempo, os tokens, o hash, a régua ao lado do texto do motor, o texto cru, os
 * problemas — e, na amostra, o resumo por motor com a mesma grafia do cartão.
 */
import { describe, it, expect } from '@jest/globals';
import { SEM_MODELO, type LinhaDoRelatorio, type MotorId } from '@vitale/shared';
import type { ContextoDaAmostra, CorridaMedida } from '../motores/amostra';
import type { Linha } from '../motores/amostras';
import {
  CAMINHO_NO_CONTAINER,
  NOME_DO_ARQUIVO,
  VERSAO_DO_ARQUIVO,
  emJson,
  retratoDaAmostra,
  retratoDeUmaJanela,
  valeGuardar,
} from '../motores/arquivo-regras';

const QWEN = 'aparelho:coreai:qwen3-1.7b' as MotorId;
const TUCANO = 'aparelho:coreai:tucano2' as MotorId;
const EM = new Date('2026-09-25T18:04:11.742Z');

const NOMES: Readonly<Record<string, string>> = {
  [SEM_MODELO]: 'sem modelo',
  [QWEN]: 'Qwen3 1.7B',
  [TUCANO]: 'Tucano2',
};
const nomeDe = (m: MotorId): string => NOMES[m] ?? m;

const TEMPLATE = 'Dormiu 7h12 nas últimas sete noites, com uma noite curta.';

/** A régua: a coluna sem modelo, que não é tentativa. */
const REGUA: Linha = { motor: SEM_MODELO as MotorId, desfecho: 'template', ms: 0, frase: TEMPLATE };

/** Uma coluna de motor com tudo o que o cartão mostra. */
const COLUNA_OK: Linha = {
  motor: QWEN,
  desfecho: 'ok',
  ms: 9812,
  hash: 'a'.repeat(64),
  frase: 'A semana teve sono estável, com um tropeço na quinta.',
  cru: 'A semana teve sono estável, com um tropeço na {dia_curto}.',
  tokens: { entrada: 812, saida: 41 },
  provedor: 'coreai',
  modelo: 'Qwen3 1.7B Q4',
};

const COLUNA_REPROVADA: Linha = {
  motor: TUCANO,
  desfecho: 'reprovada',
  ms: 7104,
  hash: 'b'.repeat(64),
  cru: 'Você deveria dormir mais cedo para melhorar seu descanso.',
  problemas: [{ regra: 'aconselha', detalhe: 'a frase manda o dono fazer algo' }],
  detalhe: 'reprovada na conferência',
  motivo: 'o motor aconselhou',
};

function janela(o: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: '7d',
    offset: 0,
    alcance: 'noite',
    caso: 'boa',
    hashDoPedido: 'c'.repeat(64),
    desfecho: 'ok',
    ms: 9500,
    template: TEMPLATE,
    frase: 'Uma frase aprovada.',
    textoDoMotor: 'Uma frase aprovada.',
    ...o,
  } as LinhaDoRelatorio;
}

const CONTEXTO: ContextoDaAmostra = {
  hoje: '2026-09-25',
  limite: 2,
  noites: 295,
  notasDesde: '2026-01-01',
  maisAntiga: '2025-12-04',
  passos: [
    { range: '7d', passos: 4 },
    { range: '4s', passos: 3 },
  ],
  enumeradas: 61,
  janelas: 22,
};

function corrida(o: Partial<CorridaMedida> & { motor: MotorId }): CorridaMedida {
  return {
    linhas: [janela()],
    parcial: false,
    inicio: EM.getTime() - 300_000,
    fim: EM.getTime(),
    ...o,
  };
}

describe('o endereço do arquivo', () => {
  it('é um nome fixo em Documents/ — é por ele que o devicectl o acha', () => {
    expect(NOME_DO_ARQUIVO).toBe('bancada-ultima-corrida.json');
    expect(CAMINHO_NO_CONTAINER).toBe('Documents/bancada-ultima-corrida.json');
  });

  it('não carrega data nem hash: o caminho tem de ser previsível sem listar o diretório', () => {
    expect(NOME_DO_ARQUIVO).not.toMatch(/\d/);
  });
});

describe('o retrato de uma janela', () => {
  const retrato = retratoDeUmaJanela({
    em: EM,
    leitura: 'saude-do-sono',
    caso: { chave: '7d|0', rotulo: '7 dias · esta janela' },
    linhas: [REGUA, COLUNA_OK, COLUNA_REPROVADA],
    nomeDe,
  });

  it('carimba a versão, o instante, a leitura e o caso', () => {
    expect(retrato.versao).toBe(VERSAO_DO_ARQUIVO);
    expect(retrato.tipo).toBe('uma-janela');
    expect(retrato.em).toBe('2026-09-25T18:04:11.742Z');
    expect(retrato.leitura).toBe('saude-do-sono');
    expect(retrato.caso).toEqual({ chave: '7d|0', rotulo: '7 dias · esta janela' });
  });

  it('diz quais motores entraram, com id e nome', () => {
    expect(retrato.motores).toEqual([
      { id: SEM_MODELO, nome: 'sem modelo' },
      { id: QWEN, nome: 'Qwen3 1.7B' },
      { id: TUCANO, nome: 'Tucano2' },
    ]);
  });

  it('guarda por motor o desfecho, o tempo, os tokens, o hash, o cru e a frase', () => {
    const c = retrato.colunas.find((x) => x.motor === QWEN)!;
    expect(c.desfecho).toBe('ok');
    expect(c.ms).toBe(9812);
    expect(c.tokens).toEqual({ entrada: 812, saida: 41 });
    expect(c.hash).toBe('a'.repeat(64));
    expect(c.frase).toBe(COLUNA_OK.frase);
    expect(c.cru).toBe(COLUNA_OK.cru);
    expect(c.provedor).toBe('coreai');
    expect(c.modelo).toBe('Qwen3 1.7B Q4');
    expect(c.nome).toBe('Qwen3 1.7B');
  });

  it('guarda os problemas da coluna reprovada', () => {
    const c = retrato.colunas.find((x) => x.motor === TUCANO)!;
    expect(c.problemas).toEqual([{ regra: 'aconselha', detalhe: 'a frase manda o dono fazer algo' }]);
    expect(c.motivo).toBe('o motor aconselhou');
  });

  it('repete a régua dentro de cada coluna de motor, e não na do próprio template', () => {
    expect(retrato.colunas.find((x) => x.motor === QWEN)!.template).toBe(TEMPLATE);
    expect(retrato.colunas.find((x) => x.motor === TUCANO)!.template).toBe(TEMPLATE);
    // No bloco da régua ela é a linha: repeti-la ali seria a mesma frase duas vezes.
    expect(retrato.colunas.find((x) => x.motor === SEM_MODELO)).not.toHaveProperty('template');
  });

  it('sem régua na corrida, nenhuma coluna ganha template inventado', () => {
    const semRegua = retratoDeUmaJanela({
      em: EM,
      leitura: 'nome-de-rota',
      caso: { chave: 'a1', rotulo: '14/09 · Ittre' },
      linhas: [COLUNA_OK],
      nomeDe,
    });
    expect(semRegua.colunas[0]).not.toHaveProperty('template');
  });
});

describe('o retrato da amostra', () => {
  const inicio = EM.getTime() - 1_800_000;
  const fim = EM.getTime();
  const corridas: readonly CorridaMedida[] = [
    corrida({
      motor: QWEN,
      linhas: [janela(), janela({ offset: 1, desfecho: 'reprovada', frase: undefined, problemas: [{ regra: 'aconselha', detalhe: 'x' }] })],
    }),
    corrida({ motor: TUCANO, linhas: [janela()], parcial: true, motivo: 'três seguidas do hospedeiro' }),
  ];
  const retrato = retratoDaAmostra({ em: EM, leitura: 'saude-do-sono', contexto: CONTEXTO, corridas, inicio, fim, nomeDe });

  it('guarda o contexto uma vez — a amostra é preparada uma vez e serve a todas', () => {
    expect(retrato.contexto).toEqual(CONTEXTO);
    expect(retrato.duracaoMs).toBe(1_800_000);
  });

  it('traz o resumo por motor: taxa, mediana e idênticas ao template', () => {
    const q = retrato.corridas.find((c) => c.motor === QWEN)!;
    expect(q.resumo.motor).toBe(QWEN);
    expect(q.resumo.janelas).toBe(2);
    expect(q.resumo.aprovadas).toBe(1);
    expect(q.resumo.aprovacao).toMatch(/%$/);
    expect(typeof q.resumo.identicasAoTemplate).toBe('number');
    expect(q.resumo.medianaMs).toBe(9500);
  });

  it('escreve a linha de comparação com o nome do motor — a mesma do cartão', () => {
    const q = retrato.corridas.find((c) => c.motor === QWEN)!;
    expect(q.resumoEmTexto).toContain('Qwen3 1.7B');
    expect(q.resumoEmTexto).toContain(q.resumo.aprovacao);
  });

  it('guarda cada janela inteira, com hash, template e texto do motor', () => {
    const q = retrato.corridas.find((c) => c.motor === QWEN)!;
    expect(q.janelas).toHaveLength(2);
    expect(q.janelas[0]!.hashDoPedido).toBe('c'.repeat(64));
    expect(q.janelas[0]!.template).toBe(TEMPLATE);
    expect(q.janelas[1]!.problemas).toEqual([{ regra: 'aconselha', detalhe: 'x' }]);
  });

  it('marca a corrida parcial e o motivo dela', () => {
    const t = retrato.corridas.find((c) => c.motor === TUCANO)!;
    expect(t.parcial).toBe(true);
    expect(t.motivo).toBe('três seguidas do hospedeiro');
  });

  it('acusa quando as corridas não mediram as mesmas janelas', () => {
    // Qwen mediu duas, Tucano uma: as taxas não se comparam, e o arquivo diz isso.
    expect(retrato.divergencia).toContain('não mediram as mesmas janelas');
  });

  it('não acusa divergência quando as janelas coincidem', () => {
    const iguais = retratoDaAmostra({
      em: EM,
      leitura: 'saude-do-sono',
      contexto: CONTEXTO,
      corridas: [corrida({ motor: QWEN }), corrida({ motor: TUCANO })],
      inicio,
      fim,
      nomeDe,
    });
    expect(iguais.divergencia).toBeNull();
  });

  it('a corrida que não aconteceu entra com o motivo, e não desaparece', () => {
    const recusada = retratoDaAmostra({
      em: EM,
      leitura: 'saude-do-sono',
      contexto: CONTEXTO,
      corridas: [corrida({ motor: TUCANO, linhas: [], recusa: 'o compilado sumiu' })],
      inicio,
      fim,
      nomeDe,
    });
    expect(recusada.corridas[0]!.recusa).toBe('o compilado sumiu');
    expect(recusada.corridas[0]!.janelas).toEqual([]);
  });

  it('escreve os instantes de cada corrida em ISO, não em milissegundos crus', () => {
    expect(retrato.corridas[0]!.inicio).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(retrato.corridas[0]!.fim).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(retrato.corridas[0]!.duracaoMs).toBe(300_000);
  });
});

describe('o texto que vai para o arquivo', () => {
  const retrato = retratoDeUmaJanela({
    em: EM,
    leitura: 'saude-do-sono',
    caso: { chave: '7d|0', rotulo: '7 dias' },
    linhas: [REGUA, COLUNA_OK],
    nomeDe,
  });

  it('é JSON válido e volta igual ao retrato', () => {
    expect(JSON.parse(emJson(retrato))).toEqual(JSON.parse(JSON.stringify(retrato)));
  });

  it('é indentado e termina em nova linha — o primeiro leitor é um `cat`', () => {
    const texto = emJson(retrato);
    expect(texto).toContain('\n  "versao": 1');
    expect(texto.endsWith('}\n')).toBe(true);
  });
});

describe('vale guardar?', () => {
  it('uma corrida sem coluna nenhuma não substitui a anterior', () => {
    expect(
      valeGuardar(
        retratoDeUmaJanela({ em: EM, leitura: 'saude-do-sono', caso: { chave: 'a', rotulo: 'a' }, linhas: [], nomeDe }),
      ),
    ).toBe(false);
  });

  it('uma amostra sem corrida nenhuma também não', () => {
    expect(
      valeGuardar(
        retratoDaAmostra({
          em: EM,
          leitura: 'saude-do-sono',
          contexto: CONTEXTO,
          corridas: [],
          inicio: 0,
          fim: 1,
          nomeDe,
        }),
      ),
    ).toBe(false);
  });

  it('uma corrida com coluna, sim — inclusive a que só mediu uma', () => {
    expect(
      valeGuardar(
        retratoDeUmaJanela({ em: EM, leitura: 'saude-do-sono', caso: { chave: 'a', rotulo: 'a' }, linhas: [REGUA], nomeDe }),
      ),
    ).toBe(true);
  });
});
