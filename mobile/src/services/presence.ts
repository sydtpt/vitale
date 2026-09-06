/**
 * Fase 0 da Presença — o motor (A): geofence do iOS, sem uma linha de Swift.
 *
 * **O que esta fase faz e o que ela recusa.** Ela registra até três regiões,
 * recebe `enter`/`exit` do iOS e grava cada evento num log local. Ela **não**
 * escreve no Supabase, não cria visita, não notifica e não toca em nenhum
 * módulo. O objetivo é medir o motor antes de construir em cima dele: quantos
 * eventos por dia, quanto é flapping, e se a bateria sente.
 *
 * **Por que a task é definida no escopo do módulo.** Quando um evento de região
 * chega com o app encerrado, o iOS relança o processo só para entregá-lo. Nesse
 * relançamento não há tela, não há sessão e não há efeito de React — o que
 * existe é o bundle sendo avaliado. `TaskManager.defineTask` precisa ter rodado
 * até o fim dessa avaliação, senão o iOS entrega o evento para uma task que não
 * existe e ele se perde calado. É por isso que `_layout.tsx` importa este
 * arquivo pelo efeito colateral, e não por uma função.
 *
 * **Por que o fix vem do cache.** O evento de geofence não traz coordenada nem
 * precisão — traz só a região. Pedir posição nova (`getCurrentPositionAsync`)
 * ligaria o GPS a cada borda, que é exatamente o erro que faz uma feature de
 * localização queimar bateria. `getLastKnownPositionAsync` devolve o que o
 * sistema já tinha, de graça. Em troca, a coordenada pode estar velha — daí
 * `fixAgeS` ser gravado junto e o resumo contar os fixes rançosos.
 */
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  appendPresenceEvent,
  presenceEventId,
  type PresenceEvent,
  type PresenceEventKind,
} from '../lib/presence-events';
import { readPresencePlaces, type PresencePlace } from '../lib/presence-places';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';

export const PRESENCE_TASK = 'vitale-presence-geofence';

interface GeofencingTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

/**
 * Guarda contra dupla definição. O Fast Refresh reavalia o módulo em
 * desenvolvimento, e `defineTask` chamado duas vezes com o mesmo nome registra
 * o handler duas vezes — cada evento viraria dois no log, e o teste de flapping
 * mediria o Metro em vez do iOS.
 */
if (!TaskManager.isTaskDefined(PRESENCE_TASK)) {
  TaskManager.defineTask<GeofencingTaskData>(PRESENCE_TASK, async ({ data, error }) => {
    if (error) {
      void recordBreadcrumb('geofence', `erro: ${error.message}`);
      return;
    }
    if (!data?.region) return;

    const kind: PresenceEventKind =
      data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
    const placeId = data.region.identifier ?? 'desconhecido';
    const appState = AppState.currentState ?? 'unknown';

    // A migalha primeiro: se a gravação do evento falhar, ainda restará a prova
    // de que o iOS acordou o app. As duas coisas falham por motivos diferentes.
    void recordBreadcrumb('geofence', `${placeId} ${kind} state=${appState}`);

    const at = new Date().toISOString();
    const event: PresenceEvent = {
      id: presenceEventId(placeId, kind, at),
      placeId,
      kind,
      at,
      tz: currentTimeZone(),
      appState,
    };

    try {
      const fix = await Location.getLastKnownPositionAsync();
      if (fix) {
        event.lat = fix.coords.latitude;
        event.lon = fix.coords.longitude;
        event.accuracyM = fix.coords.accuracy ?? undefined;
        event.fixAgeS = Math.max(0, Math.round((Date.now() - fix.timestamp) / 1000));
      }
    } catch {
      // Sem fix em cache o evento continua válido: hora e região já bastam para
      // contar eventos e medir flapping, que é o que a fase 0 precisa saber.
    }

    try {
      await appendPresenceEvent(event);
    } catch {
      void recordBreadcrumb('geofence', `${placeId} ${kind} FALHOU ao gravar`);
    }
  });
}

function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface PresencePermission {
  foreground: boolean;
  /** "Sempre". Sem isto o iOS não entrega nada com o app fechado. */
  background: boolean;
  /** `true` quando o usuário negou e o iOS não vai mais perguntar. */
  blocked: boolean;
}

export async function getPresencePermission(): Promise<PresencePermission> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    foreground: fg.granted,
    background: bg.granted,
    blocked: !fg.granted && !fg.canAskAgain,
  };
}

/**
 * Pede as permissões na ordem que o iOS exige: primeiro "durante o uso", só
 * depois o degrau para "sempre". Pedir background antes do foreground devolve
 * negado sem sequer mostrar o diálogo.
 */
export async function requestPresencePermission(): Promise<PresencePermission> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    return { foreground: false, background: false, blocked: !fg.canAskAgain };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted, blocked: false };
}

export async function isPresenceRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(PRESENCE_TASK);
  } catch {
    return false;
  }
}

/**
 * (Re)arma o monitoramento com os lugares salvos.
 *
 * `startGeofencingAsync` substitui o conjunto inteiro — não acrescenta. Por isso
 * toda mudança de lugar chama esta função de novo com a lista completa, em vez
 * de tentar registrar só o que entrou.
 */
export async function startPresence(places?: PresencePlace[]): Promise<number> {
  const list = places ?? (await readPresencePlaces());
  if (list.length === 0) {
    await stopPresence();
    return 0;
  }

  const perm = await getPresencePermission();
  if (!perm.background) {
    throw new Error('A captura precisa da permissão "Sempre" para funcionar com o app fechado.');
  }

  await Location.startGeofencingAsync(
    PRESENCE_TASK,
    list.map((p) => ({
      identifier: p.id,
      latitude: p.lat,
      longitude: p.lon,
      radius: p.radiusM,
      notifyOnEnter: true,
      notifyOnExit: true,
    })),
  );
  return list.length;
}

export async function stopPresence(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(PRESENCE_TASK)) {
      await Location.stopGeofencingAsync(PRESENCE_TASK);
    }
  } catch {
    // Parar o que já não está rodando não é erro.
  }
}

/**
 * Posição atual, para cadastrar um lugar a partir de onde se está.
 *
 * Este é o único ponto da fase 0 que liga o GPS, e ele roda só quando o usuário
 * toca em "usar minha posição" — nunca em background, nunca num evento.
 */
export async function currentFix(): Promise<Location.LocationObject> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}
