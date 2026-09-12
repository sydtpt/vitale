/**
 * A bancada — o executável (story 5.4, marco A).
 *
 *     pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --ajuda
 *
 * As bandeiras são declaradas uma vez em {@link BANDEIRAS}, e é de lá que sai tanto o
 * texto de `--ajuda` quanto a leitura delas — um JSDoc que as repetisse seria a
 * segunda lista, e divergiria na primeira bandeira nova.
 *
 * **Duas entradas, e é o que separa os portões.** Com credencial, a bancada puxa o
 * acervo de produção e mede. Com `--export <dir>`, ela mede sobre um export que já
 * está no disco — o manifesto dele diz o `hoje` — e não abre rede nenhuma: a coluna
 * sem modelo fecha por esse caminho, em qualquer máquina. A coluna da nuvem exige o
 * JWT do dono, e é portão dele.
 *
 * **Sem credencial, ela para antes de abrir rede e nomeia as variáveis que
 * faltam.** Nada é gravado em disco e nada é impresso — nem em log de erro.
 *
 * **O que sai daqui:** o export e os relatórios vão para diretório ignorado pelo
 * git; o único arquivo versionado é o `manifesto.json` ao lado deste — janelas,
 * `hoje`, contagens e hashes, sem dado de saúde. O `stdout` imprime contagens, não
 * frases: a frase é leitura de saúde dele, e mora no relatório.
 *
 * **O limiar do portão não está aqui.** Nenhum número deste arquivo aprova motor,
 * fixa nota de corte ou recomenda padrão: isso é do dono, lendo o relatório.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { platform, release } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { SEM_MODELO, isValidDate, lerMotorId, localDateStr, type MotorId } from '@vitale/shared';
import {
  ARQUIVO_DO_MANIFESTO,
  conferirAcervoContraManifesto,
  exportarAcervo,
  lerAcervoDoDisco,
  manifestoDoExport,
  type Acervo,
} from './exportar.ts';
import {
  LIMITE_DA_AMOSTRA,
  amostraDaNuvem,
  enumerarJanelas,
  passosPorAlcance,
  type JanelaClassificada,
} from './janelas.ts';
import { RECURSO, VERSAO_DO_DESCRITOR, medir } from './medir.ts';
import { PRAZO_MS, SEM_NENHUM_MOTOR, motoresDaBancada } from './motores.ts';
import {
  compararRelatorios,
  hashCurto,
  montarManifesto,
  montarRelatorio,
  relatorioEmMarkdown,
  type Manifesto,
  type Relatorio,
  type SistemaDaMedicao,
} from './relatorio.ts';
import { abrirSessao, avisoDeValidade, comoSeAutenticar, lerCredenciais, type Sessao } from './supabase.ts';

/* ── as bandeiras ────────────────────────────────────────────────────────── */

/** A versão do critério da amostra — entra no hash do manifesto (ver `relatorio.ts`). */
const VERSAO_DA_REGRA_DE_AMOSTRA = 1;

/**
 * Acima deste número de chamadas de nuvem, a execução exige um "sim" explícito.
 *
 * A amostra padrão são 28 chamadas; `--limite 999` sobre 387 janelas são centenas, e
 * cada uma é paga. O teto não impede nada — só obriga a dizer que o gasto é
 * intencional, com a conta na tela antes de a primeira sair.
 */
const TETO_DE_CHAMADAS = 60;

const SIM = '--sim-gastar-chamadas';

interface Bandeiras {
  readonly hoje: string | null;
  readonly motores: readonly MotorId[];
  readonly limite: number;
  readonly soExportar: boolean;
  readonly export: string | null;
  readonly comparar: readonly string[];
  readonly simGastar: boolean;
  readonly ajuda: boolean;
}

/** A fonte única das bandeiras: a leitura e o `--ajuda` saem desta lista. */
const BANDEIRAS = [
  { nome: '--hoje', arg: 'AAAA-MM-DD', ajuda: 'o dia local da leitura (padrão: hoje; com --export, o do manifesto)' },
  { nome: '--motor', arg: '<MotorId>', ajuda: 'uma coluna de modelo a mais (repetível, ou por vírgula)' },
  { nome: '--limite', arg: '<n>', ajuda: `janelas por caso × alcance na amostra da nuvem (padrão ${LIMITE_DA_AMOSTRA})` },
  { nome: '--so-exportar', arg: null, ajuda: 'exporta o acervo e o manifesto, e não mede' },
  { nome: '--export', arg: '<dir>', ajuda: 'mede sobre um export já em disco, sem abrir rede' },
  { nome: '--comparar', arg: '<a.json> <b.json>', ajuda: 'compara dois relatórios do mesmo manifesto e sai' },
  { nome: SIM, arg: null, ajuda: `confirma uma corrida acima de ${TETO_DE_CHAMADAS} chamadas de nuvem` },
  { nome: '--ajuda', arg: null, ajuda: 'mostra isto (também --help)' },
] as const;

