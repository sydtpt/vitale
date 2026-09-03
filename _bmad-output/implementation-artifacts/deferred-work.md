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

- source_spec: `_bmad-output/implementation-artifacts/spec-splash-igual-ao-icone.md`
  summary: A marca salta na transição splash nativa → `SplashOverlay`: encolhe e sobe ~50pt quando o JS assume, e fica assim pelo `MIN_SPLASH_MS` inteiro.
  evidence: O storyboard faz aspect-fit na tela cheia, então o glifo do ícone (bbox 188,203–865,861 num canvas 1024) renderiza ~260pt de largura numa tela de 393pt. Em seguida o `SplashOverlay` desenha `OrbeMark size={220}` (~175pt de conteúdo visível) mais o wordmark de 72pt, que empurra a marca acima do centro. Antes do fix o salto existia mas era de um quadrado laranja para a marca — ninguém o leria como continuidade quebrada; agora as duas pontas são a mesma arte em tamanhos diferentes, o que torna o pulo visível. Casar o `size` do overlay com os ~260pt (ou usar `imageWidth` do plugin) fecha o handoff.

- source_spec: `_bmad-output/implementation-artifacts/spec-splash-igual-ao-icone.md`
  summary: A receita do prebuild em sandbox — único jeito sancionado de alterar `mobile/ios/` — não existe em nenhum arquivo versionado.
  evidence: ADR 0009 diz "`mobile/ios/` nunca se edita à mão — a alteração vai pela ferramenta que o gera", mas a ferramenta (`expo prebuild`) apaga o `AppDelegate.swift:32` se rodada no repo. A saída (prebuild numa cópia, transplante só do que mudou) só está registrada neste spec, em `_bmad-output/`. `mobile/AGENTS.md` não menciona splash, prebuild, `ios/` nem assets. O próximo agente esbarra na proibição sem alternativa documentada — e está a um `npx expo prebuild` de matar o HealthKit em background.

- source_spec: `_bmad-output/implementation-artifacts/spec-splash-igual-ao-icone.md`
  summary: ADR 0009 exige bump de `runtimeVersion` em toda mudança nativa; este fix recusou o bump deliberadamente e a ressalva não está registrada em nenhum ADR.
  evidence: O ADR diz literalmente "Mudança nativa exige rebuild e bump do runtime em dois lugares: `Expo.plist` e `app.json`". Troca de asset assado no binário é mudança nativa. O raciocínio (contrato JS↔nativo intacto; bump orfanaria a lane OTA `preview` sem ganho) é defensável mas mora num spec em `_bmad-output/` — o próximo leitor vê só o ADR contrariado. `docs/decisions/` é append-only: cabe um ADR novo que superseda com a ressalva "asset-only não bumpa".

- source_spec: `_bmad-output/implementation-artifacts/spec-splash-igual-ao-icone.md`
  summary: `splash.backgroundColor` e `resizeMode` continuam sem guard, sendo exatamente a mesma classe de drift que o fix acabou de fechar para a imagem.
  evidence: `app.json` declara `backgroundColor: "#FFF7EE"` e `resizeMode: "contain"`; o lado nativo carrega os valores em `SplashScreenBackground.colorset` (255,247,238) e no `contentMode="scaleAspectFit"` do storyboard. Os três são consumidos no mesmo prebuild e dessincronizam do mesmo jeito — editar a cor no `app.json` sem regenerar deixa o colorset antigo, sem nada acusando.

