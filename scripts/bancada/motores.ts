/**
 * O ponto de injeção da bancada (guarda (1) do `architecture.test.ts`, ADR 0047).
 *
 * **Este é o único arquivo da bancada que nomeia a function**, e o único que
 * constrói transporte. A catraca "uma porta por hospedeiro" reconhece
 * `scripts/<qualquer>/motores.ts`, e é ela que impede a terceira cópia do cliente
 * da `ia-narrar`: o app já teve duas, cada uma lendo o erro do seu jeito, e nas
 * duas o ramo que lia o corpo de erro era código morto.
 *
 * O que mora aqui é só **a chamada**: método, cabeçalho, corpo e a leitura do
 * status. Quem traduz status, corpo, conclusão e assinatura em `Resposta` ou
 * `Falha` é `criarMotorDeNuvem` (`ia/nuvem.ts`), no núcleo — uma tabela com teste,
 * não um `if` por hospedeiro.
 *
 * **Status não-2xx não é exceção**: é dado, e volta como `{ status, corpo }`. Só a
 * ausência de rede volta como `{ semRede: true }` — o que o núcleo traduz em
 * `indisponivel`, que recua sem aumentar exposição. **Estouro de prazo não é
 * ausência de rede**: ele volta como corpo de classe `transitoria`, igual ao app —
 * ver `prazoEstourado`.
 *
 * O token nunca aparece em `detalhe`: o que sobe para diagnóstico é o nome e a
 * mensagem do erro de rede, e o corpo que a function devolveu.
 *
 * **O aparelho entra pelo mesmo ponto** (story 5.10). A ponte é Swift
 * (`mobile/modules/on-device-engine/ios/Engine.swift`), e a bancada a roda por uma CLI
 * local — `swiftc` direto sobre os fontes, sem cópia —, num processo vivo que troca
 * uma linha JSON por pedido. Aqui mora só a chamada: compilar, abrir o processo,
 * escrever a linha, esperar a resposta com prazo. Quem lê a linha é
 * `criarMotorDoAparelho` (`ia/aparelho.ts`), no núcleo. O processo é injetável:
 * nenhum teste chama `swift`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { arch, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  APARELHO_SISTEMA,
  STATUS_POR_CLASSE,
  criarMotorDeNuvem,
  criarMotorDoAparelho,
  formatarMotorId,
  lerMotorId,
  type CorpoDaFalha,
  type Falha,
  type Motor,
  type MotorId,
  type RespostaDoTransporte,
  type Transporte,
  type TransporteDoAparelho,
} from '@vitale/shared';

/** A function de narração. O literal vive aqui, e em mais lugar nenhum da bancada. */
const FUNCTION = 'ia-narrar';

/** O que a bancada manda no corpo da chamada. */
interface ChamadaHttp {
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  /** O prazo. Sem ele, uma function pendurada pendura a medição inteira. */
  readonly signal: AbortSignal;
}

/**
 * O prazo de uma chamada de nuvem.
 *
 * Uma narração de uma frase leva segundos; um minuto é folga larga. O que este teto
 * compra não é velocidade — é **relatório**: sem ele, uma function pendurada para a
 * corrida de 28 chamadas para sempre e nada é escrito no disco. A janela aparece no
 * relatório com a causa, e as outras seguem sendo medidas.
 *
 * O mesmo valor do app (`mobile/src/lib/motores/index.ts`), de propósito: as duas
 * colunas da bancada só comparam motor se o prazo for o mesmo dos dois lados.
 */
export const PRAZO_MS = 60_000;

/** O pedaço de `Response` que o transporte lê. O `fetch` global cabe aqui. */
export interface RespostaHttp {
  readonly status: number;
  text(): Promise<string>;
}

/**
 * A chamada, injetável — é por ela que o teste exercita a tabela de status sem
 * abrir rede. O `fetch` do Node 22 satisfaz esta forma.
 */
export type Buscar = (url: string, init: ChamadaHttp) => Promise<RespostaHttp>;

/** O endereço da function num projeto Supabase. */
export function enderecoDaFunction(url: string): string {
  return `${url.replace(/\/+$/, '')}/functions/v1/${FUNCTION}`;
}

/** A marca que fica no lugar de um segredo, quando ele aparece num diagnóstico. */
export const OMITIDO = '<omitido>';

