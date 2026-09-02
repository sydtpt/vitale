---
id: SPEC-registros
companions:
  - metricas-do-detalhe.md
  - data-model.md
  - plan.md
sources: []
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar. O spec narrativo v1 (2026-05-21) foi absorvido aqui; o texto antigo vive no git.
> **Aviso:** `plan.md` descreve o layout v1 — a camada de dados que ele situa no web migrou para `packages/shared/src/data/registros.ts`; em divergência, o código do núcleo vale.

# Registros — marcação diária avulsa + detalhe com métricas

## Why

Dor a resolver, em dois tempos. **v1 (entregue):** Habitos tem meta e contador, Tarefas tem agendamento — faltava um modelo para atividades sem frequência definida (Pizza, Dentista) que o usuário só quer marcar "fiz hoje" e consultar depois. **Agora:** o histórico acumulado é write-only — tocar num registro abre o editor, e ler o dado exige a página web. O usuário quer o mesmo gesto do histórico de treinos: tocar num item e ver as métricas daquele dado, com períodos alternáveis, no celular primeiro.

## Capabilities

- **CAP-1** — Marcar feito hoje *(v1, entregue)*
  - **intent:** Usuário marca com um toque que fez a atividade hoje; tocar de novo desmarca.
  - **success:** Marcar grava e persiste ao reabrir; segundo toque remove só o dia atual; na virada do dia local tudo volta a "não marcado" sem apagar o histórico.

- **CAP-2** — Criar e configurar um registro *(v1, entregue)*
  - **intent:** Usuário cria um registro com nome, módulo, ícone e cor.
  - **success:** Item criado aparece na lista pronto para marcar; editar nome/módulo/ícone/cor reflete em lista e análise sem afetar marcas passadas.

- **CAP-3** — Editar, arquivar e reativar *(v1, entregue)*
  - **intent:** Usuário arquiva sem perder histórico, reativa depois e controla a ordem da captura.
  - **success:** Arquivado some da captura e mantém histórico na análise; reativado volta com histórico; `sort` controla a ordem.

- **CAP-4** — Análise na página web *(v1, entregue)*
  - **intent:** Usuário vê de relance, por registro, quanto/quando aconteceu.
  - **success:** `/registros` mostra por card a contagem no período, "última vez há N dias" e heatmap; sem registros, estado vazio orienta criar o primeiro.

- **CAP-5** — View de detalhe por registro
  - **intent:** Tocar num registro abre uma view de métricas daquele dado (não mais o editor), com seletor de período no molde do histórico de treinos.
  - **success:** Tap na lista (mobile e web `/registros/:id`) abre o detalhe; alternar entre os 5 períodos (7d · 4s · 12m · Ano · Sempre) redesenha gráfico de barras por bucket e métricas; o editor continua a um toque, por botão no header do detalhe.

- **CAP-6** — Métricas derivadas do detalhe
  - **intent:** O detalhe responde "com que frequência, quando e em que padrão" para um registro.
  - **success:** Cabeçalho com total no período + delta vs período anterior + última vez; frequência média, intervalo médio entre ocorrências, maior jejum, distribuição por dia da semana, sazonalidade e primeira vez/total histórico conferem com cálculo manual sobre `registro_logs` num caso plurianual (testes no shared). Catálogo e definições em [metricas-do-detalhe.md](metricas-do-detalhe.md).

- **CAP-7** — Corrigir o passado a partir do detalhe
  - **intent:** Usuário corrige dias passados a partir da view de detalhe, sem ganhar uma superfície nova de edição (o retroativo já existe: calendário mensal `/registros/marcar` e edição por dia `/registros/dia`).
  - **success:** Mobile: o heatmap é só-leitura e um toque nele (ou botão "editar dias") abre o calendário mensal existente; web: clique numa célula ≤ hoje alterna a marca daquele dia. Em ambos, a mudança persiste e as métricas do detalhe refletem imediatamente; dias futuros não respondem.

## Constraints

- O eixo de período reusa `Period` do núcleo (`semana`/`mes`/`meses12`/`ano`/`sempre`, labels 7d/4s/12m/Ano/Sempre) e o padrão `buildOverview` — nenhum app cria eixo próprio.
- Derivações são funções puras testadas em `packages/shared` (padrão `fitness/overview`/`consistency`); web e mobile só renderizam.
- Sem migration: tudo deriva de `registro_logs`; retroativo usa o mesmo `insert … on conflict do nothing` / `delete` por `(registro_id, log_date)` — nenhuma RPC nova.
- PostgREST corta em 1000 linhas sem erro: o fetch do histórico completo de um registro exige range+order/paginação.
- O detalhe reusa a camada de dados do núcleo (`packages/shared/src/data/registros.ts` — `fetchRegistroLogsBetween` e afins, que já paginam); nenhum app escreve fetch novo.
- RLS por usuário: cada usuário só lê/escreve os próprios registros e logs.
- Retroativo não aceita dias futuros; registros arquivados também abrem o detalhe (o histórico preservado é promessa de CAP-3).
- Mobile entrega primeiro; a web segue no mesmo contrato.
- Done inclui conferência visual em escala real e build Release no iPhone — mergeado sem rodar no aparelho não conta como entregue.

## Non-goals

- Atalho "ver correlações" no detalhe (o cruzamento com saúde segue vivendo na Retrospectiva; backlog).
- Contagem de mais de 1×/dia e anotação por marca (`count`/`note`) — seguem no backlog.
- Recorrência, lembretes/push, metas ou streaks esperados (não há frequência alvo por definição).
- Surfacing na tela Hoje do mobile e filtro/agrupamento por módulo — backlog.
- Unificar Habitos + Registros num modelo com `kind` — backlog.
- Ponte com Compras/Finanças (exclusão herdada do v1; a razão original — "módulos mock" — envelheceu, mas a exclusão segue).
- Redesenhar a lista/captura v1 além de trocar o destino do tap.

## Success signal

Abrir "Pizza" no celular com mais de um ano de histórico, varrer os 5 períodos e responder "com que frequência, quando foi a última vez e em que dias costuma acontecer" sem sair da tela; tocar num dia esquecido do heatmap e ver todas as métricas refletirem na hora.

## Assumptions

- A navegação de ano no detalhe espelha o histórico de treinos (ano corrente + anteriores até o primeiro com dado); sem os toggles multi-ano do período Sempre.
- Os cards de análise da página web v1 permanecem; o detalhe soma, não substitui.
