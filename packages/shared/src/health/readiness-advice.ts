/**
 * Recomendação de treino a partir da prontidão (readiness) do dia.
 * Derivação pura, sem I/O — compartilhada por web e mobile. Ver
 * docs/specs/readiness-treino/.
 *
 * Cruza o score 0–100 de `computeReadiness` com a intensidade do treino
 * planejado para hoje e devolve uma orientação curta. A ideia é tornar o
 * score acionável: prontidão baixa num dia forte → sugerir aliviar; prontidão
 * alta → liberar; dia já leve/descanso → confirmar que está adequado.
 */
import type { Treino } from '../models';
import { READINESS_BANDS } from './readiness';

/** Intensidade do treino do dia, derivada do `Treino`. */
export type WorkoutKind = 'strength' | 'endurance' | 'easy' | 'rest' | 'none';

/** Tom da recomendação → cor/ícone na UI. */
export type AdviceTone = 'go' | 'caution' | 'rest' | 'neutral';

export interface ReadinessAdvice {
  tone: AdviceTone;
  title: string;
  text: string;
}

/**
 * Limiares do score (0–100). Moravam aqui como `LOW`/`HIGH` e o cartão não os
 * enxergava: a recomendação classificava a nota com números que a tela não tinha.
 * Agora vêm de `READINESS_BANDS`, um lugar só para conselho, cartão e teste.
 */
const { lowBelow: LOW, highFrom: HIGH } = READINESS_BANDS;

/**
 * Classifica o treino planejado do dia pela carga que impõe.
 * `rest` tem prioridade; corrida/bike = endurance; volume de carga = força;
 * o resto com duração (yoga, mobilidade) = leve. `undefined` = sem treino.
 */
export function classifyWorkout(t: Treino | undefined): WorkoutKind {
  if (!t) return 'none';
  if (t.rest) return 'rest';
  if (t.run) return 'endurance';
  if (t.vol > 0) return 'strength';
  if (t.dur > 0) return 'easy';
  return 'none';
}

/** true quando o treino do dia exige esforço alto (força ou endurance). */
function isHard(kind: WorkoutKind): boolean {
  return kind === 'strength' || kind === 'endurance';
}

/**
 * Recomendação para hoje. Sem dados de prontidão → orientação neutra
 * (não inventa conselho). Caso contrário cruza score × intensidade do dia.
 *
 * `total` nulo cai na mesma orientação neutra que `hasData: false`, e de
 * propósito: desde o piso de cobertura de `computeReadiness`, "não há nota"
 * acontece também quando **há** sinais, só que velhos ou poucos demais. Nos dois
 * casos a resposta certa é a mesma — sincronizar —, então o texto serve aos dois.
 */
export function readinessAdvice(
  total: number | null,
  hasData: boolean,
  kind: WorkoutKind,
  label: string,
): ReadinessAdvice {
  if (!hasData || total == null) {
    return {
      tone: 'neutral',
      title: 'Prontidão indisponível',
      text: 'Sincronize a aba Saúde para receber a recomendação do dia.',
    };
  }

  const hard = isHard(kind);

  if (total < LOW) {
    if (hard) {
      return {
        tone: 'caution',
        title: 'Prontidão baixa',
        text: `Seu corpo pede recuperação. Considere aliviar “${label}” — reduza volume ou troque por mobilidade.`,
      };
    }
    return {
      tone: 'rest',
      title: 'Prontidão baixa',
      text: kind === 'rest'
        ? 'Hoje já é descanso — perfeito para recuperar.'
        : 'Prontidão baixa, mas o dia é leve. Mantenha tranquilo e priorize sono.',
    };
  }

  if (total < HIGH) {
    if (hard) {
      return {
        tone: 'neutral',
        title: 'Prontidão moderada',
        text: `Siga com “${label}”, mas monitore o esforço e evite estourar a intensidade.`,
      };
    }
    return {
      tone: 'neutral',
      title: 'Prontidão moderada',
      text: 'Dia leve combina bem com a prontidão de hoje.',
    };
  }

  // prontidão alta
  if (hard) {
    return {
      tone: 'go',
      title: 'Pronto para o esforço',
      text: `Boa prontidão — vá com tudo em “${label}”.`,
    };
  }
  if (kind === 'rest') {
    return {
      tone: 'go',
      title: 'Recuperado',
      text: 'Você está recuperado. Se quiser, dá para adiantar um treino leve.',
    };
  }
  return {
    tone: 'go',
    title: 'Pronto para o esforço',
    text: 'Boa prontidão — se sentir disposição, dá para puxar um pouco mais hoje.',
  };
}
