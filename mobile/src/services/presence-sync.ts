/**
 * A ponte entre o log local da Fase 0 e as tabelas da Fase 1.
 *
 * ## Onde ela NÃO roda
 *
 * **Nunca dentro do callback do geofence.** O motor de região é barato — célula e
 * Wi-Fi, sem GPS contínuo —, e quem custa bateria é o que se faz quando o evento chega.
 * Abrir conexão com o Supabase dentro do callback mantém o app acordado a cada borda e
 * transforma a feature mais barata do aparelho na mais cara. O callback grava no disco
 * e devolve o controle; quem fala com a rede é esta função, chamada quando há sessão e
 * o app está em primeiro plano.
 *
 * ## Por que ela reenvia tudo, toda vez
 *
 * Não há marca d'água. A idempotência é o `client_event_id` — o mesmo id que o log já
 * usa para deduplicar desde a Fase 0 —, e o custo real é pequeno: o log tem teto de 500
 * eventos e os 24 dias medidos deram **30 visitas**.
 *
 * Mas o motivo não é o custo, é a correção: **o pareamento precisa do histórico**. Uma
 * chegada de hoje fecha uma visita que abriu ontem, e uma saída perdida só é descoberta
 * olhando o que veio antes. Enviar "o que é novo" obrigaria a reconstruir o estado
 * anterior a cada vez — mais código para fazer pior.
 *
 * ## A semeadura dos 24 dias não é um caminho separado
 *
 * Ela é a **primeira** execução desta função. O log já tem os 74 eventos; a primeira
 * sincronização os pareia e sobe as 30 visitas. Um código de semeadura em separado seria
 * um segundo caminho para o mesmo resultado — e o segundo caminho é o que não é testado.
 */

