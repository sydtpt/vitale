/**
 * O endereço de uma foto da biblioteca, resolvido para render (ADR 0037).
 *
 * `'loading'` e `null` são estados distintos de propósito: enquanto resolve, a
 * tela mostra o quadro vazio (é quase instantâneo com o cache); quando dá
 * `null`, a foto não existe mais e a tela mostra a **lacuna** — sumir calado
 * faria a contagem do cabeçalho mentir.
 */

import { useEffect, useState } from 'react';
import { resolveAssetUri, resolvePosterUri } from '../services/asset-uri';

export type AssetUri = string | null | 'loading';

/**
 * `isVideo` troca o endereço pelo **quadro-pôster**: o `Image` do RN não desenha
 * um arquivo de vídeo, e sem isto o vídeo aparece como quadro vazio.
 *
 * `durationS` só serve ao vídeo, e só à segunda tentativa do pôster — ver
 * `resolvePosterUri`. Sem ela o quadro do fim é impedível, e o clipe cujo
 * primeiro quadro não sai fica sem pôster nenhum.
 */
export function useAssetUri(
  assetId: string | null,
  isVideo = false,
  durationS: number | null = null,
): AssetUri {
  const [uri, setUri] = useState<AssetUri>('loading');

  useEffect(() => {
    let alive = true;
    setUri('loading');
    void resolvePosterUri(assetId, isVideo, durationS).then((u) => {
      if (alive) setUri(u);
    });
    return () => {
      alive = false;
    };
  }, [assetId, isVideo, durationS]);

  return uri;
}
