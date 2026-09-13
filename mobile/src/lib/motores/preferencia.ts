/**
 * A escolha de motor **deste aparelho**, por recurso (AD-8).
 *
 * Mora em AsyncStorage, e não em `user_preferences`: a escolha é de cada
 * aparelho, porque o que está disponível é de cada aparelho. Um iPhone com a
 * ponte do modelo do sistema e um navegador sem ela não podem compartilhar uma
 * linha no banco — sincronizar isso faria o aparelho sem ponte herdar uma
 * preferência que ele não tem como cumprir, e o recuo silencioso viraria o
 * comportamento normal.
 *
 * **Uma chave, um dono.** `vitale:motores-preferencia` é deste módulo e de mais
 * ninguém; quem quiser ler ou gravar passa por aqui. É o molde de
 * `sync-breadcrumbs.ts`, inclusive na **fila**: AsyncStorage não tem
 * read-modify-write atômico, e gravar a escolha de dois recursos ao mesmo tempo
 * (o dono tocando duas linhas do seletor em sequência) perderia uma delas calado.
 *
 * **Ler nunca lança**, e nunca apaga: valor que não se lê devolve `null`, e o
 * que está gravado fica onde está. `resolverCadeia` sabe o que fazer com a
 * ausência — cai no padrão do recurso —, e apagar a preferência de quem talvez
 * só tenha um app velho seria destruir a escolha do dono para arrumar um formato.
 */
import {
  formatarMotorId,
  lerMotorId,
  type MotorId,
  type RecursoId,
} from '@vitale/shared';
import { asyncStore, getJSON, setJSON, type KVStore } from '../local-store';

/** A chave, deste módulo. */
const KEY = 'vitale:motores-preferencia';

/** O que está gravado: um `MotorId` por recurso, só os recursos escolhidos. */
export type PreferenciaDeMotores = Readonly<Partial<Record<RecursoId, MotorId>>>;

/** O mapa cru, como está no disco — inclusive o que não se lê. */
type Cru = Readonly<Record<string, unknown>>;

async function lerCru(store: KVStore): Promise<Cru> {
  try {
    const bruto = await getJSON<unknown>(KEY, store);
    // `getJSON` já devolve `null` em JSON inválido; o que sobra é JSON válido que
    // não é objeto (um número, uma lista) — gravado por outra versão, ou lixo.
    return typeof bruto === 'object' && bruto !== null && !Array.isArray(bruto)
      ? (bruto as Cru)
      : {};
  } catch {
    // Armazenamento indisponível não é escolha do dono: a leitura devolve vazio,
    // e `resolverCadeia` usa o padrão do recurso.
    return {};
  }
}

/**
 * As escolhas legíveis, por recurso. Id que não se lê **não entra** — e não é
 * apagado: `resolverCadeia` recebe ausência e cai no padrão, que é o que a
 * matriz de bordas pede.
 */
export async function lerPreferencias(store: KVStore = asyncStore): Promise<PreferenciaDeMotores> {
  const cru = await lerCru(store);
  const out: Partial<Record<RecursoId, MotorId>> = {};
  for (const [recurso, valor] of Object.entries(cru)) {
    const lido = lerMotorId(valor);
    if (lido) out[recurso as RecursoId] = formatarMotorId(lido);
  }
  return out;
}

/** A escolha de um recurso, ou `null` — ausente, ilegível ou armazenamento quebrado. */
export async function lerPreferencia(
  recurso: RecursoId,
  store: KVStore = asyncStore,
): Promise<MotorId | null> {
  return (await lerPreferencias(store))[recurso] ?? null;
}

/**
 * Serializa as escritas. Duas linhas tocadas em sequência no seletor saem quase
 * juntas, e sem a fila a segunda leria o mapa antes de a primeira ter gravado —
 * a escolha do primeiro recurso desapareceria sem erro nenhum.
 *
 * A fila em si **nunca rejeita**: uma escrita que falha devolve o erro a quem a
 * pediu, mas não envenena a corrente. Se rejeitasse, um AsyncStorage que falhou
 * uma vez deixaria toda escolha seguinte sem gravar — e o sintoma seria "o
 * seletor não salva nada", longe da causa.
 */
let fila: Promise<void> = Promise.resolve();

/**
 * Grava (ou apaga, com `null`) a escolha de um recurso.
 *
 * O mapa é lido **cru** e mesclado: uma entrada de outro recurso que este app não
 * consegue ler — gravada por uma versão mais nova — sobrevive à escrita. Perder
 * a escolha do dono ao arrumar a de outro recurso seria pior do que não arrumar.
 */
export function gravarPreferencia(
  recurso: RecursoId,
  motor: MotorId | null,
  store: KVStore = asyncStore,
): Promise<void> {
  const proxima = fila.then(async () => {
    const cru = { ...(await lerCru(store)) };
    if (motor === null) delete cru[recurso];
    else cru[recurso] = motor;
    await setJSON(KEY, cru, store);
  });
  fila = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}
