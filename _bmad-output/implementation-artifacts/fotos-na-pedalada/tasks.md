# Tasks: Fotos na pedalada — `activity_photos`

Spec: [docs/specs/fotos-na-pedalada/spec.md](../../../docs/specs/fotos-na-pedalada/spec.md) ·
data-model: [data-model.md](../../../docs/specs/fotos-na-pedalada/data-model.md) ·
ADR: [0037](../../../docs/decisions/0037-a-foto-e-ponteiro-com-chave-de-cura.md)

Mockups aprovados em 06/09/2026: `claude.ai/code/artifact/8e093ae5-72dc-4a19-b13c-f2c8f330e210`.

**Fases 0–6 feitas em 06/09/2026.** Branch `feat/fotos-na-pedalada`, no worktree
`/Users/sydtpt/Projects/life-organizer-wt-fotos`, **sem push**. Falta a Fase 7 (vídeo) e,
sobretudo, a **Fase 8 — conferência no aparelho**, que nada aqui substitui.

> A branch nasceu com `git checkout -b` na árvore principal, e isso moveu a árvore
> compartilhada por baixo de uma sessão concorrente, que commitou docs desta frente junto
> com os dela (`92502a4`). Desfeito sem reescrever histórico. O caminho certo é
> `git worktree add <path> -b <branch>`.

## Fase 0 — Pesquisa e proposta (feita em 06/09/2026)

- [x] **T0.1** Pesquisa competitiva com fonte: Strava (foto no mapa é web-only, para
      assinante, e criticada pela precisão; ordem aleatória é bug assumido no help),
      Komoot (Trail View separado da foto pessoal; Highlight é linha, não pin),
      Ride with GPS (sugere pela janela e solta no mapa — o mais próximo do desejado),
      Relive (agrupa de propósito: exato "parava o vídeo a cada 2–3 segundos"),
      Apple Journal (`JournalingSuggestions` agrupa treino + fotos, on-device, com
      consentimento por asset), Garmin (Connect não põe no mapa; BaseCamp casa por
      timestamp e precisou do "Timeshift"), Polarsteps (contraponto: foto é manual).
- [x] **T0.2** Conferência do terreno em produção, que desmentiu duas premissas do pedido:
      `points` tem `t` em **275/275** rotas desde jul/2023; o perfil de elevação da
      pedalada-régua tem **20,4 m em 67 km** e não serve de eixo.
- [x] **T0.3** Calibração de `detectStops` contra falso positivo: 8 saídas urbanas curtas
      (Bruxelas, Amsterdam, Zaventem, meia-maratona de 21,5 km) → **zero** paradas em
      4 min/60 m, 3 min/40 m e 6 min/60 m.
- [x] **T0.4** Descoberta do risco do `localIdentifier` (Apple: válido só no dispositivo
      local; relatos de mudança em Quick Start / restore / update do iOS) e desenho da
      chave de cura.
- [x] **T0.5** Proposta com mockups em escala de iPhone (393 px), Orbe claro e escuro,
      sobre a pedalada real `A958ACC6…` — detalhe, folha de confirmação, trilho do tempo,
      três versões da Retrospectiva, extremos (0 e 34 fotos), menu de desligar, e duas
      direções de cartão. Aprovada com 11 respostas (spec §6).

## Fase 1 — Núcleo puro (`packages/shared/src/photos/`) — feita em 06/09/2026

Testável sem aparelho e sem banco. **Fazer inteira antes de qualquer tela.**

- [x] **T1.1** `window.ts` — `photoWindow(startAtMs, endAtMs, { beforeMin: 30, afterMin: 60 })`.
      Recebe epoch ms em vez do `Activity` para o módulo não depender de modelo.
- [x] **T1.2** `stops.ts` — `detectStops`, com a fusão de janelas contíguas
      (< 5 min e < 120 m) e `cumulativeDistances` exportado.
- [x] **T1.3** `match.ts` — `matchToRoute`: **projeção no segmento** (não vértice mais
      próximo — meio segmento de erro seria visível com 25 m entre pontos) quando há
      coordenada; busca binária em `t` quando não há. Mais `classifyCandidate`.
- [x] **T1.4** `group.ts` — `groupByStop(photos, stops)` → `{ stops[], moving[] }`.
      Agrupa **por tempo**, não por coordenada: senão a foto da ida se juntaria à parada
      da volta no mesmo lugar.
