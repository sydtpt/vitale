/**
 * O ranqueamento do miolo — em que ordem os cadernos entram na edição.
 * Spec: docs/specs/revista-retrospectiva/bases-e-ranqueamento.md · Story 1.7.
 *
 * ```
 * ordenarCadernos(pacotes) → CadernoId[]      // pura, determinística
 * ```
 *
 * Escolher qual caderno abre a edição é jornalismo; dizer o que fazer com ele
 * seria conselho. Esta função só faz o primeiro.
 *
 * ## Os seis passos, e a precedência entre eles
 *
 * 1. **Afastamento** — de cada fato, o `|deltaPct|` da base **mais confiável**
 *    que ele tem (B3, depois B2, depois B1), vezes o peso dela. Nunca a maior
 *    das três: com a maior, 60% contra o mês anterior venceria 10% contra a
 *    normal, que é justamente a comparação mais informativa.
 * 2. **Portão** — só disputa o fato com cobertura do caderno não desigual,
 *    `comparavel` e `amostra ≥ 7`. Quem não passa entra na ordem, atrás.
 * 3. **Confiança** — o peso da base: B2 e B3 valem 1, B1 vale meio.
 * 4. **Desempate** — a ordem do catálogo, fixa, para a função nunca ser
 *    ambígua.
 * 5. **Lápide** — o caderno com a lápide **do período** vai para a frente.
 * 6. **Vazio** — fora da lista.
 *
 * **O passo 5 vence o 6.** O mês em que o relógio para é justamente o mês sem
 * dado; sem a precedência, a lápide seria apagada exatamente quando importa. Um
 * caderno cujo único conteúdo é a lápide existe, aparece e lidera. A lápide
 * **antiga** não ressuscita nada — e essa distinção não mora aqui, mora em
 * `cadernoVazio`, que é também quem cala o prompt: o vazio tem dono único.
 *
 * ## Por que em `ia/`, e não em `period/cadernos.ts`
 *
 * O ranqueamento precisa de `cadernoVazio`, que é do pacote, e `ia/pacote.ts`
 * já importa `period/cadernos.ts` em runtime — pôr a função lá fecharia um
 * ciclo. Em `ia/` ela nasce sob a barreira do núcleo de IA
 * (`architecture.test.ts`).
 *
 * ## Por que o `index.ts` NÃO exporta este arquivo
 *
 * É função de **impressão** (Story 1.10), nunca de **render** (Story 1.9). A
 * ordem congela na impressão: a tela lê a `posicao` gravada e nunca a recalcula,
 * senão mudar um peso aqui reordenaria em silêncio toda edição de período
 * fechado. Quem precisa dela importa pelo caminho relativo, dentro do núcleo.
 *
 * O que esta story garante é só isto: ela **não sai pelo barril**, e
 * `ranqueamento.test.ts` cobra a ausência. Não é o mesmo que o app não
 * alcançá-la — um import profundo (`@vitale/shared/src/ia/ranqueamento`) ainda
 * compila. A barreira contra ele, varrendo `mobile/src` e `web/src`, é da Story
 * 1.9, junto da coluna que congela a ordem.
 */
import type { BaseId, FatoNumero, PacoteDeFatos } from './pacote';
import { cadernoVazio, temLapideDoPeriodo, validarLapides } from './pacote';
import type { CadernoId } from '../period/cadernos';
import { CADERNO_IDS, isCadernoId } from '../period/cadernos';

/**
 * O N do portão: o menor lado da comparação tem que ter pelo menos 7
 * observações **que carregam a medida**.
 *
 * Simulado sobre os 39 meses fechados (17 com dois cadernos ou mais), dado de
 * produção, com a regra da iteração 1 — a distância conta só as atividades com
 * distância, e a elevação não disputa: com 5 passam duas manchetes sobre 5–6
 * sessões; com 10 somem três histórias cujo lado fino tinha 8 atividades (mar/26
 * "atividades +200%" vira "VFC +23%"). 7 é o menor valor sem nenhum dos dois. O
 * "+971% de distância" que a primeira simulação dava a março não era história:
 * era ruído sobre 2 atividades com distância, e é o que a regra nova barra.
 *
 * **Calibrado em meses, e vale para mês, trimestre e ano.** A semana é postal —
 * não grava edição (CAP-9) — e por isso não ordena: nenhuma semana foi medida
 * contra este N.
 *
 * Mudar é contrato.
 */
export const AMOSTRA_MINIMA = 7;

/**
 * O peso de cada base no afastamento — o passo 3.
 *
 * Peso, e não ordem lexicográfica: lexicográfica faria 2% contra a normal vencer
 * 60% contra o mês anterior. Hoje nenhum fato tem B2 nem B3 com valor, então o
 * peso ainda não muda ordem nenhuma; ele existe para o dia em que tiver.
 */
export const PESO_DA_BASE: Readonly<Record<BaseId, number>> = Object.freeze({ B1: 0.5, B2: 1, B3: 1 });

/** Da mais confiável para a menos — a ordem em que o passo 1 procura. */
const POR_CONFIANCA: readonly BaseId[] = ['B3', 'B2', 'B1'];

/**
 * O fato numérico mais forte do caderno — o de maior afastamento entre os que
 * passam no portão —, e com quanto.
 *
 * É a chave que a impressão congela (`metrica_lider`, Story 1.9): um valor
 * gravado, e não um ponteiro a re-derivar depois, porque re-derivado ele leria um
 * estado que já andou.
 *
 * **Nem sempre é o que deu ao caderno o lugar dele.** No caderno forçado pela
 * lápide do período (passo 5), a posição veio da lápide, e o líder devolvido
 * aqui continua sendo o fato numérico mais forte — ou `null`, se nenhum passa no
 * portão. O que `metrica_lider` guarda nesses dois casos é decisão da 1.9.
 */
