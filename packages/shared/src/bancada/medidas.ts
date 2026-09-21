/**
 * O fecho de uma coluna e as quatro medidas da ADR 0050 — puro, sem limiar e sem
 * veredito.
 *
 * **O limiar é do dono.** Nada aqui decide nota de corte, aprova motor nem recomenda: o
 * número sai, a régua fica na ADR, e a comparação é de quem lê. Nenhum campo diz "passa"
 * (ADR 0050, "nenhum código o lê").
 *
 * **Um dono só** (story 5.13). Isto morava no relatório da bancada do Mac
 * (`scripts/bancada/relatorio.ts`); subiu para o núcleo para a tela de desenvolvimento do
 * iPhone contar a amostra dela **com a mesma régua**. Dada a mesma lista de linhas, o
 * relatório do Mac e a tela do iPhone dão o mesmo número — e é isso que torna a aprovação
 * do modelo do iPhone comparável com a do Mac.
 */
import { CASOS_DA_SAUDE, type CasoDaSaude } from '../sleep/caso';
import type { AlcanceDaSaude } from '../sleep/leitura';
import type { DesfechoDaLinha, LinhaDoRelatorio } from './linha';

/* ── o fecho ─────────────────────────────────────────────────────────────── */

/**
 * O que uma linha virou, no vocabulário em que o dono vai ler o fecho. `falha` junta toda
 * classe de falha e o defeito: a classe exata está em `porClasse`.
 */
export const VEREDITOS = Object.freeze(['aprovada', 'reprovada', 'recusa', 'falha', 'template', 'mudo'] as const);

export type VereditoDaLinha = (typeof VEREDITOS)[number];

/**
 * O veredito de um desfecho, com `switch` **exaustivo**: um desfecho novo no núcleo não
 * compila aqui até ser classificado. Com `default`, ele entraria como `falha` em silêncio
 * e o fecho mentiria sobre uma categoria que ninguém leu.
 */
export function vereditoDe(d: DesfechoDaLinha): VereditoDaLinha {
  switch (d) {
    case 'ok':
      return 'aprovada';
    case 'reprovada':
      return 'reprovada';
    case 'recusa-do-modelo':
      return 'recusa';
    case 'template':
      return 'template';
    case 'mudo':
      return 'mudo';
    case 'indisponivel':
    case 'capacidade':
    case 'janela':
    case 'guarda':
    case 'saida-invalida':
    case 'transitoria':
    case 'defeito':
      return 'falha';
    default: {
      const nunca: never = d;
      throw new TypeError(`desfecho sem veredito: ${String(nunca)}`);
    }
  }
}

/**
 * A ordem em que os casos aparecem no fecho e na cobertura: **a precedência da CAP-13**,
 * como `sleep/caso.ts` a declara — `sem-contagem` primeiro, `fora-do-empate` por último.
 * **É a lista do caso, não uma cópia dela**: um caso novo lá aparece aqui sem ninguém
 * lembrar (e o teste do Mac guarda a lista literal, para a mudança ser vista).
 *
 * Exposta com nome próprio porque a bancada do Mac a lê e não pode importar
 * `CASOS_DA_SAUDE` (a guarda (7) o conta como peça da Saúde do sono).
 */
export const ORDEM_DOS_CASOS: readonly CasoDaSaude['caso'][] = CASOS_DA_SAUDE;

export interface ContagemPorCaso {
  readonly caso: CasoDaSaude['caso'];
  readonly total: number;
  readonly porVeredito: Readonly<Record<VereditoDaLinha, number>>;
}

export interface Agregados {
  readonly total: number;
  readonly porVeredito: Readonly<Record<VereditoDaLinha, number>>;
  /** Por caso, na ordem canônica de {@link ORDEM_DOS_CASOS}. */
  readonly porCaso: readonly ContagemPorCaso[];
  /** Quantas vezes cada regra da conferência **reprovou**. Da mais frequente para a menos. */
  readonly porRegra: readonly { readonly regra: string; readonly vezes: number }[];
  /** Quantas vezes cada classe de falha (e o defeito) apareceu. */
  readonly porClasse: readonly { readonly classe: string; readonly vezes: number }[];
}

