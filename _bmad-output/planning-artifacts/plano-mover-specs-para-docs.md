# Plano — Mover `.claude/specs/` → `docs/specs/`

**Autor:** Winston (arquiteto) · **Data:** 2026-08-17 · **Status:** pronto para priorização
**Tipo:** refactor de estrutura de repositório (sem mudança funcional)

---

## 1. Por que agora

O motivo **não** é medo de lock-in de fornecedor. As specs são markdown puro; trocar de
ferramenta de IA custaria um `git mv` e um find/replace a qualquer momento.

O motivo é um defeito ativo de configuração:

```yaml
# _bmad/bmm/config.yaml
project_knowledge: "{project-root}/docs"   # ← pasta não existe
```

Toda skill BMAD que varre `project_knowledge` em busca de contexto de produto encontra o
vazio hoje. As 55 specs que descrevem o produto estão invisíveis para o pipeline de
planejamento. Não quebra nada visivelmente — só produz planejamento pior do que produziria.

Mover as specs para `docs/specs/` conserta o defeito **e** põe o conteúdo na camada certa
(documentação de projeto, não configuração de ferramenta). A portabilidade vem de graça.

### Alternativa descartada

Apontar `project_knowledge` para `.claude/specs` (1 linha) conserta o BMAD com custo quase
zero, mas mantém documentação de produto dentro da pasta de configuração do harness.
Descartada por ser remendo, não correção — mas é o fallback se a prioridade cair.

---

## 2. Decisão e fronteira de escopo

| Item | Decisão |
|---|---|
| Destino | `docs/specs/` (não `docs/` na raiz — deixa espaço para outros docs) |
| Método | `git mv` — preserva histórico dos 55 arquivos |
| Migrations SQL aplicadas | **Fora de escopo** — ver §2.1 |
| `_bmad/bmm/config.yaml` | **Nenhuma mudança** — já aponta para `docs/`, passa a ser válido |

### 2.1 Por que as migrations ficam de fora

28 migrations carregam um comentário `-- Spec: .claude/specs/<feature>/`. Elas já foram
aplicadas em produção. Migration aplicada é registro histórico append-only: reescrever 28
arquivos aplicados para consertar um comentário é churn com downside real (ruído em
qualquer diff de migrations) e upside nenhum.

**Mitigação:** um tombstone em `.claude/specs/README.md` apontando para o novo caminho.
Um arquivo resolve as 28 referências obsoletas — e também qualquer link antigo em
histórico de git, sessões anteriores ou anotações fora do repo.

---

## 3. Inventário verificado

**51 arquivos, 84 ocorrências.** Todas são comentário ou link — nenhuma é `import`,
path de build ou referência de runtime.

| Grupo | Arquivos | Ocorrências | Ação |
|---|---:|---:|---|
| `CLAUDE.md` | 1 | 28 | atualizar |
| `AGENTS.md` | 1 | 2 | atualizar — **ver §5, armadilha** |
| Código TS — `packages/shared/` | 6 | 11 | atualizar comentários |
| Código TS — `web/` | 5 | 5 | atualizar comentários |
| Código TS — `mobile/` | 4 | 4 | atualizar comentários |
| Specs cruzando specs | 5 | 5 | atualizar |
| `.claude/settings.local.json` | 1 | 1 | remover permissão obsoleta do `mkdir` |
| **Subtotal a tocar** | **23** | **56** | |
| Migrations SQL | 28 | 28 | **não tocar** (§2.1) |

Concentração: `CLAUDE.md` (28) e `packages/shared/src/models/index.ts` (6) somam 40% das
ocorrências. O resto é 1 por arquivo — find/replace mecânico.

Formatos encontrados (o replace precisa cobrir os dois):
- Com barra final: `.claude/specs/habitos/`
- Arquivo direto: `.claude/specs/web-metas.md`

---

## 4. Sequência de execução

Fases independentes. Cada uma é commitável sozinha; a 1 e a 2 devem ir juntas.

**Fase 1 — mover**
```bash
mkdir -p docs
git mv .claude/specs docs/specs
```

