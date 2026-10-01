# Tarefas: Presença

> Spec: [docs/specs/presenca/spec.md](../../../docs/specs/presenca/spec.md) ·
> [data-model](../../../docs/specs/presenca/data-model.md) ·
> [ADR 0059](../../../docs/decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md)
>
> **Fase 0 medida e aprovada em 30/09/2026** — o portão do `background` passou, e os três
> limiares da proposta sobreviveram à medição. A **Fase 1 está liberada e não tem uma linha
> escrita**. Origem: proposta de 06/09/2026 (artifact `3afe66ba`), UX do editor de local de
> 07/09 (artifact `00920792`), e os 23 dias de log no iPhone.

## Fase 0 — Medir o motor antes de construir em cima dele

- [x] T0.1 — Geofence, log local com teto de 500, tela `/configuracoes/presenca`. Na main em
  07/09 (`1f4d823`), instalada no iPhone com build Release + `--prebuild` (módulo nativo
  novo: **não pode ser OTA**).
- [x] T0.2 — Editor de local com mapa, mira parada no centro e slider de raio (`1514bb3`,
  `e8a90e4`). Sinais vitais por lugar na lista, porque **lugar mudo é O sintoma da fase 0**.
- [x] T0.3 — **Travessia separada de relatório de estado** (`f5b790c`, `769581a`). O primeiro
  log media os builds: 16 "chegadas" numa noite parada, 12 delas uma por build. Estado por
  região persistido; o teto poda relatório antes de travessia.
- [x] T0.4 — **O portão, respondido em 30/09/2026.** `chegou · Casa · background · ±40 m ·
  fix de 0s`, às 18:36:04. O iOS entrega com o app fora da tela.
- [x] T0.5 — **Os três limiares, medidos em 23 dias.** 73 travessias / 23 dias distintos ·
  pior dia 5 (alarme em 60) · 1 passagem · 4 colagens · 1 borda sem saída · mediana ±19,8 m.
  Nenhum limiar muda.
- [ ] T0.6 — **Defeito de 1 linha, aberto.** `mediana()` em
  [`lib/presence-events.ts`](../../../mobile/src/lib/presence-events.ts) arredonda só no caso
  par; com contagem ímpar devolve o float cru e a tela imprime
  `±19.83774537753359 m` duas vezes. Arredondar no ramo ímpar. Custa um build — pegar carona
  no próximo.

## Fase 1 — O esqueleto e os alertas

### F1.1 Núcleo puro (sem banco, sem aparelho)

- [ ] T1.1 — `packages/shared/src/presence/models.ts`: `Place`, `Visit`, `PlaceDay`,
  `ForgottenDay`. Somente leitura, sem lógica (convenção do shared).
- [ ] T1.2 — `presence/pair.ts`: travessias → visitas. Descarta `redundant`, pareia por lugar
  em ordem cronológica, fecha órfã por teto de 16 h com `departed_source='inferred'`, deixa a
  última em aberto. **Teste com os 73 eventos reais exportados do aparelho.**
- [ ] T1.3 — `presence/rules.ts`: colagem (< 20 min, via `merged_into`), passagem (< 8 min →
  `provisional`), e o candidato por três passagens no mesmo ponto. Cada limiar é uma
  constante exportada com o número medido no comentário.
- [ ] T1.4 — `presence/rollup.ts`: visitas → `place_days`, **dividindo na meia-noite local**
  pelo `tz` da chegada. Teste dedicado para a visita que cruza o dia — é sempre o que se
  esquece. Propaga `inferred_edges` e `incomplete`.
- [ ] T1.5 — `presence/match.ts`: `dist(ponto, centro) < radius_m + accuracy_m`, nunca
  distância pura; empate desempata por frequência histórica naquele horário; centro é a
  **mediana ponderada por duração** das visitas confirmadas.
- [ ] T1.6 — `presence/forget.ts`: a lápide. Apaga a visita inteira e credita `seconds` e
  `visits` no dia. Teste da invariante **`medido + esquecido + não coberto` = o dia**.

### F1.2 Banco

- [ ] T2.1 — Migration `presenca_fase1`: as quatro tabelas do data-model, RLS por `user_id`,
  os três índices únicos de `visits`, o `check (radius_m between 100 and 500)`. Aplicada à
  mão, com confirmação, e registrada em `supabase_migrations.schema_migrations`.
- [ ] T2.2 — Ensaio antes da janela (`supabase/ensaio/`): a migration declara privilégios que
  o `create table` sozinho não dá. Ver a seção 6 do roteiro da janela da revista-1.9.

### F1.3 Aparelho

