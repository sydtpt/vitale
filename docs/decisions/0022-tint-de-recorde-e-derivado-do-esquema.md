# 0022 — Tint de recorde é derivado do esquema, não autorado

**Status:** aceita · estende [0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md) · o token de texto foi generalizado por [0024](0024-acento-nao-e-cor-de-texto.md)
**Data:** 2026-08-26

## Contexto

A [0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md) tirou cor da mão de quem
escreve: um módulo aponta para um **papel** e `softOf()` calcula o tint em OKLab, por
esquema. Dez módulos entraram nessa regra.

A tira de **Recordes** do histórico ficou de fora, e por um motivo compreensível — ela não
colore um módulo, colore um destaque. Então manteve o formato antigo: `HL_COLORS`, treze
pares `bg`/`fg` escritos à mão em `mobile/src/lib/running-highlights.ts`, com uma segunda
cópia idêntica em `web/.../data/running-highlights.ts` e um comentário em cada uma pedindo
que sejam mantidas em sincronia.

Os treze pares foram autorados para o modo claro. Nada ali lê tema. O escuro recebe,
literalmente, o mesmo `#FCDCC4`.

**O primeiro sintoma é ótico, e tem número.** Um tint é um realce: no sistema de temas ele
fica entre **1,13 e 1,43** de contraste contra a página, nos dois esquemas. Os cartões de
recorde no escuro medem **16,17** contra o preto do Clean e **14,50** contra o `#14110D`
do Orbe. Dezesseis para um é a razão que se exige de **texto**, não de superfície — cada
cartão tem a força ótica de um bloco de texto branco. É por isso que a tira ofusca e é por
isso que a hierarquia inverte: com a íris adaptada ao escuro, cinco cartões de resumo
passam a ser o objeto mais claro da tela, mais forte que o cabeçalho e que o CTA laranja
logo acima.

**O segundo sintoma é o que ensina a regra.** `hlLabel` e `hlCaption` usam `colors.ink3`,
que **responde ao esquema** — no escuro vira cinza claro (`#8A8074`). O fundo embaixo dele
não responde. Cinza claro sobre pastel claro mede **2,94–3,12**, abaixo de AA para texto
pequeno; é o "21 de jul." que mal se segura na tela. Não foi o pastel que quebrou o texto:
foi misturar, no mesmo cartão, uma cor que segue o tema com uma que não segue. Um literal
não erra sozinho — ele erra quando encosta em algo derivado.

## Decisão

**`HL_COLORS` deixa de mapear chave → hex e passa a mapear chave → papel.** O cartão lê
`resolveTokens()` como o resto do app.

**E o papel pinta o que a casca do tema mandar.** O cartão de recorde preenchido não era só
inadequado ao escuro — ele contradizia o contrato do `clean`, que a docstring do próprio
tema já declarava:

> *"o card não tem preenchimento próprio — é o mesmo branco (ou o mesmo preto) do fundo, e o
> que o delimita é uma linha fina."*

O predicado é derivado, não um `switch` por id de tema: **`surface === bg` significa que o
tema não dá preenchimento ao card.**

| tema | claro | escuro | casca |
|---|---|---|---|
| `orbe` | `#FFF7EE` / `#FFFFFF` | `#14110D` / `#1E1A15` | preenchido |
| `cleanElev` | `#FFFFFF` / `#F7F7F8` | `#000000` / `#1A1A1D` | preenchido |
| `clean` | `#FFFFFF` / `#FFFFFF` | `#000000` / `#000000` | **contorno** |

**Casca preenchida** (`surface !== bg`):

| slot | antes | agora | piso nas 36 combinações |
|---|---|---|---|
| fundo do cartão | `bg` literal | `roles[R].soft` | 1,13–1,43 contra a página |
| valor | `fg` literal | `roles[R].on` | **≥ 3,00** — garantido por `onTintOf()` |
| label e legenda | `colors.ink3` | `colors.ink2` | **≥ 5,60** |

**Casca de contorno** (`surface === bg`):

