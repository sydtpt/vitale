/**
 * As dúvidas que o dono já respondeu com **"está certo"**.
 *
 * ## Por que "está certo" precisa ser gravado
 *
 * A caixa de correções levanta a dúvida a partir do log, e o log não muda quando a
 * resposta é "não há nada para corrigir". Sem guardar a dispensa, a mesma pergunta volta
 * toda semana — e uma caixa que repete pergunta respondida é uma caixa que se desliga
 * sozinha.
 *
 * É por isso que a resposta negativa grava tanto quanto a positiva. **Uma das seis
 * anomalias do log real é falso positivo** (dois `exit` separados por 4 ms, com o estado
 * da região velho): ela nunca vai virar correção, e precisa parar de perguntar.
 *
 * ## Por que aqui e não no banco
 *
 * Na Fase 1 a dúvida **nasce do log local** — é o aparelho que sabe o que o iOS entregou
 * e o que foi descartado. Guardar a resposta ao lado da pergunta mantém as duas na mesma
 * vida: trocar de aparelho zera as duas juntas, em vez de deixar respostas órfãs de
 * perguntas que não existem mais.
 *
 * Quando a dúvida passar a nascer no banco (as testemunhas da fase 2 leem `sleep_periods`
 * e atividades), isto vira `user_preferences`, no molde de `notification_prefs`.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const KEY = 'vitale:presence-dispensadas';

/**
 * Teto. Dúvida dispensada é uma linha de texto curta, mas a lista acompanha o log por
 * meses e não tem quem a limpe — e a chave mais antiga é a que menos importa, porque a
 * pergunta correspondente já saiu da janela que a tela mostra.
 */
export const DISPENSADAS_CAP = 300;

export async function lerDispensadas(store: KVStore = asyncStore): Promise<string[]> {
  return (await getJSON<string[]>(KEY, store)) ?? [];
}

/** Grava "está certo" para uma dúvida. Idempotente: responder duas vezes não duplica. */
export async function dispensar(chave: string, store: KVStore = asyncStore): Promise<string[]> {
  const atuais = await lerDispensadas(store);
  if (atuais.includes(chave)) return atuais;
  const proximas = [...atuais, chave].slice(-DISPENSADAS_CAP);
  await setJSON(KEY, proximas, store);
  return proximas;
}

export async function limparDispensadas(store: KVStore = asyncStore): Promise<void> {
  await setJSON<string[]>(KEY, [], store);
}
