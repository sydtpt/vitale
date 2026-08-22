---
id: SPEC-cultura
companions:
  - data-model.md
  - ../../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md
sources:
  - ../../../_bmad-output/planning-artifacts/backlog-de-features.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar.

# Cultura — livros, filmes, podcasts e álbuns no Orbe

## Why

O Orbe rastreia treino, saúde, alimentação, casa, compras e finanças, mas não rastreia nada do que o usuário lê, assiste ou escuta. É uma visão a realizar dentro da fase declarada em 2026-08-21: **criação e coleta de features do super app pessoal**, com a IA analítica adiada de propósito.

O que o módulo entrega é uma **estante pessoal com estado** — o que quero consumir, o que estou consumindo, o que já consumi — em quatro mídias. O valor primário é o próprio acervo: hoje essa informação não existe em lugar nenhum, ou está espalhada por quatro apps que não conversam.

O valor analítico é de dois tipos, e só um deles é de baixa resolução. O **temporal** é grosseiro por decisão explícita: sem registro de sessão, o módulo produz uma janela de consumo, nunca dias (CAP-5). A **procedência** não é: quem indicou um item é contexto humano sem backfill, e cruzado com a nota responde de quem vêm as indicações que valem a pena (CAP-11).

Livro, filme, podcast e álbum são também a primeira entidade do app que **nenhum modelo existente comporta** — não é marcação binária diária, não é contador com meta, não é to-do com prazo. É entidade com estado que evolui. Por isso é módulo novo, e não campo em algo que já existe.

## Capabilities

> **CAP-3 foi retirada** (sessão de consumo opcional). O id não é reutilizado.

- **CAP-1** — Catálogo externo multi-provedor, com saída manual
  - **intent:** O usuário adiciona um item buscando pelo título, e os metadados chegam prontos em vez de digitados, qualquer que seja a mídia — e consegue cadastrar mesmo quando nenhum provedor conhece o item.
  - **success:** buscar um título em cada um dos quatro tipos devolve candidatos com capa e criador; salvar grava o id externo e qual provedor o forneceu. A busca cai para o próximo provedor **sem exigir credencial nova** tanto quando o primário não acha quanto quando ele erra ou estoura o tempo — um 401 do TMDB cai para o iTunes igual a uma busca vazia. Esgotada a cadeia, o usuário cadastra à mão com título e tipo, e o item fica sem `fonte`. Candidato sem capa ou sem criador é salvável.

- **CAP-2** — Ciclo de vida do item
  - **intent:** Um item transita entre querer consumir, estar consumindo e ter consumido, para que a estante reflita a intenção e não só o que terminou.
  - **success:** cada transição grava suas datas conforme a máquina de estados do companion, inclusive as diretas — `quero → concluido` para o que se consome de uma vez, e `concluido → consumindo` para reler, rever ou reouvir. **Toda transição aceita uma data, com hoje como padrão**, sem o que o backfill gravaria o passado como presente. Um item pode nascer em qualquer estado. Os três estados valem para as quatro mídias sem exceção.

- **CAP-4** — Nota subjetiva
  - **intent:** O usuário registra o que achou, na mesma escala que já usa no resto do app.
  - **success:** a nota 1–5 é oferecida ao concluir, aceita ser pulada, e é editável **em qualquer estado** — inclusive antes de terminar. Reler não a apaga.

- **CAP-5** — Janela de consumo consultável
  - **intent:** O período em que cada item foi consumido fica disponível para cruzar com o resto do app.
  - **success:** uma consulta por intervalo devolve os itens cuja janela o intersecta, tratando item em curso como janela aberta — `coalesce(concluido_em, current_date)` — e excluindo os que estão em `quero`, que não têm janela. **Resolução é de janela, não de dia.**

- **CAP-6** — Análise na web
  - **intent:** O usuário vê o que consumiu, quando, e como isso se distribui entre as mídias.
  - **success:** `/cultura` mostra contagem por período e por tipo, distribuição de notas, e o que está parado em `consumindo` há mais tempo.

- **CAP-7** — Segredo fora do cliente
  - **intent:** A busca em catálogo externo acontece sem expor credencial em nenhum dos dois apps.
  - **success:** nenhuma requisição a `api.themoviedb.org` parte de web ou mobile — a única origem de busca nos dois apps é a edge function, que responde no mesmo shape para os quatro tipos, qualquer que seja o provedor por trás.

- **CAP-8** — Vocabulário por mídia
  - **intent:** Cada tipo fala a própria língua, e o modelo não adota a de nenhum.
  - **success:** o estado interno é o mesmo para os quatro tipos, e a UI exibe "quero ler / quero ver / quero ouvir" conforme o tipo; nenhum rótulo de mídia aparece em nome de coluna, enum ou tipo TypeScript.

- **CAP-9** — Tipo extensível sem migration
  - **intent:** Adicionar uma mídia nova é mudança de código no núcleo, não mudança de schema.
  - **success:** acrescentar um quinto tipo não exige `.sql` novo — o registro de tipos vive no shared, e o banco não tem `check` enumerando mídias.

- **CAP-10** — Deleção como única saída
  - **intent:** O que o usuário larga ou não quer mais some da estante, em vez de virar estado extra.
  - **success:** deletar um item em qualquer estado o remove por completo, sem tombstone e sem resíduo em consulta — e é a única forma de tirar algo da estante.

- **CAP-11** — Procedência da indicação
  - **intent:** O usuário registra quem indicou o item, para lembrar depois de onde aquilo veio e saber de quem vêm as boas indicações.
  - **success, na captura:** o campo é opcional nos quatro tipos, e digitar o prefixo de um indicador já usado o oferece antes de criar valor novo.
  - **success, na análise:** a web lista os itens agrupados por indicador, com as notas de cada um.

