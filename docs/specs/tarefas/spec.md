# Tarefas (to-do com agendamento)

> Módulo de tarefas que se faz e marca como concluídas, com recorrência variada e
> regras de carry-over/cancelamento. **Separado de Habitos** (que é acumulação
> quantitativa diária, sem datas nem conclusão binária).

## Objetivo

Mobile para captura/checagem rápida; web para visão e gestão. Cobre tarefas
recorrentes por data, por intervalo após concluir, avulsas, e gatilhos não-temporais.

## Conceito central — Série × Ocorrência

- **`TodoTemplate`** = a regra ("lavar banheiro a cada 15 dias após concluir").
- **`TodoOccurrence`** = o item concreto na lista, com `dueDate` e `status`.
- Resolver uma ocorrência (feita/pulada/cancelada/expirada) **gera a próxima** conforme a recorrência.

## Eixos de comportamento

| Eixo | Opções |
|------|--------|
| Gatilho (recorrência) | `none` · `monthly` · `weekly` (inclui a **diária**) · `yearly` · `after_completion` · `usage` · `event` · `stock` · `on_workout` |
| Encadeamento (`onComplete`) | lista de séries-filhas instanciadas ao concluir esta tarefa |
| Se não fizer no dia (`overdue`) | `carry` (mantém atrasada) · `expire` (some) |
| Cancelamento (`cancelPolicy`) | `none` (obrigatória) · `manual` · `auto` (após o dia) |
| Janela de horário (`startTime`/`endTime`) | opcionais `'HH:MM'`, só p/ recorrências com data |
| A partir de (`startDate`) | opcional `'YYYY-MM-DD'`: série oculta até o dia (Agora = sem data) |
| Âncora da próxima | calendário (`monthly`/`weekly`/`yearly`) · conclusão (`after_completion`) |

Os 5 exemplos do usuário:
- **Pagar aluguel** → `monthly{day:1}`, `carry`, `none`.
- **Descer o lixo** → `weekly{weekdays:[3,0]}`, `expire`, `auto`.
- **Lavar banheiro/lençol** → `after_completion{15}`, `carry`, `manual`.
- **Ligar para alguém** → `none` (sem prazo), `carry`, `manual`.

## Requisitos funcionais

1. Criar/editar/arquivar séries (mobile: `tarefas/editor`; web: modal).
2. Listar ocorrências pendentes em **Atrasadas / A fazer / Em breve**, com o dia
   virando às 02h (a madrugada ainda fecha o dia anterior).
3. Concluir, pular e cancelar ocorrências; gerar a próxima automaticamente.
4. Reconciliação no `load`: expira vencidas (`expire`), gera próximas de calendário, mantém vencidas (`carry`).
5. Gatilhos manuais: `event`/`stock` (botão "Registrar"), `usage` (atualizar contador).
6. Surfacing no "Hoje" (mobile): tarefas atrasadas e do dia.
7. Offline (mobile): conclusões enfileiradas e drenadas via RPC `todo_resolve`.

## Séries diárias (ZMA, creatina, nozes)

**Não existe um `kind: 'daily'`.** Uma série diária é `weekly` com os sete dias —
o caso completo da recorrência que já existe, sem ramo novo em `firstDueDate`,
`nextDueDate` nem `reconcileTemplate`. O predicado `isDailyRecurrence` (shared) é
a leitura inversa, para quem precisa reconhecer a intenção depois:

- **Editor** (mobile e web): um chip **"Diária"** grava `weekly{weekdays:[0…6]}`
  e volta selecionado ao reabrir. Sem ele, "todo dia" custava sete toques e a
  descoberta de que "Semanal" também servia para isso.
- **Rótulo**: `describeRecurrence` devolve `"Todo dia"` em vez de
  `"Dom/Seg/Ter/Qua/Qui/Sex/Sáb"`.

**`overdue` tem que ser `expire`.** Com `carry` a ocorrência de ontem continua
pendente, e a reconciliação só cria a do dia quando não há nenhuma viva
(`hasCurrentOrFuture`) — a tarefa de hoje nunca nasceria. Escolher "Diária" já
move a política para `expire`; voltar para "Acumula" exibe o aviso, sem travar.
O dia expirado é o registro de que passou batido — é dele que sai o contraste
abaixo.

### A faixa de adesão na Retrospectiva

Uma tarefa comum entra na retro só como **contagem por módulo**: o nome se perde.
Para o que se faz todo santo dia isso não serve — a pergunta é *"quantos dias eu
lembrei, e quantos esqueci"*, e ela precisa do nome, dos dias e da janela.

