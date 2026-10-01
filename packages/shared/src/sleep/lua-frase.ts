/**
 * A **regra de composição** da frase coletiva da página da lua — e o vocabulário
 * que os blocos de fase imprimem.
 *
 * ## Por que uma regra, e não uma lista de casos
 *
 * O veredito é **por fase** e tem três valores, então uma execução tem **81
 * tuplas** possíveis (3⁴), mais o estado pré-execução. Redação autorada existe
 * para três delas, e a prancha de UX rende exatamente essas três. Escrever 81
 * redações não é opção; o que existe é a regra de quatro passos de
 * `EXPERIENCE.md` § *A regra de composição*
 * (`_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/`),
 * e é ela que mora aqui.
 *
 * **Ela é núcleo, e não tela, por uma razão mensurável:** o mobile não tem
 * renderizador de teste, então uma regra escrita dentro de um componente só
 * poderia ser coberta por barreira de texto-fonte. Aqui ela é varrida **por
 * tupla** — as 81, uma a uma, em `lua-frase.test.ts`.
 *
 * ## Os quatro passos, e a ordem deles
 *
 * 1. **O portão da luz vem antes de tudo**, porque é global às quatro
 *    (`lua-protocolo.ts`: *"Portão 1 — a luz. Global às quatro"*). Com noite sem
 *    horas de luz no acervo, as quatro param no mesmo portão, **nenhum poder foi
 *    calculado**, e as duas linhas trazem o mesmo motivo. Nesse caso é
 *    **proibido** escrever *"não houve poder"*: seria falso, e mandaria esperar
 *    cem noites quando o que falta é consertar dado que já está no acervo.
 * 2. **O compartimento 1 conta quantas decidiram, dentro da família.** *Decidir*
 *    é **chegar a um veredito com poder** — `achado` **ou** `nenhum_padrao`. Só
 *    `inconclusivo` é não decidir. Os denominadores são **1** e **3**, nunca 4:
 *    o §2 do pré-registro de 28/09 proíbe por escrito juntar as quatro num só
 *    resultado.
 * 3. **O compartimento 2 diz o quê, ou por quê, e nunca quanto.** Nenhum número
 *    de `falta` sobe para a frase — as quatro unidades não se contam na mesma
 *    moeda, e somá-las imprimiria outra coisa com o nome de noite (a lição do
 *    *"1 dias"* da story 2.8). O que sobe é o **motivo**, e com motivos mistos
 *    sobe a **partição**, nunca o motivo majoritário.
 * 4. **A invariância é de forma:** duas linhas, dois compartimentos cada, em
 *    qualquer tupla e no estado pré-execução. Nenhuma some, não há variante
 *    curta, e as duas nunca viram um número só.
 *
 * ## O verbo é "decidir", e o custo está declarado
 *
 * Com `decidir = achado`, quatro `nenhum_padrao` e quatro `inconclusivo`
 * escreviam **a mesma primeira linha**, e a distinção que a §5 de 07/09 chama de
 * *o erro mais fácil deste documento* ficava só no compartimento menor. Com o
 * veredito com poder, o compartimento **grande** já as separa: quatro
 * `nenhum_padrao` dizem *"As três decidiram."* e quatro `inconclusivo` dizem
 * *"Nenhuma das três decidiu."* O custo é que *decidiu* deixa de significar
 * *achou algo* — e é o compartimento 2, que nunca desaparece, que desfaz isso na
 * mesma frase.
 *
 * ## Puro, e sem decidir nada do teste
 *
 * Nada aqui calcula veredito, p, poder nem efeito: a entrada é o que o motor já
 * produziu (ou o que o banco devolveu). α, lateralidade, direção e família saem
 * de `PROTOCOLO_LUNAR`. Esta é a camada que **escreve palavras** sobre números
 * que outro arquivo mediu — ADR 0049, do outro lado: ali o motor de IA escreve
 * palavras e o código escreve números; aqui não há motor nenhum, e as palavras
 * são regra, não narração. A página **não assina modelo**.
 *
 * **Toda a redação deste arquivo é autorada na espinha de UX**, não decidida pelo
 * dono. O que ele decidiu é a **forma** (dois compartimentos, nada desaparece,
 * sem variante curta) e o **placar por família**. Mudar uma palavra daqui mexe no
 * que a emenda de 01/10 da ADR 0045 declara satisfeito, então não se muda sem
 * perguntar.
 */
import { PHASE_ORDER, type LunarPhaseKind } from '../astro/moon';
import { formatarNumero, porExtenso } from '../format/numero';
import {
  ALFA_DAS_TRES,
  ALFA_DA_CHEIA,
  LIMIAR_PRATICO_MIN,
  PODER_MINIMO,
  PROTOCOLO_LUNAR,
  type FamiliaLunar,
  type MotivoDoInconclusivo,
  type OQueFalta,
  type ResultadoDaFase,
  type UnidadeDoQueFalta,
  type VereditoLunar,
  type VereditoLunarCompleto,
} from './lua-protocolo';

/* ─────────────────────── O vocabulário das quatro fases ─────────────────────── */

/**
 * O nome de cada fase, como o bloco a imprime.
 *
 * Não sai de `moonPhaseName`: aquela função nomeia uma **fase observada** por
 * fração iluminada, com faixas ("Crescente gibosa"), e aqui o que se nomeia é uma
 * das quatro **fases do protocolo**. São vocabulários diferentes com palavras
 * parecidas, e misturá-los faria o bloco do quarto crescente mudar de nome
 * conforme o dia.
 */
export const NOME_DA_FASE: Readonly<Record<LunarPhaseKind, string>> = Object.freeze({
  new: 'Lua nova',
  firstQuarter: 'Quarto crescente',
  full: 'Lua cheia',
  lastQuarter: 'Quarto minguante',
});

/**
 * A fase dentro de *"nas noites que antecedem …"* — com o artigo, porque ele
 * concorda com o nome e não com a fase.
 *
 * A cheia aparece como *"a cheia"* e não *"a lua cheia"*: é assim que a frase
 * coletiva aprovada em tela a nomeia, e é o mesmo nome que o rótulo da família
 * usa.
 */
export const ANTES_DA_FASE: Readonly<Record<LunarPhaseKind, string>> = Object.freeze({
  new: 'a lua nova',
  firstQuarter: 'o quarto crescente',
  full: 'a cheia',
  lastQuarter: 'o quarto minguante',
});