function ajuda(): string {
  const rotulo = (b: (typeof BANDEIRAS)[number]): string => (b.arg ? `${b.nome} ${b.arg}` : b.nome);
  const largura = Math.max(...BANDEIRAS.map((b) => rotulo(b).length));
  return [
    'bancada — mede a leitura da Saúde do sono, motor por motor, sobre o acervo real.',
    '',
    ...BANDEIRAS.map((b) => `  ${rotulo(b).padEnd(largura)}  ${b.ajuda}`),
    '',
    'A coluna sem-modelo roda sempre e mede todas as janelas. Sem --motor, nenhuma',
    'chamada de nuvem sai. O relatório carrega dado de saúde e fica fora do git.',
  ].join('\n');
}

/**
 * O valor de uma bandeira. Valor **vazio** é recusado junto com o ausente: num
 * shell, `--limite "$N"` com `N` não exportado chega aqui como `''`, e `Number('')`
 * é 0 — a coluna da nuvem se desligaria em silêncio por causa de uma variável que
 * ninguém definiu.
 */
function valorDe(argv: readonly string[], i: number, bandeira: string): string {
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--') || v.trim() === '') throw new Error(`${bandeira} precisa de um valor`);
  return v;
}

export function lerBandeiras(argv: readonly string[]): Bandeiras {
  let hoje: string | null = null;
  let limite = LIMITE_DA_AMOSTRA;
  let soExportar = false;
  let doDisco: string | null = null;
  let simGastar = false;
  let pedeAjuda = false;
  const motores: MotorId[] = [];
  const comparar: string[] = [];
  // Bandeira repetida é recusada: "o último ganha" faz um `--limite 2 --limite 40`
  // medir 40 sem dizer nada, e o manifesto registra o que ninguém pediu.
  const vistas = new Set<string>();
  const umaVez = (nome: string): void => {
    if (vistas.has(nome)) throw new Error(`${nome} aparece mais de uma vez`);
    vistas.add(nome);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    switch (a) {
      case '--hoje':
        umaVez(a);
        hoje = valorDe(argv, i, a);
        i += 1;
        break;
      case '--motor': {
        const crus = valorDe(argv, i, a).split(',').map((x) => x.trim()).filter((x) => x !== '');
        if (crus.length === 0) throw new Error(`${a} precisa de um valor`);
        for (const cru of crus) {
          // Id que não se lê é erro de quem chamou, e não "motor indisponível": a
          // diferença entre os dois é exatamente o que a bancada existe para medir.
          if (!lerMotorId(cru)) throw new Error(`--motor ${cru} não é um MotorId (sem-modelo, aparelho:…, nuvem:…)`);
          if (!motores.includes(cru as MotorId)) motores.push(cru as MotorId);
        }
        i += 1;
        break;
      }
      case '--limite': {
        umaVez(a);
        // Só algarismos: `1.5`, `2e1`, `0x2` e ` 2 ` não são "um inteiro escrito",
        // e aceitá-los por coerção é deixar o manifesto dizer outro número.
        const cru = valorDe(argv, i, a);
        if (!/^\d+$/.test(cru)) throw new Error(`--limite tem de ser um inteiro >= 0, e veio ${JSON.stringify(cru)}`);
        limite = Number(cru);
        i += 1;
        break;
      }
      case '--so-exportar':
        umaVez(a);
        soExportar = true;
        break;
      case '--export':
        umaVez(a);
        doDisco = valorDe(argv, i, a);
        i += 1;
        break;
      case '--comparar':
        umaVez(a);
        comparar.push(valorDe(argv, i, a), valorDe(argv, i + 1, a));
        i += 2;
        break;
      case SIM:
        umaVez(a);
        simGastar = true;
        break;
      case '--ajuda':
      case '--help':
        pedeAjuda = true;
        break;
      default:
        throw new Error(`bandeira desconhecida: ${a}`);
    }
  }
  if (hoje !== null && !isValidDate(hoje)) throw new Error(`--hoje tem de ser um dia AAAA-MM-DD real, e veio ${hoje}`);
  // O manifesto registraria um motor que ninguém mediu.
  if (soExportar && motores.some((m) => m !== SEM_MODELO)) {
    throw new Error('--so-exportar não mede nada, então --motor não pode vir com ele');
  }
  return { hoje, motores, limite, soExportar, export: doDisco, comparar, simGastar, ajuda: pedeAjuda };
}

