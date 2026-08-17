# Spec: Visão Geral e Arquitetura

## Objetivo do produto

**Vitale** é uma plataforma pessoal para organizar a vida cotidiana em um só lugar. O usuário não precisa alternar entre apps de treino, alimentação, finanças e tarefas domésticas — tudo está integrado com uma visão unificada da semana.

**Princípio central:** Mobile para registrar (rápido, durante o dia), Web para analisar (dashboard, tendências, planejamento).

## Usuário-alvo

Pessoa com rotina ativa que:
- Treina regularmente (academia + corrida)
- Acompanha alimentação por macros e kcal
- Gerencia orçamento pessoal
- Divide tarefas domésticas
- Mantém lista de compras recorrente
- Acompanha metas de longo prazo

## Fluxo principal

```
Dia a dia (mobile):
  Acorda → abre app → vê o dia de hoje (Hoje tab)
  → marca treino feito → loga refeições → checa tarefas de casa
  → adiciona item à lista de compras

Final de semana (web):
  Abre dashboard → vê overview da semana (Semana)
  → analisa progressão de treino → revisa macros da semana
  → planeja compras → revisa orçamento → atualiza metas
```

## Arquitetura de dados (sem backend)

Fase atual: **dados mockados em memória** (signals no Angular, Zustand no mobile).

Fase futura: API REST ou GraphQL com autenticação JWT.

```
packages/shared/src/models/index.ts   ← modelos de domínio TypeScript
packages/shared/src/constants/tokens.ts ← design tokens
```

## Módulos funcionais

| Módulo       | Web route      | Mobile tab | Domínio                          |
|--------------|----------------|------------|----------------------------------|
| Semana       | `/semana`      | —          | Overview semanal, heatmap, stats |
| Treinos      | `/treinos`     | Hoje       | Lifts, corridas, volume          |
| Alimentação  | `/alimentacao` | Hoje       | Macros, refeições, água          |
| Compras      | `/compras`     | Compras    | Lista por categoria, recorrentes |
| Casa         | `/casa`        | Hoje       | Rotação de tarefas domésticas    |
| Finanças     | `/financas`    | —          | Orçamento, gastos por categoria  |
| Metas        | `/metas`       | Mais       | Progresso de objetivos           |
| Hábitos      | —              | Hoje       | Check-in diário de hábitos       |

## Dependências principais

### Web
```json
{
  "@angular/core": "^20.0.0",
  "chart.js": "*",
  "ngx-charts": "*"
}
```

### Mobile
```json
{
  "expo": "~52.0.0",
  "react-native": "0.76.x",
  "expo-router": "~4.0.0",
  "zustand": "^5.0.0",
  "react-native-reanimated": "^3.0.0"
}
```

## Decisões de design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Web state | Signals Angular | Sem overhead de NgRx para escala atual |
| Mobile state | Zustand 5 | Simples, sem boilerplate, ótimo com Expo |
| Navegação mobile | Expo Router | File-based, nativo, ótima DX |
| Estilos web | SCSS + CSS vars | Flexibilidade com tokens centralizados |
| Estilos mobile | StyleSheet.create | Performance, integração com tokens shared |
| Monorepo | npm workspaces | Sem overhead de nx/turborepo para 3 pacotes |

## Convenções de arquivo

```
web/src/app/features/<modulo>/
  <modulo>.component.ts      # componente raiz do módulo
  <modulo>.component.scss    # estilos
  <modulo>.routes.ts         # roteamento lazy
  components/                # subcomponentes do módulo

mobile/src/app/(tabs)/
  index.tsx                  # Hoje
  semana.tsx                 # Semana
  compras.tsx                # Compras
  mais.tsx                   # Mais

mobile/src/components/       # componentes reutilizáveis
mobile/src/store/            # Zustand stores
mobile/src/theme/            # tema e estilos base
```
