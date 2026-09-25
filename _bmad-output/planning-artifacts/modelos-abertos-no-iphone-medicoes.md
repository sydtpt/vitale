# Modelos abertos no iPhone — o que foi medido

**Aparelho:** iPhone 17 Pro (`iPhone18,1` → `h18p`), iOS 27.0 build 24A437, 12 GB.
**Período:** 21–24/09/2026. Tudo abaixo foi **medido aqui**, não lido. Onde há número de
terceiro, está marcado.

Companheiro de [`edge0-moe-streaming-iphone.md`](edge0-moe-streaming-iphone.md), que trata do
Gemma 4. Este documento trata do que **roda hoje**.

---

## 1. O que está embarcado, e quanto custa

| modelo | quantização | janela | pesos | compilado | total no telefone |
|---|---|---|---|---|---|
| SmolLM2-135M | — | 4.096 | — | 231 MB | — |
| Tucano2-1.5B | 6 bits, grupo 8 | 4.096 | 1,1 GB | 1,32 GB | 2,4 GB |
| Qwen3-1.7B | 6 bits, grupo 8 | 4.096 | 1,3 GB | 1,12 GB | 2,4 GB |
| **Qwen3-4B** | **int4, grupo 32** | **4.096** | **2,1 GB** | **2,06 GB** | **4,2 GB** |

O `.app` com os três maiores tem **4,6 GB** e instala por `devicectl` em ~1 a 3 min. O limite de
4 GB é de **submissão à App Store**, não do aparelho.

## 2. A aritmética que decide se cabe

```
memória em execução  =  compilado  +  cache KV  +  o resto do app
```

- **Pesos**: parâmetros × bytes por parâmetro. 4B a 4 bits = 2,0 GB; a 16 bits seriam 8,0 GB.
- **Cache KV**: `2 × camadas × cabeças_kv × head_dim × 2 bytes` por token.
  Qwen3-4B (36 camadas, 8 cabeças, head_dim 128) = **144 KB/token**. Qwen3-1.7B = 112 KB/token.
- **Teto por processo** com o entitlement `increased-memory-limit`: ~6,4 GB `[estimativa de terceiro]`.
  O nosso único ponto medido é **2,90 GB morre**.

| configuração do 4B | compilado | KV | total | resultado |
|---|---|---|---|---|
| misto 4/8, janela 4.096 (22/09) | 2,30 GB | 0,60 | **2,90** | **jetsam, 3× seguidas** |
| int4, janela 1.024 | 2,06 | 0,15 | 2,21 | roda |
| int4, janela 2.048 | 2,06 | 0,29 | 2,35 | roda |
| **int4, janela 4.096** | **2,06** | **0,60** | **2,66** | **roda** |

**A janela não entra no artefato compilado**: os exports de 1.024, 2.048, 3.072 e 4.096 saíram
todos com `resources.bin` de **1,69 GB** e `.odix` de ~373 MB. Ela só custa memória em execução.

## 3. As quatro armadilhas do export

**A janela só aceita potências de dois.** 3.072 falhou com
`InferenceRuntimeError.invalidState("Failed to find an extend function with the max context
length of 3072")`. O exportador gera a escada **256 · 512 · 1.024 · 2.048 · 4.096** e o runtime
pede a função com o valor exato. Conferível antes de gastar a compilação:

```bash
strings -a <modelo>.aimodel/main.mlirb | grep -oE "extend_[0-9]+_[0-9]+"
```

**A janela tem de caber a MAIOR leitura**, medida **no modelo que vai usá-la** (ver §4).

**O template de chat precisa do mesmo ajuste dos outros.** O export vem com
`{%- if enable_thinking is defined and enable_thinking is false %}`; os modelos que funcionam têm
`{%- if true %}`. Sem isso o modelo emite blocos `<think>` e a comparação sai enviesada.

**Compilar é GERAR, não abrir.** `CoreAILanguageModel(resourcesAt:)` devolve em menos de um
minuto sem escrever cache: ele cria o motor **preguiçosamente**. Quem cronometra a especialização
no benchmark da Apple é o `EngineFactory.createEngine`. Um token de geração basta para forçá-la.

## 4. Contagem de tokens é por modelo

Mesmo caderno da Retrospectiva (Movimento), mesmo pedido:

| modelo | tokens do pedido |
|---|---|
| Tucano2-1.5B | **1.775** |
| Qwen3-4B | **2.039** |

**13% de diferença**, porque o tokenizador do Tucano viu mais português. Dimensionar a janela do
Qwen pelo número do Tucano foi o erro que produziu a janela de 2.048 — e com ela o 4B consumiu
2.039 dos 2.048 e escreveu **nove tokens**, aprovados pelo portão.

E a mesma física entre línguas, medida com o tokenizador embarcado sobre um trecho real:

| | tokens |
|---|---|
| português | 329 |
| inglês | 274 |
| **economia** | **16,7%** |

## 5. O que o 4B faz e não faz

| leitura | pedido | saída | resultado |
|---|---|---|---|
| Saúde do sono | 617 | texto | **funciona** |
| Retrospectiva · sono | ~1.850 | texto | **funciona** (janela 4.096) |
| Retrospectiva · movimento | 2.039 | texto | a confirmar com 4.096 |
| **Nome de rota** | 1.114 | **esquema** | **`No logits returned from engine`** |

**O nome de rota é o problema aberto.** Não é janela: 1.114 tokens já cabiam em 2.048. É o
caminho da **geração restrita por esquema**, e só o 4B falha nele — o Qwen3-1.7B e o Tucano2
completam. Falhou duas vezes, depois de ~76 s de trabalho.

## 6. O portão não tem piso de tamanho

`verificarTexto` confere número inventado, causa afirmada e correlação fora do portão. **Não
confere quantas palavras.** Um texto de nove tokens que não erre nada é aprovado — foi o que
aconteceu, e é a fronteira exata de até onde a medição automática vai. A taxa de 22/22 do
Qwen3-1.7B mede correção, não riqueza.

## 7. Custos operacionais que ninguém previa

**Cada export é um cache novo no telefone, e o anterior não se apaga.** Em 24/09 havia **oito**
modelos em cache somando ~9,2 GB, dos quais **7,4 GB são tentativas mortas do 4B**. O
`clearCache` foi declarado na fatia 3 sem botão, porque não tinha sido provado; agora há motivo e
material de teste.

**O `[CP] Copy Pods Resources` copia por rsync sem `--delete`.** Trocar um modelo deixava o
anterior dentro do `.app` (4,6 → 6,7 GB, dois `.aimodel` na mesma pasta, ficha contando "0 de 2").
Aconteceu **duas vezes no mesmo dia**; o `mobile/scripts/ios-device.sh` passou a apagar `pesos/`
antes do build.

**Compilar leva ~10 min por modelo** e estoura os limiares de CPU e de escrita em disco do iOS —
os `.ips` de `cpu_resource` e `diskwrites_resource` são esperados, não são mortes.

---

## O padrão, que vale mais que os fatos

Cada uma das armadilhas da §3 custou **uma rodada inteira** — export, compilação e build, horas —
e cada uma era uma **checagem de minutos** que não foi feita antes de gastar. Em todas, supor
onde dava para medir.

Antes da próxima compilação: o maior prompt entre **todas** as leituras, contado **no tokenizador
daquele modelo**; o valor na escada de `extend`; e o que de fato dispara a especialização.
