# Plano de Migração — Orbe

**Base:** [ARCHITECTURE-SPINE.md](architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md) · **Data:** 2026-08-17
**Substitui** `plano-mover-specs-para-docs.md`, cujo escopo (mover as specs) virou a Fase 2 daqui.

Consolidação **antes** de novas features. Cada fase é commitável sozinha e a ordem importa: fases posteriores dependem de invariantes que as anteriores tornam verdadeiras.

## Estado em 2026-08-18

| Fase | Capability | Estado |
| --- | --- | --- |
| 0 — verificação | CAP-1 | ✅ os 3 testes órfãos rodam; 27 asserts, todos verdes |
| 1 — config morta | CAP-8 | ✅ |
| 2 — conhecimento | CAP-2 | ✅ 55 specs em `docs/specs`, tasks nos efêmeros, tombstone |
| 3 — ADRs | CAP-3 | ✅ 11 ADRs, incluindo a 0011 sobre schema |
| 4 — vocabulário | CAP-4 | ✅ + 2 correções de classificação e teste de disjunção |
| 5 — lógica duplicada | CAP-5 | ✅ 10 consolidadas, 2 renomeadas; `running-highlights` diferido |
| 6 — contrato de schema | CAP-6 | ✅ **19 de 19 tabelas**; as 139 chamadas `.from()` migradas |
| 7 — guarda | CAP-7 | ✅ 4 barreiras, nenhuma catraca — todas verificadas falhando |

**A consolidação está completa.** As oito capabilities do spec foram entregues.

A guarda entrou antes da Fase 6 terminar, ao contrário do plano original: a checagem de `.from()` nasceu **catraca** (falhava só se o número crescesse) para proteger o passivo enquanto ele era drenado. O teto desceu quinze vezes e chegou a zero, quando ela virou barreira — como estava previsto no comentário desde que foi escrita.

## O que sobrou, deliberadamente

- **`running-highlights.ts`** segue duplicado. `ActivityHighlight` carrega `value` e `caption` já formatados; separar cálculo de apresentação é o que a AD-2 manda, mas muda o contrato que os componentes consomem. Diferido com condição no spine.
- **`drop` de `user_profiles`** — opcional e bem-informado. Verificado em produção: `n_tup_ins = 0`, nunca recebeu um insert; nenhum código a referencia; o comentário no banco já a marca obsoleta.
- **Alvo de hospedagem do web** e **pipeline de CI** — diferidos no spine, com condição escrita.

---

## Fase 0 — Destravar a verificação

Nada abaixo é verificável enquanto o núcleo não tiver runner. Primeiro isto.

1. Instalar Vitest em `packages/shared` e trocar `"test": "echo 'No tests yet'"` por execução real (AD-13).
2. Rodar os três testes que existem e nunca rodaram: `evaluate.test.ts`, `axis.test.ts`, `smooth-path.test.ts`. **Assumir que passam é erro** — eles nunca executaram, então podem estar quebrados há meses.
3. Confirmar que `npm run test` na raiz agrega os três workspaces.

**Aceite:** `npm run test` executa runner de verdade nos três workspaces e o resultado dos três testes órfãos é conhecido.

---

## Fase 1 — Limpar as mentiras do repositório

Correções pequenas que hoje enganam quem lê. Independentes entre si.

1. Apagar `web/src/environments/environment.prod.ts` — órfão, sem `fileReplacements` no `angular.json`, cheio de placeholder (AD-9).
2. Remover de `.claude/settings.local.json` a permissão obsoleta do `mkdir .claude/specs`.
3. Apagar o comentário "⚠️ Espelho de web/… manter em sincronia" de `mobile/src/lib/planned-match.ts` **junto com** a Fase 3, não antes — enquanto a cópia existir, o aviso é verdadeiro.

**Aceite:** nenhum arquivo de configuração descreve um mecanismo que não existe.

---

## Fase 2 — Arquitetura de conhecimento (AD-10, AD-11)

1. `mkdir -p docs && git mv .claude/specs docs/specs` — preserva histórico dos 55 arquivos.
2. Mover `plan.md` e `tasks.md` de dentro das 14 pastas de feature para `_bmad-output/implementation-artifacts/` (efêmero não mora junto do durável).
3. Substituir `.claude/specs` → `docs/specs` em 23 arquivos, **excluindo `supabase/migrations/`**:
   ```bash
   grep -rl "\.claude/specs" . --exclude-dir=node_modules --exclude-dir=.git \
     --exclude-dir=migrations | xargs sed -i '' 's|\.claude/specs|docs/specs|g'
   ```
4. Criar o tombstone `.claude/specs/README.md` apontando para `docs/specs/` — resolve de uma vez as 28 referências nas migrations aplicadas, que não são reescritas.
5. Criar `docs/decisions/` e rodar `bmad-project-context` no intent `refresh` — o `AGENTS.md` tem 2 referências dentro dos marcadores gerenciados, e a proveniência do bloco está defasada.

**Aceite:** `grep -r "\.claude/specs"` retorna só migrations e o tombstone. Os 28 links do `CLAUDE.md` resolvem. `git log --follow` de um spec movido mostra o histórico anterior.

