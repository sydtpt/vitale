# Orbe — Life Organizer

> **Propósito:** Uma plataforma pessoal para gerenciar a rotina completa — treinos, alimentação, casa, compras e finanças. Web para análise, mobile para captura rápida do dia a dia.
>
> Nome antigo: **Vitale** — os pacotes npm mantêm o escopo `@vitale/*` e os bundle IDs `com.sydtpt.vitale` (renomear quebraria builds/entitlements); só a marca visível virou Orbe.

## Arquitetura

Monorepo pnpm workspaces (resolução isolada — ADR 0016) com 3 pacotes:

```
life-organizer/
├── packages/shared/      @vitale/shared  — tokens de design e modelos de domínio
├── web/                  @vitale/web     — Angular 21 dashboard analítico
└── mobile/               @vitale/mobile  — React Native / Expo (captura rápida)
```

## Comandos essenciais

> **O gerenciador é pnpm** (ADR 0016 / AD-14). A versão vem do campo
> `packageManager` — use `corepack enable pnpm` e não misture `npm install` aqui:
> ele recria uma árvore plana e traz de volta as colisões entre workspaces.

```bash
# Instalar dependências
pnpm install

# Web (Angular 21) — http://localhost:4200
pnpm web:dev

# Mobile (Expo)
pnpm mobile:start       # QR code / Expo DevTools
pnpm mobile:ios         # Simulador iOS
pnpm mobile:android     # Emulador Android

# Validação — o CI roda exatamente isto nos três workspaces (AD-17)
pnpm --filter @vitale/shared lint     # tsc do núcleo + é onde vivem as barreiras
pnpm --filter @vitale/shared test     # testes + barreiras de arquitetura (AD-7)
pnpm --filter @vitale/web build       # compila templates e TS
pnpm --filter @vitale/web test        # Vitest
cd mobile && pnpm exec tsc --noEmit && pnpm exec jest
cd mobile && pnpm dlx expo-doctor     # 21/21; falha nova dele é sinal, não ruído
```

> **Regras para agentes de IA:** [AGENTS.md](AGENTS.md) (+ um por workspace em
> `web/`, `mobile/`, `packages/shared/`). Mantido por `bmad-project-context` e
> verificado contra o código — em caso de divergência, o AGENTS.md vale.

## Stack

### Shared (`packages/shared`)
- TypeScript 5 — modelos de domínio e design tokens
- Arquivo de entrada: `packages/shared/src/index.ts`
- Modelos: `Meal`, `Habit`, `Chore`, `ShopItem`, `Treino`, `Lift`, `FinancaCategory`, `Transaction`, `Meta`, `DayData`
- Tokens: `surfaces`, `ink`, `brand`, `accents`, `spacing`, `radii`, `fonts`, `MOD` (map de cores por módulo)

### Web (`web/`)
- **Angular 21** com standalone components
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
- **Expo 57** / React Native 0.86 (New Architecture — única arquitetura a partir da RN 0.82)
- **Roteamento:** Expo Router (file-based, pasta `mobile/src/app/`)
- **Store:** Zustand 5
- **Animações:** `Animated` do React Native — Reanimated está instalado (o `expo-router` o exige), mas **não se usa** (ADR 0010)
- 6 tabs: Hoje, Semana, Histórico, Saúde, Compras, Mais

## Design System

**Quatro eixos independentes** — ver [spec](docs/specs/temas/spec.md). Cor nasce em
`packages/shared/src/theme` e chega por `resolveTokens()` / `moduleOf()`; nunca escreva
hex numa tela.

| Eixo | Opções | Governa |
|---|---|---|
| Esquema | sistema · claro · escuro | claro/escuro |
| Tema | Orbe · Clean · Clean elevado | superfície, tinta, linha |
| Paleta | Orbe · Bruma · Terra · Néon · Joia · Acessível | cor dos módulos e das séries |
| Marca | Laranja · Tinta · Azul · Verde | o cromo: FAB, CTA, toggle |

Três regras que o `architecture.test.ts` cobra: nenhum `StyleSheet` de escopo de módulo
lê tema (congela no import), nenhuma variável CSS da web fora do sistema, e todo `CHECK`
de id em `user_preferences` cobre os ids que o app grava.

O recorte abaixo é o tema **Orbe claro** — o padrão histórico, preservado por teste:

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
- Animações com `Animated` do React Native (não importar Reanimated — ver `mobile/AGENTS.md`)
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
- Temas: quatro eixos (esquema, tema, paleta, marca) nos dois apps, com contraste
  medido em vez de conferido. A web ganhou modo escuro, que não tinha

