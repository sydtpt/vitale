# Epic 5 Context: Os motores

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Dar ao Orbe uma porta única (`Motor`) para qualquer motor de linguagem — sem modelo, aparelho
(Foundation Models, depois Core AI) e nuvem (`ia-narrar`) — e um orquestrador único que percorre
pedido → motor → interpretação → conferência → frase, com o motor escolhido **por recurso e por
aparelho**. O dono redefiniu o foco em 19/09: o épico é a **ponte** e a **escolha do modelo em
Configurações**; a Saúde do sono é só o recurso de teste, e o épico tem de oferecer todo modelo que
ele *pode* usar. O núcleo, a bancada, o botão "Ler", o seletor, a lista de nuvem, a ponte Swift no
iPhone e a medição no próprio aparelho já estão na `main`. O que falta é levar o **terceiro e último
inquilino** — o nome de rota — para a mesma porta (5.7), e decidir o caminho do Core AI (5.8).

## Stories

- Story 5.1: A porta, o fio e o orquestrador (F0) — fechada
- Story 5.2: O descritor da retrospectiva e as listas com dono (F0) — fechada
- Story 5.3: A leitura da Saúde do sono, sem modelo (F0) — fechada
- Story 5.4: A bancada no Mac (F1, marco A) — fechada
- Story 5.5: O botão Ler e a escolha do motor (F2, marco A) — fechada
- Story 5.6: Vários motores de nuvem (F3) — fechada
- Story 5.10: A coluna do aparelho na bancada (metade do Mac do marco B) — fechada
- Story 5.9: A ponte Swift `on-device-engine` no app (a outra metade do marco B) — na `main`, em `review`
- Story 5.13: A amostra no iPhone — na `main`, em `review`
- Story 5.7: O nome de rota pela porta (F4) — **de pé**
- Story 5.8: Core AI (F5) — **de pé**, com riscos abertos

> As 5.9, 5.10, 5.11 e 5.13 nasceram depois do desdobramento e **não têm seção própria no
> `epics.md`**; o `sprint-status.yaml` é a autoridade sobre elas. A 5.11 (pedido da Saúde para o
> modelo pequeno) vive na branch `feat/motores-5-11`, **sem push e parada por decisão do dono** — não
> vai à `main` sem decisão nova.

## Requirements & Constraints

Cada recurso declara o seu regime de números, o seu gatilho e a sua cadeia. A frase da Saúde do sono
nasce de um entre sete casos classificados pelo código, só por ação explícita, e nunca é gravada. A
tela diz sempre quem escreveu e, quando o motor escolhido não escreveu, por quê. Cada aparelho
escolhe o motor de cada recurso; a lista de motores de nuvem é do servidor. A web fica fora.

Invariantes do épico inteiro:
- O motor nunca calcula: recebe o caso pronto e só redige.
- O motor escreve palavras, o código escreve números — no regime interpolado, nenhum algarismo sai
  do motor.
- O recuo nunca aumenta a exposição nem troca de destinatário: o aparelho não recua para a nuvem.
- Só resposta de motor grava. Piso por `indisponivel`, `capacidade`, `janela` ou `transitoria` não
  grava nada — nem recusa, nem marca de visitado.
- O núcleo não conhece rede, SDK nem fornecedor, e as barreiras acham quem viola isso pelo import.
- Nenhum dado de saúde de produção é versionado; a bancada versiona só o manifesto.
- As seis regras da ADR 0036 valem inteiras: sem placar, sem conselho, sem "melhorou"/"piorou".

**O portão de padrão.** Um motor de modelo só vira padrão de um recurso quando passa nas quatro
condições juntas, na medição da bancada: aprovação ≥ 90% das janelas (só desfecho `ok`), os sete
casos nos dois alcances, nenhuma frase aprovada idêntica à do template e mediana ≤ 20 s por chamada.
A aprovação é registrada pelo dono e vale para o par recurso × `MotorId` com o manifesto medido;
trocar modelo, provedor ou pedido exige medição nova. Nenhum agente fixa, afrouxa ou contorna o
limiar, e nenhum código o lê para decidir.

**O que a medição já disse.** A nuvem passou na Saúde do sono e está **habilitada, não imposta**. O
modelo do aparelho **reprovou pela forma** (rótulo com dois-pontos, mais de uma frase, número por
extenso, marcador ausente ou fora de posição), com latência de ~1,6 s; a sonda de fidelidade passou
inteira. Por isso a cadeia padrão da Saúde continua `[sem-modelo]`, e os motores de modelo entram só
por escolha no seletor. O Private Cloud Compute ficou **fora** — do aparelho ele se diz disponível e
recusa o pedido por falta de entitlement gerenciado pela Apple; se um dia voltar, entra como `nuvem:`,
não como aparelho.

**Aceite.** O veredito é do dono, no aparelho. Verde no CI nunca quer dizer motor funcionando.

## Technical Decisions

**A porta e o orquestrador.** `Motor` vai de `Pedido` para `Promise<Resposta | Falha>` e **nunca
rejeita**: falha é valor, com classe. O orquestrador único tem dois modos — `produto` (segue a cadeia
resolvida, com recuo, e `sem-modelo` é o passo terminal) e `medicao` (um motor só, sem recuo e sem
piso; só a bancada e a tela de desenvolvimento o usam). Exceção que escapa de um motor é defeito: vai
ao anel com a pilha e cai no piso. O resultado é discriminado por origem (`motor` ou `piso`), com a
trilha e a causa.

**Só acréscimo.** A revista e a Saúde já são clientes. `ia/motor.ts` e `ia/orquestrar.ts` **só
recebem acréscimos**: a assinatura existente nunca muda, ou quebra quem já mergeou.

