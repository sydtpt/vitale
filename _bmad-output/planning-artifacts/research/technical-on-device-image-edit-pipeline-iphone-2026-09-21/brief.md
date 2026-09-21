# Common research brief (read fully before starting)

Today is **2026-09-21** (September 2026). Your training data ends around January 2026, so
the field has moved a lot: every model name, API, version, number and licence you "know" is
a **hypothesis to verify with current sources**, not a fact.

## The decision this research serves

Is a **fully on-device** (no cloud, offline after weights are downloaded) image-editing
pipeline feasible on **iPhone 17 Pro or newer (12 GB RAM, iOS 27)**, chaining:

1. subject/foreground segmentation **when the photo has a clear subject**. **USER CORRECTION (2026-09-21): the photos are general photos the user takes during the day while doing physical activities (rides, runs, walks): landscapes, streets, companions/people, selfies, food, pets, objects, sky. A bicycle appears only occasionally — do NOT optimise for the cyclist+bike case.** Segmentation must be subject-agnostic (person, animal, object, sky, or no clear subject at all, where it may be skipped),
2. generative restyle of the **background only** *or of the whole image* (structure-preserving diffusion img2img / inpainting, possibly ControlNet, or non-diffusion style transfer),
3. recomposition of the original subject (when segmented) over the restyled background + colour harmonisation,
4. a deterministic overlay drawn by app code (route map, elevation profile, ride stats) — numbers never go through a generative model,
5. a small language (or vision-language) model, or rules, choosing one of ~4–6 predefined style presets from ride metadata (distance, elevation, time of day, weather).

Latency is **not** critical (tens of seconds is fine; initial target < 60 s end to end).
**Memory (per-process limit), thermals and model swapping are the real risks.** The host app is
React Native / Expo (SDK 57, RN 0.86, New Architecture); a local Swift native module is acceptable.
The app is personal today but the team wants to know what would block publishing.

The models named in your specific brief are only **suggestions written by someone whose
knowledge may be stale**. Verify each claim, and **propose better options** if you find them.

## Epistemics — two standing rules (verbatim)

1. **Never conclude from training data alone.** What you already know proposes hypotheses, queries, and structure; conclusions require evidence retrieved *this run*. A claim you cannot evidence is stated as an unverified belief or not at all.
2. **The research firewall.** You have only this brief. Do not read or search local project files, and do not use the shell. Your tools are WebSearch, WebFetch (load them with ToolSearch `select:WebSearch,WebFetch` if they are not directly callable) and Write (only for your digest file). Every claim you report must trace to a source you actually retrieved.

## Source craft (technical research)

- Prefer **primary sources**: official docs (developer.apple.com, WWDC session pages/transcripts), GitHub repos (README, releases, *issues*), Hugging Face model cards (incl. licence), papers (arXiv), Apple machine-learning research posts.
- Read the retrospective/issue threads, not the launch posts. Favour accounts with **production numbers** (device, config, resolution, steps, quantisation) over advocacy.
- Before citing a pain point, check whether it was **since fixed** — an old complaint against a current version is a false claim. Read repository activity over time (release dates, last commit), never a star snapshot.
- Red flags that downgrade confidence on sight: speculative language ("could", "may"), marketing register, unnamed sources, unsourced numbers, aggregators recycling a single upstream. **A large family of SEO sites publishes invented facts about Apple and AI models — treat any unattributed blog claim about Apple frameworks or model support as unverified until a primary source agrees.** Answer engines (Perplexity, Grok…) are aggregators: chase their citations, cite those.
- Conflicts resolve by recency, consistency with adjacent facts, and publisher quality — **never by averaging**. Report both sides.
- A number without its device, runtime, model size/quantisation, resolution and step count is nearly useless — record them, or say they are missing.

## Freshness bars

versions & compatibility ≤ 1 month · ecosystem signals ≤ 6 months · landscape ≤ 12 months (AI-adjacent ≤ 3 months) · patterns ≤ 2 years. Older sources are history — use them for context, flag them.

## Two-source classes (mark `needs-2nd-source` when only one source backs it)

version/compatibility claims · performance, memory or latency numbers a recommendation would rest on · claims that a technology or approach failed.

## Budgets and query craft

- Read at most **12 distinct sources** and make at most the **tool-call budget in your specific brief** (hard cap 20). When either is spent, synthesise what you have.
- **Short queries** (≈5 words or fewer) beat hyper-specific ones that return nothing. Broaden when results are sparse, narrow when abundant. Never repeat an identical query on the same tool. After every tool result pause and ask: what did this add, what gap remains, what is the best next query.
- WebSearch is US-only. For GitHub use WebFetch on the repo page, releases page, raw README and issue pages. For Apple docs, if developer.apple.com renders poorly, try WWDC transcript pages, the GitHub docs of the relevant Apple repo, or Apple's machine-learning research site.

## Return contract

1. **Write the full digest as markdown to the absolute path given in your specific brief** (use Write; create the file after your first ~5 tool calls with what you have, then overwrite with the final version — a crash must not lose your work). Structure:
   - `## Findings` — one row/bullet per claim: `claim | source URL | publisher | pub_date | accessed (2026-09-21) | confidence H/M/L | class (version|perf|memory|licence|capability|failure|landscape|other) | needs-2nd-source?`
   - `## Hypotheses checked` — each hypothesis listed in your specific brief with a verdict (confirmed / overturned / partly / not found) and the evidence.
   - `## Candidate matrix` — if your brief asks for one.
   - `## Leads worth chasing` — new entities, contradictions between sources, questions this round opened.
   - `## Looked for and could not find` — absence of evidence is a finding.
2. Then reply in chat with **at most 250 words**: the digest path, a verdict-level summary, the 3 most load-bearing claims, any contradictions, the best leads. No raw dumps.

Write the digest in English. Be dense; do not pad.