/** O erro como texto, antes de passar pelo `semSegredo`. */
function mensagem(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/**
 * O segredo fora do diagnóstico.
 *
 * O `detalhe` de uma falha viaja até o relatório e até o anel, e a mensagem de um
 * erro de rede não é nossa: ela pode carregar a URL completa, o cabeçalho ou o que
 * a biblioteca achou de incluir. Um token num relatório é um token vazado, e o
 * relatório é o arquivo que o dono abre e manda para si mesmo. Trocar por marca
 * custa uma linha; confiar na mensagem do `fetch` custa o token.
 */
export function semSegredo(texto: string, segredos: readonly string[]): string {
  let out = texto;
  for (const s of segredos) if (s.length > 0) out = out.split(s).join(OMITIDO);
  return out;
}

/**
 * O estouro do prazo, no vocabulário do núcleo.
 *
 * Cópia deliberada de `prazoEstourado` do app (`mobile/src/lib/motores/index.ts`),
 * e a razão de ela existir dos dois lados é a mesma: `CorpoDaFalha` é a forma
 * declarada de "falha com classe", e a tabela de `traduzirDaNuvem` diz que a classe
 * do corpo decide qualquer que seja o status — então o hospedeiro dizer
 * `transitoria` aqui é **usar** o contrato, não falsificar uma resposta HTTP.
 *
 * `transitoria`, e não `indisponivel`: timeout está na definição de `transitoria`
 * no núcleo ("o mesmo pedido no mesmo motor pode dar certo depois"). A diferença
 * não é de rótulo, é de caminho — `transitoria` cai no piso sem repetir, e
 * `indisponivel` recua para o próximo elo da cadeia. Enquanto a bancada dizia
 * `indisponivel` e o app dizia `transitoria`, a mesma chamada travada produzia
 * caminhos diferentes no Mac e no iPhone, e a comparação entre as duas colunas
 * deixava de ser sobre o motor.
 */
function prazoEstourado(prazoMs: number): RespostaDoTransporte {
  const corpo: CorpoDaFalha = {
    classe: 'transitoria',
    detalhe: `o prazo de ${Math.round(prazoMs / 1000)} s estourou`,
  };
  return doHospedeiro({ status: STATUS_POR_CLASSE.transitoria, corpo });
}

/**
 * As respostas que o próprio transporte fabricou — sem rede, prazo estourado. Pela
 * identidade do objeto, e não pela forma: um 502 de prazo e um 502 da function têm o
 * mesmo corpo, e só um deles é do motor.
 */
const FABRICADAS_AQUI = new WeakSet<object>();

function doHospedeiro(r: RespostaDoTransporte): RespostaDoTransporte {
  FABRICADAS_AQUI.add(r);
  return r;
}

/** A resposta foi fabricada pelo transporte, e não veio da function? */
export function fabricadaPeloHospedeiro(r: RespostaDoTransporte): boolean {
  return FABRICADAS_AQUI.has(r);
}

/**
 * O transporte da nuvem: POST com o JWT do usuário no `Authorization`.
 *
 * O `apikey` vai junto porque é o que o gateway do Supabase exige antes de olhar
 * o JWT; sem ele, o 401 viria do gateway e a medição diria `indisponivel` sem que
 * a function tenha rodado (`verify_jwt = true`, `supabase/config.toml`).
 *
 * Corpo que não é JSON volta como `corpo: undefined` — e o núcleo o lê como
 * `saida-invalida` num 2xx, ou usa só o status num erro. Engolir o erro de
 * `JSON.parse` aqui é o certo: um HTML de gateway não é falha de transporte, é
 * resposta ilegível.
 */
export function transporteDaNuvem(
  url: string,
  /** O JWT **de agora** — função, porque a sessão renova (ver `supabase.ts`). */
  tokenAtual: () => Promise<string>,
  chaveAnonima: string,
  buscar: Buscar = fetch,
  prazoMs: number = PRAZO_MS,
  /** Os outros segredos a redigir — o refresh token, sobretudo, que não expira em uma hora. */
  segredosExtra: readonly string[] = [],
): Transporte {
  const alvo = enderecoDaFunction(url);
  return async (corpo): Promise<RespostaDoTransporte> => {
    let token: string;
    try {
      token = await tokenAtual();
    } catch (e) {
      // A sessão venceu e não renovou: nenhuma chamada sai, e isto não é falha do
      // modelo. `indisponivel` recua sem subir exposição e sem gravar.
      return doHospedeiro({ semRede: true, detalhe: semSegredo(mensagem(e), [chaveAnonima, ...segredosExtra]) });
    }
    // Os dois segredos saem de TODO diagnóstico deste transporte — inclusive do
    // corpo que a function devolveu: se o gateway ecoar o `Authorization` num erro,
    // o JWT desceria até `Falha.detalhe` e até o arquivo que o dono abre.
    const segredos = [token, chaveAnonima, ...segredosExtra];
    const diagnostico = (e: unknown): string => semSegredo(mensagem(e), segredos);

    // O prazo vai por um controle NOSSO, e não por `AbortSignal.timeout`: abortando
    // nós mesmos, sabemos que o aborto foi nosso e classificamos o estouro como
    // `transitoria`. Deixar o runtime abortar devolve um `TimeoutError` que aqui
    // seria indistinguível de "a rede caiu", e viraria `indisponivel` — a classe
    // errada, e a que o app não usa.
    const controle = new AbortController();
    let estourou = false;
    const relogio = setTimeout(() => {
      estourou = true;
      controle.abort();
    }, prazoMs);

    let r: RespostaHttp;
    try {
      r = await buscar(alvo, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: chaveAnonima,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(corpo),
        signal: controle.signal,
      });
    } catch (e) {
      if (estourou) return prazoEstourado(prazoMs);
      // Sem rede de verdade: a chamada nem chegou a ter status.
      return doHospedeiro({ semRede: true, detalhe: diagnostico(e) });
    } finally {
      clearTimeout(relogio);
    }
    let cru = '';
    try {
      cru = await r.text();
    } catch (e) {
      // O status chegou e o corpo não: é resposta, não falta de rede.
      return { status: r.status, corpo: { detalhe: diagnostico(e) } };
    }
    let lido: unknown;
    try {
      lido = cru.trim() === '' ? undefined : JSON.parse(semSegredo(cru, segredos));
    } catch {
      lido = undefined;
    }
    return { status: r.status, corpo: lido };
  };
}

