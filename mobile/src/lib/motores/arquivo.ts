/**
 * A borda do retrato da bancada: **uma escrita em disco**, e nada mais.
 *
 * Tudo o que decide o que vai no arquivo é puro e tem teste (`./arquivo-regras.ts`). Aqui
 * só mora o que precisa do aparelho, e por isso este arquivo é curto de propósito: um
 * `try`, um `write`, uma nota quando falha.
 *
 * ## Onde, e por quê `Documents/`
 *
 * Em `Documents/` do container de dados do app — `Paths.document` do `expo-file-system`.
 * Três razões, na ordem em que pesam:
 *
 *  1. **É o endereço mais curto e estável que o `devicectl` alcança.** O domínio
 *     `appDataContainer` tem a raiz do container como origem, então o caminho é
 *     literalmente `Documents/bancada-ultima-corrida.json` — sem aritmética de caminho,
 *     sem UUID de instalação no meio.
 *  2. **O sistema não o apaga.** `Paths.cache` é purgável sob pressão de espaço, e neste
 *     iPhone a pressão é a regra, não a exceção (é ela que mata o app em segundo plano,
 *     que é o defeito que este arquivo existe para contornar). Um retrato que desaparece
 *     entre a corrida e o cabo não resolve nada.
 *  3. **`Library/Application Support/` teria de ser construído à mão.** O
 *     `expo-file-system` expõe `cache`, `bundle`, `document` e os contêineres
 *     compartilhados — Application Support só por caminho relativo montado por nós, com
 *     `intermediates` para criar o diretório. Mais peças móveis, e nenhuma delas melhora
 *     o que o `devicectl` lê.
 *
 * Contra: `Documents/` é o diretório que entra em backup e, com `UIFileSharingEnabled`,
 * apareceria no app Arquivos. **Essa chave fica desligada**: ela só existe pelo config plugin
 * do `expo-file-system`, que o app config não declara — escrever no próprio container não
 * pede entitlement nenhum, e é só isto que fazemos aqui. O conteúdo é o mesmo que a tela já
 * mostra ao dono: não é segredo novo, é o mesmo dado num formato que o cabo lê. O
 * AsyncStorage do app já mora ali ao lado, pelo mesmo motivo.
 *
 * ## Nada é transmitido
 *
 * A tela repete que *nada sai do aparelho*, e um arquivo parece contradizê-la. **Não
 * contradiz**: o princípio é sobre não transmitir. Este módulo importa uma única coisa do
 * mundo — o sistema de arquivos — e não abre rede, não pede backup, não notifica nuvem
 * nenhuma. O retrato fica dentro do container, onde só o dono chega, com o aparelho
 * desbloqueado e ligado ao Mac dele:
 *
 * ```
 * xcrun devicectl device copy from --device <UDID> \
 *   --domain-type appDataContainer --domain-identifier com.sydtpt.vitale \
 *   --source Documents/bancada-ultima-corrida.json --destination ./
 * ```
 *
 * ## Falhar em gravar não derruba a corrida
 *
 * {@link guardarUltimaCorrida} **nunca lança**. Disco cheio, permissão negada, caminho que
 * virou diretório — qualquer um deles vira uma nota no anel e a medição segue. Uma corrida
 * de meia hora de tela acesa não pode morrer por causa do seu próprio registro, e a tela
 * não muda de estado por isto: a nota é memória, aparece no cartão do anel na próxima
 * pintura, e não há `setState` nenhum neste caminho.
 */
import { File, Paths } from 'expo-file-system';
import { anel } from './anel';
import { NOME_DO_ARQUIVO, emJson, valeGuardar, type RetratoDaBancada } from './arquivo-regras';

/**
 * Grava o retrato da última corrida, substituindo o anterior.
 *
 * **Substitui, não acumula.** Histórico viraria um diretório crescendo dentro do container,
 * sem ninguém para apagá-lo e sem tela que o liste — e o que o dono quer é justamente *a
 * última*, a que ele acabou de ver. `write` sem `append` reescreve o arquivo inteiro
 * (`String.write(to:atomically:)` no iOS), então não há sobra do retrato anterior: um
 * arquivo maior não deixa cauda no menor que o substitui.
 *
 * Devolve o `file://` do que foi gravado, ou `null` quando não gravou — por falha ou porque
 * a corrida não tinha o que guardar ({@link valeGuardar}). Quem chama pode ignorar os dois:
 * o valor existe para o teste e para quem quiser mostrá-lo, nunca para decidir algo da
 * medição.
 */
export function guardarUltimaCorrida(retrato: RetratoDaBancada): string | null {
  if (!valeGuardar(retrato)) return null;
  try {
    const arquivo = new File(Paths.document, NOME_DO_ARQUIVO);
    arquivo.write(emJson(retrato));
    return arquivo.uri;
  } catch (e) {
    // O anel é o diagnóstico desta tela, e uma nota do hospedeiro é exatamente isto: algo
    // que aconteceu fora de uma leitura e que o dono precisa ver. Sem ela, o sintoma seria
    // um arquivo velho lido como se fosse o da corrida de agora — o pior desfecho possível
    // para uma medição.
    anel.anotar(`a última corrida não foi para o arquivo: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    return null;
  }
}
