/**
 * O hospedeiro da página da lua (Story 4.4) — **por valor**, que é o que a barreira
 * de texto não consegue cobrar.
 *
 * Três mutações mataram a feature com as 85 suítes verdes, e as três são a mesma
 * falha: a barreira de código-fonte prova que a **chamada existe**, nunca que o
 * **valor está certo**.
 *
 * 1. `frase: fraseColetivaDe(null)` em vez da execução lida → verde, e a linha do pé
 *    do caderno Sono imprime *"não foi lida"* para sempre, inclusive depois da
 *    primeira execução.
 * 2. Apertar o portão para `estado === 'pronto' && execucao !== null` → verde, e o pé
 *    do caderno fica **sem linha nenhuma** no único estado que o aparelho tem hoje.
 * 3. Apagar a guarda de carga **e** trocar `vereditoValePara` por `return true` →
 *    `tsc` em 0 e 85 suítes verdes, e o primeiro quadro depois de trocar de conta
 *    desenha o veredito de outra pessoa.
 *
 * O molde é `anuario.ts` + `anuario.test.ts`, e pela razão escrita lá: este workspace
 * não tem renderizador de teste, então a decisão sai do hook e vem para onde um
 * `expect` a alcança.
 */
import { describe, it, expect } from '@jest/globals';
import {
  APOIO_SEM_LEITURA,
  PHASE_ORDER,
  PROTOCOLO_LUNAR,
  ROTULO_CURTO_DA_FASE,
  fraseColetivaDe,
  fraseDaFalha,
  operacionalizacaoLunar,
  type AcervoLunar,
  type ExecucaoLunar,
  type LunarPhaseKind,
  type QuatroResultados,
  type ResultadoDaFase,
  type VereditoLunar,
  type VereditoLunarCompleto,
} from '@vitale/shared';
import {
  FIGURA_DA_LUA,
  MEDIDA_DO_CICLO,
  apoioSemResultado,
  camposDaMoldura,
  chaveDoVeredito,
  ciclosPorFase,
  dataCurta,
  entradaDaLua,
  falhaDaLeitura,
  proximoVeredito,
  vereditoInicial,
  vereditoValePara,
  vistaDoVeredito,
  type AcaoDoVeredito,
  type EstadoDoVeredito,
  type VereditoLunarNaTela,
} from '../lua';

/* ─────────────────────── Uma execução construída à mão ─────────────────────── */

/**
 * Nenhum dado lunar real entra aqui, e nenhum pode entrar: a migração não foi
 * aplicada e `vereditoLunar` não é chamado por tela nenhuma. Toda fase sai de
 * `PROTOCOLO_LUNAR`.
 */
function fase(f: LunarPhaseKind, veredito: VereditoLunar, ciclos = 17): ResultadoDaFase {
  const l = PROTOCOLO_LUNAR.find((x) => x.fase === f);
  if (l === undefined) throw new Error(`a fase ${f} não está no protocolo`);
  const indeciso = veredito === 'inconclusivo';
  return {
    fase: f,
    familia: l.familia,
    alfa: l.alfa,
    lateralidade: l.lateralidade,
    direcao: l.direcao,
    veredito,
    motivo: indeciso ? 'poder' : null,
    portaoReprovado: null,
    efeitoMin: f === 'full' ? 19 : -11,
    p: indeciso ? 0.21 : 0.014,
    zDeMannWhitney: 2.2,
    poder: indeciso ? 0.64 : 0.86,
    efeitoMinimoDetectavelMin: 17.5,
    noitesDentro: 49,
    noitesFora: 241,
    ciclos,
    falta: indeciso ? { quanto: 382, unidade: 'noites-coletaveis' } : null,
    noitesPara80: 396,
  };
}

const ACERVO: AcervoLunar = {
  noites: 502,
  noitesDistintas: 502,
  de: '2025-04-23',
  ate: '2026-09-30',
  sdMin: 45,
  origemDoEixoH: 18,
  noitesSemLuz: 0,
  primeiraNoiteSemLuz: null,
};

function vereditoCompleto(ciclosDaUltima = 17): VereditoLunarCompleto {
  const fases = PHASE_ORDER.map((f, i) => fase(
    f,
    i === 2 ? 'achado' : 'inconclusivo',
    i === 3 ? ciclosDaUltima : 17,
  )) as unknown as QuatroResultados;
  return { fases, acervo: ACERVO };
}

