import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, TIPOS_DE_MOTOR, lerMotorId,
  type MotorId, type TipoDeMotor,
} from './fio';
import {
  CONCLUSAO, TIPOS_QUE_GRAVAM, admiteTipo, destinatario, ehFalha, exposicao, hashDoPedido, resolverCadeia,
  serializarPedido,
  type Cadeia, type ChamadorDeModelo, type Falha, type Pedido, type PromptLegado, type RegimeDoRecurso,
  type Resposta,
} from './motor';
import type { PromptDeNome } from '../routes/prompt';

/* ── a porta ── */

describe('a porta', () => {
  it('ehFalha separa falha de resposta pela classe', () => {
    const r: Resposta = { texto: 'ok', assinatura: { tipo: 'nuvem', provedor: 'p', modelo: 'm' } };
    const f: Falha = { classe: 'transitoria' };
    assert.equal(ehFalha(r), false);
    assert.equal(ehFalha(f), true);
  });

  it('ehFalha usa o mesmo critério do orquestrador: classe inventada não é falha', () => {
    // P8: o hospedeiro e o orquestrador classificam do mesmo jeito.
    const inventada = { classe: 'inventada', detalhe: 'x' } as unknown as Falha;
    assert.equal(ehFalha(inventada), false);
    assert.equal(ehFalha({ classe: null } as unknown as Falha), false);
  });

  it('a conclusão tem uma grafia só', () => {
    assert.equal(CONCLUSAO, 'STOP');
  });

  it('o par guardrail permissivo + esquema não compila', () => {
    const texto: Pedido = { sistema: 's', usuario: 'u', amostragem: 'gulosa', saida: { tipo: 'texto' }, guardrails: 'permissivo' };
    const esquema: Pedido = {
      sistema: 's', usuario: 'u', amostragem: 'padrao',
      saida: { tipo: 'esquema', esquema: { type: 'boolean' } }, guardrails: 'padrao',
    };
    // @ts-expect-error — o modo permissivo só existe com saída de texto (AD-3).
    const invalido: Pedido = { sistema: 's', usuario: 'u', amostragem: 'padrao', saida: { tipo: 'esquema', esquema: { type: 'boolean' } }, guardrails: 'permissivo' };
    assert.ok(texto && esquema && invalido);
  });

  it('a costura antiga aceita o prompt do nome de rota sem conhecê-lo', () => {
    const prompt: PromptDeNome = { sistema: 's', usuario: 'u', json: true };
    const legado: PromptLegado = prompt;
    const chamar: ChamadorDeModelo = async (p) => ({ texto: p.usuario });
    assert.ok(legado && chamar);
  });
});

/* ── exposição e destinatário ── */

describe('exposição e destinatário', () => {
  it('sem modelo < aparelho < nuvem', () => {
    assert.deepEqual(TIPOS_DE_MOTOR.map(exposicao), [0, 1, 2]);
  });

  it('só a nuvem tem destinatário, e padrao é um destinatário próprio', () => {
    assert.equal(destinatario(lerMotorId(SEM_MODELO)!), null);
    assert.equal(destinatario(lerMotorId(APARELHO_SISTEMA)!), null);
    assert.equal(destinatario(lerMotorId('aparelho:local/pesos-a')!), null);
    assert.equal(destinatario(lerMotorId(NUVEM_PADRAO)!), 'padrao');
    assert.equal(destinatario(lerMotorId('nuvem:prov-a/modelo-1')!), 'prov-a');
  });
});

/* ── a cadeia ── */

const regime = (cadeiaPadrao: readonly MotorId[], regimeMaximo: TipoDeMotor = 'nuvem') => ({
  cadeiaPadrao, regimeMaximo,
});

