# Spec: Mobile — Tab Hoje (Home)

## Objetivo

Tela principal do app mobile. O usuário abre o app pela manhã e vê tudo que precisa fazer no dia — treino, refeições, hábitos, tarefas de casa. Check-in rápido ao longo do dia.

## Status: 🔧 Estrutura criada, UI incompleta

## Layout (scroll vertical)

```
┌─────────────────────────────┐
│  Bom dia, [nome] 👋  SEG 19 │  ← Header com saudação e data
├─────────────────────────────┤
│  SALDO DE HOJE              │  ← FormCurveCard (curva de forma) — carrossel
│  +36 de folga  ●●           │     de 2 slides com 223 pt fixos: saldo + faísca
│  ~~~~~~~~~~~~~~~~~~  42d hoje│     de 42 d · barras Base/Cansaço com o típico
├─────────────────────────────┤
│ (🌙 Sono 3/5 ✎) 01:26 → 08:39│  ← SleepRatingCard: a nota (chip) e, à direita,
│            3 despertares · 8 min│     a noite medida (Sono CAP-8); toque abre /sono/[day]
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

## Componentes

### `SleepRatingCard` ✅ (nota: 2026-06 · noite ao lado: 2026-09-05)
- A partir das 06h. Sem nota, o card "Como foi seu sono?" com as pílulas 1–5; com nota,
  colapsa no chip `🌙 Sono 3/5 ✎`, que reabre ao toque.
- **Com a nota dada, a mesma linha ganha a medição à direita** — `01:26 → 08:39` e
  `3 despertares · 8 min`, duas linhas de 12/16 pt centradas nos 36 pt do chip, alinhadas ao
  limite direito. Número em mono `ink`, palavra em `ink2`; sem casca e sem cor de sono. O
  texto vem de `nightLine()` do shared; a noite vem de `useSonoStore().loadToday()` — uma
  consulta por `wake_day`, não o histórico. Toque abre `/sono/[day]`.
- Nunca antes da nota; sem noite medida, o espaço fica em branco. Spec:
  [Sono CAP-8](sono/spec.md) · [ratings FR-009](ratings-diarios/spec.md).

### `FormCurveCard` ✅ (2026-09-03)
- Carrossel de altura fixa (trilho 206 pt + pílulas = 223 pt): trocar de slide ou de
  estado não move o resto da tela. Slide 1: saldo (`base − cansaço`, em minutos
  equivalentes por semana), frase de estado e faísca de 42 dias segmentada por sinal.
  Slide 2: barras Base 42 d / Cansaço 7 d com o traço do típico pessoal (mediana de 90 d).
- Dado: `useActivitiesStore` (`_all`, `load(true)` no mount, na troca de usuário e ao
  voltar do background) → `buildFormCurve` do `@vitale/shared`. Sem atividade, não renderiza.
- Estados: fresco / enterrado / sem confiança (≥ 4 dias sem atividade: número neutro,
  selo e alerta que abre Conexões) / base aquecendo (< 42 dias de histórico).
- Lógica pura e testada em `src/lib/form-curve-view.ts`; cor só pelo tema (`roleColors`).
- Fora: "Ver a curva completa" (sem tela destino) — ver `deferred-work.md`.

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
