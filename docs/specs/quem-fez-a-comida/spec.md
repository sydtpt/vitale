---
id: SPEC-quem-fez-a-comida
companions:
  - data-model.md
  - stories.yaml
sources:
  - "Mesa de desenho de 28/09/2026 (party mode), seis rodadas"
  - "Canvas de UX: https://claude.ai/artifact/Y5EpxQTPMkYtKxtFqEJK95 — cinco quadros, A e B tocáveis"
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar. As decisões abaixo foram tomadas pelo dono item por item em 28/09/2026; onde este documento e a memória da sessão divergirem, este documento vale.

# Quem fez a comida — a origem de cada almoço e jantar, e quanto custou não cozinhar

## Why

Ele parou de cozinhar e não sabe o tamanho disso. A pergunta que ele trouxe foi *"almocei em casa ou fora?"* e ela **não responde o que ele quer saber**: comprar comida pronta e comer em casa é *em casa* geograficamente e é *fora* economicamente — €10 que o fogão não tocou. Levar marmita para a cantina é o contrário: comeu fora e cozinhou. O eixo "casa × fora" classifica os dois errado, e os dois são casos reais dele, com escritório híbrido de dois a três dias.

O eixo que responde é **quem fez a comida**. Nele a marmita é `cozinhei` sem discussão e a comida pronta é gasto sem discussão.

Duas coisas tornam isso urgente agora e nenhuma delas é a comida:

1. **A Hoje já cobra e não dá botão.** O cabeçalho escreve todo dia *"Dia 4 de 7 · 3 refeições a registrar"* (`MEAL_TARGET = 4` em `mobile/src/app/(tabs)/index.tsx:210`), e **não existe cartão de refeição na tela**. A única porta é o FAB → Refeição → digitar nome e kcal, que ele não faz. A dívida existe sem o pagamento.
2. **Finanças está morta.** Ele não usa a feature — declarou em 28/09 que *"não está bem desenhada"* — e por isso **não existe linha de base retroativa**: nem `transactions` nem `shop_items` têm histórico utilizável. A medição começa no dia em que o primeiro toque acontecer, como na Presença. Em compensação, isto passa a ser a **primeira ponte real entre um módulo e Finanças** neste projeto — a mesma ponte que o CLAUDE.md lista em aberto para Tarefas há semanas — e o formato dela é o molde da próxima.

## Capabilities

- **CAP-1** — O cartão na Hoje pergunta quem fez, não o que foi comido
  - **intent:** Cada vão do dia (almoço, jantar) aparece na Hoje como um cartão que pergunta a origem da comida, e responder não exige nome de prato, kcal nem teclado.
  - **success:** No iPhone, na Hoje, os dois cartões estão visíveis sem rolar até o fim. Um toque grava a origem e o cartão colapsa numa linha. Nenhum campo de texto é atravessado no caminho. Registrar uma refeição por `QuickAddSheet` continua funcionando e é **independente** — nenhuma das duas exige a outra.

- **CAP-2** — Seis estados, tudo à vista, sempre um toque
  - **intent:** As seis origens possíveis estão todas visíveis no cartão; nenhuma fica atrás de um segundo andar ou de um gesto escondido.
  - **success:** `cozinhei` · `pronta` · `restaurante` · `refeitório` · `snack` · `pulei`, seis alvos de 48 px ou mais em duas fileiras de três. Qualquer resposta custa **exatamente um toque** para gravar. Não existe estado genérico do tipo "comprei, não disse onde": todo toque aterra numa origem específica — o que reduz o `CHECK` de sete valores para seis. Decisão do dono contra a proposta de três chips com segundo andar, medida nos dois protótipos tocáveis do canvas.

- **CAP-3** — O relógio ordena, não tranca
  - **intent:** Ele responde na hora que quiser, não na hora da refeição.
  - **success:** Os dois vãos estão disponíveis o dia inteiro. Às 11h ele pode responder o jantar; às 23h pode responder o almoço. `defaultMealType()` (`QuickAddSheet.tsx:42-48`) pode ordenar ou destacar o vão da hora, mas **nunca bloqueia** o outro nem expira o vão vencido dentro do dia.

- **CAP-4** — A folha do valor não é dona da resposta
  - **intent:** O valor é um segundo fato, opcional, que nunca pode levar a resposta embora.
  - **success:** Tocar um chip pago **grava a origem imediatamente** e então sobe uma folha de baixo pedindo o valor. Fechar a folha por gesto, por scrim ou por "sem valor" deixa a origem gravada e o valor em branco. **Não existe caminho em que fechar a folha desfaça a resposta.** Verificado no aparelho, inclusive fechando a folha por arraste.

- **CAP-5** — Só quem gasta pede valor
  - **intent:** A fricção do teclado cai apenas sobre os estados que custam dinheiro.
  - **success:** `cozinhei` e `pulei` **nunca** abrem folha nenhuma — um toque e acabou. `pronta`, `restaurante`, `refeitório` e `snack` abrem. O banco recusa valor nos dois primeiros por `CHECK`, não por convenção de tela. Consequência desenhada e não acidental: o comportamento que ele quer aumentar custa um toque; o que ele quer diminuir custa um toque mais um teclado.

