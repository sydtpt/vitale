# 0030 — A prontidão não pontua dado velho, e abaixo de metade da informação não dá nota

**Data:** 2026-09-04
**Status:** aceita
**Relaciona-se com:** ADR 0024 (pisos de contraste), ADR 0025 (carga tem pesos próprios), ADR 0026 (VFC do intervals), ADR 0027 (ACWR desacoplado e faixas contestadas)

## Contexto

O item R2 da pesquisa competitiva mandava comparar o score de prontidão do Orbe
com os dos concorrentes. A comparação de fórmulas não foi o que apareceu.

**Em 04/09/2026 o cartão exibia 80.** O estado real dos sinais naquele dia:

| Sinal | Última leitura | Idade | Sub-score |
|---|---|---|---|
| VFC | 04/09 | 0 d | **52** |
| Sono | 31/08 | 4 d | 98 |
| FC repouso | 31/08 | 4 d | 100 |
| Anéis | 17/08 | **18 d** | ~100 |

O 80 não vinha de erro de conta. A média renormaliza sobre os componentes
presentes e nunca perguntou **de quando** eles eram, então três quartos do
número respondiam uma pergunta sobre domingo e eram publicados como se fossem
sobre sexta. O único sinal do dia era o mais baixo, e era o que menos aparecia.

Dois defeitos menores no mesmo caminho:

- **A meta de sono, fixa em 8 h com rampa linear, saturava.** Quatro das sete
  últimas noites marcavam 100 e o componente parava de distinguir noite boa de
  noite ótima.
- **A baseline era de 7 leituras.** Uma semana ruim virava a nova referência e
  apagava a melhora do trimestre. Os 4 bpm de queda na FC de repouso do dono
  ficavam invisíveis por construção.

## Decisão

### 1. Cada leitura carrega a idade, e acima de 3 dias sai do peso

`ReadinessInput` recebe `ageDays` por sinal e `ReadinessComponent` devolve
`ageDays` e `stale`. Acima de `READINESS_STALE_DAYS` (3) o componente **continua
na lista** — com o sub-score calculado, para a tela desenhá-lo apagado e dizer de
quando é — e **não entra** na média nem na cobertura.

Continuar na lista é a metade que importa: o corte antigo do mobile simplesmente
descartava leitura de mais de 7 dias, e por isso o cartão não tinha como dizer
"anéis, de 18 dias atrás". Só podia calar.

**Idade ausente conta como fresca.** É o que mantém funcionando quem ainda não
data suas leituras — hoje, a web —, e é uma armadilha declarada: um consumidor
que esqueça de passar as idades reabre exatamente este defeito.

### 2. Abaixo de metade do peso não há nota

`ReadinessScore.total` passa de `number` para `number | null`. Abaixo de
`READINESS_MIN_COVERAGE` (0,5) o módulo não pontua, e quem exibe mostra as
barras e a razão.

É o mesmo portão que a ADR 0027 aplica ao ACWR sem base. Um número renormalizado
sobre um sinal tem a aparência de um completo, e essa aparência é o problema —
não a imprecisão. No dia 04/09 o resultado é `null` com 0,20 de cobertura, que é
desconfortável e é a verdade.

### 3. O sono ganha joelho na meta, e a meta cai para 7 h

Duas retas: linear até 85 nas 7 h, mais rasa de 85 a 100 entre 7 h e 9 h.

A meta de 8 h é orientação de saúde e não estava errada — errada estava a rampa
única, que gasta a escala inteira antes da meta e depois trava. Com o joelho, as
sete noites reais do dono (3,2 a 8,5 h) se separam em 39–96 pontos, sem nenhum
teto. Dormir além da meta ainda conta, sem valer o mesmo que dormir dentro dela.

**Não se pontua contra a média pessoal.** Comparar a noite com o habitual de 5,9 h
normalizaria o sono curto: o app passaria a dizer "ótimo" para uma noite de 6 h
porque é o normal dele. Adequação e variação são perguntas diferentes, e esta é
de adequação.

### 4. A baseline vira 90 dias, com 14 ao lado sem pontuar

`READINESS_BASELINE_DAYS` (90) é a que entra na conta;
`READINESS_BASELINE_SHORT_DAYS` (14) viaja no componente para a tela poder
mostrar a deriva entre o habitual longo e o recente. Quando as duas discordam, a
mudança já virou o novo normal.

**A janela é de dias, não de leituras, onde as datas existem.** `rollingBaseline`
conta leituras, e as duas coisas só coincidem em série sem buraco: com um mês sem
sincronizar no meio, "90 leituras" alcança o ano passado. O adaptador do mobile
recorta por data antes de chamar; a web ainda conta leituras, e está registrado.

