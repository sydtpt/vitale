# Orbe

A personal platform for running an entire routine: training, health, food, house, shopping and money.

Orbe exists because that data used to live in six apps that never talked to each other — a workout in one, macros in another, the grocery list in a third, the budget in a fourth. Nothing could answer a question that crossed two of them, like whether a bad week of sleep showed up in the numbers on the bar.

The whole repo leans on one split: **mobile captures, web analyses.** The phone is for logging during the day — a meal, a habit, a shopping item, how you slept — in as few taps as possible. The browser is for looking back: weekly dashboards, lift progression, heart-rate load, spend by category, a written recap of the week. It is a bias, not a wall: three of the six mobile tabs read rather than write, and the phone has stack routes for most analysis screens.

It is a personal project, built for one user, and shaped by that: decisions favour being right about this routine over being general.

> **On the name:** the product is Orbe. The npm scope stayed `@vitale/*` and the bundle IDs stayed `com.sydtpt.vitale` — renaming them would break builds and iOS entitlements, so only the visible brand changed.

## Quick start

**Prerequisites:** Corepack, and Node `^20.19 || ^22.12 || >=24` — that is what Angular CLI 21 accepts. The repo's own `engines` field says only `>=20`, which is looser than what actually runs; CI uses Node 22. pnpm is pinned to 11.22.0 by the `packageManager` field and Corepack reads it, so pnpm needs no separate install.

`pnpm mobile:ios` additionally needs macOS with Xcode, and `pnpm mobile:android` needs the Android SDK.

```bash
corepack enable pnpm
pnpm install

pnpm web:dev          # http://localhost:4200
pnpm mobile:start     # Expo DevTools / QR code
pnpm mobile:ios       # iOS simulator
pnpm mobile:android   # Android emulator
```

### Environment

`web/src/environments/environment.ts` is committed on purpose: it holds only the Supabase anon key, which is public and gated by row-level security.

Mobile is not covered by that. It reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the environment, there is no tracked example file, and both fall back to an empty string. A fresh clone without `mobile/.env` therefore builds and boots an app that talks to nothing, with no error to explain it.

> **Do not run `npm install` here.** The workspace uses pnpm's isolated resolution ([ADR 0016](docs/decisions/0016-pnpm-isolado-substitui-npm-workspaces.md)). npm rebuilds a flat tree and brings back the cross-workspace collisions that isolation removed. If it happens, delete `node_modules` and `package-lock.json`, then run `pnpm install`.

Isolated resolution has one consequence worth knowing up front: each workspace only sees what it declares. A dependency used without being in *that* workspace's `package.json` will not resolve — that is a missing declaration to fix, not an obstacle to work around.

## Repo layout

```
life-organizer/
├── packages/shared/   @vitale/shared   — domain models, design tokens, pure logic
├── web/               @vitale/web      — Angular 21 analytical dashboard
├── mobile/            @vitale/mobile   — Expo / React Native capture app
├── supabase/          Postgres + RLS + Deno edge functions + manual SQL scripts
├── patches/           pnpm patches — load-bearing, see below
├── docs/              specs, architecture decisions
├── _bmad-output/      BMAD planning and implementation artifacts
└── .github/           CI
```

Two dependencies are patched, keyed by version *range* rather than exact version so a bump does not silently skip the patch. `allowUnusedPatches` stays at its default of `false`, so a declared patch that fails to apply **kills `pnpm install`** — that is deliberate. The HealthKit patch is the one to respect: it carries background delivery, and if it stops applying nothing breaks in build or test, data just stops arriving ([ADR 0013](docs/decisions/0013-background-do-healthkit-exige-patch-na-lib.md)).

## Web — Angular 21

Standalone components everywhere, OnPush change detection, state in signals (`signal()` / `computed()`, no NgRx), SCSS, lazy-loaded feature routes. TypeScript 5.9. Maps use MapLibre with a Leaflet bridge.

Routes are defined in `web/src/main.ts`, not in an `app.routes.ts`.

| Group | Routes |
|---|---|
| Overview | `/semana` (default) · `/retrospectiva` |
| Training & health | `/treinos` · `/workout-history` · `/saude` · `/recuperacao` · `/habits` |
| Daily life | `/alimentacao` · `/compras` · `/casa` · `/tasks` · `/registros` · `/cultura` |
| Money & goals | `/financas` · `/metas` |
| Setup | `/conexoes` · `/configuracoes` |
| Auth | `/login` · `/register` · `/setup` |