/* ── o que o hospedeiro sabe e o núcleo não ────────────────────────────────── */

/**
 * O que só o hospedeiro sabe de cada chamada: se ela foi servida por um processo recém-
 * aberto (**fria** — o modelo subiu nela), e se a falha que voltou foi gerada **por ele**
 * (prazo estourado, processo que caiu, protocolo divergente, sem rede) e não pelo motor.
 *
 * São contadores, e a medição lê a diferença antes e depois de cada linha: é assim que a
 * informação chega ao relatório sem a porta (`Motor`) ganhar campo nenhum.
 */
export interface RegistroDoHospedeiro {
  frias: number;
  doHospedeiro: number;
}

export function novoRegistro(): RegistroDoHospedeiro {
  return { frias: 0, doHospedeiro: 0 };
}

/* ── o aparelho: a CLI Swift, um processo vivo ─────────────────────────────── */

/**
 * A ponte do aparelho — o mesmo arquivo que o app compila (AD-3). A CLI o compila
 * **sem cópia**: `swiftc` direto sobre este caminho e o `main.swift` dela.
 */
export const ENGINE_SWIFT = join(__dirname, '..', '..', 'mobile', 'modules', 'on-device-engine', 'ios', 'Engine.swift');
/** O laço da CLI: o protocolo `pronto` / `{id, pedido}` / `{id, linha}`. */
export const MAIN_DA_CLI = join(__dirname, 'aparelho', 'main.swift');
/** Os testes da ponte, sem modelo (`aparelho:testar`). */
export const TESTES_DA_CLI = join(__dirname, 'aparelho', 'testes.swift');
/** Onde o `swiftc` escreve — fora do git (`.gitignore`): saída de build local, nunca fonte. */
export const DIR_DA_BUILD = join(__dirname, 'aparelho', '.build');
export const BINARIO_DA_CLI = join(DIR_DA_BUILD, 'aparelho');
export const BINARIO_DOS_TESTES = join(DIR_DA_BUILD, 'testes');

/**
 * O sistema mínimo para o qual a CLI é compilada: o 26, o primeiro que tem o modelo.
 *
 * Com ele, os `#available(…26…)` da ponte são sempre verdadeiros aqui — quem os exerce de
 * fato é o app, que roda em sistema anterior. O que este alvo garante é o outro lado:
 * **todo símbolo do 27 tem de estar atrás de `#available(…27…)`**, senão a CLI não compila
 * — a mesma exigência do build do app, que não pode supor o 27. E o ramo do
 * `GenerationError` (deprecado no 27) compila sem aviso, porque o alvo é anterior à
 * deprecação.
 */
export const ALVO_MINIMO_DA_CLI = 'macos26.0';
/** O maior do macOS em que o modelo do sistema existe. Abaixo dele, nem se compila. */
export const MACOS_MINIMO = 26;

/**
 * Os argumentos do `swiftc`, e só eles — sem `Package.swift`, sem symlink, sem cópia. Os
 * mesmos para a CLI e para os testes (`aparelho:testar`): os dois têm `@main`, e é por
 * isso que vai `-parse-as-library`.
 */
