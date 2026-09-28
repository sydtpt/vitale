# 0058 — A paleta que promete daltonismo declara por esquema

**Status:** aceita
**Data:** 2026-09-28
**Complementa:** [0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md) (cor de módulo é papel, não
hex autorado) e [0022](0022-tint-de-recorde-e-derivado-do-esquema.md) (cor literal não responde a
tema — o mesmo erro de categoria, um nível acima)

## Contexto

A paleta **Acessível** existe para uma promessa só: separar sob daltonismo. As outras cinco otimizam
estética e medem 0,4–1,1 de separação mínima sob deuteranopia; ela mede 8,0. É o que justifica ela
ficar fora da contagem das cinco de caráter.

Em 28/09/2026 a promessa foi medida **no hex que a tela mostra**, e não no que a paleta declara.
Os números são outros:

| par de módulo | declarado | na tela | onde |
|---|---|---|---|
| `food × casa` | 14,6 | **1,0** | Clean elevado claro, deuteranopia |
| `treino × food` | 27,7 | **2,0** | Clean elevado claro, deuteranopia |
| `financas × cultura` | 19,5 | **2,5** | Clean escuro, deuteranopia |
| `treino × casa` | 13,1 | **2,9** | Clean elevado claro, deuteranopia |

São **15 pares** abaixo do piso de 5,0 que o próprio teste da paleta cobra — e o teste estava verde,
porque lia `PALETTES.find(cvdSafe).roles[...]`, os hex declarados.

### O mecanismo: a escada amputada

Sob deuteranopia os onze papéis da Acessível colapsam em **três famílias de matiz** — amarelo-verde
(~108°), azul-violeta (~284°) e o acromático. Dentro de uma família a cor é a mesma: **só a
luminosidade separa**. A maior família carrega cinco módulos: Hábitos, Alimentação, Saúde, Treino e
Casa.

Isso não é acidente da Acessível, é o desenho dela. A própria nota em `palettes.ts` já dizia, sobre
os papéis `purple` e `red`: *"daltonismo preserva luminância, então claro/escuro do mesmo matiz
continua separável"*. A paleta é uma **escada de luminância** de L 0,29 a L 0,90.

Cada esquema tem uma janela de luminância, e ela é menor que a escada:

- **claro:** nada acima de `L 0,67` alcança 3:1 sobre branco;
- **escuro:** nada abaixo de `L 0,47` alcança 3:1 sobre preto.

O `ensureContrast` empurra cada papel **que falha** até exatamente o piso, um por um, sem olhar para
os vizinhos. O que já passava fica onde estava. Então tudo o que estava fora da janela se empilha na
borda dela: no claro `yellow` (0,90), `brown` (0,75) e `teal` (0,73) descem para ~0,66 enquanto o
`orange` fica em 0,62 — três degraus que valiam 0,15 de distância viram uma faixa de 0,05. No escuro
acontece o espelho, com `ink` (0,29) subindo para junto de `purple` (0,48).

**O piso de contraste move exatamente o eixo que carrega a promessa.** Um teste que meça o declarado
nunca vê isso.

## Decisão

**Uma paleta pode declarar papéis por esquema, e a declaração é lida antes do piso de contraste.**

`AppPalette` ganha `schemeRoles?: Partial<Record<ColorScheme, Partial<AppPaletteRoles>>>`. O laço de
papéis do `resolveTokens` lê `palette.schemeRoles?.[scheme]?.[role] ?? palette.roles[role]` e só
então aplica o `ensureContrast`, que continua existindo como rede — ele deixa de ser quem decide.

Só a Acessível declara, e declara três valores:

| esquema | papel | módulo | era | passa a ser | contraste |
|---|---|---|---|---|---|
| claro | `orange` | Treino | `#D55E00` | `#AB4A00` | 5,66:1 |
| claro | `brown` | Casa | `#C68900` | `#A87300` | 4,10:1 |
| escuro | `purple` | Cultura | `#8B3E6B` | `#A85886` | 4,41:1 |

Escolhidos por busca, com teto de ΔE 10 de mudança visível por módulo. Com eles **nenhum par de
módulo fica abaixo de 5,0 em nenhuma das seis combinações** de tema e esquema. `yellow` e `teal`
continuam passando pelo `ensureContrast` de propósito: o que os salva é os vizinhos saírem de cima
deles, não um valor próprio.

**E o teste passa a medir o resolvido.** A checagem da Acessível lê
`resolveTokens(tema, esquema, 'acessivel').roles[papel].accent` nas seis combinações. Uma segunda
checagem confere que o que a paleta declara por esquema chega intacto na tela — ela reprova se
alguém tirar a leitura de `schemeRoles` de antes do piso.

## Consequências

**O vermelhão canônico da Okabe–Ito sai do claro.** `#D55E00` é a cor que a referência publica, e o
Treino é o módulo mais visível do app. Esse é o preço, e foi aprovado sobre a medição. A paleta já
não era Okabe–Ito pura: `purple` e `red` são variações de luminosidade inventadas, pelo mesmo motivo
de fundo — **oito categorias sobre fundo neutro não cobrem dez módulos sob um piso de contraste de
interface.** Okabe–Ito não foi desenhada para UI.

**De quebra, o acervo de atividades melhora.** `Caminhada × Corrida`, o par mais fraco depois da
Trilha virar púrpura (PR #571), sai de 3,6 — e de 2,0 no Clean elevado — para 9,4.

**Uma troca declarada.** No escuro, o piso das cinco atividades do acervo **cai**, de 10,0–11,1 para
6,4, no par Yoga × Trilha: o púrpura clareia para se separar do Finanças e se aproxima do verde.
Continua acima do piso de 5,0, e a troca foi aceita com o número à vista.

**O mecanismo serve a quem vier.** Uma paleta nova que dependa de luminância tem onde declarar. As
cinco estéticas não declaram nada e seguem idênticas — o raio de explosão desta ADR é uma paleta.

## Alternativas consideradas

**Endurecer o `ensureContrast` para preservar a escada.** Consertaria todas as paletas de uma vez,
e mudaria a cor derivada das outras cinco, que ninguém pediu. Raio de explosão de seis contra um.

**Só a catraca: não mexer em cor e reescrever o teste para medir o resolvido, travando no pior de
hoje (1,0).** Torna a mentira visível e rastreada, e não conserta nada — numa paleta cuja única
razão de existir é a promessa.

**Trocar o papel de um módulo** — Casa sair do marrom, por exemplo. Resolveria por outro caminho e
quebraria a família semântica que a ADR 0018 fixou. Luminosidade é o eixo certo para mexer aqui.

**Estreitar a promessa aos pares que aparecem juntos numa tela**, no molde de `highlight-roles.ts`
(*"a invariante é por fileira, não por tela"*). Não salvaria nada: a Semana e a Retrospectiva mostram
os dez módulos de uma vez, e `food × casa` está entre eles.
