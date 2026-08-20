# 0015 — `overrides` na raiz fixam cópia única e a versão dos pacotes com patch

**Status:** aceita
**Data:** 2026-08-20

## Contexto

O monorepo é npm workspaces. O `mobile` pina `react` e `react-native` em versão
**exata**, porque é o Expo SDK que dita quais são. As bibliotecas em volta
declaram peers curinga (`react: "*"`, `react-native: ">=0.79"`), e `web` e
`packages/shared` declaram `@supabase/supabase-js: "^2.106.0"`.

Até a Fase 2 do plano de migração isso nunca deu problema — mas não por
construção. O `package-lock.json` tinha sido criado quando aquelas versões eram
as mais novas, e congelava tudo numa cópia só. Era **inércia do lockfile**, não
restrição declarada.

Subir o SDK 54 → 55 exigiu regenerar o lockfile. No instante em que ele foi
regenerado, três problemas latentes apareceram juntos:

1. **`react-native` duplicado.** O `mobile` queria 0.83.10; o peer da
   `react-native-reanimated@4.1.7` (`0.78 - 0.82`) não aceita a 0.83, então o npm
   instalou uma **segunda** RN 0.81.5 na raiz para satisfazê-lo. O `tsc` quebrou
   com duas árvores de tipos incompatíveis — o mesmo `ViewStyle` vindo de dois
   caminhos diferentes.
2. **`react` duplicado.** 19.2.0 aninhado no `mobile` (pin exato do SDK) contra
   19.2.8 hasteado na raiz (resolvido pelos peers curinga). Duas instâncias de
   React no mesmo bundle é o defeito clássico de "Invalid hook call" — e nada no
   build acusa.
3. **`supabase-js` flutuou.** Com o `^`, a raiz subiu para 2.112.3 enquanto o
   `mobile` ficou com 2.106.0 aninhado. O `patch-package` roda na raiz e corrigiu
   **a cópia que o Metro não empacota**.

O terceiro é exatamente a falha que o plano de migração previa para o patch do
`supabase-js` — e é a que não aparece como erro de instalação, e sim como erro de
bundle, depois.

## Decisão

O `package.json` da raiz ganha `overrides` fixando:

- `react` e `react-native` — na versão que o Expo SDK ativo pina;
- `@supabase/supabase-js` — na versão que o **nome do arquivo de patch** nomeia.

E o `postinstall` passa a rodar `patch-package --error-on-fail`, para um patch que
deixou de aplicar **derrubar a instalação** em vez de avisar e seguir.

## Alternativas rejeitadas

**Pinar a versão exata no `package.json` de cada workspace.** Três lugares para
manter em sincronia, e não resolve o caso 1: a RN duplicada não veio de um
workspace, veio de um peer curinga de terceiro. O `overrides` age sobre a árvore
inteira, que é onde o problema mora.

**`legacy-peer-deps` ou `--omit=peer`.** Resolveria a duplicação desligando a
resolução de peers — no monorepo inteiro, `web` incluído. Trocar um defeito
específico por uma mudança global de semântica de instalação.

**Continuar confiando no lockfile.** Era o statu quo, e é o que quebrou. O
lockfile registra o que foi resolvido; ele não declara o que *precisa* ser
verdade. Quando alguém o regenera — e uma migração de SDK regenera — não há nada
para segurar o invariante.

## Consequências

**`react` e `react-native` no `overrides` precisam subir no mesmo commit de cada
bump de SDK** (Fases 3 e 4 do plano). Esquecer não dá erro de instalação: o npm
resolve a versão velha e o app compila contra a RN errada.

**Todo pacote com patch precisa estar no `overrides` em versão exata**, igual ao
nome do arquivo em `patches/`. É a mesma disciplina que a
[ADR 0013](0013-background-do-healthkit-exige-patch-na-lib.md) já exige do
`@kingstinct/react-native-healthkit`, agora expressa no manifesto em vez de
depender de alguém lembrar.

**Efeito colateral que vale nomear:** com a RN fixada em 0.83.10, o peer da
`react-native-reanimated@4.1.7` fica insatisfazível e o npm **descarta o peer
opcional**. Reanimated e `react-native-worklets` saem da árvore por completo —
o estado que a [ADR 0010](0010-sem-reanimated-no-mobile.md) sempre descreveu mas
que de fato nunca existiu: até aqui a 4.1.7 estava lá, hasteada por acidente.

Isso obrigou a tirar `react-native-reanimated/plugin` do `mobile/babel.config.js`,
onde ele resolvia **apenas** por causa daquela cópia acidental. A ADR 0010 tinha
removido o uso do Reanimated e deixado a referência do Babel para trás; ela só não
quebrava porque o pacote continuava presente sem ninguém importar.

Como dividendo, o ponto de atenção da Fase 3 do plano deixa de existir: a
regressão de memória do Hermes V1 no SDK 56 atinge quem usa
`reanimated`/`worklets`, e agora a árvore comprovadamente não tem nenhum dos dois.
