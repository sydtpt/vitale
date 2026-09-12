/**
 * A forma do relatório e do manifesto — puro, sem rede e sem disco (AD-11).
 *
 * **O relatório é para o dono ler, e o limiar é dele.** Nada aqui decide nota de
 * corte, aprova motor nem recomenda: o que este módulo faz é pôr, lado a lado e na
 * mesma linha, a frase do template, o **texto cru** do motor e a frase final — é no
 * cru que a paráfrase e o sinônimo que a conferência não pega se esconderiam.
 *
 * **A chave é `{ recurso, motor, sistema, manifesto }`.** A `versao` do sistema sai
 * de `os.release()`; no marco B é ela que vai distinguir a coluna do aparelho, cujo
 * modelo muda com o build do sistema.
 *
 * **O manifesto é o que torna dois relatórios comparáveis**, e é o único arquivo
 * versionado da bancada: `hoje`, as janelas, o hash do export, a regra da amostra,
 * os `MotorId` medidos e a versão do descritor — nenhum dado de saúde. Relatórios
 * de manifestos diferentes **não se comparam**: somar maçã com laranja é pior que
 * não comparar, porque o número sai com cara de resultado.
 *
 * **O que entra no hash é identidade, não prosa.** A regra da amostra entra como
 * identificador estável mais uma versão; o texto que a descreve fica fora, porque
 * reescrever uma frase não pode invalidar todo manifesto anterior.
 *
 * Duas saídas: o JSON é a fonte, o Markdown é a leitura.
 */
import { createHash } from 'node:crypto';
import type { AlcanceDaSaude, Desfecho, MotorId, ProblemaDaConferencia, RecursoId, SonoRange } from '@vitale/shared';
import { CLASSES_DE_FALHA } from '@vitale/shared';
import type { CasoDaSaude, MotivoSemContagem } from '@vitale/shared';
import { ALCANCES_MEDIDOS, type Janela } from './janelas.ts';

/* ── o manifesto ─────────────────────────────────────────────────────────── */

/** Um arquivo do export, descrito sem o conteúdo: nome, linhas e hash. */
export interface ArquivoDoExport {
  readonly arquivo: string;
  readonly linhas: number;
  readonly sha256: string;
}

export interface AcervoDoManifesto {
  readonly noites: ArquivoDoExport;
  readonly notas: ArquivoDoExport;
  /** O hash dos dois juntos — é este que identifica o acervo. */
  readonly sha256: string;
}

/**
 * As regras de amostra que a bancada conhece, por **identificador estável**.
 *
 * O id entra no hash do manifesto; a prosa que o descreve, não. Reescrever a frase
 * de uma regra não pode invalidar todo manifesto anterior — e mudar o *critério* tem
 * de invalidar, o que é o papel da `versaoDaRegra`.
 */
export const REGRAS_DE_AMOSTRA = Object.freeze({
  'recentes-por-caso-e-alcance': 'as mais recentes, por caso × alcance',
  todas: 'todas as janelas do acervo',
} as const);

export type IdDaRegraDeAmostra = keyof typeof REGRAS_DE_AMOSTRA;

export interface AmostraDoManifesto {
  readonly regra: IdDaRegraDeAmostra;
  /** Sobe quando o **critério** muda. A prosa mudando não mexe aqui. */
  readonly versaoDaRegra: number;
  readonly limite: number;
  /** Quantas janelas a amostra escolheu. */
  readonly janelas: number;
}

/** O que o manifesto descreve, antes de ganhar a própria identidade. */
export interface CorpoDoManifesto {
  readonly recurso: RecursoId;
  readonly versaoDoDescritor: number;
  /** O dia local da leitura. Muda a janela, então muda o manifesto. */
  readonly hoje: string;
  readonly acervo: AcervoDoManifesto;
  readonly janelas: readonly { readonly range: SonoRange; readonly passos: number }[];
  readonly amostra: AmostraDoManifesto;
  readonly motores: readonly MotorId[];
}