- [x] **T1.5** Modelo `ActivityPhoto` em `packages/shared/src/models/index.ts`, e o
      comentário de `ActivityRoutePoint.t` corrigido com a medição das 275 rotas.
- [x] **T1.6** `photos.test.ts` — 16 checks, incluindo a **regressão urbana** (semáforos
      de 90 s não viram parada) e o corredor de 40 m como fronteira dura.
- [x] **T1.7** Exportado no `index.ts`; barreiras de arquitetura passam.
- [x] **T1.8** **Achado durante a construção:** o track cru superestima a distância —
      67,3 km somando ponto a ponto contra os 57,05 km de `activities.distance_m`, 18% de
      jitter. Sem tratar, o cartão diria "km 45,1" numa pedalada cujo cabeçalho diz 57,05.
      `detectStops` e `matchToRoute` ganharam `totalDistanceM`, que reescala para a
      distância oficial; `distanceScale` é exportado. Com ele, o núcleo reproduz
      exatamente os números do mockup: **km 24,6 e km 38,2**.
- [x] **T1.9** Conferência contra a pedalada real `A958ACC6…` (2 620 pontos de produção):
      janela 10:38→17:50, duas paradas em 13:33–13:40 e 14:20–15:08, foto casada a 7,4 m
      do traçado. Validação nos três workspaces: shared `tsc` + todas as suítes, web
      `build`, mobile `tsc --noEmit`.

## Fase 2 — Banco (feita em 06/09/2026, com autorização do usuário)

- [x] **T2.1** Migration `20260906150000_activity_photos.sql`: tabela, 7 checks, três
      índices (chave de cura, caminho quente parcial, capa única parcial), RLS, trigger
      `touch_updated_at` e `activities.photos_checked_at`.
- [x] **T2.2** Aplicada em produção pela Management API e registrada em
      `schema_migrations` (`20260906150000 · activity_photos`). Conferido no banco:
      17 colunas, RLS ligado com 1 policy, 4 índices (pk + 3), 7 checks, 1 trigger, e
      `activities.photos_checked_at` presente.
- [x] **T2.3** Leitura `packages/shared/src/data/activity-photos.ts` — colunas explícitas,
      paginada. `fetchActivityPhotos` traz `dismissed` por padrão, porque a varredura
      precisa saber o que não sugerir; `fetchPhotosForActivities` traz só `linked`, para a
      retro e o mapa de período. A **escrita** também mora aqui (AD-4).
- [x] **T2.4** Smoke test das constraints contra produção, com a atividade real
      `A958ACC6…`, e limpeza depois (0 linhas ao fim). Os cinco casos que **têm** de
      falhar falharam: `on_route` sem posição, `lat` sem `lng`, mesmo instante na mesma
      atividade, segunda capa, vídeo sem duração. RLS conferido pelos dois lados — o dono
      vê 1, outro usuário vê 0 — e o trigger tocou `updated_at`.

## Fase 3 — Mobile: varredura, cura e confirmação (feita em 06/09/2026)

- [x] **T3.1** Permissão com `PhotoAccess` de três estados. `limited` **não** é sucesso:
      a folha explica que o "Selecionar fotos" do iOS quebra a busca por janela, em vez
      de mostrar "nenhuma foto" numa pedalada cheia delas.
- [x] **T3.2** `services/activity-photos.ts`. **A API do briefing não existe mais como
      padrão:** no `expo-media-library` 57 o `getAssetsAsync`/`getAssetInfoAsync` viraram
      `legacy` e o import padrão é um builder de `Query`. Fui para a nova, e ela resolve
      um risco em vez de contorná-lo — `exeForMetadata()` lê data e tipo **sem resolver
      arquivo nem decodificar imagem** (a antiga passava por `getAssetInfoAsync`, que
      baixa do iCloud por padrão), e `getIsInCloud()` torna o risco nº 2 do spec um dado.
- [x] **T3.3** A cura do ponteiro, com a parte pura (`planHealing`) separada da escrita.
- [x] **T3.4** `PhotoSuggestSheet`: **quatro** grupos, não três — foto tirada no meio da
      pedalada a 500 m do traçado não é "depois da chegada", e o mockup já dizia "fora da
      rota" na legenda. Confirmação **por grupo**; só "Na rota" ligada. Os quatro estados
      que o mockup não mostrava (varrendo, negado, limitado, zero) estão todos na folha.
