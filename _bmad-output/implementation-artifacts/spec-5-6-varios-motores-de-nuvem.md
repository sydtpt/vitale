---
title: 'Story 5.6 — Vários motores de nuvem (F3)'
type: 'feature'
created: '2026-09-17'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'af96818d6659d1a03ea6bc66848c9049a1672132'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-5-o-botao-ler-e-a-escolha-do-motor-marco-a.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A lista de motores de nuvem é fixa no código do app (só `nuvem:padrao`), e a
`ia-narrar` devolve falha solta sem classe — o app não pode oferecer outro provedor por recurso
nem confiar no motivo de uma queda ao piso.

**Approach:** A function passa a falar em classes de `ia/fio.ts` (status fixado por classe); o
servidor publica, via `secrets`, a lista de motores aprovados por recurso; o catálogo do app funde
essa lista com o que já conhece, cacheada com instante. `nuvem:padrao` continua sempre elegível.

## Boundaries & Constraints

**Always:**
- Toda falha da function tem `classe` de `CLASSES_DE_FALHA`, status = `STATUS_POR_CLASSE[classe]`.
- `supabase/functions/` só cita classe do que importa de `ia/fio.ts` — nunca literal solto.
- `nuvem:padrao` fica elegível sempre que há rede, mesmo se a leitura da lista do servidor falhar.
- Corpo sem `motor` se comporta como hoje: resolve pelo padrão do recurso.
- A function nunca loga `sistema` nem `usuario` (já cumprido — não regredir).

**Ask First:**
- Subir `TETO_STOP` ou `TETO_PORTA_POR_HOSPEDEIRO` em `architecture.test.ts`.
- Configurar um segundo provedor de nuvem real (chave, endpoint) — fora do escopo.

**Never:**
- Inventar ou configurar um segundo provedor concreto. A lista do servidor continua nomeando só
  `nuvem:padrao` hoje; esta story entrega a **mecânica**, não um segundo provedor ao vivo.
- Tocar `mobile/app.base.json`, código nativo, ou qualquer coisa do marco B (story 5.9).
- Acrescentar campo de "motores aprovados" em `Descritor` — a aprovação por recurso vive na lista
  do servidor, não no núcleo (AD-9).
- Reintroduzir a leitura do formato antigo `{error, detalhe}` em `traduzirDaNuvem`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Motor pedido está na lista | `corpo.motor = 'nuvem:padrao'` | usa o motor pedido | N/A |
| Motor pedido ausente | corpo sem `motor` | usa o padrão do recurso | N/A |
| Motor pedido fora da lista | `corpo.motor` desconhecido | falha com classe `indisponivel`, status fixo | classe correta, nunca crash |
| Lista do servidor falha ao ler | erro no fetch/parse dos `secrets` | catálogo remove só as variantes nomeadas | `nuvem:padrao` continua |
| Function recebe erro inesperado | exceção não mapeada | ainda devolve `CorpoDaFalha` com classe | nunca `{error}` solto |
| Provedor novo sem tabela de regime | tentativa de listar um 2º provedor | não entra na lista | doc ausente é o motivo |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/fio.ts:338-342,363-367` -- `CorpoDoPedido` ganha `motor?`/`esquema?`;
  `CorpoDaFalha` (`:363-367`) e `STATUS_POR_CLASSE` (`:377-385`) já existem, comentário próprio já
  anuncia a mudança na 5.6.
- `supabase/functions/ia-narrar/index.ts` (85 linhas) -- hoje devolve `{error,detalhe}` solto
  (`:48,56,58,68,83`), não importa `ia/fio.ts`, não lê `motor` do corpo. É o arquivo que a story
  reescreve por dentro.
- `supabase/functions/_shared/ia/narrador.ts:150-163` -- `resolverNarrador` lê `AI_PROVIDER`/
  `AI_MODEL`/chave; é aqui (ou módulo novo ao lado) que a lista de motores aprovados por recurso
  entra, lida de um novo secret.
- `packages/shared/src/ia/nuvem.ts:100-142` -- `traduzirDaNuvem` ainda lê o formato antigo; a
  leitura antiga morre aqui. `corpoDoPedido` (`:52-54`) ganha `motor`.
- `packages/shared/src/ia/nuvem.test.ts:187-211` -- describe do formato antigo; remover e cobrir
  os cenários da matriz acima.
- `packages/shared/src/architecture.test.ts` -- **guarda nova** (a "guarda 3" da AD-10, nunca
  implementada): nenhum arquivo de `supabase/functions/` declara classe de falha fora do que
  importa de `ia/fio.ts`. Molde: a barreira de import relativo em `:216-247`.
- `mobile/src/lib/motores/catalogo.ts` (185 linhas) -- `MOTORES_CONHECIDOS` é lista estática; ganha
  função de fusão com a lista do servidor (cache + instante), mantendo `nuvem:padrao` sempre.
- `mobile/src/lib/motores/index.ts` (212 linhas) -- `invocar` sobre `ia-narrar`; passa a enviar
  `motor` quando a preferência resolver um motor nomeado, e a buscar a lista do servidor.
- `docs/decisions/0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md:85-86,119-121` --
  registra a tabela de regime como pendência; criar `docs/decisions/regime-<provedor>.md` (ou anexo
  à 0040) no formato tier/envio/retenção/DPA/treino/guardrails **antes** de listar um 2º provedor.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/ia/fio.ts` -- acrescentar `motor?: MotorId`, `esquema?: Esquema` a
  `CorpoDoPedido` -- ACs 1 e 3.
