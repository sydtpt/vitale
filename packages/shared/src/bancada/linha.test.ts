import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import { APARELHO_SISTEMA, SEM_MODELO, type MotorId } from '../ia/fio';
import { hashDoPedido, type Falha, type Motor, type Resposta } from '../ia/motor';
import { ler, type EventoDoAnel, type Medicao } from '../ia/orquestrar';
import { descritorDaSaudeDoSono as D, entradaDaSaude, templateDaSaude } from '../sleep/leitura';
import { amostraDaNuvem, chaveDoPasso, enumerarJanelas, type JanelaClassificada } from './amostra';
import {
  SEM_PEDIDO,
  defeitoDe,
  hashDaMedicao,
  linhaDaMedicao,
  linhaDoDefeito,
  marcasDoHospedeiro,
  templateDaMedicao,
  type LinhaDoRelatorio,
} from './linha';

/**
 * A medição virando linha — a tradução que o Mac e o iPhone fazem pela mesma função
 * (story 5.13).
 *
 * O que só este arquivo prova: **o iPhone chega ao mesmo hash que o Mac sem montar o
 * pedido.** O Mac o tira do corpo que monta para o relatório (`montarPedido`, que a
 * catraca só permite a ele); o app o lê da própria medição (`hashDaMedicao`). Se os dois
 * divergissem, a comparação por hash da AD-11 compararia pedidos diferentes sem ninguém
 * ver.
 *
 * Acervo sintético (AD-8). O motor "bom" devolve a frase do template daquela janela, com
 * os marcadores: passa na conferência por construção.
 */

const BXL = 120;

function noite(wakeDay: string, onsetH: number, durH: number): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + durH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: [],
    stages: null,
    stageSegments: null,
  };
}

function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOJE = '2026-09-10';
const NOITES: SleepPeriod[] = [];
const NOTAS: Record<string, number> = {};
for (let i = 0; i < 80; i += 1) {
  const dia = mais('2026-06-23', i);
  if (i % 9 === 4 || (i > 30 && i < 38)) continue;
  NOITES.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7));
  if (i % 3 !== 0) NOTAS[dia] = 1 + (i % 5);
}
const AMOSTRA = amostraDaNuvem(enumerarJanelas(NOITES, NOTAS, HOJE));
const entrada = (j: JanelaClassificada) => entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });

/** Um relógio que anda 100 ms por leitura: o `ms` de cada tentativa sai dele. */
function relogio(): () => Date {
  let t = Date.UTC(2026, 8, 19, 9, 0, 0);
  return () => {
    const d = new Date(t);
    t += 100;
    return d;
  };
}

function resposta(texto: string): Resposta {
  return {
    texto,
    assinatura: { tipo: 'aparelho', provedor: 'prov-a', modelo: 'AFM 3 Core Advanced', plataforma: 'iOS 27.0', buildDoSistema: '27A1' },
    tokens: { entrada: 300, saida: 20 },
  };
}

/** Uma janela medida como a tela do iPhone a mede: a régua pelo piso, e o motor em `medicao`. */
async function comoOIphone(j: JanelaClassificada, motor: Motor | undefined): Promise<LinhaDoRelatorio> {
  const e = entrada(j);
  const agora = relogio();
  const motorPara = (id: MotorId): Motor | undefined => (id === APARELHO_SISTEMA ? motor : undefined);
  const regua = await ler(D, e, { modo: 'medicao', motor: SEM_MODELO, motorPara, registrar: () => undefined, agora });
  let anel: EventoDoAnel | null = null;
  const m = await ler(D, e, {
    modo: 'medicao',
    motor: APARELHO_SISTEMA,
    motorPara,
    registrar: (ev) => {
      anel = ev;
    },
    agora,
  });
  return linhaDaMedicao(j, hashDaMedicao(m), templateDaMedicao(regua), m, anel);
}

describe('o hash: o iPhone lê da medição o mesmo que o Mac monta', () => {
  it('em toda janela da amostra, hashDaMedicao é o hashDoPedido do pedido que o Mac monta', async () => {
    const bom: Motor = async (p) => resposta(p.usuario.length > 0 ? 'x' : 'y');
    let comPedido = 0;
    for (const j of AMOSTRA) {
      const e = entrada(j);
      const pedido = D.montarPedido(e);
      const doMac = pedido ? hashDoPedido(pedido, D.versao) : SEM_PEDIDO;
      const linha = await comoOIphone(j, bom);
      assert.equal(linha.hashDoPedido, doMac, chaveDoPasso(j));
      if (pedido) comPedido += 1;
    }
    assert.ok(comPedido > 0, 'nenhuma janela da amostra montou pedido — o teste não prova nada');
  });

  it('a medição sem pedido (e o piso) não inventa hash: é o sentinela', () => {
    const muda: Medicao<string> = { tipo: 'mudo', motor: APARELHO_SISTEMA };
    const piso: Medicao<string> = { tipo: 'template', motor: SEM_MODELO, frase: 'o piso' };
    assert.equal(hashDaMedicao(muda), SEM_PEDIDO);
    assert.equal(hashDaMedicao(piso), SEM_PEDIDO);
    assert.doesNotMatch(SEM_PEDIDO, /^[0-9a-f]{64}$/);
  });
});

