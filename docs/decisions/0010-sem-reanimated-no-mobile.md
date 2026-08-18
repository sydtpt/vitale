# 0010 — Sem Reanimated no mobile

**Status:** aceita
**Data:** 2026-05-19

## Contexto

O `CLAUDE.md` listava "animações com `useAnimatedStyle` do Reanimated 3" como convenção do projeto. Isso nunca refletiu o que estava instalado.

`mobile/package.json` não declara `react-native-reanimated`. A única versão presente é a **4.1.7 hoisted na raiz** do monorepo — Reanimated 4 exige New Architecture e uma stack mais nova que a do app.

Nada em `mobile/src` importava o pacote, então o módulo nativo nunca era carregado e o descompasso passou despercebido.

## Decisão

Animação no mobile usa o `Animated` do próprio `react-native`: `Animated.Value`, `.interpolate`, `Animated.timing`, com `useNativeDriver: true`.

## Alternativas rejeitadas

**Instalar Reanimated na versão compatível.** Possível, mas adiciona dependência nativa — e portanto rebuild e risco de assinatura ([0009](0009-ios-versionado-workflow-bare.md)) — para animações que o `Animated` já entrega.

**Usar a 4.1.7 hoisted.** Não é opção: importá-la faz o app abrir e fechar imediatamente, crash no boot ao carregar o módulo nativo.

## Consequências

Um `import` de `react-native-reanimated` em qualquer arquivo do mobile derruba o app no boot — falha silenciosa para quem escreveu, porque nada no build acusa.

A regra vive no `mobile/AGENTS.md`, onde um agente a encontra antes de escrever a animação. Este ADR guarda o porquê.

Exemplo do padrão em uso: a coordenação entre scroll e tab bar em `mobile/src/lib/tab-bar-scroll.tsx`.
