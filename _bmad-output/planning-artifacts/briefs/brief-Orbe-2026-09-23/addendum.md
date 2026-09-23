---
title: 'Adendo ao brief — Edição de imagem on-device'
status: draft
created: '2026-09-23'
updated: '2026-09-23'
---

# Adendo ao brief — Edição de imagem on-device

O que o brief não comporta, mas o PRD, a arquitetura e as stories vão querer.

## Alternativas consideradas e por que caíram

| Alternativa | Por que caiu |
|---|---|
| **Editor de cadeia na tela** (escolher etapas, ordem e ligações) | O dono decidiu que a ordem é do código. Quase todo o aprendizado vem de trocar o modelo de uma etapa e de ligar ou desligar etapas — o editor custa contratos de ligação genéricos e não paga essa diferença na v1. |
| **Leitura ordenando as opções de look** | Com três looks numa grade, o olho decide mais rápido que a heurística. Pior: se a leitura só ordenasse, trocar o modelo da etapa 1 quase não mudaria a imagem final, e o laboratório não ensinaria nada. A leitura ficou com ajuste de parâmetros e colocação do overlay, que mudam o render. |
| **Rastreador de experimentos** (métricas automáticas de qualidade, ranking, gráficos) | Nenhuma métrica automática mede "ficou bonito". O olho do dono decide, e um toque registra o veredito. |
| **Quatro a seis looks na v1** (brief original) | Cada look precisa ser desenhado, testado nas fotos dele e mantido. Três provam a esteira, e serão substituídos assim que ela rodar. |
| **Escolha automática de look pelos dados da volta** (brief original) | O dono quer escolher na mão, olhando as prévias. A escolha automática deixa de ser requisito e vira, no máximo, um enfeite posterior. |
| **Recorte de ciclista e bicicleta como núcleo** (brief original) | A premissa mudou durante a pesquisa: as fotos são gerais (paisagem, rua, comida, pets), e a bicicleta é rara. O núcleo virou o look na imagem inteira; a máscara é uma etapa opcional. |
| **Só a receita atravessando a ponte para o Mac** | Sem a foto, não dá para comparar a mesma imagem nos dois executores, o que é o ponto da ponte. |
| **Servidor alugado com GPU** | Sai do controle dele e rompe a ADR 0037 com um terceiro. O Mac na rede dele preserva o espírito: a imagem só vai para uma máquina dele. |

## Os números medidos, e de onde vêm

Todos do aparelho do dono (iPhone 17 Pro, iOS 27), em 21 e 22/09. Não vêm de fontes web.

| Fato | Valor | Consequência para a esteira |
|---|---|---|
| Teto de memória por processo | Bundle de 2,3 GiB morto por jetsam **com** o entitlement | O "~6,1 GB por processo" que circula não vale. A difusão é a etapa que pode não caber, e o portão de memória é obrigatório. |
| Primeira compilação | ~14 min (1,7B) e ~29 min (4B) | Entrar com um modelo novo é um ato deliberado, com tela própria — não acontece no meio de uma edição. |
| Custo por modelo | ~2,6 GB (pesos + cache) | Dois ou três modelos instalados por vez; remover é parte do fluxo. |
| Como se enxerga a morte por memória | `devicectl --console` | Sem isso, o app apenas "some". Instrumentação obrigatória no spike. |
| Classes iOS do exportador do Core AI | `qwen3`, `qwen2`, `olmo2`, `mistral` | Nenhum VLM aberto. A leitura trocável é embedding, rótulo, profundidade e máscara. |
| Guided generation | Funciona no motor estático (ele expõe logits) | Se algum dia a etapa 2 (escolher o look) for por modelo, a saída estruturada é possível sem depender da Apple. |

Fontes: `~/Orbe-dados/pesquisa-modelos-pequenos-2026-09-22.md` e a seção "Ponte com o repo" da pesquisa
técnica.

## Portabilidade: onde cada peça mora, e as regras

O monorepo já tem o lugar de cada peça: a definição da esteira em `packages/shared`, o executor do
iPhone no módulo Swift e o executor do Mac em `scripts/`, que já é a bancada e já roda fora dos apps.

Três regras que tornam a portabilidade possível e valem desde a primeira linha:

- nenhuma etapa guarda estado escondido — tudo o que muda a saída está na receita;
- id de modelo é referência, não caminho de arquivo;
- imagens de referência por etapa, para detectar quando os dois executores divergirem.

## Esboço dos contratos de etapa

A definição da esteira precisa ser dado para ela rodar nos dois lugares. Forma provável, a fechar na
arquitetura:

- **Leitura** → entra a imagem; sai um registro com saliência, caixas de rosto e texto, mapa de
  profundidade opcional, paleta, luminância e a região recomendada para o overlay.
- **Look** → entra a leitura; sai a receita resolvida: parâmetros por etapa, já ajustados à foto.
- **Máscara** → entra a imagem e a receita; sai uma máscara, ou nada (documentado: "não havia sujeito").
- **Estilo** → entra a imagem, a máscara e a receita; sai uma imagem-guia, em 512² a 1024².
- **Composição** → entra o original em resolução cheia, o guia e a máscara; sai a imagem composta.
- **Overlay** → entra a imagem composta, a região recomendada e os números da volta; sai a imagem final.
- **Execução** → a receita, a semente, o modelo por etapa, o tempo e o pico de memória de cada etapa.

Cada etapa declara o que exige e o que promete, para que "não coube na memória" ou "não havia sujeito"
sejam respostas normais da esteira, não exceções.

## O que já existe no app e não deve ser reconstruído

- **Compositor de compartilhar** (`share-composer`): já desenha rota e estatísticas sobre uma foto de
  fundo e exporta. A etapa de overlay deve reaproveitá-lo, não nascer de novo.
- **Galeria e visor da atividade** (fotos na pedalada, ADR 0037): já existe o lugar onde o dono
  escolhe a foto — é a porta de entrada da esteira.
- **Capa da Revista** (stories 1.13 e 1.16): já consome uma imagem como capa; é um dos três destinos.
- **Porta de motores e bancada** (ADRs 0047 e 0048, workspace `scripts/`): a porta de hoje só fala
  texto. Imagem precisa da porta irmã, e a bancada é o candidato natural a executor no Mac.
- **Frente de UX dos Motores** (`ux-Orbe-2026-09-22`): instalar, compilar, modelos no aparelho, quem
  escreve o quê e comparar. A esteira de imagem entra como mais uma família nesse desenho.

## Riscos, e o que fazer se cada um se confirmar

| Risco | O que acontece se ele se confirmar |
|---|---|
| A difusão não cabe na memória | A v1 continua de pé sem ela; os looks elaborados caem e o laboratório vira comparação entre modelos pequenos |
| Cada modelo custa ~2,6 GB e até meia hora de compilação | O laboratório é pequeno por desenho; instalar, compilar e remover precisam ser atos visíveis (é o que os Motores já desenham) |
| Os dois executores divergem | As imagens de referência pegam a divergência; sem elas, a comparação entre Mac e iPhone mente |
| Foundation Models indisponível na região | A v1 não depende dele: o look é escolhido à mão |

## Pergunta que a pesquisa não respondeu e o produto vai responder

Nenhuma fonte mede se uma escada sem difusão é percebida como "editada". O look "Sujeito em foco", que
usa máscara e profundidade sem nada generativo, é o teste barato dessa pergunta: se ele já satisfaz, a
difusão passa a ser luxo, e não fundação.
