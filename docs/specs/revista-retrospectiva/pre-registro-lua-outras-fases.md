# Pré-registro — as outras três fases × início do sono

> **Escrito em 28/09/2026, antes de qualquer consulta ao dado.** Nenhuma mediana,
> nenhuma contagem por fase e nenhum cruzamento lunar foi olhado antes deste
> texto — nem para a cheia, nem para as outras três. O único número consultado até
> aqui é a contagem total de noites (290), que não distingue fase.
>
> **Este arquivo é imutável**, pelas mesmas razões do de 07/09. Correção só por
> documento novo, que cite este e diga o que mudou e por quê.
>
> **Documento irmão, não substituto:**
> [`pre-registro-lua.md`](pre-registro-lua.md) (07/09/2026) segue valendo palavra
> por palavra. Este acrescenta as três fases que ele não cobria, e **não altera
> nada nele** — a §2 diz exatamente o que fica de fora do alcance deste texto.

## 1. Por que isto existe, e por que agora

O documento de 07/09 pré-registrou **uma** exposição: as cinco noites que
antecedem a lua cheia. A story 4.1 construiu a efeméride, e ela entrega as
**quatro** fases principais ao minuto (`LunarPhaseKind`: `'new'`,
`'firstQuarter'`, `'full'`, `'lastQuarter'`). Assim que existe a efeméride
completa, existe a tentação — e a tentação tem nome técnico: quatro comparações
onde o protocolo fixou uma.

Há também uma razão de ordem, que é o motivo de este texto vir **antes** da
primeira execução da 4.2 e não depois: a coluna "fora" do teste da cheia
**contém as noites das outras três fases**. Rodar a 4.2 e olhar aquela coluna já
entrega parte da resposta que este documento tem de fixar às cegas. Depois da
primeira execução, este pré-registro seria impossível de escrever honestamente.

## 2. O que este documento não faz

- **Não muda o α da cheia.** Ela continua a 5%, unilateral, na direção do atraso.
- **Não muda a janela, o instante da noite, o desfecho nem os limiares** do
  documento de 07/09. A janela segue `[fase − 5 d, fase)`, e a noite segue
  representada por 08:00 UTC do `wakeDay` — nunca pelo `apagou` medido, que é o
  desfecho.
- **Não reabre a covariável de luz**, que continua pré-requisito e não ressalva.
- **Não põe secundários nas três fases novas.** Ver §8.

**O preço desta escolha, escrito em voz alta:** a partir daqui **não existe "eu
testei as quatro fases"**. Existem dois testes de proveniência diferente — um
confirmatório a 5%, pré-registrado sozinho em 07/09 com direção derivada de
literatura, e uma família de três a 1,67% cada, nascida depois e sem direção
própria. Qualquer página, qualquer frase da revista e qualquer relato posterior
que junte os quatro num só resultado está errado, e este parágrafo é o que
autoriza chamá-lo de errado.

## 3. A decisão da multiplicidade

**Escolha do dono, 28/09/2026: a cheia é família própria; as três dividem um α
separado.** α = 5% / 3 = **1,67%** para cada uma das três.

O argumento é de **procedência, não de conveniência**. A correção por
multiplicidade existe para punir quem *escolhe* entre muitas comparações depois
de olhar. A cheia não foi escolhida entre quatro: em 07/09 ela era a única
exposição que existia, fixada num documento datado, com hipótese direcional
tirada do Casiraghi 2021, e as outras três não estavam no horizonte do
documento. Rebaixá-la agora seria punir retroativamente um compromisso que foi
cumprido.

As três, ao contrário, nascem **juntas e ao mesmo tempo**, sem nenhuma que
tenha precedência sobre as outras. Entre elas a correção se aplica integralmente.

Os dois caminhos recusados, com o motivo:

| Caminho | Por que não |
|---|---|
| **Bonferroni nas quatro** (α 1,25% cada) | honesto e severo, mas rebaixa retroativamente um teste que foi pré-registrado sozinho e cumprido. E a 45 min de dispersão levaria a fila de espera de 396 para 610 noites |
| **As três nascem exploratórias** (sem α) | não gasta poder nenhum e preserva a opção de testar depois — foi a recomendação escrita, e foi recusada. O dono quer veredito, não descrição |

## 4. O desenho das três

Idêntico ao da cheia em tudo o que não é a fase:

