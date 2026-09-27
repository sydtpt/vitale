/**
 * O **anuário do ano** — a montagem das quatro tiras que abrem a edição do ano,
 * e o veredito de quando não há tira nenhuma a desenhar (Story 3.2).
 *
 * ```
 * montarAnuario(arquivo, 2025) → { estado: 'tiras',     tiras: 4 × 12 células }
 * montarAnuario(arquivo, 2024) → { estado: 'sem-lider', frase: "Nenhum mês…" }
 * ```
 *
 * ## Por que o ano não é um mês grande
 *
 * A rota da revista abria o ano como abre agosto: capa, sumário, quatro cadernos
 * — e procurando uma manchete que o ano não tem. *Um ano não tem um fato: tem
 * doze formas.* A parede (Story 2.4b) já sabia ler o ano como série, e era a
 * única peça do app que sabia; a rota, que é onde ele se lê, não.
 *
 * Este módulo é a metade pura disso. Ele **não** desenha e **não** decide
 * pixel: ele responde a uma pergunta só — *o ano tem série a mostrar, ou tem uma
 * frase a dizer?*
 *
 * ## O que ele reusa inteiro, e por quê
 *
 * As tiras saem de {@link tirasDoAno}, sem uma linha de cópia: é a mesma função
 * que a parede usa, com a mesma leitura de `metrica_lider` e as mesmas regras
 * finas (a colisão de duas edições no mesmo mês civil resolvida pelo `fim`
 * maior; o `anterior` que **não** zera num mês mudo). Duas montagens do mesmo
 * ano seriam duas respostas possíveis para a mesma pergunta, e a que ficaria
 * congelada é a de quem desenhou primeiro.
 *
 * **A tira lê o carimbo e nunca recalcula** (AD-17). Recalcular o ranqueamento a
 * cada abertura é reescrita silenciosa de período fechado — proibida desde a
 * 1.9 —, e faria a tira discordar da `posicao` que a própria edição congelou.
 *
 * ## Por que a frase do silêncio sai daqui, e não da tela
 *
 * *"Nenhum mês de 2024 reuniu medida bastante para liderar"* é um **veredito
 * sobre o dado**, não um rótulo de tela: é a mesma gramática da 2.6 (ausência
 * não vira zero) e da 2.4b (nulo é declaração, não omissão). No núcleo ela tem
 * teste; na tela, só revisão.
 *
 * E ela existe porque quatro tiras vazias **não** são a resposta: o ano em que
 * ninguém liderou desenharia quatro faixas de filetes brancos, que leem como
 * tela quebrada — não como "não houve líder".
 */
import { MESES_DO_ANO, tirasDoAno, type CelulaDaTira, type TiraDoAno } from './parede';
import type { EdicaoNoArquivo } from '../data/edicoes-ia';
import { rotuloDoCaderno } from '../period/cadernos';

/* ── o ano que o endereço nomeia ─────────────────────────────────────────── */

/**
 * O ano de um início `YYYY-MM-DD`, ou `null` quando a data não se lê.
 *
 * A rota guarda o **início** do período (`/revista/ano/2025-01-01`), e
 * {@link montarAnuario} pede o ano como número — porque é por ele que o arquivo
 * dos **meses** é recortado. A conversão mora aqui, e não na tela, para não
 * haver uma segunda régua de "que ano é este endereço".
 *
 * `null` é impossível pela coluna `date` do Postgres e pelo `periodoDaRota`, que
 * já recusou o que não abre período — e por isso não lança: a tela cai para "sem
 * tiras", e o texto do ano abre igual.
 */
export function anoDoAnuario(inicio: string): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(inicio);
  return m ? Number(m[1]) : null;
}

/* ── o anuário ───────────────────────────────────────────────────────────── */

/** O ano com série: as quatro tiras, sempre as quatro, sempre de doze meses. */
export interface AnuarioComTiras {
  readonly estado: 'tiras';
  readonly ano: number;
  /**
   * Quatro, na ordem do catálogo — **inclusive as de zero meses**.
   *
   * A tira toda em ausência é a resposta de que aquele caderno não saiu no ano;
   * escondê-la faria três tiras parecerem os quatro cadernos.
   */
  readonly tiras: readonly TiraDoAno[];
}

/**
 * O ano **sem líder nenhum** — o estado em que a frase ocupa o lugar das faixas.
 *
 * Não é erro e não é ausência de dado: é um ano em que nenhum mês teve métrica
 * carimbada. 2024 é exatamente isso em produção — 23 pares (edição, caderno) e
 * zero líderes, porque a coluna `metrica_lider` nasceu depois.
 */
