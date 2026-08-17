# Spec: Web — Casa (`/casa`)

## Objetivo

Rotação de tarefas domésticas: quais tarefas precisam ser feitas, com qual frequência e quando foi a última vez.

## Status: 🔧 Página criada, dados mockados

## Seções

### Tarefas de hoje
- Lista de tarefas que vencem hoje ou estão em atraso
- Destaque visual (badge vermelho) para atrasadas
- Checkbox para marcar como feita → recalcula próxima data
- Modelo: `CasaTarefa` — `{ name, every, when }`

### Calendário de tarefas (view semanal)
- Grid de 7 dias com tarefas alocadas em cada dia
- Cores por tipo: limpeza (azul), manutenção (marrom), organização (verde)
- Tarefas atrasadas aparecem em vermelho

### Lista completa de tarefas
- Todas as tarefas com frequência e data da próxima execução
- Ordenadas por "mais urgente primeiro"
- Botão "+" → adicionar nova tarefa (nome, frequência)
- Edição inline de frequência

### Stats rápidas
- % de tarefas em dia (últimos 30 dias)
- Tarefa mais negligenciada (maior atraso médio)

## Modelos usados
- `CasaTarefa`
- `Chore` (para check-in diário)

## Estado (signals Angular)
```ts
tarefas = signal<CasaTarefa[]>([...])
hoje = signal<Date>(new Date())
vencendoHoje = computed(() => tarefas().filter(t => isToday(t.when) || isPast(t.when)))
semana = computed(() => buildWeekView(tarefas(), hoje()))
```

## Próximos passos
- [ ] Recalcular `when` automaticamente ao marcar como feita
- [ ] Notificação push quando tarefa vence (mobile)
- [ ] Multi-pessoa: atribuir tarefas a moradores
- [ ] Template de tarefas (kit básico para apartamento)
