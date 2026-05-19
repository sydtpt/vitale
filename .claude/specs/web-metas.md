# Spec: Web — Metas (`/metas`)

## Objetivo

Acompanhar objetivos de longo prazo com progresso visual — perda de peso, PR de levantamento, meta financeira, etc.

## Status: 🔧 Página criada, dados mockados

## Seções

### Cards de metas
- Grid de cards por meta
- Cada card: nome, categoria, barra de progresso, valor atual vs target
- Cores por categoria (treino, financeiro, saúde, pessoal)
- Modelo: `Meta` — `{ name, cat, progress, target, current }`

### Progresso por categoria
- Tabs ou accordion: Treino, Financeiro, Saúde, Pessoal
- Filtrar cards por categoria

### Gráfico de progresso (nice-to-have)
- Linha do tempo de uma meta específica
- X: datas de registro, Y: valor da meta
- Ex: peso corporal ao longo do tempo

### Adicionar/editar meta
- Modal: nome, categoria, valor inicial, valor alvo, data alvo
- Ao atingir 100%: confetti + card marcado como concluído

## Modelos usados
- `Meta`

## Estado (signals Angular)
```ts
metas = signal<Meta[]>([...])
selectedCat = signal<string>('todas')
filtered = computed(() =>
  selectedCat() === 'todas' ? metas() : metas().filter(m => m.cat === selectedCat())
)
```

## Próximos passos
- [ ] Histórico de progresso por meta (array de { date, value })
- [ ] Data alvo e contagem regressiva
- [ ] Notificação quando próximo de atingir meta
- [ ] Metas recorrentes (ex: "correr 100km todo mês")
