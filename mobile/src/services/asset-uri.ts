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
import { getThumbnailAsync } from 'expo-video-thumbnails';

const cache = new Map<string, string | null>();
/** Promessas em voo: dois quadros pedindo a mesma foto fazem UMA extração. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * A extração crua, **sem cache**.
 *
 * O endereço que o `getUri()` devolve não é um caminho comum: ele carrega uma
 * *chave de sandbox* concedida pelo PhotoKit no momento do pedido. O próprio
 * `expo-video` documenta isso em `URL+MediaLibraryAssets.swift` — "once we
 * request an AVAsset for a PHAsset url, the URI (…) has a valid sandbox key".
 *
 * Guardar essa string e reusá-la depois é guardar uma chave que pode já não
 * abrir. Foi o que explicou o sintoma de 07/09/2026: **alguns** pôsteres de
 * vídeo apareciam e outros não, sem padrão visível. Para vídeo, extrai-se de
 * novo a cada uso; o que se memoriza é o **pôster**, que é arquivo nosso, no
 * nosso diretório de cache, sem chave nenhuma.
 */
async function extractUri(assetId: string): Promise<string | null> {
  try {
    return (await new Asset(assetId).getUri()) ?? null;
  } catch {
    return null;
  }
}

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

/**
 * O endereço de uma **imagem** para o asset: a própria foto, ou o quadro-pôster
 * do vídeo.
 *
 * ## As duas armadilhas do pôster, ambas conferidas no iPhone
 *
 * **1. A chave de sandbox envelhece.** O endereço extraído não é um caminho
 * comum — ver `extractUri`. Por isso o vídeo extrai de novo a cada tentativa, e
 * só o pôster gerado (arquivo nosso) fica memorizado.
 *
 * **2. O gerador de quadro é estrito demais.** O `expo-video-thumbnails` roda o
 * `AVAssetImageGenerator` com `requestedTimeToleranceAfter = .zero`, e ainda
 * zera a tolerância *anterior* sempre que o instante pedido cai **dentro** do
 * clipe. Pedir o quadro em `t=0` é, portanto, exigir aquele quadro exato — o
 * que HEVC/Dolby Vision, câmera lenta e clipes aparados nem sempre entregam.
 *
 * Há uma única fresta na regra dele: quando o instante pedido **não** é menor
 * que a duração, a tolerância anterior fica no padrão (infinita) e o gerador
 * passa a poder devolver o quadro recuperável mais próximo para trás. Daí a
 * segunda tentativa, no fim do clipe: um último quadro é pôster pior que o
 * primeiro, e infinitamente melhor que um retângulo escuro.
 */
export async function resolvePosterUri(
  assetId: string | null,
  isVideo: boolean,
  durationS: number | null = null,
): Promise<string | null> {
  if (!assetId) return null;
  if (!isVideo) return resolveAssetUri(assetId);

  const key = `poster:${assetId}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      const source = await extractUri(assetId);
      if (!source) {
        cache.set(key, null);
        return null;
      }
      try {
        // `time: 0` é o primeiro quadro — o mais barato e o melhor pôster.
        const first = await getThumbnailAsync(source, { time: 0 });
        cache.set(key, first.uri);
        return first.uri;
      } catch (strict) {
        // A fresta: `time >= duração` afrouxa a tolerância anterior. Sem saber
        // a duração não há como pedir isso, e aí não há segunda tentativa.
        if (!durationS || durationS <= 0) throw strict;
        const last = await getThumbnailAsync(source, {
          time: Math.round(durationS * 1000),
        });
        cache.set(key, last.uri);
        return last.uri;
      }
    } catch (err) {
      // O `catch {}` que existia aqui custou uma hora de investigação às cegas:
      // o quadro saía vazio e não havia como saber de quê.
      console.warn('[fotos] pôster do vídeo falhou:', String(err));
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** Esquece o que foi memorizado — usado quando a biblioteca muda sob o app. */
export function clearAssetUriCache(): void {
  cache.clear();
  inflight.clear();
}
