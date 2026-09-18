# Epic 5 Context: Os motores

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Dar ao Orbe uma porta única (`Motor`) para qualquer motor de linguagem — sem modelo, aparelho
(Foundation Models, depois Core AI) e nuvem (`ia-narrar`) — e um orquestrador único que percorre
pedido → motor → interpretação → conferência → frase, com o motor escolhido por recurso e por
aparelho. Entrou na sprint da revista por correct-course em 10/09/2026 porque a story 1.10 (a
impressão da revista) passou a depender dele: sem essa porta, a 1.10 escreveria uma segunda
sequência com política de falha própria, duplicando exatamente o que as ADRs 0047 e 0041 existem
para impedir. A primeira leitura que a usa é a Saúde do sono — o usuário aperta "Ler" e recebe uma
frase sobre o período, escrita pelo template, pela nuvem ou pelo modelo do aparelho, com a tela
dizendo sempre quem escreveu.

## Stories

- Story 5.1: A porta, o fio e o orquestrador (F0)
- Story 5.2: O descritor da retrospectiva e as listas com dono (F0)
- Story 5.3: A leitura da Saúde do sono, sem modelo (F0)
- Story 5.4: A bancada no Mac (F1)
- Story 5.5: A ponte, o botão Ler e a escolha do motor (F2)
- Story 5.6: Vários motores de nuvem (F3)
- Story 5.7: O nome de rota pela porta (F4)
- Story 5.8: Core AI (F5)

## Requirements & Constraints

O usuário lê, numa frase, o que a Saúde do sono (CAP-11) diz sobre o período ou a noite — a frase
nasce de um entre sete casos que o código classifica em precedência fixa, gerada só sob ação
explícita ("Ler") e nunca gravada. Três motores concorrem por recurso; a tela sempre diz quem
escreveu e, quando o motor preferido não escreveu, por quê. Cada aparelho escolhe o motor de cada
recurso pela preferência local dele; a lista de motores de nuvem aprovados vem do servidor, nunca
do cliente. A narração da revista e o nome de rota passam pela mesma porta e pelo mesmo
orquestrador que a Saúde do sono. A bancada no Mac mede template × aparelho × nuvem sobre leituras
reais e é o portão humano para um recurso ganhar motor de modelo como padrão — o limiar é sempre
fixado pelo dono, nunca por um agente. Pesos abertos (Core AI) só entram pela mesma ponte, na linha
`model:`.

Invariantes válidas para o épico inteiro: o motor nunca calcula — recebe o caso já pronto e só
redige; no regime interpolado a saída do motor não carrega nenhum algarismo, só o código escreve
número; o recuo de motor nunca aumenta a exposição do dado nem troca de provedor/destinatário —
aparelho não recua para nuvem por conta própria; só resposta de motor grava, e piso por
indisponibilidade, capacidade, janela ou falha passageira nunca grava nada; existe uma porta por
hospedeiro, e o núcleo não conhece rede, SDK nem fornecedor, com barreiras mecânicas que acham quem
viola isso pelo próprio import; nenhum dado de saúde de produção é versionado, só o manifesto da
bancada; as seis regras da Saúde do sono (ADR 0036) continuam de pé — sem placar, sem conselho, sem
"melhorou"/"piorou"; e a primeira versão é mobile-first, com a web fora do escopo.

**Critério de aceite do épico nesta sprint (F0–F2):** o primeiro relatório da bancada foi lido e o
limiar fixado; e apertar "Ler" no iPhone sobre as janelas de hoje mostra, na tela de
desenvolvimento, a frase de cada motor disponível ao lado da do template. As duas coisas são
veredito do dono, nunca de quem implementa.

## Technical Decisions

Duas costuras, duas altitudes: a porta TypeScript (`ia/motor.ts`) escolhe o **tipo** de motor
(sem-modelo/aparelho/nuvem); dentro da ponte Swift, a linha `model:` do `LanguageModelSession`
escolhe os **pesos locais**. `Motor` é função pura de `Pedido` para `Promise<Resposta | Falha>` que
nunca rejeita — falha é valor, com classe.

O orquestrador único mora em `ia/orquestrar.ts`: `ler(descritor, fatos, { modo, cadeia, motorPara,
registrar, agora })`, com dois modos — `produto` (cadeia resolvida, com recuo) e `medicao` (um
motor só, sem recuo nem piso; só a bancada e a tela de desenvolvimento o usam). O resultado é
discriminado — `origem: 'motor'` ou `origem: 'piso'` (com `causa`) — e só o primeiro pode ser
gravado.

