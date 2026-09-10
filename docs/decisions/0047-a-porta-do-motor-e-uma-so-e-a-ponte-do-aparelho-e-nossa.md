# 0047 — A porta do motor é uma só, e a ponte do aparelho é nossa

**Status:** aceita
**Data:** 2026-09-10
**Complementa:** [0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md),
[0041](0041-o-nome-da-rota-e-molde-com-lacuna.md) e
[0042](0042-o-passe-de-nome-roda-no-aparelho.md). Responde à pergunta que a 0041 deixou para
"quando um terceiro uso aparecer".
**Espinha:** [architecture-Orbe-ia-no-aparelho-2026-09-10](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md) — AD-1 a AD-5, AD-10, AD-12 a AD-14

## Contexto

Em 10/09/2026 o dono pediu que o Orbe passe a usar modelos de linguagem que rodam no próprio
iPhone — o modelo do sistema pelo Foundation Models agora, pesos abertos pelo Core AI no iOS 27 —,
sem abandonar o modelo de nuvem que a `ia-narrar` já serve, e com o motor escolhido por recurso. A
primeira leitura é a Saúde do sono ([ADR 0036](0036-saude-do-sono-e-contagem-nao-placar.md)).

O repositório já tinha uma costura: o `ChamadorDeModelo` da ADR 0042, uma função injetada na
orquestração pura. Tinha também dois inquilinos dela — a narração da Retrospectiva e o nome de rota
— e, no app, **duas cópias** do cliente da `ia-narrar` (`lib/edicao-ia.ts` e
`services/route-name.ts`), cada uma lendo a resposta de um jeito e tratando texto cortado de outro.
A Saúde do sono seria a terceira cópia.

A pesquisa de 09 e 10/09 mediu o terreno em fonte primária:

- o `@react-native-ai/apple` publicado (0.12.0, de 28/01/2026) informa disponibilidade só como
  booleano, não publicou a distinção de erros nem a contagem de tokens que entraram no repositório
  em junho, não oferece guardrails e fixa `SystemLanguageModel.default` em toda sessão — com ele, o
  Core AI não entra;
- `LanguageModelSession.GenerationError` está deprecado no iOS 27 em favor de `LanguageModelError`,
  e pegar os tipos novos exige Xcode 27;
- o modo permissivo de guardrail só vale para geração de texto livre, e é justamente no texto livre
  que a recusa do modelo chega como texto comum, sem erro;
- o iOS 27 sai em 14/09/2026 com um modelo novo, e no iOS 27 a mesma linha `model:` aceita modelos de
  servidor;
- o Foundation Models roda no Mac de desenvolvimento (macOS 26.6, janela de 4.096 tokens, pt-BR).

Um portão de revisão com três revisores independentes, no mesmo dia, achou dois defeitos que o
primeiro desenho teria gravado no banco: um piso de "motor indisponível" marcaria uma pedalada como
nomeada para sempre, e o `'STOP'` do Gemini está num `CHECK` de `edicoes_ia` — qualquer outro motor
impediria a revista de gravar.

## Decisão

**Uma porta, um orquestrador, e a ponte do aparelho escrita no projeto.**

1. **Duas costuras, nenhuma nova.** A porta `Motor` em `ia/motor.ts` — `Pedido` para
   `Promise<Resposta | Falha>`, que nunca rejeita — escolhe o tipo de motor (sem modelo, aparelho,
   nuvem). Dentro da ponte, `LanguageModelSession(model:)` escolhe os pesos locais. O
   `ChamadorDeModelo` vira apelido e morre quando o nome de rota passar pela porta. Nenhum SDK de
   modelo em JavaScript, nenhuma camada de provedor acima da porta.
2. **Um orquestrador só percorre a sequência.** Cada recurso declara um descritor puro — entrada,
   pedido, interpretação, conferência, frase, piso, cadeia padrão, se grava. O orquestrador de
   `ia/orquestrar.ts` é o único que anda na cadeia, em modo `produto` ou `medicao`; o hospedeiro só
   entrega motores por id e o registro local.
3. **O resultado diz de onde veio, e só resposta de motor grava.** O piso pode ser ausência. Piso
   causado por indisponibilidade, capacidade, janela ou falha passageira nunca grava nada. Motivo de
   parada cru não atravessa a porta: o Orbe tem a constante `CONCLUSAO` (valor `'STOP'`, sem
   migration), e nenhum consumidor compara motivo de parada.
4. **Falha tem classe do Orbe.** Sete classes com critério e destino — `indisponivel`, `capacidade`,
   `janela`, `guarda`, `recusa-do-modelo`, `saida-invalida`, `transitoria` —, traduzidas na borda
   (ponte e adaptador da nuvem). Guarda e recusa nunca repetem o mesmo pedido. Nome de erro da
   Apple ou do provedor nunca chega a uma decisão.
