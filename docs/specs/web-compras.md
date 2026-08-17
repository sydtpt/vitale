# Spec: Web — Compras (`/compras`)

## Objetivo

Gerenciar lista de compras ativa e itens recorrentes (compras periódicas que sempre precisam ser repostas).

## Status: 🔧 Página criada, dados mockados

## Seções

### Lista de compras ativa
- Itens agrupados por categoria (Proteínas, Vegetais, Laticínios, Grãos, etc.)
- Cada item: nome, quantidade, checkbox de "comprado"
- Itens comprados ficam riscados e vão para o fim da lista
- Botão "+" → adicionar item novo (nome, qty, categoria)
- Modelo: `ShopItem` — `{ id, name, qty, done, cat }`

### Itens recorrentes
- Lista de itens que sempre precisam ser comprados periodicamente
- Cada item: nome, frequência (ex: "a cada 2 semanas"), última compra, próxima compra estimada
- Botão "Adicionar à lista" → copia para lista ativa
- Modelo: `RecurringItem` — `{ name, every, last, due }`

### Ações de lista
- "Limpar comprados" → remove itens com `done: true`
- "Adicionar recorrentes vencidos" → adiciona todos com `due` passado
- "Compartilhar lista" (futuro) → texto formatado para enviar via WhatsApp

## Modelos usados
- `ShopItem`
- `RecurringItem`

## Estado (signals Angular)
```ts
items = signal<ShopItem[]>([...])
recurringItems = signal<RecurringItem[]>([...])
grouped = computed(() => groupBy(items(), 'cat'))
pendingRecurring = computed(() => recurringItems().filter(r => isPast(r.due)))
```

## Próximos passos
- [ ] Persistência local (localStorage)
- [ ] Ordenação por categoria (drag or alphabetical)
- [ ] Modo "Fazendo compras" (foco na lista, tela sempre ativa)
- [ ] Histórico de compras (quando e quanto custou)