### Em andamento / Próximo 🔧
- Tarefas: módulo to-do (web + mobile) — recorrências, carry/expire, gatilhos, conclusão rica. Falta aplicar migration e ponte real com Compras/Finanças
- Mobile: componentes UI completos (`DayRingCard`, `CheckButton`, `QuickAddSheet`)
- Mobile: carregamento de fontes (Geist, Instrument Serif)
- Backend / integração com API
- Autenticação
- Push notifications

## Specs detalhados

Cada módulo tem seu spec em `docs/specs/`:

- [Arquitetura geral](docs/specs/00-overview.md)
- [Web: Semana](docs/specs/web-semana.md)
- [Web: Treinos](docs/specs/web-treinos.md)
- [Web: Alimentação](docs/specs/web-alimentacao.md)
- [Web: Compras](docs/specs/web-compras.md)
- [Web: Casa](docs/specs/web-casa.md)
- [Web: Finanças](docs/specs/web-financas.md)
- [Web: Metas](docs/specs/web-metas.md)
- [Mobile: Saúde](docs/specs/mobile-saude.md)
- [Mobile: Hoje](docs/specs/mobile-hoje.md)
- [Mobile: Semana](docs/specs/mobile-semana.md)
- [Mobile: Compras](docs/specs/mobile-compras.md)
- [Mobile: Mais](docs/specs/mobile-mais.md)
- [Backend / API](docs/specs/backend.md)
- [Sync: Atividades (HealthKit → Supabase)](docs/specs/sync-atividades/spec.md) · [plan](docs/specs/sync-atividades/plan.md) · [data-model](docs/specs/sync-atividades/data-model.md) · [tasks](_bmad-output/implementation-artifacts/sync-atividades/tasks.md)
- [Web: Histórico de Treinos](docs/specs/historico-treinos/spec.md) · [plan](docs/specs/historico-treinos/plan.md) · [data-model](docs/specs/historico-treinos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/historico-treinos/tasks.md)
- [Habitos (contadores diários)](docs/specs/habitos/spec.md) · [plan](docs/specs/habitos/plan.md) · [data-model](docs/specs/habitos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/habitos/tasks.md)
- [Tarefas (to-do com agendamento)](docs/specs/tarefas/spec.md) · [plan](docs/specs/tarefas/plan.md) · [data-model](docs/specs/tarefas/data-model.md) · [tasks](_bmad-output/implementation-artifacts/tarefas/tasks.md)
- [Registros (marcação diária avulsa)](docs/specs/registros/spec.md) · [plan](docs/specs/registros/plan.md) · [data-model](docs/specs/registros/data-model.md) · [tasks](_bmad-output/implementation-artifacts/registros/tasks.md)
- [Mobile: Histórico de Treinos](docs/specs/mobile-historico-treinos/spec.md) · [plan](docs/specs/mobile-historico-treinos/plan.md) · [data-model](docs/specs/mobile-historico-treinos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/mobile-historico-treinos/tasks.md)
- [Web: Carga Semanal (zonas de FC agregadas)](docs/specs/carga-semanal/spec.md) · [data-model](docs/specs/carga-semanal/data-model.md) · [tasks](_bmad-output/implementation-artifacts/carga-semanal/tasks.md)
- [Web: Readiness → Treino (prontidão acionável)](docs/specs/readiness-treino/spec.md) · [tasks](_bmad-output/implementation-artifacts/readiness-treino/tasks.md)
- [Web: Correlações de Gatilho (hábito-ruim/registro × saúde)](docs/specs/correlacoes-gatilho/spec.md) · [tasks](_bmad-output/implementation-artifacts/correlacoes-gatilho/tasks.md)
- [Web: Recap Semanal (resumo automático da semana)](docs/specs/recap-semanal/spec.md) · [tasks](_bmad-output/implementation-artifacts/recap-semanal/tasks.md)
- [Ratings diários subjetivos (sono ao acordar + dia após 22h)](docs/specs/ratings-diarios/spec.md)
- [Retrospectiva (resumo agregado por semana/mês/estação/ano/total com insights cruzados)](docs/specs/retrospectiva/spec.md) · [v2 — o jornal](docs/specs/retrospectiva/v2-jornal.md)
- [Web: Visão detalhada por país (Ciclismo — mapa de rotas + cidades por país)](docs/specs/mapa-por-pais/spec.md) · [plan](docs/specs/mapa-por-pais/plan.md) · [data-model](docs/specs/mapa-por-pais/data-model.md) · [tasks](_bmad-output/implementation-artifacts/mapa-por-pais/tasks.md)
- [Temas (quatro eixos: esquema, tema, paleta e marca)](docs/specs/temas/spec.md) · [data-model](docs/specs/temas/data-model.md)
- [Cultura (livros, filmes, podcasts e álbuns)](docs/specs/cultura/spec.md) · [data-model](docs/specs/cultura/data-model.md) · [stories](docs/specs/cultura/stories.yaml)
