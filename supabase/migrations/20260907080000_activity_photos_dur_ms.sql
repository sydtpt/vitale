-- Orbe — Fotos na pedalada: a duração do vídeo estava em milissegundos.
-- ADR 0037 · spec: docs/specs/fotos-na-pedalada/spec.md
--
-- A API **nova** do `expo-media-library` mapeia a duração como
-- `Int(duration * 1000)`; a legada devolvia segundos. O app gravava o valor cru
-- numa coluna chamada `duration_s`, e nada reclamou: `numeric` aceita, a
-- constraint só exige `> 0`, e o número errado *parece* um número.
--
-- O erro só aparece na tela, e disfarçado de outra coisa: o crachá de um clipe
-- de 68 segundos escrevia `1137:15`. Conferido em 07/09/2026 contra os 37
-- vídeos gravados até aqui — todos entre 98 e 68 235, isto é, entre 0,1 s e
-- 68,2 s. Nenhum deles é plausível como segundos: seriam de 1,6 a 19 horas de
-- clipe tirado do selim.
--
-- O corte por `created_at` é o que torna esta migration repetível. O conserto
-- da origem (`meta.duration / 1000`) entra no mesmo build; linha gravada depois
-- desse instante já vem em segundos, e dividir de novo a arruinaria. Não existe
-- guarda melhor pelo próprio valor: 90 é uma duração legítima em segundos e em
-- milissegundos, e nenhum limiar separa as duas leituras sem chutar.

update public.activity_photos
   set duration_s = duration_s / 1000,
       updated_at = now()
 where media_type = 'video'
   and duration_s is not null
   and created_at < timestamptz '2026-09-07 08:00:00+00';