- source_spec: none
  summary: **Fase 3 do piloto BMAD — ciclo completo sobre o Garmin Venu 4**: aba Fitness do mobile lendo do Supabase em vez do HealthKit, mais a cobertura dos dados que o Garmin não escreve no Apple Health (VFC, VO₂max, SpO₂, rota GPS, stream de FC).
  evidence: Adiado em 2026-08-17 por decisão do usuário, ao fim da Fase 2. É a única fase que exercita as 4 fases do BMAD de ponta a ponta — `bmad-deep-recon` → `bmad-product-brief`/`bmad-prd` → `bmad-architecture` + TEA → `bmad-create-epics-and-stories` → `bmad-sprint-planning` → `bmad-build` story a story → `bmad-retrospective`. Ponto de partida técnico já mapeado: `mobile/src/store/fitness.store.ts` e `mobile/src/app/fitness/*` são os únicos lugares que ainda leem HealthKit; `mobile/src/store/activities.store.ts` já é o padrão de leitura do Supabase. Começar em sessão nova — só a fase de Análise enche um contexto. Plano completo em `~/.claude/plans/quero-comecar-a-estudar-fizzy-whisper.md`.

- source_spec: none
  summary: **Fase 4 do piloto BMAD** — criar, com o BMB, uma skill própria que codifique o gate de migration manual do Supabase (gera SQL → mostra → espera aplicação humana → registra em `schema_migrations`).
  evidence: Adiado em 2026-08-17. É a fase curta em que "estudar o framework" vira construir um: `SKILL.md`, arquivos `step-NN-*.md`, o resolver TOML de 4 camadas e os hooks do `bmad-customize`. A regra a codificar já está escrita e verificada em `AGENTS.md` (raiz).

- source_spec: none
  summary: **Fase 5 do piloto BMAD** — decidir a adoção oficial: reescrever a seção de processo do `CLAUDE.md`, definir o destino das 55 specs em `.claude/specs/`, rodar a retrospectiva do piloto e mergear `bmad-pilot` em `main`.
  evidence: Adiado em 2026-08-17. Depende da Fase 3 para ter evidência suficiente — decidir adoção total com base só nas Fases 1 e 2 seria decidir com meio experimento. O plano do Winston em `_bmad-output/planning-artifacts/plano-mover-specs-para-docs.md` já ataca a parte das specs, com um motivo independente: `project_knowledge` do BMAD aponta para `docs/`, que não existe.

- source_spec: `_bmad-output/implementation-artifacts/spec-reescrever-readme.md`
  summary: `CLAUDE.md` está defasado nos mesmos eixos que o README acabou de corrigir — e o README novo aponta para ele como "status snapshot".
  evidence: Diz "Fontes: Geist (sans)" quando `packages/shared/src/constants/tokens.ts:131` define `'Manrope'`; lista 7 rotas quando `web/src/main.ts` declara 20; a seção "Feito ✅" diz "Mobile: 4 telas de tab" enquanto `mobile/src/app/(tabs)/` tem 6, e a própria seção Stack do mesmo arquivo diz "6 tabs". Enquanto isso o README passou a linkar `CLAUDE.md` como referência de status, então a divergência agora é citável.

- source_spec: `_bmad-output/implementation-artifacts/spec-reescrever-readme.md`
  summary: `docs/specs/00-overview.md` descreve um projeto que não existe mais — "Vitale", "Arquitetura de dados (sem backend)", "dados mockados em memória".
  evidence: O arquivo diz "Fase atual: dados mockados em memória (signals no Angular, Zustand no mobile)" e "Fase futura: API REST ou GraphQL". O repo tem 52 migrations em `supabase/migrations/`, 4 edge functions e `profileGuard` em 21 rotas. É o primeiro documento que a tabela de specs do README leva a ler, e desmente o resto do README.

- source_spec: `_bmad-output/implementation-artifacts/spec-reescrever-readme.md`
  summary: `web/src/app/features/auth/auth.routes.ts` é código morto — exporta `AUTH_ROUTES`, que ninguém importa.
  evidence: `main.ts:10-19` declara `login` e `register` inline; um grep por `AUTH_ROUTES` em `web/src` acha só a própria declaração. Quem procurar onde ficam as rotas de auth acha esse arquivo primeiro e conclui que está ligado.

