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
 */
import type { CapaACarimbar, NaturezaDaCapa } from '../data/edicoes-capa';
import { formatarNumero } from '../format/numero';
import type { Activity, ActivityPhoto, CityMark } from '../models';
import { coverOf } from '../photos/retro';

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

  const foto = coverOf(fotosElegiveis(e.fotos));
  if (foto) {
    return {
      ...chave,
      natureza: 'foto' satisfies NaturezaDaCapa,
      fotoId: foto.id,
      // ISO, porque a coluna é `timestamptz` — e é a chave de cura, não enfeite.
      fotoTakenAt: new Date(foto.takenAt).toISOString(),
      rotaActivityId: null,
      legenda: comRede(legendaDaFoto(foto, e.cidades), e.periodo),
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
    };
  }

  return {
    ...chave,
    natureza: 'grade' satisfies NaturezaDaCapa,
    fotoId: null,
    fotoTakenAt: null,
    rotaActivityId: null,
    legenda: comRede(null, e.periodo),
  };
}
