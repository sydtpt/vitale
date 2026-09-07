-- Orbe — Fotos na pedalada: solta a exigência de duração em vídeo.
-- ADR 0037 · spec: docs/specs/fotos-na-pedalada/spec.md
--
-- A constraint `activity_photos_video_dur` exigia `duration_s` sempre que
-- `media_type = 'video'`. Parecia higiene e é armadilha: o
-- `expo-media-library` nem sempre reporta a duração no `exeForMetadata()` — que
-- é justamente a leitura barata, sem resolver o arquivo, escolhida para não
-- travar a tela esperando o iCloud.
--
-- O custo era desproporcional: a gravação da folha vai num `INSERT` único, e
-- **um** vídeo sem duração derrubava o lote inteiro — a seleção toda do usuário
-- se perdia, e a tela não dizia nada. Um vídeo cuja duração não se conhece
-- continua sendo um vídeo; a marca de duração na tira já trata `null`.

alter table public.activity_photos
  drop constraint if exists activity_photos_video_dur;
