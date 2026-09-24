/**
 * A **marca** de que uma compilação começou e ainda não tinha desfecho — o único jeito de a
 * tela distinguir *parada por você* de *interrompida sem você*.
 *
 * ## Por que ela existe
 *
 * A compilação leva de 11 a 15 min e roda dentro de uma chamada nativa que não se cancela.
 * Enquanto o processo do app vive, a tela sabe o que aconteceu: ela viu o desfecho, ou viu o
 * dono tocar em Parar. Mas o iOS pode encerrar o app nesse meio — e aí não sobra nada na
 * memória. Ao voltar, o Expo Router restaura a rota, a tela monta de novo e, sem marca, ela
 * faria **a pior das duas coisas**: recomeçar sozinha uma tarefa de quinze minutos que ninguém
 * pediu de novo.
 *
 * Com a marca, o desfecho é o do desenho: *a compilação foi interrompida*, sem relógio e sem
 * carimbo, com um botão para recomeçar. O tempo que correu antes não se sabe, e inventá-lo
 * seria pior que não ter nenhum.
 *
 * ## O que NÃO fica guardado
 *
 * **Não fica o instante de início**, de propósito. Tê-lo tentaria a tela a mostrar "correram N
 * minutos antes de ser interrompida", e esse número é uma mentira de duas pontas: o app pode
 * ter sido encerrado a qualquer momento depois (o relógio contaria a suspensão junto) e o
 * carregador pode ter morrido antes. O que fica é só *qual pasta*, que é o que a tela precisa
 * para saber se a marca é dela.
 *
 * **E ela nunca vira carimbo.** Quem carimba é a fase *terminou* (ver `carimbo.ts`); uma
 * compilação interrompida não produz medida nenhuma.
 *
 * **Uma chave, um dono**, e a fila pelo mesmo motivo de `preferencia.ts` e `carimbo.ts`:
 * AsyncStorage não tem read-modify-write atômico.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from '../local-store';

/** A chave, deste módulo. */
const KEY = 'vitale:motores-compilacao-em-curso';

/** A pasta de pesos cuja compilação começou e não teve desfecho, ou `null`. */
export type CompilacaoEmCurso = string | null;

/**
 * O cru → a pasta, ou `null`.
 *
 * Pura e exportada porque é ela que tem teste: o que chega do disco pode ter sido gravado por
 * outra versão do app. Um valor que não é um nome de pasta plausível não vira marca — e uma
 * marca inventada faria a tela recusar-se a compilar, dizendo "foi interrompida", para sempre.
 */
export function lerEmCursoDoCru(cru: unknown): CompilacaoEmCurso {
  if (typeof cru !== 'string') return null;
  const pasta = cru.trim();
  return pasta === '' ? null : pasta;
}

/** A marca guardada. **Nunca lança**: armazenamento quebrado devolve `null`. */
export async function lerEmCurso(store: KVStore = asyncStore): Promise<CompilacaoEmCurso> {
  try {
    return lerEmCursoDoCru(await getJSON<unknown>(KEY, store));
  } catch {
    return null;
  }
}

/** Serializa as escritas — o molde de `carimbo.ts`, e nunca envenena a corrente. */
let fila: Promise<void> = Promise.resolve();

function enfileirar(passo: () => Promise<void>): Promise<void> {
  const proxima = fila.then(passo);
  fila = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}

/**
 * Marca que a compilação **desta pasta** começou.
 *
 * Uma marca por vez, e a última vence: duas compilações simultâneas não existem (o compilador
 * compartilha a promessa em voo por pasta, e a tela é uma), então guardar uma lista seria
 * cerimônia sobre um caso impossível.
 */
export function marcarEmCurso(pasta: string, store: KVStore = asyncStore): Promise<void> {
  return enfileirar(() => setJSON(KEY, pasta, store));
}

/**
 * Apaga a marca — chamada em **todo** desfecho: terminou, falhou, o dono parou, e também
 * quando a tela lê uma marca antiga e a transforma no estado "interrompida".
 *
 * O último caso é o que importa para não travar: sem ele, a marca de uma interrupção velha
 * sobreviveria e a tela diria "foi interrompida" em toda visita seguinte.
 */
export function esquecerEmCurso(store: KVStore = asyncStore): Promise<void> {
  return enfileirar(() => store.removeItem(KEY));
}
