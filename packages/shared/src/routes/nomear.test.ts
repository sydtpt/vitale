/**
 * O caminho inteiro do nome, **pela porta** (ADR 0042 · story 5.7).
 *
 * Os mesmos oito casos de antes, agora atravessando `ler()` com o motor de nuvem
 * de verdade (`criarMotorDeNuvem`) sobre um transporte falso — é o que faz o
 * corpo enviado à `ia-narrar` ser um fato observável do teste, e não uma
 * suposição. A cada linha da matriz corresponde uma checagem:
 *
 *  1. Rota degenerada **não gasta uma chamada** — o teste conta os corpos.
 *  2. Recusa (permanente) grava; erro (transitório) **não grava nada**, e a
 *     pedalada volta ao gatilho. Confundir as duas queima a rota para sempre por
 *     causa de um timeout.
 *  3. A meta carrega o que a auditoria precisa: forma, língua, região, versão do
 *     prompt, provedor, modelo e tokens — inclusive quando a recusa é que ficou.
 *  4. O feliz produz o nome que o dono aprovou.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type MotorId } from '../ia/fio';
import { CONCLUSAO, resolverCadeia, type Motor } from '../ia/motor';
import { criarMotorDeNuvem, type RespostaDoTransporte, type Transporte } from '../ia/nuvem';
import { ler, type EventoDoAnel, type Leitura } from '../ia/orquestrar';
import { derivarAncoras } from './anchor';
import { descritorDoNomeDeRota, type FatosDoNome } from './descritor';
import { metaDaLeitura } from './nomear';
import type { NomePreenchido, RouteFacts } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

const ancoras = derivarAncoras(
  rides.flatMap((r) => [
    { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
    { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
  ]),
);

const acharRota = (dia: string, km: number): RouteFacts =>
  rides.find((r) => r.startAt.slice(0, 10) === dia && Math.round(r.distanceM / 1000) === km)!;

const fatosDe = (rota: RouteFacts): FatosDoNome => ({ rota, ancoras });

const PAJOTTENLAND = fatosDe(acharRota('2026-08-15', 75));
const DEGENERADA = fatosDe(acharRota('2026-08-31', 5));
const HALLE = fatosDe(acharRota('2026-07-27', 50));

const AGORA = new Date('2026-09-21T12:00:00Z');
const CATALOGO: readonly MotorId[] = [SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO];

const BOA = JSON.stringify({
  regiao: 'Pajottenland',
  artigo: 'le',
  justificativa: ['Sint-Martens-Lennik', 'Strijtem', 'Pamel'],
});

/** Um 2xx da function, como ela responde hoje. */
function corpoBom(texto: string, extra: Record<string, unknown> = {}): RespostaDoTransporte {
  return {
    status: 200,
    corpo: {
      texto,
      provedor: 'fake',
      modelo: 'fake-1',
      motivoDeParada: CONCLUSAO,
      tokens: { entrada: 120, saida: 40 },
      ...extra,
    },
  };
}

/**
 * O motor de nuvem de verdade sobre um transporte falso: é o que faz o **corpo**
 * ser observável. Guardar os corpos é como o teste conta as chamadas — a rota
 * degenerada tem de deixar a lista vazia.
 */
function nuvemFalsa(...roteiro: readonly RespostaDoTransporte[]) {
  const corpos: unknown[] = [];
  let i = 0;
  const transporte: Transporte = async (corpo) => {
    corpos.push(corpo);
    const r = roteiro[Math.min(i, roteiro.length - 1)];
    i += 1;
    return r;
  };
  return { motor: criarMotorDeNuvem(transporte), corpos };
}

interface Corrida {
  readonly leitura: Leitura<NomePreenchido>;
  readonly corpos: readonly unknown[];
  readonly eventos: readonly EventoDoAnel[];
  readonly gravar: ReturnType<typeof metaDaLeitura>;
}

async function correr(
  fatos: FatosDoNome,
  motores: Readonly<Partial<Record<MotorId, Motor>>>,
  corpos: readonly unknown[],
  preferencia: string | null = null,
): Promise<Corrida> {
  const eventos: EventoDoAnel[] = [];
  const leitura = await ler(descritorDoNomeDeRota, fatos, {
    modo: 'produto',
    cadeia: resolverCadeia(descritorDoNomeDeRota, preferencia, CATALOGO),
    motorPara: (id) => motores[id],
    registrar: (e) => {
      eventos.push(e);
    },
    agora: () => AGORA,
  });
  return { leitura, corpos, eventos, gravar: metaDaLeitura(leitura, fatos, AGORA) };
}

