# Spec: Mobile — Tab Hoje (Home)

## Objetivo

Tela principal do app mobile. O usuário abre o app pela manhã e vê tudo que precisa fazer no dia — treino, refeições, hábitos, tarefas de casa. Check-in rápido ao longo do dia.

## Status: 🔧 Estrutura criada, UI incompleta

## Layout (scroll vertical)

```
┌─────────────────────────────┐
│  Bom dia, [nome] 👋  SEG 19 │  ← Header com saudação e data
├─────────────────────────────┤
│  🏋️ Treino: Upper Body      │  ← DayRingCard (treino)
│     17:00 • 1h • 12 exerc. │
│     [Iniciar] [Pular]       │
├─────────────────────────────┤
│  🍽️ Alimentação             │  ← Seção de macros
│     1.840 / 2.200 kcal      │
│     ████████░░ Proteína      │
│     Café ✓  Almoço ✓  Lanche│
├─────────────────────────────┤
│  💧 Água  4 / 8 copos       │  ← Hidratação (tap p/ adicionar)
├─────────────────────────────┤
│  ✅ Hábitos                 │  ← Lista de hábitos do dia
│     ○ Meditação             │
│     ✓ Leitura               │
│     ○ Sem açúcar            │
├─────────────────────────────┤
│  🏠 Casa                    │  ← Tarefas de casa de hoje
│     ○ Lavar louça           │
│     ✓ Varrer                │
└─────────────────────────────┘
         [+ Adicionar]          ← FAB ou QuickAddSheet
```

## Componentes a implementar

### `DayRingCard`
- Card com anel de progresso circular (ex: 3/5 exercícios feitos)
- Props: `title`, `subtitle`, `progress`, `color`, `actions`
- Animação do anel com Reanimated 3

### `CheckButton`
- Botão de check-in para hábitos, refeições, tarefas
- Estados: unchecked → checking (animação) → checked
- Haptic feedback ao marcar

### `QuickAddSheet`
- Bottom sheet (via `@gorhom/bottom-sheet` ou Expo)
- Permite adicionar: refeição, hábito extra, tarefa, item de compras
- Abre ao pressionar FAB "+"

### `WaterTracker`
- Linha de ícones de copo
- Tap em copo → anima e marca como bebido
- Long press → desfaz

## Modelos usados
- `DayData`
- `Meal`
- `Habit`
- `Chore`

## Estado (Zustand)
```ts
// store/dayStore.ts
interface DayStore {
  today: DayData
  toggleMeal: (id: string) => void
  toggleHabit: (id: string) => void
  toggleChore: (id: string) => void
  addWaterCup: () => void
  removeWaterCup: () => void
}
```

## Próximos passos
- [ ] Implementar `DayRingCard` com animação Reanimated
- [ ] Implementar `CheckButton` com haptics
- [ ] Implementar `QuickAddSheet`
- [ ] Implementar `WaterTracker`
- [ ] Carregar fontes Geist e Instrument Serif via `expo-font`
