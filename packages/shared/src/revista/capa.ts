/**
 * A **escolha da capa** de uma edição, e as legendas que ela carimba (Story 1.13).
 *
 * ## Por que a escolha é do núcleo, e é pura
 *
 * A capa é a única entrada da revista que diz **onde** o período aconteceu, e a
 * regra que a elege — `coverOf` — é a mesma da tira da Retrospectiva e do
 * compositor de compartilhar. Tê-la aqui é o que garante que os dois hospedeiros
 * (o iPhone hoje, o script do arquivo amanhã) escolham a mesma foto para o mesmo
 * período, sem nenhum dos dois consultar banco nem relógio de fora do que recebeu.
 *
 * **A tela nunca escolhe capa, e o render nunca recalcula.** O que se desenha é o
 * que está carimbado em `edicoes_capa` — porque `coverOf` lê `isCover` e
 * `state === 'linked'`, os dois mutáveis depois da impressão, e o `assetId` some
 * da biblioteca. Sem carimbo, a edição que ele leu em agosto teria outra capa em
 * outubro, contra *período fechado congela*.
 *
 * ## Três naturezas, sempre uma
 *
 * `foto` quando há foto vinculada no período; senão `tracado`, quando há atividade
 * do período com rota; senão `grade`. **A terceira não é sobra** — as fotos só
 * existem a partir de 2026, e é a textura das capas que registra quando o dono
 * passou a fotografar. Sem ela, 2023 não teria capa nenhuma.
 *
 * ## O que fica gravado é valor, nunca ponteiro a re-derivar
 *
 * A identidade do escolhido (`fotoId` + `fotoTakenAt`, a chave de cura da ADR
 * 0037) e **a legenda já formatada**. A legenda é também a descrição textual da
 * imagem (EXPERIENCE §Accessibility Floor): quando o arquivo não resolve mais, é
 * ela que continua dizendo onde o período aconteceu.
 *
 * ## O porquê, a ficha e a troca (Story 1.16)
 *
 * A escolha passa a carimbar também **por que** ({@link escolherCapa} devolve o
 * motivo) e a atividade da foto — `coverOf` não muda. A capa aberta mostra isso
 * numa ficha ({@link fichaDaCapa}), e a ficha oferece a troca: um seletor
 * ({@link secoesDoSeletor}) e a capa que o dono escolheu ({@link capaTrocada}),
 * que recarimba a capa e só.
 */
import { localDateAt } from '../date/local';
import { MESES_COMPLETOS } from '../date/ptbr';
import type { Capa, CapaACarimbar, MotivoDaCapa, NaturezaDaCapa } from '../data/edicoes-capa';
import type { TipoComEdicao } from '../data/edicoes-ia';
import { formatarNumero } from '../format/numero';
import type { Activity, ActivityPhoto, CityMark } from '../models';
import { periodBounds, periodLabel, type PeriodKind } from '../period/bounds';
import { coverOf } from '../photos/retro';
import { nomeDaAtividade } from '../routes/molde';

/** O separador dos campos da legenda — "Ittre · km 31,1 · 12:38". */
const SEPARADOR = ' · ';

/**
 * A cidade mais próxima de uma coordenada, entre as que as rotas atravessaram —
 * ou `null` quando falta a coordenada ou falta o acervo.
 *
 * Não é geocodificação nova: `activities.cities` já foi enriquecida no ingest, e
 * a conta é a mesma que o cartão de fotos faz. A distância é euclidiana em graus
 * de propósito — só se compara para **ordenar** candidatas dentro de um mesmo
 * período, e uma haversine mudaria a ordem em nenhum caso que exista neste
 * acervo, ao preço de uma trigonometria por candidata.
 */
function cidadeMaisProxima(
  lat: number | null,
  lng: number | null,
  cidades: readonly CityMark[],
): string | null {
  if (lat === null || lng === null || cidades.length === 0) return null;
  let melhor = cidades[0];
  let menor = Infinity;
  for (const c of cidades) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < menor) {
      menor = d;
      melhor = c;
    }
  }
  return melhor.name;
}

/** `31100` → `"km 31,1"`. O número em pt-BR sai do dono dele (`format/numero`). */
function quilometro(metros: number | null | undefined): string | null {
  if (metros === null || metros === undefined || !Number.isFinite(metros)) return null;
  return `km ${formatarNumero(metros / 1000, 1)}`;
}

