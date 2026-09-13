---
title: 'Story 1.9 — A migração e a leitura da forma nova'
type: 'feature'
created: '2026-09-12'
status: 'done'
review_loop_iteration: 3
baseline_commit: '9f4f18d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/supabase/ensaio/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A edição é uma linha por período, então marcar errata no caderno de Sono toca a linha do de Movimento. A chave precisa ganhar `caderno`, a ordem precisa virar coluna (`posicao`) e a métrica que deu a posição precisa ficar carimbada (`metrica_lider`) desde a primeira impressão. É a **única migração do Épico 1**, em instância única, sem staging — e o raio é o dobro do que parece: `fetchEdicao` termina em `.maybeSingle()` e `upsertEdicao` casa `onConflict` pela chave velha, então um build antigo quebra **ao abrir e ao gravar**.

**Approach:** Uma migração que tira as 7 edições antes de as colunas novas nascerem obrigatórias, refaz a chave, cria `edicoes_capa` e a função que recalcula a ordem numa chamada só; e o JS que lê a forma nova — `fetchEdicao` e `upsertEdicao` reescritos juntos, a ordem vinda de `posicao`, e a barreira que proíbe a tela de importar `ordenarCadernos`. Entre esta story e a 1.10, o celular **não escreve** edição: a sequência da impressão é da 1.10.

## Boundaries & Constraints

**Always:**
- **Entrega única (AD-15):** migração e JS novo na mesma sessão, nessa ordem — build compilado **antes**, ou `eas update` publicado **depois** da migração, sabendo que o update só vale no segundo lançamento do app.
- **Ordem interna:** as 7 edições saem **antes** de `caderno`, `posicao` e `metrica_lider` nascerem `not null`. O texto delas já está em `primeiras-edicoes-prompt-v2.md`.
- PK `(user_id, tipo_periodo, inicio, fim, caderno)`; `caderno` com CHECK dos quatro ids do catálogo; `unique (user_id, tipo_periodo, inicio, fim, posicao)` **`deferrable initially deferred`**; `agg_version_no_momento` passa a `not null`.
- `posicao` é contígua de **1 a N sobre os cadernos que a edição tem** — não sobre quatro. Caderno vazio não reserva posição.
- `metrica_lider` **aceita nulo**, e nulo quer dizer "nenhuma métrica liderou": caderno que entrou pela lápide, ou onde nada passou no portão. O que se grava é a **chave** da métrica do passo 1 — valor, nunca ponteiro a recalcular.
- A reimpressão parcial passa por **uma função no banco**, numa chamada: grava texto só dos regenerados, ajusta `posicao` de todos e **apaga** a linha do caderno que saiu. Nenhuma linha órfã, nenhuma posição reservada sem texto.
- `edicoes_capa` nasce com chave de **edição**, RLS pelo dono, natureza de três valores (`foto`/`tracado`/`grade`) e a legenda como **valor resolvido**. Ninguém escreve nela aqui.
- A leitura tira a ordem de `posicao` e **nunca** chama `ordenarCadernos`. A barreira em `architecture.test.ts` recusa `ia/ranqueamento` em `mobile/src` e `web/src`, inclusive por caminho profundo, e prova que o conjunto varrido não é vazio.
- O CHECK de `motivo_de_parada` continua igual a `CONCLUSAO` (`'STOP'`) e legível pelo leitor de migration da guarda (6) da 5.1.
- Nada vai a produção sem o ensaio antes (`supabase/ensaio/`): candidata ensaiada na base, rollback limpo provado, nenhuma instrução não transacional.

**Ask First:**
- Aplicar em produção — é escrita, e é a janela da AD-15.
- Mudar o CHECK de `motivo_de_parada`, a natureza da capa, ou o caminho de entrega do JS.
- Qualquer coisa que faça o celular voltar a escrever edição antes da 1.10.

**Never:**
- Uma segunda migração no Épico 1 — coluna que aparecer entra nesta.
- `ordenarCadernos` no caminho de leitura, ou importado por tela.
- `.maybeSingle()` ou `.single()` sobre a chave nova.
- Escrever em `edicoes_capa` (é a 1.13) ou subir a sequência da impressão (é a 1.10).

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| A migração no ensaio | banco na base carimbada, com as 7 edições | as 7 saem, a chave nova existe, `edicoes_capa` nasce, o retrato mostra o que mudou | nada fica pela metade |
| Falha no meio | a mesma candidata com `--falhar-no-fim` | erro, e o retrato idêntico ao antes | — |
| Ordem interna errada | colunas `not null` antes de as 7 saírem | — | a migração falha; é o erro que a ordem existe para evitar |
| Ler uma edição | quatro linhas do mesmo período | os cadernos na ordem de `posicao` | nenhum `maybeSingle` recebe mais de uma linha |
| Ler edição parcial | duas linhas, posições 1 e 2 | os dois cadernos, na ordem | N/A |
| Ler sem edição | período sem linha | vazio, como hoje | N/A |
| Reimpressão parcial | três regenerados, um que saiu | texto só dos três, posições 1..3, a linha que saiu **apagada** | a permutação não colide — `unique` deferida |
| `metrica_lider` nulo | caderno que entrou só pela lápide | grava nulo, e a leitura o trata como ausência declarada | N/A |
| Barreira | `import` de `ia/ranqueamento` em `mobile/src` ou `web/src` | reprova | conjunto varrido vazio → reprova também |
| Build antigo × forma nova | JS velho depois da migração | quebra ao abrir **e** ao gravar | é a janela que a AD-15 fecha, não um caso a tratar em código |

