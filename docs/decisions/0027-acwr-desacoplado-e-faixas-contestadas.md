# 0027 — ACWR desacoplado, sobre a carga da curva, com faixas declaradamente contestadas

**Status:** aceita
**Data:** 2026-09-04

## Contexto

A curva de forma ([ADR 0025](0025-carga-de-treino-tem-pesos-proprios.md)) responde "estou fresco ou enterrado?". Ela não responde duas outras perguntas, e as duas têm receita pública:

- **O salto.** Uma semana muito acima da base é o preditor clássico de lesão. O saldo da curva não distingue "semana pesada porque estou em bloco" de "semana pesada porque dobrei a carga de uma vez".
- **A textura.** Sete dias iguais e sete dias com um pico e dois de descanso somam a mesma carga semanal e cobram coisas diferentes — a **monotonia** de Foster e o **strain** que ela multiplica.

São métricas de literatura aberta. A pesquisa competitiva de 03/09/2026 registrou que a Runalyze as expõe só no tier pago (recomendação R3), e que nada nelas depende de dado que o Orbe não tenha.

Três coisas precisavam ser decididas antes de escrever a primeira linha, porque todas as três mudam o número inteiro e nenhuma delas quebra nada visivelmente: **de onde vem a carga**, **qual forma do ACWR é o padrão** e **quanto peso as faixas interpretativas carregam**.

### De onde vem a carga

O núcleo tem duas unidades de carga, e a ADR 0025 existe justamente para impedir que se misturem:

| | `weekly-load.ts` (minutos de esforço) | `form-curve.ts` (`dailyLoadMin`) |
|---|---|---|
| Pergunta | "bati o mínimo de saúde da OMS?" | "quanto isso me cobra de recuperação?" |
| Pesos | `HR_ZONE_WEIGHTS` ([ADR 0002](0002-minutos-de-esforco-ancorados-no-vigoroso.md)), teto em 1, z4 = z5 | `FORM_ZONE_WEIGHTS` (ADR 0025), sem teto, z5 > z4 |
| Granularidade | semana (seg–dom) | dia local, parado = zero |

O ACWR compara sete dias contra vinte e oito, e a monotonia é o desvio-padrão **entre dias** — as duas exigem série diária, que o `weekly-load` não tem. E a pergunta que ambas fazem é de custo de recuperação, que é a pergunta da coluna da direita. Usar os minutos da OMS aqui daria a mesma carga a um intervalado e a um contínuo de limiar de mesma duração, apagando exatamente o sinal que o índice existe para captar.

### Acoplado contra desacoplado

Na forma clássica de Gabbett, a janela aguda (7 dias) está **dentro** da crônica (28 dias): o numerador é parte do denominador. Impellizzeri e colegas mostraram que isso cria correlação espúria — o índice é puxado para 1 por construção e **amortece o próprio pico** que deveria denunciar. No caso extremo (histórico menor que sete dias) as duas fatias são a mesma e o índice vale 1, sempre.

O efeito não é acadêmico. Com 53 dias a 10 min/dia seguidos de uma semana a 60 min/dia:

| Forma | Denominador | ACWR |
|---|---|---|
| Desacoplado (dias 8–28) | 10 | **6,0** |
| Acoplado (dias 1–28) | (7×60 + 21×10)/28 = 22,5 | 2,7 |

O mesmo sextuplicar de carga aparece como 2,7 na forma que a maioria das ferramentas publica.

### As faixas

"Zona ideal" 0,8–1,3, risco acima de 1,5, monotonia de alerta acima de 2. São números de estudos cujo desenho é contestado: amostras pequenas, esporte único, sem controle de carga acumulada, e com a mesma crítica de acoplamento embutida no cálculo que os produziu. São orientação, não diagnóstico — e ainda assim são o que dá sentido ao número para quem lê.

## Decisão

Um módulo puro, `packages/shared/src/fitness/training-load.ts`, que recebe a `series` de `buildFormCurve` e devolve ACWR, monotonia, strain, faixas e confiança. Sem UI, sem migration, sem rede, sem recalcular carga.

**A entrada é a série da curva, não `Activity[]`.** A carga do dia é o `dailyLoadMin` que já veio pronto, na unidade e com os pesos da ADR 0025. O módulo não conhece atividade, zona nem peso — se a ponderação mudar, ela muda num lugar só.

**O ACWR desacoplado é o padrão** (`acwr`): média diária dos dias 1–7 sobre a média diária dos dias 8–28. O acoplado fica exposto ao lado (`acwrCoupled`), para comparação com ferramentas que publicam só aquele.