function execucaoLunar(veredito = vereditoCompleto()): ExecucaoLunar {
  return {
    execucaoId: 'exec-1',
    rodadaEm: '2026-10-01T18:00:00.000Z',
    cadeia: [],
    cadeiaDigest: 'f'.repeat(64),
    operacionalizacao: operacionalizacaoLunar(),
    motorVersao: 1,
    janelaVersao: 1,
    pedido: { desde: '2025-04-23', noitesColapsadas: 0 },
    veredito,
  };
}

const PRONTO_COM_EXECUCAO: VereditoLunarNaTela = {
  estado: 'pronto', execucao: execucaoLunar(), execucoes: 6,
};
/** O **quarto estado**: a tabela respondeu, e está vazia. */
const PRONTO_VAZIO: VereditoLunarNaTela = { estado: 'pronto', execucao: null, execucoes: 0 };

/* ───────── A entrada da linha: o valor, não a presença da chamada ───────── */

describe('a entrada no pé do caderno Sono carrega o veredito LIDO', () => {
  /**
   * **A mutação nº 1.** `frase: fraseColetivaDe(null)` passava em 85 suítes porque a
   * barreira cobra a chamada. Aqui o esperado sai da regra do núcleo com a execução
   * nas mãos: a igualdade é palavra por palavra, e `null` no lugar dela reprova.
   */
  it('a frase é, palavra por palavra, a da regra do núcleo sobre a execução lida', () => {
    const execucao = execucaoLunar();
    const entrada = entradaDaLua({ estado: 'pronto', execucao, execucoes: 6 }, 'set 2026');
    expect(entrada).toEqual({ frase: fraseColetivaDe(execucao.veredito), periodo: 'set 2026' });
    // E ela não é a do quarto estado — que é exactamente o que a mutação produzia.
    expect(entrada?.frase).not.toEqual(fraseColetivaDe(null));
    expect(entrada?.frase.cheia.placar).toBe('A cheia decidiu.');
  });

  /**
   * **A mutação nº 2.** Apertar o portão para `execucao !== null` deixava o pé do
   * caderno sem linha nenhuma no único estado que o aparelho tem hoje: a tabela
   * respondeu, e está vazia.
   */
  it('o quarto estado PRODUZ entrada — tabela vazia é resposta, não ausência', () => {
    const entrada = entradaDaLua(PRONTO_VAZIO, 'ago 2026');
    expect(entrada).toEqual({ frase: fraseColetivaDe(null), periodo: 'ago 2026' });
    expect(entrada?.frase.cheia.placar).toBe('A cheia não foi lida.');
  });

  /**
   * **Tabela ausente não é tabela vazia.** Hoje a migração não foi aplicada, as duas
   * leituras lançam, e com a linha desenhando só no `pronto` a feature era invisível
   * em produção: `/sono/lua` ficava inalcançável, porque a única porta dela é esta
   * linha.
   */
  it('a falha de leitura também produz entrada, e com a frase da causa', () => {
    for (const causa of ['rede', 'integridade'] as const) {
      const entrada = entradaDaLua({ estado: 'falhou', causa, recado: null }, 'set 2026');
      expect(entrada).toEqual({ frase: fraseDaFalha(causa), periodo: 'set 2026' });
      expect(entrada?.frase).not.toEqual(fraseColetivaDe(null));
    }
    expect(entradaDaLua({ estado: 'falhou', causa: 'rede', recado: null }, '')?.frase)
      .not.toEqual(entradaDaLua({ estado: 'falhou', causa: 'integridade', recado: null }, '')?.frase);
  });

  /** E carregando não afirma nada: desenhar aqui seria afirmar silêncio antes de saber. */
  it('carregando e sem sessão não produzem entrada', () => {
    expect(entradaDaLua({ estado: 'carregando' }, 'set 2026')).toBeUndefined();
    expect(entradaDaLua({ estado: 'sem-sessao' }, 'set 2026')).toBeUndefined();
  });

  /** As duas linhas, nos dois casos — a invariante de forma da emenda à ADR 0045. */
  it('a entrada tem sempre as duas famílias, com os dois compartimentos', () => {
    for (const v of [PRONTO_COM_EXECUCAO, PRONTO_VAZIO] as const) {
      const frase = entradaDaLua(v, '')?.frase;
      expect(frase?.linhas).toHaveLength(2);
      for (const l of frase?.linhas ?? []) {
        expect(l.placar.length).toBeGreaterThan(0);
        expect(l.porque.length).toBeGreaterThan(0);
        // A leitura do leitor de tela não gagueja: o rótulo entra uma vez só.
        expect(l.leitura.startsWith(`${l.rotulo}. ${l.rotulo}`)).toBe(false);
      }
    }
  });
});

