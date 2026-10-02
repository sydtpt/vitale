/**
 * Travessias → visitas, e as bordas que o sensor perdeu pelo caminho.
 *
 * Esta é a primeira peça do núcleo da Presença, e ela é inteiramente pura: entra
 * uma lista de eventos de geofence, sai uma lista de visitas **mais uma lista de
 * anomalias**. A segunda lista não é diagnóstico opcional — é metade do produto.
 *
 * ## Por que a anomalia sai junto da visita
 *
 * A manchete da feature é *"dias sem sair de casa"*, e ela é **binária**: quando o
 * iOS perde uma borda, o erro não arranha o número, ele **inverte o dia**. Perdida
 * a saída, o aparelho acha que ninguém saiu e devolve uma estadia contínua; perdida
 * a chegada, a ausência engole a noite e um dia comum vira "noite fora".
 *
 * Medido no log real de 24 dias (ver {@link ../presence/fixture-24-dias}): **4
 * anomalias**, uma a cada seis dias — e **3 delas são chegadas perdidas**, o inverso
 * do que a proposta de 06/09 assumia como falha dominante. A de 17/09 fabrica
 * sozinha uma ausência de 30 h 48 min que parece noite fora e não foi.
 *
 * Por isso elas saem pela mesma porta: quem consome visita precisa saber, no mesmo
 * instante, de quais visitas desconfiar. Separar as duas listas em duas chamadas
 * seria convidar alguém a usar só a primeira.
 *
 * ## As duas assinaturas
 *
 * Nenhuma delas precisa de testemunha externa — são lidas no próprio log:
 *
 * | Sequência | O que foi | Efeito se ninguém notar |
 * |---|---|---|
 * | `exit` → `exit` | **chegada perdida** | a ausência engole o período inteiro |
 * | `enter` → `enter` | **saída perdida** | a estadia engole a saída |
 *
 * ## O que NUNCA vira visita
 *
 * Evento com `redundant` é **relatório de estado**, não travessia: o iOS reavalia as
 * regiões a cada lançamento do app e o `expo-location` entrega a reavaliação como
 * entrada. No log real eles são **298 contra 74** — quatro para um. Se virassem
 * visita, cada abertura do app inventaria uma chegada em casa.
 */

/**
 * Um evento de travessia, como o aparelho o grava.
 *
 * É um subconjunto do `PresenceEvent` do mobile (`mobile/src/lib/presence-events.ts`):
 * só o que o núcleo consome. Coordenada e precisão ficam de fora porque o
 * pareamento não os lê — quem os lê é o casamento ponto↔lugar.
 */
export interface PresenceEvent {
  placeId: string;
  kind: 'enter' | 'exit';
  /** ISO do instante da entrega. */
  at: string;
  /** `true` = reavaliação de estado do iOS, não travessia. Nunca vira visita. */
  redundant?: boolean;
  /** `${placeId}:${kind}:${at}` no aparelho — a idempotência atravessa até o banco. */
  clientEventId?: string;
}

/**
 * Teto de uma visita sem saída, em horas.
 *
 * Uma chegada sem saída fecha pelo próximo `enter` em **outro** lugar; não havendo,
 * fecha aqui. Dezesseis horas é mais que qualquer estadia plausível que não seja
 * dormir em casa, e é curto o bastante para a inferência não comer um dia inteiro.
 */
export const TETO_ORFA_H = 16;

export type AnomaliaKind = 'chegada-perdida' | 'saida-perdida';

export interface Anomalia {
  kind: AnomaliaKind;
  placeId: string;
  /** Os dois instantes entre os quais a borda deveria ter existido. */
  de: string;
  ate: string;
}

/**
 * Como a saída de uma visita ficou conhecida.
 *
 * `inferred` é o que impede a tela de mentir: "3 h 40 em casa *(1 borda estimada)*".
 * Mesma disciplina de *dado velho não pontua* da Prontidão.
 */
export type FonteDaBorda = 'geofence' | 'inferred' | 'manual' | 'clvisit';

/** Uma estadia num lugar. O núcleo não conhece `user_id` nem `id` — isso é do banco. */
export interface Visita {
  placeId: string;
  arrivedAt: string;
  /** `null` = visita em curso. Não é erro: é agora. */
  departedAt: string | null;
  departedSource: FonteDaBorda | null;
}

export interface Pareamento {
  visitas: Visita[];
  anomalias: Anomalia[];
  /** Relatórios de estado descartados. Não é ruído escondido: é contagem de lançamentos. */
  relatorios: number;
}

