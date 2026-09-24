# Gemma 4 no app — estudo de viabilidade

**Data:** 24/09/2026 · **Pergunta:** vale ter o Gemma 4 no Orbe, e em qual variante?
**Resposta curta:** **hoje, não** — mas por um motivo diferente do esperado, e o estudo abre duas
portas que estavam fechadas por engano.

O arquivo herda o nome que o dono pediu (`edge0-moe-streaming-iphone`), mas a hipótese do MoE com
streaming **morre na seção 5**. O que sobra de útil está nas seções 3, 6 e 7.

---

## 1. O que a gente já mediu, e que é a régua

Tudo abaixo é medição nossa, no iPhone 17 Pro, em 22–23/09:

| fato | número |
|---|---|
| A leitura da Saúde do sono | **617 tokens de entrada → 19 de saída** |
| Qwen3-1.7B, 22 janelas | **22/22 aprovadas, mediana 5,9 s** |
| Tucano2-1.5B, mesmas janelas | 17/22, mediana 5,5 s |
| Nuvem (`ia-narrar`), mesmas janelas | 22/22, mediana 13,6 s |
| Modelo do aparelho (Apple, 5.10) | 3/22, 1,6 s |
| Limiar da [ADR 0050](../../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md) | aprovação ≥ 90%, **mediana ≤ 20 s** |
| Qwen3-1.7B / Tucano2 embarcados | **6 bits**, 1,3 / 1,1 GB, janela 4.096 |
| Qwen3-4B (22/09) | misto 4/8 bits, **2,5 GB**, janela 4.096 — **morreu de jetsam** |

Os 5,9 s de mediana para 617 tokens implicam **≥ 105 tok/s de prefill** no que roda hoje. Guarde
esse número: é ele que decide quase tudo abaixo.

---

## 2. O Gemma 4 não tem preset de iOS na Apple

Listado do `apple/coreai-models@main` em 23/09 (`models/` pela API + os 32 `ModelPreset` do
`model_registry.py`):

- **Presets de iOS:** `qwen3-0.6b/1.7b/4b/8b`, `qwen2.5-1.5b`, `mistral-7b`, `smollm2-*`, `olmo2-1b`.
- **Gemma existe só para macOS:** `gemma3-4b-it`, `gemma3-12b-it`, `gemma-3n-e2b/e4b`. O README do
  3n diz isso numa tabela: macOS **Yes**, iOS **No**.
- **Gemma 4 não existe em nenhuma plataforma.**

