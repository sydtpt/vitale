/**
 * Os doze meses de um ano, para o anuário da edição (Story 3.2).
 *
 * ## O custo, declarado
 *
 * **Ele lê o arquivo inteiro de edições para desenhar um ano.** `montarAnuario`
 * pede as edições de **mês** daquele ano, e a rota só tem a edição do ano;
 * `fetchArquivoDeEdicoes` é a única leitura que traz os meses, e ela não recorta
 * por intervalo — traz tudo, sem o `texto`, paginado.
 *
 * Escrever um recorte agora seria otimizar antes de medir: o arquivo tem ~170
 * linhas hoje, a leitura já é paginada e já está provada pela parede, que a
 * chama a cada foco sobre o acervo inteiro. Se um dia doer, o recorte é uma
 * linha de `.gte`/`.lte` sobre `inicio` — e o lugar de escrevê-la é
 * `data/edicoes-ia.ts`, não aqui.
 *
 * ## Uma leitura por ano aberto, e não por foco
 *
 * A parede relê a cada foco porque voltar da edição pode trazer um mês que
 * acabou de ser impresso, e a capa dele apareceria em branco. Aqui não: as
 * células leem `metrica_lider` dos **meses**, e o que se imprime nesta rota é a
 * edição do **ano** — imprimi-la não muda nenhuma das doze células. Reler a cada
 * volta seria pagar ~170 linhas por nada.
 *
 * ## O que ele nunca faz
 *
 * **Não afirma silêncio antes de saber.** Com os meses em voo a resposta é
 * `carregando`, e não "nenhum mês liderou" — senão a frase do silêncio piscaria
 * na abertura de **todo** ano, inclusive nos que têm doze líderes. E quando a
 * leitura falha a resposta é `sem-tiras`: o texto do ano abre igual, sem alarme
 * no topo sobre uma coisa que o leitor não pediu.
 *
 * Quem decide as transições é `proximoAnuario` (`lib/anuario.ts`), puro e com
 * teste; quem decide o que o arquivo **diz** é `montarAnuario`, no núcleo. Aqui
 * só se lê e se despacha.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { fetchArquivoDeEdicoes, montarAnuario, type Anuario } from '@vitale/shared';
import { anuarioInicial, anuarioValePara, chaveDoAnuario, proximoAnuario } from '../lib/anuario';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

/** O que a tela recebe — três estados, e o do meio é o único que desenha. */
export type AnuarioNaTela =
  /** Os meses estão em voo. A tela não desenha tira nem frase. */
  | { readonly estado: 'carregando' }
  | { readonly estado: 'pronto'; readonly anuario: Anuario }
  /** Sem sessão, endereço ilegível ou leitura falha: a edição abre sem as tiras. */
  | { readonly estado: 'sem-tiras' };

const CARREGANDO: AnuarioNaTela = { estado: 'carregando' };
const SEM_TIRAS: AnuarioNaTela = { estado: 'sem-tiras' };

/**
 * O anuário de um ano — ou a ausência dele.
 *
 * `ano` vem de `anoDoAnuario(inicio)` e pode ser `null` quando o endereço não se
 * lê. O parâmetro aceita o nulo de propósito: hook não mora em ramo, e a
 * alternativa seria chamá-lo condicionalmente na rota.
 */
export function useAnuarioDoAno(ano: number | null): AnuarioNaTela {
  const uid = useAuthStore((s) => s.user?.id);
  /**
   * A sessão vem do disco, e no arranque a frio ela não está pronta no primeiro
   * quadro. Sem distinguir isso de "não há sessão", quem está logado perderia as
   * tiras por um instante a cada abertura — a mesma armadilha que `estadoDe`
   * nomeia na store da edição.
   */
  const sessaoHidratando = useAuthStore((s) => s.isLoading);
  const [estado, despachar] = useReducer(proximoAnuario, undefined, anuarioInicial);
  /** O número da leitura em curso. O reducer recusa a resposta de uma carga superada. */
  const carga = useRef(0);
  /**
   * De quem e de que ano é o que está na tela **agora**.
   *
   * Calculada no render, e não dentro do efeito: é ela que impede o quadro de
   * atraso na troca de conta e na troca de ano — o efeito só roda depois do
   * render, e até lá o estado ainda descreve a leitura anterior.
   */
  const chave = chaveDoAnuario(uid, ano);

  useEffect(() => {
    carga.current += 1;
    const minha = carga.current;
    despachar({ tipo: 'ler', carga: minha, chave });

    // Endereço que não se lê: impossível pelo `periodoDaRota`, que já recusou o
    // que não abre período. Sai sem tiras, e sem uma leitura paga por nada.
    if (ano === null) {
      despachar({ tipo: 'sem-tiras', carga: minha });
      return;
    }
    if (!uid) {
      // Hidratando, o `ler` acima já deixou a tela em "carregando"; sem sessão de
      // verdade, não há arquivo de ninguém.
      if (!sessaoHidratando) despachar({ tipo: 'sem-tiras', carga: minha });
      return;
    }

    let vivo = true;
    void fetchArquivoDeEdicoes(supabase, uid).then(
      (arquivo) => {
        if (vivo) despachar({ tipo: 'arquivo', carga: minha, arquivo });
      },
      (e: unknown) => {
        console.warn('[revista] o arquivo de edições não veio para o anuário; o ano abre sem as tiras:', e);
        if (vivo) despachar({ tipo: 'sem-tiras', carga: minha });
      },
    );
    return () => {
      vivo = false;
    };
  }, [ano, uid, sessaoHidratando, chave]);

  /**
   * O que os doze meses **dizem** — do núcleo, e memoizado pelo par (estado,
   * ano): `montarAnuario` varre o arquivo inteiro, e refazê-lo a cada render da
   * edição seria pagar a varredura por cada toque na página.
   *
   * A primeira pergunta é **de quem é este estado**: um estado de outra conta ou
   * de outro ano não descreve o que está na tela, e desenhá-lo mostraria os doze
   * meses do dono anterior por um quadro. A regra é pura e tem teste.
   */
  return useMemo<AnuarioNaTela>(() => {
    if (!anuarioValePara(estado, chave) || estado.fase === 'carregando') return CARREGANDO;
    if (estado.fase === 'sem-tiras' || ano === null) return SEM_TIRAS;
    return { estado: 'pronto', anuario: montarAnuario(estado.arquivo, ano) };
  }, [estado, ano, chave]);
}
