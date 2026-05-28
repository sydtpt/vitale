/**
 * Vitale — Domain Models
 * Shared across web & mobile.
 */

export interface Meal {
  id: string;
  name: string;
  time: string;
  kcal: number;
  done: boolean;
  emoji: string;
  items: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  done: boolean;
  streak: number;
}

/** Direção da meta de um hábito contador. */
export type HabitDirection = 'at_least' | 'at_most';

/**
 * Hábito contador (quantitativo) — distinto do `Habit` binário acima.
 * O valor diário acumula em `HabitLog`. Só campos, sem lógica.
 * Ver .claude/specs/habitos/.
 */
export interface CounterHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  unit: string;            // 'L' | 'un' | 'cig' ...
  step: number;            // incremento por toque
  target?: number;         // meta (at_least) / teto (at_most); ausente = sem meta
  direction: HabitDirection;
  bad: boolean;            // true = hábito a evitar; mostra dias SEM fazer em vez de sequência cumprindo
  showOnHome: boolean;     // true = aparece na home (tela "Hoje"); false = só na tela de hábitos
  active: boolean;
  sort: number;
  createdAt: string;       // ISO; usado para limitar a contagem de dias "sem fazer" à idade do hábito
}

/** Valor acumulado de um CounterHabit num dia (1 por habit/dia). */
export interface HabitLog {
  id: string;
  habitId: string;
  logDate: string;         // 'YYYY-MM-DD' (data local)
  value: number;
}

export interface Chore {
  id: string;
  name: string;
  done: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  qty: string;
  done: boolean;
  cat: string;
}

export interface Treino {
  day: string;
  date: number;
  type: string;
  dur: number;
  vol: number;
  done: boolean;
  rest: boolean;
  planned: boolean;
  run: { dist: number; pace: string } | null;
}

export interface Lift {
  name: string;
  sets: string;
  current: number;
  history: number[];
}

export interface RunWeek {
  week: string;
  km: number;
  runs: number;
}

export interface FinancaCategory {
  cat: string;
  amount: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: number;
  date: string;
  name: string;
  cat: string;
  amount: number;
}

export interface RecurringItem {
  name: string;
  every: string;
  last: string;
  due: string;
}

/** Categorias canônicas de itens de compras. */
export const SHOP_CATS = ['Proteínas', 'Vegetais', 'Laticínios', 'Grãos', 'Higiene', 'Limpeza', 'Outros'] as const;
export type ShopCat = typeof SHOP_CATS[number];

/** Dados extras de um item de compras — guardados em TodoTemplate.meta. */
export interface ShopMeta {
  qty?: string;    // ex: "500g", "2 caixas"
  cat: ShopCat;   // categoria para agrupamento
  price?: number;  // preço estimado em BRL
}

export interface CasaTarefa {
  name: string;
  every: string;
  when: string;
}

export interface Meta {
  name: string;
  cat: string;
  progress: number;
  target: string;
  current: string;
}

export interface DayData {
  date: string;
  greeting: string;
  weekDay: string;
  treino: {
    name: string;
    time: string;
    duration: string;
    exercises: number;
    location: string;
  };
  meals: Meal[];
  water: { current: number; goal: number };
  habits: Habit[];
  casa: Chore[];
  compras: ShopItem[];
}

export type WeekDay = 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SÁB' | 'DOM';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

/**
 * Treino sincronizado do HealthKit (push-only). Identidade = ID do HealthKit.
 * Mapeia a tabela `activities` do Supabase.
 */
