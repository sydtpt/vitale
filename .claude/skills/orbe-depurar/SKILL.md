---
name: orbe-depurar
description: 'Investigação de causa-raiz antes de propor qualquer correção neste repositório, com o catálogo das falhas que aqui acontecem em silêncio. Use ao encontrar bug, teste vermelho, build quebrado, comportamento inesperado, número errado num gráfico, tela que não muda de tema, "sumiu", "não aparece", "não sincronizou", "parou de funcionar", regressão, lentidão ou timeout — SEMPRE antes de sugerir o conserto.'
---

# Depurar no Orbe

**Princípio:** achar a causa antes de tocar no código. Conserto de sintoma é fracasso.

## A lei

```
NENHUMA CORREÇÃO ANTES DA CAUSA-RAIZ.
```

Se você não completou a Fase 1, não pode propor conserto. Vale **especialmente** quando o
bug parece óbvio, quando há pressa, e quando você já tentou algo que não funcionou.

## Olhe aqui primeiro

Este repo falha em silêncio de maneiras específicas. Antes de investigar do zero, confira
se o sintoma casa com uma destas — todas já custaram caro aqui, e nenhuma levanta exceção.

### Dado que vem errado sem erro

| Sintoma | Causa provável |
|---|---|
| Agregado, gráfico ou contagem **menor do que devia**, sem exceção nenhuma | **PostgREST corta em 1000 linhas sem avisar.** Fetch por intervalo precisa de `range` + `order`, ou perde dado calado |
| Leitura que estoura tempo, ou 8 s cravados | `select('*')` em `activity_routes` e outras tabelas de payload grande fura o `statement_timeout` do role `authenticated` — uma leitura chegou a 89 MB / 17,7 s. Leia com colunas explícitas |
| Coluna ou tabela "não existe" em produção | Migration no repo ≠ migration aplicada. Rode `supabase/scripts/check-schema-drift.sh` |
| Atividade duplicada | Multi-app no HealthKit gera cópias; o dedupe é por fonte (ADR 0004), e `reconcileRecent` só roda com provider vinculado |

### Tela que não muda

| Sintoma | Causa provável |
|---|---|
| Trocar o tema não muda a tela, **sem erro** | `StyleSheet.create` de escopo de módulo resolve tema **no import** e congela. Embrulhe em `themed(() => …)` ou `useThemedStyles`. O `packages/shared/src/architecture.test.ts` cobra isso |
| Eixo novo de tema não pega | Ele entra em **dois** lugares: nas dependências do `useThemedStyles` **e** em `themedCacheKey()` (`mobile/src/theme/tokens.ts:177`). Esquecer um não dá erro |
| Camada de trás invisível, com todo o resto correto | `contentStyle` do `Stack` governa só o conteúdo. O container nativo da pilha é pintado à parte pelo tema de navegação — ver `NavThemeProvider` em `mobile/src/app/_layout.tsx` |
| Blur com a aparência errada | `BlurView tint="default"` segue o **sistema**, não o app. Use `systemChromeMaterialLight` / `…Dark` |
| Contraste ruim dentro de chip | Sobre `tint` use `onTint`; sobre preenchimento da marca, `onPrimary`. O par `accent`/`tint` chegou a medir 1,55 |

### Mobile e plataforma

| Sintoma | Causa provável |
|---|---|
| "Não sincronizou" | Leia `mobile/src/lib/sync-breadcrumbs.ts` (Configurações → Dados) **antes de qualquer suposição**. Ele separa "o iOS não acordou o app" de "acordou e não achou nada" (ADR 0013) |
| Feature morre em runtime com build, `tsc` e testes verdes | API de plataforma que mudou de comportamento no upgrade de SDK. Já aconteceu três vezes: background, patch do supabase na cópia errada, `saveToLibraryAsync` na galeria |
| Build "passou" mas o app está velho | `xcodebuild \| tail` sem `set -o pipefail` devolve o status do `tail`, e build quebrado passa por bem-sucedido |
| Import que "sumiu" | Quase sempre dependência **não declarada**. Sob resolução isolada não existe carona: declare no workspace que usa, nunca hasteie para a raiz |
| Gesto horizontal não responde perto da borda esquerda | O swipe-back do stack dispara junto. Guarda de borda para gráfico, `gestureEnabled: false` para slider |
| Erro de assinatura depois do bundle do JS | `expo run:ios --configuration Release` não passa `-allowProvisioningUpdates`. Use `pnpm mobile:device` |

