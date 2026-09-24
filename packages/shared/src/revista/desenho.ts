/**
 * Os **dois desenhistas da capa** — o traçado e a grade (Story 2.4a).
 *
 * A capa tem três naturezas ({@link NaturezaDaCapa}) e até esta story o app
 * desenhava **uma**: `tracado` e `grade` caíam no papel liso da 1.11. Não é caso
 * de borda — no arquivo real, 17 dos 39 meses têm uma dessas duas capas, e todo
 * 2023–2024 vive delas.
 *
 * ## Por que a geometria e a contagem moram aqui, e não no componente
 *
 * A parede de capas (2.4b) vai desenhar ~40 destes numa lista rolante. Geometria
 * dentro do render roda a cada quadro de rolagem; aqui ela é `useMemo` de um lado
 * e teste sem tela do outro. É a mesma divisão que o `RouteProfileCard` já faz.
 *
 * ## O que este módulo **não** faz
 *
 * Não lê banco, não escolhe capa e não desenha. A rota chega já carregada
 * (`fetchRouteSurface`, que traz `route_overview` — **nunca** a coluna `points`,
 * que estoura o `statement_timeout` de 8 s), e a marca da grade sai da entrada
 * que a Retrospectiva já monta. Cor também não sai daqui: rota e célula marcada
 * são **dado**, e dado pede papel de paleta — quem resolve isso é o hospedeiro.
 */
import type { NaturezaDaCapa } from '../data/edicoes-capa';
import type { TipoComEdicao } from '../data/edicoes-ia';
import { localDateOf, localDateStr } from '../date/local';
import type { Activity } from '../models';
import { periodBounds } from '../period/bounds';

/* ── o traçado ───────────────────────────────────────────────────────────── */

/**
 * Quantos pontos uma rota precisa ter para virar traçado — **abaixo disto a capa
 * cai para a grade**.
 *
 * `route_overview` guarda 1 ponto a cada 40 do track, então este número conta
 * vértices da polilinha, não metros. As seis rotas carimbadas hoje têm **10, 29,
 * 52, 110, 129 e 135** pontos: há um vão inteiro entre a menor e a segunda menor,
 * e qualquer limiar dentro dele separa o acervo do mesmo jeito. 20 fica no meio
 * do vão, de propósito — uma rota um pouco mais densa que a de 10 ainda não
 * entra, e uma um pouco mais rala que a de 29 ainda desenha.
 *
 * O argumento é de **tamanho**: em capa inteira quase tudo lê, mas a parede
 * desenha a 173 px, e ali uma polilinha de 9 segmentos não lê como rota — lê como
 * risco. Declarar o limiar agora, com a queda para a grade já ligada, é o que faz
 * a 2.4b herdar a decisão em vez de reabri-la.
 *
 * **Pendente do veredito em tela** (dono, 24/09/2026), junto com a espessura do
 * traço e o vão da grade — ver a entrada da 2.4a em `deferred-work.md`.
 */
export const PONTOS_MINIMOS_DO_TRACADO = 20;

/**
 * Um par `[lat, lon]` como `route_overview` o guarda — metade dos bytes de um
 * `{lat,lng}`, e é a forma que `fetchRouteSurface` devolve.
 */
export type ParDaRota = readonly [number, number];

/** A caixa em que o traçado é desenhado, em unidades de tela. */
export interface CaixaDoDesenho {
  readonly largura: number;
  readonly altura: number;
  /**
   * O respiro nos quatro lados. Não é enfeite: sem ele a ponta arredondada do
   * traço encosta na borda e a rota parece cortada.
   */
  readonly margem: number;
}

/** Um ponto já projetado, no sistema da caixa (y cresce para baixo, como em SVG). */
export interface PontoNaCaixa {
  readonly x: number;
  readonly y: number;
}

