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
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  criarMotorDeNuvem,
  pedidoParaAPonte,
  type Falha,
  type Pedido,
  type Resposta,
} from '@vitale/shared';
import {
  BINARIO_DA_CLI,
  BINARIO_DOS_TESTES,
  ENGINE_SWIFT,
  LINHA_DE_PRONTO,
  MAIN_DA_CLI,
  OMITIDO,
  PRAZO_MS,
  SEM_NENHUM_MOTOR,
  TESTES_DA_CLI,
  abrirProcesso,
  argumentosDoSwiftc,
  carimboDaCompilacao,
  cliDoAparelho,
  enderecoDaFunction,
  maiorDoMacOS,
  motoresDaBancada,
  novoRegistro,
  precisaCompilar,
  transporteDaNuvem,
  type AbrirCanal,
  type Buscar,
  type EventosDoCanal,
  type Preparo,
} from './motores.ts';

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

  // A diferença não é de rótulo: `transitoria` cai no piso sem repetir, e
  // `indisponivel` recua para o próximo elo da cadeia. Enquanto a bancada dizia
  // uma coisa e o app dizia outra, a mesma chamada travada seguia caminhos
  // diferentes no Mac e no iPhone, e a comparação entre as colunas deixava de
  // ser sobre o motor.
  it('prazo estourado é transitoria — a mesma classe que o app usa, não indisponivel', async () => {
    // Uma chamada que nunca responde: só o nosso próprio abort a termina.
    const pendurada: Buscar = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('AbortError: o sinal abortou')));
      });
    const motor = criarMotorDeNuvem(
      transporteDaNuvem(URL_DO_PROJETO, async () => TOKEN, ANON, pendurada, 5),
    );
    const saida = await motor(PEDIDO);
    assert.ok(ehFalha(saida), 'o prazo estourado tem de ser falha');
    assert.equal(saida.classe, 'transitoria');
    assert.match(saida.detalhe ?? '', /prazo/);
  });

  it('o prazo da bancada é o mesmo do app — colunas com prazos diferentes não comparam motor', () => {
    assert.equal(PRAZO_MS, 60_000);
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

  it('sem a CLI do aparelho, o aparelho não tem motor', () => {
    assert.equal(motorPara(APARELHO_SISTEMA), undefined);
    assert.equal(motorPara('aparelho:prov-a/pesos'), undefined);
  });

  it('não entrega motor para sem-modelo nem para id ilegível', () => {
    assert.equal(motorPara(SEM_MODELO), undefined);
    assert.equal(motorPara('nuvem:padrao/x' as never), undefined);
    assert.equal(motorPara('nuvem:' as never), undefined);
  });

  it('o mesmo id dá o mesmo motor; ids diferentes, motores diferentes', () => {
    assert.equal(motorPara(NUVEM_PADRAO), motorPara(NUVEM_PADRAO));
    assert.notEqual(motorPara(NUVEM_PADRAO), motorPara('nuvem:prov-a/modelo-1'));
  });

  /**
   * **O teste que faltava, e o defeito que ele pega.**
   *
   * Passa POR `motoresDaBancada` — não por `criarMotorDeNuvem` montado à mão — e
   * lê o corpo que saiu no fio. Enquanto a bancada devolvia um motor só para todo
   * id de nuvem, `--motor nuvem:prov-a/modelo-1` mandava corpo **sem** `motor`: a
   * function caía no padrão do servidor e o relatório rotulava a coluna com o id
   * nomeado. Medir um modelo e reportar outro corrompe o portão da ADR 0050, que
   * lê exatamente esse relatório.
   */
  it('o id nomeado vai no corpo; NUVEM_PADRAO manda o corpo de sempre', async () => {
    const { buscar: umaChamada, vistas } = chamada({ status: 200, corpo: CORPO_BOM });
    const para = motoresDaBancada(
      { url: URL_DO_PROJETO, tokenAtual: async () => TOKEN, chaveAnonima: ANON },
      umaChamada,
    );

    const nomeado = para('nuvem:prov-a/modelo-1');
    assert.ok(nomeado);
    await nomeado(PEDIDO);
    assert.deepEqual(JSON.parse(um(vistas).init.body), {
      sistema: PEDIDO.sistema,
      usuario: PEDIDO.usuario,
      json: false,
      motor: 'nuvem:prov-a/modelo-1',
    });

    const padrao = para(NUVEM_PADRAO);
    assert.ok(padrao);
    await padrao(PEDIDO);
    // `nuvem:padrao` **é** "o servidor escolhe": mandá-lo no corpo seria pedir ao
    // servidor que resolvesse para o padrão dele, que é o que a ausência já diz.
    const segundo = JSON.parse(um(vistas, 1).init.body);
    assert.equal('motor' in segundo, false, JSON.stringify(segundo));
    assert.deepEqual(segundo, { sistema: PEDIDO.sistema, usuario: PEDIDO.usuario, json: false });
  });

  it('o segredo extra da credencial (o refresh token) é redigido pelo transporte', async () => {
    // Não basta `segredosDe` conhecer o refresh token: ele tem de CHEGAR ao transporte,
    // que é quem escreve `detalhe`. Um refresh vazado dura muito mais que uma hora.
    const REFRESH = 'o-refresh-que-nao-expira';
    const { buscar: queLanca } = chamada({ lanca: new Error(`falhou com ${TOKEN} e ${REFRESH}`) });
    const para = motoresDaBancada(
      { url: URL_DO_PROJETO, tokenAtual: async () => TOKEN, chaveAnonima: ANON, segredos: [ANON, TOKEN, REFRESH] },
      queLanca,
    );
    const motor = para(NUVEM_PADRAO);
    assert.ok(motor);
    const saida = await motor(PEDIDO);
    const texto = JSON.stringify(saida);
    assert.equal(texto.includes(REFRESH), false, texto);
    assert.equal(texto.includes(TOKEN), false, texto);
    assert.ok(texto.includes(OMITIDO));
  });

  it('SEM_NENHUM_MOTOR não entrega nada', () => {
    for (const id of [NUVEM_PADRAO, SEM_MODELO, APARELHO_SISTEMA] as const) {
      assert.equal(SEM_NENHUM_MOTOR(id), undefined);
    }
  });

  it('sem sessão (o caminho de --export), a nuvem não tem motor e o aparelho tem', () => {
    const cli = cliDoAparelho({ preparar: () => ({ ok: true }), abrir: canalFalso(() => BOA_DA_PONTE).abrir });
    const para = motoresDaBancada(null, undefined, undefined, cli.transporte);
    assert.equal(para(NUVEM_PADRAO), undefined);
    assert.equal(para('nuvem:prov-a/modelo-1'), undefined);
    assert.ok(para(APARELHO_SISTEMA));
    assert.equal(para(APARELHO_SISTEMA), para(APARELHO_SISTEMA), 'o mesmo id dá o mesmo motor');
    // A linha `model:` da ponte (pesos nomeados) é a F5: aqui não tem motor.
    assert.equal(para('aparelho:prov-a/pesos'), undefined);
    assert.equal(para(SEM_MODELO), undefined);
  });

  it('com sessão, as duas: a nuvem pelo transporte HTTP e o aparelho pela CLI', () => {
    const cli = cliDoAparelho({ preparar: () => ({ ok: true }), abrir: canalFalso(() => BOA_DA_PONTE).abrir });
    const para = motoresDaBancada(
      { url: URL_DO_PROJETO, tokenAtual: async () => TOKEN, chaveAnonima: ANON },
      chamada({ status: 200, corpo: CORPO_BOM }).buscar,
      undefined,
      cli.transporte,
    );
    assert.ok(para(NUVEM_PADRAO));
    assert.ok(para(APARELHO_SISTEMA));
    assert.notEqual(para(NUVEM_PADRAO), para(APARELHO_SISTEMA));
  });
});

