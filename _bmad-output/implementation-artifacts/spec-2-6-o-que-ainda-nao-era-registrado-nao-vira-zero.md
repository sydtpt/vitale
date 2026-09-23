---
title: 'Story 2.6 — O que ainda não era registrado não vira zero'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
baseline_commit: '448c642e2ecf28d819c3076a4624cf00ff2e6db0'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Uma edição de 2023 diz "0" do que o app ainda não registrava. O piloto imprimiu *"água, café, cerveja e smoke somaram 0 dias"* e *"passos por dia: 0"* — mas os hábitos nascem em 20/05/2026 e a saúde em 24/03/2025. A causa é uma só: `deRecap` força `?? 0`, e com isso hábito, registro, tarefa, compra, gasto, passos, andares, atividade, distância, tempo e esporte são **incapazes** de dizer "não medido". A 2.3 espalharia esse zero por quase todas as edições de 2023 a 2025.

**Approach:** A doutrina e o canal já existem — `atual: null` é "não medido", e alfabeto, prompt, `semDado` e `cadernoVazio` já o respeitam. Falta o critério, e ele é de **dois tipos**: *medição* (saúde, passos, andares) não tem medida quando nenhum dia do período carregou valor — a régua que a saúde já usa; *contagem de ato* (hábito, registro, tarefa, compra, atividade) é zero legítimo quando o registro existia, e não medida quando ele ainda não existia. O marco de cada contagem já está carregado — `createdOn` de hábitos, registros e séries, e a primeira atividade do acervo —, então **nenhuma consulta nova ao banco** entra aqui.

## Boundaries & Constraints

**Always:** zero continua sendo medida quando o registro já existia e o dia passou sem ocorrência; o marco sai do dado, nunca de data escrita no código; `atual: null` é o canal — nenhum campo novo no `FatoNumero`; a base anterior sem registro é `existe: true` com `valor: null`, nunca 0; a regra mora no núcleo e os dois hospedeiros a herdam sem escolher nada; `PACOTE_VERSAO` sobe e o `GABARITO` é refixado **no mesmo commit**.

**Ask First:** mexer no prompt ou em `PROMPT_VERSAO`, na conferência ou no ranqueamento; qualquer migração; qualquer leitura nova do banco; reimprimir ou apagar edição existente.

