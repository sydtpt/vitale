# 0029 — O Strava é app de origem, não integração; a API sai do código

**Data:** 2026-09-04
**Status:** aceita
**Supersede parcialmente:** nada; **relaciona-se com** ADR 0004 (dedupe multi-fonte)

## Contexto

O item R6 da pesquisa competitiva mandava decidir se a assinatura de
desenvolvedor do Strava valia a pena, e listava um prazo: até 01/06/2027 tornam-se
obrigatórios o token no header, a base `api-v3.strava.com` e o `oauth/revoke`.
Desde 01/06/2026 o tier Standard exige assinatura Strava ativa — na prática
US$ 11,99/mês para manter uma integração pessoal.

A pesquisa partiu de uma premissa que o inventário derrubou: *“o Orbe já
sincroniza atividades do Strava”*.

**O código concordava. A produção, não.**

- `linked_account_secrets` tem **uma** linha, `intervals`. Nunca houve token do
  Strava. As funções `strava-oauth` e `providers/strava.ts` existiam e nunca
  foram vinculadas.
- As 60 atividades com `source_name = 'Strava'` têm `source_id = com.strava.…`,
  o **bundle identifier do app iOS**, e `device = Garmin Venu 4`. Elas entraram
  pelo HealthKit.

A cadeia real é **Garmin Venu 4 → app do Strava → Apple Health → Orbe**, e o
programa de desenvolvedores diz explicitamente que *“download dos próprios dados
e integrações com relógios não mudam”*. Nada do R6 tocava no que estava em uso.

Um segundo fato pesou: o Apple Watch parou de gravar em **14/07/2026**, e desde
então todo treino chega por esse caminho.

## Decisão

### 1. O Strava é app de origem, não integração — e a API sai do código

Removidos `supabase/functions/strava-oauth/`, `_shared/providers/strava.ts`, o
despacho por provedor no ingest, o `connectStrava` dos dois stores e os cartões
de Strava nas duas telas de Conexões. `ConnectionProvider` passa de
`'strava' | 'intervals'` para `'intervals'`.

Era código morto carregando um prazo de 2027, uma cobrança mensal condicional e
uma fronteira legal (a cláusula “replicate functionality”, sem definição) que o
app não precisa atravessar. Nada muda para o usuário: o app do Strava continua
escrevendo no Apple Health como sempre.

### 2. O `CHECK` da migration fica como está

A constraint de `linked_accounts` ainda aceita `'strava'`. Constraint permissiva
não cria linha, e apertá-la pediria migration para proibir um valor que ninguém
grava. As seis migrations que citam Strava são história e não se reescrevem.

### 3. A assinatura de desenvolvedor não se justifica

Não há integração a manter. Se um dia fizer falta, o que se perdeu foi código de
OAuth — algumas horas —, não dado: o histórico está no banco e continua chegando.

### 4. O intervals.icu pode substituir a cadeia, e isso foi verificado

Investigado a pedido, e a resposta é **nenhum dado se perderia**:
`fetchIntervalsActivities` já existe e o provedor já busca os streams de `time`,
`latlng`, `altitude` e `heartrate`. Tudo o mais que a tela mostra —
`elevationM`, `hrZones`, `bestEfforts` — é **calculado a partir dos pontos** no
ingest, não recebido do provedor. Um provedor que entregue streams entrega a
feature inteira.

**Não trocado agora.** A cadeia atual funciona, não está ameaçada, e ligar as
atividades do intervals acrescentaria uma segunda fonte sobre a mesma atividade —
o caso que o dedupe da ADR 0004 trata, mas que merece ser exercitado numa
história própria em vez de de carona numa faxina.

### 5. MCP, IA conversacional e prescrição de treino ficam fora do roadmap

O item R7 da pesquisa, registrado aqui porque o argumento é o mesmo: mercado
saturado, crítica convergente, e — para dado de origem Strava — uso em IA vedado
pela API Policy. Como o Strava deixa de ser fonte via API, a trava legal deixa de
valer, mas a razão de produto continua.

## Consequências

- O prazo de junho de 2027 deixa de existir para este projeto. Não há migração
  para `api-v3`, header ou `oauth/revoke` a fazer.
- A tela de Conexões fica com duas fontes: Apple Health e intervals.icu.
- **A dependência real passa a ser o app do Strava no iPhone.** Se ele parar de
  escrever no HealthKit, os treinos do Garmin param de chegar — e o caminho de
  volta é ligar as atividades do intervals.icu, que já está vinculado. É a razão
  de a decisão 4 ficar registrada em vez de esquecida.
- Um risco herdado fica visível: com o Apple Watch parado desde 14/07, o app do
  Strava é hoje **o único** caminho de entrada de treino.

## Alternativas rejeitadas

**Manter o código e migrar para api-v3 antes de 2027.** Custaria a migração e
manteria viva uma opção que exige assinatura para ser exercida. Pagar
manutenção por uma porta que nunca foi aberta.

**Manter congelado, sem migrar.** Deixaria a decisão para o dia em que alguém
tentasse conectar e descobrisse que não funciona mais — a pior hora para
descobrir.

**Trocar o ingest para o intervals.icu junto com esta faxina.** Duas mudanças de
natureza diferente no mesmo commit: remover o que não se usa é seguro, trocar o
caminho do dado que está em uso não é.

**Apertar o `CHECK` da migration.** Migration para apagar um valor que ninguém
grava, com risco de quebrar linha histórica em troca de nada.

## Referências

- Pesquisa competitiva, R6 e R7, e o parágrafo do programa de desenvolvedores de junho de 2026
- ADR 0004 (dedupe multi-fonte), ADR 0021 (elevação calculada vence a reportada)
- `supabase/functions/_shared/providers/intervals.ts`, `_shared/ingest.ts`
