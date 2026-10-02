/**
 * A caixa de correções da Presença: o que o app tem a perguntar, e o que acontece quando
 * o dono responde.
 *
 * ## O app levanta a dúvida; quem decide é ele
 *
 * Nenhum detector aqui corrige nada sozinho, e isso não é timidez: **uma das seis
 * anomalias do log real é falso positivo** — dois `exit` separados por 4 ms, com o estado
 * da região velho. Uma máquina que corrigisse sozinha teria inventado uma chegada em casa
 * que não houve.
 *
 * Por isso as duas respostas gravam. *"Cheguei"* vira visita manual; *"está certo"* vira
 * dispensa. A segunda é tão necessária quanto a primeira: sem ela a mesma pergunta volta
 * toda semana e a caixa se desliga sozinha.
 *
 * ## De onde vêm as dúvidas
 *
 * | Fonte | O que ela vê |
 * |---|---|
 * | a sequência do log | `exit`→`exit` (chegada perdida) e `enter`→`enter` (saída perdida) |
 * | o rótulo descartado | `enter` em background, sozinho no instante — a corrida de 02/10 |
 *
 * A segunda é a que devolve **hora exata**, e por isso é a que chega com a folha
 * preenchida. As testemunhas do banco — sono e atividade com rota — já existem no núcleo
 * (`contradicoes`) e entram quando a tela souber ler as duas.
 */