/**
 * O respiro em volta do desenho: **um oitavo do menor lado**, com um piso que
 * quem desenha informa (a espessura do traço, para a ponta arredondada não
 * encostar na borda).
 *
 * Fração do lado, e não um número de pixels: a mesma capa é desenhada em 173 px
 * na parede e em 390 na edição, e uma margem fixa sumiria numa e comeria a outra.
 *
 * As **duas** naturezas usam esta margem, e é de propósito: na parede elas ficam
 * lado a lado, e dois respiros diferentes fariam a fronteira 2025→2026 parecer
 * desalinhada.
 */
export function margemDoDesenho(largura: number, altura: number, piso = 0): number {
  return Math.max(piso, Math.min(largura, altura) / 8);
}

export interface TracadoProjetado {
  /** Os pontos na ordem em que a rota os gravou. Um só quando ela é degenerada. */
  readonly pontos: readonly PontoNaCaixa[];
  /**
   * Não há o que traçar: os pontos coincidem, ou a escala saiu zero (margem
   * maior que metade da caixa). Quem desenha põe **um ponto centrado** — uma
   * polilinha ali seria invisível, e a conta da escala dividiria por zero.
   */
  readonly degenerado: boolean;
}

/**
 * O menor cosseno que a projeção aceita — o mesmo piso de `geo/country-explorer`.
 *
 * Aos polos `cos φ` vai a zero e a longitude explodiria; nenhuma rota deste
 * acervo chega perto disso, e o piso existe para o dia em que uma chegar.
 */
const COS_MINIMO = 0.01;

/**
 * Os pares que servem, na ordem em que vieram.
 *
 * A coluna é `jsonb`: o que chega do PostgREST não é conferido por tipo nenhum, e
 * um `null` no meio do overview viraria `NaN` na conta da caixa — e daí um `points`
 * de SVG inteiro sem desenho, sem erro e sem pista. O próprio `overview` pode não
 * ser lista: um objeto ali faria o `for…of` **lançar**, dentro de uma função que o
 * contrato promete pura.
 *
 * **O que este filtro NÃO faz:** ele recusa o que está fora do globo
 * (`|lat| > 90`, `|lon| > 180`) e nada mais. Um par **trocado** dentro do globo —
 * `[4.26, 50.64]`, Bruxelas ao contrário — passa nos dois limites e é desenhado
 * como se fosse coordenada, com a forma espelhada na diagonal. Recusá-lo exigiria
 * uma caixa de bordas plausíveis do acervo, que rejeitaria uma pedalada legítima
 * no primeiro país novo; esta é uma limitação declarada, não uma promessa
 * quebrada. Nenhuma rota do acervo está trocada — a origem grava `[lat, lon]`.
 */
export function pontosDaRota(overview: readonly ParDaRota[] | null | undefined): ParDaRota[] {
  if (!Array.isArray(overview)) return [];
  const bons: ParDaRota[] = [];
  for (const p of overview) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const [lat, lon] = p as readonly unknown[];
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    bons.push([lat, lon]);
  }
  return bons;
}

/**
 * Há traçado a desenhar? — a mesma régua de {@link projetarTracado}, **sem a
 * caixa**.
 *
 * Existe separada porque a decisão "traçado ou grade" acontece antes de alguém
 * saber o tamanho da tela: quem escolhe é {@link desenhoDaCapa}, e quem mede é o
 * componente.
 */
export function temTracado(overview: readonly ParDaRota[] | null | undefined): boolean {
  return pontosDaRota(overview).length >= PONTOS_MINIMOS_DO_TRACADO;
}

