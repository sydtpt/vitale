/**
 * Diagramação da Retrospectiva — quais blocos existem, em que ordem, e quais
 * estão escondidos.
 *
 * O usuário pediu explicitamente "incluir ideias, ver quais uso mais, e depois
 * refinar ou remover". Isso só funciona se **remover for barato**: cada seção da
 * tela é um bloco com id, ordem e visibilidade, e matar um bloco é apagar uma
 * entrada — não cirurgia no template.
 *
 * ## A tensão, e a resolução
 *
 * A Retrospectiva é **um jornal**, e um jornal é igual toda edição — você abre e
 * sabe onde está tudo. Isso briga com blocos que o leitor rediagrama toda semana:
 * um jornal reordenável não é jornal, é feed.
 *
 * Resolução: os primeiros {@link PROOF_DAYS} dias são a **prova de gráfica**. Ele
 * testa, esconde, mata. Depois disso a diagramação **congela** — o controle de
 * ordem deixa de ser exposto — e bloco escondido há {@link DEATH_DAYS} dias sem
 * reativação sai do código. Portfólio primeiro, publicação depois.
 *
 * Persistido como jsonb `user_preferences.retro_prefs`, resolvido defensivamente
 * sobre os defaults: chave ausente ou versão antiga do app nunca quebra — herda o
 * default. Adicionar bloco novo = acrescentar ao catálogo, sem migration nova.
 *
 * Ver docs/specs/retrospectiva/v2-jornal.md §6.
 */
import type { PeriodKind } from './bounds';

/** Duração da prova de gráfica: depois disso a diagramação congela. */
export const PROOF_DAYS = 60;

/** Bloco escondido por este tanto de dias, sem reativação, sai do código. */
export const DEATH_DAYS = 60;

export type RetroBlockId =
  | 'lede'
  | 'kpis'
  | 'highlights'
  | 'heatmap'
  | 'tasks'
  | 'dailyTasks'
  | 'purchases'
  | 'fitness'
  | 'sports'
  | 'health'
  | 'habits'
  | 'yearSeries';

export interface RetroBlockDef {
  id: RetroBlockId;
  label: string;
  /** Em que modos o bloco faz sentido. Vazio ⇒ todos. */
  kinds?: readonly PeriodKind[];
  /** Blocos que a manchete precisa para existir não podem ser escondidos. */
  fixed?: boolean;
}

/**
 * O catálogo — a ordem aqui **é** a diagramação padrão do jornal, e a ordem
 * padrão é editorial: a manchete abre, o número contextualiza, o detalhe segue.
 */
export const RETRO_BLOCKS: readonly RetroBlockDef[] = [
  { id: 'lede', label: 'A manchete', fixed: true },
  { id: 'kpis', label: 'Números do período' },
  { id: 'highlights', label: 'Destaques' },
  { id: 'heatmap', label: 'Grade diária', kinds: ['week', 'month', 'season'] },
  { id: 'tasks', label: 'Tarefas feitas' },
  { id: 'dailyTasks', label: 'Tarefas — todo dia', kinds: ['week', 'month'] },
  { id: 'purchases', label: 'Compras & gastos' },
  { id: 'fitness', label: 'Treinos & atividade' },
  { id: 'sports', label: 'Ciclismo & corrida' },
  { id: 'health', label: 'Saúde & bem-estar' },
  { id: 'habits', label: 'Hábitos & registros' },
  { id: 'yearSeries', label: 'Por mês', kinds: ['year'] },
];

const BY_ID = new Map(RETRO_BLOCKS.map((b) => [b.id, b]));

export interface RetroPrefs {
  /** Ordem completa dos blocos. Ids desconhecidos são descartados na resolução. */
  order: RetroBlockId[];
  /** Escondidos → dia 'YYYY-MM-DD' em que foram escondidos, p/ a regra dos 60 dias. */
  hidden: Partial<Record<RetroBlockId, string>>;
  /** Dia 'YYYY-MM-DD' em que a prova de gráfica começou. Ausente ⇒ ainda não começou. */
  proofStartedOn?: string;
}

export const DEFAULT_RETRO_PREFS: RetroPrefs = {
  order: RETRO_BLOCKS.map((b) => b.id),
  hidden: {},
};

