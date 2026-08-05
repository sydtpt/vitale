/**
 * Cores das linhas de referência do gráfico de duração (Histórico de Treinos).
 *
 * São três linhas: a meta (`goal`), o seu esforço médio (`average`, reta pontilhada)
 * e a progressão barra a barra (`series`, polilinha sólida). A meta fica sempre num
 * cinza neutro — é pano de fundo, não dado. As outras duas são configuráveis aqui.
 *
 * **Por que fora da paleta das barras:** as barras usam os 8 papéis de
 * `chart-palettes` (laranja, azul, verde, amarelo, rosa, marrom, laranja-escuro,
 * tinta), e cada um já identifica um tipo de atividade — uma linha azul se
 * confundiria com Ciclismo/Natação/Remo. Como `remapChartColor` deixa passar hex
 * desconhecido, estas cores ficam **idênticas nas 6 paletas**: as referências viram
 * um ponto fixo enquanto as barras mudam de cor.
 *
 * **Por que há um passo por tema.** Desde que o esforço passou a ser ancorado no
 * vigoroso (ver `health/who-activity`), a linha ficou *dentro* das barras em vez de
 * flutuar acima delas — então ela é lida contra os preenchimentos, não contra a
 * superfície. Nenhuma cor única serve os dois temas: um violeta escuro dá 10.6:1 no
 * claro e 1.6:1 no escuro. Cada esquema traz o seu passo claro e o seu passo escuro
 * da mesma rampa, escolhidos por medição, não por olho.
 *
 * **Como os valores foram escolhidos.** Para cada candidato mediu-se a *cobertura*:
 * a fração dos 97 fundos possíveis (8 papéis × 6 paletas × 2 paradas do gradiente,
 * mais a superfície) em que o traço OU o seu halo se separa do fundo em ≥3:1. O halo
 * (traço largo na cor da superfície, desenhado por baixo) é o que torna isso viável:
 * sem ele, nenhuma cor passa de 8% de cobertura. Todo `series` aqui tem 100% de
 * cobertura nos dois temas. O `average` dos esquemas alternativos fica abaixo disso
 * (ver `hint`), o que é aceitável porque a reta é horizontal, atravessa o gráfico
 * inteiro e leva rótulo direto — a forma identifica mesmo onde a cor enfraquece.
 */
export type ReferenceLineScheme = 'violeta-petroleo' | 'violeta' | 'petroleo-vinho';

/** Tema ativo — cada esquema tem um passo por tema. A web só usa `light`. */
export type ReferenceLineMode = 'light' | 'dark';

export interface ReferenceLineColors {
  /** Reta do esforço médio ("Você") — a leitura principal, comparada com a meta. */
  average: string;
  /** Polilinha barra a barra (mês a mês / ano a ano) — a linha do seu progresso. */
  series: string;
}

export interface ReferenceLineSchemeDef {
  id: ReferenceLineScheme;
  label: string;
  /** Uma linha sobre a escolha, exibida no seletor. */
  hint: string;
  light: ReferenceLineColors;
  dark: ReferenceLineColors;
}

export const REFERENCE_LINE_SCHEMES: ReadonlyArray<ReferenceLineSchemeDef> = [
  {
    id: 'violeta-petroleo',
    label: 'Violeta e petróleo',
    hint: 'Dois frios sobre barras quentes. As duas linhas legíveis sobre qualquer barra.',
    light: { series: '#4A2D82', average: '#0D4F58' },
    dark: { series: '#C4B5FD', average: '#7FDCE6' },
  },
  {
    id: 'violeta',
    label: 'Violeta',
    hint: 'Mesmo matiz nos dois: as duas linhas são você, mudando só o peso. A reta da média fica mais discreta sobre as barras claras.',
    light: { series: '#4A2D82', average: '#6A4A9E' },
    dark: { series: '#C4B5FD', average: '#9B85E8' },
  },
  {
    id: 'petroleo-vinho',
    label: 'Petróleo e vinho',
    hint: 'Mais quente, casa com a paleta bege do app.',
    light: { series: '#0D4F58', average: '#7A1F52' },
    dark: { series: '#7FDCE6', average: '#F0A8C8' },
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

/**
 * Cores do esquema ativo no tema dado. Aceita valor cru — resolve antes de ler.
 *
 * `mode` é obrigatório na prática mesmo tendo padrão: passar o tema errado devolve
 * um passo calibrado para a superfície oposta, que é exatamente o defeito que a
 * separação por tema existe para evitar. O padrão `light` serve a web, que não tem
 * tema escuro.
 */
export function referenceLineColors(
  raw: unknown,
  mode: ReferenceLineMode = 'light',
): ReferenceLineColors {
  const id = resolveReferenceLineScheme(raw);
  const def = REFERENCE_LINE_SCHEMES.find((s) => s.id === id)!;
  return def[mode === 'dark' ? 'dark' : 'light'];
}
