/**
 * Texto da notificação de sync de atividades — puro, sem I/O.
 *
 * O anúncio antigo era só a contagem ("2 treinos sincronizados"), que não diz
 * QUAL treino chegou. Nomear o tipo é o que torna a notificação verificável de
 * relance: quem acabou de fazer yoga reconhece "Atividade de Yoga sincronizada"
 * sem abrir o app.
 */
import { activityTypeLabel, DEFAULT_ACTIVITY_LABEL } from '@vitale/shared';

export interface ActivityNotice {
  title: string;
  body: string;
}

/** Máximo de tipos listados no corpo; o resto vira "e mais N". */
const MAX_LABELS = 3;

/**
 * Monta título e corpo para as atividades recém-sincronizadas, a partir dos
 * códigos de tipo do HealthKit. `null` quando não há nada a anunciar.
 *
 * Formas:
 *  - uma atividade          → "Atividade de Yoga sincronizada."
 *  - várias do mesmo tipo   → "2 atividades de Corrida sincronizadas."
 *  - tipos misturados       → "3 atividades sincronizadas: 2× Corrida e Yoga."
 *
 * Tipo desconhecido cai no label genérico do shared, e aí "Atividade de Treino"
 * soaria redundante — vira "Treino sincronizado".
 */
export function activitySyncNotice(activityIds: readonly number[]): ActivityNotice | null {
  if (activityIds.length === 0) return null;

  // Contagem por label, preservando a ordem de chegada como critério de desempate.
  const counts = new Map<string, number>();
  for (const id of activityIds) {
    const label = activityTypeLabel(id);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = activityIds.length;
  const one = total === 1;
  const title = one ? 'Atividade sincronizada' : 'Atividades sincronizadas';

  if (counts.size === 1) {
    const [label, n] = [...counts][0];
    const generic = label === DEFAULT_ACTIVITY_LABEL;
    const body = one
      ? generic
        ? 'Treino sincronizado.'
        : `Atividade de ${label} sincronizada.`
      : generic
        ? `${n} treinos sincronizados.`
        : `${n} atividades de ${label} sincronizadas.`;
    return { title, body };
  }

  // Misturado: o tipo dominante primeiro; empate mantém a ordem de chegada.
  const ordered = [...counts].sort((a, b) => b[1] - a[1]);
  const shown = ordered.slice(0, MAX_LABELS).map(([label, n]) => (n > 1 ? `${n}× ${label}` : label));
  const rest = ordered.length - shown.length;
  if (rest > 0) shown.push(`mais ${rest}`);

  return { title, body: `${total} atividades sincronizadas: ${joinPtBr(shown)}.` };
}

/** "a, b e c" — o "e" antes do último, como se escreve em português. */
function joinPtBr(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}
