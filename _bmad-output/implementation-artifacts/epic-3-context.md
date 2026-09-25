# Epic 3 Context: As outras duas formas

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A revista tem três objetos, não três profundidades do mesmo objeto. O Épico 1 entregou o do meio — a edição de mês e trimestre. Este épico entrega os outros dois. A **semana** vira um **postal**: uma tela, acromática, que não grava nada e não custa nada, para que folhear seis semanas não dispare seis chamadas pagas. O **ano** vira um **anuário**: ele abre pelas quatro tiras de doze meses antes de qualquer texto, lendo a `metrica_lider` que a impressão vem carimbando desde a primeira edição, porque um ano não tem uma manchete — tem doze formas. Cobre `FR9` (as duas formas que faltavam) e a fatia do `FR6` que é o destaque de luz no trimestre. A terceira story é a única das 27 da sprint que **não está pronta para desenvolvimento**, e isso é declarado: metade dos critérios dela depende de uma passagem de UX adiada de propósito, e ela pode acabar morrendo.

## Stories

- Story 3.1: O postal da semana
- Story 3.2: O anuário do ano
- Story 3.3: O destaque de luz no trimestre

## Requirements & Constraints

- **Postal (semana):** uma tela, **sem sumário** — não há o que sumariar. Capa pequena, **três fatos**, e **só trajetória** como comparação: semana contra semana anterior é ruído, e a semana é rasa por declaração do contrato.
- **O postal não grava edição.** Calcula na hora, como a retro faz hoje; nada é escrito em `edicoes_ia`. A prosa só existe se o dono mandar escrever e **some ao sair** — ao reabrir, volta aos três fatos apurados. Não há terceiro estado de persistência: ou é gravado (edição, anuário) ou é efêmero (postal).
- **O postal é a única superfície acromática da revista.** Sem cadernos não há o que colorir, e a ausência de cor de módulo é o que diz *isto é um postal, não uma edição* antes de ele ler uma palavra. É consequência da regra, não padrão novo.
- **Anuário (ano):** abre **serial** — quatro tiras de doze meses, 34 px, uma por caderno, na cor do caderno, **antes de qualquer texto**. Os meses são rotulados uma vez só, sob a última tira. Depois da série vêm os cadernos, cada um com os **extremos datados**: o ano é o único período em que extremo vale data. O anuário **grava** edição.
- **O anuário não tem capa** — as quatro tiras são a capa do ano, e é isso que o distingue dos meses dentro da parede.
- **A tira lê o carimbo e nunca recalcula.** Recalcular faria o anuário de 2025 desenhar outras doze marcas quando o ranqueamento mudasse de peso, o que é reescrita silenciosa de período fechado, e faria a tira discordar da edição que ela anuncia. Mês sem carimbo (edição anterior à coluna) desenha **lacuna declarada**, nunca um valor recalculado que fingiria ser o de então.
- **A tira diz identidade, não grandeza** (estreitamento de 25/09/2026). O carimbo guarda **qual** métrica liderou, nunca **quanto** ela mediu, então a tira desenha **três estados por mês, sem nenhum número**: o caderno liderou com uma métrica; o caderno saiu e nenhuma métrica liderou (carimbo nulo — entrou pela lápide, ou nada passou no portão de amostra); o caderno não saiu. E marca **onde o líder trocou** de um mês para o seguinte — sem isso, doze meses com o mesmo líder e doze meses trocando a cada mês desenhariam a mesma barra. A promessa de magnitude fica em aberto e só reabre com coluna nova.
- **A tira é formato, não visualização:** sem toque, sem tooltip, sem scrub.
- **Trimestre:** o destaque de luz aparece **só** em `tipo_periodo = 'season'`, e `season` continua sendo trimestre civil — mover a fronteira quebraria edições de `season` já gravadas em produção. O destaque **não pede dado novo e não grava coluna nenhuma**, e o número que ele mostra é o mesmo que a prosa cita, com a mesma casa decimal.
- **Vale para tudo:** abrir só lê — a revista nunca gera sozinha, e imprimir é ato do usuário. Período em curso e `all` não têm rota de revista. Mobile-first.

## Technical Decisions

- **A forma sai do tipo, na mesma rota.** Postal, edição e anuário vivem em `/revista/[tipo]/[inicio]`; não há tela nova por forma. A parede de capas é irmã da rota, não filha.
- **Backfill em massa de semanas é não-objetivo declarado.** A semana não grava edição, e 172 chamadas para textos de sete dias não se pagam.
- **As horas de luz são derivadas na leitura e nunca gravadas**, a partir da coordenada de casa constante no núcleo — nunca a do aparelho, senão a mesma edição fechada renderia luz diferente conforme quem a imprime. Entram no pacote com **uma casa decimal**: é compensação medida (inteiro pequeno passa a conferência 16% das vezes; com uma casa decimal, 3,6%).
- **Cor sempre por `moduleOf()` e `resolveTokens()`**, inclusive na tira — nenhum hex em tela.
- **A ausência na tira se separa por forma, não por cor.** Medido: `tint` contra `line` fica abaixo de ΔE 10 nas 144 combinações de tema × esquema × paleta × caderno, e abaixo de 3 em 49 delas. Um tri-estado por cor seria um bi-estado com uma promessa a mais.

## UX & Interaction Patterns

- Nenhum gesto horizontal, nenhum compartilhar, nenhum hover ou tooltip em lugar nenhum da revista. A borda esquerda é do voltar do sistema.
- Informação obrigatória usa `ink2`, nunca `ink3`.
- Tipografia com papéis fixos: serifada é o que a máquina escreveu e passou pela conferência, mono é o que ela mediu, sans é o cromo. Número dentro de frase fica na serifada da frase.
- Botão de imprimir só aparece em período fechado e ainda não escrito.
- Referência visual das duas formas: `mockups/key-formas.html` da passagem de UX de 07/09 (o postal acromático sem rolagem; as quatro tiras empilhadas com os meses rotulados uma vez).
- A forma, a posição e o tratamento visual do destaque de luz **não existem** — é exatamente o que a passagem de UX da 3.3 tem que produzir, e não se escrevem sem inventar UX.

## Cross-Story Dependencies

- **3.2 depende do carimbo do Épico 1.** `metrica_lider` nasceu e passou a ser gravada desde a primeira impressão justamente para o anuário a ler mais tarde; sem ela a tira só teria lacuna. Depende também do arquivo impresso pela 2.3 — sem edições de doze meses, o ano não tem o que desenhar.
- **3.2 herda a 2.4b.** As tiras em miniatura do ano já nasceram na parede de capas, lendo o mesmo carimbo, com leitura em lote e recorte de acervo prontos. O anuário é a versão em tela cheia e tem que **concordar** com a miniatura — mesma leitura, mesmos três estados, mesma marca de troca de líder.
- **3.1 depende da rota e dos estados da 1.11** e da sequência de narração do Épico 1, com a diferença de que o postal a usa **sem gravar**.
- **3.3 depende da 1.6** (a luz já nos quatro pacotes) e está **bloqueada** pela passagem curta de `bmad-ux` — uma coisa só, sem reabrir capa, sumário ou paleta. A decisão que a desbloqueia ou a mata é do dono, depois de ler as edições-piloto: se a luz na prosa já bastar, a story some e o `FR6` fica coberto só pelo Épico 1.
