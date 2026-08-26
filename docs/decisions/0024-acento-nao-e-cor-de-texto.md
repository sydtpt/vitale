# 0024 — Acento não é cor de texto

**Status:** aceita · estende [0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md) e [0022](0022-tint-de-recorde-e-derivado-do-esquema.md)
**Data:** 2026-08-26

## Contexto

A [0022](0022-tint-de-recorde-e-derivado-do-esquema.md) precisou de uma cor nova para o
número dentro do cartão de recorde sem preenchimento, e a chamou de `onGround`. Antes de
implementar, foi feita uma varredura para saber se ela era só daquela tira.

Não era. **Setenta e dois pontos dos dois apps pintam texto com acento ou com a marca** — 29
no mobile (`color: colors.<papel>`) e 43 na web (`color: var(--primary)` e afins). E acento
nunca prometeu servir para isso. A tabela na docstring do `derive.ts` é explícita desde que
foi escrita:

| token | onde vive | garantia |
|---|---|---|
| `accent` | ponto, barra, **traço** sobre o fundo | ≥ 3,0 contra `surface` |

Três é o piso de **objeto gráfico** (WCAG 2.1, 1.4.11). Texto de corpo quer **4,5** (1.4.3,
nível AA). A distância entre os dois pisos é exatamente onde os 72 pontos estavam morando, e
ela é grande: **54%** das combinações de papel × tema × paleta × esquema ficam abaixo de 4,5.

Os piores não são teóricos nem de canto:

| onde | cor | sobre | mede |
|---|---|---|---|
| estrelas de nota, `cultura/[tipo].tsx` | `yellow` `#F5B946` | branco | **1,76** |
| marca `verde`, no claro | `#00C853` | branco | **2,09** |
| marca `laranja` — **o padrão do app** | `#F25C2B` | branco | **3,31** |

O 1,76 das estrelas reprova até o piso gráfico. É defeito de legibilidade em produção, no
tema padrão, e nenhum teste o via — porque nenhum teste perguntava esta pergunta.

**É a mesma falha que já tinha sido encontrada e resolvida uma vez.** A 0018 registra que o
par ícone-em-acento sobre caixa-em-tint media 1,55 no amarelo, e que a saída foi um terceiro
token com primeiro plano próprio (`*On`, o "on-container" da Material). Este é o mesmo
defeito na outra superfície: o sistema aprendeu a lição para o conteúdo **dentro** do chip e
não a aplicou ao conteúdo **fora** dele. Um `accent` não erra sozinho — ele erra quando
alguém o usa para uma promessa que ele não fez.

## Decisão

**Cada papel ganha um quarto token, `text`**, e a marca ganha o `primaryText` equivalente:

| token | onde vive | garantia |
|---|---|---|
| `accent` | ponto, barra, traço sobre o fundo | ≥ 3,0 contra `surface` |
| `*Soft` | preenchimento de chip/caixa | — é fundo, não precisa |
| `*On` | ícone ou texto **dentro** do chip | ≥ 3,0 contra o `*Soft` |
| **`*Text`** | **texto fora do chip, direto na superfície** | **≥ 4,5 contra `surface`** |

É a mesma busca binária em OKLab do `ensureContrast()` que já produz `accent` e `on`, com
outro piso e outra superfície de referência. Desloca o mínimo necessário, que é o que
preserva a identidade do papel.

**No escuro quase nada desloca**, porque lá o acento já passa folgado: no Orbe escuro os seis
papéis mais usados como texto ficam intactos. **No claro desloca tudo**, e o amarelo é o caso
extremo — `#F5B946` → `#9C6E00`, ΔL 0,250 — porque amarelo saturado não pode ser texto sobre
branco. Isso é física, não escolha de design; qualquer solução o escurece muito ou o
substitui.

**Dois testes novos em `theme.test.ts`** cobram os pisos: `text` sobre `surface` nas 36
combinações de tema × paleta × esquema, e `primaryText` nas 24 de tema × marca.

**Os 72 pontos existentes viram catraca, não barreira.** `architecture.test.ts` conta 115
ocorrências pelas regexes de três baldes e falha quando o número **cresce**. É o mesmo
idioma da catraca de hex e da catraca de `.from()`, que já chegou a zero e virou barreira.
Baixar o teto ao migrar cada frente é parte do trabalho.

## Alternativas rejeitadas

**Migrar os 72 agora.** Resolve de vez e não deixa passivo. Perdeu por sequenciamento, não
por mérito: o escuro fica intacto, mas o claro muda em todo lugar que usa cor de papel como
texto, com o amarelo saltando ΔL 0,250. É a maior mudança visual que o app levaria de uma
vez, e ela não tem relação com o trabalho que a descobriu — misturar as duas faria uma
revisão impossível de fazer bem.

**Deixar o token local à tira de Recordes**, como `onGround`. Era o plano até a varredura.
Perdeu porque o segundo consumidor não é hipotético: são 72, já escritos, alguns
francamente ilegíveis. Um token nascido local seria extraído em seguida, e a extração é mais
cara que nascer certo.

**Subir o piso do próprio `accent` para 4,5.** Uma cor só, sem token novo. Perdeu porque
quebra o que `accent` faz bem: um traço de gráfico a 4,5 fica escuro demais e a série perde
a cor, que é justamente o que a WCAG separa em dois critérios. Os dois pisos existem porque
os dois usos são diferentes.

**Só consertar os casos abaixo de 3,0** — as estrelas, a marca verde, o punhado na mesma
faixa. Conserta o indefensável e não repinta o app. Perdeu por não resolver a causa: a
faixa 3,0–4,5 continuaria reprovando em texto, sem nada para acusar, e a próxima cor nova
cairia no mesmo buraco.

## Consequências

- **`text` e `primaryText` existem e são cobrados**, então o buraco fecha para o código novo
  no dia em que este ADR foi escrito, não no dia em que os 72 forem migrados.
- **O passivo passou de invisível a medido.** Nenhum dos 72 acusava nada; agora o número
  está num teste, com o nome do arquivo e do balde.
- **A migração é por frente e a catraca desce junto.** Cada tela migrada baixa o teto, e a
  catraca vira barreira quando chegar a zero — como a de `.from()` já fez.
- **Um dos 72 não tem conserto por token: o amarelo.** `yellow` como texto sobre branco
  desloca para um ouro escuro que já não lê como amarelo. Onde a identidade amarela
  importar, a saída é chip com tint (usando `*On`), não texto solto — o que aliás é o que a
  0018 já tinha concluído para os ícones.
- **Fica em aberto se `text` deve medir contra `surface` ou contra `bg`.** Hoje mede contra
  `surface`, que é onde a maior parte do texto vive e é a mesma referência do `accent`. Nos
  Clean os dois são idênticos; no Orbe diferem por um fator de 1,07, pequeno o bastante para
  não mudar a resposta em nenhuma combinação medida — mas é sorte, não garantia.
