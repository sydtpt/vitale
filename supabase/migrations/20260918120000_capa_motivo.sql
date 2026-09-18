-- Orbe — A capa carimbada passa a guardar o PORQUÊ, e a atividade da foto.
-- Story 1.16 · spec: _bmad-output/implementation-artifacts/spec-1-16-a-capa-aberta-e-a-troca.md
--
-- **É a segunda migração do Épico 1.** A da 1.9 (`20260912120000_edicao_por_caderno`)
-- se declarou "a ÚNICA migração do Épico 1" — a instância é única, não há staging, e
-- cada janela custa um build. O dono abriu esta segunda em 18/09/2026, ao decidir que a
-- capa aberta diz por que aquela foto está ali: o porquê não pode ser reconstruído
-- depois, porque `coverOf` lê `isCover` e o vínculo, os dois mutáveis depois do
-- carimbo. O que congela guarda valor, não ponteiro a re-derivar.
--
-- A de 1.9 **não é editada**: ela já foi aplicada, e o `sha` dela está fixo no
-- `aplicar.sh` daquela janela.
--
-- ## Aditiva e compatível nos dois sentidos, por construção
--
-- - **As duas colunas nascem NULAS.** O build anterior grava a capa sem elas
--   (`gravarCapa` lista as colunas do upsert, e as novas não estão lá): com
--   `not null`, toda impressão dele passaria a falhar no carimbo — e o carimbo
--   engole a falha, então a capa sumiria calada.
-- - **O risco aceito, declarado.** Nulo não é garantia de "o build velho gravou": o
--   upsert dele é `insert … on conflict do update` só das colunas que ele conhece.
--   Numa linha que o build NOVO já carimbou, uma reimpressão inteira feita pelo
--   build velho troca a foto, a identidade e a legenda — e **mantém** o `motivo` e o
--   `foto_activity_id` da capa anterior, que passam a descrever outra foto. Só
--   acontece com um build anterior reimprimindo a edição inteira durante a janela
--   (a reimpressão inteira só aparece com zero cadernos impressos), e é o preço
--   aceito na spec da 1.16 para a migração ser aditiva. **Sem trigger** para
--   limpar: o conserto é a próxima impressão ou troca pelo build novo, que escreve
--   as duas colunas sempre.
-- - **`capa_identidade_bate_com_natureza` não é apertado** pelo mesmo motivo: o build
--   anterior não sabe o que é `foto_activity_id`.
-- - **O motivo das capas já carimbadas NÃO é reconstruído.** As duas de produção ficam
--   com `motivo` nulo, e a ficha diz que foram impressas antes de o app guardar o
--   porquê. Inferir hoje ("tinha estrela?") leria um estado que já andou — é
--   exatamente o que esta coluna existe para não fazer.

-- ── 1. As colunas ───────────────────────────────────────────────────────────
--
-- A lista do CHECK é `MOTIVOS_DA_CAPA` de `packages/shared/src/data/edicoes-capa.ts`,
-- letra por letra, e a barreira do `architecture.test.ts` compara as duas. A forma
-- `check (motivo in (…))`, com a coluna logo depois do parêntese, é a que a barreira
-- sabe ler — e o nome da constraint é o implícito do Postgres escrito por extenso,
-- para um `drop constraint` futuro achá-la pelo mesmo nome.
--
-- - `estrela`  — a foto escolhida tinha a estrela do dono;
-- - `rajada`   — o meio da maior rajada do período, sem estrela nenhuma;
-- - `unica`    — era a única foto elegível e vinculada do período;
-- - `trocada`  — o dono trocou a capa na ficha (ato dele, não escolha do app);
-- - `sem-foto` — natureza `tracado` ou `grade`: não havia foto que fosse capa.
--
-- `foto_activity_id` é `text` porque `activities.id` é `text`. **Sem chave
-- estrangeira**, pelo mesmo motivo de `foto_id`: o carimbo guarda valor, e uma FK com
-- `cascade` apagaria a capa de um período fechado no dia em que a atividade saísse.

alter table public.edicoes_capa
  add column motivo text
    constraint edicoes_capa_motivo_check
    check (motivo in ('estrela', 'rajada', 'unica', 'trocada', 'sem-foto')),
  add column foto_activity_id text;

comment on column public.edicoes_capa.motivo is
  'Por que esta capa: estrela, rajada, unica, trocada ou sem-foto — carimbado na impressão ou na troca. NULO = capa carimbada antes da Story 1.16 (o porquê não é reconstruído).';
comment on column public.edicoes_capa.foto_activity_id is
  'A atividade da foto da capa (activities.id), só na natureza foto. Valor, não ponteiro: sem chave estrangeira.';

-- ── 2. A atividade das capas de foto que já existem ──────────────────────────
--
-- **Isto é valor, não reconstrução** — e é por isso que o motivo não entra aqui e a
-- atividade entra. A foto é única por `(user_id, activity_id, taken_at)`: o
-- `activity_id` dela nunca muda depois do vínculo, então lê-lo hoje dá o mesmo que
-- teria dado no dia do carimbo. O motivo, ao contrário, dependia de `is_cover` e do
-- conjunto de fotos vinculadas, e os dois andaram.
--
-- A foto que já saiu do acervo não tem de onde tirar a atividade: a capa fica com
-- `foto_activity_id` nulo, e a ficha mostra o porquê e o quando, sem atividade e sem
-- rota — a mesma degradação de uma atividade que não se acha.

update public.edicoes_capa c
   set foto_activity_id = p.activity_id
  from public.activity_photos p
 where c.natureza = 'foto'
   and c.foto_activity_id is null
   and p.id = c.foto_id
   and p.user_id = c.user_id;