/**
 * A rota projetada na caixa — `null` quando ela não tem
 * {@link PONTOS_MINIMOS_DO_TRACADO} pontos que sirvam.
 *
 * Três propriedades que a fazem ser uma projeção e não um encaixe:
 *
 * - **a latitude é corrigida** (`cos φ` na latitude central). Sem isso um grau de
 *   longitude valeria tanto quanto um de latitude, e a Bélgica — a 50,6° N, onde
 *   `cos φ` ≈ 0,64 — sairia esticada em 56% na horizontal;
 * - **a proporção é preservada**: a mesma escala nos dois eixos, escolhida pelo
 *   lado que aperta. Escalas separadas fariam a rota caber sempre e deformar
 *   sempre, e duas rotas diferentes sairiam com a mesma silhueta;
 * - **não depende do tamanho**: dobrar a caixa e a margem dobra cada ponto, e a
 *   forma é a mesma a 173 px e a 346 px. É isso que deixa a parede (2.4b) usar a
 *   mesma função da capa inteira.
 *
 * O caso da **extensão zero** — uma rota parada, um GPS que gravou o mesmo ponto
 * do começo ao fim — não divide por zero: devolve um ponto no centro da caixa,
 * com `degenerado` ligado. O mesmo vale quando a **escala sai zero**, que acontece
 * com margem maior que metade da caixa: N pontos idênticos com `degenerado: false`
 * seriam uma polilinha invisível que o componente desenharia como se fosse rota.
 */
export function projetarTracado(
  overview: readonly ParDaRota[] | null | undefined,
  caixa: CaixaDoDesenho,
): TracadoProjetado | null {
  const pts = pontosDaRota(overview);
  if (pts.length < PONTOS_MINIMOS_DO_TRACADO) return null;

  const centroX = caixa.largura / 2;
  const centroY = caixa.altura / 2;
  const pingo: TracadoProjetado = { pontos: [{ x: centroX, y: centroY }], degenerado: true };

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  // O encolhimento da longitude é medido na latitude do MEIO da rota, e não na de
  // cada ponto: uma correção por ponto curvaria a própria projeção, e o que se
  // quer aqui é uma planta, não um mapa.
  const k = Math.max(COS_MINIMO, Math.abs(Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))));
  const spanX = (maxLon - minLon) * k;
  const spanY = maxLat - minLat;
  if (spanX <= 0 && spanY <= 0) return pingo;

  const util = (lado: number): number => Math.max(0, lado - 2 * caixa.margem);
  // `Infinity` no eixo sem extensão faz o `min` escolher o outro — uma rota
  // perfeitamente norte-sul tem `spanX` zero e continua desenhando.
  const escala = Math.min(
    spanX > 0 ? util(caixa.largura) / spanX : Infinity,
    spanY > 0 ? util(caixa.altura) / spanY : Infinity,
  );
  if (!(escala > 0)) return pingo;

  const esquerda = centroX - (spanX * escala) / 2;
  const topo = centroY - (spanY * escala) / 2;

  return {
    // `maxLat - lat`, e não `lat - minLat`: o norte é em cima, e o y do SVG cresce
    // para baixo. Sem a inversão a rota sai espelhada na horizontal — o que passa
    // despercebido numa volta fechada e é grosseiro numa ida e volta.
    pontos: pts.map(([lat, lon]) => ({
      x: esquerda + (lon - minLon) * k * escala,
      y: topo + (maxLat - lat) * escala,
    })),
    degenerado: false,
  };
}

/* ── a grade ─────────────────────────────────────────────────────────────── */

/** Sete — e são sempre sete, mudando só se eles são as colunas ou as linhas. */
export const DIAS_DA_SEMANA = 7;

/**
 * O teto de células, para o passeio pelos dias não ter como virar laço infinito.
 *
 * 366 é o ano bissexto, o período mais longo que tem edição ({@link TipoComEdicao}
 * não inclui `'all'`). O tipo já garante isso; o teto é o segundo fecho, porque um
 * `for (;;)` que dependa de uma data para terminar é o tipo de código que trava o
 * aparelho em vez de errar alto.
 */
const TETO_DA_GRADE = 366;

