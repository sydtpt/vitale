---
title: 'Pesquisa técnica: edição de imagem on-device no iPhone 17 Pro (iOS 27)'
type: 'technical'
topic: 'Pipeline de edição de imagem 100% on-device (segmentar, restilar, compor, sobrepor) para fotos de atividades e da revista'
decision: 'É viável rodar, no iPhone 17 Pro ou superior com iOS 27, um pipeline único de modelos de IA para editar fotos sem nuvem? Com quais modelos e runtimes, em que ordem de risco, e com que escada de degradação?'
source: 'run (fan-out web nativo)'
status: complete
preset: 'deep'
validation: 'high'
shape: 'select'
created: '2026-09-21'
updated: '2026-09-22'
claims: 'verificadas 10 · sem 2ª fonte 5 · disputadas 4 · desmentida 1 (do brief) · retirada 1'
artifact: 'https://claude.ai/artifact/HgfxGzsBfjSjFM7hoeBH2A'
---

# Pesquisa técnica: edição de imagem on-device no iPhone 17 Pro (iOS 27)

**Decisão que esta pesquisa serve:** é viável rodar, no iPhone 17 Pro ou superior com iOS 27, um
pipeline único de modelos de IA para editar fotos sem nuvem? Com quais modelos e runtimes, em que
ordem de risco e com que escada de degradação?

Versão em HTML, para leitura: [research-briefing.html](research-briefing.html) (também publicada
como artifact privado). Entrada original: [imports/brief-edicao-imagem-pedal.md](imports/brief-edicao-imagem-pedal.md).

## Escopo e correções do dono durante a rodada

- As fotos **não são sobretudo de ciclista com bicicleta**. São fotos gerais tiradas durante o dia nas
  atividades (paisagem, rua, pessoas, comida, pets). A bicicleta aparece pouco. Consequência: o restilo
  pode ser da imagem inteira, a segmentação tem de servir a qualquer sujeito (ou nenhum), e a escolha do
  preset depende do conteúdo da foto tanto quanto dos dados da volta.
- **Português não é requisito** de nenhum modelo (o brief pedia pt-BR no LLM de presets).
- Os modelos do brief são sugestões, trocáveis; os passos também. O foco é a viabilidade de combinar
  modelos num processo único.
- "Não salvar nada" valeu durante a pesquisa; o dono liberou o salvamento no fim (21/09).

## Sumário executivo

**Viável em camadas; a cadeia inteira ainda não foi demonstrada por ninguém.**

1. Cada estágio tem caminho on-device no iPhone 17 Pro, mas não há registro público da cadeia
   completa (segmentar, difundir em modo edição, compor, exportar) rodando junta, nem de edição por
   difusão medida por terceiros no iPhone. A difusão é o elo de maior risco e deve ser a última camada,
   atrás de um spike de aparelho.
2. "Processo único" só funciona como orquestração sequencial, com um estágio pesado residente por vez.
   O que limita é a memória por processo, não o disco. O "~6,1 GB por processo" do brief **não tem fonte**
   (a Apple chama a documentação de "deliberadamente vaga"); medir com `os_proc_available_memory()`.
3. O brief estava defasado em pontos centrais. O "klein 4B não cabe" foi **contestado**, não desmentido:
   há um relato único de FLUX.2 klein 4B a 512² em 4-bit no iPhone 17 Pro (só texto→imagem, no iOS 26), e
   nenhum número de edição nem de iOS 27. O Core AI tem receitas oficiais para todos os estágios (não só LLM),
   mas é candidato principal, não runtime único: ControlNet e inpainting ficam no Core ML, a difusão no iPhone
   via Core AI não tem número e está disputada, e o FP16 da especialização padrão deu saída errada em silêncio
   no iOS 27.0. E um LLM aberto provavelmente não é necessário para escolher o preset. Fora do brief, o Image
   Playground do iOS 27 saiu da jogada.
4. Como as fotos são gerais, o núcleo do produto é um look na imagem inteira, com "trocar o fundo" como
   modo extra. A escada sem difusão (LUT, profundidade, máscara de céu, colorimetria) funciona sem
   máscara de sujeito e é o caminho de menor risco.