/* ── o destino ───────────────────────────────────────────────────────────── */

const DIR_DA_BANCADA = __dirname;
/** O manifesto versionado: o único arquivo da bancada que entra no git. */
const MANIFESTO_VERSIONADO = join(DIR_DA_BANCADA, ARQUIVO_DO_MANIFESTO);
/** O único lugar **dentro de um repositório** onde export e relatório podem cair. */
const SAIDA = join(DIR_DA_BANCADA, 'saida');

/** `alvo` está dentro de `base`? Compara por separador: `saida-old` não é filho de `saida`. */
function dentroDe(alvo: string, base: string): boolean {
  return alvo === base || alvo.startsWith(base + sep);
}

/**
 * O caminho real, resolvendo symlink — inclusive de um diretório que ainda não
 * existe: sobe até o primeiro ancestral existente, resolve ele, e recoloca o resto.
 * Sem isso, um link apontando para dentro de um repositório passaria pela conferência.
 */
function caminhoReal(p: string): string {
  const alvo = resolve(p);
  let existente = alvo;
  const resto: string[] = [];
  while (!existsSync(existente)) {
    resto.unshift(basename(existente));
    const pai = dirname(existente);
    if (pai === existente) return alvo;
    existente = pai;
  }
  return resto.length > 0 ? join(realpathSync(existente), ...resto) : realpathSync(existente);
}

/** A raiz do repositório git que contém `de`, ou `null`. Em worktree, `.git` é arquivo. */
function raizDeGit(de: string): string | null {
  let atual = de;
  for (;;) {
    if (existsSync(join(atual, '.git'))) return atual;
    const pai = dirname(atual);
    if (pai === atual) return null;
    atual = pai;
  }
}

/**
 * O destino aceita dado de saúde?
 *
 * Recusa **qualquer** diretório dentro de **algum** repositório git, menos
 * `scripts/bancada/saida/` (que o `.gitignore` cobre). Não basta proteger a árvore em
 * que a bancada roda: este projeto vive em worktrees paralelos, e
 * `--export ~/Projects/life-organizer/tmp` gravaria acervo de saúde dentro de outro
 * clone do mesmo repo — que tem o mesmo `.gitignore` e não ignora `tmp/`.
 *
 * A regra é de caminho real, não de `git check-ignore`: uma checagem que depende de
 * subprocesso é uma checagem que alguém desliga, e o que está em jogo é a invariante
 * de que nenhum dado de saúde de produção entra no git.
 */
export function conferirDestino(dir: string): void {
  const alvo = caminhoReal(dir);
  if (dentroDe(alvo, caminhoReal(SAIDA))) return;
  const raiz = raizDeGit(alvo);
  if (raiz !== null) {
    throw new Error(
      `${alvo} está dentro do repositório git em ${raiz}.\n` +
        '  Export e relatório carregam dado de saúde e não entram no git (AD-8/AD-11) — nem neste clone,\n' +
        `  nem em outro worktree do mesmo projeto. Aponte para um diretório fora de qualquer repositório,\n` +
        `  ou deixe a bancada escolher o padrão dela (${SAIDA}).`,
    );
  }
}

const sistemaDaMedicao = (): SistemaDaMedicao => ({ plataforma: platform(), versao: release() });

/** Precisa de JWT? Exportar precisa; uma coluna de nuvem precisa. */
export function precisaDeRede(b: Pick<Bandeiras, 'export' | 'motores'>): boolean {
  return b.export === null || b.motores.some((m) => lerMotorId(m)?.tipo === 'nuvem');
}

function escrever(dir: string, nome: string, texto: string): string {
  mkdirSync(dir, { recursive: true });
  const caminho = join(dir, nome);
  writeFileSync(caminho, texto, 'utf8');
  return caminho;
}

/**
 * O que a cópia versionada do manifesto é — escrito nela mesma.
 *
 * Ela é a **linha de base da execução padrão**: a coluna sem modelo sobre o acervo
 * inteiro, sem nuvem. Uma corrida com `--motor` tem, por construção, outro manifesto
 * (os motores e o tamanho da amostra entram no hash), e `compararRelatorios` vai
 * recusar comparar as duas — o que é o certo, e não um defeito. Quem lê o arquivo
 * precisa saber disso sem ir ao código.
 */
