/**
 * A forma do relatório e do manifesto — puro, sem rede e sem disco (AD-11).
 *
 * **O relatório é para o dono ler, e o limiar é dele.** Nada aqui decide nota de
 * corte, aprova motor nem recomenda: o que este módulo faz é pôr, lado a lado e na
 * mesma linha, a frase do template, o **texto cru** do motor e a frase final — é no
 * cru que a paráfrase e o sinônimo que a conferência não pega se esconderiam.
 *
 * **A chave é `{ recurso, motor, sistema, manifesto }`.** A `versao` do sistema sai
 * de `os.release()`. A coluna do aparelho, cujo modelo muda com o build do sistema,
 * carrega além disso **quem assinou** cada resposta — a plataforma e o build que a
 * ponte leu em execução (story 5.10) —, e o relatório mostra cada assinatura distinta:
 * versões diferentes nunca se somam.
 *
 * **As quatro medidas da ADR 0050**, por coluna de modelo, e **sem limiar**: aprovação,
 * cobertura por caso × alcance, aprovadas idênticas ao template e mediana por chamada.
 * O número sai; a régua fica na ADR, e a comparação é do dono.
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
import type { AlcanceDaSaude, MotorId, ProblemaDaConferencia, RecursoId, SonoRange } from '@vitale/shared';
import {
  CLASSES_DE_FALHA,
  REGRA_DA_AMOSTRA,
  REGRA_DA_JANELA_MEDIDA,
  SEM_MODELO,
  VEREDITOS,
  agregar,
  decimal,
  foraDaMedida,
  foraEmTexto,
  hashCurto,
  medidasDoPortao,
  porcento,
  resumoDaCobertura,
  segundos,
  type Agregados,
  type AssinaturaDaLinha,
  type DesfechoDaLinha,
  type ForaDaMedida,
  type LinhaDoRelatorio,
  type MedidasDoPortao,
} from '@vitale/shared';
import type { CasoDaSaude } from '@vitale/shared';
import { ALCANCES_MEDIDOS, type Janela } from './janelas.ts';

/*
 * A linha, o fecho e as quatro medidas são do núcleo (story 5.13,
 * `packages/shared/src/bancada/`): a tela de desenvolvimento do iPhone conta a amostra
 * dela pela mesma régua, e dada a mesma lista de linhas os dois dão o mesmo número. Este
 * relatório continua dono do manifesto, da sonda, da comparação e do Markdown — e
 * reexporta a régua pelos nomes com que a bancada sempre a leu.
 */
export {
  MOTIVOS_FORA_DA_MEDIDA,
  ORDEM_DOS_CASOS,
  hashCurto,
  REGRA_DA_JANELA_MEDIDA,
  VEREDITOS,
  agregar,
  foraDaMedida,
  mediana,
  medidasDoPortao,
  vereditoDe,
  type Agregados,
  type AssinaturaDaLinha,
  type ContagemPorCaso,
  type DesfechoDaLinha,
  type ForaDaMedida,
  type LinhaDoRelatorio,
  type MedidasDoPortao,
  type NaAmostra,
  type VereditoDaLinha,
} from '@vitale/shared';

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
  // A regra das colunas de modelo é do núcleo, com a versão ao lado do critério.
  [REGRA_DA_AMOSTRA.id]: REGRA_DA_AMOSTRA.descricao,
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
  /**
   * A sonda de fidelidade, quando pedida (`--sonda`, story 5.10). Ausente é "sem sonda" —
   * e ausente não entra no hash (o JSON canônico omite `undefined`), então todo manifesto
   * anterior à sonda continua com o mesmo hash.
   */
  readonly sonda?: { readonly versaoDoDescritor: number };
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

/* ── a linha da sonda ─────────────────────────────────────────────────────── */

/**
 * Uma linha da sonda de fidelidade (story 5.10): o motor escolheu uma dimensão entre as
 * medidas, e a conferência a comparou com o que o código nomeia.
 *
 * `mudo` é a janela cujo caso não nomeia dimensão nenhuma — não houve pergunta, e a
 * linha não conta. `esperado` é o `nomear` do caso: está na linha para o dono ler a
 * escolha e a resposta certa lado a lado, e **não** decide nada — quem aprova é o
 * `conferir` do descritor.
 */
