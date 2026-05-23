-- Adiciona coluna meta ao todo_templates para dados extras por módulo
-- (ex: ShopMeta — qty, cat, price — para itens de compras)
alter table public.todo_templates
  add column if not exists meta jsonb;