/**
 * O rótulo **curto** de cada fase — o que cabe sob uma janela de cinco células na
 * figura do ciclo sinódico.
 *
 * Mora aqui, com os outros dois, porque vocabulário de fase em três arquivos é
 * vocabulário que divergem: a tela que o declarava por conta própria podia
 * rebatizar o quarto crescente sem nada reclamar, e o nome da fase é a única coisa
 * que liga o disco destacado ao bloco que o explica.
 */
export const ROTULO_CURTO_DA_FASE: Readonly<Record<LunarPhaseKind, string>> = Object.freeze({
  new: 'nova',
  firstQuarter: 'crescente',
  full: 'cheia',
  lastQuarter: 'minguante',
});

/**
 * A data em que **cada família** foi pré-registrada — a fonte única das três
 * prosas que a citam.
 *
 * Ela não sai de {@link CADEIA_DO_PRE_REGISTRO} porque os elos da cadeia carregam
 * arquivo e sha256, e nenhuma data: o que a cadeia afirma é *quais documentos
 * autorizaram*, não *quando*. Então a data é declarada **uma** vez, aqui, e a razão
 * do grupo, o versalete da página e o rodapé do método derivam dela — antes, as três
 * eram prosa digitada três vezes, e corrigir uma deixava as outras duas mentindo.
 */
export const DATA_DO_PRE_REGISTRO: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia: '07 set 2026',
  'as-tres': '28 set 2026',
});

/** A palavra de veredito, como o bloco a imprime. Três, nunca duas. */
export const PALAVRA_DO_VEREDITO: Readonly<Record<VereditoLunar, string>> = Object.freeze({
  achado: 'achado',
  nenhum_padrao: 'nenhum padrão',
  inconclusivo: 'inconclusivo',
});

/**
 * O que ocupa a **vaga da palavra de veredito** antes da primeira execução.
 *
 * **Não é travessão**, que leria como nulo *medido*, e não é "—" nem "sem dado":
 * é uma palavra de veredito, e sai no degrau e na tinta das outras três
 * (`lua-veredito`, 21/26, serifada, `ink`). Imprimi-la em corpo menor ou em
 * `ink2` são duas das três atenuações que a ADR 0045 §3 proíbe por nome — no
 * estado em que a página passa a maior parte do tempo.
 */
export const SEM_LEITURA = 'sem leitura';

/** O rótulo de cada família, dentro da frase coletiva. */
export const ROTULO_DA_FAMILIA: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia: 'A cheia',
  'as-tres': 'As três',
});

/** O nome de cada grupo, no cabeçalho que carrega o α. */
export const TITULO_DO_GRUPO: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia: 'A cheia, sozinha',
  'as-tres': 'Nova, crescente e minguante',
});

/**
 * A razão da separação, **uma por família** — e ela diz o **fato datado**, não um
 * comparativo.
 *
 * *"Antes das outras três"* instalaria, no menor corpo da página, a hierarquia que
 * a disposição existe para negar: a precedência da cheia é de **procedência** (foi
 * pré-registrada sozinha, com direção tirada da literatura), não de importância. E
 * no grupo vizinho a ausência de literatura é **razão de desenho** — é ela que faz
 * as três serem bilaterais —, não carência delas.
 */
export const RAZAO_DO_GRUPO: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia:
    `Pré-registrada em ${DATA_DO_PRE_REGISTRO.cheia}, com a direção tirada da literatura. A posição `
    + 'aqui é de procedência, não de importância.',
  'as-tres':
    `Nascidas juntas em ${DATA_DO_PRE_REGISTRO['as-tres']}, sem direção na literatura — e é por isso `
    + 'que são bilaterais. Entre as três a correção por multiplicidade se aplica inteira.',
});

/**
 * O α de cada família, **por extenso e com a divisão escrita**.
 *
 * O `1,67%` dos documentos é o arredondado, e ele é **mais frouxo** que 5/3 %; a
 * divisão ao lado é o que impede alguém de ler o arredondado como o protocolo.
 * O α é propriedade de **família**, nunca de fase: imprimi-lo quatro vezes,
 * intercalado, apagaria a fronteira que o agrupamento existe para desenhar (§11
 * de 28/09).
 */
/**
 * O α em porcento, como o cabeçalho o imprime — **derivado da constante**.
 *
 * Nenhum dos dois α é digitado: `1,67%` à mão é um número que concorda com o
 * protocolo por acaso, e um teste que pine o literal passa a provar que alguém
 * digitou o mesmo texto duas vezes. Ele é o arredondado, e é **mais frouxo** que
 * 5/3 % — é por isso que a divisão vai escrita ao lado dele, e é por isso que ela
 * também sai das constantes.
 */
function emPorcento(alfa: number, casas: number): string {
  return formatarNumero(alfa * 100, casas);
}

/** Quantas fases a família das três tem — o divisor da correção por multiplicidade. */
const FASES_POR_FAMILIA_DAS_TRES = PROTOCOLO_LUNAR.filter((l) => l.familia === 'as-tres').length;

export const ALFA_DO_GRUPO: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia: `α ${emPorcento(ALFA_DA_CHEIA, 0)}% · unilateral · direção do atraso`,
  'as-tres':
    `α ${emPorcento(ALFA_DAS_TRES, 2)}% (${formatarNumero(ALFA_DA_CHEIA, 2)} / `
    + `${String(FASES_POR_FAMILIA_DAS_TRES)}) · bilateral`,
});

/** As fases de cada família, **na ordem do protocolo** — a lunação, não a importância. */
export const FASES_DA_FAMILIA: Readonly<Record<FamiliaLunar, readonly LunarPhaseKind[]>> =
  Object.freeze({
    cheia: Object.freeze(PROTOCOLO_LUNAR.filter((l) => l.familia === 'cheia').map((l) => l.fase)),
    'as-tres': Object.freeze(
      PROTOCOLO_LUNAR.filter((l) => l.familia === 'as-tres').map((l) => l.fase),
    ),
  });

/** As duas famílias na ordem de leitura: a cheia primeiro, por procedência. */
export const FAMILIAS_EM_ORDEM: readonly FamiliaLunar[] = Object.freeze<FamiliaLunar[]>([
  'cheia',
  'as-tres',
]);

