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
  LIMIAR_PRATICO_MIN,
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
    'Pré-registrada em 07 set 2026, com a direção tirada da literatura. A posição aqui é de '
    + 'procedência, não de importância.',
  'as-tres':
    'Nascidas juntas em 28 set 2026, sem direção na literatura — e é por isso que são bilaterais. '
    + 'Entre as três a correção por multiplicidade se aplica inteira.',
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
export const ALFA_DO_GRUPO: Readonly<Record<FamiliaLunar, string>> = Object.freeze({
  cheia: 'α 5% · unilateral · direção do atraso',
  'as-tres': 'α 1,67% (0,05 / 3) · bilateral',
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
  };
}

function duasLinhas(cheia: LinhaDaFamilia, asTres: LinhaDaFamilia): FraseColetiva {
  return { cheia, asTres, linhas: [cheia, asTres] };
}

/**
 * O estado **pré-execução** — o quarto, e o único em que a página vive hoje.
 *
 * A forma é a mesma das outras: duas linhas, dois compartimentos. O que muda é o
 * verbo, e ele muda porque **não houve leitura**, não porque não houve resultado.
 */
export const FRASE_SEM_LEITURA: FraseColetiva = Object.freeze(
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

/** O limiar prático, escrito como a frase o diz. */
const LIMIAR_EM_PALAVRAS = `${String(LIMIAR_PRATICO_MIN)} minutos`;

/** O sentido do deslocamento medido. A hora de apagar foi para onde? */
function sentidoDe(efeitoMin: number | null): string {
  return (efeitoMin ?? 0) < 0 ? 'ficou mais cedo' : 'ficou mais tarde';
}

/** O mesmo sentido, em elipse — a segunda oração coordenada, sem repetir o verbo. */
function sentidoEmElipse(efeitoMin: number | null): string {
  return (efeitoMin ?? 0) < 0 ? 'mais cedo' : 'mais tarde';
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

/** Quem parou num **portão** e quem rodou e **faltou poder** — a partição que a frase diz. */
function particaoDosMotivos(indecisas: readonly ResultadoDaFase[]): {
  nosPortoes: number;
  semPoder: number;
  motivoUnico: MotivoDoInconclusivo | null;
} {
  const motivos = new Set<MotivoDoInconclusivo>();
  let nosPortoes = 0;
  let semPoder = 0;
  for (const f of indecisas) {
    const m = f.motivo ?? 'poder';
    motivos.add(m);
    if (m === 'poder') semPoder += 1;
    else nosPortoes += 1;
  }
  return {
    nosPortoes,
    semPoder,
    motivoUnico: motivos.size === 1 ? [...motivos][0] : null,
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
  const { nosPortoes, semPoder, motivoUnico } = particaoDosMotivos(indecisas);

  if (motivoUnico !== null) {
    if (sozinha) {
      const sujeito = familia === 'cheia' ? 'O teste' : 'Os três testes';
      return `${sujeito} ${oracaoDoMotivo(motivoUnico, n)}.`;
    }
    const verbo = n === 1 ? 'não decidiu' : 'não decidiram';
    return `${porExtenso(n, 'feminino')} ${verbo}: ${oracaoDoMotivo(motivoUnico, n)}.`;
  }

  // Mistos. A partição, e o bloco como destino — nunca um motivo falando pelas
  // outras.
  const aoBloco = 'cada bloco diz qual, e em que unidade.';
  if (nosPortoes > 0 && semPoder > 0) {
    return (
      `${porExtenso(nosPortoes, 'feminino')} ${nosPortoes === 1 ? 'parou' : 'pararam'} num portão `
      + `e ${porExtenso(semPoder, 'feminino')} ${semPoder === 1 ? 'rodou' : 'rodaram'} sem poder; `
      + aoBloco
    );
  }
  // Só portões, e portões diferentes: a frase diz que são diferentes, e qual é de
  // cada uma fica no bloco.
  return `${porExtenso(nosPortoes, 'feminino')} pararam em portões diferentes; ${aoBloco}`;
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
  poder: `faltam para 80% de poder em ${String(LIMIAR_PRATICO_MIN)} min`,
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
  return linhas;
}

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
  if (!Number.isFinite(execucoes) || execucoes < 0) {
    throw new RangeError(
      `o contador de execuções não é uma contagem: ${String(execucoes)} — zero é "nenhuma `
      + 'execução", e um número negativo não descreve pilha nenhuma.',
    );
  }
  if (execucoes === 0) return 'nenhuma execução';
  return `${formatarNumero(execucoes, 0)}ª execução`;
}