describe('a linha de apoio do bloco sem resultado muda com o estado', () => {
  /**
   * *"A primeira execução autorizada ainda não rodou"* é verdade no quarto estado e
   * **falsa** enquanto a leitura está em voo ou depois de falhar — e a moldura desenha
   * nos cinco estados.
   */
  it('o quarto estado diz que não rodou; os outros, não', () => {
    expect(apoioSemResultado(PRONTO_VAZIO)).toBe(APOIO_SEM_LEITURA);
    for (const v of [
      { estado: 'carregando' } as const,
      { estado: 'sem-sessao' } as const,
      { estado: 'falhou', causa: 'rede', recado: null } as const,
    ]) {
      expect(apoioSemResultado(v)).not.toBe(APOIO_SEM_LEITURA);
      expect(apoioSemResultado(v)).not.toMatch(/ainda não rodou/);
      expect(apoioSemResultado(v).length).toBeGreaterThan(0);
    }
  });

  it('os quatro textos são distintos entre si', () => {
    const vistos = new Set([
      apoioSemResultado(PRONTO_VAZIO),
      apoioSemResultado({ estado: 'carregando' }),
      apoioSemResultado({ estado: 'sem-sessao' }),
      apoioSemResultado({ estado: 'falhou', causa: 'rede', recado: null }),
    ]);
    expect(vistos.size).toBe(4);
  });
});

/* ───────────── A causa da falha: rede e integridade são duas coisas ───────────── */

describe('falhaDaLeitura separa rede de integridade', () => {
  /**
   * A recusa do núcleo **chegou com a resposta** e diz o que consertar; ela sobe para
   * a tela em vez de morrer num `console.warn`. O erro do PostgREST não descreve nada
   * que o leitor possa fazer.
   */
  it('a recusa do núcleo é integridade, e o recado dela sobe', () => {
    const e = new Error('lua_execucoes: uma execução tem 4 linhas, uma por fase, e chegaram 3. …');
    expect(falhaDaLeitura(e)).toEqual({ causa: 'integridade', recado: e.message });
  });

  it('o erro do PostgREST é rede, e não carrega recado acionável', () => {
    // É isto que `if (error) throw error` relança: um objeto, nem Error.
    const postgrest = { message: 'relation "public.lua_execucoes" does not exist', code: '42P01' };
    expect(falhaDaLeitura(postgrest)).toEqual({ causa: 'rede', recado: null });
    expect(falhaDaLeitura(new TypeError('Network request failed')).causa).toBe('rede');
    expect(falhaDaLeitura(undefined).causa).toBe('rede');
  });

  /** Um Error qualquer não vira integridade só por ser Error. */
  it('só o prefixo do núcleo marca integridade', () => {
    expect(falhaDaLeitura(new Error('deu errado')).causa).toBe('rede');
  });
});

/* ───────────────────── As transições, e as duas guardas ───────────────────── */

const DELE = chaveDoVeredito('dono-1');
const DE_OUTRO = chaveDoVeredito('dono-2');

function apos(acoes: readonly AcaoDoVeredito[]): EstadoDoVeredito {
  return acoes.reduce(proximoVeredito, vereditoInicial());
}

describe('o veredito começa sem saber', () => {
  it('o estado inicial é `carregando`, e nunca "não rodou"', () => {
    expect(vereditoInicial()).toEqual({
      fase: 'carregando', carga: 0, chave: chaveDoVeredito(null),
    });
  });

  it('`carregando`, o quarto estado e a falha são fases distintas', () => {
    const emVoo = apos([{ tipo: 'ler', carga: 1, chave: DELE }]);
    const vazio = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'execucao', carga: 1, execucao: null, execucoes: 0 },
    ]);
    const falhou = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'falhou', carga: 1, causa: 'rede', recado: null },
    ]);
    const semSessao = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'sem-sessao', carga: 1 },
    ]);
    expect([emVoo.fase, vazio.fase, falhou.fase, semSessao.fase])
      .toEqual(['carregando', 'pronto', 'falhou', 'sem-sessao']);
    expect(new Set([emVoo.fase, vazio.fase, falhou.fase, semSessao.fase]).size).toBe(4);
  });

  it('a execução que chega vira a fase pronta, com o contador', () => {
    const execucao = execucaoLunar();
    expect(apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'execucao', carga: 1, execucao, execucoes: 6 },
    ])).toEqual({ fase: 'pronto', execucao, execucoes: 6, carga: 1, chave: DELE });
  });

  it('a falha guarda a causa e o recado', () => {
    expect(apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'falhou', carga: 1, causa: 'integridade', recado: 'lua_execucoes: …' },
    ])).toEqual({
      fase: 'falhou', causa: 'integridade', recado: 'lua_execucoes: …', carga: 1, chave: DELE,
    });
  });
});

