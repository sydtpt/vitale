---
title: 'Story 5.11 — O pedido da Saúde para o modelo pequeno'
type: 'feature'
created: '2026-09-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'dbca55529b2916a6d1b68564ceb52011f2ed29da'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-10-a-coluna-do-aparelho-na-bancada.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Na medição da 5.10 o modelo do aparelho aprovou **3 de 22** leituras da Saúde do sono (a nuvem, 22 de 22), e reprovou pela **forma**, não pelo conteúdo: abre com rótulo e dois-pontos, escreve mais de uma frase, escreve número por extenso, deixa de usar os marcadores. Ele imita o próprio pedido, que chega em linhas `Rótulo: valor`. Ligar esse modelo no iPhone (5.9) hoje entregaria o template em quase toda leitura.

**Approach:** Reescrever **só a forma** do pedido da Saúde para um modelo pequeno conseguir segui-la — o que o modelo recebe deixa de parecer uma ficha a copiar, e ganha um exemplo de resposta boa, com marcadores —, sem tocar a régua que o reprovou. Medir o aparelho de graça em até três rodadas, validar numa amostra que não serviu de ajuste, e o dono mede a nuvem **uma vez** com o pedido final. O número decide se a 5.9 vale o build.

## Boundaries & Constraints

**Always:**
- Muda **só o pedido**: `SISTEMA`, `usuarioDe` e o texto que ele monta em `sleep/leitura.ts`. A conferência (`regraDe`, `conferirInterpolado`, `interpolar`), o template, os marcadores e os casos **não mudam** — a régua é a mesma que reprovou.
- **Um pedido para todos os motores** (AD-11): nada de variante por tipo de motor. Continua função só de alcance, `range`, caso e dimensões — semanas no mesmo caso seguem com o mesmo hash.
- `VERSAO` do descritor sobe para **2**.
- O exemplo de resposta usa **marcadores, nunca valores**; nunca reproduz a frase do template; e não nomeia dimensão que o caso daquele pedido não deixa citar.
- Cada rodada é medida no aparelho na amostra padrão (`--limite 2`, 22 janelas) e registrada **só com números** — aprovadas e reprovação por regra —, nunca com texto de leitura. No máximo **três** rodadas.
- A validação da versão final roda no aparelho numa amostra maior (`--limite 6`), e o número que vai ao dono é o das janelas **que não serviram de ajuste**.
- A nuvem é medida uma vez, com o pedido final, **pelo dono** (a medição exige o token dele): o comando sai pronto.

**Ask First:**
- Qualquer mudança na conferência, no template, nos marcadores, nos casos ou no regime.
- Uma quarta rodada, ou uma segunda medição paga da nuvem.