- [x] **T3.5** 9 testes em `lib/__tests__/activity-photos.test.ts`.
- [x] **T3.6** Plugin `expo-media-library` registrado no `app.base.json` com
      `NSPhotoLibraryUsageDescription`. Estava na dependência mas **fora dos plugins**:
      do jeito que estava, o iOS nunca pediria a permissão. **Exige prebuild + pod
      install** — o `ios/` da árvore principal foi gerado antes disto. expo-doctor 21/21.
- [x] **T3.7** Lógica pura em `lib/`, I/O em `services/` — o padrão do `activity-todo-link`.
      Não é cerimônia: `Query` e `Asset` são classes nativas que nem importam fora do
      aparelho, e sem a separação não haveria como testar classificação nenhuma.

## Fase 4 — Mobile: as telas (feita em 06/09/2026)

- [x] **T4.1** Cartão Fotos abaixo dos números, agrupado por parada, com a cidade real, o
      km e o tempo parado. Some por completo sem foto; a pedalada nunca procurada ganha
      uma linha fina de convite, que é o caminho de volta de quem tocou "Agora não".
- [x] **T4.2** Marcadores nos **dois** renderizadores (Leaflet e MapLibre). As cores vêm
      do chamador: a rota e as cidades já gastam o papel `orange`, e receber `ink`/`fill`
      por parâmetro é o que faz o marcador inverter no escuro sem literal no `map-html.ts`.
      O círculo fica na coordenada **da parada**, não da primeira foto — senão ele dança
      conforme quais fotos entram.
- [x] **T4.3** `TimeRailCard` + `fitness/time-rail.ts`. Mora em `fitness/` porque descreve
      a **atividade** no relógio; as fotos só foram o motivo de precisarem dele. Emite
      **distância em metros**, não tempo, para entrar na máquina de scrub que já existia.
- [x] **T4.4** Toque longo → Ver no app Fotos / Tornar a capa / **Desligar da pedalada**.
- [x] **T4.5** Foto órfã mostra **lacuna tracejada**. A cura reendereça ponteiro trocado,
      não ressuscita arquivo apagado; sumir calado faria a contagem do cabeçalho mentir.
- [x] **T4.6** `useActivityPhotos`: mapa e cartão leem do **mesmo** carregamento. Dois
      carregamentos dariam contagens diferentes na mesma tela por alguns milissegundos.

### Achado da Fase 4 (registrado porque muda decisão futura)

Duas barreiras de arquitetura pegaram **defeito real**, não estilo:

- **AD-4** — as 7 queries diretas do serviço mobile foram para `packages/shared/src/data`.
  A de `photos_checked_at` foi para `data/activities.ts`: a regra é sobre a **tabela**,
  não sobre a feature.
- **Teto de hex literais** (catraca em 200, exata) — o `#FFFFFF` do botão cheio viraria
  branco sobre branco na marca **Tinta** no escuro, que é justamente o que
  `colors.onPrimary` existe para evitar. O branco legítimo (ícone sobre véu escuro em
  cima da foto) virou o token `onMedia`, declarado uma vez no tema.

## Fase 5 — Compartilhar (feita em 06–07/09/2026)

- [x] **T5.1** `ShareComposerModal` com foto: direção A (foto como chão, rota como selo
      branco, véu de gradiente garantindo legibilidade) e direção B (foto acima, dados
      abaixo em superfície sólida).