describe('resolverCadeia — os casos que a espinha nomeia', () => {
  const catalogo: MotorId[] = [APARELHO_SISTEMA, NUVEM_PADRAO, 'nuvem:prov-a/modelo-1', 'aparelho:local/pesos-a'];

  it('ausente: o padrão do recurso', () => {
    assert.deepEqual([...resolverCadeia(regime([NUVEM_PADRAO, SEM_MODELO]), undefined, catalogo)], [NUVEM_PADRAO, SEM_MODELO]);
    assert.deepEqual([...resolverCadeia(regime([APARELHO_SISTEMA, SEM_MODELO]), null, catalogo)], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('ilegível: só sem-modelo, mesmo com padrão de nuvem', () => {
    for (const p of ['lixo', '', 'nuvem:', 'aparelho:x', 'nuvem:padrao/x']) {
      assert.deepEqual([...resolverCadeia(regime([NUVEM_PADRAO, SEM_MODELO]), p, catalogo)], [SEM_MODELO], p);
    }
  });

  it('legível e conhecida: primeiro elo, e o recuo nunca sobe', () => {
    const c = resolverCadeia(regime([NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]), APARELHO_SISTEMA, catalogo);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('nuvem escolhida não recua para outro provedor — mas recua para o aparelho', () => {
    const c = resolverCadeia(regime([NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]), 'nuvem:prov-a/modelo-1', catalogo);
    assert.deepEqual([...c], ['nuvem:prov-a/modelo-1', APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('pesos desconhecidos no aparelho: o padrão filtrado a aparelho ou menos', () => {
    const c = resolverCadeia(regime([NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]), 'aparelho:outro/pesos-z', catalogo);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('acima do regimeMaximo: recusada, e o padrão fica no regime', () => {
    const c = resolverCadeia(regime([APARELHO_SISTEMA, SEM_MODELO], 'aparelho'), NUVEM_PADRAO, catalogo);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('um padrão que sobe a exposição é cortado, não reordenado', () => {
    const c = resolverCadeia(regime([APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO]), undefined, catalogo);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('motor conhecido do padrão fica mesmo fora do catálogo: a tentativa sintética explica', () => {
    const c = resolverCadeia(regime([APARELHO_SISTEMA, SEM_MODELO]), undefined, []);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('a cadeia é congelada e só a resolução a constrói', () => {
    const c = resolverCadeia(regime([SEM_MODELO]), undefined, []);
    assert.ok(Object.isFrozen(c));
    // @ts-expect-error — uma lista escrita à mão não é Cadeia.
    const falsa: Cadeia = [NUVEM_PADRAO, SEM_MODELO];
    assert.ok(falsa);
  });
});

/* ── o que um recurso que grava admite (AD-12, story 5.2) ── */

describe('resolverCadeia — o admite de quem grava', () => {
  const catalogo: MotorId[] = [APARELHO_SISTEMA, NUVEM_PADRAO, 'nuvem:prov-a/modelo-1', 'aparelho:local/pesos-a'];
  const grava = (admite: RegimeDoRecurso['grava']) => (cadeiaPadrao: readonly MotorId[]): RegimeDoRecurso => ({
    cadeiaPadrao, regimeMaximo: 'nuvem', grava: admite,
  });
  const soNuvem = grava({ admite: ['nuvem'] });
  const soAparelho = grava({ admite: ['aparelho'] });

  it('os tipos que gravam são aparelho e nuvem — sem-modelo é o piso', () => {
    assert.deepEqual([...TIPOS_QUE_GRAVAM], ['aparelho', 'nuvem']);
  });

  it('os tipos que gravam, mais sem-modelo, são exatamente os tipos de motor', () => {
    const unidos = new Set<string>([...TIPOS_QUE_GRAVAM, SEM_MODELO]);
    assert.deepEqual([...unidos].sort(), [...TIPOS_DE_MOTOR].sort());
    assert.equal(unidos.size, TIPOS_DE_MOTOR.length);
  });

  it('o padrão é filtrado pelo admite, antes de a exposição ser conferida', () => {
    // Filtrar depois pegaria o aparelho como elo anterior, cortaria a nuvem por
    // subir a exposição, e só então tiraria o aparelho: sobraria [sem-modelo].
    const padrao = [APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO] as const;
    assert.deepEqual([...resolverCadeia(soNuvem(padrao), undefined, catalogo)], [NUVEM_PADRAO, SEM_MODELO]);
  });

  it('a revista com o aparelho fica em sem-modelo — nunca sobe para a nuvem', () => {
    // A forma da retrospectiva: só nuvem, padrão [nuvem:padrao, sem-modelo].
    for (const p of [APARELHO_SISTEMA, 'aparelho:local/pesos-a', 'aparelho:outro/pesos-z']) {
      assert.deepEqual([...resolverCadeia(soNuvem([NUVEM_PADRAO, SEM_MODELO]), p, catalogo)], [SEM_MODELO], p);
    }
  });

  it('a nuvem pedida a quem só admite o aparelho é recusada como a que passa do regime', () => {
    const c = resolverCadeia(soAparelho([APARELHO_SISTEMA, SEM_MODELO]), 'nuvem:prov-a/modelo-1', catalogo);
    assert.deepEqual([...c], [APARELHO_SISTEMA, SEM_MODELO]);
  });

  it('dentro do admite, a preferência conhecida continua sendo o primeiro elo', () => {
    const c = resolverCadeia(soNuvem([NUVEM_PADRAO, SEM_MODELO]), 'nuvem:prov-a/modelo-1', catalogo);
    assert.deepEqual([...c], ['nuvem:prov-a/modelo-1', SEM_MODELO]);
  });

  it('admite vazio, ou que não é lista, não admite nada: só sem-modelo', () => {
    for (const admite of [[], 'nuvem,aparelho', undefined, null]) {
      const r = { cadeiaPadrao: [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO], regimeMaximo: 'nuvem', grava: { admite } } as unknown as RegimeDoRecurso;
      assert.deepEqual([...resolverCadeia(r, undefined, catalogo)], [SEM_MODELO], JSON.stringify(admite));
      assert.deepEqual([...resolverCadeia(r, NUVEM_PADRAO, catalogo)], [SEM_MODELO], JSON.stringify(admite));
    }
  });

  it('admiteTipo: quem não grava admite tudo, e sem-modelo é sempre admitido', () => {
    for (const tipo of TIPOS_DE_MOTOR) {
      assert.equal(admiteTipo({}, tipo), true, tipo);
      assert.equal(admiteTipo({ grava: false }, tipo), true, tipo);
    }
    assert.equal(admiteTipo({ grava: { admite: ['nuvem'] } }, 'sem-modelo'), true);
    assert.equal(admiteTipo({ grava: { admite: ['nuvem'] } }, 'nuvem'), true);
    assert.equal(admiteTipo({ grava: { admite: ['nuvem'] } }, 'aparelho'), false);
  });
});

/**
 * A propriedade da AD-5, exaustiva sobre um universo pequeno: toda preferência
 * (ausente, ilegível, desconhecida, conhecida, acima do regime) × todo padrão
 * ordenado sobre os elos permitidos, mais padrões fora da regra × todo catálogo ×
 * todo regime máximo × todo `grava` (ausente, `false`, só nuvem, só aparelho, os
 * dois — story 5.2).
 */
describe('resolverCadeia — a propriedade da AD-5', () => {
  const UNIVERSO: MotorId[] = [
    SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO,
    'aparelho:local/pesos-a', 'nuvem:prov-a/modelo-1', 'nuvem:prov-b/modelo-2',
  ];
  const PREFERENCIAS: (string | null | undefined)[] = [
    undefined, null,
    ...UNIVERSO,
    'aparelho:outro/pesos-z', 'nuvem:prov-c/modelo-9', 'nuvem:prov-a/modelo-9',   // legíveis, desconhecidas
    '', 'lixo', 'nuvem:', 'aparelho:x', 'nuvem:padrao/x', 'NUVEM:padrao', 'sem-modelo:x', // ilegíveis
  ];

  /** Toda sequência ordenada, sem repetição, de um subconjunto de `base`. */
  function arranjos<T>(base: readonly T[]): T[][] {
    const out: T[][] = [[]];
    const passo = (atual: T[], resto: readonly T[]) => {
      for (let i = 0; i < resto.length; i += 1) {
        const prox = [...atual, resto[i]];
        out.push(prox);
        passo(prox, [...resto.slice(0, i), ...resto.slice(i + 1)]);
      }
    };
    passo([], base);
    return out;
  }

  // Os padrões permitidos (só as três formas canônicas, em toda ordem) e alguns
  // que a validação recusaria — a resolução tem de ser segura mesmo com eles.
  const PADROES: MotorId[][] = [
    ...arranjos<MotorId>([SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO]),
    ['nuvem:prov-a/modelo-1', 'nuvem:prov-b/modelo-2', 'aparelho:local/pesos-a', SEM_MODELO],
    ['aparelho:local/pesos-a', 'nuvem:prov-b/modelo-2', NUVEM_PADRAO],
    [NUVEM_PADRAO, NUVEM_PADRAO, 'nuvem:prov-a/modelo-1', APARELHO_SISTEMA, APARELHO_SISTEMA],
    ['nuvem:lixo' as MotorId, APARELHO_SISTEMA, 'aparelho:' as MotorId],
  ];

  const CATALOGOS: MotorId[][] = [];
  const conheciveis = UNIVERSO.filter((id) => id !== SEM_MODELO);
  for (let mascara = 0; mascara < 1 << conheciveis.length; mascara += 1) {
    CATALOGOS.push(conheciveis.filter((_, i) => mascara & (1 << i)));
  }

  const grau = (id: string) => exposicao(lerMotorId(id)!.tipo);

  // Ausente e `false` são "não grava"; os dois com os dois tipos é "grava tudo".
  const GRAVAS: RegimeDoRecurso['grava'][] = [
    undefined, false, { admite: ['nuvem'] }, { admite: ['aparelho'] }, { admite: ['aparelho', 'nuvem'] },
  ];
  const admitidos = (grava: RegimeDoRecurso['grava']): readonly string[] =>
    grava ? grava.admite : TIPOS_QUE_GRAVAM;

  it('vale em toda combinação', () => {
    let combinacoes = 0;
    for (const preferencia of PREFERENCIAS) {
      const lida = preferencia == null ? null : lerMotorId(preferencia);
      for (const padrao of PADROES) {
        for (const catalogo of CATALOGOS) {
          for (const regimeMaximo of TIPOS_DE_MOTOR) {
            // A cadeia de quem não grava — a da 5.1 —, contra a qual as outras se medem.
            const semGravar = [...resolverCadeia({ cadeiaPadrao: padrao, regimeMaximo }, preferencia, catalogo)];
            for (const grava of GRAVAS) {
              combinacoes += 1;
              const regime: RegimeDoRecurso = grava === undefined
                ? { cadeiaPadrao: padrao, regimeMaximo }
                : { cadeiaPadrao: padrao, regimeMaximo, grava };
              const c = [...resolverCadeia(regime, preferencia, catalogo)];
              const caso = JSON.stringify({ preferencia, padrao, catalogo, regimeMaximo, grava, c });
              const admite = admitidos(grava);

              // Termina em sem-modelo, uma vez só.
              assert.equal(c[c.length - 1], SEM_MODELO, caso);
              assert.equal(c.filter((id) => id === SEM_MODELO).length, 1, caso);
              // Sem repetição, e todo elo se lê.
              assert.equal(new Set(c).size, c.length, caso);
              for (const id of c) assert.ok(lerMotorId(id), caso);

              // A exposição não cresce ao longo da cadeia…
              for (let i = 1; i < c.length; i += 1) assert.ok(grau(c[i]) <= grau(c[i - 1]), caso);
              // …não passa do regime…
              for (const id of c) assert.ok(grau(id) <= exposicao(regimeMaximo), caso);
              // …nem da preferência gravada.
              if (lida) for (const id of c) assert.ok(grau(id) <= exposicao(lida.tipo), caso);

              // Nenhum elo além de sem-modelo é de tipo que o recurso não admite (AD-12).
              for (const id of c) {
                if (id !== SEM_MODELO) assert.ok(admite.includes(lerMotorId(id)!.tipo), caso);
              }

              // A nuvem tem um destinatário só — e, se a preferência é de nuvem, é o dela.
              const destinos = new Set(c.map((id) => destinatario(lerMotorId(id)!)).filter((d) => d !== null));
              assert.ok(destinos.size <= 1, caso);
              if (lida?.tipo === 'nuvem') {
                for (const d of destinos) assert.equal(d, destinatario(lida), caso);
              }

              // Ilegível dá só sem-modelo.
              if (preferencia != null && !lida) assert.deepEqual(c, [SEM_MODELO], caso);

              // Legível, conhecida, dentro do regime e admitida é o primeiro elo.
              if (lida && lida.tipo !== 'sem-modelo' && catalogo.includes(preferencia as MotorId)
                && exposicao(lida.tipo) <= exposicao(regimeMaximo) && admite.includes(lida.tipo)) {
                assert.equal(c[0], preferencia, caso);
              }

              // Nenhum elo entra de fora: ou é a preferência, ou veio do padrão.
              for (const id of c) {
                if (id === SEM_MODELO || id === preferencia) continue;
                assert.ok(padrao.includes(id), caso);
              }

              // Quem não grava, ou admite os dois tipos, resolve como na 5.1.
              if (grava === false || admite.length === TIPOS_QUE_GRAVAM.length) {
                assert.deepEqual(c, semGravar, caso);
              }
            }
          }
        }
      }
    }
    // A enumeração não ficou vazia por engano:
    // 18 preferências × 20 padrões × 32 catálogos × 3 regimes × 5 formas de gravar.
    assert.equal(combinacoes, 172_800);
  });
});

/* ── a identidade do pedido ── */

describe('serializarPedido e hashDoPedido', () => {
  const pedido: Pedido = {
    sistema: 'Você escreve uma frase.',
    usuario: 'Caso: uma dimensão.',
    amostragem: 'gulosa',
    saida: { tipo: 'esquema', esquema: { type: 'object', properties: { b: { type: 'boolean' }, a: { type: 'string' } }, required: ['a'] } },
    guardrails: 'padrao',
  };

  it('JSON canônico: chaves ordenadas em todo nível, com a versão do descritor', () => {
    assert.equal(
      serializarPedido(pedido, 3),
      '{"amostragem":"gulosa","guardrails":"padrao","saida":{"esquema":{"properties":{"a":{"type":"string"},'
        + '"b":{"type":"boolean"}},"required":["a"],"type":"object"},"tipo":"esquema"},'
        + '"sistema":"Você escreve uma frase.","usuario":"Caso: uma dimensão.","versaoDoDescritor":3}',
    );
  });

  it('a ordem em que o pedido foi escrito não muda nada', () => {
    const mesmo = {
      guardrails: 'padrao', usuario: pedido.usuario, saida: { esquema: pedido.saida.tipo === 'esquema' ? pedido.saida.esquema : undefined, tipo: 'esquema' },
      amostragem: 'gulosa', sistema: pedido.sistema,
    } as unknown as Pedido;
    assert.equal(serializarPedido(mesmo, 3), serializarPedido(pedido, 3));
    assert.equal(hashDoPedido(mesmo, 3), hashDoPedido(pedido, 3));
  });

  it('campo indefinido não entra', () => {
    const comBuraco = { ...pedido, extra: undefined } as unknown as Pedido;
    assert.equal(serializarPedido(comBuraco, 3), serializarPedido(pedido, 3));
  });

  it('a versão do descritor muda o hash; o texto muda o hash', () => {
    assert.notEqual(hashDoPedido(pedido, 3), hashDoPedido(pedido, 4));
    assert.notEqual(hashDoPedido(pedido, 3), hashDoPedido({ ...pedido, usuario: 'outro' }, 3));
  });

  it('o hash é o SHA-256 da string canônica', () => {
    const s = serializarPedido(pedido, 3);
    assert.equal(hashDoPedido(pedido, 3), createHash('sha256').update(s, 'utf8').digest('hex'));
    assert.match(hashDoPedido(pedido, 3), /^[0-9a-f]{64}$/);
  });
});
