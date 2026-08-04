/**
 * Cores das linhas de referência do gráfico de duração (Histórico de Treinos).
 *
 * São três linhas: a meta (`goal`), o seu esforço médio (`average`, reta) e a
 * progressão barra a barra (`series`). A meta fica sempre num cinza neutro — é pano
 * de fundo, não dado. As outras duas são configuráveis aqui.
 *
 * **Por que fora da paleta das barras:** as barras usam os 8 papéis de
 * `chart-palettes` (laranja, azul, verde, amarelo, rosa, marrom, laranja-escuro,
 * tinta), e cada um já identifica um tipo de atividade — uma linha azul se
 * confundiria com Ciclismo/Natação/Remo. Sobram violeta e petróleo/vinho, ausentes
 * da paleta. Como `remapChartColor` deixa passar hex desconhecido, estas cores ficam
 * **idênticas nas 6 paletas**: as referências viram um ponto fixo enquanto as barras
 * mudam de cor.
 */
export type ReferenceLineScheme = 'violeta-petroleo' | 'violeta' | 'petroleo-vinho';

export interface ReferenceLineColors {
  /** Reta do esforço médio ("Você") — a leitura principal, comparada com a meta. */
  average: string;
  /** Polilinha barra a barra (mês a mês / ano a ano). */
  series: string;
}

export interface ReferenceLineSchemeDef extends ReferenceLineColors {
  id: ReferenceLineScheme;
  label: string;
  /** Uma linha sobre a escolha, exibida no seletor. */
  hint: string;
}

export const REFERENCE_LINE_SCHEMES: ReadonlyArray<ReferenceLineSchemeDef> = [
  {
    id: 'violeta-petroleo',
    label: 'Violeta e petróleo',
    hint: 'Dois frios sobre barras quentes — o maior contraste entre as duas linhas.',
    average: '#6D3FA8',
    series: '#2A7B74',
  },
  {
    id: 'violeta',
    label: 'Violeta',
    hint: 'Mesmo matiz nos dois: as duas linhas são você, mudando só o peso.',
    average: '#5B3E8F',
    series: '#A98BD4',
  },
  {
    id: 'petroleo-vinho',
    label: 'Petróleo e vinho',
    hint: 'Mais quente, casa com a paleta bege do app.',
    average: '#8E3A5D',
    series: '#1F6F78',
  },
];

export const DEFAULT_REFERENCE_LINE_SCHEME: ReferenceLineScheme = 'violeta-petroleo';

const SCHEME_IDS = new Set<string>(REFERENCE_LINE_SCHEMES.map((s) => s.id));

/** Normaliza o valor vindo das preferências (jsonb/coluna), caindo no padrão. */
export function resolveReferenceLineScheme(raw: unknown): ReferenceLineScheme {
  return typeof raw === 'string' && SCHEME_IDS.has(raw)
    ? (raw as ReferenceLineScheme)
    : DEFAULT_REFERENCE_LINE_SCHEME;
}

/** Cores do esquema ativo. Aceita valor cru — resolve antes de ler. */
export function referenceLineColors(raw: unknown): ReferenceLineColors {
  const id = resolveReferenceLineScheme(raw);
  const def = REFERENCE_LINE_SCHEMES.find((s) => s.id === id)!;
  return { average: def.average, series: def.series };
}
