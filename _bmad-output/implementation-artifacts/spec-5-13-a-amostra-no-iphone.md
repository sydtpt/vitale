---
title: 'Story 5.13 — A amostra no iPhone: medir o modelo do aparelho no próprio aparelho'
type: 'feature'
created: '2026-09-19'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'b0e95ed6e58e48ae40365dc9ab2225b02cdbb06b'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-10-a-coluna-do-aparelho-na-bancada.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-9-a-ponte-no-app.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O iPhone do dono tem o **AFM 3 Core Advanced** (janela de 8.192); o Mac da bancada só tem o AFM 3 Core (4.096). As medições da 5.10 e da 5.11 foram do modelo menor — ninguém sabe quanto o modelo **dele** aprova na Saúde do sono, e sem esse número não há como decidir o pedido nem a cadeia padrão. A tela de desenvolvimento só mede uma janela por vez, à mão.

**Approach:** A tela de desenvolvimento ganha **"Medir a amostra"**: roda o modelo do aparelho, em modo `medicao`, sobre a **mesma amostra de janelas** da bancada do Mac, com a **mesma régua**, e mostra as quatro medidas da ADR 0050, as reprovações por regra e o hash de cada pedido. Para não haver duas regras, a amostra, a tradução da medição em linha e as medidas **sobem para o núcleo**, e a bancada do Mac passa a usá-las de lá. Pedido v1; nada sai do aparelho.

## Boundaries & Constraints

**Always:**
- **Um dono só para a régua da bancada:** `enumerarJanelas`, `amostraDaNuvem` (a regra `recentes-por-caso-e-alcance`), a tradução `Medicao` → linha e as medidas (`foraDaMedida`, `medidasDoPortao`, `mediana`, `agregar`) passam a morar num módulo puro do núcleo **fora de `ia/` e de `sleep/`** (ex.: `packages/shared/src/bancada/`), e `scripts/bancada/` passa a importá-las de lá — **o relatório do Mac não muda** (os testes dele seguem verdes sem ajustar expectativa).
- **A amostra do caso só na tela de desenvolvimento:** uma barreira nova restringe o uso desse módulo, em `mobile/src`, a `app/configuracoes/motores/bancada.tsx` — no molde da barreira da sonda. Tela de produto nunca lê caso.
- **As notas inteiras antes de enumerar:** a medição só começa depois de `carregarNotasDesde` cobrir a noite mais antiga e sem `notasError`; senão a percepção muda o caso e a amostra diverge da do Mac. Falhou a carga: a tela diz por quê e não mede.
- **O laço fica no hospedeiro, e o motor é só o aparelho:** um pedido por vez, pela fila da ponte; a janela que ele não atendeu (prazo, processo) conta **fora da medida**, como no Mac — o app ganha o mesmo registro de "fabricada pelo hospedeiro" e de "fria" (a primeira do processo).
- **O resultado:** as quatro medidas da ADR 0050 com a regra da janela medida escrita ao lado, **sem limiar e sem veredito**; a contagem por regra; e, por janela, `range@offset`, caso, alcance, desfecho, ms e o **hash do pedido** (para comparar com o relatório do Mac por hash, AD-11). Os `hoje` e os limites usados aparecem no topo.
- **`--limite` do Mac vira escolha na tela:** 2 (padrão, ~22 janelas, a amostra do Mac) ou 6 (~61, a validação).
- **A tela não dorme durante a medição** (`expo-keep-awake`, já no binário como dependência do `expo`, passa a ser declarado): o iOS suspende o app com a tela apagada e o modelo em segundo plano cai por taxa.
- Tudo fica na memória da sessão: nenhuma linha, texto ou número sai do aparelho.

**Ask First:**
- Qualquer mudança no relatório ou nos números da bancada do Mac.
- Rodar a nuvem ou a sonda no app; persistir resultado; dependência nova além do `expo-keep-awake`.

