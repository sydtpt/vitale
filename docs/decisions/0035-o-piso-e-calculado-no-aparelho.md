# ADR 0035 — O piso das rotas é calculado no aparelho, não no ingest

**Data:** 2026-09-06 · **Status:** aceita ·
**Supersede:** a decisão 1 da [ADR 0043](0043-piso-das-rotas-vem-do-osm-no-ingest.md)
("o piso é calculado no ingest"). O resto da 0043 — as classes, a procedência,
o "não especificado" visível, a forma das colunas — continua valendo inteiro.

> A 0043 apareceu como 0034 e depois como 0035 antes de assentar; o número maior é
> posterior à renumeração de 07/09/2026, não à decisão. Ver a nota no cabeçalho dela.

## Contexto

A ADR 0034 pôs o passe de piso no `connections-ingest`, ao lado do de cidades.
Foi deployado em 06/09/2026 e o smoke test em produção o derrubou no mesmo dia.

Duas rodadas, na mesma rota de 5,4 km, apagada e restaurada pelo backfill
idempotente:

1. **Antes do fail-fast:** a chamada ficou **125 s pendurada**, até o abort do
   próprio código disparar.
2. **Depois** (timeout de 25 s e três espelhos), o motivo veio nomeado em ~2 min:
   `overpass-api.de HTTP 504 · overpass.kumi.systems timeout 25s ·
   overpass.private.coffee timeout 25s`.

A **mesma consulta**, da rede doméstica do usuário, responde em **5,5 s** com 430
vias e 368 KB. O Nominatim — o passe de cidades, pelo mesmo caminho de saída —
funciona. Logo não é bloqueio de egresso: é o Overpass, que distribui slots por
IP. O IP de saída da Supabase é compartilhado e não tem slot; o do celular tem.

A pesquisa competitiva de 05/09 já apontava a dependência do Overpass público
como o único risco real desta fase. O risco se realizou, e agora está medido.

## Decisão

O passe roda **no aparelho**, dentro do `syncDelta`, depois da recuperação de
rotas (ele lê `route_overview`, que só existe depois que a rota subiu).

- `mobile/src/lib/surface-osm.ts` faz o `fetch` — só isso.
- A regra continua inteira no núcleo: `planSurface` (amostra e monta a consulta),
  `parseOverpassWays`, `surfaceFromWays` (classifica e monta a procedência).
  São puros, então o resultado independe de quem buscou as vias.
- Duas pedaladas por sync, falha volta à fila em 6 h com o motivo em
  `surface_meta`. Best-effort: nunca derruba o sync.
- O passe server-side e o `_shared/surface.ts` foram **removidos**. Código que
  falha em silêncio a cada tick é pior que código que não existe.

## Alternativas descartadas

- **Manter na function e conviver com o retry.** Com 504 consistente nos três
  espelhos, provavelmente nunca completaria — e gastaria o relógio da function
  a cada tentativa.
- **Overpass próprio ou extrato Geofabrik no Postgres.** Resolve de verdade e
  custa uma infraestrutura inteira, para 2–3 pedaladas por semana.
- **API paga de geodados.** Mesma desproporção, com fatura.
- **Só backfill manual daqui.** É o que já cobriu as 138 rotas, mas exige um
  humano no circuito para toda pedalada nova.

## Consequências

- O piso de uma pedalada nova aparece **depois do primeiro sync com rede**, e
  não em minutos pelo cron. Para um app pessoal cujo dono sincroniza quase todo
  dia, é uma diferença sem consequência prática.
- Pedaladas que chegam por Strava/intervals (sem passar pelo aparelho) só ganham
  piso quando o app rodar um sync — o passe varre por ausência, não por origem,
  então elas entram na mesma fila.
- O núcleo segue sem imports e pronto para o servidor, se um dia houver um
  caminho de saída com slot.
- Precedente que vale registrar: **API pública de OSM em passe server-side tem
  de ser testada do ambiente de destino**, não da máquina de quem escreve.
