---
id: SPEC-busca-textual
companions:
  - data-model.md
sources:
  - ../../../_bmad-output/planning-artifacts/pesquisa-por-cidade-brief.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar. O brief de levantamento (07/09/2026) foi absorvido aqui; consulte-o só para a narrativa da investigação.

# Busca textual nas atividades — achar por cidade, nome da rota, nome, fonte ou aparelho

## Why

Oportunidade a capturar. São 555 atividades em produção e nenhuma forma de achar uma. O acervo já carrega o texto que responderia — 1.376 marcas de cidade em 254 municípios, 33 nomes escritos à mão como *Tour de la Meuse-Rhin*, o aparelho que gravou — mas esse texto só existe para ser lido depois que a atividade já foi encontrada por rolagem. Duas coisas o tornam urgente agora: o passe de cidades roda **só para bicicleta**, então 137 atividades têm rota e nenhuma cidade e desapareceriam de uma busca que parecesse completa; e o geocodificador **já devolve** os apelidos de idioma de cada cidade e o código os descarta, de modo que digitar `Brussels` não acha as marcas de **Bruxelles** que o próprio Strava escreveu assim na atividade ao lado. Corrigir os dois custa um passe de ~19 min, uma vez.

## Capabilities

- **CAP-1** — Campo de busca no Histórico
  - **intent:** O usuário digita texto livre e a lista do histórico passa a mostrar só as atividades que casam, em qualquer dos campos buscáveis.
  - **success:** No iPhone (Histórico) e na web (`/workout-history`), digitar `Tervuren` devolve as atividades que passaram pela cidade; `Louvain` devolve as cinco rotas com Louvain no nome **e** a *Tour du Hageland*, que só passa por Leuven; `Garmin` devolve o que o relógio novo gravou. Limpar o campo devolve a lista íntegra. A lista responde enquanto se digita, sem passo de confirmação.

- **CAP-2** — Um mesmo termo alcança os cinco campos
  - **intent:** A consulta é avaliada contra cidade, nome próprio da rota, nome da atividade, fonte e aparelho ao mesmo tempo, sem o usuário escolher onde procurar.
  - **success:** Uma consulta que casa em campos diferentes de atividades diferentes devolve todas numa lista só. Teste sobre o acervo real: `Brussels` devolve tanto pedaladas cuja marca de cidade é *Bruxelles* quanto corridas cujo nome é *Brussels Running* e que não têm cidade nenhuma.

- **CAP-3** — Apelidos de idioma tornam a cidade alcançável pela grafia que se digita
  - **intent:** O usuário acha a cidade escrevendo-a como sabe escrever, sem precisar adivinhar em que idioma o passe a gravou.
  - **success:** `Brussels`, `Brussel` e `Bruxelas` acham as marcas de **Bruxelles**; `Louvain` acha **Leuven**; `Schaarbeek` acha **Schaerbeek**. Nenhuma chamada extra ao geocodificador no ingest corrente: as variantes vêm na mesma resposta que já é pedida.

- **CAP-4** — Toda atividade com rota tem cidade
  - **intent:** O passe de cidades cobre corrida e caminhada além de bicicleta, para que a busca por cidade não esconda um terço do acervo.
  - **success:** Depois do backfill, nenhuma atividade com `has_route = true` fica com `cities` nulo por mais tempo que o ciclo normal de enriquecimento — as 137 de hoje (80 caminhadas, 57 corridas) passam a ter marcas. Conferido por consulta em produção, não por amostra.

- **CAP-5** — O resultado diz por que apareceu
  - **intent:** Cada item da lista de resultados mostra em que campo o termo casou e com que texto.
  - **success:** Buscando `Bruxelles`, um resultado que casou pela cidade e outro que casou pelo nome se distinguem na tela sem abrir a atividade. Nenhum resultado aparece sem proveniência.

- **CAP-6** — Nome raro vale mais que rótulo de fábrica
  - **intent:** A ordem dos resultados reflete quanto o casamento informa: um nome que aparece uma vez no acervo diz algo; um que aparece 185 vezes é rótulo.
  - **success:** `Cycling` — 175 atividades com o rótulo genérico — não empurra para baixo um casamento em cidade nem em nome raro. `Meuse` traz *Tour de la Meuse-Rhin* no topo. Ranqueamento é função pura testada no núcleo, com caso de teste por faixa de frequência.