5. **O recuo nunca aumenta a exposição nem troca de destinatário.** Aparelho não recua para nuvem;
   um provedor de nuvem não recua para outro. Preferência ilegível degrada para uma opção igual ou
   mais privada.
6. **A ponte é nossa.** Módulo Expo local `on-device-engine`, em dois arquivos: `Engine.swift` (só
   `Foundation` e `FoundationModels`, sem estado, sem domínio, uma sessão por pedido, com a tabela
   erro → classe) e a cola do Expo, carregada com `requireOptionalNativeModule`. Só pesos que rodam
   no aparelho entram nela; modelo de servidor, se vier, é motor de nuvem. O build que a embarca sobe
   `runtimeVersion`.
7. **O fio da nuvem é do núcleo.** O contrato da `ia-narrar` mora em `ia/fio.ts`, sem imports, lido
   pela function; o motor de nuvem é um só, `criarMotorDeNuvem(invocar)`, e cada hospedeiro só
   injeta o transporte.
8. **Uma porta por hospedeiro, e as barreiras acham o inquilino sozinhas.** Sete guardas em
   `architecture.test.ts`, entre elas: a `ia-narrar` e a ponte só aparecem no ponto de injeção de
   cada hospedeiro (catraca em 2 hoje); a barreira do núcleo de IA passa a seguir o código, não uma
   lista de pastas; e as classes do Swift são iguais às do TypeScript.
9. **A impressão da Retrospectiva é cliente do orquestrador.** A story 1.10 chama o orquestrador por
   caderno, com o descritor da retrospectiva, em vez de escrever uma segunda sequência em `ia/`.

## Alternativas rejeitadas

**A Vercel AI SDK como costura.** Era a premissa inicial do dono: o `model` do `generateObject` como
ponto de troca. Seria uma terceira costura ao lado do `ChamadorDeModelo`, que já tinha dois
inquilinos, e é da família de abstração de terceiros que a ADR 0040 recusou. Ela também não resolve a
nuvem: a `ia-narrar` não é um provedor dela.

**O pacote `@react-native-ai/apple`.** Zero Swift nosso, mas, na versão publicada, sem motivo de
indisponibilidade, sem erros separados, sem contagem de tokens e sem guardrails — as quatro coisas
que a lista de riscos pedia —, sobre a AI SDK 6 com a 7 já em linha, e com o modelo do sistema
fixado dentro do Swift dele. O dono preferia a conveniência e aceitou o custo de manter Swift.

**Inline modules do Expo.** Mais leves, mas experimentais desde a SDK 56. O módulo local sobrevive ao
prebuild e é o caminho estável.

**Deixar cada recurso chamar o motor e conferir por conta própria.** É o estado de hoje, e ele já
produziu duas cópias do cliente com tratamentos diferentes. Um recurso sem piso some quando o motor
falta.

**Recuo automático entre motores de nuvem.** A ADR 0040 já o recusou por dobrar os regimes de dado a
auditar. Aqui ele seria pior: dado de saúde indo a um terceiro que ninguém escolheu para aquele
recurso.

**Tratar toda falha do mesmo jeito.** Gera retry inútil em guardrail e em recusa, que nunca vão dar
certo com o mesmo pedido, e esconde a indisponibilidade que a tela precisa explicar.

## Consequências

**O que custa.** O Swift da ponte é do projeto, e a migração de erros do Xcode 27 acontece dentro
dele. A primeira fase deixa de ser só a leitura do sono: leva também o orquestrador, o contrato da
nuvem e o descritor da retrospectiva. A story 1.10 muda de escopo. As duas cópias do cliente da
`ia-narrar` precisam ser migradas — a da revista pela 1.10, a do nome de rota na F4.

**O que paga.** Trocar de cérebro passa a ser uma linha em dois lugares previsíveis: a preferência
(qual tipo) e a linha `model:` (quais pesos). Nenhum recurso novo inventa o próprio caminho até o
modelo, porque as barreiras o encontram pelo import. E nenhuma falha passageira vira estado
permanente no banco.

**O que custa reverter.** Pouco na porta e no orquestrador, que são tipos e funções puras. A ponte
Swift é um módulo isolado: removê-lo devolve o app ao modelo de nuvem e ao piso.

**O que fica em aberto.** O Core AI exige iOS 27 como alvo mínimo no pacote da Apple, e o Xcode 27
não está na imagem EAS da SDK 57; a F5 decide entre subir o alvo do app, vendorizar o pacote ou
escrever uma conformidade própria. Não verificado ainda: se o Xcode 26.6 abre no macOS 27.
