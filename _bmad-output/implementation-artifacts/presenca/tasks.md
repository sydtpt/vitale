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
- [x] T1.5 — `presence/lugar.ts` (02/10): `dist < radius_m + accuracy_m` (com o outlier real
  de ±176 m como caso de teste), empate por frequência histórica **naquela hora**, e centro
  por mediana ponderada por duração. Usa o `haversineM` de `geo/distance` — duplicar criaria
  uma segunda verdade sobre distância.
- [x] T1.6 — `presence/esquecer.ts` (02/10). **A invariante do papel estava errada e o teste
  achou:** apagar uma visita não deixa buraco, deixa vão — e o rollup **recoloca aquele tempo
  como "fora"**, porque é o complemento. Somar a lápide por cima contava duas vezes e o dia de
  24 h fechava em 25 h 10. A lápide **não se soma ao dia: ela se desconta** do que o rollup
  recolocou (`medido = rollup − esquecido`, `naoCoberto = total − rollup`) — e isso fecha sem
  precisar saber onde nem quando, que é tudo o que a lápide tem direito de guardar.
  `foraDescontado()` existe pelo mesmo motivo: sem ele, esquecer **aumenta** as horas fora de
  casa, e o esquecimento vira visível justamente na métrica que ele mais olha.

### F1.2 Banco

- [x] T2.1 — **Aplicada em produção em 02/10** (`20261002120000_presenca_fase1` +
  `20261002130000_visits_lng`, migrations 73 → 74). RLS nas quatro, 3 policies, 5 índices.
  **A tabela `places` já existia** (nome das rotas, 2 linhas) — a migração a ESTENDE em vez
  de criar, e a coluna `identidade` nasceu da exigência do dono de não perder métrica ao
  mudar de casa. Ensaiada antes contra o schema real numa transação desfeita.
- [x] T2.2 — Ensaio feito **sem colima**: a migração inteira rodou contra o schema REAL de
  produção dentro de `begin … rollback`, e o rollback foi conferido (0 tabelas, 0 coluna).
  Vale mais que o ensaio local para migração aditiva, e custa um comando. Privilégios: não
  foram declarados, por desenho — produção concede ALL por `alter default privileges` e quem
  protege é a RLS (`supabase/ensaio/privilegios.sql`); conferido depois com
  `has_table_privilege`.

### F1.2b Portas do banco (shared/data — AD-4)

- [x] T2.3 — `data/presence.ts` (02/10): `enviarVisitas` (upsert por `client_event_id`, em
  lotes), `gravarPlaceDays` (conflito na chave `nulls not distinct`, senão o lugar "fora"
  duplica a cada recálculo), `gravarLapides`, e as leituras. **`fetchPlaceDays` pagina**: um
  ano com três lugares são ~1095 linhas e passa do teto de 1000 — o rollup não escapa dele
  só por existir.
- [x] T2.4 — `data/places.ts` ganhou `fetchLugares`, `vigenteEm` e **`mudarDeEndereco`** —
  a operação que a exigência do dono criou. Ela existe como função nomeada para ninguém
  reinventá-la do jeito tentador (editar `lat`/`lng` da linha), que preserva a métrica e
  **apaga a história** de onde era a casa. 12 checagens.

### F1.2c O que o banco já provou (02/10, sem tocar no aparelho)

> Tudo contra **produção**, dentro de `begin … rollback`. Nada ficou.

- [x] T2.5 — **O pipeline inteiro, com o log real.** Núcleo → SQL → banco: 30 visitas e 54
  linhas de rollup, os mesmos números que o TypeScript diz. E a invariante conferida **em
  SQL, independente do núcleo**: 23 dias fechando em 86 400 s exatos e 2 parciais (as
  bordas). Zero visita fora da vigência do endereço — `vigenteEm` está certo.
- [x] T2.6 — **As 8 travas mordem**: raio abaixo do piso, vaga ≥ 20, `kind` inventado, saída
  antes da chegada, `source` fora do vocabulário, `client_event_id` repetido, dois "fora" no
  mesmo dia (o `nulls not distinct`) e lápide negativa.
- [x] T2.7 — **A RLS fecha dos dois lados**: outro usuário vê 0 visitas dele; o dono vê a
  sua; o dono **não** grava no nome de outro; um estranho **não** grava no nome dele.
- [x] T2.8 — **Defeito achado pelo ensaio e consertado** (`20261002140000_places_kind_amplia`):
  a tabela vinha com `check (kind = 'home')` da feature de rotas, e a migração da Presença não
  tocou nele. Cadastrar o escritório devolvia `23514`. **Sem o ensaio, isso apareceria no
  iPhone**, no momento em que ele cadastrasse o segundo lugar, com cara de bug do app.