**Denominador zero devolve `null`, nunca `Infinity` nem `NaN`.** Vale para a crônica zerada (quatro semanas parado), para a janela vazia e para o desvio zero da monotonia (semana constante — inclusive a semana toda parada, em que a razão seria 0/0). Quem exibe decide o que dizer; o núcleo não escolhe um número para preencher o buraco.

**As faixas são constantes exportadas** (`ACWR_BANDS`, `MONOTONY_ALERT`) com classificadores próprios (`acwrBandOf`, `monotonyBandOf`), nunca número solto num `if`. O limite de baixo pertence sempre à faixa de baixo: 0,8 e 1,3 são `optimal`, 1,5 é `caution`, `risk` começa estritamente acima. O docblock diz, e esta ADR repete: **orientação, não diagnóstico**. O corpo não muda de regime em 1,4999, e a UI que exibir isso precisa dizê-lo.

**A janela aguda é `FORM_FATIGUE_DAYS`**, importada da curva, não um 7 redeclarado: as duas medem "o que está pesando agora", e duas janelas diferentes para a mesma coisa fariam o cartão contar duas histórias. A crônica é 28 dias (`ACWR_CHRONIC_DAYS`).

**A monotonia usa desvio-padrão populacional** (divide por n) e **exige a semana cheia**. Os sete dias *são* a semana, não uma amostra dela; o amostral (n−1) infla o desvio e derruba a razão em ~8%, o bastante para mudar faixa calado. Com menos de sete dias não há monotonia — "média sobre desvio" de três números não é a textura de uma semana.

**Confiança é declarada, não consertada:** `historyDays`, `acuteDays`, `chronicDays` e `shortWindow` (histórico menor que a crônica). **Idade do dado não se avalia aqui** — silêncio de sincronização chega nesta série como zeros indistinguíveis de descanso. Quem responde por isso é o `trusted` de `buildFormCurve`, e quem exibir os dois números precisa olhar os dois sinais.

## Alternativas rejeitadas

**Somar carga a partir de `weekly-load.ts`.** Já existe, já é testado, já está nos dois apps. Mas é semanal (o ACWR precisa de dia) e responde a outra pergunta com outra unidade — misturar as duas é exatamente o que a ADR 0025 existe para impedir. E os pesos da OMS igualam z4 e z5, apagando o sinal do topo.

**Recalcular a carga a partir de `Activity[]`.** Daria autonomia ao módulo. Duplicaria `activityLoad`, a regra de dia local, o tratamento de `hidden` e a de atividade no futuro — e, no dia em que a ponderação mudasse, os dois cálculos divergiriam sem que nenhum teste os comparasse. A série da curva já é o produto canônico dessa transformação.

**ACWR acoplado como padrão, "porque é o que todo mundo mostra".** Comparabilidade com Strava e afins tem valor real. Perde para a correção: a forma acoplada amortece o pico por construção, e o número que o app existe para dar é justamente o do pico. A comparabilidade fica preservada em `acwrCoupled`, ao lado, sem custo.

**EWMA em vez de médias móveis para as duas janelas.** É a variante que Williams e colegas propõem, e é defensavelmente melhor — pesa o dia de ontem mais que o de 27 dias atrás. Mas a curva de forma **já é** o modelo exponencial da mesma carga: o EWMA-ACWR seria quase uma repetição dela com outro nome, e o valor deste módulo está justamente em trazer o que ela não traz. A média móvel também é o que torna a comparação acoplado × desacoplado legível — é a forma em que a crítica de Impellizzeri foi escrita.

**Não exportar faixas, só o número cru.** Evitaria dar aparência de diagnóstico a um número contestado. Mas empurraria os limiares para dentro da UI, onde virariam `if (acwr > 1.5)` em dois apps, sem docblock e sem ressalva — que é pior. Exportar com a ressalva ao lado mantém a interpretação num lugar só e visível.

**Devolver 0 (ou 1) quando o denominador é zero.** Faria todo consumidor funcionar sem tratar `null`. E mentiria: quatro semanas parado seguidas de uma semana de treino não têm ACWR — não é "zero de razão", é razão indefinida. Um `0` ali seria classificado como `undertraining`, o oposto do que está acontecendo.

## O que a revisão acrescentou