/** A corrida normal: a nuvem no padrão, respondendo o roteiro. */
async function comNuvem(
  fatos: FatosDoNome,
  ...roteiro: readonly RespostaDoTransporte[]
): Promise<Corrida> {
  const { motor, corpos } = nuvemFalsa(...roteiro);
  return correr(fatos, { [NUVEM_PADRAO]: motor }, corpos);
}

describe('a linha que sai nome', () => {
  it('o feliz produz o nome aprovado e a meta completa', async () => {
    const { leitura, corpos, gravar } = await comNuvem(PAJOTTENLAND, corpoBom(BOA));

    assert.equal(leitura.origem, 'motor');
    assert.equal(corpos.length, 1);
    assert.equal(gravar?.nome, 'Tour du Pajottenland');
    const m = gravar!.meta;
    assert.equal(m.recusa, undefined);
    assert.equal(m.forma, 'casa-b');
    assert.equal(m.lingua, 'fr');
    assert.equal(m.regiao, 'Pajottenland');
    assert.equal(m.artigo, 'le');
    assert.deepEqual(m.justificativa, ['Sint-Martens-Lennik', 'Strijtem', 'Pamel']);
    assert.equal(m.versaoPrompt, 2);
    assert.equal(m.provedor, 'fake');
    assert.equal(m.modelo, 'fake-1');
    assert.deepEqual(m.tokens, { entrada: 120, saida: 40 });
    assert.equal(m.em, '2026-09-21T12:00:00.000Z');
  });

  it('o corpo enviado à function é o de hoje: o par do prompt, com json', async () => {
    const { corpos } = await comNuvem(PAJOTTENLAND, corpoBom(BOA));
    const corpo = corpos[0] as { sistema: string; usuario: string; json: boolean; motor?: unknown };
    assert.equal(corpo.json, true);
    assert.match(corpo.sistema, /^Você nomeia percursos de bicicleta/);
    assert.match(corpo.usuario, /Cidades na ordem em que o percurso passou:/);
    // `nuvem:padrao` **é** "o servidor escolhe": o corpo não nomeia motor nenhum,
    // e é isso que o mantém igual ao de antes da porta.
    assert.equal(corpo.motor, undefined);
  });

  it('sem região o trajeto assume, e o nome sai mesmo assim', async () => {
    const { gravar } = await comNuvem(HALLE, corpoBom(JSON.stringify({ destino: 'Hal', justificativa: ['Halle'] })));
    assert.equal(gravar?.nome, 'Aller à Hal');
    assert.equal(gravar?.meta.regiao, null);
  });
});