### F1.3 Aparelho

- [x] T3.1 — `services/presence-sync.ts` (02/10). **Sem marca d'água, e não por preguiça:**
  o pareamento precisa do histórico — uma chegada de hoje fecha uma visita de ontem, e uma
  saída perdida só se descobre olhando o que veio antes. Enviar "só o novo" obrigaria a
  reconstruir o estado anterior a cada vez: mais código para fazer pior. A idempotência é o
  `client_event_id`. Nunca roda dentro do callback do geofence.
- [x] T3.2 — **A semeadura não é caminho separado: é a PRIMEIRA execução da sync.** O log já
  tem os 74 eventos; a primeira chamada os pareia e sobe as 30 visitas. Um código de semeadura
  à parte seria um segundo caminho para o mesmo resultado — e o segundo caminho é o que não é
  testado. O id local do lugar **não vira** o id remoto (seria outro `identifier` de região, e
  o monitoramento se rearmaria): são dois ids do mesmo lugar, e `remoteId` guarda a ponte.
- [x] T3.3 — **Guarda da permissão** dentro da sync: sem "Sempre", os dias da janela sobem
  com `incomplete = true`. Falta a tela mostrar o buraco — a coluna já chega lá.
- [ ] T3.4 — Caixa de entrada: candidato (2+ visitas em ~150 m, ou uma sozinha > 90 min),
  mini-mapa, nome sugerido pelo `reverseGeocodeAsync` — **`CLGeocoder` no aparelho, nenhuma
  coordenada sai**. Nomear vincula o cluster retroativamente.
- [ ] T3.5 — Alerta por lugar: chegada e saída, texto do usuário, `alert_cooldown_min` 60,
  horário de silêncio, e **nada dispara enquanto houver atividade aberta no HealthKit**. A
  tela diz que a saída atrasa 1–3 min, senão parece quebrado.
- [ ] T3.6 — Modo viagem: liga sozinho a > 100 km de `home` por > 24 h, desliga sozinho.
  "Tempo em casa" fica **em branco, nunca zero**, e os dias de viagem saem das médias.

- [x] T3.7 — **O fio ligado**: botão "Enviar para o banco" na tela da Fase 0. É botão e não
  automático **nesta fase** — a primeira execução sobe 24 dias inteiros, e isso acontecendo
  sozinho em segundo plano é o tipo de ato que ninguém vê dar errado. Quando a Fase 1 tiver
  tela, o gatilho vira a volta ao primeiro plano. *(Sem isto, a sync seria mais um mecanismo
  sem quem o dispare — a família que a Mary conta desde o AGG_VERSION.)*
- [x] T3.7b — **O gatilho automático** (05/10). A tela ficou pronta em 02/10 e o gatilho não
  foi ligado: o banco parou em 01/10 com o aparelho medindo — exatamente o mecanismo sem quem
  o dispare que a T3.7 temia. Agora: ao abrir o app, a cada volta ao primeiro plano e ao abrir
  `/presenca`; um envio por vez, no máximo a cada 30 min (o botão fura o intervalo); falha vira
  breadcrumb. `sincronizarPresencaSemRepetir` / `…EmSilencio` em `presence-sync.ts`.

### F1.4 Telas — **a tela está no aparelho desde 02/10**

- [x] T7.1b — `/presenca`, pelo **Mais** e não pela barra (lugar é dimensão). Manchete,
  três números, barras de horas fora, perfil por dia da semana, o período em três estados
  — **três degraus da mesma cor**, não três cores — e o rodapé honesto. Derivação toda em
  `presence/detalhe.ts`; a tela só renderiza. Conferida no iPhone pelo dono.
- [x] T8.6b — **A caixa de correções**, dentro da tela. `chegadasEngolidas()` recupera o
  que a corrida de 02/10 classificou errado (`background` + sozinho no instante), com a
  hora exata para a folha; a correção grava visita `manual` com as **duas pontas** (a
  saída sai do log, não da tela); e **"está certo" grava tanto quanto "cheguei"**, porque
  uma das seis anomalias é falso positivo. Conferida no iPhone.
- [x] T4.1 — **Faixa de 7 dias na Semana** (02/10): a altura é a hora fora, o dia sem
  medição fica vazado, e a frase embaixo é a mesma manchete do bloco. Toca e abre
  `/presenca`. *(Armadilha paga: rota nova exige regenerar `.expo/types/router.d.ts`, e a
  conferência tem de ser pela rota EXATA — procurar "presenca" casa com
  `/configuracoes/presenca`.)*