import {
  contradicoes,
  enviarVisitas,
  fetchActivities,
  fetchLugares,
  fetchPlaceDays,
  fetchSleepPeriodsSince,
  parear,
  rollupDoBanco,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { chegadasEngolidas, readPresenceLog } from '../lib/presence-events';
import { readPresencePlaces } from '../lib/presence-places';
import { dispensar, lerDispensadas } from '../lib/presence-dispensadas';

export type MotivoDaDuvida = 'sequencia' | 'descartada' | 'sono' | 'atividade';

export interface Duvida {
  /** Chave estável: é por ela que "está certo" dura. */
  chave: string;
  motivo: MotivoDaDuvida;
  /** Nome do lugar, como o dono o escreveu. */
  lugar: string;
  placeIdLocal: string;
  /** Instante proposto para a chegada — só existe quando a fonte o conhece. */
  chegadaProposta: string | null;
  /**
   * A saída que abriu a ausência: a última travessia de saída **daquele lugar** antes da
   * chegada proposta.
   *
   * Sai do log e não da tela, porque a tela não tem como saber — e porque uma correção
   * precisa das duas pontas: o intervalo a subtrair é `[saída, chegada]`. Sem a ponta de
   * baixo, a correção seria um instante, e instante não recorta estadia nenhuma.
   */
  saidaProposta: string | null;
  /** Os dois instantes entre os quais a borda deveria ter existido. */
  de: string;
  ate: string;
}

/**
 * O que há para perguntar, já sem o que ele dispensou.
 *
 * A dúvida com hora exata vem primeiro: ela é a única que o dono consegue responder sem
 * esforço, e deixar as vagas na frente faria a caixa parecer trabalho.
 */
export async function duvidasDaPresenca(userId?: string): Promise<Duvida[]> {
  const [log, lugares, dispensadas] = await Promise.all([
    readPresenceLog(),
    readPresencePlaces(),
    lerDispensadas(),
  ]);
  if (log.length === 0) return [];

  const nome = (id: string): string => lugares.find((l) => l.id === id)?.name ?? id;
  const ja = new Set(dispensadas);
  const out: Duvida[] = [];

  const emOrdem = [...log].sort((a, b) => a.at.localeCompare(b.at));
  const saidaAntesDe = (placeId: string, at: string): string | null => {
    let ultima: string | null = null;
    for (const e of emOrdem) {
      if (e.at >= at) break;
      if (e.placeId === placeId && e.kind === 'exit' && !e.redundant) ultima = e.at;
    }
    return ultima;
  };

  for (const c of chegadasEngolidas(log)) {
    const saida = saidaAntesDe(c.placeId, c.at);
    out.push({
      chave: `descartada:${c.at}`,
      motivo: 'descartada',
      lugar: nome(c.placeId),
      placeIdLocal: c.placeId,
      chegadaProposta: c.at,
      saidaProposta: saida,
      de: saida ?? c.at,
      ate: c.at,
    });
  }

  for (const a of parear(log).anomalias) {
    out.push({
      chave: `seq:${a.kind}:${a.ate}`,
      motivo: 'sequencia',
      lugar: nome(a.placeId),
      placeIdLocal: a.placeId,
      chegadaProposta: null,
      saidaProposta: null,
      de: a.de,
      ate: a.ate,
    });
  }

  // As testemunhas do banco. Elas só entram com sessão, e **falhar nelas não derruba a
  // caixa**: as duas de cima vêm do log local e valem sozinhas. Uma caixa que fica vazia
  // porque a rede caiu some com perguntas que o aparelho já sabia fazer.
  if (userId) {
    try {
      out.push(...(await duvidasDoBanco(userId, log, lugares)));
    } catch {
      // sem rede, só as do log
    }
  }

  return out
    .filter((d) => !ja.has(d.chave))
    .sort((a, b) => {
      if (a.motivo !== b.motivo) return a.motivo === 'descartada' ? -1 : 1;
      return b.ate.localeCompare(a.ate);
    });
}

/**
 * As duas testemunhas que moram no banco (já prontas em `contradicoes`).
 *
 * | Testemunha | Audita | O que ela sabe |
 * |---|---|---|
 * | `sleep_periods` | a **chegada** | dormiu, e não há presença em casa naquele dia |
 * | atividade **com rota** | a **saída** | o dia diz "não saiu" e há uma pedalada nele |
 *
 * Nenhuma decide: a do sono não distingue "dormiu fora" de "a chegada se perdeu", e as
 * duas coisas são legítimas. Quem separa é ele, na caixa.
 *
 * A janela é curta de propósito — 45 dias. Dúvida velha não é acionável: ele não lembra,
 * e a caixa vira um arquivo de culpa em vez de uma lista de uma pergunta.
 */
const JANELA_DAS_TESTEMUNHAS_DIAS = 45;

async function duvidasDoBanco(
  userId: string,
  log: Awaited<ReturnType<typeof readPresenceLog>>,
  lugares: Awaited<ReturnType<typeof readPresencePlaces>>,
): Promise<Duvida[]> {
  const hoje = new Date();
  const de = new Date(hoje);
  de.setDate(de.getDate() - JANELA_DAS_TESTEMUNHAS_DIAS);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const tz = log.find((e) => e.tz)?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const [ls, dias, noites, atividades] = await Promise.all([
    fetchLugares(supabase, userId),
    fetchPlaceDays(supabase, userId, ymd(de), ymd(hoje)),
    fetchSleepPeriodsSince(supabase, userId, ymd(de)),
    fetchActivities(supabase, userId),
  ]);

  const rollup = rollupDoBanco(dias);
  const comCasa = new Set(
    rollup.filter((l) => l.placeId === 'casa' && l.seconds > 0).map((l) => l.day),
  );
  const identidadeCasa = ls.find((l) => l.kind === 'home')?.identidade ?? 'casa';

  const achadas = contradicoes({
    // Os dias classificados não são recalculados aqui: a caixa pergunta sobre o que o
    // banco já afirma, e recalcular abriria a porta para ela discordar da tela.
    dias: [],
    anomalias: [],
    tz,
    casa: identidadeCasa,
    diasComCasa: comCasa,
    noites: noites.map((n) => ({ inicio: n.onsetAt, fim: n.wakeAt })),
    atividades: atividades
      .filter((a) => a.hasRoute)
      .map((a) => ({ inicio: a.startAt, fim: a.endAt ?? undefined, temRota: true })),
  });

  const nomeCasa = lugares.find((l) => (l.identidade ?? '') === identidadeCasa)?.name ?? 'Casa';
  return achadas.map((c) => ({
    chave: c.chave,
    motivo: c.motivo === 'sono' ? 'sono' : 'atividade',
    lugar: nomeCasa,
    placeIdLocal: '',
    chegadaProposta: null,
    saidaProposta: null,
    de: c.de,
    ate: c.ate,
  }));
}

/** "Está certo": a dúvida para de perguntar e nada é gravado no banco. */
export async function confirmarQueEstaCerto(chave: string): Promise<void> {
  await dispensar(chave);
}

/**
 * "Cheguei": grava a correção como **visita manual**.
 *
 * `place_id` nulo porque o que se corrige é *"eu não estava fora"* — e nulo, neste
 * modelo, é "fora de qualquer lugar conhecido". O rollup aplica a precedência
 * `manual > geofence` e recorta a estadia medida; nada da medição é apagado.
 *
 * A dúvida é dispensada **depois** da gravação: se o banco recusar, ela continua na
 * caixa, que é onde ele consegue tentar de novo.
 */
export async function registrarChegada(userId: string, duvida: Duvida): Promise<void> {
  if (!duvida.chegadaProposta || !duvida.saidaProposta) {
    throw new Error('esta dúvida não tem as duas pontas: nada a subtrair.');
  }
  await enviarVisitas(supabase, userId, [
    {
      placeId: null,
      source: 'manual',
      clientEventId: `correcao:${duvida.chave}`,
      arrivedAt: duvida.saidaProposta,
      departedAt: duvida.chegadaProposta,
      departedSource: 'manual',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      status: 'confirmed',
    },
  ]);
  await dispensar(duvida.chave);
}
