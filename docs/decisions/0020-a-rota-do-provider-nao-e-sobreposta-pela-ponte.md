# 0020 — A rota do provider não é sobreposta pela cópia da ponte

**Status:** aceita
**Data:** 2026-08-26

## Contexto

Um treino de bicicleta chega ao banco por dois caminhos ao mesmo tempo:

1. Garmin → Strava → o app da Strava escreve o treino no Apple Health → o sync do
   mobile o empurra para `activities` (a **cópia da ponte**);
2. Garmin → intervals.icu → o ingest server-side o lê com o FIT inteiro (a **versão
   rica**) e cria a linha canônica.

O dedupe casa os dois e a linha canônica guarda `external_ids = {healthkit, intervals}`.
O que ninguém tinha verificado é o que acontece no **re-sync**, quando o mobile reprocessa
todo o histórico de um tipo. Três buracos, encontrados ao investigar exatamente essa
pergunta:

**A rota podia ser trocada pela pobre.** `upsertActivityRoute` é um upsert sem condição em
`activity_routes` (`onConflict: activity_id`). A proteção que devia impedir isso —
`retryMissingRoutes` — filtrava por `provider = 'healthkit'`, e a linha canônica mergeada
**tem** `provider = 'healthkit'`: o vínculo com o intervals mora em `external_ids`, não em
`provider`. O filtro nunca pegou as linhas que precisava proteger.

**O mapa podia sumir com os pontos intactos.** `fetchWorkoutRoute` tem timeout de 12 s e
devolve **lista vazia em vez de erro**. O sync então empurrava `has_route = false`, e
`sync_upsert_activities` gravava sem condição. A tela de detalhe só carrega a rota quando
`hasRoute` é true, então o mapa desaparecia — com os pontos ainda em `activity_routes`, e
sem nada que os reencontrasse: o reparo automático descarta justamente as linhas que já
têm rota persistida.

**A elevação e os recordes eram apagados pelo mesmo timeout.** Derivados do track, viravam
`null` no push e o upsert gravava o `null` por cima. Diferente de `hr_zones` e `calories`,
que têm o trigger de métricas estimadas cuidando do null (ADR 0005), esses dois não tinham
rede nenhuma.

Nenhum dos três chegou a causar dano: as 20 atividades multi-fonte de hoje são todas stubs
que `bridgeStubKeepFilter` descarta antes do push, e o banco estava íntegro (192 linhas com
`has_route`, 192 com pontos, zero divergência). Mas essa proteção é estado local do
aparelho — `makeStubKeepPredicate` devolve `() => true` quando a cobertura das pontes não
está no AsyncStorage.

## Decisão

**A rota de uma atividade vinculada a provider é do ingest.** Um cliente não-privilegiado
não a substitui. E, para qualquer atividade, **rota mais pobre não substitui a mais rica**.
As duas regras viram um trigger `before update` em `activity_routes`, com
`SECURITY INVOKER` — a decisão depende de *quem* escreve (o ingest usa a service role, o
app usa `authenticated`), e numa `SECURITY DEFINER` o `current_user` viraria o dono da
função e a distinção se perderia. Só UPDATE: preencher rota ausente segue livre.

O trigger **ignora em silêncio** (`return null`) em vez de dar erro. O app não teria o que
fazer com a falha, e transformá-la em exceção encheria a fila de sync de itens que nunca
passariam.

**Leitura que falhou não apaga dado derivado.** `has_route` só sobe
(`activities.has_route or excluded.has_route`), e `elevation_m` / `best_efforts` preservam
o valor guardado quando o entrante é null. Valor entrante não-nulo continua vencendo — é
assim que o re-sync corrige um número velho.

`hr_zones` e `calories` ficam de fora dessa regra: quem cuida do null deles é o trigger de
métricas estimadas, desenhado justamente para sobreviver ao re-sync.

## Alternativas rejeitadas

**Confiar no `bridgeStubKeepFilter`.** É a proteção que já existia e a razão de nada ter
quebrado até hoje. Perdeu por depender de estado local: sem a cobertura das pontes no
AsyncStorage o predicado deixa tudo passar, e um build antigo instalado no aparelho não
tem correção nenhuma. Guarda no banco vale para qualquer cliente, de qualquer versão.

**Corrigir só o filtro do cliente (`external_ids` em vez de `provider`).** Foi feito
também — mas como conserto único seria a mesma classe de proteção que já falhou: uma regra
no cliente, que só vale para quem instalou a versão nova.

**Fazer o trigger levantar exceção.** Daria diagnóstico melhor. Perdeu porque o caminho de
escrita do mobile trata erro enfileirando o item para retry: cada re-sync recolocaria na
fila um push que está *corretamente* sendo recusado.

**Coalescer `hr_zones` junto.** Perdeu porque brigaria com o trigger de estimativa, que
depende de ver o null para decidir. Duas máquinas mandando no mesmo campo é pior que o
buraco que fecharia.

## Consequências

- O ingest continua podendo reescrever qualquer rota (service role). Verificado nos quatro
  casos: cópia pobre recusada, app recusado em linha de provider, ingest aceito em linha de
  provider, app aceito enriquecendo linha sem provider.
- Um treino que legitimamente perdeu a rota no HealthKit mantém `has_route = true` até o
  `retryMissingRoutes` confirmar a ausência e marcar false — é o único caminho que pode
  baixar a flag, e ele só faz isso depois de olhar.
- Elevação e recordes podem ficar "velhos" numa linha cuja rota sumiu da fonte, em vez de
  ficarem nulos. É a troca escolhida: dado antigo é melhor que dado apagado.
- O trigger é silencioso. Quem for depurar "por que meu upsert de rota não gravou" precisa
  saber que ele existe — daí este ADR e o `comment on function`.