- [x] T4.1b — **O papel do lugar é escolhido, não adivinhado** (02/10): sete chips no
  editor de local, no vocabulário fechado que o banco cobra. A escolha do dono ganha do
  mapa de nomes, que fica só para os lugares cadastrados antes do campo existir. Fecha a
  dívida que tinha acabado de virar sintoma — o Trabalho nascendo `other` e a tela
  mostrando dois traços.
- [x] T4.1c — **As testemunhas do banco na caixa** (02/10): `sleep_periods` audita a
  chegada e atividade com rota audita a saída, numa janela de 45 dias — dúvida velha não é
  acionável. **Falhar nelas não derruba a caixa**: as duas do log local valem sozinhas, e
  uma caixa vazia por falta de rede some com perguntas que o aparelho já sabia fazer.
- [ ] T4.2 — Tela de Presença pelo Mais (não na barra — lugar é dimensão, não módulo).
  Tempo por lugar, chegada e saída do dia, e a linha da lápide quando houver.
- [ ] T4.3 — A borda estimada aparece: "3 h 40 em casa *(1 borda estimada)*".

### F1.6 O bloco da Retrospectiva

> Desenho completo em [docs/specs/presenca/retrospectiva.md](../../../docs/specs/presenca/retrospectiva.md).

- [x] T4.4 — **DECIDIDO em 02/10: bloco próprio + as setas de reordenar VOLTAM.** Não existe
  teto de blocos (conferido no catálogo, no `resolveRetroPrefs`, na migration, no celular e na
  web); o único "12" do sistema são os blocos manipuláveis = 13 menos a manchete, que é
  `fixed`. Devolver a seta ataca o **custo declarado** pela própria 2.5, não a decisão dela.
- [x] T4.4b — **As setas voltaram** (02/10) e o bloco `presence` entrou no catálogo, sem
  `kinds` — vale nas cinco recorrências. `moveBlock` respeita `fixed` (a manchete não sai do
  topo, nem por troca), não embaralha nas bordas e preserva o conjunto. 12 checagens.
- [x] T4.10b — **O bloco na Retrospectiva**: manchete em frase, horas fora no típico, dias
  de escritório, a maior sequência quando houver, e a cobertura escrita. Sem dado o bloco
  **não é publicado** — um jornal deixa de publicar a seção, não publica a seção com erro
  dentro.
- [x] T4.5 — `presence/dias.ts` (manchete, três estados) + `presence/retro.ts` (02/10): as
  cinco métricas de um período, com o recorte entrando pronto de `period/bounds.ts` — duplicar
  a régua do que é "o mês" criaria uma segunda verdade. **Correção de desenho no caminho:**
  o piso de 10 dias gateava tudo e esvaziava a semana — que é a recorrência que ele mais lê.
  Contagem não estima e não tem piso; o piso vale para mediana (5) e taxa (10), na escada que
  o Sono já fixou (`REGULARITY_MIN_NIGHTS` / `BASELINE_MIN_NIGHTS`). Mediana e não média; dia de escritório como denominador do item 4; visita
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
- [x] T8.2 — **Testemunha do sono** (`correcao.ts`, 02/10): noite sem presença em casa no dia
  = dormiu fora **ou** a chegada se perdeu. A testemunha não decide qual — ela levanta.
- [x] T8.3 — **Testemunha da atividade** (02/10): dia "não saiu" com atividade **de rota**
  naquele dia. E ela traz a `sugestao` pronta (`start_at`/`end_at`) — é o que derruba a
  objeção de que ninguém reconstitui horário três semanas depois.
- [x] T8.4 — `aplicarCorrecoes()` (02/10): a correção é **subtração de intervalo**. Visita
  medida cruzada pelo corte é fatiada, aparada ou removida; a em curso continua em curso. A
  invariante das 24 h é cobrada por teste — sem a precedência o dia somava 26 h.
- [ ] T8.5 — O rollup **lê a correção**. É o reescritor aqui, como o sync era no `type_edited`
  — que nasceu porque a correção não durava, desfeita "sem erro, sem aviso, sem marca".
- [~] T8.6 — `contradicoes()` devolve a lista com **chave estável** por dúvida — é ela que faz
  "está certo" durar, senão a mesma pergunta volta toda semana. Falta a tela: elas vivem na
  caixa de correções da Retrospectiva, que já existe (`sleep/retro.ts`).
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
