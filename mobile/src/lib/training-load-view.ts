/**
 * Carga da semana — lógica de apresentação do cartão do Histórico.
 *
 * Tudo aqui é puro: recebe o `TrainingLoad` do núcleo (mais o `trusted` da curva
 * de forma) e devolve texto, tom e geometria. O componente só desenha o que sai
 * daqui — e por isso é isto que se testa, sem renderizar nada. Mesmo padrão de
 * `form-curve-view.ts`.
 *
 * ## O que este arquivo resolve
 *
 * O núcleo devolve seis campos que podem ser `null`, e cada `null` significa uma
 * coisa diferente. Mandar todos para "sem dados" faria o cartão mentir por
 * omissão — em especial no caso `constant`, em que a monotonia é `null` porque a
 * razão é indefinida, mas a faixa diz `monotonous`: ali o `null` do número é o
 * **extremo** da escala, não a ausência dela.
 *
 * ## O portão de confiança
 *
 * A regra que não pode falhar: **com `trusted` falso, nenhuma faixa sai daqui.**
 * Silêncio de sincronização chega na série como zeros indistinguíveis de
 * descanso; zeros na janela aguda empurram o ACWR para baixo; e baixo é
 * `undertraining`, a faixa mais tranquilizadora da escala. Sync parado se
 * disfarça de semana leve, e é a curva de forma quem sabe a idade do dado.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-carga-acwr.md
 */
import {
  ACWR_CHRONIC_DAYS,
  buildTrainingLoad,
  type AcwrBand,
  type FormCurveDay,
  type TrainingLoad,
} from '@vitale/shared';

/** Tom do número e do chip. `mute` é ausência de faixa, não uma faixa a mais. */
export type LoadTone = 'under' | 'optimal' | 'caution' | 'risk' | 'mute';

/**
 * Rótulos das faixas. Descrevem **o que aconteceu**, não o que fazer: as
 * fronteiras vêm de estudos contestados e foram calibradas sobre o ACWR
 * acoplado, enquanto o número classificado aqui é o desacoplado, mais sensível.
 * "Risco" prometeria um diagnóstico que a evidência não sustenta. Ver ADR 0027.
 */
export const BAND_LABEL: Record<AcwrBand, string> = {
  undertraining: 'bem abaixo do costume',
  optimal: 'dentro do costume',
  caution: 'acima do costume',
  risk: 'muito acima do costume',
};

const BAND_TONE: Record<AcwrBand, LoadTone> = {
  undertraining: 'under',
  optimal: 'optimal',
  caution: 'caution',
  risk: 'risk',
};

/** O que ocupa a faixa central do cartão. As três variantes são excludentes. */
export type LoadBody =
  /** A escala com o marcador. `muted` quando a base ainda não encheu. */
  | { kind: 'scale'; value: number; muted: boolean }
  /** Não há índice: a frase explica por quê, no lugar da escala. */
  | { kind: 'void'; text: string }
  /** Dado velho: aviso tocável, e nenhuma faixa em lugar nenhum. */
  | { kind: 'alert'; text: string };

/** Tom da linha de textura. Separado de `LoadTone`: não é faixa de ACWR. */
export type TextureTone = 'ink' | 'alert' | 'mute';

export interface TextureLine {
  /** `1,4` ou `—`. */
  value: string;
  note: string;
  tone: TextureTone;
}

export interface LoadState {
  /** `+12%`, `−34%` ou `—`. */
  headline: string;
  tone: LoadTone;
  /** Rótulo da faixa; `null` sempre que não há faixa a mostrar. */
  chip: string | null;
  /** A razão crua, para conferir contra outra ferramenta. */
  ratioText: string;
  body: LoadBody;
  texture: TextureLine;
  footer: string;
}

/** Teto do domínio da escala. Acima disto o marcador encosta na ponta. */
export const SCALE_MAX = 2;

/** Quantas semanas a tendência de esforço mostra. */
export const STRAIN_WEEKS = 8;

export const FOOTER_DEFAULT =
  'A semana contra as 3 anteriores; hoje ainda não fechou. Faixa é orientação, não diagnóstico.';

/** O cartão só existe com dado carregado e pelo menos um dia na série. */
export function canShowLoad(loaded: boolean, series: readonly FormCurveDay[]): boolean {
  return loaded && series.length > 0;
}

/**
 * Vírgula decimal, como todo número do app em pt-BR.
 * `null` vira travessão, não `"null"`.
 */
export function decimal(v: number | null, places = 2): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toFixed(places).replace('.', ',');
}

/**
 * ACWR como percentual sobre a base: 1,12 → `+12%`, 0,66 → `−34%`.
 *
 * A razão crua é jargão; o percentual diz a mesma coisa e se lê sem manual. O
 * sinal segue o **valor arredondado**, e é o motivo de não bastar `Math.round`
 * direto: 0,999 arredonda para 0% e um `−0%` na tela seria erro visível. Usa o
 * menos tipográfico (−), não o hífen.
 */
export function percentText(acwr: number | null): string {
  if (acwr === null || !Number.isFinite(acwr)) return '—';
  const shown = Math.round((acwr - 1) * 100);
  if (shown === 0) return '0%';
  return shown > 0 ? `+${shown}%` : `−${Math.abs(shown)}%`;
}