export interface Manifesto extends CorpoDoManifesto {
  /** sha256 do corpo canônico. Dois relatórios só se comparam com o mesmo. */
  readonly hash: string;
}

/** JSON canônico: chaves ordenadas, `undefined` fora — o mesmo critério do hash do pedido. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => canonico(x)).join(',')}]`;
  const o = v as Record<string, unknown>;
  const chaves = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
}

export function sha256De(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * O manifesto com a identidade dele: mesmo corpo, mesmo hash, em qualquer máquina.
 *
 * Os motores saem **ordenados**: `--motor a --motor b` e `--motor b --motor a` medem
 * a mesma coisa, e uma ordem de bandeira diferente não pode fazer
 * `compararRelatorios` recusar duas rodadas genuinamente comparáveis.
 */
export function montarManifesto(corpo: CorpoDoManifesto): Manifesto {
  const normal: CorpoDoManifesto = { ...corpo, motores: [...corpo.motores].sort() };
  return { ...normal, hash: sha256De(canonico(normal)) };
}

/** O corpo sem o hash — é sobre ele que o digest é calculado, e é o que um teste recalcula. */
export function corpoDoManifesto(m: Manifesto): CorpoDoManifesto {
  const { hash: _hash, ...corpo } = m;
  return corpo;
}

/** O digest de um manifesto já montado, recalculado a partir do corpo dele. */
export function hashDoCorpo(corpo: CorpoDoManifesto): string {
  return sha256De(canonico({ ...corpo, motores: [...corpo.motores].sort() }));
}

/** O hash curto, para nome de arquivo e para o cabeçalho do Markdown. */
export function hashCurto(hash: string): string {
  return hash.slice(0, 12);
}

/* ── as linhas ───────────────────────────────────────────────────────────── */

/**
 * Como uma linha terminou. `template` é a coluna sem modelo (o piso, que não é
 * tentativa); `mudo` é o pedido nulo, em que nenhuma chamada sai. O resto é o
 * `Desfecho` do orquestrador.
 */
export type DesfechoDaLinha = Desfecho | 'template' | 'mudo';

export interface LinhaDoRelatorio {
  readonly range: SonoRange;
  readonly offset: number;
  readonly alcance: AlcanceDaSaude;
  readonly caso: CasoDaSaude['caso'];
  readonly motivo?: MotivoSemContagem;
  /** O hash do pedido pleno, ou o sentinela `SEM_PEDIDO` quando nenhum foi montado. */
  readonly hashDoPedido: string;
  readonly desfecho: DesfechoDaLinha;
  readonly ms: number;
  readonly tokens?: { readonly entrada: number; readonly saida: number };
  /** A frase pronta — só quando a conferência aprovou (ou é o template). */
  readonly frase?: string;
  /** A frase do piso, sempre: é contra ela que o dono julga a do motor. */
  readonly template: string;
  /** O texto que o motor escreveu, com os marcadores, como a conferência o leu. */
  readonly textoDoMotor?: string;
  readonly problemas?: readonly ProblemaDaConferencia[];
  /** Nenhuma chamada saiu: o hospedeiro não entregou o motor, ou o recurso o recusou. */
  readonly sintetica?: true;
  readonly detalhe?: string;
  /** A pilha que o anel recolheu, quando houve defeito. */
  readonly pilha?: string;
}

/* ── os agregados ────────────────────────────────────────────────────────── */

/**
 * O que uma linha virou, no vocabulário em que o dono vai ler o fecho. `falha`
 * junta toda classe de falha e o defeito: a classe exata está em `porClasse`.
 */
export const VEREDITOS = Object.freeze(['aprovada', 'reprovada', 'recusa', 'falha', 'template', 'mudo'] as const);

export type Veredito = (typeof VEREDITOS)[number];