**Never:** o detector de métrica morta (2.7 — a outra face, a métrica que parou de chegar); a impressão em massa (2.3); a parede (2.4); silenciar caderno (2.5); escrever em `edicoes_ia`.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Ato não registrado | hábito criado depois do **fim** do período | fato **não medido**: fora do prompt, fora do alfabeto da conferência, não conta para o ranqueamento | — |
| Zero de verdade | hábito criado antes, nenhuma marca no período | `atual: 0`, citável, como hoje | — |
| Medição ausente | passos sem nenhum dia com valor no período | não medido — a mesma régua da saúde, que já vale | — |
| Medição presente | ao menos um dia com valor | a soma, como hoje | — |
| Antes do acervo | período anterior à primeira atividade | atividades, distância, tempo e esporte não medidos | — |
| Caderno inteiro | todas as métricas do caderno não medidas | caderno vazio pela regra que já existe: some da edição e da tela | — |
| Base anterior | o registro **não existia** no período anterior | B1 `existe: true`, `valor: null`; a frase de ausência que o prompt já escreve | — |
| Base amputada | o registro nasceu **dentro** do período anterior | B1 mantém o número real, menor, e `comparavel: false` o marca — apagar um número medido seria perder dado (decisão do dono, 23/09) | — |
| Marco ilegível | `createdOn` que não é dia de calendário | não medido — "não se sabe" não vira alegação, o mesmo critério de `nascidoAntes` | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/pacote.ts` -- **o culpado**: `deRecap` :591-608, com o `?? 0` em :596-597. `deMetrica` :611-627 já preserva o nulo (é o molde). Doutrina escrita em :38-44 e :122-125. `Base` :108-120 já distingue os três estados. `nascidoAntes` :571-577 (e a ordem das guardas no docblock :553-570). `semDado` :920-921, `cadernoVazio` :1060-1065, `PACOTE_VERSAO` :77.
- Chamadas de `deRecap` a tratar, em `montarPacotes`: atividades/distância/tempo :785-800, passos e andares :794-797, esporte :656-677 (e a omissão de :657), hábitos :679-685, registros :687-691, tarefas :851-853, compras e gasto :854-859.
- `packages/shared/src/period/retro.ts` -- onde os marcos nascem: `steps`/`floors` somam sem contar dias :545-551; `RetroFitness` :187-192; hábitos :614 (não filtra) e registros :637 (filtra zerado dos dois lados); `RetroInput` :140-168.
- `packages/shared/src/period/retro-dados.ts` -- `retroInputDe` :257 é quem monta o `RetroInput` para os dois hospedeiros; `createdOn` de hábitos :318, registros :324 e séries :245 chega **sem corte de janela** (:194-198).
- `packages/shared/src/ia/prompt.ts` -- `linhaDeFato` :124-137 descarta o fato nulo (:125); `blocoDeAusencias` :173-207 já tem a gramática de ausência, só para bases. **Não muda.**
- `packages/shared/src/ia/verificar.ts` -- regra 1 :809-818 sobre o alfabeto de `procedenciaDoPacote` (`pacote.ts` :1153-1186, que só admite não-nulo :1156). **Não muda:** o nulo já sai do alfabeto sozinho.
- `packages/shared/src/ia/ranqueamento.ts` -- `passaNoPortao` :133-136 lê `amostra`/`comparavel`; `cadernoVazio` tira o caderno da ordem :210.
- `packages/shared/src/period/__tests__/contrato-da-edicao.ts` -- `GABARITO` :602 e a regra de refixar :598-601. Os hashes mudam **por tabela**, porque `versaoDoDescritor` = `PROMPT_VERSAO * 1000 + PACOTE_VERSAO` (`ia/retrospectiva.ts` :45).
- `web/src/app/features/retrospectiva/data/retro.store.ts` -- monta o `RetroInput` à mão (:164) e **não imprime edição**; campo novo entra opcional, e a divergência já está no `deferred-work` desde a 2.2.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/retro.ts` -- `RetroSummary` ganha os marcos que só o pacote lê: o início do registro de tarefas e de compras (o menor `createdOn` das séries, e o das de módulo compras), o da primeira atividade do acervo, e os dias com valor de passos e de andares no período e no anterior. Tudo derivado do `RetroInput` que já chega — nenhuma leitura nova.
- [x] `packages/shared/src/period/retro-dados.ts` -- `retroInputDe` leva ao `RetroInput` o `createdOn` das séries de tarefa e de compras que hoje fica só nas diárias. Campo opcional: a web monta o input dela à mão e não imprime edição.
- [x] `packages/shared/src/ia/pacote.ts` -- `deRecap` passa a aceitar o veredito "foi medido?" por fato (e pela base anterior), devolvendo `atual: null` e `Base.valor: null` quando não. Cada família passa o seu: contagem pelo marco contra o fim do período, medição pelos dias com valor. `PACOTE_VERSAO` vai a 4, com a nota de versão no padrão das anteriores.
- [x] `packages/shared/src/ia/pacote.test.ts` -- os oito casos da matriz, com um período inteiro antes de qualquer registro (o caso de 2023) e o espelho: o mesmo período depois do marco, com zero de verdade.
- [x] `packages/shared/src/period/retro.test.ts` -- os marcos saem do dado: acervo vazio, `createdOn` ilegível, séries de compras sem nenhuma série comum, e dias com valor contados nos dois lados.
- [x] `packages/shared/src/period/__tests__/contrato-da-edicao.ts` -- refixar o `GABARITO` (a versão do descritor mudou) e acrescentar à fixture um fato de contagem **anterior ao marco**, para o contrato provar o não medido de ponta a ponta.
- [x] `_bmad-output/implementation-artifacts/epic-2-context.md` e `sprint-status.yaml` -- registrar a decisão do dono de 23/09 como pré-condição da 2.3: setembro e outubro de 2023 serão reimpressas, e **antes disso** o texto atual das duas vai para `docs/specs/revista-retrospectiva/`, como se fez com as 7 edições antigas na janela da 1.9. Quem exporta é o dono, com o JWT dele.

