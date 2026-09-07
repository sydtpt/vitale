# Fotos na pedalada — a foto pertence à parada, não ao ponto

> **Status:** construída e **na main** (07/09/2026), conferida no iPhone em ciclos curtos.
> Dez achados que só o aparelho deu estão nas fases 8 e 9 do tasks — nenhum de lógica,
> todos de borda (iOS, GPS, Postgres). A varredura teve a velocidade aprovada por ele.
> Falta o veredito dele sobre os gestos, a "parada não gravada" e o vídeo — cuja
> reprodução acabou de ser construída, e cujo **pôster segue em branco** por uma de duas
> causas que o próximo build separa (T9.5).
> Decisão: [ADR 0037](../../decisions/0037-a-foto-e-ponteiro-com-chave-de-cura.md).
> Data-model: [data-model.md](data-model.md).
> Tarefas: [tasks](../../../_bmad-output/implementation-artifacts/fotos-na-pedalada/tasks.md).
> Mockups aprovados: `claude.ai/code/artifact/8e093ae5-72dc-4a19-b13c-f2c8f330e210`.

## 1. Problema

O dono do app fotografa pedalando — às vezes quase nada, às vezes muito. Hoje essas fotos
vivem na biblioteca do iPhone sem nenhuma relação com a atividade que estava acontecendo.
Abrir uma pedalada de seis meses atrás mostra o traçado e os números, e nada do dia.

O que ele **não** quer: que a foto vire o destaque. A ordem de leitura declarada é
**mapa, números, e só então foto**.

## 2. A pedalada que serviu de régua

Todo o desenho foi feito sobre uma atividade real, e os números desta seção saíram do
banco de produção:

| Medida | Valor |
|---|---|
| Atividade | `A958ACC6-E7E9-4FB3-B733-E49FE5F90156` — "Rotterdam Cycling", 29/08/2026 |
| Janela | 11:08 → 16:50 (5h42 de relógio, 2h40 de movimento) |
| Distância / ganho | 57,05 km · 125 m |
| Cidades | 11, de Rotterdam a Amsterdam |
| Piso | 83% liso, 17% blocos |
| Paradas detectadas | 13:33–13:40 no km 24,6 (7 min) · 14:20–15:08 no km 38,2 (48 min) |
| FC nas paradas | 90 bpm e 109 bpm (`health_series` do dia) |

Foi escolhida por ser o caso difícil: três horas fora de movimento, que é o perfil do dia
que produz fotos.

## 3. Duas premissas do pedido que o banco desmentiu

1. **`points` tem `t` por ponto** — `{t, lat, lng, alt}`, epoch ms, em **275 de 275**
   rotas desde jul/2023. O casamento por tempo é exato; não há regra de três, nem
   necessidade do "Timeshift" que o Garmin BaseCamp precisou inventar.
2. **O perfil de elevação não serve de eixo aqui.** Nesta pedalada a amplitude inteira é
   de **20,4 m em 67 km**, quase toda jitter. O eixo que carrega a foto é o **tempo**.

## 4. O que esta rodada entrega

**Entrega:** a ligação foto ↔ atividade sugerida por janela e confirmada pelo dono; a
posição da foto resolvida no traçado; o agrupamento por parada; e as leituras no detalhe
da atividade, no mapa, no trilho do tempo, no cartão de compartilhar e na Retrospectiva.

**Não entrega, de propósito:** upload de arquivo. A imagem permanece na biblioteca do
iPhone (ADR 0037). A web recebe a versão em dados.

## 5. Comportamento

### 5.1 A janela

`start_at − 30 min` até `end_at + 60 min`. Assimétrica porque os dois lados têm causas
diferentes: antes, a bicicleta encostada esperando a largada; depois, o café já com o
relógio parado. Na pedalada da §2 isso dá **10:38 → 17:50**. A janela usada aparece
escrita na folha de confirmação — o dono nunca precisa adivinhar por que uma foto entrou.

### 5.2 A sugestão, e os três grupos

A varredura devolve a mídia da janela e a classifica pela coordenada da própria foto
(o *Local* está ligado na câmera dele, conferido em 06/09/2026):

| Grupo | Regra | Padrão |
|---|---|---|
| **Na rota** | a menos de **40 m** do traçado | ligado |
| **Antes da largada** | antes de `start_at` | desligado |
| **Depois da chegada** | depois de `end_at`, ou fora do corredor | desligado |