export interface LinhaDaSonda {
  readonly range: SonoRange;
  readonly offset: number;
  readonly alcance: AlcanceDaSaude;
  readonly caso: CasoDaSaude['caso'];
  readonly hashDoPedido: string;
  readonly desfecho: DesfechoDaLinha;
  readonly ms: number;
  readonly tokens?: { readonly entrada: number; readonly saida: number };
  readonly esperado: readonly string[];
  /**
   * As opções que o motor recebeu — as dimensões medidas. Aqui na ordem da contagem; a ordem
   * embaralhada em que o pedido as deu está no próprio pedido, na seção dos pedidos.
   */
  readonly opcoes: readonly string[];
  /** A dimensão que o motor escolheu, quando a resposta se leu. */
  readonly escolha?: string;
  /** O que o motor devolveu, cru — é o que se lê quando a resposta não se leu. */
  readonly textoDoMotor?: string;
  readonly problemas?: readonly ProblemaDaConferencia[];
  readonly sintetica?: true;
  readonly detalhe?: string;
  readonly pilha?: string;
  readonly assinatura?: AssinaturaDaLinha;
  readonly frio?: true;
  readonly doHospedeiro?: true;
}

/* ── o resumo da sonda ───────────────────────────────────────────────────── */

const EH_CLASSE_DE_FALHA = (d: DesfechoDaLinha): boolean => (CLASSES_DE_FALHA as readonly string[]).includes(d);

/**
 * O fecho da sonda, que **soma**: acertos + escolha errada + fora das opções + outra
 * reprovação + recusas + falhas + defeitos = perguntadas; perguntadas + mudas = janelas.
 *
 * E o acerto que o acaso daria, para ler os acertos contra ele: por pergunta medida,
 * |nomeadas| ÷ |opções| — quem chuta entre três opções com uma certa acerta um terço.
 */
export interface ResumoDaSonda {
  readonly janelas: number;
  readonly mudas: number;
  readonly perguntadas: number;
  readonly acertos: number;
  readonly escolhaErrada: number;
  readonly foraDasOpcoes: number;
  readonly outraReprovacao: number;
  readonly recusas: number;
  readonly falhas: readonly { readonly classe: string; readonly vezes: number }[];
  readonly defeitos: number;
  /** As perguntas que chegaram ao modelo, pela mesma regra da coluna. */
  readonly medidas: number;
  readonly acertoAoAcaso: number;
}

export function resumoDaSonda(linhas: readonly LinhaDaSonda[]): ResumoDaSonda {
  const perguntadas = linhas.filter((l) => l.desfecho !== 'mudo');
  const reprovadasPor = (regra: string): number =>
    perguntadas.filter((l) => l.desfecho === 'reprovada' && l.problemas?.[0]?.regra === regra).length;
  const falhas = new Map<string, number>();
  for (const l of perguntadas) {
    if (EH_CLASSE_DE_FALHA(l.desfecho) && l.desfecho !== 'recusa-do-modelo') falhas.set(l.desfecho, (falhas.get(l.desfecho) ?? 0) + 1);
  }
  const escolhaErrada = reprovadasPor('escolha');
  const foraDasOpcoes = reprovadasPor('fora-das-opcoes');
  const medidas = perguntadas.filter((l) => foraDaMedida(l) === null);
  return {
    janelas: linhas.length,
    mudas: linhas.length - perguntadas.length,
    perguntadas: perguntadas.length,
    acertos: perguntadas.filter((l) => l.desfecho === 'ok').length,
    escolhaErrada,
    foraDasOpcoes,
    outraReprovacao: perguntadas.filter((l) => l.desfecho === 'reprovada').length - escolhaErrada - foraDasOpcoes,
    recusas: perguntadas.filter((l) => l.desfecho === 'recusa-do-modelo').length,
    falhas: [...falhas].map(([classe, vezes]) => ({ classe, vezes })).sort((a, b) => b.vezes - a.vezes || a.classe.localeCompare(b.classe)),
    defeitos: perguntadas.filter((l) => l.desfecho === 'defeito').length,
    medidas: medidas.length,
    acertoAoAcaso: medidas.reduce((soma, l) => soma + (l.opcoes.length > 0 ? l.esperado.length / l.opcoes.length : 0), 0),
  };
}

