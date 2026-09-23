/**
 * **De quem é a medida** — a corrida da amostra como coisa nomeada, pura, sem rede e sem
 * disco (fatia 5 do redesenho de Motores).
 *
 * As medidas da ADR 0050 (`./medidas.ts`) contam uma lista de linhas e não perguntam quem
 * as produziu: no Mac isso bastava, porque lá cada coluna do relatório já nasce com o nome
 * do motor em cima. No iPhone a amostra era **do modelo do sistema por definição** — o
 * motor estava cravado no laço —, e o cabeçalho podia dizer "o aparelho" sem mentir.
 * Quando a amostra passa a medir o motor que o dono escolher, "22 de 22 aprovadas" sem
 * nome vira um número órfão: dois modelos abertos produzem duas listas com a mesma cara.
 *
 * Então a corrida ganha três coisas que o núcleo pode garantir:
 *
 *  1. **o motor**, dentro do próprio dado — não ao lado dele, num rótulo de tela que se
 *     descola do que foi medido;
 *  2. **uma linha de comparação** por corrida, escrita pelo mesmo `./texto.ts` do resto —
 *     a taxa de aprovação é o que esta fatia existe para produzir, e escrevê-la duas vezes
 *     (aqui e no Mac) é como "86,4%" de um lado vira "86.4%" do outro;
 *  3. **o aviso de que duas corridas não se comparam**, quando elas não mediram as mesmas
 *     janelas. Uma corrida parada no meio (o toque em Parar, o freio do hospedeiro) mede um
 *     prefixo da amostra, e 19 de 22 ao lado de 5 de 7 são duas taxas sobre acervos
 *     diferentes — o erro que a comparação lado a lado torna fácil e silencioso.
 *
 * **Sem limiar e sem veredito**, como o resto da régua: nada aqui ordena corridas, aprova
 * ou reprova. As quatro condições da ADR 0050 continuam sendo lidas pelo dono.
 */
import type { MotorId } from '../ia/fio';
import { chaveDoPasso } from './amostra';
import type { LinhaDoRelatorio } from './linha';
import { medidasDoPortao } from './medidas';
import { porcento, segundos } from './texto';

/**
 * Uma corrida da amostra: **um motor** e as janelas que ele mediu.
 *
 * `recusa` é a corrida que não aconteceu — o motor perdeu o pé antes da primeira janela
 * (o compilado sumiu, o diagnóstico virou indisponível). Ela continua sendo uma corrida,
 * com nome e motivo, porque uma medição que não houve vale tanto quanto uma que houve: sem
 * ela, o modelo simplesmente sumiria do resultado e ninguém saberia por quê.
 */
export interface CorridaDaAmostra {
  readonly motor: MotorId;
  readonly linhas: readonly LinhaDoRelatorio[];
  readonly recusa?: string;
}

/**
 * A corrida reduzida ao que se compara entre motores — três das quatro condições da ADR
 * 0050, as que são **um número só**.
 *
 * A quarta (a cobertura dos sete casos nos dois alcances) é tabela, e fica no cartão de
 * cada corrida: espremê-la numa linha de comparação viraria um número que esconde qual
 * combinação faltou, que é exatamente o que ela existe para mostrar.
 */
export interface ResumoDaCorrida {
  readonly motor: MotorId;
  /** As janelas da amostra que a corrida percorreu — nem sempre a amostra inteira. */
  readonly janelas: number;
  /** As que chegaram ao modelo — a regra da janela medida, de `./medidas.ts`. */
  readonly medidas: number;
  readonly aprovadas: number;
  /** `aprovadas ÷ medidas` em por cento — `—` quando não houve medida. */
  readonly aprovacao: string;
  readonly identicasAoTemplate: number;
  /** Das medidas não frias, em ms. `null` quando não sobrou nenhuma. */
  readonly medianaMs: number | null;
  /** A corrida não aconteceu, e por quê. */
  readonly recusa?: string;
}

/** O resumo de uma corrida, pelas mesmas contas do cartão dela. */
export function resumoDaCorrida(c: CorridaDaAmostra): ResumoDaCorrida {
  const m = medidasDoPortao(c.linhas);
  return {
    motor: c.motor,
    janelas: m.janelas,
    medidas: m.medidas,
    aprovadas: m.aprovadas,
    aprovacao: porcento(m.aprovadas, m.medidas),
    identicasAoTemplate: m.identicasAoTemplate,
    medianaMs: m.medianaMs,
    ...(c.recusa !== undefined ? { recusa: c.recusa } : {}),
  };
}

/**
 * A linha de comparação de uma corrida, com o nome do motor que o hospedeiro sabe escrever.
 *
 * O nome vem de fora porque ele é do app (o catálogo de motores do aparelho) e não do
 * núcleo — aqui só existe o id. Escrever a linha aqui, e não na tela, é a mesma regra do
 * `./texto.ts`: a mediana em segundos e a taxa em por cento saem do mesmo lugar do relatório
 * do Mac, senão a comparação passa por uma tradução na cabeça de quem lê.
 */
export function linhaDoResumo(r: ResumoDaCorrida, nome: string): string {
  if (r.recusa !== undefined) return `${nome} · não mediu: ${r.recusa}`;
  return (
    `${nome} · ${r.aprovadas} de ${r.medidas} medidas aprovadas (${r.aprovacao})` +
    ` · mediana ${segundos(r.medianaMs)} · ${r.identicasAoTemplate} idênticas ao template` +
    ` · ${r.janelas} janelas`
  );
}

/** Os endereços das janelas que uma corrida percorreu, na ordem em que ela as mediu. */
function passosDaCorrida(c: CorridaDaAmostra): string {
  return c.linhas.map(chaveDoPasso).join(' ');
}

/**
 * As corridas mediram **as mesmas janelas**? Em palavras quando não — ou `null`, quando a
 * comparação é legítima.
 *
 * A taxa de aprovação só compara motores se o denominador for o mesmo conjunto de casos: a
 * amostra é preparada uma vez e serve a todas as corridas justamente por isso. O que quebra
 * a igualdade é a corrida que parou no meio — o toque em Parar, o freio do hospedeiro, a
 * tela que perdeu o foco —, e o resultado dela fica na tela ao lado dos outros com a mesma
 * cara de medida completa.
 *
 * Corrida sem linha nenhuma (a recusada) fica de fora da conta: ela não tem o que comparar,
 * e acusá-la aqui esconderia a divergência de verdade entre as que mediram.
 */
export function amostrasDivergentes(
  corridas: readonly CorridaDaAmostra[],
  nomeDe: (motor: MotorId) => string = (motor) => motor,
): string | null {
  const mediram = corridas.filter((c) => c.linhas.length > 0);
  if (mediram.length < 2) return null;
  const primeira = passosDaCorrida(mediram[0]!);
  if (mediram.every((c) => passosDaCorrida(c) === primeira)) return null;
  return (
    'as corridas não mediram as mesmas janelas — ' +
    mediram.map((c) => `${nomeDe(c.motor)} ${c.linhas.length}`).join(' · ') +
    ' — e as taxas não se comparam entre si'
  );
}