O corredor de 40 m é o que separa "estava lá" de "caiu na janela": a foto de um documento
tirada em casa quase nunca está a 40 m da rota, e cai sozinha no grupo desligado. Para
comparação, o passe de piso usa 25 m contra o OSM e obtém mediana de 1,6 m (ADR 0035).

A confirmação é **por grupo**, não por foto — com 34 fotos, marcar uma a uma é castigo.
Descer ao detalhe para desmarcar uma continua possível.

Foto sem coordenada (Local desligado naquele momento, captura de tela) não some: cai em
"depois da chegada" com posição por tempo e entra na tira cronológica sem pin no mapa.

### 5.3 A parada

> **O traçado tem buracos, e o silêncio não é resposta.** Conferido em 07/09/2026: a
> travessia de 29/08 tem **12 buracos**, um deles de 35 min e 6,3 km entre dois pontos
> consecutivos. `detectStops` mede "ficou parado" contando pontos — onde não há pontos,
> ele não acha nada, e isso estava virando a afirmação de que não houve parada.
>
> `trackGaps` separa os dois casos. Buraco de **pontas próximas** já é parada pelo caminho
> normal. Buraco de **pontas longas** é ignorância: a foto ali não é "em movimento", e sim
> uma parada **provada pelas fotos** — doze fotos em 6,5 min no mesmo lugar são evidência
> melhor que o track ausente. Na tela ela vem com marcador pontilhado e diz que o GPS não
> gravou.

`detectStops(points, { minPausedS: 240, radiusM: 60 })` — uma janela em que o traçado não
saiu de 60 m por 4 minutos ou mais. Duas janelas contíguas separadas por menos de 5 min e
120 m são a mesma parada (na pedalada da §2, o café de 48 min chegava partido em duas).

**Conferido contra falso positivo** em 06/09/2026, em 8 saídas urbanas curtas de Bruxelas,
Amsterdam e Zaventem, incluindo uma meia-maratona de 21,5 km: **zero paradas detectadas**
nos três limiares testados (4 min/60 m, 3 min/40 m, 6 min/60 m). Semáforo dura 1–2 min.

A parada é derivada, nunca gravada (ADR 0037 §4).

### 5.4 Onde a foto aparece

- **No mapa da atividade** — um marcador por parada, neutro, com a contagem dentro; foto
  em movimento vira ponto pequeno. Nunca um enxame de pins.
- **No cartão Fotos**, abaixo dos números, agrupado por parada, com a cidade real
  (`activities.cities`), o km, o tempo parado e a FC daquele minuto (`health_series`) —
  a "legenda do esforço", que nenhum dos cinco concorrentes pesquisados faz.
- **No trilho do tempo**, que substitui o scrub de elevação: laranja é movimento, o vão é
  parada, e o dedo no trilho move o ponto no mapa.
- **Na Retrospectiva**, na versão discreta (§6).
- **No cartão de compartilhar**, em duas direções — foto como chão do cartão, ou foto ao
  lado do traçado. O `localIdentifier` não atrapalha: o composer roda no iPhone.

Zero foto **some por completo** — nenhum "adicione fotos" pedindo atenção. A maioria das
pedaladas vai ser assim.

### 5.5 Desligar

Toque longo na miniatura → "Ver no app Fotos" / "Tornar a capa" / **"Desligar da
pedalada"**. A palavra é deliberada: o app não é dono do arquivo, e o menu diz isso ao
oferecer o app Fotos logo acima. Desligar grava `state='dismissed'`, que sobrevive a novas
varreduras.

## 6. As decisões do dono (06/09/2026)

| Pergunta | Resposta |
|---|---|
| A imagem sobe? | **Não.** Só `localIdentifier`; a web fica sem imagem |
| Automático ou confirmado? | **Sugere e eu confirmo** |
| *Local* ligado na câmera? | **Sim** — o caminho robusto está liberado |
| Papel da foto | os quatro: mapa, jornal, legenda do esforço, cartão |
| Folga na janela | 30 min antes, **1 h depois** |
| Compartilha? | **Posta em rede social** — o composer é frente própria, não sobra |
| Retrospectiva | **versão 2** — tira discreta no fim do bloco |
| Corredor de 40 m | ok |
| Parada a partir de 4 min | ok |
| Corrida | entra junto |
| Vídeo | entra |