/**
 * Quem são as sete: as **colunas** ou as **linhas**.
 *
 * - `colunas` — a semana desce, como num calendário de mês. Semana e mês.
 * - `linhas` — a semana deita: uma linha por dia da semana, uma coluna por semana.
 *   Trimestre e ano, e é a forma do heatmap anual que Registros e Hábitos já usam.
 *
 * **Por que o eixo sai do período, e não de uma constante** (decisão do dono,
 * 24/09/2026, sobre medição): com sete colunas fixas, o ano dá 53 linhas, e numa
 * capa de 390 × 320 o bloco inteiro sai com **31 px de largura — 8% da caixa, com
 * célula de 3,7 px**; o trimestre fica em 30%. Girando, os quatro períodos passam a
 * ocupar os mesmos ~79% que semana e mês já ocupavam. A caixa da capa é mais larga
 * que alta, e uma grade de 53 linhas é mais alta que larga: era a forma brigando
 * com o espaço.
 */
export function eixoDaGrade(kind: TipoComEdicao): EixoDaGrade {
  return kind === 'week' || kind === 'month' ? 'colunas' : 'linhas';
}

export type EixoDaGrade = 'colunas' | 'linhas';

/**
 * O que a grade precisa da entrada da Retrospectiva — a forma estrutural de
 * `RetroInput` reduzida ao que esta função lê.
 *
 * É a forma, e não o tipo: a grade não é peça da retro, e importar `RetroInput`
 * aqui amarraria o desenho da capa ao pacote inteiro por quatro campos. Um
 * `RetroInput` de verdade **não** é atribuível a isto, e de propósito: o `kind`
 * aqui é {@link TipoComEdicao}, que é `PeriodKind` menos `'all'`. O Total começa
 * em 2000 e daria ~9.760 células — uma capa que não é capa, e um passeio de dez
 * mil iterações a cada medição de layout. Quem monta a entrada é
 * `entradaDaGradeDe`, no dono dos dados da retro.
 *
 * **Nenhuma leitura nova**: `activities` e `registros` são exatamente os que a
 * rota da edição já tem em mãos.
 */
export interface EntradaDaGrade {
  readonly now: Date;
  readonly kind: TipoComEdicao;
  readonly offset: number;
  /**
   * As atividades do acervo — **não** só as do período: o recorte é desta
   * função. As ocultas já saíram em quem montou a entrada, e é isso que faz o que
   * o dono escondeu não marcar dia nenhum.
   */
  readonly activities: readonly Activity[];
  /** Os registros avulsos, cada um com os dias em que foi marcado. */
  readonly registros: readonly { readonly days: Iterable<string> }[];
}

export interface GradeDaCapa {
  /**
   * Uma célula por dia do período, em ordem — `true` quando o dia teve atividade
   * **ou** registro.
   */
  readonly celulas: readonly boolean[];
  /** Quantas marcadas. Sai daqui para ninguém varrer as células de novo só para contar. */
  readonly marcados: number;
  /**
   * Células **vazias antes da primeira** — o dia da semana em que o período
   * começa, com segunda = 0.
   *
   * É o mesmo `pad` do `Heatmap` (`cells[0]?.weekday`), e pelo mesmo motivo: sem
   * ele a coluna não é o dia da semana, e a grade que promete mostrar o fim de
   * semana como coluna mostra um deslocamento diferente a cada mês. Ele também
   * corrige a contagem de faixas — agosto de 2026 começa num sábado e precisa de
   * **seis** linhas, não das cinco que `ceil(31 / 7)` daria.
   */
  readonly pad: number;
  /** Quem são as sete — ver {@link eixoDaGrade}. */
  readonly eixo: EixoDaGrade;
}

