# Quem fez a comida — data model

> Companion de [spec.md](spec.md). Uma migration, duas funções, um gatilho, e as leituras puras no shared.

## 1. Por que uma tabela nova e não uma coluna em `meals`

A tentação é `meals.place_kind`. Ela não serve, por dois motivos medidos no código:

1. **`meals.name` é `not null`** (`supabase/migrations/20260715160000_meals_transactions.sql:10-24`). Gravar só a origem exigiria inventar um `name` vazio — uma linha de refeição que não diz o que foi comido é uma refeição mentindo sobre si mesma.
2. **O estado `pulei` não tem refeição.** Ele é a ausência de uma, e uma coluna em `meals` só existe quando há linha em `meals`.

A origem é um fato sobre o **par (dia, vão)**, que existe independentemente de ter havido comida registrada. As duas tabelas casam por `(meal_date, slot ↔ meal_type)` quando as duas existirem — um `join` oportunista, nunca exigido.

Lugar continua sendo **dimensão e não módulo** (ADR 0031): esta feature não cria papel novo na paleta e usa o módulo `food`.

## 2. A migration

```sql
-- supabase/migrations/2026MMDDHHMMSS_quem_fez_a_comida.sql

-- ─────────────────────────────────────────────────────────────
-- meal_origins — quem fez a comida de um vão do dia
-- ─────────────────────────────────────────────────────────────
create table if not exists public.meal_origins (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  meal_date   date          not null,                -- data LOCAL do dispositivo
  slot        text          not null,
  origin      text          not null,
  amount      numeric(10,2),                          -- NULL = não lançado (nunca 0)
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),

  constraint meal_origins_slot_valido
    check (slot in ('almoco','jantar')),

  constraint meal_origins_origin_valido
    check (origin in ('cozinhei','pronta','restaurante','refeitorio','snack','pulei')),

  -- sem valor = sem linha; nunca €0 (espelha transactions.amount > 0)
  constraint meal_origins_amount_positivo
    check (amount is null or amount > 0),

  -- só quem gasta pode ter valor — a regra do CAP-5 é do banco, não da tela
  constraint meal_origins_amount_so_onde_paga
    check (amount is null or origin in ('pronta','restaurante','refeitorio','snack')),

  unique (user_id, meal_date, slot)
);

create index if not exists meal_origins_user_date_idx
  on public.meal_origins (user_id, meal_date desc);

-- ─────────────────────────────────────────────────────────────
-- a ponte: transactions ganha o ponteiro de volta
-- ─────────────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists meal_origin_id uuid
    references public.meal_origins(id) on delete cascade;

-- NÃO é índice parcial de propósito: em Postgres NULLs são distintos, então
-- um unique index comum já permite milhares de transações sem refeição, e
-- serve de conflict target inferível no ON CONFLICT da função abaixo.
create unique index if not exists transactions_meal_origin_uidx
  on public.transactions (meal_origin_id);

alter table public.meal_origins enable row level security;

create policy "own meal_origins" on public.meal_origins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists meal_origins_touch on public.meal_origins;
create trigger meal_origins_touch before update on public.meal_origins
  for each row execute function public.touch_updated_at();

-- comentário velho: o app renderiza € desde 07/09 (format/money.ts é a fonte)
comment on column public.transactions.amount is 'valor da despesa, na moeda de format/money.ts (€)';
```

### Os `CHECK` e a barreira

`architecture.test.ts` cobra que todo `CHECK` de id cubra os ids que o app grava. Aqui isso significa **duas listas fechadas** que precisam existir no shared e casar com o banco letra por letra: `MEAL_SLOTS` (2) e `MEAL_ORIGINS` (6). Acrescentar origem é migration + constante, nunca só constante.

## 3. A porta: `refeicao_registrar`

Único caminho de escrita, chamado igual pelo celular e pela web (CAP-11). Faz a origem e a transação **no mesmo passo**, atomicamente.