export interface Activity {
  id: string;
  userId: string;
  activityId: number;
  activityName?: string;
  calories: number;
  startAt: string;
  endAt: string;
  durationS: number;
  /** Tempo em movimento (s): tempo total menos as pausas. Ausente em linhas antigas. */
  movingTimeS?: number;
  distanceM?: number;
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  hasRoute: boolean;
  metadata?: Record<string, unknown>;
  /**
   * Recordes de corrida (best efforts): menor tempo (s) para cobrir cada
   * distância padrão, derivado do track GPS. Chaves: distância em metros como
   * string (`"1000"`, `"5000"`, …) e `"half"` / `"marathon"`. Ausente em
   * corridas sem GPS e em linhas antigas (preenchido ao re-sincronizar).
   */
  bestEfforts?: Record<string, number>;
  /**
   * Tempo (segundos) em cada zona de FC, derivado das amostras de frequência
   * cardíaca do treino. Chaves: `"z1"`…`"z5"` (ver `HR_ZONES` no shared). Ausente
   * em treinos sem amostras de FC e em linhas antigas (preenchido ao re-sincronizar).
   */
  hrZones?: Record<string, number>;
  /** true quando editado manualmente na web; o sync deixa de sobrescrever. */
  locallyEdited?: boolean;
  editedAt?: string;
  /** true quando editado e depois apagado no HealthKit — fora de métricas/listas. */
  hidden?: boolean;
}

export interface ActivityRoutePoint {
  lat: number;
  lng: number;
  alt?: number;
  /** Timestamp do ponto em epoch ms. Ausente em rotas antigas. Base dos best efforts. */
  t?: number;
}

/** Rota GPS de um treino outdoor. Mapeia a tabela `activity_routes`. */
export interface ActivityRoute {
  activityId: string;
  points: ActivityRoutePoint[];
  pointCount: number;
}

/**
 * Tarefas (to-do com agendamento) — módulo separado de Habitos.
 * Uma `TodoTemplate` (regra/série) gera `TodoOccurrence` (itens na lista).
 * Só campos, sem lógica. Ver .claude/specs/tarefas/.
 */

/** Categoria/ponte de integração da tarefa com outros módulos. */
export type TodoModule = 'financas' | 'compras' | 'casa' | 'saude' | 'geral';

/** Política de cancelamento: obrigatória (none), cancelável (manual) ou auto após o dia (lixo). */
export type TodoCancelPolicy = 'none' | 'manual' | 'auto';

/** Se não fizer no dia: permanece atrasada (carry) ou expira/some (expire). */
export type TodoOverduePolicy = 'carry' | 'expire';

/**
 * Recorrência — união discriminada por `kind`.
 * Âncora: monthly/weekly/yearly ancoram no calendário; after_completion na conclusão.
 * weekdays usa 0=domingo … 6=sábado (getDay).
 */
export type TodoRecurrence =
  | { kind: 'none' }                                       // avulsa
  | { kind: 'monthly'; day: number }                       // dia X do mês
  | { kind: 'weekly'; weekdays: number[] }                 // dias da semana
  | { kind: 'yearly'; month: number; day: number }         // anual (month 1..12)
  | { kind: 'after_completion'; intervalDays: number }     // N dias após concluir
  | { kind: 'usage'; meterUnit: string; every: number }    // não-temporal: por uso/contador
  | { kind: 'event'; label: string }                       // não-temporal: por evento manual
  | { kind: 'stock'; shopItemRef?: string }                // não-temporal: por estoque (ponte Compras)
  // gatilho de CRIAÇÃO automática por atividade HealthKit (a ocorrência nasce quando o treino é registrado):
  | { kind: 'on_workout'; activityId?: number; dueInDays?: number };

/**
 * Encadeamento: ao concluir esta série, instanciar ocorrências de outras séries.
 * A série-filha mantém sua própria `recurrence` — o encadeamento é apenas um
 * gatilho adicional de criação. `ifPending`: 'ignore' = não duplica se já houver
 * pendente; 'duplicate' = sempre cria uma nova.
 */
export interface TodoSpawnRule {
  templateId: string;
  ifPending: 'ignore' | 'duplicate';
}

