import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, validarEsquema, type Esquema, type MotorId } from '../ia/fio';
import { hashDoPedido, resolverCadeia, type Falha, type Motor, type Pedido, type Resposta } from '../ia/motor';
import { ler, type Medicao } from '../ia/orquestrar';
import { CATALOGO_DE_RECURSOS, validarDescritor } from '../ia/recursos';
import { casoDaSaude } from './caso';
import { descritorDaSaudeDoSono, type AlcanceDaSaude, type EntradaDaSaude } from './leitura';
import { descritorDaSondaDaSaude as sonda } from './sonda';
import { DIMENSION_LABEL, type SleepDimensionKey } from './score';

/**
 * A sonda de fidelidade (story 5.10), linha a linha da matriz: pergunta só onde o caso
 * nomeia, aprova a escolha que está no `nomear`, reprova a que não está — dizendo a
 * escolha e o esperado —, e é `mudo` onde não há o que perguntar.
 *
 * As contagens são montadas à mão: o que a sonda lê é o `SleepScore`, e escrevê-lo
 * direto deixa cada caso da precedência à vista, sem depender de um acervo que o produza.
 */

const CHAVES: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'regularidade', 'percepcao'];

type Pontos = Partial<Record<SleepDimensionKey, number>>;

function entrada(pontos: Pontos, alcance: AlcanceDaSaude = 'periodo', scored = true): EntradaDaSaude {
  const dimensions = CHAVES.map((key) => ({
    key,
    label: DIMENSION_LABEL[key],
    points: pontos[key] ?? null,
    fact: '—',
    ...(pontos[key] === undefined ? { absent: 'sem dado' } : {}),
  }));
  const medidas = dimensions.filter((d) => d.points !== null);
  return {
    alcance,
    range: alcance === 'noite' ? 'ultima' : '7d',
    hoje: '2026-09-10',
    janela: { since: null, until: null },
    score: {
      dimensions,
      points: medidas.reduce((s, d) => s + (d.points ?? 0), 0),
      max: 2 * medidas.length,
      coverage: alcance === 'noite' ? null : { nights: 7, expected: 7, ratio: 1 },
      scored: scored && medidas.length > 0,
    },
  };
}

/** Um exemplo de cada caso que nomeia, com o que o código nomeia. */
const QUE_NOMEIAM = {
  uma: { pontos: { duracao: 2, continuidade: 1, horario: 0, percepcao: 2 }, nomear: ['horario'] },
  duas: { pontos: { duracao: 0, continuidade: 0, horario: 2, regularidade: 1 }, nomear: ['duracao', 'continuidade'] },
  'fora-do-empate': { pontos: { duracao: 1, continuidade: 1, horario: 1, percepcao: 2 }, nomear: ['percepcao'] },
} as const satisfies Record<string, { pontos: Pontos; nomear: readonly SleepDimensionKey[] }>;

/** Um exemplo de cada caso que não nomeia. */
const SEM_PERGUNTA: readonly (readonly [string, EntradaDaSaude])[] = [
  ['sem-contagem', entrada({ duracao: 1, horario: 2 }, 'periodo', false)],
  ['medidas-insuficientes', entrada({ duracao: 1 }, 'noite')],
  ['tudo-no-maximo', entrada({ duracao: 2, continuidade: 2, horario: 2, percepcao: 2 }, 'noite')],
  ['todas-iguais', entrada({ duracao: 1, continuidade: 1, horario: 1, regularidade: 1, percepcao: 1 })],
];

const escolha = (dimensao: string): Resposta => ({
  texto: JSON.stringify({ dimensao }),
  assinatura: { tipo: 'aparelho', provedor: 'prov-a', modelo: 'modelo-1' },
});