function zerado(): Record<VereditoDaLinha, number> {
  const out = {} as Record<VereditoDaLinha, number>;
  for (const v of VEREDITOS) out[v] = 0;
  return out;
}

/**
 * A linha conta em `porClasse`? Toda classe de falha do fio, mais o defeito — o `switch`
 * é **exaustivo** pelo mesmo motivo do de {@link vereditoDe}: uma classe nova no fio não
 * compila aqui até alguém decidir se ela conta.
 *
 * Escrito à mão, e não com o `ehClasseDeFalha` do fio, de propósito: assim este módulo
 * importa **só tipo** do núcleo de IA, e nada o aproxima do fecho da guarda (7) — a régua
 * da bancada precisa continuar importável pela tela de desenvolvimento.
 */
function contaPorClasse(d: DesfechoDaLinha): boolean {
  switch (d) {
    case 'indisponivel':
    case 'capacidade':
    case 'janela':
    case 'guarda':
    case 'recusa-do-modelo':
    case 'saida-invalida':
    case 'transitoria':
    case 'defeito':
      return true;
    case 'ok':
    case 'reprovada':
    case 'template':
    case 'mudo':
      return false;
    default: {
      const nunca: never = d;
      throw new TypeError(`desfecho sem classe: ${String(nunca)}`);
    }
  }
}

/** O que {@link agregar} lê de uma linha — a da coluna e a da sonda têm os três. */
export type LinhaAgregavel = Pick<LinhaDoRelatorio, 'desfecho' | 'caso' | 'problemas'>;

export function agregar(linhas: readonly LinhaAgregavel[]): Agregados {
  const porVeredito = zerado();
  const porCaso = new Map<string, { total: number; porVeredito: Record<VereditoDaLinha, number> }>();
  const porRegra = new Map<string, number>();
  const porClasse = new Map<string, number>();

  for (const l of linhas) {
    const v = vereditoDe(l.desfecho);
    porVeredito[v] += 1;
    const caso = porCaso.get(l.caso) ?? { total: 0, porVeredito: zerado() };
    caso.total += 1;
    caso.porVeredito[v] += 1;
    porCaso.set(l.caso, caso);
    // Só reprovação conta como reprovação. Uma ressalva numa linha aprovada (ou na
    // recusa, que tem problema próprio) entraria como se a regra tivesse barrado algo.
    if (v === 'reprovada') {
      for (const p of l.problemas ?? []) porRegra.set(p.regra, (porRegra.get(p.regra) ?? 0) + 1);
    }
    if (contaPorClasse(l.desfecho)) {
      porClasse.set(l.desfecho, (porClasse.get(l.desfecho) ?? 0) + 1);
    }
  }

  const ordenar = (m: Map<string, number>): { chave: string; vezes: number }[] =>
    [...m].map(([chave, vezes]) => ({ chave, vezes })).sort((a, b) => (b.vezes - a.vezes) || a.chave.localeCompare(b.chave));

  // Ordem canônica, e o caso fora da lista no fim — um caso novo aparece, não some.
  const conhecidos = ORDEM_DOS_CASOS.filter((c) => porCaso.has(c));
  const estranhos = [...porCaso.keys()].filter((c) => !(ORDEM_DOS_CASOS as readonly string[]).includes(c)).sort();

  return {
    total: linhas.length,
    porVeredito,
    porCaso: [...conhecidos, ...estranhos].map((caso) => {
      const c = porCaso.get(caso)!;
      return { caso: caso as CasoDaSaude['caso'], total: c.total, porVeredito: c.porVeredito };
    }),
    porRegra: ordenar(porRegra).map(({ chave, vezes }) => ({ regra: chave, vezes })),
    porClasse: ordenar(porClasse).map(({ chave, vezes }) => ({ classe: chave, vezes })),
  };
}

/* ── a janela medida, e as quatro medidas da ADR 0050 ────────────────────── */

