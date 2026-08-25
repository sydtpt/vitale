# Backlog de instrumentação — insights de IA analítica no Orbe

Origem: sessão de brainstorming de 2026-08-21 (`.memlog.md` desta pasta).
Este documento é lista de trabalho, não ensaio. Só entra o que está no memlog.

## O eixo de priorização

A descoberta central da sessão inverte a intuição:

> **Gap do relógio = recuperável depois. Gap de contexto humano = perdido a cada dia que passa.**

- **Recuperável:** as amostras cruas seguem no HealthKit do device e o `health-sync.ts`
  já tem mecanismo de recuperação — um bump de `AGG_VERSION` dispara backfill e
  reprocessa o histórico com a agregação nova. `BACKFILL_DAYS = 500`, confirmado no
  código e **verificado na prática em 24/08/2026** (ver "Linha de base" no fim).
  Strava e intervals.icu ainda têm os streams no servidor.
- **Irrecuperável:** ninguém lembra em março por que quebrou um streak em agosto.
  Contexto humano não tem backfill.

Consequência prática: **a instrumentação de contexto é o que tem prazo.** Adiar IA
estava certo; a justificativa é que o dado do relógio espera e o contexto não.

Caveat de recuperabilidade a respeitar: FC no backfill é limitada a **60 dias**
(`HEAVY_METRICS` / `HEAVY_MAX_DAYS`). É o único gap do relógio com validade curta.

---

## URGENTE — perde-se a cada dia que passa

Ordenado por valor dentro da seção.

### U0 — `onset` está cego no Garmin 🔴 **DESCOBERTO EM 24/08/2026 — NOVO**
- **Problema:** o Garmin escreve o `INBED` **começando no instante em que se adormece** —
  registra "na cama" como sinônimo de "dormindo". O Apple Watch escrevia a janela real de
  rolar na cama acordado. Quebra limpa na troca de relógio (18/07/2026):

  | mês | onset médio | mediana |
  |---|---|---|
  | 2026-04 | 61 min | 77 min |
  | 2026-05 | 57 min | 69 min |
  | 2026-06 | 28 min | 21 min |
  | 2026-07 | 8 min | 0 min |
  | 2026-08 | **0 min** | **0 min** (19/19 noites) |

- **Por que é URGENTE e não adiável:** ao contrário dos outros gaps do relógio, este **não
  tem backfill** — a informação nunca chega ao HealthKit. Cada noite com o Garmin é uma
  noite de latência perdida para sempre. É o mesmo tipo de perda do contexto humano.
- ~~**Agravante silencioso:** um `onset` ≈ 0 **parece** "apagou na hora" quando significa
  "não medido".~~ ✅ **CORRIGIDO em 25/08/2026** (`AGG_VERSION` 4 → 5).

  A medição decidiu o desenho. O Garmin abre o `INBED` **exatamente 1 segundo** antes do
  sono — 19/19 noites de agosto com `min = mediana = max = 1s`. Não é medida imprecisa,
  é constante. Já o Apple Watch **nunca desceu de 90s em 41 noites**:

  | mês | min | mediana | abaixo de 60s |
  |---|---|---|---|
  | 2026-04 | 90 s | 4605 s | 0/9 |
  | 2026-05 | 600 s | 4170 s | 0/17 |
  | 2026-06 | 127 s | 1275 s | 0/15 |
  | 2026-07 | 1 s | 1 s | 12/14 |
  | 2026-08 | 1 s | 1 s | **19/19** |

  Logo um piso de **1 min** (`MIN_ONSET_MS`) separa os dois casos sem descartar uma única
  medida legítima — não é chute, é o que os dados mostram, e ninguém adormece em menos de
  um minuto ao deitar.

  **O estado passa a ser legível pela forma:** `inbed` **presente** + `onset` **ausente**
  = a fonte não separa cama de sono. Ambos ausentes = não havia dado de cama. Ambos
  presentes = medida real. Sem chave nova, sem mudar tipo.

  O backfill reescreve as ~33 linhas que hoje carregam o `onset` falso — o upsert troca o
  `extra` inteiro (`extra = excluded.extra`), não faz merge.

