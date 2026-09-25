# Retomar a 3.2 — onde paramos (25/09/2026)

Escrito para a sessão seguinte. Se você está lendo isto, a 3.2 ficou no meio.

## Estado

- **Worktree:** `/Users/sydtpt/Projects/life-organizer-wt-revista-3-1` (o nome é histórico —
  a árvore serve a 3.1, a 3.2 e o build).
- **Branch:** `feat/revista-3-2`, baseline `1b3e112`. O trabalho está **commitado como WIP e
  empurrado** — nada vive só no disco local.
- **Spec:** `_bmad-output/implementation-artifacts/spec-3-2-o-anuario-do-ano.md`, em
  `status: 'in-review'`, com as sete caixas de Execution marcadas.
- **`mobile/ios/`** é saída de build gerada e ignorada pelo git. **Não apague** — o próximo
  build pula o prebuild por causa dela, e refazê-la custa ~20 min.

## O que já aconteceu

1. A story foi implementada inteira e os **sete portões passaram por exit code**
   (shared lint/test, web build/test, scripts lint/test, mobile tsc + jest — 81 suítes).
2. A revisão em três camadas rodou e devolveu **21 consertos**.
3. O implementador estava **aplicando os 21** quando a sessão pausou em 25/09. Ele foi
   parado de propósito, **entre arquivos e não no meio de um**: no instante da parada,
   `shared lint` e `mobile tsc` saíam com **exit 0**.

### O que ele já tinha feito (visível no commit WIP)

- **P13/P12** — `tira-do-caderno.tsx` virou `CelulasDaTira.tsx` + `geometria-da-tira.ts`
  (PascalCase para componente, e os vãos deixaram de ser exportados).
- **P2** — nasceu `mobile/src/lib/__tests__/anuario-fiacao.test.ts`, a barreira da fiação.
- **P3** — `useRolagemAncorada.ts` e o teste dele foram mexidos: é onde a corrida das
  âncoras estava sendo resolvida.
- **P6** — nasceu `mobile/src/components/revista/__tests__/`, o teste que faltava ao desenho.
- **P9** — `parede-sem-leitura-por-celula.test.ts` foi atualizado.

**A última coisa que ele disse antes de parar**, palavra por palavra:
*"Now the architecture AST barrier (P2 second half + P8 caller check via AST)."* Ou seja, ele
estava entrando na **segunda metade do P2** (a asserção, na AST do `architecture.test.ts`, de
que o primeiro filho do `ScrollView` de `Edicao` é `antesDaCapa`) e no **P8 pelo lado do
chamador** (proibir que a rota embrulhe `<AnuarioDaEdicao>` num `Pressable`). Comece por aí.

**O que NÃO dá para afirmar:** que os 21 estão todos aplicados, nem que os sete portões
passam. Os dois que rodei na hora da parada passaram; os outros cinco não foram rodados.

## O que fazer ao retomar

**Primeiro, confira o disco, não a memória:**

```bash
cd /Users/sydtpt/Projects/life-organizer-wt-revista-3-1
git status --porcelain
pnpm --filter @vitale/shared lint >/dev/null 2>&1; echo "exit=$?"
```

Os portões **por exit code**, nunca por grep: uma barreira do `architecture.test.ts` derruba
o runner em vez de imprimir `not ok`.

**Depois**, ou retome o mesmo agente pelo id acima (ele tem o contexto dos 21), ou aplique o
que faltar à mão. A lista dos 21 está na transcrição da sessão; os três que importam:

- **P1** — `{antesDaCapa}` só é desenhado no `case 'edicao'` do switch de `Edicao`. Nos ramos
  `nada`, `lendo`, `sem-sessao` e `erro` a prop é descartada, então o ano abre **sem as tiras**
  quando a leitura da edição falha — contra a tese da própria story ("elas acrescentam; não
  substituem").
- **P2** — nada prende a fiação: `antesDaCapa={null}` compila e passa em tudo, e o ano volta a
  abrir como um mês grande. O idioma certo está no mesmo arquivo, em
  `mobile/src/lib/__tests__/silencio-fiacao.test.ts:83`.
- **P3** — as tiras chegam **depois** de os cadernos medirem `onLayout`, então as âncoras do
  sumário do ano podem cair curtas pela altura do bloco, em silêncio. A spec avisou do
  *embrulho* e não do *atraso* — é falha da spec, não do implementador.

## Depois dos consertos

Fechar como as outras: `status: 'done'` + Suggested Review Order na spec, `3-2-o-anuário-do-ano: review`
na `sprint-status.yaml`, commit, push, PR.

## O que está esperando o dono, fora da 3.2

- **PR #561** (`chore/veredito-25-09`) — o fechamento do Épico 2 e a recusa da magnitude.
  Estava **aberto** quando pausamos.
- O Épico 3 tem ainda a **3.3** (o destaque de luz no trimestre), e o `epic-3-context.md`
  registra que ela é a única das 27 stories da sprint **não pronta para desenvolvimento**:
  depende de uma passagem de `bmad-ux` adiada de propósito, e pode morrer.
- Nasceu uma story nova por decisão dele em 25/09: **os extremos datados** (`EventoFato`).
  Só o Sono os tem hoje; a forma e a seção `### Eventos` do prompt já existem e ninguém as
  preenche (dívida nomeada em `period/cadernos.ts:83`). Serviria as quatro tiras **e** o
  texto, em todos os períodos.
