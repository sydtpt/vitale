/**
 * A última execução lunar gravada, e quantas já foram — para a página da lua e
 * para a linha de entrada no pé do caderno Sono (Story 4.4).
 *
 * ## Ele **lê**, e nunca calcula
 *
 * `vereditoLunar()` não é chamado aqui, nem em tela nenhuma: *uma execução é uma
 * decisão, não um render*. O hook pede a última linha gravada
 * (`fetchUltimaExecucaoLunar`) e o contador da §7.4
 * (`contarExecucoesLunares`), e nada mais. Abrir a página não autoriza execução,
 * não grava, e não move o contador — que é a peça anti-gaveta inteira da ADR
 * 0045.
 *
 * ## Carregando **não** é "ainda não rodou"
 *
 * É o molde direto de `useAnuarioDoAno`, e por essa razão: os dois estados
 * desenhariam quase a mesma coisa e são coisas diferentes. Sem a distinção, a
 * página afirmaria *"A cheia não foi lida"* — o quarto estado — por um instante
 * **em toda abertura**, inclusive depois de a sexta execução estar gravada. A
 * união discriminada é o que impede a tela de afirmar silêncio antes de saber.
 *
 * E `sem-leitura` **não** degrada para o quarto estado. "Não deu para ler" e
 * "nunca rodou" são afirmações diferentes sobre a pilha de tentativas, e
 * confundi-las é a gaveta aberta por um operador de coalescência — a lição da
 * story 2.6, que `contarExecucoesLunares` já aplica recusando `count` nulo em vez
 * de devolver zero.
 *
 * ## As duas leituras vão juntas, e falham juntas
 *
 * `Promise.all`: a execução sem o contador desenharia a moldura com o campo
 * *Execuções* mudo, e o contador sem a execução desenharia *"6ª execução"* sobre
 * quatro blocos sem leitura. As duas respondem à mesma pergunta — *o que já
 * rodou* —, então ou as duas chegam, ou a página diz que não conseguiu ler.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  contarExecucoesLunares,
  fetchUltimaExecucaoLunar,
  type ExecucaoLunar,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

/** O que a tela recebe — três estados, e só o do meio desenha veredito. */
export type VereditoLunarNaTela =
  /** A leitura está em voo. A página desenha a moldura e cala sobre o veredito. */
  | { readonly estado: 'carregando' }
  /**
   * O banco respondeu. `execucao` nulo é o **quarto estado** — nenhuma execução
   * gravada —, e é onde a página vive hoje; não é falha de leitura.
   */
  | {
      readonly estado: 'pronto';
      readonly execucao: ExecucaoLunar | null;
      /** O contador da §7.4. Zero é resposta: "nenhuma execução". */
      readonly execucoes: number;
    }
  /** Sem sessão, ou a leitura falhou. A página diz isso, e **não** o quarto estado. */
  | { readonly estado: 'sem-leitura' };

const CARREGANDO: VereditoLunarNaTela = { estado: 'carregando' };
const SEM_LEITURA: VereditoLunarNaTela = { estado: 'sem-leitura' };

/* ──────────────── O estado, fora do React ──────────────── */

/**
 * De quem é a leitura. A conta é a única chave: a execução mais recente não
 * depende de período, de rota nem de janela.
 *
 * `\u0000` como separador, pela mesma razão de `chaveDoAnuario`: um id de usuário
 * não o contém.
 */
export function chaveDoVeredito(uid: string | null | undefined): string {
  return `${uid ?? ''}\u0000lua`;
}

export type FaseDoVeredito =
  | { readonly fase: 'carregando' }
  | {
      readonly fase: 'pronto';
      readonly execucao: ExecucaoLunar | null;
      readonly execucoes: number;
    }
  | { readonly fase: 'sem-leitura' };

export type EstadoDoVeredito = FaseDoVeredito & {
  /** A carga que produziu este estado — a resposta de uma leitura superada é ignorada. */
  readonly carga: number;
  /** De quem é este estado. Ver {@link chaveDoVeredito}. */
  readonly chave: string;
};

