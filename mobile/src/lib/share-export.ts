import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export type ShareExportResult = 'shared' | 'unavailable';

/**
 * Captura a view referenciada (o WebView offscreen que renderiza o cartão em
 * resolução plena) num PNG e abre o share sheet nativo.
 *
 * Usa `react-native-view-shot` (snapshot nativo de pixels), que funciona tanto
 * para o fundo "arte" (SVG/CSS) quanto para "mapa" (tiles raster) — ao contrário
 * de `canvas.toDataURL`, que falha com tiles cross-origin (canvas "tainted").
 */
export async function captureAndShareCard(
  ref: RefObject<unknown>,
  size: { width: number; height: number },
  dialogTitle: string,
): Promise<ShareExportResult> {
  const uri = await captureRef(ref as never, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: size.width,
    height: size.height,
  });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle,
    UTI: 'public.png',
  });
  return 'shared';
}