- [ ] `supabase/functions/ia-narrar/index.ts` -- importar `ia/fio.ts` por caminho relativo; mapear
  cada erro hoje solto para `CorpoDaFalha` com `classe` + status de `STATUS_POR_CLASSE`; ler
  `motor` do corpo e repassar -- AC 1, 3.
- [ ] `supabase/functions/_shared/ia/*` -- ler o novo secret com a lista de motores aprovados por
  recurso; expor essa lista para o app (mesma function, modo/branch novo) -- AC 2, 4.
- [ ] `packages/shared/src/ia/nuvem.ts` -- remover a leitura do formato antigo em
  `traduzirDaNuvem`; incluir `motor` em `corpoDoPedido` -- AC 1.
- [ ] `packages/shared/src/architecture.test.ts` -- nova guarda: `supabase/functions/` só cita
  classe de falha do que importa de `ia/fio.ts` -- AC 1.
- [ ] `mobile/src/lib/motores/catalogo.ts` -- fundir `MOTORES_CONHECIDOS` com a lista do servidor,
  cacheada com instante; falha na leitura remove só as variantes nomeadas -- AC 4.
- [ ] `mobile/src/lib/motores/index.ts` -- buscar a lista do servidor ao carregar; enviar `motor`
  no corpo quando a preferência resolver um motor nomeado -- AC 3, 4.
- [ ] Testes puros novos/ajustados em `packages/shared/src/ia/nuvem.test.ts` e
  `mobile/src/lib/__tests__/` cobrindo a matriz de I/O acima.

**Acceptance Criteria:**
- Given a lista do servidor nunca foi lida, when o app abre, then `nuvem:padrao` está disponível e
  nenhuma variante nomeada aparece.
- Given a lista foi lida com sucesso, when um motor nomeado está aprovado para o recurso corrente,
  then ele aparece selecionável no seletor.
- Given o deploy da function com a lista nova ainda não aconteceu, when o build novo do app já lê,
  then a leitura falha graciosamente e `nuvem:padrao` continua a única variante de nuvem.
- Given as seis suítes do portão (`shared` lint+test, `web` build+test, `mobile` tsc+jest) rodam,
  when a story fecha, then todas passam, incluindo a guarda nova e `expo-doctor` 21/21.

## Spec Change Log

## Design Notes

**Por que a mecânica sem um segundo provedor real.** As ACs descrevem a lista, o formato, a
resolução e a queda graciosa — nenhuma delas exige que um segundo provedor concreto exista hoje.
Configurar credencial/endpoint de um provedor novo é decisão de produto (qual provedor, qual
custo) que ninguém tomou ainda; inventar um aqui seria uma decisão fantasma. A story entrega o
tubo; encher o tubo é a próxima decisão do dono.

**Por que a guarda nova em vez de esperar o marco B.** O `epics.md` previa a "guarda 3" nascendo
junto de `Engine.swift` (5.4/5.5), que não existe ainda (é a 5.9). Como a 5.6 é a primeira story a
fazer `supabase/functions/` de fato falar em classes, ela é quem cria a asserção — não tem sentido
adiar uma guarda para o único código que hoje a violaria por padrão.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- exit 0.
- `pnpm --filter @vitale/shared test` -- verde, incluindo a guarda nova.
- `pnpm --filter @vitale/web build` e `pnpm --filter @vitale/web test` -- verdes (web não muda).
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verdes.
- `cd mobile && pnpm dlx expo-doctor` -- 21/21.
- `grep -rn "'ia-narrar'" mobile/src` -- só `motores/index.ts`, `edicao-ia.ts`, `route-name.ts`.

**Manual checks (if no CLI):**
- Deploy manual da function (`supabase functions deploy ia-narrar`) e do secret novo, **antes** de
  instalar o build que lê a lista -- confirmar que a ordem foi respeitada, não só declarada.