**No mobile isso exigiu uma segunda fonte.** As summaries do HealthKit cobrem 7
dias — com elas a "baseline longa" seria a curta com outro nome. As linhas de
`health_daily` cobrem 365, foram escritas pelo próprio app a partir do mesmo
HealthKit, e agora entram junto: o HealthKit vence empate de dia (é a fonte
fresca), a tabela estende o passado. A exceção é a VFC, em que SDNN e RMSSD
convivem (ADR 0026) e a baseline só usa leituras do mesmo tipo da mais recente.

### 5. A carga recente vira o quinto sinal

Alimentado pelo `acwr` desacoplado de `buildTrainingLoad` — a razão pronta, não a
série: o cálculo mora num lugar só e a prontidão não precisa conhecer a unidade
da carga, só o quanto ela subiu.

Abaixo do costume vale 100 (estar fresco não é demérito); acima, desconta. A
inclinação não é palpite nem empréstimo de estudo: é a que faz
`ACWR_BANDS.cautionMax` (1,5) cair exatamente em `READINESS_BANDS.lowBelow` (50).
São duas convenções deste código alinhadas de propósito, e o alinhamento está
declarado como convenção — **nenhuma literatura afirma essa correspondência**.

Peso 0,20, empatado com os anéis no menor: é o único componente que não mede o
corpo. É inferência do que foi feito, e não deve pesar mais que uma medida.

### 6. As faixas saem do conselho e viram constantes

`READINESS_BANDS` (50 e 70) estavam escondidas em `readiness-advice.ts` como
`LOW`/`HIGH`, o que significava que a recomendação classificava a nota com
números que o cartão não enxergava. Agora conselho, cartão e teste usam o mesmo
corte, e mudá-lo é uma edição num lugar só.

### 7. Os pesos não são recalibrados

Os quatro sinais do corpo mantêm exatamente a proporção histórica 30/25/25/20,
multiplicada por 0,8 para abrir os 0,20 da carga. Eles não vêm de estudo nenhum
documentado; mexer neles sem evidência trocaria um palpite por outro.

## Consequências

- **A prontidão do dono, hoje, não tem nota.** Com um sinal fresco de cinco a
  cobertura é 0,20. O cartão mostra as barras, a VFC acesa em 52, as outras três
  apagadas com a idade, e a frase que explica.
- **Adicionar o quinto sinal aperta a cobertura.** Faltar a carga sozinha deixa
  0,80; faltar carga e mais um sinal do corpo pode derrubar abaixo do piso onde
  antes havia número.
- **O cartão da Hoje cresceu 18 pt** (214 → 232). A proposta prometia cinco
  barras nos mesmos 214, e a medida desmentiu: cabiam, com 2 pt para os dois vãos
  do `space-between` contra os 10 pt de hoje. Caber é diferente de respirar.
- **A notificação parou de afirmar com dado velho:** o gatilho passou de "há
  componentes" para "há nota".
- **A web fica com quatro sinais e sem portão de frescor.** `latestFor` não diz
  de quando é a leitura e o ACWR vem das atividades, que aquele cartão não
  carrega. A cobertura de lá fica no teto de 0,80, e a superfície é história
  própria.
- **Os anéis passaram a ser os do dia mais recente.** Varrer a janela devolvia
  até 21 frações — sete dias de três anéis — que o núcleo mediava como se fossem
  os de hoje: um domingo cheio segurava a nota de uma quarta parada.

## Alternativas rejeitadas

**Deixar o sinal velho entrar apagado, mas ainda contando.** A nota não desabaria
e o cartão pareceria mais estável. O custo é que ela seguiria afirmando algo que
o dado não sustenta, que é o defeito inteiro desta ADR com outra roupa.

**Pontuar o sono contra a média pessoal.** Coerente com os outros sinais e mede
variação em vez de adequação — ao preço de deixar de dizer que 5,9 h é pouco.
Ver a decisão 3.

**Calcular a carga dentro da prontidão.** Duas famílias de métrica derivando
carga por conta própria é exatamente o que a ADR 0025 existe para impedir.

**Recalibrar os pesos junto.** Mudança de natureza diferente no mesmo commit:
tirar dado velho do peso é corrigir um defeito; mudar quanto cada sinal vale é
inventar um modelo, e nenhum estudo à mão sustenta os números novos.

**Manter os 214 pt espremendo o slide.** O cartão é julgado no aparelho, e um
encaixe sem vão nenhum lê como erro de layout, não como densidade.

## Referências

- Pesquisa competitiva, R2 — `_bmad-output/planning-artifacts/research/competitive-strava-e-apps-de-analise-de-exercicio-2026-09-02/research.md`
- Proposta e mockups: https://claude.ai/code/artifact/51547ca9-4bbd-4afa-8a90-56bdb923b9e8
- `packages/shared/src/health/readiness.ts` e o teste irmão
- `mobile/src/lib/health-readiness.ts`, `mobile/src/lib/readiness-slide.ts`