</frozen-after-approval>

## Code Map

> Faixas atualizadas na rodada 1. As do estado **anterior** à entrega ficam
> citadas em itálico, porque é delas que a Intent fala.

- `packages/shared/src/data/edicoes-ia.ts:146-163` `fetchEdicao` -- devolve a lista ordenada por `posicao`, sem `maybeSingle` (*era `:67-84`, com quatro `.eq` e `.maybeSingle()`*)
- `packages/shared/src/data/edicoes-ia.ts:214-243` `upsertEdicao` -- `onConflict` da chave nova, com `caderno`, `posicao` e `metrica_lider` no payload (*era `:123-150`, com a chave velha*)
- `packages/shared/src/data/edicoes-ia.ts:36-41` `TIPOS_COM_EDICAO`/`temEdicao`; `:44-67` `EdicaoRow` (17 colunas); `:70-102` `CadernoImpresso` e `Edicao`; `:112-116` `EDICAO_COLUMNS`; `:118-134` `toCadernoImpresso`; `:165-192` `EdicaoInput`; `:265-267` `precisaErrata` (**segue sem chamador em produção** — a prop `errata` do cartão saiu na rodada 1)
- `packages/shared/src/data/edicoes-capa.ts:34-47` a natureza e a guarda; `:85-89` `CAPA_COLUMNS`; `:99-120` `toCapa` (confere a natureza, não faz cast); `:126-143` `fetchCapa` — `maybeSingle` aqui é correto: a chave é a edição inteira
- `mobile/src/lib/edicao-ia.ts:27-40` `LeituraDaEdicao` (`ausente` | `ok`); `:54-62` `buscarEdicao` -- ausência resolvida **antes** da consulta; a chave sai de `resumo.{kind,startISO,endISO}` (*era `:67-72` + `gerarEdicao` em `:85-117`, com `montarPacotes(entrada)[0]`*)
- `mobile/src/store/edicao.store.ts:26-49` as **seis** fases (`sem-sessao` entrou na rodada 2); `:67-70` `chaveDe(uid, entrada)` -- o uid **na chave**, não ao lado dela; `:83-88` `estadoDe`, a derivação que a tela e a store dividem; `:145-163` a regra de cache — `pronta`, `erro` e a leitura em voo dispensam repetição (*era `:22,36-40,61,85`, com `edicao` no singular; e na rodada 1 `erro` relia a cada foco*)
- `mobile/src/app/retrospectiva/index.tsx:286-304,399` -- a tela lê `porPeriodo` e o uid por seletores estáveis e deriva **fora** deles, com `chaveDe`/`estadoDe` (*era a chave montada à mão e `porPeriodo[chave] ?? {fase:'carregando'}` inline, sem teste*)
- `mobile/src/components/EdicaoCard.tsx:40-43` `Props` com o `EstadoEdicao` **importado da store** (era união gêmea, mantida à mão); `:53-55` `faseNaoTratada`, o ramo `never`; `:69-135` o `switch` exaustivo, com `nao-escrita` e `sem-sessao` em ramo próprio (*era cadeia de `if` com `nao-escrita` caindo no `return` final*)
- `supabase/migrations/20260906150000_edicoes_ia.sql` -- a tabela antes: PK `:47`, CHECK de `tipo_periodo` `:22`, CHECK de `motivo_de_parada` `:36`, RLS e policy `:54-57`, índice `:61-62`. É o molde que `edicoes_capa` herdou
- `supabase/migrations/20260912120000_edicao_por_caderno.sql` -- a migração desta story: a guarda das sete `:22-41`, as colunas novas `:43-73`, a chave e a `unique` deferida `:82-98`, `edicoes_capa` `:107-176`, `edicao_imprimir` `:186-330`, o `revoke` `:336-345`
- `packages/shared/src/architecture.test.ts:134-145` -- nenhum `.from()` fora de `data/`; `:378-388` `idsAceitosPeloCheck(tabela, coluna)` -- lê o CHECK **por tabela**, com âncora no `create table`/`alter table` (rodada 2); `:402-436` `colunasDaTabela`; `:475-513` as listas de id da edição e a barreira delas, com **duas** linhas de `tipo_periodo`; `:528-543` `TIPOS_COM_EDICAO` = `PeriodKind` − `'all'`; `:564-593` as colunas pedidas ao PostgREST contra as do banco; `:1340-1385` a barreira do `ia/ranqueamento`, com os nomes **lidos do módulo**; `:1412` a catraca do `'STOP'`
- `packages/shared/src/ia/ranqueamento.ts:148-166,207-230` -- `liderDoCaderno` e `ordenarCadernos`, com a pergunta do `metrica_lider` nulo escrita em `:143-147`; o arquivo **não** sai pelo `index.ts`
- `docs/specs/revista-retrospectiva/mudancas-mecanicas.md:10-15` -- o DDL já escrito da chave e do `unique` (**sem** o `deferrable`, que a AD-4 exige); `:69-82` -- o que são as 7 edições
- `supabase/ensaio/README.md` -- como ensaiar a candidata antes de produção; `supabase/ensaio/cenarios/edicao-imprimir.sql` -- o cenário da função, concatenado à migração e aplicado como uma candidata só

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260912120000_edicao_por_caderno.sql` -- as 7 saem primeiro (e a guarda reprova se não forem 7); PK nova com `caderno` e CHECK; `posicao` e `metrica_lider` (esta **nullable**); `unique` deferida; `agg_version_no_momento` `not null`; `edicoes_capa`; `edicao_imprimir`, com `revoke` de `public`/`anon`
- [x] `packages/shared/src/data/edicoes-ia.ts` -- `fetchEdicao` devolve as linhas do período **ordenadas por `posicao`**, sem `maybeSingle`; `upsertEdicao` fala por caderno com `onConflict` da chave nova; tipos e `COLUMNS` com as três colunas novas
- [x] `packages/shared/src/data/edicoes-capa.ts` -- o tipo e o leitor da capa, sem escritor (a 1.13 escreve)
- [x] `mobile/src/lib/edicao-ia.ts` + `store/edicao.store.ts` + `components/EdicaoCard.tsx` -- a leitura recebe a lista e mostra os cadernos na ordem gravada; a **escrita fica desligada** até a 1.10, com aviso honesto no lugar do botão
- [x] `packages/shared/src/architecture.test.ts` -- a barreira do `ia/ranqueamento`, com asserção de não-vacuidade; mais a barreira das listas de id (`caderno`, `natureza`, `tipo_periodo`) contra o banco
- [x] testes -- `fetchEdicao`/`upsertEdicao` sobre a chave nova (R-03/R-04), incluindo o caso de várias linhas; `COLUMNS` conferida; `edicoes-capa` coberto; o caminho de leitura do celular e a store; a equivalência da chave em `ia/pacote.test.ts`
- [x] `supabase/ensaio/` -- ensaiada a candidata (aplicação e `--falhar-no-fim`), e o cenário de `edicao_imprimir` em `cenarios/`; logs em `_bmad-output/implementation-artifacts/revista-1-9/`
- [x] **rodada 3 (última)** -- validação de tipo e caderno na entrada da função; o isolamento ancorado no desfecho e a capa com linha para a RLS falar; o cenário por dono e período próprio, com 11 casos de guarda novos; `cenarios/concorrencia.sh`, que é quem observa a trava; as colunas lidas do `information_schema`; o aviso que parou de disparar sempre; o cast e o `tipoPeriodo` apertados; a sessão que chega tarde, a hidratação e o `render` que não derruba a tela; as barreiras que liam migration pela metade (ver Spec Change Log)
- [x] **rodada 2** -- a trava e a `unique` cobrada no ponto de chamada; as barreiras lendo por tabela e cobrando as `COLUMNS` contra o banco; a store chaveada por dono, com `erro` que não relê sozinho e `estadoDe` dividida com a tela; o `switch` exaustivo do cartão; o ensaio que sobrevive ao dia da entrega e o cenário com isolamento entre donos (ver Spec Change Log)
- [ ] **1.10, e não aqui:** a sequência lê `AGG_VERSION` do núcleo antes de montar a chamada, e `verificarTexto` roda antes dela (ver Design Notes)

**Acceptance Criteria:**
- Given o ensaio na base carimbada, when a migração roda por lá, then as 7 edições saem, a chave nova existe, `edicoes_capa` nasce, e com `--falhar-no-fim` o retrato fica idêntico ao antes.
- Given quatro linhas do mesmo período, when a Retrospectiva abre no aparelho, then os cadernos aparecem na ordem de `posicao` e nenhuma leitura recebe mais de uma linha onde espera uma.
- Given a função de reordenar com três cadernos regenerados e um que saiu, when ela roda numa transação, then as posições ficam contíguas de 1 a 3 e a linha do caderno que saiu é apagada.
- Given um `import` de `ia/ranqueamento` em `mobile/src`, when a barreira roda, then ela reprova — e reprova também se o conjunto varrido for vazio.

## Spec Change Log

### Rodada 3 de revisão — 13/09/2026 · **ÚLTIMA**

19 achados. Nada do bloco congelado foi tocado; nada foi a produção.

**Critério de parada, e por que ele é agora.** Três rodadas seguidas devolveram a
**mesma classe** de achado — guarda que não guarda, evidência que não evidencia —, e
a rodada 3 a devolveu sobre as guardas que a rodada 2 acabara de escrever: a trava
que ninguém observava, o bloco de isolamento ancorado numa mensagem que outra causa
também produz, os três logs no disco descrevendo um cenário que já não é o do
arquivo. Isso não é sinal de que a próxima rodada acharia menos; é sinal de que a
revisão achará achados enquanto for chamada. O que muda o custo-benefício é que os
buracos desta leva são os **últimos com consequência medida** — os que sobraram são
declarações (limitações do leitor léxico de migration) e dívidas com dono e data no
`deferred-work.md`. Decisão do dono: fechar estes, declarar o resto, e parar.

O que mudou de **decisão**:

1. **A evidência humana ganhou procedimento.** Depois da migração produção fica sem
   edição e o celular não escreve até a 1.10 — a tela nova não teria como ser vista
   com dado real. O dono vai **semear uma edição chamando a própria
   `edicao_imprimir`**, e isso prova de quebra o caminho de escrita de verdade, o
   mesmo da 1.10, exercitado uma vez em produção. Está nos Manual checks, com a
   chamada, o que olhar e como desfazer.
2. **A função passou a validar tipo e caderno na ENTRADA.** Os CHECKs só são tocados
   quando há `insert`, e a permutação pura não insere: `'all'` e `array['lua']`
   caíam na mensagem genérica de contagem — **a mesma que o bloco de isolamento usa
   como prova**. Duas causas muito diferentes chegando pela mesma frase é como uma
   prova passa por motivo nenhum.
3. **O isolamento foi reancorado no desfecho, não na mensagem.** Se a RLS vazasse, a
   chamada da outra sessão **teria sucesso**; agora é o sucesso que reprova, e a
   conferência da frase é só o segundo portão.
4. **A trava ganhou observador** (`cenarios/concorrencia.sh`, duas sessões psql).
   Medido: sem a linha do `pg_advisory_xact_lock`, o cenário SQL passa A–H verde e
   só este caso reprova, em "B NÃO esperou".
5. **A RLS de `edicoes_capa` passou a ter linha sobre a qual falar.** Tabela vazia
   faz policy certa e policy ausente produzirem o mesmo zero.
6. **O cenário deixou de contar a tabela inteira**: dono e período em toda leitura, e
   período que produção não usa. O `delete` sem filtro apagaria arquivo real no dia
   em que a 1.10 imprimisse a primeira edição.
7. **A comparação de colunas produção↔local saiu das linhas para o
   `information_schema`.** Amarrada a haver linha, ela ficaria desligada para sempre
   depois desta story — no estado permanente da tabela, e é ela que pega a coluna que
   só existe lá.
8. **O aviso de migration pendente deixou de apontar para a própria candidata.**
   Aviso que dispara sempre é aviso que ensina a ignorar avisos.
9. **`toCadernoImpresso` deixou de fazer `as CadernoId`** — o cast que o módulo irmão
   recusa por escrito, na mesma entrega — e `tipoPeriodo` apertou para a união nos
   tipos de domínio e nos parâmetros. O `Row` continua `string`, porque ele descreve
   o fio; é lá que a conferência acontece.
10. **O efeito da tela passou a reagir à sessão que chega tarde**, e `sem-sessao`
    deixou de disparar durante a hidratação: quem está logado via "Entre na sua
    conta" nos primeiros quadros de todo arranque a frio.
11. **`faseNaoTratada` parou de lançar dentro do render.** A exaustividade continua
    no compilador (é lá que ela é barata); em produção, o cartão some e o motivo vai
    para o log — derrubar a Retrospectiva inteira punia o leitor pelo defeito.
12. **O teste da store passou a medir o caminho da tela** (`estadoDe(porPeriodo,
    chaveDe(uid, entrada))`), e não o `estado()` que produção nunca chama.
13. **As barreiras pararam de mentir por leitura incompleta**: `drop constraint` e a
    forma `= any (array[…])` passaram a contar; `rename column`, `drop table`,
    literais e corpos de função passaram a ser tratados; e o que sobrou está
    **declarado como limitação no próprio arquivo**.
14. **A barreira de `COLUMNS` virou dupla continência** (pedidas ⊆ banco, pedidas ⊇
    chaves da linha). Igualdade obrigaria a pedir para sempre coluna que a tela
    descarta, e quebraria na primeira coluna de uso só do servidor.
15. **`PELO_NOME` deixou de varrer palavra solta**: só conta nome entrando por
    import ou qualificado. Um export futuro de nome genérico viraria alarme falso
    espalhado, e barreira que grita sem motivo se aprende a silenciar.
16. **Quatro dívidas novas registradas** (`deferred-work.md`): `data/edicoes-capa`
    no barril sem chamador; a frase provisória "A impressão está parada…", que a
    1.10 tem de tirar; `upsertEdicao` como porta de escrita direta que contorna a
    função, com a contiguidade 1..N vivendo só dentro dela; e a evidência de
    `montarPromptDaEdicao` recontada, que se contradizia.

### Rodada 2 de revisão — 12/09/2026

Três camadas de novo, 21 achados, todos endereçados na worktree. Nada do bloco
congelado foi tocado; nada foi a produção. O que mudou de **decisão**:

1. **A função não serializava contra si mesma** — e concorrência é a razão
   declarada de ela existir. Duas impressões do mesmo período rodavam cada uma no
   seu snapshot, as duas passavam a própria conferência final, e o único árbitro
   era a `unique` deferida estourando no COMMIT do cliente, sem período e sem
   chamador. Agora há `pg_advisory_xact_lock` sobre a chave da edição na entrada,
   e a `unique` é forçada a `immediate` antes do `return query`, para a violação
   aparecer com o contexto de quem imprimiu.
2. **A barreira dos ids lia a migration errada.** `idsAceitosPeloCheck` pegava a
   última ocorrência da regex em qualquer tabela: medido, `tipo_periodo` era
   comparado com o CHECK de `edicoes_capa` e o de `edicoes_ia` **não era comparado
   com nada** — na story cujo assunto é a chave de `edicoes_ia`. Passou a ler por
   tabela, com uma linha por tabela.
3. **`EDICAO_COLUMNS` e `CAPA_COLUMNS` não eram comparadas com o banco**, só com a
   interface do TS — duas coisas escritas à mão no mesmo commit e no mesmo
   vocabulário. Barreira nova lê `create table`/`add column` e cobra igualdade de
   conjunto.
4. **`erro` deixou de reler a cada foco.** Releitura automática de erro enche o
   log com uma linha por folheada e **esvazia o botão "Tentar de novo"**: quando o
   dedo chega nele, a releitura já aconteceu. `erro` virou terminal para
   `carregar`, e o toque continua tendo porta própria.
5. **A store passou a ser chaveada por `uid`.** `pronta` não relê — certo, período
   fechado congela —, e sem o dono na chave o texto de um usuário continuava
   desenhado depois de outro login. Com o uid na chave, o estado alheio não é
   invalidado: é **inalcançável**.
6. **Sessão ausente ganhou estado e frase.** `carregar` saía antes de qualquer
   `set`, o mapa nunca ganhava a chave, e o padrão (`carregando`) é a fase que não
   desenha nada — o cartão ficava invisível para sempre.
7. **A tela e a store passaram a dividir uma função só.** A tela montava a chave à
   mão e lia `porPeriodo` direto, sem teste; `chaveDe` e `estado()` ficavam sem
   uso. `estadoDe(porPeriodo, chave)` é pura, testada, e usada nos dois lados — o
   seletor segue proibido de chamar função.
8. **O `EdicaoCard` deixou de ter união gêmea e `return` de sobra.** O tipo vem da
   store por `import type`, e o `switch` é exaustivo com ramo `never`: fase nova
   sem desenho passou a ser **erro de compilação**, e não um ramo herdado em
   silêncio (era `nao-escrita` caindo no `return` final).
9. **O ensaio ia ficar irrodável no dia da entrega.** Medido: depois que a
   migração for a produção, `preparar.sh` abortava com "produção não tem edição
   nenhuma" — a migração apaga as sete —, e a candidata concatenada não é
   reaplicável. Produção sem edição passou a ser **aviso**, e a conferência dos
   textos declara que não teve o que comparar em vez de passar por vacuidade;
   o cabeçalho do cenário escreve o caminho repetível (aplicá-lo sozinho).
10. **O cenário nunca cobrava a `unique` deferida sobre o estado final** — a
    limpeza apagava tudo antes do COMMIT. Agora ela é forçada a `immediate` com
    as linhas ainda de pé.
11. **A primeira função que escreve por RPC ganhou prova de isolamento.** O
    cenário rodava com um usuário só. O caso novo troca o `sub` do
    `request.jwt.claims` e mede: o dono enxerga 3 cadernos, a outra sessão
    enxerga 0 **com o mesmo argumento** — e a edição do dono não muda.
12. **Duas remoções silenciosas foram registradas** (`deferred-work.md`): o aviso
    de errata, que existia na tela e saiu na rodada 1 (volta na 1.12), e
    `montarPromptDaEdicao`/`precisaErrata`, que ficaram sem chamador de produção.

### Rodada 1 de revisão — 12/09/2026

Três camadas de revisão sobre a entrega, 22 achados, todos endereçados na
worktree. Nada do bloco congelado foi tocado; nada foi a produção. O que mudou de
**decisão**, e não só de código:

1. **A AD-16 estava reaberta pelo outro lado.** `upsertEdicao` lê `AGG_VERSION` no
   ponto de gravação, mas `edicao_imprimir` a recebe pela chamada — o mesmo
   caminho de passagens opcionais que deixou as 7 linhas com nulo. A função passou
   a **recusar a linha sem ela, com mensagem nomeada**, e a barreira de dono único
   foi conferida: ela impede um **segundo dono** da constante e nada mais, então
   não obriga chamador nenhum a lê-la. A obrigação vira entrega da 1.10 (ver
   Design Notes).
2. **"Verifica antes de gravar" ficou sem ponto de aplicação** e isso passou a
   estar escrito, aqui e no `deferred-work.md`. Enquanto isso, `edicao_imprimir`
   deixou de nascer executável por anônimo.
3. **A ordem interna ganhou uma asserção**: a migração reprova se as edições a
   apagar não forem exatamente 7.
4. **`kind` pode valer `all`**, que o CHECK recusa. A leitura passou a tratar
   "período que nunca terá edição" e "período em curso" como a **mesma ausência**,
   e a lista dos tipos com edição virou valor no núcleo (`TIPOS_COM_EDICAO`),
   cobrado contra o banco pela mesma barreira dos ids.
5. **`precisaErrata` perdeu o guarda de nulo.** Com a coluna `not null`, ele era
   condição sempre verdadeira, e o teste dele só existia com cast.
6. **`ausente` e `nao-escrita` deixaram de ser terminais no cache.** As duas são
   respostas sobre o relógio e sobre o arquivo, e as duas mudam.

## Design Notes

**Onde os documentos brigam, e o que vale.** O companion `mudancas-mecanicas.md:47-48` manda "recalcular **as quatro** posições"; a AD-4 e o critério de aceite dizem **1 a N sobre os cadernos que a edição tem** — e 22 dos 39 meses do backfill têm um caderno só. Vale a AD-4. O mesmo companion escreve o `unique` **sem** `deferrable initially deferred`; sem isso a permutação é ilegal em qualquer formulação. Vale a AD-4.

**Por que `metrica_lider` aceita nulo.** `liderDoCaderno` devolve `null` para o caderno que entrou pela lápide ou onde nada passou no portão. Nulo é a verdade — "nenhuma métrica liderou" —, e o anuário da 3.2 lê isso como lacuna declarada, que é o que a AD-17 manda fazer com mês sem carimbo. Sentinela inventaria uma chave que não existe.

**Por que o celular para de escrever.** A tela não pode ordenar (a barreira proíbe), e a sequência da impressão é a 1.10. Gravar uma linha só, rotulada com um caderno qualquer, poria mentira num arquivo que o Épico 2 vai imprimir 53 vezes e o anuário vai ler. A migração já apaga as 7 edições, então o intervalo custa pouco: o arquivo nasce vazio de qualquer jeito.

**A janela da AD-15, em ordem.** Ensaio verde → build compilado (ou `eas update` pronto para publicar) → migração → JS novo ativo → abrir **e** imprimir no aparelho. O `eas update` só vale no segundo lançamento, e publicado antes da migração quebra do outro lado.

**O que a 1.10 herda, e que esta story NÃO resolve.** Duas dívidas nascem aqui, as duas por causa do mesmo fato — o celular parou de escrever e a escrita ainda não nasceu no lugar novo:

1. **A versão da agregação volta a ser passada de fora.** `upsertEdicao` a lê da constante no ponto de gravação (AD-16), e essa garantia não atravessa o RPC: `edicao_imprimir` recebe `agg_version_no_momento` na carga. A função **recusa o nulo com mensagem nomeada**, o que fecha a omissão — mas não o valor errado, que é exatamente a metade que a AD-16 dizia não conseguir fechar por tipo. E a barreira de dono único **não ajuda aqui**: medida na rodada 1, ela impede um *segundo `const AGG_VERSION`* e nada mais; um chamador que passasse `PACOTE_VERSAO` no lugar dela passa por ela sem tocar em nada. Entrega da 1.10: a sequência lê `AGG_VERSION` do núcleo ao montar a carga, e uma barreira cobra que o literal não apareça em `mobile/src` nem em `scripts/`.

2. **"Verifica antes de gravar" está sem ponto de aplicação.** `verificarTexto` não tem chamador vivo desde que `gerarEdicao` saiu do celular, e `edicao_imprimir` insere o texto que receber, sem conferência nenhuma — o banco confere truncamento (`motivo_de_parada`) e texto em branco, e mais nada. Hoje isso não tem consequência, porque **ninguém escreve**; a consequência aparece no minuto em que a 1.10 ligar a escrita. Entrega da 1.10: a conferência roda **antes** da chamada ao RPC, e `upsertEdicao`/`edicao_imprimir` só são alcançáveis pela sequência, por barreira — que é o que a AD-13 já promete. Registrado também no `deferred-work.md`.

## Verification

**Commands:**
- `supabase/ensaio/subir.sh && supabase/ensaio/preparar.sh && supabase/ensaio/ensaiar.sh <migração>` -- expected: aplica; o diff mostra a chave nova, `edicoes_capa` e as 7 edições saindo
- O mesmo com `--falhar-no-fim` -- expected: erro, e o retrato idêntico ao antes (R-25)
- `pnpm --filter @vitale/shared lint` e `test` -- expected: 0 erros; barreira nova verde e **não vácua**
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- `import { ordenarCadernos }` em `mobile/src` -- a barreira reprova
- Esvaziar o conjunto que a barreira varre -- ela reprova por vacuidade
- Voltar `.maybeSingle()` na leitura -- o teste de várias linhas reprova
- `onConflict` com a chave velha -- o teste de gravação reprova

**Manual checks:**

No aparelho, com a migração aplicada e o JS novo ativo — é a evidência humana que o
test design exige da 1.9. **Não há botão a conferir**: ele não foi desabilitado, foi
**removido** junto com o caminho de escrita, e o que ocupa o lugar dele é uma frase.

### Semear uma edição em produção, para a tela ter o que mostrar

Depois da migração, produção fica **sem edição nenhuma** (a migração apaga as sete) e
o celular não escreve até a 1.10 — então a forma nova não teria como ser vista com
dado real. A decisão do dono é semear uma edição **chamando a própria
`edicao_imprimir`** na conta dele.

Isto prova de quebra o que nenhum teste prova: é o **caminho de escrita de verdade**,
o mesmo que a sequência da 1.10 vai usar, exercitado uma vez em produção — a função,
a chave nova, a coluna `posicao`, o carimbo de `metrica_lider` e a RLS, com o JWT dele
e não com um `sub` fabricado.

**1. O uid.** No SQL editor do painel:

```sql
select id from auth.users where email = '<o e-mail dele>';
```

**2. A chamada.** Tudo numa transação, porque `set local` não atravessa comando: a
função é `security invoker` e roda como `postgres` se ninguém descer para
`authenticated` — e aí ela passaria por cima da RLS e gravaria com `auth.uid()` nulo,
que ela recusa. Três cadernos, texto curto, **todos os campos obrigatórios presentes**
— incluindo `metrica_lider` **declarado**, que é chave que tem de existir mesmo valendo
nulo (o caderno de Coração abaixo é o caso da lápide):

```sql
begin;
select set_config('request.jwt.claims',
                  json_build_object('sub', '<uid>', 'role', 'authenticated')::text, true);