/** Definição/regra de uma tarefa recorrente (ou avulsa). Mapeia `todo_templates`. */
export interface TodoTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;                  // token do design system (MOD)
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoOverduePolicy;
  cancelPolicy: TodoCancelPolicy;
  meter?: number;                 // estado atual do contador (recurrence.kind === 'usage')
  meterAtLastDone?: number;       // leitura do contador na última conclusão
  linkedActivityId?: number;      // activityId HealthKit que conclui esta tarefa (corrida=37, bike=13...)
  onComplete?: TodoSpawnRule[];   // encadeamento: ao concluir, instancia ocorrências destas séries
  triggerOnly?: boolean;          // true = só nasce por gatilho (onComplete/on_workout/manual); ignora ocorrência inicial e calendário
  meta?: Record<string, unknown>; // dados extras por módulo (ex: ShopMeta para compras)
  active: boolean;
  sort: number;
  createdAt: string;              // ISO
}

/** Estado de uma ocorrência concreta. */
export type TodoStatus = 'pending' | 'done' | 'skipped' | 'canceled' | 'expired';

/** Item concreto que aparece na lista. 1 por (template, dueDate). Mapeia `todo_occurrences`. */
export interface TodoOccurrence {
  id: string;
  templateId: string;
  dueDate: string | null;         // 'YYYY-MM-DD' local; null = sem data (até concluir)
  status: TodoStatus;
  doneAt?: string;                // ISO; quando marcada feita
  meta?: Record<string, unknown>; // conclusão rica: { amount } finanças, { shopItemId } compras
  createdAt: string;              // ISO
}

/**
 * Registros — marcação diária de atividades avulsas. Módulo separado de Habitos
 * (contador com meta) e Tarefas (to-do com agendamento). Sem recorrência nem meta:
 * o usuário só marca "feito hoje" (1×/dia) para registrar e analisar depois.
 * Reusa `TodoModule` para a categoria. Só campos, sem lógica. Ver .claude/specs/registros/.
 */

/** Definição de um registro avulso (ex.: Pizza, Dentista). Mapeia `registros`. */
export interface Registro {
  id: string;
  name: string;
  icon: string;        // nome do ícone canônico (HABIT_ICONS)
  color: string;       // token do design system (MOD)
  module: TodoModule;  // categoria/cor — mesmo conjunto das tarefas
  active: boolean;     // false = arquivado (some da captura, mantém histórico)
  sort: number;        // ordem na captura
  createdAt: string;   // ISO
}

/** Marca binária de um Registro num dia (1 por registro/dia). Mapeia `registro_logs`. */
export interface RegistroLog {
  id: string;
  registroId: string;
  logDate: string;     // 'YYYY-MM-DD' (data local)
}

/**
 * Perfil visível do usuário. Mapeia a tabela `user_profiles`.
 * Ver .claude/specs/settings/.
 */
export interface UserProfile {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  updatedAt: string;
}

export type AppTheme = 'system' | 'light' | 'dark';

/**
 * Preferências de app do usuário (tema, notificações, metas). 1 linha por usuário.
 * Mapeia a tabela `user_preferences`. Ver .claude/specs/settings/.
 */
export interface UserPreferences {
  userId: string;
  theme: AppTheme;
  glassEnabled: boolean;
  language: string;
  notificationsEnabled: boolean;
  dailyReminderTime?: string;         // 'HH:MM'
  nutritionCaloriesGoal?: number;
  nutritionProteinG?: number;
  nutritionCarbsG?: number;
  nutritionFatG?: number;
  trainingDaysPerWeek?: number;
  updatedAt: string;
}

/**
 * Agregado diário de uma métrica de saúde (Apple Health). 1 linha por
 * (user, dia, métrica). Mapeia a tabela `health_daily`. O mobile agrega as
 * amostras do HealthKit antes de enviar — nunca sobem amostras brutas.
 * `metric` referencia o catálogo em `health/metric-catalog`.
 */
export interface HealthDaily {
  userId: string;
  day: string;                          // 'YYYY-MM-DD' (data local)
  metric: string;                       // id de HealthMetricMeta ('passos','fc',...)
  value: number | null;                 // soma (cumulative) ou média (discrete)
  minValue?: number;                    // só discretas
  maxValue?: number;                    // só discretas
  count?: number;                       // nº de amostras agregadas
  extra?: Record<string, unknown>;      // pressão {sys,dia}, anéis, macros
}
