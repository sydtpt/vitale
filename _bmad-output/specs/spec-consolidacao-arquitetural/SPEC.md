---
id: SPEC-consolidacao-arquitetural
companions:
  - ../../planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/plano-de-migracao.md
  - inventario-duplicacao.md
sources: []
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar.

# Consolidação arquitetural do Orbe

## Why

O Orbe está prestes a ganhar features novas sobre uma arquitetura que já duplica. Cinco pares de lógica de domínio existem em web e mobile ao mesmo tempo, e 85% dos commits que os tocaram precisaram mudar os dois lados juntos — o par `todo-logic` tem 272 linhas contra 274, com seis divergentes. O conhecimento de schema é escrito à mão nos dois apps: 139 chamadas `.from()` sobre 19 tabelas, 14 delas compartilhadas, com filtros que já discordam. E as decisões mais caras do projeto — zonas de FC, dedupe multi-fonte do HealthKit, o timeout ao ler rotas — vivem em 24 arquivos de memória fora do repositório.

É uma oportunidade com janela: cada feature nova multiplica o custo de consolidar. O trabalho é fazer isso agora, enquanto são cinco pares e não quinze.

## Capabilities

- **CAP-1** — Verificação executável no núcleo
  - **intent:** O núcleo compartilhado roda seus próprios testes, para que qualquer garantia sobre ele seja verificável.
  - **success:** `npm run test` na raiz executa um runner real nos três workspaces, e o resultado dos três testes hoje órfãos é conhecido e registrado.

- **CAP-2** — Conhecimento durável no repositório
  - **intent:** Specs e documentação de produto vivem no repositório, separadas do que é descartável.
  - **success:** `docs/specs/` contém as 55 specs com histórico preservado sob `git log --follow`; `grep -r "\.claude/specs"` retorna apenas migrations aplicadas e o tombstone; os 28 links do `CLAUDE.md` resolvem.

- **CAP-3** — Decisões arquiteturais registradas
  - **intent:** As decisões caras do projeto ficam legíveis por qualquer pessoa ou ferramenta que abra o repositório.
  - **success:** cada decisão hoje presente só nas 24 memórias externas ou em comentário de código tem ADR numerada em `docs/decisions/`, e nenhuma precisa ser editada para mudar de ideia — apenas superseded.

- **CAP-4** — Vocabulário de domínio com dono único
  - **intent:** Cada conceito de domínio tem exatamente uma definição no repositório.
  - **success:** `GPS_ACTIVITY_IDS`, `STRENGTH_IDS` e `EASY_IDS` têm definição única, no núcleo; nenhuma constante de domínio é redefinida fora dele.

- **CAP-5** — Lógica de domínio sem duplicata
  - **intent:** Cálculo de domínio é escrito uma vez e consumido pelos dois apps.
  - **success:** nenhum basename se repete entre `web/src` e `mobile/src` fora dos 10 stores, os cinco pares estão consolidados, e os testes dos três workspaces passam.

- **CAP-6** — Contrato de schema com dono por tabela
  - **intent:** O conhecimento sobre o schema do banco tem um dono único, e os apps o consomem em vez de reescrevê-lo.
  - **success:** nenhuma chamada `.from(` fora de `packages/shared/src/data/`; cada tabela tem um módulo dono que devolve modelo de domínio, nunca linha crua.

- **CAP-7** — Guarda mecânica ativa
  - **intent:** As fronteiras da arquitetura são impostas por execução, não por disciplina.
  - **success:** a guarda passa no estado consolidado e falha comprovadamente quando uma violação é introduzida de propósito.

- **CAP-8** — Configuração que não mente
  - **intent:** Nenhum arquivo de configuração do repositório descreve um mecanismo que não existe.
  - **success:** `web/src/environments/environment.prod.ts` — placeholder órfão, sem `fileReplacements` que o referencie — está removido, e a permissão obsoleta do `mkdir .claude/specs` saiu de `.claude/settings.local.json`.

## Constraints

- Migration aplicada nunca é reescrita. As 28 referências obsoletas dentro delas permanecem, resolvidas por um tombstone em `.claude/specs/README.md`.
- Nenhuma migration em produção faz parte desta consolidação — o trabalho não toca o banco.
- `npm run test` na raiz é o único ponto de imposição que existe: não há CI nem git hooks. Qualquer guarda que não rode ali não roda.
- Módulo que não importa API de plataforma pertence ao núcleo. O critério é o conjunto de imports, nunca um julgamento sobre o que "é domínio".
- Consolidar um par divergente escolhe **uma** das versões e pode mudar o comportamento de um dos apps. `moving-time`, com 60 linhas divergentes, é o de maior risco.
- Uma única instância Supabase serve todos os ambientes: todo trabalho de desenvolvimento escreve em dado real.
- `mobile/ios/` e `patches/` mudam apenas pela ferramenta que os gera.

## Non-goals

- Criar pipeline de CI.
- Segunda instância Supabase para desenvolvimento.
- Subir a SDK do Expo ou o React Native.
- Reescrever os comentários das 28 migrations aplicadas.
- Reorganizar o **conteúdo** das specs — o movimento é de local, não de texto.
- Qualquer feature nova antes da consolidação fechar.

## Success signal

A próxima feature que envolva cálculo de domínio é escrita uma vez, roda nos dois apps sem cópia, e uma tentativa de duplicá-la falha em `npm run test` antes de virar commit.

## Assumptions

- `@supabase/supabase-js` é isomórfico e não conta como API de plataforma — base da CAP-6.
- Os três testes órfãos do núcleo podem estar quebrados. Nunca executaram, então o resultado é desconhecido, não presumido verde.

## Open Questions

- O web consulta `from('profiles')`, que não existe em nenhuma migration, enquanto o mobile consulta `from('user_profiles')`, que existe. É tabela criada fora do versionamento ou leitura que falha calada? Resolver antes da CAP-6.
- Qual o alvo de hospedagem do web, dado que será publicado em breve?