- [ ] T3.1 — Fila local de eventos → `visits`, em lote. **Nunca abrir conexão dentro do
  callback do geofence**: o motor é barato, o callback é que custa bateria. Idempotência por
  `client_event_id` (o mesmo id que o log já deduplica).
- [ ] T3.2 — **Semeadura dos 23 dias** (data-model §4): os dois lugares locais viram `places`
  preservando o `id` (senão o `identifier` da região muda e o monitoramento precisa ser
  rearmado), e as 73 travessias viram ~36 visitas. Roda uma vez, guardada por carimbo.
- [ ] T3.3 — **Guarda da permissão**: checar o status a cada foreground; se caiu, marcar os
  dias afetados como `incomplete` e mostrar buraco, nunca número menor. É o risco nº 1 e o
  modo de falha dos buracos de sono até 18/07.
- [ ] T3.4 — Caixa de entrada: candidato (2+ visitas em ~150 m, ou uma sozinha > 90 min),
  mini-mapa, nome sugerido pelo `reverseGeocodeAsync` — **`CLGeocoder` no aparelho, nenhuma
  coordenada sai**. Nomear vincula o cluster retroativamente.
- [ ] T3.5 — Alerta por lugar: chegada e saída, texto do usuário, `alert_cooldown_min` 60,
  horário de silêncio, e **nada dispara enquanto houver atividade aberta no HealthKit**. A
  tela diz que a saída atrasa 1–3 min, senão parece quebrado.
- [ ] T3.6 — Modo viagem: liga sozinho a > 100 km de `home` por > 24 h, desliga sozinho.
  "Tempo em casa" fica **em branco, nunca zero**, e os dias de viagem saem das médias.

### F1.4 Telas

- [ ] T4.1 — Cartão na Semana: faixa de 7 dias com as horas fora de casa. Leitura de um
  segundo.
- [ ] T4.2 — Tela de Presença pelo Mais (não na barra — lugar é dimensão, não módulo).
  Tempo por lugar, chegada e saída do dia, e a linha da lápide quando houver.
- [ ] T4.3 — A borda estimada aparece: "3 h 40 em casa *(1 borda estimada)*".

### F1.5 Portão de entrega

- [ ] T5.1 — Os quatro workspaces verdes por **EXIT CODE**, não por grep:
  `shared lint` · `shared test` · `web build` · `web test` · `scripts lint` · `scripts test` ·
  `mobile tsc --noEmit` · `mobile jest` · `expo-doctor`.
- [ ] T5.2 — **Uma semana de verdade no iPhone** antes de considerar entregue: é a única
  forma de medir o custo do callback em bateria e o comportamento da permissão.

## Fase 2 — Os carimbos

- [ ] T6.1 — `place_id` em refeição, transação, registro e hábito, preenchido com o lugar
  ativo no instante da criação.
- [ ] T6.2 — **FC por lugar**: `health_series` tem a série minuto a minuto desde 05/09 e a
  visita é só um intervalo. FC de repouso em casa contra o escritório é leitura que nenhum
  app comercial entrega, porque nenhum deles tem as duas séries.
- [ ] T6.3 — Chegada em casa × `deitou` do `sleep_periods`. A hipótese que ele nunca mediu.

## Fase 3 — O `CLVisit`

- [ ] T7.1 — Módulo Swift, `source='clvisit'` na mesma tabela (ADR 0059).
- [ ] T7.2 — Regras de sobreposição: geofence ganha nos âncora, `CLVisit` no resto.
- [ ] T7.3 — Guarda de 48 h contra ressurreição da visita esquecida.
- [ ] T7.4 — O mapa da vida: o mapa por país passa a conhecer onde ele **viveu**, não só onde
  pedalou.

## Fase 4 — Os gatilhos de módulo

- [ ] T8.1 — Chegou no mercado → a lista de Compras renderizada.
- [ ] T8.2 — Chegou em casa → as tarefas `@casa`; no escritório → as `@escritório`.
- [ ] T8.3 — Modo foco por lugar: o app abre em Tarefas no escritório, em Hoje em casa. Muda
  a tela inicial, não interrompe.

## Fora de escopo, com motivo

- **Cômodos** (quarto, cozinha, escritório de casa): distam 5–10 m, uma ordem de grandeza
  abaixo do ruído do sensor. Só com `CLBeaconRegion`, que custa hardware, módulo Swift e
  vagas do **mesmo teto de 20**. Adiado em 07/09/2026.
- **Backfill retroativo**: não existe. Google Timeline desativado, geofence e `CLVisit` sem
  API histórica, Locais Significativos E2E sem API pública. Encerrado em 06/09/2026, **não
  reinvestigar**.
- **Qualquer texto que aconselhe.** O Sono ganha dados de chegada em casa; não ganha opinião.
