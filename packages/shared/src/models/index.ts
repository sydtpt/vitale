/**
 * Vitale — Domain Models
 * Shared across web & mobile.
 */

import type { MapStyle } from '../constants/map';
import type { Wallpaper } from '../constants/wallpaper';
import type { NotificationPrefs } from '../constants/notifications';
import type { ReferenceLineScheme } from '../constants/reference-lines';
import type { ThemeId } from '../theme/themes';
import type { PaletteId } from '../theme/palettes';
import type { BrandId } from '../theme/brands';

export interface Meal {
  id: string;
  name: string;
  time: string;
  kcal: number;
  done: boolean;
  emoji: string;
  items: string;
}

/** Tipo de refeição (persistido em `meals.meal_type`; sem acento p/ o check do Postgres). */
export type MealType = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'outro';

/** Tipos oferecidos nos seletores de captura (na ordem do dia). */
export const MEAL_TYPES: readonly MealType[] = ['cafe', 'almoco', 'lanche', 'jantar'] as const;

/** Rótulos exibíveis por tipo de refeição. */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  cafe: 'Café',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
  outro: 'Outro',
};

/**
 * Refeição logada num dia (tabela `meals`). Distinta do `Meal` (mock da Hoje):
 * é um registro pontual real, com macros opcionais. Só campos, sem lógica.
 */
