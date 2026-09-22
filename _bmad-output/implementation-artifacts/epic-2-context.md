# Epic 2 Context: O arquivo

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

As edições de todos os períodos fechados desde 22/05/2023 (mês, trimestre e ano) passam a existir. Quem as imprime em massa é um hospedeiro que não é o app, o workspace `scripts/`, e o resultado tem que ser idêntico ao do iPhone. Com elas impressas, o dono folheia até 2023 numa parede de capas e vê pela textura (foto → traçado) quando começou a fotografar. O épico também lhe dá o único jeito de discordar da revista depois de lê-la: silenciar um caderno. Imprimir e folhear ficam num épico só de propósito, porque a entrega tem que ser algo que ele vê, não "linhas no banco". Dois defeitos achados no piloto (1.15) fecham antes da impressão em massa: a ausência de registro não pode virar zero, e a métrica que parou de chegar tem que virar lápide.

## Stories

- Story 2.1: O quarto workspace, e a barreira que o enxerga
- Story 2.2: O script imprime uma edição, e ela é idêntica à do telefone
- Story 2.3: A impressão em massa dos períodos fechados
- Story 2.4: A parede de capas
- Story 2.5: Silenciar um caderno
- Story 2.6: O que ainda não era registrado não vira zero
- Story 2.7: O detector de métrica morta

## Requirements & Constraints

- **Escopo da massa:** mês, trimestre e ano desde 22/05/2023. São 53 períodos, menos os já impressos no piloto (ago/2026, jul/2026, set/2023 e out/2023). Semana não grava edição: o postal calcula na hora. `all` e período em curso nunca têm edição.
- **Mesmo resultado nos dois hospedeiros:** o mesmo pacote dá o mesmo texto verificado no script e no telefone, e isso é teste obrigatório. A assinatura também é idêntica: provedor, modelo, `prompt_versao`, `PACOTE_VERSAO` e `agg_version_no_momento`.
- **Verifica antes de gravar, sempre.** Texto reprovado no script não chega ao banco.
- **Paginação:** toda leitura de intervalo que cresce com o tempo passa por `fetchAllPages`, com `range` e ordenação total. O PostgREST corta em 1000 linhas sem erro, e `health_daily` já passa de 4 mil.
- **Posições contíguas de 1 a N** sobre os cadernos que a edição tem. Caderno vazio não reserva posição, e caderno reprovado não tem linha. A maioria dos meses antigos tem um caderno só (22 de 39).
- **Capa:** toda edição de 2026 nasce com a capa carimbada. Carimbar depois não recupera nada.
- **Ausência tem gramática:** métrica que começou a ser registrada depois do fim do período entra como "não medida", nunca como zero. O marco sai do dado (criação do hábito ou do registro, primeiro dia da métrica de saúde), nunca de uma data escrita no código. Zero continua sendo medida quando o registro já existia. Caderno com tudo "não medido" é vazio e some.
- **Lápide:** o detector preenche `entrada.lapides` na tela e na impressão, pelas mesmas portas. Métrica que parou numa fonte e voltou por outra não é morta (caso real: a VFC, do Apple Watch para o intervals.icu).
- **Silenciar:** caderno silenciado não aparece nem quando o ranqueamento o poria em primeiro. Silenciar caderno e esconder bloco são atos independentes.
- **Abrir só lê:** a parede desenha só as capas que existem e nunca imprime para preencher buraco.
- **Decisões do dono antes do código:**
  - 2.6: reimprimir set/out 2023 na 2.3 ou mantê-las como estão.
  - 2.7: o limiar de silêncio; a latência (a edição impressa no fechamento não vê uma morte dos últimos dias); por quanto tempo uma morte antiga continua sendo repassada.
- **Veredito do dono no fechamento da 2.7:** ele julga a lápide em tela e o passo 5 do ranqueamento.

## Technical Decisions