/* ── o aparelho: a CLI, com o processo injetado — nenhum teste chama swift ── */

/** A linha que a ponte escreve numa resposta boa. */
const BOA_DA_PONTE = JSON.stringify({
  buildDoSistema: '26A428',
  modelo: 'modelo-do-sistema',
  plataforma: 'macOS 27.0',
  provedor: 'prov-a',
  texto: 'Nos últimos 7 dias, a duração fica abaixo das outras.',
  tokens: { entrada: 71, saida: 5 },
});

/**
 * Um processo de mentira que fala o protocolo da CLI: nasce pronto (ou não), recebe
 * `{id, pedido}` e responde `{id, linha}`. `responder` devolve a linha da ponte para o
 * pedido, ou `null` para ficar calado.
 */
function canalFalso(responder: (pedido: string, n: number) => string | null, o: { readonly nasce?: Preparo | 'nunca' } = {}) {
  const abertos: { recebidas: string[]; ids: number[]; encerrado: boolean; eventos: EventosDoCanal }[] = [];
  let n = 0;
  const abrir: AbrirCanal = (eventos) => {
    const aberto = { recebidas: [] as string[], ids: [] as number[], encerrado: false, eventos };
    abertos.push(aberto);
    const nasce = o.nasce ?? { ok: true };
    return {
      pronto: nasce === 'nunca' ? new Promise<Preparo>(() => undefined) : Promise.resolve(nasce),
      escrever: (linha) => {
        const { id, pedido } = JSON.parse(linha) as { id: number; pedido: string };
        aberto.recebidas.push(pedido);
        aberto.ids.push(id);
        const r = responder(pedido, n);
        n += 1;
        // Como o processo de verdade: a resposta chega depois, noutro tique.
        if (r !== null) setImmediate(() => eventos.aoLinha(JSON.stringify({ id, linha: JSON.parse(r) as unknown })));
      },
      encerrar: () => {
        aberto.encerrado = true;
      },
    };
  };
  return { abrir, abertos };
}