set local role authenticated;

select caderno, posicao, modelo
  from public.edicao_imprimir(
    'month', '2026-08-01', '2026-08-31',
    array['movimento','sono','coracao'],
    '[{"caderno":"movimento","texto":"Agosto teve mais quilômetros do que julho, e quase todos vieram de bicicleta.",
       "provedor":"semeadura","modelo":"mão","prompt_versao":3,"pacote_versao":3,
       "motivo_de_parada":"STOP","tokens_entrada":0,"tokens_saida":0,
       "agg_version_no_momento":9,"metrica_lider":"distancia"},
      {"caderno":"sono","texto":"As noites encurtaram no fim do mês, e a nota acompanhou.",
       "provedor":"semeadura","modelo":"mão","prompt_versao":3,"pacote_versao":3,
       "motivo_de_parada":"STOP","tokens_entrada":0,"tokens_saida":0,
       "agg_version_no_momento":9,"metrica_lider":"duracao"},
      {"caderno":"coracao","texto":"A frequência de repouso ficou onde estava.",
       "provedor":"semeadura","modelo":"mão","prompt_versao":3,"pacote_versao":3,
       "motivo_de_parada":"STOP","tokens_entrada":0,"tokens_saida":0,
       "agg_version_no_momento":9,"metrica_lider":null}]'::jsonb);