`ia/fio.ts` não importa nada e é dono das sete classes de falha (`indisponivel`, `capacidade`,
`janela`, `guarda`, `recusa-do-modelo`, `saida-invalida`, `transitoria`), cada uma com destino
próprio (recuar na cadeia, repetir uma vez, ou cair no piso sem repetir), e do formato de `MotorId`
(`tipo:provedor/resto`, com `aparelho:sistema` e `nuvem:padrao` reservados).

Três regimes de número, um por recurso: **interpolado** (Saúde do sono — texto sem dígito, valor só
por marcador declarado); **copiado e conferido** (revista — números no texto, cada um verificado
contra o pacote); **molde** (nome de rota — campos por esquema, frase que sai do molde).

A ponte do aparelho (`mobile/modules/on-device-engine/`) é Swift puro, sem estado nem domínio, só
com pesos locais — nunca chama modelo de servidor; é o único ponto do app que nomeia Apple ou Core
AI. A preferência de motor é um mapa `RecursoId → MotorId` local a cada aparelho (nunca em
`user_preferences`).

A bancada (`scripts/bancada-motores`, quarto workspace pnpm) mede pedidos idênticos — mesmo hash —
no Mac e no iPhone, na mesma versão maior do sistema, autenticando como usuário (JWT), nunca com
chave de serviço; exporta dado de produção sob demanda para fora do git e versiona só o manifesto,
nunca o dado de saúde. Linha de base: iOS/macOS 27 — o app em produção continua compilando com
Xcode 26.6, porque o modelo vem do sistema.

A primeira medição (12/09/2026, 295 noites reais) aprovou a nuvem em 22 de 22 janelas, zero frase
idêntica ao template, mediana de 13,6 s/chamada; o dono fixou o limiar do portão sobre esse
relatório (ADR 0050): aprovação ≥ 90%, os sete casos presentes nos dois alcances medidos, nada
idêntico ao template, mediana ≤ 20 s. Até um motor de modelo atingir esse limiar para um recurso, a
cadeia padrão da Saúde do sono continua só `sem-modelo`; a nuvem entra por escolha explícita no
seletor.

## UX & Interaction Patterns

O botão "Ler" em `/sono/saude` dispara leitura efêmera só por ação explícita, nunca ao abrir a
tela; um segundo toque com o mesmo pedido se junta ao primeiro, e resposta de um pedido que já não
é o corrente é descartada. A tela sempre diz quem escreveu a frase e, quando o motor preferido não
escreveu, por quê — nunca mostra o texto cru do fornecedor, que é exclusivo da tela de
desenvolvimento. `/configuracoes/motores` lista, por recurso, os motores até o `regimeMaximo` dele,
com motor indisponível aparecendo com o motivo, sem nunca descartar a preferência gravada. Qualquer
mudança visual nessas telas exige mockup com dados reais aprovado pelo dono antes do código (regra
permanente do projeto, não específica deste épico).

## Cross-Story Dependencies

5.1–5.3 (F0) correm em paralelo com as stories 1.7–1.9 da revista, sem deploy nem tela; junto com o
marco A da 5.4 (bancada em modo medição sobre sem-modelo e nuvem), são pré-requisito bloqueante da
story 1.10, que passa a ser cliente do orquestrador. 5.5 (F2, a ponte + o botão) só entra depois da
1.9, em build próprio — nunca no mesmo build da migração, que é o de maior risco da sprint. Quatro
pontos seguem a regra "quem chegar primeiro cria": o workspace `scripts/` (5.4 × story 2.1), a
autenticação por JWT de usuário (5.4 × 2.2), `mobile/src/lib/motores/` com `invocar` e o anel (1.10
× 5.5), e `Engine.swift` (5.4 × 5.5). `criarMotorDeNuvem` nasce antecipado na 5.1 porque a 1.10
precisa dele antes do previsto; a function `ia-narrar` só aprende o contrato do fio na 5.6. O marco
B da 5.4 (a coluna do aparelho, que exige macOS 27) não bloqueia a revista. 5.6, 5.7 e 5.8 (F3–F5)
ficam para a próxima sprint.