describe('as recusas permanentes — o que fica gravado', () => {
  it('rota degenerada não gasta uma chamada', async () => {
    const { leitura, corpos, gravar } = await comNuvem(DEGENERADA, corpoBom(BOA));
    assert.equal(leitura.origem === 'piso' && leitura.causa, 'mudo');
    assert.equal(corpos.length, 0, 'o portão deixou passar uma chamada que não devia existir');
    assert.equal(gravar?.nome, null);
    assert.equal(gravar?.meta.recusa, 'degenerada');
    assert.equal(gravar?.meta.provedor, undefined, 'ninguém respondeu — não há assinatura a gravar');
  });

  it('resposta ilegível vira recusa registrada, com o provedor e o motivo', async () => {
    const { leitura, gravar } = await comNuvem(PAJOTTENLAND, corpoBom('não consigo nomear este percurso'));
    assert.equal(leitura.origem === 'piso' && leitura.causa, 'saida-invalida');
    assert.equal(gravar?.meta.recusa, 'ilegivel');
    assert.match(gravar?.meta.detalhe ?? '', /não traz as peças do nome/);
    assert.equal(gravar?.meta.provedor, 'fake');
    assert.deepEqual(gravar?.meta.tokens, { entrada: 120, saida: 40 });
  });

  it('região inventada é reprovada, e a meta guarda o que o modelo tentou', async () => {
    const { leitura, gravar } = await comNuvem(
      PAJOTTENLAND,
      corpoBom(JSON.stringify({ regiao: 'Toscana', artigo: 'la', justificativa: ['Siena'] })),
    );
    assert.equal(leitura.origem === 'piso' && leitura.causa, 'reprovada');
    assert.equal(gravar?.nome, null);
    assert.equal(gravar?.meta.recusa, 'reprovado');
    assert.equal(gravar?.meta.regiao, 'Toscana', 'a tentativa tem de ficar registrada para auditoria');
    assert.deepEqual(gravar?.meta.justificativa, ['Siena']);
    assert.equal(gravar?.meta.provedor, 'fake');
    assert.equal(gravar?.meta.modelo, 'fake-1');
    assert.deepEqual(gravar?.meta.tokens, { entrada: 120, saida: 40 });
    assert.match(gravar?.meta.detalhe ?? '', /Siena/);
  });

  it('cidade da rota vendida como região é reprovada', async () => {
    const { gravar } = await comNuvem(
      PAJOTTENLAND,
      corpoBom(JSON.stringify({ regiao: 'Ninove', justificativa: ['Ninove'] })),
    );
    assert.equal(gravar?.meta.recusa, 'reprovado');
    assert.match(gravar?.meta.detalhe ?? '', /não é uma região|regiao-e-cidade/);
  });

  it('peças válidas que o molde não monta gravam sem-molde, não reprovado', async () => {
    const semPonta: FatosDoNome = {
      rota: {
        startAt: '2026-08-15T08:00:00Z',
        distanceM: 42_000,
        elevationM: 300,
        lat0: 50.8, lng0: 4.0, lat1: 50.9, lng1: 4.3,
        cities: [
          { name: 'Ninove', country: 'BE', lat: 50.83, lng: 4.02 },
          { name: '', country: 'BE', lat: 50.9, lng: 4.3 },
        ],
      },
      ancoras: [],
    };
    const { motor, corpos } = nuvemFalsa(corpoBom(JSON.stringify({ justificativa: ['Ninove'] })));
    const { gravar } = await correr(semPonta, { [NUVEM_PADRAO]: motor }, corpos);
    assert.equal(gravar?.nome, null);
    assert.equal(gravar?.meta.recusa, 'sem-molde');
    assert.equal(gravar?.meta.provedor, 'fake');
  });
});

/**
 * `saida-invalida` tem duas origens, e só uma é o modelo (o caso-espelho da
 * revisão da 5.7). A classe é a mesma; o que as separa é a tentativa recusada,
 * que só existe quando houve resposta assinada.
 */
describe('saida-invalida sem ninguém ter escrito — não grava', () => {
  const NAO_E_RESPOSTA: readonly (readonly [string, RespostaDoTransporte])[] = [
    // Um 2xx com HTML de gateway, ou um portal cativo respondendo por cima.
    ['corpo ilegível', { status: 200, corpo: '<html>502 Bad Gateway</html>' }],
    ['resposta sem texto', { status: 200, corpo: { texto: '', provedor: 'fake', modelo: 'fake-1', motivoDeParada: CONCLUSAO } }],
    ['resposta sem assinatura', { status: 200, corpo: { texto: BOA, motivoDeParada: CONCLUSAO } }],
  ];

  for (const [nome, resposta] of NAO_E_RESPOSTA) {
    it(`${nome}: a classe é saida-invalida, e ainda assim nada é gravado`, async () => {
      const { leitura, gravar } = await comNuvem(PAJOTTENLAND, resposta);
      assert.equal(leitura.origem === 'piso' && leitura.causa, 'saida-invalida');
      assert.equal(
        leitura.origem === 'piso' && leitura.recusado,
        undefined,
        'não houve modelo escrevendo: não há tentativa recusada',
      );
      assert.equal(
        gravar,
        null,
        'gravar aqui deixaria a pedalada sem nome para sempre por causa de um soluço de proxy',
      );
    });
  }

  it('e o espelho: a MESMA classe, vinda do modelo, grava', async () => {
    // A diferença é uma só — a resposta assinada. O texto é ilegível nos dois.
    const { leitura, gravar } = await comNuvem(PAJOTTENLAND, corpoBom('não consigo nomear este percurso'));
    assert.equal(leitura.origem === 'piso' && leitura.causa, 'saida-invalida');
    assert.ok(leitura.origem === 'piso' && leitura.recusado, 'houve modelo: a tentativa recusada tem de existir');
    assert.equal(gravar?.meta.recusa, 'ilegivel');
    assert.equal(gravar?.meta.provedor, 'fake');
  });

  it('o truncado é a exceção que confirma a regra: a borda recusa antes, e nada é gravado', async () => {
    // O motivo de parada que não é conclusão para na borda (`ia/nuvem.ts`): o
    // texto nunca chega ao descritor, então não há resposta assinada — e, pela
    // regra acima, não há o que gravar. A pedalada tenta de novo, o que é o certo:
    // um estouro de tokens pode não se repetir no pedido seguinte.
    const { leitura, gravar } = await comNuvem(
      PAJOTTENLAND,
      corpoBom('{"regiao":"Pajotten', { motivoDeParada: 'MAX_TOKENS' }),
    );
    assert.equal(leitura.origem === 'piso' && leitura.causa, 'saida-invalida');
    assert.match(leitura.trilha[leitura.trilha.length - 1].detalhe ?? '', /motivo de parada: MAX_TOKENS/);
    assert.equal(gravar, null);
  });
});

