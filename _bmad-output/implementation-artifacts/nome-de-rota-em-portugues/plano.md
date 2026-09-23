# Nome de rota em português — o plano

**Data:** 23/09/2026 · **Estado:** aguardando aprovação do dono antes da migração

**Decisões dele, nesta sessão:**

1. **Coluna nova**, não troca de língua. Os dois nomes coexistem.
2. **O nome local manda; o português é legenda.**
3. **Motor próprio para o português** — não precisa ser o mesmo que escreve o nome local.
4. **Toda atividade com GPS**, não só a pedalada.

## O problema, medido

As cidades chegam do Nominatim com o nome **local** — `Brugge`, `Mechelen`, `Gent`. O
francês que aparece hoje é trabalho do modelo: ele escolhe a região, escolhe a passagem e
**traduz o topônimo** para a língua do nome. As pontas **não ficam guardadas** em
`route_name_meta`, que registra só `regiao`, `artigo` e `via`.

Consequência que define tudo: **não dá para re-renderizar em português a partir do banco.**
Derivar por código devolveria flamengo dentro de frase portuguesa.

| hoje (fr) | derivado por código | com o modelo escrevendo em pt |
|---|---|---|
| De Bruges à Bredene | De **Brugge** a Bredene | De Bruges a Bredene |
| Boucle de Malines | Volta por **Mechelen** | Volta por Malinas |
| Retour de Gand | Volta de **Gent** | Volta de Gante |
| Boucle du Pajottenland | Volta pelo Pajottenland | Volta pelo Pajottenland |

## A forma: **dois recursos**, não duas leituras

A decisão 3 muda a arquitetura para melhor. Em vez de o mesmo recurso rodar duas vezes,
nasce um **quarto recurso** — `nome-de-rota-pt` — com descritor próprio, preferência própria
e linha própria no seletor de Motores. É o que permite, por exemplo, o Tucano2 (treinado a
mais em português) escrever o português enquanto outro motor escreve o nome local.

**O descritor em pt é uma variante fina, não uma cópia.** Hoje o descritor deriva a leitura
em `leituraDoNome(f) → lerRota(f.rota, f.ancoras)`, e a língua nasce lá dentro de
`linguaDoPais(paisDominante)`. A variante força a língua na leitura:

```ts
const leituraEmPt = (f) => ({ ...lerRota(f.rota, f.ancoras), lingua: 'pt' });
```

As cinco funções seguem as mesmas, `montarFrase` continua devolvendo **uma** frase, e
**nada em `shape.ts` ou em `RouteFacts` muda** — o plano anterior queria um campo de língua
forçada nos fatos; com um recurso próprio ele deixa de ser necessário.

**Molde e `verificar`: zero trabalho.** Os dois já são `Record<Lingua, …>`; o português já
está escrito e testado (`Volta por X`, `Ida a X`, `Volta de X`, `De X a Y`, `Tour do X`, com
contração de artigo).

**A preferência não custa migração.** Ela mora em **AsyncStorage**, não em
`user_preferences` — `Partial<Record<RecursoId, MotorId>>`, por aparelho e de propósito
(AD-8). Um recurso novo entra sem tocar no banco e sem mexer em `CHECK`.

### O que um quarto recurso obriga

Sete lugares são `Record<RecursoId, …>` **fechados** e não compilam até serem preenchidos —
é a barreira funcionando, e é o escopo:

`catalogo.ts` (HOSPEDAGEM) · `folha-regras.ts` (DETALHE_DO_SEM_MODELO) ·
`amostras-regras.ts` (RECURSOS_COM_REGUA) · `amostras.ts` (POR_RECURSO) ·
`motores/index.tsx` e `modelo/[id].tsx` (NOME_DO_RECURSO) · `preferencia.ts`

Mais `RECURSOS` e `CATALOGO_DE_RECURSOS` no núcleo. `RECURSOS_COM_REGUA['nome-de-rota-pt']`
é **false** — não há template, então a bancada mede e mostra, mas quem aprova é você.

### Por que não a alternativa

**Uma chamada devolvendo as duas línguas** mudaria o prompt (`versaoPrompt` sobe), o
`interpretar`, o `montarFrase` e o contrato do descritor — barreira do
`architecture.test.ts`. Economizaria ~6 s por atividade e custaria a peça mais cara do
núcleo. E mataria a decisão 3: um motor só escreveria as duas línguas.

## O alcance: toda atividade com GPS

Medido em produção hoje:

| tipo | com GPS | já nomeadas | sem nome | km médio |
|---|---|---|---|---|
| ciclismo (13) | 141 | 135 | 0 | 37,9 |
| **caminhada (52)** | 80 | 0 | **80** | 3,8 |
| **corrida (37)** | 58 | 0 | **58** | 8,7 |
| **total** | **279** | 135 | **138** | — |

