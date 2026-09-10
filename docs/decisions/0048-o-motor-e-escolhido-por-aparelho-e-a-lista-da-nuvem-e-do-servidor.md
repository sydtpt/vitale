# 0048 — O motor é escolhido por aparelho e por recurso, e a lista da nuvem é do servidor

**Status:** aceita
**Data:** 2026-09-10
**Supera em parte:** [0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md), invariante 4,
período (a) — "provedor e modelo vêm de configuração (`AI_PROVIDER`, `AI_MODEL`)". O período (b), a
assinatura de toda edição gravada, fica intacto.
**Complementa:** [0047](0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md)
**Espinha:** [architecture-Orbe-ia-no-aparelho-2026-09-10](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md) — AD-5, AD-8, AD-9, AD-11

## Contexto

O dono quer, depois que a Retrospectiva passar pela porta da 0047, **escolher o motor de cada
recurso**: o modelo do iPhone para a Saúde do sono, a nuvem para a revista, um Qwen do Core AI para
um chat futuro. E quer que a nuvem seja **vários** motores — o Google hoje, outros depois.

Três fatos pesaram:

- A `ia-narrar` usa um modelo só, lido de `AI_PROVIDER` e `AI_MODEL` em `secrets` (ADR 0040).
- A `user_preferences` é gravada por inteiro num upsert só, e a barreira `ID_COLUMNS` do
  `architecture.test.ts` existe porque um id fora do `CHECK` derruba a linha inteira. Uma coluna de
  motor com `CHECK` exigiria migration antes de todo build que grava um motor novo.
- A web não roda modelo de aparelho, e um iPhone sem Apple Intelligence também não. A escolha é, em
  parte, uma propriedade do aparelho.

O dono decidiu que **cada aparelho escolhe o seu**.

## Decisão

1. **A preferência é local, por recurso.** Um mapa `RecursoId` → `MotorId`, guardado por um módulo
   só, dono da chave e com fila de escrita — AsyncStorage no iPhone, `localStorage` na web, argumento
   de invocação na bancada. A `user_preferences` não é tocada.
2. **O id do motor tem gramática e dono.** `sem-modelo`, `aparelho:<pesos>`,
   `nuvem:<provedor>/<modelo>`: o tipo vai até o primeiro `:`, o provedor até o primeiro `/`, e o
   resto é literal. Duas variantes reservadas: `aparelho:sistema` (o modelo que o sistema fornece) e
   `nuvem:padrao` (o servidor escolhe). O `MotorId` é a escolha; a assinatura é quem de fato
   respondeu, e uma nunca é comparada com a outra.
3. **O catálogo mostra o indisponível.** O hospedeiro lista todo motor que conhece, disponível ou
   indisponível com motivo. A preferência nunca é descartada em silêncio: o motor indisponível entra
   na trilha como tentativa com a classe `indisponivel`, e a tela diz por quê.
4. **A lista da nuvem é do servidor.** Os `secrets` guardam a lista de motores de nuvem permitidos,
   em `MotorId` completo; `AI_PROVIDER` e `AI_MODEL` continuam sendo o padrão. A `ia-narrar` aceita
   `motor` opcional: na lista, é usado; ausente, vale o padrão; fora, falha com classe. Ela expõe a
   lista, e o app a lê do servidor. O deploy que a expõe vem antes do build que a lê. Corpo sem
   `motor` se comporta como hoje.
5. **Provedor novo entra com regime.** Nenhum provedor entra na lista sem a sua tabela de regime
   versionada em `docs/` — tier, o que pode ser enviado, retenção, DPA, uso para treino e o que ele
   faz com o guardrail. Modelo novo de um provedor existente é configuração; provedor novo é um
   adaptador.
6. **Trocar o padrão exige medida.** Cada entrada da lista carrega os recursos para os quais passou
   na bancada; os dois recursos que já existem entram aprovados para o modelo em produção hoje.
   `nuvem:padrao` só resolve para um recurso se o padrão corrente estiver aprovado para ele.
7. **O servidor não guarda o pedido.** A `ia-narrar` nunca registra `sistema` nem `usuario` em log;
   registra motor, classe, status e tokens.

## Alternativas rejeitadas

**Coluna em `user_preferences` com `CHECK`.** Toda variante nova — um Qwen, um segundo provedor —
exigiria migration antes do build que a grava, sob pena de o upsert derrubar todas as preferências.
É a armadilha que custou meses ao papel de parede.

**`jsonb` em `user_preferences`, como o `retro_prefs`.** Evitaria a migration, mas sincronizaria a
escolha entre aparelhos: a web receberia `aparelho:sistema`, que não pode rodar. O dono escolheu
que cada aparelho decide.

**Lista de motores de nuvem duplicada no app.** Duas listas divergem em silêncio, e o cliente
passaria a escolher modelo que o servidor não autorizou — a function existe para proteger o crédito
Prepay.

**Um só motor de nuvem, como hoje.** O dono quer testar outros provedores; manter o modelo fixo em
`secrets` faria cada teste virar troca global, sem medir por recurso.

## Consequências

**O que custa.** Uma tela de seleção, um módulo de preferência, a lista em `secrets` e uma function
que passa a expor dado. Cada provedor novo traz trabalho de regime antes de uma linha de código.

**O que paga.** Motores diferentes por recurso sem migration, sem sincronizar o que não faz sentido
sincronizar e sem o app decidir sozinho que modelo o servidor aceita. A ADR 0040 continua valendo no
que importa: o provedor segue sendo dado, não código.

**O que custa reverter.** Pouco. Tirar `motor` do corpo devolve a function ao comportamento de hoje,
e a preferência local some com o app.