**Fase 2 — atualizar referências (23 arquivos)**
Substituir `.claude/specs` → `docs/specs` em tudo, **exceto** `supabase/migrations/`.
```bash
grep -rl "\.claude/specs" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=migrations \
  | xargs sed -i '' 's|\.claude/specs|docs/specs|g'
```

**Fase 3 — tombstone**
Criar `.claude/specs/README.md`:
> As specs foram movidas para `docs/specs/`. Referências a `.claude/specs/` em migrations
> aplicadas e no histórico do git apontam para cá de propósito — não foram reescritas.

**Fase 4 — limpeza**
Remover de `.claude/settings.local.json` a permissão
`Bash(mkdir -p /Users/sydtpt/Projects/life-organizer/.claude/specs)` — obsoleta.

**Fase 5 — reconciliar o AGENTS.md** (ver §5)

---

## 5. Armadilha específica do BMAD

As 2 ocorrências em `AGENTS.md` estão **dentro** dos marcadores `<!-- bmad:context -->`.
Editar à mão ali funciona, mas o bloco é gerenciado: o próximo `refresh` do
`bmad-project-context` substitui o conteúdo entre os marcadores.

Além disso, o bloco já está com a proveniência defasada — diz `verificado contra a711c41`,
mas há correção não commitada por cima (a linha do `npm run test`).

**Ação:** depois das fases 1–4, rodar `bmad-project-context` no intent `refresh`. Ele
reverifica os caminhos, atualiza as 2 referências e recarimba data + SHA. Isso resolve o
caminho novo e a proveniência defasada de uma vez.

---

## 6. Critérios de aceite

O compilador **não** ajuda aqui — são todos comentários. Build verde não prova nada sobre
este refactor. A verificação é por grep e por resolução de link.

1. `docs/specs/` contém os 55 `.md`; `git log --follow` de um arquivo movido mostra o
   histórico anterior preservado.
2. `grep -r "\.claude/specs" . --exclude-dir=node_modules --exclude-dir=.git` retorna
   **apenas** as 28 migrations e o tombstone.
3. Os 28 links de `CLAUDE.md` resolvem para arquivos existentes.
4. Sem regressão funcional (esperado, dado que só comentários mudaram):
   - `cd web && npx ng build && npx ng test --watch=false`
   - `cd mobile && npx tsc --noEmit && npx jest`
   - `npm run lint -w @vitale/shared`
5. `AGENTS.md` reverificado pelo `bmad-project-context`, com proveniência nova.

---

## 7. Risco e rollback

**Risco: baixo.** Sem mudança de runtime, sem migration, sem impacto em produção. O pior
caso é um link de doc quebrado, detectável por grep.

**Rollback:** `git revert` do commit. Nada aplicado fora do repositório.

**Ponto de atenção:** o `sed` da fase 2 é abrangente. Confirmar que `--exclude-dir=migrations`
pegou — um `git diff --stat supabase/migrations/` deve sair vazio antes do commit.

---

## 8. Fora de escopo

- Reescrever comentários das 28 migrations aplicadas (§2.1)
- Reorganizar o conteúdo das specs (é mudança de local, não de conteúdo)
- Criar `docs/` para outra documentação além de specs
- Qualquer alteração em `CLAUDE.md` além dos caminhos

---

## 9. Handoff

**Para o PM:** item de manutenção, não feature. Não gera valor de usuário — desbloqueia o
pipeline de planejamento do BMAD, então tem efeito multiplicador sobre todo trabalho
planejado daqui pra frente. Argumento de priorização: fazer **antes** do próximo ciclo de
planejamento, senão esse ciclo roda sem enxergar as specs. Sem dependências; não bloqueia
nem é bloqueado por nenhuma feature em andamento.

**Para o dev:** refactor mecânico, sem decisão de design pendente. As fases 1–4 são
executáveis direto. Os dois pontos que exigem atenção humana são a exclusão das migrations
no `sed` (§7) e o refresh do `AGENTS.md` (§5) — o resto é find/replace. A rota BMAD natural
é `bmad-build`: é change request bem delimitada, não precisa de PRD nem de quebra em
stories.
