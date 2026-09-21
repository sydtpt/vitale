# Story 5.11 — as rodadas do pedido v2 no aparelho

> **Só números e chaves.** Nenhum texto de leitura entra aqui (AD-8/AD-11). O que o modelo escreveu,
> o template e a frase final ficam nos relatórios da bancada, fora do git, em
> `~/Orbe-dados/sono-2026-09-12-aparelho/`. As janelas aparecem pela chave `range@passo`.
>
> **Sem veredito.** Os números estão ao lado da régua da ADR 0050, mas a comparação é do dono.

## O número que vai ao dono

A versão que está na branch é a **versão corrigida** (ver "A remedição", abaixo), medida no aparelho em
`--limite 6`.

| | aprovadas | pedidos distintos |
|---|---|---|
| **fora do ajuste, com pedido que o ajuste não viu** | **15 de 24 (62,5%)** | 16 |
| fora do ajuste, todas | 29 de 39 (74,4%) | 24 |
| linha de base, v1 (as 22 de ajuste, medição da 5.10) | 3 de 22 (13,6%) | 18 |

**Por que o número de destaque é o de 24, e não o de 39.** Janelas no mesmo caso × `range` × dimensões
recebem o mesmo pedido, pelo mesmo hash, e a amostragem é gulosa. Das 39 janelas fora do ajuste, **15**
compartilham o pedido com uma janela de ajuste. Elas repetem, por construção, a resposta que o ajuste
já viu, e não medem nada de novo. As **24** restantes trazem **16** pedidos que o ajuste nunca mandou ao
modelo.

A v1 nunca rodou nessas 24 nem nas 39. A linha de base é das 22 de ajuste; a regra da amostra é a
mesma, mas as janelas não são.

### Ao lado da régua da ADR 0050

Os números são os da corrida de validação inteira (61 janelas). A régua é a da ADR, copiada aqui só
para ler ao lado.

| condição | régua da ADR 0050 | versão corrigida, 61 janelas |
|---|---|---|
| 1. aprovação | ≥ 90% das janelas medidas | 46 de 60 (76,7%) — 1 janela fora da medida (abaixo) |
| 2. cobertura | os sete casos, nos dois alcances (14 combinações) | 11 de 14, as 11 com aprovada |
| 3. idênticas | nenhuma aprovada idêntica ao template | 0 de 46 |
| 4. tempo | mediana ≤ 20 s por chamada | 1,6 s (58 medidas; 2 frias fora) |

**Três combinações não existem neste acervo**: sem-contagem/noite, medidas-insuficientes/período e
tudo-no-maximo/período. Nenhuma amostra dele mostra as 14, com qualquer motor.

### A cópia do exemplo — agora contada pelo código

A condição 3 só compara a aprovada com o template. O pedido v2 traz também um exemplo de frase aprovada,
e um motor que devolve esse exemplo marca zero idênticas ao template. A bancada passou a contar isso
(bloco "A cópia do exemplo do pedido" do relatório, `formaDaAprovada` em `scripts/bancada/relatorio.ts`).
A regra, a mesma escrita no relatório, é:

- **idêntica**: o texto do motor é o exemplo, a menos do espaço nas pontas;
- **quase**: as mesmas palavras a menos da pontuação, de uma palavra trocada, tirada ou posta, ou o
  exemplo cortado no fim;
- **texto próprio**: o resto.

| aprovadas | idênticas ao exemplo | quase o exemplo | texto próprio |
|---|---|---|---|
| fora do ajuste, pedido não visto (15) | 7 | 5 | 3 |
| fora do ajuste (29) | 15 | 10 | 4 |
| todas (46) | 24 | 16 | 6 |

**25 das 29 aprovadas fora do ajuste (86%) são o exemplo, idêntico ou quase.** Na corrida inteira, 40 de
46 (87%).

## As condições

| | |
|---|---|
| motor | `aparelho:sistema` — apple / system-language-model, macOS 27.0, build 26A428 (o mesmo da 5.10) |
| CLI | `Apple Swift version 6.4 (swiftlang-6.4.0.34.1 clang-2100.3.34.1)` |
| acervo | 293 noites · 89 notas · `7819e989eb1c` · hoje 2026-09-10 (a cópia de 12/09 em `~/Orbe-dados/sono-2026-09-12-aparelho/`) |
| amostra de ajuste | `recentes-por-caso-e-alcance` v1, `--limite 2` → 22 janelas, 11 das 14 combinações |
| amostra de validação | a mesma regra, `--limite 6` → 61 janelas, que contêm as 22 de ajuste |
| sonda | não rodou: o descritor dela não mudou |
| custo | nenhum — só o modelo local; nenhuma chamada de nuvem |

