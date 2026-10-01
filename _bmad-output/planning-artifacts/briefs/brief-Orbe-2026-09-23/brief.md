---
title: 'Product Brief — Edição de imagem on-device (Orbe)'
status: ready
created: '2026-09-23'
updated: '2026-09-23'
---

# Product Brief — Edição de imagem on-device

## Problema e valor

O Orbe guarda as fotos das atividades como ponteiro: a imagem fica na biblioteca do iPhone e só o
fato sobe (ADR 0037). Ele já sabe desenhar rota e estatísticas sobre uma foto de fundo, no cartão de
compartilhar. O que não existe é **mexer na imagem**: aplicar um look, ler o que está nela e decidir,
a partir dessa leitura, como ela sai.

O valor não está no filtro. Está na **esteira**: uma sequência de etapas em que cada uma pode rodar
sem modelo, com um modelo pequeno ou com um modelo caro — e em que **trocar o modelo de uma etapa é
barato e medido**. A foto editada é o primeiro produto dessa esteira e a prova de que ela funciona.

Por que agora: o app já tem a porta de motores para texto (ADRs 0047 e 0048), e a frente de Motores
já desenha instalar, compilar e comparar modelos. Imagem é a segunda família de motores — e é a que
obriga a esteira a existir, porque nenhuma etapa isolada resolve uma foto.

## Quem usa, e quando

Um usuário: o dono. App pessoal, **sem planos de publicar**.

Ele abre as fotos de uma atividade, escolhe uma e decide mexer nela. Nunca automático. Normalmente
depois da atividade, às vezes em outro momento. Tempo não é restrição: dezenas de segundos por foto
são aceitáveis, e até uma compilação longa na primeira vez que um modelo entra.

A foto editada termina em um de três lugares, à escolha dele: **compartilhada**, **salva** ou como
**capa de uma edição da Revista**.

## Escopo da v1

**A esteira.** Seis etapas, ordem fixa no código, modelo trocável por etapa — e **toda etapa tem uma
versão sem modelo**. Isso mantém o app inteiro funcionando quando os pesos são removidos e dá chão de
comparação: um modelo só entra se provar que é melhor que o caminho de graça.

| # | Etapa | Sem modelo (a base) | Com modelo (trocável) |
|---|---|---|---|
| 1 | Ler a foto | saliência, rostos, texto, variância, paleta | embedding (CLIP, SigLIP), classificador do Vision |
| 2 | Escolher o look | ele escolhe na grade de prévias | — (v1 não decide o look por modelo) |
| 3 | Separar | máscara de primeiro plano do Vision | SAM 3, profundidade |
| 4 | Estilizar | LUT e colorimetria | difusão como guia, só se o spike aprovar |
| 5 | Compor e sobrepor | Core Image; o lugar do overlay vem da etapa 1 | — |
| 6 | Sair | salvar, compartilhar, virar capa | — |

**Etapa e camada não são a mesma coisa.** Etapa é um passo da esteira — as seis acima. Camada é
*quanto de modelo* a esteira usa, e vem da pesquisa: **T0** não tem modelo generativo (LUT,
colorimetria, Vision, Core Image), **T1** acrescenta modelos pequenos (embedding, profundidade,
máscara) e **T2** acrescenta difusão. A v1 entrega T0 e T1 inteiras; T2 só entra se o spike aprovar.

**O que a leitura faz na v1:** decide **onde** cabe o overlay e **ajusta os parâmetros** do look à foto
(não aquecer o que já está quente, não afundar o que já está escuro, respeitar rostos). Ela não ordena
as opções — com três looks na tela, o olho é mais rápido que a heurística. Como a leitura muda o
render, trocar o modelo da etapa 1 produz diferença visível: é isso que torna a comparação útil.

**Os três looks da v1** existem para exercitar partes diferentes da esteira e serão substituídos por
looks elaborados quando ela estiver rodando:

| Look | O que faz | O que ele exercita |
|---|---|---|
| Hora dourada | aquece, levanta sombras, acrescenta brilho suave | o caminho curto: leitura → parâmetros → composição |
| Noite neon | sombras frias, realce de luzes, grão, vinheta | o ajuste por leitura de luminância |
| Sujeito em foco | fundo dessaturado ou desfocado, sujeito preservado | máscara e profundidade |

Um look é uma **receita que atravessa as etapas** (`{prompt, parâmetros por etapa}`), não um filtro no
fim da linha: cada etapa lê o que entende dela. É isso que faz os mesmos looks funcionarem desde já,
sem modelo nenhum.

**Como ele escolhe:** o app roda a leitura e gera as três prévias baratas numa grade (LUT; esperado em
menos de um segundo). Ele toca na que gostou. A etapa cara, quando existir, roda depois e só sob
pedido, sobre a opção escolhida.

**O histórico, que transforma "testei" em "aprendi":** cada execução guarda a receita (modelo
por etapa, parâmetros, semente), as medições (tempo por etapa, pico de memória) e o arquivo de saída.
O fato vai ao banco; a imagem fica no aparelho. Duas execuções da mesma foto abrem lado a lado, e um
toque diz qual ficou melhor — de preferência sem mostrar qual é qual.