export interface Lider {
  /** A chave do {@link FatoNumero} — a métrica líder. */
  chave: string;
  /** A base que forneceu o afastamento: a mais confiável que o fato tinha. */
  base: BaseId;
  /** `|deltaPct|` dessa base × {@link PESO_DA_BASE}. */
  afastamento: number;
}

/**
 * O afastamento de um fato, pela base **mais confiável que ele tem** — a
 * primeira de B3, B2, B1 que existe e tem percentual.
 *
 * "Tem" é ter percentual: uma base que existe com valor zero não tem variação
 * relativa (divisão por zero), e quem responde pelo fato passa a ser a próxima.
 */
function afastamentoDe(f: FatoNumero): { base: BaseId; afastamento: number } | null {
  for (const id of POR_CONFIANCA) {
    const b = f.bases.find((x) => x.id === id);
    if (b == null || !b.existe || b.deltaPct == null || !Number.isFinite(b.deltaPct)) continue;
    return { base: id, afastamento: Math.abs(b.deltaPct) * PESO_DA_BASE[id] };
  }
  return null;
}

/**
 * O portão do passo 2, fato a fato.
 *
 * Caderno sem cobertura declarada não é desigual — a cobertura só barra quando
 * existe e diz que não é comparável (27 noites contra 14). `amostra` nula é "não
 * se sabe", e não se sabe não passa.
 */
function passaNoPortao(p: PacoteDeFatos, f: FatoNumero): boolean {
  if (p.cobertura != null && !p.cobertura.comparavel) return false;
  return f.comparavel && f.amostra != null && f.amostra >= AMOSTRA_MINIMA;
}

/**
 * O fato que lidera o caderno: o de maior afastamento entre os que passam no
 * portão. Empate fica com o primeiro na ordem do pacote, que é fixa.
 *
 * **Pode ser `null`**: caderno que só tem lápide, ou que nenhum fato passou no
 * portão. A Story 1.9 decide o que `metrica_lider` guarda nesse caso — e no do
 * caderno forçado pela lápide, cujo líder aqui não é o que o pôs na frente (ver
 * {@link Lider}); a 1.10 carimba a partir desta função e nunca recalcula.
 */
export function liderDoCaderno(p: PacoteDeFatos): Lider | null {
  let lider: Lider | null = null;
  for (const f of p.metricas) {
    if (!passaNoPortao(p, f)) continue;
    const a = afastamentoDe(f);
    if (a == null) continue;
    if (lider == null || a.afastamento > lider.afastamento) {
      lider = { chave: f.chave, base: a.base, afastamento: a.afastamento };
    }
  }
  return lider;
}

/** Posição no catálogo — o desempate de tudo. */
function posicaoNoCatalogo(id: CadernoId): number {
  return CADERNO_IDS.indexOf(id);
}

/**
 * A entrada é uma edição: cada caderno uma vez, todos do mesmo período, e as
 * lápides de cada um certas.
 *
 * Caderno repetido ou período misturado não tem ordem certa — qualquer resposta
 * seria um chute com aparência de resultado. Lápide de outro caderno poria na
 * frente o caderno errado; lápide posterior ao fim forçaria um caderno por uma
 * morte que ainda não aconteceu. Explode — as lápides pelo mesmo
 * `validarLapides` que o prompt chama.
 */
function validar(pacotes: readonly PacoteDeFatos[]): void {
  const vistos = new Set<CadernoId>();
  for (const p of pacotes) {
    if (!isCadernoId(p.caderno)) throw new Error(`caderno desconhecido: ${String(p.caderno)}`);
    if (vistos.has(p.caderno)) throw new Error(`caderno repetido na edição: ${p.caderno}`);
    vistos.add(p.caderno);
    validarLapides(p);
  }
  const [primeiro] = pacotes;
  for (const p of pacotes) {
    const a = primeiro.periodo;
    const b = p.periodo;
    if (a.tipo !== b.tipo || a.inicioISO !== b.inicioISO || a.fimISO !== b.fimISO) {
      throw new Error(
        `a edição mistura períodos: ${primeiro.caderno} é ${a.tipo} ${a.inicioISO}–${a.fimISO}, `
        + `${p.caderno} é ${b.tipo} ${b.inicioISO}–${b.fimISO}`,
      );
    }
  }
}

/**
 * A ordem da edição — os cadernos que ela tem, e só eles.
 *
 * Primeiro os de lápide do período (5), entre si pelo catálogo; depois os que
 * passam no portão (2), pelo afastamento ponderado (1, 3); depois os que não
 * passam, pelo catálogo; todo empate pelo catálogo (4). Vazio não entra (6).
 *
 * Pura e determinística: não depende da ordem da entrada, não muta nada, e a
 * mesma edição dá sempre a mesma ordem.
 */
export function ordenarCadernos(pacotes: readonly PacoteDeFatos[]): CadernoId[] {
  validar(pacotes);
  const presentes = pacotes
    .filter((p) => !cadernoVazio(p))
    .map((p) => ({ p, lider: liderDoCaderno(p), catalogo: posicaoNoCatalogo(p.caderno) }))
    .sort((a, b) => a.catalogo - b.catalogo);

  const forcado = (p: PacoteDeFatos) => temLapideDoPeriodo(p.lapides, p.periodo);
  const forcados = presentes.filter((x) => forcado(x.p));
  const resto = presentes.filter((x) => !forcado(x.p));
  const disputam = resto
    .filter((x) => x.lider != null)
    .sort((a, b) => b.lider!.afastamento - a.lider!.afastamento || a.catalogo - b.catalogo);
  const atras = resto.filter((x) => x.lider == null);

  return [...forcados, ...disputam, ...atras].map((x) => x.p.caderno);
}