**Maior ressalva:** quase todo número de difusão no iPhone é de fonte única e auto-relatado; não existe
comparação independente de qualidade para restilar fotos (rostos, texto), e nenhuma fonte mede o quanto
o usuário percebe a escada sem difusão como "editada". Só o aparelho do dono responde isso.

## O brief, afirmação por afirmação

| Afirmação do brief | Veredito | O que a evidência mostra |
|---|---|---|
| Core AI com `.aimodel` e receitas oficiais | **Confirmada** | `apple/coreai-models` (código BSD-3, exige iOS 27.0+ e Xcode 27) tem receitas para `sam3`, `flux2`, `stable-diffusion`, `efficient-sam`, `depth-anything`, `edsr`, `qwen3`, `gemma3/3n` e VLM. |
| SAM 3 com export oficial | **Com ressalvas** | Variante iOS "lite" a 336 px, prompt de texto, ~430–623 MB (as sessões 325 e 326 da WWDC26 discordam), pesos gated. Nenhuma fonte publica latência ou RAM em iPhone. |
| SD ~0,9B com img2img e ControlNet | **Parcial** | img2img existe (SD 1.5 e 2.1 no Core AI). ControlNet e inpainting não existem no Core AI; existem no Core ML antigo (`ml-stable-diffusion`), cujo único número de iPhone é de 2023 (SD 2.1 a 512² em 7,9 s no iPhone 14 Pro Max). |
| klein 4B não cabe (~6,1 GB) | **Contestada** | Relato único e auto-relatado (Imarello, iOS 26.6.1, só texto→imagem): MLX 4-bit a 512² em 9,9–12,2 s e 2,6–3,5 GB no 17 Pro. A receita `flux2` da Apple tem preset iOS, e o PR #252 diz "validado no iPhone 17 Pro" (disputado, sem números). Só um pacote de comunidade a 1024² estoura (~6,5 GB). Nenhum número de edição no iPhone. O "6,1 GB" segue sem fonte. |
| Qwen3.5-2B ou Gemma 4 E2B via Core AI | **Desmentida** (sem receita) | Qwen3 tem receita, Qwen3.5 não. Gemma 4 E2B existe (Apache-2.0) e roda no iPhone por LiteRT-LM, não por Core AI. |
| Image Playground (fora do brief) | **Fora** | No iOS 27 roda em Private Cloud Compute, a foto de origem é só "inspiração", e o `ImageCreator` deixa de funcionar (duas páginas da Apple). |
| Pesos por download sob demanda | **Confirmada** | Background Assets hospedado pela Apple: 200 GB e 200 packs, funciona no TestFlight; teto por pack não encontrado. |

## Etapa por etapa

### Preset (escolher o look)

Ladder, do mais barato ao mais caro; usar o primeiro degrau que resolver:

- **Degrau 0 — regras e estatísticas de pixel.** Hora, clima, esforço, luminância, temperatura de cor, fração de céu,
  número de rostos. Sem download; é o fallback de tudo.
- **Degrau 1 — Vision `ClassifyImageRequest`.** 1.303 rótulos, incluindo `sky`, `blue_sky`, `night_sky`, `sunset_sunrise`,
  `mountain`, `water`, `food`, `people`, `dog`. **Não existe `landscape` nem `selfie`** (compor com outros rótulos e contagem
  de rostos). O dump que confirma isso é de 2022: refazer com `supportedIdentifiers` no iOS 27.
- **Degrau 2 — Foundation Models** com a foto anexada e `@Generable enum`. No iOS 27 o modelo do sistema aceita imagem
  (Apple + PR independente validada no iOS 27); a Apple afirma que a decodificação restrita garante a estrutura. Sem frase
  específica para `enum`; janela de 8192 tokens só no código de exemplo da Apple. Validar o id em código e cair para o degrau 0.
- **Evitar:** MobileCLIP2 e FastVLM (licença só de pesquisa; app pessoal não está claramente coberto). LLM aberto
  (Gemma 4 E2B, 2,58 GB) só se precisar de raciocínio livre; pico de memória disputado (497 MB num benchmark independente,
  1.450 MB no Google).
