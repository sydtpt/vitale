# 0002 — Minutos de esforço ancorados no vigoroso

**Status:** aceita
**Data:** 2026-08-04 · revisada desde a formulação moderada original

## Contexto

Tempo bruto não compara: 60 min de yoga não valem 60 min de corrida. A OMS enuncia a diretriz de duas formas equivalentes — 150–300 min/semana de atividade moderada **ou** 75–150 de vigorosa, na razão 1 vigoroso = 2 moderados.

A primeira versão do modelo ancorou no moderado. O gráfico de Duração precisa desenhar a linha de esforço dentro da barra de tempo, e com a âncora moderada o esforço podia **passar** da duração — a linha subia acima da barra que a sustenta.

## Decisão

Âncora no vigoroso: **1 min vigoroso = 1 min de esforço**, moderado vale meio. Faixa de referência `WHO_RANGE_MIN = 75` / `WHO_RANGE_MAX = 150`.

Isso garante a invariante `effectiveSeconds(a) <= a.durationS`, de que o gráfico depende.

O peso vem de duas fontes combinadas proporcionalmente em `effectiveSeconds`, sem limiar de corte: zonas de FC (`HR_ZONE_WEIGHTS`) para o tempo coberto, tabela de MET por tipo (`ACTIVITY_MET` + `metToWeight`) para o resto. O resultado passa por um **piso** dado pela própria tabela de MET — as zonas só podem somar, nunca derrubar o treino abaixo do que seu tipo vale por padrão.

Tudo em `packages/shared/src/health/who-activity.ts`.

## Alternativas rejeitadas

**Âncora no moderado (150–300).** Formulação equivalente da mesma diretriz, mas quebra a invariante do gráfico. Foi o modelo original e está superada.

**Peso de z1 acima de zero.** Avaliado subir para 0.2: um pedal ia de 19 para 58 min equivalentes, ainda 4× abaixo do honesto, e passava a pagar tempo parado além de diluir a unidade na corrida. Com o piso, o peso de z1 é irrelevante para ciclismo fácil — o piso domina.

**Piso sobre a duração cheia.** O piso usa tempo ativo, não duração: multiplicar a duração num pedal urbano transforma semáforo em crédito de saúde.

## Consequências

Sem o piso, gravar FC podia valer **menos** que não gravar — um pedal longo quase todo em z1 rendia menos que o mesmo pedal sem relógio. As zonas premiam o que foi forte; o piso protege o que foi longo.

Um número só não responde "atingi o mínimo de saúde?" e "quão duro treinei?" ao mesmo tempo. Para a segunda pergunta existe a Carga Semanal (`weekly-load.ts`), sobre zonas brutas.