import {
  parear,
  colar,
  descartarPassagens,
  rollup,
  enviarVisitas,
  gravarPlaceDays,
  fetchLugares,
  criarLugar,
  definirRaioDoGeofence,
  vigenteEm,
  type Lugar,
  type VisitaParaEnviar,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { readPresenceLog } from '../lib/presence-events';
import { readPresencePlaces, writePresencePlaces, type PresencePlace } from '../lib/presence-places';
import { getPresencePermission } from './presence';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';

export interface ResumoDaPresenca {
  visitas: number;
  dias: number;
  lugaresCriados: number;
  /** Dias marcados incompletos porque a permissão não está mais em pé. */
  incompletos: number;
}

/** Fuso do aparelho agora. O evento carrega o seu; isto é só para o que não tem. */
function fusoAtual(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function diaDe(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/**
 * Garante que cada lugar local tenha linha no banco, e devolve o mapa local → remoto.
 *
 * Criar é raro — acontece uma vez por lugar — e por isso é feito em série e sem lote: a
 * clareza de "este lugar falhou" vale mais que a economia de uma chamada.
 */
async function casarLugares(
  userId: string,
  locais: PresencePlace[],
  remotos: Lugar[],
  /**
   * Primeiro dia com evento de cada lugar.
   *
   * O lugar criado agora recebe vigência a partir **do primeiro evento dele**, não de
   * hoje. Carimbar hoje foi o defeito de 02/10: o Trabalho nasceu valendo a partir de
   * 02/10 e as seis visitas dele, de 08/09 em diante, ficaram **fora da vigência do
   * próprio lugar** — um lugar que não existia quando foi visitado.
   */
  primeiroDia: Map<string, string>,
): Promise<{ mapa: Map<string, PresencePlace>; criados: number }> {
  const mapa = new Map<string, PresencePlace>();
  let criados = 0;
  let mudou = false;

  for (const local of locais) {
    let p = local;
    if (!p.identidade) {
      // Sem identidade declarada, o nome vira a identidade. É um palpite, e é o certo
      // na primeira vez: "Casa" → `casa`. O dono pode corrigir depois sem perder nada,
      // porque a identidade só é lida na agregação.
      p = { ...p, identidade: p.name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') };
      mudou = true;
    }
    if (!p.remoteId) {
      const jaExiste = remotos.find((r) => r.identidade === p.identidade && r.activeTo === null);
      if (jaExiste) {
        // Adotar um lugar que já existia (a Casa veio do nome das rotas) sem carimbar o
        // raio deixaria o banco sem saber com que raio o iOS vigia aquele lugar.
        if (jaExiste.geofenceRadiusM === null) {
          await definirRaioDoGeofence(supabase, userId, jaExiste.id, p.radiusM);
        }
        p = { ...p, remoteId: jaExiste.id };
      } else {
        p = {
          ...p,
          remoteId: await criarLugar(supabase, userId, {
            identidade: p.identidade!,
            kind: p.identidade === 'casa' ? 'home' : 'other',
            label: p.name,
            lat: p.lat,
            lng: p.lon,
            geofenceRadiusM: p.radiusM,
            activeFrom: primeiroDia.get(local.id),
          }),
        };
        criados += 1;
      }
      mudou = true;
    }
    mapa.set(local.id, p);
  }

  if (mudou) await writePresencePlaces([...mapa.values()]);
  return { mapa, criados };
}

/**
 * Sobe o que o aparelho mediu.
 *
 * Devolve o resumo, e **não lança em falha de rede**: a próxima chamada reenvia tudo.
 * O que ela lança é erro de forma — recusa do banco —, porque isso não melhora sozinho
 * e precisa aparecer.
 */
export async function sincronizarPresenca(userId: string): Promise<ResumoDaPresenca> {
  const [locais, log, remotos, permissao] = await Promise.all([
    readPresencePlaces(),
    readPresenceLog(),
    fetchLugares(supabase, userId),
    getPresencePermission(),
  ]);

  if (locais.length === 0 || log.length === 0) {
    return { visitas: 0, dias: 0, lugaresCriados: 0, incompletos: 0 };
  }

  // O primeiro dia de cada lugar sai do próprio log — é ele que diz desde quando o
  // aparelho tem o que afirmar sobre aquele lugar.
  const tzDoLog = log.find((e) => e.tz)?.tz ?? fusoAtual();
  const primeiroDia = new Map<string, string>();
  for (const e of log) {
    if (e.redundant) continue;
    const d = diaDe(e.at, tzDoLog);
    const atual = primeiroDia.get(e.placeId);
    if (!atual || d < atual) primeiroDia.set(e.placeId, d);
  }

  const { mapa, criados } = await casarLugares(userId, locais, remotos, primeiroDia);
  const lugares = criados > 0 ? await fetchLugares(supabase, userId) : remotos;

  const tz = log.find((e) => e.tz)?.tz ?? fusoAtual();
  const visitas = descartarPassagens(colar(parear(log).visitas));

  // O lugar de uma visita é a linha VIGENTE no dia da chegada, não a linha de hoje.
  // Sem isto, uma visita de antes da mudança de casa apontaria para o endereço novo —
  // e a feature de nome das rotas passaria a responder errado sobre pedaladas antigas.
  const resolver = (placeIdLocal: string, arrivedAt: string): string | null => {
    const local = mapa.get(placeIdLocal);
    if (!local?.identidade) return null;
    return vigenteEm(lugares, local.identidade, diaDe(arrivedAt, tz))?.id ?? local.remoteId ?? null;
  };

  const paraEnviar: VisitaParaEnviar[] = visitas.map((v) => ({
    placeId: resolver(v.placeId, v.arrivedAt),
    source: 'geofence',
    clientEventId: `${v.placeId}:enter:${v.arrivedAt}`,
    arrivedAt: v.arrivedAt,
    departedAt: v.departedAt,
    departedSource: v.departedSource,
    tz,
    status: 'confirmed',
  }));

  await enviarVisitas(supabase, userId, paraEnviar);

  // O rollup é recalculado inteiro e regravado: ele é derivado, e derivado se refaz.
  // A janela é a do próprio log — fora dela o aparelho não tem o que afirmar.
  const instantes = log.filter((e) => !e.redundant).map((e) => e.at).sort();
  const janela = { inicio: instantes[0]!, fim: instantes[instantes.length - 1]! };
  const linhas = rollup(
    visitas.map((v) => ({ ...v, placeId: resolver(v.placeId, v.arrivedAt) ?? v.placeId })),
    { tz, janela },
  );

  // A permissão caiu: os dias desta janela não são confiáveis, e a tela precisa mostrar
  // buraco em vez de número menor. É o risco nº 1 da feature — o app não erra, emudece.
  const incompleto = !permissao.background;
  const porIdentidade = new Map(lugares.map((l) => [l.id, l.identidade]));

  await gravarPlaceDays(
    supabase,
    userId,
    linhas.map((l) => ({
      day: l.day,
      placeId: l.placeId,
      identidade: l.placeId ? (porIdentidade.get(l.placeId) ?? null) : null,
      seconds: l.seconds,
      arrivals: l.arrivals,
      inferredEdges: l.inferredEdges,
      incomplete: incompleto,
    })),
  );

  const dias = new Set(linhas.map((l) => l.day)).size;
  void recordBreadcrumb(
    'geofence',
    `sync: ${paraEnviar.length} visitas, ${dias} dias${incompleto ? ' (SEM permissão — dias incompletos)' : ''}`,
  );

  return {
    visitas: paraEnviar.length,
    dias,
    lugaresCriados: criados,
    incompletos: incompleto ? dias : 0,
  };
}
