# Piso das rotas — tarefas

Origem: pergunta de pneu em 05/09/2026 → cruzamento das 137 rotas com o OSM →
party mode (Mary, John, Sally, Winston, Amelia, Sophia, Maya, Carson, Quinn,
Victor, Caravaggio, Murat). Ordem aprovada pelo Sydnei: mockup → bicicleta →
deep recon → piso.

Mockup da visão global (dado real, seletor funcional):
https://claude.ai/code/artifact/c487cbb0-3205-44d4-9e9a-a795243ef8cd

## Decisões que já valem

- **Global primeiro, por pedalada depois.** "Interessante é a palavra que a gente
  usa para o que não vai abrir" (Maya). O que decide pneu/bike é o agregado.
- **Duas fronteiras marcadas em "tudo":** bicicleta (30/05/2026) e relógio
  (Garmin, 18/07/2026). Tempo parado só é comparável a partir do Garmin — medido:
  mesma Nuroad, Apple Watch 7,5% × Garmin 22%.
- **Cor de piso é ORDINAL:** rampa de um tom só no laranja do módulo, zero hex
  novo (validada nos dois esquemas). Categorias: liso · blocos+pavé · cascalho ·
  terra. Separar blocos de pavé daria cinco cores — não.
- **Piso vem do OSM** via Overpass: 1 amostra a cada ~400 m do `route_overview`,
  via mais próxima em 25 m, ciclovia a ≤ 12 m vence rua. 14,5% dos pontos sem
  `surface` são inferidos pelo tipo de via. Golden set de 10 pedaladas (Murat)
  antes de qualquer número virar tela.
- **Só a bicicleta é entidade agora** (ADR 0033). Pneu em março/2027.

## Fase 0 — Bicicleta como entidade (sem risco externo)

- [x] T0.1 Migration `20260906120000_gear_bicicleta.sql`: tabela `gear` + RLS +
      `activities.gear_id` (override, nulo). **Aplicada em prod em 06/09** com "pode"
      explícito (registrada como `gear_bicicleta`).
- [x] T0.2 Núcleo: `Gear` nos models, `Activity.gearId`, `data/gear.ts`,
      `gear/assign.ts` (herança por dia local, override, sobreposição) + testes.
- [x] T0.3 Mobile: `gear.store.ts`; linha "Bicicleta" no detalhe; seletor de bike
      na página do tipo (filtra lista, recordes, curvas e evolução).
- [x] T0.4 Cadastro em prod (06/09): **Riverside** 01/01/2025→29/05/2026 (126 pedaladas,
      4.051 km) e **Cube Nuroad SLX** 30/05/2026→ (22, 1.321 km). Falta conferir o
      seletor no iPhone (build Release).
- [ ] T0.5 Web: linha "Bicicleta" no detalhe (recompõe; mesmo núcleo).
- [ ] T0.6 Tela de gerenciar bicicletas (nome, janela) — quando houver a 3ª.
- [ ] T0.7 Ingest: ler `gear_id` de Strava/intervals → `gear.external_ids`.

## Fase 1 — Passe de piso (o único risco real: Overpass público)

- [x] T1.1 Migration `20260906130000_piso_das_rotas.sql`: `activity_routes.surface_segments`
      ([[startM,endM,cat,inferido]] em metros ao longo do overview) + `surface_meta`
      (procedência: fonte, data, espaçamento, raio, mediana da distância à via, erro) +
      `activities.surface_mix` (metros por classe, desnormalizado). **Aplicada em prod
      em 06/09** com "pode seguir" (registrada como `piso_das_rotas`). ADR 0034.
- [x] T1.2 `surface/classify.ts` no núcleo (sem imports; tabela OSM→classe, ciclovia ≤ 12 m
      vence rua, reta > 500 m = buraco, segmentos e soma) + 30 asserts;
      `_shared/surface.ts` na function (1 chamada Overpass por rota pela polilinha das
      amostras, 1 rota por run, falha → `surface_meta.status=failed` e retry em 24 h),
      chamada no `runIngest` e no `mode: reconcile`. **Deploy feito em 06/09**
      (`supabase functions deploy connections-ingest` a partir do worktree; o bundle
      subiu `packages/shared/src/surface/classify.ts` junto). Sem `deno` local, a
      function não foi type-checkada aqui — o primeiro run real é o teste (T1.3b).