/** Uma assinatura vista numa coluna, com quantas linhas ela assinou — da leitura e da sonda. */
export interface AssinaturaObservada extends AssinaturaDaLinha {
  readonly leitura: number;
  readonly sonda: number;
}

type ComAssinatura = { readonly assinatura?: AssinaturaDaLinha };

/**
 * As assinaturas distintas de uma coluna. Mais de uma é sinal para o dono: o modelo
 * (ou o build do sistema) mudou no meio da medição, e as linhas não se somam.
 */
export function assinaturasDe(
  leitura: readonly ComAssinatura[],
  sonda: readonly ComAssinatura[] = [],
): AssinaturaObservada[] {
  const porChave = new Map<string, { a: AssinaturaDaLinha; leitura: number; sonda: number }>();
  const contar = (linhas: readonly ComAssinatura[], onde: 'leitura' | 'sonda'): void => {
    for (const { assinatura: a } of linhas) {
      if (!a) continue;
      const chave = JSON.stringify([a.tipo, a.provedor, a.modelo, a.plataforma ?? null, a.buildDoSistema ?? null]);
      const visto = porChave.get(chave) ?? { a, leitura: 0, sonda: 0 };
      visto[onde] += 1;
      porChave.set(chave, visto);
    }
  };
  contar(leitura, 'leitura');
  contar(sonda, 'sonda');
  return [...porChave.values()].map(({ a, leitura: l, sonda: s }) => ({ ...a, leitura: l, sonda: s }));
}

/* ── o relatório ─────────────────────────────────────────────────────────── */

export interface PedidoDoRelatorio {
  readonly sistema: string;
  readonly usuario: string;
}

/** A sonda de uma coluna: as linhas, o fecho delas no vocabulário da coluna, e o resumo que soma. */
export interface SondaDaColuna {
  readonly linhas: readonly LinhaDaSonda[];
  readonly agregados: Agregados;
  readonly resumo: ResumoDaSonda;
}

