# Digest runtimes-r1-1 — on-device runtimes and iOS 27 platform limits
Accessed 2026-09-21 (all rows). Tool budget (20) fully spent: Q1 well covered, Q3 partly, **Q2 (alternative runtimes) and thermals NOT researched** — see "Looked for and could not find".
Caveat on method: WebFetch returns a small-model *summary* of the page, not verbatim text; two summaries contradicted themselves (SD README: "does not address img2img" yet lists `vae_encoder (enabling image-to-image)`). Quotes below are second-hand. Read the READMEs verbatim before building on them.

## Findings
Format: claim | source | publisher | pub_date | confidence | class | needs-2nd-source

### Q1 — Core AI
- Core AI is "the inference framework powering on-device Apple Intelligence", now open to developers; "more than just a framework": optimisation, conversion, debugging, integration. | https://developer.apple.com/videos/play/wwdc2026/324/ (Meet Core AI) | Apple | WWDC26 (Jun 2026) | H | capability | no (primary)
- Model format is `.aimodel` (`ai_program.save_asset("X.aimodel")`). PyTorch route: `torch.export.export` -> `run_decompositions(coreai_torch.get_decomp_table())` -> `coreai_torch.TorchConverter().add_exported_program(...).to_coreai()`. | same | Apple | WWDC26 | H | capability | no
- Runs "across the CPU, GPU, and Neural Engine"; "specialization" = (1) compile steps that "segment, plan and optimize compute" + (2) executable artifacts per compute unit; AOT compilation on the dev machine can precompile. Swift API: `AIModel(contentsOf:)`, `model.loadFunction(named:)`, `function.run(inputs:)`, async, NDArray inputs. Available "on all Apple Silicon". | same | Apple | WWDC26 | H | capability | no
- Session mentions "an API for creating a Core AI Language model, which plugs right in to the Foundation Models framework, letting you bring your own custom models and token sampling strategies" (custom LLMs behind Foundation Models). The exact type name `CoreAILanguageModel` was NOT confirmed in retrieved text. | same | Apple | WWDC26 | M | capability | yes
- The retrieved session summary says nothing about Core ML deprecation or MLX. | same | — | — | — | — | —
- `apple/coreai-models` = "Model export recipes, Python primitives, and Swift runtime utilities for on-device AI": dirs `models/`, `python/` (PyTorch authoring + export), `swift/` (runtime package for macOS/iOS), `skills/` (agent plugins: working-with-coreai, model-authoring, model-compression-exploration). Min **macOS and iOS 27.0+, Xcode 27.0+**. Recipes output a folder of `.aimodel` files. Code licence **BSD-3-Clause**. Closed to PRs at launch (issues welcome). Discovery: `uv run coreai.model.registry --list-models`. | https://github.com/apple/coreai-models (+ raw README) | Apple (GitHub) | 2026 (commit/release dates not retrieved) | H | capability/licence | yes (version freshness bar not met)
- Recipe directories: clap, clip, depth-anything (v3), edsr (super-resolution), efficient-sam, flux2, gemma3, gemma3n, gpt_oss, mistral, mixtral, muse_glimmer, olmo2, parakeet, phi, pvt, qwen2, qwen3, qwen3_moe, roberta, sam3, sam3_video, smollm2, stable-diffusion, t5, vlm (Qwen3-VL), wan, wav2vec2, whisper, yolo. Catalog groups: LLMs, Diffusion, VLMs, Vision, Audio, Text. | https://github.com/apple/coreai-models/tree/main/models and models/README.md | Apple | 2026 | H | capability | no
- LLM recipes have iOS-vs-macOS quantisation presets ("discussed extensively"); specific preset names/sizes not retrieved. | models/README.md | Apple | 2026 | L (summary only) | capability | yes
- **SAM 3**: `facebook/sam3`, 848M params; macOS + iOS ("restructured specifically for iOS"); iOS "lite" export at **336x336** (image encoder 4-bit k-means palettization gs=32 + fp16; text encoder 6-bit gs=8 + fp16); full export **1008x1008**; text prompts supported; point/box prompts not mentioned; HF-gated (licence acceptance before export); no latency/memory numbers. | .../models/sam3/README.md | Apple | 2026 | M-H | capability | yes
- **FLUX.2**: only "FLUX.2 Klein 4B" (4B params); macOS + iOS; iOS default **512x512**, macOS 1024x1024 (customisable); image-to-image/editing = "a VAE encoder plus an img2img transformer", reference tokens drive adherence (not noise blending); `--single-function` and `--low-memory` (half-res VAEs) cut peak memory; `--compression none` for full precision (default is compressed); no latency numbers; weights licence not stated in README. | .../models/flux2/README.md | Apple | 2026 | M-H | capability/memory | yes
- **Stable Diffusion**: SD 1.5, SD 2.1, SD 3.5 Medium (0.9B–2.5B); all three macOS + iOS; SD 1.x/2.x = text_encoder + unet + vae_decoder + vae_encoder (vae_encoder "enabling image-to-image"); SD 3.x = dual encoders + MMDiT; **no mention of ControlNet, inpainting, LoRA, SDXL, SD Turbo**; no quantisation/resolution/latency/memory numbers; some models HF-gated. | .../models/stable-diffusion | Apple | 2026 | M | capability | yes
- Weights licence: repo README carries no per-model licence table; SAM 3 and some SD models are HF-gated (user accepts upstream licence + token, then exports locally). Licence terms of converted weights / redistribution NOT retrieved. | repo + model READMEs | Apple | 2026 | M | licence | yes
- Ecosystem: `ultralytics/yolo-ios-app` PR #319 "Add Apple Core AI (.aimodel) backend for iOS 27+ with Core ML fallback" — third parties already ship Core AI with Core ML kept as fallback. (title only, PR body not read) | https://github.com/ultralytics/yolo-ios-app/pull/319 | Ultralytics | 2026 | M | landscape | yes