/**
 * **A guarda da carga, nas duas direções** — a primeira das duas que o revisor apagou
 * sem a suíte reclamar.
 */
describe('a guarda da carga superada', () => {
  it('a resposta de uma carga superada é ignorada', () => {
    const estado = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'ler', carga: 2, chave: DE_OUTRO },
      { tipo: 'execucao', carga: 1, execucao: execucaoLunar(), execucoes: 6 },
    ]);
    expect(estado).toEqual({ fase: 'carregando', carga: 2, chave: DE_OUTRO });
  });

  it('a falha de uma carga superada também é ignorada', () => {
    const execucao = execucaoLunar();
    expect(apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'ler', carga: 2, chave: DELE },
      { tipo: 'execucao', carga: 2, execucao, execucoes: 6 },
      { tipo: 'falhou', carga: 1, causa: 'rede', recado: null },
    ])).toEqual({ fase: 'pronto', execucao, execucoes: 6, carga: 2, chave: DELE });
  });

  /** A prova de que a guarda morde na direção certa: a carga em dia passa. */
  it('a resposta da carga em curso passa', () => {
    expect(apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'ler', carga: 2, chave: DELE },
      { tipo: 'execucao', carga: 2, execucao: null, execucoes: 0 },
    ]).fase).toBe('pronto');
  });

  it('uma leitura nova apaga a execução anterior — ela é de outro dono', () => {
    expect(apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'execucao', carga: 1, execucao: execucaoLunar(), execucoes: 6 },
      { tipo: 'ler', carga: 2, chave: DE_OUTRO },
    ])).toEqual({ fase: 'carregando', carga: 2, chave: DE_OUTRO });
  });
});

/**
 * **A chave** — a segunda guarda. O efeito que dispara a releitura roda **depois** do
 * render: na troca de conta, o primeiro quadro ainda tem o estado da leitura anterior,
 * e desenhá-lo é mostrar o veredito de outra pessoa.
 */
describe('a chave — de quem é o veredito que está na tela', () => {
  const pronto = (chave: string) => apos([
    { tipo: 'ler', carga: 1, chave },
    { tipo: 'execucao', carga: 1, execucao: execucaoLunar(), execucoes: 6 },
  ]);

  it('o estado do dono anterior não vale para o dono novo', () => {
    expect(vereditoValePara(pronto(DELE), DE_OUTRO)).toBe(false);
  });

  it('para a própria chave, vale', () => {
    expect(vereditoValePara(pronto(DELE), DELE)).toBe(true);
  });

  it('a chave separa o que parece igual', () => {
    expect(chaveDoVeredito(undefined)).toBe(chaveDoVeredito(null));
    expect(chaveDoVeredito('')).toBe(chaveDoVeredito(null));
    expect(chaveDoVeredito('dono-1')).not.toBe(chaveDoVeredito('dono-11'));
  });

  /**
   * E a vista obedece à chave: com `vereditoValePara` trocado por `return true`, esta
   * asserção é a que reprova — o quadro de atraso desenha o veredito do dono anterior.
   */
  it('a vista de um estado de outra conta é `carregando`, nunca o veredito dele', () => {
    expect(vistaDoVeredito(pronto(DELE), DE_OUTRO)).toEqual({ estado: 'carregando' });
    const vista = vistaDoVeredito(pronto(DELE), DELE);
    expect(vista.estado).toBe('pronto');
    expect(vista.estado === 'pronto' ? vista.execucoes : null).toBe(6);
  });

  it('a vista traduz as quatro fases sem perder a causa da falha', () => {
    const falhou = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'falhou', carga: 1, causa: 'integridade', recado: 'lua_execucoes: x' },
    ]);
    expect(vistaDoVeredito(falhou, DELE))
      .toEqual({ estado: 'falhou', causa: 'integridade', recado: 'lua_execucoes: x' });
    const semSessao = apos([
      { tipo: 'ler', carga: 1, chave: DELE },
      { tipo: 'sem-sessao', carga: 1 },
    ]);
    expect(vistaDoVeredito(semSessao, DELE)).toEqual({ estado: 'sem-sessao' });
  });
});