const lida = (linha: string): Record<string, unknown> => JSON.parse(linha) as Record<string, unknown>;
const pronta = (): Preparo => ({ ok: true, compilador: 'Apple Swift version 6.4' });

describe('a CLI do aparelho, com o processo de mentira', () => {
  it('um processo vivo para a corrida inteira: compila uma vez, abre uma vez, um id por pedido', async () => {
    let preparos = 0;
    const falso = canalFalso(() => BOA_DA_PONTE);
    const cli = cliDoAparelho({
      preparar: () => {
        preparos += 1;
        return pronta();
      },
      abrir: falso.abrir,
    });
    for (let i = 0; i < 3; i += 1) assert.equal(await cli.transporte(`pedido ${i}`), BOA_DA_PONTE);
    assert.equal(preparos, 1);
    assert.equal(falso.abertos.length, 1, 'abriu um processo por pedido — mediria a carga, não o motor');
    assert.deepEqual(falso.abertos[0]?.recebidas, ['pedido 0', 'pedido 1', 'pedido 2']);
    assert.equal(new Set(falso.abertos[0]?.ids).size, 3, 'dois pedidos com o mesmo id');
    cli.encerrar();
    assert.equal(falso.abertos[0]?.encerrado, true);
  });

  it('preparar compila, abre e espera o processo nascer — antes da medição, com o compilador', async () => {
    const falso = canalFalso(() => BOA_DA_PONTE);
    const cli = cliDoAparelho({ preparar: pronta, abrir: falso.abrir });
    assert.deepEqual(await cli.preparar(), pronta());
    assert.equal(falso.abertos.length, 1, 'preparar não abriu o processo');
    assert.equal(await cli.transporte('pedido'), BOA_DA_PONTE);
    assert.equal(falso.abertos.length, 1, 'o pedido abriu outro processo');
    cli.encerrar();
  });

  it('CLI que não compila: indisponivel com o motivo, memorizado, sem abrir nada — e é do hospedeiro', async () => {
    let preparos = 0;
    const registro = novoRegistro();
    const falso = canalFalso(() => BOA_DA_PONTE);
    const cli = cliDoAparelho({
      preparar: (): Preparo => {
        preparos += 1;
        return { ok: false, motivo: 'a CLI do aparelho não compilou: error: cannot find FoundationModels' };
      },
      abrir: falso.abrir,
      registro,
    });
    assert.equal((await cli.preparar()).ok, false);
    for (let i = 0; i < 2; i += 1) {
      const f = lida(await cli.transporte('pedido'));
      assert.equal(f['classe'], 'indisponivel');
      assert.match(String(f['detalhe']), /não compilou/);
    }
    assert.equal(preparos, 1);
    assert.equal(falso.abertos.length, 0);
    assert.equal(registro.doHospedeiro, 2);
  });

  it('o processo que não nasce (binário ausente, dyld): indisponivel, memorizado — nunca transitoria', async () => {
    const falso = canalFalso(() => BOA_DA_PONTE, { nasce: { ok: false, motivo: 'a CLI do aparelho morreu ao iniciar: saiu com 134 · dyld: Library not loaded' } });
    const cli = cliDoAparelho({ preparar: pronta, abrir: falso.abrir });
    const p = await cli.preparar();
    assert.equal(p.ok, false);
    for (let i = 0; i < 2; i += 1) {
      const f = lida(await cli.transporte('pedido'));
      assert.equal(f['classe'], 'indisponivel');
      assert.equal(f['naoMapeado'], undefined);
      assert.match(String(f['detalhe']), /dyld/);
    }
    assert.equal(falso.abertos.length, 1, 'tentou nascer de novo a cada pedido');
  });

  it('o processo que abre e nunca diz que está pronto: indisponivel no prazo', async () => {
    const falso = canalFalso(() => BOA_DA_PONTE, { nasce: 'nunca' });
    const cli = cliDoAparelho({ preparar: pronta, abrir: falso.abrir, prazoMs: 20 });
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'indisponivel');
    assert.match(String(f['detalhe']), /não ficou pronta/);
    assert.equal(falso.abertos[0]?.encerrado, true);
  });

  it('abrir que lança é indisponivel, memorizado', async () => {
    let tentativas = 0;
    const cli = cliDoAparelho({
      preparar: pronta,
      abrir: () => {
        tentativas += 1;
        throw new Error('spawn EACCES');
      },
    });
    for (let i = 0; i < 2; i += 1) {
      const f = lida(await cli.transporte('pedido'));
      assert.equal(f['classe'], 'indisponivel');
      assert.match(String(f['detalhe']), /EACCES/);
    }
    assert.equal(tentativas, 1);
  });

  it('CLI que trava: transitoria no prazo, do hospedeiro; o processo morre, o próximo abre outro — e é frio', async () => {
    const registro = novoRegistro();
    const falso = canalFalso((_p, n) => (n === 1 ? null : BOA_DA_PONTE));
    const cli = cliDoAparelho({ preparar: pronta, abrir: falso.abrir, prazoMs: 20, registro });
    assert.equal(await cli.transporte('o primeiro'), BOA_DA_PONTE);
    assert.equal(registro.frias, 1, 'o primeiro pedido de um processo novo é frio');
    const f = lida(await cli.transporte('o que trava'));
    assert.equal(f['classe'], 'transitoria');
    assert.match(String(f['detalhe']), /prazo/);
    assert.equal(f['naoMapeado'], undefined, 'estouro de prazo é reconhecido, não é caso novo');
    assert.equal(registro.doHospedeiro, 1);
    assert.equal(registro.frias, 1, 'o segundo pedido do mesmo processo não é frio');
    assert.equal(falso.abertos[0]?.encerrado, true, 'o processo travado não foi encerrado');
    assert.equal(await cli.transporte('o seguinte'), BOA_DA_PONTE);
    assert.equal(falso.abertos.length, 2, 'o próximo pedido não abriu processo novo');
    assert.equal(registro.frias, 2, 'o primeiro depois do reinício não saiu frio');
    cli.encerrar();
  });

  it('a resposta atrasada do processo morto não vira a resposta do próximo pedido', async () => {
    const pendurados: EventosDoCanal[] = [];
    let aberturas = 0;
    const abrir: AbrirCanal = (eventos) => {
      aberturas += 1;
      const este = aberturas;
      return {
        pronto: Promise.resolve({ ok: true }),
        escrever: (linha) => {
          const { id } = JSON.parse(linha) as { id: number };
          if (este === 1) pendurados.push(eventos); // o primeiro processo não responde a tempo
          else setImmediate(() => eventos.aoLinha(JSON.stringify({ id, linha: JSON.parse(BOA_DA_PONTE) as unknown })));
        },
        encerrar: () => undefined,
      };
    };
    const cli = cliDoAparelho({ preparar: pronta, abrir, prazoMs: 20 });
    assert.equal(lida(await cli.transporte('primeiro'))['classe'], 'transitoria');
    const segundo = cli.transporte('segundo');
    // O processo velho acorda agora, com a resposta velha — e o fim dele chega junto.
    pendurados[0]?.aoLinha(JSON.stringify({ id: 1, linha: { classe: 'guarda', detalhe: 'a resposta velha' } }));
    pendurados[0]?.aoFim('saiu com SIGTERM');
    assert.equal(await segundo, BOA_DA_PONTE);
  });

  it('o processo que morre no meio do pedido: transitoria não mapeada, do hospedeiro', async () => {
    const registro = novoRegistro();
    const abertos: EventosDoCanal[] = [];
    const abrir: AbrirCanal = (eventos) => {
      abertos.push(eventos);
      return {
        pronto: Promise.resolve({ ok: true }),
        escrever: (linha) => {
          const { id } = JSON.parse(linha) as { id: number };
          if (abertos.length === 1) setImmediate(() => eventos.aoFim('saiu com 132 · Illegal instruction'));
          else setImmediate(() => eventos.aoLinha(JSON.stringify({ id, linha: JSON.parse(BOA_DA_PONTE) as unknown })));
        },
        encerrar: () => undefined,
      };
    };
    const cli = cliDoAparelho({ preparar: pronta, abrir, registro });
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'transitoria');
    assert.equal(f['naoMapeado'], true);
    assert.match(String(f['detalhe']), /Illegal instruction/);
    assert.equal(registro.doHospedeiro, 1);
    // E a corrida continua: o próximo pedido abre outro processo.
    assert.equal(await cli.transporte('pedido'), BOA_DA_PONTE);
    assert.equal(abertos.length, 2);
  });

  it('a resposta com outro id: transitoria, e o processo que saiu do protocolo é encerrado', async () => {
    let aberturas = 0;
    const encerrados: number[] = [];
    const abrir: AbrirCanal = (eventos) => {
      aberturas += 1;
      const este = aberturas;
      return {
        pronto: Promise.resolve({ ok: true }),
        escrever: (linha) => {
          const { id } = JSON.parse(linha) as { id: number };
          const respondido = este === 1 ? id + 41 : id;
          setImmediate(() => eventos.aoLinha(JSON.stringify({ id: respondido, linha: JSON.parse(BOA_DA_PONTE) as unknown })));
        },
        encerrar: () => {
          encerrados.push(este);
        },
      };
    };
    const cli = cliDoAparelho({ preparar: pronta, abrir });
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'transitoria');
    assert.match(String(f['detalhe']), /fora do protocolo/);
    assert.deepEqual(encerrados, [1]);
    assert.equal(await cli.transporte('pedido'), BOA_DA_PONTE, 'o próximo pedido não abriu processo novo');
  });

  it('um pedido por vez: dois pedidos simultâneos saem em fila, cada um com a sua resposta', async () => {
    const recebidos: string[] = [];
    let emVoo = 0;
    let maxEmVoo = 0;
    const abrir: AbrirCanal = (eventos) => ({
      pronto: Promise.resolve({ ok: true }),
      escrever: (linha) => {
        const { id, pedido } = JSON.parse(linha) as { id: number; pedido: string };
        recebidos.push(pedido);
        emVoo += 1;
        maxEmVoo = Math.max(maxEmVoo, emVoo);
        setTimeout(() => {
          emVoo -= 1;
          eventos.aoLinha(JSON.stringify({ id, linha: { classe: 'guarda', detalhe: `resposta a ${pedido}` } }));
        }, 5);
      },
      encerrar: () => undefined,
    });
    const cli = cliDoAparelho({ preparar: pronta, abrir });
    const [a, b] = await Promise.all([cli.transporte('A'), cli.transporte('B')]);
    assert.equal(lida(a)['detalhe'], 'resposta a A');
    assert.equal(lida(b)['detalhe'], 'resposta a B');
    assert.deepEqual(recebidos, ['A', 'B']);
    assert.equal(maxEmVoo, 1, 'dois pedidos ficaram em voo ao mesmo tempo');
  });

  it('de ponta a ponta pelo motorPara: a string de serializarPedido vai, a Resposta do aparelho volta', async () => {
    const falso = canalFalso(() => BOA_DA_PONTE);
    const cli = cliDoAparelho({ preparar: pronta, abrir: falso.abrir });
    const motor = motoresDaBancada(null, undefined, undefined, cli.transporte)(APARELHO_SISTEMA);
    assert.ok(motor);
    const r = await motor(PEDIDO);
    assert.ok(!('classe' in r), JSON.stringify(r));
    assert.equal((r as Resposta).assinatura.tipo, 'aparelho');
    assert.equal((r as Resposta).assinatura.buildDoSistema, '26A428');
    assert.deepEqual(falso.abertos[0]?.recebidas, [pedidoParaAPonte(PEDIDO)]);
    cli.encerrar();
  });

  it('encerrar sem processo aberto não lança', () => {
    cliDoAparelho({ preparar: pronta, abrir: canalFalso(() => null).abrir }).encerrar();
  });
});

