# Relatório de validação — A revista da Retrospectiva

- **DESIGN.md:** `DESIGN.md`
- **EXPERIENCE.md:** `EXPERIENCE.md`
- **Rodado em:** 2026-09-08T01:31
- **Lentes:** contrato + rubric mecânico · acessibilidade · adversarial

## Veredito geral

As espinhas **respeitam a lei**: das 17 restrições do contrato (não 16 — a contagem do
enunciado estava errada), nenhuma é contrariada de frente, e os 11 não-objetivos estão
limpos. CAP-7 e CAP-11 saíram fortes; CAP-8, CAP-9 e CAP-10 saíram parciais; **CAP-6 foi
contrariada por omissão** — a camada de luz não ganhou superfície nenhuma.

O que os três revisores mostram junto é outra coisa, e é mais importante: **o desenho é
sólido onde foi medido e frágil onde não foi renderizado.** Ele descreve bem uma edição —
agosto/2026, quatro cadernos, foto na capa — e essa é a minoria do arquivo: 22 dos 39 meses
do backfill têm um caderno só. E a passagem de UX abriu **sete defeitos dentro do próprio
contrato**, que declarava zero perguntas abertas.

## Vereditos por categoria

| Categoria | Veredito |
|---|---|
| Cobertura contra o contrato | adequada |
| Cobertura de jornadas | adequada |
| Completude de tokens | adequada |
| Cobertura de componentes | **fraca** |
| Cobertura de estados | **fraca** |
| Referências visuais | forte |
| Inchaço e superespecificação | adequada |
| Forma dos documentos | forte |

## Achados por severidade

### Críticos (4)

**[Acessibilidade]** A rolagem ancorada não move o foco do VoiceOver
A única navegação da revista é inerte para quem não enxerga. `setAccessibilityFocus` e
`announceForAccessibility` não aparecem uma vez em `mobile/src/`.
*Corrigido na espinha:* §Accessibility Floor agora exige o foco, declarando que é código
novo.

**[Acessibilidade]** Tipo dinâmico corta a moldura da lua
Altura fixa em px + `overflow:hidden` cortam o veredito em AX3+. Uma configuração de
acessibilidade anula em silêncio a garantia da ADR 0045, para quem tem baixa visão.
*Corrigido na espinha:* a paridade passou a ser de **tratamento**, não de caixa; altura fixa
foi proibida ali.

**[Acessibilidade]** `ink3` carrega informação obrigatória a 2,87–3,05
Assinatura, os cinco rótulos da ficha da lua e o período de cada capa. Sobre `bg`, abaixo
até do piso de objeto gráfico.
*Corrigido na espinha:* esses três passam a `ink2` (7,52 / 7,09), no mesmo corpo.

**[Acessibilidade]** O véu da capa não tem piso
≈1,8 sobre céu branco de foto real. As fotos vêm da biblioteca do iPhone.
*Corrigido na espinha:* o véu se aprofunda até 4,5 contra o pixel mais claro sob o texto.

### Altos (16)

**[Adversarial]** A edição de um caderno é 56% do arquivo — não estava desenhada.
*Decidido:* o sumário existe sempre, com o custo declarado.

**[Adversarial]** CAP-14 não tem superfície: `hidden` é sobre `RetroBlockId`, não sobre
caderno. **Defeito de contrato** — aberto.

**[Adversarial]** A execução da lua não tem chave legal (`caderno='lua'` × CHECK; a PK
impede acumular). **Defeito de contrato** — aberto.

**[Adversarial]** A capa não congela: `coverOf` lê estado mutável. **Defeito de contrato** —
aberto.

**[Adversarial]** Lápide × caderno vazio se contradizem no caso mais provável. **Defeito de
contrato** — aberto.

**[Adversarial]** `posicao` congelada × reimpressão por caderno pode bater no `unique`.
*Ressalva escrita na jornada 2.*

**[Adversarial]** A revista não diz onde mora: os doze blocos e o seletor de período.
*Seção nova §Onde a revista mora, com o buraco declarado.*

**[Rubric]** A "chamada" não tem origem declarada — nem capa nem sumário são construíveis.

**[Rubric]** A tira do anuário não diz o que mede, e substitui `yearSeries` sem citá-lo.

**[Rubric]** ADR 0045 §3 proíbe o negativo atrás de um toque. *Decidido:* mantém a
sub-página e **emenda a ADR** — pré-requisito de construção, não feito.

**[Rubric]** Falta o estado "o teste lunar ainda não rodou". *Corrigido na espinha.*

**[Rubric]** CAP-6 sem superfície: a camada de luz, e o trimestre com luz em destaque.

**[Rubric]** O Do's mandava número em mono, e o texto de caderno é serifado com números
embutidos. *Corrigido:* a fronteira é tabela × frase.

**[Rubric]** Botão de imprimir e fase sinódica sem especificação visual. *Corrigido no
frontmatter.*

**[Rubric]** O Arquivo não tem estado nenhum.

**[Verificado no código]** Os ícones não vinham do `ICON_MAP` "intacto": não há bicicleta
ali. *Corrigido:* `bicycle-outline` declarado como novo, com o viés assumido.

### Médios (25) e baixos (13)

Nos relatórios individuais. Predominam falta de especificação de componente e de estado —
as duas categorias que saíram fracas.

## Arquivos de revisão

- `review-rubric.md` — contrato + rubric mecânico
- `review-acessibilidade.md`
- `review-adversarial.md`
