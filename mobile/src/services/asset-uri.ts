/**
 * O endereço carregável de uma foto da biblioteca (ADR 0037).
 *
 * ## Por que isto existe
 *
 * A primeira versão montava `ph://<localIdentifier>` na mão — o mesmo formato
 * que a API legada do `expo-media-library` devolve em `asset.uri`. **Não
 * funciona**: conferido no iPhone em 06/09/2026, com a varredura achando as
 * fotos e todos os quadros saindo vazios.
 *
 * O caminho suportado é `Asset.getUri()`, que no iOS passa por um
 * `UriExtractor` e devolve um `file://` de verdade — o que o `Image` do React
 * Native carrega sem depender de nenhum loader especial de biblioteca.
 *
 * ## Por que tem cache
 *
 * `getUri()` extrai o recurso, então não é de graça: uma tira com 14
 * miniaturas faria 14 extrações a cada render. O id é estável dentro da
 * sessão, então o resultado é memorizado — inclusive o `null`, para uma foto
 * apagada não ser reprocurada a cada quadro.
 */

import { Asset } from 'expo-media-library';

const cache = new Map<string, string | null>();
/** Promessas em voo: dois quadros pedindo a mesma foto fazem UMA extração. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Resolve o `assetId` num endereço carregável.
 *
 * Devolve `null` quando a foto não existe mais na biblioteca — que é um estado
 * legítimo (ADR 0037: a cura reendereça ponteiro trocado, não ressuscita
 * arquivo apagado), e a tela mostra a lacuna.
 */
export async function resolveAssetUri(assetId: string | null): Promise<string | null> {
  if (!assetId) return null;
  const hit = cache.get(assetId);
  if (hit !== undefined) return hit;

  const pending = inflight.get(assetId);
  if (pending) return pending;

  const task = (async () => {
    try {
      const uri = await new Asset(assetId).getUri();
      cache.set(assetId, uri ?? null);
      return uri ?? null;
    } catch {
      cache.set(assetId, null);
      return null;
    } finally {
      inflight.delete(assetId);
    }
  })();

  inflight.set(assetId, task);
  return task;
}

/** Esquece o que foi memorizado — usado quando a biblioteca muda sob o app. */
export function clearAssetUriCache(): void {
  cache.clear();
  inflight.clear();
}