export interface AnuarioSemLider {
  readonly estado: 'sem-lider';
  readonly ano: number;
  /** A linha em palavras, pronta para a tela. Nunca vazia. */
  readonly frase: string;
  /**
   * Em quantos meses **algum** caderno saiu — 0 a 12.
   *
   * Ele existe porque a frase muda com ele (ver {@link fraseDoAnoSemLider}), e
   * porque o estado sem o número seria uma frase sem a razão dela: quem lê o
   * objeto no teste ou no log precisa saber qual dos dois silêncios é este.
   */
  readonly meses: number;
}

/** O anuário de um ano: a série, ou a frase. Nunca os dois, nunca nenhum. */
export type Anuario = AnuarioComTiras | AnuarioSemLider;

/**
 * A frase do ano sem líder — **três, porque são três silêncios diferentes**.
 *
 * O que muda entre elas é **de quantos meses a frase fala**, e errar isso é
 * afirmar medida que não houve — a regra da 2.6:
 *
 * - **nenhum mês impresso.** *"Nenhum mês de 2019 tem edição impressa."* Dizer
 *   que nenhum "reuniu medida bastante" afirmaria que os doze existiram e
 *   ficaram aquém;
 * - **parte do ano impressa.** *"Nenhum dos 5 meses de 2024 com edição impressa
 *   reuniu medida bastante para liderar."* A frase do ano inteiro, dita sobre
 *   cinco meses, estende o veredito aos sete que ninguém escreveu — e o
 *   singular ganha a sua forma, porque *"nenhum dos 1 meses"* não é português;
 * - **o ano inteiro impresso.** *"Nenhum mês de 2024 reuniu medida bastante para
 *   liderar."* Aqui, e só aqui, "nenhum mês" cobre exatamente o que foi medido.
 *
 * `meses` é a **união** dos doze — quantos meses tiveram algum caderno
 * impresso —, nunca a soma dos quatro cadernos: quatro cadernos no mesmo mês são
 * um mês.
 */
export function fraseDoAnoSemLider(ano: number, meses: number): string {
  if (meses <= 0) return `Nenhum mês de ${ano} tem edição impressa.`;
  if (meses >= MESES_DO_ANO) return `Nenhum mês de ${ano} reuniu medida bastante para liderar.`;
  const quantos = meses === 1
    ? `O único mês de ${ano} com edição impressa não reuniu`
    : `Nenhum dos ${meses} meses de ${ano} com edição impressa reuniu`;
  return `${quantos} medida bastante para liderar.`;
}

/** Uma célula que diz "este caderno saiu liderado por alguma coisa". */
const liderou = (c: CelulaDaTira): boolean => c.estado === 'metrica';

/**
 * O anuário de um ano, montado sobre o arquivo **inteiro** de edições.
 *
 * **Os doze valores saem dos doze meses, e não da edição do ano.** A edição do
 * ano tem uma linha por caderno, com um `metrica_lider` só — doze valores não
 * existem nela. É por isso que quem chama entrega o arquivo, e não a edição.
 *
 * Pura e determinística: não olha o relógio, não lê banco, não muta nada.
 *
 * O corte entre os dois estados é **"algum mês liderou?"**, e não "alguma edição
 * existe?": um ano com doze meses impressos e nenhuma métrica carimbada tem tira
 * a desenhar do ponto de vista do dado (doze blocos em `tint`), e nenhuma do
 * ponto de vista de quem lê — as quatro faixas não diriam nada que a frase não
 * diga melhor.
 */
export function montarAnuario(
  arquivo: readonly EdicaoNoArquivo[],
  ano: number,
): Anuario {
  const tiras = tirasDoAno(arquivo, ano);
  if (tiras.some((t) => t.celulas.some(liderou))) return { estado: 'tiras', ano, tiras };
  // Quantos meses do ano tiveram **algum** caderno impresso — a união das
  // quatro tiras, mês a mês. Não é a soma de `TiraDoAno.meses`: quatro cadernos
  // no mesmo mês são um mês, e somar diria "4 meses" sobre um mês só.
  //
  // A célula ausente **da lista** (uma tira mais curta que doze, que
  // `tirasDoAno` não produz) conta como mês não impresso, e não como impresso:
  // `c?.estado !== 'ausente'` seria verdadeiro para `undefined` e somaria um mês
  // que ninguém escreveu — o que muda a frase do silêncio para a de um ano mais
  // cheio do que ele é. O laço vai até {@link MESES_DO_ANO} pelo mesmo motivo:
  // ler o tamanho da primeira tira deixaria a contagem depender dela.
  let meses = 0;
  for (let mes = 0; mes < MESES_DO_ANO; mes += 1) {
    const impresso = tiras.some((t) => {
      const c = t.celulas[mes];
      return c !== undefined && c.estado !== 'ausente';
    });
    if (impresso) meses += 1;
  }
  return { estado: 'sem-lider', ano, frase: fraseDoAnoSemLider(ano, meses), meses };
}