describe('a linha', () => {
  const j = AMOSTRA.find((x) => x.alcance === 'periodo' && x.caso !== 'sem-contagem') ?? AMOSTRA[0]!;

  it('aprovada: o texto cru, a frase, a régua ao lado, a assinatura sem o instante e os tokens', async () => {
    const bom: Motor = async () => resposta(templateDaSaude(entrada(j)));
    const l = await comoOIphone(j, bom);
    assert.equal(l.desfecho, 'ok', JSON.stringify(l));
    assert.equal(l.range, j.range);
    assert.equal(l.offset, j.offset);
    assert.equal(l.caso, j.caso);
    assert.equal(l.alcance, j.alcance);
    assert.equal(l.textoDoMotor, templateDaSaude(entrada(j)));
    assert.equal(l.frase, l.template, 'o motor copiou o template — a frase final é a do piso');
    assert.deepEqual(l.assinatura, {
      tipo: 'aparelho',
      provedor: 'prov-a',
      modelo: 'AFM 3 Core Advanced',
      plataforma: 'iOS 27.0',
      buildDoSistema: '27A1',
    });
    assert.deepEqual(l.tokens, { entrada: 300, saida: 20 });
    assert.ok(l.ms > 0);
  });

  it('a falha do motor fica com a classe e o detalhe; a sintética diz que nenhuma chamada saiu', async () => {
    const lento: Motor = async () => ({ classe: 'transitoria', detalhe: 'o prazo de 60 s estourou' }) satisfies Falha;
    const l = await comoOIphone(j, lento);
    assert.equal(l.desfecho, 'transitoria');
    assert.equal(l.detalhe, 'o prazo de 60 s estourou');
    assert.equal(l.sintetica, undefined);

    const semMotor = await comoOIphone(j, undefined);
    assert.equal(semMotor.desfecho, 'indisponivel');
    assert.equal(semMotor.sintetica, true);
    assert.equal(semMotor.ms, 0);
  });

  it('o ms e os problemas somam a trilha inteira — não só a última tentativa', () => {
    const m: Medicao<string> = {
      tipo: 'tentativa',
      motor: APARELHO_SISTEMA,
      hash: 'a'.repeat(64),
      desfecho: 'reprovada',
      trilha: [
        { motor: APARELHO_SISTEMA, desfecho: 'janela', ms: 400, problemas: [{ regra: 'um', detalhe: 'primeira' }] },
        { motor: APARELHO_SISTEMA, desfecho: 'reprovada', ms: 250, curto: true, problemas: [{ regra: 'dois', detalhe: 'segunda' }] },
      ],
    };
    const l = linhaDaMedicao(j, hashDaMedicao(m), 'o piso', m, null);
    assert.equal(l.ms, 650);
    assert.deepEqual(l.problemas?.map((p) => p.regra), ['um', 'dois']);
    assert.equal(l.hashDoPedido, 'a'.repeat(64));
  });

  it('a pilha do defeito vem do evento que o registrar recebeu', () => {
    const m: Medicao<string> = {
      tipo: 'tentativa',
      motor: APARELHO_SISTEMA,
      hash: 'b'.repeat(64),
      desfecho: 'defeito',
      trilha: [{ motor: APARELHO_SISTEMA, desfecho: 'defeito', ms: 0 }],
    };
    const anel = { pilha: 'Error: x\n  at y' } as EventoDoAnel;
    assert.equal(linhaDaMedicao(j, 'h', 'o piso', m, anel).pilha, 'Error: x\n  at y');
  });

  it('o template da régua: a frase do piso, a ausência dita, e o aviso quando o piso não foi pedido', () => {
    assert.equal(templateDaMedicao({ tipo: 'template', motor: SEM_MODELO, frase: 'o piso' }), 'o piso');
    assert.equal(templateDaMedicao({ tipo: 'template', motor: SEM_MODELO, ausencia: 'sem noite' }), '(sem frase: sem noite)');
    assert.equal(templateDaMedicao({ tipo: 'mudo', motor: APARELHO_SISTEMA }), '(o piso não foi pedido)');
  });

  it('o defeito vira linha, com o nome, a mensagem e a pilha — a medição não para por ele', () => {
    const falhou = defeitoDe(new TypeError('quebrou'));
    assert.equal(falhou.detalhe, 'TypeError: quebrou');
    assert.match(falhou.pilha, /TypeError: quebrou/);
    const l = linhaDoDefeito(j, SEM_PEDIDO, '(defeito)', falhou);
    assert.equal(l.desfecho, 'defeito');
    assert.equal(l.ms, 0);
    assert.equal(l.detalhe, 'TypeError: quebrou');
    assert.equal(defeitoDe('texto').detalhe, 'texto');
  });
});

describe('as marcas do hospedeiro', () => {
  it('fria e fabricada pelo hospedeiro vêm do que a contagem andou durante a linha', () => {
    const antes = { frias: 1, doHospedeiro: 2 };
    assert.deepEqual(marcasDoHospedeiro({ frias: 1, doHospedeiro: 2 }, antes), {});
    assert.deepEqual(marcasDoHospedeiro({ frias: 2, doHospedeiro: 2 }, antes), { frio: true });
    assert.deepEqual(marcasDoHospedeiro({ frias: 1, doHospedeiro: 3 }, antes), { doHospedeiro: true });
    assert.deepEqual(marcasDoHospedeiro({ frias: 2, doHospedeiro: 3 }, antes), { frio: true, doHospedeiro: true });
    assert.deepEqual(marcasDoHospedeiro(undefined, antes), {}, 'hospedeiro sem contagem não marca nada');
  });
});
