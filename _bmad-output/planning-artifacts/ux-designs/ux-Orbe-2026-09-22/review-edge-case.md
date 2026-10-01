# Revisão: lente de caso de borda

**22/09/2026, 23h** · alvo: `EXPERIENCE.md`, `DESIGN.md` e os seis mockups do canvas (versão 10)
· **36 achados**, nenhum aplicado ainda — o dono escolheu aplicar na sessão seguinte.

A lente é rastreadora de caminhos: ela lista **só** o que não tem tratamento, sem severidade e
sem ranking. A ordem abaixo é de triagem (minha), não dela.

---

## Os três que mudam a jornada principal

1. **A corrida pode disparar uma compilação de 15 min.** Os chips de motor são pintados uma vez;
   se o iOS purgar o cache (ou a Apple Intelligence for desligada) depois disso, o motor continua
   marcado e o toque em Medir manda compilar — o oposto do que a tela promete.
   **Guarda:** reler `isCached` e o diagnóstico de cada motor marcado **antes** do laço; quem
   perdeu sai da corrida com o motivo.
2. **"Todo build nasce não compilado" é falso.** O cache é particionado por **build do iOS**, não
   do app: um build novo sobre o mesmo iOS abre com os modelos já compilados. A jornada 1 e a
   linha de nascimento assumem o contrário.
   **Guarda:** o estado nasce de `isCached` na montagem, nunca de constante.
3. **Duas compilações ao mesmo tempo.** Nada impede tocar Compilar numa segunda linha com a
   primeira em curso — dois modelos de 1 GB disputando memória é como o app morreu em 22/09.
   **Guarda:** com uma compilação em curso, o Compilar das outras linhas fica inerte, com
   "um modelo de cada vez".

---

## A tela de Compilar não tem fim (6)

| Condição | Guarda |
|---|---|
| `isCached` vira verdadeiro, ou o dono toca Parar | fase `correndo` / `terminou` / `parada`; terminou mostra "compilado · N min" e o caminho de volta |
| a especialização falha (disco, memória, pesos ilegíveis) | fase `falhou`, com o motivo vindo de `MOTIVO_DO_COREAI_EM_PALAVRAS` |
| as três etapas não têm evento que as avance | uma etapa só ("compilando"), ou a 2 fixa até o fim — senão parece travado por 15 min |
| o iOS encerra o app no meio | ao reabrir, sem carimbo e sem relógio; a linha diz "a compilação foi interrompida" |
| deslizar da borda esquerda durante a compilação | `gestureEnabled: false` enquanto compila, ou confirmação com o preço |
| parar aos 3 min e compilar noutro dia | só carimba duração quando `isCached` vira verdadeiro — senão "da última vez levou 3 min" vira promessa falsa |

## Contradições já escritas (3)

- **"Perder o foco mata a compilação" × lista e folha mostrando "compilando".** Uma das duas
  afirmações tem de cair.
- **O atalho da folha marca os motores daquela folha × "peso aberto nasce desligado".** As duas
  regras estão escritas e nenhuma vence.
- **O chip "Template · régua" nas duas leituras sem template.** O cartão explica a ausência; o
  chip continua prometendo.

## Guardas que faltam (8)

- tocar Compilar numa linha já compilada → recompila 15 min à toa
- `Medir` tocado duas vezes enquanto corre → duas corridas na mesma lista
- motor que não devolve nem resposta nem erro → botão `busy` para sempre (falta teto de espera)
- sair da tela no meio da corrida → motores correndo atrás de tela trocada
- `modelo/[id]` e `compilar/[id]` com id que o build não traz → tela em branco
- um build que embarque um modelo que **não cabe** (o caso medido do Qwen3-4B) não tem linha
- a gravação da preferência falha depois de a folha fechar → a escolha some sem nada dizer
- opção "consultando" tocável → grava preferência para motor que o diagnóstico vai recusar

## "Existe e não tem dado" (4)

- **Janela de sono sem noite nenhuma:** a fonte sempre devolve um caso, e sai `mudo` em todas as
  colunas — o mesmo sintoma que mordeu em 22/09 por outro caminho. `Medir` deveria ficar inerte
  com "esta janela não tem noite para ler".
- **"22 janelas" e "o ano" nas leituras sem amostra de N janelas.**
- **"Sem modelo" na Retrospectiva e no nome de rota** é lápide, e a folha a oferece como neutra.
- **Preferência apontando para motor que sumiu** → nenhuma opção marcada, sem explicação.

## Forma e acabamento (5)

- **O véu da folha no escuro:** `ink` a 60% é tinta **clara** — o véu clareia a tela de trás.
- **Chip de altura fixa (36 pt) com Texto grande** corta justamente o motivo do chip travado.
- **`regimeMaximo` não tem onde ser aplicado** nos chips (hoje os três recursos admitem nuvem; o
  quarto que não admitir sairia do aparelho para medir).
- **Janela (4.096) e "raciocínio longo desligado"** na ficha não estão em "onde a informação
  nasce" — número autorado, que é o que esta família existe para não fazer.
- **O total do cabeçalho** soma tamanhos medidos à mão; modelo novo entra sem número.

---

## O que NÃO é aplicável por escrita

Duas, e são as que já estavam abertas: **bloquear a tela mata a compilação?** e **parar recomeça
do zero?** Ambas custam uma compilação inteira para medir; a cobaia proposta é o Qwen3-0.6B.
Enquanto não houver medida, a tela não afirma.
