# Vitale — Life Organizer

> **Propósito:** Uma plataforma pessoal para gerenciar a rotina completa — treinos, alimentação, casa, compras e finanças. Web para análise, mobile para captura rápida do dia a dia.

## Arquitetura

Monorepo npm workspaces com 3 pacotes:

```
life-organizer/
├── packages/shared/      @vitale/shared  — tokens de design e modelos de domínio
├── web/                  @vitale/web     — Angular 20 dashboard analítico
└── mobile/               @vitale/mobile  — React Native / Expo (captura rápida)
```

## Comandos essenciais

```bash
# Instalar dependências
npm install

# Web (Angular 20) — http://localhost:4200
npm run web:dev

# Mobile (Expo)
npm run mobile:start       # QR code / Expo DevTools
npm run mobile:ios         # Simulador iOS
npm run mobile:android     # Emulador Android

# Linting e testes
npm run lint
npm run test
```

## Stack

### Shared (`packages/shared`)
- TypeScript 5 — modelos de domínio e design tokens
- Arquivo de entrada: `packages/shared/src/index.ts`
- Modelos: `Meal`, `Habit`, `Chore`, `ShopItem`, `Treino`, `Lift`, `FinancaCategory`, `Transaction`, `Meta`, `DayData`
- Tokens: `surfaces`, `ink`, `brand`, `accents`, `spacing`, `radii`, `fonts`, `MOD` (map de cores por módulo)

### Web (`web/`)
- **Angular 20** com standalone components
- **Store:** signals + `signal()` / `computed()` (sem NgRx)
- **Estilos:** SCSS, OnPush em todo lugar
- **Roteamento:** lazy-loaded feature routes
- Estrutura: `web/src/app/features/<modulo>/`

| Rota           | Módulo       |
|----------------|--------------|
| `/semana`      | Semana       |
| `/treinos`     | Treinos      |
| `/alimentacao` | Alimentação  |
| `/compras`     | Compras      |
| `/casa`        | Casa         |
| `/financas`    | Finanças     |
| `/metas`       | Metas        |

### Mobile (`mobile/`)
- **Expo 52** / React Native 0.76
- **Roteamento:** Expo Router (file-based, pasta `mobile/src/app/`)
- **Store:** Zustand 5
- **Animações:** Reanimated 3
- 5 tabs: Hoje, Semana, Fitness, Saúde, Mais

## Design System

Paleta quente, orgânica:

| Token         | Valor     | Uso                    |
|---------------|-----------|------------------------|
| `primary`     | `#F25C2B` | CTA, destaque principal |
| `bg`          | `#FFF7EE` | Fundo app mobile       |
| `bgWeb`       | `#FAF3E6` | Fundo web              |
| `surface`     | `#FFFFFF` | Cards                  |
| `ink`         | `#1F1B16` | Texto principal        |
| `ink2`        | `#5C534A` | Texto secundário       |
| `line`        | `#EFE6D8` | Bordas, separadores    |

**Fontes:** Geist (sans), Geist Mono, Instrument Serif

**Cores por módulo** (via `MOD` do shared):
- `treino` → laranja `#F25C2B`
- `food` → amarelo `#F5B946`
- `agua` → azul `#6E8CC9`
- `habito` → verde `#6FA86A`
- `casa` → marrom `#B4825B`
- `compras` → rosa `#E26A8A`
- `financas` → tinta `#1F1B16`

## Convenções de código

### Angular (web)
- Todo componente é **standalone** (`standalone: true`)
- Usar **OnPush** (`changeDetection: ChangeDetectionStrategy.OnPush`) em todos
- Estado local via `signal()`, derivações via `computed()`
- Injeção de dependência via `inject()` (não construtor)
- SCSS com variáveis CSS, sem magic values — usar tokens do shared
- Nomeação: `kebab-case` para arquivos, `PascalCase` para classes

### React Native (mobile)
- Componentes funcionais com hooks
- Estilos via `StyleSheet.create()` usando tokens do shared
- Estado global via Zustand store em `mobile/src/store/`
- Animações com `useAnimatedStyle` do Reanimated 3
- Nomeação: `PascalCase` para componentes, `camelCase` para hooks

### Shared
- Modelos de domínio são **somente leitura** — não adicionar lógica de negócio
- Design tokens exportados do `packages/shared/src/constants/tokens.ts`
- Modelos exportados do `packages/shared/src/models/index.ts`

## Status atual

### Feito ✅
- Estrutura monorepo com workspace compartilhado
- Design tokens e modelos de domínio completos
- Web: roteamento, sidebar, 7 páginas de feature
- Web: dashboard Semana completo (heatmap, gráficos, listas, stats)
- Web: página Treinos (gráfico de lift, gráfico de corrida, planejador semanal)
- Web: página Finanças (gráfico de gastos, transações)
- Mobile: navegação por tabs, Zustand store, tema
- Mobile: 4 telas de tab (Hoje, Semana, Compras, Mais)

### Em andamento / Próximo 🔧
- Mobile: componentes UI completos (`DayRingCard`, `CheckButton`, `QuickAddSheet`)
- Mobile: carregamento de fontes (Geist, Instrument Serif)
- Backend / integração com API
- Autenticação
- Push notifications

## Specs detalhados

Cada módulo tem seu spec em `.claude/specs/`:

- [Arquitetura geral](.claude/specs/00-overview.md)
- [Web: Semana](.claude/specs/web-semana.md)
- [Web: Treinos](.claude/specs/web-treinos.md)
- [Web: Alimentação](.claude/specs/web-alimentacao.md)
- [Web: Compras](.claude/specs/web-compras.md)
- [Web: Casa](.claude/specs/web-casa.md)
- [Web: Finanças](.claude/specs/web-financas.md)
- [Web: Metas](.claude/specs/web-metas.md)
- [Mobile: Saúde](.claude/specs/mobile-saude.md)
- [Mobile: Hoje](.claude/specs/mobile-hoje.md)
- [Mobile: Semana](.claude/specs/mobile-semana.md)
- [Mobile: Compras](.claude/specs/mobile-compras.md)
- [Mobile: Mais](.claude/specs/mobile-mais.md)
- [Backend / API](.claude/specs/backend.md)
- [Sync: Atividades (HealthKit → Supabase)](.claude/specs/sync-atividades/spec.md) · [plan](.claude/specs/sync-atividades/plan.md) · [data-model](.claude/specs/sync-atividades/data-model.md) · [tasks](.claude/specs/sync-atividades/tasks.md)
- [Web: Histórico de Treinos](.claude/specs/historico-treinos/spec.md) · [plan](.claude/specs/historico-treinos/plan.md) · [data-model](.claude/specs/historico-treinos/data-model.md) · [tasks](.claude/specs/historico-treinos/tasks.md)