**Never:**
- Sonda no app (a barreira da AD-7 continua); `montarPedido` chamado pelo app; o laço `medir()` inteiro no núcleo (a catraca do `montarPedido` nomeia só a bancada).
- Mudar o pedido da Saúde (a v2 da 5.11 fica na branch dela); mudar `cadeiaPadrao`; tocar o módulo nativo (sem `runtimeVersion` novo).

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Medir a amostra | aparelho disponível, notas carregadas | ~22 janelas medidas uma a uma, progresso visível; ao fim, as medidas, as regras e a lista com hash | N/A |
| Aparelho indisponível | diagnóstico não `disponivel` | o botão não mede e diz o motivo do diagnóstico | N/A |
| Notas não chegaram | `carregarNotasDesde` falhou ou ainda carrega | não mede; diz que as notas não chegaram | nunca mede com percepção faltando |
| Janela que estoura o prazo | aparelho não responde em 60 s | a linha conta fora da medida, contada à parte | a medição continua |
| Parar | toque em "parar" no meio | não abre a próxima janela; o que já mediu fica com as medidas parciais, marcado como parcial | a chamada em voo termina sozinha |
| Mesma régua | a mesma lista de linhas | o módulo do núcleo dá as mesmas medidas que o relatório do Mac dava | N/A |
| Uso fora da bancada | uma tela de produto importa o módulo | a barreira reprova | N/A |

</frozen-after-approval>

## Code Map