/**
 * O veredito de um desfecho, com `switch` **exaustivo**: um desfecho novo no núcleo
 * não compila aqui até ser classificado. Com `default`, ele entraria como `falha` em
 * silêncio e o fecho do relatório mentiria sobre uma categoria que ninguém leu.
 */
export function vereditoDe(d: DesfechoDaLinha): Veredito {
  switch (d) {
    case 'ok':
      return 'aprovada';
    case 'reprovada':
      return 'reprovada';
    case 'recusa-do-modelo':
      return 'recusa';
    case 'template':
      return 'template';
    case 'mudo':
      return 'mudo';
    case 'indisponivel':
    case 'capacidade':
    case 'janela':
    case 'guarda':
    case 'saida-invalida':
    case 'transitoria':
    case 'defeito':
      return 'falha';
    default: {
      const nunca: never = d;
      throw new TypeError(`desfecho sem veredito: ${String(nunca)}`);
    }
  }
}

const EH_CLASSE_DE_FALHA = (d: DesfechoDaLinha): boolean => (CLASSES_DE_FALHA as readonly string[]).includes(d);

/**
 * A ordem em que os casos aparecem no fecho — do mais específico ao mais vazio.
 *
 * É uma cópia declarada de `CASOS_DA_SAUDE` (`sleep/caso.ts`), e **não um import**:
 * aquele módulo é peça do núcleo de IA, e a bancada só tem liberação para
 * `casoDaSaude` (guarda (7)). O acoplamento não fica solto — `relatorio.test.ts`
 * compara esta lista com a do núcleo, então um caso novo lá derruba o teste aqui.
 */
export const ORDEM_DOS_CASOS: readonly CasoDaSaude['caso'][] = Object.freeze([
  'sem-contagem',
  'medidas-insuficientes',
  'tudo-no-maximo',
  'todas-iguais',
  'uma',
  'duas',
  'fora-do-empate',
]);

export interface ContagemPorCaso {
  readonly caso: CasoDaSaude['caso'];
  readonly total: number;
  readonly porVeredito: Readonly<Record<Veredito, number>>;
}

export interface Agregados {
  readonly total: number;
  readonly porVeredito: Readonly<Record<Veredito, number>>;
  /** Por caso, na ordem canônica de {@link ORDEM_DOS_CASOS} — o fecho que o AC pede. */
  readonly porCaso: readonly ContagemPorCaso[];
  /** Quantas vezes cada regra da conferência **reprovou**. Da mais frequente para a menos. */
  readonly porRegra: readonly { readonly regra: string; readonly vezes: number }[];
  /** Quantas vezes cada classe de falha (e o defeito) apareceu. */
  readonly porClasse: readonly { readonly classe: string; readonly vezes: number }[];
}

function zerado(): Record<Veredito, number> {
  const out = {} as Record<Veredito, number>;
  for (const v of VEREDITOS) out[v] = 0;
  return out;
}