- **Falta medir:** latência e memória do Vision e do Foundation Models no aparelho; custo em tokens de uma imagem.

### Máscara

- Começar pela máscara de primeiro plano do **Vision** (`VNGenerateForegroundInstanceMaskRequest`, iOS 17+; Swift-nativa iOS 18+):
  sem pesos, independente de classe, volta vazia quando não há sujeito (documentado). Vazia ou implausível → pular a segmentação.
- Ninguém publicou qualidade em cabelo e borda fina, latência, nem se pessoa + objeto seguro saem fundidos.
- O iPhone 15+ só grava profundidade/matte com pessoa, gato ou cachorro (fonte secundária): atalho para selfies e pets, não
  mecanismo geral. Paisagem: máscara de céu ou limiar de profundidade (Depth Anything V2 Small, Apache-2.0).
- Com prompt ("person", "dog"): **SAM 3 lite** (Core AI), 848 M de parâmetros. Segundo prompt na mesma foto é 76% mais rápido
  (embedding em cache, Apple). Borda: BiRefNet (MIT). RMBG-2.0 é CC BY-NC.

### Restilo generativo

Nenhum número abaixo é de terceiros independentes.

| Caminho | Tempo | Memória | Ressalva |
|---|---|---|---|
| klein 4B, MLX 4-bit, rota experimental (Imarello) | 9,9 s (17 Pro, 512², 4 passos) | 2,6 GB | Só texto→imagem; iOS 26.2+; fork do `mlx-swift`; metallib de 155 MB; repo sem licença; fonte única |
| klein 4B, MLX 4-bit, rota padrão | 12,2 s | 3,5 GB | Padrão entregue pelo mesmo autor |
| Bonsai 1-bit (PrismML) | 9,4 s (17 Pro Max) ou ~12 s (17 Pro) | 1,5–2 GB | Números do vendor que se contradizem; só texto→imagem; app fechado |
| Core AI, receita `flux2` iOS | sem número | sem número | Preset 512², `--single-function`; PR #252: "validado no iPhone 17 Pro" |
| Core AI, pacote de comunidade a 1024² | 17 s (só Mac M4 Max) | ~6,5 GB | Cartão diz "macOS only"; disputa com o PR #252 |
| Core ML, SD 2.1 a 512² | 7,9 s (iPhone 14 Pro Max) | > 2 GB | De 2023; ControlNet e inpainting funcionam |

- **Modos:** imagem inteira com estrutura preservada (edição por referência ou img2img de baixa força) e só o fundo. Sem
  comparação independente entre eles em fotos. O paper do FLUX.1 Kontext mede outro modelo (12B) e não compara com SDEdit.
- **Falhas documentadas do klein:** texto distorcido (a BFL admite); deriva de pose e de cor do cabelo em 2 relatos
  independentes com prompts de várias mudanças (nenhum só de estilo); edição por referência custa ~1,65–2,1× o texto→imagem
  por passo (Mac). Rosto: nenhuma evidência independente para o 4B.
- **Fora:** Image Playground, Bonsai (só T2I), klein 9B (não-comercial).
- **Falta:** tempo/memória/térmica da edição no iPhone; SD de poucos passos no iPhone (nenhum número); qualidade em rostos.

### Composição, cor e exportação

- Core Image: `CIColorCubesMixedWithMask` (duas LUTs + máscara), colorimetria de forma fechada (Reinhard/MKL, ~12 parâmetros),
  grão e vinheta. Profundidade: Depth Anything V2 Small, 49,8 MB, ~34 ms no iPhone 15 Pro Max (cartão da Apple; fonte única).
- **Resolução é a armadilha:** 512²–1024² contra fotos de 12–48 MP é uma razão de ≈12× (1024² sobre 12 MP) a ≈186×
  (512² sobre 48 MP) em pixels, ou de ≈4× a ≈16× no lado maior. Só mudanças de baixa
  frequência sobrevivem (cor, tom, fundo). Usar o gerado como **guia** sobre o original em resolução cheia; proteger rostos por
  máscara; looks de textura (ilustração, grão) precisam de fonte de detalhe própria.
