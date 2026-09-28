# Retomar a 4.2a — onde paramos (28/09/2026, 13h13)

Escrito para a sessão seguinte. A story parou **no meio da iteração 2**, com um
subagente ainda escrevendo. Se você está lendo isto, **confira o disco, não este texto**.

## Estado

- **Worktree:** `/Users/sydtpt/Projects/life-organizer-wt-revista-3-1`
- **Branch:** `feat/revista-4-2`, baseline `7e5f26db5b3cd02d23de117821b4f932b3d9c94d`
- **Spec:** `spec-4-2a-o-motor-do-teste-lunar.md`, `status: in-progress`,
  `review_loop_iteration: 1`
- O trabalho está **commitado como WIP e empurrado**.
- **`mobile/ios/`** é saída de build gerada. **Não apague** — refazê-la custa ~20 min.
  O disco estava em **97%**.

## O que já aconteceu

1. A **4.2 foi dividida** em 4.2a (o motor, puro) e 4.2b (o registro), por decisão do
   dono. A 4.2b está inteira na `deferred-work.md`, com o escopo e a **terceira
   correção** descritos por extenso.
2. **Iteração 1 foi implementada, revisada e REVERTIDA** por `bad_spec`.
3. **Iteração 2 estava rodando quando a sessão pausou.** Os arquivos existem no disco
   (`lua-protocolo.ts` 36 KB às 12:57, `lua-protocolo.test.ts` 40 KB às 13:10, mais
   `astro/moon.ts`, `sleep/lua.ts`, `lua.test.ts` e `index.ts` modificados), mas
   **eu não rodei portão nenhum contra eles**. Não afirme que passam.

## O defeito que derrubou a iteração 1

`resolverFase` não consultava o poder em dois dos quatro ramos:

```ts
const veredito = significante
  ? passaLimiar ? 'achado' : 'nenhum_padrao'   // nenhum dos dois olhava `poder`
  : poder >= PODER_MINIMO ? 'nenhum_padrao' : 'inconclusivo';
```

A §5 de 07/09 e a §6 de 28/09 exigem `poder ≥ 80%` para **achado**, e mandam
`inconclusivo` sempre que `poder < 80%`. Com 290 noites o poder para 15 min fica entre
39% e 69% nas três fases novas — **o ramo defeituoso é o provável**. A causa-raiz foi a
linha da matriz da spec, que dizia "poder < 80% **e nada significante**" e estreitou uma
condição que os documentos escrevem sem conjunção. A matriz é frozen e **não foi
editada**; a tabela literal entrou nas Design Notes, que são a autoridade agora.

## O que a revisão de iteração 1 achou, para não re-descobrir

Já está tudo virado em tarefa na spec. As três que valem lembrar, porque foram
**provadas por mutação** e não por leitura:

- **Apagar a covariável de luz deixava a suíte verde.** `residuo = apagou` passava em
  tudo, e movia os números publicados (`p` de 0,0312 para 0,2518 numa fase).
- **Inverter a precedência dos portões deixava a suíte verde.** Com a luz depois da
  amostra, um buraco de luz com coluna curta diria "faltam 2 noites" — mandando esperar
  noites quando o que trava é um valor ausente.
- **A tupla `QuatroLinhas` era imposta por `as`**, que não confere aridade: uma quinta
  fase compilava, contra o que o docblock e a AC afirmam.

Menores, também na spec: `sd = 0` dava poder 100%; `onsetAt`/`tzOffset` sem validação
propagavam `NaN` até o veredito; a origem de 18h tem a mesma borda da meia-noite
deslocada (17h50 → 1430); `TRIGGER_MIN_PER_CELL` é constante de outra feature; o portão
da luz não dizia **quantas** noites faltaram; a guarda de superfície pública não fechava
`export {}` / `export default` / `export *`.

## O que fazer ao retomar

**Primeiro, o disco:**

```bash
cd /Users/sydtpt/Projects/life-organizer-wt-revista-3-1
git status --porcelain
pnpm --filter @vitale/shared lint >/dev/null 2>&1; echo "exit=$?"
pnpm --filter @vitale/shared test >/dev/null 2>&1; echo "exit=$?"
```

Portões **por exit code**, nunca por grep: uma barreira do `architecture.test.ts`
derruba o runner em vez de imprimir `not ok`.

**Depois**, confira contra a spec — em especial as **quatro provas negativas** que a
seção Verification manda rodar e registrar: SD residual reprova, luz apagada reprova,
portão da luz invertido reprova, quinta linha não compila. A iteração 1 rodou só a
primeira.

**Então** siga o `bmad-build` do step-04: revisão em três camadas. O pacote de revisão
tem de incluir os arquivos novos — `git diff <baseline>` **não pega arquivo não
rastreado**; acrescente `git ls-files --others --exclude-standard`.

## Regra que vale acima de tudo nesta story

**Nenhum dado lunar pode ser consultado, por ninguém.** Nem mediana por fase, nem
contagem por coluna, nem "só para ver se o portão passaria". O único número permitido é o
desvio-padrão **marginal** da hora de apagar. Medir em produção antes de desenhar é o
método padrão deste repositório — **aqui está proibido**, e consultar invalida os dois
pré-registros.

## Fora da 4.2a, esperando o dono

- As **nove reimpressões dirigidas** da luz solta: uma a uma, com
  `--tipo <t> --inicio <d> --caderno <c>`. **Não** `--massa`, que hoje ofereceria 50.
- O disco em **97%** — o `mobile/ios/` deste worktree são ~4 GB que dá para devolver
  quando ele não estiver buildando.
- A 4.1 está `review` na sprint, esperando o veredito dele.