export function agregar(linhas: readonly LinhaDoRelatorio[]): Agregados {
  const porVeredito = zerado();
  const porCaso = new Map<string, { total: number; porVeredito: Record<Veredito, number> }>();
  const porRegra = new Map<string, number>();
  const porClasse = new Map<string, number>();

  for (const l of linhas) {
    const v = vereditoDe(l.desfecho);
    porVeredito[v] += 1;
    const caso = porCaso.get(l.caso) ?? { total: 0, porVeredito: zerado() };
    caso.total += 1;
    caso.porVeredito[v] += 1;
    porCaso.set(l.caso, caso);
    // Só reprovação conta como reprovação. Uma ressalva numa linha aprovada (ou na
    // recusa, que tem problema próprio) entraria como se a regra tivesse barrado algo.
    if (v === 'reprovada') {
      for (const p of l.problemas ?? []) porRegra.set(p.regra, (porRegra.get(p.regra) ?? 0) + 1);
    }
    if (EH_CLASSE_DE_FALHA(l.desfecho) || l.desfecho === 'defeito') {
      porClasse.set(l.desfecho, (porClasse.get(l.desfecho) ?? 0) + 1);
    }
  }

  const ordenar = (m: Map<string, number>): { chave: string; vezes: number }[] =>
    [...m].map(([chave, vezes]) => ({ chave, vezes })).sort((a, b) => (b.vezes - a.vezes) || a.chave.localeCompare(b.chave));

  // Ordem canônica, e o caso fora da lista no fim — um caso novo aparece, não some.
  const conhecidos = ORDEM_DOS_CASOS.filter((c) => porCaso.has(c));
  const estranhos = [...porCaso.keys()].filter((c) => !(ORDEM_DOS_CASOS as readonly string[]).includes(c)).sort();

  return {
    total: linhas.length,
    porVeredito,
    porCaso: [...conhecidos, ...estranhos].map((caso) => {
      const c = porCaso.get(caso)!;
      return { caso: caso as CasoDaSaude['caso'], total: c.total, porVeredito: c.porVeredito };
    }),
    porRegra: ordenar(porRegra).map(({ chave, vezes }) => ({ regra: chave, vezes })),
    porClasse: ordenar(porClasse).map(({ chave, vezes }) => ({ classe: chave, vezes })),
  };
}

/* ── o relatório ─────────────────────────────────────────────────────────── */

export interface PedidoDoRelatorio {
  readonly sistema: string;
  readonly usuario: string;
}

export interface ColunaDoRelatorio {
  readonly motor: MotorId;
  readonly linhas: readonly LinhaDoRelatorio[];
  readonly agregados: Agregados;
}

/** Onde a medição rodou. `versao` é o build do sistema — `os.release()` no Mac. */
export interface SistemaDaMedicao {
  readonly plataforma: string;
  readonly versao: string;
}

export interface Relatorio {
  readonly recurso: RecursoId;
  readonly sistema: SistemaDaMedicao;
  readonly manifesto: Manifesto;
  readonly geradoEm: string;
  /**
   * Os pedidos distintos, por hash — e não um por linha: o pedido é função do
   * alcance, do `range`, do caso e das dimensões, então 387 janelas cabem em
   * poucas dezenas de pedidos, e a deduplicação é ela mesma a prova de que
   * janelas no mesmo caso têm o mesmo hash.
   */
  readonly pedidos: readonly { readonly hash: string; readonly pedido: PedidoDoRelatorio }[];
  readonly colunas: readonly ColunaDoRelatorio[];
}

/** A chave de uma coluna — o que o AC manda o relatório ser chaveado por. */
export function chaveDaColuna(r: Relatorio, motor: MotorId): {
  recurso: RecursoId;
  motor: MotorId;
  sistema: SistemaDaMedicao;
  manifesto: string;
} {
  return { recurso: r.recurso, motor, sistema: r.sistema, manifesto: r.manifesto.hash };
}

export function montarRelatorio(args: {
  readonly recurso: RecursoId;
  readonly sistema: SistemaDaMedicao;
  readonly manifesto: Manifesto;
  readonly geradoEm: string;
  readonly pedidos: Readonly<Record<string, PedidoDoRelatorio>>;
  readonly colunas: readonly { readonly motor: MotorId; readonly linhas: readonly LinhaDoRelatorio[] }[];
}): Relatorio {
  const pedidos: { hash: string; pedido: PedidoDoRelatorio }[] = [];
  for (const hash of Object.keys(args.pedidos).sort()) {
    const pedido = args.pedidos[hash];
    if (pedido !== undefined) pedidos.push({ hash, pedido });
  }
  return {
    recurso: args.recurso,
    sistema: args.sistema,
    manifesto: args.manifesto,
    geradoEm: args.geradoEm,
    pedidos,
    colunas: args.colunas.map((c) => ({ motor: c.motor, linhas: c.linhas, agregados: agregar(c.linhas) })),
  };
}

