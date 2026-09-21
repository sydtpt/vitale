# Brief — Edição de imagem on-device para histórico de pedais

> Entrada da pesquisa técnica de 21/09/2026, anexada pelo dono ao pedido. Copiada sem alterações.
> As correções feitas durante a pesquisa (fotos gerais e não só de bicicleta; pt-BR não é requisito) estão em
> [../research.md](../research.md).

> **Uso no BMAD:** entregar este arquivo ao agente **Analyst** como insumo do *Product Brief*. Em seguida, **PM** (PRD), **Architect** (arquitetura), **PO/SM** (épicos e stories) e **Dev/QA**. Os nomes exatos dos comandos variam entre versões do BMAD. Siga o fluxo da versão instalada.

---

## 1. Visão

Permitir que o usuário escolha uma foto de um pedal e gere uma imagem editada **100% no dispositivo**, combinando:
- estilização generativa guiada por **prompts pré-definidos** pelo app;
- dados reais da volta (GPX + Garmin) desenhados sobre a imagem (rota, altimetria, estatísticas).

A latência não é crítica: o processamento pode levar dezenas de segundos, com feedback de progresso.

## 2. Escopo

**Dentro**
- Seleção de foto vinculada a uma volta do histórico.
- Recorte do ciclista e da bike.
- Estilização do fundo por preset.
- Escolha automática de preset a partir dos dados da volta.
- Overlay de rota e estatísticas, e exportação/compartilhamento.

**Fora (v1)**
- Prompt livre digitado pelo usuário.
- Edição por instrução estilo "remova o carro".
- Processamento em nuvem.
- Vídeo.

## 3. Pipeline proposto

```
Foto + Volta (GPX/Garmin)
   │
   ├─1. RideSummary      → parse GPX/Garmin: distância, elevação, FC, potência, clima, horário
   ├─2. Preset Engine    → LLM pequeno escolhe preset + parâmetros (saída estruturada)
   │                        fallback: regras determinísticas
   ├─3. Segmentação      → SAM 3 (Core AI), prompt "person, bicycle" → máscara
   ├─4. Estilização      → Stable Diffusion ~0,9B img2img (+ ControlNet, se viável) só no fundo
   ├─5. Composição       → Core Image: fundo estilizado + ciclista original + ajustes de cor
   └─6. Overlay          → desenho da rota GPX, altimetria e stats via template
```

**Regra de ouro:** os números da volta **nunca** passam por modelo generativo. Eles são desenhados de forma determinística.

## 4. Stack técnica

| Camada | Escolha | Observação |
|---|---|---|
| Plataforma | iOS 27+, alvo iPhone 17 Pro (12 GB) | Definir o comportamento em aparelhos inferiores |
| Runtime de modelos | **Core AI** (`.aimodel`) | Receitas oficiais em `apple/coreai-models` |
| Segmentação | **SAM 3** (export oficial) | Alternativa leve: Vision `VNGenerateForegroundInstanceMaskRequest` |
| Estilização | **Stable Diffusion ~0,9B** img2img | FLUX.2 klein 4B **não cabe** no iPhone (limite de ~6,1 GB/processo) |
| LLM de presets | **Gemma 4 E2B** ou **Qwen3.5-2B** | Via Foundation Models (`CoreAILanguageModel`/`MLXLanguageModel`) com saída estruturada |
| Composição | Core Image + Core Graphics | Templates de overlay |
| Distribuição de modelos | Background Assets / download sob demanda | Não embutir modelos no binário |
| Integração com o app | **Decidir:** nativo Swift ou Expo Module (Swift) | Core AI é API Swift |

## 5. Épicos e stories

### E0 — Spike de viabilidade (fazer primeiro)
- **S0.1** Exportar SAM 3, SD ~0,9B e o LLM escolhido para `.aimodel` (iOS).
  - *AC:* os três rodam isoladamente no iPhone 17 Pro. Registrar tempo, pico de memória e tamanho em disco.
- **S0.2** Validar se o runtime de difusão do Core AI suporta img2img + ControlNet no iOS.
  - *AC:* decisão documentada: Core AI ou `ml-stable-diffusion` (Core ML) como fallback.
- **S0.3** Rodar o pipeline completo em sequência, carregando e descarregando os modelos.
  - *AC:* sem crash por memória. Tempo total medido.