/**
 * Pareia travessias em visitas, **caminhando o log inteiro de uma vez** — não lugar
 * por lugar.
 *
 * A caminhada é global porque a regra que fecha uma visita órfã é global: chegar num
 * lugar prova que se saiu do anterior, mesmo sem o `exit` ter chegado. Percorrer por
 * lugar perderia exatamente essa prova, que é a mais barata que existe.
 *
 * Ordena por `at` antes de tudo. O iOS entrega evento com atraso, e um par invertido
 * produziria permanência negativa.
 */
export function parear(eventos: readonly PresenceEvent[]): Pareamento {
  const travessias = eventos.filter((e) => !e.redundant).sort((a, b) => a.at.localeCompare(b.at));
  const relatorios = eventos.length - travessias.length;

  const visitas: Visita[] = [];
  const anomalias: Anomalia[] = [];
  let aberta: Visita | null = null;

  const fechar = (quando: string, fonte: FonteDaBorda): void => {
    if (!aberta) return;
    // O teto de 16 h vale **só para borda inferida**. Um `exit` medido às 09:28
    // depois de dezenove horas em casa é um fato, não um chute — aparar isso
    // inventaria uma saída que ninguém observou. (Primeira versão deste arquivo
    // aparava os dois, e as 34 visitas do log real saíram todas com a saída
    // errada: o fixture pegou na primeira execução.)
    aberta.departedAt = fonte === 'inferred' ? limitarPorTeto(aberta.arrivedAt, quando) : quando;
    aberta.departedSource = fonte;
    aberta = null;
  };

  for (const e of travessias) {
    if (e.kind === 'enter') {
      if (aberta && aberta.placeId === e.placeId) {
        // Dois `enter` no mesmo lugar sem `exit`: a saída se perdeu. A visita
        // continua aberta — o aparelho afirma que nunca se saiu, e é isso que ele
        // mediu. A anomalia é o que permite duvidar disso depois.
        anomalias.push({ kind: 'saida-perdida', placeId: e.placeId, de: aberta.arrivedAt, ate: e.at });
        continue;
      }
      // Chegar aqui prova que se saiu de lá, mesmo sem o `exit`.
      fechar(e.at, 'inferred');
      aberta = { placeId: e.placeId, arrivedAt: e.at, departedAt: null, departedSource: null };
      visitas.push(aberta);
      continue;
    }

    if (aberta && aberta.placeId === e.placeId) {
      fechar(e.at, 'geofence');
      continue;
    }

    if (aberta) {
      // Saída de um lugar com visita aberta em outro: alguma borda se perdeu no meio.
      anomalias.push({ kind: 'chegada-perdida', placeId: e.placeId, de: aberta.arrivedAt, ate: e.at });
      fechar(e.at, 'inferred');
      continue;
    }

    // `exit` sem visita aberta = voltou e o iOS não contou. **Nenhuma visita é
    // inventada aqui**: não há chegada conhecida, e chutar uma seria fabricar
    // presença. A anomalia é o registro honesto de que existe um buraco.
    //
    // Exceto no **primeiro** evento do log: ali não há buraco nenhum, há começo.
    // O log nasce no meio do estado — o aparelho já estava em algum lugar quando
    // a observação ligou — e acusar isso como anomalia é acusar a borda da janela.
    const anterior = ultimoInstante(visitas, anomalias);
    if (anterior === null) continue;
    anomalias.push({ kind: 'chegada-perdida', placeId: e.placeId, de: anterior, ate: e.at });
  }

  return { visitas, anomalias, relatorios };
}

/** O teto de 16 h vale para borda inferida e para borda real: o sensor erra dos dois lados. */
function limitarPorTeto(inicio: string, fim: string): string {
  const i = Date.parse(inicio);
  const f = Date.parse(fim);
  const teto = i + TETO_ORFA_H * 3600_000;
  return f > teto ? new Date(teto).toISOString() : fim;
}

function ultimoInstante(visitas: readonly Visita[], anomalias: readonly Anomalia[]): string | null {
  const v = visitas[visitas.length - 1];
  const a = anomalias[anomalias.length - 1];
  const candidatos = [v?.departedAt ?? v?.arrivedAt, a?.ate].filter((x): x is string => !!x);
  return candidatos.length ? candidatos.sort().at(-1)! : null;
}

/** Duração de uma visita em minutos. Visita em curso devolve `null` — não zero. */
export function duracaoMin(v: Visita, agora?: string): number | null {
  const fim = v.departedAt ?? agora;
  if (!fim) return null;
  return (Date.parse(fim) - Date.parse(v.arrivedAt)) / 60_000;
}