async function medir(e: EntradaDaSaude, saida: Resposta | Falha, motor: MotorId = APARELHO_SISTEMA) {
  const chamadas: Pedido[] = [];
  const falso: Motor = async (p) => {
    chamadas.push(p);
    return saida;
  };
  let t = 0;
  const m: Medicao<SleepDimensionKey> = await ler(sonda, e, {
    modo: 'medicao',
    motor,
    motorPara: (id) => (id === motor ? falso : undefined),
    registrar: () => undefined,
    agora: () => new Date((t += 50)),
  });
  return { m, chamadas };
}

function tentativa(m: Medicao<SleepDimensionKey>) {
  assert.equal(m.tipo, 'tentativa', JSON.stringify(m));
  return m as Extract<Medicao<SleepDimensionKey>, { tipo: 'tentativa' }>;
}

describe('o descritor', () => {
  it('é válido, e nunca entra no catálogo — o seletor não o lista', () => {
    assert.deepEqual(validarDescritor(sonda), []);
    assert.equal(CATALOGO_DE_RECURSOS.includes(sonda as never), false);
    assert.equal(CATALOGO_DE_RECURSOS.some((d) => (d as unknown) === sonda), false);
  });

  it('mede a Saúde do sono no mesmo regime dela: o dado da sonda vai só aonde o da leitura já vai', () => {
    assert.equal(sonda.recurso, descritorDaSaudeDoSono.recurso);
    assert.equal(sonda.regimeMaximo, descritorDaSaudeDoSono.regimeMaximo);
    assert.equal(sonda.grava, false);
    assert.deepEqual(sonda.cadeiaPadrao, [SEM_MODELO]);
  });

  it('nunca vira produto: resolvida pelo padrão, a cadeia é só o piso, e nenhum motor é chamado', async () => {
    const cadeia = resolverCadeia(sonda, null, [APARELHO_SISTEMA, NUVEM_PADRAO]);
    assert.deepEqual([...cadeia], [SEM_MODELO]);
    let chamou = false;
    const leitura = await ler(sonda, entrada(QUE_NOMEIAM.uma.pontos), {
      modo: 'produto',
      cadeia,
      motorPara: () => {
        chamou = true;
        return async () => escolha('horario');
      },
      registrar: () => undefined,
      agora: () => new Date(0),
    });
    assert.equal(leitura.origem, 'piso');
    assert.equal(chamou, false);
  });
});

