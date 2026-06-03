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
| Gatilho (recorrência) | `none` · `monthly` · `weekly` · `yearly` · `after_completion` · `usage` · `event` · `stock` · `on_workout` |
| Encadeamento (`onComplete`) | lista de séries-filhas instanciadas ao concluir esta tarefa |
| Se não fizer no dia (`overdue`) | `carry` (mantém atrasada) · `expire` (some) |
| Cancelamento (`cancelPolicy`) | `none` (obrigatória) · `manual` · `auto` (após o dia) |
| Janela de horário (`startTime`/`endTime`) | opcionais `'HH:MM'`, só p/ recorrências com data |
| Âncora da próxima | calendário (`monthly`/`weekly`/`yearly`) · conclusão (`after_completion`) |

Os 5 exemplos do usuário:
- **Pagar aluguel** → `monthly{day:1}`, `carry`, `none`.
- **Descer o lixo** → `weekly{weekdays:[3,0]}`, `expire`, `auto`.
- **Lavar banheiro/lençol** → `after_completion{15}`, `carry`, `manual`.
- **Ligar para alguém** → `none` (sem prazo), `carry`, `manual`.

## Requisitos funcionais

1. Criar/editar/arquivar séries (mobile: `tarefas/editor`; web: modal).
2. Listar ocorrências pendentes em **Atrasadas / A fazer / Em breve**.
3. Concluir, pular e cancelar ocorrências; gerar a próxima automaticamente.
4. Reconciliação no `load`: expira vencidas (`expire`), gera próximas de calendário, mantém vencidas (`carry`).
5. Gatilhos manuais: `event`/`stock` (botão "Registrar"), `usage` (atualizar contador).
6. Surfacing no "Hoje" (mobile): tarefas atrasadas e do dia.
7. Offline (mobile): conclusões enfileiradas e drenadas via RPC `todo_resolve`.

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

**Disparo:** sem timer em background/push, a aparição e o cancelamento acontecem na
próxima reconciliação (`load`: abrir app, foreground, navegação) e por um `setTimeout`
interno agendado para o próximo limite enquanto o app está aberto. `startTime` é a base
para um lembrete push local futuro.

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
- Sem notificações push (roadmap geral).