O bloco **"Tarefas — todo dia"** (`buildTaskGrid`, `packages/shared/src/period/task-grid.ts`)
responde às duas de uma vez: cada linha traz o nome, a contagem (`26 de 31`) e a
**faixa** — uma célula por dia, feito/esquecido/fora-da-janela. A tabela e o visual
são a mesma coisa; separá-los faria o número aparecer duas vezes na mesma rolagem.

**Não é o `Heatmap` de `retro.ts`.** Aquele é uma métrica contínua contra uma meta,
em calendário de 7 colunas com escala divergente. Aqui o dado é **binário** e são
**várias séries ao mesmo tempo**: a leitura que importa é comparar as linhas entre
si, e isso pede faixas empilhadas no mesmo eixo de dias.

**Semana e mês só.** A faixa é uma linha por tarefa, então N vira largura: 31
células já ficam com ~7px num telefone e uma estação (92) não caberia.

**Três estados, não dois** — um dia só conta como esquecido se a série existia e o
dia acabou:

| Estado | Quando |
|--------|--------|
| `null` (fora da janela) | antes de `createdOn`, depois de hoje, ou **hoje ainda não feito** |
| `true` (feito) | há ocorrência concluída no dia |
| `false` (esqueci) | a série existia, o dia passou, e não foi feita |

O terceiro caso do `null` é o que impede o denominador de piscar: sem ele "26 de 31"
viraria "26 de 32" às 00h01 e voltaria quando o ZMA fosse marcado.

`createdOn` também vinha do contrato de `RetroHabit`/`RetroRegistro` sem que
**nenhum fetcher o preenchesse** — corrigido nos três (`habits`, `registros`,
`todo_templates`), o que de quebra conserta a amostra dos cruzamentos de saúde.

**As diárias NÃO alimentam o cruzamento de saúde.** Como `cross` pesa 1000 na
ordenação dos destaques, promovê-las a gatilho colocaria "nos dias com ZMA, sono
+9%" no topo de todo domingo. A pergunta aqui é adesão, não efeito.

## Encadeamento (onComplete)

Cada série pode declarar uma lista `onComplete` de regras `{ templateId, ifPending }`.
Ao concluir uma ocorrência da série-pai, o seam `resolveAndAdvance` instancia uma
ocorrência de cada série-filha (com `dueDate` = dia da conclusão). A filha mantém
sua própria recorrência — é uma tarefa normal, só nasce por gatilho da pai.

- `ifPending: 'ignore'` (padrão) — não cria se a filha já tem ocorrência pendente.
- `ifPending: 'duplicate'` — sempre cria; conflito de `(template_id, due_date)`
  cai no índice único do banco e vira no-op silencioso.

Exemplos:
- "Tomar shake" disparado por "Correr" (que por sua vez é concluída pela sync HealthKit).
- "Colocar saco de lixo" disparado por "Descer o lixo".

Edição: a relação é gravada **só no pai**. No editor da filha, a seção "É criada por"
lista os pais (read-only) — derivado por query reverso de `onComplete`.

**`triggerOnly`:** flag no template — quando `true`, a série NÃO cria ocorrência
inicial nem ocorrências por calendário; só nasce por gatilho (onComplete,
on_workout/sync HealthKit, gatilhos manuais event/stock/usage). Use para tarefas
filhas que existem só como consequência de outras (ex.: "tomar shake" disparada
por "correr"). Configurável no editor ("Só nasce por gatilho").

## O dia das tarefas vira às 02h

O "hoje" das listas é um **dia lógico**, não a data do relógio: entre 00h e 02h ainda
é o dia anterior. Uma tarefa com prazo em terça continua em "A fazer" até as 02h de
quarta — não some, não vira "atrasada" e não é expirada/cancelada na virada da
meia-noite. Motivo: quem fecha o dia depois da meia-noite ainda está no mesmo dia,
e perder a tarefa da lista às 00:00 é perder a chance de marcá-la.

- Derivado por `todoDayStr()` / `todoTimeStr()` (shared) — usados no lugar de
  `localDateStr`/`localTimeStr` em **tudo** que é tarefa: baldes, `isOverdue`,
  reconciliação, `dueLabel` ("Hoje"), dia da conclusão e "concluídas hoje".
- Na madrugada a hora vira `'24:mm'`/`'25:mm'`, então `startTime` já cumprido segue
  visível e `endTime` já passado continua fechando a janela (cancelamento automático).