describe('os erros transitórios — nada é gravado', () => {
  const casos: readonly (readonly [string, RespostaDoTransporte])[] = [
    ['rede caiu', { semRede: true, detalhe: 'Network request failed' }],
    ['prazo estourou', { status: 502, corpo: { classe: 'transitoria', detalhe: 'o prazo de 60 s estourou' } }],
    ['function fora', { status: 503, corpo: { classe: 'indisponivel', detalhe: 'sem crédito' } }],
    ['capacidade', { status: 422, corpo: { classe: 'capacidade', detalhe: 'esquema não suportado' } }],
  ];

  for (const [nome, resposta] of casos) {
    it(`${nome}: a leitura cai no piso e metaDaLeitura devolve null`, async () => {
      const { leitura, gravar } = await comNuvem(PAJOTTENLAND, resposta);
      assert.equal(leitura.origem, 'piso');
      assert.equal(gravar, null, 'gravar aqui queimaria a rota para sempre por causa de um timeout');
    });
  }

  it('a pedalada é tentada de novo, e o segundo desfecho é que decide', async () => {
    const { motor, corpos } = nuvemFalsa(
      { semRede: true },
      corpoBom(BOA),
    );
    const primeira = await correr(PAJOTTENLAND, { [NUVEM_PADRAO]: motor }, corpos);
    assert.equal(primeira.gravar, null);
    const segunda = await correr(PAJOTTENLAND, { [NUVEM_PADRAO]: motor }, corpos);
    assert.equal(segunda.gravar?.nome, 'Tour du Pajottenland');
  });
});

describe('a preferência do dono', () => {
  it('o aparelho escolhido num build sem a ponte não recua para a nuvem', async () => {
    const { motor, corpos } = nuvemFalsa(corpoBom(BOA));
    // O aparelho não tem motor neste build; a nuvem tem. A exposição não sobe:
    // a cadeia resolvida para o aparelho vai só até ele, e o piso é a ausência.
    const c = await correr(PAJOTTENLAND, { [NUVEM_PADRAO]: motor }, corpos, APARELHO_SISTEMA);
    assert.deepEqual(
      c.leitura.trilha.map((t) => [t.motor, t.desfecho, t.sintetica]),
      [[APARELHO_SISTEMA, 'indisponivel', true]],
    );
    assert.equal(c.corpos.length, 0, 'a nuvem foi chamada para um recurso cuja preferência era o aparelho');
    assert.equal(c.leitura.origem === 'piso' && c.leitura.causa, 'indisponivel');
    assert.ok(c.leitura.origem === 'piso' && 'ausencia' in c.leitura);
    assert.equal(c.gravar, null);
  });

  it('sem preferência, a cadeia é a nuvem e o piso', () => {
    assert.deepEqual([...resolverCadeia(descritorDoNomeDeRota, null, CATALOGO)], [NUVEM_PADRAO, SEM_MODELO]);
  });
});

describe('o anel', () => {
  it('recebe um evento por execução, com o recurso e a versão do descritor', async () => {
    const { eventos } = await comNuvem(PAJOTTENLAND, corpoBom(BOA));
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].recurso, 'nome-de-rota');
    assert.equal(eventos[0].versaoDoDescritor, 2);
    assert.equal(eventos[0].modo, 'produto');
  });

  it('a recusa permanente leva o pedido junto — é nele que a investigação começa', async () => {
    const { eventos } = await comNuvem(PAJOTTENLAND, corpoBom('prosa'));
    assert.ok(eventos[0].pedido, 'o anel ficou sem o corpo do pedido que falhou');
    assert.equal(eventos[0].causa, 'saida-invalida');
  });
});