describe('a nuvem conta o que o próprio transporte fabricou', () => {
  it('prazo estourado e falta de rede são do hospedeiro; o que a function devolveu, não', async () => {
    const registro = novoRegistro();
    const pendurada: Buscar = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    const para = (buscar: Buscar) =>
      motoresDaBancada({ url: URL_DO_PROJETO, tokenAtual: async () => TOKEN, chaveAnonima: ANON }, buscar, 5, undefined, registro)(NUVEM_PADRAO)!;
    await para(pendurada)(PEDIDO);
    assert.equal(registro.doHospedeiro, 1, 'o prazo estourado não contou');
    await para(chamada({ lanca: new TypeError('fetch failed') }).buscar)(PEDIDO);
    assert.equal(registro.doHospedeiro, 2, 'a falta de rede não contou');
    await para(chamada({ status: 502, corpo: { classe: 'transitoria', detalhe: 'o provedor caiu' } }).buscar)(PEDIDO);
    await para(chamada({ status: 200, corpo: CORPO_BOM }).buscar)(PEDIDO);
    assert.equal(registro.doHospedeiro, 2, 'o que a function devolveu contou como do hospedeiro');
  });
});

/* ── o processo de verdade, sem Swift: o Node faz o papel da CLI ── */

describe('abrirProcesso, com um processo de verdade', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-cli-falsa-'));
  const script = (nome: string, corpo: string): string => {
    const caminho = join(dir, nome);
    writeFileSync(caminho, corpo, 'utf8');
    return caminho;
  };
  const CABECALHO = `
    const readline = require('node:readline');
    const escrever = (x, depois) => process.stdout.write(JSON.stringify(x) + '\\n', depois);
    const BOA = ${BOA_DA_PONTE};
  `;
  const eco = script('eco.js', `${CABECALHO}
    process.stdout.write(${JSON.stringify(LINHA_DE_PRONTO)} + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (l) => {
      const { id, pedido } = JSON.parse(l);
      escrever({ id, linha: { ...BOA, texto: 'eco: ' + pedido } });
    });
  `);
  const morreAoNascer = script('dyld.js', `
    process.stderr.write('dyld[4242]: Library not loaded: /System/Library/Frameworks/FoundationModels.framework\\n');
    process.exit(134);
  `);
  const morreNoMeio = script('morre.js', `${CABECALHO}
    process.stdout.write(${JSON.stringify(LINHA_DE_PRONTO)} + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', () => {
      process.stderr.write('Fatal error: o modelo explodiu\\n', () => process.exit(3));
    });
  `);
  const linhaAMais = script('a-mais.js', `${CABECALHO}
    process.stdout.write(${JSON.stringify(LINHA_DE_PRONTO)} + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (l) => {
      const { id } = JSON.parse(l);
      escrever({ id, linha: BOA });
      escrever({ id: 999, linha: { classe: 'guarda', detalhe: 'a linha que ninguém pediu' } });
    });
  `);
  const respondeESai = script('responde-e-sai.js', `${CABECALHO}
    process.stdout.write(${JSON.stringify(LINHA_DE_PRONTO)} + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (l) => {
      const { id } = JSON.parse(l);
      escrever({ id, linha: BOA }, () => process.exit(0));
    });
  `);
  const node = (arquivo: string): AbrirCanal => abrirProcesso(process.execPath, [arquivo]);

  it('nasce, diz que está pronto, e responde pelo id', async () => {
    const cli = cliDoAparelho({ preparar: pronta, abrir: node(eco) });
    assert.equal((await cli.preparar()).ok, true);
    const r = lida(await cli.transporte('um pedido'));
    assert.equal(r['texto'], 'eco: um pedido');
    assert.equal(lida(await cli.transporte('outro'))['texto'], 'eco: outro');
    cli.encerrar();
  });

  it('o caminho que não existe: indisponivel, pelo evento de erro do spawn', async () => {
    const cli = cliDoAparelho({ preparar: pronta, abrir: abrirProcesso('/caminho/que/nao/existe/aparelho') });
    const p = await cli.preparar();
    assert.equal(p.ok, false);
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'indisponivel');
    assert.equal(f['naoMapeado'], undefined);
    assert.match(String(f['detalhe']), /ENOENT/);
  });

  it('o binário que morre ao iniciar (o dyld): indisponivel com a saída de erro, memorizado', async () => {
    const cli = cliDoAparelho({ preparar: pronta, abrir: node(morreAoNascer) });
    const p = await cli.preparar();
    assert.equal(p.ok, false);
    assert.ok(!p.ok && /Library not loaded/.test(p.motivo), JSON.stringify(p));
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'indisponivel');
    assert.match(String(f['detalhe']), /morreu ao iniciar.*134/);
  });

  it('o processo que morre no meio do pedido: transitoria não mapeada, com a saída de erro inteira', async () => {
    const cli = cliDoAparelho({ preparar: pronta, abrir: node(morreNoMeio) });
    const f = lida(await cli.transporte('pedido'));
    assert.equal(f['classe'], 'transitoria');
    assert.equal(f['naoMapeado'], true);
    assert.match(String(f['detalhe']), /saiu com 3 · Fatal error: o modelo explodiu/);
    cli.encerrar();
  });

  it('a linha a mais derruba o processo, e o próximo pedido tem a resposta dele — nunca a sobra', async () => {
    const cli = cliDoAparelho({ preparar: pronta, abrir: node(linhaAMais) });
    assert.equal(await cli.transporte('primeiro'), BOA_DA_PONTE);
    const segundo = lida(await cli.transporte('segundo'));
    // Ou o processo novo respondeu, ou a divergência foi pega — a sobra nunca vira resposta.
    assert.notEqual(segundo['detalhe'], 'a linha que ninguém pediu');
    cli.encerrar();
  });

  it('a última resposta boa sobrevive ao processo sair logo depois — o fim é o close, não o exit', async () => {
    // Um processo por rodada: cada um responde e sai na mesma hora. No `exit`, o `stdout`
    // ainda podia estar sem drenar, e a resposta boa virava "caiu no meio do pedido".
    for (let i = 0; i < 5; i += 1) {
      const cli = cliDoAparelho({ preparar: pronta, abrir: node(respondeESai) });
      assert.equal(await cli.transporte(`pedido ${i}`), BOA_DA_PONTE, `a resposta ${i} virou "caiu no meio do pedido"`);
      cli.encerrar();
    }
  });
});