- **HDR:** exportar SDR e HDR editados e deixar o Core Image calcular o gain map; muitas operações reportam headroom 0; fundo
  gerado é SDR (inferência). Fonte de 2024; nada lido sobre iOS 26/27.
- Super-resolução: receita `edsr` no Core AI; nenhum número de iPhone para 12–48 MP.

### Integração, entrega, segundo plano e térmica

- **Overlay:** determinístico (Skia fora da tela ou Core Graphics em módulo Swift). Crash a 3000 px no Skia relatado em 2023,
  não reverificado.
- **Módulo Swift local no Expo:** `AsyncFunction` roda fora da thread JS; há `Events` e `URL` de arquivo. Cancelamento por
  `Task` não é documentado (jobId→Task seria desenho nosso). Nunca tensores pela ponte.
- **SwiftPM:** `import CoreAI` (framework do sistema) não precisa; MLX e fontes vendorizadas precisam. `spm_dependency` do RN
  força frameworks dinâmicos; PR #50329 do Expo (aberto em 18/09) trata do caminho `react-native spm`. `react-native-executorch`
  0.10 lista style transfer, sem difusão.
- **Pesos:** Background Assets da Apple ou download com hash; LUTs e presets no bundle.
- **Segundo plano:** GPU em segundo plano (`BGContinuedProcessingTask`) voltou "não suportado" em todos os iPhones testados no
  iOS 26; iOS 27 sem evidência. Projetar para primeiro plano, tela acesa, checkpoint por estágio.
- **Térmica (LLM contínuo):** GPU perde 52–62% da vazão em 10 min; Neural Engine perde ~um terço. Difusão em rajada não medida.
  Draw Things: o 16 Pro estrangula após ~1 min a ≥1024².

## Camadas do produto

| Camada | O que roda | Máscara de sujeito? | Pesos | Risco principal |
|---|---|---|---|---|
| T0, sem modelo generativo | LUT (máscara opcional), colorimetria, vinheta, grão, overlay | Não | nenhum | Parecer "filtro", não "reimaginado"; nenhum estudo mede |
| T1, modelos pequenos | Profundidade, máscara de céu, máscara do Vision, preset por Vision + Foundation Models | Só no modo sujeito | ~50 MB a poucas centenas de MB | Qualidade das máscaras; latência não medida |
| T2, difusão como guia | klein 4B ou SD a 512², recomposto sobre o original | Opcional (modo fundo) | 2,6–3,5 GB em execução | Memória, térmica, rostos, exportação em 12–48 MP |

## Quanto custa uma foto (aproximado, fonte única)

- Vision: não medido. SAM 3 lite: RAM e latência não medidas.
- Difusão klein 4B, 512², 4 passos: ~10–12 s em texto→imagem; edição ~1,65–2,1× por passo (extrapolado do Mac) → ~16–26 s
  (estimativa), mais carga.
- LUT, composição, overlay: sub-segundo esperado (não medido).
- Primeira execução: a "specialization" do Core AI é lenta e não deve ocorrer em fluxo interativo; usar compilação AOT. Sem número.
- **Leitura:** dezenas de segundos por foto com tudo quente e cabendo em memória; a frio, desconhecido.

## Contra-evidência (red-team)

- **Cadeia sequencial (red-team 1):** só sobrevive como hipótese plausível. Pelo menos 5 componentes (segmentador, codificador de
  texto, VAE encoder, transformer de difusão, VAE decoder). A demo da Apple no iPhone usa modelos < 1 B. O MLX retém buffers
  liberados sem limitar/limpar o cache. Mitigações candidatas (não testadas): embedding de texto pré-calculado por preset, 512²,
  entitlement de memória.
- **klein no iPhone (red-team 2):** edição por difusão não demonstrada no iPhone com número; aceitação de rosto sem evidência
  independente para o 4B; exportação em 12–48 MP só para mudanças de baixa frequência.
- **Core AI (red-team 3):** candidato principal, não runtime único. Ultralytics achou FP16 com **saída errada em silêncio** na
  especialização padrão (iPhone 17 Pro, iOS 27.0) e manteve o Core ML como padrão; issues #257, #124 e #201 abertas sem resposta
  da Apple; sem Simulator; sem PR externo; empata com o Core ML em redes pequenas; primeiro token do Gemma 4 E2B 3,1 s contra
  0,2 s do MLX (fonte única).