/**
 * A cadência da **re**execução, em noites (§7.3 de 07/09).
 *
 * Ela governa a reexecução e **não** a primeira: documento nenhum fixa a data da
 * primeira, e fabricar uma no campo *Primeira leitura* seria inventar compromisso.
 */
export const CADENCIA_DE_REEXECUCAO_NOITES = 100;

/* ─────────────────────────── A frase coletiva ─────────────────────────── */

/**
 * Uma linha de família: **dois compartimentos, e nenhum deles some**.
 *
 * `decidiram` e `tamanho` viajam ao lado do texto porque são o que o teste da
 * regra confronta com o numeral escrito — é assim que *"Duas das três
 * decidiram."* deixa de poder discordar de `decidiram: 2`.
 */
export interface LinhaDaFamilia {
  readonly familia: FamiliaLunar;
  /** *A cheia* · *As três* — o rótulo acima dos dois compartimentos. */
  readonly rotulo: string;
  /** Quantas fases da família chegaram a um veredito **com poder**. */
  readonly decidiram: number;
  /** O tamanho da família: **1** ou **3**. Nunca 4. */
  readonly tamanho: number;
  /** Compartimento 1 — o placar da família. */
  readonly placar: string;
  /** Compartimento 2 — o quê, ou por quê. Nunca quanto. */
  readonly porque: string;
  /**
   * A linha como o **leitor de tela** a ouve, numa frase.
   *
   * Ela existe porque o rótulo e o começo do placar são o mesmo texto: *"A cheia"*
   * acima de *"A cheia decidiu."* é legível na tela, onde os dois estão em degraus
   * diferentes, e vira *"A cheia. A cheia decidiu."* quando alguém concatena os
   * três compartimentos — a gagueira que ninguém vê e todo mundo que usa VoiceOver
   * ouve. Quem monta o rótulo acessível lê **daqui**, e não concatena por conta.
   */
  readonly leitura: string;
}

/**
 * As duas linhas, sempre as duas.
 *
 * `linhas` é uma tupla de **dois** no tipo, e não um array: é o que faz uma
 * terceira linha — ou a ausência de uma — virar erro de compilação em vez de uma
 * página que soma 1 + 3.
 */
export interface FraseColetiva {
  readonly cheia: LinhaDaFamilia;
  readonly asTres: LinhaDaFamilia;
  readonly linhas: readonly [LinhaDaFamilia, LinhaDaFamilia];
}

/**
 * A frase que o leitor de tela ouve, **sem repetir o rótulo** que o placar já diz.
 *
 * O placar da cheia começa com o rótulo dela em toda tupla, e o das três começa com
 * ele quando as três decidem. Nos dois casos o rótulo entra uma vez só.
 */
function leituraDe(familia: FamiliaLunar, placar: string, porque: string): string {
  const rot = ROTULO_DA_FAMILIA[familia];
  return placar.startsWith(rot) ? `${placar} ${porque}` : `${rot}. ${placar} ${porque}`;
}

function linha(
  familia: FamiliaLunar,
  decidiram: number,
  placar: string,
  porque: string,
): LinhaDaFamilia {
  return {
    familia,
    rotulo: ROTULO_DA_FAMILIA[familia],
    decidiram,
    tamanho: FASES_DA_FAMILIA[familia].length,
    placar,
    porque,
    leitura: leituraDe(familia, placar, porque),
  };
}

function duasLinhas(cheia: LinhaDaFamilia, asTres: LinhaDaFamilia): FraseColetiva {
  return { cheia, asTres, linhas: [cheia, asTres] };
}

/**
 * Congela uma frase **até o fundo** — as duas linhas, a tupla e cada linha.
 *
 * `Object.freeze` sobre a frase prende só a superfície: `linhas` continua um array
 * mutável e cada `LinhaDaFamilia` continua um objeto mutável. Como as frases
 * constantes deste arquivo são **singletons de módulo** que a mesma referência
 * entrega a todo chamador, um `frase.cheia.placar = …` em qualquer tela mudaria o
 * quarto estado do app inteiro, para sempre, sem erro e sem rastro. `readonly` é
 * do `tsc`; isto é do tempo de execução.
 */
function congelarFrase(f: FraseColetiva): FraseColetiva {
  Object.freeze(f.cheia);
  Object.freeze(f.asTres);
  Object.freeze(f.linhas);
  return Object.freeze(f);
}

/**
 * O estado **pré-execução** — o quarto, e o único em que a página vive hoje.
 *
 * A forma é a mesma das outras: duas linhas, dois compartimentos. O que muda é o
 * verbo, e ele muda porque **não houve leitura**, não porque não houve resultado.
 */
export const FRASE_SEM_LEITURA: FraseColetiva = congelarFrase(
  duasLinhas(
    linha('cheia', 0, 'A cheia não foi lida.', 'A primeira execução autorizada ainda não rodou.'),
    linha(
      'as-tres',
      0,
      'As três não foram lidas.',
      'A primeira execução autorizada ainda não rodou — as quatro rodam juntas, ou nenhuma roda.',
    ),
  ),
);

/**
 * Por que a leitura não respondeu — **e são duas coisas diferentes**.
 *
 * `rede` é a consulta que não voltou: a tabela não existe ainda (é o caso de hoje —
 * a migração não foi aplicada), a sessão caiu, o aparelho está sem rede. `integridade`
 * é a consulta que **voltou** e foi recusada na tradução: execução truncada, assinatura
 * discordante entre as quatro linhas, digest de cadeia que não bate. A primeira pede
 * tentar de novo; a segunda pede consertar dado, e não tentar de novo nunca.
 *
 * Misturá-las foi o defeito: as duas saíam como *"não conseguiu ler"* e a mensagem
 * acionável — que diz exatamente o que consertar — morria num `console.warn`.
 */
export type CausaDaFalhaLunar = 'rede' | 'integridade';