/**
 * A regra **única** de "janela medida", a mesma na coluna e na sonda, e escrita ao lado dos
 * números — no relatório do Mac e na tela do iPhone: entra a tentativa que **chegou ao
 * modelo**. Ficam fora — e contadas à parte — a que nem chamou (template, muda), a
 * sintética (o hospedeiro não entregou o motor), o `defeito` (bug nosso), o
 * `indisponivel` (o motor não atendia) e a falha que o próprio hospedeiro fabricou (prazo,
 * processo que caiu, protocolo, rede).
 */
export const REGRA_DA_JANELA_MEDIDA =
  'Janela medida é a tentativa que chegou ao modelo. Ficam fora, contadas à parte: a sintética ' +
  '(o hospedeiro não entregou o motor), o defeito (bug da bancada), o `indisponivel` (o motor não ' +
  'atendia) e a falha que o próprio hospedeiro fabricou (prazo, processo que caiu, protocolo, rede). ' +
  'A aprovação é `ok` ÷ medidas; a mediana é das medidas não frias — a fria é a primeira de um ' +
  'processo novo, em que o modelo sobe.';

/** Por que uma linha ficou fora da medida — ou `null`, se ela é medida. Nesta ordem de precedência. */
export type ForaDaMedida = 'semChamada' | 'sintetica' | 'defeito' | 'indisponivel' | 'doHospedeiro';

export const MOTIVOS_FORA_DA_MEDIDA: readonly ForaDaMedida[] = Object.freeze([
  'semChamada', 'sintetica', 'defeito', 'indisponivel', 'doHospedeiro',
]);

export function foraDaMedida(l: {
  readonly desfecho: DesfechoDaLinha;
  readonly sintetica?: true;
  readonly doHospedeiro?: true;
}): ForaDaMedida | null {
  if (l.desfecho === 'template' || l.desfecho === 'mudo') return 'semChamada';
  if (l.sintetica) return 'sintetica';
  if (l.desfecho === 'defeito') return 'defeito';
  if (l.desfecho === 'indisponivel') return 'indisponivel';
  if (l.doHospedeiro) return 'doHospedeiro';
  return null;
}

function contagemFora(linhas: readonly Parameters<typeof foraDaMedida>[0][]): Record<ForaDaMedida, number> {
  const out = { semChamada: 0, sintetica: 0, defeito: 0, indisponivel: 0, doHospedeiro: 0 };
  for (const l of linhas) {
    const f = foraDaMedida(l);
    if (f) out[f] += 1;
  }
  return out;
}

/** Presença na amostra e aprovadas, num alcance. */
export interface NaAmostra {
  readonly amostra: number;
  readonly aprovadas: number;
}

/**
 * Os alcances que a cobertura percorre — a condição 2 da ADR 0050 é "os sete casos nos
 * **dois** alcances", e é desta lista que o "dois" sai, nunca de aritmética.
 *
 * **Exaustiva por construção:** um alcance novo em `AlcanceDaSaude` deixa `SobraDeAlcance`
 * diferente de `never`, e a linha abaixo não compila até ele entrar aqui — o mesmo
 * mecanismo do `switch` de {@link vereditoDe}, e o motivo é o mesmo: uma combinação que
 * ninguém conta é uma condição do portão medida pela metade, em silêncio.
 */
export const ALCANCES_DA_COBERTURA = ['noite', 'periodo'] as const satisfies readonly AlcanceDaSaude[];

type SobraDeAlcance = Exclude<AlcanceDaSaude, (typeof ALCANCES_DA_COBERTURA)[number]>;
const _coberturaCobreTodoAlcance: [SobraDeAlcance] extends [never] ? true : SobraDeAlcance = true;
void _coberturaCobreTodoAlcance;

/** O nome de cada alcance na leitura — exaustivo pelo `Record`. */
export const ROTULO_DO_ALCANCE: Readonly<Record<AlcanceDaSaude, string>> = {
  noite: 'noite',
  periodo: 'período',
};

/** A cobertura de um caso: a presença na amostra e as aprovadas, **em cada alcance**. */
export type CoberturaDoCaso = { readonly caso: CasoDaSaude['caso'] } & {
  readonly [A in AlcanceDaSaude]: NaAmostra;
};

