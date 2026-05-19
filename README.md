# Vitale — Life Organizer

Um lugar para tudo: comida, treino, casa, dinheiro.

## Architecture

Monorepo with 3 workspaces:

```
life-organizer/
├── packages/shared/     @vitale/shared — tokens, models, shared types
├── web/                 @vitale/web    — Angular 20 dashboard (analítico)
└── mobile/              @vitale/mobile — React Native / Expo (captura rápida)
```

### Shared (`@vitale/shared`)
Design tokens (colors, spacing, typography) and TypeScript domain models shared between web and mobile.

### Web — Angular 20
Analytical dashboard with sidebar navigation and 7 feature modules:

| Route          | Module       | Description                        |
|----------------|--------------|------------------------------------|
| `/semana`      | Semana       | Weekly overview with all panels     |
| `/treinos`     | Treinos      | Lift progression + run volume       |
| `/alimentacao` | Alimentação  | Macros, kcal tracking, meal log     |
| `/compras`     | Compras      | Shopping list + recurring items     |
| `/casa`        | Casa         | Household chore rotation            |
| `/financas`    | Finanças     | Budget, spend by category           |
| `/metas`       | Metas        | Long-term goal progress bars        |

**Stack:** Angular 20, standalone components, signal-based store, OnPush everywhere, SCSS, lazy-loaded routes.

### Mobile — React Native (Expo)
Quick check-in interface with 4 tabs:

| Tab      | Screen   | Description                      |
|----------|----------|----------------------------------|
| Hoje     | Home     | Day card, meals, habits, casa    |
| Semana   | Week     | Week strip, stats, heatmap       |
| Compras  | Shopping | Grouped list by category         |
| Mais     | More     | Links to secondary modules       |

**Stack:** Expo 52, React Native 0.76, Expo Router (file-based), Zustand 5, Reanimated 3.

## Design System

Warm, organic palette inspired by natural materials:

- **Primary:** `#F25C2B` (burnt orange)
- **Surface:** `#FFF7EE` (cream)
- **Ink:** `#1F1B16` (warm black)
- **Fonts:** Geist (sans), Geist Mono, Instrument Serif

Module colors: each domain (treino, food, água, hábito, casa, compras, finanças) has its own tint/accent pair.

## Getting Started

```bash
# Install dependencies
npm install

# Web (Angular 20)
npm run web:dev        # → http://localhost:4200

# Mobile (Expo)
npm run mobile:start   # → Expo DevTools
```

## Project Status

- [x] Monorepo structure with shared package
- [x] Design tokens and domain models
- [x] Angular web: routing, sidebar, all 7 feature pages
- [x] Angular web: full Semana dashboard (heatmap, charts, lists, stats)
- [x] Angular web: Treinos page (lift chart, run chart, week planner)
- [x] Angular web: Finanças page (spend chart, transactions)
- [x] React Native: tab navigation, Zustand store, theme
- [x] React Native: 4 tab screens (Hoje, Semana, Compras, Mais)
- [ ] React Native: full UI components (DayRingCard, CheckButton, QuickAddSheet)
- [ ] Font loading (Geist, Instrument Serif) for mobile
- [ ] Backend / API integration
- [ ] Authentication
- [ ] Push notifications