describe('o pedido', () => {
  for (const [caso, { pontos, nomear }] of Object.entries(QUE_NOMEIAM)) {
    it(`${caso}: pede uma dimensão por esquema fechado, com os pontos de cada medida`, () => {
      const e = entrada(pontos);
      assert.equal(casoDaSaude(e.score).caso, caso, 'o exemplo não caiu no caso que diz ser');
      const p = sonda.montarPedido(e);
      assert.ok(p, `${caso} não gerou pedido`);
      assert.equal(p.amostragem, 'gulosa');
      assert.equal(p.guardrails, 'padrao');
      assert.equal(p.saida.tipo, 'esquema');
      if (p.saida.tipo !== 'esquema') return;
      const esquema: Esquema = p.saida.esquema;
      assert.deepEqual(validarEsquema(esquema), []);
      const medidas = CHAVES.filter((k) => pontos[k as keyof typeof pontos] !== undefined);
      // As opções são TODAS as medidas — a certa não se distingue das outras —, e o enum
      // vem na mesma ordem (embaralhada) em que o pedido as lista.
      assert.equal(esquema.type, 'object');
      if (esquema.type !== 'object') return;
      assert.deepEqual(esquema.required, ['dimensao']);
      const dim = esquema.properties['dimensao'];
      assert.ok(dim && dim.type === 'string' && dim.enum);
      assert.deepEqual([...dim.enum].sort(), [...medidas].sort());
      const listadas = p.usuario.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(' ')[0]);
      assert.deepEqual(listadas, [...dim.enum], 'a lista do pedido e o enum saíram em ordens diferentes');
      for (const k of medidas) {
        const pt = pontos[k as keyof typeof pontos];
        assert.ok(p.usuario.includes(`- ${k} (`), `${k} não foi listada`);
        assert.ok(p.usuario.includes(`: ${pt} ponto`), `os pontos de ${k} não foram`);
      }
      for (const k of CHAVES.filter((c) => !medidas.includes(c))) {
        assert.equal(p.usuario.includes(`- ${k} (`), false, `${k} não foi medida e foi listada`);
      }
      // A pergunta não diz a resposta: nenhuma chave aparece nela.
      const pergunta = p.usuario.split('\n').find((l) => l.startsWith('Pergunta:')) ?? '';
      assert.ok(pergunta.length > 0, 'o pedido não tem pergunta');
      for (const k of CHAVES) assert.equal(pergunta.includes(k), false, `a pergunta cita ${k}`);
      for (const k of nomear) assert.equal(pergunta.includes(DIMENSION_LABEL[k].toLowerCase()), false);
    });
  }

  it('em uma e duas pergunta pelo ponto mais baixo; fora do empate, pelas que não estão nele', () => {
    const pergunta = (pontos: Pontos): string =>
      (sonda.montarPedido(entrada(pontos))?.usuario ?? '').split('\n').find((l) => l.startsWith('Pergunta:')) ?? '';
    assert.match(pergunta(QUE_NOMEIAM.uma.pontos), /que esteja no ponto mais baixo/);
    assert.match(pergunta(QUE_NOMEIAM.duas.pontos), /que esteja no ponto mais baixo/);
    assert.match(pergunta(QUE_NOMEIAM['fora-do-empate'].pontos), /que não esteja no ponto mais baixo/);
  });

  it('a ordem das opções é da janela: determinística nela, e diferente entre janelas', () => {
    const ordem = (e: EntradaDaSaude): string => {
      const p = sonda.montarPedido(e);
      assert.ok(p && p.saida.tipo === 'esquema' && p.saida.esquema.type === 'object');
      const dim = p.saida.esquema.properties['dimensao'];
      return dim && dim.type === 'string' ? (dim.enum ?? []).join(',') : '';
    };
    const pontos = { duracao: 2, continuidade: 1, horario: 0, regularidade: 2, percepcao: 2 };
    const naJanela = (since: string, until: string): EntradaDaSaude => ({ ...entrada(pontos), janela: { since, until } });
    // A mesma janela, duas vezes: a mesma ordem (e o mesmo pedido, pelo mesmo hash).
    assert.equal(ordem(naJanela('2026-08-01', '2026-08-07')), ordem(naJanela('2026-08-01', '2026-08-07')));
    // Janelas diferentes: a ordem varia — a posição não decide.
    const ordens = new Set<string>();
    for (let d = 1; d <= 20; d += 1) {
      const dia = String(d).padStart(2, '0');
      ordens.add(ordem(naJanela(`2026-07-${dia}`, `2026-07-${dia}`)));
    }
    assert.ok(ordens.size > 3, `20 janelas deram só ${ordens.size} ordens`);
    assert.ok(![...ordens].every((o) => o.startsWith('duracao')), 'a duração ficou sempre na frente');
  });

  it('o pedido da sonda nunca é o da leitura — hashes distintos para a mesma entrada', () => {
    const e = entrada(QUE_NOMEIAM.uma.pontos);
    const daSonda = sonda.montarPedido(e);
    const daLeitura = descritorDaSaudeDoSono.montarPedido(e);
    assert.ok(daSonda && daLeitura);
    assert.notEqual(hashDoPedido(daSonda, sonda.versao), hashDoPedido(daLeitura, descritorDaSaudeDoSono.versao));
  });
});

