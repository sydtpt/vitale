# Bases, trajetória, ranqueamento e verificação

Companion de [`spec.md`](spec.md). Cobre CAP-4, CAP-5, CAP-7 e CAP-11.

## As três bases nomeadas

`FatoNumero` deixa de ter `atual`/`anterior`/`delta` e passa a ter `atual` mais um
array de bases **identificadas**.

| id | O que é | Existe quando |
|---|---|---|
| **B1** | o período anterior | sempre |
| **B2** | o mesmo período do ano anterior | conforme a fonte — atividades desde 22/05/2023, saúde 24/03/2025, sono 23/04/2025; registros, hábitos e notas **não antes de mai–jun/2027** |
| **B3** | **a normal dele para este período** — média dos mesmos meses em todos os anos disponíveis | ≥ 2 anos da fonte |

B3 é o que transforma *"você pedalou menos"* em *"você pedalou menos do que você
costuma pedalar em novembro"*.

## Trajetória — e por que não uma quarta base

```ts
FatoTendencia { chave, direcao: 'sobe' | 'cai' | 'oscila', periodos: n, desde: rotulo }
```

Nenhum valor bruto. Três razões, e a terceira decidiu:

1. **Duas bases consecutivas respondem quase a mesma pergunta.** Base serve para
   *comparado com o quê*; "dois meses atrás" responde uma pergunta e meia.
2. **Custo.** Uma base nova põe **N números** no alfabeto da verificação; a
   trajetória põe **um inteiro**. Pelo mesmo preço ela entrega 3, 6 ou 12 períodos de
   direção — mais história do que duas bases dariam, por menos.
3. **É a única comparação que o caderno Rotina consegue antes de mai/2027**, porque
   só precisa de períodos consecutivos.

E lê melhor: *"caiu 12% contra julho, e 8% contra junho"* é planilha; *"cai pelo
terceiro mês seguido"* é frase.

## A quinta regra: o texto nomeia a base

**Base citada sem nome reprova.** Reprovação, não aviso — igual às quatro que já
existem em `verificar.ts`.

A verificação deixa de perguntar *"esse número existe?"* e passa a perguntar *"esse
número existe **como B2**, e a frase diz **B2**?"*.

Três bases **sem** nome é um alfabeto três vezes maior. Três bases **com** nome é uma
**gramática**: o número tem que bater e a preposição junto. Um texto que escreve
"435 km, contra 380 no ano passado" e inverteu as bases hoje passa; com a regra,
reprova.

### Por que ela é conserto, não viabilizador

Medição feita em 07/09/2026 sobre o pacote real de agosto (`ia/pacote.test.ts`, o
golden set):

```
módulos 6 · FatoNumero 20 · correlações 0 · eventos 0 · lacunas 0
valoresDoPacote 71   ·   numerosDoPacote 80

inteiros entre 0 e 100 presentes no alfabeto: 16
  0  2  4  6  7  8  9  11  17  21  29  31  39  49  57  80
```

**Um inteiro alucinado entre 0 e 100 passa na conferência 16% das vezes — hoje, com
uma base só.** Com três bases sem nome, perto de 50%. Números com uma casa decimal
passam a 3,6%: o risco é **inteiro pequeno**, que é exatamente o formato de "21
atividades" e "7 noites".

E o alfabeto de 71 é com correlações, eventos e lacunas **vazios**. Quando o balde
da §3.2 do brief entrar, o crescimento vem dos cadernos, não das bases — que é o
argumento decisivo para **um pacote por caderno** (CAP-3): seis pacotes de 40 são
muito mais seguros que um de 240, e o caderno de Sono nunca precisa saber quantos
quilômetros o dono pedalou.

## O ranqueamento do miolo

```
ordenarCadernos(pacotes) → CadernoId[]      // pura, determinística
```

1. **Afastamento** — o maior `|deltaPct|` entre as métricas do caderno, contra a base
   nomeada daquela métrica.
2. **Portão** — a métrica que forneceu o afastamento precisa de
   `cobertura.comparavel === true` **e** n suficiente. Sem isso o caderno não concorre
   à liderança; entra na ordem, atrás.
3. **Confiança** — peso da base disponível: B2/B3 > B1 > só trajetória.
4. **Desempate** — ordem do catálogo. Fixa, para a função nunca ser ambígua.
5. **Lápide** — posição 1 forçada **só** se a última medida da métrica cair dentro
   deste período.
6. **Vazio** — fora da lista.

O passo 2 existe porque **amostra pequena varia mais**: sem ele, Rotina lideraria
todo mês por ser o caderno mais novo e mais volátil. Efeito grande com amostra pequena
é ruído com aparência de manchete — o mesmo raciocínio do pré-registro da lua.

**Não é conselho.** Escolher qual fato merece a capa é jornalismo; dizer o que fazer
com ele é conselho, e continua proibido.

O teste é a **função**, não o layout: dada uma entrada, a ordem é determinística.

## Ausência declarada

| Caso | Comportamento |
|---|---|
| **Caderno vazio** — não aconteceu nada | **some**. Sem espaço reservado, sem "nenhuma atividade registrada" |
| **Caderno cego** — o sensor morreu e o app não sabe | **lápide** no pé do caderno que possuía a métrica: nome, última data, ponto |
| **Base inexistente** | declarada **no pacote**, como fato |

A lápide **vira capa uma vez só**: na edição do período **em que a métrica morreu**
(condição testável: *a última medida cai dentro deste período*). Agosto/2026 é o mês
em que os anéis pararam; setembro não é. Sem essa regra ela lideraria toda edição
para sempre — sensor morto não ressuscita sozinho — e depois da terceira o leitor
para de ver.

Nada de "verifique suas conexões": isso é conselho. **O alerta operacional sai da
revista** e vai para Conexões ou notificação, com o tempo do agora — a edição
congela, e em 2030 a de agosto/2026 ainda dirá que a respiração parou, o que como
história está certo e como alerta é ruído de quatro anos atrás.

E a regra que fecha o buraco: o modelo **não pode descobrir** sozinho que não há ano
anterior; ele tem que ser **informado** de que não há. Sem a lápide, a revista narra o
silêncio como melhora — *"sua respiração está estável"* quando não há respiração há
dois meses.