export function argumentosDoSwiftc(saida: string, fontes: readonly string[], cpu: string = arch()): string[] {
  const alvo = `${cpu === 'x64' ? 'x86_64' : cpu}-apple-${ALVO_MINIMO_DA_CLI}`;
  return ['-O', '-swift-version', '6', '-parse-as-library', '-target', alvo, '-o', saida, ...fontes];
}

/**
 * O carimbo de uma compilação: a versão do compilador e os argumentos. Muda o Xcode, muda
 * um argumento — muda o carimbo, e a CLI se refaz. Só o `mtime` não vê troca de toolchain.
 */
export function carimboDaCompilacao(versaoDoSwiftc: string, argumentos: readonly string[]): string {
  return JSON.stringify({ swiftc: versaoDoSwiftc.trim(), argumentos });
}

/**
 * Compila? Quando o binário não existe, quando algum fonte é mais novo que ele — um
 * `Engine.swift` editado mediria a ponte velha —, ou quando o carimbo gravado ao lado
 * dele não é o de agora (outro compilador, outros argumentos).
 */
export function precisaCompilar(a: {
  readonly binario: number | null;
  readonly fontes: readonly number[];
  readonly carimboGravado: string | null;
  readonly carimboAtual: string;
}): boolean {
  return a.binario === null || a.fontes.some((f) => f > a.binario!) || a.carimboGravado !== a.carimboAtual;
}

/**
 * O maior do macOS, pelo `sw_vers -productVersion`; sem ele, pelo Darwin do `os.release()`
 * (o Darwin 25 é o macOS 26, e daí em diante a diferença é um). `null` quando nem um nem
 * outro se lê.
 */
export function maiorDoMacOS(swVers: string | null, release: string): number | null {
  const MAIOR = /^\s*(\d+)(?:\.|\s*$)/;
  const doSwVers = swVers === null ? null : MAIOR.exec(swVers);
  if (doSwVers) return Number(doSwVers[1]);
  const darwin = MAIOR.exec(release);
  return darwin && Number(darwin[1]) >= 25 ? Number(darwin[1]) + 1 : null;
}

/** Pronta, com o compilador que a fez — ou o motivo de não estar, que vira a linha `indisponivel`. */
export type Preparo =
  | { readonly ok: true; readonly compilador?: string }
  | { readonly ok: false; readonly motivo: string };

/** O fim de um texto longo, para caber num `detalhe`. */
function cauda(texto: string, max = 1500): string {
  const t = texto.trim();
  return t.length <= max ? t : `…${t.slice(-max)}`;
}

/** A primeira linha da versão do `swiftc` — o que o relatório mostra. */
function linhaDaVersao(v: string): string {
  return v.trim().split('\n')[0] ?? v.trim();
}

/**
 * Deixa um binário Swift pronto: compila se faltar, se um fonte for mais novo ou se o
 * carimbo mudou. **Não lança** — nem `statSync`, nem `mkdirSync`, nem o `swiftc`: o que dá
 * errado é o motivo da linha `indisponivel`, e a corrida continua nas outras colunas.
 *
 * Só no macOS 26 ou mais novo: a ponte é Swift sobre o modelo do sistema, e fora dele não
 * há o que medir — nem o que compilar.
 */