- [x] **T5.2** A capa (`is_cover`) é o que o composer abre por padrão.
      [ShareComposerModal.tsx:308](../../../mobile/src/components/share/ShareComposerModal.tsx#L308):
      `photoId` explícito → capa → primeira. A cadeia de fallback importa: sem a última perna,
      pedalada com foto mas sem capa abriria o composer vazio.

## Fase 6 — Corrida, Retrospectiva e web (feita em 06/09/2026)

- [x] **T6.1** Corrida entra sem código próprio: a tela de detalhe é
      `historico/[label]/[id]`, genérica por tipo, e o núcleo só olha `points` e
      instantes. Nenhum `if` por modalidade foi preciso.
- [x] **T6.2** Retrospectiva **versão 2**: `photos/retro.ts` (`photoRetro`,
      `photoRetroLabel`) mais a tira no fim de *Ciclismo & corrida* no iPhone. A amostra é
      **espalhada**, não os cinco primeiros — cinco fotos seguidas costumam ser a mesma
      parada, e a tira mostraria o mesmo café cinco vezes.
- [x] **T6.3** Web: a mesma seção existe, e mostra o **fato** em vez da imagem
      ("N fotos em M atividades" + "As imagens ficam na biblioteca do aparelho"). É a
      degradação honesta que fez a versão 2 ser a escolhida: no navegador vira uma linha
      de texto, não uma moldura vazia.
- [x] **T6.4** Validação: shared 28 suítes (23 no núcleo de fotos), web build + 141 testes,
      mobile `tsc` + 49 suítes.

## Fase 7 — Vídeo (feita em 06/09/2026)

- [x] **T7.1** Vídeo já entrava na varredura desde a Fase 3 (`MediaType.VIDEO`), com
      `duration_s` gravado e a constraint `activity_photos_video_dur` cobrando que exista.
- [x] **T7.2** Marca de duração no cartão e na folha, com `formatClip` em
      `lib/workout-format.ts` — distinta de `formatDuration`, que fala em horas porque
      descreve treino; um vídeo de pedalada tem segundos, e "0 min" não diz nada.
      A duração fica na base do quadro, onde não briga com a estrela de capa (topo).
- [x] **T7.3** **`expo-video-thumbnails` NÃO foi adicionado, de propósito.** Seria mais um
      plugin nativo e mais um prebuild para resolver um problema ainda não confirmado: no
      iOS o `Image` com `ph://` costuma renderizar o quadro-pôster do vídeo. A Fase 8
      responde isso de graça, e se falhar o `Thumb` já mostra a lacuna em vez de quebrar.
      **Decidir só com o aparelho na mão.**

## Fase 8 — Conferência no aparelho (06–07/09/2026)

- [x] **T8.1** Builds Release por cabo, em ciclos curtos, com o dono usando entre um e
      outro. **Sete achados que os 673 testes não pegaram** — nenhum deles é bug de
      lógica; são premissas erradas sobre como o iOS, o GPS e o Postgres se comportam:

      | # | O que se viu na tela | A causa | O conserto |
      |---|---|---|---|
      | 1 | Fotos achadas, todos os quadros vazios | `ph://<localIdentifier>` montado à mão não é carregado pelo `Image` do RN 0.86 | `Asset.getUri()`, que devolve `file://` real, com cache por id |
      | 2 | "km 45,1" numa pedalada de 57,05 km | somar o track ponto a ponto superestima (67,3 km) | `totalDistanceM` reescala para a distância oficial |
      | 3 | Pedalada sem foto ficava muda para sempre | `if (checked) return sheet` — levei "zero foto some por completo" longe demais | convite fica, mais quieto; e "Procurar mais" na galeria |
      | 4 | "Ligar N fotos" não fazia nada | duas mídias no mesmo instante derrubam o `INSERT` inteiro; e um vídeo sem duração violava a constraint | dedupe por instante + constraint removida + **erro visível** |
      | 5 | Vídeos como quadro vazio | `getUri()` de vídeo devolve o arquivo de vídeo | `expo-video-thumbnails` (a dependência que a Fase 7 deixou para o aparelho decidir) |
      | 6 | Arrastar para baixo não fazia nada | o `ScrollView` do iOS resolve o arrasto no nível **nativo**; o `PanResponder` nunca vê o gesto, em fase nenhuma | `react-native-gesture-handler` (ADR 0010 proíbe o Reanimated, não ele) |
      | 7 | "Em movimento · sem parada" com 12 fotos de uma parada óbvia | o traçado tem **12 buracos**; um vai de 12:54 a 13:29, 6,3 km — `detectStops` conta pontos, e onde não há pontos ele não acha nada | `trackGaps` + grupo `silent`: a parada provada pelas **fotos**, não medida pelo track |

- [x] **T8.2** Confirmado por ele na tela: miniaturas aparecem, ligar funciona, o convite
      voltou, e a galeria abre com as seções por parada.
- [x] **T8.4** Velocidade da varredura **aprovada por ele** em 07/09. Não foi
      cronometrada, e não vai ser: 73 fotos numa pedalada e 60 noutra passaram sem que
      ele notasse. Medir agora seria medir para confirmar o que o uso já respondeu.
- [ ] **T8.3** Veredito parcial em 07/09: **"o thumbnail do vídeo e a execução não
      funcionam"**. O resto (arrastar para baixo, deslizar da esquerda, seleção múltipla,
      "parada não gravada") segue sem julgamento.

