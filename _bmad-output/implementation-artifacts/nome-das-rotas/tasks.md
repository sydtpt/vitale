# Tasks: Nome das rotas — `route_name`

Spec: [docs/specs/nome-das-rotas/spec.md](../../../docs/specs/nome-das-rotas/spec.md) ·
data-model: [data-model.md](../../../docs/specs/nome-das-rotas/data-model.md) ·
ADR: [0041](../../../docs/decisions/0041-o-nome-da-rota-e-molde-com-lacuna.md)

**Estado em 07/09/2026 (fim do dia): as Fases 0, 1, 2, 3 e 5 estão na main.** O núcleo inteiro
vive em `packages/shared/src/routes/` (7 módulos com teste + golden set), a migration
`20260907170000_nome_das_rotas.sql` está aplicada, e o passe roda **no aparelho** por
`mobile/src/services/route-name.ts`.

**Os 133 nomes foram aprovados por ele em 07/09** — "os nomes já estão ok", o único critério
de aceite que a Fase 6 reconhece. Restam as duas conferências de *tela* (T6.1 e T6.2): que o
nome apareça certo no iPhone e no navegador é pergunta diferente de se o nome é bom.

> O cabeçalho anterior dizia "só a Fase 0 existe, nada foi construído" — ficou parado
> enquanto a frente inteira era escrita e mesclada no mesmo dia. Conferido contra o código
> em 07/09/2026 às 22h.

> **Abrir a branch com worktree**, não com `git checkout -b` na árvore principal:
> `git worktree add ../life-organizer-wt-nomes -b feat/nome-das-rotas`. A frente de fotos
> aprendeu isso do jeito caro, movendo a árvore compartilhada por baixo de uma sessão
> concorrente.
>
> E antes de qualquer build de entrega:
> `git merge-base --is-ancestor origin/main HEAD` — worktree defasado já fez o app voltar no tempo.

---

## Fase 0 — Levantamento e proposta (feita em 07/09/2026)

