import { useEffect, useMemo, useRef } from 'react';
import type { EntradaPacote } from '@vitale/shared';
import { useAuthStore } from '../store/auth.store';
import { chaveDe, estadoDe, useEdicaoStore, type EstadoEdicao } from '../store/edicao.store';

/**
 * O estado da edição de um período, **lido e só lido** — o bloco que a revista e
 * o postal precisam igual (Story 3.1).
 *
 * Ele nasceu duas vezes no mesmo arquivo: a rota da 1.11 o escreveu para a
 * edição, e o postal da 3.1 o copiou linha a linha, comentários inclusive. São
 * cinco decisões finas de uma vez, e cada cópia é uma chance de uma delas se
 * perder:
 *
 * - **a chave só muda com o dono e o período.** A `entrada` muda a cada ciclo da
 *   busca da retro; se o efeito dependesse dela, cada ciclo releria o banco;
 * - **a entrada mais recente entra por `ref`**, para o efeito ler o que vale
 *   agora sem depender do que mudou;
 * - **`estadoDe` é a mesma função dos dois lados** — a tela não pode chamar
 *   função dentro do seletor do zustand (objeto novo a cada quadro), então ela
 *   assina `porPeriodo` e deriva aqui fora;
 * - **chave nula tem duas causas**, e `sessaoHidratando` diz qual: a sessão
 *   ainda vindo do disco (`carregando`) ou a ausência de dono (`sem-sessao`);
 * - **abrir nunca escreve.** `carregar` só lê, e é a única coisa que este hook
 *   dispara.
 */
export function useEstadoDaEdicao(entrada: EntradaPacote): EstadoEdicao {
  const carregar = useEdicaoStore((s) => s.carregar);
  const porPeriodo = useEdicaoStore((s) => s.porPeriodo);
  const uid = useAuthStore((s) => s.user?.id);
  const sessaoHidratando = useAuthStore((s) => s.isLoading);

  const chave = useMemo(() => (uid ? chaveDe(uid, entrada) : null), [uid, entrada]);
  const estado = useMemo(
    () => estadoDe(porPeriodo, chave, sessaoHidratando),
    [porPeriodo, chave, sessaoHidratando],
  );

  const entradaRef = useRef(entrada);
  entradaRef.current = entrada;

  // A chave nula (sessão ainda no disco) vira chave quando ela chega, e é isso
  // que redispara a leitura.
  useEffect(() => {
    void carregar(entradaRef.current);
  }, [carregar, chave]);

  return estado;
}