/* ── o que o leitor de tela ouve ─────────────────────────────────────────── */

/** Quantos meses, em palavras. */
const emMeses = (n: number): string => (n === 1 ? '1 mês' : `${n} meses`);

/**
 * A tira, em palavras — os **três** estados e as trocas, e não só a contagem.
 *
 * *"Sono em 9 meses"* não decodifica nada: não separa o mês calado do mês
 * ausente, e não diz nada das trocas, que são a razão declarada de a tira
 * existir. Quem ouve tem de conseguir reconstruir o desenho.
 *
 * **Nenhuma parte que conte zero é dita** (matriz de I/O da 3.2). *"Liderou em 0
 * meses"* e *"não saiu em 0 meses"* são ruído que obriga quem ouve a subtrair de
 * cabeça — e a primeira é pior que ruído, porque anuncia liderança e entrega
 * nenhuma. Com `meses > 0`, ao menos uma das partes sobra: ou o caderno liderou
 * em algum mês, ou saiu calado em algum.
 *
 * Mora no núcleo, e não na tela, pela razão do cabeçalho do módulo: é veredito
 * sobre o dado, e a parede (2.4b) e o anuário (3.2) falam com a mesma voz.
 */
export function tiraEmPalavras(t: TiraDoAno): string {
  const nome = rotuloDoCaderno(t.caderno);
  if (t.meses === 0) return `${nome}: não saiu no ano`;
  const comMetrica = t.celulas.filter(liderou).length;
  const calados = t.celulas.filter((c) => c.estado === 'sem-metrica').length;
  const trocas = t.celulas.filter((c) => c.estado === 'metrica' && c.mudou).length;
  const naoSaiu = t.celulas.length - t.meses;
  const partes: string[] = [];
  if (comMetrica > 0) partes.push(`liderou em ${emMeses(comMetrica)}`);
  if (calados > 0) partes.push(`saiu sem líder em ${emMeses(calados)}`);
  if (naoSaiu > 0) partes.push(`não saiu em ${emMeses(naoSaiu)}`);
  if (trocas > 0) partes.push(trocas === 1 ? 'o líder mudou uma vez' : `o líder mudou ${trocas} vezes`);
  return `${nome}: ${partes.join(', ')}`;
}

/**
 * As quatro tiras de um ano em palavras — **a voz das duas telas, uma vez só**.
 *
 * A parede (2.4b) e o anuário da edição (3.2) desenham a mesma coisa em dois
 * tamanhos, e falam a mesma coisa. Enquanto cada uma montava a sua abertura e o
 * seu `join`, elas já tinham divergido: uma dizia *"O anuário de 2025"* e a
 * outra *"O ano de 2025"*, com a mesma junção escrita duas vezes — e o cabeçalho
 * do módulo afirmando que elas falam com a mesma voz.
 *
 * Um alvo, um rótulo: quatro tiras como elementos separados fariam o VoiceOver
 * parar quatro vezes, e o ano — que é o assunto — nunca seria dito. É a regra da
 * 1.16: o desenho é um nó, o texto é texto.
 *
 * *"O ano de"*, e não *"O anuário de"*: quem ouve quer saber de que **ano** se
 * fala; "anuário" é o nome da peça, não do período.
 */
export function tirasEmPalavras(ano: number, tiras: readonly TiraDoAno[]): string {
  return `O ano de ${ano}. ${tiras.map(tiraEmPalavras).join('. ')}.`;
}

/**
 * O anuário inteiro em palavras — **o bloco é um nó só**, e este é o rótulo dele.
 *
 * No estado `sem-lider` ela é a **própria** frase que a tela mostra: repetir em
 * voz um texto diferente do que está escrito é a forma mais fácil de as duas
 * divergirem no dia em que uma delas mudar.
 */
export function anuarioEmPalavras(a: Anuario): string {
  return a.estado === 'sem-lider' ? a.frase : tirasEmPalavras(a.ano, a.tiras);
}
