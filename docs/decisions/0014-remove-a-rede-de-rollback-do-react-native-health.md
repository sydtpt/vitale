# 0014 — Remove a rede de rollback do react-native-health

**Status:** aceita
**Data:** 2026-08-20

## Contexto

A [ADR 0012](0012-kingstinct-healthkit-devolve-o-prebuild.md) decidiu manter
`legacy-provider.ts` e a dependência `react-native-health` no repositório "para
rollback de uma linha" — trocar o ponteiro em `health-source/active.ts` e voltar
à implementação antiga se a nova falhasse.

Duas coisas mudaram desde então.

**A rede já era parcial, e ninguém tinha notado.** O rollback de uma linha
restauraria a leitura sob demanda, mas **não** a entrega em background. A linha
`RCTAppleHealthKit().initializeBackgroundObservers(bridge)` vivia num
`AppDelegate.swift` versionado à mão; desde a 0012 o AppDelegate é gerado por
`expo prebuild` e traz `hk_setup_background_observers()` no lugar. Voltar de
verdade exigiria reverter o commit da migração — que é o que o git já faz,
independentemente de a lib estar instalada.

**O portão 3 passou.** Em 20/08/2026, com o app fechado, uma atividade chegou a
`activities` no mesmo minuto do fim do treino (ver [ADR 0013](0013-background-do-healthkit-exige-patch-na-lib.md)).
A migração está validada no único critério que importava e que nunca havia sido
verificado nesta base.

Enquanto isso, a lib parada desde 15/10/2024 custa: é ela que arrasta o
`@expo/fingerprint` duplicado e a reprovação "Untested on New Architecture" no
`expo-doctor` — duas das quatro falhas — e continua sendo linkada e
inicializada no boot como módulo bridge legado, logo antes de a Fase 1 do plano
ligar `newArchEnabled`.

## Decisão

Remover a dependência `react-native-health` e o `legacy-provider.ts`.

O rollback passa a ser `git revert`, que é o que ele efetivamente já era.

## Alternativas rejeitadas

**Manter até depois da Fase 1 (`newArchEnabled: true`).** A intuição é que ter a
lib por perto reduz risco ao ligar a New Architecture. É o inverso: o risco que
o plano de migração nomeia nesse degrau é justamente um módulo bridge legado
sob a camada de interop. Mantê-la instalada **adiciona** a variável que se quer
eliminar antes do teste.

**Manter só o `legacy-provider.ts` sem a dependência.** Ficaria um arquivo que
não compila, apontando para um import inexistente — pior que remover, porque
parece uma opção viva.

## Consequências

Voltar atrás deixa de ser trocar uma linha e passa a ser reverter commits. Como
o AppDelegate gerado teria de mudar junto, isso implica rebuild nativo — não é
mais reversível por `eas update`.

O `expo-doctor` cai de 4 falhas para 2: sobram os desvios de versão de pacote
(Fase 0 do plano de migração) e o falso positivo de `app.json` coexistindo com
`app.config.js`, que apenas faz `require('./app.json')`.

Os testes do dicionário de tradução do adaptador legado saem junto — não é perda
de cobertura, porque a biblioteca nova usa os identificadores da Apple
diretamente e não existe dicionário para dessincronizar. A única propriedade de
produto que morava naqueles mapas — quais cumulativas passam pelo dedupe
multi-fonte da ADR 0004 — ganhou barreira própria em
`health-source-mapping.test.ts`.