| slot | valor | piso |
|---|---|---|
| fundo do cartão | nenhum — é a página | — |
| borda 1px | `roles[R].accent` | **≥ 3,00** contra a página, o piso de objeto gráfico (WCAG 1.4.11) |
| valor | `roles[R].text` | **≥ 4,50** contra a superfície |
| label e legenda | `colors.ink2` | **≥ 7,39** |

**O valor usa `text` e a borda usa `accent`, e a diferença entre os dois é o ponto.**
`accent` promete o piso gráfico de 3,0, que é o da linha de 1px; `text` promete 4,5, que é o
do número de 20px. Sobre o branco do Clean claro os acentos medem **3,00–3,36** — bastam para
a borda e não bastam para o texto. No escuro nada desloca (os acentos já medem 6,26–7,49
sobre preto) e borda e valor saem literalmente na mesma cor; no claro o valor escurece um
degrau, `#F25C2B` → `#D64201`. Uma regra, os dois esquemas.

Este token nasceu aqui com o nome `onGround` e, na varredura que precedeu a implementação,
descobriu-se que o mesmo buraco existia em **72 outros pontos** dos dois apps. Ele virou o
quarto token de todo papel, e a história está na
[0024](0024-acento-nao-e-cor-de-texto.md).

**A casca de contorno é imune ao defeito original por construção**, e vale registrar por
quê: o texto do cartão passa a ficar sobre o fundo da página, que é exatamente a superfície
para a qual `ink2` e `ink3` foram calibrados. "Cinza claro sobre pastel claro" não tem onde
acontecer.

O mapa de papéis:

| card | matiz de hoje | papel | nota |
|---|---|---|---|
| `longest` | laranja | `orange` | direto |
| `last12mo` | azul | `blue` | direto |
| `total` | verde | `green` | direto |
| `marathon` | terra | `brown` | direto |
| `40000` | verde-água | `teal` | direto |
| `30000` | lilás | `purple` | direto |
| `half` | magenta | `rose` | **um passo de matiz** |
| `20000` | rosa | `red` | **um passo de matiz** |
| `10000` | coral | `orange` | **repete `longest`, na outra fileira** |
| `5000` | âmbar | `yellow` | direto |
| `1000` | amarelo | `ink` | **deliberado, ver abaixo** |
| `maxElev` | oliva | `brown` | direto |
| `elev12mo` | azul-petróleo | `teal` | direto |

**A invariante é por fileira, não por tela.** Foi a primeira formulação que o teste
derrubou. Treze destaques não cabem em onze papéis — mas o que precisa ser distinto não é a
tela inteira: é a **fileira**. Cada linha é um carrossel horizontal próprio, e é ali que os
cartões se comparam; dois cartões em linhas diferentes nunca ficam lado a lado. Por isso
`orange` serve `longest` no resumo e `10000` nos recordes, e `brown`/`teal` se repetem entre
corrida e ciclismo — a mesma saída barata que a 0018 já registrou para `ACTIVITY_ROLE`,
dezessete tipos de treino sobre oito papéis.

**`deep` não entra na tira, e quem decidiu foi a medição.** Dos 55 pares de papéis nas 36
combinações, só **dois** ficam abaixo do piso de separação de 3,5, e ambos são dele:
`orange×deep` cai a **1,0** nas paletas `neon` e `joia` — não "parecidos", a mesma cor — e
`red×deep` a **2,7** na `acessivel`. Como a fileira de recordes já usa `red` e o resumo
acima usa `orange`, não sobra lugar seguro. `10000` era coral e ficou com `orange`.

**`1000 → ink` é escolha, não sobra.** É o papel de menor `on` no escuro (3,03, o piso do
conjunto), o que faz do 1 km o cartão mais quieto da fileira. Para a menor distância, ser
o mais quieto é certo. A permuta importava: com `marathon → ink`, a maratona é que ficava
apagada — e ela é a que menos pode ficar. Com `brown` ela mede 5,94 e sai rica nos dois
esquemas.

## Alternativas rejeitadas

