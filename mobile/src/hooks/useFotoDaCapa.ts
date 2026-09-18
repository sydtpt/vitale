/**
 * A imagem da capa carimbada — do `foto_id` gravado ao endereço que o `<Image>`
 * carrega (Story 1.13).
 *
 * `edicoes_capa` guarda **valor, nunca ponteiro**: o id da linha de
 * `activity_photos` e o instante da captura, porque o `localIdentifier` do
 * PhotoKit não é estável (ADR 0037). Desenhar precisa do ponteiro de hoje, e são
 * dois passos até ele: a linha (uma consulta) e o arquivo (o `getUri()` da
 * biblioteca, que é o mesmo caminho do resto do app — nunca um `ph://` montado à
 * mão, que não carrega).
 *
 * Os quatro estados existem porque a rota faz coisas diferentes com eles, e
 * `null` não distinguiria "ainda procurando" de "não existe mais":
 *
 * - **sem-foto** — a capa é `tracado`, `grade`, ou não há capa carimbada: a rota
 *   desenha a capa em papel da 1.11, sem reservar espaço para imagem;
 * - **procurando** — a rota já desenha a capa com foto, sem a imagem: o bloco tem
 *   altura fixa, e piscar papel antes da foto seria um salto de layout a cada
 *   abertura;
 * - **pronta** — a imagem;
 * - **sem-imagem** — a linha sumiu, ou o arquivo saiu da biblioteca: a rota cai
 *   para o papel **com a legenda carimbada**, que é o que continua dizendo onde o
 *   período aconteceu.
 */
import { useEffect, useState } from 'react';
import { fetchPhotoById, type Capa } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { resolvePosterUri } from '../services/asset-uri';
import { useAuthStore } from '../store/auth.store';

export type FotoDaCapa =
  | { readonly estado: 'sem-foto' }
  | { readonly estado: 'procurando' }
  | { readonly estado: 'pronta'; readonly uri: string }
  | { readonly estado: 'sem-imagem' };

const SEM_FOTO: FotoDaCapa = { estado: 'sem-foto' };
const PROCURANDO: FotoDaCapa = { estado: 'procurando' };

/**
 * Quanto se espera pela biblioteca antes de desistir da imagem.
 *
 * `getUri()` **exporta o recurso**, e uma foto que mora só no iCloud pode demorar
 * — ou nunca voltar, se a promessa ficar pendurada. Sem teto, o estado ficaria
 * `procurando` para sempre: a capa mostraria o quadro escuro com o texto e nunca
 * cairia para o papel, que é a degradação declarada.
 */
const TETO_DA_BUSCA_MS = 12_000;

export function useFotoDaCapa(capa: Capa | null): FotoDaCapa {
  const uid = useAuthStore((s) => s.user?.id);
  const fotoId = capa?.natureza === 'foto' ? capa.fotoId : null;
  /**
   * O estado inicial sai do `fotoId`, e não de `sem-foto` fixo: com o fixo, o
   * primeiro render de uma capa de foto pintava papel e o efeito trocava para o
   * quadro escuro logo depois — um pisca de capa inteira a cada abertura.
   */
  const [r, setR] = useState<FotoDaCapa>(() => (fotoId ? PROCURANDO : SEM_FOTO));

  useEffect(() => {
    if (!fotoId || !uid) {
      setR(SEM_FOTO);
      return undefined;
    }
    let vivo = true;
    setR(PROCURANDO);
    /** Uma resposta só: o teto não fala depois de a biblioteca falar, nem vice-versa. */
    const resolver = (proximo: FotoDaCapa): void => {
      if (!vivo) return;
      vivo = false;
      setR(proximo);
    };
    const teto = setTimeout(() => {
      console.warn('[revista] a foto da capa não chegou a tempo; a capa cai para o papel.');
      resolver({ estado: 'sem-imagem' });
    }, TETO_DA_BUSCA_MS);

    void (async () => {
      try {
        const foto = await fetchPhotoById(supabase, uid, fotoId);
        // O vídeo entra pelo quadro-pôster: o `Image` do RN não desenha um
        // arquivo de vídeo, e sem isso a capa sairia em branco.
        const uri = foto
          ? await resolvePosterUri(foto.assetId, foto.mediaType === 'video', foto.durationS)
          : null;
        resolver(uri ? { estado: 'pronta', uri } : { estado: 'sem-imagem' });
      } catch (e) {
        console.warn('[revista] a foto da capa não resolveu:', e);
        resolver({ estado: 'sem-imagem' });
      }
    })();

    return () => {
      vivo = false;
      clearTimeout(teto);
    };
  }, [fotoId, uid]);

  return r;
}