const LEIA_ME_DO_MANIFESTO = Object.freeze([
  'Linha de base da EXECUÇÃO PADRÃO da bancada: a coluna sem-modelo sobre todas as janelas,',
  'sem nuvem. Só a execução padrão atualiza este arquivo — --so-exportar, --limite fora do',
  'padrão e --export de outro acervo não o tocam, para não apagar a linha de base.',
  'Uma corrida com --motor tem outro hash de propósito (motores e amostra entram no corpo),',
  'e dois relatórios só se comparam com o mesmo hash. Este arquivo não tem dado de saúde:',
  'só contagens, datas e hashes.',
]);

/** A execução é a padrão — a única que pode reescrever a linha de base versionada? */
export function ehExecucaoPadrao(b: Pick<Bandeiras, 'soExportar' | 'limite' | 'motores' | 'export'>): boolean {
  return !b.soExportar && b.limite === LIMITE_DA_AMOSTRA && b.motores.every((m) => m === SEM_MODELO);
}

function gravarManifesto(dir: string, m: Manifesto, padrao: boolean): void {
  escrever(dir, ARQUIVO_DO_MANIFESTO, `${JSON.stringify(m, null, 2)}\n`);
  if (!padrao) return;
  // A cópia versionada, ao lado do código, só da execução padrão.
  writeFileSync(MANIFESTO_VERSIONADO, `${JSON.stringify({ _leia: LEIA_ME_DO_MANIFESTO, ...m }, null, 2)}\n`, 'utf8');
}

/* ── a comparação, pela bandeira ─────────────────────────────────────────── */

function compararArquivos(caminhos: readonly string[]): number {
  const [a, b] = caminhos;
  if (a === undefined || b === undefined) {
    process.stderr.write('--comparar precisa de dois arquivos de relatório\n');
    return 1;
  }
  const ler = (p: string): Relatorio => JSON.parse(readFileSync(p, 'utf8')) as Relatorio;
  const c = compararRelatorios(ler(a), ler(b));
  if (!c.ok) {
    process.stderr.write(`os relatórios não se comparam: ${c.motivo}\n`);
    return 1;
  }
  if (c.iguais) {
    process.stdout.write('os dois relatórios têm o mesmo hash de pedido em toda linha.\n');
    return 0;
  }
  process.stdout.write(`${c.diferencas.length} linha(s) diferem:\n`);
  for (const d of c.diferencas) process.stdout.write(`  ${d}\n`);
  return 1;
}

/* ── o caminho ───────────────────────────────────────────────────────────── */

async function principal(argv: readonly string[]): Promise<number> {
  const b = lerBandeiras(argv);
  if (b.ajuda) {
    process.stdout.write(`${ajuda()}\n`);
    return 0;
  }
  if (b.comparar.length > 0) return compararArquivos(b.comparar);

  /* O destino, antes da rede: é a conferência mais barata e a que protege o git. */
  const dirPedido = b.export;
  if (dirPedido !== null) conferirDestino(dirPedido);

  /* A credencial, antes de qualquer rede. */
  let sessao: Sessao | null = null;
  if (precisaDeRede(b)) {
    const c = lerCredenciais(process.env);
    if (!c.ok) {
      const comoSair =
        dirPedido === null
          ? '  (ou rode com --export <dir> para medir sobre um export já em disco, sem rede)\n'
          : '  (a coluna da nuvem exige o JWT do usuário; sem --motor nenhuma chamada sai)\n';
      process.stderr.write(
        'a bancada não abriu rede:\n' +
          c.faltam.map((v) => `  - falta ${v}\n`).join('') +
          c.problemas.map((p) => `  - ${p}\n`).join('') +
          // Sem nenhum caminho de autenticação, listar variável não basta: quem tem
          // conta do Google precisa saber que a senha não existe para ela.
          (c.semCaminho ? `\n${comoSeAutenticar()}\n\n` : '') +
          comoSair,
      );
      return 1;
    }
    for (const aviso of c.avisos) process.stderr.write(`aviso: ${aviso}\n`);
    sessao = await abrirSessao(c.credenciais);
  }

  try {
    return await medirEEscrever(b, sessao);
  } finally {
    // Para o relógio de renovação do JWT, senão o processo não termina.
    sessao?.fechar();
  }
}

