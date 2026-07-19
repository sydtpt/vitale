import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

export type ShareExportResult = 'shared' | 'unavailable';

/**
 * Captura a view referenciada num PNG (tmpfile) e devolve a URI. A ref deve
 * apontar para uma **View nativa** (a que embrulha o WebView do cartão) — a
 * ref do próprio WebView 13.x é um handle imperativo, não uma view, e o
 * captureRef falha com "Argument appears to not be a ReactComponent".
 *
 * Usa `react-native-view-shot` (snapshot nativo de pixels), que funciona tanto
 * para o fundo "arte" (SVG/CSS) quanto para "mapa" (tiles raster) — ao contrário
 * de `canvas.toDataURL`, que falha com tiles cross-origin (canvas "tainted").
 *
 * IMPORTANTE: no iOS o snapshot usa `drawViewHierarchyInRect`, que exige a view
 * **dentro dos limites da tela** (views em coordenadas offscreen falham com
 * "The view cannot be captured"), e o WKWebView só rasteriza a região visível.
 * Por isso o composer renderiza o WebView de export em tamanho de tela, coberto
 * por um overlay opaco — nunca deslocado para fora da tela.
 */
export async function captureCardPng(
  ref: RefObject<unknown>,
  size: { width: number; height: number },
): Promise<string> {
  const opts = {
    format: 'png' as const,
    quality: 1,
    result: 'tmpfile' as const,
    // Redimensiona o snapshot para a resolução de saída (1080×…).
    width: size.width,
    height: size.height,
  };

  try {
    return await captureRef(ref as never, opts);
  } catch (e) {
    // Fallback iOS: `renderInContext` contorna falhas do drawViewHierarchyInRect
    // com WKWebView em alguns cenários.
    if (Platform.OS === 'ios') {
      return captureRef(ref as never, { ...opts, useRenderInContext: true });
    }
    throw e;
  }
}

/** Abre o share sheet nativo com o PNG. */
export async function shareCardPng(uri: string, dialogTitle: string): Promise<ShareExportResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle,
    UTI: 'public.png',
  });
  return 'shared';
}

/**
 * Salva o PNG na galeria de fotos. O share sheet não oferece "Salvar imagem"
 * para file-URLs (só "Salvar em Arquivos"), então o salvamento é direto, via
 * expo-media-library com permissão **add-only** (NSPhotoLibraryAddUsageDescription
 * no Info.plist). 'denied' quando o usuário nega a permissão.
 */
export async function saveCardPngToGallery(uri: string): Promise<'saved' | 'denied'> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return 'denied';
  await MediaLibrary.saveToLibraryAsync(uri);
  return 'saved';
}
