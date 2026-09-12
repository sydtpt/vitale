/**
 * O transporte da bancada — a chamada, e o que ela devolve ao núcleo.
 *
 * **Nenhum teste aqui abre rede:** a chamada é injetada. O que se prova é que o
 * transporte entrega ao núcleo o que ele espera — status e corpo, ou a falta de
 * rede — e que a tradução para classe de falha, que é do núcleo, chega inteira
 * pela composição.
 *
 * O nome da function não é escrito à mão em nenhuma asserção: ele vem de
 * `enderecoDaFunction`, que é o dono dele. Um teste que repetisse o literal seria
 * a segunda cópia que a guarda (1) existe para impedir.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NUVEM_PADRAO, SEM_MODELO, criarMotorDeNuvem, type Falha, type Pedido, type Resposta } from '@vitale/shared';
import { OMITIDO, SEM_NENHUM_MOTOR, enderecoDaFunction, motoresDaBancada, transporteDaNuvem, type Buscar } from './motores.ts';

const URL_DO_PROJETO = 'https://projeto.supabase.co';
const TOKEN = 'jwt-do-usuario-que-nunca-aparece-em-detalhe';
const ANON = 'chave-anonima';

const PEDIDO: Pedido = {
  sistema: 'as regras',
  usuario: 'o caso',
  amostragem: 'gulosa',
  saida: { tipo: 'texto' },
  guardrails: 'padrao',
};

const CORPO_BOM = {
  texto: 'Nos últimos 7 dias, a duração fica abaixo das outras.',
  provedor: 'prov-a',
  modelo: 'modelo-1',
  motivoDeParada: 'STOP',
  tokens: { entrada: 310, saida: 24 },
};

/** Uma chamada falsa que grava o que recebeu e devolve o que o teste mandar. */
function chamada(resultado: { status: number; corpo?: unknown; cru?: string } | { lanca: unknown }) {
  const vistas: { url: string; init: { method: string; headers: Readonly<Record<string, string>>; body: string } }[] = [];
  const buscar: Buscar = async (url, init) => {
    vistas.push({ url, init });
    if ('lanca' in resultado) throw resultado.lanca;
    const cru = resultado.cru ?? JSON.stringify(resultado.corpo ?? {});
    return { status: resultado.status, text: async () => cru };
  };
  return { buscar, vistas };
}

const ehFalha = (x: Resposta | Falha): x is Falha => 'classe' in x;

/** O item `i` de uma lista, provando que ele existe. */
function um<T>(xs: readonly T[], i = 0): T {
  const x = xs[i];
  assert.ok(x !== undefined, `a lista não tem item ${i}`);
  return x;
}

/** Chama o motor de nuvem inteiro — transporte + tradução do núcleo. */
async function pelaNuvem(resultado: Parameters<typeof chamada>[0]): Promise<{ saida: Resposta | Falha; vistas: ReturnType<typeof chamada>['vistas'] }> {
  const { buscar, vistas } = chamada(resultado);
  const motor = criarMotorDeNuvem(transporteDaNuvem(URL_DO_PROJETO, async () => TOKEN, ANON, buscar));
  return { saida: await motor(PEDIDO), vistas };
}

describe('a chamada', () => {
  it('é POST no endereço da function, com o JWT do usuário e a chave anônima', async () => {
    const { vistas } = await pelaNuvem({ status: 200, corpo: CORPO_BOM });
    assert.equal(vistas.length, 1);
    const vista = vistas[0];
    assert.ok(vista);
    const { url, init } = vista;
    assert.equal(url, enderecoDaFunction(URL_DO_PROJETO));
    assert.ok(url.includes('/functions/v1/'), url);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Authorization'], `Bearer ${TOKEN}`);
    assert.equal(init.headers['apikey'], ANON);
    assert.equal(init.headers['Content-Type'], 'application/json');
  });

  it('manda o corpo que a function lê: o par e a intenção de JSON', async () => {
    const { vistas } = await pelaNuvem({ status: 200, corpo: CORPO_BOM });
    assert.deepEqual(JSON.parse(um(vistas).init.body), {
      sistema: PEDIDO.sistema,
      usuario: PEDIDO.usuario,
      json: false,
    });
  });

  it('a barra sobrando na URL do projeto não duplica no endereço', () => {
    assert.equal(enderecoDaFunction(`${URL_DO_PROJETO}///`), enderecoDaFunction(URL_DO_PROJETO));
  });
});