- **CAP-6** — Valor ausente não vira zero nem vira chute nosso
  - **intent:** Quando o valor não é lançado, a leitura diz o que sabe e nomeia o que estimou.
  - **success:** A leitura mostra **três números separados**: lançado por ele, estimado, e o total. A estimativa é a **mediana dos valores que ele mesmo lançou naquela origem** — nunca um preço configurado, nunca um padrão nosso. Sem histórico daquela origem, **a estimativa não existe**: a linha diz "N sem valor" e o total para no que foi lançado. Mesmo princípio dos limiares da Saúde do sono (ADR 0036), que saem da distribuição recente do usuário. O dono recusou explicitamente seis preços médios configuráveis: *"precisa ser lançado na hora pois varia sempre"*.

- **CAP-7** — A ponte com Finanças tem um escritor só
  - **intent:** O valor lançado aparece no extrato de Finanças sem que o mesmo euro possa divergir entre duas tabelas.
  - **success:** O valor gera uma linha em `transactions`, categoria `Alimentação`, `tx_date` = **o dia da refeição** (nunca o dia do toque), descrição derivada (`Jantar · restaurante`). A refeição é a **dona**: a linha é criada, atualizada e apagada pelo mesmo gesto que mexe na refeição. Em Finanças a linha aparece no extrato, mas o valor não é editável ali — tocar leva de volta à refeição. Três regras confirmadas pelo dono: trocar o chip **apaga** a transação · apagar a linha em Finanças **limpa o valor** da refeição · `tx_date` é sempre o dia da refeição.

- **CAP-8** — Responder depois, e responder o ano
  - **intent:** Existe uma segunda porta onde ele preenche o que ficou em branco, de qualquer dia.
  - **success:** Uma tela só, com chips de período (semana · mês · estação · ano), no vocabulário que Registros e Retrospectiva já usam. No período curto, uma **grade** de dias × dois vãos, toda tocável. No ano, um **heatmap** clicável que abre o dia. Preencher a quinta-feira num domingo grava com a data da quinta em tudo, inclusive na transação.

- **CAP-9** — O cabeçalho da Hoje diz três números e nenhum adjetivo
  - **intent:** A linha de cobrança do cabeçalho é substituída por uma que descreve o que aconteceu.
  - **success:** No lugar de *"3 refeições a registrar"*, a linha lê `cozinhou 9 · comprou 4 · pulou 1`, com os três números em Geist Mono. A linha antiga e a constante `MEAL_TARGET` saem no mesmo commit — **não pode haver duas coisas no mesmo cabeçalho falando de comida**. Escolha do dono entre quatro redações; a expressão "o fogão acendeu" foi **vetada** por ele e não aparece em nenhuma superfície diária.

- **CAP-10** — As métricas ao longo do tempo
  - **intent:** As leituras que respondem "quanto eu cozinhei e quanto me custou não cozinhar", por período.
  - **success:** Por período: **refeições cozinhadas por você** (contagem e percentual sobre as respondidas), **€ não cozinhado** (lançado + estimado, separados), **dias seguidos sem cozinhar**, **almoço × jantar** (qual vaza), **por dia da semana**, e o **heatmap anual**. Todas derivam de funções puras no shared, testadas sem rede. O molde de tela é `/habitos/detalhe`, que já tem períodos, barras por valor, dia da semana e heatmap com intensidade.

- **CAP-11** — A web responde também, pela mesma porta
  - **intent:** `/alimentacao` deixa de ser placeholder e passa a ler **e** escrever.
  - **success:** A página hoje é um `rt-panel` com a frase *"Donut de kcal, barras de macros e lista de refeições."* e uma classe vazia. Passa a mostrar as leituras do CAP-10 e a permitir responder dias. A escrita vai pela **mesma função do banco** que o celular chama — nunca uma segunda implementação da regra, pelo precedente do `edicao_imprimir` (AD-4 da Revista). Na web o cartão de seis chips **não se repete**: a forma é uma linha por dia numa grade, porque seis alvos de 54 px numa tela de 1400 px são enfeite.

- **CAP-12** — Ausência é ausência em toda leitura
  - **intent:** Um vão sem resposta nunca é contado como nada nem como algo.
  - **success:** Vão sem linha não entra em nenhum denominador: o percentual de cozinhadas é sobre **respondidas**, não sobre vãos possíveis. Na grade, a célula sem resposta é tracejada e distinta das quatro origens por **claridade**, não só por matiz. Na contagem aparece como número próprio ("1 dia sem resposta"). Pular o almoço (`pulei`) e não ter respondido o almoço são **duas linhas diferentes** e nenhuma tela as mistura.

## Constraints