**O rendimento cai muito fora da bicicleta, e você deve saber antes.** As 135 pedaladas
deram **66 nomes distintos** — cerca de duas por nome. Já as 58 corridas passam por apenas
**8 origens e 7 destinos distintos**: elas vão colapsar em ~8 variações, repetindo
"Volta por X" dezenas de vezes. As 80 caminhadas têm 22 origens e 24 destinos — melhor, mas
ainda ~3 por nome.

Isso **não é argumento para não fazer**: hoje essas 138 se chamam literalmente "Walking" e
"Running", e 8 nomes repetidos ainda são mais informação que um. É argumento para não
esperar da corrida o que a pedalada deu.

**Nenhum piso de distância artificial.** O único filtro continua sendo `forma: 'degenerada'`,
que já existe e já derruba o que não tem percurso. Se depois você achar que caminhada de
2 km não merece nome, isso vira uma linha — não precisa ser decidido agora.

## A migração

```sql
alter table public.activities
  add column if not exists route_name_pt      text,
  add column if not exists route_name_pt_meta jsonb;
```

E **os dois índices de pendentes perdem o crivo de bicicleta**, que é a decisão 4 chegando
ao banco:

```sql
drop index if exists activities_route_name_pending_idx;
create index if not exists activities_route_name_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name is null and has_route;

create index if not exists activities_route_name_pt_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name_pt is null and has_route;
```

**Conferido em produção, 23/09 — ✅.** Pela armadilha que a migration de 07/09 registrou:
`sync_upsert_activities` não pode referenciar as colunas novas, senão um re-push do
HealthKit apaga o nome derivado. Li a definição no banco — **3.010 caracteres, zero
ocorrências** de `route_name`, `route_name_meta` ou `route_name_pt`, e **nenhum `*`**: ela
lista coluna por coluna. As colunas novas ficam de fora por construção.

Ritual: seção 6 de [`revista-1-9/janela-da-migracao.md`](../revista-1-9/janela-da-migracao.md),
leitura obrigatória antes da janela. Registrar em `supabase_migrations.schema_migrations` se
aplicada pela Management API.

## O gatilho e o backfill

`precisaDeNome` hoje é `activityId === BIKE_ACTIVITY_ID && !routeName && !routeNameChecked
&& hasRoute`. Muda em dois pontos: **cai o crivo de bicicleta**, e a marca de "já tentei"
passa a ser **por língua** (`route_name_meta` para o local, `route_name_pt_meta` para o pt).
Quem já tem o francês e não tem o português paga só a segunda chamada.

> `BIKE_ACTIVITY_ID` em `activity-sync.ts:341` é do passe de **piso das rotas**, não do nome.
> Fica onde está.

**Backfill preguiçoso, sem lote e sem script.** Cada atividade ganha os nomes que lhe faltam
quando você a abre — o caminho que já existe. A conta cheia: 138 nomes locais + 279 em
português ≈ **417 chamadas**, ~42 min somados, offline e de graça no Qwen (é o que a
[ADR 0056](../../../docs/decisions/0056-o-peso-aberto-deixa-de-ser-so-prova-e-o-descritor-decide.md)
destravou). Diluído em meses de navegação, não numa sentada. Um passe em lote é possível
depois, se você quiser as 417 sem abrir uma a uma.

## A exibição — **o que falta desenhar**

Pela decisão 2, o nome local manda:

| superfície | proposta |
|---|---|
| detalhe da atividade | legenda sob o nome — o lugar natural, há espaço |
| cartão do Histórico | **a conferir em mockup**; é denso e já ganhou o selo de mídia |
| web (`activities.store.ts`) | fora desta rodada |
| capa da Revista | fora desta rodada — lê a rota ao vivo, espaço escasso |

**Nada vira código antes de mockup com dado real e do seu sim** — regra da casa para
mudança visual.

## Ordem de execução

1. ~~Conferir `sync_upsert_activities` contra as colunas novas.~~ **Feito em 23/09 — limpo.**
2. Migração, na janela, com o ritual.
3. Núcleo: o descritor `nome-de-rota-pt` e o quarto `RecursoId`, com teste.
4. As sete tabelas fechadas sobre `RecursoId`, preenchidas.
5. `route-name.ts`: cai o crivo de bicicleta, marca por língua, duas gravações.
6. Mockup da legenda (detalhe e cartão) → aprovação → tela.
7. Build. O backfill acontece sozinho conforme você navega.

**Portão de tudo:** os quatro workspaces, não só o mobile — foi um shared verde só no mobile
que deixou o `af4ddcb` ir quebrado hoje.
