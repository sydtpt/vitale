<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra a711c41. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## mobile (@vitale/mobile)

App Expo / React Native. Rotas file-based (Expo Router) em `src/app/`, stores Zustand em
`src/store/`. Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd mobile && npx tsc --noEmit && npx jest` (29 suítes, 349 testes hoje).
- `npm run lint` falha: `eslint` não está instalado.
- Teste de lógica pura mora em `src/lib/__tests__/*.test.ts` — inclusive a lógica de
  `@vitale/shared`, que o jest daqui resolve.

## Conventions that differ from defaults

- Não importe `react-native-reanimated`: não está nas dependências e o 4.1.7 hoisted é
  incompatível — anime com `Animated` do React Native.

<!-- /bmad:context -->