- **Hospedeiro:** `scripts/` é workspace declarado, com `@supabase/supabase-js` e `tsx` nas próprias dependências. Entra no portão de CI e na varredura da barreira "nenhum `.from()` fora do núcleo". Constrói o próprio `SupabaseClient` ali (nunca em `packages/shared/src`) e chama `shared/src/data/` como os apps.
- **Autenticação:** sessão de usuário pelo auth normal. O JWT dela serve para a `ia-narrar` e para as tabelas. Chave de serviço é proibida, porque desligaria a RLS. A credencial vem do ambiente de quem roda e não é versionada. É a mesma sessão da bancada.
- **Sequência:** imprime `ia/imprimir.ts`, do núcleo, cliente do orquestrador (uma chamada por caderno). O script só injeta `invocar` em `criarMotorDeNuvem(invocar)` e liga `buscar`/`gravar` ao client dele. Não escreve cliente da `ia-narrar`, não lê corpo de erro e não traduz classe. Uma barreira garante que só a sequência importa `upsertEdicao`. Piso por causa passageira (`indisponivel`, `capacidade`, `transitoria`, `janela`) nunca grava nada.
- **Gravação:** passa pela função única do banco (`edicao_imprimir`, serializada por advisory lock). Numa chamada, ela grava só o texto dos cadernos regenerados, ajusta `posicao` e apaga o caderno que saiu. Por isso não há lost update entre o iPhone e o script. O `unique` de posição é deferido. `AGG_VERSION` vem do núcleo e é sempre gravada; `metrica_lider` vai carimbada (nulo = nenhuma métrica liderou).
- **Capa:** `edicoes_capa`, uma linha por edição. Carimbada na primeira impressão e na reimpressão inteira, nunca na parcial. Guarda valores resolvidos, não ponteiros: natureza (`foto`/`tracado`/`grade`), identidade (`activity_photos.id` + `taken_at`, ou a rota), legenda formatada e `motivo`. A manchete deriva do caderno em `posicao = 1` e não congela com a imagem.
- **Silenciar:** `RetroPrefs.cadernosOcultos` no jsonb `user_preferences.retro_prefs` (sem CHECK de forma, logo sem migration). `resolveRetroPrefs` ganha só um ramo defensivo. `RetroBlockId` não é alargado; `CadernoId` tem dono único no núcleo. O valor guardado é a data.
- **Detector de métrica morta:** na camada de dados ou na sequência da impressão, nunca no núcleo puro, que já recebe, ranqueia, narra e desenha a lápide.
- **Ano na parede:** as tiras em miniatura leem a `metrica_lider` carimbada, nunca recalculam; mês sem carimbo é lacuna declarada.

## UX & Interaction Patterns

- **Parede:** duas colunas, ~6 capas por tela, da mais recente para trás. O rótulo (período + manchete curta) fica abaixo da capa, em `ink2` (nunca `ink3`). Leva `rounded.md` e sombra suave, e é o único lugar da revista com sombra. A capa inteira é o alvo de toque (mínimo 44 px) e abre a edição.
- **Naturezas:** `foto` mostra a imagem; `tracado` desenha a rota do período em SVG sobre fundo liso; `grade` mostra a grade diária. A fronteira foto → traçado em 2025 tem que ser legível sem legenda. O ano aparece como quatro tiras em miniatura, não como capa.
- **Imagem que não carrega:** precedente do `useAssetUri` — `'loading'` e `null` são estados distintos. Capa cuja imagem sumiu ainda diz o que era, pela legenda carimbada.
- **Proibido na revista:** compartilhar, carrossel, gesto horizontal e hover. A borda esquerda é do voltar do sistema.
- **Navegação:** abre-se por uma ação na revista e volta para ela; a parede é irmã da rota `/revista/[tipo]/[inicio]`, não filha.
- **Diagramação da Retrospectiva:** perde as duas setas de cada linha e fica só o olho. A legenda muda, porque a regra dos 60 dias deixou de existir.
- **Lápide:** dois estados visuais, nunca um terceiro. No mês da morte, vai no topo com um degrau de corpo; nos demais, no pé, em corpo normal.

## Cross-Story Dependencies

- **Ordem da sprint:** 2.1 → 2.2 → 2.6 → 2.7 → 2.3 → 2.4 → 2.5. A 2.6 e a 2.7 vêm antes da 2.3; sem elas, a massa espalha zeros falsos por 2023–2025 e sai sem lápide.
- **2.1 só confere:** a bancada (5.4) chegou primeiro e já criou `scripts/` como quarto workspace. Resta conferir que o backfill entra sem dependência não declarada e que as barreiras o enxergam.
- **2.2** depende da 1.10 (sequência no núcleo, portas `buscar`/`gravar`) e do fio da nuvem dos motores (`criarMotorDeNuvem`, o contrato da `ia-narrar` em `ia/fio.ts`).
- **2.3** depende da 1.9 (forma por caderno e função única de impressão), da 1.13/1.16 (carimbo da capa com `motivo`) e do `AGG_VERSION` no núcleo.
- **2.4** depende da 2.3, porque sem edições a parede fica vazia. As tiras em miniatura do ano vêm antes do anuário do Épico 3 (3.2), que lê o mesmo carimbo.
- **2.7** fecha o veredito da lápide que a 1.12 deixou em aberto.