```sql
create or replace function public.refeicao_registrar(
  p_date   date,
  p_slot   text,
  p_origin text,
  p_amount numeric default null
) returns public.meal_origins
language plpgsql
security invoker
as $$
declare
  v_row  public.meal_origins;
  v_desc text;
begin
  insert into public.meal_origins (user_id, meal_date, slot, origin, amount)
  values (auth.uid(), p_date, p_slot, p_origin, p_amount)
  on conflict (user_id, meal_date, slot) do update
     set origin     = excluded.origin,
         amount     = excluded.amount,
         updated_at = now()
  returning * into v_row;

  if v_row.amount is null then
    -- cobre os dois casos: valor nunca lançado, e troca de chip para
    -- cozinhei/pulei (o CHECK já zerou o amount). A transação morre aqui.
    delete from public.transactions where meal_origin_id = v_row.id;
  else
    v_desc := (case v_row.slot
                 when 'almoco' then 'Almoço'
                 else 'Jantar'
               end)
              || ' · ' ||
              (case v_row.origin
                 when 'pronta'      then 'pronta, em casa'
                 when 'restaurante' then 'restaurante'
                 when 'refeitorio'  then 'refeitório'
                 when 'snack'       then 'um snack'
               end);

    insert into public.transactions
      (user_id, tx_date, description, category, amount, meal_origin_id)
    values
      (v_row.user_id, v_row.meal_date, v_desc, 'Alimentação', v_row.amount, v_row.id)
    on conflict (meal_origin_id) do update
       set tx_date     = excluded.tx_date,
           description = excluded.description,
           amount      = excluded.amount,
           updated_at  = now();
  end if;

  return v_row;
end;
$$;
```

Três detalhes que são a razão de a função existir:

- **`tx_date = v_row.meal_date`**, nunca `current_date`. É o caso 3 do Murat: preencher a quinta-feira num domingo tem de lançar a despesa na quinta, senão o mês fica torto sozinho.
- **Troca de chip apaga a transação** sem código de tela. Trocar `restaurante` por `cozinhei` faz o `CHECK` recusar o `amount`, então quem chama manda `p_amount => null`, o `if` cai no `delete` e a despesa morre no mesmo `UPDATE`.
- **`category` sai de `FINANCA_CATS`** — `'Alimentação'` já existe (`packages/shared/src/models/index.ts:183`). Nenhuma categoria nova.

## 4. Desfazer: `refeicao_esquecer`

```sql
create or replace function public.refeicao_esquecer(p_date date, p_slot text)
returns void
language sql
security invoker
as $$
  delete from public.meal_origins
   where user_id = auth.uid() and meal_date = p_date and slot = p_slot;
$$;
```

O `on delete cascade` do `meal_origin_id` leva a transação junto. O vão volta a **sem resposta**, que por CAP-12 não é `pulei`.

## 5. O caminho de volta: o gatilho

Caso 2 do Murat — apagar a linha em Finanças limpa o valor da refeição, em vez de deixar um órfão.

```sql
create or replace function public.meal_origin_limpa_valor()
returns trigger
language plpgsql
as $$
begin
  if old.meal_origin_id is not null then
    update public.meal_origins
       set amount = null, updated_at = now()
     where id = old.meal_origin_id
       and amount is not null;      -- guarda de idempotência
  end if;
  return old;
end;
$$;

drop trigger if exists transactions_limpa_refeicao on public.transactions;
create trigger transactions_limpa_refeicao
  after delete on public.transactions
  for each row execute function public.meal_origin_limpa_valor();
```

### Por que isto termina

O par função↔gatilho é uma laço em potencial e não é. Dois caminhos, os dois finitos:

1. **`refeicao_registrar` com `amount` nulo** → `delete from transactions` → o gatilho dispara → `update meal_origins set amount = null` numa linha que **já está** com `amount` nulo → a guarda `and amount is not null` casa zero linhas → fim. Nenhum gatilho em `meal_origins` para continuar.
2. **`refeicao_esquecer`** → a linha de `meal_origins` é apagada → o `cascade` apaga a transação → o gatilho dispara → o `update` não acha a linha (já foi) → zero linhas → fim.

O segundo caminho é sutil o bastante para merecer teste próprio: **apagar a origem com valor lançado não pode levantar erro nem deixar transação viva.**

## 6. O que a tela nunca faz

- Nenhuma tela escreve em `transactions` por causa de refeição. A única linha de código que cria essa transação está na função.
- Nenhuma tela decide a descrição nem a categoria.
- Em Finanças, linha com `meal_origin_id is not null` tem o valor **não editável** e um caminho de volta para a refeição. Editar ali é o único jeito de as duas tabelas discordarem, então é ali que se fecha a porta.

## 7. As leituras — puras, no shared

