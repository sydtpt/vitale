# 0003 — Meta semanal configurável, não constante da OMS

**Status:** aceita
**Data:** 2026-07-30

## Contexto

A linha de referência do gráfico de Duração precisa de um alvo. A OMS publica uma **faixa**, não um valor: 75–150 min/semana na âncora vigorosa ([0002](0002-minutos-de-esforco-ancorados-no-vigoroso.md)). Escolher um ponto dela e chamar de "OMS" seria atribuir à OMS uma decisão que é do usuário.

## Decisão

Meta configurável em `user_preferences.weekly_activity_target_min` (smallint, nullable, check 30–1500; migration `20260730130000`). Quando NULL, cai em `DEFAULT_WEEKLY_TARGET_MIN = 95` — dentro da faixa, na parte de baixo: alvo sustentável toda semana, não teto.

Toda leitura passa por `resolveWeeklyTargetMin()`, que trata NULL, não-finito e fora-de-faixa.

O rótulo no gráfico é **"Meta"**, nunca "OMS".

## Alternativas rejeitadas

**Constante fixa da OMS.** Mentiria no momento em que o usuário configurasse outro valor, e a OMS não publica valor único.

**Rótulo "OMS" com valor configurável.** Pior dos dois: atribui à instituição um número escolhido pelo usuário.

## Consequências

Edita-se no mobile em `configuracoes/objetivos.tsx`; a web só lê, via `PreferencesService`.

Duas armadilhas herdadas desta decisão:

- O settings store do mobile **não hidrata sozinho**. Tela que leia `preferences` precisa chamar `loadSettings()` quando estiver null, ou fica presa no padrão.
- `PreferencesService` da web usa `select('*')` **de propósito**. Listar colunas explicitamente faz o PostgREST rejeitar a query inteira quando uma migration recente não foi aplicada — derrubaria até o `map_style`. É exceção consciente à regra de colunas explícitas, que vale para tabelas de payload grande.