### Q1 — relation to Core ML / MLX / Foundation Models
- Aggregator blogs (byteiota, andrew.ooo, buildmvpfast, blakecrosley) say Core AI and Core ML "coexist in iOS 27", "Apple has not announced a deprecation date", `.mlmodel`/MLModel keep working, "MLX is for research/fine-tuning/open-weights LLMs", Foundation Models is the system LLM API. These are unattributed to any Apple statement. | search results (secondary) | various blogs | Jun–Sep 2026 | L | landscape | yes
- 9to5Mac (pre-WWDC rumour, 2026-03-01): "Apple replacing Core ML with modernized Core AI framework for iOS 27". Conflicts in tone with "coexist"; predates the announcement. | https://9to5mac.com/2026/03/01/apple-replacing-core-ml-with-modernized-core-ai-framework-for-ios-27-at-wwdc/ (headline only) | 9to5Mac | 2026-03-01 | L | landscape | yes
- Core AI language models "plug into" Foundation Models (Apple, above). Relationship to MLX: no primary source retrieved.

### Q3 — memory / platform limits
- iPhone 17 Pro has 12 GB RAM (MacRumors title "iPhone 17, Air, and iPhone 17 Pro: Here's How Much RAM in Each Model", 2025-09-09; and a PR author calls it "the device's 12 GB"). Conflict: the Zenn article labels its 17 Pro test device "8GB". Treat the Zenn device label as suspect. | https://www.macrumors.com/2025/09/09/iphone-17-pro-iphone-air-ram-amounts/ (title via search), https://github.com/boardsesh/boardsesh/pull/5524 | MacRumors / GitHub | 2025-09 / 2026 | M | other | yes
- Real-world sample: "An iPhone 17 Pro killed the hold-detector benchmark with 11 GB of the device's 12 GB still free" (jetsam kills far below physical RAM). Author measured no peak RSS; single anecdote. | https://github.com/boardsesh/boardsesh/pull/5524 | boardsesh (GitHub PR) | 2026 | L-M | memory | yes
- Entitlements: `com.apple.developer.kernel.increased-memory-limit` (iOS 15+) raises the resident/jetsam cap on capable devices but "does not allow allocation exceeding the physical RAM"; `extended-virtual-addressing` (iOS 14+) enlarges *virtual* address space only (fragmentation from many mmap regions), not the physical limit. Increased limit unchanged on 4 GB devices. | https://zenn.dev/mtfum/articles/ios_memory_entitlements | Zenn (mtfum) | 2026 | M | memory | yes (Apple entitlement doc page not fetched)
- Measured (Zenn): Gemma 4 E4B (3.65 GB model) on "iPhone 17 Pro" (device label suspect): load failed without entitlement; **either** entitlement alone gave 36/36 successful loads; peak memory **4,651 MB** (increased-limit only) / **4,775 MB** (EVA only). Inference (mine, unverified): EVA alone sufficing hints the pre-fix failure was an mmap/virtual-address failure, not a resident-set jetsam. | same | Zenn | 2026 | L-M | memory | yes
- Search-snippet claim (unattributed, could not tie to a page): "on a 6 GB device apps can reach ~4.5 GB; on 8 GB models roughly 6 GB" with the entitlement. | WebSearch summary | — | — | L | memory | yes
- `os_proc_available_memory()` exists (Apple doc page exists: https://developer.apple.com/documentation/os/os_proc_available_memory); page body not read.
- Origin of "≈6.1 GB per-process limit on iPhone 17 Pro": **not found** in 3 searches + 2 pages. Plausible (speculative) origin: an 8 GB-device figure (~6 GB with entitlement) recycled onto the 12 GB device. Not evidenced.

### Q3 — background execution
- Apple doc "Performing long-running tasks on iOS and iPadOS" returned only its title (JS-rendered page). Nothing retrieved on BGProcessingTask / BGContinuedProcessingTask GPU rules. **Unverified belief from training (not evidence):** Metal GPU work is refused for backgrounded apps, and iOS 26 added BGContinuedProcessingTask with a GPU entitlement on supported devices — verify at WWDC25 "Finish tasks in the background".

## Hypotheses checked
- **H1 Core AI models are `.aimodel` files produced by official recipes in apple/coreai-models — CONFIRMED (with a nuance).** README: recipes emit `.aimodel` folders; `coreai-torch` also converts arbitrary torch. Nuance: the repo ships *recipes*, not converted weights; gated upstream weights are exported locally by whoever accepts the licence. Evidence: repo + WWDC 324.
- **H2 Core AI diffusion includes img2img and ControlNet on iOS — PARTLY.** img2img: yes (SD 1.x/2.x have `vae_encoder`; FLUX.2 Klein 4B has an explicit VAE-encoder + img2img-transformer path with reference tokens; both list iOS). ControlNet: not mentioned anywhere retrieved; inpainting and LoRA also not mentioned. iOS FLUX default is 512x512.
- **H3 Core ML is not deprecated — PARTLY / UNCONFIRMED by Apple.** No primary Apple statement retrieved. Secondary blogs say coexistence with no deprecation date; a pre-WWDC rumour said "replacing"; Ultralytics keeps Core ML as fallback. Best reading: not formally deprecated as of Sept 2026, but only on low-quality evidence.
- **H4 Per-process limit on iPhone 17 Pro ≈ 6.1 GB — NOT FOUND (unverified).** No source states it; only anecdotes (kill at 11/12 GB free; a 3.65 GB model loading with peak 4.65 GB after entitlement). Do not carry the number into the decision; measure with `os_proc_available_memory()` on the target device.
- **H5 MLX Swift runs LLMs and diffusion on iPhone — NOT VERIFIED this run.** Only aggregator statements that MLX targets open-weights LLMs. Unverified belief (training data): mlx-swift-examples ships LLM and Stable Diffusion apps for iPhone. Chase the leads below.

## Candidate matrix (partial — budget spent on Q1/Q3)
| Runtime | Latest release | LLM | Diffusion | Segmentation | ANE/GPU | Measured iPhone number |
|---|---|---|---|---|---|---|
| Core AI (iOS 27) | not retrieved | qwen3, gemma3/3n, phi, smollm2, olmo2, gpt_oss, mistral, Qwen3-VL recipes | SD1.5/2.1/3.5M, FLUX.2 Klein 4B (iOS 512px) | SAM3 lite 336px, efficient-sam | CPU+GPU+ANE scheduled by framework | none in READMEs (Zenn: 3.65 GB LLM, 4.65 GB peak) |
| Core ML + coremltools + ml-stable-diffusion | not researched | — | — | — | — | — |
| MLX Swift | not researched | — | — | — | — | — |
| ExecuTorch, llama.cpp, ONNX RT, LiteRT/MediaPipe, Draw Things engine | not researched | — | — | — | — | — |

## Best unlisted options (from evidence)
1. Core AI's own first-party recipes already cover the whole chain: `sam3` (iOS lite) -> `flux2` Klein 4B img2img/edit (iOS) -> `edsr` super-resolution (bridge 512 px to output size) -> `qwen3`/`gemma3`/`vlm` for preset choice (or rules). One runtime, one format, one memory budget.
2. `efficient-sam` recipe as a lighter segmenter than SAM 3 (848M params).
3. Unverified beliefs (training only, not researched): Apple Vision foreground-instance-mask (iOS 17+) as a zero-download subject cut-out; MLC LLM (TVM) as another iOS LLM runtime (its repo has an EVA-entitlement issue #1260).

## Leads worth chasing
- Read verbatim: coreai-models `models/flux2`, `stable-diffusion`, `sam3` READMEs and the repo **Issues** tab (iOS memory, ANE compile, gated weights, ControlNet requests); commit/release dates.
- Medium (MLBoy, Jun 2026) "I Benchmarked Apple's New Framework Against MLX for On-Device LLMs" — measured numbers, not read.
- https://github.com/ultralytics/yolo-ios-app/pull/319 — a shipped Core AI integration with device numbers likely.
- https://developer.apple.com/machine-learning/ and Apple docs for `increased-memory-limit`; Apple Dev Forums threads 702400, 704945, 740831 (entitlement not raising the limit) for jetsam numbers.
- WWDC25 "Finish tasks in the background" transcript (BGContinuedProcessingTask + GPU) — primary source for the background question.
- MacRumors forum thread: iOS 27 gating features on 12 GB RAM (relevant to "iPhone 17 Pro or newer" floor).
- Contradiction: Zenn labels the 17 Pro "8GB", MacRumors says 12 GB.

## Looked for and could not find
- Any source for "6.1 GB per-process on iPhone 17 Pro" (3 searches, boardsesh PR, Zenn).
- A per-device jetsam table for iPhone 17 Pro / 16 Pro; the extra headroom `increased-memory-limit` grants on 12 GB devices.
- ControlNet or inpainting recipes in Core AI's diffusion set; any latency/memory figure for sam3, flux2 or SD on iPhone.
- Licence terms for converted weights / redistribution; a licence table in the repo.
- An Apple statement on Core ML deprecation status; Core AI vs MLX positioning from Apple.
- Release dates/versions for coreai-models (freshness bar unmet).
- Not searched (budget): Q2 runtimes (Core ML/coremltools, ml-stable-diffusion, MLX Swift, ExecuTorch, llama.cpp, ONNX Runtime, LiteRT/MediaPipe, Draw Things), thermal-throttling evidence and `ProcessInfo.thermalState` guidance, background GPU/ANE rules (Apple doc fetch returned title only).
