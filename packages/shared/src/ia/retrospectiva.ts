/**
 * O descritor da retrospectiva — a revista declarada como recurso (AD-13, story 5.2).
 *
 * **As peças que a revista já usa, sem mudar uma regra delas** — o prompt de
 * `ia/prompt.ts`, a conferência de `ia/verificar.ts`, as versões que
 * `edicoes_ia` já grava —, ditas no idioma do orquestrador, para a sequência da
 * impressão (story 1.10) chamá-lo uma vez por caderno em vez de percorrer
 * pedido → modelo → conferência por conta própria.
 *
 * **O recorte é o da 1.10, não o de hoje.** A impressão em produção narra uma
 * vez por edição (`montarPromptDaEdicao`) e confere o texto contra os quatro
 * pacotes juntos. Este descritor narra e confere **por caderno** — e por isso é
 * mais estrito: um número que só existe em outro caderno passa na conferência de
 * hoje e reprova aqui, pela regra dos números. É a frouxidão que o pacote por
 * caderno existe para acabar (`ia/pacote.ts`, versão 2).
 *
 * - **Regime copiado e conferido** (AD-6): o motor escreve números, e a
 *   conferência exige que cada um exista no pacote do caderno.
 * - **Grava, e só a nuvem** (AD-12): a edição impressa é permanente, e o motor
 *   do aparelho ainda não passou pela bancada para a revista. Quem pede o
 *   aparelho para ela fica no piso — nunca sobe para a nuvem. É pela bancada que
 *   um tipo novo entra no `admite` (AD-9).
 * - **Recusa não é resultado**: texto recusado não vira edição.
 * - **Piso é ausência**: a revista não imprime sem modelo.
 *
 * Não importa valor de `ia/recursos`: é o catálogo que importa este arquivo, e
 * o contrário faria nascer um ciclo.
 */
import { NUVEM_PADRAO, SEM_MODELO } from './fio';
import type { Descritor } from './orquestrar';
import { PACOTE_VERSAO, type PacoteDeFatos } from './pacote';
import { montarPrompt, PROMPT_VERSAO } from './prompt';
import { verificarTexto } from './verificar';

/**
 * A versão do descritor é o par que `edicoes_ia` já grava — `prompt_versao` e
 * `pacote_versao` — num número só, sem coluna nova: 4002 é o prompt 4 sobre o
 * pacote 2. O par só se recupera (`Math.floor(v / 1000)`, `v % 1000`) enquanto o
 * pacote ficar abaixo de 1000, e um teste cobra isso.
 *
 * Mudança só na conferência não a sobe. É o ponto cego que já existe hoje:
 * nenhuma das duas versões gravadas muda quando `verificar.ts` muda.
 */
const VERSAO = PROMPT_VERSAO * 1000 + PACOTE_VERSAO;

export const descritorDaRetrospectiva: Descritor<PacoteDeFatos, string> = {
  recurso: 'retrospectiva',
  versao: VERSAO,
  regimeDeNumeros: 'copiado-e-conferido',
  regimeMaximo: 'nuvem',
  cadeiaPadrao: [NUVEM_PADRAO, SEM_MODELO],
  grava: { admite: ['nuvem'], recusaEResultado: false },

  /**
   * O prompt de hoje, sem tirar nem pôr, com a amostragem do motor e saída em
   * texto. Nulo — "não gaste chamada" — em dois casos:
   *
   * - **período em curso**: recurso que grava não narra período aberto (§3 do
   *   spec `ia-analitica`). É a mesma regra que a impressão de hoje aplica antes
   *   de montar, agora dentro do núcleo;
   * - **caderno mudo**: `montarPrompt` devolve `usuario` vazio, e a `ia-narrar`
   *   responderia 400 a isso.
   */
  montarPedido(p) {
    if (!p.periodo.fechado) return null;
    const { sistema, usuario } = montarPrompt(p);
    if (usuario === '') return null;
    return { sistema, usuario, amostragem: 'padrao', saida: { tipo: 'texto' }, guardrails: 'padrao' };
  },

  interpretar: (resposta) => resposta.texto,

  /**
   * A conferência de hoje, contra o pacote **deste caderno**. Ela não detecta
   * recusa: um texto que recusa e passa nas regras é texto, e um que reprova é
   * `reprovada`.
   */
  conferir(texto, p) {
    const v = verificarTexto(texto, p);
    return v.ok ? { ok: true } : { ok: false, problemas: v.problemas };
  },

  montarFrase: (texto) => texto,

  semModelo: () => ({ ausencia: 'a revista não imprime sem modelo' }),
};