`/workout-history` nests further: `/:slug` for one activity type, `/:slug/mapa` for its route map, and `/:slug/:id` for a single session. Order matters there — `/mapa` is declared before `/:id` so it is not swallowed as an id.

Every application route sits behind `profileGuard`, `''` redirects to `/semana`, and anything unmatched redirects to `/login`. `/setup` is the profile-onboarding gate a new account clears before any other route resolves.

## Mobile — Expo 57 / React Native 0.86

Expo Router (file-based, under `mobile/src/app/`), Zustand 5 for global state, React 19.2, TypeScript 6.0. Six tabs:

| Tab | Purpose |
|---|---|
| Hoje | The day: rings, meals, habits, tasks |
| Semana | Week strip, stats, heatmap |
| Histórico | Past activities and sessions |
| Saúde | Sleep, heart-rate zones, readiness |
| Compras | Shopping list grouped by category |
| Mais | Secondary modules and settings |

Animation uses React Native's own `Animated`. Reanimated is installed because `expo-router` requires it, but **it is not used** — see [ADR 0010](docs/decisions/0010-sem-reanimated-no-mobile.md).

`mobile/ios/` is not versioned. It is prebuild output ([ADR 0012](docs/decisions/0012-kingstinct-healthkit-devolve-o-prebuild.md)); edit the config, then regenerate with `expo prebuild`.

## Shared — `@vitale/shared`

The core has **no build step**. Its entry point is `src/index.ts` and both apps compile it as source. That is why it pins the *lowest* TypeScript among its consumers (5.8): a TS-6-only language feature written here breaks the web build far from where it was typed.

