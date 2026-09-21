/**
 * Reconfere um relatório salvo: as medidas **gravadas** nele contra as **recalculadas**
 * pela régua de hoje (story 5.13).
 *
 * ## Por que existe
 *
 * A régua — o fecho, as quatro medidas da ADR 0050 e a tradução da medição em linha —
 * subiu para o núcleo para o iPhone medir com ela. "Subiu sem mudar número nenhum" é uma
 * afirmação, e afirmação em comentário não se confere: este comando a torna reprodutível.
 * Ele relê um relatório que o dono já tem no disco e refaz as contas a partir das
 * **mesmas linhas**; se algum número divergir, ele diz qual, onde e quanto.
 *
 * Serve depois de qualquer mexida na régua, e serve também para conferir uma medição do
 * iPhone contra a do Mac: a comparação por hash é da `--comparar` da bancada; esta aqui é
 * a comparação das contas.
 *
 * ## O que ele NÃO faz
 *
 * Não abre rede, não chama modelo, não escreve arquivo nenhum e não vai ao CI (o relatório
 * carrega dado de saúde e mora fora do git). É leitura e aritmética.
 *
 *     pnpm --filter @vitale/scripts exec tsx bancada/reconferir.ts ~/Orbe-dados/<dir>/relatorio-*.json
 */
import { readFileSync } from 'node:fs';
import { agregar, medidasDoPortao } from '@vitale/shared';
import { relatorioEmMarkdown, resumoDaSonda, type Relatorio } from './relatorio.ts';

/** Uma divergência entre o que está gravado e o que a régua de hoje calcula. */
export interface Divergencia {
  readonly coluna: string;
  readonly onde: string;
  readonly gravado: string;
  readonly recalculado: string;
}

export interface Reconferencia {
  readonly colunas: number;
  /** Quantas comparações foram feitas — a não-vacuidade do resultado. */
  readonly conferidas: number;
  readonly divergencias: readonly Divergencia[];
  /** O Markdown regerado bate com o que o arquivo `.md` ao lado tem? Só quando ele existe. */
  readonly markdown?: 'igual' | 'diferente';
}

/** JSON estável para comparar dois objetos de contagem sem depender da ordem das chaves. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
}

/**
 * Reconfere um relatório já lido. Puro: nada de disco aqui dentro, para o teste exercitar
 * a comparação inteira sem um arquivo.
 */
export function reconferir(r: Relatorio): Reconferencia {
  const divergencias: Divergencia[] = [];
  let conferidas = 0;
  const comparar = (coluna: string, onde: string, gravado: unknown, recalculado: unknown): void => {
    conferidas += 1;
    const a = canonico(gravado);
    const b = canonico(recalculado);
    if (a !== b) divergencias.push({ coluna, onde, gravado: a, recalculado: b });
  };

  for (const c of r.colunas) {
    comparar(c.motor, 'agregados', c.agregados, agregar(c.linhas));
    if (c.medidas) comparar(c.motor, 'medidas da ADR 0050', c.medidas, medidasDoPortao(c.linhas));
    if (c.sonda) {
      comparar(c.motor, 'sonda: agregados', c.sonda.agregados, agregar(c.sonda.linhas));
      comparar(c.motor, 'sonda: resumo', c.sonda.resumo, resumoDaSonda(c.sonda.linhas));
    }
  }
  return { colunas: r.colunas.length, conferidas, divergencias };
}

/** O relatório lido do disco — e a recusa clara quando o arquivo não é um. */
export function lerRelatorio(caminho: string): Relatorio {
  const bruto: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
  const r = bruto as Partial<Relatorio>;
  if (!r || typeof r !== 'object' || !Array.isArray(r.colunas) || r.manifesto === undefined) {
    throw new Error(`${caminho} não parece um relatório da bancada (sem colunas ou sem manifesto)`);
  }
  return bruto as Relatorio;
}

/** O relatório em Markdown, regerado do mesmo JSON — a leitura também é da régua. */
export function markdownDoRelatorio(r: Relatorio): string {
  return relatorioEmMarkdown(r);
}

function principal(argv: readonly string[]): number {
  const caminhos = argv.filter((a) => !a.startsWith('-'));
  if (caminhos.length === 0) {
    process.stderr.write(
      'reconferir — as medidas gravadas num relatório contra as recalculadas pela régua de hoje.\n\n' +
        '  pnpm --filter @vitale/scripts exec tsx bancada/reconferir.ts <relatorio.json> [outro.json …]\n\n' +
        'Não abre rede, não chama modelo e não escreve nada.\n',
    );
    return 2;
  }
  let ruim = 0;
  for (const caminho of caminhos) {
    const r = lerRelatorio(caminho);
    const x = reconferir(r);
    const nome = caminho.replace(/^.*\//, '');
    if (x.divergencias.length === 0) {
      process.stdout.write(`ok  ${nome} — ${x.colunas} colunas, ${x.conferidas} contas conferidas, nenhuma divergência\n`);
      continue;
    }
    ruim += 1;
    process.stdout.write(`DIVERGE  ${nome} — ${x.divergencias.length} de ${x.conferidas} contas\n`);
    for (const d of x.divergencias) {
      process.stdout.write(`  ${d.coluna} · ${d.onde}\n    gravado:      ${d.gravado}\n    recalculado:  ${d.recalculado}\n`);
    }
  }
  return ruim === 0 ? 0 : 1;
}

// `require.main` porque este workspace é CommonJS (ver `scripts/tsconfig.json`).
if (require.main === module) process.exitCode = principal(process.argv.slice(2));