/* ─────────────────────── A moldura: os cinco campos ─────────────────────── */

describe('camposDaMoldura — cinco campos, nos dois lados da execução', () => {
  const rotulos = (c: readonly { rotulo: string }[]) => c.map((x) => x.rotulo);

  it('são cinco, e os três invariáveis são os mesmos com e sem execução', () => {
    const vazio = camposDaMoldura(null, 0);
    const cheio = camposDaMoldura(execucaoLunar(), 6);
    expect(vazio).toHaveLength(5);
    expect(cheio).toHaveLength(5);
    expect(rotulos(vazio).slice(0, 2)).toEqual(['Janela testada', 'Desfecho']);
    expect(rotulos(cheio).slice(0, 2)).toEqual(['Janela testada', 'Desfecho']);
    expect(rotulos(vazio)[4]).toBe('Execuções');
  });

  /** **Nenhum número fabricado**: sem execução não há contagem de noites nem de ciclos. */
  it('sem execução, Noites e ciclos diz o protocolo e Primeira leitura diz a condição', () => {
    const campos = camposDaMoldura(null, 0);
    expect(rotulos(campos)[2]).toBe('Noites e ciclos');
    expect(campos[2].valor).toBe('o acervo desde 23 abr 2025');
    expect(campos[2].sub).toContain('os portões pedem 5 noites em cada coluna e 10 ciclos sinódicos');
    expect(rotulos(campos)[3]).toBe('Primeira leitura');
    expect(campos[3].valor).toBe('quando a primeira execução autorizada rodar');
    expect(campos[4].valor).toBe('nenhuma execução');
    // Nenhuma contagem de noites inventada no estado em que ninguém mediu nada.
    expect(campos[2].valor).not.toMatch(/\d+ noites no acervo/);
  });

  it('com execução, os números são os do acervo e a leitura passa a ser a próxima', () => {
    const campos = camposDaMoldura(execucaoLunar(), 6);
    expect(campos[2].valor).toBe('502 noites no acervo');
    expect(campos[2].sub).toBe('17 ciclos sinódicos por fase · 23 abr 2025 → 30 set 2026');
    expect(rotulos(campos)[3]).toBe('Próxima leitura');
    expect(campos[3].valor).toBe('a cada +100 noites');
    expect(campos[4].valor).toBe('6ª execução');
  });

  /** A janela sai da operacionalização **medida**, e aparece no valor e no sub. */
  it('a janela testada sai da operacionalização, nos dois compartimentos', () => {
    const op = operacionalizacaoLunar();
    const campo = camposDaMoldura(null, 0)[0];
    expect(campo.valor).toBe(`${String(op.janelaNoites)} noites antes de cada fase`);
    expect(campo.sub).toContain(`[fase − ${String(op.janelaNoites)} d, fase`);
    expect(campo.sub).toContain(op.bordaDireita === 'aberta' ? ')' : ']');
  });
});

/**
 * **O `- 1` do índice do mês.** Perdê-lo imprime *"23 mai 2025"* para abril, e nada
 * muda de cor — é o defeito que um `toContain` sobre texto-fonte nunca veria.
 */
describe('dataCurta — sem Date, e com o mês certo', () => {
  it('traduz o ISO para dia, mês abreviado e ano', () => {
    expect(dataCurta('2025-04-23')).toBe('23 abr 2025');
    expect(dataCurta('2026-01-01')).toBe('01 jan 2026');
    expect(dataCurta('2026-12-31')).toBe('31 dez 2026');
  });

  it('os doze meses saem na ordem, e nenhum desloca', () => {
    const meses = Array.from({ length: 12 }, (_, i) => dataCurta(`2026-${String(i + 1).padStart(2, '0')}-15`));
    expect(meses).toEqual([
      '15 jan 2026', '15 fev 2026', '15 mar 2026', '15 abr 2026', '15 mai 2026', '15 jun 2026',
      '15 jul 2026', '15 ago 2026', '15 set 2026', '15 out 2026', '15 nov 2026', '15 dez 2026',
    ]);
  });

  it('sem data é travessão, e uma data torta sai como veio', () => {
    expect(dataCurta(null)).toBe('—');
    expect(dataCurta('2026-13-01')).toBe('2026-13-01');
  });
});