`packages/shared/src/refeicoes/`, nenhuma abre rede:

| arquivo | assinatura | responde |
|---|---|---|
| `types.ts` | `MealSlot`, `OriginKind`, `MEAL_SLOTS`, `MEAL_ORIGINS`, `ORIGENS_PAGAS`, `ORIGIN_LABELS` | as listas fechadas que espelham os `CHECK` |
| `contagem.ts` | `contar(origens) → { cozinhou, comprou, pulou, respondidas, semResposta }` | CAP-9, CAP-10 |
| `mediana.ts` | `medianaPorOrigem(origens) → Partial<Record<OriginKind, number>>` | só de linhas com `amount`; origem sem lançamento **não aparece no mapa** |
| `gasto.ts` | `gasto(origens) → { lancado, estimado, total, semValor }` | CAP-6 — `estimado` soma só o que a mediana alcança; o resto vira contagem em `semValor` |
| `porDiaDaSemana.ts` | `porDiaDaSemana(origens) → { dia, cozinhadas, respondidas }[]` | CAP-10 |
| `sequencia.ts` | `diasSemCozinhar(origens, hoje) → number` | CAP-10 |
| `heatmap.ts` | `heatmapAnual(origens, ano) → { dia, nivel }[]`, `nivel: 0\|1\|2\|null` | CAP-10, CAP-12 — `null` é **sem resposta**, distinto de `0` |

Duas regras que as funções têm de honrar e que são fáceis de violar:

- **O denominador é `respondidas`, nunca o número de vãos do período.** Um dia sem resposta não empurra o percentual para baixo (CAP-12).
- **`nivel: 0` e `nivel: null` são cores diferentes** no heatmap, e diferem por **claridade**, não por matiz — a barreira de contraste medido do sistema de temas se aplica.

## 8. Acesso a dado

`packages/shared/src/data/meal-origins.ts`:

```ts
const COLUMNS = 'id, meal_date, slot, origin, amount';

fetchMealOrigins(de: string, ate: string): Promise<MealOriginRow[]>
registrarRefeicao(date: string, slot: MealSlot, origin: OriginKind, amount?: number | null): Promise<MealOriginRow>   // rpc refeicao_registrar
esquecerRefeicao(date: string, slot: MealSlot): Promise<void>                                                          // rpc refeicao_esquecer
```

**São 2 linhas por dia — 730 por ano.** Um ano cabe no teto de 1000 linhas do PostgREST; **dois não**, e o corte vem sem erro. Toda leitura de faixa maior que um ano usa `range` + `order` explícitos.

## 9. Os quatro estados de um vão

Distinguir os quatro é o que impede a tela de mentir:

| estado | no banco | na grade | conta no denominador? |
|---|---|---|---|
| respondido, com valor | linha, `amount not null` | célula cheia, valor no detalhe | sim |
| respondido, sem valor | linha, `amount is null`, origem paga | célula cheia, `€ ?` no detalhe | sim (para a contagem) — e entra em `semValor` no gasto |
| respondido, sem gasto | linha, origem `cozinhei` ou `pulei` | célula cheia | sim |
| **sem resposta** | **nenhuma linha** | célula tracejada | **não** |

A quarta linha é a que o resto do projeto chama de *ausência não vira zero*. `pulei` é uma decisão dele sobre o dia; ausência é o app não sabendo. Nenhuma leitura pode transformar uma na outra.

## 10. Onde o código encosta

| superfície | arquivo | o que muda |
|---|---|---|
| Hoje | `mobile/src/app/(tabs)/index.tsx` | dois cartões novos; a linha `MEAL_TARGET` e a constante **saem** |
| cartão | `mobile/src/components/cards/MealOriginCard.tsx` | novo — seis chips, colapso ao responder |
| folha | `mobile/src/components/sheets/MealValueSheet.tsx` | nova — no vocabulário do `QuickAddSheet` |
| store | `mobile/src/store/refeicoes.ts` | novo — Zustand |
| tela | `mobile/src/app/refeicoes/index.tsx` | nova rota — **regenerar `.expo/types/router.d.ts`** |
| web | `web/src/app/features/alimentacao/` | o placeholder vira leitura e escrita |
| shared | `packages/shared/src/refeicoes/`, `data/meal-origins.ts` | novos |
| banco | uma migration | tabela, ponte, duas funções, um gatilho |
