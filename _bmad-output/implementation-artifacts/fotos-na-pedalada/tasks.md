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

## Fase 5 — Compartilhar

- [ ] **T5.1** `ShareComposerModal` com foto: direção A (foto como chão, rota como selo
      branco, véu de gradiente garantindo legibilidade) e direção B (foto acima, dados
      abaixo em superfície sólida).
- [ ] **T5.2** A capa (`is_cover`) é o que o composer abre por padrão.

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

## Fase 7 — Vídeo

- [ ] **T7.1** `mediaType: ['photo','video']` na varredura, `duration_s` gravado.
- [ ] **T7.2** Marca de duração na tira; miniatura por `expo-video-thumbnails` ou pelo
      thumbnail do asset.

## Fase 8 — Conferência no aparelho

- [ ] **T8.1** Build Release por cabo (nunca Metro pela LAN) e conferência numa pedalada
      real: custo do iCloud, comportamento da permissão, e os 393 px em escala de verdade.
- [ ] **T8.2** Julgamento do dono antes de considerar entregue.

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
