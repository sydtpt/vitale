# Tasks: Fotos na pedalada — `activity_photos`

Spec: [docs/specs/fotos-na-pedalada/spec.md](../../../docs/specs/fotos-na-pedalada/spec.md) ·
data-model: [data-model.md](../../../docs/specs/fotos-na-pedalada/data-model.md) ·
ADR: [0037](../../../docs/decisions/0037-a-foto-e-ponteiro-com-chave-de-cura.md)

Mockups aprovados em 06/09/2026: `claude.ai/code/artifact/8e093ae5-72dc-4a19-b13c-f2c8f330e210`.

**Ainda não começou.** Branch a criar: `feat/fotos-na-pedalada`, da `main`, em worktree
(regra da casa: validar do commit num worktree limpo antes da main).

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

## Fase 1 — Núcleo puro (`packages/shared/src/photos/`)

Testável sem aparelho e sem banco. **Fazer inteira antes de qualquer tela.**

- [ ] **T1.1** `window.ts` — `photoWindow(activity, { beforeMin: 30, afterMin: 60 })`.
- [ ] **T1.2** `stops.ts` — `detectStops(points, { minPausedS: 240, radiusM: 60 })`, com a
      fusão de janelas contíguas (< 5 min e < 120 m). Devolve
      `{ startIdx, endIdx, startT, endT, durationS, lat, lng, distanceM }`.
- [ ] **T1.3** `match.ts` — `matchToRoute(coord | null, takenAt, points, { corridorM: 40 })`:
      vizinho mais próximo na polilinha quando há coordenada; **busca binária em `t`**
      quando não há. Devolve `{ routeIndex, routeDistanceM, offsetM, onRoute }`.
- [ ] **T1.4** `group.ts` — `groupByStop(photos, stops)` → `{ stops[], moving[] }`.
- [ ] **T1.5** Modelo `ActivityPhoto` em `packages/shared/src/models/index.ts`.
- [ ] **T1.6** Testes: janela assimétrica; parada partida que funde; parada que **não**
      existe (as 8 urbanas da T0.3 como caso de regressão); foto sem coordenada caindo no
      caminho do tempo; foto a 41 m ficando fora do corredor; ida e volta do índice.
- [ ] **T1.7** Exportar no `index.ts` e registrar a barreira em `architecture.test.ts`.

## Fase 2 — Banco

- [ ] **T2.1** Migration `20260906150000_activity_photos.sql` (data-model §1): tabela,
      constraints, três índices, RLS, trigger, e `activities.photos_checked_at`.
- [ ] **T2.2** Aplicar em produção **à mão, com confirmação** (política do AGENTS.md) e
      registrar em `supabase_migrations.schema_migrations`. Rodar `check-schema-drift.sh`.
- [ ] **T2.3** Leitura `packages/shared/src/data/activity-photos.ts` — colunas explícitas,
      paginada (o teto de 1000 linhas do PostgREST vale aqui como em tudo).

## Fase 3 — Mobile: varredura, cura e confirmação

- [ ] **T3.1** Permissão: exigir `accessPrivileges === 'all'`; detectar o acesso limitado
      do iOS 14+ e **explicar** em vez de falhar calado (spec §7).
- [ ] **T3.2** `services/activity-photos.ts` — `getAssetsAsync` na janela,
      `getAssetInfoAsync` para coordenada e `localUri`, classificação nos três grupos,
      persistência, e `photos_checked_at`.
- [ ] **T3.3** **A cura do ponteiro:** `asset_id` que não resolve → varre a janela e
      re-casa por `taken_at`; reescreve o ponteiro. Sem tela, sem aviso.
- [ ] **T3.4** Folha de confirmação (`PhotoSuggestSheet`): três grupos com toggle, os dois
      de fora desligados, a janela escrita no cabeçalho, "Ligar N fotos" / "Agora não".
- [ ] **T3.5** Teste do mobile: asset do `expo-media-library` → linha; foto `dismissed`
      não volta na segunda varredura; ponteiro morto cura pelo instante.

## Fase 4 — Mobile: as telas

- [ ] **T4.1** Cartão Fotos no detalhe, **abaixo dos números**, agrupado por parada, com
      cidade (`activities.cities`), km, tempo parado e FC do minuto (`health_series`).
      Some por completo quando não há foto.
- [ ] **T4.2** Marcadores no `lib/map-html.ts`: círculo neutro com contagem por parada,
      ponto pequeno para foto em movimento. Inverte no escuro; **sem cor de paleta**.
- [ ] **T4.3** Trilho do tempo com scrub (substitui o perfil de elevação nesta tela):
      trecho laranja = movimento, vão = parada, dedo move o ponto no mapa.
- [ ] **T4.4** Toque longo → "Ver no app Fotos" / "Tornar a capa" / "Desligar da pedalada".
- [ ] **T4.5** Estado de carregamento para foto em iCloud não baixada, e a lacuna honesta
      para foto apagada da biblioteca.

## Fase 5 — Compartilhar

- [ ] **T5.1** `ShareComposerModal` com foto: direção A (foto como chão, rota como selo
      branco, véu de gradiente garantindo legibilidade) e direção B (foto acima, dados
      abaixo em superfície sólida).
- [ ] **T5.2** A capa (`is_cover`) é o que o composer abre por padrão.

## Fase 6 — Corrida, Retrospectiva e web

- [ ] **T6.1** Corrida usa o mesmo caminho — o desenho não muda.
- [ ] **T6.2** Retrospectiva **versão 2**: tira discreta no fim do bloco, subordinada ao
      texto, que some sem deixar buraco.
- [ ] **T6.3** Web: pin no mapa, marca no trilho e contagem por período. Sem imagem, com
      leitura em texto ("11 fotos, em 3 lugares").

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