const FRASE_POR_CAUSA: Readonly<Record<CausaDaFalhaLunar, FraseColetiva>> = Object.freeze({
  rede: congelarFrase(
    duasLinhas(
      linha(
        'cheia',
        0,
        'A cheia não foi lida.',
        'Não foi possível ler as execuções agora. Isto não diz que nenhuma rodou.',
      ),
      linha(
        'as-tres',
        0,
        'As três não foram lidas.',
        'A mesma leitura serve as quatro, então as quatro ficam sem resposta juntas.',
      ),
    ),
  ),
  integridade: congelarFrase(
    duasLinhas(
      linha(
        'cheia',
        0,
        'A cheia não foi lida.',
        'A execução gravada foi recusada na leitura, e tentar de novo devolve o mesmo.',
      ),
      linha(
        'as-tres',
        0,
        'As três não foram lidas.',
        'A página diz o que há para consertar — uma execução recusada é dado a arrumar, não rede a esperar.',
      ),
    ),
  ),
});

/**
 * A frase de uma **falha de leitura** — e ela existe para que a linha de entrada
 * **continue aparecendo**.
 *
 * Sem ela a feature era invisível em produção: `lua_execucoes` não existe ainda, as
 * duas leituras lançam, o hook cai na falha, e com a linha desenhando só no estado
 * `pronto` o pé do caderno Sono ficava vazio e `/sono/lua` ficava **inalcançável** —
 * a única porta da página mora nessa linha. A matriz da story confundiu *tabela
 * vazia* com *tabela ausente*: são ramos diferentes, e o quarto estado é o primeiro.
 */
export function fraseDaFalha(causa: CausaDaFalhaLunar): FraseColetiva {
  return FRASE_POR_CAUSA[causa];
}

/* ───────────────────────── Passo 2 — o placar ───────────────────────── */

/**
 * O compartimento 1, com o **verbo concordando com o numeral**.
 *
 * É a lição do *"1 dias"* da story 2.8: o defeito nasce no template escrito para
 * um valor só. Na família da cheia a concordância é **sempre singular** — ela tem
 * uma fase, e *"nenhuma das uma"* não é frase; por isso o texto dela nomeia a
 * fase em vez de contar.
 */
function placarDa(familia: FamiliaLunar, d: number): string {
  if (familia === 'cheia') return d === 0 ? 'A cheia não decidiu.' : 'A cheia decidiu.';
  if (d === 0) return 'Nenhuma das três decidiu.';
  if (d === 1) return 'Uma das três decidiu.';
  if (d === 2) return 'Duas das três decidiram.';
  return 'As três decidiram.';
}

/* ──────────────────── Passo 3 — o compartimento 2 ──────────────────── */

/**
 * O limiar prático, escrito como a frase o diz — **com a unidade concordando**.
 *
 * `${LIMIAR_PRATICO_MIN} minutos` é o template escrito para um valor só, e é
 * exatamente o defeito do *"1 dias"* da story 2.8: o dia em que o limiar baixar
 * para um minuto, a constante muda e a frase passa a dizer *"1 minutos"*. A
 * concordância sai do número, não da memória de quem digitou.
 */
export const LIMIAR_EM_PALAVRAS = comUnidade(LIMIAR_PRATICO_MIN, 'minuto', 'minutos');

/**
 * O número com a unidade **concordando com ele** — a função que apaga o *"1 dias"*.
 *
 * O parâmetro é `number` de propósito: com o tipo literal da constante entrando
 * direto, o `tsc` resolve a comparação em tempo de compilação e **apaga o ramo do
 * singular** (`TS2367`), o que faz o defeito voltar a ser invisível no dia em que a
 * constante mudar.
 */
function comUnidade(quanto: number, um: string, muitas: string): string {
  return `${formatarNumero(quanto, 0)} ${quanto === 1 ? um : muitas}`;
}

/**
 * O sentido do deslocamento medido. A hora de apagar foi para onde?
 *
 * **Nulo não é zero, e zero não é uma direção.** `(efeitoMin ?? 0) < 0` fazia um
 * efeito **não medido** e um efeito **exatamente zero** saírem os dois como *"ficou
 * mais tarde"* — uma afirmação de direção sem medição atrás dela, que é o que
 * `apoioDoBloco` já evita por escrito (*"zero seria mentira"*). Um `achado` com
 * efeito nulo ou zero é dado contraditório; a frase **mostra** a contradição em vez
 * de escolher um lado para ela.
 */
function sentidoDe(efeitoMin: number | null): string {
  if (efeitoMin === null) return 'mudou numa direção que não foi medida';
  if (efeitoMin === 0) return 'não se deslocou em direção nenhuma';
  return efeitoMin < 0 ? 'ficou mais cedo' : 'ficou mais tarde';
}

/** O mesmo sentido, em elipse — a segunda oração coordenada, sem repetir o verbo. */
function sentidoEmElipse(efeitoMin: number | null): string {
  if (efeitoMin === null) return 'em direção não medida';
  if (efeitoMin === 0) return 'sem deslocamento';
  return efeitoMin < 0 ? 'mais cedo' : 'mais tarde';
}

/**
 * A oração dos achados — **nomeia cada fase que achou**, na ordem do protocolo.
 *
 * O compartimento tem de caber **mais de um nome**: com duas ou três achando, as
 * orações se coordenam e a segunda entra em elipse, porque o verbo repete.
 */
function oracaoDosAchados(achadas: readonly ResultadoDaFase[]): string {
  const primeira = achadas[0];
  let texto =
    `Nas noites que antecedem ${ANTES_DA_FASE[primeira.fase]}, a hora de apagar `
    + sentidoDe(primeira.efeitoMin);
  for (const f of achadas.slice(1)) {
    texto += `; nas que antecedem ${ANTES_DA_FASE[f.fase]}, ${sentidoEmElipse(f.efeitoMin)}`;
  }
  return `${texto}.`;
}

/**
 * A oração das que decidiram **sem achar** — `nenhum_padrao`.
 *
 * Sozinha (a família inteira decidiu e nenhuma achou), ela é a frase do caso: na
 * cheia, unilateral, o que não houve é deslocamento **na direção que o teste pode
 * achar**; nas três, bilateral, é em direção nenhuma. O *"com poder"* não precisa
 * ser dito — o compartimento 1 já disse *decidiu*, e é essa palavra que separa
 * isto do inconclusivo.
 *
 * Acompanhada, ela vira a oração que diz **quantas** decidiram sem achar, para
 * que o compartimento não sugira que uma delas ficou sem resposta.
 */
