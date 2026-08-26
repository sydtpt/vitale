---
id: SPEC-temas
companions:
  - data-model.md
sources:
  - ../../decisions/0018-cor-de-modulo-deriva-de-papel-cromatico.md
  - ../../decisions/0017-mod-esgota-a-paleta-quente-na-nona-cor.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar.

# Temas — quatro eixos de aparência

## Why

O Orbe tinha **um** visual: creme quente, laranja de marca, cor de módulo fixa. O claro/escuro existia como preferência, mas era o único eixo de escolha — e no escuro a paleta era a mesma paleta quente, invertida.

O que o módulo entrega é a separação de quatro coisas que estavam grudadas, e que respondem a perguntas diferentes:

| Eixo | Governa | Pergunta que responde |
|---|---|---|
| **Esquema** | claro / escuro / sistema | "está de dia ou de noite?" |
| **Tema** | superfície, tinta, linha | "que material é este app?" |
| **Paleta** | cor dos módulos e das séries | "que clima cromático eu quero?" |
| **Marca** | o cromo — FAB, CTA, toggle | "qual é a voz do app?" |

A separação não é enfeite. Marca e paleta grudadas é o motivo de o cromo do app ser laranja em qualquer paleta: `primary` saía do papel `orange`, e as seis paletas mantêm o laranja quente na faixa do treino. E tema e paleta grudados é o motivo de o modo escuro nunca ter sido mais que a mesma cor sobre fundo escuro.

O valor secundário é de **acessibilidade**, e não foi planejado: ao medir as combinações em vez de julgá-las, o sistema encontrou defeitos que estavam em produção há muito tempo — entre eles um par ícone/fundo com **1,55** de contraste.

## Capabilities

**CAP-1 — O usuário escolhe os quatro eixos, e a escolha sincroniza.**
Mobile e web têm seletor. As quatro colunas vivem em `user_preferences`; a web escreve, o que é exceção declarada à convenção "quem edita é o mobile" (obrigar a pegar o celular para escurecer o desktop é UX ruim).

**CAP-2 — Toda combinação é legível, e isso é medido, não conferido.**
São 36 combinações de cor mais 24 de marca. `theme.test.ts` calcula contraste WCAG e separação perceptual em todas; combinação que reprove não entra no app. É a capacidade que sustenta as demais — sem ela, "escolha o que quiser" é convite a uma tela ilegível.

**CAP-3 — Cor é derivada, não autorada.**
Cada paleta declara **11 matizes**; tint (`softOf`), primeiro plano (`onTintOf`) e ajuste de contraste (`ensureContrast`) são calculados em OKLab. Autorar as combinações à mão daria ~1.200 hex que ninguém revisa.

**CAP-4 — O tema `orbe` devolve exatamente o que o app sempre teve.**
Travado por teste. Esses valores já estão na tela de quem usa o app; refatoração não pode mudá-los como efeito colateral.

**CAP-5 — A paleta vale para o app e para os gráficos.**
Havia dois seletores, um deles guardado só localmente. Um seletor só, e as séries de gráfico falam o mesmo vocabulário de papéis que os módulos.

**CAP-6 — Um módulo aponta para um papel, não para um hex.**
`MODULE_ROLE` é a ponte. Módulo novo é uma linha ali, e as seis paletas o servem. Ver [ADR 0018](../../decisions/0018-cor-de-modulo-deriva-de-papel-cromatico.md).

## Constraints

**Sombra e contorno são declarados pelo tema, não pelo componente.** `cardChrome` diz se o card se separa do fundo por sombra (`orbe`) ou por linha de 1px (`clean`, `cleanElev`). Os ~82 pontos que desenham card fazem `...shadows.card` e herdam a decisão.

**Um card se separa do fundo por elevação OU por contorno — nunca por nada.** Quando o tema abre mão da elevação (`surface` igual ao `bg`), a borda deixa de ser acabamento e vira a única coisa que define o card. Testado.

**Nenhum seletor oferece duas opções que produzem o mesmo resultado.** Foi o caso de `flat` e `pure` no Clean, onde `bg` e `bgPure` são o mesmo hex. `wallpapersFor()` filtra; testado.

**Cor não nasce fora de `packages/shared/src/theme`.** Três barreiras em `architecture.test.ts`: nenhum `StyleSheet` de módulo lê tema (incluindo as constantes históricas do núcleo, que congelam), nenhuma variável CSS da web fora do sistema, e o `CHECK` de cada coluna de id cobre os ids que o app grava.

**A paleta `acessivel` é de outra natureza.** As cinco de caráter otimizam estética; ela otimiza separação sob daltonismo, e mede 8,0 de separação mínima contra 0,4–1,1 das demais. Fica fora da contagem das cinco justamente por isso.

## Non-goals

**Tema por tela ou por módulo.** Os eixos são globais. Um módulo com tema próprio devolveria a fragmentação que este trabalho desfez.

**Paleta customizada pelo usuário.** Escolher entre seis curadas e medidas é diferente de montar a sua — que só é defensável com o mesmo aparato de medição rodando no cliente.

**Migrar o passivo de hex literal.** As catracas travam 230 no mobile, 121 no SCSS e 97 no TS da web. Elas não crescem; baixá-las é trabalho de fundo, não parte deste contrato.

**Tema no cartão de compartilhamento.** `share-card-html.ts` é imagem exportada com identidade fixa: ela não deve mudar porque alguém trocou a paleta do app.

## Success signal

O usuário troca de tema, paleta ou marca e **nenhuma tela fica ilegível** — sem ninguém ter conferido combinação por combinação.

O sinal negativo é específico e conhecido: uma tela que **não muda** ao trocar de eixo. É o modo de falha deste sistema, não dá erro nenhum, e já aconteceu três vezes (esquema, papel de parede, e o container nativo da navegação). `theme-cache.test.ts` percorre 288 estados exigindo chaves de cache distintas.

## Assumptions

- Os pisos WCAG usados são os corretos por natureza de conteúdo: **4,5** para texto, **3,0** para objeto gráfico e texto grande. Ícone de 28px dentro de botão é objeto gráfico — assumir 4,5 ali foi erro cometido e corrigido.
- Separação perceptual medida em OKLab prevê separação percebida na tela. É aproximação; o piso de 3,5 entre módulos vem de calibração sobre a paleta Orbe, não de norma.
- A simulação de daltonismo por Viénot basta para responder "estas duas cores continuam separáveis?". Não pretende simular percepção.

## Open Questions

- **A marca `tinta` deveria ser preto absoluto ou a tinta do tema?** Hoje é a tinta do tema, o que a torna levemente quente no Orbe. Foi escolha declarada, não medida.
- **O contorno preto das marcas fluorescentes some no escuro** — preto sobre quase-preto não tem contraste. O fluorescente sozinho separa (10,86), mas o caráter de adesivo se perde. A alternativa é a borda usar a tinta do tema, virando um anel claro.
- **`blur_intensity` tem padrão 100 no banco e 50 no código.** Quem nunca mexeu no slider vê valores diferentes conforme a linha exista.
- **O modo escuro da web nasceu aqui e ainda não foi visto rodando.** Build e testes passam; isso não prova que a `ThemeService` pinta.