describe('ciclosPorFase — um número quando concordam, o intervalo quando não', () => {
  it('as quatro com o mesmo número dão um número', () => {
    expect(ciclosPorFase(vereditoCompleto().fases)).toBe('17 ciclos sinódicos por fase');
  });

  /** Um número só sobre quatro janelas diferentes seria média disfarçada de contagem. */
  it('discordando, sai o intervalo', () => {
    expect(ciclosPorFase(vereditoCompleto(12).fases)).toBe('12 a 17 ciclos sinódicos por fase');
  });
});

/* ─────────────────────── A geometria da figura ─────────────────────── */

describe('FIGURA_DA_LUA — a geometria por valor', () => {
  it('as quatro janelas, na ordem do protocolo, com o rótulo do núcleo', () => {
    expect(FIGURA_DA_LUA.janelas.map((j) => j.fase)).toEqual([...PHASE_ORDER]);
    expect(FIGURA_DA_LUA.janelas.map((j) => j.rotulo))
      .toEqual(PHASE_ORDER.map((f) => ROTULO_CURTO_DA_FASE[f]));
  });

  /** As cinco noites saem do protocolo, não de um cinco digitado ao lado dele. */
  it('a janela tem as noites do protocolo, e a banda tem a largura delas', () => {
    const passo = FIGURA_DA_LUA.largura / FIGURA_DA_LUA.celulas;
    for (const j of FIGURA_DA_LUA.janelas) {
      expect(j.largura).toBeCloseTo(FIGURA_DA_LUA.janelaNoites * passo, 6);
      // O instante da fase cai **fora** da janela, à direita dela: a exposição é antes.
      expect(j.x).toBeGreaterThan(j.de + j.largura - passo);
      expect(j.de).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * **Cada janela marca exatamente cinco discos** — é a propriedade que o desenho tem
   * de preservar: *os discos marcados são as noites testadas*. Trocar o `<` por `<=`
   * no corte marca seis em alguma, e nada reclama na tela.
   */
  it('cada janela marca cinco discos, e vinte dos trinta caem dentro', () => {
    expect(FIGURA_DA_LUA.discos).toHaveLength(FIGURA_DA_LUA.celulas);
    expect(FIGURA_DA_LUA.naJanela).toBe(FIGURA_DA_LUA.janelaNoites * PHASE_ORDER.length);
    expect(FIGURA_DA_LUA.discos.filter((d) => d.naJanela)).toHaveLength(FIGURA_DA_LUA.naJanela);
    expect(FIGURA_DA_LUA.celulas - FIGURA_DA_LUA.naJanela).toBe(10);
  });

  it('a iluminação vai de nova a cheia e volta, sem sair de [0, 1]', () => {
    for (const d of FIGURA_DA_LUA.discos) {
      expect(d.illuminated).toBeGreaterThanOrEqual(0);
      expect(d.illuminated).toBeLessThanOrEqual(1);
    }
    // O disco da lua nova é o mais escuro, e o da cheia o mais claro.
    const claros = FIGURA_DA_LUA.discos.map((d) => d.illuminated);
    expect(Math.min(...claros)).toBeLessThan(0.01);
    expect(Math.max(...claros)).toBeGreaterThan(0.99);
  });

  /**
   * **A oração que reconcilia os três números.** A legenda entregava 30, 20 e 68% e
   * deixava com o leitor a conta que explica por que dois deles não fecham.
   */
  it('a medida do ciclo traz os três números e a conta que os reconcilia', () => {
    expect(MEDIDA_DO_CICLO).toContain('30 noites desenhadas');
    expect(MEDIDA_DO_CICLO).toContain('29,53');
    expect(MEDIDA_DO_CICLO).toContain('20 delas');
    expect(MEDIDA_DO_CICLO).toContain('20/30 = 67%');
    expect(MEDIDA_DO_CICLO).toContain('68%');
    expect(MEDIDA_DO_CICLO).toContain('20 / 29,53');
  });

  it('a figura é congelada: ela é dado compartilhado, não folha de desenho', () => {
    expect(Object.isFrozen(FIGURA_DA_LUA)).toBe(true);
    expect(Object.isFrozen(FIGURA_DA_LUA.janelas)).toBe(true);
    expect(Object.isFrozen(FIGURA_DA_LUA.discos)).toBe(true);
  });
});