## Fase 9 — Vídeo, de verdade (07/09/2026)

Um relato só — "o thumbnail do vídeo e a execução não funcionam" — abriu **três**
defeitos, e um deles ele não tinha como ver.

| # | O defeito | A causa | O conserto |
|---|---|---|---|
| 8 | O clipe não toca | **não havia player instalado** — nem `expo-video`, nem `expo-av`. O visor desenhava um `<Image>`, que não desenha vídeo. Nunca foi construído; eu fechei a Fase 7 sem dizer isso com todas as letras | `expo-video`: `useVideoPlayer` + `VideoView` com controles nativos, dentro do visor |
| 9 | Crachá de duração absurdo (`1137:15` num clipe de 68 s) | a API **nova** do `expo-media-library` mapeia `Int(duration * 1000)` — **milissegundos**; a legada devolvia segundos. O valor cru ia para uma coluna chamada `duration_s` e nada reclamava: `numeric` aceita, a constraint só exige `> 0`, e o número errado *parece* um número | `meta.duration / 1000` na origem + migration `20260907080000` nos 37 vídeos em produção |
| 10 | Pôster do vídeo em branco | **ainda em aberto.** Duas causas possíveis, com consertos opostos: o sandbox recusando o caminho do contêiner do Fotos, ou o `AVAssetImageGenerator`, que o `expo-video-thumbnails` roda com tolerância **zero** e por isso engasga em HEVC/Dolby Vision | o `catch {}` virou `console.warn` com a exceção; e o visor toca pelo **mesmo endereço**, o que separa as duas hipóteses sozinho |

- [x] **T9.1** `expo-video` instalado e registrado em `app.base.json`, com
      `supportsBackgroundPlayback` e `supportsPictureInPicture` **desligados**: som em
      segundo plano e PiP pedem entitlement e modo de fundo que este app não tem motivo
      para carregar.
- [x] **T9.2** O player só existe na **página ativa**. O `ScrollView` monta todas de uma
      vez, e a Tour de la Wallonie Picarde (21/07) tem 14 vídeos: 14 `AVPlayer`
      simultâneos passam do que o iOS decodifica e garantiriam dois clipes falando junto.
- [x] **T9.3** Não toca sozinho, de propósito — chega-se ao visor varrendo a grade, e um
      vídeo que começa a falar no meio da curadoria é pior do que um toque a mais.
- [x] **T9.4** A grade para de mentir: a lacuna pontilhada com "?" afirma "esta mídia
      sumiu da biblioteca", e isso só se sabe da **foto**. Vídeo sem pôster vira quadro de
      filme com o play — verdade em qualquer das duas hipóteses do achado 10.
- [ ] **T9.5** **Falta o aparelho.** Se o clipe toca e só o pôster falha, o arquivo é
      legível e a culpa é da extração de quadro exato — o conserto então é trocar o
      gerador de pôster. Se **nem toca**, é o caminho, e aí a saída é a URI `ph://`, que
      o `expo-video` aceita e que não passa pelo sistema de arquivos.
- [ ] **T9.6** Conferir também os gestos **sobre o vídeo**: a barra de tempo dos controles
      nativos é horizontal, e o carrossel de páginas também. O `UIScrollView` não cancela
      toque em `UIControl`, então a barra deve ganhar — mas isso é teoria até alguém
      arrastar.

## Fase 10 — O vínculo automático e o selo no Histórico (07/09/2026)

Duas decisões dele, ambas tomadas contra dados e não contra intuição. As 707
decisões que ele já tinha tomado à mão viraram a base de medida:

| Grupo | Ligou | Recusou | Aceita |
|---|---|---|---|
| No corredor (até 40 m) | 549 | 69 | **89%** |
| 40 a 250 m | 15 | 7 | 68% |
| Antes da largada | 1 | 1 | 50% (sem sinal) |
| Depois da chegada | 10 | 26 | **28%** |

- [x] **T10.1** **Liga sozinho só o corredor.** Ligar o "depois" erraria em quase
      3 de 4 — é a janela de uma hora onde moram a foto em casa e a do café. A
      faixa de 40 a 250 m fica de fora por outro motivo: 68% é bom demais para
      descartar e ruim demais para automatizar. É onde caem as fotos que ele
      **edita no Lightroom** (a exportação mexe na precisão da coordenada o
      bastante para sair do corredor) e as que o GPS não soube colocar, porque o
      traçado tem buracos.