**Respondido em 07/09:** a web fica cega **por enquanto** — decisão dele. O
`fetchMediaCounts` já mora no shared e serve quando a hora chegar; a saída para imagem
continua sendo subir só a capa (ADR 0037, alternativas).

### O vínculo automático (decidido em 07/09/2026)

A pergunta "ligar sozinho?" só teve resposta quando houve o que medir. Sobre as **707
decisões que ele já tinha tomado à mão**:

| Grupo | Ligou | Recusou | Aceita |
|---|---|---|---|
| No corredor (até 40 m) | 549 | 69 | **89%** |
| 40 a 250 m | 15 | 7 | 68% |
| Antes da largada | 1 | 1 | 50% (sem sinal) |
| Depois da chegada | 10 | 26 | **28%** |

**Liga sozinho só o corredor.** As três regras que sustentam isso valem mais que o
limiar: nada é recusado pela máquina (o que sobra fica indeciso e volta); nenhuma folha
abre sozinha (o resto vira linha quieta); e a varredura roda uma vez por pedalada,
guardada pelo `photos_checked_at`.

A faixa de 40 a 250 m fica de fora por um motivo que só o dono sabia: **é onde caem as
fotos que ele edita no Lightroom.** A exportação mexe na precisão da coordenada o
bastante para sair do corredor e não o bastante para ir longe — e são justamente as
fotos que ele tratou com carinho. Somam-se às que o GPS não soube colocar, porque o
traçado tem buracos (§5.3). 68% é bom demais para descartar e ruim demais para
automatizar.

## 7. Riscos e limites conhecidos

- **`localIdentifier` não é estável.** Muda em Quick Start, restore de backup e às vezes
  em atualização do iOS. Tratado pela chave de cura (ADR 0037 §2) — sem isso, a primeira
  troca de iPhone mataria todas as ligações em silêncio.
- **iCloud com "Otimizar armazenamento".** Se a foto não está no aparelho,
  `getAssetInfoAsync` a baixa da rede; pode demorar. Precisa de estado de carregamento e
  de comportamento sensato sem rede.
- **Acesso limitado à biblioteca** (o "Selecionar fotos…" do iOS 14+) quebra a consulta
  por janela e faz a feature parecer defeituosa. O app tem de detectar
  `accessPrivileges !== 'all'` e explicar, não falhar calado.
- **Vídeo custa duas dependências, e nenhuma foi de graça.** O `expo-video-thumbnails`
  entrou para o pôster e ainda não entrega — ele roda o `AVAssetImageGenerator` com
  tolerância **zero**, que engasga em HEVC/Dolby Vision, e antes disso confere a leitura
  do caminho contra o contêiner do Fotos. O `expo-video` entrou para tocar o clipe dentro
  do visor. O `generateThumbnailsAsync` dele resolveria o pôster também, mas devolve um
  `SharedRef` que só o `expo-image` desenha — seria uma **terceira** dependência para um
  quadro estático, e por isso não foi.
- **Unidade que atravessa fronteira de biblioteca.** A API nova do `expo-media-library`
  devolve duração em **milissegundos**; a legada devolvia segundos, e a coluna se chama
  `duration_s`. Nada reclamou por dias. Vale para toda leitura nova daquele pacote:
  conferir a unidade contra o dado real antes de gravar.
- **Foto apagada da biblioteca** vira ligação órfã: a tira mostra a lacuna e oferece
  desligar. Nunca some calada.
- **Rajada (burst)** pode gerar assets com instantes muito próximos; a chave única é
  `(user_id, activity_id, taken_at)` em ms. Colisão exata é improvável, mas não impossível.

## 8. Depois desta rodada

1. Construir na ordem das fases do tasks — o núcleo puro primeiro, que é testável sem
   aparelho.
2. A migration é aplicada à mão, com confirmação (política do AGENTS.md), e registrada em
   `supabase_migrations.schema_migrations`.
3. Conferir no iPhone, com uma pedalada de verdade, antes de considerar entregue: é a
   única forma de medir o custo do iCloud e o comportamento da permissão.
4. Candidato natural a seguir: a foto entrando na visão por país e no mapa multi-rota do
   Histórico — o "mapa de fotos da vida inteira" que o Statshunters faz sobre o Strava.