- **Resistiu:** caminho oficial de SAM 3 no iOS; decode de LLM pequeno no nível do MLX; Core AI mais rápido que o Core ML em
  detecção/classificação com YOLO26n. Nos mesmos números (17 Pro, iOS 27.0) ele perde em profundidade (7,87 × 6,62 ms) e
  em segmentação semântica (8,55 × 4,86 ms); são redes nano YOLO26n, não Depth Anything.

## Recomendações

1. **Reescrever o brief em camadas** (T0, T1, T2). O E0 deixa de ser "exportar modelos" e vira **medir**.
2. **E0 = um build de spike no iPhone 17 Pro, com limiares pré-registrados.** Antes da primeira execução, o dono fixa por
   escrito o que aprova e o que reprova cada camada, como na ADR 0050: latência por foto **a frio** (o brief partia de
   < 60 s), pico de memória contra o `os_proc_available_memory()` do aparelho, quantas execuções seguidas sem
   `thermalState` ≥ `.serious`, e o protocolo do bake-off (quantas fotos, julgamento cego ou não, quem decide). Item
   reprovado tira a camada do produto; não vira ajuste depois do fato. Parâmetro fixo de todos os itens: a política de
   enquadramento das fotos 4:3 num modelo quadrado (ex.: lado maior em 512, em múltiplos do VAE, ou recorte + máscara da
   área não gerada), para o guia alinhar com o original.
   a. `os_proc_available_memory()` por estágio, com e sem o entitlement;
   b. máscara do Vision em ~30 fotos do dono (vazio, qualidade, latência) + dump de `supportedIdentifiers`;
   c. SAM 3 lite com compilação AOT (latência, RAM, primeira carga);
   d. klein 4B pela receita `flux2 --platform iOS` (512²) e pelo MLX: tempo **a frio e quente** (carga + inferência), pico,
      e `thermalState` a cada uma de 5 execuções seguidas. Antes de medir, definir duas coisas. O modo: a receita `flux2`
      faz img2img por tokens de referência (condicionamento in-context), não por mistura de ruído; o SDEdit por força é do
      caminho MLX. E a origem do código MLX: o único port para iPhone é o Imarello, sem licença, então o spike precisa de
      port próprio sobre o `mlx-swift` oficial ou de licença pedida ao autor;
   e. bake-off de qualidade nas fotos do dono: SDEdit, edição por referência e LUT ajustada por preset (prompts só de estilo).
      A grade do SDEdit é em **passos efetivos**, não só em força: num modelo destilado de 4 passos, força 0,3–0,5 são 1–2
      passos (ex.: 4 passos com 0,5 e 0,75; 8 passos com 0,3 e 0,5, se o caminho permitir). Registrar o scheduler;
   f. teste de saída conhecida por modelo e build do iOS (FP16 padrão contra CPU);
   g. **a cadeia inteira em sequência** (o S0.3 do brief): segmentar → difundir → compor → exportar, sobre 10 fotos,
      carregando e descarregando cada estágio. Medir o pico de `phys_footprint` entre estágios, a memória devolvida depois
      da descarga (limite e limpeza do cache do MLX), se o app sobrevive sem jetsam, e o tempo total;
   h. o guia de 512² aplicado sobre um original de 48 MP e exportado em HEIF com gain map: pico, tempo e o que sobra do HDR;
   i. Foundation Models no aparelho do dono, com a região e o idioma reais: `SystemLanguageModel.default.availability`; e,
      com foto anexada e `@Generable enum`, latência e `tokenCount(for:)`;
   j. `BGTaskScheduler.shared.supportedResources` impresso no aparelho.
3. **Arquitetura:** protocolos `Segmenter`, `Stylizer`, `PresetSelector` (como o brief); um estágio residente por vez; porta em
   `os_proc_available_memory()` e `thermalState`; checkpoint entre estágios; tela acesa; o gerado só como guia sobre o original;
   rostos protegidos por máscara; números da volta nunca por modelo generativo.
