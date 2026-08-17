- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: `packages/shared` tem 3 arquivos de teste que nenhum runner executa — `src/goals/evaluate.test.ts`, `src/chart/axis.test.ts`, `src/chart/smooth-path.test.ts`.
  evidence: O script `test` do pacote é `echo 'No tests yet'`; o jest do mobile tem `rootDir` em `mobile/` e `npx jest --listTests | grep -c packages/shared` devolve 0; o novo `web/tsconfig.spec.json` cobre só `web/src`. Mesma classe de problema que esta story resolveu no web — testes escritos que nunca rodam.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: `mobile/src/lib/planned-match.ts` não tem nenhum teste, embora seja espelho de código que o web testa com 9 casos.
  evidence: `find mobile -name '*planned-match*'` devolve só o fonte; o jest do mobile roda 29 suítes, exatamente os 29 arquivos de `mobile/src/lib/__tests__`. Tirar o `57` do `EASY_IDS` do mobile mantém web verde, jest verde e `tsc --noEmit` limpo — a mesma deriva silenciosa que deixou o `52` errado sobreviver meses.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: `kindForActivity`, `STRENGTH_IDS` e `EASY_IDS` são copiados entre web e mobile, e `GPS_ACTIVITY_IDS` está duplicado em mais dois arquivos — candidatos a subir para `@vitale/shared`.
  evidence: `web/src/app/features/treinos/data/planned-match.ts` e `mobile/src/lib/planned-match.ts` carregam a mesma função (o segundo com um comentário "⚠️ Espelho … manter as duas em sincronia"); `GPS_ACTIVITY_IDS = {13,24,37,52}` aparece em `web/src/app/core/models/activity-types.ts:20` e `mobile/src/lib/workout-types.ts:120`. Nada força paridade entre as quatro cópias.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: Nenhum teste protege a invariante que causou o bug — `GPS_ACTIVITY_IDS` e `EASY_IDS` não podem ter interseção.
  evidence: Recolocar `52` em `EASY_IDS` hoje mantém os 122 testes verdes, porque a checagem de GPS vem antes e o id fica inalcançável. Um caso afirmando a disjunção pegaria a próxima ocorrência; o comentário inline documenta o motivo mas não impõe nada.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: Não há CI nem git hook — nada impede a suíte de voltar a apodrecer.
  evidence: Root `AGENTS.md` afirma "Não há CI nem git hooks"; `ls .github/workflows` não existe. A causa raiz aqui foi um spec escrito em `03225b8` que nunca executou; torná-lo executável sem ligá-lo a nada automático mantém o mesmo modo de falha.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: O target `test` não configura cobertura nem limiar, então não se sabe que fração da lógica os testes tocam.
  evidence: O schema do builder aceita `coverage`, `coverageReporters` e `coverageThresholds`; nenhum foi definido. O problema declarado da spec era lógica "sem cobertura efetiva" — a suíte agora roda, mas segue sem medida.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: `STRENGTH_IDS` contém `35`, que o próprio repositório rotula como **Remo**, sob o comentário "Tipos HealthKit de musculação/força" — mesma classe do bug do `52`, na linha adjacente.
  evidence: `packages/shared/src/fitness/activity-types.ts:14` diz `35: 'Remo'` e `mobile/src/lib/workout-types.ts:229` confirma `// Remo`. Remo classificar como `strength` em vez de `endurance` é decisão de produto, igual à da caminhada — precisa de resposta humana antes de mexer.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: `kindForActivity` devolve `'none'` para ids que o app exibe normalmente — 63 (HIIT), 16 (elíptico), 44 (escada), 82.
  evidence: Todos têm ícone, cor e rótulo em `BASE`, mas nenhum cai em GPS/STRENGTH/EASY, então nunca casam com um treino planejado. Nenhum teste fixa o ramo `'none'`.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: O target `serve` continua em `@angular-devkit/build-angular:dev-server`, o que obriga a manter o pacote legado — que ainda declara peers de karma e jest.
  evidence: `@angular/build` traz o próprio `dev-server` (confirmado no `builders.json`). Migrando `serve`, dá para remover `@angular-devkit/build-angular` inteiro; isso também limpa o peer inválido que `npm ls jsdom` reporta (`jest-environment-jsdom@29.7.0 invalid: "^30.2.0"`). Verificado que hoje `ng serve` não quebra: o dev-server detecta `@angular/build:application` como esbuild-based.

- source_spec: `_bmad-output/implementation-artifacts/spec-testes-do-web-com-vitest.md`
  summary: Os testes unitários são construídos através da config completa do app, arrastando CSS do Leaflet, `src/styles.scss` e `public/` para o bundle de teste.
  evidence: `buildTarget: vitale-web:build:development` emite um `styles.css` de 15,2 kB para specs que não tocam o DOM. Além do tempo desperdiçado, acopla a suíte unitária ao pipeline de assets — um stylesheet global quebrado passa a derrubar os testes.

- source_spec: none
  summary: **Fase 3 do piloto BMAD — ciclo completo sobre o Garmin Venu 4**: aba Fitness do mobile lendo do Supabase em vez do HealthKit, mais a cobertura dos dados que o Garmin não escreve no Apple Health (VFC, VO₂max, SpO₂, rota GPS, stream de FC).
  evidence: Adiado em 2026-08-17 por decisão do usuário, ao fim da Fase 2. É a única fase que exercita as 4 fases do BMAD de ponta a ponta — `bmad-deep-recon` → `bmad-product-brief`/`bmad-prd` → `bmad-architecture` + TEA → `bmad-create-epics-and-stories` → `bmad-sprint-planning` → `bmad-build` story a story → `bmad-retrospective`. Ponto de partida técnico já mapeado: `mobile/src/store/fitness.store.ts` e `mobile/src/app/fitness/*` são os únicos lugares que ainda leem HealthKit; `mobile/src/store/activities.store.ts` já é o padrão de leitura do Supabase. Começar em sessão nova — só a fase de Análise enche um contexto. Plano completo em `~/.claude/plans/quero-comecar-a-estudar-fizzy-whisper.md`.

- source_spec: none
  summary: **Fase 4 do piloto BMAD** — criar, com o BMB, uma skill própria que codifique o gate de migration manual do Supabase (gera SQL → mostra → espera aplicação humana → registra em `schema_migrations`).
  evidence: Adiado em 2026-08-17. É a fase curta em que "estudar o framework" vira construir um: `SKILL.md`, arquivos `step-NN-*.md`, o resolver TOML de 4 camadas e os hooks do `bmad-customize`. A regra a codificar já está escrita e verificada em `AGENTS.md` (raiz).

- source_spec: none
  summary: **Fase 5 do piloto BMAD** — decidir a adoção oficial: reescrever a seção de processo do `CLAUDE.md`, definir o destino das 55 specs em `.claude/specs/`, rodar a retrospectiva do piloto e mergear `bmad-pilot` em `main`.
  evidence: Adiado em 2026-08-17. Depende da Fase 3 para ter evidência suficiente — decidir adoção total com base só nas Fases 1 e 2 seria decidir com meio experimento. O plano do Winston em `_bmad-output/planning-artifacts/plano-mover-specs-para-docs.md` já ataca a parte das specs, com um motivo independente: `project_knowledge` do BMAD aponta para `docs/`, que não existe.