/* ── a comparação ────────────────────────────────────────────────────────── */

export type Comparacao =
  | { readonly ok: false; readonly motivo: string }
  | { readonly ok: true; readonly iguais: boolean; readonly diferencas: readonly string[] };

const chaveDaLinha = (motor: MotorId, l: LinhaDoRelatorio): string => `${motor} ${l.range}@${l.offset}`;

/**
 * Dois relatórios do **mesmo manifesto**, comparados pelo hash do pedido de cada
 * linha — é o portão de repetibilidade: mesma janela, mesmo caso, mesmo hash.
 *
 * Manifesto diferente é **recusado**, não comparado.
 */
export function compararRelatorios(a: Relatorio, b: Relatorio): Comparacao {
  if (a.manifesto.hash !== b.manifesto.hash) {
    return {
      ok: false,
      motivo:
        `manifestos diferentes (${hashCurto(a.manifesto.hash)} x ${hashCurto(b.manifesto.hash)}): ` +
        'as duas execuções leram janelas, acervo ou motores diferentes, e os números não se somam',
    };
  }
  const hashes = (r: Relatorio): Map<string, string> => {
    const m = new Map<string, string>();
    for (const c of r.colunas) for (const l of c.linhas) m.set(chaveDaLinha(c.motor, l), l.hashDoPedido);
    return m;
  };
  const ma = hashes(a);
  const mb = hashes(b);
  const diferencas: string[] = [];
  for (const [chave, hash] of ma) {
    const outro = mb.get(chave);
    if (outro === undefined) diferencas.push(`${chave}: só na primeira execução`);
    else if (outro !== hash) diferencas.push(`${chave}: ${hashCurto(hash)} x ${hashCurto(outro)}`);
  }
  for (const chave of mb.keys()) if (!ma.has(chave)) diferencas.push(`${chave}: só na segunda execução`);
  return { ok: true, iguais: diferencas.length === 0, diferencas };
}

/* ── o Markdown ──────────────────────────────────────────────────────────── */

/** Texto numa célula de tabela: o `|` escapado e a quebra de linha visível. */
function celula(s: string | undefined): string {
  if (s === undefined || s === '') return '—';
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ');
}

const rotuloDaJanela = (j: Janela): string => (j.offset === 0 ? j.range : `${j.range} ◀${j.offset}`);

function tabela(cabecalho: readonly string[], linhas: readonly (readonly string[])[]): string[] {
  return [
    `| ${cabecalho.join(' | ')} |`,
    `|${cabecalho.map(() => '---').join('|')}|`,
    ...linhas.map((l) => `| ${l.join(' | ')} |`),
  ];
}

/**
 * A cerca de um bloco de código, **maior que a maior sequência de crases do texto**.
 *
 * Três crases dentro de um pedido fechariam a cerca e o resto do relatório viraria
 * prosa — e o pedido é texto que um modelo pode ter influenciado.
 */