| | |
|---|---|
| **Sujeito** | o mesmo indivíduo; `sleep_periods` |
| **Desfecho primário — um só, o mesmo** | **hora de apagar**, em minutos desde a meia-noite |
| **Exposições** | as **5 noites que antecedem** a lua nova · o quarto crescente · o quarto minguante |
| **Janela** | `[fase − 5 d, fase)`, fechada à esquerda e aberta à direita |
| **Colunas** | duas por fase. Cada fase contra **todas as outras noites** — ver §7 |
| **Direção** | **bilateral** — e isto não é detalhe, é a §5 |
| **α** | **1,67%** por fase (5% / 3) |
| **Covariável obrigatória** | horas de luz do dia na latitude do sujeito (~50,8° N) |

A geometria é a mesma da cheia por construção: cinco noites por ciclo sinódico,
~17 ciclos no intervalo, estimativa de ~49 noites dentro e ~241 fora por fase.

## 5. Por que bilateral, e não unilateral como a cheia

Esta é a consequência que o caminho escolhido arrasta, e ela custa poder.

A cheia é unilateral porque **tem mecanismo e tem direção**: o Casiraghi 2021
mediu sono atrasado e mais curto nas noites que antecedem a cheia, e a hipótese
usual é luz noturna crescente no início da noite. Nas noites que antecedem a
cheia, a lua está alta e brilhante nas primeiras horas da noite — é ali que o
mecanismo, se existe, opera.

**Esse mecanismo não transfere.** Antes da lua nova não há luz lunar no início
da noite nenhuma; nos quartos há metade de um disco, em horários deslocados. Não
existe literatura que dê direção a essas três, e **testá-las unilateralmente na
direção do atraso seria emprestar a hipótese da cheia sem a razão que a
justificou** — que é exatamente a forma elegante de p-hacking que este par de
documentos existe para impedir.

Então: **bilateral**. Adiantamento e atraso contam igual, e um resultado em
qualquer direção é um achado. O preço está na tabela da §6, e é alto.

## 6. Os portões, os vereditos e o poder

### Portões — cada fase só roda se os três passarem, por conta própria

1. **Amostra por coluna:** ≥ 5 noites de cada lado (`TRIGGER_MIN_PER_CELL`).
2. **Ciclos distintos:** ≥ **10** ciclos sinódicos contribuindo com ao menos
   uma noite na janela **daquela fase**. As 49 noites podem vir de oito ciclos, e
   oito replicações internas é menos do que o desenho promete. Para contar, use
   `evento.instant.getTime()` — cada chamada da efeméride devolve um `Date` novo,
   e um `Set<Date>` contaria cada noite como um ciclo.
3. **Luz do dia disponível** para todas as noites de ambas as colunas.

Portão reprovado ⇒ **inconclusivo** para aquela fase, nunca "nenhum padrão".

### Vereditos — os mesmos três, com o mesmo limiar

O limiar prático continua **15 minutos** de deslocamento mediano, agora em
módulo. Significante e menor que 15 min é **nulo prático**.

| Veredito | Condição | O que a página diz |
|---|---|---|
| **Achado** | \|Δ\| ≥ 15 min · p < 0,0167 bilateral · poder ≥ 80% | o efeito medido, com o sinal, sem mecanismo e sem causa |
| **Nenhum padrão** | não significante **com poder ≥ 80%** | não há efeito detectável de 15 min ou mais nesta fase |
| **Inconclusivo** | poder < 80%, ou qualquer portão reprovado | **quantas noites faltam** |

### Poder, calculado antes de olhar

n = 49 dentro × 241 fora, **bilateral**, α = 1,67%:

| SD da hora de apagar | efeito mín. detectável (80%) | poder p/ 15 min | poder p/ 30 min |
|---|---|---|---|
| 30 min | 15,2 min | 79% | 100% |
| 45 min | 22,8 min | 39% | 97% |
| 60 min | 30,4 min | 21% | 79% |
| 75 min | 38,0 min | 13% | 56% |
| 90 min | 45,6 min | 9% | 39% |

Noites totais para 80% de poder em 15 min: **672** (SD 45) · **1.193** (SD 60) ·
**1.864** (SD 75). Ele tem 290.

**Este documento pré-registra, portanto, três testes que muito provavelmente
sairão "inconclusivo" na primeira execução, e provavelmente na segunda.** Isso é
aceito por escrito, aqui, antes de rodar. A comparação que importa, e que fica
registrada para não ser esquecida depois:

| | efeito mín. detectável (SD 45) | poder p/ 15 min | noites p/ 80% |
|---|---|---|---|
| **cheia** — 5%, unilateral | 17,5 min | 69% | 396 |
| **cada uma das três** — 1,67%, bilateral | 22,8 min | 39% | 672 |

A diferença entre as duas linhas é o custo da escolha da §3 somado ao da §5. Ela
não é um defeito do documento: é o que se paga para poder dar veredito sobre as
três em vez de apenas descrevê-las.