export type AcaoDoVeredito =
  | { readonly tipo: 'ler'; readonly carga: number; readonly chave: string }
  | {
      readonly tipo: 'execucao';
      readonly carga: number;
      readonly execucao: ExecucaoLunar | null;
      readonly execucoes: number;
    }
  | { readonly tipo: 'sem-leitura'; readonly carga: number };

export function vereditoInicial(): EstadoDoVeredito {
  return { fase: 'carregando', carga: 0, chave: chaveDoVeredito(null) };
}

/**
 * A transição — pura, e por isso executável sem renderizador.
 *
 * `ler` volta sempre para `carregando`: uma leitura nova só acontece quando a
 * conta troca, e a execução do dono anterior não descreve esta tela.
 */
export function proximoVeredito(
  atual: EstadoDoVeredito,
  acao: AcaoDoVeredito,
): EstadoDoVeredito {
  if (acao.tipo === 'ler') return { fase: 'carregando', carga: acao.carga, chave: acao.chave };
  if (acao.carga !== atual.carga) return atual;
  if (acao.tipo === 'execucao') {
    return {
      fase: 'pronto',
      execucao: acao.execucao,
      execucoes: acao.execucoes,
      carga: atual.carga,
      chave: atual.chave,
    };
  }
  return { fase: 'sem-leitura', carga: atual.carga, chave: atual.chave };
}

/** O estado vale para esta chave? A guarda que mata o quadro de atraso na troca de conta. */
export function vereditoValePara(estado: EstadoDoVeredito, chave: string): boolean {
  return estado.chave === chave;
}

/* ──────────────── O hook ──────────────── */

export function useVereditoLunar(): VereditoLunarNaTela {
  const uid = useAuthStore((s) => s.user?.id);
  /**
   * A sessão vem do disco, e no arranque a frio ela não está pronta no primeiro
   * quadro. Sem distinguir isso de "não há sessão", quem está logado veria a
   * linha de entrada sumir por um instante a cada abertura da edição.
   */
  const sessaoHidratando = useAuthStore((s) => s.isLoading);
  const [estado, despachar] = useReducer(proximoVeredito, undefined, vereditoInicial);
  const carga = useRef(0);
  // Calculada no render, e não dentro do efeito: é ela que impede o quadro de
  // atraso na troca de conta.
  const chave = chaveDoVeredito(uid);

  useEffect(() => {
    carga.current += 1;
    const minha = carga.current;
    despachar({ tipo: 'ler', carga: minha, chave });

    if (!uid) {
      // Hidratando, o `ler` acima já deixou a tela em "carregando"; sem sessão de
      // verdade, não há pilha de execuções de ninguém.
      if (!sessaoHidratando) despachar({ tipo: 'sem-leitura', carga: minha });
      return;
    }

    let vivo = true;
    void Promise.all([
      fetchUltimaExecucaoLunar(supabase, uid),
      contarExecucoesLunares(supabase, uid),
    ]).then(
      ([execucao, execucoes]) => {
        if (vivo) despachar({ tipo: 'execucao', carga: minha, execucao, execucoes });
      },
      (e: unknown) => {
        console.warn('[lua] as execuções não vieram; a página da lua diz que não conseguiu ler:', e);
        if (vivo) despachar({ tipo: 'sem-leitura', carga: minha });
      },
    );
    return () => {
      vivo = false;
    };
  }, [uid, sessaoHidratando, chave]);

  return useMemo<VereditoLunarNaTela>(() => {
    if (!vereditoValePara(estado, chave) || estado.fase === 'carregando') return CARREGANDO;
    if (estado.fase === 'sem-leitura') return SEM_LEITURA;
    return { estado: 'pronto', execucao: estado.execucao, execucoes: estado.execucoes };
  }, [estado, chave]);
}
