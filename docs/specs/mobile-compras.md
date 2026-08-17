# Spec: Mobile — Tab Compras

## Objetivo

Lista de compras otimizada para uso no supermercado: navegação rápida, check-in fácil, agrupamento por categoria para seguir o percurso da loja.

## Status: 🔧 Estrutura criada, UI incompleta

## Layout

```
┌─────────────────────────────┐
│  🛒 Compras      [+ Adicionar]│  ← Header com FAB inline
├─────────────────────────────┤
│  Proteínas          (3/5)   │  ← SectionHeader com progresso
│    ✓ Frango 1kg             │
│    ✓ Ovo dúzia              │
│    ○ Atum lata ×3           │
│    ○ Iogurte grego          │
│    ○ Queijo cottage 400g    │
├─────────────────────────────┤
│  Vegetais           (1/3)   │
│    ✓ Alface                 │
│    ○ Tomate                 │
│    ○ Brócolis               │
├─────────────────────────────┤
│  [Limpar comprados]         │  ← Footer sticky
└─────────────────────────────┘
```

## Comportamento de check-in
- Tap no item: marca/desmarca
- Item marcado: texto riscado, opacidade reduzida, move para fim da seção
- Swipe left: deletar item
- Long press: editar (nome, quantidade, categoria)

## Adicionar item
- Tap "+" abre bottom sheet minimalista
- Campo: nome do item
- Campo: quantidade (teclado numérico + unidade)
- Selector de categoria (ícones)
- Submit: fecha sheet, item aparece na seção correta

## Modelos usados
- `ShopItem` — `{ id, name, qty, done, cat }`

## Estado (Zustand)
```ts
// store/shoppingStore.ts
interface ShoppingStore {
  items: ShopItem[]
  toggleItem: (id: string) => void
  addItem: (item: Omit<ShopItem, 'id'>) => void
  removeItem: (id: string) => void
  clearDone: () => void
  grouped: () => Record<string, ShopItem[]>
}
```

## Próximos passos
- [ ] Swipe-to-delete com Reanimated
- [ ] Bottom sheet de adição rápida
- [ ] Ordenação de categorias (drag-to-reorder)
- [ ] Modo "fazendo compras" (tela sempre ativa, fonte maior)
- [ ] Sincronizar com lista do web