- **AINDA EM ABERTO — restaurar o sinal.** O fix acima faz a métrica parar de mentir, mas
  **não devolve a medida**. Com o Garmin, nenhuma noite nova acumula latência. Três saídas:
  1. **Checar o Garmin Connect primeiro** (5 min, gratuito): foi medido o que *chega* ao
     Apple Health, não o que o Garmin sabe. Se houver ajuste que mude o que ele escreve,
     dispensa o resto.
  2. **Apple Watch nas noites que importam** — zero código, funciona hoje; custo é logística
     de carga e perder o dado noturno do Garmin nessas noites.
  3. **Toque de "deitei agora"** — o `onset` passa a ser calculado contra o registro do
     usuário, não contra o relógio: funciona em qualquer aparelho, para sempre. Casa com U3
     (hora exata nos logs manuais) e com a tese da sessão — instrumentar o contexto humano
     em vez de esperar o relógio melhorar.

### U1 — Motivo relâmpago quando um streak quebra ✅ **APROVADO PELO USUÁRIO**
- **Capturar:** ao detectar quebra de streak, um toque escolhendo o motivo
  (viagem / doença / preguiça / lesão).
- **Destrava:** sem isso a análise futura só vê buraco no gráfico, sem causa.
  Separa "parou porque adoeceu" de "parou porque desistiu" — que são conclusões opostas
  sobre a mesma série.

### U2 — Flag universal de "dia atípico" ✅ **APROVADO PELO USUÁRIO**
- **Capturar:** marcador do dia (doente / viajando / evento) aplicável a **todos** os
  módulos daquele dia.
- **Destrava:** permite a análise futura **filtrar o outlier em vez de poluir a correlação**.
  Num dataset de 1 pessoa e poucos meses, um punhado de dias atípicos não marcados
  é o suficiente para fabricar correlação espúria.

### U3 — Hora exata nos logs manuais (água / fumo / cerveja)
- **Capturar:** timestamp real do evento, não só a data "hoje".
- **Destrava:** cruzar o evento com o **sono daquela noite** e com o **treino do dia seguinte**.
  Sem a hora, "bebeu no dia X" e "bebeu 40 min antes de deitar" são a mesma linha.
  É o insumo direto da hipótese testável levantada na sessão (ver A6).

### U4 — Dose / intensidade em vez de binário
- **Capturar:** quantos cigarros, quantas cervejas — não apenas "aconteceu".
- **Destrava:** resposta dose-dependente. "Uma cerveja" e "cinco cervejas" hoje entram
  no mesmo balde e cancelam qualquer sinal na correlação.

### U5 — Chip de contexto em 1 toque ao logar hábito ruim
- **Capturar:** estresse / social / tédio / comemorando, escolhido no mesmo toque do log.
- **Destrava:** transforma um contador em **variável cruzável**. Alimenta direto o
  motor de gatilhos já existente (`triggerImpact`) — deixa de ser "quantas vezes"
  e passa a ser "em que circunstância".

### U6 — Rating subjetivo por evento (RPE pós-treino 1–5)
- **Capturar:** percepção de esforço no momento do save do treino, além do rating diário
  que já existe.
- **Destrava:** **a divergência entre a métrica objetiva do relógio e a sensação percebida
  É o insight.** Treino que o relógio marcou como leve e o corpo sentiu como pesado é
  exatamente o sinal que o Morning Report do Garmin nunca vê.

### U7 — Timing relativo na alimentação
- **Capturar:** quantas horas antes/depois de dormir ou treinar, não só o quê comeu.
- **Destrava:** liga alimentação a sono e desempenho. "O quê" sozinho não explica noite ruim;
  "quando" explica.

### U8 — Tag de gatilho emocional em gastos por impulso
- **Capturar:** mesma mecânica do chip de hábito ruim, aplicada à transação.
- **Destrava:** cruzamento com as correlações-gatilho já no roadmap — gasto por impulso
  vira sintoma observável do mesmo estado que dispara o hábito ruim.

