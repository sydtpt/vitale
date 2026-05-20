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
| Gatilho (recorrência) | `none` · `monthly` · `weekly` · `yearly` · `after_completion` · `usage` · `event` · `stock` |
| Se não fizer no dia (`overdue`) | `carry` (mantém atrasada) · `expire` (some) |
| Cancelamento (`cancelPolicy`) | `none` (obrigatória) · `manual` · `auto` (após o dia) |
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

## Escopo v1

**Inclui:** núcleo (5 exemplos) + gatilhos não-temporais + integração por módulo.
**Fica para depois:** antecedência/janela de prazo, encadeamento (concluir uma gera outra),
"X vezes por período".

## Integração com módulos

- Cada série tem `module` (`financas`/`compras`/`casa`/`saude`/`geral`) — categoriza e colore.
- **Conclusão rica:** ao concluir uma tarefa de `financas`, captura `amount` em `occurrence.meta`.
- ⚠️ Compras/Finanças ainda não têm backend Supabase (são mock no frontend); por isso a
  ponte grava em `meta` mas não cria linhas nesses módulos. Quando esses backends existirem,
  conectar `stock` → lista de Compras e `amount` → Transação.

## Não-objetivos

- Não mistura com Habitos (modelo próprio).
- Sem notificações push (roadmap geral).