/**
 * Resolve o jsonb cru sobre os defaults.
 *
 * **Blocos novos entram no fim**, não somem: uma ordem salva por uma versão antiga
 * do app não pode esconder uma seção que passou a existir depois.
 */
export function resolveRetroPrefs(raw: unknown): RetroPrefs {
  if (!raw || typeof raw !== 'object') {
    return { order: [...DEFAULT_RETRO_PREFS.order], hidden: {} };
  }
  const r = raw as Record<string, unknown>;

  const seen = new Set<RetroBlockId>();
  const order: RetroBlockId[] = [];
  if (Array.isArray(r['order'])) {
    for (const id of r['order']) {
      if (typeof id !== 'string') continue;
      const key = id as RetroBlockId;
      if (!BY_ID.has(key) || seen.has(key)) continue;
      seen.add(key);
      order.push(key);
    }
  }
  for (const b of RETRO_BLOCKS) if (!seen.has(b.id)) order.push(b.id);

  const hidden: Partial<Record<RetroBlockId, string>> = {};
  const rawHidden = r['hidden'];
  if (rawHidden && typeof rawHidden === 'object') {
    for (const [k, v] of Object.entries(rawHidden as Record<string, unknown>)) {
      const key = k as RetroBlockId;
      const def = BY_ID.get(key);
      // `fixed` nunca fica escondido, nem que o jsonb diga o contrário.
      if (!def || def.fixed || typeof v !== 'string') continue;
      hidden[key] = v;
    }
  }

  const proof = r['proofStartedOn'];
  return {
    order,
    hidden,
    ...(typeof proof === 'string' ? { proofStartedOn: proof } : {}),
  };
}

/** Dias inteiros entre dois 'YYYY-MM-DD'. Negativo quando `b` é anterior a `a`. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * Os blocos a renderizar, na ordem, para um dado modo — já sem os escondidos e
 * sem os que não fazem sentido no período.
 */
export function visibleBlocks(prefs: RetroPrefs, kind: PeriodKind): RetroBlockDef[] {
  const out: RetroBlockDef[] = [];
  for (const id of prefs.order) {
    const def = BY_ID.get(id);
    if (!def) continue;
    if (prefs.hidden[id]) continue;
    if (def.kinds && !def.kinds.includes(kind)) continue;
    out.push(def);
  }
  return out;
}

/**
 * A diagramação ainda está aberta para edição?
 *
 * Congela quando a prova de gráfica termina. Sem `proofStartedOn` a prova ainda
 * não começou — segue aberta.
 */
export function layoutEditable(prefs: RetroPrefs, today: string): boolean {
  if (!prefs.proofStartedOn) return true;
  return daysBetween(prefs.proofStartedOn, today) < PROOF_DAYS;
}

/**
 * Blocos escondidos há {@link DEATH_DAYS} dias sem reativação — **candidatos a
 * sair do código**, não removidos automaticamente.
 *
 * Apagar código é decisão humana; o que a regra faz é impedir que "depois eu
 * removo" vire uma coleção de seis seções que ninguém olha. Chamar num diagnóstico
 * ou numa tela de manutenção.
 */
export function deadBlocks(prefs: RetroPrefs, today: string): RetroBlockId[] {
  const out: RetroBlockId[] = [];
  for (const [id, since] of Object.entries(prefs.hidden)) {
    if (typeof since !== 'string') continue;
    if (daysBetween(since, today) >= DEATH_DAYS) out.push(id as RetroBlockId);
  }
  return out;
}

/** Alterna a visibilidade de um bloco, carimbando o dia em que foi escondido. */
export function toggleBlock(prefs: RetroPrefs, id: RetroBlockId, today: string): RetroPrefs {
  const def = BY_ID.get(id);
  if (!def || def.fixed) return prefs;
  const hidden = { ...prefs.hidden };
  if (hidden[id]) delete hidden[id];
  else hidden[id] = today;
  return { ...prefs, hidden };
}

/** Move um bloco uma posição para cima (`-1`) ou para baixo (`+1`). */
export function moveBlock(prefs: RetroPrefs, id: RetroBlockId, dir: -1 | 1): RetroPrefs {
  const order = [...prefs.order];
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return prefs;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...prefs, order };
}