4. **Runtime, por estágio, até o E0 medir:**
   - **Segmentação:** Core AI para o SAM 3 lite (caminho iOS oficial; foi o que resistiu ao red-team 3).
   - **Profundidade:** Depth Anything V2 Small no Core ML (número publicado, Apache-2.0) até o `da3-small` da receita do
     Core AI ser medido e ter a licença dos pesos exportados confirmada. No 17 Pro, o Core AI não ganhou do Core ML em
     redes pequenas de visão.
   - **Difusão:** MLX (o único caminho com número no iPhone) ou SD no Core ML (que tem ControlNet e inpainting). A receita
     `flux2` do Core AI só entra depois de medida no E0 d e aprovada no teste de saída conhecida do E0 f: o red-team 3 pediu
     para tirá-la como alvo no iPhone.
   - **Super-resolução:** receita `edsr` do Core AI como candidata, sem número no iPhone.
   - **Preset:** Vision (degrau 1) como padrão; Foundation Models só se o E0 i o mostrar disponível no aparelho do dono.
   - **Contexto:** o teto de ≤ 1.024 tokens vale para LLM exportado pelo Core AI no iOS (limite do cache KV; a 2.048 o
     processo morre na carga). Não vale para o Foundation Models, que declara 8.192 no código de exemplo da Apple; quanto a
     foto anexada consome sai do E0 i.
   - **Toolchain fixada.**
5. **Ideia barata, sem evidência:** rodar o klein poucas vezes por preset e ajustar uma LUT 3D a partir dos resultados (a rede
   original de LUT 3D adaptativa tem < 600 mil parâmetros, roda 4K em < 2 ms numa GPU de desktop, código Apache-2.0, aceita treino
   pareado). Uma LUT muda só tom e cor; ninguém mediu no iPhone.

## Licenças (o que bloquearia publicar; não é aconselhamento jurídico)

- **Podem publicar:** FLUX.2 klein 4B (Apache-2.0), SAM 2/2.1 (Apache-2.0), Depth Anything V2 Small e DA3 Small/Base (Apache-2.0; a
  receita do Core AI usa `da3-small`), BiRefNet (MIT), Gemma 4 (Apache-2.0 pelos metadados), SigLIP2 base (Apache-2.0), MLX,
  llama.cpp, LiteRT-LM, código do `coreai-models` (BSD-3).
- **Condicionais:** SAM 3 (SAM License: uso comercial ok, distribuir o acordo, exclusões ITAR e militar, pesos gated); SD 3.5
  (receita < US$ 1 milhão e "Powered by Stability AI").
- **Bloqueiam:** klein 9B (FLUX Non-Commercial), Depth Anything V2 Base+, DA3 Large+, RMBG-2.0 (CC BY-NC), MobileCLIP2 e FastVLM
  (só pesquisa), EdgeSAM e Apple Depth Pro (texto não lido), Imarello (repo sem licença: não reaproveitar o código).
- **Armadilhas:** o selo Apache do repositório não vale para os pesos; o `coreai-models` não diz nada sobre a licença dos pesos
  exportados; as listas de uso proibido dos modelos FLUX e SD valem para um app que edita fotos de pessoas.

## Ponte com o repo (memória do projeto, não é evidência da pesquisa)

- Casa com as ADRs 0047 e 0048 (porta única, orquestrador, ponte Swift `on-device-engine`, motor por recurso e por aparelho): o
  pipeline de fotos seria mais um recurso do mesmo desenho.
- A pesquisa achou o mesmo obstáculo de empacotamento já medido em 21/09 (`import CoreAI` sem SwiftPM; "casca fina" resolveu o
  CocoaPods).
- A foto é ponteiro (ADR 0037): o pipeline lê do Fotos e nada sobe.
- O teste de 21/09 do modelo do aparelho (Foundation Models) passou no portão de qualidade só em parte: reforça validar o preset em
  código e cair para as regras.
- A memória do projeto diz que a UE não bloqueia o Foundation Models; a pesquisa lista região e Apple Intelligence como
  pré-requisito. Conferir no aparelho: item i do E0.

## Onde as fontes discordam