Three TypeScript versions coexist on purpose — 5.9 in web (Angular 21's ceiling), 6.0 in mobile (pinned by the Expo SDK), 5.8 in the core.

It holds domain models (`Meal`, `Habit`, `Chore`, `ShopItem`, `Treino`, `Lift`, `Transaction`, `Meta`, `DayData`, …) plus pure logic organised by domain: `fitness`, `health`, `goals`, `habits`, `todo`, `geo`, `chart`, `period`, `planner`, `week`, `cultura`, `astro`, `date`, `format`.

### Design system

Colour is born in `packages/shared/src/theme` and reaches a screen through `resolveTokens()` / `moduleOf()`. Do not write hex values in a screen.

`packages/shared/src/architecture.test.ts` is where the layering rules are policed, and it is worth knowing how it works. It mixes **barriers** — hard rules that fail on first violation: the core never imports from the apps, never constructs a `SupabaseClient`, no module-scope `StyleSheet` reads the theme, every web `var(--x)` traces back to the theme system — with **ratchets**, counts that may shrink but never grow. The hex rule is a ratchet, not a barrier: a large stock of hand-written hexes predates the theme system, so a new one can still slip under the ceiling. Treat the rule as binding regardless; the ratchet only stops the bleeding.

Four independent axes:

| Axis | Options | Governs |
|---|---|---|
| Scheme | system · light · dark · solar | light vs dark |
| Theme | `orbe` · `clean` · `cleanElev` | surface, ink, line |
| Palette | `orbe` · `bruma` · `terra` · `neon` · `joia` · `acessivel` | module and series colours |
| Brand | `laranja` · `tinta` · `azul` · `verde` | the chrome: FAB, CTA, toggle |

The solar scheme reads the device timezone rather than GPS, and switches at **civil twilight** — the sun 6° below the horizon — computed from the sun's current altitude, not from a stored sunrise/sunset pair ([ADR 0023](docs/decisions/0023-o-esquema-solar-le-o-fuso-nao-o-gps.md)). Sunrise and sunset were rejected on purpose: they darken the app while there is still light outside, and in a polar summer there is no sunset to compare against.

**Fonts:** Manrope (body), Geist Mono (numbers — tabular, so columns align), Instrument Serif (headings).

## Backend — Supabase

Postgres with row-level security, plus Deno edge functions:

| Function | Purpose |
|---|---|
| `connections-ingest` | Pulls activities from Strava, intervals.icu and Apple Health, deduping across sources ([ADR 0004](docs/decisions/0004-dedupe-multi-fonte-do-healthkit.md)) |
| `strava-oauth` | Strava OAuth handshake |
| `intervals-link` | intervals.icu linking |
| `cultura-search` | Lookup for books, films, podcasts and albums |

The schema lives in `supabase/migrations/` ([ADR 0011](docs/decisions/0011-schema-mora-em-migrations.md)). The one documented exception is `supabase/scripts/`, which holds SQL meant to be pasted into the SQL editor by hand — including `schedule_connections_ingest.sql`, which installs `pg_cron` and `pg_net` and schedules the ingest every 15 minutes. Rebuilding the project from migrations alone gives you a database that never ingests anything until that script is run.

`supabase/scripts/check-schema-drift.sh` compares production tables and columns against what the migrations create, and exits non-zero on drift. It does not see policies, triggers, functions or the cron job. It also needs more than a live database: a Supabase token from the **macOS keychain**, plus `curl` and `jq`, against a hardcoded project ref. That is why it is not part of the test run.

> The project is linked to a live Supabase project: **`supabase db push` reaches production.** Write the `.sql` into `supabase/migrations/` and apply it deliberately.

## Validation

CI (`.github/workflows/ci.yml`) runs these on every push and pull request, one job per workspace:

```bash
pnpm install --frozen-lockfile        # every job starts here; this is where patches are enforced

pnpm --filter @vitale/shared lint     # tsc over the core
pnpm --filter @vitale/shared test     # unit tests + architecture barriers and ratchets
pnpm --filter @vitale/web build       # compiles templates and TS
pnpm --filter @vitale/web test        # Vitest

(cd mobile && pnpm exec tsc --noEmit)
(cd mobile && pnpm exec jest)
(cd mobile && pnpm dlx expo-doctor)
```

The mobile lines are wrapped in subshells so they can be pasted as a block — chained bare, the second `cd mobile` fails against the first.

Iterating on one core test? The suite has no filter — its script runs every `*.test.ts` through `tsx` — so run the file directly: `cd packages/shared && pnpm exec tsx src/architecture.test.ts`.

Three things to know about this:

- **Linting from the root does not work** — neither `pnpm -r lint` nor the `pnpm lint` script that wraps it. The core passes, web fails (no `lint` target in `angular.json`), and mobile fails after it with exit 127, because eslint is not declared in any `package.json`. Validate workspace by workspace. `pnpm -r test`, by contrast, does work across all three.
- **There are no git hooks.** Nothing is checked at commit time — only after a push.
- **Green CI is not a working feature.** It does not cover the native iOS build or anything gated on a device.

Touched a dependency? Validate all three workspaces, not just the one that motivated the change. That is what CI does, and for good reason: before isolation, bumping mobile to TypeScript 6 broke the web build without anything in mobile complaining.

## Decisions

Architecture decisions live in [`docs/decisions/`](docs/decisions/), numbered and **append-only**. To change your mind, write a new one that supersedes the old; never edit a recorded decision.

That authoring rule implies a reading rule: **check the `Status:` line before trusting a decision.** Several are already superseded in part — 0009 by 0012, 0017 by 0018, the precedence in 0019 by 0021, the rollback in 0012 by 0014, the text token in 0022 by 0024 — and a decision is often superseded piecewise rather than wholesale.

The ones that shape day-to-day work most: [0016 pnpm isolation](docs/decisions/0016-pnpm-isolado-substitui-npm-workspaces.md), [0011 schema in migrations](docs/decisions/0011-schema-mora-em-migrations.md), [0010 no Reanimated](docs/decisions/0010-sem-reanimated-no-mobile.md), [0004 multi-source HealthKit dedupe](docs/decisions/0004-dedupe-multi-fonte-do-healthkit.md).

## Where the docs live

This README is the only document here written in English. Everything it links to — the ADRs, the specs, all four `AGENTS.md` files, the code comments — is in Portuguese, as is the product itself. The Portuguese route and palette names in the tables above are the real identifiers, not translations waiting to happen.

| Path | What it holds |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules for AI agents — policy, verified commands, known pitfalls. One per workspace too. |
| [`CLAUDE.md`](CLAUDE.md) | Project instructions and a status snapshot |
| [`docs/specs/`](docs/specs/) | Product specs. Newer features get a folder with `spec.md` and usually `plan.md` / `data-model.md`; older ones are a single flat file. |
| [`docs/decisions/`](docs/decisions/) | Architecture decision records |
| [`docs/upgrade-de-plataforma.md`](docs/upgrade-de-plataforma.md) | What CI cannot check: the SDK-upgrade and on-device gates |
| `_bmad-output/` | BMAD planning and implementation artifacts, including per-feature task lists |
