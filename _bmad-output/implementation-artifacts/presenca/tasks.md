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

- [x] T1.1 — Tipos do núcleo escritos **dentro das peças que os usam** (`eventos.ts`), não num
  `models.ts` próprio: `Visita`, `PresenceEvent`, `Anomalia`, `FonteDaBorda`. As linhas de banco
  (`Place`, `PlaceDay`, `ForgottenDay`) entram em `models/index.ts` junto da migration — é lá
  que moram as linhas persistidas, como `SleepPeriod`.
- [x] T1.2 — `presence/eventos.ts` (02/10): `parear()` descarta `redundant`, caminha o log
  **inteiro** (chegar num lugar fecha a visita no anterior — percorrer por lugar perderia essa
  prova), fecha órfã com `inferred` e teto de 16 h, deixa a última aberta. **Dois defeitos que
  só o log real pegou:** o teto aparava borda **medida** (as 34 visitas saíam com a saída
  errada), e o primeiro evento do log — um `exit` — era acusado como anomalia em vez de borda
  da janela.
- [x] T1.3 — `presence/regras.ts` (02/10): colagem (20 min, funde 3 no log real), passagem
  (8 min), `ausencias()` e `contaComoSaida()` com o limiar de saída. Falta o **candidato por
  três passagens** no mesmo ponto e o `merged_into` (precisa do banco).
- [x] T1.4 — `presence/rollup.ts` (02/10): visitas → `place_days`, dividindo na meia-noite
  local, com o **lugar nulo** preenchendo os vãos e `inferredEdges` por dia. A invariante
  `presença + fora + não coberto = o dia` fecha nos 25 dias reais, por teste.
  **Armadilha paga: o dia local não tem 24 h duas vezes por ano** — em Bruxelas 29/03/2026 tem
  23 h e 25/10/2026 tem 25 h. Um rollup que suponha 86 400 erra o dia inteiro nessas datas e
  erra calado, porque 23 h num dia de 23 h parece cobertura parcial. `segundosDoDiaLocal()`
  mede. Falta `incomplete` (vem da guarda de permissão, T3.3).
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
- [ ] T3.2 — **Semeadura dos 24 dias** (data-model §4): os dois lugares locais viram `places`
  preservando o `id` (senão o `identifier` da região muda e o monitoramento precisa ser
  rearmado), e as **74 travessias viram ~37 visitas**. Roda uma vez, guardada por carimbo.
  **Pode ler do backup** em `~/Documents/Orbe/presenca-backup-2026-10-02/` — mesmo JSON.
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

### F1.6 O bloco da Retrospectiva

> Desenho completo em [docs/specs/presenca/retrospectiva.md](../../../docs/specs/presenca/retrospectiva.md).

- [x] T4.4 — **DECIDIDO em 02/10: bloco próprio + as setas de reordenar VOLTAM.** Não existe
  teto de blocos (conferido no catálogo, no `resolveRetroPrefs`, na migration, no celular e na
  web); o único "12" do sistema são os blocos manipuláveis = 13 menos a manchete, que é
  `fixed`. Devolver a seta ataca o **custo declarado** pela própria 2.5, não a decisão dela.
- [ ] T4.4b — Reimplementar as setas de reordenar no painel Diagramação (`retrospectiva/index.tsx`),
  respeitando `fixed` (a manchete não move). O comentário da 2.5 que diz "não existe mais UI
  para movê-lo" deixa de valer e precisa ser atualizado junto.
- [~] T4.5 — `presence/dias.ts` entrega a **manchete** (dias sem sair, três estados, maior
  sequência, cobertura pela janela). Faltam as outras quatro métricas e os cinco `PeriodKind`.
  Original: `presence/retro.ts` no shared, as cinco métricas pedidas, para os cinco
  `PeriodKind`. Mediana e não média; dia de escritório como denominador do item 4; visita
  confirmada (não `provisional`) como critério do item 5.
- [ ] T4.6 — **Teste da invariante** `fora + em casa acordado + dormindo + não coberto = 24 h`.
  É o que trava a implementação inteira.
- [ ] T4.7 — Interseção Casa ∩ `sleep_periods`, **no eixo do tempo** e recortada depois por dia
  local — a noite cruza a meia-noite, igual à visita. Noite sem medição derruba só o
  "acordado", nunca o "fora".
- [ ] T4.8 — Guardas de honestidade: `incomplete` e viagem fora das médias, piso de **10 dias
  cobertos** para o bloco existir, e a cobertura escrita ("sobre 23 dos 30 dias").
- [ ] T4.9 — Série "horas fora de casa" por dia no `yearSeries`, ao lado de Sono e Acordado.
  Entra no bloco que já existe, sem desenho novo.
- [ ] T4.10 — **A manchete é "dias sem sair de casa"** (02/10), não "horas fora" — essa fica
  secundária. Heatmap com **três** estados: saiu · não saiu · sem cobertura. Saída curta
  aparece no detalhe do dia, **nunca** como quarto estado na grade do ano.

### F1.7 A tela própria (decidida em 02/10 — entra NA Fase 1, não depois)

> *"A ideia é a coleta de dados agora, e uma forma de já visualizar."* A Fase 1 entrega banco
> **e** tela **e** bloco **e** cartão — a coleta nunca fica sozinha.

- [ ] T7.1 — Tela de Presença no **molde do detalhe de Hábitos/Registros**: períodos, barras,
  dia da semana, heatmap anual com intensidade. Molde já aprovado duas vezes; troca a fonte,
  não redesenha.
- [ ] T7.2 — Cartão na Semana (ver T4.1) e bloco da Retro (F1.6) saem no mesmo passo.

### F1.8 As duas testemunhas e a correção manual

> Quatro casos reais já esperam, com data — ver [retrospectiva.md §8.2](../../../docs/specs/presenca/retrospectiva.md).

- [x] T8.1 — **Detector de sequência** dentro do `parear()` (02/10): `exit`→`exit` = chegada
  perdida · `enter`→`enter` = saída perdida. Nos 24 dias reais acha **6** (10/09, 17/09 ×3,
  24/09, 26/09) — e **uma é falso positivo**: dois `exit` separados por 4 ms, estado de região
  velho. É a prova de que a caixa precisa da resposta "está certo" tanto quanto da "saí".
- [ ] T8.2 — **Testemunha do sono**: noite em `sleep_periods` sem visita em Casa cobrindo =
  dormiu fora **ou** a chegada se perdeu. Audita a **chegada**.
- [ ] T8.3 — **Testemunha da atividade**: dia "não saiu" com atividade de rota naquele dia.
  Audita a **saída**. 555 atividades com `points` no banco.
- [ ] T8.4 — Correção = **visita manual com horário** (`source='manual'`, `place_id` nulo),
  **pré-preenchida** pela testemunha que acusou. Precedência `manual > geofence > clvisit`
  **com teste** — sem ela o dia soma 26 h.
- [ ] T8.5 — O rollup **lê a correção**. É o reescritor aqui, como o sync era no `type_edited`
  — que nasceu porque a correção não durava, desfeita "sem erro, sem aviso, sem marca".
- [ ] T8.6 — As contradições vivem na **caixa de correções** da Retrospectiva, que já existe
  (`sleep/retro.ts`). Duas respostas, **as duas gravam**: "saí" e "está certo".
- [ ] T8.7 — **Limiar de saída: 45 min, configurável, derivado na leitura** — nunca gravado
  (precedente `unit_price`: retroativo sem backfill). Medido: qualquer valor entre 26 e 64 min
  dá resultado idêntico; o botão só muda algo acima de ~90 min.

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