/** Os dias 'YYYY-MM-DD' que têm alguma marca — atividade ou registro. */
function diasComMarca(e: EntradaDaGrade): Set<string> {
  const dias = new Set<string>();
  for (const a of e.activities) {
    // `startAt` chega do PostgREST como texto; uma data que não se lê viraria a
    // chave `"NaN-NaN-NaN"`, que nunca casa com dia nenhum — mas casaria com ela
    // mesma, e um dia inexistente no conjunto é o tipo de lixo que só aparece
    // quando alguém for contar outra coisa com este mesmo conjunto.
    if (!Number.isFinite(Date.parse(a.startAt))) continue;
    dias.add(localDateOf(a.startAt));
  }
  for (const r of e.registros) {
    for (const d of r.days) dias.add(d);
  }
  return dias;
}

/**
 * A grade de um período: **uma célula por dia**, marcada quando houve atividade
 * ou registro.
 *
 * Quatro decisões que a matriz do spec cobra:
 *
 * - **atividade OU registro**, e não só atividade: jan/2024 tem 0 atividades e 1
 *   registro, e uma grade inteiramente vazia ali diria que o mês não existiu;
 * - **esparso é a informação**. A grade não normaliza nem preenche: 1 marca em 31
 *   dias é o que aquele mês foi, e é essa textura que distingue um mês do vizinho
 *   na parede;
 * - **para em hoje**. Num período que ainda não fechou, o dia que ainda não
 *   chegou não é dia sem dado — ele não tem célula nenhuma. (A rota da revista só
 *   abre período fechado, mas a parede e o script não prometem isso.)
 * - **alinha pelo dia da semana** ({@link GradeDaCapa.pad}).
 *
 * O passeio pelos dias é por componentes locais (`new Date(a, m, d + i)`), e não
 * somando 24 h: a noite em que o relógio muda tem 23 ou 25 horas, e a soma pularia
 * ou repetiria um dia uma vez por ano em cada fuso com horário de verão.
 */
export function gradeDoPeriodo(e: EntradaDaGrade): GradeDaCapa {
  const b = periodBounds(e.now, e.kind, e.offset);
  const marcas = diasComMarca(e);
  // O fim de hoje, no relógio local — o teto do que a grade mostra.
  const fimDeHoje = new Date(e.now.getFullYear(), e.now.getMonth(), e.now.getDate() + 1).getTime();
  const fim = Math.min(b.end.getTime(), fimDeHoje);

  const celulas: boolean[] = [];
  let marcados = 0;
  for (let i = 0; i < TETO_DA_GRADE; i += 1) {
    const dia = new Date(b.start.getFullYear(), b.start.getMonth(), b.start.getDate() + i);
    if (!(dia.getTime() < fim)) break;
    const marcado = marcas.has(localDateStr(dia));
    celulas.push(marcado);
    if (marcado) marcados += 1;
  }
  return {
    celulas,
    marcados,
    // Segunda = 0, como no `Heatmap` — `getDay()` devolve domingo = 0.
    pad: celulas.length === 0 ? 0 : (b.start.getDay() + 6) % 7,
    eixo: eixoDaGrade(e.kind),
  };
}

/** Onde cada célula da grade cai — o lado, o vão e a origem do bloco. */
export interface LayoutDaGrade {
  readonly lado: number;
  readonly vao: number;
  readonly esquerda: number;
  readonly topo: number;
  readonly colunas: number;
  readonly linhas: number;
}

/**
 * O vão entre células, como **fração do lado** delas.
 *
 * Fração, e não pixel fixo: na capa inteira a célula tem ~30 px e o `GAP = 4` do
 * `HeatmapGrid` serviria; na parede, com célula de 4 px, os mesmos 4 px de vão
 * engoliriam o dado. A fração dá a mesma leitura nos dois tamanhos.
 *
 * **Pendente do veredito em tela**, com o limiar do traçado e a espessura.
 */
const FRACAO_DO_VAO = 0.22;