- `scripts/bancada/janelas.ts` — puro, só núcleo: `Janela`/`JanelaClassificada` (30-36), `ALCANCES_MEDIDOS` (47), `LIMITE_DA_AMOSTRA` (50), `REGRA_DA_AMOSTRA` (53), `TETO_DE_PASSOS` (65), `enumerarJanelas(noites, notas, hoje)` (96, síncrona, ~390 `entradaDaSaude`), `amostraDaNuvem(classificadas, limite)` (160), `passosPorAlcance` (182), `chaveDaJanela` (190 — **colide de nome** com `mobile/src/lib/leitura-da-saude.ts:82`, outra coisa: renomear a do núcleo).
- `scripts/bancada/medir.ts` — `medirUma` (270-295: `entradaDaSaude` → `montarPedido` só para o corpo → `ler(..., medicao)`); a tradução pura e não exportada `linhaDaMedicao` (173) com `textoDoPiso` (168), `msDa` (122), `problemasDa` (133), `assinaturaDe` (109), `SEM_PEDIDO` (145); `frio`/`doHospedeiro` vêm de `Hospedeiro.registro` (68-72). No app, "houve pedido" é `m.tipo === 'tentativa'`, nunca `montarPedido`.
- `scripts/bancada/relatorio.ts` — `LinhaDoRelatorio` (162-191), `DesfechoDaLinha` (147), `vereditoDe` (245), `ORDEM_DOS_CASOS` (282, cópia de `CASOS_DA_SAUDE` — no núcleo, usar a original), `agregar` (318), `foraDaMedida` (383), `mediana` (444), `medidasDoPortao` (451, lê desfecho, sintetica, doHospedeiro, caso, alcance, frio, ms, frase, template). `sha256De` usa `node:crypto` e **fica** na bancada.
- `packages/shared/src/architecture.test.ts` — guarda (7) `:2826-3160`: `PORTA_DE_IA` (2891), `LIVRES_DE_SONO` (2893), `LIVRES_NA_BANCADA` (2908), `ehDescritor` (3012); peças de `sleep/` são achadas pelo fecho a partir de quem importa `../ia/` (2936-2950) — por isso o módulo novo fica fora de `sleep/` e de `ia/`. Barreira da sonda (2446-2495) é o molde da nova. Catraca do `montarPedido` (3241, 3359). A barreira do "núcleo que fala com modelo" (1372) exige só import relativo e nada de rede — o código puro já cumpre.
- `mobile/src/app/configuracoes/motores/bancada.tsx` — dados por `useSonoStore` (55-62), `hoje = localDateStr()` (80), `entradaDaSaude` (83-86), `carregarNotasDesde` (88-91, sem conferir `ratingsSince`), laço `medir` (106-138), `medirUm` (225-277), `PeriodNav` (148), `BlocoDoMotor` (279), `Anel` (355). O anel tem teto 40 (`lib/motores/anel.ts:22`): a amostra registra com `registrar` próprio, não o anel.
- `mobile/src/store/sono.store.ts` — noites todas (93), notas de 90 dias (18, 91-94), `carregarNotasDesde` (118-147: não relança erro; `ratingsSince` só cresce).
- `mobile/src/lib/motores/index.ts` — `criarTransporteDoAparelho` (326), `PRAZO_MS` (88), `linhaDoPrazo` (282), a vez solta após 3 prazos (291): é onde nasce o registro de "fria" e "fabricada pelo hospedeiro".
- `expo-keep-awake@~57.0.2` já no binário (`mobile/ios/Podfile.lock:53`, transitiva de `expo`); o pnpm isolado pede declarar no `mobile/package.json` (não é nativo novo: sem `runtimeVersion`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/bancada/` (novo) + testes — a amostra (`enumerarJanelas`, `amostraDaNuvem`, a chave renomeada), a tradução `Medicao` → linha e as medidas, puras; exportadas pelo barril.
- [x] `scripts/bancada/janelas.ts`, `medir.ts`, `relatorio.ts` + testes — passam a importar do núcleo; o relatório e os testes da bancada seguem iguais.
- [x] `packages/shared/src/architecture.test.ts` — barreira: o módulo da bancada, em `mobile/src`, só em `app/configuracoes/motores/bancada.tsx`.
- [x] `mobile/src/lib/motores/index.ts` + teste — o registro de "fria" e "fabricada pelo hospedeiro" do transporte do aparelho, lido pela medição.
- [x] `mobile/src/app/configuracoes/motores/bancada.tsx` (+ um hook ou lib em `mobile/src/lib/` se o laço crescer) + testes puros — "Medir a amostra": notas inteiras, enumerar, amostrar (2 ou 6), medir um por vez com progresso e "parar", mostrar medidas, regras e a lista com hash; `useKeepAwake` durante a medição.
- [x] `mobile/package.json` — declarar `expo-keep-awake@~57.0.2`.

**Acceptance Criteria:**
- Given o build instalado e as notas carregadas, when o dono toca "Medir a amostra", then em cerca de um minuto vê a aprovação do **AFM 3 Core Advanced** na amostra do Mac, com as outras três medidas, as regras que reprovaram e o hash de cada pedido.
- Given a mesma lista de linhas, when o relatório do Mac e a tela do iPhone calculam as medidas, then dão o mesmo número — a régua é uma só.
- Given a suíte, when roda, then passa inteira, a bancada do Mac sem mudar de resultado e a barreira nova verde.

## Spec Change Log

## Design Notes

**Por que subir a régua, e não copiar:** o valor desta medição é ser **comparável** com a do Mac. Duas implementações da amostra e das medidas divergiriam na primeira correção de uma delas — e aí o "mesmo número" seria coincidência. O laço continua em cada hospedeiro porque o app não pode chamar `montarPedido` (catraca) nem rodar a sonda (AD-7).

**Por que a barreira nova:** a guarda (7) mantém caso fora das telas de produto ("um caso lido na tela poderia discordar dela"). A amostra carrega caso por janela; ela é ferramenta de medição, e fica presa à tela que existe para medir.

**O que esta story não decide:** o pedido (v1 × v2) e o padrão da cadeia. Ela dá o número do modelo do dono; a decisão vem depois, com ele na mão.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test`
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test`
- `pnpm --filter @vitale/web build`
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`
- `pnpm mobile:device --build-only` — o JS novo no build (sem nativo novo).

**Manual checks:**
- No iPhone: Bancada → "Medir a amostra", com a tela acesa — **portão do dono**, que lê os números.
