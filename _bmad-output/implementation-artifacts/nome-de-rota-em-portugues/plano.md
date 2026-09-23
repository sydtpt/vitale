# Nome de rota em português — o plano

**Data:** 23/09/2026 · **Estado:** aguardando aprovação do dono antes da migração
**Decisões já tomadas por ele nesta sessão:**

1. **Coluna nova**, não troca de língua. Os dois nomes coexistem.
2. **O nome local manda; o português é legenda.** O que está gravado hoje em
   `route_name` continua sendo o nome principal em toda superfície.

## O problema, medido

As cidades chegam do Nominatim com o nome **local** — `Brugge`, `Mechelen`, `Gent`. O
francês que aparece hoje é trabalho do modelo: ele escolhe a região, escolhe a passagem e
**traduz o topônimo** para a língua do nome. Nada disso fica guardado em `route_name_meta`,
que registra `regiao`, `artigo` e `via` mas **não as pontas**.

Consequência que define o plano: **não dá para re-renderizar em português a partir do que
está no banco.** Derivar por código devolveria flamengo dentro de frase portuguesa.

| hoje (fr) | derivado por código | com o modelo escrevendo em pt |
|---|---|---|
| De Bruges à Bredene | De **Brugge** a Bredene | De Bruges a Bredene |
| Boucle de Malines | Volta por **Mechelen** | Volta por Malinas |
| Retour de Gand | Volta de **Gent** | Volta de Gante |
| Boucle du Pajottenland | Volta pelo Pajottenland | Volta pelo Pajottenland |

Produção em 23/09: **135 nomes, 66 distintos**; 136 pedaladas com `lingua: fr`, 3 `nl`, 2 `pt`.
120 dos 135 não têm região gravada, 110 não têm via — mas **os 135 passaram por modelo**.

## A forma escolhida: duas leituras, sem tocar no contrato

O caminho que não mexe em barreira. `montarFrase` continua devolvendo **uma** frase; quem
roda duas vezes é o chamador.

- **Núcleo:** um campo opcional de língua forçada em `RouteFacts`, honrado no `lerRota`.
  Hoje a língua nasce lá dentro, de `linguaDoPais(paisDominante)` — é o único ponto que
  precisa ceder. Uma linha, sem mudar assinatura de nenhuma das cinco funções do descritor.
- **`nomear.ts` / `route-name.ts`:** a leitura roda duas vezes — a local (como hoje) e a
  forçada em `pt` — e grava as duas colunas.
- **Molde e `verificar`:** **zero**. Os dois já são `Record<Lingua, …>` e o português já
  está escrito e testado (`Volta por X`, `Ida a X`, `Volta de X`, `De X a Y`, `Tour do X`,
  com contração de artigo).

### Por que não as alternativas

- **Uma chamada devolvendo as duas línguas.** Mudaria o prompt (`versaoPrompt` sobe),
  o `interpretar`, o `montarFrase` e o contrato do descritor — que é barreira coberta pelo
  `architecture.test.ts`. Economiza uma chamada de ~6 s por pedalada e custa a peça mais
  cara do núcleo. Má troca.
- **Derivar por código.** De graça, e entrega "De Brugge a Bredene". É a tabela acima.

## A migração

```sql
alter table public.activities
  add column if not exists route_name_pt      text,
  add column if not exists route_name_pt_meta jsonb;
```

Simétrica à de 07/09 (`20260907170000_nome_das_rotas.sql`), que criou `route_name` e
`route_name_meta` — duas colunas anuláveis, sem default, sem backfill no DDL, sem tocar em
linha existente.

**Índice do passe pendente**, mesmo molde do que já existe para `route_name`:

```sql
create index if not exists activities_route_name_pt_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name_pt is null and has_route and activity_id = 13;
```

**Conferido em produção, 23/09 — ✅.** Pela mesma nota que a migration de 07/09 deixou
registrada: `sync_upsert_activities` não pode referenciar as colunas novas, nem na inserção
nem no `do update set`, senão um re-push do HealthKit apaga o nome derivado. Li a definição
da função no banco: **3.010 caracteres, zero ocorrências** de `route_name`, `route_name_meta`
ou `route_name_pt`, e **nenhum `*`** — ela lista coluna por coluna. O `do update set` toca
`activity_id`, `activity_name` (protegido por `name_edited`), `duration_s`, `calories`,
`start_at` e companhia. As colunas novas ficam fora por construção.

Ritual: seção 6 de
[`revista-1-9/janela-da-migracao.md`](../revista-1-9/janela-da-migracao.md) é leitura
obrigatória antes da janela. Registrar em `supabase_migrations.schema_migrations` se for
aplicada pela Management API.

## O gatilho e o backfill

`precisaDeNome` hoje é `!routeName && !routeNameChecked && hasRoute && ciclismo`, onde
`routeNameChecked` é `route_name_meta != null` (`packages/shared/src/data/activities.ts:75`).

**Proposta: o mesmo molde, por língua.** A pedalada aberta precisa do nome local *ou* do
português; cada um tem sua marca de "já tentei". Quem já tem o francês e não tem o português
ganha só a segunda chamada.

**O backfill das 135 fica preguiçoso, não em lote.** Elas recebem o nome em pt conforme
você abre cada uma — mesmo caminho que já existe, sem script novo e sem passe em massa.
Custo por pedalada: ~6 s no Qwen, offline e de graça (é o que a [ADR 0056](../../../docs/decisions/0056-o-peso-aberto-deixa-de-ser-so-prova-e-o-descritor-decide.md)
habilitou hoje). Um lote de uma vez só é possível depois, se você quiser as 135 sem abrir uma a uma.

## A exibição — **o que falta desenhar**

Pela decisão 2, o nome local manda. Onde a legenda entra, nesta ordem de confiança:

| superfície | proposta |
|---|---|
| detalhe da pedalada | legenda sob o nome — o lugar natural, há espaço |
| cartão do Histórico | **a conferir em mockup**; o cartão é denso e já ganhou selo de mídia |
| web (`activities.store.ts`) | fora desta rodada |
| capa da Revista | fora desta rodada — ela lê a rota ao vivo e o espaço é escasso |

**Nada disso vira código antes de mockup com dado real e do seu sim** — é a regra da casa
para mudança visual.

## Ordem de execução

1. ~~Conferir `sync_upsert_activities` contra as colunas novas.~~ **Feito em 23/09 — limpo.**
2. Migração, na janela, com o ritual.
3. Núcleo: língua forçada em `RouteFacts` + `lerRota`, com teste.
4. `route-name.ts`: duas leituras, duas gravações, com teste do gatilho por língua.
5. Mockup da legenda (detalhe e cartão) → aprovação → tela.
6. Build, e o backfill acontece sozinho conforme você navega.

**Portão de tudo:** os quatro workspaces, não só o mobile — foi um portão de shared verde
só no mobile que deixou o `af4ddcb` ir quebrado hoje.
