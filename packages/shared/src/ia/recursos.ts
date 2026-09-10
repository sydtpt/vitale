/**
 * O catálogo de recursos que falam com modelo (AD-2).
 *
 * É aqui que `RecursoId` tem dono, e é daqui que o seletor de motores lista os
 * recursos — nunca de uma lista escrita à mão numa tela. Cada recurso registra o
 * seu descritor no catálogo; o descritor mora junto do domínio dele (`sleep/`,
 * `routes/`, `ia/`).
 *
 * **Nasce vazio.** A retrospectiva entra na 5.2 e a Saúde do sono na 5.3; o
 * nome de rota, na 5.7. Até lá, `validarDescritor` é provado com descritores
 * falsos, e o teste que percorre o catálogo passa a morder no dia em que o
 * primeiro entrar.
 */
import { SEM_MODELO, TIPOS_DE_MOTOR, lerMotorId } from './fio';
import { exposicao } from './motor';
import { ELOS_DE_PADRAO, REGIMES_DE_NUMEROS, type Descritor } from './orquestrar';

export const RECURSOS = ['retrospectiva', 'saude-do-sono', 'nome-de-rota'] as const;

export type RecursoId = (typeof RECURSOS)[number];

/** Os descritores registrados. Um por recurso. */
export const CATALOGO_DE_RECURSOS: readonly Descritor<unknown, unknown>[] = [];

const FUNCOES = ['montarPedido', 'interpretar', 'conferir', 'montarFrase', 'semModelo'] as const;

/**
 * Os problemas de um descritor; lista vazia é descritor válido. Cobra em tempo
 * de execução o que o tipo não alcança: a cadeia padrão, a versão e a forma de
 * `grava`.
 */
export function validarDescritor(d: Descritor<unknown, unknown>): string[] {
  const problemas: string[] = [];

  if (!(RECURSOS as readonly string[]).includes(d.recurso)) {
    problemas.push(`recurso fora do catálogo: ${String(d.recurso)}`);
  }
  if (!Number.isSafeInteger(d.versao) || d.versao < 1) {
    problemas.push(`versão não é inteiro positivo: ${String(d.versao)}`);
  }
  if (!(REGIMES_DE_NUMEROS as readonly string[]).includes(d.regimeDeNumeros)) {
    problemas.push(`regime de números desconhecido: ${String(d.regimeDeNumeros)}`);
  }
  const regimeConhecido = (TIPOS_DE_MOTOR as readonly string[]).includes(d.regimeMaximo);
  if (!regimeConhecido) problemas.push(`regimeMaximo desconhecido: ${String(d.regimeMaximo)}`);

  const cadeia = d.cadeiaPadrao;
  if (!Array.isArray(cadeia)) {
    problemas.push('cadeiaPadrao não é lista');
  } else {
    if (cadeia[cadeia.length - 1] !== SEM_MODELO) problemas.push('cadeiaPadrao não termina em sem-modelo');
    if (new Set(cadeia).size !== cadeia.length) problemas.push('cadeiaPadrao repete um elo');
    let anterior = Infinity;
    for (const id of cadeia) {
      // O tipo já recusa outro id; isto é para o descritor montado fora do tipo.
      if (!(ELOS_DE_PADRAO as readonly string[]).includes(id)) {
        problemas.push(`cadeiaPadrao usa ${String(id)} — só sem-modelo, aparelho:sistema e nuvem:padrao`);
        continue;
      }
      const grau = exposicao(lerMotorId(id)!.tipo);
      if (regimeConhecido && grau > exposicao(d.regimeMaximo)) {
        problemas.push(`cadeiaPadrao passa do regimeMaximo em ${id}`);
      }
      if (grau > anterior) problemas.push(`cadeiaPadrao aumenta a exposição em ${id}`);
      anterior = grau;
    }
  }

  const grava: unknown = d.grava;
  if (grava !== false) {
    const recusa = typeof grava === 'object' && grava !== null
      ? (grava as { recusaEResultado?: unknown }).recusaEResultado
      : undefined;
    if (typeof recusa !== 'boolean') problemas.push('grava não é false nem { recusaEResultado: boolean }');
  }

  for (const nome of FUNCOES) {
    if (typeof d[nome] !== 'function') problemas.push(`${nome} não é função`);
  }
  if (d.pedidoCurto !== undefined && typeof d.pedidoCurto !== 'function') {
    problemas.push('pedidoCurto não é função');
  }

  return problemas;
}
