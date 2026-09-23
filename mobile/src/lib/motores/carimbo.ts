/**
 * O **carimbo** de uma compilação que terminou neste aparelho: quando, e quanto levou.
 *
 * ## Por que é guardado, e por que só isto é guardado
 *
 * A compilação de um peso aberto leva de 11 a 15 min (medidos em 22/09, no iPhone 17 Pro),
 * e **o iOS não emite fração alguma** enquanto ela corre — nem etapa, nem evento, nem
 * crescimento em disco. A única estimativa honesta que o app pode dar é *da última vez,
 * neste iPhone, levou N minutos*, e ela só existe porque aconteceu aqui: o tamanho do
 * arquivo não prediz o tempo (o Tucano2 é 15% menor e compilou 27% mais rápido) e o que o
 * Mac mediu não vale para o telefone.
 *
 * **O carimbo é lembrança, nunca promessa.** Ele *não* decide se o modelo está compilado —
 * quem decide isso é `isCached`, relido na montagem e ao focar (ver `LeitorDaCompilacao`).
 * Um carimbo ao lado de um modelo que voltou a `instalado, não compilado` é uma
 * **contradição**, e a ficha tem de explicá-la (o iOS recompila tudo quando o sistema
 * atualiza, e apaga o cache sob pressão de espaço) em vez de mostrar os dois lado a lado.
 *
 * **Só uma compilação que terminou carimba.** Parar aos três minutos num dia e compilar de
 * verdade noutro não pode produzir *da última vez levou 3 min* — seria uma promessa falsa
 * no lugar exato em que o dono a usa para decidir se cabe no intervalo antes de sair.
 * Quem chama {@link gravarCarimbo} é a tela de compilação, na fase *terminou*, e mais
 * ninguém — **e ela ainda não existe** (é a fatia 2). Até lá a ficha lê um mapa vazio e
 * diz isso, que é o que ela tem.
 *
 * **Uma chave, um dono**, e a fila de `preferencia.ts` pelo mesmo motivo: AsyncStorage não
 * tem read-modify-write atômico, e dois modelos carimbados em sequência perderiam um.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from '../local-store';

/** A chave, deste módulo. */
const KEY = 'vitale:motores-carimbo';

/** Uma compilação que terminou neste aparelho. */
export interface CarimboDaCompilacao {
  /** Quando ela terminou (ms desde a época). */
  readonly em: number;
  /** Quanto ela levou, em ms. */
  readonly ms: number;
}

/** O que está guardado: um carimbo por **pasta de pesos**, só as que já compilaram aqui. */
export type CarimbosDaCompilacao = Readonly<Record<string, CarimboDaCompilacao>>;

/** O mapa vazio — o que a ficha lê hoje, e o que toda falha de leitura devolve. */
export const SEM_CARIMBOS: CarimbosDaCompilacao = Object.freeze({});

/**
 * O mapa cru → os carimbos legíveis.
 *
 * Pura e exportada porque é ela que tem teste: o que chega do disco pode ter sido gravado
 * por outra versão do app, e um `ms` que é string ou um `em` que é `NaN` atravessaria até
 * a ficha e sairia como *levou NaN min* na única tela que existe para não inventar número.
 * Entrada que não se lê **não entra e não é apagada** — a versão que a gravou talvez saiba
 * lê-la.
 */
export function lerCarimbosDoCru(cru: unknown): CarimbosDaCompilacao {
  if (typeof cru !== 'object' || cru === null || Array.isArray(cru)) return SEM_CARIMBOS;
  const out: Record<string, CarimboDaCompilacao> = {};
  for (const [pasta, valor] of Object.entries(cru as Record<string, unknown>)) {
    if (typeof valor !== 'object' || valor === null) continue;
    const { em, ms } = valor as Partial<Record<'em' | 'ms', unknown>>;
    // `em` tem de ser um instante plausível e `ms` uma duração não negativa: os dois
    // viram texto na tela, e um deles negativo viraria "levou -3 min".
    if (typeof em !== 'number' || !Number.isFinite(em) || em <= 0) continue;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) continue;
    out[pasta] = { em, ms };
  }
  return out;
}

/** Os carimbos guardados. **Nunca lança**: armazenamento quebrado devolve vazio. */
export async function lerCarimbos(store: KVStore = asyncStore): Promise<CarimbosDaCompilacao> {
  try {
    return lerCarimbosDoCru(await getJSON<unknown>(KEY, store));
  } catch {
    return SEM_CARIMBOS;
  }
}

/**
 * Serializa as escritas — o molde de `preferencia.ts`, e nunca envenena a corrente: uma
 * gravação que falha devolve o erro a quem a pediu e deixa a próxima passar.
 */
let fila: Promise<void> = Promise.resolve();

/**
 * Carimba uma compilação que **terminou**. Só a fase *terminou* da tela de compilação
 * chama isto; ver o cabeçalho.
 *
 * O mapa é lido cru e mesclado, para o carimbo de um modelo que esta versão não conhece
 * sobreviver à escrita do carimbo de outro.
 */
export function gravarCarimbo(
  pasta: string,
  carimbo: CarimboDaCompilacao,
  store: KVStore = asyncStore,
): Promise<void> {
  const proxima = fila.then(async () => {
    const cru = { ...(await getJSON<Record<string, unknown>>(KEY, store).catch(() => null) ?? {}) };
    cru[pasta] = { em: carimbo.em, ms: carimbo.ms };
    await setJSON(KEY, cru, store);
  });
  fila = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}