function oracaoDasNulas(
  nulas: readonly ResultadoDaFase[],
  familia: FamiliaLunar,
  sozinha: boolean,
): string {
  if (sozinha && familia === 'cheia') {
    return (
      `Não houve deslocamento de ${LIMIAR_EM_PALAVRAS} ou mais na direção que este teste pode achar.`
    );
  }
  if (sozinha) {
    return `Nenhuma das três mostrou deslocamento de ${LIMIAR_EM_PALAVRAS} ou mais, em nenhuma direção.`;
  }
  const n = nulas.length;
  const verbo = n === 1 ? 'decidiu' : 'decidiram';
  return (
    `${porExtenso(n, 'feminino')} ${verbo} sem achar deslocamento de ${LIMIAR_EM_PALAVRAS} ou mais.`
  );
}

/** O motivo em oração, com o verbo concordando — nunca com o número do que falta. */
function oracaoDoMotivo(motivo: MotivoDoInconclusivo, n: number): string {
  const plural = n !== 1;
  switch (motivo) {
    case 'poder':
      return `${plural ? 'rodaram' : 'rodou'} sem poder para decidir entre as duas colunas`;
    case 'amostra':
      return `${plural ? 'pararam' : 'parou'} no portão da amostra`;
    case 'ciclos':
      return `${plural ? 'pararam' : 'parou'} no portão dos ciclos`;
    case 'luz':
      return `${plural ? 'pararam' : 'parou'} no portão da luz`;
    default:
      return motivoNaoTratado(motivo);
  }
}

function motivoNaoTratado(nunca: never): never {
  throw new RangeError(
    `motivo de inconclusivo sem oração: ${JSON.stringify(nunca)} — `
    + 'acrescente a oração dele em `oracaoDoMotivo` antes de gravar execuções com este motivo.',
  );
}

/**
 * Quem parou num **portão**, quem rodou e **faltou poder**, e quem veio **sem motivo
 * gravado** — a partição que a frase diz.
 *
 * **`f.motivo ?? 'poder'` era a gaveta da story 2.6 nesta função.** Um
 * `inconclusivo` com motivo nulo virava a afirmação *"rodou sem poder"*, que é um
 * motivo inventado: `numeroDoBloco`, onze linhas adiante, devolve `null` para a
 * **mesma** linha e o bloco não imprime nada — então a tela ficava com a frase
 * afirmando um motivo e o bloco sem o número que o sustentaria. Ausência não vira
 * poder: ela vira a terceira fatia desta partição, e a frase manda ao bloco.
 */
function particaoDosMotivos(indecisas: readonly ResultadoDaFase[]): {
  nosPortoes: number;
  semPoder: number;
  semMotivo: number;
  motivoUnico: MotivoDoInconclusivo | null;
} {
  const motivos = new Set<MotivoDoInconclusivo>();
  let nosPortoes = 0;
  let semPoder = 0;
  let semMotivo = 0;
  for (const f of indecisas) {
    if (f.motivo === null) {
      semMotivo += 1;
      continue;
    }
    motivos.add(f.motivo);
    if (f.motivo === 'poder') semPoder += 1;
    else nosPortoes += 1;
  }
  return {
    nosPortoes,
    semPoder,
    semMotivo,
    // Um motivo só **e** nenhuma fase sem motivo: com uma sem, o que há são duas
    // situações, e nomear a da maioria é afirmar pela outra.
    motivoUnico: motivos.size === 1 && semMotivo === 0 ? [...motivos][0] : null,
  };
}

/**
 * A oração das que **não decidiram** — e ela nunca afirma o motivo majoritário.
 *
 * Com um motivo só, ele é nomeado. Com motivos mistos, a frase diz a **partição** e
 * manda ao bloco: *"Duas pararam num portão e uma rodou sem poder; cada bloco diz
 * qual, e em que unidade."* Nenhum número de `falta` entra aqui, em nenhum dos
 * dois caminhos — as quatro unidades não se somam, e a frase pode dizer que faltou
 * poder, nunca quanto.
 */
function oracaoDasIndecisas(
  indecisas: readonly ResultadoDaFase[],
  familia: FamiliaLunar,
  sozinha: boolean,
): string {
  const n = indecisas.length;
  const { nosPortoes, semPoder, semMotivo, motivoUnico } = particaoDosMotivos(indecisas);

  if (motivoUnico !== null) {
    if (sozinha) {
      const sujeito = familia === 'cheia' ? 'O teste' : 'Os três testes';
      return `${sujeito} ${oracaoDoMotivo(motivoUnico, n)}.`;
    }
    const verbo = n === 1 ? 'não decidiu' : 'não decidiram';
    return `${porExtenso(n, 'feminino')} ${verbo}: ${oracaoDoMotivo(motivoUnico, n)}.`;
  }

  // **Todas sem motivo gravado.** Nenhuma partição a declarar, e nada a nomear: a
  // frase diz que não decidiram e que o motivo não está na linha. Afirmar poder
  // aqui era o defeito.
  if (semMotivo === n) {
    const sujeito = familia === 'cheia' ? 'O teste não decidiu' : 'Os três testes não decidiram';
    return `${sujeito}, e a linha gravada não diz por quê; ${AO_BLOCO}`;
  }

  // Mistos. A partição, e o bloco como destino — nunca um motivo falando pelas
  // outras. As três fatias entram com o número delas, e a que é zero não entra.
  const fatias: string[] = [];
  if (nosPortoes > 0) {
    fatias.push(
      `${porExtenso(nosPortoes, 'feminino')} ${nosPortoes === 1 ? 'parou' : 'pararam'} num portão`,
    );
  }
  if (semPoder > 0) {
    fatias.push(
      `${porExtenso(semPoder, 'feminino')} ${semPoder === 1 ? 'rodou' : 'rodaram'} sem poder`,
    );
  }
  if (semMotivo > 0) {
    fatias.push(
      `${porExtenso(semMotivo, 'feminino')} ${semMotivo === 1 ? 'veio' : 'vieram'} sem motivo gravado`,
    );
  }
  if (fatias.length > 1) return `${juntarFatias(fatias)}; ${AO_BLOCO}`;
  // Uma fatia só com mais de um motivo dentro dela: são portões diferentes. A frase
  // diz que são diferentes, e qual é de cada uma fica no bloco.
  return `${porExtenso(nosPortoes, 'feminino')} pararam em portões diferentes; ${AO_BLOCO}`;
}