- [x] T1.3 Backfill das 137 rotas em prod (06/09): 274 updates numa transação, a partir
      do cruzamento de 05/09. Verificado: 137/137 com piso, 5.032 km, liso 78,9% ·
      blocos+pavé 8,5% · cascalho 8,6% · terra 3,9% · desconhecido 0,1% · inferido 14,6%;
      mediana média da distância à via 1,8 m.
- [ ] T1.3b Smoke test do passe deployado: uma rota curta (Amsterdam, 31/08, 5,4 km) teve
      o piso apagado para o cron recalcular via Overpass; comparar com o backfill.
- [ ] T1.4 Golden set: Sydnei marca 10 pedaladas que lembra; conferir.
- [ ] T1.5 Conferir se `activity_routes.points` tem timestamp (velocidade por piso).

## Fase 2 — Visão global no celular (mockup aprovado antes)

- [x] T2.1a Núcleo: `surface/aggregate.ts` (janela 4 sem / 12 sem / ano / tudo,
      soma sob a lente de bike, legenda com blocos+pavé fundidos e "não
      especificado" só quando existe) + `surface/colors.ts` (rampa ordinal do
      acento do módulo, zero hex) + 20 asserts.
- [ ] T2.1b Série por mês/semana com as duas fronteiras (bike 30/05, Garmin 18/07)
      — segunda passada; o modelo `chart/stacked-bars` do núcleo serve.
- [x] T2.2 Página de Ciclismo: seletor de período + `SurfaceCard` (herói + barra
      + legenda + rodapé com cobertura e % inferido). Aprovado pelo Sydnei em
      06/09 sobre o mockup; visível só quando há pedalada com piso.
- [ ] T2.3 Tabela como alternativa ao gráfico (acessibilidade).

## Fase 3 — Por pedalada

- [x] T3.1 O MESMO cartão no detalhe da pedalada (pedido do Sydnei em 06/09: "inclua"),
      logo depois do percurso; some enquanto o passe não calculou.
- [ ] T3.2 Toque pinta a rota por segmento (overview 1/40 → blocos de ~200 m no
      track cheio, ou interpolar — decidir).

## Fase 4 — Web recompõe

- [ ] T4.1 Coluna única, mesmo núcleo; nenhuma decisão visual nova.

## Pesquisa

- [x] Deep recon (competitivo) feita em 05/09/2026:
      `_bmad-output/planning-artifacts/research/competitive-terreno-e-contexto-de-rota-no-ciclismo-2026-09-05/research.md`
      (8 verified · 4 unverified · 1 disputed · 1 overturned; Reddit inacessível).

**O que a pesquisa mudou neste plano (R1–R7 do relatório):**

- R1 → T1.1 ganha duas regras: `surface_segments` guarda **fonte e data do
  extrato OSM** por trecho, e "não especificado/inferido" é **classe própria**
  em toda soma e toda tela (nunca redistribuída — o bug da Strava que soma 61%).
- R2 → a visão global por bicicleta (Fase 2) é a superfície de decisão; o Garmin
  mostra piso por pedalada mas ninguém agrega por período/bike/pneu.
- R3 → **T3.3 nova**: "km por piso por equipamento", quando o pneu virar filho de
  `gear` (março/2027). Sem concorrente documentado.
- R4 → **vento por trecho NÃO se constrói**: o intervals.icu (que o Sydnei usa)
  está entregando; reavaliar em março/2027. Vai para o backlog de features.
- R5 → semáforo e noturno viram **fatos da retrospectiva**, não features: tempo
  parado por cidade só da era Garmin (18/07/2026+); "km após o pôr do sol" pela
  efeméride do núcleo. Zero demanda medida.
- R6 → método da Fase 1 fica como está (25 m, ciclovia ≤ 12 m) **+ guarda de reta
  > 500 m** (VeloViewer) + golden set (T1.4). Não perseguir a tolerância do
  Wandrer (não publicada; ele desistiu do algoritmo e fez editor manual).
- R7 → exploração ("km em vias nunca pedaladas", modelo Wandrer de fração de via)
  entra no backlog como candidata forte depois do piso.

**Perguntas abertas que dois minutos num navegador logado resolvem:** a Strava
mostra percentuais na atividade ou só na rota? O RwGPS cumpriu o "(MORE SOON)"
de 2021? Quais Edge (e o Venu 4?) trazem a quebra por pedalada?
