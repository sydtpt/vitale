/**
 * A amostra no iPhone (story 5.13) — o que o laço da tela de desenvolvimento precisa e
 * não é régua: o portão das notas, a sequência com "parar" e a escrita dos números.
 *
 * **A régua não mora aqui.** A amostra, a tradução da medição em linha e as medidas da ADR
 * 0050 são do núcleo (`packages/shared/src/bancada/`), as mesmas da bancada do Mac, e uma
 * barreira do `architecture.test.ts` as prende, no app, à tela
 * `app/configuracoes/motores/bancada.tsx` — a amostra carrega caso, e caso não entra em
 * tela de produto. Este arquivo lê delas **só tipos**, que a compilação apaga: nenhum caso
 * passa por aqui.
 *
 * **O laço é do hospedeiro, e o motor é só o aparelho.** Uma janela por vez, pela fila da
 * ponte; a que o aparelho não atendeu (prazo, ponte) conta fora da medida, pela marca do
 * `registroDoAparelho`. Tudo fica na memória da sessão: nada disto sai do aparelho.
 */
import type { MedidasDoPortao } from '@vitale/shared';

/* ── o portão das notas ──────────────────────────────────────────────────── */

/** O que a store do sono diz das notas — o bastante para saber se elas cobrem o acervo. */
export interface EstadoDasNotas {
  /** O primeiro dia que o mapa de notas cobre, ou `null` antes de carregar. */
  readonly ratingsSince: string | null;
  /** A última falha ao estender a janela de notas. */
  readonly notasError?: string;
}

export type ProntidaoDasNotas = { readonly pronta: true } | { readonly pronta: false; readonly motivo: string };

/**
 * As notas estão **inteiras** para enumerar? Cobrem desde a noite mais antiga, e a última
 * extensão não falhou.
 *
 * É o portão que faz a amostra do iPhone ser a do Mac: a percepção muda o caso, e com as
 * notas de 90 dias que a store carrega sozinha as janelas antigas cairiam em outros casos
 * — outra amostra, e números que não se comparam. Nota antes da noite mais antiga não
 * muda caso nenhum (a percepção só lê a nota do dia de acordar de uma noite), então cobrir
 * a partir dela basta.
 */
export function prontidaoDasNotas(estado: EstadoDasNotas, noiteMaisAntiga: string): ProntidaoDasNotas {
  if (estado.notasError !== undefined) {
    return { pronta: false, motivo: `as notas não chegaram: ${estado.notasError}` };
  }
  if (estado.ratingsSince === null) {
    return { pronta: false, motivo: 'as notas ainda não chegaram' };
  }
  if (estado.ratingsSince > noiteMaisAntiga) {
    return {
      pronta: false,
      motivo: `as notas só chegaram desde ${estado.ratingsSince}, e a noite mais antiga é de ${noiteMaisAntiga}`,
    };
  }
  return { pronta: true };
}

/* ── a sequência ─────────────────────────────────────────────────────────── */

export interface ResultadoDaSequencia<L> {
  readonly linhas: readonly L[];
  /** Parou antes da última janela: as medidas são só do que já foi medido. */
  readonly parcial: boolean;
}

/**
 * Mede as janelas **uma por vez**, na ordem, e para quando pedirem.
 *
 * "Parar" não cancela a janela em voo — uma chamada nativa não se cancela, e ela termina
 * sozinha —: só não abre a próxima. A linha da janela em voo entra, porque ela foi medida;
 * o resultado sai marcado como parcial se sobrou janela sem medir.
 *
 * `medir` não rejeita: quem mede transforma o defeito em linha. Se rejeitar mesmo assim, a
 * rejeição sobe — a tela a trata como o fim da medição.
 */
export async function medirEmSequencia<J, L>(o: {
  readonly janelas: readonly J[];
  readonly medir: (janela: J, indice: number) => Promise<L>;
  readonly parar: () => boolean;
  /** Antes de cada janela: qual vai ao aparelho agora. */
  readonly aoAbrir?: (janela: J, indice: number) => void;
  /** Depois de cada janela: o que já foi medido. */
  readonly aoMedir?: (linhas: readonly L[]) => void;
}): Promise<ResultadoDaSequencia<L>> {
  const linhas: L[] = [];
  for (let i = 0; i < o.janelas.length; i += 1) {
    if (o.parar()) return { linhas, parcial: true };
    const janela = o.janelas[i] as J;
    o.aoAbrir?.(janela, i);
    linhas.push(await o.medir(janela, i));
    o.aoMedir?.([...linhas]);
  }
  return { linhas, parcial: false };
}

/* ── os números, como a tela os escreve ──────────────────────────────────── */

/** Número com vírgula decimal, como o relatório do Mac escreve. */
export function decimal(n: number, casas = 1): string {
  return n.toFixed(casas).replace('.', ',');
}

/** `parte ÷ todo` em por cento, com uma casa — ou `—` sem denominador. */
export function porcento(parte: number, todo: number): string {
  return todo === 0 ? '—' : `${decimal((parte / todo) * 100)}%`;
}

/** Milissegundos em segundos, com uma casa — ou `—` quando não há. */
export function segundos(ms: number | null): string {
  return ms === null ? '—' : `${decimal(ms / 1000)} s`;
}

/** Os motivos de ficar fora da medida, nas palavras do relatório do Mac. */
const ROTULO_FORA: Readonly<Record<keyof MedidasDoPortao['foraDaMedida'], string>> = {
  semChamada: 'sem chamada',
  sintetica: 'sintéticas',
  defeito: 'defeitos',
  indisponivel: 'indisponíveis',
  doHospedeiro: 'do hospedeiro',
};

/** O que ficou fora da medida, por motivo, numa linha — `nenhuma` quando nada ficou. */
export function foraEmTexto(fora: MedidasDoPortao['foraDaMedida']): string {
  const partes = (Object.keys(ROTULO_FORA) as (keyof typeof ROTULO_FORA)[])
    .filter((m) => fora[m] > 0)
    .map((m) => `${fora[m]} ${ROTULO_FORA[m]}`);
  return partes.length > 0 ? partes.join(' · ') : 'nenhuma';
}