/** O destino da frase quando ela não pode nomear um motivo por todas. */
const AO_BLOCO = 'cada bloco diz qual, e em que unidade.';

/** `a`, `a e b`, `a, b e c` — a coordenação que o número de fatias pede. */
function juntarFatias(fatias: readonly string[]): string {
  if (fatias.length <= 1) return fatias[0] ?? '';
  return `${fatias.slice(0, -1).join(', ')} e ${fatias[fatias.length - 1]}`;
}

/**
 * A inicial maiúscula de uma oração que virou frase.
 *
 * `porExtenso` devolve a palavra como ela é dentro de uma frase — *"duas"* —, e
 * as orações deste arquivo se tornam frases quando se juntam. Sem isto, o
 * compartimento 2 sai com *"…ficou mais cedo. duas não decidiram"*, que é o
 * mesmo tipo de defeito do *"1 dias"*: template escrito para uma posição só.
 */
function comInicialMaiuscula(oracao: string): string {
  return oracao.length === 0 ? oracao : oracao[0].toLocaleUpperCase('pt-BR') + oracao.slice(1);
}

/** O compartimento 2 de uma família, fora do caminho do portão da luz. */
function porqueDa(familia: FamiliaLunar, fases: readonly ResultadoDaFase[]): string {
  const achadas = fases.filter((f) => f.veredito === 'achado');
  const nulas = fases.filter((f) => f.veredito === 'nenhum_padrao');
  const indecisas = fases.filter((f) => f.veredito === 'inconclusivo');
  const partes: string[] = [];
  const quantas = (achadas.length > 0 ? 1 : 0) + (nulas.length > 0 ? 1 : 0) + (indecisas.length > 0 ? 1 : 0);

  if (achadas.length > 0) partes.push(oracaoDosAchados(achadas));
  if (nulas.length > 0) partes.push(oracaoDasNulas(nulas, familia, quantas === 1));
  if (indecisas.length > 0) partes.push(oracaoDasIndecisas(indecisas, familia, quantas === 1));
  return partes.map(comInicialMaiuscula).join(' ');
}

/* ─────────────── Passo 1 — o portão da luz, antes de tudo ─────────────── */

/**
 * O compartimento 2 quando o portão da luz reprovou — o **único** motivo que sobe
 * para as duas linhas.
 *
 * Ele sobe porque é propriedade do **acervo**, não da fase: acima de zero, as
 * quatro param juntas. As duas orações dizem o mesmo motivo com palavras
 * diferentes porque a segunda tem de dizer, além do motivo, que ele é o mesmo das
 * quatro — e que estas noites **não se coletam**: conserta-se o dado de quem as
 * produziu.
 */
const PORQUE_DA_LUZ: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia:
    'O portão da luz reprovou antes de qualquer cálculo: há noites no acervo sem horas de luz do dia.',
  'as-tres':
    'O mesmo portão, que é global às quatro: sem a luz, nenhum poder foi calculado. Estas noites '
    + 'não se coletam — conserta-se o dado.',
});

/* ─────────────────────────── A porta ─────────────────────────── */

/**
 * A frase coletiva de uma execução — **as duas linhas, de uma vez**.
 *
 * `fases` são as quatro que o motor produziu (ou que o banco devolveu), e
 * `noitesSemLuz` é `acervo.noitesSemLuz`. A função **não calcula nada do teste**:
 * ela lê veredito, motivo, família e o sinal do efeito, e escreve.
 *
 * Lança quando a execução não chegou inteira, e a mensagem diz **o que fazer** —
 * uma execução truncada é leitura recortada, não dado torto.
 *
 * **O acervo sem luz e uma fase que decidiu não convivem**, e é por isso que o
 * placar sai dos vereditos mesmo no caminho da luz: o motor retorna
 * `inconclusivo` nas quatro antes de calcular poder nenhum, então `d` é zero ali
 * por construção. Se um dia as duas coisas aparecerem na mesma linha, o que está
 * errado é a linha, e a frase vai mostrar a contradição em vez de escondê-la.
 */
export function comporFraseColetiva(
  fases: readonly ResultadoDaFase[],
  noitesSemLuz: number,
): FraseColetiva {
  conferirAsQuatro(fases);
  conferirAPortaDaLuz(fases, noitesSemLuz);
  const porFamilia = (familia: FamiliaLunar): LinhaDaFamilia => {
    const daFamilia = FASES_DA_FAMILIA[familia].map((fase) => acharFase(fases, fase));
    const d = daFamilia.filter((f) => f.veredito !== 'inconclusivo').length;
    const porque = noitesSemLuz > 0 ? PORQUE_DA_LUZ[familia] : porqueDa(familia, daFamilia);
    return linha(familia, d, placarDa(familia, d), porque);
  };
  return duasLinhas(porFamilia('cheia'), porFamilia('as-tres'));
}

/**
 * A frase de uma execução lida do banco — ou o estado pré-execução, quando não há
 * nenhuma.
 *
 * É a porta que a tela e a linha de entrada no pé do caderno Sono usam, e é por
 * ela que as duas dizem **a mesma coisa, palavra por palavra**: duas composições
 * independentes é o caminho mais curto para a linha virar resumo da página.
 */
export function fraseColetivaDe(execucao: VereditoLunarCompleto | null): FraseColetiva {
  if (execucao === null) return FRASE_SEM_LEITURA;
  return comporFraseColetiva(execucao.fases, execucao.acervo.noitesSemLuz);
}

function acharFase(fases: readonly ResultadoDaFase[], fase: LunarPhaseKind): ResultadoDaFase {
  const achada = fases.find((f) => f.fase === fase);
  if (achada === undefined) {
    throw new Error(
      `a frase coletiva não achou a fase ${fase} na execução — as quatro são `
      + `${PHASE_ORDER.join(', ')}. Leia a execução inteira antes de compor: `
      + '`fetchUltimaExecucaoLunar` traz as quatro linhas numa consulta, e `toLuaExecucao` recusa '
      + 'um recorte. Se uma fase chegou faltando, o que falhou foi a consulta.',
    );
  }
  return achada;
}

