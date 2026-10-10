/**
 * O enriquecimento geográfico da atividade, **no aparelho**.
 *
 * Mesmo gatilho e mesmo contrato do nome de rota (`route-name.ts`): roda ao
 * abrir a atividade, uma vez, e falha em silêncio para o dono — mas deixa
 * migalha, que é o que faltou da outra vez.
 *
 * **Por que no aparelho.** O enriquecimento vivia só na edge function e parou
 * entre 17 e 25/09/2026 sem que uma linha daquele código mudasse. Ver
 * `lib/geocode-osm.ts` para a medição. Uma escrita parada derrubou quatro
 * telas de uma vez — a lista de cidades, as estatísticas por país, o toggle
 * "Mostrar cidades" do compartilhar e o nome de rota, que espera cidade de
 * propósito (ver `precisaDeNome`).
 */
import type { Activity, CityMark } from '@vitale/shared';
import { saveActivityCities } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { cidadesDaRota } from '../lib/geocode-osm';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';

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

/**
 * Resolve e grava as cidades, se faltarem. Devolve as marcas gravadas, ou
 * `null` quando não havia o que fazer ou a tentativa falhou.
 *
 * Grava **tudo ou nada**: `cidadesDaRota` lança se qualquer chamada falhar, e
 * aqui a atividade fica em `NULL` para a próxima abertura. Gravar o que deu até
 * ali marcaria uma rota pela metade como completa, e `cities` preenchido é
 * definitivo.
 */
export async function enriquecerCidadesSePreciso(
  a: Activity,
  pontos: readonly { lat: number; lng: number }[],
  userId: string,
): Promise<CityMark[] | null> {
  if (!precisaDeCidades(a)) return null;
  if (pontos.length < 2) return null;
  try {
    const cidades = await cidadesDaRota(pontos);
    await saveActivityCities(supabase, userId, a.id, cidades);
    return cidades;
  } catch (e) {
    void recordBreadcrumb(
      'enriquecimento-fail',
      `cidades ${a.id}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