- [x] **T0.1** Origem do nome rastreada no código: nunca foi gerado pelo app. Vem do
      `activityName` do HealthKit ([healthkit-workouts.ts:90](../../../mobile/src/lib/healthkit-workouts.ts#L90))
      ou do `raw.name` do intervals.icu ([intervals.ts:195](../../../supabase/functions/_shared/providers/intervals.ts#L195)),
      que espelha o Garmin — e o Garmin nomeia pelo **ponto de partida**.
- [x] **T0.2** Levantamento em produção: 196 pedaladas, 138 com rota, **138/138 com `cities`**
      (média de 10 cidades ordenadas), **175 chamadas `Cycling`**, **1 com `name_edited`**.
      A queixa original (nome da cidade de casa) atinge ~10 linhas; a ausência de nome atinge 175.
- [x] **T0.3** Classificação geométrica das 138 rotas: 75 Casa→loop→Casa, 23 Casa→B, 19 A→B,
      18 A→Casa, 3 A→loop→A. As quatro formas do pedido cobrem 97%; a quinta apareceu no dado.
- [x] **T0.4** **Descoberta da mudança de casa**: cluster `50.852, 4.344` até 07/06/2026,
      cluster `50.872, 4.373` a partir de 21/06/2026, ~3 km, zero sobreposição. Casa é
      entidade com vigência (ADR 0034), não constante.
- [x] **T0.5** Restrição encontrada: a regra `setName` do
      [dedupe.ts:249](../../../packages/shared/src/fitness/dedupe.ts#L249) reescreve
      `activity_name` a cada sync — daí a coluna separada.
- [x] **T0.6** Prova barata: 20 pedaladas reais nomeadas à mão sobre o payload exato, com as
      2 já nomeadas pelo dono incluídas às cegas. `Tour de la Meuse-Rhin` saiu idêntica;
      `Tour de la Wallonie picarde` divergiu e produziu a regra **região vence trajeto**.
- [x] **T0.7** Aprovação do dono, com uma correção: nomes **na língua do país**, Bélgica em
      **francês** inclusive nas rotas flamengas. Consequência técnica: o modelo passa a
      devolver `{regiao, artigo, lingua}` em vez de frase, porque contração francesa
      (*de* + *le* → *du*) é regra de código.

---

## Fase 1 — Núcleo puro (`packages/shared/src/routes/`) — **feita em 07/09/2026**

Sem rede, sem SDK, sem banco. **Fazer inteira antes de qualquer chamada ao modelo.**
A barreira do `architecture.test.ts` tem que recusar até o nome de um provedor aqui dentro.

- [x] **T1.1** `anchor.ts` — agrupa pontos de partida em clusters e fecha vigências.
      Entrada: `[{ startAt, lat, lng }]`. Saída: `[{ lat, lng, activeFrom, activeTo }]`.
      Teste contra as 138 partidas reais: tem que produzir **exatamente 2** âncoras, com o
      corte no vão de 08–20/06/2026.
- [x] **T1.2** `shape.ts` — `(rota, âncoras) → { forma, pontaNotavel, paisDominante }`.
      Forma por distância início/fim contra a âncora vigente na data (limiar 400 m) e gap
      início→fim. Teste: reproduzir a distribuição 75/23/19/18/3.
- [x] **T1.3** `molde.ts` — `(forma, regiao, artigo, lingua) → string`. É aqui que mora a
      contração: `de`+`le`→`du`, `de`+`la`→`de la`, `de`+`l'`→`de l'`.
      Casos de teste obrigatórios: `du Pajottenland`, `de la Wallonie picarde`,
      `du Hageland`, `de la forêt de Soignes`, `d'Anvers`.
- [x] **T1.4** `verificar.ts` — a justificativa do modelo se sustenta? Reprova quando cita
      cidade que não foi enviada, quando `regiao` é uma das cidades da lista (isso é
      trajeto disfarçado de região) ou quando a língua não bate com o país dominante.
      Espelha o contrato do [ia/verificar.ts](../../../packages/shared/src/ia/verificar.ts).
- [x] **T1.5** Portão de degenerescência, **antes** de qualquer chamada: menos de 2 km, ou
      uma única cidade → não nomeia, não chama o modelo. Teste com as 3 rotas da spec §6.
- [x] **T1.6** **Golden set** com os 20 da spec §6, fixado em arquivo. É o que impede uma
      troca de modelo ou de prompt de degradar em silêncio.
- [x] **T1.7** `pt-BR`, `fr`, `nl` no molde. Alemão fica de fora até existir uma rota
      dominada pela Alemanha — hoje não há.

## Fase 2 — Banco

- [x] **T2.1** Migration `20260907170000_nome_das_rotas.sql`: tabela `places` + as duas
      colunas em `activities` + o índice parcial do cursor (data-model §1 e §2).
- [x] **T2.2** **Conferir na função em produção** que `sync_upsert_activities` não referencia
      `route_name` nem `route_name_meta`. Se referenciar, todo re-push do HealthKit apaga o
      nome — é a nota que a migration de `cities` deixou registrada.
- [x] **T2.3** Aplicar via Management API e registrar em `supabase_migrations.schema_migrations`
      para o `db push` não re-executar. *Conferido indiretamente: 133 rotas foram nomeadas em
      produção, o que exige as colunas e o índice. Confirmar no banco quando houver sessão com
      a Management API aberta.*
- [x] **T2.4** Semear as 2 linhas de `places` a partir do T1.1 rodado sobre produção.
      *Mesma evidência: `route-name.ts` lê `places` por `ancoras(userId)`; sem as linhas
      semeadas nenhum nome teria saído.*

## Fase 3 — O passe ~~no ingest~~ **no aparelho** ([ADR 0042](../../../docs/decisions/0042-o-passe-de-nome-roda-no-aparelho.md))

A fase mudou de lugar durante a construção (commit `acf10c8`). A orquestração não roda na
edge function: o aparelho lê `places`, deriva com `lerRota`, monta o prompt com
`montarPromptDeNome`, chama a `ia-narrar` — que segue burra —, confere com `verificarNome`,
monta a frase com `montarNome` e grava. Tudo em
[route-name.ts](../../../mobile/src/services/route-name.ts). Os nomes das funções abaixo são
os do plano; os reais estão entre parênteses.

- [x] **T3.1** `promptDeNome()` em `packages/shared/src/routes/prompt.ts` — **no núcleo**, não
      no adaptador, pelos dois motivos da [ia/prompt.ts](../../../packages/shared/src/ia/prompt.ts):
      é o que se ajusta, e é agnóstico de provedor. Payload: cidades ordenadas, forma, km,
      subida, países, língua-alvo. **Nunca** os pontos do GPX.
- [x] **T3.2** `VERSAO_PROMPT`, gravada em `route_name_meta`. Sobe a cada mudança que altere
      o texto que sai.
- [~] **T3.3** ~~`enrichRouteNames()` em `ingest.ts`~~ — **SUPERADA pela ADR 0042.** Não há
      `enrichRouteNames` em `ingest.ts` e não deve haver: o gatilho virou "abrir o detalhe de
      uma pedalada sem nome, uma vez por pedalada", o mesmo molde da varredura de fotos.
      Não é dívida — é decisão registrada.
- [x] **T3.4** Reusar `resolverNarrador()` da [ADR 0040](../../../docs/decisions/0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md).
      **Não** criar caminho novo de provedor. Se o `Narrador` não servir para saída
      estruturada, essa é a hora de descobrir — e de decidir se a interface muda ou se
      ganha um irmão.
- [x] **T3.5** Registrar tokens de entrada/saída em `route_name_meta`, para conferir a
      estimativa de ~21 mil tokens do backfill contra o real.

## Fase 4 — Backfill retroativo (pedido explicitamente)

- [x] **T4.1** Rodar sobre as 138 em lotes, com o golden set conferido **antes** de soltar o
      resto. *Rodou: **133 nomeadas** em produção.*
- [x] **T4.2** Ler as 138 saídas inteiras. **Lidas e aprovadas em 07/09/2026: "os nomes já
      estão ok".** Não houve nome ruim entre os 133 — o que fecha a pergunta do T4.3 abaixo.
- [x] **T4.3** Medido em produção em 07/09/2026 (Management API). **138 com rota · 133
      nomeadas · 4 recusadas · 1 não tentada.** Recusa de **2,9%**, contra os ~15% previstos
      pela amostra — cinco vezes menos.

      **O achado não é a taxa, é a origem dela.** As 4 recusas são *todas* `degenerada`, o
      portão que roda **antes** de chamar o modelo. Os outros quatro motivos —
      `truncado`, `ilegivel`, `reprovado`, `sem-molde` — **nunca dispararam nenhuma vez**.
      Ou seja: o `verificar.ts` inteiro, que existe para reprovar justificativa que não se
      sustenta, jamais reprovou nada em produção, e `lerRespostaDoModelo` jamais recebeu
      resposta ilegível.

      Isso não prova que ele está frouxo — prova que **nunca foi exercitado**. A rede de
      segurança está intacta porque nada caiu nela.

      **Resolvido pelo T4.2 (07/09):** os 133 nomes foram lidos e aprovados, sem nome ruim
      entre eles. Então a leitura correta é a primeira — **o prompt é apertado o bastante e
      o `verificar` é rede dormente, não portão frouxo**. Fica o registro para a próxima
      troca de modelo ou de prompt: se a recusa continuar em zero fora do `degenerada`, isso
      é sinal de que o prompt segue firme; se começar a disparar, o `verificar` acordou e
      vale ler o que ele barrou antes de mexer nele.

      Distribuição das formas entre as nomeadas: 76 casa-loop-casa · 22 casa-b · 18 a-b ·
      15 a-casa · 2 a-loop-a — bate com o levantamento da Fase 0 (75/23/19/18/3).

## Fase 5 — Leitura nos apps

- [x] **T5.1** Helper único no shared com a precedência da spec §8. Nenhuma tela reimplementa.
- [x] **T5.2** Adicionar as colunas aos três `select` (data-model §4).
- [x] **T5.3** Trocar os quatro pontos de leitura: cartão e detalhe da web, detalhe do
      celular, Retrospectiva.
- [x] **T5.4** Conferir que renomear à mão continua funcionando e que o selo "editado" não
      aparece por causa de um nome derivado — `route_name` não é edição do usuário.

## Fase 6 — Conferência (nada aqui substitui)

- [ ] **T6.1** No iPhone: Histórico, detalhe, Retrospectiva.
- [ ] **T6.2** No navegador: `/workout-history` e o detalhe.
- [x] **T6.3** **Veredito do dono** sobre os nomes das 138. É o único critério de aceite que
      importa — a spec §6 é a régua, mas o gosto dele é o juiz.
      **APROVADO em 07/09/2026: "os nomes já estão ok".** A frente passa no seu único
      critério de aceite. A parede de 22 `Boucle de Bruxelles` (133 nomes, 65 distintos)
      já tinha sido julgada por ele no mesmo dia, do lado da busca textual, e também não
      incomoda — a data e a distância bastam para diferenciar.
- [x] **T6.4** Rodar a validação dos três workspaces (CLAUDE.md) e o `expo-doctor`.

---

## O que esta frente decidiu não fazer

- **O cartão de compartilhar** fica fora: tem título próprio, editável, e mexer nele agora
  misturaria duas conversas.
- **Pedir um nome novo sob demanda** para uma pedalada específica — de produto, não de
  arquitetura. Cabe depois, e `route_name_meta` já guarda o que seria preciso.
- **Nomear corrida e caminhada.** O `cities` só é preenchido para ciclismo hoje
  (`activity_id = 13`). Estender é uma linha no `enrichCities`, mas é outra decisão.
