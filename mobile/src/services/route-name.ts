/**
 * O nome da rota, do aparelho (ADR 0041 · ADR 0042 · story 5.7).
 *
 * Todo o juízo mora no núcleo — forma, prompt, leitura, conferência, molde —, e
 * quem o percorre é o **orquestrador**, sobre `descritorDoNomeDeRota`. Este
 * arquivo é hospedeiro: junta os fatos, resolve a cadeia com a preferência do
 * dono, chama `ler` e grava o que `metaDaLeitura` mandar gravar. Não monta
 * pedido, não interpreta, não confere e não escreve frase (AD-2).
 *
 * **Não conhece a function.** Até a 5.7 este era o segundo cliente da function de
 * narração no app, com o nome dela escrito aqui e a leitura de erro própria.
 * Agora o motor vem do ponto de injeção (`lib/motores/`), que é o único lugar do
 * app que a nomeia — e a guarda do `architecture.test.ts` virou barreira em zero
 * por causa desta story.
 *
 * **O gatilho não mudou**: uma vez por pedalada, quando o dono abre o detalhe,
 * protegido pela marca gravada (`routeNameChecked`). Nunca há repetição daqui —
 * quem repete, recua e cai no piso é o orquestrador.
 */
import {
  descritorDoNomeDeRota,
  fetchHomeAnchors,
  ler as lerRecurso,
  metaDaLeitura,
  resolverCadeia,
  saveRouteName,
  type Activity,
  type FatosDoNome,
  type HomeAnchor,
  type RouteCity,
  type RouteFacts,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { catalogoDoRecurso, motorPara } from '../lib/motores';
import { anel } from '../lib/motores/anel';
import { lerPreferencia } from '../lib/motores/preferencia';

/** Ciclismo no HealthKit. Só ele tem `cities` preenchido pelo ingest. */
const BIKE_ACTIVITY_ID = 13;

const RECURSO = descritorDoNomeDeRota.recurso;

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

/** O que este caminho precisa do mundo. Injetável para o teste não abrir rede. */
export interface DepsDoNome {
  readonly motorPara: typeof motorPara;
  readonly registrar: typeof anel.registrar;
  readonly agora: () => Date;
  /**
   * A escolha do dono para este recurso, ou `null`.
   *
   * **Rejeição aqui aborta a nomeação desta vez** — ver o corpo. Não há
   * `.catch(() => null)`: para o recurso que grava, "não consegui ler a escolha"
   * não pode virar "não há escolha".
   */
  readonly lerPreferencia: () => Promise<string | null>;
  /**
   * Os ids que o hospedeiro conhece — disponíveis ou não. Rejeição aborta a
   * nomeação, pela mesma razão da preferência: o catálogo estático descartaria
   * calado as variantes que só a lista do servidor conhece, e a escolha do dono
   * viraria o padrão — gravado.
   */
  readonly catalogo: () => Promise<readonly string[]>;
  readonly salvar: (id: string, nome: string | null, meta: unknown) => Promise<void>;
}

function depsDoApp(userId: string): DepsDoNome {
  return {
    motorPara,
    registrar: anel.registrar,
    agora: () => new Date(),
    lerPreferencia: () => lerPreferencia(RECURSO),
    catalogo: () => catalogoDoRecurso(RECURSO),
    salvar: (id, nome, meta) => saveRouteName(supabase, userId, id, nome, meta),
  };
}

/**
 * Nomeia uma pedalada, se ela precisar. Devolve o nome, ou `null` quando não
 * houve nome a dar — e `null` aqui não é falha.
 *
 * **Engole erro de rede de propósito.** A falha transitória não produz meta
 * (`metaDaLeitura` devolve `null`), a pedalada fica sem `route_name_meta` e
 * entra de novo na próxima abertura, exatamente como a varredura de fotos faz
 * quando o iOS nega a biblioteca em segundo plano. O `catch` de fora cobre o que
 * ainda pode lançar: a consulta das âncoras, **a preferência e o catálogo**, a
 * gravação, e o bug de código puro que o orquestrador não engole. Todos terminam
 * do mesmo jeito — nada gravado, tenta de novo —, que é o desfecho mais barato
 * que existe aqui: não há nada que o dono possa fazer com um aviso de cota, e
 * nada se perde ao tentar de novo.
 */
export async function nomearPedaladaSePreciso(
  activity: Activity,
  pontos: readonly PontaDaRota[] | undefined,
  userId: string,
  deps: DepsDoNome = depsDoApp(userId),
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
    const fatos: FatosDoNome = { rota, ancoras: await ancoras(userId) };
    /*
     * A preferência (do disco) e o catálogo (do disco mais o servidor) em
     * paralelo: são independentes. E **sem recuo**, que é a diferença entre este
     * caminho e o da leitura da Saúde (`lib/leitura-da-saude.ts`).
     *
     * Lá, cair no `null` e no catálogo estático custa uma frase efêmera, e a
     * alternativa — a tela pendurada em "escrevendo" — é pior. Aqui o resultado é
     * **gravado** e não se reprocessa: `lerPreferencia().catch(() => null)` faria
     * uma rota ir à nuvem com `sem-modelo` ou `aparelho:sistema` escolhidos, e
     * `catalogo().catch(() => idsConhecidos)` descartaria calada a variante
     * aprovada e nomearia com outro modelo. Nos dois casos o dono só descobriria
     * lendo `route_name_meta`.
     *
     * Então a exceção sobe para o `catch` de fora: nada gravado, e a pedalada
     * volta ao gatilho na próxima abertura — que é o mesmo desfecho de uma falha
     * transitória, e o mais barato que existe aqui.
     */
    const [preferencia, catalogo] = await Promise.all([deps.lerPreferencia(), deps.catalogo()]);
    const leitura = await lerRecurso(descritorDoNomeDeRota, fatos, {
      modo: 'produto',
      cadeia: resolverCadeia(descritorDoNomeDeRota, preferencia, catalogo),
      motorPara: deps.motorPara,
      registrar: deps.registrar,
      agora: deps.agora,
    });

    // Só causa permanente grava. Transitória devolve `null`, nada é escrito, e a
    // pedalada volta ao gatilho na próxima abertura.
    const escrita = metaDaLeitura(leitura, fatos, deps.agora());
    if (!escrita) return null;
    await deps.salvar(activity.id, escrita.nome, escrita.meta);
    return escrita.nome;
  } catch {
    return null;
  }
}