export interface MealLog {
  id: string;
  mealDate: string;        // 'YYYY-MM-DD' (data local)
  mealType: MealType;
  name: string;            // "o que você comeu"
  kcal?: number;
  protein?: number;        // macros opcionais (g)
  carbs?: number;
  fat?: number;
  loggedAt: string;        // ISO
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
 * Ver docs/specs/habitos/.
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

/**
 * Treino planejado para um dia, persistido no Supabase (`planned_workouts`).
 * Distinto do `Treino` (mock da grade antiga) e da `Activity` (treino real
 * sincronizado do HealthKit): aqui é a *intenção* do usuário para o dia.
 *
 * `kind` é escolhido explicitamente ao planejar (não inferido), e alimenta
 * direto a recomendação de prontidão (`readinessAdvice`). A conclusão é por
 * auto-match: se houver uma `Activity` compatível no mesmo dia local, o treino
 * vira `done` e guarda o `doneActivityId`.
 */
export interface PlannedWorkout {
  id: string;
  /** Data local do dia agendado (YYYY-MM-DD). */
  date: string;
  type: string;
  /** Intensidade planejada — direciona o readiness. `rest` = descanso. */
  kind: 'strength' | 'endurance' | 'easy' | 'rest';
  durMin: number;
  /** Só para `endurance` (corrida/bike); ausente nos demais. */
  distKm?: number;
  done: boolean;
  /** Id da `Activity` que casou com este treino (auto-match). */
  doneActivityId?: string;
  sort: number;
  createdAt: string;
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

/** Categorias canônicas de despesa (tabela `transactions`). */
export const FINANCA_CATS = ['Alimentação', 'Transporte', 'Casa', 'Saúde', 'Lazer', 'Outros'] as const;
export type FinancaCat = typeof FINANCA_CATS[number];

/**
 * Despesa lançada (tabela `transactions`). Nome distinto do legado `Transaction`
 * (id:number, usado pelo mock de Finanças) para não colidir. Só campos, sem lógica.
 */
export interface FinanceTransaction {
  id: string;
  date: string;            // 'YYYY-MM-DD' (data local; tx_date)
  description: string;
  category: string;        // FINANCA_CATS ou livre
  amount: number;          // em reais
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

/**
 * Metas anuais contabilizadas automaticamente a partir de dados que já existem
 * no app (atividades, tarefas concluídas, hábitos) ou informados à mão.
 * Só campos, sem lógica — a avaliação de progresso vive em `goals/evaluate`.
 * Ver docs/specs/web-metas.md.
 */

/**
 * Como a meta mede progresso:
 *  - `cadence`    → "≥N por período" ao longo do ano (ex.: correr 1x/mês).
 *  - `milestone`  → marco único no ano (ex.: 1 meia-maratona, agachar 100kg).
 *  - `cumulative` → soma no ano até um alvo (ex.: ler 12 livros, economizar R$8.000).
 */
export type GoalFamily = 'cadence' | 'milestone' | 'cumulative';

/** Sub-período de uma meta de cadência. O container é sempre o ano. */
export type GoalPeriodKind = 'week' | 'month';

/** Fonte do sinal — o que conta o progresso. */
export type GoalSourceKind = 'activity' | 'task' | 'habit' | 'manual';

/** Métrica lida de atividades (source.kind === 'activity'). */
export type GoalActivityMetric = 'count' | 'distance' | 'bestEffort';

export interface GoalSource {
  kind: GoalSourceKind;
  // activity:
  activityId?: number;              // tipo HealthKit (corrida=37...); ausente = qualquer atividade
  activityMetric?: GoalActivityMetric; // default 'count'
  bestEffortKey?: string;           // 'half' | 'marathon' | '5000'... — só com activityMetric='bestEffort'
  // task:
  templateId?: string;              // conta occurrences 'done' desta série de tarefa
  // habit:
  habitId?: string;                 // conta dias que bateram a meta deste hábito contador
}

/** Meta anual. Mapeia a tabela `goals`. */
export interface Goal {
  id: string;
  year: number;                     // ano-container (ex.: 2026)
  title: string;
  cat: string;                      // token de módulo (MOD) p/ cor/agrupamento
  family: GoalFamily;
  source: GoalSource;
  /** cadence: sub-período da meta (semana|mês). Ignorado nas outras famílias. */
  period?: GoalPeriodKind;
  /** cadence: mínimo de ocorrências por sub-período (ex.: 1). */
  perPeriodTarget?: number;
  /**
   * Alvo numérico, interpretado pela família:
   *  - cadence:    nº de sub-períodos que precisam cumprir (ausente = todos do ano)
   *  - cumulative: total no ano (ex.: 12 livros; distância em metros)
   *  - milestone:  limiar a atingir (distância em metros; 1 = binário via bestEffort/contagem)
   */
  target: number;
  unit?: string;                    // rótulo de exibição ('km','livros','R$'...)
  manualCurrent?: number;           // source.kind === 'manual': valor atual informado à mão
  active: boolean;
  sort: number;
  createdAt: string;                // ISO
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
  /**
   * Ganho de elevação acumulado (m), derivado do track GPS no sync (soma das
   * subidas > 1 m entre pontos consecutivos). Ausente em treinos sem rota/altitude
   * e em linhas antigas (preenchido pelo backfill da migration ou ao re-sincronizar).
   */
  elevationM?: number;
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
  /**
   * true quando `calories` é estimativa, não medida: o treino chegou sem
   * calorias (logado direto na Strava, sem relógio) e o banco preencheu com a
   * mediana de kcal/min do usuário naquele tipo × a duração desta linha.
   */
  caloriesEstimated?: boolean;
  /**
   * true quando `hrZones` é estimativa: o treino chegou sem nada medido e o
   * banco distribuiu a duração pela forma média das zonas do usuário naquele
   * tipo. Só acontece em linha sem calorias medidas — linha do relógio sem
   * zonas é ambígua (aguarda o re-sync trazer as zonas reais) e fica intocada.
   */
  hrZonesEstimated?: boolean;
  /** true quando editado manualmente na web; o sync deixa de sobrescrever. */
  locallyEdited?: boolean;
  editedAt?: string;
  /** true quando editado e depois apagado no HealthKit — fora de métricas/listas. */
  hidden?: boolean;
  /** Fonte que criou a linha: 'healthkit' | 'strava' | 'intervals'. Ausente = healthkit. */
  provider?: string;
  /** Id do treino na fonte de origem (UUID do HK, id numérico Strava/intervals). */
  externalId?: string;
  /** Fontes já mescladas nesta linha canônica (provider → id externo). */
  externalIds?: Record<string, string>;
  /**
   * Cidades atravessadas pela rota, na ordem do percurso. Derivadas por
   * reverse-geocoding do track GPS no ingest (só treinos de bicicleta hoje).
   * Ausente em treinos sem rota, tipos não cobertos e linhas ainda não
   * enriquecidas (o passe do ingest preenche ao longo dos ticks).
   */
  cities?: CityMark[];
}

/**
 * Uma cidade atravessada por uma rota. `lat`/`lng` são o centro da cidade
 * (âncora para rótulos no mapa/cartão). `state`/`country` são opcionais
 * (dependem do que o geocoder devolve) e servem para agregações em reports.
 */
export interface CityMark {
  name: string;
  state?: string;
  country?: string;
  /**
   * Código do país em ISO 3166-1 alpha-2 maiúsculo (ex.: `"BR"`, `"BE"`), do
   * `address.country_code` do Nominatim. Chave estável para agrupar por país —
   * independe do idioma da resposta (ao contrário de `country`, texto livre).
   * Ausente em marcas gravadas antes do enriquecimento passar a capturá-lo.
   */
  countryCode?: string;
  lat: number;
  lng: number;
}

export interface ActivityRoutePoint {
  lat: number;
  lng: number;
  alt?: number;
  /** Timestamp do ponto em epoch ms. Ausente em rotas antigas. Base dos best efforts. */
  t?: number;
}

/**
 * Ponto de rota **como o HealthKit entrega** — nomes longos e timestamp ISO.
 * `ActivityRoutePoint` acima é a forma **persistida**, compacta e em epoch ms.
 * São dois formatos do mesmo conceito; converter entre eles é trabalho de
 * adaptador, e é por isso que os dois vivem lado a lado aqui.
 */
export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Timestamp do ponto (ISO) vindo do HealthKit. Base do cálculo de best efforts. */
  timestamp?: string;
}

/** Rota GPS de um treino outdoor. Mapeia a tabela `activity_routes`. */
export interface ActivityRoute {
  activityId: string;
  points: ActivityRoutePoint[];
  pointCount: number;
}

/** Provedores externos vinculáveis na tela de Conexões. */
export type ConnectionProvider = 'strava' | 'intervals';

export type ConnectionStatus = 'pending' | 'connected' | 'error' | 'revoked';

/**
 * Conta vinculada de um provedor externo (Strava, intervals.icu). Mapeia a
 * tabela `linked_accounts` — só o estado legível pelo client; credenciais vivem
 * em `linked_account_secrets` (invisível fora das edge functions).
 */
export interface LinkedAccount {
  userId: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  athleteId?: string;
  athleteName?: string;
  /** Progresso do backfill inicial: true quando o histórico já foi importado. */
  backfillDone: boolean;
  lastSyncAt?: string;
  lastError?: string;
  connectedAt?: string;
}

/**
 * Tarefas (to-do com agendamento) — módulo separado de Habitos.
 * Uma `TodoTemplate` (regra/série) gera `TodoOccurrence` (itens na lista).
 * Só campos, sem lógica. Ver docs/specs/tarefas/.
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
  startDate?: string;             // 'YYYY-MM-DD' local; "a partir de": antes desse dia a série fica oculta. null/ausente = vale desde já ("Agora")
  startTime?: string;             // 'HH:MM' local; só vale p/ recorrências com data. A ocorrência do dia só aparece a partir desse horário — e é quando o lembrete local dispara (buildTaskReminders)
  endTime?: string;               // 'HH:MM' local; após esse horário no dia a ocorrência é cancelada automaticamente (sobrepõe carry/cancelPolicy)
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
 * Reusa `TodoModule` para a categoria. Só campos, sem lógica. Ver docs/specs/registros/.
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
 * Ratings subjetivos de um dia (1–5). Mapeia a tabela `daily_ratings` (1 linha
 * por user/dia). `sleepQuality` é preenchido ao acordar; `dayQuality` + `dayNote`
 * ao fim do dia. Valor subjetivo, deliberadamente desacoplado de outros dados.
 */
export interface DailyRating {
  day: string;                  // 'YYYY-MM-DD' (data local)
  sleepQuality: number | null;  // 1..5 — percepção da noite de sono
  dayQuality: number | null;    // 1..5 — percepção do dia como um todo
  dayNote: string | null;       // anotação livre opcional do dia
}

/**
 * Perfil visível do usuário. Mapeia a tabela `user_profiles`.
 * Ver docs/specs/settings/.
 */
/**
 * Perfil do usuário — quem ele é. Configuração do app fica em
 * `UserPreferences`. `name` e `birthdate` são obrigatórios: o banco os exige e
 * o fluxo de setup os coleta antes de liberar o app.
 */
export interface Profile {
  userId: string;
  name: string;
  /** 'YYYY-MM-DD'. Alimenta estimativa de FC máxima e linhas de base de saúde. */
  birthdate: string;
  avatarUrl?: string;
  updatedAt?: string;
}

/** @deprecated Superada por `Profile`; some quando o mobile migrar de `user_profiles`. Ver ADR 0011. */
export interface UserProfile {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  updatedAt: string;
}

/**
 * Preferência de **esquema** claro/escuro.
 *
 * `system` segue o sistema operacional; `solar` segue o sol no lugar onde o
 * aparelho está — ver `astro/solar-scheme`. Os dois são automáticos, mas por
 * autoridades diferentes, e é por isso que são opções separadas em vez de uma:
 * quem deixa o celular no escuro o dia todo quer `system`, quem quer o app
 * acompanhando a luz da janela quer `solar`.
 */
export type AppTheme = 'system' | 'light' | 'dark' | 'solar';

/** Os valores de `AppTheme`, para UI e para a barreira do CHECK no banco. */
export const APP_THEMES: readonly AppTheme[] = ['system', 'light', 'dark', 'solar'];

/**
 * Preferências de app do usuário (tema, notificações, metas). 1 linha por usuário.
 * Mapeia a tabela `user_preferences`. Ver docs/specs/settings/.
 */
export interface UserPreferences {
  userId: string;
  /**
   * **Esquema** claro/escuro/sistema — não confundir com `themeId`. O nome ficou
   * de quando havia só este eixo, e a coluna `theme` no banco carrega o mesmo
   * mal-entendido. Renomear custaria migration nos dois apps por ganho
   * cosmético; documentar sai mais barato.
   */
  theme: AppTheme;
  /** Família de neutros: `orbe`, `clean` ou `cleanElev`. Ver `theme/themes.ts`. */
  themeId: ThemeId;
  /** Família cromática: `orbe` + as cinco outras. Vale para o app E os gráficos. */
  paletteId: PaletteId;
  /**
   * Cor de marca — o cromo (FAB, CTA, toggle). Independente da paleta: ela
   * governa os módulos, esta governa a voz do app.
   */
  brandId: BrandId;
  glassEnabled: boolean;
  blurIntensity: number;           // 0–100; 100 = blur máximo / mais transparente
  language: string;
  notificationsEnabled: boolean;
  mapStyle: MapStyle;                 // estilo dos mapas de atividade
  wallpaper: Wallpaper;               // papel de parede (fundo) do app
  dailyReminderTime?: string;         // 'HH:MM'
  nutritionCaloriesGoal?: number;
  nutritionProteinG?: number;
  nutritionCarbsG?: number;
  nutritionFatG?: number;
  trainingDaysPerWeek?: number;
  /** FC máxima do usuário (bpm). Base das zonas de FC (% da FCmáx). Ausente ⇒ estima por idade. */
  maxHr?: number;
  /**
   * Meta semanal de atividade em minutos de esforço (escala ancorada no vigoroso) — a
   * linha de referência do gráfico de duração no Histórico. Ausente ⇒
   * `DEFAULT_WEEKLY_TARGET_MIN` (95). A OMS recomenda a faixa 75–150 vigorosos, que são
   * os mesmos 150–300 moderados da outra formulação; ver `health/who-activity`.
   */
  weeklyActivityTargetMin?: number;
  /**
   * Diagramação da Retrospectiva — ordem e visibilidade dos blocos + a data em
   * que a prova de gráfica começou. Resolver sempre com `resolveRetroPrefs`.
   * Ver docs/specs/retrospectiva/v2-jornal.md §6.
   */
  retroPrefs?: RetroPrefs;
  /**
   * Cores das linhas de referência do gráfico de duração (esforço médio e
   * progressão). Ausente ⇒ `DEFAULT_REFERENCE_LINE_SCHEME`. Ver
   * `constants/reference-lines`.
   */
  referenceLineScheme?: ReferenceLineScheme;
  /** Preferências de notificações locais (quais tipos + agenda das retrospectivas). */
  notificationPrefs?: NotificationPrefs;
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

/* ─────────────────────────────────────────────────────────────
 * Cultura — livros, filmes, podcasts e álbuns.
 * Spec: docs/specs/cultura/spec.md
 * ───────────────────────────────────────────────────────────── */

/**
 * `CulturaTipo` e `CulturaEstado` moram em `cultura/tipos`, não aqui: aquele
 * módulo precisa ser auto-contido para a edge function poder importá-lo, e o
 * vocabulário é dele. Importados, nunca re-exportados — `src/index.ts` já
 * exporta os dois de lá, e re-exportar aqui criaria ambiguidade.
 */
import type { CulturaEstado, CulturaTipo } from '../cultura/tipos';
import type { RetroPrefs } from '../period/retro-blocks';

/**
 * Um item da estante. Mapeia `cultura_items` — tabela única, sem sessões:
 * o par `iniciadoEm`/`concluidoEm` é todo o sinal temporal do módulo, e define
 * uma janela de consumo, nunca dias (CAP-5).
 */
export interface CulturaItem {
  id: string;
  userId: string;
  tipo: CulturaTipo;
  titulo: string;
  criador?: string;              // autor, diretor, apresentador ou artista
  estado: CulturaEstado;
  nota?: number;                 // 1–5, editável em qualquer estado (CAP-4)
  indicadoPor?: string;          // quem recomendou (CAP-11)
  fonte?: string;                // provedor; ausente em item cadastrado à mão
  fonteId?: string;              // id externo, para reconsultar a origem
  capaUrl?: string;
  extra?: Record<string, unknown>; // metadado da mídia: paginas, duracaoMin, ano
  iniciadoEm?: string;           // 'YYYY-MM-DD' — nulo se e somente se estado='quero'
  concluidoEm?: string;          // 'YYYY-MM-DD' — não-nulo se e somente se estado='concluido'
  criadoEm: string;              // ISO
  atualizadoEm: string;          // ISO
}