- **CAP-12** — Edição do item
  - **intent:** O usuário corrige o que ficou errado sem destruir o histórico do item.
  - **success:** `titulo`, `criador`, `indicado_por`, `nota` e as datas são editáveis a qualquer momento; corrigir um candidato escolhido errado na busca não custa perder `iniciado_em`. Uma edição de data que violaria a coerência entre estado e datas é barrada no módulo de dados com mensagem própria — o usuário nunca vê violação de `check` do Postgres. **`tipo` não é editável** — trocá-lo invalidaria `fonte`, `fonte_id` e os rótulos; mudar de mídia é deletar e recriar.

- **CAP-13** — Integridade do tipo sem constraint no banco
  - **intent:** Tirar o `check` do banco (CAP-9) não pode custar a garantia de que todo item tem um tipo conhecido.
  - **success:** o módulo de dados do shared rejeita na escrita qualquer `tipo` fora do registro; na leitura, um tipo desconhecido cai para rótulos genéricos em vez de quebrar a tela. O registro é **append-only**: como `tipo` não é editável (CAP-12), remover uma mídia deixaria seus itens sem conserto possível.

## Constraints

- Nenhuma chamada `.from()` fora de `packages/shared/src/data/`. Cultura precisa de módulo dono no núcleo, devolvendo modelo de domínio e nunca linha crua.
- Migration nunca vai por `supabase db push` sem confirmação explícita: o projeto está linkado e o push atinge produção. Gerar o `.sql` em `supabase/migrations/` e perguntar.
- **Áudio só busca em provedor sem chave.** iTunes Search é o primário para podcast e álbum, e o fallback de álbum é o MusicBrainz. Nenhum provedor que exija credencial entra para áudio — descarta Spotify, Listen Notes e Podcast Index de antemão.
- Chave de provedor não pode ir no bundle do cliente. TMDB e Google Books exigem chave, e guardá-las pede edge function Deno, no padrão de `strava-oauth`. **É esta constraint que impede a CAP-1 de ser feita inteira no cliente** — junto do CORS e do rate-limit do MusicBrainz.
- **Livro depende de provedor com chave.** A Open Library não tem catálogo brasileiro contemporâneo, então o Google Books é o único que serve — e sem `GOOGLE_BOOKS_API_KEY` ele esbarra na cota anônima por IP. Descoberto no uso real em 2026-08-22.
- **A saída manual não pode depender de lista vazia.** Provedor que devolve resultado irrelevante é tão terminal quanto provedor que não devolve nada; esconder o cadastro à mão nesse caso deixa o usuário sem saída justo quando ele mais precisa.
- O MusicBrainz exige `User-Agent` próprio e limita a um pedido por segundo. A edge function espaça os pedidos, e ao estourar o limite devolve **resultado parcial em vez de falhar a busca inteira** — perder o fallback de álbum é aceitável; perder a busca não.
- `indicado_por` é **coluna de topo, nunca dentro do `extra`**: é cross-tipo e precisa ser agregável. E precisa de autocomplete sobre os valores já usados, casando **sem distinção de caixa e reusando a grafia existente** — texto livre sem convergência transforma uma pessoa em três grafias e mata a agregação, que é o único motivo do campo existir.
- O vocabulário de estado não pode ser o do livro. Nomear a coluna ou o enum em "ler/lido" travaria filme, podcast e álbum — daí a CAP-8.
- O módulo recebe `cultura: { tint: '#EBE3F3', accent: '#8B6BB1' }` no map `MOD`. Roxo é a única faixa livre entre os oito accents atuais.
- RLS por `user_id` em toda tabela nova.
- Lógica de domínio escrita uma vez no shared e consumida pelos dois apps: nenhum basename repetido entre `web/src` e `mobile/src`.
- Mobile não importa Reanimated (ADR 0010) — animação é `Animated` do React Native.

## Non-goals

- **Registro de sessão.** Nenhuma tabela de "consumi neste dia". Decisão explícita do usuário, e é ela que fixa o teto analítico descrito no Why.
- **Rastreio de progresso.** Nem página, nem percentual, nem episódio atual.
- **Estado de abandono.** Três estados apenas. O que se larga é deletado (CAP-10) — o app não guarda que houve tentativa, e "quanto tempo aguentou antes de largar" não é uma pergunta respondível.
- **Histórico de consumos repetidos.** Reler é permitido (CAP-2), mas sobrescreve a conclusão anterior. O módulo guarda a última janela, não todas.
- **Motor de correlação.** Cultura entrega a janela consultável (CAP-5) e para aí. Destravar o `triggerImpact` é o item A6 do backlog de instrumentação.
- **Importar histórico** de Goodreads, Letterboxd, Spotify Wrapped ou similar.
- **Recomendação** do que consumir a seguir.
- **Qualquer superfície social** — o Orbe é single-user por construção.

## Success signal

No mobile, adicionar um item leva uma busca e um toque, sem digitar autor nem capa — e o que nenhum provedor conhece ainda entra à mão. Na web, `/cultura` reúne o que ele anda lendo, vendo e ouvindo, informação que hoje não existe junta em nenhum app dele.

O teste da promessa: **um item de cada uma das quatro mídias entra pela busca, atravessa os três estados e sai com nota — sem que nenhum rótulo de livro apareça na tela de um álbum.**

## Assumptions

- Podcast e álbum entram como tipos do v1, não apenas como possibilidade futura — o usuário os nomeou concretamente.
- Podcast é o único tipo sem provedor de fallback: o iTunes é o único keyless que o cobre bem. A assimetria é aceita, não esquecida.
- Usuário único autenticado, herdado do resto do app.

## Open Questions

Nenhuma.