/**
 * Os números que as quatro condições da ADR 0050 leem, numa coluna de modelo — **sem
 * limiar e sem veredito**:
 *
 *  1. aprovação — `ok` sobre as janelas **medidas** ({@link REGRA_DA_JANELA_MEDIDA});
 *  2. cobertura — por caso × alcance, a presença na amostra **e** as aprovadas, noite e
 *     período separados;
 *  3. idênticas — as aprovadas cuja frase final é igual à do template;
 *  4. mediana — do tempo por chamada, sobre as medidas não frias.
 */
export interface MedidasDoPortao {
  /** As linhas da coluna — a amostra inteira. */
  readonly janelas: number;
  readonly medidas: number;
  /** As que ficaram fora da medida, por motivo — a soma com `medidas` fecha em `janelas`. */
  readonly foraDaMedida: Readonly<Record<ForaDaMedida, number>>;
  readonly aprovadas: number;
  readonly cobertura: readonly CoberturaDoCaso[];
  readonly identicasAoTemplate: number;
  /** Em ms, das medidas não frias. `null` quando não sobrou nenhuma. */
  readonly medianaMs: number | null;
  /** Quantas medidas entraram na mediana. */
  readonly naMediana: number;
  /** As medidas frias — fora da mediana, e ditas. */
  readonly frias: number;
}

/** A mediana — a média dos dois do meio, numa lista par. `null` na vazia. */
export function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
}

export function medidasDoPortao(linhas: readonly LinhaDoRelatorio[]): MedidasDoPortao {
  const medidas = linhas.filter((l) => foraDaMedida(l) === null);
  const aprovadas = medidas.filter((l) => l.desfecho === 'ok');
  const naAmostra = (caso: CasoDaSaude['caso'], alcance: AlcanceDaSaude): NaAmostra => ({
    amostra: linhas.filter((l) => l.caso === caso && l.alcance === alcance).length,
    aprovadas: aprovadas.filter((l) => l.caso === caso && l.alcance === alcance).length,
  });
  const quentes = medidas.filter((l) => !l.frio);
  return {
    janelas: linhas.length,
    medidas: medidas.length,
    foraDaMedida: contagemFora(linhas),
    aprovadas: aprovadas.length,
    // Caso × alcance percorrendo a LISTA de alcances: quem acrescentar um terceiro não
    // precisa lembrar de nada aqui, e não compila sem declará-lo.
    cobertura: ORDEM_DOS_CASOS.map((caso) => {
      const porAlcance = {} as { [A in AlcanceDaSaude]: NaAmostra };
      for (const alcance of ALCANCES_DA_COBERTURA) porAlcance[alcance] = naAmostra(caso, alcance);
      return { caso, ...porAlcance };
    }),
    identicasAoTemplate: aprovadas.filter((l) => l.frase !== undefined && l.frase.trim() === l.template.trim()).length,
    medianaMs: mediana(quentes.map((l) => l.ms)),
    naMediana: quentes.length,
    frias: medidas.length - quentes.length,
  };
}

/**
 * A cobertura em uma linha de leitura: quantas das combinações caso × alcance estão na
 * amostra, quantas têm ao menos uma aprovada, e quais ficaram sem janela. É como o
 * relatório do Mac e a tela do iPhone escrevem a condição 2 — a mesma conta nos dois.
 */
export function resumoDaCobertura(m: Pick<MedidasDoPortao, 'cobertura'>): {
  readonly combinacoes: number;
  readonly presentes: number;
  readonly comAprovada: number;
  /** `caso/noite` ou `caso/período`, na ordem dos casos. */
  readonly semJanela: readonly string[];
} {
  const contar = (leitura: (na: NaAmostra) => boolean): number =>
    m.cobertura.reduce((n, c) => n + ALCANCES_DA_COBERTURA.filter((a) => leitura(c[a])).length, 0);
  return {
    combinacoes: m.cobertura.length * ALCANCES_DA_COBERTURA.length,
    presentes: contar((na) => na.amostra > 0),
    comAprovada: contar((na) => na.aprovadas > 0),
    semJanela: m.cobertura.flatMap((c) =>
      ALCANCES_DA_COBERTURA.filter((a) => c[a].amostra === 0).map((a) => `${c.caso}/${ROTULO_DO_ALCANCE[a]}`),
    ),
  };
}

