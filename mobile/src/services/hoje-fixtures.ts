/**
 * Fixtures do protótipo da tela Hoje. Substituir por chamadas reais de API.
 * Renomeado de `mock-data`: não espelha o mock da web (símbolos diferentes),
 * o nome só colidia.
 */
import type { Meal, Habit, Chore, ShopItem, WeekDay } from '@vitale/shared';

export const WEEK: WeekDay[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
export const TODAY_IDX = 3;

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
  meals: [
    { id: 'cafe', name: 'Café da manhã', time: '07:30', kcal: 420, done: true, emoji: '☕', items: 'Aveia, banana, café preto, 2 ovos' },
    { id: 'lanche1', name: 'Lanche', time: '10:30', kcal: 180, done: true, emoji: '🍎', items: 'Iogurte + maçã' },
    { id: 'almoco', name: 'Almoço', time: '13:00', kcal: 720, done: true, emoji: '🍱', items: 'Arroz, frango, brócolis' },
    { id: 'lanche2', name: 'Lanche da tarde', time: '16:30', kcal: 220, done: false, emoji: '🥜', items: 'Whey + castanhas' },
    { id: 'jantar', name: 'Jantar', time: '20:30', kcal: 580, done: false, emoji: '🍲', items: '—' },
  ] as Meal[],
  water: { current: 5, goal: 8 },
  habits: [
    { id: 'yoga', name: 'Yoga 10min', icon: 'yoga', done: false, streak: 12 },
    { id: 'read', name: 'Ler 20min', icon: 'book', done: true, streak: 8 },
    { id: 'stretch', name: 'Alongar', icon: 'leaf', done: false, streak: 3 },
    { id: 'meditate', name: 'Meditar 5min', icon: 'moon', done: false, streak: 0 },
  ] as Habit[],
  casa: [
    { id: 'louca', name: 'Lavar louça do almoço', done: false },
    { id: 'lixo', name: 'Tirar lixo (orgânico)', done: false },
    { id: 'banheiro', name: 'Limpar banheiro', done: true },
  ] as Chore[],
  compras: [
    { id: 'banana', name: 'Bananas', qty: '1kg', done: false, cat: 'Hortifruti' },
    { id: 'frango', name: 'Peito de frango', qty: '500g', done: false, cat: 'Açougue' },
    { id: 'leite', name: 'Leite vegetal', qty: '2L', done: true, cat: 'Bebidas' },
    { id: 'sabao', name: 'Sabão em pó', qty: '1un', done: false, cat: 'Limpeza' },
  ] as ShopItem[],
};

export const HEATMAP: Record<string, number[]> = {
  Treino: [3, 0, 4, 3, 0, 4, 0],
  Alimentação: [4, 3, 4, 3, 0, 0, 0],
  Água: [4, 4, 3, 4, 0, 0, 0],
  Yoga: [0, 2, 0, 3, 0, 0, 0],
  Leitura: [2, 3, 2, 2, 0, 0, 0],
  Casa: [3, 0, 2, 0, 0, 0, 0],
  Compras: [0, 0, 4, 0, 0, 0, 0],
};

export const TREINOS_SEMANA = [
  { day: 'SEG', date: 18, type: 'Peito + Tríceps', dur: 52, vol: 4200, done: true, rest: false, planned: false, run: null as null | { dist: number; pace: string } },
  { day: 'TER', date: 19, type: 'Corrida 6km', dur: 38, vol: 0, done: true, rest: false, planned: false, run: { dist: 6.2, pace: '5:48' } },
  { day: 'QUA', date: 20, type: 'Costas + Bíceps', dur: 58, vol: 4650, done: true, rest: false, planned: false, run: null },
  { day: 'QUI', date: 21, type: 'Pernas — Volume', dur: 55, vol: 0, done: false, rest: false, planned: true, run: null },
  { day: 'SEX', date: 22, type: 'Yoga + Mobilidade', dur: 45, vol: 0, done: false, rest: false, planned: true, run: null },
  { day: 'SÁB', date: 23, type: 'Corrida longa', dur: 60, vol: 0, done: false, rest: false, planned: true, run: { dist: 10, pace: '—' } },
  { day: 'DOM', date: 24, type: 'Descanso', dur: 0, vol: 0, done: false, rest: true, planned: false, run: null },
];

export const COMPRAS_RECORR = [
  { name: 'Café em grãos', every: 'a cada 3 semanas', last: '08 mai', due: 'em 4 dias' },
  { name: 'Aveia em flocos', every: 'a cada 2 semanas', last: '12 mai', due: 'em 2 dias' },
  { name: 'Whey protein', every: 'mensal', last: '03 mai', due: 'em 12 dias' },
  { name: 'Sabão em pó', every: 'mensal', last: '28 abr', due: 'atrasado' },
];
