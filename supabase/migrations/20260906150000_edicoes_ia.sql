-- Edições da camada de IA analítica.
-- Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040.
--
-- "Edição", e não "cache": um jornal não reescreve a edição de terça. Período
-- fechado é impresso uma vez e congela; se o fato muda, publica-se errata.
--
-- A tabela materializa duas regras que o app não pode esquecer:
--
--   1. NÃO EXISTE EDIÇÃO DE PERÍODO ABERTO. O CHECK de `tipo_periodo` recusa
--      'all' — que nunca fecha, por definição. Um bug no cliente que tente
--      gravar a análise do mês corrente bate no banco, não na revisão de código.
--
--   2. TODA EDIÇÃO É ASSINADA (ADR 0040). provedor, modelo, versão do prompt e
--      versão do pacote. No dia em que qualquer um dos quatro mudar — e o
--      provedor já mudou uma vez antes da primeira chamada dar certo — dá para
--      saber qual texto veio de qual cabeça, e o que vale a pena regerar.

create table if not exists public.edicoes_ia (
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- 'all' fora: período que nunca fecha não tem edição.
  tipo_periodo  text not null check (tipo_periodo in ('week', 'month', 'season', 'year')),
  inicio        date not null,
  fim           date not null,                 -- último dia INCLUSIVO

  texto         text not null check (length(trim(texto)) > 0),

  -- A linha de crédito.
  provedor      text not null,
  modelo        text not null,                 -- o id que RESPONDEU, não o pedido
  prompt_versao integer not null,
  pacote_versao integer not null,

  -- 'STOP' é conclusão. Qualquer outra coisa é texto truncado, e texto truncado
  -- não é edição — o CHECK impede que vire uma.
  motivo_de_parada text not null check (motivo_de_parada = 'STOP'),

  tokens_entrada integer not null default 0,
  tokens_saida   integer not null default 0,

  -- Errata: a agregação vigente quando o texto foi escrito. Se o AGG_VERSION
  -- subir e reprocessar o histórico, a edição não é reescrita — é MARCADA.
  agg_version_no_momento integer,

  gerado_em     timestamptz not null default now(),

  primary key (user_id, tipo_periodo, inicio, fim),
  constraint edicao_intervalo_valido check (fim >= inicio)
);

comment on table public.edicoes_ia is
  'Parágrafos gerados por modelo para períodos FECHADOS. Uma linha por período, assinada pelo provedor/modelo/prompt que a escreveu.';

alter table public.edicoes_ia enable row level security;

create policy "own edicoes_ia" on public.edicoes_ia
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A leitura real é "as últimas edições deste tipo", para a tela abrir na mais
-- recente sem varrer a tabela.
create index if not exists edicoes_ia_recentes
  on public.edicoes_ia (user_id, tipo_periodo, inicio desc);