---

## ADIÁVEL — recuperável depois (fonte crua sobrevive)

Ordenado por valor. Nada aqui se perde por esperar — com a exceção sinalizada em A1.

### A1 — Curva de FC do treino (segundo-a-segundo)
- **Hoje:** a curva é colapsada em 5 zonas agregadas (`hr_zones`); a **forma** do treino se perde.
- **Destrava:** distinguir intervalado de contínuo, deriva cardíaca, resposta ao aquecimento.
- **Atenção:** é o **menos adiável dos adiáveis** — backfill de FC via HealthKit tem teto de
  60 dias (`HEAVY_METRICS` / `HEAVY_MAX_DAYS`). Além disso só os streams de
  Strava/intervals.icu recuperam.

### A2 — Cadência e potência nos streams
- **Hoje:** nem são pedidas — nem ao HealthKit, nem aos streams de Strava/intervals.icu.
- **Destrava:** eficiência de pedalada/passada e carga real, hoje invisíveis.
- **Esforço:** baixo — **ambas as APIs já suportam, só falta incluir no pedido**.

### A3 — Macros completos (carboidrato + gordura)
- **Hoje:** carbo e gordura são lidos e **descartados no persist** (`case 'macros': return []`);
  só proteína sobrevive no `health_daily`.
- **Destrava:** nutrição real cruzável com treino e sono, não só proteína.
- **Esforço:** maior que o do sono — `macrosFetch` **pré-soma o período inteiro com timestamp
  `now`**; é preciso reestruturar para manter amostras por dia antes de conseguir persistir.
  O campo `extra` jsonb já existe como destino.

### A4 — Timestamps de pausa/retomada do treino
- **Hoje:** guarda-se só a contagem de eventos de pausa.
- **Destrava:** separar tempo em movimento de tempo parado e reconstruir a estrutura da sessão
  (blocos de intervalado, paradas de semáforo).
- **Esforço:** guardar no `metadata` do treino.

### A5 — Deleção de treino no relógio não propaga
- **Hoje:** `activities` só é ocultável manualmente (`hidden`), nunca removida automaticamente.
- **Destrava:** higiene de dados — treino apagado no relógio segue contando em agregados
  e correlações, envenenando silenciosamente qualquer análise futura.

### A6 — Motor de correlação do retro: destravar os 4 estrangulamentos
A correlação **já existe** (`retro.ts:669-690`, usando `triggerImpact` do shared).
A dor não é "falta construir" — é que está estrangulada em quatro pontos:

1. **Só a métrica sono** (com fallback de VFC). Nenhuma outra métrica é testada.
2. **Só hábitos com `bad=true` + registros** entram como gatilho. Hábito bom e treino
   nunca são testados como causa.
3. **Dois portões restritivos:** exige ≥3 dias de cada lado **e** `|deltaPct| >= 5%`.
4. **O pior — ranking global:** `priority = |deltaPct| + 3` compete na mesma lista com
   gasto e tarefas. "R$ 340 em compras" (priority 40) enterra "sono −10% nos dias com
   cerveja" (priority 13).

Complementos registrados na sessão:
- **Formato, não só pesos:** o ranking de insight é **por superfície**, não global
  (manhã = sono + dia anterior + foco do dia; retrospectiva = a decidir). A lista única
  ordenada por `priority` tem o **formato errado**, não apenas os pesos errados.
- **Direção única:** a correlação só roda gatilho → sono; **nunca sono → desempenho do dia seguinte**.
- **Payoff imediato do trabalho já feito:** com `onset` / `awake` / estágios no `extra`,
  o **mesmo motor** passa a cruzar gatilho × **latência** — "nos dias com cerveja você demora
  +40% pra pegar no sono" é muito mais acionável que "sono −6%".
- ~~**Hipótese testável já com o dado existente:** álcool teria assinatura oposta nos dois
  tipos de insônia — encurta a latência de início e piora a manutenção.~~
  **TESTADA EM 24/08/2026 — não sustentada.** Na única era com `onset` válido (até 17/07),
  cerveja dá 28 min vs 32 min de latência com **n=5**. Amostra pequena demais para
  qualquer conclusão, em qualquer direção. Ver "Linha de base".