- [x] **T10.2** **Nada é recusado pela máquina.** O que não entra fica indeciso e
      volta na próxima varredura. Gravar `dismissed` é dizer "esta não", e só o
      dono pode dizer isso.
- [x] **T10.3** **Nenhuma folha abre sozinha.** O que sobrou vira uma linha quieta
      — sem moldura, sem preenchimento: lembrete, não tarefa. Um modal saltando a
      cada pedalada antiga aberta só para ver o mapa seria pior que o problema.
- [x] **T10.4** **Uma vez por pedalada**, guardada pelo `photos_checked_at`. E
      falhar deixa a pedalada sem a marca, então ela tenta de novo — por isso o
      erro **não** vira alerta, ao contrário do erro de gravação da folha.
- [x] **T10.5** **O selo de mídia no cartão do Histórico** — proposta B de um
      estudo de quatro (`claude.ai/code/artifact/b4065110-2a43-464f-bcb8-2fe744dd16b7`).
      Vai no **cabeçalho**, ao lado de `editado`, e não na régua de números: a
      régua é a linguagem do esforço, e ele disse desde o começo que foto não é
      destaque. Foto e vídeo no mesmo selo — há uma pedalada com 31 fotos e 35
      vídeos —, e o conjunto some inteiro quando não há mídia, porque em 9 de
      cada 10 cartões não há e um vão reservado desalinharia a lista.
- [x] **T10.6** A contagem vem **agrupada do banco** (`activity_media_counts()`,
      migration `20260907120000`). Contar no cliente transportaria as 700+ fotos
      para desenhar um número de dois dígitos; filtrar por `in (<ids>)` estoura a
      URL, porque o Histórico de Ciclismo tem 338 atividades de id textual.
      `security invoker` com `user_id = auth.uid()` explícito: função que só se
      protege pela RLS vira vazamento silencioso no dia em que alguém mexer na
      política.
- [ ] **T10.7** **Falta o aparelho.** Conferir que abrir uma pedalada antiga
      liga as fotos sozinha e não trava a tela; que a linha de pendência aparece
      e some depois de julgada; e que o selo cabe ao lado de `editado` sem
      espremer a data.
- [ ] **T10.8** A **web** ficou de fora por decisão dele (07/09). O
      `fetchMediaCounts` já é do shared e serve quando a hora chegar.
- [x] **T10.9** **Dois defeitos meus, achados por ele no aparelho.** O primeiro é o
      mesmo erro que esta feature já documentava: a tela passava `routePoints ?? []`
      e a rota carrega assíncrona, então o vínculo rodava com traçado vazio,
      classificava tudo como "fora da rota" e ainda gravava `photos_checked_at` —
      a pedalada ficava marcada como varrida sem nunca ter sido.
      **`?? []` num dado assíncrono apaga a diferença entre "ainda não sei" e "não
      tem"**, que é a armadilha da §5.3 vista do outro lado. A prop passou a aceitar
      `undefined`. O segundo: a contagem do selo era lida só na montagem, e a lista
      fica viva atrás do detalhe — virou `useFocusEffect`. Quatro pedaladas marcadas
      à toa pelo build quebrado foram destravadas em produção.
- [x] **T10.10** **O lote** — "Procurar em todas as pedaladas", em Configurações →
      Dados. Mais recentes primeiro (parar na metade deixa a metade que importa);
      uma rota por vez e descartada (são 31 MB nas 222 pendentes com rota);
      **sem `route_overview`**, cujos segmentos de ~445 m fariam a foto de qualquer
      curva cair fora do corredor de 40 m; retomável sem estado próprio, pelo
      `photos_checked_at`; e as 280 sem rota contadas como puladas, porque um total
      de "222" com 502 pendentes pareceria errado. O relatório final diz **o que o
      lote não fez** — quantas ficaram fora do corredor e em quantas pedaladas.