commit;
```

> **`agg_version_no_momento` tem de ser o valor real de `AGG_VERSION`** (o `9` acima é
> o do dia em que isto foi escrito — confira em `packages/shared/src/constants/agg-version.ts`).
> Um número inventado aqui marca a edição como errata errada no dia seguinte, e é
> exatamente a metade que a função **não** consegue fechar sozinha (Design Notes).

A chamada devolve as três linhas na ordem pedida, com `posicao` 1, 2 e 3.

**3. Na tela**, abrindo a Retrospectiva em agosto/2026:

- os **três cadernos**, cada um com o **nome** por extenso (Movimento, Sono, Coração);
- na **ordem de `posicao`** — a mesma da chamada, e **não** a ordem do ranqueamento;
- **filete só ENTRE os blocos**: nenhum risco acima do primeiro nem abaixo do último;
- **assinatura por caderno** embaixo de cada um (`mão · 13 set 2026`), e não uma só
  para a edição inteira.

**4. Desfazer.** A semeadura é andaime, não arquivo — e o Épico 2 vai imprimir este
mês de verdade:

```sql
delete from public.edicoes_ia
 where user_id = '<uid>' and tipo_periodo = 'month'
   and inicio = '2026-08-01' and fim = '2026-08-31';
```

Depois de apagar, a mesma tela tem de voltar a dizer *"Este período fechou e ainda não
foi escrito."* — o que confere o outro estado no mesmo passo.

### O resto da tela

- Período **fechado e sem edição** (é o estado de todo período depois da migração): o
  cartão "A edição" diz *"Este período fechou e ainda não foi escrito."*, com a nota
  *"A impressão está parada…"* — e **nenhum botão** de escrever em lugar nenhum da tela.
- Período **em curso** (setembro, hoje) e **Total**: nada. Sem cartão, sem aviso, sem
  espaço reservado — as duas ausências têm de ser iguais, e nenhuma delas pode parecer
  um botão desabilitado.
- **Modo avião**, num período fechado: a frase de erro aparece com "Tentar de novo", o
  toque desenha *"Procurando a edição…"* e, saindo e voltando à tela, ele **continua
  lá** — a releitura automática desistiu do erro na rodada 2, e é esse o sintoma.
- Se houver linha gravada à mão para conferir a forma nova: os cadernos saem na ordem de
  `posicao`, cada um com nome e assinatura própria.

## Suggested Review Order

**A migração — é o que não tem volta**

- A ordem interna é a garantia: as sete saem antes de a coluna obrigatória nascer.
  [`20260912120000_edicao_por_caderno.sql:29`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L29)

- A chave nova, e a `unique` de posição deferida — sem ela a permutação é ilegal.
  [`20260912120000:86`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L86)

- A capa com grão de edição, três naturezas e a identidade sem chave estrangeira.
  [`20260912120000:123`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L123)

- A impressão numa chamada: grava o regenerado, reposiciona todos, apaga quem saiu.
  [`20260912120000:191`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L191)

- A trava por edição, que é a razão declarada de a função existir.
  [`20260912120000:244`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L244)

- A função não nasce executável por anônimo: a linha de plpgsql não é a única defesa.
  [`20260912120000:482`](../../supabase/migrations/20260912120000_edicao_por_caderno.sql#L482)

**A leitura da forma nova**

- A edição virou lista de cadernos, ordenada por `posicao`, sem `maybeSingle`.
  [`edicoes-ia.ts:188`](../../packages/shared/src/data/edicoes-ia.ts#L188)

- A porta de escrita direta, que a 1.10 fecha — e o `onConflict` da chave nova.
  [`edicoes-ia.ts:256`](../../packages/shared/src/data/edicoes-ia.ts#L256)

- Os tipos de período que têm edição, cobrados contra o banco pela barreira.
  [`edicoes-ia.ts:38`](../../packages/shared/src/data/edicoes-ia.ts#L38)

- A errata perdeu o guarda de nulo porque a coluna passou a cobrar.
  [`edicoes-ia.ts:307`](../../packages/shared/src/data/edicoes-ia.ts#L307)

**As barreiras — é onde as três rodadas mais bateram**

- A tela não alcança o ranqueamento, nem por caminho profundo nem por nome.
  [`architecture.test.ts:1521`](../../packages/shared/src/architecture.test.ts#L1521)

- Os ids do TS e os CHECKs do banco são a mesma lista, lidos por tabela.
  [`architecture.test.ts:600`](../../packages/shared/src/architecture.test.ts#L600)

- O leitor de CHECK por tabela e coluna, que antes lia a última migration qualquer.
  [`architecture.test.ts:425`](../../packages/shared/src/architecture.test.ts#L425)

- As colunas pedidas conferidas contra as colunas que o banco tem.
  [`architecture.test.ts:495`](../../packages/shared/src/architecture.test.ts#L495)

**A tela**

- A chave do estado passou a incluir o dono, e a derivação é a mesma nos dois lados.
  [`edicao.store.ts:73`](../../mobile/src/store/edicao.store.ts#L73)

- Um caderno por bloco, na ordem gravada, com assinatura por linha.
  [`EdicaoCard.tsx:68`](../../mobile/src/components/EdicaoCard.tsx#L68)

- Fase inesperada não derruba a tela: reprova na compilação, devolve nada em execução.
  [`EdicaoCard.tsx:61`](../../mobile/src/components/EdicaoCard.tsx#L61)

**A prova**

- O cenário da função: A–H, com isolamento entre donos e a constraint cobrada no commit.
  [`cenarios/edicao-imprimir.sql:1`](../../supabase/ensaio/cenarios/edicao-imprimir.sql#L1)

- A concorrência, que um arquivo SQL não consegue provar: duas sessões e `pg_locks`.
  [`cenarios/concorrencia.sh:1`](../../supabase/ensaio/cenarios/concorrencia.sh#L1)
