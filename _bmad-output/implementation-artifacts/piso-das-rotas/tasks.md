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
      `activities.gear_id` (override, nulo). **Não aplicada em prod — pede confirmação.**
- [x] T0.2 Núcleo: `Gear` nos models, `Activity.gearId`, `data/gear.ts`,
      `gear/assign.ts` (herança por dia local, override, sobreposição) + testes.
- [x] T0.3 Mobile: `gear.store.ts`; linha "Bicicleta" no detalhe; seletor de bike
      na página do tipo (filtra lista, recordes, curvas e evolução).
- [ ] T0.4 Cadastro inicial por SQL (duas bikes; antiga até 29/05, Nuroad desde
      30/05). **Pede confirmação e o nome da bike antiga.**
- [ ] T0.5 Web: linha "Bicicleta" no detalhe (recompõe; mesmo núcleo).
- [ ] T0.6 Tela de gerenciar bicicletas (nome, janela) — quando houver a 3ª.
- [ ] T0.7 Ingest: ler `gear_id` de Strava/intervals → `gear.external_ids`.

## Fase 1 — Passe de piso (o único risco real: Overpass público)

- [ ] T1.1 Coluna `activity_routes.surface_segments` (índices do `route_overview`
      + categoria) e percentuais derivados. Migration + CHECK de forma.
- [ ] T1.2 `enrichSurface` ao lado do `enrichCities` em `connections-ingest`:
      1 rota por tick, retry com espera, marca de falha.
- [ ] T1.3 Backfill das 137 à mão (~30 min) + `verify` (cobertura, mediana da
      distância à via, % inferido).
- [ ] T1.4 Golden set: Sydnei marca 10 pedaladas que lembra; conferir.
- [ ] T1.5 Conferir se `activity_routes.points` tem timestamp (velocidade por piso).

## Fase 2 — Visão global no celular (mockup aprovado antes)

- [ ] T2.1 Núcleo: agregação por período/bucket (semana ↔ mês, regra do Sono),
      fronteiras como marcas.
- [ ] T2.2 Página de Ciclismo: cartão Piso (herói + barra + legenda), série com
      as duas marcas, fatos. Chips de bike já vêm da Fase 0.
- [ ] T2.3 Tabela como alternativa ao gráfico (acessibilidade).

## Fase 3 — Por pedalada

- [ ] T3.1 Barra fina de piso no detalhe, embaixo do mapa.
- [ ] T3.2 Toque pinta a rota por segmento (overview 1/40 → blocos de ~200 m no
      track cheio, ou interpolar — decidir).

## Fase 4 — Web recompõe

- [ ] T4.1 Coluna única, mesmo núcleo; nenhuma decisão visual nova.

## Pesquisa

- [ ] Deep recon (competitivo): "que análise de terreno mudou uma decisão de
      alguém" — Komoot, Wandrer, VeloViewer, Strava, Ride with GPS. Régua de
      custo do Quinn: já no banco (tempo parado por cidade, noturno, perfil por
      bike) · um passe externo (piso, tipo de via, limite, iluminação, vento e
      chuva via Open-Meteo) · instrumento novo (potência, pressão).