O [pedido #20](https://github.com/apple/coreai-models/issues/20) está aberto desde 11/06 sem
compromisso da Apple, e o README raiz avisa que **não aceitam pull request**. Então "alguém
contribui o preset" não é caminho.

**O que existe é porte de comunidade**, do `coreai-model-zoo` de Daisuke Majima — repo original
(não fork), 445 estrelas, push de 23/09. Fonte única: não há segunda medição independente de
Gemma 4 em A19.

---

## 3. Os números medidos, e a conta que decide

Todos de iPhone 17 Pro, iOS 27 beta, greedy, aparelho "settled":

| variante | decode | prefill | carga a frio | pico de memória |
|---|---|---|---|---|
| **Gemma 4 E2B** (Core AI, AOT) | 30,3 tok/s | **38,9** | ~11 s | — |
| **Gemma 4 E4B** (Core AI, provider mode) | 15,1 | **21,3** | 19,3 s | **2,2 GB, folga 4,2** |
| Gemma 4 E2B, loop Metal cru (**não é Core AI**) | 55–56 | 66–87 | — | — |
| **Qwen3-4B** (= `FastContext-1.0-4B`, AOT `h18p`) | **20,4** | não medido | — | — |

### A nossa leitura contra cada um

617 tokens de entrada, 19 de saída:

| | prefill | decode | **total** | passa o limiar de 20 s? |
|---|---|---|---|---|
| **Qwen3-1.7B, o que roda hoje** | — | — | **5,9 s** (medido) | sim, com folga |
| Gemma 4 E2B | 617/38,9 = **15,9 s** | 0,6 s | **~16,5 s** | por pouco |
| Gemma 4 E4B | 617/21,3 = **29,0 s** | 1,3 s | **~30 s** | **não** |

**É isto:** trocar o que roda hoje pelo Gemma 4 E2B deixaria a leitura **quase três vezes mais
lenta**, e o E4B estouraria o limiar que o dono fixou. Não por o Gemma ser pior — por o prefill do
Core AI ser lento nessa família.

### Por que o prefill é lento: um bug aberto da Apple

[Issue #201](https://github.com/apple/coreai-models/issues/201), aberta em 27/08, atualizada em
13/09: no iOS 27, **qualquer prefill com lote > 1** num bundle de decode do Gemma 4 E2B aborta —
o heap de scratch do MPSGraph estoura. S=64, S=32 e S=16 abortam; **só S=1 passa**. Nas palavras do
relator: *"a 1024-token prompt degrades to per-token processing"*. A Apple respondeu *"Filed a
feedback with the internal team"*; sem correção anunciada. Um grafo de outra família
(Qwen3-VL-2B, prefill estático S=64) roda limpo no mesmo aparelho — é subdimensionamento por
família, não limite geral.

**Tradução para o nosso caso:** o Gemma 4 lê o nosso pedido token a token. É a causa direta da
tabela acima, e não é coisa que a gente conserte.

---

## 4. O bloqueio que ninguém tinha visto: disco, não memória

Esta é a descoberta que muda o desenho.

A premissa que a gente carregava era **memória** — foi o que matou o Qwen3-4B. Mas o E4B **cabe**:
2,2 GB de pico, 4,2 GB de folga, com o veredito registrado *"jetsam a non-issue even at E4B size"*.
Isso graças ao **provider mode** do Core AI, que é o equivalente ao mmap de PLE do LiteRT-LM: as
tabelas de per-layer embedding *"never enter process memory"*. Custo: ~13 ms/token de round-trip no
iPhone 17 Pro.

O bloqueio real é **o tamanho do app**:

| | disco necessário |
|---|---|
| Limite da App Store, app descomprimido | **4 GB** |
| Gemma 4 E2B (decoder 2,12 + tabelas PLE 2,81) | **4,9 GB** |
| Gemma 4 E4B (decoder 3,99 + tabelas 3,60) | **7,6 GB** |
| O que já embarcamos (Qwen3-1.7B + Tucano2) | 2,4 GB |

**Correção de 24/09, depois de o dono dizer que quer três modelos embarcados:** os 4 GB são o
limite de **submissão à App Store**, e o Orbe não é publicado lá — ele é instalado direto por
`devicectl`. Para esse caminho a Apple não documenta teto, e temos evidência em contrário: o `.app`
de hoje tem **2,5 GB** e instala. Então o correto é: *embarcar Gemma seria impossível **se o app
fosse para a App Store***; no build pessoal, o teto é desconhecido e mediria-se instalando.

Isso **não muda o veredito** do Gemma 4 — o que o reprova é a velocidade da seção 3, não o disco. Mas
muda a conta dos três modelos do dono, que está na seção 7.

A licença está limpa: Apache 2.0 confirmada no model card e na API do HF, e **sem gate** (o Gemma 3
tinha).

---

## 5. MoE com streaming de especialistas: por que não

A hipótese do nome do arquivo: o **26B A4B** tem 128 especialistas, 8 disparam por token, 3,8 B
ativos. Se só os especialistas do token entrassem na memória, o teto do jetsam deixaria de importar.

Três achados a derrubam, em ordem de gravidade:

1. **O `GatherMM` de estoque do Core AI lê denso.** Literal, do conhecimento do zoo: *"`GatherMM`
   gathers then runs a DENSE matmul — it does NOT read only the routed experts, so MoE decode is
   over-read-bound, not active-param-bound"*. Medido no LFM2.5-8B-A1B: int8 lê **8,8 GB por token**.
   A vantagem do MoE é jogada fora no caminho oficial.
2. **O kernel que conserta isso ainda precisa de tudo mapeado.** A comunidade escreveu o
   `gather_qmm`, que recebe os índices roteados como input e lê só as fatias do top-k — 39 → 141
   tok/s no M4 Max. Mas é **GPU-only por construção** e não é streaming: os pesos inteiros continuam
   mapeados.
3. **A aritmética fecha a porta.** 25,2 B parâmetros a int4 ≈ **12,6 GB**, contra um teto com
   entitlement de **~6,44 GB** num iPhone de 12 GB. Ninguém portou o 26B A4B — nem a Apple (sem
   preset) nem a comunidade (não está no zoo).

**Existe um MoE rodando em iPhone**, uma vez: LFM2.5-8B-A1B, bundle `int4km-gather` de 4,7 GB,
**31,3 tok/s no iPhone 17 Pro**. Não foi publicado porque o int4 sem QAT degradou a qualidade. Serve
de prova de que MoE roda — não de que 26B roda.

**Veredito:** streaming de especialista do disco **não existe** no Core AI hoje. Para tê-lo seria
preciso um segundo runtime dentro do app, contra a [ADR 0047](../../docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md)
("a porta do motor é uma só"). Fora de escopo.

---

## 6. A premissa que cai: existe hospedagem, e é da Apple

O dono deu uma ordem permanente em 22/09: *"como não tenho onde hospedar ainda, não liste nada para
instalar e sempre builde com os 2 modelos embarcados"*.

**A premissa não é verdadeira.** Existe **Apple-Hosted Background Assets**: a Apple hospeda, com
limite de **200 GB por registro de app** e **200 asset packs**. É exatamente o mecanismo que a
documentação do Core AI recomenda para distribuir os `.aimodelc` compilados por arquitetura
(WWDC 326: *"a background asset for each compiled model"*).

Isso não muda nada hoje por decreto — a ordem é do dono e só ele a revoga. Mas ela foi dada sobre um
fato falso, e com hospedagem:

- o teto de 4 GB do app deixa de valer para os pesos;
- o "instalar" do desenho de Motores, que está **parado** desde 22/09, volta a fazer sentido;
- a fatia 2 (tela Compilar), adiada por não haver modelo novo de verdade, ganha cliente.

---

## 7. O que vale a pena de verdade: o Qwen3-4B, de novo

O zoo tem uma seção chamada **"The 4B wall"**, verificada com o `FastContext-1.0-4B` — que **é o
Qwen3-4B** — no iPhone 17 Pro. Ele roda a **20,4 tok/s**. As duas falhas que eles documentaram não
são a nossa, e a correção é a mesma para as três.

**Como falhou para nós (22/09):** `TRIM_MEMORY_RUNNING_CRITICAL` → `signal 9`, jetsam, **com** o
entitlement e com o cache já compilado. Morreu na carga, não na compilação.

**Três alavancas que ninguém puxou**, em ordem de força:

1. **Compilar AOT no Mac, e distribuir `.aimodelc`.**
   ```
   xcrun coreai-build compile … --preferred-compute gpu --architecture h18p
   ```
   Isso **elimina a especialização no aparelho** — que é onde o pico de memória acontece. É a
   condição que o zoo diz ser obrigatória para bundles GPU de classe 4B.
   - `h18p` vem do **device identifier**, não do nome comercial: iPhone 17 Pro = `iPhone18,1` =
     `h18p`. Um `.aimodelc` de `h17p` falha no load com `invalidCompiledModel`, e o
     `coreai-build compile` **sai com 0 para qualquer arquitetura pedida** — build verde não valida
     a escolha. Só o load no aparelho valida.
2. **Baixar para int4 puro.** O nosso export foi **misto 4/8 bits, 2,5 GB** — quase o dobro do
   maior que funciona (1,3 GB). Os que rodam são 6 bits.
3. **Encolher a janela de 4.096 para 1.024.** O cache KV cresce com tamanho × janela; num 4B, 4.096
   custa quatro vezes o que custa no 1.7B, por uma folga que a nossa leitura de 617 tokens nunca usa.

### A conta dos três modelos (decisão do dono, 24/09)

Ele quer o 4B **ao lado** do Qwen3-1.7B e do Tucano2, para comparar os três na Bancada. O `.app` de
hoje tem 2,5 GB com os dois modelos (1,3 + 1,1). Somando o terceiro:

| export do 4B | `.app` resultante |
|---|---|
| int4 puro (~1,3–1,5 GB, a hipótese) | **~3,8–4,0 GB** |
| o misto 4/8 de 22/09 (2,3 GB) | ~4,8 GB |

Ou seja: **a configuração A do plano não é só a mais provável de caber na memória — é a única que
mantém o app numa faixa já demonstrada.** Se o 4B voltar a sair com 2,3 GB, o `.app` entra em
território que ninguém instalou ainda.

A Bancada já é multi-modelo (`PESOS_ABERTOS` é lista desde 22/09), então acrescentar o terceiro é
uma entrada no catálogo e os pesos — nenhuma tela muda.

**Antes de tentar:** apagar `Library/Caches/coreai-cache` do app. Especialização que falha deixa
cache parcial, e toda tentativa posterior falha como `NSPOSIXErrorDomain code=2` — cadeia de disco
cheio, não problema de payload. O nosso 4B deixou 2,4 GB lá.

**E não tentar o ANE nesse tamanho:** carrega (31 regiões, ~518 s a frio) e a inferência morre com
`ANECompilerService Code=4097`.

---

## 8. Veredito

| candidato | veredito | por quê |
|---|---|---|
| **Gemma 4 E2B** | **não, hoje** | 4,9 GB não cabe no app; e a 16,5 s seria ~3× mais lento que o atual |
| **Gemma 4 E4B** | **não** | 7,6 GB; e ~30 s estoura o limiar da ADR 0050 |
| **Gemma 4 26B A4B com streaming** | **não** | não existe streaming no Core AI; 12,6 GB contra teto de 6,44 |
| **Qwen3-4B reconfigurado** | **sim, vale medir** | três alavancas não puxadas; existe medição de 4B rodando no mesmo aparelho |

O Gemma 4 volta a ser pergunta no dia em que **(a)** a Apple publicar preset de iOS, **(b)** o bug
#201 for corrigido, e **(c)** o dono decidir usar Background Assets. Os três são independentes de
nós.

---

## 9. Se valer: o plano

Molde do **E0** da pesquisa de imagem, e da ADR 0050: **limiares pré-registrados antes da primeira
execução**. Item reprovado tira o candidato; não vira ajuste depois do fato.

### Fase 1 — o export (Mac, ~1 h)

Exportar o Qwen3-4B em **três** configurações, para separar as variáveis em vez de mudar tudo de
uma vez:

| # | quantização | janela | hipótese que testa |
|---|---|---|---|
| A | int4 puro | 1.024 | as duas alavancas juntas |
| B | int4 puro | 4.096 | a janela importa? |
| C | 6 bits (como os que rodam) | 1.024 | a quantização importa? |

Compilar as três **AOT com `--architecture h18p`** e anotar o tamanho de cada `.aimodelc`.

### Fase 2 — os limiares, escritos antes de medir

O dono fixa por escrito, antes do primeiro `create`:

1. **Carrega?** Sem `signal 9` em 3 lançamentos seguidos, com o cache limpo antes do primeiro.
2. **Cabe?** `os_proc_available_memory()` registrado no pico, com e sem o entitlement.
3. **É rápido o bastante?** Mediana da leitura de 617 tokens **≤ 20 s** (ADR 0050). Medir na
   Bancada, com a mesma amostra de 22 janelas — a comparação com os 5,9 s do 1.7B tem de ser na
   mesma régua.
4. **Escreve melhor?** Aprovação **≥ 90%** nas 22 janelas, e o dono lendo as divergentes contra o
   1.7B. Se empatar em qualidade, **o 4B perde** — ele custa mais memória e mais disco pelo mesmo
   resultado.
5. **Aguenta?** 5 execuções seguidas sem `thermalState` ≥ `.serious`.

### Fase 3 — a medição (iPhone, ~1 h por configuração)

Uma configuração por vez, com o console por `devicectl --console` aberto: sem isso a morte por
memória aparece só como o app sumindo. Registrar o tempo da primeira carga de cada uma.

### O que **não** entra nesta rodada

- Background Assets e a tela "instalar" — dependem da decisão do dono sobre a ordem permanente.
- Qualquer coisa de Gemma 4 — a seção 8 explica.
- Segundo runtime no app (llama.cpp, MLX, LiteRT-LM) — contra a ADR 0047.

---

## Fontes

Apple: [coreai-models](https://github.com/apple/coreai-models) ·
[models/README.md](https://github.com/apple/coreai-models/blob/main/models/README.md) ·
[models/gemma3n/README.md](https://github.com/apple/coreai-models/blob/main/models/gemma3n/README.md) ·
[models/qwen3_moe/README.md](https://github.com/apple/coreai-models/blob/main/models/qwen3_moe/README.md) ·
[issue #20](https://github.com/apple/coreai-models/issues/20) ·
[issue #201](https://github.com/apple/coreai-models/issues/201) ·
[limites de build da App Store](https://developer.apple.com/help/app-store-connect/reference/maximum-build-file-sizes/) ·
[limites do Apple-Hosted Background Assets](https://developer.apple.com/help/app-store-connect/reference/apple-hosted-asset-pack-size-limits/)

Google: [model card do Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4) ·
[licença](https://ai.google.dev/gemma/docs/gemma_4_license)

Comunidade (fonte única, Daisuke Majima): [coreai-model-zoo](https://github.com/john-rocky/coreai-model-zoo) ·
[gemma4-e2b](https://github.com/john-rocky/coreai-model-zoo/blob/main/models/gemma4-e2b/README.md) ·
[gemma4-e4b](https://github.com/john-rocky/coreai-model-zoo/blob/main/models/gemma4-e4b/README.md) ·
[lfm2.5-8b-a1b-moe](https://github.com/john-rocky/coreai-model-zoo/blob/main/models/lfm2.5-8b-a1b-moe/README.md) ·
[aot-and-specialization.md](https://github.com/john-rocky/coreai-model-zoo/blob/main/knowledge/aot-and-specialization.md) ·
[compute-units-and-authoring.md](https://github.com/john-rocky/coreai-model-zoo/blob/main/knowledge/compute-units-and-authoring.md)

**Ressalva de método:** toda medição de Gemma 4 em iPhone vem de **um** repositório de **uma**
pessoa, em **betas** do iOS 27 (o próprio zoo diz: *"not yet re-measured on the release OS"*). Não
há segunda fonte independente. Os números da seção 1 são nossos e foram medidos por nós.
