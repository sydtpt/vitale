# ADR 0034 — Bicicleta é entidade, e a pedalada herda a bike pela data

**Data:** 2026-09-05 · **Status:** aceita

## Contexto

Em 05/09/2026 o dono do app pediu ajuda para escolher pneu "com base em todas
as pedaladas". O cruzamento das 137 rotas com o OpenStreetMap deu 87%
pavimentado, e só no meio da conversa apareceu o fato que muda a leitura: as
pedaladas até maio de 2026 eram de **outra bicicleta**. A Nuroad entrou em
30/05/2026. Separadas, as duas bikes têm perfis diferentes (antiga 78,1% liso /
13,1% fora do asfalto, 125 saídas de 30 km; Nuroad 81,5% / 10,5%, 23 saídas de
54 km, 3 km/h mais rápida nas saídas longas). Nenhuma tela sabia disso, porque
o modelo não tinha onde guardar.

Ele quer o corte "por bicicleta" para decisões futuras (pneu, troca de bike) e
disse **só a bicicleta** agora — pneu fica para quando trocar, em março de 2027.

## Decisão

1. Nasce a tabela `gear` — nome, `kind` (hoje só `bike`), janela de vigência
   `[active_from, active_to]` (`active_to` nulo = em uso) e `activity_types`
   (ids HealthKit que herdam; `{13}` = ciclismo). RLS por `user_id`.
2. `activities.gear_id` é um **override explícito**, nulo por padrão. Ninguém o
   escreve ainda; está reservado para o usuário ou para o provider (Strava e
   intervals.icu mandam `gear_id` e o ingest hoje descarta).
3. A regra "de qual bike foi esta pedalada" mora **no núcleo**, num lugar só:
   `packages/shared/src/gear/assign.ts`. Override primeiro; senão, a bike cujo
   tipo bate e cuja janela contém o **dia local** do início. Janelas sobrepostas
   não quebram: vence o `active_from` mais recente.

## Alternativas descartadas

- **Só `gear_id` por atividade.** Exige backfill de 148 linhas e um escritor
  para cada pedalada nova — o HealthKit não tem a noção de bike. Duas janelas
  resolvem o passado inteiro e o futuro sem código.
- **Inferir pelo relógio (`device`).** O Garmin chegou em 18/07, a bike em
  30/05: são fronteiras diferentes, e confundi-las já custou uma inferência
  errada nesta mesma sessão ("a Nuroad para mais no semáforo" — era o relógio).
- **Bike no `metadata` jsonb.** Não dá para listar as bikes, nem filtrar por
  elas sem varrer o histórico.
- **View no banco resolvendo a herança.** Duplicaria a regra entre SQL e
  cliente; o cliente já tem tudo carregado e a regra é uma comparação de datas.

## Consequências

- O cadastro inicial (duas linhas) entra por SQL com confirmação; não há tela de
  gerenciar bicicletas ainda — é o próximo passo natural quando houver uma
  terceira.
- Toda visão agregada de ciclismo (piso, velocidade, volume) pode filtrar por
  bike, e a visão "tudo" deve **marcar** a fronteira em vez de misturar.
- Pneu, quando vier, é filho de `gear` com a mesma forma (nome + janela) — não
  precisa de outra regra.
- `kind` com CHECK de um valor só: adicionar tênis é migration, de propósito.