---

## Descartado (com motivo)

- **Cafeína como variável a instrumentar** — descartado pelo usuário: ele **já corta antes
  das 15h**. Não é o buraco que a hipótese do coach apostava; a explicação real dele para
  noite ruim é **insônia de início** (tipo 1), tratada pelo trabalho já implementado.
- **Perfil estático (idade / sexo biológico / tipo sanguíneo)** — é o item de **menor valor
  analítico** da lista: não varia, e o único uso real (`max_hr`) já é configurado à mão em
  `user_preferences`. Hoje é lido do HealthKit e nunca persistido; fica assim.

---

## Implementado nesta sessão — saiu do backlog

Ambos commitados em `a94f803` (branch `main`), e o **backfill foi verificado em produção
em 24/08/2026** — ver "Linha de base" no fim.

- **Fases do sono (REM / Deep / Core / Awake).** Antes eram lidas do HealthKit e colapsadas
  em horas totais antes de salvar. Agora vão para o `extra` jsonb do `health_daily`.
  Arquivos: `health-buckets.ts` (`Sample.stages` + `subtractIntervals` + `STAGE_PRIORITY`
  deep > rem > core), `health-aggregate.ts` (`aggregateSleep` → `extra`),
  `health-sync.ts` (`AGG_VERSION` 2 → 3). 7 testes novos; suíte mobile 386/386 + tsc limpo.
  - **Invariante testada explicitamente** (para evitar o 3º bug de sono do repo):
    `deep + rem + core + unspecified = total dormido`, e **`awake` fica FORA da soma** — é WASO,
    métrica à parte.
- **Latência de início do sono.** `INBED` era lido e **descartado** (`toIntervals` só casava
  CORE/DEEP/REM/AWAKE/ASLEEP — havia até um teste "ignora na cama"). É exatamente o sinal que
  mede a latência de início, o tipo de insônia mais comum e **o tipo que o usuário tem**.
  Agora `stages` ganha `inbed` / `onset` (fora da soma). `AGG_VERSION` 3 → 4.
  6 testes novos; mobile 392/392 + tsc limpo.
  - **O teste que prova o valor:** duas noites de 4h dormidas, idênticas no total — uma com
    `onset=2h30` (insônia) e outra sem latência (deitou tarde). Antes eram a **mesma linha**
    no banco.

**Caveat do backfill:** em 31/07 o usuário ficou 3–4 dias sem relógio. O buraco no hipnograma
nesse período é **ausência real de dado**, não falha de sync nem do Garmin → Apple Health.
Não gastar tempo depurando isso.

---

## Registrado, fora do backlog agora

- **Chat + auto-análise via IA** é a feature principal do futuro, mas o usuário decidiu que
  **não é o momento**: a fase atual é criação/coleta de features do "super app pessoal",
  para poder cruzar os dados depois.
- **Divisão de trabalho quando a IA entrar:** `triggerImpact` já calcula a correlação de forma
  determinística e gratuita. O que falta não é achar o número — é **decidir qual dos N números
  merece o topo do card**. Estatística acha; LLM prioriza e narra. Não é escolha entre os dois.
- **Superfície "manhã" (Morning Report do Orbe):** não competir com o do Garmin — ele é cego
  para o que o Orbe tem (hábitos, tarefas, gastos, ratings subjetivos, metas). Garmin diz
  "recuperação baixa"; o Orbe pode dizer **por quê**. A vantagem não é o dado do relógio,
  é o contexto de vida que o relógio nunca vê — e é por isso que a instrumentação da seção
  URGENTE não é dívida técnica, é o fosso.

---

## Linha de base — medição de 2026-08-24

Primeira análise real rodada sobre o dado, via SQL direto no Postgres de produção
(exploração descartável, nada disso está no app). Registrado para comparação futura:
**daqui a seis meses, comparar em vez de refazer do zero.**

### Backfill: funcionou

