/**
 * O nome da rota, do aparelho (ADR 0041 · ADR 0042).
 *
 * Todo o juízo mora no núcleo — forma, molde, conferência —, e daqui sai só o
 * que o núcleo não pode fazer: falar com a rede. É a mesma divisão da narração
 * da Retrospectiva, e o mesmo gatilho da varredura de fotos: **uma vez por
 * pedalada, quando o dono abre o detalhe**.
 *
 * A `ia-narrar` continua burra. Ela não sabe que existe nome de rota: recebe um
 * par `{ sistema, usuario }` como qualquer outro e devolve texto. Quem sabe é o
 * `packages/shared/src/routes/`.
 */
import {
  fetchHomeAnchors,
  nomearRota,
  saveRouteName,
  type Activity,
  type ChamadorDeModelo,
  type HomeAnchor,
  type RouteCity,
  type RouteFacts,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';

/** Ciclismo no HealthKit. Só ele tem `cities` preenchido pelo ingest. */
const BIKE_ACTIVITY_ID = 13;

/**
 * As casas mudam de ano em ano, não de minuto em minuto — e a mesma abertura de
 * tela pode nomear mais de uma rota. Guardar por sessão poupa uma consulta por
 * pedalada sem risco de servir dado velho: quem escreve `places` é o passe de
 * manutenção, não o app.
 */
let ancorasEmCache: HomeAnchor[] | null = null;

export function limparCacheDeAncoras(): void {
  ancorasEmCache = null;
}

async function ancoras(userId: string): Promise<HomeAnchor[]> {
  if (!ancorasEmCache) ancorasEmCache = await fetchHomeAnchors(supabase, userId);
  return ancorasEmCache;
}

/**
 * Chamador do modelo. É o único ponto deste caminho que conhece rede — e nem
 * aqui há chave: quem a guarda é a edge function (ADR 0038).
 */
const chamar: ChamadorDeModelo = async (prompt) => {
  const { data, error } = await supabase.functions.invoke('ia-narrar', {
    body: { sistema: prompt.sistema, usuario: prompt.usuario, json: prompt.json },
  });
  if (error) throw error;
  const d = data as {
    texto?: string;
    provedor?: string;
    modelo?: string;
    motivoDeParada?: string;
    tokens?: { entrada: number; saida: number };
    error?: string;
    detalhe?: string;
  };
  // O corpo de erro da function carrega a causa real (cota, chave, modelo
  // inexistente). Sem repassá-la, tudo chega aqui como "falhou".
  if (d.error) throw new Error(d.detalhe ?? d.error);
  if (!d.texto) throw new Error('resposta sem texto');
  return {
    texto: d.texto,
    provedor: d.provedor,
    modelo: d.modelo,
    motivoDeParada: d.motivoDeParada,
    tokens: d.tokens,
  };
};

/** Já visitada, ou fora do escopo? Puro, e a razão de o gatilho poder ser burro. */
export function precisaDeNome(a: Activity): boolean {
  if (a.activityId !== BIKE_ACTIVITY_ID) return false;
  if (a.routeName || a.routeNameChecked) return false;
  if (!a.hasRoute) return false;
  return true;
}

export interface PontaDaRota {
  lat: number;
  lng: number;
}

/**
 * Nomeia uma pedalada, se ela precisar. Devolve o nome, ou `null` quando não
 * houve nome a dar — e `null` aqui não é falha.
 *
 * **Engole erro de rede de propósito.** A pedalada fica sem `route_name_meta` e
 * entra de novo na próxima abertura, exatamente como a varredura de fotos faz
 * quando o iOS nega a biblioteca em segundo plano. Não há nada que o dono possa
 * fazer com um aviso de cota, e nada se perde ao tentar de novo.
 */
export async function nomearPedaladaSePreciso(
  activity: Activity,
  pontos: readonly PontaDaRota[] | undefined,
  userId: string,
): Promise<string | null> {
  if (!precisaDeNome(activity)) return null;

  const cities = (activity.cities ?? []) as readonly RouteCity[];
  const primeiro = pontos?.[0];
  const ultimo = pontos?.[pontos.length - 1];
  // Sem as pontas não há forma a derivar, e sem forma não há molde. Sair agora
  // deixa a rota pendente para quando o traçado já estiver carregado.
  if (!primeiro || !ultimo) return null;

  const rota: RouteFacts = {
    startAt: activity.startAt,
    distanceM: activity.distanceM ?? 0,
    elevationM: activity.elevationM ?? 0,
    lat0: primeiro.lat,
    lng0: primeiro.lng,
    lat1: ultimo.lat,
    lng1: ultimo.lng,
    cities,
  };

  try {
    const { nome, meta } = await nomearRota(rota, await ancoras(userId), chamar);
    await saveRouteName(supabase, userId, activity.id, nome, meta);
    return nome;
  } catch {
    return null;
  }
}