/* ── a cópia do exemplo (story 5.11) ─────────────────────────────────────── */

/**
 * A regra mecânica da cópia, escrita ao lado dos números — a mesma que
 * `motores-5-11/rodadas.md` usou à mão.
 */
export const REGRA_DA_COPIA =
  'Cada aprovada é comparada com o exemplo do próprio pedido, com os marcadores, antes da troca. ' +
  '**Idêntica**: o texto do motor é o exemplo, a menos do espaço nas pontas. **Quase**: as palavras são as ' +
  'do exemplo a menos da pontuação (`.` `,` `;` `:` `—` `–`), de uma palavra trocada, tirada ou posta, ou o ' +
  'exemplo cortado no fim. **Texto próprio**: o resto. Maiúscula e minúscula contam como diferença.';

/** Como uma aprovada se relaciona com o exemplo do pedido. */
export type FormaDaAprovada = 'identica' | 'quase' | 'propria' | 'semExemplo';

/** As palavras de um texto, sem a pontuação que a regra da cópia ignora. */
function palavrasDaCopia(s: string): string[] {
  return s.replace(/[.,;:—–]/gu, ' ').split(/\s+/u).filter((w) => w !== '');
}

/** A distância de edição, em palavras. */
function distanciaEmPalavras(a: readonly string[], b: readonly string[]): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      atual[j] = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length]!;
}

/**
 * A forma de uma aprovada contra o exemplo do pedido, pela {@link REGRA_DA_COPIA}. Sem
 * texto ou sem exemplo (linha de antes da 5.11), `semExemplo` — nunca um palpite.
 */
export function formaDaAprovada(texto: string | undefined, exemplo: string | undefined): FormaDaAprovada {
  if (texto === undefined || exemplo === undefined || exemplo.trim() === '') return 'semExemplo';
  const t = texto.trim();
  const x = exemplo.trim();
  if (t === x) return 'identica';
  const a = palavrasDaCopia(t);
  const b = palavrasDaCopia(x);
  const cortado = a.length > 0 && a.length < b.length && a.every((w, i) => w === b[i]);
  return cortado || distanciaEmPalavras(a, b) <= 1 ? 'quase' : 'propria';
}

/** As aprovadas de uma coluna, contadas contra o exemplo — a soma fecha em `aprovadas`. */
export interface CopiaDoExemplo {
  readonly aprovadas: number;
  readonly identicas: number;
  readonly quase: number;
  readonly proprias: number;
  readonly semExemplo: number;
}

/**
 * A cópia numa coluna de modelo: só as aprovadas **medidas**, pela mesma regra da
 * aprovação ({@link REGRA_DA_JANELA_MEDIDA}) — e por isso `aprovadas` aqui é o mesmo
 * número que o de {@link medidasDoPortao}.
 *
 * **Sem limiar e sem veredito**, como o resto deste módulo: quanto copiar é demais é do
 * dono. Ela existe porque a condição 3 da ADR 0050 compara a aprovada só com o template —
 * no modelo pequeno do Mac, boa parte das "aprovadas" era o exemplo do pedido devolvido, e
 * aquela condição marcava zero idênticas sem mentir.
 */
export function copiaDoExemplo(linhas: readonly LinhaDoRelatorio[]): CopiaDoExemplo {
  const aprovadas = linhas.filter((l) => foraDaMedida(l) === null && l.desfecho === 'ok');
  const conta = { identica: 0, quase: 0, propria: 0, semExemplo: 0 };
  for (const l of aprovadas) conta[formaDaAprovada(l.textoDoMotor, l.exemplo)] += 1;
  return {
    aprovadas: aprovadas.length,
    identicas: conta.identica,
    quase: conta.quase,
    proprias: conta.propria,
    semExemplo: conta.semExemplo,
  };
}