- **Uma porta no banco.** A escrita passa por função SQL, chamada igual pelos dois apps. Regra implementada duas vezes é regra que divergiu — precedente `edicao_imprimir` (AD-4) e `habit_log_add`.
- **Leituras puras no shared.** Nada em `packages/shared/src/refeicoes/` abre rede. Testadas contra dados sintéticos, sem Supabase.
- **Cor de módulo por papel.** Este é o módulo `food` (papel `yellow`). A cor sai de `moduleOf()` — nunca hex autorado, nunca `--primary`, que é cromo de marca e não cor de dado (ADR 0018).
- **Barreiras do `architecture.test.ts`.** Nenhum `StyleSheet` de escopo de módulo lê tema; nenhuma variável CSS da web fora do sistema; todo `CHECK` de id cobre os ids que o app grava — aqui, os seis de `origin` e os dois de `slot`.
- **Moeda por `format/money.ts`.** O símbolo € sai de lá. A migration de `transactions` comenta `-- em reais`: o comentário está velho desde 07/09 e deve ser corrigido no mesmo passo, sem tocar no tipo.
- **`transactions.amount` tem `check (amount > 0)`.** Isso encaixa com CAP-6 por construção: **sem valor = sem linha**. Não existe transação de €0 e não se deve criar uma.
- **Teto de 1000 linhas do PostgREST.** São 2 linhas por dia — 730 por ano. Um ano cabe; dois não. Toda leitura de faixa longa usa `range` + `order` explícitos, sem confiar no padrão.
- **Rota nova no mobile exige regenerar `.expo/types/router.d.ts`**, senão o `tsc` reprova o `router.push`. Subir `expo start` por ~10 s gera.
- **Convenções dos apps.** Web: standalone, OnPush, `signal()`/`computed()`, `inject()`. Mobile: funcional com hooks, `StyleSheet.create()` com tokens, Zustand, `Animated` — **nunca Reanimated** (ADR 0010).
- **Validação nos quatro workspaces**, como o CI: `shared lint`, `shared test`, `web build`, `web test`, `scripts lint`, `scripts test`, `cd mobile && tsc --noEmit && jest`, `expo-doctor`.
- **A migration é aplicada pelo dono, numa janela.** Build nunca compartilha entrega com migração — a seção 6 de `_bmad-output/implementation-artifacts/revista-1-9/janela-da-migracao.md` é leitura obrigatória antes.

## Non-goals

- **Café da manhã e lanche como vãos.** Vetado pelo dono em 28/09: são dois vãos, almoço e jantar. `snack` existe como **origem** (ele pulou e comeu algo), nunca como vão.
- **Detecção automática de lugar.** A Presença está na Fase 0 e a pergunta central dela segue sem dado — o iOS relança o app fechado para entregar um evento de região? Sem essa resposta, nada aqui é inferido por geofence. Carimbar `place_id` em refeição é a Fase 2 da Presença e continua lá.
- **Vincular à linha de `meals`.** As duas tabelas casam por `(data, vão)` se as duas existirem, mas esta feature **não exige nem cria** linha em `meals`, e o `QuickAddSheet` não muda.
- **Bloco na Retrospectiva ou na Revista.** As métricas do CAP-10 vivem na tela própria e na web. O jornal vem depois — e é o único lugar onde a expressão vetada pode voltar, porque lá o floreio é o produto.
- **Preço com vigência no tempo.** Não existe tabela de preços. O valor é por refeição.
- **Linha de base retroativa.** Não existe e não se deve fabricar uma a partir de `transactions` ou `shop_items`.
- **Editar o valor direto em Finanças.** Por CAP-7, ali a linha se lê; o valor se edita na refeição.

## Success signal

Duas semanas depois de instalado: os dois vãos respondidos na maioria dos dias **sem que a contagem de respostas caia** ao longo das semanas — é isso que distingue esta feature das capturas manuais que morreram. E a metade do euro mostrando um número que ele reconhece como o seu, com a parte estimada nomeada como estimada.

## Assumptions

- Dois vãos por dia bastam: no máximo dois toques, mais o teclado nos dias em que ele pagou.
- Ele digita o valor **no momento em que está pagando**, com a notificação do cartão à vista — é o único instante em que digitar um número é cópia e não esforço de memória.
- A mediana por origem fica útil depois de poucos lançamentos por origem; antes disso a leitura assume que não sabe.

## Open Questions

- **O `snack` merece folha de valor?** O dono confirmou que sim, porque custa. Mas €3 atrás de uma folha pode irritar na prática mais do que informa. Medir no uso, não decidir agora.
- **A grade editável da web não foi desenhada.** CAP-11 fixa a forma (linha por dia, não cartão) e o caminho de escrita (a mesma função), mas o desenho da célula, do estado de foco e de onde o valor é digitado na web está em aberto. Pela regra da casa, mockup com dado real antes do código.
- **O rótulo do vão** é texto fixo ("Almoço"/"Jantar") ou vem de `MEAL_TYPE_LABELS`, que já existe para os cinco `MealType`? A segunda opção amarra dois vocabulários que hoje são independentes.
- **Desfazer a resposta.** O botão "trocar" do protótipo reabre os chips; falta decidir se ele apaga a linha (volta a "sem resposta") ou só permite substituir a origem. As duas se comportam diferente no CAP-12.