export function prepararBinario(
  binario: string,
  fontes: readonly string[],
  avisar: (m: string) => void = (m) => process.stderr.write(`${m}\n`),
): Preparo {
  try {
    if (platform() !== 'darwin') {
      return { ok: false, motivo: `a coluna do aparelho só roda no macOS (esta máquina é ${platform()})` };
    }
    const sw = spawnSync('sw_vers', ['-productVersion'], { encoding: 'utf8' });
    const maior = maiorDoMacOS(sw.status === 0 ? sw.stdout : null, release());
    if (maior === null || maior < MACOS_MINIMO) {
      return {
        ok: false,
        motivo: `o modelo do sistema pede macOS ${MACOS_MINIMO} ou mais novo, e esta máquina é ${maior === null ? 'de versão ilegível' : `macOS ${maior}`}`,
      };
    }
    const faltam = fontes.filter((f) => !existsSync(f));
    if (faltam.length > 0) return { ok: false, motivo: `a CLI do aparelho não tem fonte: falta ${faltam.join(', ')}` };

    const versao = spawnSync('swiftc', ['--version'], { encoding: 'utf8' });
    if (versao.error) return { ok: false, motivo: `o swiftc não rodou: ${versao.error.name}: ${versao.error.message}` };
    if (versao.status !== 0) return { ok: false, motivo: `o swiftc --version saiu com ${String(versao.status)}: ${cauda(versao.stderr ?? '')}` };
    const compilador = linhaDaVersao(versao.stdout ?? '');
    const argumentos = argumentosDoSwiftc(binario, fontes);
    const carimboAtual = carimboDaCompilacao(versao.stdout ?? '', argumentos);
    const arquivoDoCarimbo = `${binario}.carimbo`;
    const decisao = {
      binario: existsSync(binario) ? statSync(binario).mtimeMs : null,
      fontes: fontes.map((f) => statSync(f).mtimeMs),
      carimboGravado: existsSync(arquivoDoCarimbo) ? readFileSync(arquivoDoCarimbo, 'utf8') : null,
      carimboAtual,
    };
    if (!precisaCompilar(decisao)) return { ok: true, compilador };

    mkdirSync(dirname(binario), { recursive: true });
    avisar(`compilando ${binario} (swiftc, sem cópia do Engine.swift) — ${compilador}`);
    const r = spawnSync('swiftc', argumentos, { encoding: 'utf8' });
    if (r.error) return { ok: false, motivo: `o swiftc não rodou: ${r.error.name}: ${r.error.message}` };
    if (r.status !== 0) {
      return { ok: false, motivo: `a CLI do aparelho não compilou (swiftc saiu com ${String(r.status)}): ${cauda(r.stderr ?? '')}` };
    }
    // O carimbo só depois do binário: um swiftc que falhou no meio não deixa carimbo novo.
    writeFileSync(arquivoDoCarimbo, carimboAtual, 'utf8');
    return { ok: true, compilador };
  } catch (e) {
    return { ok: false, motivo: `a CLI do aparelho não ficou pronta: ${mensagem(e)}` };
  }
}

/** A CLI da bancada: a ponte e o laço. */
export function prepararCli(avisar?: (m: string) => void): Preparo {
  return prepararBinario(BINARIO_DA_CLI, [ENGINE_SWIFT, MAIN_DA_CLI], avisar);
}

/** O processo vivo, visto do transporte. */
export interface CanalDoAparelho {
  /**
   * Resolve quando o processo **nasceu de verdade**: o sistema o criou (evento `spawn`) e
   * ele escreveu a linha de pronto. Um binário ausente ou sem permissão (o `error` do
   * `spawn`, que chega depois) ou que o `dyld` não carrega (sai antes do `main`) resolve com
   * o motivo — nunca rejeita.
   */
  readonly pronto: Promise<Preparo>;
  escrever(linha: string): void;
  encerrar(): void;
}

/** O que o processo avisa, depois de pronto: cada linha do `stdout`, e o fim dele. */
export interface EventosDoCanal {
  readonly aoLinha: (linha: string) => void;
  readonly aoFim: (motivo: string) => void;
}

/** Abre o processo. Injetável: é por aqui que o teste troca a CLI por um falso. */
export type AbrirCanal = (eventos: EventosDoCanal) => CanalDoAparelho;

/** A linha com que a CLI diz que nasceu. */
export const LINHA_DE_PRONTO = '{"pronto":true}';

/**
 * O `AbrirCanal` de verdade: um executável, com `stdin`/`stdout` por linha.
 *
 * O fim é o `close`, e não o `exit`: no `exit` o `stdout` pode ainda não ter drenado, e a
 * última resposta boa viraria "caiu no meio do pedido" — com a saída de erro cortada.
 */
