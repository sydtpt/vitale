/**
 * O acervo da parede de capas — **uma leitura em lote por coisa** (Story 2.4b).
 *
 * A parede tem 39 células hoje, e cada uma delas quer cinco coisas: a edição, a
 * capa carimbada, o texto que vira manchete, a foto e a rota. Pedidas por célula
 * seriam ~150 idas ao banco mais 39 ao PhotoKit para desenhar uma tela — e elas
 * chegariam fora de ordem, com a parede preenchendo buracos enquanto o dedo rola.
 *
 * Aqui são **cinco chamadas, ponto**, em duas ondas:
 *
 * 1. **o arquivo, as capas e os textos**, em paralelo. Com as três a parede já
 *    desenha: período, manchete, e a grade (que não vem do banco — sai da memória
 *    da Retrospectiva, pelo selo de `memoria-da-retro.ts`);
 * 2. **as fotos e as rotas**, que dependem dos ponteiros que as capas carimbaram.
 *    Uma chamada cada, sobre a lista inteira de ids — `ponteirosDaParede` junta
 *    exatamente os dos ladrilhos que a parede vai ter, pelo **mesmo** recorte que
 *    `montarParede` usa para desenhá-los.
 *
 * O que **não** está aqui: resolver o arquivo da biblioteca em endereço. Isso é
 * por célula por obrigação (é o PhotoKit, não o banco), e acontece só no ladrilho
 * **visível**, pelo `useAssetUri` — que tem cache, dedup e teto de seis extrações
 * em voo (`services/asset-uri.ts`). A lista é virtualizada, então quem não está
 * na janela não extrai nada.
 *
 * ## As fotos vêm por id, e é isso que fecha o buraco
 *
 * `fetchPhotosByIds` lê `activity_photos` pela chave primária e **sem filtro de
 * estado**. A leitura por atividade traria centenas de linhas para escolher 39, e
 * deixaria de fora a foto que o dono desligou depois do carimbo — que continua
 * sendo a capa daquela edição. A spec proíbe `fetchPhotoById` **por célula**; uma
 * leitura em lote por id é o contrário disso.
 *
 * ## Este hook não decide nada
 *
 * Ele lê e despacha; quem decide é `proximaParede` (`lib/parede.ts`), puro e com
 * teste. A separação não é estética: enquanto as transições moravam aqui, nada as
 * executava — trocar a semeadura dos lotes por `procurando` fixo deixava capas em
 * cinza para sempre com a suíte inteira verde.
 */
import { useCallback, useReducer, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchArquivoDeEdicoes,
  fetchCapasDoArquivo,
  fetchManchetesDosMeses,
  fetchPhotosByIds,
  fetchRouteOverviewPairs,
  ponteirosDaParede,
  type AcervoDaParede,
  type ParDaRota,
} from '@vitale/shared';
import {
  paredeInicial,
  proximaParede,
  type EstadoDaParede,
} from '../lib/parede';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

/** A frase da tela para uma leitura que não veio. O motivo vai para o log. */
function mensagemDoAcervo(e: unknown): string {
  console.warn('[revista] o arquivo de edições não veio para a parede:', e);
  return 'Não foi possível abrir o arquivo agora.';
}

export interface AcervoDaParedeNaTela {
  readonly estado: EstadoDaParede;
  /** Relê tudo — o botão do erro. O foco da tela já faz isso sozinho. */
  readonly recarregar: () => void;
}

export function useAcervoDaParede(): AcervoDaParedeNaTela {
  const uid = useAuthStore((s) => s.user?.id);
  /**
   * A sessão vem do disco, e no arranque a frio ela não está pronta no primeiro
   * quadro. Sem distinguir isso de "não há sessão", quem está logado lê "Entre na
   * sua conta" por um instante a cada abertura — é a mesma armadilha que `estadoDe`
   * nomeia na store da edição.
   */
  const sessaoHidratando = useAuthStore((s) => s.isLoading);
  const [estado, despachar] = useReducer(proximaParede, undefined, () => paredeInicial(new Date()));
  /** O número da leitura em curso. O reducer recusa a resposta de uma carga superada. */
  const carga = useRef(0);

  const carregar = useCallback(() => {
    carga.current += 1;
    const minha = carga.current;
    despachar({ tipo: 'ler', carga: minha, now: new Date() });
    if (!uid) {
      // Hidratando, o `ler` acima já deixou a tela em "carregando"; sem sessão de
      // verdade, a frase é outra.
      if (!sessaoHidratando) despachar({ tipo: 'sem-sessao', carga: minha });
      return;
    }

    void (async () => {
      let acervo: AcervoDaParede;
      try {
        const [arquivo, capas, textos] = await Promise.all([
          fetchArquivoDeEdicoes(supabase, uid),
          fetchCapasDoArquivo(supabase, uid),
          fetchManchetesDosMeses(supabase, uid),
        ]);
        acervo = { arquivo, capas, textos };
      } catch (e) {
        despachar({ tipo: 'erro', carga: minha, mensagem: mensagemDoAcervo(e) });
        return;
      }

      const ponteiros = ponteirosDaParede(acervo);
      despachar({ tipo: 'acervo', carga: minha, acervo, ponteiros });

      // A segunda onda. As duas falham sozinhas: uma rota que não veio não pode
      // tirar as fotos da tela, e vice-versa — cada capa cai para o seu próprio
      // caminho de degradação.
      if (ponteiros.fotos.length > 0) {
        void fetchPhotosByIds(supabase, uid, ponteiros.fotos).then(
          (fotos) => despachar({ tipo: 'fotos', carga: minha, porId: new Map(fotos.map((f) => [f.id, f])) }),
          (e: unknown) => {
            console.warn('[revista] as fotos das capas não vieram; os ladrilhos caem para a legenda:', e);
            despachar({ tipo: 'fotos-falharam', carga: minha });
          },
        );
      }
      if (ponteiros.rotas.length > 0) {
        void fetchRouteOverviewPairs(supabase, uid, ponteiros.rotas).then(
          (rotas) => despachar({
            tipo: 'rotas',
            carga: minha,
            porId: new Map<string, readonly ParDaRota[]>(rotas.map((r) => [r.activityId, r.overview])),
          }),
          (e: unknown) => {
            console.warn('[revista] as rotas das capas não vieram; os ladrilhos caem para a grade ou o papel:', e);
            despachar({ tipo: 'rotas-falharam', carga: minha });
          },
        );
      }
    })();
  }, [uid, sessaoHidratando]);

  /**
   * Uma leitura ao montar e uma a cada volta.
   *
   * A parede é a porta para a rota da edição, e de lá se imprime: voltar com o
   * acervo de antes mostraria um mês sem capa que acabou de ganhar uma. A
   * releitura **não apaga a parede** — ver `proximaParede` e o estado `relendo`
   * dos lotes. Ela roda de novo quando a sessão chega do disco, que é o que tira a
   * parede da invisibilidade no arranque a frio.
   */
  useFocusEffect(carregar);

  return { estado, recarregar: carregar };
}