**Como ler as colunas.**

- **"Regras"** são os problemas das janelas **reprovadas**, contados como o relatório conta ("Por
  regra da conferência"). Uma janela reprovada pode somar mais de um.
- **"Recusas"** são as janelas com desfecho `recusa-do-modelo`, contadas à parte. "(ausente)" quer dizer
  que a conferência não achou no texto o que o caso exige — o nome da dimensão, o marcador ou a palavra
  do alcance — e que nada mais estava errado. É por esse critério que ela separa recusa de erro.

**A impressão de cada versão.** Nada foi commitado durante as rodadas, então não há sha de código. Cada
versão do pedido fica identificada por duas impressões, os 12 primeiros caracteres de um sha256:

- a **dos pedidos**: o sha256 dos hashes distintos dos pedidos das 22 janelas de ajuste, ordenados, um
  por linha;
- a **do sistema**: o sha256 do texto `sistema`.

Qualquer um recalcula as duas do relatório de cada rodada.

## A linha de base — o pedido v1 (medição da 5.10)

Relatório `relatorio-fd45f94f1152-2026-09-19T08-03-54-533Z`. Impressão dos pedidos `2d0c2a33fec6`,
do sistema `41a3040bc8d7`.

| aprovadas | reprovadas | recusas | regras | idênticas ao template | mediana |
|---|---|---|---|---|---|
| **3 de 22 (13,6%)** | 19 | 0 | forma 28 · ausente 14 · extenso 9 · marcador 4 · algarismo 2 · chave 2 · contradicao 2 · a-mais 1 | 0 | 1,6 s |

## As três rodadas de ajuste (`--limite 2`, as mesmas 22 janelas)

| rodada | impressão dos pedidos · do sistema | aprovadas | reprovadas | recusas | regras | cópia (idêntica · quase · própria) | mediana | estado |
|---|---|---|---|---|---|---|---|---|
| 1 | `c1cf887c3ab9` · `3b56ee43e509` | **19 de 22** | 2 | 1 (ausente) | ausente 1 · chave 1 · marcador 1 · vocabulario 1 | 6 · 7 · 6 | 1,6 s | **a base da versão final** |
| 2 | `406f99611487` · `3b56ee43e509` | 13 de 22 | 9 | 0 | marcador 7 · ausente 4 · chave 3 | 3 · 8 · 2 | 1,6 s | **descartada** |
| 3 | `ab4b2b694ef9` · `3b56ee43e509` | 4 de 22 | 16 | 2 (ausente) | marcador 24 · chave 7 · ausente 5 | 3 · 1 · 0 | 1,7 s | **descartada** |

**Rodada 1 — prosa corrida e o exemplo do caso.** Relatório
`relatorio-5bb7f8e6d8db-2026-09-19T08-46-34-927Z`.

- *Hipótese*: o modelo pequeno copia a forma do que recebe, e a ficha `Rótulo: valor` da v1 volta como
  resposta. A rodada diz o mesmo em prosa, sem nenhuma linha que abra com rótulo e dois-pontos, e fecha
  com um exemplo de frase aprovada do caso.
- *Resultado*: a regra `forma` foi de 28 problemas para 0, e `extenso` de 9 para 0.

**Rodada 2 — tirar "janela" do sentido do marcador, e deixar os marcadores opcionais.** Relatório
`relatorio-5bb7f8e6d8db-2026-09-19T08-52-47-613Z`.

- *O que mudou*: **duas coisas ao mesmo tempo**. (a) O sentido de `{janela}` passou a dizer "a noite
  lida" / "o período lido". (b) A lista de marcadores passou a dizer "use só os de que ela precisar".
- *Resultado*: mais marcador inventado ou fora do lugar. Como as duas mudanças entraram juntas, a
  rodada não diz qual delas pesou.
- *Estado*: descartada, e o código voltou à rodada 1.

**Rodada 3 — as linhas de marcador como instrução.** Relatório
`relatorio-5bb7f8e6d8db-2026-09-19T08-55-12-926Z`.

- *O que mudou*: cada linha `{marcador} é …` virou "para dizer …, use {marcador}". O (a) da rodada 2
  ficou; a introdução voltou à da rodada 1.
- *Resultado*: o modelo passou a pôr preposição antes de `{janela}`/`{quando}` e a inventar marcador de
  dimensão.
- *Estado*: descartada, e o código voltou à rodada 1.

## A validação da rodada 1 — superada pela remedição

Relatório `relatorio-9c5838fc6e8f-2026-09-19T08-58-19-064Z`, `--limite 6`, 61 janelas. É o número da
versão da rodada 1 antes da revisão, e **não é o da versão que está na branch**. Fica para comparação.

| | aprovadas | pedidos distintos | cópia (idêntica · quase · própria) |
|---|---|---|---|
| fora do ajuste, pedido não visto | 17 de 24 (70,8%) | 16 | — |
| fora do ajuste | 32 de 39 (82,1%) | 24 | 12 · 11 · 9 |
| todas | 51 de 61 (83,6%) | — | 18 · 18 · 15 |

Casos fracos fora do ajuste nessa corrida: **uma/noite, 1 de 4**, e **fora-do-empate/noite, 1 de 3**.

## A remedição — a versão corrigida

**Por quê.** A revisão da 5.11 pediu consertos no pedido:

- o `sistema` dizia que o pedido termina no exemplo, e ele termina no pedido da resposta;
- as regras "curta", "sem marcação" e "nada que o **caso** não diga", da v1, voltaram ao texto;
- as dimensões citáveis entram sempre que houver;
- o texto dos casos sem contagem não abre mais pela frase do template;
- `uma` com duas dimensões medidas diz "a outra", no singular;
- os exemplos sem contagem usam `{quando}` onde ele cabe, e a exceção está comentada no código;
- o exemplo passou a ser uma função pública do núcleo, `exemploDaSaude`.

Esses consertos mudaram o pedido, e com ele o hash. A validação foi medida de novo no aparelho, local e
grátis.

**Não é uma quarta rodada de ajuste.** Nenhum conserto foi escolhido olhando a saída do modelo: todos
vieram da revisão do texto. É a mesma versão da rodada 1, corrigida. A versão do descritor segue **2**,
porque a v2 da rodada 1 nunca saiu desta branch. O golden do pedido, em `ia/recursos.test.ts`, foi
atualizado para `bba52757442a…`, com 19 variantes; entrou `uma` com duas medidas.

Relatório `relatorio-9c5838fc6e8f-2026-09-19T09-52-33-030Z`. Impressão dos pedidos `0bd2043b43d9`,
do sistema `2cbc782bde7a`.

| | janelas | pedidos distintos | aprovadas | reprovadas | recusas | regras |
|---|---|---|---|---|---|---|
| todas | 61 | 34 | 46 de 60 medidas (76,7%) | 13 | 1 (ausente) | marcador 10 · chave 7 · ausente 6 · extenso 3 · algarismo 2 |
| as 22 de ajuste | 22 | 18 | 17 de 21 medidas | 4 | 0 | chave 3 · algarismo 2 · ausente 2 · extenso 2 · marcador 2 |
| fora do ajuste | 39 | 24 | 29 de 39 (74,4%) | 9 | 1 (ausente) | marcador 8 · ausente 4 · chave 4 · extenso 1 |
| fora do ajuste, pedido não visto | 24 | 16 | **15 de 24 (62,5%)** | 8 | 1 (ausente) | marcador 7 · ausente 4 · chave 4 · extenso 1 |

**Fora da medida: 1 janela**, `7d@7`. É uma falha transitória do hospedeiro: a CLI estourou o prazo de
60 s e foi reiniciada. A regra da janela medida a conta à parte, e o reinício gera uma segunda chamada
fria (por isso 2 frias fora da mediana).

Por caso × alcance, fora do ajuste:

| caso | noite | período |
|---|---|---|
| sem-contagem | — | 4 de 4 |
| medidas-insuficientes | 4 de 4 | — |
| tudo-no-maximo | 4 de 4 | — |
| todas-iguais | 4 de 4 | — (as 2 do acervo estão no ajuste) |
| uma | 3 de 4 | 3 de 4 |
| duas | 3 de 4 | 1 de 4 |
| fora-do-empate | 2 de 3 | 1 de 4 |

**Diante da validação da rodada 1**, a versão corrigida aprova menos no aparelho:

- fora do ajuste: de 32 para 29, de 39;
- pedido não visto: de 17 para 15, de 24;
- a maior queda está em **fora-do-empate/período**, de 4 para 1 de 4, e em **duas/período**, de 3 para
  1 de 4.

**Leitura à mão das 4 aprovadas de texto próprio fora do ajuste.** É a leitura do agente, não da régua;
o dono confere pelas chaves no relatório.

| leitura | janelas | chaves |
|---|---|---|
| diz o caso | 0 | — |
| sem sentido: marcadores encadeados que não formam oração, e a conferência aprova | 1 | `7d@32` |
| junta as duas dimensões nomeadas ao marcador da contagem, como se elas fossem todas as medidas — afirma uma contagem que o caso não diz, e a conferência aprova | 3 | `ultima@10` `ultima@14` `ultima@16` |

## O que fica para o dono

Observações, sem veredito:

1. **A cópia.** 25 das 29 aprovadas fora do ajuste são o exemplo do pedido, idêntico (15) ou quase (10).
   Das 4 restantes, nenhuma diz o caso (leitura à mão, acima).
2. **Os casos fracos.**
   - Na versão corrigida, fora do ajuste: **fora-do-empate/período, 1 de 4**, **duas/período, 1 de 4**,
     e fora-do-empate/noite, 2 de 3.
   - Na validação da rodada 1: uma/noite, 1 de 4, e fora-do-empate/noite, 1 de 3.
3. **A conferência aprova texto sem sentido** e texto que afirma uma contagem que o caso não diz.
   Mudar a conferência é "Ask First" nesta story, e nada nela mudou.
4. **Uma brecha da régua em `fora-do-empate`.** Na validação da rodada 1, uma aprovada desse caso
   (`ultima@4`) disse da dimensão de fora do empate o que o caso diz das outras, e a lista `contradiz`
   não a pegou. Fica para o deferred-work: mexe na conferência.
5. **A mesma amostra para a v1.** Medir a v1 nas mesmas 24 janelas de pedido não visto é de graça (é o
   aparelho) e fecha a comparação na mesma amostra.

## A medição da nuvem — o comando, para o dono

**A v2 não pode ir para a `main` antes desta medição.** O pedido é um só (AD-11), e a aprovação da nuvem
na ADR 0050 (22 de 22, 0 idênticas ao template, 13,6 s) é **do pedido v1**.

São **22 chamadas pagas**: a amostra padrão, abaixo do teto de 60, sobre as mesmas 22 janelas de ajuste
das rodadas e da coluna do aparelho da 5.10. Rode da raiz do repositório, na branch `feat/motores-5-11`:

```bash
git rev-parse --abbrev-ref HEAD   # tem de dizer feat/motores-5-11
git rev-parse HEAD                # anote: é o commit cujo pedido esta medição mede

export ORBE_SUPABASE_URL=https://<projeto>.supabase.co
export ORBE_SUPABASE_ANON_KEY=<chave anônima>
# Os tokens entram pelo teclado: não aparecem na tela nem vão para o histórico do shell.
read -rs ORBE_ACCESS_TOKEN && export ORBE_ACCESS_TOKEN     # o access_token do navegador — scripts/README.md, "O caminho do token"
read -rs ORBE_REFRESH_TOKEN && export ORBE_REFRESH_TOKEN   # opcional: renova no meio da corrida

pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts \
  --export ~/Orbe-dados/sono-2026-09-12-aparelho --motor nuvem:padrao --limite 2
```

- **O que ler.** Na coluna `nuvem:padrao`, o bloco "As quatro medidas da ADR 0050", ao lado do 22 de
  22 da v1, e o bloco novo "A cópia do exemplo do pedido". É ele que diz se a nuvem passou a copiar o
  exemplo.
- **As janelas não são as da v1.** A medição da v1 foi sobre o acervo puxado de produção em 12/09 (295
  noites, hoje 12/09). Este export tem 293 noites, com hoje 10/09. A regra da amostra é a mesma.
- **Com o aparelho no mesmo relatório:** `--motor nuvem:padrao,aparelho:sistema`. O aparelho não é
  pago.
- **Não suba o `--limite`.** Com 6, seriam 61 chamadas pagas, acima do teto, e a story prevê uma
  medição só.