**As fronteiras foram calibradas sobre o acoplado e são aplicadas ao desacoplado.** É um descompasso real, e não se resolve escolhendo outro número: os estudos que produziram 0,8–1,3–1,5 mediram a forma acoplada, que é justamente a que este módulo rejeita como padrão. O desacoplado é mais sensível — na mesma semana ele marca 6,0 onde o acoplado marca 2,7 —, então `risk` acende com mais frequência do que a taxa de base da literatura sugere. Inventar fronteiras novas sem estudo que as sustente seria pior que herdar as antigas e avisar. Fica avisado no docblock, aqui, e é obrigação da UI tratar a faixa como direção.

**Faixa só nas janelas padrão.** Com `acuteDays`/`chronicDays` fora de 7 e 28, `band` e `monotonyBand` saem `null`: as fronteiras não foram calibradas para outra janela, e classificar uma "monotonia de 14 dias" com o limiar de sete dias de Foster seria emprestar autoridade que o número não tem. O número continua sendo devolvido.

**`monotony: null` ganhou um porquê.** Semana perfeitamente uniforme e semana inteira de descanso chegavam as duas como `null`, indistinguíveis — e a primeira é exatamente o extremo que o índice de Foster existe para denunciar. Agora `monotonyReason` separa `constant`, `idle` e `shortWeek`, e a semana constante recebe `monotonyBand: 'monotonous'`: o número é indefinido, o significado não.

**`acwrCoupled` cala quando degeneraria em 1.** Com histórico de até sete dias, ou com uma janela crônica que não seja maior que a aguda, as duas fatias são a mesma e a razão vale 1 por construção. Publicar esse 1 seria vender o artefato do acoplamento como medida.

**O campo de tamanho chama `seriesDays`, não `historyDays`.** `FormCurve.historyDays` é a distância da primeira atividade até hoje; aqui é o tamanho da fatia recebida, e `buildFormCurve` corta a série em 90 dias. Um atleta de cinco anos entrega milhares num campo e 90 no outro. Com o mesmo nome, um cartão que mostrasse os dois contaria histórias diferentes.

## Consequências

Passa a haver **três** números de carga no núcleo (`weekly-load`, `form-curve`, `training-load`), e um leitor desavisado pode pegar o errado. Mitigação: cada módulo abre com o docblock dizendo qual pergunta responde e apontando para os outros; esta ADR e a 0025 são citadas do código.

O `acwr` e a `monotony` são **razões**, e por isso sobrevivem a uma futura troca de unidade de carga. O `strain` e o `weeklyLoad` não: mudar `FORM_ZONE_WEIGHTS` muda os dois retroativamente, e o histórico inteiro passa a ter outro valor sem que nada tenha acontecido. Continuam comparáveis só consigo mesmos ao longo do tempo.

`null` é um estado de exibição de primeira classe, não um erro. A superfície da etapa 2 precisa ter um texto para cada `null` — crônica zerada, semana constante, semana parada, série curta — e não pode cair num "—" mudo, porque cada um deles significa uma coisa diferente. `monotonyReason` existe para tornar isso possível.

**Quem volta de um período parado fica sem número, e é o pior momento para isso.** Quatro semanas de zero seguidas de uma semana de treino dão `acwr: null`, porque a base é zero — justamente o salto que a métrica existe para enxergar. É a resposta matematicamente correta e a única honesta, mas cria uma obrigação para a etapa 2: dizer "você voltou de um período parado, e é aqui que se sobe devagar" em vez de esconder o cartão.

**Sync parado se disfarça de semana leve.** Silêncio de sincronização chega na série como zeros, zeros na janela aguda puxam o ACWR para baixo, e baixo é `undertraining` — a faixa mais tranquilizadora da escala. Quem exibir precisa cruzar com o `trusted` de `buildFormCurve` e não mostrar faixa nenhuma com dado velho.

**O último ponto da série é intradiário.** Hoje ainda não fechou, e esse dia parcial entra só na janela aguda, nunca na crônica desacoplada: de manhã o ACWR lê mais baixo e sobe ao longo do dia sem que nada tenha mudado no treino. É viés sistemático e pequeno numa semana de sete dias, mas existe.

As faixas vão aparecer numa tela e, por mais ressalva que se escreva, um número com cor de "risco" **é** lido como diagnóstico. É o custo aceito ao expor a métrica; a mitigação é textual e fica com a UI. Se a evidência virar contra as faixas, mudar os três números é uma edição num lugar só — mas muda a classificação de todo o histórico de uma vez, e por isso é ADR nova, não edição.

Reverter é barato enquanto não houver UI: apagar o módulo, o teste e o `export *`. Nada mais depende dele.