/**
 * **O portão da luz é global às quatro, e a frase e o bloco têm de concordar.**
 *
 * `noitesSemLuz` governa as duas linhas da frase coletiva; `portaoReprovado` governa
 * o bloco de cada fase. Com os dois discordando, a mesma tela afirmava as duas
 * coisas: a frase dizia *"o portão da luz reprovou, global às quatro"* e os blocos
 * imprimiam efeito medido — ou o contrário, quatro blocos dizendo *"efeito não
 * medido: o portão reprovou antes"* sob uma frase que nomeava poder.
 *
 * As duas direções são recusadas, porque as duas são a mesma incoerência vista de
 * lados opostos, e nenhuma delas é produzível por `vereditoLunar`: acima de zero o
 * motor para as quatro no portão da luz, e em zero nenhuma para nele. Uma dessas
 * linhas no banco é dado a consertar, e a frase não tem como escolher qual metade
 * está certa.
 */
function conferirAPortaDaLuz(fases: readonly ResultadoDaFase[], noitesSemLuz: number): void {
  const naLuz = fases.filter((f) => f.portaoReprovado === 'luz').length;
  if (noitesSemLuz > 0 && naLuz === fases.length) return;
  if (noitesSemLuz === 0 && naLuz === 0) return;
  throw new Error(
    `a frase coletiva recebeu noitesSemLuz = ${String(noitesSemLuz)} com ${String(naLuz)} de `
    + `${String(fases.length)} fases paradas no portão da luz — o portão é global às quatro, então `
    + 'as duas contagens são a mesma afirmação: acima de zero as quatro param nele, e em zero '
    + 'nenhuma para. Confira que `acervo.noitesSemLuz` e as quatro linhas vieram da MESMA '
    + 'execução: `fetchUltimaExecucaoLunar` traz as quatro numa consulta e `toLuaExecucao` recusa '
    + 'um recorte, e misturar o acervo de uma execução com as fases de outra produz exatamente isto.',
  );
}

function conferirAsQuatro(fases: readonly ResultadoDaFase[]): void {
  if (fases.length === PHASE_ORDER.length) return;
  const conselho =
    fases.length < PHASE_ORDER.length
      ? 'Peça a execução inteira: `fetchUltimaExecucaoLunar` ordena por (rodada_em desc, '
        + 'execucao_id desc, fase asc) e limita a quatro, e `toLuaExecucao` recusa um recorte. '
        + 'Compor com menos de quatro escreveria um placar de família sobre fases que ninguém leu.'
      : 'Mais de quatro são duas execuções juntas: filtre por um `execucao_id` só antes de compor, '
        + 'senão as duas linhas falam de execuções diferentes na mesma frase.';
  throw new Error(
    `a frase coletiva precisa das ${String(PHASE_ORDER.length)} fases e recebeu `
    + `${String(fases.length)}. ${conselho}`,
  );
}

/* ─────────────────── O vocabulário dos blocos de fase ─────────────────── */

/** O número de um bloco, com a **unidade dele** e a legenda que o explica. */
export interface NumeroDoBloco {
  /** O valor com a unidade colada — nunca um sem o outro. */
  readonly valor: string;
  /** A legenda, logo abaixo: o que aquele número conta. */
  readonly legenda: string;
}

/**
 * O substantivo de cada unidade, em singular e plural.
 *
 * `noites-coletaveis` é o identificador que o banco aceita, **sem acento**; a
 * palavra exibida é a acentuada. Quem as confundir grava um valor que o CHECK
 * recusa, ou imprime um identificador na tela.
 */
const PALAVRA_DA_UNIDADE: Readonly<Record<UnidadeDoQueFalta, { um: string; muitas: string }>> =
  Object.freeze({
    'noites-sem-luz': { um: 'noite sem horas de luz', muitas: 'noites sem horas de luz' },
    'noites-de-coluna': { um: 'noite de coluna', muitas: 'noites de coluna' },
    ciclos: { um: 'ciclo', muitas: 'ciclos' },
    'noites-coletaveis': { um: 'noite coletável', muitas: 'noites coletáveis' },
  });

/**
 * A legenda do que falta, **por motivo**: o que aquele número conta, e por que ele
 * não é noite quando não é noite.
 *
 * *"Faltam N noites"* só é frase verdadeira em `noites-coletaveis`. Imprimi-la
 * sobre `ciclos` erraria por ~118 dias — quatro ciclos sinódicos são 118,1.
 */
const LEGENDA_DO_MOTIVO: Readonly<Record<MotivoDoInconclusivo, string>> = Object.freeze({
  luz: 'noites-sem-luz · o portão da luz reprovou',
  amostra: 'noites-de-coluna · o portão da amostra reprovou',
  ciclos: 'ciclos · o portão dos ciclos reprovou',
  poder: `faltam para ${emPorcento(PODER_MINIMO, 0)}% de poder em ${formatarNumero(LIMIAR_PRATICO_MIN, 0)} min`,
});

/** O que falta, escrito com a unidade do motivo e a concordância certa. */
export function numeroDoQueFalta(falta: OQueFalta, motivo: MotivoDoInconclusivo): NumeroDoBloco {
  const p = PALAVRA_DA_UNIDADE[falta.unidade];
  return {
    valor: `${formatarNumero(falta.quanto, 0)} ${falta.quanto === 1 ? p.um : p.muitas}`,
    legenda: LEGENDA_DO_MOTIVO[motivo],
  };
}

/**
 * O efeito medido, com sinal — e a legenda dizendo **o que** o sinal significa.
 *
 * Positivo é atraso. Na cheia, que é unilateral no atraso, um valor negativo é um
 * **adiantamento** — e a legenda o nomeia, porque *"deslocamento"* esconderia o
 * que o bloco da direção não coberta existe para explicar.
 */
export function numeroDoEfeito(f: ResultadoDaFase): NumeroDoBloco | null {
  if (f.efeitoMin === null) return null;
  const sinal = f.efeitoMin > 0 ? '+' : '';
  const nome =
    f.lateralidade === 'unilateral'
      ? f.efeitoMin < 0
        ? 'adiantamento mediano'
        : 'atraso mediano'
      : 'deslocamento mediano';
  return {
    valor: `${sinal}${formatarNumero(f.efeitoMin, 0)} min`,
    legenda: `${nome} · hora de apagar`,
  };
}

