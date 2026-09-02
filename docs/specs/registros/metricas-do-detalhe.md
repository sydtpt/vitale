# Métricas do detalhe de um Registro

> Companion de [SPEC-registros](spec.md) (CAP-5/6/7). Todas as derivações são funções puras
> no shared sobre `RegistroLog[]` (datas locais `YYYY-MM-DD`); nada é persistido.
> As tabelas abaixo são formato de **documento**: no app, métricas rendem como cards/linhas,
> nunca como tabela.

## Períodos e buckets

| Período | Label | Janela | Bucket do gráfico | Período anterior (delta) |
|---|---|---|---|---|
| `semana` | 7d | últimos 7 dias | dia | os 7 dias anteriores |
| `mes` | 4s | últimas 4 semanas | semana | as 4 semanas anteriores |
| `meses12` | 12m | últimos 12 meses | mês | os 12 meses anteriores |
| `ano` | Ano | ano civil mostrado, navegável | mês | o ano anterior |
| `sempre` | Sempre | todo o histórico | ano | — (sem delta) |

Semânticas herdadas do histórico de treinos: navegação de ano (corrente + anteriores até o
primeiro ano com marca) e delta em três estados — número, zero, ou `null` quando não há
período anterior comparável.

Onde o registro **diverge** do histórico (dado esparso):

- **Default = `meses12`**, não `semana` — registro esparso abriria vazio em 7d. A última
  escolha de período fica lembrada por aparelho (mesmo padrão do armazenamento local dos
  anos do histórico).
- **Delta é contagem absoluta** (+1/−2), nunca percentual — não herdar os pontos
  percentuais de `totalsDelta`.
- **Eixo do gráfico só em inteiros** (contagens 0–3 são o caso comum).

## Cabeçalho

- Ícone e cor do módulo (`moduleOf()`) + nome do registro.
- **Total no período** + delta vs período anterior.
- **"Última vez há N dias"** — independe do período selecionado.

## Métricas

| Métrica | Definição | Visível em |
|---|---|---|
| Frequência média | total ÷ semanas da janela (7d/4s) ou ÷ meses (12m/Ano/Sempre) | todos |
| Intervalo médio | média dos dias entre marcas consecutivas dentro da janela | janelas com ≥ 2 marcas; senão "—" |
| Maior jejum | maior distância entre marcas consecutivas na janela (o jejum corrente já aparece como "última vez") | janelas com ≥ 2 marcas; senão "—" |
| Dia da semana | 7 mini-barras com a contagem por dia da semana na janela | todos |
| Sazonalidade | 12 mini-barras com a contagem por mês | 12m e Sempre — no Ano duplicaria exatamente as barras (e zeraria meses futuros no corrente) |
| Primeira vez + total histórico | menor `log_date` e contagem total — fixos | todos |

## Heatmap anual e correção do passado (CAP-7)

- Grade de dias do ano mostrado (estilo GitHub), navegável pelos mesmos controles de ano.
- **Mobile:** heatmap só-leitura — célula de ~10px não é alvo de toque; um toque no heatmap
  (ou botão "editar dias") abre o calendário mensal existente (`/registros/marcar`), que já
  faz marcar/desmarcar arbitrário via `setRegistroMark`. Ao voltar, o detalhe recarrega.
- **Web:** clique numa célula ≤ hoje alterna a marca: otimista no cliente,
  `insert … on conflict do nothing` ou `delete` por `(registro_id, log_date)`; em erro,
  reverte (padrão de `markToday`).
- Dias futuros são inertes nas duas plataformas.

## Estados

- **Nenhuma marca:** o detalhe abre com estado vazio orientando marcar (hoje, ou dias passados pela correção do CAP-7).
- **Registro arquivado:** detalhe abre normalmente; só a captura o esconde.
- **Histórico curto:** métricas indisponíveis mostram "—", nunca somem do layout.