- source_spec: `_bmad-output/implementation-artifacts/spec-reescrever-readme.md`
  summary: O `description` do `package.json` da raiz ainda diz "Vitale — Life organizer with Angular web dashboard and React Native mobile app".
  evidence: Único lugar versionado fora do escopo npm que ainda carrega o nome antigo como marca (o escopo `@vitale/*` é intencional, per ADR/CLAUDE.md). Ficou fora do escopo do spec do README, que proibia tocar em `package.json`.

- source_spec: `_bmad-output/implementation-artifacts/spec-reescrever-readme.md`
  summary: Nada versionado documenta como levar o app ao device nem como publicar as edge functions — os dois caminhos que o CI não cobre.
  evidence: `mobile/eas.json` define development/preview/production com distribuição interna, `mobile/plugins/` tem 5 config plugins (2 para entrega em background do HealthKit) e `supabase/config.toml` marca `connections-ingest` e `strava-oauth` com `verify_jwt = false` (autenticam-se por `x-cron-secret` e por `state` assinado). O README deliberadamente não cobre deploy — o spec listava isso em "Ask First" —, mas o vazio não é preenchido por nenhum outro doc.
- source_spec: none
  summary: Detalhe web de Registros — rota /registros/:id com métricas por período e heatmap clicável (CAP-5/6/7 lado web do SPEC-registros).
  evidence: Split do build de 2026-09-02; mobile-first é constraint do spec e o lado web só consome o núcleo depois de entregue, sem acoplamento reverso.
- source_spec: `_bmad-output/implementation-artifacts/spec-registros-detalhe-mobile.md`
  summary: Extrair nomes de mês/dia pt-BR para módulo único no shared — a story criou a 4ª e 5ª cópias (detail.ts e detalhe.tsx, além de fitness/overview.ts e goals/format.ts).
  evidence: Achado do blind-hunter na revisão de 2026-09-02; duplicação real confirmada por grep, mas o merge das cópias pré-existentes excede o escopo da story.
- source_spec: `_bmad-output/implementation-artifacts/spec-registros-detalhe-mobile.md`
  summary: CI não valida typed routes do Expo Router — gerar .expo/types/router.d.ts antes do tsc no job mobile (ou commitar a declaração), senão pathname inválido passa verde.
  evidence: Verification-gap demonstrou: com router.d.ts ausente (condição exata do CI), push para rota inexistente compila com 0 erros; gap pré-existente que afeta o app inteiro, exposto pela rota nova.
- source_spec: `_bmad-output/implementation-artifacts/spec-registros-detalhe-web.md`
  summary: Heatmap anual de Registros sem rótulos de mês/dia nem legenda marcado/não — achar "aquele dia de março" num grid 53×7 depende só do tooltip; merece um passe de design (mobile idem).
  evidence: Achado do blind-hunter na revisão de 2026-09-02; enhancement de produto, não bug — o spec não pedia rótulos e a decisão de layout pede calibração visual.
- source_spec: `_bmad-output/implementation-artifacts/spec-curva-de-forma-shared.md`
  summary: A curva de forma é só de frequência cardíaca; treino de força (`Treino`, `Lift`) entra como duração × MET independentemente da intensidade e subconta o custo de recuperação.
  evidence: Revisão da etapa 1 apontou que sessão de força gera pouco tempo em zona e muito custo de recuperação; o módulo não tem entrada para carga de força e a limitação foi apenas documentada.
- source_spec: `_bmad-output/implementation-artifacts/spec-curva-de-forma-shared.md`
  summary: Todo módulo do repo tem spec durável em `docs/specs/`, mas a curva de forma só tem o spec de implementação em `_bmad-output`; decidir se ganha `docs/specs/curva-de-forma/` quando a etapa 2 (UI) fechar.
  evidence: Revisão notou que o cabeçalho do teste cita "a matriz de casos do spec" sem nada em `docs/specs/`; o CLAUDE.md lista os specs de feature ali.
