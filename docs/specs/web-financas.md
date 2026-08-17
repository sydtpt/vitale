# Spec: Web — Finanças (`/financas`)

## Objetivo

Acompanhar gastos mensais por categoria, comparar com orçamento definido e ver histórico de transações.

## Status: ✅ Implementado (dados mockados)

## Seções

### Resumo do mês (header)
- Mês selecionado (navegação mês a mês)
- Total gasto vs orçamento total (ex: "R$ 3.240 / R$ 4.500")
- Barra de progresso do orçamento (verde → amarelo → vermelho)

### Gráfico de gastos por categoria (donut ou bar)
- Categorias: Alimentação, Moradia, Transporte, Saúde, Lazer, etc.
- Cada categoria tem cor própria
- Hover: valor absoluto e % do total
- Modelo: `FinancaCategory` — `{ cat, amount, color, icon }`

### Lista de transações
- Tabela: data, descrição, categoria, valor
- Filtro por categoria e por período
- Ordenação por data (mais recente primeiro)
- Modelo: `Transaction` — `{ id, date, name, cat, amount }`

### Orçamento por categoria
- Meta de gasto por categoria (editável)
- Barra de progresso: gasto atual vs meta
- Alerta visual quando ultrapassa 80% da meta

## Modelos usados
- `FinancaCategory`
- `Transaction`

## Estado (signals Angular)
```ts
selectedMonth = signal<Date>(startOfMonth(new Date()))
transactions = signal<Transaction[]>([...])
budgets = signal<Record<string, number>>({ alimentacao: 800, moradia: 1500, ... })
byCategory = computed(() => groupByCategory(transactions(), selectedMonth()))
totalSpent = computed(() => sum(byCategory()))
```

## Próximos passos
- [ ] Importação de extrato (CSV do banco)
- [ ] Transações recorrentes (aluguel, assinaturas)
- [ ] Comparativo mês a mês (gráfico de linha por categoria)
- [ ] Meta de economia mensal (receita - gastos)
- [ ] Integração futura: Open Finance / Pluggy API