### E1 — Infraestrutura de modelos
- **S1.1** `ModelManager`: download, verificação (hash), versionamento e remoção.
- **S1.2** Ciclo de vida: carregar um modelo por vez e liberar ao fim de cada etapa.
- **S1.3** Tela de gerenciamento: espaço usado e botão de baixar/remover.

### E2 — Contexto da volta
- **S2.1** `RideSummary` a partir do GPX (distância, ganho de elevação, duração, bounding box da rota).
- **S2.2** Enriquecer com os dados do Garmin (FC, potência, cadência, temperatura).
- *AC:* testes unitários com arquivos GPX reais.

### E3 — Preset Engine
- **S3.1** Catálogo de presets versionado em JSON (id, prompt, negative prompt, strength, paleta, template de overlay).
- **S3.2** Seleção por regras determinísticas (fallback e baseline).
- **S3.3** Seleção por LLM com saída estruturada, restrita aos IDs do catálogo.
  - *AC:* o LLM nunca devolve um preset inexistente. Timeout cai para as regras.

### E4 — Segmentação
- **S4.1** Máscara ciclista + bike via SAM 3.
- **S4.2** Refino de borda (feather) e fallback para Vision.
- *AC:* golden images com máscara aceitável em cinco fotos de referência.

### E5 — Estilização generativa
- **S5.1** img2img no fundo mascarado com os parâmetros do preset.
- **S5.2** ControlNet (se aprovado no S0.2) para preservar a estrutura da cena.
- **S5.3** Cancelamento e progresso por step.

### E6 — Composição e overlay
- **S6.1** Recompor o ciclista original sobre o fundo estilizado.
- **S6.2** Desenhar a rota GPX (projeção + simplificação) e o gráfico de altimetria.
- **S6.3** Templates de stats (2–3 layouts) e export em alta resolução com compartilhamento.

### E7 — UX
- **S7.1** Fluxo: volta → foto → preview do preset → gerar → antes/depois → salvar.
- **S7.2** Estados: baixando modelo, processando (com etapa atual), erro e cancelado.

### E8 — Qualidade e desempenho
- **S8.1** Monitorar estado térmico (`ProcessInfo.thermalState`) e pausar ou reduzir steps.
- **S8.2** Suíte de regressão visual (golden images) e benchmarks por etapa.

## 6. Requisitos não funcionais

- **Privacidade:** nenhuma foto ou dado da volta sai do aparelho.
- **Memória:** um modelo carregado por vez e pico abaixo do limite por processo.
- **Tempo:** meta inicial abaixo de 60 s no 17 Pro, a validar no E0.
- **Offline:** funciona sem rede depois que os modelos são baixados.
- **Degradação:** em aparelhos sem suporte, oferecer só o modo sem IA generativa (Vision + Core Image + overlay).

## 7. Riscos

| Risco | Mitigação |
|---|---|
| ControlNet indisponível no Core AI para iOS | Fallback para `ml-stable-diffusion` (Core ML) ou img2img puro com strength baixo |
| Pico de memória ao encadear modelos | Descarregar entre etapas, usar modelos paletizados/int4 |
| Artefatos da difusão na borda do ciclista | Estilizar só o fundo e aplicar feather na máscara |
| APIs do iOS 27 ainda mudando | Isolar o Core AI atrás de protocolos próprios (`Segmenter`, `Stylizer`, `PresetSelector`) |
| Licenças dos modelos (SAM 3, SD, Gemma) | Revisar as licenças antes de publicar e documentar a atribuição |
| Tamanho do download | Modelos opcionais, baixados sob demanda |

## 8. Decisões em aberto

1. App nativo Swift ou Expo com módulo nativo?
2. Qual LLM usar (Gemma 4 E2B ou Qwen3.5-2B)? Decidir por qualidade em PT-BR e latência.
3. Garmin: formato de importação (FIT, Connect API ou export)?
4. Quantos presets na v1 (sugestão: 4–6)?
5. Suporte mínimo de aparelho e comportamento em quem não tem iOS 27.

## 9. Ordem sugerida

**E0 → E1 → E2 → E3 (regras) → E4 → E6 → E5 → E3 (LLM) → E7 → E8**

Com isso, já existe um produto utilizável (recorte + overlay) antes da parte generativa, que é a mais arriscada.