**Onde mora:** a esteira **roda** a partir da foto, no detalhe da atividade. A **comparação** e o
gerenciamento de modelos moram nos Motores, junto de instalar, compilar e "quem escreve o quê".

### Fora da v1

- Editor de cadeia: escolher etapas e ligá-las na tela. A ordem é do código; o que se troca é o modelo.
- Escolha automática do look, prompt livre e edição por instrução ("remova o carro").
- Rastreador de experimentos: métricas automáticas de qualidade, ranking, gráficos.
- Nuvem, vídeo e qualquer coisa que tire a foto do aparelho.
- Os looks elaborados ("futurista", "surrealista"): dependem da etapa generativa, que depende do spike.

## A esteira precisa sair do aparelho

Não na v1 — mas a v1 não pode impedir que isso aconteça. O plano é exportar a esteira inteira, como
projeto, e rodá-la no **Mac do dono, na rede dele** (nunca em máquina de terceiro), com modelos
maiores.

Isso só funciona se a **definição da esteira for dado, não código**: etapas, contratos de entrada e
saída, parâmetros, semente e qual modelo em cada etapa. Cada runtime implementa as etapas; nenhum
runtime define a esteira. Onde cada peça mora no monorepo e as três regras que tornam a portabilidade
possível estão no adendo.

O preço é real: **cada etapa vai ser implementada duas vezes**. É por isso que a v1 tem poucas etapas e
poucos parâmetros. E a ponte fará a foto sair do aparelho, o que pede emenda à ADR 0037 — só por ação
dele, só para máquina dele.

## Restrições conhecidas (medidas, não supostas)

As quatro primeiras foram medidas no aparelho do dono em 21 e 22/09; a procedência e as consequências
detalhadas estão no adendo.

- **Memória é o limite, não o disco nem o tempo.** Um bundle de 2,3 GiB foi morto por jetsam **com** o
  entitlement de memória aumentada. Uma etapa pesada residente por vez, com portão de memória entre
  etapas. A difusão é a única etapa que pode simplesmente não caber.
- **Cada modelo novo custa caro para entrar:** ~2,6 GB no aparelho, pesos e cache somados, e de 14 a 29
  minutos de compilação na primeira carga. O laboratório é de dois ou três modelos por vez, com remoção
  consciente — não é uma lista longa.
- **Não existe VLM aberto no iPhone:** o exportador do Core AI só tem classe iOS para `qwen3`, `qwen2`,
  `olmo2` e `mistral`. Ler a foto *em palavras*, só pelo Foundation Models da Apple, que não é trocável.
  O que é trocável e comparável: embeddings, classificador, profundidade e segmentação.
- **O gerado é pequeno e a foto é grande:** difusão vive em 512² a 1024²; a foto tem de 12 a 48 MP. O
  gerado entra como **guia** sobre o original em resolução cheia, nunca como a imagem final.
- **A foto pode não estar no aparelho** (iCloud com armazenamento otimizado): a leitura do original é um
  caminho que pode falhar ou exigir rede.
- **A regra de ouro e a irmã dela:** os números da volta nunca passam por modelo generativo. A leitura
  decide **onde** eles vão; o código desenha **o que** eles dizem.

## O spike é a primeira entrega, não um andaime

Como o produto é a esteira, medir é função dela. O primeiro trilho a existir é o que roda uma etapa,
mede e registra — e o spike (`E0` da pesquisa, itens a–j) acontece **dentro** dele, não ao lado.

Antes da primeira execução, o dono fixa por escrito o critério que aprova ou reprova cada camada: tempo
por foto a frio, pico de memória contra o disponível, execuções seguidas sem estrangulamento térmico e
como o bake-off decide. Item reprovado tira a camada do produto.

O risco que muda o escopo é um só: **a difusão pode não caber na memória**. Se não couber, a v1 continua
de pé sem ela, e os looks elaborados caem junto. Os outros três riscos — o preço de cada modelo, a
divergência entre os dois executores e a indisponibilidade do Foundation Models na região — estão no
adendo, com o que fazer em cada caso. Nenhum deles derruba a v1.

## Decisões em aberto

1. **Onde exatamente a comparação mora dentro dos Motores** — depende da frente de UX em andamento
   (ver Entradas).
2. **Os limiares do spike**, que são do dono e precisam ser escritos antes da primeira medição.
3. **A emenda à ADR 0037**, quando a ponte com o Mac existir.

## Entradas

- Brief original do dono: `_bmad-output/planning-artifacts/research/technical-on-device-image-edit-pipeline-iphone-2026-09-21/imports/brief-edicao-imagem-pedal.md`
- Pesquisa técnica (revisada em 22/09, com as camadas T0/T1/T2 e o spike E0):
  `_bmad-output/planning-artifacts/research/technical-on-device-image-edit-pipeline-iphone-2026-09-21/research.md`
- Medições no iPhone (22/09): `~/Orbe-dados/pesquisa-modelos-pequenos-2026-09-22.md`
- UX dos Motores em andamento: `_bmad-output/planning-artifacts/ux-designs/ux-Orbe-2026-09-22/`