- **CAP-7** — "Não achei" não se confunde com "não sei"
  - **intent:** A tela distingue a atividade cuja cidade ainda não foi resolvida da que nunca terá cidade por não ter rota, e das duas separa a que foi resolvida sem resultado.
  - **success:** **Nenhuma linha afirma ausência de cidade** — o silêncio é correto, a afirmação não. O estado vazio da busca é seco ("Nada encontrado"), sem contagem de pendentes: decisão dele em 07/09, tornada segura pela ordem das stories, já que o backfill (story 2) roda antes da tela (story 4) e a janela incompleta nunca chega a ser instalada. Onde a contagem for necessária em outro contexto, ela é `has_route AND cities IS NULL` — nunca `cities IS NULL` puro, que somaria as 244 atividades sem rota que jamais terão cidade.

- **CAP-8** — Acrescentar campo buscável não é reescrita
  - **intent:** Um campo passa a ser buscável assim que tiver conteúdo em produção, sem que a busca precise ser reescrita para recebê-lo.
  - **success:** **Já exercitado na estreia:** `route_name` estava fora por estar vazio e entrou na v1 ao ganhar 133 linhas em 07/09 — uma entrada nova na lista, com seu peso e seu rótulo de proveniência, sem tocar nas telas nem no motor. `gear.name`/`gear.notes` entram pelo mesmo caminho quando alguma atividade tiver `gear_id`.

- **CAP-9** — A linha 2 do cartão explica sem crescer
  - **intent:** O cartão diz por que apareceu reusando a segunda linha que já existe, em vez de ganhar uma linha nova.
  - **success:** Com busca ativa, a segunda linha mostra o nome próprio grifado quando foi ele que casou; mostra `Leuven · cidade` quando só campos invisíveis casaram; e volta ao nome próprio ou à hora quando não há busca. A altura do cartão é idêntica nos três casos, medida no aparelho.

- **CAP-10** — Buscar esvazia o agregado do período
  - **intent:** Enquanto há consulta ativa, a tela é uma lista de resultados e nada mais.
  - **success:** Digitar remove da tela a carga de treino, o seletor de período, os quatro números e os gráficos; o ✕ devolve todos. Nenhum número que descreve o período aparece acima de uma lista que descreve a consulta.

## Constraints

- **A busca é função pura no `packages/shared`, sobre a lista já carregada.** `fetchActivities` (`packages/shared/src/data/activities.ts:111`) já traz o histórico inteiro paginado nos dois apps: não há consulta nova, teto do PostgREST no caminho, nem dependência de rede. Web e mobile só renderizam — mesmo padrão de `geo/country-explorer.ts`.
- **O índice normalizado é derivado uma vez por carga do store, nunca por tecla.** É o que sustenta a conta: ~1.100 atividades daqui a dois anos no ritmo de pico (277/ano), 462 bytes de texto buscável por atividade, ≈1 ms por tecla. Normalizar por tecla joga essa conta fora.
- **O contrato é `(consulta, atividades) → resultados ranqueados com proveniência`.** Trocar o motor por Postgres (`ilike`, `pg_trgm`, `tsvector`) quando o acervo pedir é substituir uma implementação, não reescrever duas telas.
- **O peso do nome sai da frequência dele no acervo, não de `name_edited`.** Medido em 07/09: dos 33 nomes editados, 31 são "Yoga", e os informativos (*Tour de la Meuse-Rhin*, *Morning Ride*, *Rotterdam Cycling*) não estão marcados — 6% de precisão. Já a raridade separa quase perfeitamente: 4 nomes cobrem 526 das 555 atividades, e os 9 nomes únicos são exatamente os que informam. A frequência é derivada da lista já carregada ao montar o índice: **nenhuma coluna nova, nenhuma mudança no SELECT nem no modelo**.
- **O campo visível vem antes da proveniência na linha 2.** Medido: **todas** as 21 rotas com "Tervuren" no nome também passam por Tervuren. Se a proveniência tivesse precedência, ela esconderia justamente o texto que o usuário digitou. A explicação só entra quando nada visível casou.
- **Quem quer que ocupe a linha 2, a hora desce para a fileira de números.** Hoje essa migração só acontece quando existe nome próprio (`18b260b`); com a proveniência disputando a linha, a condição tem que virar impessoal — senão a hora evapora numa corrida, que não tem `route_name`.
- **Nome genérico é buscável, só vale menos.** Excluir os 526 rótulos de fábrica mataria o resgate das corridas, que não têm `cities` e carregam a cidade no nome (*Brussels Running*).
- **Casamento por prefixo de palavra, minúscula e sem acento.** Tokenizando em não-alfanumérico, para `pierre` achar *Woluwe-Saint-Pierre* e `elles` não achar *Ixelles*. Consulta de várias palavras casa por **E** entre os tokens.
- **O conjunto de apelidos é limitado, não "tudo que o OSM devolve".** A resposta de Bruxelas traz 188 chaves em `namedetails`; guardar todas é ruído no índice. A lista fechada — sete chaves, cinco apelidos em Bruxelas — está em [data-model.md](data-model.md).
- **`cities` continua escrita só pelo UPDATE server-side do passe.** `sync_upsert_activities` não referencia a coluna e não pode passar a referenciar — senão o re-push do HealthKit apaga os apelidos.
- **O backfill roda fora da edge function**, no precedente das ADR 0006/0007. `enrichCities` tem teto de 3 atividades por run porque 3 pedaladas × ~27 chamadas × 1,1 s já encostam no wall-clock da edge; drenar 275 atividades a 3 por tick seriam ~92 syncs. O caminho incremental para atividade nova continua no `enrichCities`.
- **`null` (pendente) e `[]` (enriquecida sem resultado) seguem sendo estados distintos**, como a migration original previu.
- **Nominatim a 1,1 s entre chamadas**, com User-Agent identificável. O backfill inteiro são ~992 chamadas ≈ 19 min, uma vez.