As contas saem da aproximação normal para duas amostras na razão 49 : 241, e a
conferência delas foi **reproduzir a tabela da §5 do documento de 07/09** sob os
parâmetros dele — 17,5 min e 69% a 45 min de dispersão, e as cinco linhas
inteiras. A linha da cheia acima é citada de lá, não recalculada aqui.

### O único número que pode ser consultado antes

**O desvio-padrão da hora de apagar**, marginal, sem separar por fase — a mesma
permissão do documento de 07/09, e pela mesma razão: dispersão revela se o teste
tem poder para existir, sem revelar o resultado. **Nenhuma** estatística separada
por fase, de nenhuma das quatro, pode ser olhada antes da execução autorizada.

## 7. A contaminação das colunas, declarada

Quatro janelas de cinco noites ocupam vinte dos 29,5 dias do ciclo sinódico —
**68% dele**. Sobram ~9,5 noites por ciclo fora de todas as quatro, o que dá
aproximadamente **93 das 290** noites.

Consequência: quando uma fase é comparada contra "todas as outras noites", a
coluna de controle **contém as janelas das outras três**. Duas saídas existiam:

- **coluna limpa** — cada fase contra as ~93 noites de nenhuma janela. Colunas
  independentes, e poder ainda menor: o efeito mínimo detectável passaria de 22,8
  para 25,7 min a 45 min de dispersão, e as três deixariam de ser comparáveis
  com a cheia, que usa "todas as outras".
- **contra todas as outras** — o que a cheia faz, mantido aqui para que as quatro
  sejam diretamente comparáveis.

**Escolhida a segunda**, com a limitação declarada: se uma fase tem efeito, ela
eleva a coluna de controle das outras três, e o deslocamento delas fica
**subestimado**. O viés é **para o nulo** — ele esconde achado, não fabrica. Um
viés conservador é aceitável num teste confirmatório de um jeito que um viés a
favor do achado nunca seria, e é essa assimetria que sustenta a escolha.

## 8. Secundários — nenhum, para as três

Duração, latência e número de despertares **não** são relatados por fase para as
três novas. O documento de 07/09 os manteve como exploratórios para a cheia; para
as três, três fases × quatro desfechos são doze comparações, e o par de documentos
existe para não chegar lá.

Fora do escopo por decisão explícita, como antes: as 14 métricas de
`health_daily`, hábitos e registros.

## 9. As quatro rodam juntas, ou nenhuma roda

Regra nova, que o documento de 07/09 não precisava ter porque havia um teste só:

**Uma execução autorizada calcula as quatro fases, grava as quatro e publica as
quatro.** É proibido rodar uma fase, ver o resultado e decidir se roda as outras
— essa é a forma que o jardim dos caminhos que se bifurcam toma quando há quatro
portas e nenhuma regra de ordem.

A cadência permanece a do documento de 07/09: reexecuta a cada **+100 noites**,
não por vontade. As três novas entram nessa mesma cadência, e a primeira execução
delas é a primeira execução da 4.2 — a mesma.

## 10. Contra refazer até dar certo

Toda a máquina da §7 do documento de 07/09 se aplica a este arquivo, sem
exceção: a **sha256 deste texto** entra no código como constante ao lado da do
outro; toda execução grava linha em `edicoes_ia` com `caderno='lua'` e **os dois
hashes** que a autorizaram; hash divergente com execução já gravada **quebra o
build**; a página mostra o contador de execuções.

Uma dívida herdada, nomeada aqui para não se perder: `JANELA_LUNAR_NOITES`,
`HORA_UTC_DO_FIM_DA_NOITE` e a borda aberta à direita vivem em
`packages/shared/src/sleep/lua.ts`, **fora de qualquer documento hasheado**.
Mudar uma delas depois de ver o resultado desloca a coluna testada **sem quebrar
o build**. A story 4.3 decide se a barreira passa a cobrir essas constantes
também; até ela existir, a proteção deste par de documentos tem esse buraco, e
ele está escrito.

## 11. Onde isto aparece na revista

Na **mesma página** da cheia, dentro do caderno Sono — não numa página nova.
Quatro fases em quatro páginas seriam quatro promessas de conteúdo recorrente
onde há uma execução a cada cem noites.

A página nomeia as duas famílias separadamente e **mostra os dois α**. Uma página
que imprima os quatro resultados com a mesma tipografia, sem dizer que um vale a
5% e três a 1,67%, desfaz no leitor a distinção que a §3 deste documento pagou
para manter.

## Fontes

As mesmas quatro do documento de 07/09, que não se repetem aqui — ver
[`pre-registro-lua.md`](pre-registro-lua.md#fontes). Nenhuma literatura nova foi
consultada para este texto, e a ausência dela sobre as três fases é justamente o
argumento da §5.
