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

O Orbe estava prestes a ganhar features novas sobre uma arquitetura que já duplicava. Cinco pares de lógica de domínio existiam em web e mobile ao mesmo tempo, com 85% dos commits precisando mudar os dois lados juntos. O conhecimento de schema era escrito à mão nos dois apps: 139 chamadas `.from()` sobre 19 tabelas, 14 delas compartilhadas, com filtros que já discordavam. E as decisões mais caras do projeto viviam em 24 arquivos de memória fora do repositório.

Era oportunidade com janela: cada feature nova multiplicaria o custo. **As oito capabilities foram entregues.** Os critérios de sucesso abaixo seguem sendo o contrato — o que mudou é que agora são verificáveis como cumpridos, e a guarda da CAP-7 os mantém assim.

## Capabilities

- **CAP-1** — Verificação executável no núcleo
  - **intent:** O núcleo compartilhado roda seus próprios testes, para que qualquer garantia sobre ele seja verificável.
  - **success:** `npm run test` na raiz executa um runner real nos três workspaces, e o resultado dos três testes antes órfãos é conhecido e registrado.

- **CAP-2** — Conhecimento durável no repositório
  - **intent:** Specs e documentação de produto vivem no repositório, separadas do que é descartável.
  - **success:** `docs/specs/` contém as 55 specs com histórico preservado sob `git log --follow`; `grep -r "\.claude/specs"` retorna apenas migrations aplicadas e o tombstone; os 28 links do `CLAUDE.md` resolvem.

- **CAP-3** — Decisões arquiteturais registradas
  - **intent:** As decisões caras do projeto ficam legíveis por qualquer pessoa ou ferramenta que abra o repositório.
  - **success:** cada decisão antes presente só nas memórias externas ou em comentário de código tem ADR numerada em `docs/decisions/`, e nenhuma precisa ser editada para mudar de ideia — apenas superseded.

- **CAP-4** — Vocabulário de domínio com dono único
  - **intent:** Cada conceito de domínio tem exatamente uma definição no repositório.
  - **success:** `GPS_ACTIVITY_IDS`, `STRENGTH_IDS`, `EASY_IDS` e `ENDURANCE_IDS` têm definição única, no núcleo; os quatro conjuntos são disjuntos por teste; nenhuma constante de domínio é redefinida fora dele.

- **CAP-5** — Lógica de domínio sem duplicata
  - **intent:** Cálculo de domínio é escrito uma vez e consumido pelos dois apps.
  - **success:** nenhum basename se repete entre `web/src` e `mobile/src` fora dos 10 stores e do diferimento nomeado; os testes dos três workspaces passam.

- **CAP-6** — Contrato de schema com dono por tabela
  - **intent:** O conhecimento sobre o schema do banco tem um dono único, e os apps o consomem em vez de reescrevê-lo.
  - **success:** nenhuma chamada `.from(` fora de `packages/shared/src/data/`; cada tabela tem um módulo dono que devolve modelo de domínio, nunca linha crua — salvo `user_preferences`, cuja exceção está justificada no próprio módulo.

- **CAP-7** — Guarda mecânica ativa
  - **intent:** As fronteiras da arquitetura são impostas por execução, não por disciplina.
  - **success:** a guarda passa no estado consolidado e falha comprovadamente quando uma violação é introduzida de propósito, em cada uma das suas checagens.

- **CAP-8** — Configuração que não mente
  - **intent:** Nenhum arquivo de configuração do repositório descreve um mecanismo que não existe.
  - **success:** `environment.prod.ts` — placeholder órfão, sem `fileReplacements` que o referenciasse — está removido, e a permissão obsoleta do `mkdir` saiu de `.claude/settings.local.json`.

## Constraints

- Migration aplicada nunca é reescrita. As 28 referências obsoletas dentro delas permanecem, resolvidas por um tombstone em `.claude/specs/README.md`.
- Escrita em produção só com autorização explícita **por operação**. Houve exatamente uma nesta consolidação: a migration que versionou `profiles`, aplicada com `begin/commit` explícito e registrada em `schema_migrations`.
- `npm run test` na raiz é o único ponto de imposição automático que existe: não há CI nem git hooks. Guarda que não roda ali não roda.
- Checagem que precisa do banco não cabe no `npm run test` e não é coberta pela guarda — vira comando documentado. É o caso da detecção de desvio de schema.
- Módulo que não importa API de plataforma pertence ao núcleo. O critério é o conjunto de imports, nunca um julgamento sobre o que "é domínio".
- Consolidar um par divergente escolhe **uma** das versões e pode mudar o comportamento de um dos apps.
- Uma única instância Supabase serve todos os ambientes: todo trabalho de desenvolvimento escreve em dado real.
- `mobile/ios/` e `patches/` mudam apenas pela ferramenta que os gera.

## Non-goals

- Criar pipeline de CI.
- Segunda instância Supabase para desenvolvimento.
- Subir a SDK do Expo ou o React Native.
- Reescrever os comentários das 28 migrations aplicadas.
- Reorganizar o **conteúdo** das specs — o movimento foi de local, não de texto.
- Separar cálculo de apresentação em `running-highlights.ts`. `ActivityHighlight` carrega `value` e `caption` já formatados; partir isso é o que a AD-2 manda, mas muda o contrato que os componentes consomem. Diferido com condição: quando alguém encostar em highlights.
- Derrubar `user_profiles`. Verificado em produção que nunca recebeu um insert (`n_tup_ins = 0`) e nenhum código a referencia, mas `drop` é irreversível e a decisão é do dono do banco.

## Success signal

A próxima feature que envolva cálculo de domínio é escrita uma vez, roda nos dois apps sem cópia, e uma tentativa de duplicá-la falha em `npm run test` antes de virar commit.

## Assumptions

- Nenhuma pendente. A que existia — `@supabase/supabase-js` ser isomórfico e não contar como API de plataforma — deixou de ser suposição: 19 módulos de dados rodam nos dois apps com o mesmo código de query.

## Open Questions

- Qual o alvo de hospedagem do web? A AD-9 já elimina a necessidade de injetar segredo no build, então a escolha é de plataforma, não de arquitetura. Continua aberta.
