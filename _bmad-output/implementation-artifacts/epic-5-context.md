# Epic 5 Context: Os motores

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Dar ao Orbe uma porta única (`Motor`) para qualquer motor de linguagem — sem modelo, aparelho
(Foundation Models, depois Core AI) e nuvem (`ia-narrar`) — e um orquestrador único que percorre
pedido → motor → interpretação → conferência → frase, com o motor escolhido por recurso e por
aparelho. A primeira leitura é a Saúde do sono: o usuário aperta "Ler", recebe uma frase sobre a
noite ou o período, e a tela diz sempre quem escreveu. A impressão da revista já narra pela mesma
porta, e o nome de rota vem depois. O que falta nesta sprint é o motor do aparelho: a ponte Swift
`on-device-engine` e a coluna do aparelho na bancada, o marco B que saiu da 5.5 e virou a story 5.9.
A 5.9 ainda não tem seção própria no desdobramento do épico. Os critérios dela são os da ponte (5.5)
e os da coluna do aparelho e da sonda de fidelidade (marco B da 5.4).

## Stories

- Story 5.1: A porta, o fio e o orquestrador (F0)
- Story 5.2: O descritor da retrospectiva e as listas com dono (F0)
- Story 5.3: A leitura da Saúde do sono, sem modelo (F0)
- Story 5.4: A bancada no Mac (F1)
- Story 5.5: A ponte, o botão Ler e a escolha do motor (F2)
- Story 5.6: Vários motores de nuvem (F3)
- Story 5.7: O nome de rota pela porta (F4)
- Story 5.8: Core AI (F5)
- Story 5.10: A coluna do aparelho na bancada (metade do Mac do marco B — entra **antes** da 5.9)
- Story 5.11: O pedido da Saúde para o modelo pequeno (nasceu da medição da 5.10 — entra **antes** da 5.9)
- Story 5.9: A ponte Swift `on-device-engine` no app (a outra metade do marco B)

## Requirements & Constraints

A frase da Saúde do sono nasce de um entre sete casos que o código classifica em precedência fixa.
Ela só é gerada quando o usuário aperta "Ler" e nunca é gravada. Três motores concorrem por recurso.
A tela diz quem escreveu e, quando o motor escolhido não escreveu, por quê. Cada aparelho escolhe o
motor de cada recurso, e a lista de motores de nuvem é do servidor. A web fica fora da primeira
versão.

Invariantes do épico inteiro:
- O motor nunca calcula. Recebe o caso pronto e só redige.
- No regime interpolado a saída do motor não tem algarismo. Só o código escreve número.
- O recuo nunca aumenta a exposição nem troca de destinatário: o aparelho não recua para a nuvem.
- Só resposta de motor grava. Piso por `indisponivel`, `capacidade`, `janela` ou `transitoria` não
  grava nada.
- O núcleo não conhece rede, SDK nem fornecedor, e as barreiras acham quem viola isso pelo import.
- Nenhum dado de saúde de produção é versionado.
- As seis regras da ADR 0036 valem inteiras: sem placar, sem conselho, sem "melhorou"/"piorou".

**O portão de padrão.** Um motor de modelo só vira padrão de um recurso quando passa nas quatro
condições juntas, na medição da bancada:
- aprovação ≥ 90% das janelas, contando só o desfecho `ok` da conferência;
- os sete casos presentes nos dois alcances, noite e período;
- nenhuma frase aprovada idêntica à do template;
- mediana ≤ 20 s por chamada.

O dono registra a aprovação, que vale para o par recurso × `MotorId` com o manifesto medido. Trocar
modelo, provedor ou pedido exige medição nova. Nenhum agente fixa, afrouxa ou contorna o limiar, e
nenhum código o lê para decidir. A nuvem passou na Saúde do sono (22 de 22, nenhuma idêntica, 13,6 s)
e está habilitada, não imposta: a cadeia padrão continua só `sem-modelo`. O motor do aparelho será
julgado pelas mesmas quatro condições, e ali se espera reprovação.

**Aceite do épico.** A primeira metade está cumprida: o relatório foi lido e o limiar, fixado. Falta
a segunda: apertar "Ler" no iPhone e ver, na tela de desenvolvimento, a frase de cada motor
disponível, com o aparelho entre eles, ao lado da do template. O veredito é do dono, no aparelho.
Verde no CI nunca quer dizer motor funcionando.

## Technical Decisions

**A porta e o orquestrador.** Há duas costuras. A porta TS (`ia/motor.ts`) escolhe o tipo de motor.
A linha `model:` da ponte Swift escolhe os pesos locais. `Motor` vai de `Pedido` para
`Promise<Resposta | Falha>` e nunca rejeita: a falha é um valor com classe. O orquestrador único
(`ia/orquestrar.ts`) tem dois modos:
- `produto`: segue a cadeia resolvida, com recuo, e `sem-modelo` é o passo terminal;
- `medicao`: roda um motor só, sem recuo e sem piso, e só a bancada e a tela de desenvolvimento o
  usam.

Exceção que escapa de um motor é defeito: vai ao anel com a pilha e cai no piso.

**O fio.** `ia/fio.ts` não importa nada. É dono das sete classes de falha, cada uma com o seu
destino, e da gramática de `MotorId` (`tipo:provedor/resto`, com `aparelho:sistema` e `nuvem:padrao`
reservados). O código da `ia-narrar` já fala o fio. A lista de nuvens nomeadas está vazia por
decisão, e `nuvem:padrao` existe sempre que há rede.

**Três regimes de número.** Interpolado na Saúde do sono, copiado e conferido na revista, molde no
nome de rota.

