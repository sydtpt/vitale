# Licence verification from official texts — r2-1 (FINAL)

Accessed 2026-09-21 (all sources are live pages; "pub_date" = n/a, last-push dates given where GitHub gave them). NOT legal advice: this reports what the retrieved texts say.
**Method caveat:** WebFetch summarises pages, so every "quote" below is as relayed by the summariser (usually verbatim, not guaranteed). Items marked *memory* were NOT retrieved this run and are unverified beliefs. For GitHub repos the licence was read from the GitHub REST search API (`license.spdx_id`, GitHub's own detection of the LICENSE file) — that is the **code** licence and is NOT the weights licence (see Trap 1). Budget: 20 tool calls used; ~13 distinct sources.

## Findings

claim | source URL | publisher | conf | class | needs-2nd-source
- FLUX.2 [klein] 4B is Apache-2.0, repo not gated; "Open weights available for commercial use under the Apache 2.0 license." | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B | Black Forest Labs (HF card) | H | licence | no
- 4B card lists prohibited uses (violating law; exploiting/harming minors; deceptive/fraudulent content; PII generated for harm; harassment/abuse; non-consensual intimate imagery; "fully automated decision making or high risk applications that adversely impact an individual's legal rights") and says "Filters or manual review must be used"; inference code adds "pixel-layer watermarking" and C2PA metadata. Legal force under Apache-2.0 unclear — the card, not the licence, is the source. Card also shows 44 quantizations / 58 finetunes / 76 adapters already published (evidence derivatives exist, not a licence statement). | same | BFL | M | licence | yes
- FLUX.2 [klein] 9B: licence "FLUX Non-Commercial License", repo **gated** ("agree to share your contact information"), "Available for non-commercial use"; card: "Filters or manual review must be used with the FLUX.2 [klein] 9B models under the terms of the FLUX Non-Commercial License"; prohibited uses include "To generate or disseminate deceptive, fraudulent, misleading or otherwise harmful content", "To create non-consensual intimate imagery…", "For fully automated decision making or high risk applications". The licence text (LICENSE.md) **returned HTTP 401** (`…/FLUX.2-klein-9B/raw/main/LICENSE.md`) → the redistribution-of-derivatives/quantised-weights clause is UNVERIFIED. | https://huggingface.co/black-forest-labs/FLUX.2-klein-9B | BFL | H (NC) / L (redistribution) | licence | yes
- `black-forest-labs/flux2` code repo is Apache-2.0 (pushed 2026-03-12) — code only, does not cover the 9B weights. | api.github.com/search/repositories | GitHub | M | licence | no
- SD 1.5: repo `stable-diffusion-v1-5/stable-diffusion-v1-5` states "This repository is a mirror of the now deprecated `ruwnayml/stable-diffusion-v1-5`, this repository or organization are not affiliated in any way with RunwayML." Licence "The CreativeML OpenRAIL M license". Card's misuse list: "Impersonating individuals without their consent", "Sexual content without consent of the people who might see it", "Mis- and disinformation"; "not trained to be factual or true representations of people or events". Card does NOT state commercial-use/redistribution terms; the licence text itself was not fetched. | https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5 | community mirror (HF) | H (card) / L (terms) | licence | yes
- Stability AI Community License: free access "for people or organizations generating annual revenue of less than US $1,000,000"; "If at any time You or Your Affiliate(s)…generate more than USD $1,000,000 in annual revenue…any licenses granted to You under this Agreement shall terminate"; above that "You must request a license from Stability AI, which Stability AI may grant to You in its sole discretion"; must "prominently display 'Powered by Stability AI' on a related website, user interface, blogpost, about page, or product documentation"; Derivative Works include "'fine tune' and 'low-rank adaptation' models"; comply with "Stability AI's AUP, which is hereby incorporated by reference"; cannot use materials "to create or improve any foundational generative AI model (excluding the Models or Derivative Works)". The fetched page pointed to stability.ai/core-models and did not itself name SD 3.5 Medium; the SD 3.5 HF card was not read. | https://stability.ai/community-license-agreement | Stability AI | H (agreement) / M (that it governs SD 3.5 Medium) | licence | yes
- SAM 2 / 2.1: "The SAM 2 model checkpoints, SAM 2 demo code (front-end and back-end), and SAM 2 training code are licensed under Apache 2.0"; Inter Font and Noto Color Emoji in the demo are SIL OFL 1.1. Repo Apache-2.0, pushed 2026-05-30. | https://raw.githubusercontent.com/facebookresearch/sam2/main/README.md | Meta | H | licence | no
- BiRefNet: HF `license: MIT`, GitHub repo MIT (pushed 2026-09-02). Card excerpt gave no per-variant terms and no statement on training-data provenance. | https://huggingface.co/ZhengPeng7/BiRefNet | ZhengPeng7 | M | licence | yes
- MobileSAM Apache-2.0 (pushed 2026-05-05); EfficientSAM Apache-2.0 (last push 2024-12-24 — stale); both GitHub-detected repo licence, weights licence not separately read. | api.github.com | GitHub | M | licence | yes
- EdgeSAM: README "This project is licensed under NTU S-Lab License 1.0 … Redistribution and use should follow this license." GitHub detection: NOASSERTION (custom text). The licence text itself was NOT read. README says the demo iOS app "CutCha" is on the App Store and offers CoreML/ONNX export — that is not a licence grant. | https://github.com/chongzhou96/EdgeSAM | chongzhou96 | M (name) / L (terms) | licence | yes
- Depth Anything V2: "Depth-Anything-V2-Small model is under the Apache-2.0 license." "Depth-Anything-V2-Base/Large/Giant models are under the CC-BY-NC-4.0 license." README says nothing about metric-depth checkpoints' licences. Repo badge Apache-2.0 (pushed 2026-03-24) — code only. | https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/README.md | DepthAnything | H | licence | no
- Depth Anything 3 README model table: **CC BY-NC 4.0** = DA3NESTED-GIANT-LARGE(-1.1), DA3-GIANT(-1.1), DA3-LARGE(-1.1); **Apache 2.0** = DA3-BASE, DA3-SMALL, DA3METRIC-LARGE, DA3MONO-LARGE. Repo Apache-2.0 (pushed 2026-07-27). | https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/README.md | ByteDance Seed | M-H (summariser read a table) | licence | yes
- `apple/coreai-models`: "This project is licensed under the BSD 3-Clause License." The README fetched contains **no statement** about the licence of model weights/exported models, no "each model has its own licence" disclaimer, and no redistribution notice; models are discovered via `uv run coreai.model.registry --list-models` (per-model READMEs live under `models/`, not read). Which Depth-Anything size/licence the Core AI `depth-anything` recipe pulls: NOT determined. Repo pushed 2026-09-19. | https://raw.githubusercontent.com/apple/coreai-models/main/README.md | Apple | H (code) / L (weights) | licence | yes
- Apple Depth Pro: HF licence tag `apple-amlr`; card gives no terms. Licence text not read; `apple/ml-depth-pro` was **absent** from the GitHub API result (asked for 8 repos, 7 returned). | https://huggingface.co/apple/DepthPro | Apple | M (tag) / L (terms) | licence | yes
- Gemma 4: HF API metadata shows `apache-2.0` for google/gemma-4-31B-it, -12B-it, -26B-A4B-it, -E4B-it, -E2B-it, -E4B, -E2B and the official `gemma-4-E2B-it-qat-q4_0-gguf`; no gating indicator. Gemma 3 models carry `gemma` licence + gate ("To access Gemma on Hugging Face, you're required to review and agree to Google's usage license."). Card body and Gemma Terms of Use NOT read. | https://huggingface.co/api/models?author=google&search=gemma-4&limit=20&expand[]=cardData | Hugging Face API | M | licence | yes
- Runtime/code repos (GitHub-detected SPDX): llama.cpp MIT (pushed 2026-09-21); mlx MIT; mlx-swift MIT; LiteRT Apache-2.0; LiteRT-LM Apache-2.0; coreai-models BSD-3-Clause; **executorch: NOASSERTION**; **react-native-executorch: NOASSERTION**; **PowerBeef/Imarello: licence null (no licence file detected)**. | api.github.com/search/repositories?q=repo:… | GitHub | M | licence | yes
- Other code repos: CLIP MIT; Real-ESRGAN BSD-3-Clause (last push 2024-08-06); SwinIR Apache-2.0 (2024-05-14); EDSR-PyTorch MIT (2023-01-03); big_vision (SigLIP code) Apache-2.0. Weights licences for these NOT read. | api.github.com | GitHub | M (code) | licence | yes

## Candidate matrix (licence)

Columns: item | licence | commercial use | redistribute converted/quantised weights | attribution | key restrictions/thresholds | decisive quote (URL above) | conf

| Item | Licence | Commercial | Redistribute converted/quantised | Attribution | Restrictions / thresholds | Decisive quote | Conf |
|---|---|---|---|---|---|---|---|
| FLUX.2 klein 4B | Apache-2.0 | Yes | Derivatives allowed by Apache-2.0 (44 quantizations already on HF); Apache text not fetched | Apache-2.0 duty (summariser: "requires attribution", no wording) | Card prohibited-use list + "Filters or manual review must be used"; watermark/C2PA in inference code | "Open weights available for commercial use under the Apache 2.0 license." | H |
| FLUX.2 klein 9B | FLUX Non-Commercial License (gated) | **No** | **UNVERIFIED** (LICENSE.md 401) | unknown | filters/manual review required "under the terms of the FLUX Non-Commercial License" | "Available for non-commercial use" | H (NC) / L (redistribution) |
| SD 1.5 (mirror repo) | CreativeML OpenRAIL-M | not stated on card (*memory*: allowed) | not stated on card (*memory*: allowed if use restrictions are passed on) | n/a | misuse list incl. "Impersonating individuals without their consent" | card quote left | H card / L terms |
| SD 2.1 | *memory*: CreativeML Open RAIL++-M | — | — | — | — | not reached | unverified |
| SD 3.5 Medium | Stability AI Community License | Yes below US$1M annual revenue (incl. Affiliates); above → licence terminates, Enterprise licence at Stability's "sole discretion" | Derivatives incl. fine-tune/LoRA covered by the agreement; further redistribution terms not captured | "Powered by Stability AI" displayed in UI/docs | AUP incorporated; no using materials to improve another foundation model | "…annual revenue of less than US $1,000,000" | H agreement / M coverage |
| SAM 2 / 2.1 | Apache-2.0 (checkpoints, code) | Yes | Yes (Apache-2.0) | Apache duty | fonts in demo under OFL | "model checkpoints … are licensed under Apache 2.0" | H |
| MobileSAM | Apache-2.0 (repo) | Yes | Yes (repo) | Apache duty | weights file licence not read | — | M |
| EfficientSAM | Apache-2.0 (repo) | Yes | Yes (repo) | Apache duty | stale repo (2024-12) | — | M |
| EdgeSAM | NTU S-Lab License 1.0 | **UNVERIFIED** | "Redistribution and use should follow this license" | unknown | text unread (GitHub: NOASSERTION) | "licensed under NTU S-Lab License 1.0" | M name / L terms |
| BiRefNet | MIT | Yes | Yes | MIT notice | training-data provenance not checked | HF tag MIT | M |
| Depth Anything V2 Small | Apache-2.0 | Yes | Yes | Apache duty | — | "Small model is under the Apache-2.0 license" | H |
| Depth Anything V2 Base/Large/Giant | CC-BY-NC-4.0 | **No** | NC | BY | non-commercial | "Base/Large/Giant models are under the CC-BY-NC-4.0 license" | H |
| Depth Anything 3 Small/Base/Metric-Large/Mono-Large | Apache-2.0 | Yes | Yes | Apache duty | — | README table (Apache 2.0 rows) | M-H |
| Depth Anything 3 Large/Giant/Nested (+1.1) | CC BY-NC 4.0 | **No** | NC | BY | non-commercial | README table (CC BY-NC 4.0 rows) | M-H |
| Apple Depth Pro | `apple-amlr` | **UNVERIFIED** | UNVERIFIED | unknown | text unread | HF tag only | L |
| Gemma 4 (E2B…31B) | Apache-2.0 (HF metadata) | Yes (if metadata = card) | Official QAT q4_0 GGUF is itself listed Apache-2.0 | Apache duty | card/terms unread | metadata `apache-2.0` | M |
| Gemma 3 / 3n | `gemma` licence, gated | *memory*: yes with ToU | *memory*: flow-down of ToU | — | Gemma Terms of Use + prohibited-use policy unread | "required to review and agree to Google's usage license" | M (gate) / L (terms) |
| Qwen3 / VL / 3.5, Llama 3.2 | — | — | — | — | not reached | — | unverified |
| CLIP / SigLIP(2) | code: MIT / Apache-2.0 | code yes | weights licence unread | — | — | repo detection only | M code / unverified weights |
| EDSR / Real-ESRGAN / SwinIR | code: MIT / BSD-3 / Apache-2.0 | code yes | weights unread | — | — | repo detection only | M code |
| Bonsai Image 4B (PrismML) | — | — | — | — | not reached | — | unverified |
| coreai-models | BSD-3-Clause (code) | Yes | **No statement about exported weights** | BSD notice | weights inherit upstream (inference, not stated) | "This project is licensed under the BSD 3-Clause License." | H code / L weights |
| MLX, mlx-swift, llama.cpp | MIT | Yes | n/a | MIT notice | — | GitHub detection | M |
| LiteRT, LiteRT-LM | Apache-2.0 | Yes | n/a | Apache duty | — | GitHub detection | M |
| ExecuTorch, react-native-executorch | custom (NOASSERTION) | unverified | n/a | unverified | read LICENSE before shipping (*memory*: BSD-style / MIT — unverified) | — | L |
| Imarello | **no licence** | unverified (no grant) | no grant | — | code cannot be assumed reusable | `license: null` | M |

## Publishing blockers (what the text says would block, or cannot be cleared from retrieved text)
1. **FLUX.2 [klein] 9B** — "FLUX Non-Commercial License", "Available for non-commercial use". Use the Apache-2.0 **4B** instead. (Whether a free App Store app counts as "non-commercial" depends on the licence's definition, which was gated/unread.)
2. **Depth Anything V2 Base/Large/Giant** and **DA3 Large/Giant/Nested** — CC-BY-NC-4.0. Ship V2 **Small** or DA3 **Small/Base/Metric-Large/Mono-Large** (Apache-2.0). Which DA3 size Apple's `depth-anything` recipe pulls is unverified — check before assuming the exported artefact is publishable.
3. **EdgeSAM** — NTU S-Lab License 1.0, text unread; treat as blocked until read. **Apple Depth Pro** — `apple-amlr`, text unread; treat as blocked until read. (RMBG-2.0 CC BY-NC 4.0 and SAM 3 SAM License are already known per brief, not re-checked.)
4. **Imarello** — GitHub reports no licence: no permission to reuse/redistribute its code.
5. **ExecuTorch / react-native-executorch** — GitHub could not classify the LICENSE (NOASSERTION); read the files before committing to them as the shipped runtime.
6. Conditional, not blocking for an indie: **SD 3.5 Medium** — revenue < US$1M (with Affiliates), "Powered by Stability AI" on UI/docs, AUP by reference, licence terminates above threshold. **Gemma 3/3n** — gated ToU (unread).

## Personal-use only, fine (usable today in the personal app, must be swapped/cleared before publishing)
FLUX.2 klein 9B; DA V2 Base/Large/Giant; DA3 Large/Giant/Nested; EdgeSAM; Depth Pro; RMBG-2.0; SAM 3 (last two per brief). Clear-to-publish on retrieved evidence: FLUX.2 klein 4B (Apache-2.0), SAM 2/2.1 (Apache-2.0, checkpoints stated), DA V2 Small, DA3 Small/Base/Metric/Mono, BiRefNet (MIT; provenance caveat), MobileSAM/EfficientSAM (Apache-2.0 repos), Gemma 4 (Apache-2.0 metadata), MLX/mlx-swift/llama.cpp/LiteRT/LiteRT-LM/coreai-models (permissive).

## Licence traps not on the list
1. **Repo badge ≠ weights licence.** Depth-Anything-V2 and Depth-Anything-3 repos show Apache-2.0 while Base/Large/Giant (V2) and Large/Giant/Nested (DA3) weights are CC (NC); `black-forest-labs/flux2` is Apache-2.0 while the 9B weights are NC. Never infer weights terms from the GitHub badge.
2. **Prohibited-use lists apply to a photo app.** FLUX.2 cards forbid non-consensual intimate imagery, "deceptive, fraudulent, misleading or otherwise harmful content", PII generation for harm, and say "Filters or manual review must be used" (9B: explicitly "under the terms of the FLUX Non-Commercial License"; 4B: on the card, legal force under Apache-2.0 unclear). SD 1.5's OpenRAIL-M misuse list includes "Impersonating individuals without their consent". None forbids restyling one's own photos outright, but the pipeline edits photos of companions/selfies, so content-filter/manual-review and watermark/C2PA expectations should be planned for a published version.
3. **Stability revenue test counts Affiliates** and terminates the licence (not just a fee), with "sole discretion" enterprise terms.
4. **Apple Core AI recipes:** the repo's BSD-3 covers the recipe code; the README says nothing about exported weights, so converted weights presumably inherit the upstream licence (my inference, not stated).
5. **SD 1.5 provenance:** the "official" repo is a community mirror of a deprecated RunwayML repo, unaffiliated with RunwayML.
6. **Distribution vs download:** licence duties (attribution, licence copy, flow-down of use restrictions) attach when the developer redistributes weights (in-app or from own server); whether pointing users to the upstream HF/BFL URL changes that is a question for counsel — not evidenced here.
7. **App Store side** (Developer Program License Agreement, Review Guidelines on generative AI/downloaded model content) — not checked this run.

## Hypotheses checked
- FLUX.2 klein 4B Apache-2.0 → **confirmed** (HF card). 9B "FLUX Non-Commercial License" → **confirmed**. "Redistribution of derivative/quantised weights prohibited" → **not found / unverified** (LICENSE.md gated, HTTP 401; card only says the licence governs "the model and its derivatives").
- SD 1.5 CreativeML OpenRAIL-M; authoritative repo → **partly**: licence confirmed; the current repo is a community mirror of a deprecated RunwayML repo; terms text not read; SD 2.1 not reached.
- SD 3.5 Medium revenue threshold/attribution → **confirmed** for the Community License agreement (US$1,000,000; "Powered by Stability AI"); explicit coverage of SD 3.5 Medium not seen on the page read.
- SAM 2/2.1 Apache-2.0 → **confirmed** (README names checkpoints). MobileSAM/EfficientSAM Apache-2.0 → **confirmed for repos**, weights not read. EdgeSAM permissive → **overturned/unresolved** (NTU S-Lab License 1.0, text unread). BiRefNet MIT → **confirmed** (tag + repo).
- Depth Anything V2 Small vs Base+ → **confirmed** (Apache vs CC-BY-NC-4.0). DA3 → **confirmed split** (Small/Base/Metric-Large/Mono-Large Apache; Large/Giant/Nested NC). Which size Apple's recipe pulls → **not found**. Depth Pro → **partly** (tag `apple-amlr`, text unread).
- Gemma 4 Apache-2.0 vs Gemma ToU → **partly confirmed**: HF metadata Apache-2.0 for all Gemma 4 variants, `gemma` + gate for Gemma 3; card text/terms unread. Qwen3/3-VL/3.5 and Llama 3.2 → **not reached**.
- CLIP/SigLIP/EDSR/Real-ESRGAN/SwinIR → **code licences confirmed via GitHub**, weights not read. Bonsai Image 4B → **not reached**.
- B: coreai-models BSD-3 → **confirmed** (README); "any statement on exported weights" → **none found**. MLX/mlx-swift/llama.cpp MIT, LiteRT/LiteRT-LM Apache-2.0 → **confirmed by GitHub detection**. ExecuTorch, react-native-executorch → **unresolved (NOASSERTION)**. Imarello → **no licence**.

## Leads worth chasing
- FLUX.2-klein-9B LICENSE.md is gated for anonymous fetch (401): a human with HF access, or BFL's own licence/legal pages, must supply the clause on Derivatives and quantised weights.
- `apple/coreai-models` `models/depth-anything/` (and other) per-model READMEs: upstream checkpoint + licence of each recipe; also whether recipes fetch weights at build time (then who redistributes).
- EdgeSAM `LICENSE`, `apple/ml-depth-pro` LICENSE (repo missing from API result) and HF `apple/DepthPro` LICENSE file.
- ExecuTorch and react-native-executorch LICENSE text (NOASSERTION) — likely the shipped runtime for the RN host.
- Gemma 4 card + Gemma Terms page to confirm Apache-2.0 in text (and whether the official QAT GGUF carries the same); Qwen family, Llama 3.2, SD 3.5 Medium HF card, SD 2.1, Bonsai Image 4B, SigLIP2/CLIP HF weight cards, Real-ESRGAN/SwinIR release weights.
- BiRefNet training-data provenance vs MIT weights (unchecked).
- Contradiction to keep in view: EdgeSAM README advertises an App Store app and CoreML export, yet its licence is a non-standard NTU S-Lab licence — the grant text decides, not the README.

## Looked for and could not find
- Full text of FLUX Non-Commercial License (401 gated).
- Any statement in the coreai-models README about licences of exported weights.
- Licence terms text for EdgeSAM, Apple Depth Pro, Gemma 3/3n, CreativeML OpenRAIL-M, and explicit SD 3.5 Medium coverage on the Stability page.
- Qwen3 / Qwen3-VL / Qwen3.5, Llama 3.2, Bonsai Image 4B (PrismML), SD 2.1: not fetched (budget spent).
- `apple/ml-depth-pro` in the GitHub API result (7 of 8 repos returned).