### Não é bug, é a árvore

| Sintoma | Causa provável |
|---|---|
| Feature que existia "voltou a não existir" | Worktree defasado. `git merge-base --is-ancestor origin/main HEAD` — o app voltou no tempo, não quebrou |
| Commit que compila aqui e quebra no CI | A árvore principal tem patch solto. Valide do commit, num worktree limpo |
| Recurso de TS que quebra o build do web sem estar no web | Três TypeScripts convivem de propósito (AD-15). O núcleo segue o **menor** consumidor |

## As quatro fases

### 1. Causa-raiz — antes de qualquer conserto

1. **Leia o erro inteiro.** Stack trace completo, linha, arquivo, código. Ele costuma
   conter a resposta.
2. **Reproduza.** Dá para disparar de propósito? Sempre? Se não reproduz, junte mais
   dado — não chute.
3. **O que mudou?** `git diff`, commits recentes, dependência nova, migration nova. E
   confira se a árvore está atrás de `origin/main`.
4. **Instrumente as fronteiras.** Em sistema de várias camadas (HealthKit → sync → edge
   function → Postgres → app), registre o que **entra** e o que **sai** de cada camada e
   rode **uma vez** para descobrir onde quebra, antes de investigar o quê.
5. **Trace o dado de volta.** De onde veio o valor errado? Quem chamou com ele? Suba até
   a origem e conserte lá, não no sintoma.

### 2. Padrão

Ache código parecido que **funciona** nesta base e liste **todas** as diferenças, por
menores que pareçam. Se está seguindo uma referência, leia a referência inteira — adaptar
por cima de entendimento parcial garante bug.

### 3. Hipótese

Escreva uma frase: *"acho que X é a causa porque Y"*. Teste com a **menor** mudança
possível, uma variável por vez. Não funcionou? Formule hipótese **nova** — não empilhe
conserto sobre conserto.

### 4. Conserto

1. **Teste que falha primeiro.** O núcleo tem teste em `tsx`, o web em Vitest, o mobile em
   Jest. Se a lógica for pura, ela pertence a `packages/shared` e deve ter teste lá.
2. **Uma mudança só.** Nada de melhoria "já que estou aqui".
3. **Verifique pelo portão.** Use a skill `orbe-pronto` antes de dizer que resolveu.

**Se a terceira correção falhar, pare e questione a arquitetura.** O padrão é: cada
conserto revela um problema novo em outro lugar, ou exige refatoração grande. Isso não é
hipótese errada — é desenho errado. Converse com ele antes de tentar a quarta.

## Bandeiras vermelhas

- "Conserto rápido agora, investigo depois"
- "Deve ser X, vou mudar e ver"
- Listar consertos antes de ter traçado o dado
- Mudar várias coisas e rodar o teste
- "Não entendi direito, mas isto talvez funcione"
- Segunda tentativa sem ter voltado à Fase 1
- Culpar "flakiness", timing ou ambiente antes de investigar — 95% desses casos são
  investigação incompleta

## Desculpas

| Desculpa | Realidade |
|---|---|
| "é simples, não precisa de processo" | bug simples também tem causa; o processo é rápido nele |
| "não tem tempo" | chutar e testar é mais lento que investigar |
| "vejo o problema, deixa eu consertar" | ver o sintoma não é entender a causa |
| "mais uma tentativa" (depois de 2) | 3 falhas = problema de arquitetura |
| "escrevo o teste depois de confirmar" | conserto sem teste não gruda |
| "é ambiente" | prove com evidência das fronteiras, não por eliminação |

---

*Estrutura inspirada em `systematic-debugging` de
[obra/superpowers](https://github.com/obra/superpowers) (MIT, © 2025 Jesse Vincent).
O catálogo de falhas é deste repositório.*
