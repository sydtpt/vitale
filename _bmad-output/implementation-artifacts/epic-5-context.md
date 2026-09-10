# Epic 5 Context: Os motores

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

O dono aperta **"Ler"** na Saúde do sono, no iPhone, e lê uma frase sobre o período ou a noite —
escrita pelo modelo do aparelho, pela nuvem ou pelo template —, e a tela diz quem escreveu. Por
baixo nasce a camada de motores do Orbe: uma porta e um orquestrador únicos, por onde passam também
a narração da revista e, depois, o nome de rota — em vez de uma terceira cópia do cliente da
`ia-narrar`. Sem PRD nem UX próprios: o contrato é a CAP-13 de Sono e as ADRs 0047–0049. Nesta
sprint entram 5.1–5.5; só a 5.5 tem tela.

## Stories

- Story 5.1: A porta, o fio e o orquestrador (F0)
- Story 5.2: O descritor da retrospectiva, e as listas com dono (F0)
- Story 5.3: A leitura da Saúde do sono, sem modelo (F0)
- Story 5.4: A bancada no Mac (F1)
- Story 5.5: A ponte, o botão Ler e a escolha do motor (F2)
- Story 5.6: Vários motores de nuvem (F3)
- Story 5.7: O nome de rota pela porta (F4)
- Story 5.8: Core AI (F5)

## Requirements & Constraints

**O motor escreve palavras; o código escreve números.** O motor nunca calcula: recebe o caso pronto
e redige. Na Saúde do sono, nenhum algarismo sai dele.

**As regras da Saúde do sono seguem inteiras:** a frase nunca vira nota, aconselha, elogia, afirma
causa nem diz "melhorou" ou "piorou".

**Leitura efêmera:** só no toque, nunca ao abrir a tela, nunca gravada — por isso lê período em curso.

**O recuo nunca aumenta a exposição nem troca de provedor.** Aparelho não recua para nuvem.

**Só resposta de motor grava.** Piso por indisponibilidade, capacidade, janela ou falha passageira
nunca grava nada.

**Motor de modelo vira padrão só depois da bancada,** com limiar fixado pelo dono — nunca por agente.
Nenhum dado de saúde de produção é versionado. Web fora da primeira versão.

**Aceite da sprint é veredito dele:** fixou o limiar lendo o relatório, e leu na tela de
desenvolvimento do iPhone a frase de cada motor ao lado da do template. Verde no CI nunca quer dizer
motor funcionando.

## Technical Decisions

**Duas costuras, nenhuma camada nova.** A porta `Motor` (`ia/motor.ts`) **nunca rejeita** — falha é
valor, com classe — e escolhe o tipo de motor; a linha `model:` da ponte escolhe os pesos. Nenhum SDK
de modelo em JS.

**Só o orquestrador percorre a cadeia** (`ia/orquestrar.ts`). Cada recurso declara um descritor
puro no catálogo de `ia/`, com piso `semModelo` obrigatório, `regimeMaximo`, cadeia padrão e se
grava. Modo `medicao` (um motor, sem recuo nem piso) é só da bancada e da tela de desenvolvimento. O
resultado diz se veio de motor ou de piso, com causa e trilha.

**A classe de falha decide** — sete, traduzidas na borda por tabela com teste. Nome de erro da Apple
ou status HTTP nunca chega a decisão.

**O fio da nuvem é do núcleo:** `ia/fio.ts`, sem imports e lido pelo Deno, é dono do contrato, das
classes e da gramática de `MotorId`. Há um só motor de nuvem, `criarMotorDeNuvem(invocar)`.

**Três regimes de número:** interpolado (Saúde do sono), copiado e conferido (revista), molde (nome
de rota). Marcador e termos proibidos têm dono único. Na Saúde, o caso é classificado pelo código.

**A escolha é de cada aparelho, por recurso,** em armazenamento local — `user_preferences` não é
tocada. A lista da nuvem é do servidor.

**A ponte é nossa:** módulo Expo local `on-device-engine`, Swift sem estado nem domínio, só com pesos
locais, carregado como opcional. Há OTA: o build que a embarca sobe `runtimeVersion`.

**Uma porta por hospedeiro.** `'ia-narrar'` e a ponte só no ponto de injeção de cada um (no app,
`mobile/src/lib/motores/`). As guardas em `architecture.test.ts` entram com o código que cobram;
as que têm passivo nascem catraca.

**A bancada roda o mesmo Swift, sem cópia, e o mesmo pedido** — idêntico é mesmo hash, pela mesma
entrada pura da tela. Mac e iPhone no mesmo major.minor (27); nuvem com JWT de usuário, nunca chave
de serviço.

## UX & Interaction Patterns

- A tela diz **quem escreveu** e por que o escolhido não escreveu. Toque repetido com o mesmo hash se
  junta ao primeiro.
- `/configuracoes/motores` lista os recursos do catálogo do núcleo, nunca à mão; indisponível aparece
  com motivo.
- A tela de desenvolvimento, com os motores lado a lado, é o único lugar do texto cru do fornecedor.
- Tela só depois de proposta visual com dados reais, aprovada por ele.
- A percepção passa a sair com vírgula (`3,3/5`) nos dois apps — conserto na origem.

## Cross-Story Dependencies

- **Ordem não numérica:** 5.1 → 5.2 → 5.3 em paralelo com 1.7–1.9, sem deploy nem banco; a 5.4
  depois de 5.1 e 5.3.
- **5.1, 5.2 e a 5.4 no marco A → 1.10**, que vira cliente do orquestrador. O marco B (aparelho,
  macOS 27) não segura a revista; se o Xcode 26.6 não abrir no 27, a 5.4 para e volta ao dono.
- **5.5 depois da 1.9, em build próprio.** Depois dela, update para o runtime 1.0.5 não alcança o
  iPhone.
- **Quem chegar primeiro cria:** `scripts/` (5.4 × 2.1), sessão JWT (5.4 × 2.2),
  `mobile/src/lib/motores/` (1.10 × 5.5), `Engine.swift` (5.4 × 5.5).
- **`criarMotorDeNuvem` nasce na 5.1** lendo também a `ia-narrar` de hoje; a function só aprende o
  fio na 5.6.
- **A 1.9 é a única migração do Épico 1:** a 5.2 não cria coluna, e o `CHECK` de
  `motivo_de_parada` muda junto com a guarda da 5.1.
- **Catracas descem em ordem:** `'ia-narrar'` e `'STOP'` de 2 (5.1) a 1 (1.10) a 0 (5.7).
- **A 1.11** deriva *reprovada* (causas permanentes) e *erro* (passageiras) da causa do piso, e lista
  os problemas da trilha que a 5.1 carrega.
- **5.6–5.8 são da próxima sprint.**
