# Spec: Mobile — Tab Semana

## Objetivo

Visão semanal compacta no mobile: faixa de dias com indicadores visuais, stats resumidas e heatmap de atividade. Menos denso que o web — é para checar rápido como foi a semana.

## Status: 🔧 Estrutura criada, UI incompleta

## Layout

```
┌─────────────────────────────┐
│   < Semana 20, Maio 2026 >  │  ← Header com navegação
├─────────────────────────────┤
│  SEG TER QUA QUI SEX SÁB DOM│  ← WeekStrip
│   ✓   ✓   ✓   ●   ○   ○   ○│    (dots de treino, anel de hábitos)
├─────────────────────────────┤
│  Treinos    Kcal  Hábitos   │  ← Stats cards (3 colunas)
│    3/5      1.9k   72%      │
├─────────────────────────────┤
│  Progressão de Hábitos      │  ← Heatmap 7×N
│  Meditação  ■ ■ □ ■ □ □ □  │    (preenchido = feito)
│  Leitura    ■ ■ ■ ■ □ □ □  │
│  Sem açúcar ■ □ ■ □ □ □ □  │
├─────────────────────────────┤
│  Hoje: QUA 21               │  ← Card expandido do dia selecionado
│  Upper Body • 1.840 kcal    │
│  Hábitos: 2/3               │
└─────────────────────────────┘
```

## Componentes

### `WeekStrip`
- 7 colunas, scroll horizontal se necessário
- Dia selecionado: destaque com background
- Indicador de treino feito (ícone de haltere)
- Anel de hábitos (mini progress ring)
- Tap no dia: seleciona e mostra card do dia abaixo

### `StatCard`
- Card pequeno com número grande e rótulo
- Props: `value`, `label`, `color`

### `HabitHeatmap`
- Grid N hábitos × 7 dias
- Célula preenchida com cor do hábito se concluído
- Labels dos hábitos à esquerda

### `DaySummaryCard`
- Card do dia selecionado (expansível)
- Treino, kcal, % hábitos, tarefas

## Modelos usados
- `DayData`
- `Treino`
- `Habit`

## Estado (Zustand)
```ts
// store/weekStore.ts
interface WeekStore {
  selectedWeekStart: Date
  selectedDay: Date
  weekData: DayData[]
  setSelectedDay: (date: Date) => void
  prevWeek: () => void
  nextWeek: () => void
}
```

## Próximos passos
- [ ] Implementar `WeekStrip` com seleção de dia
- [ ] Implementar `HabitHeatmap`
- [ ] Conectar ao `dayStore` para dados reais