- [x] **T10.11** **O gancho no sync FOI feito** (commit `f91f6db`, 07/09) — este item
      ficou desatualizado no mesmo dia em que foi escrito.
      [activity-sync.ts:520](../../../mobile/src/services/activity-sync.ts#L520) chama
      `linkNewActivityPhotos` com o traçado que o `syncDelta` já tem em memória, zero
      download extra. Converte `latitude/longitude/timestamp` do HealthKit para o
      `lat/lng/t` do núcleo. Guarda de âncora igual à das tarefas — sem ela o primeiro
      sync varreria a biblioteca contra três anos. O erro é **engolido** com `console.warn`,
      de propósito: em segundo plano o iOS pode barrar a leitura da biblioteca, e aí a
      pedalada fica sem marca e tenta de novo com o app na frente.

## Fase 11 — A foto sai para fora (07/09/2026)

Quatro estudos de UX num dia, e o achado que ordenou tudo veio do primeiro: **o
compositor era o único lugar do app que descartava a tese da feature.** O app
sabe a cidade, o quilômetro e a hora de cada foto — e o único lugar que sai para
fora jogava os três fora.

- [x] **T11.1 · Enquadramento.** Pinça e arrasto sobre a foto do cartão. Nasceram
      cinco proporções (preencher, 1:1, 4:5, 9:16, 16:9) e sobrou **uma**: ele
      julgou no aparelho e ficou com Preencher. O motivo é geométrico e fica
      escrito para não voltarem — um bloco 9:16 num cartão 9:16 só é "tela cheia"
      sem margem, e aí é o Preencher; os demais só encolhiam a foto para mostrar
      papel. O que importava era **qual parte da foto**, e isso é a pinça.
- [x] **T11.2 · A parada no cartão** (proposta A do estudo). "Ittre · km 31,1 ·
      12:38" acima do título, opcional. Nenhum dado novo — `activities.cities` e a
      mesma conta de cidade-mais-próxima do cartão de fotos.
- [x] **T11.3 · Ações no visor.** Compartilhar, usar como capa, desligar. As duas
      últimas já existiam num toque longo que o visor não alcançava: para desligar
      uma foto que se está **olhando** era preciso fechar o visor e caçar a
      miniatura. E o compositor abre com aquela foto, montado **dentro** da
      galeria — o iOS não apresenta três `Modal` empilhados.
- [x] **T11.4 · O pino de foto no mapa.** O círculo não dizia "foto" (é a forma do
      ponto) e ainda **cobria a rota** no lugar da parada. O pino de cabeça
      quadrada resolve os dois, e o desenho passou a existir uma vez só, injetado
      nos dois renderizadores.
- [x] **T11.5 · A capa acorda.** Havia **1 capa marcada em 94 pedaladas** — um
      ciclo fechado. Invertido: o app escolhe (a foto do meio da maior rajada) e a
      estrela vira **correção**. A tira da Retrospectiva passa a mostrar dias, não
      fotos: medido em julho de 2026, a regra antiga dava duas das cinco vagas a
      dias de 8 e 9 fotos, uma a um treino de academia, e deixava a travessia até
      Tournai (59 fotos) de fora.
- [x] **T11.6 · A sequência** (proposta D). Seis Stories em ordem, um por parada.
      Barata porque a T11.2 já existia: é o mesmo cartão com fotos diferentes.
- [x] **T11.7 · O álbum do período.** A tira levava direto à pedalada, e ele recusou
      o caminho: *"estou na retrospectiva, gostaria de poder ver TODAS as fotos, e
      com ela maximizada, poderia ter um botão de ir para a pedalada"*. A tira
      abre a **mesma galeria** da pedalada, com todas as fotos do período,
      agrupadas **por pedalada** (um dia pode ter dois treinos, e é a pedalada que
      a ação seguinte promete abrir). No visor, uma ação só — as outras três são
      decisões que se toma dentro do dia, não folheando o mês.
- [x] **T11.8 · O "+N" saía do cartão.** Não era enquadramento: eram cinco quadros
      **mais** o contador, 378 pt numa faixa de 329. Agora são cinco lugares e o
      contador ocupa um deles, com a contagem corrigida para o que aparece.
- [x] **T11.9 · O gancho no sync** (o que a Fase 10 deixou em T10.11). A pedalada
      nova chega com o corredor ligado, sem abrir o detalhe. **Zero download**: o
      `syncDelta` já carrega o traçado em memória para calcular tempo em
      movimento. Guardado pela mesma âncora do vínculo de tarefas — sem ela, o
      primeiro sync varreria a biblioteca contra três anos de histórico. E o erro
      é **engolido**: o sync roda em segundo plano, onde o iOS restringe a leitura
      da biblioteca; falhando ali a pedalada fica sem a marca e tenta de novo com
      o app na frente. Não há nada que o dono possa fazer com esse aviso.
- [x] **T11.10** Conferidos por ele: o lote de varredura (rodado) e o enquadramento
      no PNG exportado.
- [ ] **T11.11 · Falta só o veredito da sequência** — a mais arriscada de tudo,
      porque monta seis WebViews em série e resolve seis fotos antes.

### A lição da fase

**19 correções para 15 funcionalidades.** Mais da metade dos commits do dia
consertou trabalho do próprio dia — a assinatura de um ciclo curto, que foi a
escolha dele.

Mas os defeitos tinham um padrão, e ele não é aleatório: **três vezes quebrei
algo que funcionava, ao construir outra coisa.** O `?? []` que apagou a
diferença entre "a rota não chegou" e "não há rota". A camada que envolvi no
Preencher para dar simetria a um modo que não precisava dela. O teto que a
regra "uma foto por pedalada" virou sem querer, encolhendo a tira.

Nos três, os 688 testes passaram. Eles testam a função nova; ninguém testa a
consequência dela no que já existia.

E dois defeitos foram de **ligação, não de lógica**: o `healPointers` escrito na
Fase 2 e nunca chamado por ninguém — a defesa central da feature desarmada desde
o primeiro dia —, e o `showRoute` fora da lista de dependências. Escrever a
função é a parte que o teste cobre. Ligá-la é a parte que ninguém cobre.

**Uma nota sobre diagnóstico.** Duas vezes gastei ciclos consertando o sintoma
errado: o xadrez de transparência estava numa linha que eu nunca tinha lido, e
eu mexia no código que acabara de escrever. E abandonei um diagnóstico **certo**
(três modais empilhados) porque a explicação alternativa era mais confortável de
consertar. Quando o conserto óbvio não conserta, parar de mexer no próprio
código e ir ler o que já estava lá.

### A lição das fases 8 e 9

O núcleo puro fez o que devia: quando as fotos finalmente renderizaram, **os números
estavam certos** — as paradas, os quilômetros, a janela. Nada disso precisou de conserto.
O que quebrou foi a **borda**, onde o app encosta no iOS, no GPS e no banco — e ali
nenhum teste ajuda, porque nenhum deles toca uma tela de verdade.

Erros de processo meus, registrados para não repetir:

- **`comando | tail` devolve o status do `tail`.** Mascarou um build quebrado e um merge
  que não aconteceu — duas vezes buildei a versão errada. O cabeçalho do próprio
  `ios-device.sh` documenta essa armadilha.
- **`catch {}` com comentário otimista.** O "nada se perde" era falso e transformou um
  erro diagnosticável numa hora de investigação às cegas. Repeti o mesmo padrão no
  `resolvePosterUri`, e ele custou a Fase 9 inteira: o pôster falhava sem dizer de quê.
- **"Não construído" saiu do relatório como se fosse "construído".** A reprodução do
  vídeo nunca existiu, e a Fase 7 fechou sem registrar isso. Um relatório que só conta o
  que foi feito faz o buraco parecer defeito — e ele descobriu tocando na tela.

E uma unidade que ninguém confere: **`duration_s` recebeu milissegundos por dias.** Não
havia como o teste pegar (o valor é plausível), nem a constraint (`> 0` aceita), nem a
revisão (a variável se chama `duration`). Só a tela mostrou — e mostrou disfarçado de
outra coisa. Quando um número atravessa uma fronteira de biblioteca, a unidade é a
primeira coisa a conferir contra o dado real, não a última.

## Diferido

- **Subir a capa para o Storage** (~55 MB para as 275 rotas) se a Retrospectiva na web
  incomodar. Uma coluna `storage_path` e um job; o modelo já está preparado.
- **Foto na visão por país e no mapa multi-rota** do Histórico — o "mapa de fotos da vida
  inteira" que o Statshunters faz sobre o Strava.
- **`PHCloudIdentifier`** como ponteiro estável: exigiria módulo nativo próprio, já que o
  `expo-media-library` não o expõe. A chave de cura resolve sem isso.
- **Revisar o limiar de parada** com mais dados urbanos. Não há parada gravada, então
  mudar o limiar não pede migration.

## Aberto

- **"A web fica cega mesmo?"** — a única pergunta da proposta que ficou sem resposta em
  06/09/2026. Segue valendo a escolha original (sem imagem na web).
