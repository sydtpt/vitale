# ADR 0037 — A foto da atividade é um ponteiro descartável com chave de cura

**Data:** 2026-09-06 · **Status:** aceita

> **Numeração:** 0036 já estava tomado pela saúde do sono, que em 06/09/2026 vivia
> solta na árvore de trabalho (`packages/shared/src/sleep/score.ts` e a tela
> `mobile/src/app/sono/saude.tsx`, sem commit). Vale a regra da casa: quem mescla por
> último renumera. Esta é a 0037 desde o nascimento.

## Contexto

Em 06/09/2026 o dono do app quis ligar as fotos que tira pedalando à atividade
correspondente. O terreno estava quase todo conferido no pedido — `expo-media-library`
instalado, `getAssetsAsync` filtrando por janela, `activities` com `start_at`/`end_at` —
com duas premissas que o banco de produção desmentiu:

1. **`activity_routes.points` tem timestamp por ponto.** O pedido dizia
   `[{lat, lng, alt?}]`, sem tempo, e concluía que posicionar a foto por tempo exigiria
   uma regra de três sobre o índice, frágil sob pausa. Cada ponto é de fato
   `{t, lat, lng, alt}`, com `t` em epoch ms, em **275 de 275 rotas**, desde julho de
   2023. O casamento por tempo é exato.
2. **A biblioteca de fotos não devolve identificador estável.** A documentação da Apple
   diz que o `localIdentifier` "é válido para se referir a objetos apenas no contexto de
   um dispositivo local", e os relatos no fórum de desenvolvedores descrevem o
   identificador mudando ao migrar por Quick Start, ao restaurar de backup e após
   atualização do iOS. A recomendação oficial é o `PHCloudIdentifier`, que o
   `expo-media-library` não expõe.

A pesquisa competitiva do mesmo dia (Strava, Komoot, Ride with GPS, Relive, Journal da
Apple, Garmin, Polarsteps) mostrou que o Ride with GPS é o único que sugere fotos pela
janela da pedalada e as solta no mapa onde foram tiradas; que o Relive descobriu que
posição exata produz leitura ruim e passou a **agrupar**; e que a foto no mapa da Strava
é web-only, para assinante, e criticada pelos próprios membros pela precisão do local.

A decisão do dono, tomada sobre essa pesquisa: a imagem **não sobe** para o Supabase
Storage; a ligação é sugerida e confirmada por ele; a janela tem folga de 30 min antes e
1 h depois; e a foto ocupa quatro papéis — mapa, jornal, legenda do esforço e cartão de
compartilhar — sem nunca virar o destaque da tela.

## Decisão

1. **A imagem fica no aparelho. O fato sobe.** `activity_photos` guarda o instante, a
   coordenada e a posição resolvida no traçado; nenhum arquivo vai para o Storage. A web
   nunca mostra imagem — mostra **onde e quando**, e degrada para texto honesto
   ("11 fotos, em 3 lugares"), nunca para tela vazia.
2. **`asset_id` é um ponteiro descartável; a chave real é `(user_id, activity_id,
   taken_at)`.** Quando o ponteiro não resolve — troca de aparelho, restore, atualização
   do iOS — o app varre a janela outra vez e re-casa pelo instante, que é exato dos dois
   lados porque vem do mesmo relógio. A ligação se cura sozinha; o `asset_id` é
   reescrito. Nenhuma tela precisa saber que isso aconteceu.
3. **A unidade de leitura é a parada, não o ponto.** `detectStops` (4 min dentro de 60 m)
   agrupa as fotos; o mapa desenha um marcador por parada com a contagem, e a foto em
   movimento vira ponto pequeno. É a lição do Relive, e resolve os dois extremos com um
   desenho só: 34 fotos viram 4 linhas, 2 fotos continuam 2 pontos.
4. **A parada não é persistida.** É derivada de `points`, determinística e barata
   (2 620 pontos rodam instantâneo). Persistir seria cache com risco de divergir do
   traçado quando a rota for reprocessada.
5. **`state='dismissed'` em vez de apagar a linha.** Foto que o dono desligou precisa
   continuar desligada quando a varredura rodar de novo — senão ela volta a cada
   abertura da atividade.
6. **A foto não recebe cor de paleta.** A rota e as cidades já usam o papel `orange`; o
   marcador de foto é neutro (superfície com contorno de tinta, invertendo no escuro).
   Vale a ADR 0018 e a regra de que marca não é cor de dado.

## Alternativas descartadas

- **Subir tudo para o Supabase Storage.** Daria web completa e backup. Custa upload em
  background, fila, retry, política de retenção e expurgo, e o volume real é de GBs
  (HEIC de 2–4 MB). O dono escolheu explicitamente o caminho sem upload.
- **Subir só a capa** (~200 kB × 275 atividades ≈ 55 MB). Continua sendo a saída se a
  Retrospectiva na web incomodar: basta uma coluna `storage_path` e um job. O modelo já
  está preparado; nada aqui é irreversível.
- **Casar a foto pela fração de tempo** (índice proporcional em `points`). Era o plano
  quando se acreditava não haver `t` por ponto. Quebraria justamente nesta pedalada, com
  48 minutos parados no km 38,2.
- **Depender só do `localIdentifier`.** É o caminho óbvio e falha em silêncio na primeira
  troca de iPhone — a pior falha possível para um app de memória.
- **Pendurar a foto no scrub do perfil de elevação.** Era a intenção inicial, e não
  sobrevive ao dado: a travessia Rotterdam–Amsterdam tem 20,4 m de amplitude em 67 km de
  traçado, quase toda jitter de GPS. O eixo que sempre significa algo é o tempo — e é
  nele que a parada existe.

## Consequências

- A web ganha pin, hora, km e contagem sem nunca ganhar imagem. Toda tela que mostrar
  foto precisa ter uma leitura equivalente em texto, ou não entra na web.
- A cura pelo instante só funciona enquanto a foto existir na biblioteca. Foto apagada é
  ligação órfã: a tira mostra a lacuna e oferece desligar, em vez de sumir calada.
- `detectStops` foi conferido contra 8 saídas urbanas curtas (Bruxelas, Amsterdam,
  Zaventem, uma meia-maratona) e não produziu nenhum falso positivo — semáforo dura 1–2
  min, não 4. O limiar pode ser revisto sem migration: não há parada gravada.