/**
 * A hora de parede de um instante — `"12:38"` —, ou `null` se não há instante.
 *
 * Montada por componentes, e **não** por `toLocaleTimeString`: o formato de hora
 * do `Intl` muda com a localidade do aparelho (`12:38 PM` num iPhone em inglês), e
 * a legenda é carimbada uma vez e lida para sempre. Aqui ela tem uma forma só.
 *
 * O `Number.isFinite` não é zelo: `taken_at` chega do PostgREST por `Date.parse`,
 * que devolve `NaN` para uma data que não se lê, e daí sairia a legenda
 * `"NaN:NaN"` — carimbada para sempre. A foto sem instante é recusada antes de
 * chegar aqui ({@link fotosElegiveis}); este é o segundo fecho.
 */
function horaDe(instante: number): string | null {
  if (!Number.isFinite(instante)) return null;
  const d = new Date(instante);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A legenda de uma foto: **a parada, o quilômetro e a hora** — `"Ittre · km 31,1
 * · 12:38"`.
 *
 * Esta é a frase de três campos do DESIGN §Components (Capa), e a partir da 1.13
 * ela tem **dono único**: o compositor de compartilhar passou a chamá-la, em vez
 * de montar a sua. Sem os três seria decoração; com os três é a única entrada da
 * revista que diz onde o período aconteceu.
 *
 * **Cada pedaço some sozinho** quando o dado não existe — foto sem coordenada não
 * tem cidade, foto fora do traçado não tem quilômetro. **A hora sempre fica**: ela
 * é a chave da própria feature (ADR 0037 §2), e é o que impede a legenda vazia
 * que o `CHECK` de `edicoes_capa.legenda` recusaria.
 */
export function legendaDaFoto(foto: ActivityPhoto, cidades: readonly CityMark[]): string {
  const partes: string[] = [];
  const cidade = cidadeMaisProxima(foto.lat, foto.lng, cidades);
  if (cidade) partes.push(cidade);
  const km = quilometro(foto.routeDistanceM);
  if (km) partes.push(km);
  const hora = horaDe(foto.takenAt);
  if (hora) partes.push(hora);
  return partes.join(SEPARADOR);
}

/**
 * A legenda de um traçado: **a cidade e o quilômetro**, sem hora — `"Ittre · km
 * 31,1"`.
 *
 * Sem hora porque a natureza `tracado` não fala de um instante: ela fala de uma
 * rota inteira, e carimbar a hora da largada sugeriria um momento que a capa não
 * mostra. A cidade é a **primeira** do percurso, que é onde a pedalada começou —
 * não há ponto na capa do qual medir a mais próxima.
 *
 * `null` quando nem cidade nem distância existem: aí não há frase, e quem chama
 * cai no rótulo do período.
 */
export function legendaDaRota(atividade: Activity): string | null {
  const partes: string[] = [];
  const cidade = atividade.cities?.[0]?.name?.trim();
  if (cidade) partes.push(cidade);
  const km = quilometro(atividade.distanceM);
  if (km) partes.push(km);
  return partes.length > 0 ? partes.join(SEPARADOR) : null;
}

/* ── o que entra na escolha (Story 2.3) ─────────────────────────────────── */

/**
 * O que a seleção do período precisa da entrada da edição: o período e o
 * relógio.
 *
 * É a forma estrutural de `EntradaPacote` (`ia/pacote.ts`) reduzida ao que estas
 * funções leem, e não o tipo dele — a capa não é peça de IA, e importar de `ia/`
 * aqui amarraria o módulo da capa ao núcleo do pacote por um campo só.
 */
export interface PeriodoDaEntrada {
  readonly resumo: { readonly kind: PeriodKind; readonly offset: number };
  readonly agora: Date;
}

/**
 * As atividades que caem no período — a **mesma** seleção que a tira da
 * Retrospectiva faz para carregar as fotos.
 *
 * Tem de ser a mesma: a capa é escolhida entre as fotos do período, e duas
 * definições de "do período" dariam duas capas possíveis para a mesma edição.
 *
 * **Mora no núcleo desde a Story 2.3.** Ela nasceu no celular
 * (`mobile/src/lib/edicao-ia.ts`), e o script da impressão em massa carimba a
 * mesma capa que o telefone carimbaria: uma segunda cópia desta regra num
 * hospedeiro é a capa do Mac divergindo da do iPhone no dia em que uma das duas
 * mudasse.
 *
 * As **ocultas** não são tiradas aqui: quem chama passa as visíveis (o dono
 * escondeu a pedalada, e o que ele escondeu não escolhe a capa nem vira o
 * traçado do período).
 *
 * **O fim é exclusivo**, como em `periodBounds` e em `periodosFechadosDesde`
 * (Story 2.3). Até 23/09/2026 a comparação era `<= end`, e `end` é a meia-noite
 * do dia **seguinte** ao último: uma atividade que começa exatamente às 00:00 de
 * 1º de setembro entrava no período de agosto — e podia virar a capa dele, que é
 * carimbada e congela. Duas réguas para a mesma fronteira davam duas respostas
 * para a mesma atividade conforme quem perguntasse.
 */
export function atividadesDoPeriodo(
  todas: readonly Activity[],
  entrada: PeriodoDaEntrada,
): Activity[] {
  const { kind, offset } = entrada.resumo;
  const b = periodBounds(entrada.agora, kind, offset);
  return todas.filter((a) => {
    const t = Date.parse(a.startAt);
    return Number.isFinite(t) && t >= b.start.getTime() && t < b.end.getTime();
  });
}

/**
 * As cidades que as rotas do período atravessaram, sem repetir — o acervo de
 * onde {@link legendaDaFoto} tira a parada.
 *
 * Não é geocodificação nova: `activities.cities` já veio enriquecida no ingest.
 * A deduplicação é por nome porque é o nome que a legenda imprime; duas marcas
 * do mesmo lugar em pedaladas diferentes escreveriam a mesma palavra.
 */
export function cidadesDoPeriodo(atividades: readonly Activity[]): CityMark[] {
  const porNome = new Map<string, CityMark>();
  for (const a of atividades) {
    for (const c of a.cities ?? []) {
      if (!porNome.has(c.name)) porNome.set(c.name, c);
    }
  }
  return [...porNome.values()];
}

/**
 * O período como a revista o escreve — `"Agosto de 2026"` —, no cabeçalho da
 * rota, na capa em papel e na **legenda da natureza `grade`**.
 *
 * O mês ganha o "de" da proposta aprovada; semana, estação e ano ficam com o
 * rótulo da Retrospectiva (`periodLabel`), para o leitor reconhecer o período
 * que acabou de deixar.
 *
 * **Mora no núcleo desde a Story 2.3**, pelo mesmo motivo das duas acima: é a
 * legenda que a capa carimba quando não há foto nem rota, e ela ficaria
 * congelada com uma grafia no telefone e outra no script.
 */
export function rotuloDaEdicao(tipo: TipoComEdicao, inicio: string): string {
  const d = localDateAt(inicio);
  if (tipo === 'month') return `${MESES_COMPLETOS[d.getMonth()]} de ${d.getFullYear()}`;
  return periodLabel(tipo, d);
}

/** O período de que a capa é capa — a chave da linha, e o rótulo que a `grade` imprime. */
export interface PeriodoDaCapa {
  readonly tipoPeriodo: CapaACarimbar['tipoPeriodo'];
  readonly inicio: string;
  readonly fim: string;
  /**
   * O período por extenso — `"Agosto de 2026"`. É a legenda da natureza `grade`,
   * e a rede de todas as outras: a legenda nunca pode sair vazia daqui, porque o
   * `CHECK` do banco recusaria a linha e a edição ficaria sem capa por um detalhe
   * de formatação.
   */
  readonly rotulo: string;
}

/**
 * As fotos que **podem** ser capa, antes de a regra escolher entre elas.
 *
 * Duas recusas, e as duas produzem uma capa congelada e vazia se passarem — a
 * natureza fica `foto`, o carimbo é definitivo, e a tela nunca desenha nada:
 *
 * - **vídeo.** `fetchPhotosForActivities` traz os dois (`activity_photos` guarda
 *   `media_type`), e `coverOf` não distingue: a maior rajada de uma pedalada pode
 *   muito bem ser um clipe. Só que o pôster de vídeo é **defeito aberto** desde
 *   07/09/2026 — o quadro sai em branco, sem diagnóstico —, e uma capa carimbada
 *   nele não teria conserto sem reimprimir a edição inteira. Foto, portanto.
 * - **instante que não se lê.** `takenAt` vem de `Date.parse(taken_at)` e pode ser
 *   `NaN`; daí `new Date(NaN).toISOString()` **lança**, dentro de uma função que o
 *   contrato promete pura, e a legenda sairia `"NaN:NaN"`. Sem instante não há
 *   chave de cura (ADR 0037), então a foto não é capa.
 *
 * Recusadas todas, a cascata segue para `tracado` — que é o comportamento certo:
 * é melhor a capa do período ser a rota dele do que uma foto que não desenha.
 */
function fotosElegiveis(fotos: readonly ActivityPhoto[]): ActivityPhoto[] {
  return fotos.filter((p) => p.mediaType === 'photo' && Number.isFinite(p.takenAt));
}

/** O que a escolha recebe. Tudo já carregado: esta função não consulta nada. */
export interface EntradaDaCapa {
  /**
   * As fotos do período, como vieram do banco. **Não filtre antes**: `coverOf`
   * precisa ver as `dismissed` para a regra ser a mesma da tira e do compositor, e
   * a recusa de vídeo e de instante ilegível é de {@link fotosElegiveis}.
   */
  readonly fotos: readonly ActivityPhoto[];
  /** As atividades do período, para o traçado. */
  readonly atividades: readonly Activity[];
  readonly periodo: PeriodoDaCapa;
  /** As cidades que as rotas do período atravessaram — o acervo da legenda da foto. */
  readonly cidades: readonly CityMark[];
}

/**
 * A rota que a capa `tracado` desenha: **a mais longa** do período.
 *
 * Mais longa, e não a mais recente nem a mais fotografada: um período se
 * reconhece pela travessia que o marcou, e ela é a de maior distância. O desempate
 * é pela **mais antiga**, e depois pelo id — não por gosto, mas porque dois
 * hospedeiros têm de escolher a mesma, e uma ordem de lista que veio do banco não
 * é promessa.
 */
function rotaMaisLonga(atividades: readonly Activity[]): Activity | null {
  let melhor: Activity | null = null;
  for (const a of atividades) {
    if (!a.hasRoute) continue;
    const d = a.distanceM ?? 0;
    const dMelhor = melhor?.distanceM ?? 0;
    if (melhor === null || d > dMelhor) {
      melhor = a;
      continue;
    }
    if (d < dMelhor) continue;
    if (a.startAt < melhor.startAt || (a.startAt === melhor.startAt && a.id < melhor.id)) melhor = a;
  }
  return melhor;
}

/** A legenda, com a rede do rótulo: em branco, o `CHECK` do banco recusaria a linha. */
function comRede(legenda: string | null, periodo: PeriodoDaCapa): string {
  const frase = legenda?.trim();
  if (frase) return frase;
  const rotulo = periodo.rotulo.trim();
  return rotulo || periodo.inicio;
}

/**
 * A capa de um período: natureza, identidade e legenda — prontas para o carimbo.
 *
 * A cascata é a do contrato, e a ordem importa: **foto**, senão **traçado**, senão
 * **grade**. Nunca devolve nada: toda edição tem capa, e a natureza diz qual.
 *
 * A identidade acompanha a natureza porque o `CHECK`
 * `capa_identidade_bate_com_natureza` exige isso do outro lado — meia capa não é
 * capa, e uma foto sem instante seria uma capa que a cura da ADR 0037 não
 * reencontra depois de uma troca de iPhone.
 */
export function escolherCapa(e: EntradaDaCapa): CapaACarimbar {
  const { tipoPeriodo, inicio, fim } = e.periodo;
  const chave = { tipoPeriodo, inicio, fim };

  const elegiveis = fotosElegiveis(e.fotos);
  const foto = coverOf(elegiveis);
  if (foto) {
    return {
      ...chave,
      natureza: 'foto' satisfies NaturezaDaCapa,
      fotoId: foto.id,
      // ISO, porque a coluna é `timestamptz` — e é a chave de cura, não enfeite.
      fotoTakenAt: new Date(foto.takenAt).toISOString(),
      rotaActivityId: null,
      legenda: comRede(legendaDaFoto(foto, e.cidades), e.periodo),
      motivo: motivoDaEscolha(foto, elegiveis),
      fotoActivityId: foto.activityId,
    };
  }

  const rota = rotaMaisLonga(e.atividades);
  if (rota) {
    return {
      ...chave,
      natureza: 'tracado' satisfies NaturezaDaCapa,
      fotoId: null,
      fotoTakenAt: null,
      rotaActivityId: rota.id,
      legenda: comRede(legendaDaRota(rota), e.periodo),
      motivo: 'sem-foto',
      fotoActivityId: null,
    };
  }

  return {
    ...chave,
    natureza: 'grade' satisfies NaturezaDaCapa,
    fotoId: null,
    fotoTakenAt: null,
    rotaActivityId: null,
    legenda: comRede(null, e.periodo),
    motivo: 'sem-foto',
    fotoActivityId: null,
  };
}

/**
 * **Por que** a foto escolhida — lido da escolha, no instante dela (Story 1.16).
 *
 * `coverOf` **não muda**: ela continua sendo a regra da tira, do compositor e da
 * capa. O que se acrescenta é só o registro de qual ramo dela decidiu, e a ordem é
 * a dela:
 *
 * - **estrela** primeiro, porque é o primeiro ramo de `coverOf` — a foto escolhida
 *   tem `isCover` se, e só se, foi a estrela que a escolheu;
 * - **única** quando ela era a única foto elegível e vinculada do período: não
 *   houve escolha, e dizer "a do meio da maior rajada" sobre uma foto só seria
 *   inventar um critério;
 * - **rajada** no resto.
 *
 * Carimbado agora porque depois não se reconstrói: a estrela muda, o vínculo muda.
 */
function motivoDaEscolha(escolhida: ActivityPhoto, elegiveis: readonly ActivityPhoto[]): MotivoDaCapa {
  if (escolhida.isCover) return 'estrela';
  const vinculadas = elegiveis.filter((p) => p.state === 'linked').length;
  return vinculadas === 1 ? 'unica' : 'rajada';
}

/* ── a troca (Story 1.16) ────────────────────────────────────────────────── */

/**
 * A foto pode ser capa **escolhida pelo dono**? — a régua do seletor e da troca,
 * num lugar só.
 *
 * É {@link fotosElegiveis} (foto, e não vídeo; instante que se lê) mais duas
 * condições que a escolha automática não precisa e a troca precisa:
 *
 * - **vinculada** — `coverOf` já ignora as `dismissed`, mas a troca não passa por
 *   ela: sem esta guarda, uma foto que o dono desligou da atividade viraria capa;
 * - **com `assetId`** — a imagem da capa se resolve por ele. Uma foto cujo ponteiro
 *   ainda não resolveu seria uma capa que nunca desenha, escolhida por quem não a
 *   viu — o seletor nem a mostra, porque não tem miniatura.
 *
 * O seletor mostra exatamente o que esta função aceita, e a troca recusa
 * exatamente o que ela recusa: o que aparece é o que troca.
 */
export function podeSerCapaNaTroca(foto: ActivityPhoto): boolean {
  return foto.mediaType === 'photo'
    && Number.isFinite(foto.takenAt)
    && foto.state === 'linked'
    && typeof foto.assetId === 'string' && foto.assetId.length > 0;
}

/** Por que uma foto não pode ser a capa que o dono escolheu. */
export type RecusaDaTroca = 'video' | 'instante' | 'desligada' | 'sem-arquivo';

/**
 * A troca recusou a foto **antes do banco** — nada foi gravado.
 *
 * A mensagem é a frase da tela: a troca é ato do dono e falha em voz alta, então o
 * seletor a mostra como veio. Não há caminho pela tela até aqui (o seletor só
 * oferece o que {@link podeSerCapaNaTroca} aceita); a recusa existe para que um
 * caminho futuro, ou um estado que andou entre a lista e o toque, não congele uma
 * capa que não desenha.
 */
export class FotoRecusadaNaTroca extends Error {
  readonly recusa: RecusaDaTroca;

  constructor(recusa: RecusaDaTroca) {
    super(FRASE_DA_RECUSA[recusa]);
    this.name = 'FotoRecusadaNaTroca';
    this.recusa = recusa;
  }
}

const FRASE_DA_RECUSA: Readonly<Record<RecusaDaTroca, string>> = Object.freeze({
  video: 'Vídeo não pode ser capa. Escolha uma foto.',
  instante: 'Esta foto não tem a hora em que foi tirada, e não pode ser capa.',
  desligada: 'Esta foto foi desligada da atividade, e não pode ser capa.',
  'sem-arquivo': 'Esta foto não foi encontrada na biblioteca do iPhone, e não pode ser capa.',
});

function recusaDe(foto: ActivityPhoto): RecusaDaTroca | null {
  if (foto.mediaType !== 'photo') return 'video';
  if (!Number.isFinite(foto.takenAt)) return 'instante';
  if (foto.state !== 'linked') return 'desligada';
  if (!(typeof foto.assetId === 'string' && foto.assetId.length > 0)) return 'sem-arquivo';
  return null;
}

/**
 * A capa **trocada** pelo dono: a foto que ele escolheu, pronta para o carimbo.
 *
 * Recarimba a capa e só — o texto, a ordem, as assinaturas, a errata e a manchete
 * são da edição, e esta função nem os vê. O que sai daqui é o que o carimbo da
 * impressão também produziria para esta foto:
 *
 * - **a identidade** — `fotoId`, o instante como chave de cura (ADR 0037) e a
 *   atividade da foto;
 * - **a legenda recalculada** por {@link legendaDaFoto}, com as cidades **do
 *   período** — a mesma frase que a impressão carimbaria, nunca a da capa velha;
 * - **o motivo `trocada`** — ato do dono, e não escolha do app. A escolha anterior
 *   **não é guardada** (decisão do dono, 18/09): a ficha diz que foi ele quem
 *   escolheu, não qual era a de antes.
 *
 * **Recusa a foto inelegível** ({@link FotoRecusadaNaTroca}): vídeo, instante que
 * não se lê, foto desligada ou sem arquivo. "Fora do período" é do hospedeiro, que
 * sabe quais são as atividades do período; esta função recebe só o período.
 */
export function capaTrocada(
  periodo: PeriodoDaCapa,
  foto: ActivityPhoto,
  cidades: readonly CityMark[],
): CapaACarimbar {
  const recusa = recusaDe(foto);
  if (recusa) throw new FotoRecusadaNaTroca(recusa);
  const { tipoPeriodo, inicio, fim } = periodo;
  return {
    tipoPeriodo,
    inicio,
    fim,
    natureza: 'foto' satisfies NaturezaDaCapa,
    fotoId: foto.id,
    fotoTakenAt: new Date(foto.takenAt).toISOString(),
    rotaActivityId: null,
    legenda: comRede(legendaDaFoto(foto, cidades), periodo),
    motivo: 'trocada',
    fotoActivityId: foto.activityId,
  };
}

/** Uma seção do seletor da capa: uma atividade do período e as fotos dela que podem ser capa. */
export interface SecaoDoSeletor {
  readonly atividade: Activity;
  /** Em ordem cronológica — é como uma parada se lê. */
  readonly fotos: readonly ActivityPhoto[];
}

/**
 * As fotos que o dono pode pôr na capa, **agrupadas por atividade** — a lista do
 * seletor.
 *
 * - **Só o que {@link podeSerCapaNaTroca} aceita**: vídeo não aparece (o pôster
 *   está em branco desde 07/09), nem foto sem instante, desligada ou sem arquivo.
 * - **Só as atividades do período**: foto de atividade que não está em
 *   `atividades` fica de fora, porque a troca a recusaria — o que aparece é o que
 *   troca.
 * - **A atividade mais recente primeiro** (pelo início dela), porque o período se
 *   folheia de trás para a frente, como a galeria da Retrospectiva; **as fotos em
 *   ordem cronológica** dentro de cada uma. O desempate é pelo id, para dois
 *   hospedeiros mostrarem a mesma ordem.
 * - Atividade sem foto que sirva não vira seção vazia.
 */
export function secoesDoSeletor(
  fotos: readonly ActivityPhoto[],
  atividades: readonly Activity[],
): SecaoDoSeletor[] {
  const porId = new Map(atividades.map((a) => [a.id, a]));
  const porAtividade = new Map<string, ActivityPhoto[]>();
  for (const p of fotos) {
    if (!podeSerCapaNaTroca(p) || !porId.has(p.activityId)) continue;
    const lista = porAtividade.get(p.activityId);
    if (lista) lista.push(p);
    else porAtividade.set(p.activityId, [p]);
  }
  // Início que não se lê vai para o fim da lista, e não para um lugar arbitrário.
  const inicioDe = (a: Activity): number => {
    const t = Date.parse(a.startAt);
    return Number.isFinite(t) ? t : -Infinity;
  };
  const porTexto = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  return [...porAtividade.entries()]
    .map(([id, lista]) => ({
      atividade: porId.get(id)!,
      fotos: [...lista].sort((a, b) => (a.takenAt !== b.takenAt ? a.takenAt - b.takenAt : porTexto(a.id, b.id))),
    }))
    .sort((a, b) => {
      const ta = inicioDe(a.atividade);
      const tb = inicioDe(b.atividade);
      if (ta !== tb) return tb > ta ? 1 : -1;
      return porTexto(a.atividade.id, b.atividade.id);
    });
}

/* ── a ficha (Story 1.16) ────────────────────────────────────────────────── */

/**
 * As frases do porquê — **dono único**, e exaustivo sobre o motivo.
 *
 * A tabela é a do spec da 1.16 (decisões de UX do dono, 18/09), com as três
 * divergências declaradas do canvas: `trocada` diz "Você escolheu esta." (a frase
 * do canvas seria falsa na segunda troca), a nota da rajada não conta fotos nem
 * horas (seria reconstrução — só o motivo é carimbado), e a atividade não diz o km
 * da rota nem quantas fotos (o km já está na legenda da capa).
 *
 * `sem-foto` não tem linha na tabela do spec porque a ficha não abre para capa sem
 * foto (a capa não é tocável). Ele está aqui porque o `Record` é exaustivo, e a
 * frase diz o que o motivo é, sem inventar critério.
 */
const PORQUE: Readonly<Record<MotivoDaCapa, { readonly porque: string; readonly nota: string | null }>> =
  Object.freeze({
    estrela: {
      porque: 'A que você marcou com a estrela.',
      nota: 'A estrela vence a escolha do app.',
    },
    rajada: {
      porque: 'A do meio da maior rajada do período — fotografa-se mais onde valeu a pena parar.',
      nota: 'Nenhuma foto do período tinha estrela.',
    },
    unica: { porque: 'A única foto do período.', nota: null },
    // A nota da troca é a data dela, e não sai daqui: é medida, em mono.
    trocada: { porque: 'Você escolheu esta.', nota: null },
    'sem-foto': { porque: 'O período não tinha foto que pudesse ser capa.', nota: null },
  });

/** A capa carimbada antes da 1.16: o motivo é nulo, e a ficha diz exatamente isso. */
const PORQUE_ANTES_DO_PORQUE = 'Impressa antes de o app guardar o porquê.';

/** Uma nota do porquê: em sans, ou em mono quando é medida (a data da troca). */
export interface NotaDaFicha {
  readonly texto: string;
  readonly mono: boolean;
}

/** A atividade da foto, como a ficha a escreve. */
export interface AtividadeNaFicha {
  /** O nome, pela precedência de sempre, com rede para o vazio ({@link nomeDaAtividadeNaCapa}). */
  readonly nome: string;
  /** `"114,4 km"`, ou `null` quando a atividade não tem distância medida (ausente, zero). */
  readonly distancia: string | null;
}

/**
 * A ficha da capa aberta — o **bastidor** da edição, não a edição.
 *
 * Só o porquê é carimbado. Quando, atividade e rota são lidos **ao vivo**: se o
 * dono renomear a pedalada, a ficha passa a dizer o nome novo, e isso está certo —
 * a ficha fala da foto, e a edição impressa não muda por causa dela.
 */
export interface FichaDaCapa {
  /** A frase do porquê — serifada, a única prosa da ficha. */
  readonly porque: string;
  readonly nota: NotaDaFicha | null;
  /** `"18/07/2026 · 17:09"`, do instante da captura — ou `null` se ele não se lê. */
  readonly quando: string | null;
  /** `null` quando a atividade não foi achada: a ficha fica sem atividade e sem rota. */
  readonly atividade: AtividadeNaFicha | null;
  /** As cidades da rota, em ordem, com ` · ` — ou `null` sem atividade ou sem cidade. */
  readonly rota: string | null;
}

const dois = (n: number): string => String(n).padStart(2, '0');

/**
 * `DD/MM/AAAA` do dia **local** de um instante, ou `null` se ele não se lê.
 *
 * Por componentes, como a hora da legenda: o formato de data do `Intl` muda com a
 * localidade do aparelho, e a ficha fala uma forma só.
 */
function diaDe(instante: number): string | null {
  if (!Number.isFinite(instante)) return null;
  const d = new Date(instante);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * O nome de uma atividade na capa aberta — na ficha e no título da seção do
 * seletor —, **com rede**.
 *
 * `nomeDaAtividade` cai no rótulo do tipo por `??`, que não pega string vazia: uma
 * atividade cujo nome da fonte é só espaço sai com o nome `''`, e a ficha teria um
 * "Na atividade" em branco. Aqui o vazio também cai no rótulo do tipo.
 */
export function nomeDaAtividadeNaCapa(atividade: Activity, rotuloDoTipo: string): string {
  return nomeDaAtividade(atividade, rotuloDoTipo).trim() || rotuloDoTipo;
}

/**
 * `"114,4 km"`, ou `null` — **só distância que é medida**: finita e positiva. Uma
 * atividade sem GPS (a academia) chega com `0`, e "0,0 km" na ficha afirmaria uma
 * medida que não houve.
 */
function distanciaNaFicha(metros: number | null | undefined): string | null {
  if (metros === null || metros === undefined || !Number.isFinite(metros) || metros <= 0) return null;
  return `${formatarNumero(metros / 1000, 1)} km`;
}

/** As cidades de uma rota, em ordem, sem repetir o nome que já passou. */
function rotaDe(atividade: Activity): string | null {
  const vistas = new Set<string>();
  const nomes: string[] = [];
  for (const c of atividade.cities ?? []) {
    const nome = c.name?.trim();
    if (!nome || vistas.has(nome)) continue;
    vistas.add(nome);
    nomes.push(nome);
  }
  return nomes.length > 0 ? nomes.join(SEPARADOR) : null;
}

/**
 * A ficha de uma capa: **por que**, **quando**, **em que atividade** e **por onde**.
 *
 * `atividade` é a que o hospedeiro achou no acervo pelo `fotoActivityId` carimbado
 * — ou `null`. Uma atividade de **outro** id é tratada como não achada: a ficha
 * não pode dizer "na atividade X" sobre uma foto que não é dela. `rotuloDoTipo` é o
 * último recurso do nome (`"Ciclismo"`), e vem de fora porque o rótulo do tipo é
 * vocabulário do app.
 *
 * Cobre a matriz inteira da ficha:
 *
 * - **capa anterior à 1.16** (motivo nulo) — "Impressa antes de o app guardar o
 *   porquê.", sem nota;
 * - **atividade não achada** — porquê e quando, sem atividade e sem rota;
 * - **trocada** — "Você escolheu esta.", com a data da troca em mono, que é o
 *   `carimbadaEm` (a troca recarimba).
 */
export function fichaDaCapa(capa: Capa, atividade: Activity | null, rotuloDoTipo: string): FichaDaCapa {
  const daFoto = atividade !== null && capa.fotoActivityId !== null && atividade.id === capa.fotoActivityId
    ? atividade
    : null;

  let porque: string;
  let nota: NotaDaFicha | null;
  if (capa.motivo === null) {
    porque = PORQUE_ANTES_DO_PORQUE;
    nota = null;
  } else if (capa.motivo === 'trocada') {
    porque = PORQUE.trocada.porque;
    const dia = diaDe(Date.parse(capa.carimbadaEm));
    nota = dia ? { texto: `trocada em ${dia}`, mono: true } : null;
  } else {
    const frases = PORQUE[capa.motivo];
    porque = frases.porque;
    nota = frases.nota ? { texto: frases.nota, mono: false } : null;
  }

  const instante = capa.fotoTakenAt === null ? NaN : Date.parse(capa.fotoTakenAt);
  const dia = diaDe(instante);
  const hora = horaDe(instante);
  const quando = dia && hora ? `${dia}${SEPARADOR}${hora}` : null;

  return {
    porque,
    nota,
    quando,
    atividade: daFoto
      ? { nome: nomeDaAtividadeNaCapa(daFoto, rotuloDoTipo), distancia: distanciaNaFicha(daFoto.distanceM) }
      : null,
    rota: daFoto ? rotaDe(daFoto) : null,
  };
}
