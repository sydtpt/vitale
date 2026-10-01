/**
 * A última execução lunar gravada, e quantas já foram — para a página da lua e
 * para a linha de entrada no pé do caderno Sono (Story 4.4).
 *
 * **Este arquivo é cola.** O estado, as transições, a tradução para a vista e a
 * classificação da falha moram em `lib/lua.ts`, fora do React, pelo motivo medido do
 * anuário e da parede: dentro do hook **nada as executava**, e trocar uma delas
 * deixava a tela mentindo com as 85 suítes verdes. O que sobra aqui é o `useReducer`,
 * o efeito e as duas chamadas ao banco.
 *
 * ## Ele **lê**, e nunca calcula
 *
 * `vereditoLunar()` não é chamado aqui, nem em tela nenhuma: *uma execução é uma
 * decisão, não um render*. O hook pede a última linha gravada
 * (`fetchUltimaExecucaoLunar`) e o contador da §7.4 (`contarExecucoesLunares`), e
 * nada mais. Abrir a página não autoriza execução, não grava, e não move o contador —
 * que é a peça anti-gaveta inteira da ADR 0045.
 *
 * ## Cinco estados, e nenhum deles se confunde com outro
 *
 * `carregando` não é *"ainda não rodou"*: os dois desenhariam quase a mesma coisa e
 * são afirmações diferentes. **Sem sessão** não é *falha de leitura*: para um
 * visitante deslogado, *"não conseguiu ler a tabela"* é afirmação falsa sobre a
 * tabela. E **integridade** não é **rede**: a primeira pede tentar de novo, a segunda
 * pede consertar dado e nunca melhora tentando — a mensagem acionável de
 * `toLuaExecucao` sobe para a tela em vez de morrer num `console.warn`.
 *
 * ## Quem não precisa, não lê
 *
 * `ativo` existe porque a leitura disparava em **toda** edição, inclusive no postal e
 * no anuário, onde nenhum `Caderno` renderiza — duas consultas por abertura para
 * alimentar uma linha que não existe naquela tela.
 *
 * ## As duas leituras vão juntas, e falham juntas
 *
 * `Promise.all`: a execução sem o contador desenharia a moldura com o campo
 * *Execuções* mudo, e o contador sem a execução desenharia *"6ª execução"* sobre
 * quatro blocos sem leitura. As duas respondem à mesma pergunta — *o que já
 * rodou* —, então ou as duas chegam, ou a página diz que não conseguiu ler.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { contarExecucoesLunares, fetchUltimaExecucaoLunar } from '@vitale/shared';
import {
  chaveDoVeredito,
  falhaDaLeitura,
  proximoVeredito,
  vereditoInicial,
  vistaDoVeredito,
  type VereditoLunarNaTela,
} from '../lib/lua';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

/**
 * @param ativo Se esta tela tem onde pôr o resultado. `false` não lê nada e fica em
 *   `carregando` — que é o único estado que não afirma coisa alguma.
 */
export function useVereditoLunar(ativo = true): VereditoLunarNaTela {
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
    if (!ativo) return;
    carga.current += 1;
    const minha = carga.current;
    despachar({ tipo: 'ler', carga: minha, chave });

    if (!uid) {
      // Hidratando, o `ler` acima já deixou a tela em "carregando"; sem sessão de
      // verdade, não há pilha de execuções de ninguém — e isso não é falha de leitura.
      if (!sessaoHidratando) despachar({ tipo: 'sem-sessao', carga: minha });
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
        const { causa, recado } = falhaDaLeitura(e);
        // O log fica para o aparelho; o que o leitor precisa saber vai para a tela.
        console.warn(`[lua] as execuções não vieram (${causa}):`, e);
        if (vivo) despachar({ tipo: 'falhou', carga: minha, causa, recado });
      },
    );
    return () => {
      vivo = false;
    };
  }, [ativo, uid, sessaoHidratando, chave]);

  return useMemo<VereditoLunarNaTela>(() => vistaDoVeredito(estado, chave), [estado, chave]);
}