- App/aba aberta atravessando a virada: as stores agendam um re-load para as 02h
  (`msUntilTodoRollover`), junto com os limites de `startTime`/`endTime`.
- Vale também para Compras (mesmo motor). Hábitos, refeições e treinos seguem a data
  do calendário — um treino às 00:30 é do dia novo, e a tarefa que ele dispara nasce
  com a data dele.

## Janela de horário (startTime / endTime)

Campos opcionais `'HH:MM'` no template, válidos só para recorrências **com data**
(`monthly`/`weekly`/`yearly`/`after_completion`). A janela é da série; as ocorrências
herdam via `templateId`.

- **`startTime`** — a ocorrência **do dia** só vira acionável a partir do horário.
  É filtro de **exibição** (não bloqueia a criação): antes da hora ela aparece em
  "Em breve"; depois, em "A fazer"/"Hoje". (`isVisibleNow`)
- **`endTime`** — passado o horário no dia (ou em dias anteriores), a ocorrência é
  **cancelada automaticamente** na reconciliação — **sempre**, sobrepondo
  `carry`/`cancelPolicy`. O cancel passa pelo seam de avanço (gera a próxima como
  qualquer resolução). (`isPastEnd` → ação `cancel` em `reconcileTemplate`)

**Disparo:** a aparição e o cancelamento acontecem na próxima reconciliação
(`load`: abrir app, foreground, navegação) e por um `setTimeout` interno agendado
para o próximo limite enquanto o app está aberto.

**Lembrete (mobile):** toda ocorrência **pendente com data** de uma série ativa com
`startTime` agenda uma notificação local para `dueDate + startTime` — título fixo
`"Lembrete"`, corpo = o nome da tarefa, toque abre `/tarefas`. Diferente do
`setTimeout` acima, o gatilho é do sistema (DATE), então chega com o app fechado.

- Lista derivada em `buildTaskReminders` (shared, puro) — ordenada pelo horário e
  cortada em `TASK_REMINDER_LIMIT` (32), porque o iOS só mantém 64 locais pendentes
  por app e descarta o excedente calado.
- Só horários **futuros**: reagendar algo no passado dispararia na hora, virando um
  alarme falso a cada foreground.
- Identifier estável `todo:<occId>` — reagendar substitui em vez de duplicar, e
  concluir/pular/cancelar apaga o lembrete daquela ocorrência.
- Reagendado no ciclo do digest (foreground) e a cada mudança relevante na store de
  tarefas (`refreshTaskReminders`), então concluir ou mudar a hora reflete na hora.
- Chave `taskReminders` em `notification_prefs`, ligada por padrão; alternável em
  Configurações → Notificações ("Tarefas com hora").

## A partir de (startDate)

Campo opcional `'YYYY-MM-DD'` no template. No editor: "Agora" (padrão, sem data —
modelo atual) ou "Em uma data". Vale para qualquer série que não seja só-gatilho.

- Antes de `startDate` a série fica **oculta em todos os baldes** (atrasada/hoje/em
  breve) — filtro `isStarted` no filtro-base das listas. A ocorrência existe no
  banco (já criada), só não aparece.
- A **primeira data** de recorrências com data é ancorada em `max(hoje, startDate)`
  (`firstDueDate`), então ao chegar o dia ela não nasce retroativa/atrasada.
- `none` cria a ocorrência sem data normalmente; o `isStarted` a esconde até o dia.

## Escopo v1

**Inclui:** núcleo (5 exemplos) + gatilhos não-temporais + integração por módulo +
encadeamento por conclusão.
**Fica para depois:** antecedência/janela de prazo, "X vezes por período".

## Integração com módulos

- Cada série tem `module` (`financas`/`compras`/`casa`/`saude`/`geral`) — categoriza e colore.
- **Conclusão rica:** ao concluir uma tarefa de `financas`, captura `amount` em `occurrence.meta`.
- ⚠️ Compras/Finanças ainda não têm backend Supabase (são mock no frontend); por isso a
  ponte grava em `meta` mas não cria linhas nesses módulos. Quando esses backends existirem,
  conectar `stock` → lista de Compras e `amount` → Transação.

## Não-objetivos

- Não mistura com Habitos (modelo próprio).
- Sem push remoto: os lembretes são locais, agendados pelo próprio app (sem servidor),
  então dependem de o app ter sido aberto para agendar a janela seguinte.
