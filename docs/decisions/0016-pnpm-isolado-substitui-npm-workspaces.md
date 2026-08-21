# 0016 — pnpm com resolução isolada substitui npm workspaces

**Status:** aceita
**Data:** 2026-08-21

## Contexto

O monorepo usava npm workspaces, que hasteia todas as dependências numa árvore
plana na raiz. Enquanto os três workspaces quiseram versões compatíveis, isso
passou despercebido. A migração do Expo 54 → 57 quebrou o equilíbrio: o mobile
passou a exigir TypeScript 6 e o Angular 21 veta TS ≥ 6
(`@angular-devkit/build-angular` pede `>=5.9 <6.0`).

O resultado não foi um conflito declarado — foi um defeito silencioso. O
`@angular/compiler-cli` fica hasteado na raiz e passou a resolver o TS 6 do
mobile, enquanto o `@angular-devkit/build-angular`, aninhado em `web/`,
continuava no 5.9.3. Dois TypeScripts dentro do mesmo build do Angular, e o TS 6
renomeou `lib.esnext.float16` para `lib.es2025.float16`. O `ng build` morria
procurando um arquivo do TS 6 dentro da pasta do TS 5.9.

Confirmado como regressão da migração, e não dívida anterior: o `ng build` passa
num worktree do commit pré-migração e falhava em `main`.

O contorno foi um `overrides` na raiz com quatro entradas. Três existiam só para
desfazer colisões de hoisting (`react`, `react-native`,
`@angular/compiler-cli` → `typescript`); a quarta segurava a versão de um pacote
com patch. Nenhuma delas resolvia a causa.

## Decisão

Trocar npm workspaces por **pnpm 11 com `nodeLinker` isolado** (o padrão): cada
workspace enxerga apenas o que declara.

`patch-package` e o script de `postinstall` saem junto — os patches passam a ser
`patchedDependencies` no `pnpm-workspace.yaml`, com chave por **faixa** de versão
e falha alta nativa (`allowUnusedPatches` é `false` por padrão; na v11, falha de
aplicação sempre lança).

A troca aconteceu em fase própria, depois da migração de SDK e com os três
portões em device no fim — não junto dela. Misturar as duas fontes de quebra
tornaria impossível atribuir causa.

## Alternativas rejeitadas

**Manter npm workspaces com os `overrides` documentados.** Foi o estado
intermediário, e funciona. Mas `overrides` é instrumento cego: ele desfaz o
sintoma sem impedir a próxima colisão, e cada bump de SDK exige lembrar de subir
`react` e `react-native` junto — esquecer não dá erro de instalação, o app
compila contra a RN errada em silêncio.

**Separar as raízes de instalação** (web e mobile com `node_modules`
independentes). Também mata a classe de colisão, sem trocar de gerenciador, mas
perde o vínculo de workspace e exigiria repensar como o núcleo é consumido.

**Alinhar todos os workspaces num TypeScript só.** Tentado e revertido: o
`npm install` falha com ERESOLVE, porque o toolchain do Angular 21 veta TS ≥ 6.
Alinhar significaria segurar o mobile numa versão anterior à que o Expo pina,
trabalhando contra a cadência N-1 (AD-16).

**pnpm com `nodeLinker: hoisted`.** É o fallback que a Expo recomenda para
bibliotecas RN incompatíveis com isolamento. Descartado porque devolveria
exatamente a árvore plana que causou o problema. A Expo suporta dependências
isoladas desde a SDK 54, e o projeto está na 57 — verificado, e o build nativo
passou sem precisar de nenhum `publicHoistPattern`.

## Consequências

**Os quatro `overrides` desaparecem.** Os três TypeScripts passam a conviver por
construção — web 5.9.3, mobile 6.0.3, núcleo 5.8.3.

**Dependência não declarada deixa de funcionar.** O isolamento expôs quatro
dependências fantasma, que o projeto usava vivendo de carona na árvore plana:
`@types/node` no núcleo; `@jest/globals` (37 arquivos de teste) e `@types/node`
no mobile; e `@expo/config-plugins` nos cinco config plugins próprios — esta
última quebraria o `expo prebuild`, isto é, o build nativo inteiro. Em três dos
quatro casos **os testes passavam** e só o `tsc` acusava.

Isso é o custo recorrente da decisão: dependência nova precisa ser declarada no
workspace que a usa. É também o benefício — era exatamente essa disciplina que
faltava.

**`@vitale/shared` passa a ser referenciado por `workspace:*`.** O npm resolvia
`"*"` como pacote local; o pnpm exige o protocolo explícito, o que torna o
vínculo visível no manifesto.

**O patch continua cobrindo o que o bundler alcança.** Os três workspaces
resolvem a mesma cópia física com patch do `@supabase/supabase-js` — o store
endereçável por conteúdo dedupa por versão, e `patchedDependencies` tem escopo
de workspace. O `Podfile.lock` resolve o `ReactNativeHealthkit` pelo diretório
com `patch_hash`, então o CocoaPods compila o source com patch, que é o que a
[ADR 0013](0013-background-do-healthkit-exige-patch-na-lib.md) exige. **Se as
versões divergirem entre workspaces, voltam a existir duas cópias** — o
corolário de singleton da AD-14 existe para esse caso.

**Duas proteções novas ficam ligadas.** `allowBuilds` bloqueia scripts de
instalação por padrão (aprovados só os quatro que precisam) e `minimumReleaseAge`
recusa versões recém-publicadas, o que casa com a cadência N-1.

Voltar atrás é reverter o commit e reinstalar com npm — o `package-lock.json`
sai do git aqui, então o rollback recria a árvore plana e traz de volta a
necessidade dos `overrides`.
