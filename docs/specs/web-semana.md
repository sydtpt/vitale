# Spec: Web — Semana (`/semana`)

## Objetivo

Dashboard semanal: visão consolidada de todos os domínios da semana corrente. É a página inicial do app web — o usuário abre e em 30 segundos tem o panorama completo.

## Status: ✅ Implementado

## Componentes do layout

### Header da semana
- Título: "Semana N de YYYY"
- Navegação anterior/próxima semana (chevrons)
- Score semanal (percentual de hábitos concluídos)

### Heatmap de atividade
- Grid 7 colunas × linha por módulo (treino, alimentação, hábitos, casa)
- Cada célula: cor do módulo com intensidade baseada em completude
- Clique na célula abre detalhe do dia

### Painéis de resumo (cards)
- **Treinos:** volume total kg, km rodados, dias de treino vs planejados
- **Alimentação:** média de kcal, proteína, carbo, gordura da semana
- **Água:** média de copos/dia
- **Hábitos:** % de conclusão por hábito
- **Casa:** tarefas concluídas / total
- **Finanças:** gasto da semana vs orçamento semanal

### Lista de dias da semana
- 7 cards expandíveis (SEG–DOM)
- Cada card: ícones de treino, alimentação, hábitos, casa para o dia
- Clique expande: lista de refeições, hábitos checked, tarefas

## Modelos usados
- `DayData` — dados do dia
- `Treino` — sessão de treino
- `Meal` — refeição
- `Habit` — hábito
- `Chore` — tarefa doméstica

## Interações
- Navegação de semana: atualiza todos os painéis
- Hover no heatmap: tooltip com detalhes do dia
- Clique no card de dia: expande/colapsa
- Links rápidos para módulos específicos (ex: "Ver todos os treinos →")

## Estado (signals Angular)
```ts
currentWeekStart = signal<Date>(startOfWeek(new Date()))
weekData = computed(() => getWeekData(currentWeekStart()))
weekStats = computed(() => calcWeekStats(weekData()))
```