function cerca(texto: string): string {
  const maior = Math.max(0, ...[...texto.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(Math.max(3, maior + 1));
}

function blocoDeCodigo(texto: string): string[] {
  const c = cerca(texto);
  return [c, texto, c];
}

function fecho(a: Agregados): string[] {
  const usados = VEREDITOS.filter((v) => a.porVeredito[v] > 0);
  return tabela(
    ['caso', 'total', ...usados],
    a.porCaso.map((c) => [c.caso, String(c.total), ...usados.map((v) => String(c.porVeredito[v]))]),
  ).concat([
    '',
    `Total: ${a.total} — ` + usados.map((v) => `${a.porVeredito[v]} ${v}`).join(' · '),
  ]);
}

function coluna(c: ColunaDoRelatorio): string[] {
  const out: string[] = ['', `## Coluna \`${c.motor}\` — ${c.linhas.length} janelas`, ''];
  out.push('### O fecho, por caso', '', ...fecho(c.agregados), '');

  if (c.agregados.porRegra.length > 0) {
    out.push('### Por regra da conferência (só o que reprovou)', '');
    out.push(...tabela(['regra', 'reprovou'], c.agregados.porRegra.map((r) => [r.regra, String(r.vezes)])), '');
  }
  if (c.agregados.porClasse.length > 0) {
    out.push('### Por classe de falha', '');
    out.push(...tabela(['classe', 'vezes'], c.agregados.porClasse.map((r) => [r.classe, String(r.vezes)])), '');
  }

  out.push(
    '### O piso, o cru do motor e a frase final',
    '',
    'As três colunas de texto são, nesta ordem: **o template** (o piso, que a tela mostra sem ' +
      'modelo), **o cru** (o que o motor escreveu, com os marcadores, exatamente como a conferência ' +
      'o leu) e **a frase final** (o cru com os marcadores trocados pelos fatos — só existe quando a ' +
      'conferência aprovou). É no cru que a paráfrase e o sinônimo que a conferência não pega ' +
      'aparecem.',
    '',
  );
  out.push(
    ...tabela(
      ['janela', 'caso', 'alcance', 'desfecho', 'ms', 'tokens', 'pedido', 'template (piso)', 'cru do motor', 'frase final'],
      c.linhas.map((l) => [
        rotuloDaJanela(l),
        l.motivo ? `${l.caso} (${l.motivo})` : l.caso,
        l.alcance,
        // "nenhuma chamada saiu" não pode parecer um `indisponivel` de rede.
        l.sintetica ? `${l.desfecho} (sintética)` : l.desfecho,
        String(l.ms),
        l.tokens ? `${l.tokens.entrada}/${l.tokens.saida}` : '—',
        l.hashDoPedido.length === 64 ? `\`${hashCurto(l.hashDoPedido)}\`` : celula(l.hashDoPedido),
        celula(l.template),
        celula(l.textoDoMotor ?? l.detalhe),
        celula(l.frase),
      ]),
    ),
    '',
  );

  const reprovadas = c.linhas.filter((l) => (l.problemas ?? []).length > 0);
  if (reprovadas.length > 0) {
    out.push('### Os problemas, regra por regra', '');
    out.push(
      ...tabela(
        ['janela', 'caso', 'desfecho', 'regra', 'detalhe'],
        reprovadas.flatMap((l) =>
          (l.problemas ?? []).map((p) => [rotuloDaJanela(l), l.caso, l.desfecho, p.regra, celula(p.detalhe)]),
        ),
      ),
      '',
    );
  }

  // O defeito é bug de código puro: sem a pilha, quem lê o arquivo não tem o que fazer.
  const defeitos = c.linhas.filter((l) => l.desfecho === 'defeito');
  if (defeitos.length > 0) {
    out.push('### Os defeitos, com a pilha', '');
    for (const l of defeitos) {
      out.push(`**${rotuloDaJanela(l)}** · ${l.caso} · ${l.detalhe ?? 'sem detalhe'}`, '');
      if (l.pilha !== undefined) out.push(...blocoDeCodigo(l.pilha), '');
    }
  }
  return out;
}

/** O relatório para ler. A fonte é o JSON; isto é a leitura. */
export function relatorioEmMarkdown(r: Relatorio): string {
  const m = r.manifesto;
  const out: string[] = [
    `# Bancada — ${r.recurso}`,
    '',
    // O bloco dos pedidos e as colunas de texto trazem as leituras reais do sono.
    '> ⚠️ **Este arquivo carrega dado de saúde.** As frases e os pedidos abaixo contêm as medições ' +
      'reais do sono do dono. Não versionar, não compartilhar, não colar em lugar nenhum. O único ' +
      'arquivo da bancada que pode entrar no git é o `manifesto.json`, que só tem contagens e hashes.',
    '',
    'Medição do orquestrador em modo `medicao`, uma vez por janela e por motor. ' +
      'O limiar do portão **não está aqui**: ele é do dono, lendo isto.',
    '',
    ...tabela(
      ['chave', 'valor'],
      [
        ['recurso', `\`${r.recurso}\` (descritor v${m.versaoDoDescritor})`],
        ['sistema', `${r.sistema.plataforma} ${r.sistema.versao}`],
        ['manifesto', `\`${m.hash}\``],
        ['hoje', m.hoje],
        ['acervo', `${m.acervo.noites.linhas} noites · ${m.acervo.notas.linhas} notas · \`${hashCurto(m.acervo.sha256)}\``],
        [
          'janelas',
          `${m.janelas.map((j) => `${j.range} ${j.passos}`).join(' · ')} (${m.janelas.reduce((s, j) => s + j.passos, 0)})`,
        ],
        [
          'amostra da nuvem',
          `${REGRAS_DE_AMOSTRA[m.amostra.regra]} (\`${m.amostra.regra}\` v${m.amostra.versaoDaRegra}) · ` +
            `limite ${m.amostra.limite} · ${m.amostra.janelas} janelas`,
        ],
        ['motores medidos', m.motores.map((x) => `\`${x}\``).join(', ')],
        ['gerado em', r.geradoEm],
      ],
    ),
  ];
  for (const c of r.colunas) out.push(...coluna(c));

  out.push('', '## Os pedidos, por hash', '');
  out.push(
    'Um pedido por caso × alcance × dimensões nomeadas — o `range` e o passo não entram nele, ' +
      'então janelas no mesmo caso compartilham o hash.',
    '',
  );
  const todasAsLinhas = r.colunas.flatMap((c) => c.linhas);
  for (const { hash, pedido } of r.pedidos) {
    const onde = todasAsLinhas.filter((l) => l.hashDoPedido === hash);
    const casos = [...new Set(onde.map((l) => `${l.caso}/${l.alcance}`))].join(', ');
    out.push(`### \`${hashCurto(hash)}\` — ${onde.length} linhas · ${casos}`, '', ...blocoDeCodigo(pedido.usuario), '');
  }

  // Nada de "igual em todos" sem contar: se houver mais de um, o dono vê cada um.
  const sistemas = [...new Set(r.pedidos.map((p) => p.pedido.sistema))];
  if (sistemas.length === 1) {
    out.push(
      '<details><summary>O <code>sistema</code> do pedido (um só, conferido, em todos os pedidos)</summary>',
      '',
      ...blocoDeCodigo(sistemas[0] ?? '—'),
      '',
      '</details>',
      '',
    );
  } else {
    out.push(`### Os ${sistemas.length} \`sistema\` distintos`, '');
    for (const [i, s] of sistemas.entries()) out.push(`**${i + 1} de ${sistemas.length}**`, '', ...blocoDeCodigo(s), '');
  }

  const medidos = new Set(m.janelas.map((j) => j.range));
  const deFora = ALCANCES_MEDIDOS.filter((a) => !medidos.has(a));
  out.push(
    '## Os alcances',
    '',
    `Medidos, nesta ordem: ${ALCANCES_MEDIDOS.filter((a) => medidos.has(a)).join(', ')}.`,
    '',
    deFora.length > 0
      ? `Sem janela neste acervo (enumerados e vazios): ${deFora.join(', ')}.`
      : 'Todos os alcances enumerados têm janela neste acervo.',
    '',
    'Fora da enumeração, por decisão da bancada: **`ano`** — o acervo cobre dois anos parciais, ' +
      'ambos `sem-contagem`, e o que a tela mostra no seletor de ano já aparece nas outras quatro ' +
      'janelas. O seletor da tela tem cinco alcances; a bancada mede quatro.',
    '',
  );
  return out.join('\n');
}
