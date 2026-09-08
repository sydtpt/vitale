# Briefing dos mockups — A revista da Retrospectiva

Folha única lida por todos os mockups desta pasta. **Nada aqui é escolha do
renderizador**: tudo já foi decidido pelo dono em 07–08/09/2026 e está no
`.memlog.md`. Onde este documento não decide, o mockup não inventa — ele pergunta.

## Alvo

iPhone, retrato, **390 × 844** (o quadro do device é obrigatório em todo mockup).
Mobile-first é lei do projeto: *se não está no celular, ele não vê*.

## Tokens — recorte **Orbe · paleta orbe · claro**

Estes hexes foram **medidos** com `resolveTokens('orbe','light','orbe')`, não
escolhidos. Eles existem no mockup só porque HTML não roda `moduleOf()`; **no código
real nenhuma tela escreve hex** — cor nasce em `packages/shared/src/theme` e chega
por `resolveTokens()` / `moduleOf()`.

### Neutros

| token | hex | uso |
|---|---|---|
| `bg` | `#FFF7EE` | fundo da tela |
| `surface` | `#FFFFFF` | cartão |
| `ink` | `#1F1B16` | texto principal |
| `ink2` | `#5C534A` | texto secundário |
| `ink3` | `#9C928A` | rótulo, versalete, apoio |
| `line` | `#EFE6D8` | borda, separador |

### Os quatro cadernos

| caderno | papel | `accent` (fundo da faixa) | `onAccent` (nome dentro dela) | contraste medido | ícone |
|---|---|---|---|---|---|
| **Sono** | `blue` | `#6E8CC9` | `#1F1B16` | 5,10 | lua |
| **Movimento** | `orange` | `#F25C2B` | `#1F1B16` | 5,17 | bicicleta |
| **Coração** | `red` | `#E05C5C` | `#1F1B16` | 4,77 | coração |
| **Rotina** | `green` | `#6FA86A` | `#1F1B16` | 6,10 | tique em círculo |

`onAccent` é **token novo** — o melhor entre `ink` e `bgPure` por contraste medido,
no molde do `onPrimary` que a marca já tem. No claro dá `ink` nos quatro; no escuro
daria preto sobre acento claro (6,3 a 9,1).

Tons de apoio de cada caderno, quando o mockup precisar de um traço leve:
`soft` — Sono `#DDE4F2` · Movimento `#FFE3D2` · Coração `#FDDEDE` · Rotina `#E2EFD9`.

## Tipografia

Fontes reais do app: **Manrope** (sans), **Geist Mono** (números — tabular),
**Instrument Serif** (títulos e o texto da edição). Declare-as primeiro na pilha,
com fallback de sistema, e **não** busque nada na rede:

```css
--sans:  'Manrope', -apple-system, 'Segoe UI', system-ui, sans-serif;
--mono:  'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
--serif: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
```

Regras herdadas do `EdicaoCard.tsx`, que já está em produção — **não reinvente**:

- **texto da edição:** serifada, 15 px / entrelinha 23. *É texto para ler, não dado
  para conferir.*
- **assinatura:** mono, 11 px, `ink3` ou mais claro, logo abaixo do texto de cada
  caderno. Formato: `gemini-3.6-flash · 07 set 2026`. Jornal assina coluna.
- **versalete (`eyebrow`):** sans, 11 px, caixa alta, `letter-spacing: 1.1px`, `ink3`.
- **números:** sempre em mono, para alinharem em coluna.

## As decisões de layout, uma a uma

### CAP-10 · a capa

Ocupa **~45% da altura da tela**, imagem sangrando de borda a borda, com **o nome do
período e a manchete do caderno em posição 1 sobrepostos** à imagem. O sumário cai
abaixo da dobra — consequência aceita.

Duas naturezas de capa, e a diferença entre elas é o assunto:

- **com foto** (só 2026): a legenda é um fato de **três campos** — `Ittre · km 31,1
  · 12:38`. Sem parada, sem quilômetro e sem hora seria decoração.