**Never:**
- Afrouxar regra para o aparelho passar; pedido por motor; tocar o app (é a 5.9), `cadeiaPadrao`, o catálogo ou a sonda.
- Versionar relatório, acervo ou texto de leitura; fixar ou sugerir veredito do portão.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Pedido v2 por caso | cada um dos sete casos, noite e período | pedido montado, com o exemplo e as exigências do caso | N/A |
| Mesmo caso, outra semana | duas janelas no mesmo caso e `range` | mesmo pedido, mesmo hash | N/A |
| Exemplo e caso | caso que manda nomear X | o exemplo não nomeia dimensão fora do que o caso deixa citar | N/A |
| Resposta com rótulo inicial | "Resumo: …" | continua reprovada pela forma — a conferência não mudou | N/A |
| Resposta boa | uma frase com os marcadores exigidos | aprovada e interpolada como antes | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/sleep/leitura.ts:606-620` `SISTEMA` — as regras em lista; já dizem "uma frase só" e "nenhum número", e o modelo pequeno não obedece.
- `sleep/leitura.ts:636-660` `casoEmPalavras`, `:662-700` `FORMA_DA_JANELA`, `COMECO_DO_QUANDO`, `sentidoDoMarcador` — o texto de cada caso e de cada marcador.
- `sleep/leitura.ts:702-722` `usuarioDe` — monta o pedido em linhas `Alcance: …`, `Janela: …`, `Caso: …`, `Marcadores:` — **é esta forma que o modelo copia** (a resposta reprovada típica: "Alcance: um período. Janela: … Medidas: três dimensões. Regularidade: abaixo da média.").
- `sleep/leitura.ts:727` `VERSAO = 1`; `:742-768` `descritorDaSaudeDoSono` (não muda além da versão).
- `sleep/leitura.ts:537-553` `regraDe`, `:349-375` `marcadoresDe` — **só leitura**: é a régua.
- `packages/shared/src/sleep/leitura.test.ts` — prende o pedido; os testes da conferência ficam intactos.
- Consumidores que citam o descritor ou o hash (conferir se algum prende a versão ou o texto): `mobile/src/lib/__tests__/leitura-da-saude.test.ts`, `motores-*.test.ts`, `scripts/bancada/*.test.ts`, `sleep/sonda.test.ts`.
- Bancada: `pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --export <dir> --motor aparelho:sistema [--limite N]`. Acervo de 12/09 já copiado em `~/Orbe-dados/sono-2026-09-12-aparelho/` (fora do git); o relatório da 5.10 lá é a linha de base (3/22, regras: forma 28, ausente 14, extenso 9, marcador 4, algarismo 2, chave 2, contradição 2, a-mais 1).
- Nuvem: exige `ORBE_SUPABASE_URL`, `ORBE_SUPABASE_ANON_KEY` e `ORBE_ACCESS_TOKEN` do dono (`scripts/README.md:47-196`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/sleep/leitura.ts` — o pedido v2: `SISTEMA` e `usuarioDe` numa forma que não se copie, com um exemplo de resposta por marcadores; `VERSAO = 2`.
- [x] `packages/shared/src/sleep/leitura.test.ts` (e os consumidores que prenderem a versão) — a matriz, com o exemplo nunca nomeando fora do permitido e o hash estável por caso.
- [x] Rodadas no aparelho (até três) + a validação em `--limite 6` — relatórios em `~/Orbe-dados/sono-2026-09-12-aparelho/`.
- [x] `_bmad-output/implementation-artifacts/motores-5-11/rodadas.md` — só números: por rodada, aprovadas e reprovação por regra, a hipótese que ela testou; a validação; e o comando pronto da medição da nuvem para o dono.

**Acceptance Criteria:**
- Given o pedido v2, when a validação roda no aparelho, then o `rodadas.md` traz a aprovação nas janelas que não serviram de ajuste, ao lado da linha de base de 3/22.
- Given o dono roda o comando da nuvem, when o relatório sai, then ele compara a nuvem v2 com o 22/22 da v1 — é o que diz se o pedido novo pode ir para o app.
- Given a suíte, when roda, then a conferência passa inalterada e os pedidos dos sete casos estão cobertos.

## Spec Change Log

## Design Notes

**A hipótese da forma.** O modelo pequeno não desobedece às regras por não entendê-las — na 5.10 ele achou a dimensão certa, e a sonda acertou 12 de 12. Ele copia o **formato** do que recebe. Por isso o pedido deixa de ser uma ficha de rótulos e passa a pedir, no fim, a frase — com um exemplo que mostra a forma de uma resposta aprovada (uma frase, marcador no lugar do número, sem rótulo).

**Por que validar fora dos 22:** ajustar o pedido olhando as mesmas 22 janelas e relatar o número delas mediria o ajuste, não o modelo. A amostra de `--limite 6` traz outras janelas dos mesmos casos; o número delas é o que vale.

**Por que a nuvem também:** o pedido é um só. A ADR 0050 aprovou a nuvem **com o pedido v1**; trocar o pedido exige medir de novo (a própria ADR diz). Se a nuvem cair, o pedido v2 não vai para o app, mesmo que o aparelho suba.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test`
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test`
- `pnpm --filter @vitale/web build`
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`

**Manual checks:**
- A medição da nuvem com o pedido v2, rodada pelo dono — **portão do dono**, junto com a leitura do `rodadas.md`.

## Suggested Review Order

**O pedido v2 — só a forma mudou**

- A entrada: o pedido em prosa, sem ficha de rótulos, terminando no pedido da frase.
  [`leitura.ts:834`](../../packages/shared/src/sleep/leitura.ts#L834)

- As regras de sempre, em prosa — inclusive "curta", "sem marcação" e "nada que o caso não diga".
  [`leitura.ts:629`](../../packages/shared/src/sleep/leitura.ts#L629)

- O exemplo por caso, com marcadores e nunca a frase do template.
  [`leitura.ts:858`](../../packages/shared/src/sleep/leitura.ts#L858)

- As exigências e as citáveis, ditas juntas como na v1.
  [`leitura.ts:798`](../../packages/shared/src/sleep/leitura.ts#L798)

- A versão sobe para 2: outro hash, e a aprovação da nuvem da v1 não vale para ela.
  [`leitura.ts:870`](../../packages/shared/src/sleep/leitura.ts#L870)

**A medida da cópia — o que a régua da ADR 0050 não via**

- A regra mecânica de "idêntica" e "quase o exemplo", escrita ao lado do número.
  [`relatorio.ts:490`](../../scripts/bancada/relatorio.ts#L490)

- A contagem por coluna de modelo, entre as aprovadas.
  [`relatorio.ts:543`](../../scripts/bancada/relatorio.ts#L543)

- O exemplo entra pela porta que a bancada já usava para o caso.
  [`architecture.test.ts:2357`](../../packages/shared/src/architecture.test.ts#L2357)

**Os números**

- As rodadas, a validação e a remedição — só números, com a régua ao lado.
  [`rodadas.md`](motores-5-11/rodadas.md)