**Preenchido em todos os três temas** — foi a primeira versão desta decisão, e ela durou
até alguém olhar o Clean. Perdeu porque contradiz o contrato do tema, que já estava escrito:
no `clean` o card não tem preenchimento, e um cartão de recorde com tint era a única
superfície do app a ignorar isso. O erro de método vale registrar — a primeira versão tratou
"modo escuro" como o problema, quando o problema era **cor literal**, e cor literal também
ignora o eixo tema, não só o eixo esquema.

**Contorno só no escuro** — manteria o preenchido no Clean claro, onde ele não ofusca.
Perdeu por dar duas gramáticas ao mesmo componente: uma regra que muda de forma com o
esquema é uma regra que a catraca de hex do `architecture.test.ts` não consegue cobrar, e
regra não cobrada volta. O predicado `surface === bg` é verdadeiro nos dois esquemas do
Clean justamente porque a proposta do tema é a mesma nos dois.

**Cartão de superfície com o número colorido** em todos os temas — casca em `surface`,
hairline, e só o valor no `accent`. Resolvia o escuro por construção e alinhava a tira com o
card de atividade logo abaixo. Perdeu porque apaga o mosaico também no Orbe e no Clean
elevado, onde ele funciona e é o que dá leitura de relance à fileira.

**Valor no `accent`, igual à borda, nos dois esquemas** — a saída óbvia para a casca de
contorno, e a que o escuro sozinho aprovaria. Perdeu por **3,31** no Clean claro: o acento
promete o piso gráfico de 3,0, que é o da linha, não o do texto. Foi o que motivou o
`text` — e no escuro as duas propostas coincidem exatamente, então nada se perde.

**Valor em `ink` (branco/preto), cor só na borda.** Passa em tudo com folga (19,29 / 19,01)
e é o mais "Clean" de espírito. Perdeu por pendurar toda a identidade em 1px: cinco
retângulos finos coloridos, a um braço de distância, é sinal fraco, e a fileira perde a
leitura de relance que justifica ela existir.

**Pinar os treze hex atuais como softs do claro**, no padrão de `PINNED_SOFT`, derivando só
o escuro. Preservava o claro exatamente. Perdeu porque mantém viva a tabela que este ADR
existe para matar — em duas cópias. A diferença medida é de cerca de um ponto de
luminosidade (`#FCDCC4` → `#FFE3D2`); é identificável com os dois lado a lado e por mais
ninguém.

## Consequências

- Cerca de **26 hex saem de `mobile/src`** e outros 26 da web. Os tetos de
  `architecture.test.ts` (229 e 97) descem junto — o próprio teste imprime o número novo.
- **As duas cópias de `HL_COLORS` deixam de existir.** O mapa chave → papel é uma tabela de
  strings sem cor dentro: ela pode morar no `shared` e ser lida pelas duas telas, e o
  comentário "mantenha em sincronia" some com ela.
- A tira passa a atender as **24 combinações** de eixo sem trabalho adicional, incluindo as
  paletas que ainda não existiam quando ela foi escrita.
- **O caption melhora no claro de tabela**: de 2,39–2,68 para ≥ 5,60. Não era o alvo — veio
  junto porque a causa era a mesma.
- **Nasceu um token derivado, e ele não era desta tira.** A varredura que precedeu a
  implementação achou o mesmo buraco em 72 pontos dos dois apps, então ele virou `text`, o
  quarto token de todo papel. Ver [0024](0024-acento-nao-e-cor-de-texto.md).
- **O predicado `surface === bg` vira regra pública.** Ele não existia como conceito
  nomeado; estava implícito na escolha de hex de cada tema. Nomeá-lo é o que permite a
  qualquer componente futuro perguntar "este tema preenche cards?" sem citar `clean`.
- **O portão foi fechado junto, e foi ele que corrigiu a decisão.** `highlight-roles.test.ts`
  cobra papéis distintos por fileira, separação de 3,5 em toda paleta, e a coerência do
  predicado da casca. Não é cerimônia: a primeira versão do mapa passava em todo teste de
  contraste e ainda assim pintava dois cartões da mesma fileira com a mesma cor. O portão
  reprovou antes de virar código.
