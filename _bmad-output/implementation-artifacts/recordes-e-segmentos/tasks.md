# Recordes e segmentos — plano de implementação

> Saído da sessão de party-mode de 27/08/2026. O que orienta tudo abaixo são
> quatro frases do Sydnei, e vale relê-las antes de qualquer decisão:
>
> 1. *"Tenho o objetivo de diminuir por km."*
> 2. *"Quando corro 20 km, quero saber se dentro disso fiz os 5 km mais rápidos dos meus treinos."*
> 3. *"No topo, apenas as melhores importa; no detalhe da atividade pode mostrar se foi a 1, 2 ou 3."*
> 4. *"A aplicação deve ser mobile first. Se não tem no mobile, eu não vejo."*

## A lei que não é tarefa

**Ritmo se compara na mesma distância.** Ritmo médio de corrida mede *que tipo
de treino você fez*, não forma física: um 20 km leve tem ritmo pior que um 5 km
forte, sempre, e um mês de treino longo apareceria como regressão. Toda tela
abaixo que fala de "estou melhorando" compara distância com distância.

Isso não vira fase. Vira critério de revisão: se alguma tela plotar ritmo médio
ao longo do tempo, ela está errada.

## Três descobertas que encurtam o trabalho

**O melhor 5 km dentro do seu 20 km já está gravado.** `bestEfforts` não é o
recorde histórico — é calculado **por treino**, no sync, com janela deslizante
sobre o track (`bestEffortsFor(w, routes)` em `services/activity-sync.ts:379`).
A linha da sua corrida de 20 km carrega o melhor 1 km, 5 km e 10 km que
aconteceram dentro dela. **Nenhuma tela de detalhe lê isso** — nem web nem
mobile. Os únicos consumidores são o `running-highlights` (que tira o mínimo
entre todas as corridas) e a Retrospectiva.

**A medalha custa um `sort`.** Toda corrida com GPS tem o próprio `bestEfforts`;
ranquear por distância e devolver 1º/2º/3º não precisa de migration, de sync,
nem de coluna nova.

**A carga por zona da semana existe — só na web.**
`web/.../workout-history/data/weekly-load.ts` agrega 8 semanas de `hr_zones`,
calcula polarização (leve × forte) e um alerta quando a semana passa de 1,5× do
seu baseline. Está testada e renderizada num card. O mobile não tem nada disso, e
o mobile é onde você olha depois de correr.

## Colisão — leia antes de começar

Há **outra sessão trabalhando na mesma view** (a régua que liga gráfico e mapa:
`route-cursor.ts`, `RouteProfileCard`, `metric-roles.ts`). Em 27/08 ela tinha 20
arquivos não commitados, incluindo os dois detalhes de atividade.

| Arquivo | Outra tab | Este plano |
|---|---|---|
| `running-highlights.ts` (web + mobile) | — | **Fase 0** |
| `weekly-load.ts` | — | **Paralelo** |
| `activity-type-page.component.html` | — | Fases 2 e 3 |
| `[id].tsx` · `activity-detail-page.component.*` | commitado em `1f9c3c6` | **Fase 1 — livre** |
| `type-summary.ts` (web + mobile) | **em uso** | não tocar |

**A Fase 1 é a que o Sydnei mais quer e é a única bloqueada.** Por isso a ordem
abaixo não começa por ela: a Fase 0 e o trabalho em paralelo não encostam em
nada que a outra tab tem aberto, e quando ela commitar, a Fase 1 já terá a
fundação pronta e vira uma tela.

---

## Fase 0 — O ranking sai da duplicata

> **Feita** em 01/09/2026 — `546e952` na branch `feat/recordes-e-segmentos`.
> 12 testes no núcleo; web e mobile passaram a ler a tabela de distâncias de lá.

Nada de UI. É a fase invisível, e é a que impede a medalha de significar coisas
diferentes em duas telas.

`running-highlights.ts` está **duplicado** entre web e mobile e mora na lista
`DEFERRED` do `architecture.test.ts`, com razão escrita: `ActivityHighlight`
carrega `value` e `caption` já formatados, então cálculo e apresentação estão
entrelaçados. **Não é hora de desfazer isso inteiro.** O que sobe é só o que as
três fases seguintes precisam, que é puro:

Novo `packages/shared/src/fitness/best-efforts.ts`:

- `rankBestEfforts(activities, activityId, distanceKey)` — todas as corridas que
  têm aquela distância, do menor tempo para o maior, com id e data. Exclui
  `hidden`.
- `bestEffortRank(activities, activity, distanceKey)` — `1 | 2 | 3 | null`.
  Devolve `null` quando a distância tem menos de três participantes, e é isso
  que faz "prata numa disputa de dois" não existir.
- `segmentsInside(activity)` — as distâncias padrão que couberam **dentro**
  daquela atividade, com tempo e ritmo. É a entrada da Fase 1.

Testes no núcleo: empate no tempo, distância com uma/duas/três corridas,
atividade sem `bestEfforts` (sem GPS ou linha antiga), oculta fora do
ranqueamento, e a mesma corrida sendo ouro em duas distâncias.

> **Não mover ainda:** `activityHighlights` e `activityRecordBadges` continuam
> onde estão, consumindo o núcleo. Desentrelaçar `value`/`caption` é outro
> trabalho e não bloqueia nada aqui.

---

## Fase 1 — Segmentos com medalha, no detalhe · **mobile primeiro**

> **Feita** em 01/09/2026 — `SegmentsCard` no mobile e seção `.segments` na
> web, os dois por `segmentsInside`. (Tinha sido bloqueada pela outra tab nos
> detalhes; destravou com `1f9c3c6`.) **Não conferida no aparelho ainda.**
>
> Sobra visual a decidir olhando: o ouro do painel repete o troféu de recorde
> que já aparece no herói (`activityRecordBadges`). Dois selos para o mesmo
> fato — ou o troféu passa a cobrir só distância/elevação, ou fica assim.