/** O número de um bloco: o que falta no `inconclusivo`, o efeito nos outros dois. */
export function numeroDoBloco(f: ResultadoDaFase): NumeroDoBloco | null {
  if (f.veredito === 'inconclusivo') {
    return f.falta === null || f.motivo === null ? null : numeroDoQueFalta(f.falta, f.motivo);
  }
  return numeroDoEfeito(f);
}

/**
 * As linhas de apoio de um bloco — **no mesmo corpo dos outros rótulos**, sem
 * ícone, sem cinza de apologia e sem itálico. As três são proibidas pela ADR 0045
 * §3, e a do adiantamento na cheia é justamente a que mais convidaria a elas.
 *
 * Quando um portão reprovou, o bloco diz **efeito não medido** e não zero: o
 * portão reprovou antes, e zero seria mentira.
 *
 * **Ela nunca devolve lista vazia**, e isso é a regra "não há variante curta"
 * aplicada ao bloco. O caso que a quebrava é real: `inconclusivo` por poder com
 * dispersão degenerada sai sem `falta`, sem `p`, sem `poder` e sem `efeitoMin` —
 * então `numeroDoBloco` devolve `null`, nenhuma medida entra, e o bloco imprimia
 * **só o nome da fase e a palavra "inconclusivo"**, que é exatamente a variante
 * curta que a ADR 0045 §3 proíbe, na fase em que menos se pode encurtar.
 */
export function apoioDoBloco(f: ResultadoDaFase): readonly string[] {
  const linhas: string[] = [];
  const medida: string[] = [];
  if (f.veredito === 'inconclusivo' && f.portaoReprovado !== null) {
    linhas.push('Efeito não medido: o portão reprovou antes, e zero seria mentira.');
    if (f.portaoReprovado === 'luz') {
      linhas.push(
        'Horas de luz do dia na latitude do sujeito são pré-requisito do teste, e o portão é '
        + 'global às quatro: os outros três blocos dizem isto mesmo, com este mesmo número.',
      );
    }
    return linhas;
  }
  if (f.efeitoMin !== null && f.veredito === 'inconclusivo') {
    medida.push(`efeito ${f.efeitoMin > 0 ? '+' : ''}${formatarNumero(f.efeitoMin, 0)} min`);
  }
  if (f.p !== null) medida.push(`p ${formatarNumero(f.p, 3)}`);
  // A lateralidade entra onde ela **decidiu** o veredito — achado e nenhum padrão.
  // No inconclusivo por poder o que explica o veredito é o poder, e dizer
  // "unilateral" ali daria à lateralidade um papel que ela não teve.
  if (f.veredito !== 'inconclusivo') {
    medida.push(f.lateralidade === 'unilateral' ? 'unilateral no atraso' : 'bilateral');
  }
  if (f.poder !== null) medida.push(`poder ${formatarNumero(f.poder * 100, 0)}%`);
  if (medida.length > 0) linhas.push(medida.join(' · '));

  if (f.veredito === 'achado') {
    linhas.push('Contra todas as outras noites do acervo. Associação medida, sem mecanismo.');
  }
  // A direção que o pré-registro não cobre: a cheia é unilateral no atraso, e um
  // adiantamento medido ali **não é achado por este protocolo**. A moldura é
  // invariável em campos, então o efeito é impresso de qualquer jeito — e sem esta
  // linha a página imprimiria os dois sem explicar, que não é discrição, é
  // incoerência.
  if (f.veredito === 'nenhum_padrao' && f.direcao === 'atraso' && (f.efeitoMin ?? 0) < 0) {
    linhas.push(
      'O deslocamento é para mais cedo. O pré-registro fixou a direção do atraso, e é só ela que '
      + 'este teste pode achar — um adiantamento aqui não é achado por este protocolo.',
    );
  }
  // **O piso.** Nada a dizer sobre o que foi medido não é licença para o bloco
  // encolher: ele diz que não há número, e por quê. `inconclusivo` por poder com
  // dispersão degenerada é o caminho que chega aqui; qualquer outro que chegue um dia
  // recebe a mesma linha em vez de uma vaga vazia.
  if (linhas.length === 0) linhas.push(APOIO_SEM_NUMERO);
  return linhas;
}

/**
 * A linha de apoio quando **não há número nenhum para o bloco** — o piso de
 * {@link apoioDoBloco}.
 *
 * Ela nomeia a causa conhecida (`inconclusivo` sem medida nenhuma) sem afirmar
 * quanto falta, porque a conta de quantas noites faltam **não existe** quando a
 * dispersão é degenerada: é o mesmo cuidado de *"zero seria mentira"*, um degrau
 * acima.
 */
export const APOIO_SEM_NUMERO =
  'Nada foi medido nesta fase, e a conta de quanto falta não existe com esta dispersão — '
  + 'nem o efeito, nem o p, nem o poder saíram.';

/**
 * A linha de apoio do bloco no estado **pré-execução**.
 *
 * Ela existe porque a frase que explica *"sem leitura"* pertence à linha de apoio,
 * e não à vaga do veredito: ali ela seria corpo menor ocupando o lugar da palavra
 * grande, que é a atenuação que a ADR 0045 §3 proíbe.
 */
export const APOIO_SEM_LEITURA =
  'A fase foi pré-registrada e a primeira execução autorizada ainda não rodou.';

/* ─────────────────── A moldura: os cinco campos ─────────────────── */

/**
 * O contador de execuções, como a moldura o imprime.
 *
 * Zero é **resposta**, não ausência: *"nenhuma execução"* é o quarto estado. E o
 * ordinal é feminino porque o substantivo é — *"1ª execução"*, nunca *"1º"*.
 */
export function ordinalDaExecucao(execucoes: number): string {
  // `Number.isInteger` é a checagem que a mensagem descreve, e `isFinite` não era:
  // `2.5` passava e saía como "3ª execução" — `formatarNumero(2.5, 0)` arredonda —
  // debaixo de uma mensagem que diz "não é uma contagem". Meia execução não existe.
  if (!Number.isInteger(execucoes) || execucoes < 0) {
    throw new RangeError(
      `o contador de execuções não é uma contagem: ${String(execucoes)} — zero é "nenhuma `
      + 'execução", uma fração não conta tentativa nenhuma, e um número negativo não descreve '
      + 'pilha nenhuma.',
    );
  }
  if (execucoes === 0) return 'nenhuma execução';
  return `${formatarNumero(execucoes, 0)}ª execução`;
}