**Três regimes de número.** Interpolado na Saúde do sono, copiado e conferido na revista, **molde** no
nome de rota — o motor devolve campos pelo subconjunto `Esquema`, a frase sai do molde, e a
conferência é de pertinência: todo lugar citado foi enviado.

**O que a 5.7 herda como dívida declarada:**
- O resultado de piso por causa permanente **não carrega** assinatura, tokens nem o valor da tentativa
  recusada — e é exatamente o que o nome de rota grava hoje ao recusar. A forma desse resultado se
  acerta aqui, porque este é o primeiro recurso que grava recusa.
- A conformidade ao `Esquema` não é conferida em lugar nenhum do caminho: hoje cada descritor teria de
  lembrar de conferi-la e mapear para `saida-invalida`. Avaliar centralizar aqui, no primeiro recurso
  com esquema.
- As catracas das guardas do literal `'ia-narrar'` e de `'STOP'` **chegam a zero nesta story e viram
  barreira**; `ChamadorDeModelo` morre junto. O arquivo misto do hospedeiro se parte: o que toca rede
  fica no ponto de injeção, o descritor sobe para o núcleo.
- O gatilho continua "ao abrir o detalhe, uma vez por pedalada", protegido pela marca gravada. O
  "próximo tick" é o próprio gatilho, **nunca** retry da porta.

**A ponte do aparelho.** Já existe: dois arquivos em `ios/` — a `Engine.swift` (só `Foundation` e
`FoundationModels`, com a tabela erro → classe e a conversão de esquema) e a cola do Expo, sem
`catch`, literal de classe nem lógica. A porta a carrega com `requireOptionalNativeModule`, e a
ausência é `indisponivel`. Uma sessão nova por pedido, janela lida em execução, `@unknown default` em
todo `switch` sobre enum da Apple. Duas barreiras vivem com ela: o `enum ClasseDeFalha: String` tem de
ser igual a `CLASSES_DE_FALHA`, e os imports ficam numa lista permitida. É o único ponto do app que
nomeia Apple ou Core AI.

**O build.** Xcode 27 / Swift 6.4 é a base local, e o app só abre com o ciclo de vida por cena, que
entra por config plugin porque `mobile/ios/` é gerado. Todo build que embarca ou muda a ponte sobe
`runtimeVersion`, e nenhum update com código da porta vai para runtime anterior. `expo-doctor`
continua 21/21.

**A preferência** é um mapa `RecursoId` → `MotorId` guardado localmente em cada aparelho, nunca em
`user_preferences`.

**A bancada** mede no `scripts/`, com pedidos idênticos pelo mesmo hash, JWT de usuário, export para
diretório ignorado pelo git e só o manifesto versionado. A régua (amostra, linha, medidas, palavras)
tem **um dono só** no núcleo, usada pelo Mac e pelo iPhone. Mac e iPhone medem no mesmo major.minor;
versões diferentes nunca se somam. A sonda de fidelidade só existe em `medicao`.

**A 5.8 ainda tem quatro riscos não resolvidos**, e a primeira entrega dela é a decisão do dono: o
caminho (subir o alvo mínimo para iOS 27, vendorizar `apple/coreai-models` ou escrever conformidade
própria), o Xcode 27 fora da imagem EAS da SDK 57 (build local), a memória por tamanho dos pesos, e
pesos sem o guardrail da Apple num recurso de saúde. A variante entra pela mesma ponte, na linha
`model:`, sem mudar nenhum recurso, e passa pela bancada antes de virar padrão de qualquer coisa.

## UX & Interaction Patterns

- **"Ler".** Só por ação explícita, nunca ao abrir a tela. Um segundo toque com o mesmo hash se junta
  ao primeiro, e resposta de pedido que já não é o corrente é descartada. Nada é gravado.
- **Quem escreveu.** A tela diz quem escreveu e, quando for o caso, por que o escolhido não escreveu.
- **Seletor.** `/configuracoes/motores` lista os recursos do catálogo do núcleo — nunca à mão — e, para
  cada um, os motores até o `regimeMaximo`. Motor indisponível aparece com o motivo, e a preferência
  gravada nunca é descartada. O modelo do sistema mostra variante e janela.
- **Tela de desenvolvimento.** Único lugar onde o texto cru do fornecedor aparece: roda cada motor em
  `medicao` sobre o mesmo pedido, com classe e detalhe da falha, e mede a amostra no próprio aparelho.
- **Mudança visual.** Qualquer mudança visual nessas telas exige antes mockup com dados reais,
  aprovado pelo dono.

## Cross-Story Dependencies

- **A 5.7** depende do ponto de injeção do app e da porta, ambos prontos. É a story que fecha as duas
  catracas e mata a última cópia do cliente da `ia-narrar`. Toca o app: exige **build próprio** — nunca
  o mesmo de uma migração, nem build ou instalação no iPhone dividido com outra frente em paralelo.
- **O deploy da `ia-narrar`** que ensina o fio à function é **do dono** e segue pendente nos artefatos;
  até ele acontecer, produção roda a function antiga sem quebrar nada, e a lista de nuvem nomeada fica
  vazia por decisão. Um segundo modelo na lista pede, nesta ordem: tabela de regime do provedor, uma
  rodada da bancada e só então o secret.
- **A 5.8** entra depois da decisão de caminho do dono; nada nela pode alterar recurso existente.
- **Pendências de veredito.** A 5.9 e a 5.13 estão na `main` mas em `review`: falta o dono instalar e
  rodar "Medir a amostra" com a tela acesa. Elas não bloqueiam a 5.7.
