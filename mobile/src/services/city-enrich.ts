/**
 * O enriquecimento geográfico da atividade, **no aparelho**.
 *
 * Mesmo gatilho e mesmo contrato do nome de rota (`route-name.ts`): roda ao
 * abrir a atividade, uma vez, e falha em silêncio para o dono — mas deixa
 * migalha, que é o que faltou das outras vezes.
 *
 * **Por que no aparelho.** O enriquecimento vivia só na edge function e parou
 * entre 17 e 25/09/2026 sem que uma linha daquele código mudasse. Ver
 * `lib/geocode-osm.ts`. Uma escrita parada derrubou quatro telas de uma vez — a
 * lista de cidades, as estatísticas por país, o toggle "Mostrar cidades" do
 * compartilhar e o nome de rota, que espera cidade de propósito.
 *
 * **A espera entre tentativas existe por medição.** A primeira versão tentava
 * de novo assim que o efeito reavaliava, e o log mostrou a mesma atividade
 * levando 429 às 20:41:18, 20:41:46 e 20:42:54. Falhar e insistir na hora é
 * como se perde um IP.
 */
import type { Activity, CityMark } from '@vitale/shared';
import { saveActivityCities } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { cidadesDaRota, castigoAtivoAte, GeocoderDeCastigo } from '../lib/geocode-osm';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';

/** Espera depois de uma falha comum (rede, 5xx) na MESMA atividade. */
const ESPERA_APOS_FALHA_MS = 2 * 60_000;

/** Quando cada atividade pode ser tentada de novo. Vive só na sessão. */
const proximaTentativa = new Map<string, number>();

/** Só para teste. */
export function limparEsperas(): void {
  proximaTentativa.clear();
}

/**
 * Esta atividade precisa de enriquecimento?
 *
 * **`[]` não entra.** No banco `cities` distingue `NULL` ("ainda não se sabe")
 * de `[]` ("o geocoder resolveu e não achou cidade"), e o `toActivity` traduz
 * `NULL` em `undefined` — por isso o crivo é a ausência, não o tamanho. Tratar
 * `[]` como pendente poria a rota no mar de volta na fila para sempre.
 */
export function precisaDeCidades(a: Activity): boolean {
  if (!a.hasRoute) return false;
  return a.cities === undefined;
}

/** Já passou a espera desta atividade, e o geocoder não está de castigo? */
export function podeTentarAgora(id: string, agora = Date.now()): boolean {
  if (agora < castigoAtivoAte()) return false;
  return agora >= (proximaTentativa.get(id) ?? 0);
}

/**
 * Resolve e grava as cidades, se faltarem. Devolve as marcas gravadas, ou
 * `null` quando não havia o que fazer, a vez ainda não chegou, ou a tentativa
 * falhou.
 *
 * Grava **tudo ou nada**: `cidadesDaRota` lança se qualquer chamada falhar, e
 * aqui a atividade fica em `NULL` para a próxima vez. Gravar o que deu até ali
 * marcaria uma rota pela metade como completa, e `cities` preenchido é
 * definitivo.
 */
export async function enriquecerCidadesSePreciso(
  a: Activity,
  pontos: readonly { lat: number; lng: number }[],
  userId: string,
  signal?: AbortSignal,
): Promise<CityMark[] | null> {
  if (!precisaDeCidades(a)) return null;
  if (pontos.length < 2) return null;
  if (!podeTentarAgora(a.id)) return null;

  try {
    const cidades = await cidadesDaRota(pontos, signal);
    await saveActivityCities(supabase, userId, a.id, cidades);
    proximaTentativa.delete(a.id);
    return cidades;
  } catch (e) {
    // Sair da tela não é falha: não vira migalha nem queima a vez.
    if (signal?.aborted) return null;

    if (e instanceof GeocoderDeCastigo) {
      // O castigo é global e já está guardado em `geocode-osm`; aqui só a
      // migalha, uma por atividade, para o log não virar um muro de 429.
      proximaTentativa.set(a.id, e.liberaEm);
      void recordBreadcrumb(
        'enriquecimento-fail',
        `cidades ${a.id}: 429 — geocoder de castigo até ${new Date(e.liberaEm).toLocaleTimeString()}`,
      );
      return null;
    }

    proximaTentativa.set(a.id, Date.now() + ESPERA_APOS_FALHA_MS);
    void recordBreadcrumb(
      'enriquecimento-fail',
      `cidades ${a.id}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