describe('a compilação da CLI (sem compilar nada)', () => {
  const carimbo = carimboDaCompilacao('Apple Swift version 6.4', ['-O']);

  it('compila quando o binário falta, quando um fonte é mais novo, ou quando o carimbo mudou', () => {
    const base = { binario: 10, fontes: [1, 2], carimboGravado: carimbo, carimboAtual: carimbo };
    assert.equal(precisaCompilar(base), false);
    assert.equal(precisaCompilar({ ...base, binario: null }), true);
    assert.equal(precisaCompilar({ ...base, fontes: [1, 11] }), true, 'o Engine.swift editado depois mediria a ponte velha');
    assert.equal(precisaCompilar({ ...base, carimboGravado: null }), true, 'binário sem carimbo é de toolchain desconhecido');
    assert.equal(
      precisaCompilar({ ...base, carimboAtual: carimboDaCompilacao('Apple Swift version 6.5', ['-O']) }),
      true,
      'trocar o Xcode não recompilou',
    );
    assert.equal(
      precisaCompilar({ ...base, carimboAtual: carimboDaCompilacao('Apple Swift version 6.4', ['-Onone']) }),
      true,
      'trocar um argumento não recompilou',
    );
  });

  it('o macOS pelo sw_vers, e pelo Darwin quando ele falta', () => {
    assert.equal(maiorDoMacOS('27.0\n', '26.0.0'), 27);
    assert.equal(maiorDoMacOS('26.4.1', '25.4.0'), 26);
    assert.equal(maiorDoMacOS(null, '26.0.0'), 27);
    assert.equal(maiorDoMacOS(null, '25.1.0'), 26);
    assert.equal(maiorDoMacOS(null, '24.6.0'), null, 'Darwin 24 é o macOS 15 — antes do salto, e sem modelo');
    assert.equal(maiorDoMacOS('lixo', 'lixo'), null);
  });

  it('swiftc direto sobre os fontes, sem cópia nem pacote, com o alvo e os mesmos argumentos nos dois binários', () => {
    const args = argumentosDoSwiftc(BINARIO_DA_CLI, [ENGINE_SWIFT, MAIN_DA_CLI], 'arm64');
    assert.deepEqual(args.slice(-2), [ENGINE_SWIFT, MAIN_DA_CLI]);
    assert.equal(args[args.indexOf('-o') + 1], BINARIO_DA_CLI);
    assert.equal(args[args.indexOf('-target') + 1], 'arm64-apple-macos26.0');
    assert.ok(args.includes('-O') && args.includes('-parse-as-library'));
    const x64 = argumentosDoSwiftc('b', ['f'], 'x64');
    assert.equal(x64[x64.indexOf('-target') + 1], 'x86_64-apple-macos26.0');
    assert.equal(args.some((a) => /Package\.swift/.test(a)), false);
    // O dos testes é o mesmo, fora a saída e os fontes.
    const dosTestes = argumentosDoSwiftc(BINARIO_DOS_TESTES, [ENGINE_SWIFT, TESTES_DA_CLI], 'arm64');
    assert.deepEqual(dosTestes.slice(0, dosTestes.indexOf('-o')), args.slice(0, args.indexOf('-o')));
  });

  it('o aparelho:testar passa pelos mesmos argumentos — não há swiftc escrito à mão no package.json', () => {
    const pacote = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const testar = pacote.scripts['aparelho:testar'] ?? '';
    assert.equal(/swiftc/.test(testar), false, testar);
    assert.match(testar, /bancada\/aparelho\/testar\.ts/);
    assert.match(readFileSync(join(__dirname, 'aparelho', 'testar.ts'), 'utf8'), /prepararBinario\(BINARIO_DOS_TESTES/);
  });

  it('o Engine.swift é o do módulo do app — o mesmo arquivo, não uma cópia', () => {
    const raiz = join(__dirname, '..', '..');
    assert.equal(relative(raiz, ENGINE_SWIFT).split(sep).join('/'), 'mobile/modules/on-device-engine/ios/Engine.swift');
    assert.ok(existsSync(ENGINE_SWIFT), 'o Engine.swift sumiu');
    assert.ok(existsSync(MAIN_DA_CLI), 'o main.swift da CLI sumiu');
    assert.ok(existsSync(TESTES_DA_CLI), 'o testes.swift sumiu');
  });

  it('os binários moram em .build/, e o .gitignore o cobre', () => {
    const raiz = join(__dirname, '..', '..');
    for (const b of [BINARIO_DA_CLI, BINARIO_DOS_TESTES]) {
      assert.match(relative(raiz, b).split(sep).join('/'), /^scripts\/bancada\/aparelho\/\.build\//);
    }
    const ignorados = readFileSync(join(raiz, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    assert.ok(ignorados.includes('scripts/bancada/aparelho/.build/'), 'o .gitignore não cobre a saída do swiftc');
  });
});