- **com traçado** (2023–2025): o desenho da rota do próprio período sobre fundo liso.
  **Não é remendo** — 2023 tem que parecer 2023. A textura das capas registra quando
  o dono passou a fotografar.

O mockup não tem foto real: represente a foto por um retângulo com gradiente sutil e
uma nota `[foto — coverOf()]`. O traçado, desenhe de verdade em SVG inline.

### CAP-8 · o sumário

Quatro linhas, uma por caderno. Cada linha mostra **a chamada daquele caderno** — a
manchete que ele já escreveu —, **não o nome dele**. Não diz o que tem dentro; diz
**por que entrar**. Custo de superfície zero: o texto já passou pelas cinco regras de
verificação.

O nome do caderno existe na linha, mas **subordinado** — é rótulo, não manchete.
Cada linha é **tocável** e rola com âncora até o caderno na mesma página.

Molde do contrato (`cadernos.md`):

```
SONO          você dormiu 12 minutos a mais que
              em agosto do ano passado

MOVIMENTO     435 km, metade de julho — e o
              terceiro mês seguido caindo
```

### CAP-7 · o cabeçalho de caderno

**Faixa saturada sangrando de borda a borda**: fundo `accent`, nome grande em
`onAccent`, **ícone ao lado do nome** dentro da mesma faixa. A ordem dos cadernos é
variável (ranqueada), então o reconhecimento é **pela cara, não pela posição**.

O ícone não é enfeite: laranja e vermelho medem ΔE 4,1 a 9,9 em cinco das seis
paletas, e ele é o segundo portador da identidade — resolve a colisão e resolve
daltonismo no mesmo gesto.

### CAP-11 · a lápide

Fato declarado: *a revista sabe e diz quando ficou cega*. Nome da métrica, última
data, ponto. **Nada de "verifique suas conexões"** — isso é conselho, e conselho é
proibido; o alerta operacional sai da revista.

Dois estados, e o mockup mostra os dois:

- **mês da morte:** a lápide **sobe** para o topo do caderno **e ganha um degrau de
  corpo de letra**.
- **meses seguintes:** volta ao **pé** do caderno, no corpo normal, e nunca mais sobe.

O que a impede de virar banner não é a tipografia — é a regra: lidera **só** na
edição do período em que a métrica morreu.

### CAP-12 · a página da lua

**Sub-página em tela própria**, aberta por uma linha no pé do caderno Sono.

A linha de entrada carrega **o veredito por extenso**, com tipografia e extensão
idênticas nos três casos — quem nunca tocar lê o resultado assim mesmo. Isso é o que
mantém a ADR 0045 de pé com a página atrás de um toque.

Dentro, **a moldura é fixa e só o veredito muda**. Não existe variante curta da
página para quando não deu nada. Sempre os mesmos cinco campos, sempre nos mesmos
lugares: **janela testada · desfecho · contagem de noites e de ciclos · próxima
leitura · contador de execuções**.

Os três vereditos, **no mesmo corpo de letra**:

| veredito | quando | o que diz |
|---|---|---|
| **achado** | ≥ 15 min · p < 0,05 unilateral · poder ≥ 80% | o efeito medido, sem mecanismo e sem causa |
| **nenhum padrão** | não significante **com poder ≥ 80%** | não há efeito detectável de 15 min ou mais |
| **inconclusivo** | poder < 80% ou portão reprovado | **quantas noites faltam** |

*"Nenhum padrão" e "inconclusivo" não são a mesma coisa.* Um teste com poder que não
acha nada é informação; um teste sem poder que não acha nada é silêncio.

A página **abre com a fase sinódica desenhada** — o disco parcial das cinco noites
testadas —, que é dado, não símbolo. Nenhum ícone de lua.

### CAP-9 · as três formas

Não uma por tipo de período. **Três objetos distintos.**