## Non-goals

- **Rua, bairro e ponto de interesse.** Exigiriam `zoom` ~16–17 e amostragem na casa dos 100 m — ~400 chamadas por rota, contra a política de uso do Nominatim público. Se voltarem à mesa, decidir junto com o piso das rotas: uma infraestrutura, dois consumidores (ADR 0035).
- **`gear.name`/`gear.notes` na v1.** Zero atividades com `gear_id` em produção — fora por falta de conteúdo, não por decisão de produto. CAP-8 é o que os traz de volta sem reescrita. (`route_name` estava aqui e **saiu**: ganhou 133 linhas em 07/09 e entrou na v1.)
- **`provider` como campo buscável.** `healthkit` em 100% das linhas não discrimina nada.
- **Índice de texto no Postgres, `tsvector` ou `pg_trgm`.** A v1 não cria caminho de leitura novo nem migration de índice.
- **Busca fora do Histórico.** Semana, Retrospectiva e detalhe da atividade não ganham campo de busca neste passo.
- **Busca por número ou por data** — distância, duração, "junho de 2025". Este passe é sobre texto.
- **Correção manual de nome de cidade.** O que o OSM devolve é o que fica; não há tela de edição de `cities`.

## Success signal

Digitar `Brussels` no Histórico do iPhone devolve, numa lista só, as pedaladas que atravessaram **Bruxelles** e as corridas chamadas *Brussels Running* que não têm cidade nenhuma — cada uma dizendo se casou pela cidade ou pelo nome. Hoje essa busca não existe, e quando existisse devolveria zero para as primeiras e nada para as segundas.

## Assumptions

- As corridas e caminhadas amostram muito menos que as pedaladas (3,8 e 8,7 km medianos, contra dezenas de km), então o teto de 40 amostras por rota nunca é atingido nelas — o custo cai de ~27 para ~5 chamadas por atividade. A estimativa de 738 chamadas para as 137 rotas depende disso.
- O centro de cidade guardado em cada `CityMark` (`lat`/`lng` do ponto representativo do município) é preciso o bastante para reresolver a mesma cidade e colher seus apelidos — é o que torna o backfill 254 chamadas em vez de 3.700.
- Os apelidos são estáveis o suficiente para não precisarem de reenriquecimento periódico: colhidos uma vez, valem até alguém renomear a cidade no OSM.

## Open Questions

- O selo de proveniência (CAP-5) tem desenho definido? A regra do repo é mockup com dado real antes de código de tela — e há decisão de sistema no meio: destacar o trecho que casou usa papel de paleta, não `--primary`, que é cromo de marca.
- Onde exatamente o campo de busca mora no Histórico do iPhone — cabeçalho fixo, ou revelado por gesto? A tela já disputa espaço com a lente e o painel de abas da revisão de Ciclismo.
- O estado vazio de CAP-7 deve contar as atividades pendentes sempre, ou só enquanto o backfill não terminou? Depois dele, "pendente" passa a significar apenas "atividade nova ainda não enriquecida".