/**
 * A coluna e a linha de uma célula — **o `pad` já contado**.
 *
 * É a ponte entre a contagem (uma lista) e o desenho (uma grade), e mora aqui
 * porque é a mesma conta que decide quantas faixas o bloco tem: se o componente a
 * fizesse, a grade poderia ficar com seis linhas de layout e cinco de desenho.
 */
export function posicaoNaGrade(
  grade: Pick<GradeDaCapa, 'pad' | 'eixo'>,
  i: number,
): { readonly coluna: number; readonly linha: number } {
  const n = grade.pad + i;
  const naSemana = n % DIAS_DA_SEMANA;
  const faixa = Math.floor(n / DIAS_DA_SEMANA);
  return grade.eixo === 'colunas'
    ? { coluna: naSemana, linha: faixa }
    : { coluna: faixa, linha: naSemana };
}

/**
 * A grade posta na caixa: **célula quadrada, bloco centrado, nada estourando**.
 *
 * O lado sai do eixo que **aperta** — e depois da decisão do eixo
 * ({@link eixoDaGrade}) o que aperta é sempre o lado longo da caixa, que é o que
 * faz o bloco ocupá-la de verdade. Célula quadrada é medida, nunca `aspectRatio`:
 * a nota do `HeatmapGrid` (o Yoga não resolve altura por `aspectRatio` dentro de
 * `flexWrap`) vale aqui pelo mesmo motivo — o lado é derivado, não pedido.
 *
 * **Só reserva as faixas que existem**: uma semana em curso com três dias ocupa
 * três colunas, centradas, e não sete com quatro vazias à direita.
 *
 * `null` quando não há o que pôr (nenhuma célula, ou caixa sem área).
 */
export function layoutDaGrade(
  grade: Pick<GradeDaCapa, 'celulas' | 'pad' | 'eixo'>,
  largura: number,
  altura: number,
): LayoutDaGrade | null {
  const total = grade.pad + grade.celulas.length;
  if (grade.celulas.length === 0 || total <= 0 || largura <= 0 || altura <= 0) return null;
  const faixas = Math.ceil(total / DIAS_DA_SEMANA);
  const naSemana = Math.min(total, DIAS_DA_SEMANA);
  const colunas = grade.eixo === 'colunas' ? naSemana : faixas;
  const linhas = grade.eixo === 'colunas' ? faixas : naSemana;

  const margem = margemDoDesenho(largura, altura);
  const util = (lado: number): number => Math.max(0, lado - 2 * margem);
  // n células e n−1 vãos, cada vão sendo uma fração do lado.
  const cabe = (disponivel: number, n: number): number =>
    (n <= 0 ? 0 : disponivel / (n + (n - 1) * FRACAO_DO_VAO));
  const lado = Math.min(cabe(util(largura), colunas), cabe(util(altura), linhas));
  if (!(lado > 0)) return null;
  const vao = lado * FRACAO_DO_VAO;
  const blocoL = colunas * lado + (colunas - 1) * vao;
  const blocoA = linhas * lado + (linhas - 1) * vao;
  return { lado, vao, esquerda: (largura - blocoL) / 2, topo: (altura - blocoA) / 2, colunas, linhas };
}

/* ── quem desenha o quê ──────────────────────────────────────────────────── */

/**
 * A leitura da rota carimbada, como o hospedeiro a vive — os cinco estados, e não
 * "os pontos ou nada".
 *
 * Colapsar isso em `overview | null` foi o que fez a capa de traçado **saltar de
 * altura**: "ainda procurando" e "não existe" davam a mesma resposta, a capa
 * nascia sem reserva e pulava para 45% da janela quando a rota chegava, empurrando
 * o miolo com a edição já na tela.
 *
 * - `nao-pedida` — a capa não é `tracado`, ou não há ponteiro: não há o que buscar;
 * - `procurando` — a leitura está em voo;
 * - `pronta` — os pontos, que podem ser **poucos ou nenhum**: a linha existe;
 * - `sem-linha` — `activity_routes` não tem linha para esta atividade;
 * - `falhou` — a consulta errou.
 */