**A ponte do aparelho.** É um módulo Expo local com dois arquivos em `ios/`:
- `Engine.swift` importa só `Foundation` e `FoundationModels`, nunca `ExpoModulesCore` nem modelo de
  servidor. Recebe o pedido como JSON canônico, decodificado por um `Codable` único, e devolve
  `Resposta` ou `Falha` em JSON. A tabela erro → classe (com teste) e a conversão de esquema moram
  nele.
- A cola do Expo não tem `catch`, literal de classe nem lógica.

Nascem com o arquivo duas barreiras: o `enum ClasseDeFalha: String`, com valores brutos explícitos,
tem de ser igual a `CLASSES_DE_FALHA`, e os imports ficam restritos a uma lista permitida. A porta
carrega o módulo com `requireOptionalNativeModule`, e a ausência dele é `indisponivel`.

Regras do Swift:
- Uma sessão nova por pedido, e a janela lida de `contextSize` em execução.
- `#available(iOS 26, macOS 26, *)`, sempre com os dois sistemas.
- `#available(iOS 26.4, macOS 26.4, *)` para `tokenCount`.
- `#if compiler(>=6.4)` para símbolo novo dentro de `FoundationModels`; `#if canImport` não o guarda.
- `@unknown default` em todo `switch` sobre enum da Apple. Erro não reconhecido vira `transitoria` e
  vai ao anel com o nome cru.

O que muda no iOS 27:
- `GenerationError` foi deprecado em favor de `LanguageModelError`.
- A indisponibilidade tem três motivos: aparelho não elegível, Apple Intelligence desligada e modelo
  não pronto.
- Na geração de texto, a recusa chega como texto comum, e é a conferência que a detecta.
- O guardrail é intenção do pedido, e o modo permissivo só existe com saída `texto`.

A ponte é o único ponto do app que nomeia Apple ou Core AI, e só instancia pesos que rodam no
aparelho.

**O build.** Desde 15/09 o Xcode 27 (Swift 6.4) é a base do build local. O app só abre com o ciclo de
vida por cena, que entra por config plugin, porque `mobile/ios/` é gerado. A ponte não pode tratar
`UIApplication.shared.delegate.window` como a única fonte de janela. O build que embarca a ponte
sobe `runtimeVersion`, que o ciclo por cena manteve em 1.0.5, e nenhum update com código da porta vai
para o runtime anterior. O `expo-doctor` continua 21/21.

**A preferência.** É um mapa `RecursoId` → `MotorId` guardado localmente em cada aparelho, nunca em
`user_preferences`.

**A bancada.** Mede, no workspace `scripts/`, pedidos idênticos pelo mesmo hash, autenticando com JWT
de usuário e versionando só o manifesto.
- A CLI Swift compila `Engine.swift` sem cópia, e o SwiftPM não aceita alvo fora da raiz do pacote.
- O `swift build` é local, com o mesmo Xcode maior do build de entrega, e nunca roda no CI.
- Mac e iPhone medem no mesmo major.minor (27), com Apple Intelligence ativo, e versões diferentes
  nunca se somam.
- A amostra de 20 pedidos no iPhone compara por hash com a bancada e roda de novo a cada troca de
  versão maior de qualquer um dos dois.
- A sonda de fidelidade, em que o motor escolhe a dimensão entre opções fechadas e é conferido contra
  o caso do código, só existe em `medicao`.

## UX & Interaction Patterns

- **"Ler".** Em `/sono/saude`, o botão lê só por ação explícita, nunca ao abrir a tela. Um segundo
  toque com o mesmo pedido se junta ao primeiro, e resposta de pedido que já não é o corrente é
  descartada.
- **Quem escreveu.** A tela diz quem escreveu e, quando for o caso, por que o escolhido não escreveu.
- **Texto cru do fornecedor.** Só a tela de desenvolvimento o mostra. Ela roda cada motor em
  `medicao` sobre o mesmo pedido, com a classe e o detalhe da falha.
- **Seletor.** `/configuracoes/motores` lista os recursos do catálogo do núcleo e, para cada um, os
  motores até o `regimeMaximo`. Motor indisponível aparece com o motivo, e a preferência gravada nunca
  é descartada.
- **Mudança visual.** Qualquer mudança visual nessas telas exige antes mockup com dados reais,
  aprovado pelo dono.

## Cross-Story Dependencies

- **Fechadas.** 5.1 a 5.6 estão fechadas:
  - o núcleo;
  - a bancada no marco A;
  - o botão "Ler" e o seletor, sem a ponte, conferidos no iPhone;
  - a lista de nuvem do servidor. O deploy da `ia-narrar` fica com o dono, e até lá a produção roda a
    function antiga sem quebrar nada.
- **A revista.** Ela já é cliente do orquestrador. Por isso `ia/motor.ts` e `ia/orquestrar.ts` só
  recebem acréscimos: a assinatura existente nunca muda.
- **A 5.9.** Depende da bancada (5.4) e do ponto de injeção `mobile/src/lib/motores/` (5.5 marco A).
  O ponto de injeção é onde entram o `motorPara` do aparelho, o catálogo e a concorrência de um pedido
  por vez, e é o único lugar autorizado a importar `on-device-engine`. A `Engine.swift` ainda não
  existe, e a 5.9 a cria.
- **Build próprio.** A 5.9 nunca divide build com uma migração, nem build ou instalação no iPhone com
  outra story que rode em paralelo.
- **Próxima sprint.** A 5.7 e a 5.8 ficam para depois. A 5.8 (Core AI) entra pela mesma ponte, na
  linha `model:`, e ainda tem riscos abertos:
  - o caminho, entre alvo mínimo iOS 27, vendorizar `apple/coreai-models` ou conformidade própria;
  - o Xcode 27, que está fora da imagem EAS da SDK 57;
  - a memória;
  - pesos sem o guardrail da Apple num recurso de saúde.