- **Teto de memória:** "6,1 GB" sem fonte × 2,6–3,5 GB reais no MLX × ~6,5 GB num pacote de comunidade a 1024².
- **FLUX.2 no iPhone via Core AI:** cartão da comunidade "macOS only" × PR #252 da Apple "validado no iPhone 17 Pro". Não
  resolvido; a pista é o `Flux2Pipeline`.
- **Tempos de restilo:** klein 9,9 s (experimental) × 12,2 s (padrão); Bonsai 9,4 s × ~12 s.
- **Memória do Gemma 4 E2B:** 497 MB × 1.450 MB (métricas diferentes). Planejar pelo maior.
- **SAM 3:** ~430 MB × 623 MB nas sessões 325 e 326.
- **Core ML:** nenhuma declaração da Apple sobre o futuro; ainda roda no iOS 27; a imprensa fala em "substituição".
- **ImageCreator:** "deprecado" e "para de funcionar" são ambos ditos pela Apple.

## Perguntas em aberto (o que a web não respondeu)

| Pergunta | Como resolver |
|---|---|
| Teto real de memória por processo no 17 Pro (com e sem entitlement) | Sonda de 20 linhas com `os_proc_available_memory()` |
| Latência e RAM do SAM 3 lite, do Vision e do classificador no iPhone | Spike E0 (b, c) |
| Edição por difusão no iPhone: tempo, pico, térmica, qualidade em rosto | Spike E0 (d, e) |
| A cadeia inteira em sequência sobrevive sem jetsam? | Spike E0 (g) |
| Foundation Models disponível para o dono (região, Apple Intelligence); custo em tokens da foto | Spike E0 (i) |
| Vision `landscape`/`selfie` e revisão do classificador no iOS 27 | Dump de `supportedIdentifiers` no aparelho |
| GPU em segundo plano no iPhone 17 Pro / iOS 27 | Spike E0 (j): uma linha, `BGTaskScheduler.shared.supportedResources` |
| Qual receita/tamanho de Depth Anything o `coreai-models` puxa; licença dos pesos exportados | README `models/depth-anything` |
| Texto das licenças: klein 9B (HTTP 401), EdgeSAM, Depth Pro, ExecuTorch e react-native-executorch (NOASSERTION), Qwen, Llama, SD 2.1, Bonsai | Leitura humana dos arquivos de licença |
| HDR e gain map no iOS 26/27; super-resolução de 12–48 MP no iPhone | Spike E0 (h) para o gain map; Deepen (composição, rodada 3 não feita) para o resto |
| Núcleo do `Flux2Pipeline` (PR #252): memória, passos, latência | README da receita `flux2` |

## Rigor e frescor

- Método: 6 frentes em até 3 rodadas (runtimes, segmentação, restilo, preset, composição, integração) mais um assistente de licenças;
  3 verificadores (fatos Apple, números, licenças e falhas do Core AI); 3 red-teams. Todas as páginas web passaram por um resumidor
  (`WebFetch`), então números são de segunda mão. Os assistentes não receberam nenhum arquivo do projeto (firewall de pesquisa).
- Afirmações rastreadas no `.memlog.md`: **10 verificadas, 5 sem 2ª fonte, 4 disputadas, 1 desmentida (do brief: Qwen3.5
  via Core AI), 1 retirada**. Na revisão de 21/09, o "klein não cabe" desceu de desmentida para disputada, porque a
  refutação se apoiava num relato sem 2ª fonte e num PR disputado. A afirmação do Image Playground foi retirada da conta
  do brief: o brief não a faz, e o fato é o da afirmação [3], já verificada.
- Janelas de frescor usadas: versão 1 mês, desempenho 3, memória 3, capacidade 3, licença 6. Das 10 afirmações principais
  calculadas, 6 já estavam fora da janela no dia da pesquisa: Foundation Models aceita imagem, Bonsai, throttling GPU × ANE,
  GPU em segundo plano, licenças dos pesos e o dump do Vision. A mais antiga é o dump do Vision (2022), que sustenta o
  degrau 1 do preset.
- **Reverificar antes do E0:** as seis vencidas acima. **Depois:** issues do Core AI e PR #50329 do Expo/SDK 58 até
  **01/10/2026**; memória do Gemma 4 E2B até **01/10/2026**; números do klein no MLX até **01/11/2026**; `Flux2Pipeline`
  no iPhone até **01/12/2026**.
- **Revisão:** `/bmad-review` de 21/09 (quatro lentes), aplicada em 22/09 em duas partes: as correções factuais (estado do
  commit, razão de pixels, placar de afirmações, klein contestado, Core AI no Sumário, frescor, teto de tokens) e as
  Recomendações 2 e 4 reescritas. Os achados de borda, de estrutura e de prosa ficaram de fora.

## Fontes principais

- Apple: WWDC26 [241](https://developer.apple.com/videos/play/wwdc2026/241/), [324](https://developer.apple.com/videos/play/wwdc2026/324/),
  [325](https://developer.apple.com/videos/play/wwdc2026/325/), [326](https://developer.apple.com/videos/play/wwdc2026/326/),
  [375](https://developer.apple.com/videos/play/wwdc2026/375/); [aviso do ImageCreator](https://developer.apple.com/news/?id=dz9wvq0r);
  [WWDC25 227](https://developer.apple.com/videos/play/wwdc2025/227/); [WWDC24 10177](https://developer.apple.com/videos/play/wwdc2024/10177/);
  [ml-stable-diffusion](https://github.com/apple/ml-stable-diffusion).
- Core AI e benchmarks: [apple/coreai-models](https://github.com/apple/coreai-models) (issues
  [#201](https://github.com/apple/coreai-models/issues/201), [#230](https://github.com/apple/coreai-models/issues/230),
  [#257](https://github.com/apple/coreai-models/issues/257)); [Ultralytics PR #319](https://github.com/ultralytics/yolo-ios-app/pull/319);
  [apple-silicon-llm-bench](https://github.com/john-rocky/apple-silicon-llm-bench).
- Difusão no iPhone: [Imarello](https://github.com/PowerBeef/Imarello), [Bonsai Image 4B](https://prismml.com/news/bonsai-image-4b),
  [Draw Things](https://releases.drawthings.ai/p/iphone-17-pro-doubles-ai-performance),
  [FLUX.2 klein 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B),
  [pacote Core AI da comunidade](https://huggingface.co/mlboydaisuke/FLUX.2-klein-4B-CoreAI).
- Artigos: [throttling em edge](https://arxiv.org/abs/2603.23640), [FLUX.1 Kontext](https://arxiv.org/abs/2506.15742),
  [SDEdit](https://arxiv.org/abs/2108.01073), [MKL-Harmonizer](https://arxiv.org/abs/2511.12785).
- Expo e licenças: [Expo PR #50329](https://github.com/expo/expo/pull/50329),
  [SAM License](https://raw.githubusercontent.com/facebookresearch/sam3/main/LICENSE),
  [licença Apple ML Research](https://raw.githubusercontent.com/apple/ml-mobileclip/main/LICENSE_MODELS),
  [Stability Community License](https://stability.ai/community-license-agreement).

Os 21 digests (uma linha por assistente e rodada) estão em [digests/](digests/): `runtimes-r1..r3`, `segmentation-r1..r2`,
`generative-r1..r3`, `preset-r1..r2`, `composition-r1..r2`, `integration-r1..r2`, `licences-r2`, `verify-A/B/C` e `redteam-1..3`.

## Como retomar

- Próximo passo natural: roteiro do spike E0 no iPhone 17 Pro (itens a–j acima, com os limiares pré-registrados antes da
  primeira execução), ou atualizar o Product Brief com as camadas T0/T1/T2
  (`bmad-product-brief`, a partir de [imports/brief-edicao-imagem-pedal.md](imports/brief-edicao-imagem-pedal.md)).
- Um Deepen barato fecha as lacunas que só a web resolve: README da receita `flux2` para iOS, qualidade da máscara do Vision, HDR e
  super-resolução no iOS 26/27, textos de licença ainda não lidos.
- Na branch `docs/edicao-de-imagem`, sem push: a pesquisa no commit 9ee15dd (21/09) e a revisão aplicada no commit seguinte.
