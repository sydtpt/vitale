# GitHub — o acervo, a sprint e o quadro

Três zonas, com fronteira nítida. **Nenhuma issue é de duas zonas.**

| Zona | Quem manda | O que é | Rótulo |
|---|---|---|---|
| **Entrada** | GitHub | bug, ideia, pergunta — nasce aqui | (sem `revista`/`historico`) |
| **Execução** | `sprint-status.yaml` | as stories da Revista | `revista` |
| **Acervo** | congelado | a história, 17/08 a 08/09/2026 | `historico` |

Uma issue de entrada **nunca vira** story: ela é *promovida* — vira spec/épico/story
pelo BMAD, a yaml cresce, o sync cria as stories espelhadas, e a issue de entrada
fecha ligada a elas. Ela era o pedido, não o trabalho.

## Por que GitHub e não Jira

Medido em 09/09/2026, não suposto:

| | Jira | GitHub |
|---|---|---|
| Data histórica na importação | assistente web, manual | `import/issues`, por API |
| Ligar issue ao commit | 230 linhas de sync | `fixes #42`, nativo |
| Token | novo, escopo próprio | o mesmo do `git push` (issues) |
| Hierarquia | Issue ID + Parent no CSV | milestone por épico |

A API do Jira **rejeita** `created` (`"cannot be set. It is not on the appropriate
screen"`). A do GitHub aceita. Foi isso que decidiu.

## Os scripts

### `historico.py` — o parser (só leitura)

Percorre **cada versão commitada** de cada `tasks.md` e deriva, por tarefa, o
primeiro commit em que ela aparece (nascimento) e o primeiro em que virou `[x]`
(conclusão). As datas não saem do texto — saem do git.

```bash
python3 scripts/github/historico.py     # o relatório
```

Duas leituras que o número esconde:

- **17/08/2026 não é o começo do projeto.** O primeiro commit é de **19/05/2026**.
  Onze épicos aparecem em 17/08 porque foi quando o BMAD entrou e os `tasks.md`
  passaram a existir. Os três meses anteriores estão nos commits, não em tarefa.
- **Linha reescrita não entra.** No `piso-das-rotas`, "Opção A (recomendada)" virou
  "Opção A escolhida em 06/09"; importar as duas criaria pendência já decidida. Só
  o elenco da última versão vira issue — 6 caíram por isso.

### `importar_acervo.py` — a história como issues

```bash
python3 scripts/github/importar_acervo.py                   # ensaio
python3 scripts/github/importar_acervo.py --aplicar --limite 3
python3 scripts/github/importar_acervo.py --aplicar          # tudo
python3 scripts/github/importar_acervo.py --aplicar --adrs   # + as 46 ADRs
```

milestone = épico (18, com barra de progresso nativa) · issue = tarefa (452).
Idempotente pelo `saida/importado.json`; rodar de novo só pega o que faltou.
O envio anda a 0,75 s por issue porque o GitHub pede no máximo ~80 criações de
conteúdo por minuto.

**Feito em 09/09/2026:** 452 de 452 — 397 fechadas, 55 abertas, 30 `verificacao`,
6 `em-andamento`. Bate com o `grep` original ao número.

### `sincronizar_sprint.py` — a Revista

```bash
python3 scripts/github/sincronizar_sprint.py            # ensaio
python3 scripts/github/sincronizar_sprint.py --aplicar
```

Mão única: a `sprint-status.yaml` manda, o GitHub obedece. Mexer no rótulo à mão é
desfeito na execução seguinte, de propósito — quem escreve o estado das stories é o
`bmad-build`.

A exceção boa é o fechamento: `fixes #42` numa mensagem de commit fecha a issue
nativamente. A yaml continua sendo quem diz `done`, e o script reconcilia.

### `quadro.py` — o Projects v2

```bash
python3 scripts/github/quadro.py --aplicar
```

https://github.com/users/sydtpt/projects/5

Cinco colunas: **Entrada · Backlog · Em andamento · Aguardando veredito · Feita**.

**Por que a raia de veredito existe.** O gargalo medido deste projeto não é
planejamento — é veredito. Das 55 tarefas abertas, **30 são "conferir no aparelho"**,
e o `CLAUDE.md` mais o índice de memórias somam outras 10 pendências do mesmo tipo.
O trabalho fica pronto e empilha esperando alguém olhar, e esse estado não tinha
onde aparecer. Hoje a coluna tem 31 itens — é a fila real deste projeto.

Entra no quadro só trabalho **aberto** (82: 27 da Revista + 55 do acervo). As 397
fechadas seguem existindo como issue, buscáveis, fora do quadro — arquivo não é fila.

## Automático: o hook de pós-commit

```bash
git config core.hooksPath .githooks
```

Roda o sync **quando o commit tocou a `sprint-status.yaml`**, e só então.
Pular uma vez: `ORBE_SEM_SYNC=1 git commit ...`. Desligar: `git config --unset core.hooksPath`.

## Os dois tokens

- **Issues e milestones** — o token que o `git push` já usa, tirado do keychain por
  `git credential fill`. Escopo `repo`. Nada novo a guardar.
- **O quadro** — precisa de `project`, que o de cima não tem. Token clássico com
  `repo` + `project`, guardado como:

  ```bash
  security add-generic-password -s 'GitHub Orbe' -a <email> -w '<token>' -U
  ```

## Armadilha de ambiente

O Python do python.org no macOS não usa o chaveiro do sistema: sem `certifi` toda
chamada morre em `CERTIFICATE_VERIFY_FAILED` **antes** de tocar o GitHub, e o erro
parece problema de credencial. Os scripts já resolvem sozinhos.
