-- Orbe — módulo Cultura: livros, filmes, podcasts e álbuns
-- Spec: docs/specs/cultura/spec.md · modelo: docs/specs/cultura/data-model.md
-- ADR: docs/decisions/0011-schema-mora-em-migrations.md
--
-- Tabela ÚNICA: não há tabela de sessões. Foi decisão explícita do usuário, e é
-- ela que fixa o teto analítico do módulo — o par iniciado_em/concluido_em
-- define uma janela de consumo, nunca dias. Nenhuma consulta aqui responde
-- "em que noites li".
--
-- NÃO APLICADA. Gerada em 2026-08-22 e aguardando aplicação manual.

create table if not exists public.cultura_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- SEM check constraint, de propósito (CAP-9): o conjunto de mídias válidas
  -- vive em packages/shared/src/cultura/tipos.ts, e é isso que faz a quinta
  -- mídia custar zero migration. Quem rejeita tipo desconhecido na escrita é o
  -- módulo de dados do núcleo (CAP-13), que também é o único com .from() aqui.
  tipo         text not null,

  titulo       text not null,
  -- Autor, diretor, apresentador ou artista. Coluna única e consultável em vez
  -- de quatro por mídia; nullable porque nem todo provedor devolve.
  criador      text,

  -- Vocabulário NEUTRO (CAP-8): 'ler/lido' travaria filme, podcast e álbum.
  -- Os rótulos por mídia são apresentação e vivem no registro de tipos.
  estado       text not null default 'quero'
               check (estado in ('quero','consumindo','concluido')),

  nota         smallint check (nota is null or nota between 1 and 5),

  -- Quem recomendou (CAP-11). Coluna de topo e não dentro de `extra` porque
  -- precisa ser agregável: "de quem vêm as indicações que valem a pena".
  indicado_por text,

  fonte        text,  -- provedor; NULO em item cadastrado à mão
  fonte_id     text,  -- id externo; nulo junto com `fonte`
  capa_url     text,
  extra        jsonb, -- metadado da mídia: paginas, duracao_min, ano, n_faixas

  iniciado_em  date,
  concluido_em date,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Coerência entre estado e datas. São a ÚLTIMA linha de defesa: o módulo de
  -- dados valida os mesmos invariantes antes de escrever, para o usuário
  -- receber mensagem própria em vez de erro 23514.
  constraint cultura_items_concluido_tem_data
    check ((estado = 'concluido') = (concluido_em is not null)),
  constraint cultura_items_quero_nao_tem_inicio
    check ((estado = 'quero') = (iniciado_em is null)),
  constraint cultura_items_janela_nao_negativa
    check (concluido_em is null or iniciado_em is null or concluido_em >= iniciado_em),

  -- String vazia e NULL não podem coexistir como "ninguém", senão o
  -- agrupamento por indicador ganha um grupo fantasma.
  constraint cultura_items_indicador_nao_vazio
    check (indicado_por is null or length(btrim(indicado_por)) > 0)
);

-- O mesmo item de catálogo não entra duas vezes. Parcial de propósito: item
-- manual (fonte_id nulo) PODE duplicar — é o preço de permitir cadastro sem
-- provedor. Rede de segurança contra corrida; o caminho feliz é o app detectar
-- antes do insert e navegar ao item existente.
create unique index if not exists cultura_items_fonte_unica
  on public.cultura_items (user_id, fonte, fonte_id)
  where fonte_id is not null;

-- A estante, ordenada por recência.
create index if not exists cultura_items_user_atualizado
  on public.cultura_items (user_id, atualizado_em desc);

-- Consulta por janela (CAP-5). Item em `quero` fica fora — não tem janela.
create index if not exists cultura_items_janela
  on public.cultura_items (user_id, iniciado_em)
  where estado <> 'quero';

alter table public.cultura_items enable row level security;

-- Policies: cada usuário só enxerga e escreve os próprios itens.
drop policy if exists "select own cultura" on public.cultura_items;
create policy "select own cultura" on public.cultura_items
  for select using (auth.uid() = user_id);

drop policy if exists "insert own cultura" on public.cultura_items;
create policy "insert own cultura" on public.cultura_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own cultura" on public.cultura_items;
create policy "update own cultura" on public.cultura_items
  for update using (auth.uid() = user_id);

-- Deleção é a única saída da estante (CAP-10): não há estado 'abandonado', e
-- largar um item é deletá-lo. Sem tombstone — "comecei e larguei" e "nunca
-- adicionei" ficam indistinguíveis, e isso foi aceito por escrito no spec.
drop policy if exists "delete own cultura" on public.cultura_items;
create policy "delete own cultura" on public.cultura_items
  for delete using (auth.uid() = user_id);

comment on table public.cultura_items is
  'Estante pessoal: livros, filmes, podcasts e álbuns, com estado que evolui (quero → consumindo → concluido). Sem tabela de sessões — o par iniciado_em/concluido_em é uma janela de consumo, não dias. Spec: docs/specs/cultura/spec.md';

comment on column public.cultura_items.tipo is
  'Mídia. SEM check constraint de propósito: o conjunto válido vive em packages/shared/src/cultura/tipos.ts (CAP-9), e a validação de escrita é do módulo de dados (CAP-13). Registro append-only — tipo nunca é removido, senão seus itens ficam órfãos.';

comment on column public.cultura_items.indicado_por is
  'Quem recomendou. Texto livre com autocomplete no cliente casando sem distinção de caixa — sem convergência, uma pessoa vira três grafias e a agregação racha.';
