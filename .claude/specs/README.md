# As specs se mudaram

Este diretório está vazio de propósito. As specs de feature agora vivem em:

- **`docs/specs/<feature>/`** — `spec.md`, `plan.md`, `data-model.md`
- **`_bmad-output/implementation-artifacts/<feature>/tasks.md`** — as listas de tarefas

A separação segue a AD-10 da [espinha arquitetural](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md): o que segue verdadeiro depois da entrega fica em `docs/`; o que morre na entrega fica em `_bmad-output/`.

## Por que este arquivo existe

28 migrations já aplicadas carregam um comentário `-- Spec: .claude/specs/<feature>/`. Migration aplicada é registro append-only e não é reescrita, então esses ponteiros continuam apontando para cá — junto com qualquer link em histórico de git, anotação antiga ou sessão anterior.

Este arquivo resolve todos eles de uma vez.