export function abrirProcesso(executavel: string = BINARIO_DA_CLI, argumentos: readonly string[] = []): AbrirCanal {
  return ({ aoLinha, aoFim }) => {
    let resolverPronto: (p: Preparo) => void = () => undefined;
    const pronto = new Promise<Preparo>((r) => {
      resolverPronto = r;
    });
    let estado: 'nascendo' | 'pronto' | 'fim' = 'nascendo';
    let erros = '';
    let erroDoSpawn: string | null = null;
    const falhouAoNascer = (motivo: string): void => {
      if (estado !== 'nascendo') return;
      estado = 'fim';
      resolverPronto({ ok: false, motivo });
    };

    let filho: ReturnType<typeof spawn>;
    try {
      filho = spawn(executavel, [...argumentos], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      falhouAoNascer(`a CLI do aparelho não abriu: ${mensagem(e)}`);
      return { pronto, escrever: () => undefined, encerrar: () => undefined };
    }
    filho.stderr?.on('data', (d: Buffer) => {
      erros = (erros + d.toString('utf8')).slice(-4000);
    });
    // Escrever num processo que morreu dá EPIPE no `stdin`: quem conta a morte é o `close`.
    filho.stdin?.on('error', () => undefined);
    if (filho.stdout) {
      createInterface({ input: filho.stdout }).on('line', (linha) => {
        if (estado === 'nascendo') {
          if (linha.trim() === LINHA_DE_PRONTO) {
            estado = 'pronto';
            resolverPronto({ ok: true });
          } else {
            falhouAoNascer(`a CLI do aparelho não disse que estava pronta; disse ${JSON.stringify(linha.slice(0, 200))}`);
            filho.kill();
          }
          return;
        }
        if (estado === 'pronto') aoLinha(linha);
      });
    }
    // ENOENT e EACCES não lançam no `spawn`: chegam aqui, depois.
    filho.on('error', (e) => {
      erroDoSpawn = `${e.name}: ${e.message}`;
      falhouAoNascer(`a CLI do aparelho não abriu: ${erroDoSpawn}`);
      if (estado === 'pronto') {
        estado = 'fim';
        aoFim(erroDoSpawn);
      }
    });
    filho.on('close', (codigo, sinal) => {
      const como = `saiu com ${sinal ?? String(codigo)}${erros.trim() ? ` · ${cauda(erros, 600)}` : ''}`;
      if (estado === 'nascendo') {
        falhouAoNascer(erroDoSpawn ? `a CLI do aparelho não abriu: ${erroDoSpawn}` : `a CLI do aparelho morreu ao iniciar: ${como}`);
      } else if (estado === 'pronto') {
        estado = 'fim';
        aoFim(como);
      }
    });
    return {
      pronto,
      escrever: (linha) => {
        filho.stdin?.write(`${linha}\n`);
      },
      encerrar: () => {
        filho.stdin?.end();
        filho.kill();
      },
    };
  };
}

/** A CLI vista pela bancada: o transporte do núcleo, o preparo e o fim do processo. */
export interface CliDoAparelho {
  readonly transporte: TransporteDoAparelho;
  /**
   * Compila (se precisar) e abre o processo, esperando ele dizer que nasceu, **antes** da
   * medição. Sem isto, o primeiro pedido medido carregaria o `swiftc` e o início do
   * processo no `ms` dele — tempo da bancada, não do motor. O modelo em si sobe no primeiro
   * pedido, e essa linha sai marcada `frio`.
   *
   * A falha é memorizada: a CLI que não compila ou não nasce não é tentada de novo, e todo
   * pedido sai `indisponivel` com o motivo.
   */
  preparar(): Promise<Preparo>;
  /** Encerra o processo vivo, se houver. Sem isto o Node não termina. */
  encerrar(): void;
}

/** Uma `Falha` como a linha que a ponte escreveria — é o contrato que o núcleo lê. */
function linhaDeFalha(f: Falha): string {
  return JSON.stringify(f);
}

/**
 * O transporte do aparelho: **um processo vivo**, um pedido por vez, pareado por `id`.
 *
 * Um processo, e não um por pedido: a primeira resposta de um processo novo leva
 * segundos a mais (o modelo sobe), e subir um a cada pedido mediria a carga, não o
 * motor. A sessão continua nova a cada pedido; quem garante é o `Engine.swift`.
 *
 * O que dá errado volta como **linha de falha**, no mesmo contrato da ponte:
 *
 *   a CLI não compila, não abre ou morre ao nascer → indisponivel, com o motivo (memorizado)
 *   nenhuma linha até o prazo                      → transitoria; o processo morre e o próximo pedido abre outro
 *   o processo morre no meio do pedido             → transitoria não mapeada, com a saída de erro dele
 *   a resposta não traz o id do pedido             → transitoria não mapeada; o processo é encerrado
 *
 * Toda linha dessas foi gerada **aqui**, e o `registro` fica sabendo — a medição a tira
 * da conta do motor. O prazo é o mesmo da nuvem ({@link PRAZO_MS}).
 */
export function cliDoAparelho(o: {
  readonly preparar: () => Preparo;
  readonly abrir: AbrirCanal;
  readonly prazoMs?: number;
  readonly registro?: RegistroDoHospedeiro;
}): CliDoAparelho {
  const prazoMs = o.prazoMs ?? PRAZO_MS;
  const registro = o.registro ?? novoRegistro();
  /** Compilou? `null` é "ainda não tentou". */
  let compilado: Preparo | null = null;
  /** A primeira falha ao nascer — memorizada, como a de compilar. */
  let naoNasce: Preparo | null = null;

  interface Esperando {
    readonly id: number;
    readonly responder: (linha: string) => void;
  }
  /** O processo corrente. Cada um tem o seu `esperando`: um fim atrasado não resolve o pedido de outro. */
  interface Vivo {
    readonly canal: CanalDoAparelho;
    esperando: Esperando | null;
    /** Quantos pedidos ele já recebeu — zero quer dizer que o próximo é frio. */
    servidos: number;
  }
  let vivo: Vivo | null = null;
  let proximoId = 0;

  /** Do hospedeiro, não do motor: conta, e vira linha. */
  const doHospedeiro = (f: Falha): string => {
    registro.doHospedeiro += 1;
    return linhaDeFalha(f);
  };

  const derrubar = (v: Vivo): void => {
    if (vivo === v) vivo = null;
    v.esperando = null;
    v.canal.encerrar();
  };

  const abrir = (): Vivo => {
    const novo = { esperando: null, servidos: 0 } as { canal: CanalDoAparelho; esperando: Esperando | null; servidos: number };
    novo.canal = o.abrir({
      aoLinha: (linha) => {
        const e = novo.esperando;
        if (!e) {
          // Linha que ninguém pediu: o processo saiu do protocolo, e não serve mais.
          derrubar(novo);
          return;
        }
        let lido: unknown;
        try {
          lido = JSON.parse(linha);
        } catch {
          lido = undefined;
        }
        const obj = typeof lido === 'object' && lido !== null && !Array.isArray(lido) ? (lido as Record<string, unknown>) : null;
        if (!obj || obj['id'] !== e.id || !Object.prototype.hasOwnProperty.call(obj, 'linha')) {
          derrubar(novo);
          e.responder(doHospedeiro({
            classe: 'transitoria',
            detalhe: `a CLI do aparelho respondeu fora do protocolo (esperava o id ${e.id}): ${linha.slice(0, 200)}`,
            naoMapeado: true,
          }));
          return;
        }
        novo.esperando = null;
        e.responder(JSON.stringify(obj['linha']));
      },
      aoFim: (motivo) => {
        if (vivo === novo) vivo = null;
        const e = novo.esperando;
        novo.esperando = null;
        e?.responder(doHospedeiro({
          classe: 'transitoria',
          detalhe: `a CLI do aparelho caiu no meio do pedido: ${motivo}`,
          naoMapeado: true,
        }));
      },
    });
    return novo;
  };

  /** O processo pronto para o próximo pedido — ou o motivo, memorizado, de não haver um. */
  const garantir = async (): Promise<Preparo> => {
    compilado ??= o.preparar();
    if (!compilado.ok) return compilado;
    if (naoNasce) return naoNasce;
    if (vivo) return compilado;
    let novo: Vivo;
    try {
      novo = abrir();
    } catch (e) {
      naoNasce = { ok: false, motivo: `a CLI do aparelho não abriu: ${mensagem(e)}` };
      return naoNasce;
    }
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const noPrazo = new Promise<Preparo>((r) => {
      relogio = setTimeout(() => r({ ok: false, motivo: `a CLI do aparelho não ficou pronta em ${Math.round(prazoMs / 1000)} s` }), prazoMs);
    });
    const p = await Promise.race([novo.canal.pronto, noPrazo]);
    clearTimeout(relogio);
    if (!p.ok) {
      novo.canal.encerrar();
      naoNasce = p;
      return p;
    }
    vivo = novo;
    return compilado;
  };

  const um = async (pedido: string): Promise<string> => {
    const pronto = await garantir();
    if (!pronto.ok || !vivo) {
      return doHospedeiro({ classe: 'indisponivel', detalhe: pronto.ok ? 'a CLI do aparelho não abriu' : pronto.motivo });
    }
    const atual: Vivo = vivo;
    const id = (proximoId += 1);
    if (atual.servidos === 0) registro.frias += 1;
    atual.servidos += 1;
    return new Promise<string>((resolver) => {
      const relogio = setTimeout(() => {
        if (atual.esperando?.id !== id) return;
        // O processo travado não serve ao próximo pedido: morre, e o próximo abre outro.
        derrubar(atual);
        resolver(doHospedeiro({
          classe: 'transitoria',
          detalhe: `o prazo de ${Math.round(prazoMs / 1000)} s estourou; a CLI do aparelho foi reiniciada`,
        }));
      }, prazoMs);
      atual.esperando = {
        id,
        responder: (linha) => {
          clearTimeout(relogio);
          resolver(linha);
        },
      };
      try {
        atual.canal.escrever(JSON.stringify({ id, pedido }));
      } catch (e) {
        clearTimeout(relogio);
        derrubar(atual);
        resolver(doHospedeiro({ classe: 'transitoria', detalhe: `a CLI do aparelho não recebeu o pedido: ${mensagem(e)}`, naoMapeado: true }));
      }
    });
  };

  // Um pedido por vez: a CLI responde na ordem, e o modelo do sistema não atende dois. O
  // preparo entra na mesma fila, para nunca abrir dois processos.
  let fila: Promise<unknown> = Promise.resolve();
  const enfileirar = <T>(f: () => Promise<T>): Promise<T> => {
    const este = fila.then(f);
    fila = este.catch(() => undefined);
    return este;
  };
  return {
    transporte: (pedido) => enfileirar(() => um(pedido)),
    preparar: () => enfileirar(garantir),
    encerrar: () => {
      const atual = vivo;
      vivo = null;
      atual?.canal.encerrar();
    },
  };
}

/** A CLI de verdade: compila se precisar, e abre o binário. */
export function cliDaBancada(registro: RegistroDoHospedeiro, avisar?: (m: string) => void): CliDoAparelho {
  return cliDoAparelho({ preparar: () => prepararCli(avisar), abrir: abrirProcesso(), registro });
}

/* ── o motorPara da bancada ──────────────────────────────────────────────── */

/**
 * O `motorPara` da bancada: um motor de nuvem **por `MotorId`**, o do aparelho, e
 * nada para o resto.
 *
 * **Um motor por id, e o id vai no corpo** (5.6) — exatamente como o gêmeo do app
 * (`mobile/src/lib/motores/index.ts`). Um motor só, compartilhado entre os ids,
 * era o defeito que esta função tinha: `--motor nuvem:google/modelo-x` mandava
 * corpo **sem** `motor`, a function caía no padrão do servidor, e o relatório
 * rotulava a coluna com o id nomeado. Mediria um modelo e reportaria outro — e é
 * de um relatório desta bancada que sai a aprovação de um motor (ADR 0050), então
 * o portão inteiro herdaria o engano.
 *
 * `nuvem:padrao` é a exceção declarada: ele *é* "o servidor escolhe", então o
 * corpo sai sem `motor` e a function resolve pelo padrão dela — o mesmo corpo de
 * antes da 5.6, que é o que faz as medições já feitas continuarem comparáveis.
 *
 * **A nuvem precisa de sessão; o aparelho, não** (5.10). Sem sessão — o caminho de
 * `--export`, que não abre rede — nenhum id de nuvem tem motor, e o `aparelho:sistema`
 * continua tendo, porque a ponte roda nesta máquina. Pesos nomeados
 * (`aparelho:<provedor>/<pesos>`) não têm motor aqui: a linha `model:` da ponte é a F5.
 * Todo id sem motor vira tentativa sintética `indisponivel` no orquestrador, sem
 * chamada nenhuma.
 */
export function motoresDaBancada(
  s: {
    readonly url: string;
    readonly tokenAtual: () => Promise<string>;
    readonly chaveAnonima: string;
    /** Todo segredo da credencial, para nenhum deles chegar a `detalhe` (a `Sessao` os traz). */
    readonly segredos?: readonly string[];
  } | null,
  buscar?: Buscar,
  prazoMs?: number,
  /** O transporte da CLI do aparelho. Ausente: o aparelho não tem motor nesta corrida. */
  aparelho?: TransporteDoAparelho,
  /** Onde contar as falhas que o transporte da nuvem fabricou (a CLI conta as dela). */
  registro?: RegistroDoHospedeiro,
): (id: MotorId) => Motor | undefined {
  const http = s
    ? transporteDaNuvem(s.url, s.tokenAtual, s.chaveAnonima, buscar, prazoMs, s.segredos ?? [])
    : null;
  const transporte: Transporte | null = http && registro
    ? async (corpo) => {
        const r = await http(corpo);
        if (fabricadaPeloHospedeiro(r)) registro.doHospedeiro += 1;
        return r;
      }
    : http;
  const doAparelho = aparelho ? criarMotorDoAparelho(aparelho) : undefined;
  // Memoizado por id: a corrida pede o mesmo motor a cada janela, e um objeto
  // novo por chamada gastaria a identidade que o relatório usa para agrupar.
  const porId = new Map<string, Motor>();
  return (id) => {
    const lido = lerMotorId(id);
    if (lido?.tipo === 'aparelho') {
      return lido.variante === 'sistema' && formatarMotorId(lido) === APARELHO_SISTEMA ? doAparelho : undefined;
    }
    if (lido?.tipo !== 'nuvem' || transporte === null) return undefined;
    const chave = formatarMotorId(lido);
    const guardado = porId.get(chave);
    if (guardado) return guardado;
    const motor = criarMotorDeNuvem(transporte, lido.variante === 'padrao' ? undefined : chave);
    porId.set(chave, motor);
    return motor;
  };
}

/**
 * O hospedeiro sem motor nenhum. Todo motor pedido vira tentativa sintética
 * `indisponivel` — é o que os testes usam para a coluna que não deve chamar nada.
 */
export const SEM_NENHUM_MOTOR: (id: MotorId) => Motor | undefined = () => undefined;