describe('a medição da sonda', () => {
  for (const [caso, { pontos, nomear }] of Object.entries(QUE_NOMEIAM)) {
    it(`${caso}: a escolha dentro do nomear é ok`, async () => {
      for (const certa of nomear) {
        const { m, chamadas } = await medir(entrada(pontos), escolha(certa));
        const t = tentativa(m);
        assert.equal(t.desfecho, 'ok', JSON.stringify(t.trilha));
        assert.equal(t.valor, certa);
        assert.equal(t.frase, DIMENSION_LABEL[certa].toLowerCase());
        assert.equal(chamadas.length, 1);
      }
    });

    it(`${caso}: a escolha fora do nomear é reprovada, com a escolha e o esperado`, async () => {
      const medidas = CHAVES.filter((k) => pontos[k as keyof typeof pontos] !== undefined);
      const errada = medidas.find((k) => !(nomear as readonly string[]).includes(k));
      assert.ok(errada, 'o exemplo não tem escolha errada');
      const t = tentativa((await medir(entrada(pontos), escolha(errada))).m);
      assert.equal(t.desfecho, 'reprovada');
      assert.equal(t.valor, errada);
      assert.equal(t.frase, undefined);
      const problema = t.trilha[0]?.problemas?.[0];
      assert.equal(problema?.regra, 'escolha');
      assert.ok(problema?.detalhe.includes(`escolheu ${errada}`), problema?.detalhe);
      for (const k of nomear) assert.ok(problema?.detalhe.includes(k), `o esperado ${k} não está no detalhe`);
    });
  }

  it('uma dimensão que não foi medida é reprovada como fora das opções', async () => {
    const t = tentativa((await medir(entrada(QUE_NOMEIAM.uma.pontos), escolha('regularidade'))).m);
    assert.equal(t.desfecho, 'reprovada');
    assert.equal(t.trilha[0]?.problemas?.[0]?.regra, 'fora-das-opcoes');
  });

  it('resposta que não é JSON, ou que sai do esquema, é saida-invalida', async () => {
    const e = entrada(QUE_NOMEIAM.uma.pontos);
    const assinatura = { tipo: 'aparelho', provedor: 'prov-a', modelo: 'modelo-1' } as const;
    for (const texto of ['horario', '{"dimensao":"sono"}', '{"dimensao":"horario","porque":"x"}', '{}', '[]']) {
      const t = tentativa((await medir(e, { texto, assinatura })).m);
      assert.equal(t.desfecho, 'saida-invalida', texto);
    }
  });

  it('a falha do motor é o desfecho, como em qualquer descritor', async () => {
    const t = tentativa((await medir(entrada(QUE_NOMEIAM.uma.pontos), { classe: 'indisponivel', detalhe: 'modelNotReady' })).m);
    assert.equal(t.desfecho, 'indisponivel');
    assert.equal(t.trilha[0]?.detalhe, 'modelNotReady');
  });

  for (const [caso, e] of SEM_PERGUNTA) {
    it(`${caso}: sem o que perguntar é mudo, e nenhuma chamada sai`, async () => {
      assert.equal(casoDaSaude(e.score).caso, caso, 'o exemplo não caiu no caso que diz ser');
      assert.equal(sonda.montarPedido(e), null);
      const { m, chamadas } = await medir(e, escolha('duracao'));
      assert.equal(m.tipo, 'mudo');
      assert.equal(chamadas.length, 0);
    });
  }

  it('o piso é a resposta do código: o que ele nomeia, ou a ausência', () => {
    assert.deepEqual(sonda.semModelo(entrada(QUE_NOMEIAM.duas.pontos)), { frase: 'duração, continuidade' });
    const semNada = sonda.semModelo(entrada({ duracao: 2, continuidade: 2 }, 'noite'));
    assert.ok('ausencia' in semNada, JSON.stringify(semNada));
  });

  it('a leitura da resposta aceita as cinco chaves — se a escolha foi entre as medidas, quem diz é a conferência', () => {
    for (const k of CHAVES) assert.equal(sonda.interpretar(escolha(k)), k);
  });
});