Painel novo no detalhe da atividade, abaixo do percurso:

```
DENTRO DESTA CORRIDA
 1 km     4:02   4:02 /km    2º melhor
 5 km    21:48   4:22 /km    🥇 melhor de sempre
10 km    45:31   4:33 /km
20 km  1:34:12   4:42 /km
```

Três coisas de uma vez, nenhuma com dado novo:

- **O que aconteceu dentro do longo** — a pergunta 2 do Sydnei, respondida.
- **A medalha no lugar que ele escolheu** — no detalhe, não no topo da lista.
- **O número mesmo sem medalha**, que é o caso normal e hoje é tela vazia.

Regras: some inteiro quando não há `bestEfforts` (corrida sem GPS, linha antiga).
Só mostra distâncias que **couberam** na atividade. Mobile primeiro; a web recebe
o mesmo painel depois, pelo mesmo builder.

**Decidido (01/09):** segmentos em **corrida e ciclismo, cada um consigo
mesmo**. O ranking filtra por esporte — um 5 km de bicicleta nunca disputa com um
5 km de corrida. Já está assim no núcleo (`rankBestEfforts` recebe o `sportId`).

---

## Fase 2 — A tendência do seu melhor por distância

A tela que responde *"estou diminuindo?"* — o objetivo declarado.

Um ponto por mês: **o melhor 5 km daquele mês**. Linha de referência no recorde
de sempre. Seletor de distância (1 km · 5 · 10 · 21), porque a resposta é
diferente em cada uma — e é justamente por isso que ritmo médio não serve.

Nunca dois eixos. Se um dia entrar FC junto, vira segundo painel empilhado
compartilhando o eixo x, como o perfil de elevação da semana passada.

Onde: página do tipo, abaixo dos recordes. Mobile e web.

---

## Fase 3 — A curva de recordes · por último e sozinha

Escolha do Sydnei para a forma grande da página do tipo, deixada para o fim **de
propósito**: é a única forma nova da lista, e é a que mais tem a perder se for
construída sobre fundação instável. Mesma disciplina que funcionou com o
`StackedBarChart` nesta mesma semana.

Distância no eixo x (log), ritmo no y. Uma leitura responde o que oito cards não
respondem: se você é forte no curto e cai no longo, ou o contrário.

**Ressalva honesta, do Winston:** os pontos vêm de dias diferentes — o 1 km pode
ser de um tiro em março e o 21 km de uma prova em setembro. A curva desenha um
perfil como se fosse de um esforço só. É o que Strava e intervals.icu fazem e
corredores leem sem problema, mas o rótulo tem que dizer que é um **envelope de
melhores marcas**, não um teste.

**Corrida e ciclismo não convergem.** Corrida é tempo sobre distância; ciclismo,
sem potenciômetro, é subida e duração. A tentativa de simetria foi o que produziu
"Elevação 12 meses" dentro do grupo `record` sendo uma soma. Duas tiras
assumidamente diferentes, mesmo componente por baixo.

---

## Em paralelo — Carga por zona da semana, no celular

Independente de tudo acima; pode entrar a qualquer momento e é o único item que
paga a regra que o Sydnei declarou hoje.

1. `buildWeeklyLoad` e o tipo `WeeklyLoad` sobem de
   `web/.../workout-history/data/weekly-load.ts` para
   `packages/shared/src/fitness/weekly-load.ts`, com os testes junto. O card da
   web vira adaptador e não muda um pixel — mesmo padrão do `buildOverview`.
2. Card novo no mobile: barras empilhadas por zona nas últimas 8 semanas, faixa
   de polarização e o aviso de carga forte. O `StackedBarChart` do mobile já
   aceita `metric="duration"`, que é o que a web usa.
3. Onde: aba Histórico, perto do card de consistência. Os dois respondem
   "como foi a minha semana" em eixos diferentes — volume e intensidade.

---

## Fora de escopo, e por quê

- **FC média e máxima por atividade.** O sync lê as amostras de batimento e as
  descarta depois de agregar as zonas — dá para persistir com duas colunas e um
  re-sync. **O Sydnei não quer:** o que importa nos treinos dele é tempo em zona,
  e isso já está gravado e exibido.
- **Série de FC ao longo do percurso.** Exigiria tabela nova no molde de
  `activity_routes`. Mesma razão: não é o que ele pediu.
- **Cobertura dos outros oito tipos.** Ele corre e pedala. Highlights para yoga,
  musculação e companhia seriam trabalho para um usuário que não existe.
- **Desentrelaçar `ActivityHighlight`** (`value`/`caption` formatados). Continua
  na lista `DEFERRED` do `architecture.test.ts`, com a razão de sempre.

## Verificação

```bash
pnpm --filter @vitale/shared lint
pnpm --filter @vitale/shared test      # inclui as catracas de hex e de acento
pnpm --filter @vitale/web build
pnpm --filter @vitale/web test
cd mobile && pnpm exec tsc --noEmit && pnpm exec jest
```

**No aparelho** — que é onde vale, pela regra dele:

1. Abrir uma corrida longa: o painel de segmentos mostra as distâncias que
   couberam, e só elas.
2. Abrir uma corrida curta sem GPS: o painel não aparece (não aparece vazio).
3. Uma distância corrida duas vezes: existe ouro, não existe prata.
4. O ouro do painel de segmentos tem que ser o mesmo número do card de recorde na
   página do tipo. Discordarem é o pior tipo de bug: dois números certos sobre a
   mesma coisa.
5. Carga por zona: a semana no celular tem que bater com a mesma semana na web.
