# Backlog de features — Orbe

Ideias de módulo ainda não especificadas. Entra aqui o que o usuário pediu para não
perder; sai daqui quando vira spec.

## Saiu do backlog

- **F1 (Livros) + F2 (Filmes) → [spec de Cultura](../../docs/specs/cultura/spec.md)**, em 2026-08-22.
  Especificadas juntas como o módulo **Cultura**, com `tipo: livro | filme`. As decisões
  fechadas e as 5 questões ainda abertas vivem no `.memlog.md` daquela pasta — não aqui.
  As entradas abaixo ficam como registro do que originou a spec.

Este documento é lista de trabalho, não ensaio. **Ideia registrada ≠ decisão fechada** —
tudo em "Em aberto" espera resposta humana antes de virar spec.

Backlogs irmãos, com escopo próprio:
- `_bmad-output/implementation-artifacts/deferred-work.md` — dívida técnica saída dos builds.
- `_bmad-output/brainstorming/brainstorm-insights-ia-analitica-orbe-2026-08-21/backlog-instrumentacao.md`
  — o que instrumentar para a IA analítica futura.

---

## F1 — Livros

**Pedido do usuário em 2026-08-22.** Rastrear leitura no Orbe.

- **Captura:** o que o usuário está lendo, leu e quer ler.
- **Destrava:** leitura vira série temporal cruzável — páginas/noite × sono, hábito de ler
  antes de dormir × latência de início (o tipo de insônia que ele tem), leitura × dias
  sem treino.

## F2 — Filmes

**Pedido do usuário em 2026-08-22.** Rastrear o que assistiu.

- **Captura:** filme/série assistido, quando, o que achou.
- **Destrava:** consumo audiovisual como variável de contexto — tempo de tela à noite ×
  sono, maratona de fim de semana × treino do dia seguinte.

---

## Por que as duas juntas

São a **mesma classe de modelo** e provavelmente uma feature só com dois tipos, não duas
features independentes. Decidir isso é a primeira pergunta do spec.

**O que já é certo:** nenhum dos três modelos existentes serve.

| Modelo existente | Por que não serve |
|---|---|
| `Registros` | Marca binária 1×/dia, item fixo criado pelo usuário. Livro/filme é entidade nova a cada vez, com estado que **evolui** (lendo → lido) |
| `Habitos` | Contador diário com meta. "Ler" cabe como hábito; **"ler _O Nome da Rosa_" não** — o hábito não guarda qual livro |
| `Tarefas` | To-do com agendamento e conclusão única. Livro não é tarefa: não tem prazo e o progresso é parcial |

Livro e filme são **entidade com estado e progresso** — a primeira do app que não é nem
marcação diária nem contador. É o que torna isso um módulo novo, e não um campo em algo
que já existe.

**Encaixe na fase atual:** a sessão de 2026-08-21 fechou que a fase é *criação/coleta de
features do super app pessoal, para cruzar os dados depois*. Livros e filmes são
exatamente isso — contexto de vida que o relógio nunca vê.

---

## Em aberto (decidir no spec)

1. ~~**Um módulo ou dois?**~~ **DECIDIDO em 2026-08-22 pelo usuário: módulo único** com
   `tipo: livro | filme`. Evita repetir as mesmas decisões em dois specs e o risco de
   divergirem. Custo aceito: campos específicos de cada tipo (páginas/autor vs
   duração/diretor) convivem no mesmo modelo.
2. **Estados.** `quero` → `em andamento` → `concluído` + `abandonado`? Abandonado é dado
   valioso — quanto tempo aguentou antes de largar.
3. **Progresso.** Livro: página atual, % ou nada? Registrar progresso é o que permite
   "páginas por noite"; sem isso só se sabe a data em que terminou.
4. **Nota subjetiva.** Reusar a escala 1–5 dos ratings diários mantém uma escala só no app.
5. **Catálogo externo.** Digitar título na mão, ou buscar em API (Google Books / TMDB) para
   trazer capa, autor, duração? Muda o esforço de forma drástica — e é a única questão aqui
   com dependência externa.
6. **Onde vive.** Aba **Mais** no mobile (padrão de Registros e Metas) + página web para
   análise? É o padrão do repo, mas vale confirmar se merece captura mais rápida.
7. **Data de consumo.** Só a data de conclusão, ou sessões (assisti/li em tais dias)?
   Sessões são o que habilita o cruzamento com sono — sem elas, o dado é fraco
   analiticamente. **Esta é a decisão que mais afeta o valor futuro.**

> Item 7 é irrecuperável no sentido do backlog de instrumentação: registrar só "terminei
> o livro em 12/09" não permite reconstruir depois em que noites ele leu. Se o cruzamento
> com sono importa, as sessões precisam existir desde o v1.