| | |
|---|---|
| Noites de `sono` com `extra` | **277 de 300** (mar/2025 → ago/2026) |
| Com `onset` | 251 |
| Com hipnograma (`deep`) | 269 |
| Com despertar (`awake`) | 233 |
| Sem `extra` | 23 (mar/2025–mai/2026) |

As 23 sem `extra` são resíduo de syncs antigos, para dias em que o HealthKit já não
devolve amostra de sono — o upsert nunca as tocou. **Não é bug; não caçar.**

### Latência de início — retrato da era Apple Watch

```
até 20 min   127 noites      média:   30 min
20–30 min     34 noites      pior:  2h38
30–60 min     47 noites
acima de 60   44 noites      36% das noites acima de 30 min
```

Os 30 min são o limiar de referência usual para latência elevada. A queixa de insônia
de início **se confirmou nos dados** — mas o retrato é da era Apple Watch (ver U0).

### Correlações: nada sustentável ainda

**Tentativa 1 — binária (`triggerImpact`), hábito na véspera × noite seguinte:**

| Hábito | n (com/sem) | Δ onset | Veredito |
|---|---|---|---|
| Café | 54 / **3** | −36 min | ❌ sem grupo de controle |
| Smoke | 54 / **3** | −31 min | ❌ sem grupo de controle |
| Cerveja | 10 / 47 | −1 min | ⚠️ único recorte honesto, nada mostra |

Café e cigarro são **diários** — perguntar "teve ou não teve?" não tem resposta útil
quando a resposta é sempre sim. O "café reduz sua latência em 36 min" é artefato de
três noites de controle, e vem com a mesma cara de confiança de um achado real.
**É o risco do chapéu preto materializado na primeira tentativa.**

**Tentativa 2 — por dose (Pearson), restrita à era Apple Watch (21/05 → 17/07):**

| Hábito | faixa de dose | n | r onset | r sono | r awake | r deep |
|---|---|---|---|---|---|---|
| Café | 0,8–4,0 | 25 | −0,32 | **−0,43** | −0,21 | +0,04 |
| Água | 1,8–5,3 | 26 | −0,09 | −0,30 | −0,02 | +0,03 |
| Smoke | 1–12 | 24 | −0,08 | 0,00 | −0,02 | +0,08 |

Com n=25, o r precisa passar de **~0,40** para p<0,05. Só café × horas de sono cruza.
Mas foram **12 correlações testadas** (3 hábitos × 4 métricas) — com 12 testes, um
resultado em 0,05 por acaso é o cenário-base, e a barra corrigida sobe para ~0,55.
**Nada sobrevive.** Some a isso a seta invertida: bebe-se mais café **depois** de dormir
mal, e noite ruim vem em sequência — a correlação apareceria igual sem efeito nenhum.

### O que dá para afirmar

- **A regra do café está funcionando.** Ruído em torno de zero no `onset` é o resultado
  *certo* para quem corta cafeína às 15h. Um nulo bem-medido também é informação.
- **Cigarro não mostra nada** — 0,00 no sono, com dose variando de 1 a 12. Se houvesse
  efeito forte nessa faixa, apareceria.
- **O motor não tem defeito.** Ele funcionou e disse, corretamente, "ainda não sei".

### Três motivos independentes pelos quais o dado não está pronto

1. **Sem variância** — café e cigarro são diários (U4 e U5 atacam isso).
2. **Quebra de instrumento** — `onset` morto desde 18/07 (U0).
3. **Amostra pequena** — 25 noites úteis, porque a era com `onset` válido e a janela de
   hábitos logados (desde 20/05) se sobrepõem em menos de dois meses.

### O que destrava, em ordem de impacto — nenhum envolve IA

1. **Voltar o `onset`** (U0). Sem isso a métrica não acumula mais nenhuma noite útil.
2. **Tempo.** Daqui a seis meses são ~200 noites em vez de 25, e a barra de significância
   cai de 0,40 para ~0,14.
3. **Contexto** (U1, U2). "Dia atípico" sozinho já limpa os outliers que hoje distorcem
   médias de amostra pequena.