> O compilador não ajuda nesta fase — são todos comentários e links. Build verde não prova nada aqui.

---

## Fase 3 — ADRs: trazer o conhecimento caro para dentro do git (AD-11)

Duas fontes, uma varredura cada:

- **As 24 memórias do Claude Code** — separar decisão arquitetural durável de nota de sessão. Só a primeira vira ADR.
- **Código e migrations** — decisões que hoje só existem em comentário: o escopo `@vitale/*` imutável por causa de builds e entitlements, o timeout de 8 s em `activity_routes`, zonas de FC como `%FCmáx` e não Karvonen, dedupe multi-fonte do HealthKit, `_elevation_gain` transiente.

Cada ADR é numerada, append-only, e nomeia a alternativa rejeitada e o custo de reverter.

**Aceite:** toda decisão que hoje só existe em memória externa ou em comentário tem ADR no repositório. Nenhuma ADR precisa ser editada depois — só superseded.

---

## Fase 4 — Consolidar o vocabulário (AD-3)

Antes da lógica, o vocabulário — a lógica depende dele.

1. `GPS_ACTIVITY_IDS` (duplicado em `web/core/models/activity-types.ts:20` e `mobile/lib/workout-types.ts:120`) sobe para `packages/shared/src/fitness/activity-types.ts`, que já é dono dos rótulos.
2. `STRENGTH_IDS` e `EASY_IDS` (inline nos dois `planned-match`) sobem para o mesmo módulo.
3. Apps passam a importar do núcleo.

**Aceite:** cada constante de domínio tem exatamente uma definição no repositório inteiro.

---

## Fase 5 — Consolidar a lógica duplicada (AD-1, AD-2)

Os cinco pares, do mais simples ao mais divergente. Um commit por par, para que cada um seja revisável.

| Par | O que sobe | O que fica no app |
| --- | --- | --- |
| `todo-logic` | tudo (272 vs 274 linhas, 6 divergentes) | nada |
| `habit-logic` | o cálculo | — |
| `planned-match` | `autoMatch`, `kindForActivity`, helpers de data | `buildWeek` sobe junto: é puro, e a AD-1 é mecânica |
| `weekly-volume` | o cálculo | — |
| `moving-time` | o núcleo, no formato `Sample[]` que o mobile já extraiu | só o adaptador do track HealthKit — importa tipo nativo |

O `moving-time` é o modelo do movimento: o mobile já tinha separado `movingTimeFromSamples(Sample[])` dos adaptadores. Promover é reconhecer o que já estava certo.

Ao decidir cada caso, a pergunta é uma só: **este módulo importa API de plataforma?** Não importa se "parece domínio".

**Aceite:** nenhum basename se repete entre `web/src` e `mobile/src` fora dos 10 stores. Os testes dos três workspaces passam.

---

## Fase 6 — Contrato de schema (AD-4, AD-12)

A fase maior: 139 chamadas `.from()`, 19 tabelas, 14 delas em comum.

1. Criar `packages/shared/src/data/` com um módulo por tabela — dono único do acesso, devolvendo modelo de domínio de `models/`, nunca linha crua.
2. Adicionar `@supabase/supabase-js` às dependências do núcleo (deixa de ser zero-dep — custo aceito conscientemente).
3. Migrar tabela a tabela, começando pelas 14 compartilhadas. Cada store perde a query e mantém a máquina de estado.
4. **Resolver antes de encostar em perfil:** o web consulta `from('profiles')`, o mobile consulta `from('user_profiles')`, e só `user_profiles` existe nas migrations. Descobrir se a tabela foi criada fora do versionamento ou se a leitura do web falha calada.

**Aceite:** nenhum `.from(` fora de `packages/shared/src/data/`. Divergências de filtro como a de `todo_templates` deixam de ser possíveis por construção.

---

## Fase 7 — Fechar a guarda (AD-7)

Só agora — a guarda falharia de imediato se entrasse antes das Fases 4 a 6.

Teste no workspace do núcleo, rodando em `npm run test`, que falha quando:
- um basename duplica entre `web/src` e `mobile/src` fora da allowlist de stores;
- um módulo sem import de plataforma existe fora do núcleo;
- existe `.from(` fora de `packages/shared/src/data/`.

**Aceite:** a guarda passa no estado atual e comprovadamente falha quando uma violação é introduzida de propósito. Guarda que nunca foi vista falhando não é guarda.

---

## Fora de escopo

- Reescrever os comentários das 28 migrations aplicadas — ledger não se reescreve; o tombstone resolve.
- Criar CI — diferido no spine, com condição de revisita escrita.
- Segunda instância Supabase — diferido; AD-8 mantém instância única com a mitigação já praticada.
- Subir Expo/React Native — decisão independente desta consolidação.

## Risco e rollback

Fases 0 a 4 são de risco baixo e revertem com `git revert`. A Fase 5 muda comportamento potencialmente: onde as duas cópias divergiram, consolidar **escolhe uma** — e a escolhida pode mudar o que um dos apps fazia. Cada par merece leitura do diff antes de decidir qual versão vence, e o par `moving-time` (60 linhas divergentes) é o de maior risco.

A Fase 6 não toca o banco: nenhuma migration, nenhum impacto em produção.
