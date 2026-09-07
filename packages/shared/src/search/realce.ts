/**
 * Quebra um texto nos trechos que casaram e nos que não casaram, para a tela
 * grifar só a parte certa (CAP-5, CAP-9).
 *
 * Fica no núcleo, e não na tela, por dois motivos: as duas telas precisam do
 * mesmo recorte, e a regra de casamento tem de ser a MESMA da busca — se aqui
 * fosse `includes` e lá `startsWith`, o grifo apontaria para um trecho que não
 * foi o que trouxe o resultado, que é pior que não grifar nada.
 *
 * Preserva o texto original byte a byte: a normalização só decide ONDE cortar,
 * nunca o que é exibido. `Forêt` continua com o circunflexo mesmo quando o
 * casamento veio de `foret`.
 */
import { normalizar, tokenizar } from './normalize';

export interface Trecho {
  t: string;
  /** Este pedaço casou com a consulta e deve ser grifado. */
  hit: boolean;
}

/** Palavras e separadores, alternados, sem perder nada do original. */
const PARTES = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;

export function realcar(texto: string, consulta: string): Trecho[] {
  if (!texto) return [];
  const pedacos = tokenizar(consulta);
  if (pedacos.length === 0) return [{ t: texto, hit: false }];

  const out: Trecho[] = [];
  for (const parte of texto.match(PARTES) ?? []) {
    const ePalavra = /[\p{L}\p{N}]/u.test(parte);
    // Prefixo de PALAVRA, igual à busca: `pierre` grifa em Saint-Pierre e
    // `elles` não grifa nada em Ixelles.
    const hit = ePalavra && pedacos.some((p) => normalizar(parte).startsWith(p));
    const ultimo = out[out.length - 1];
    // Funde vizinhos do mesmo estado para a tela não renderizar um <Text> por
    // letra — "Louvain-la-Neuve" vira 1 ou 2 trechos, não 5.
    if (ultimo && ultimo.hit === hit) ultimo.t += parte;
    else out.push({ t: parte, hit });
  }
  return out;
}