describe('status e corpo viram classe', () => {
  it('2xx bem formado é resposta assinada, com os tokens', async () => {
    const { saida } = await pelaNuvem({ status: 200, corpo: CORPO_BOM });
    assert.equal(ehFalha(saida), false, JSON.stringify(saida));
    const r = saida as Resposta;
    assert.equal(r.texto, CORPO_BOM.texto);
    assert.deepEqual(r.assinatura, { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' });
    assert.deepEqual(r.tokens, CORPO_BOM.tokens);
  });

  /** A tabela que a 5.4 exercita de ponta a ponta — a dona dela é `ia/nuvem.ts`. */
  const PORTAO: readonly (readonly [number, string])[] = [
    [401, 'indisponivel'], // o gateway, antes de a function rodar (verify_jwt)
    [403, 'indisponivel'],
    [503, 'indisponivel'], // provedor não configurado
    [413, 'janela'],       // prompt_muito_longo
    [400, 'capacidade'],   // json_invalido, prompt_vazio
    [422, 'capacidade'],
    [429, 'transitoria'],
    [502, 'transitoria'],  // quem falhou foi o provedor
    [504, 'transitoria'],
  ];

  for (const [status, classe] of PORTAO) {
    it(`HTTP ${status} é ${classe}`, async () => {
      const { saida } = await pelaNuvem({ status, corpo: { error: 'o que a function disse' } });
      assert.ok(ehFalha(saida));
      assert.equal((saida as Falha).classe, classe);
      assert.ok((saida as Falha).detalhe?.includes(`HTTP ${status}`));
      assert.equal((saida as Falha).naoMapeado, undefined);
    });
  }

  it('status fora da tabela é transitoria, e o anel fica sabendo', async () => {
    const { saida } = await pelaNuvem({ status: 418, corpo: { error: 'bule' } });
    assert.equal((saida as Falha).classe, 'transitoria');
    assert.equal((saida as Falha).naoMapeado, true);
  });

  it('classe no corpo decide, qualquer que seja o status (a 5.6)', async () => {
    const { saida } = await pelaNuvem({ status: 422, corpo: { classe: 'recusa-do-modelo', detalhe: 'o modelo recusou' } });
    assert.equal((saida as Falha).classe, 'recusa-do-modelo');
  });

  it('2xx truncado é saida-invalida, com o motivo cru', async () => {
    const { saida } = await pelaNuvem({ status: 200, corpo: { ...CORPO_BOM, motivoDeParada: 'MAX_TOKENS' } });
    assert.equal((saida as Falha).classe, 'saida-invalida');
    assert.ok((saida as Falha).detalhe?.includes('MAX_TOKENS'));
  });

  it('2xx que não é JSON é saida-invalida — um HTML de gateway não é falta de rede', async () => {
    const { saida } = await pelaNuvem({ status: 200, cru: '<html>502 Bad Gateway</html>' });
    assert.equal((saida as Falha).classe, 'saida-invalida');
  });

  it('2xx vazio é saida-invalida', async () => {
    const { saida } = await pelaNuvem({ status: 200, cru: '   ' });
    assert.equal((saida as Falha).classe, 'saida-invalida');
  });

  it('sem rede é indisponivel, e recua sem aumentar exposição', async () => {
    const { saida } = await pelaNuvem({ lanca: new TypeError('fetch failed') });
    assert.equal((saida as Falha).classe, 'indisponivel');
    assert.ok((saida as Falha).detalhe?.includes('TypeError'));
  });

  it('o JWT e a chave anônima não aparecem em detalhe nenhum, nem quando o erro de rede os carrega', async () => {
    for (const caso of [
      { lanca: new Error(`falhou ao chamar com Bearer ${TOKEN}`) },
      { lanca: new Error(`apikey=${ANON} recusada`) },
      { status: 401, corpo: { error: 'Invalid JWT' } },
      { status: 200, cru: 'nada' },
    ] as const) {
      const { saida } = await pelaNuvem(caso);
      const texto = JSON.stringify(saida);
      assert.equal(texto.includes(TOKEN), false, texto);
      assert.equal(texto.includes(ANON), false, texto);
    }
    // Não-vácuo: a marca entra onde o segredo saiu.
    const { saida } = await pelaNuvem({ lanca: new Error(`Bearer ${TOKEN}`) });
    assert.ok((saida as Falha).detalhe?.includes(OMITIDO), (saida as Falha).detalhe);
  });
});

describe('o motorPara da bancada', () => {
  const { buscar } = chamada({ status: 200, corpo: CORPO_BOM });
  const motorPara = motoresDaBancada({ url: URL_DO_PROJETO, tokenAtual: async () => TOKEN, chaveAnonima: ANON }, buscar);

  it('entrega motor para a nuvem, simbólica e nomeada', () => {
    assert.ok(motorPara(NUVEM_PADRAO));
    assert.ok(motorPara('nuvem:prov-a/modelo-1'));
  });

  it('não entrega motor para o aparelho — é o marco B, e não há ponte aqui', () => {
    assert.equal(motorPara('aparelho:sistema'), undefined);
    assert.equal(motorPara('aparelho:prov-a/pesos'), undefined);
  });

  it('não entrega motor para sem-modelo nem para id ilegível', () => {
    assert.equal(motorPara(SEM_MODELO), undefined);
    assert.equal(motorPara('nuvem:padrao/x' as never), undefined);
    assert.equal(motorPara('nuvem:' as never), undefined);
  });

  it('sem sessão, nenhum motor — é o caminho de --export', () => {
    for (const id of [NUVEM_PADRAO, SEM_MODELO, 'aparelho:sistema'] as const) {
      assert.equal(SEM_NENHUM_MOTOR(id), undefined);
    }
  });
});
