---
name: orbe-pronto
description: 'O portão antes de afirmar que algo está pronto, funcionando, corrigido ou verde neste repositório. Use ANTES de qualquer afirmação de conclusão, antes de commitar, antes de mergear na main, antes de fechar uma tarefa — e sempre que for escrever "pronto", "funcionando", "está ok", "resolvido", "pode usar", "done", "fixed", "tests pass". Use também quando o usuário perguntar "está pronto?", "posso conferir?" ou "pode ir pra main?".'
---

# Pronto no Orbe

**Princípio:** evidência antes da afirmação — e aqui a evidência final não é um comando,
é o Sydnei olhando a tela.

## A lei

```
NADA É "PRONTO" COM UM PORTÃO SÓ.

Portão da máquina — comando rodado AGORA, saída lida, exit code conferido.
Portão dele       — ele viu no aparelho / no navegador e deu o veredito.
```

Você pode fechar o primeiro sozinho. **O segundo não é seu.** Enquanto ele não julgar, o
estado honesto é *construído, falta você conferir* — nunca *pronto*.

## Por que dois portões, e não um

Build verde, `tsc` verde, 379 testes verdes — e a exportação de imagem morta, porque
`saveToLibraryAsync` passou a **lançar** em runtime no SDK 57
([`docs/upgrade-de-plataforma.md`](../../../docs/upgrade-de-plataforma.md)). É a terceira
vez que essa forma de falha aparece nesta base: a entrega em background (ADR 0013), o
patch do supabase aplicado na cópia errada, e a galeria.

O CI não cobre build nativo iOS nem os portões em device. **Verde nele não significa
feature funcionando.**

## O portão da máquina

Rode o que o CI roda (`.github/workflows/ci.yml`), workspace a workspace. `pnpm -r lint`
na raiz **não serve**: `web` não tem target `lint` e `mobile` sai 127.

```bash
pnpm --filter @vitale/shared lint      # tsc do núcleo
pnpm --filter @vitale/shared test      # testes + barreiras de arquitetura
pnpm --filter @vitale/web build        # compila templates e TS
pnpm --filter @vitale/web test         # Vitest
cd mobile && pnpm exec tsc --noEmit && pnpm exec jest
cd mobile && pnpm dlx expo-doctor      # 21/21; falha nova dele é sinal, não ruído
```

**Mexeu em dependência? Valide os três**, não só o que motivou a mudança. Três TypeScripts
convivem de propósito (AD-15) e recurso só-TS6 no núcleo quebra o build do web longe de
onde foi escrito.

**Antes do build de entrega, confira que a árvore não está atrás:**

```bash
git merge-base --is-ancestor origin/main HEAD && echo "ok" || echo "DEFASADO"
```

Worktree defasado compila verde e **reverte features em silêncio** — foi assim que a aba
Sono voltou no tempo em 06/09. E valide do commit, num worktree limpo: a árvore principal
costuma ter patch solto, que faz commit quebrado compilar.

## Afirmação → o que a prova exige

| Afirmação | Prova | Não basta |
|---|---|---|
| "os testes passam" | os seis comandos acima, saída desta mensagem | rodar só o workspace que você mexeu |
| "o web compila" | `pnpm --filter @vitale/web build`, exit 0 | `tsc` do núcleo — `packages/shared` não tem build, os apps o compilam como fonte |
| "o mobile está ok" | `tsc --noEmit` **e** `jest` **e** `expo-doctor` | qualquer um sozinho; o doctor pega o que `tsc` e teste não pegam |
| "está no iPhone" | `pnpm mobile:device` (Release autocontido) + os 3 portões | `expo run:ios` / `pnpm mobile:ios` — é Debug, o JS vem do Metro e morre fora de casa |
| "não regrediu" | `merge-base --is-ancestor origin/main HEAD` antes do build | branch verde |
| "a feature funciona" | exercitá-la na tela, inclusive o que toca API de plataforma | build + tsc + testes verdes |
| "está na main" | `git log --oneline origin/main -1` mostrando o commit | merge local sem push |
| "a migration está em produção" | consulta ao banco, ou `supabase/scripts/check-schema-drift.sh` | o `.sql` existir em `supabase/migrations/` |
| "o tamanho ficou bom" | comparado em escala real no aparelho | conferido no monitor — o que fecha lá sai grande no telefone |
| "o agente terminou" | `git diff` mostrando a mudança | o relatório do agente |

**Os três portões em device** (`docs/upgrade-de-plataforma.md`): app abre com telas,
navegação e mapas; aba Saúde popula; sync em background com o app **fechado**, confirmado
nos dois lugares — o log em Configurações → Dados e o `created_at` em `activities`.

## Vocabulário

O CLAUDE.md diz "falta conferir no iPhone" em oito frentes agora mesmo. Esse é o registro
honesto, e é o padrão — não uma ressalva a acrescentar quando sobra espaço.

| Escreva | Quando |
|---|---|
| "construído, falta você conferir no iPhone" | o portão da máquina fechou, o dele não |
| "na main e pushado; falta o seu veredito" | mergeado, ainda não julgado |
| "aprovado no iPhone" | ele julgou e aprovou |
| "pronto" / "fechado" | **só** depois do veredito dele |

Nunca use "deve funcionar", "provavelmente", "parece ok" como conclusão — ou você rodou a
prova, ou não afirme.

## Bandeiras vermelhas — pare

- Escrever "pronto", "funcionando" ou "resolvido" sem ter rodado nada nesta mensagem
- Comemorar ("perfeito!", "ótimo!") antes da saída do comando
- Prestes a commitar, mergear ou pushar sem o portão da máquina
- Confiar no relatório de um subagente sem olhar o diff
- Dizer que uma feature visual está boa sem ela ter passado por um aparelho
- Pensar "só desta vez" porque a mudança é pequena
- Declarar pronto porque *você* achou bom — mobile-first é lei, e o juiz é ele

## Desculpas

| Desculpa | Realidade |
|---|---|
| "é uma linha só" | uma linha derrubou a galeria inteira |
| "o CI vai pegar" | o CI não cobre iOS nativo nem device |
| "o tsc passou" | tsc não é build, e build não é runtime |
| "os testes passam" | 379 testes verdes já conviveram com feature morta |
| "ele confere depois" | então diga isso, não diga "pronto" |
| "a branch está verde" | verde e defasada reverte feature em silêncio |

---

*Estrutura inspirada em `verification-before-completion` de
[obra/superpowers](https://github.com/obra/superpowers) (MIT, © 2025 Jesse Vincent).
O conteúdo — comandos, portões e armadilhas — é deste repositório.*