- **Postal (semana):** uma tela. **Sem sumário.** Capa pequena, três fatos, e **só
  trajetória** como comparação. Não grava edição — calcula na hora. **Sem botão de
  compartilhar**: a revista é para reler, não para publicar.
- **Edição (mês e trimestre):** capa · sumário · os quatro cadernos na ordem
  ranqueada. É a forma central.
- **Anuário (ano):** abre **serial** — **quatro tiras de 12 meses empilhadas**, uma
  por caderno, cada uma na cor do seu caderno, **antes de qualquer texto**. O ano
  lido como quatro batimentos paralelos. Depois vêm os cadernos, com extremos
  datados.

### CAP-10 · a parede de capas (arquivo)

**Duas colunas**, rótulo (período + manchete curta) **embaixo** da capa, ~6 capas por
tela. Navegável como parede de capas, **não como seletor de data**.

## Voz

**É um jornal: informa, não aconselha.** Não recomenda, não motiva, não parabeniza.
Nenhuma exclamação, nenhum emoji, nenhum "parabéns", nenhum "que tal". Nenhuma
afirmação de causa. **Toda base comparada é nomeada** — "contra julho", "contra
agosto do ano passado", "contra o que você costuma fazer em agosto" —, porque um
número citado sem dizer contra o quê não pode virar edição.

## Fatos disponíveis — não invente número fora desta lista

Todo número que aparecer num mockup tem que sair daqui. É a mesma lei da revista.

**Sono** · 290 noites (23/04/2025 → 07/09/2026, 58% de cobertura) · dormiu 12 min a
mais que em agosto do ano passado · cerveja atrasa o adormecer em 33 min · gatilhos
sob a regra das duas colunas.

**Movimento** · 435 km, metade de julho, terceiro mês seguido caindo · 555 atividades
no acervo · 554 conjuntos de recordes · 275 rotas com elevação · 174 cidades · 138
rotas com piso · piso: 87% pavimentado, 12,5% cascalho leve, 8% pavé · cidades:
Ittre, Leuven, Bruxelles · 1.210 fotos.

**Coração** · 179 dias de FC por minuto · série intradiária desde 05/09.

**Rotina** · 551 ocorrências de tarefa · 102 templates · 336 registros de hábito ·
4 hábitos · 96 registros · 80 dias de notas · cerveja a 11 €/L, 60 L desde 23/05 ≈
€660.

**Lápides** (data da última medida) · respiração **10/07/2026** · VO₂max
**14/07/2026** · SpO₂ **16/07/2026** · anéis **17/08/2026**. Anéis e VO₂max moram no
caderno **Movimento**; respiração e SpO₂, no **Coração**.

**Lua** (do pré-registro, calculado antes de olhar o dado) · desfecho: hora de apagar
· exposição: as 5 noites que antecedem a cheia · ~49 noites dentro × ~241 fora · 17
ciclos sinódicos no intervalo · limiar prático 15 min · direção: atraso, unilateral,
α = 5% · **faltam cerca de 106 noites** para 80% de poder · próxima leitura a cada
+100 noites.

**Capa** · legenda de exemplo: `Ittre · km 31,1 · 12:38`.

**Assinatura** · `gemini-3.6-flash · 07 set 2026`.

## Regra do mês retratado

O canônico é **agosto/2026**, e não por acaso: é o mês em que **os anéis pararam
(17/08)**. A regra da lápide dispara de verdade ali — Movimento vai para posição 1
por lápide, a lápide dele sobe ao topo com um degrau de letra, e **a manchete da capa
é a de Movimento**, porque a capa mostra a manchete do caderno em `posicao = 1`.

## Proibições

- Nenhum JS, nenhuma rede, nenhuma imagem externa. Tem que abrir offline.
- Nenhum padrão visual novo que não esteja neste briefing. Se faltar um, **pare e
  registre** em vez de inventar.
- Nenhum botão de compartilhar em lugar nenhum.
- Nenhum texto de marketing. As frases saem da lista de fatos acima.
- Nenhum conselho, nenhuma exclamação, nenhum emoji na interface retratada.
