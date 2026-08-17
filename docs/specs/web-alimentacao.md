# Spec: Web — Alimentação (`/alimentacao`)

## Objetivo

Acompanhar nutrição: log de refeições, macros diários e semanais, hidratação.

## Status: 🔧 Página criada, dados mockados

## Seções

### Resumo do dia (header)
- Data selecionada (navegação dia a dia)
- Kcal consumidas / meta (ex: "1.840 / 2.200 kcal")
- Barras de macro: Proteína, Carbo, Gordura (g consumidos / meta)
- Copos de água: ícones de copo preenchíveis

### Gráfico de macros semanal
- Stacked bar chart: proteína (verde), carbo (amarelo), gordura (laranja)
- X: dias da semana, Y: gramas
- Linha de meta de kcal sobreposta

### Log de refeições do dia
- Lista de refeições: Café, Almoço, Lanche, Jantar, Extra
- Cada refeição: nome, kcal, macros resumidos, emoji, horário
- Botão "+" por refeição → adicionar alimento
- Modelo: `Meal` — `{ id, name, time, kcal, done, emoji, items }`

### Biblioteca de alimentos (futuro)
- Busca por nome de alimento
- Valores nutricionais por 100g
- Adicionar quantidade → calcula macros automaticamente

## Modelos usados
- `Meal`
- `DayData.water`

## Estado (signals Angular)
```ts
selectedDate = signal<Date>(new Date())
meals = signal<Meal[]>([...])
waterCups = signal<number>(4)
waterGoal = signal<number>(8)
macroGoals = signal({ kcal: 2200, protein: 160, carbs: 220, fat: 70 })
dailyMacros = computed(() => calcMacros(meals()))
```

## Próximos passos
- [ ] Modal de adição de refeição (busca de alimento + quantidade)
- [ ] Gráfico de kcal semanal (tendência)
- [ ] Alerta quando kcal ou macro está muito abaixo/acima da meta
- [ ] Integração com TACO (Tabela de Composição de Alimentos do IBGE) ou Open Food Facts API
