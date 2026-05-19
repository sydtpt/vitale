/**
 * Vitale — Mock Data
 * Seeded data for the prototype. Replace with real API calls later.
 */
import type { Meal, Habit, Chore, ShopItem, Treino, Lift, RunWeek, FinancaCategory, Transaction, RecurringItem, CasaTarefa, Meta, WeekDay } from '@vitale/shared';

export const WEEK: WeekDay[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
export const TODAY_IDX = 3;

export const HEATMAP: Record<string, number[]> = {
  Treino:      [3, 0, 4, 3, 0, 4, 0],
  Alimentação: [4, 3, 4, 3, 0, 0, 0],
  Água:        [4, 4, 3, 4, 0, 0, 0],
  Yoga:        [0, 2, 0, 3, 0, 0, 0],
  Leitura:     [2, 3, 2, 2, 0, 0, 0],
  Casa:        [3, 0, 2, 0, 0, 0, 0],
  Compras:     [0, 0, 4, 0, 0, 0, 0],
};

export const HOJE = {
  date: 'Qui, 21 de maio',
  greeting: 'Bom dia, Cris',
  weekDay: 'Dia 4 de 7',
  treino: {
    name: 'Pernas — Volume',
    time: '18:00',
    duration: '55min',
    exercises: 6,
    location: 'Smart Fit · Pinheiros',
  },
  meals: <Meal[]>[
    { id: 'cafe',    name: 'Café da manhã',   time: '07:30', kcal: 420, done: true,  emoji: '☕', items: 'Aveia, banana, café preto, 2 ovos' },
    { id: 'lanche1', name: 'Lanche',          time: '10:30', kcal: 180, done: true,  emoji: '🍎', items: 'Iogurte + maçã' },
    { id: 'almoco',  name: 'Almoço',          time: '13:00', kcal: 720, done: true,  emoji: '🍱', items: 'Arroz, frango, brócolis' },
    { id: 'lanche2', name: 'Lanche da tarde', time: '16:30', kcal: 220, done: false, emoji: '🥜', items: 'Whey + castanhas' },
    { id: 'jantar',  name: 'Jantar',          time: '20:30', kcal: 580, done: false, emoji: '🍲', items: '—' },
  ],
  water: { current: 5, goal: 8 },
  habits: <Habit[]>[
    { id: 'yoga',     name: 'Yoga 10min',   icon: 'yoga',  done: false, streak: 12 },
    { id: 'read',     name: 'Ler 20min',    icon: 'book',  done: true,  streak: 8 },
    { id: 'stretch',  name: 'Alongar',      icon: 'leaf',  done: false, streak: 3 },
    { id: 'meditate', name: 'Meditar 5min', icon: 'moon',  done: false, streak: 0 },
  ],
  casa: <Chore[]>[
    { id: 'louca',    name: 'Lavar louça do almoço', done: false },
    { id: 'lixo',     name: 'Tirar lixo (orgânico)', done: false },
    { id: 'banheiro', name: 'Limpar banheiro',       done: true },
  ],
  compras: <ShopItem[]>[
    { id: 'banana', name: 'Bananas',         qty: '1kg',  done: false, cat: 'Hortifruti' },
    { id: 'frango', name: 'Peito de frango', qty: '500g', done: false, cat: 'Açougue' },
    { id: 'leite',  name: 'Leite vegetal',   qty: '2L',   done: true,  cat: 'Bebidas' },
    { id: 'sabao',  name: 'Sabão em pó',     qty: '1un',  done: false, cat: 'Limpeza' },
  ],
};

export const TREINOS_SEMANA: Treino[] = [
  { day: 'SEG', date: 18, type: 'Peito + Tríceps',  dur: 52, vol: 4200, done: true,  rest: false, planned: false, run: null },
  { day: 'TER', date: 19, type: 'Corrida 6km',      dur: 38, vol: 0,    done: true,  rest: false, planned: false, run: { dist: 6.2, pace: '5:48' } },
  { day: 'QUA', date: 20, type: 'Costas + Bíceps',  dur: 58, vol: 4650, done: true,  rest: false, planned: false, run: null },
  { day: 'QUI', date: 21, type: 'Pernas — Volume',  dur: 55, vol: 0,    done: false, rest: false, planned: true,  run: null },
  { day: 'SEX', date: 22, type: 'Yoga + Mobilidade', dur: 45, vol: 0,    done: false, rest: false, planned: true,  run: null },
  { day: 'SÁB', date: 23, type: 'Corrida longa',    dur: 60, vol: 0,    done: false, rest: false, planned: true,  run: { dist: 10, pace: '—' } },
  { day: 'DOM', date: 24, type: 'Descanso',          dur: 0,  vol: 0,    done: false, rest: true,  planned: false, run: null },
];

export const LIFTS: Lift[] = [
  { name: 'Agachamento',        sets: '4×8',  current: 90,  history: [72, 75, 80, 82, 85, 90] },
  { name: 'Supino reto',        sets: '4×8',  current: 62,  history: [55, 55, 58, 60, 60, 62] },
  { name: 'Levantamento terra', sets: '3×6',  current: 110, history: [95, 100, 100, 105, 108, 110] },
  { name: 'Remada curvada',     sets: '4×10', current: 50,  history: [42, 45, 45, 48, 48, 50] },
];

export const RUNS: RunWeek[] = [
  { week: 'S17', km: 12,   runs: 2 },
  { week: 'S18', km: 18,   runs: 3 },
  { week: 'S19', km: 15,   runs: 2 },
  { week: 'S20', km: 22,   runs: 3 },
  { week: 'S21', km: 16.2, runs: 2 },
];

export const FINANCAS = {
  budget: 3200,
  spent: 1864,
  byCategory: <FinancaCategory[]>[
    { cat: 'Mercado',     amount: 612, color: '#F25C2B', icon: 'cart' },
    { cat: 'Restaurante', amount: 320, color: '#F5B946', icon: 'fork' },
    { cat: 'Transporte',  amount: 248, color: '#6E8CC9', icon: 'pkg' },
    { cat: 'Academia',    amount: 149, color: '#6FA86A', icon: 'dumbbell' },
    { cat: 'Casa',        amount: 380, color: '#B4825B', icon: 'home' },
    { cat: 'Lazer',       amount: 155, color: '#E26A8A', icon: 'sparkle' },
  ],
  recent: <Transaction[]>[
    { id: 1, date: 'Hoje, 13:20',  name: 'Pão de Açúcar',        cat: 'Mercado',     amount: -89.40 },
    { id: 2, date: 'Hoje, 09:10',  name: 'Uber → trabalho',      cat: 'Transporte',  amount: -18.50 },
    { id: 3, date: 'Ontem, 21:00', name: 'Restaurante Italiano', cat: 'Restaurante', amount: -124.00 },
    { id: 4, date: 'Ontem, 14:30', name: 'Smart Fit',            cat: 'Academia',    amount: -149.00 },
    { id: 5, date: '19 mai',       name: 'iFood',                cat: 'Restaurante', amount: -42.80 },
    { id: 6, date: '18 mai',       name: 'Hortifruti Natural',   cat: 'Mercado',     amount: -156.30 },
  ],
};

export const COMPRAS_RECORR: RecurringItem[] = [
  { name: 'Café em grãos',   every: 'a cada 3 semanas', last: '08 mai', due: 'em 4 dias' },
  { name: 'Aveia em flocos',  every: 'a cada 2 semanas', last: '12 mai', due: 'em 2 dias' },
  { name: 'Whey protein',    every: 'mensal',           last: '03 mai', due: 'em 12 dias' },
  { name: 'Sabão em pó',     every: 'mensal',           last: '28 abr', due: 'atrasado' },
];

export const CASA_TAREFAS: CasaTarefa[] = [
  { name: 'Aspirar sala',        every: 'semanal',    when: 'sáb' },
  { name: 'Lavar lençóis',       every: 'semanal',    when: 'dom' },
  { name: 'Limpar geladeira',    every: 'mensal',     when: '1º dom' },
  { name: 'Trocar filtro do ar', every: 'trimestral', when: 'jun' },
  { name: 'Limpar banheiro',     every: '2x semana',  when: 'qui/dom' },
];

export const METAS: Meta[] = [
  { name: 'Correr 10km em 50min', cat: 'Treino',   progress: 64, target: '50:00', current: '52:20' },
  { name: 'Agachamento 100kg',    cat: 'Treino',   progress: 90, target: '100kg', current: '90kg' },
  { name: 'Ler 12 livros em 2026', cat: 'Hábito',  progress: 42, target: '12',    current: '5' },
  { name: 'Economizar R$ 8.000',  cat: 'Finanças', progress: 56, target: '8.000', current: '4.480' },
  { name: 'Yoga 4× semana',       cat: 'Hábito',   progress: 75, target: '4×',    current: '3×' },
];
