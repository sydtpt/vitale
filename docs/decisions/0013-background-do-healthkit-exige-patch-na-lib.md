# 0013 — Entrega em background do HealthKit exige patch na lib e UIBackgroundModes

**Status:** aceita
**Data:** 2026-08-20

## Contexto

A [ADR 0012](0012-kingstinct-healthkit-devolve-o-prebuild.md) trocou para
`@kingstinct/react-native-healthkit` citando, entre as razões, que o config
plugin dela injeta `BackgroundDeliveryManager.shared.setupBackgroundObservers()`
no AppDelegate — um `HKObserverQuery` direto contra `HKHealthStore`, sem
depender do `RCTBridge` que a New Architecture aposenta.

O portão 3 do plano de migração — treino novo chegando ao Supabase com o app
fechado — **nunca havia passado nesta base**. Não é regressão da troca de
biblioteca: o `Info.plist` versionado de antes da migração também não declarava
`UIBackgroundModes`, e o portão estava listado no plano como algo a testar, não
como algo verificado.

Ao instrumentar o caminho (migalhas persistidas em `sync-breadcrumbs.ts`, porque
com o app fechado não há `console.log` nem depurador), três achados:

1. **`setCallback` e `drainPendingEvents` do `BackgroundDeliveryManager` são
   código morto.** Nada na biblioteca os chama — confirmado por varredura em
   `ios/` e `src/`. A doc da classe promete "queuing any events until JS
   subscribes via `drainPendingEvents()`", mas a fila `pendingEvents` enche e
   nunca é drenada.

2. **O observer que o JS usa é outro, e é míope.** `subscribeToObserverQuery`
   cria uma `HKObserverQuery` própria com predicado
   `predicateForSamples(withStart: Date.init(), ...)` — só enxerga amostras
   escritas **depois** da inscrição. A própria biblioteca admite o problema num
   comentário do outro arquivo: *"The current subscribeToObserverQuery uses
   Date.init() which misses data from when the app was dead."*

3. **`configureBackgroundTypes` mentia.** Resolvia `true` antes do callback
   assíncrono de `enableBackgroundDelivery` voltar, e o erro dele só ia para o
   `print`. Era o único passo do fluxo cujo fracasso é totalmente invisível — se
   o registro falha, nada quebra na hora, o app só deixa de ser acordado — e
   justamente ele não deixava rastro observável a partir do JS.

Sem `UIBackgroundModes`, o app sequer aparece em Ajustes → Geral → Atualização
em 2º Plano, então não há como o usuário habilitá-lo.

## Decisão

- Declarar `UIBackgroundModes: ["fetch"]` no app config.
- Manter um **patch local** (`patch-package`) que faz `configureBackgroundTypes`
  esperar os callbacks de `enableBackgroundDelivery` — agregados num
  `DispatchGroup` — e devolver o resultado real. O adaptador reflete isso no
  contrato (`configureBackgroundDelivery` devolve `boolean`, sem rejeitar), com
  teto de 10 s no lado JS para que "pendurou" não vire outro silêncio.
- Manter as migalhas de diagnóstico como parte do app, não como andaime
  descartável. O modo de falha desta feature é ausência silenciosa; sem carimbo
  persistido, "não rodou" e "rodou e não achou nada" são indistinguíveis.

O que faz o sync funcionar **apesar** dos achados 1 e 2: o Orbe não depende do
observer alcançar o JS. `startActivitySync` termina com um delta forçado, então
basta o iOS acordar o processo — o delta ancorado pega o que houver.

## Alternativas rejeitadas

**`BGTaskScheduler` / `expo-background-task`.** Não dependeria do HealthKit
acordar o app. Mas quem decide o horário é o iOS, tipicamente em intervalos de
horas e sem garantia — não atende o SC-004 do spec de sync-atividades, que pede
o treino no servidor em ≤ 5 min. Segue disponível como rede complementar se a
entrega do HealthKit se mostrar irregular no uso real.

**Fazer o sync em Swift, no callback do observer.** Eliminaria a dependência de
o JS bootar em background. Custaria reescrever em Swift o delta ancorado, o
dedupe multi-fonte (ADR 0004), a fila offline e a ponte com tarefas (ADR 0008)
— hoje tudo lógica pura testada em JS, do lado certo da fronteira da AD-2.

**Corrigir upstream e esperar.** O patch é pequeno e o bloqueio era imediato.
Mandar o PR segue desejável, mas não como caminho crítico.

## Consequências

Todo upgrade de `@kingstinct/react-native-healthkit` precisa reaplicar e
**reverificar** o patch em device — não basta o `patch-package` aplicar. O
arquivo é pinado por versão no nome, então um bump faz o patch parar de aplicar
**em silêncio**; é o mesmo risco já registrado para o patch do `supabase-js` no
plano de migração. Como o que se perde é a entrega em background, o sintoma não
aparece em build nem em teste: aparece como dado que deixa de chegar.

Portão 3 verificado em 20/08/2026: atividade em `activities` com `created_at` no
mesmo minuto do fim do treino, app fechado — 0 min contra os ≤ 5 min do SC-004.