async function medirEEscrever(b: Bandeiras, sessao: Sessao | null): Promise<number> {
  /* O acervo: do disco, ou de produção. */
  let acervo: Acervo;
  let hoje: string;
  let dirDeSaida: string;
  if (b.export !== null) {
    acervo = lerAcervoDoDisco(b.export);
    const doManifesto = manifestoDoExport(b.export);
    // O acervo em disco tem de ser o que o manifesto descreve. Sem isto, dá para
    // trocar o `sleep_periods.json` e medir o acervo novo herdando o `hoje` do
    // manifesto velho — e o relatório sai completo, com cara de resultado.
    if (doManifesto !== null) conferirAcervoContraManifesto(acervo.acervo, doManifesto);
    // O dia da leitura, em ordem de autoridade: a bandeira, o manifesto do export
    // e — só então — a noite mais recente do acervo. A última não é o relógio da
    // máquina de propósito: medir amanhã o export de hoje tem de dar o mesmo
    // manifesto, e um `new Date()` aqui faria as janelas andarem sozinhas entre
    // duas execuções do mesmo arquivo.
    const ultimaNoite = [...acervo.dados.noites].map((p) => p.wakeDay).sort().pop() ?? null;
    const escolhido = b.hoje ?? doManifesto?.hoje ?? ultimaNoite;
    if (escolhido === null) {
      process.stderr.write(
        `${b.export} não tem ${ARQUIVO_DO_MANIFESTO} nem noite gravada, então o dia da leitura não está declarado.\n` +
          '  Passe --hoje AAAA-MM-DD.\n',
      );
      return 1;
    }
    if (b.hoje === null && doManifesto === null) {
      process.stderr.write(
        `aviso: ${b.export} não tem ${ARQUIVO_DO_MANIFESTO}; o dia da leitura saiu da noite mais recente do ` +
          `acervo (${escolhido}). Use --hoje para declarar outro — o manifesto desta execução o fixa.\n`,
      );
    }
    hoje = escolhido;
    dirDeSaida = b.export;
  } else {
    if (sessao === null) throw new Error('sem sessão e sem --export: não há acervo para medir');
    hoje = b.hoje ?? localDateStr();
    dirDeSaida = join(DIR_DA_BANCADA, 'saida', `sono-${hoje}`);
    conferirDestino(dirDeSaida);
    process.stdout.write(`puxando o acervo de sono para ${dirDeSaida}\n`);
    acervo = await exportarAcervo(sessao.db, sessao.userId, dirDeSaida);
  }
  process.stdout.write(
    `acervo: ${acervo.acervo.noites.linhas} noites · ${acervo.acervo.notas.linhas} notas · ` +
      `\`${hashCurto(acervo.acervo.sha256)}\` · hoje ${hoje}\n`,
  );

  /* As janelas e a amostra. */
  const janelas = enumerarJanelas(acervo.dados.noites, acervo.dados.notas, hoje);
  if (janelas.length === 0) {
    process.stderr.write('o acervo não tem noite nenhuma até este dia — não há janela para medir.\n');
    return 1;
  }
  const deModelo = b.motores.filter((m) => m !== SEM_MODELO);
  const amostra: readonly JanelaClassificada[] = deModelo.length > 0 ? amostraDaNuvem(janelas, b.limite) : [];
  const motores: readonly MotorId[] = [SEM_MODELO, ...deModelo];
  const padrao = ehExecucaoPadrao(b);

  const manifesto = montarManifesto({
    recurso: RECURSO,
    versaoDoDescritor: VERSAO_DO_DESCRITOR,
    hoje,
    acervo: acervo.acervo,
    janelas: passosPorAlcance(janelas),
    amostra: {
      regra: 'recentes-por-caso-e-alcance',
      versaoDaRegra: VERSAO_DA_REGRA_DE_AMOSTRA,
      limite: b.limite,
      janelas: amostra.length,
    },
    motores,
  });
  process.stdout.write(
    `janelas: ${manifesto.janelas.map((j) => `${j.range} ${j.passos}`).join(' · ')} (${janelas.length}) · ` +
      `manifesto \`${hashCurto(manifesto.hash)}\`\n`,
  );

  if (b.soExportar) {
    gravarManifesto(dirDeSaida, manifesto, padrao);
    process.stdout.write(`manifesto em ${join(dirDeSaida, ARQUIVO_DO_MANIFESTO)}\n`);
    return 0;
  }

  /* O gasto, declarado antes da primeira chamada. */
  const chamadas = deModelo.length * amostra.length;
  if (deModelo.length > 0) {
    process.stdout.write(
      `colunas de modelo: ${deModelo.join(', ')} · ${amostra.length} janelas cada (${chamadas} chamadas no total)\n`,
    );
    if (chamadas > TETO_DE_CHAMADAS && !b.simGastar) {
      process.stderr.write(
        `${chamadas} chamadas de nuvem passam do teto de ${TETO_DE_CHAMADAS}, e cada uma é paga.\n` +
          `  Se é isso que você quer, repita com ${SIM}. Para medir menos, baixe o --limite.\n`,
      );
      return 1;
    }
  }
  // A validade do token, contra o tamanho da corrida. Só tem o que dizer quando não
  // há como renovar — com refresh token (ou senha), `avisoDeValidade` devolve `null`.
  if (sessao !== null) {
    const aviso = avisoDeValidade({
      expiraEm: sessao.expiraEm,
      podeRenovar: sessao.podeRenovar,
      chamadas,
      prazoMs: PRAZO_MS,
      agora: new Date(),
    });
    if (aviso !== null) process.stderr.write(`aviso: ${aviso}\n`);
  }

  // Pedir o aparelho neste hospedeiro não mede modelo nenhum: não há ponte aqui.
  for (const m of deModelo.filter((x) => lerMotorId(x)?.tipo === 'aparelho')) {
    process.stderr.write(
      `aviso: ${m} não tem motor nesta bancada — a coluna inteira vai sair como tentativa sintética\n` +
        '  `indisponivel`, sem chamada nenhuma. A coluna do aparelho é o marco B (macOS 27 + a ponte Swift).\n',
    );
  }

  const medido = await medir({
    dados: acervo.dados,
    hoje,
    janelas,
    colunas: deModelo.map((motor) => ({ motor, janelas: amostra })),
    hospedeiro: {
      motorPara: sessao ? motoresDaBancada(sessao) : SEM_NENHUM_MOTOR,
    },
    aoAndar: ({ motor, feito, total }) => {
      if (feito === total || feito % 100 === 0) process.stdout.write(`  ${motor}: ${feito}/${total}\n`);
    },
  });

  const geradoEm = new Date().toISOString();
  const relatorio = montarRelatorio({
    recurso: RECURSO,
    sistema: sistemaDaMedicao(),
    manifesto,
    geradoEm,
    pedidos: medido.pedidos,
    colunas: medido.colunas,
  });

  // O instante entra no nome: duas rodadas do MESMO manifesto são exatamente o par
  // que `--comparar` existe para comparar, e um nome só por manifesto apagaria a
  // primeira com a segunda.
  const sufixo = `${hashCurto(manifesto.hash)}-${geradoEm.replace(/[:.]/g, '-')}`;
  const json = escrever(dirDeSaida, `relatorio-${sufixo}.json`, `${JSON.stringify(relatorio, null, 2)}\n`);
  const md = escrever(dirDeSaida, `relatorio-${sufixo}.md`, relatorioEmMarkdown(relatorio));
  gravarManifesto(dirDeSaida, manifesto, padrao);

  for (const c of relatorio.colunas) {
    const a = c.agregados;
    const partes = Object.entries(a.porVeredito).filter(([, n]) => n > 0).map(([v, n]) => `${n} ${v}`);
    process.stdout.write(`  ${c.motor}: ${a.total} linhas — ${partes.join(' · ')}\n`);
  }
  process.stdout.write(`pedidos distintos: ${relatorio.pedidos.length}\n`);
  process.stdout.write(`relatório: ${md}\n           ${json}\n`);
  if (padrao) process.stdout.write(`linha de base versionada: ${MANIFESTO_VERSIONADO}\n`);
  process.stdout.write('o relatório carrega dado de saúde: não versione e não compartilhe.\n');
  process.stdout.write('o limiar do portão é seu: nada aqui o fixou.\n');
  return 0;
}

// Só roda quando este arquivo É o executável: um teste que importe `lerBandeiras`
// não pode disparar uma medição. `require.main`, e não `import.meta`, porque sob
// `nodenext` sem `"type": "module"` este arquivo é CJS — ver o tsconfig.
const ehExecutavel = require.main === module;
if (ehExecutavel) {
  principal(process.argv.slice(2)).then(
    // `exitCode`, não `exit()`: `process.exit` corta a escrita pendente do `stdout`
    // quando ele é um arquivo ou um pipe (`| tee`), e as últimas linhas — justamente
    // os caminhos do relatório — se perdem.
    (codigo) => {
      process.exitCode = codigo;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 1;
    },
  );
}