export type LeituraDaRota =
  | { readonly estado: 'nao-pedida' }
  | { readonly estado: 'procurando' }
  | { readonly estado: 'pronta'; readonly overview: readonly ParDaRota[] }
  | { readonly estado: 'sem-linha' }
  | { readonly estado: 'falhou' };

/**
 * O que a capa põe no lugar do fundo liso — **a decisão e o dado, juntos**.
 *
 * Juntos porque separá-los deixava na tela um `if (grade)` que nunca era falso e
 * que o leitor tinha de provar de fora. Aqui a variante carrega o que ela precisa,
 * e não há guarda inalcançável a manter.
 */
export type DesenhoDaCapa =
  | { readonly tipo: 'papel' }
  /**
   * A rota está a caminho: **reserve a altura, não desenhe nada**. É o estado que
   * impede o salto, e ele dura o tempo de uma consulta por `activity_id`.
   */
  | { readonly tipo: 'reservando' }
  | { readonly tipo: 'tracado'; readonly overview: readonly ParDaRota[] }
  | { readonly tipo: 'grade'; readonly grade: GradeDaCapa };

const PAPEL: DesenhoDaCapa = { tipo: 'papel' };
const RESERVANDO: DesenhoDaCapa = { tipo: 'reservando' };

/**
 * A grade, se ela tiver o que mostrar — senão o papel.
 *
 * **Grade de zero células é papel, e não um quadro vazio**: reservar 45% da tela
 * para um desenho que não existe é exatamente o "espaço reservado para a imagem
 * que não veio" que a 1.13 proibiu.
 */
function comGrade(grade: GradeDaCapa | null): DesenhoDaCapa {
  return grade && grade.celulas.length > 0 ? { tipo: 'grade', grade } : PAPEL;
}

/**
 * A decisão — **e não o desenho**: o que a capa põe no lugar do fundo liso.
 *
 * Mora no núcleo porque é regra, e regra tem teste enquanto render não tem. As
 * linhas da matriz que ela responde:
 *
 * - **capa `grade`** → a grade, se ela tiver células. Vazia de marcas é um
 *   resultado; vazia de células é um período que ainda não começou, e aí é papel;
 * - **capa `tracado` com a leitura em voo** → `reservando`;
 * - **capa `tracado` com rota que serve** → o traçado;
 * - **capa `tracado` com rota curta** (0 a 19 pontos numa linha que existe) → a
 *   grade. Abaixo de {@link PONTOS_MINIMOS_DO_TRACADO} a polilinha vira um risco
 *   na parede, e a grade do mesmo período diz mais;
 * - **capa `tracado` sem linha, ou leitura que falhou** → o papel liso de hoje. A
 *   legenda carimbada continua na tela, dizendo o que a capa era.
 *
 * `foto` cai em `papel` de propósito: a capa de foto tem caminho próprio, e
 * chegar aqui significa que a imagem não resolveu — que é exatamente o papel com
 * a legenda da 1.13.
 */
export function desenhoDaCapa(
  natureza: NaturezaDaCapa | null,
  rota: LeituraDaRota,
  grade: GradeDaCapa | null,
): DesenhoDaCapa {
  if (natureza === 'grade') return comGrade(grade);
  if (natureza !== 'tracado') return PAPEL;
  switch (rota.estado) {
    case 'procurando':
      return RESERVANDO;
    case 'pronta':
      return temTracado(rota.overview)
        ? { tipo: 'tracado', overview: rota.overview }
        : comGrade(grade);
    case 'sem-linha':
    case 'falhou':
    case 'nao-pedida':
      return PAPEL;
    default:
      return rotaSemDesenho(rota);
  }
}

function rotaSemDesenho(nunca: never): DesenhoDaCapa {
  console.warn('[revista] leitura de rota sem desenho:', nunca);
  return PAPEL;
}
