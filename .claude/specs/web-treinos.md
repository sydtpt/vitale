# Spec: Web — Treinos (`/treinos`)

## Objetivo

Análise de progressão de treino: visualizar evolução de cargas (levantamento), volume de corrida e planejar a semana de treinos.

## Status: ✅ Implementado

## Seções

### Gráfico de Lift (progressão de carga)
- Gráfico de linha por exercício selecionado
- X: semanas, Y: carga máxima no exercício
- Selector de exercício (dropdown ou tabs): Supino, Agachamento, Terra, etc.
- Modelo: `Lift` — `{ name, sets, current, history: number[] }`

### Gráfico de Corrida (volume semanal)
- Gráfico de barras: km por semana
- Hover: nº de corridas e pace médio da semana
- Modelo: `RunWeek` — `{ week, km, runs }`

### Planejador semanal
- Grid 7 colunas (SEG–DOM)
- Cada coluna: tipo de treino (Upper, Lower, Cardio, Rest)
- Drag-and-drop para reorganizar (nice-to-have)
- Modelo: `Treino` — `{ day, date, type, dur, vol, done, rest, planned, run }`

### Lista de exercícios da sessão
- Exercícios planejados para hoje / próxima sessão
- Cada exercício: nome, séries × reps, carga atual
- Botão "Registrar sessão" → abre modal de input

## Modelos usados
- `Treino`
- `Lift`
- `RunWeek`

## Estado (signals Angular)
```ts
selectedExercise = signal<string>('Supino')
selectedWeekRange = signal<number>(12)  // últimas N semanas
lifts = signal<Lift[]>([...])
runHistory = signal<RunWeek[]>([...])
weekPlan = signal<Treino[]>([...])
```

## Próximos passos
- [ ] Modal de registro de sessão (sets, reps, peso por exercício)
- [ ] Persistência local (localStorage) antes do backend
- [ ] Export de histórico como CSV