export interface ColunaDoRelatorio {
  readonly motor: MotorId;
  readonly linhas: readonly LinhaDoRelatorio[];
  readonly agregados: Agregados;
  /** Só em coluna de modelo: os números das quatro condições da ADR 0050, sem limiar. */
  readonly medidas?: MedidasDoPortao;
  /** Só em coluna de modelo: quem assinou as respostas, com a plataforma e o build. */
  readonly assinaturas?: readonly AssinaturaObservada[];
  /** Só com `--sonda`, e só em coluna de modelo. */
  readonly sonda?: SondaDaColuna;
  /** Só na coluna do aparelho: a versão do `swiftc` que compilou a CLI. */
  readonly compilador?: string;
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
  readonly colunas: readonly {
    readonly motor: MotorId;
    readonly linhas: readonly LinhaDoRelatorio[];
    readonly sonda?: readonly LinhaDaSonda[];
    readonly compilador?: string;
  }[];
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
    colunas: args.colunas.map((c): ColunaDoRelatorio => {
      const base = { motor: c.motor, linhas: c.linhas, agregados: agregar(c.linhas) };
      // A régua não é motor: as medidas do portão e a assinatura são só das colunas de modelo.
      if (c.motor === SEM_MODELO) return base;
      return {
        ...base,
        medidas: medidasDoPortao(c.linhas),
        assinaturas: assinaturasDe(c.linhas, c.sonda ?? []),
        ...(c.sonda ? { sonda: { linhas: c.sonda, agregados: agregar(c.sonda), resumo: resumoDaSonda(c.sonda) } } : {}),
        ...(c.compilador !== undefined ? { compilador: c.compilador } : {}),
      };
    }),
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
    for (const c of r.colunas) {
      for (const l of c.linhas) m.set(chaveDaLinha(c.motor, l), l.hashDoPedido);
      // A sonda tem pedido próprio por janela, e a repetibilidade vale para ele também.
      for (const l of c.sonda?.linhas ?? []) m.set(`${c.motor} sonda ${l.range}@${l.offset}`, l.hashDoPedido);
    }
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

function assinaturasEmMarkdown(assinaturas: readonly AssinaturaObservada[], compilador: string | undefined): string[] {
  const out = ['### Quem respondeu', ''];
  if (compilador !== undefined) out.push(`A CLI desta coluna foi compilada por: \`${compilador}\`.`, '');
  if (assinaturas.length === 0) {
    return [...out, 'Nenhuma resposta assinada — nenhuma chamada desta coluna chegou a responder.', ''];
  }
  out.push(
    ...tabela(
      ['tipo', 'provedor', 'modelo', 'plataforma', 'build do sistema', 'linhas da leitura', 'da sonda'],
      assinaturas.map((a) => [
        a.tipo,
        celula(a.provedor),
        celula(a.modelo),
        celula(a.plataforma),
        celula(a.buildDoSistema),
        String(a.leitura),
        String(a.sonda),
      ]),
    ),
    '',
  );
  if (assinaturas.length > 1) {
    out.push(
      '> Mais de uma assinatura nesta coluna: o modelo ou o sistema mudou no meio da medição, e as ' +
        'linhas de assinaturas diferentes não se somam.',
      '',
    );
  }
  return out;
}

/**
 * As quatro medidas, com a regra da janela medida ao lado dos números — e **nenhum número
 * de corte**. A régua está na ADR; a comparação é do dono.
 */
function medidasEmMarkdown(m: MedidasDoPortao): string[] {
  // A mesma conta que a tela do iPhone escreve — do núcleo, uma só.
  const { combinacoes, presentes, comAprovada: aprovadas, semJanela: vazias } = resumoDaCobertura(m);
  return [
    '### As quatro medidas da ADR 0050',
    '',
    'Os números que as quatro condições leem, nesta coluna — **sem limiar e sem veredito**: a ' +
      'comparação com a régua da ADR é do dono.',
    '',
    `> ${REGRA_DA_JANELA_MEDIDA}`,
    '',
    ...tabela(
      ['medida', 'nesta coluna'],
      [
        ['janelas na amostra', String(m.janelas)],
        ['medidas (chegaram ao modelo)', `${m.medidas} — fora da medida: ${foraEmTexto(m.foraDaMedida)}`],
        ['aprovação (`ok` ÷ medidas)', `${m.aprovadas} de ${m.medidas} (${porcento(m.aprovadas, m.medidas)})`],
        [
          'cobertura (caso × alcance)',
          `${presentes} de ${combinacoes} combinações na amostra, ${aprovadas} com aprovada` +
            (vazias.length > 0 ? ` — sem janela: ${vazias.join(', ')}` : ''),
        ],
        ['aprovadas idênticas ao template', `${m.identicasAoTemplate} de ${m.aprovadas}`],
        [
          'mediana do tempo por chamada',
          `${segundos(m.medianaMs)} (${m.naMediana} medidas; ${m.frias} ${m.frias === 1 ? 'fria ficou' : 'frias ficaram'} de fora)`,
        ],
      ],
    ),
    '',
    ...tabela(
      ['caso', 'noite: na amostra', 'noite: aprovadas', 'período: na amostra', 'período: aprovadas'],
      m.cobertura.map((c) => [c.caso, String(c.noite.amostra), String(c.noite.aprovadas), String(c.periodo.amostra), String(c.periodo.aprovadas)]),
    ),
    '',
  ];
}

function sondaEmMarkdown(s: SondaDaColuna): string[] {
  const r = s.resumo;
  const falhas = r.falhas.reduce((n, f) => n + f.vezes, 0);
  const out = [
    '### A sonda de fidelidade',
    '',
    'O motor recebeu os pontos de cada dimensão medida — numa ordem embaralhada por janela, para a ' +
      'posição não decidir — e escolheu uma, por esquema fechado; a conferência aprova quando a ' +
      'escolha está entre as que o código nomeia. `mudo` é a janela cujo caso não nomeia dimensão — ' +
      'não houve pergunta, e ela não conta.',
    '',
    `Janelas: ${r.janelas} = ${r.perguntadas} perguntadas + ${r.mudas} mudas.`,
    '',
    `Das perguntadas: no que o código nomeia ${r.acertos} · escolha errada ${r.escolhaErrada} · fora das opções ` +
      `${r.foraDasOpcoes} · outra reprovação ${r.outraReprovacao} · recusa ${r.recusas} · falha ${falhas}` +
      `${r.falhas.length > 0 ? ` (${r.falhas.map((f) => `${f.vezes} ${f.classe}`).join(', ')})` : ''} · defeito ${r.defeitos}.`,
    '',
    `Acertos entre as medidas: ${r.acertos} de ${r.medidas}; ao acaso, o esperado seria ${decimal(r.acertoAoAcaso)} ` +
      '(a soma de nomeadas ÷ opções, por pergunta medida).',
    '',
  ];
  const comPergunta = s.linhas.filter((l) => l.desfecho !== 'mudo');
  if (comPergunta.length > 0) {
    out.push(
      ...tabela(
        ['janela', 'caso', 'alcance', 'desfecho', 'ms', 'opções', 'escolha', 'o código nomeia', 'detalhe'],
        comPergunta.map((l) => [
          rotuloDaJanela(l),
          l.caso,
          l.alcance,
          [l.sintetica ? `${l.desfecho} (sintética)` : l.desfecho, ...(l.frio ? ['fria'] : [])].join(' · '),
          String(l.ms),
          celula(l.opcoes.join(', ')),
          celula(l.escolha ?? l.textoDoMotor),
          celula(l.esperado.join(', ')),
          celula(l.problemas && l.problemas.length > 0 ? l.problemas.map((p) => `${p.regra}: ${p.detalhe}`).join(' · ') : l.detalhe),
        ]),
      ),
      '',
    );
  }
  const defeitos = s.linhas.filter((l) => l.desfecho === 'defeito');
  for (const l of defeitos) {
    out.push(`**${rotuloDaJanela(l)}** (sonda) · ${l.caso} · ${l.detalhe ?? 'sem detalhe'}`, '');
    if (l.pilha !== undefined) out.push(...blocoDeCodigo(l.pilha), '');
  }
  return out;
}

function coluna(c: ColunaDoRelatorio): string[] {
  const out: string[] = ['', `## Coluna \`${c.motor}\` — ${c.linhas.length} janelas`, ''];
  if (c.assinaturas) out.push(...assinaturasEmMarkdown(c.assinaturas, c.compilador));
  if (c.medidas) out.push(...medidasEmMarkdown(c.medidas));
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
        [
          l.sintetica ? `${l.desfecho} (sintética)` : l.desfecho,
          ...(l.frio ? ['fria'] : []),
          ...(l.doHospedeiro ? ['do hospedeiro'] : []),
        ].join(' · '),
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
  if (c.sonda) out.push(...sondaEmMarkdown(c.sonda));
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
        ...(m.sonda ? [['sonda de fidelidade', `descritor v${m.sonda.versaoDoDescritor}, em cada coluna de modelo`]] : []),
        ['gerado em', r.geradoEm],
      ],
    ),
  ];
  for (const c of r.colunas) out.push(...coluna(c));

  out.push('', '## Os pedidos, por hash', '');
  out.push(
    'Um pedido por caso × alcance × dimensões nomeadas — o `range` e o passo não entram nele, ' +
      'então janelas no mesmo caso compartilham o hash. O pedido da sonda leva os pontos, e por ' +
      'isso se repete menos.',
    '',
  );
  const todasAsLinhas: readonly { readonly hashDoPedido: string; readonly rotulo: string }[] = r.colunas.flatMap((c) => [
    ...c.linhas.map((l) => ({ hashDoPedido: l.hashDoPedido, rotulo: `${l.caso}/${l.alcance}` })),
    ...(c.sonda?.linhas ?? []).map((l) => ({ hashDoPedido: l.hashDoPedido, rotulo: `${l.caso}/${l.alcance} (sonda)` })),
  ]);
  for (const { hash, pedido } of r.pedidos) {
    const onde = todasAsLinhas.filter((l) => l.hashDoPedido === hash);
    const casos = [...new Set(onde.map((l) => l.rotulo))].join(', ');
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