**Acceptance Criteria:**
- Given um período anterior a todo registro, when a edição é montada, then nenhum caderno dele tem fato com número, e os cadernos somem pela regra do vazio — sem citar zero em lugar nenhum.
- Given a mudança, when as barreiras e as suítes dos quatro workspaces rodam, then passam, com o `GABARITO` refixado no mesmo commit e nenhum teto de barreira levantado.
- Given a 2.3, when ela for escrita, then encontra no contexto do épico a decisão sobre setembro e outubro de 2023, sem precisar perguntar de novo.

## Design Notes

**Por que dois critérios, e não um.** Passos não medidos não são zero passos: a medida é passiva, e dia sem linha é dia sem relógio. Já um hábito que existia e não foi marcado **é** zero — é o dado mais honesto que a retro tem sobre ele. Um critério só erraria de um dos dois lados, e o épico nomeia os dois ("zero continua sendo medida quando o registro já existia").

**Por que o prompt não muda.** O fato nulo já desaparece da lista (`prompt.ts:125`) e já sai do alfabeto da conferência. Fazer o prompt *anunciar* o não medido seria convidar o modelo a narrar ausência de métrica, que é outro assunto — o da lápide, na 2.7. `PROMPT_VERSAO` fica em 5; só `PACOTE_VERSAO` sobe.

**O efeito colateral é a entrega.** Com o nulo real, Movimento e Rotina passam a poder ficar `semDado` — hoje nunca ficam, porque sempre carregam um `0`. É exatamente isso que faz a edição de 2023 encolher para o que ela de fato tem a dizer.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- verde, barreiras incluídas
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- verde
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verde
- `pnpm --filter @vitale/web build` -- verde

**Manual checks (do dono, com o JWT dele):**
- `revista:imprimir --tipo mes --inicio 2023-09-01 --sem-gravar`: o ensaio mostra os cadernos que sobram e nenhum zero de hábito ou de passos. Nada é gravado — a reimpressão é da 2.3.

## Suggested Review Order

**A regra, e os dois critérios**

- Ponto de entrada: o veredito de um lado e do outro, com a válvula de mão única explicada.
  [`pacote.ts:611`](../../packages/shared/src/ia/pacote.ts#L611)

- Medição passiva: sem dia com valor não há medida — a régua que a saúde já usava.
  [`pacote.ts:630`](../../packages/shared/src/ia/pacote.ts#L630)

- O `?? 0` que morreu: o veredito decide `atual` e a base anterior.
  [`pacote.ts:718`](../../packages/shared/src/ia/pacote.ts#L718)

- A nota de versão: por que o pacote virou 4.
  [`pacote.ts:84`](../../packages/shared/src/ia/pacote.ts#L84)

**De onde os marcos vêm**

- Duas famílias num tipo só: datas de nascimento e dias medidos, com o três-estados do nulo.
  [`retro.ts:82`](../../packages/shared/src/period/retro.ts#L82)

- O campo novo do input, que o núcleo preenche e a web não — e por que isso é seguro.
  [`retro-dados.ts:332`](../../packages/shared/src/period/retro-dados.ts#L332)

**O contrato**

- O gabarito ganhou o hash do texto, separado do hash do pedido.
  [`contrato-da-edicao.ts:631`](../../packages/shared/src/period/__tests__/contrato-da-edicao.ts#L631)

**Os testes que prendem a regra**

- A matriz inteira, com setembro de 2023 e o espelho de 2026.
  [`pacote.test.ts:1617`](../../packages/shared/src/ia/pacote.test.ts#L1617)