/** Frase do aviso de dado velho. Fala de sincronização, não de descanso. */
export function staleText(daysSinceLastActivity: number | null): string {
  if (daysSinceLastActivity === null) return 'Sem sincronizar — o silêncio entra como descanso';
  const d = daysSinceLastActivity;
  return `${d} ${d === 1 ? 'dia' : 'dias'} sem sincronizar — o silêncio entra como descanso`;
}

/**
 * A linha da monotonia, sem a palavra "monotonia".
 *
 * O caso `constant` é o que justifica esta função existir: o número é `null`
 * porque o desvio é zero, e mesmo assim a faixa diz `monotonous`. Tratá-lo como
 * os outros `null` apagaria justamente o extremo que o índice de Foster existe
 * para denunciar.
 */
export function textureLine(tl: TrainingLoad, trusted: boolean): TextureLine {
  if (!trusted) return { value: '—', note: 'sem dado confiável', tone: 'mute' };
  if (tl.monotony !== null) {
    const monotonous = tl.monotonyBand === 'monotonous';
    return {
      value: decimal(tl.monotony, 1),
      note: monotonous ? 'dias iguais demais' : 'dias variados',
      tone: monotonous ? 'alert' : 'ink',
    };
  }
  switch (tl.monotonyReason) {
    case 'constant':
      return { value: '—', note: 'sete dias idênticos', tone: 'alert' };
    case 'idle':
      return { value: '—', note: 'semana sem treino', tone: 'mute' };
    case 'shortWeek':
      return { value: '—', note: 'semana ainda em curso', tone: 'mute' };
    default:
      return { value: '—', note: 'sem leitura', tone: 'mute' };
  }
}

/**
 * Por que não há índice. Os dois motivos pedem frases diferentes: um é falta de
 * histórico, o outro é ter parado — e o segundo é justamente o salto que a
 * métrica existiria para enxergar.
 */
function voidText(tl: TrainingLoad): string {
  if (tl.chronicDays === 0) {
    return 'Ainda não há três semanas de histórico atrás desta para comparar.';
  }
  return 'Você ficou parado nas semanas anteriores, então não há base de comparação. O número volta quando houver três semanas de histórico atrás desta.';
}

export function loadState(
  tl: TrainingLoad,
  trusted: boolean,
  daysSinceLastActivity: number | null,
): LoadState {
  const ratioText = `ACWR ${decimal(tl.acwr)}`;
  const texture = textureLine(tl, trusted);

  // O portão. Vem antes de tudo: com dado velho não sai faixa, nem chip, nem
  // escala, nem cor — e o número fica em tom apagado, como a curva já faz.
  if (!trusted) {
    return {
      headline: percentText(tl.acwr),
      tone: 'mute',
      chip: null,
      ratioText,
      body: { kind: 'alert', text: staleText(daysSinceLastActivity) },
      texture,
      footer: FOOTER_DEFAULT,
    };
  }

  if (tl.acwr === null) {
    return {
      headline: '—',
      tone: 'mute',
      chip: null,
      ratioText,
      body: { kind: 'void', text: voidText(tl) },
      texture,
      footer: FOOTER_DEFAULT,
    };
  }

  if (tl.shortWindow) {
    return {
      headline: percentText(tl.acwr),
      tone: 'mute',
      chip: 'base ainda aquecendo',
      ratioText,
      body: { kind: 'scale', value: tl.acwr, muted: true },
      texture,
      footer: `${tl.seriesDays} de ${ACWR_CHRONIC_DAYS} dias de base. O número ainda vai se mexer bastante.`,
    };
  }

  // Fora das janelas padrão o núcleo devolve `band: null` de propósito — as
  // fronteiras não valem para outra janela. Sem faixa, mas o número sai.
  return {
    headline: percentText(tl.acwr),
    tone: tl.band ? BAND_TONE[tl.band] : 'mute',
    chip: tl.band ? BAND_LABEL[tl.band] : null,
    ratioText,
    body: { kind: 'scale', value: tl.acwr, muted: false },
    texture,
    footer: FOOTER_DEFAULT,
  };
}

/**
 * Tendência de esforço: o strain de cada uma das últimas `weeks` semanas.
 *
 * O núcleo devolve um retrato, não uma série — então a tendência sai de N
 * chamadas sobre fatias da mesma série. É barato (tudo puro, janelas pequenas) e
 * mora aqui, e não no núcleo, porque é apresentação: se a web pedir a mesma
 * coisa, aí sim vira `buildTrainingLoadSeries` lá.
 *
 * `null` numa posição é semana sem leitura (constante ou parada), e quem desenha
 * mostra a ausência em vez de fingir um zero — strain zero e strain indefinido
 * são coisas diferentes.
 */
export function strainTrend(
  series: readonly FormCurveDay[],
  weeks: number = STRAIN_WEEKS,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const cut = series.length - w * 7;
    // Fatia curta demais para uma semana não produz leitura nenhuma.
    if (cut <= 0) {
      out.push(null);
      continue;
    }
    out.push(buildTrainingLoad(series.slice(0, cut)).strain);
  }
  return out;
}
