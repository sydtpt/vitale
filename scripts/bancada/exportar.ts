/**
 * O acervo de sono, exportado sob demanda para fora do git — e lido de volta do
 * disco (AD-8/AD-11).
 *
 * **Nenhum dado de saúde de produção entra no git.** O export vai para um
 * diretório ignorado; o que se versiona é só o **manifesto**: as janelas, o `hoje`,
 * as contagens e o hash do export. O hash é o que torna duas execuções
 * comparáveis sem precisar do dado.
 *
 * **A leitura é pelos módulos donos das tabelas** (AD-4): `fetchSleepPeriodsSince`
 * e `fetchDailyRatingScores`. Elas paginam por `fetchAllPages`, com ordenação
 * total — o PostgREST corta em 1000 linhas **sem erro**, e 293 noites hoje são
 * 1200 em dois anos. Um `.from()` escrito aqui seria a segunda implementação da
 * mesma consulta, e a barreira do `architecture.test.ts` passou a varrer este
 * workspace no mesmo commit que o criou.
 *
 * **O leitor aceita as duas grafias.** O export que a bancada escreve está na
 * forma de domínio (`SleepPeriod`, camelCase), porque é o que o módulo dono
 * devolve; o export puxado à mão pela Management API está na forma da linha
 * (`snake_case`). Os dois se leem: o acervo de 12/09 do dono é anterior à bancada,
 * e recusá-lo por causa do formato jogaria fora a medição que ele já tem.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchDailyRatingScores,
  fetchSleepPeriodsSince,
  isValidDate,
  toSleepPeriod,
  type SleepPeriod,
  type SleepPeriodRecord,
} from '@vitale/shared';
import type { Dados } from './medir.ts';
import type { ClientDoNucleo } from './supabase.ts';
import { sha256De, type AcervoDoManifesto, type ArquivoDoExport } from './relatorio.ts';

export const ARQUIVO_DAS_NOITES = 'sleep_periods.json';
export const ARQUIVO_DAS_NOTAS = 'daily_ratings.json';
export const ARQUIVO_DO_MANIFESTO = 'manifesto.json';

/** O começo dos tempos para as consultas: o acervo inteiro, sem janela arbitrária. */
const DESDE_SEMPRE = '1970-01-01';

export interface Acervo {
  readonly dados: Dados;
  readonly acervo: AcervoDoManifesto;
}

/** O hash do conteúdo de um arquivo, com as linhas contadas — nunca o conteúdo. */
function descrever(arquivo: string, texto: string, linhas: number): ArquivoDoExport {
  return { arquivo, linhas, sha256: sha256De(texto) };
}

/** O hash dos dois arquivos juntos: é ele que identifica o acervo no manifesto. */
function juntar(noites: ArquivoDoExport, notas: ArquivoDoExport): AcervoDoManifesto {
  return { noites, notas, sha256: sha256De(`${noites.sha256}\n${notas.sha256}`) };
}

/**
 * As notas do sono por dia de acordar — só as preenchidas, como a store as guarda.
 *
 * `day` repetido **lança**: a tabela tem PK `(user_id, day)`, então duas linhas com o
 * mesmo dia só saem de um export montado à mão — e deixar a última ganhar escolheria
 * a percepção de uma noite por ordem de arquivo, calado.
 */
function notasPorDia(linhas: readonly { readonly day: string; readonly sleepQuality: number | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  const vistos = new Set<string>();
  for (const r of linhas) {
    if (vistos.has(r.day)) throw new Error(`${ARQUIVO_DAS_NOTAS}: o dia ${r.day} aparece duas vezes`);
    vistos.add(r.day);
    if (r.sleepQuality !== null) out[r.day] = r.sleepQuality;
  }
  return out;
}

/**
 * Puxa o acervo de produção e o grava em `dir`, que tem de estar fora do git.
 *
 * Devolve os dados em memória junto do descritor do acervo: quem exportou não
 * precisa reler o disco para medir.
 */
export async function exportarAcervo(db: ClientDoNucleo, userId: string, dir: string): Promise<Acervo> {
  const noites = await fetchSleepPeriodsSince(db, userId, DESDE_SEMPRE);
  const notas = await fetchDailyRatingScores(db, userId, DESDE_SEMPRE);

  mkdirSync(dir, { recursive: true });
  const textoDasNoites = `${JSON.stringify(noites, null, 0)}\n`;
  const textoDasNotas = `${JSON.stringify(notas, null, 0)}\n`;
  writeFileSync(join(dir, ARQUIVO_DAS_NOITES), textoDasNoites, 'utf8');
  writeFileSync(join(dir, ARQUIVO_DAS_NOTAS), textoDasNotas, 'utf8');

  return {
    dados: { noites, notas: notasPorDia(notas) },
    acervo: juntar(
      descrever(ARQUIVO_DAS_NOITES, textoDasNoites, noites.length),
      descrever(ARQUIVO_DAS_NOTAS, textoDasNotas, notas.length),
    ),
  };
}

function lerJson(caminho: string): { readonly texto: string; readonly valor: unknown } {
  let texto: string;
  try {
    texto = readFileSync(caminho, 'utf8');
  } catch {
    throw new Error(`o export não tem ${caminho}`);
  }
  try {
    return { texto, valor: JSON.parse(texto) };
  } catch (e) {
    throw new Error(`${caminho} não é JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function lista(valor: unknown, caminho: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(valor)) throw new Error(`${caminho} não é uma lista`);
  return valor as readonly Record<string, unknown>[];
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O dia de uma linha, nas duas grafias — e **lança** quando não há.
 *
 * Um export truncado, ou de outra tabela, daria `wakeDay: undefined`: a noite
 * cairia fora de toda janela e a bancada mediria um acervo menor **sem erro
 * nenhum**, escrevendo um relatório com cara de resultado. Medição contra dado
 * sujo é pior que medição que não roda.
 */
function diaDe(r: Record<string, unknown>, camelo: string, cobra: string, onde: string): string {
  const bruto = camelo in r ? r[camelo] : r[cobra];
  if (typeof bruto !== 'string' || !DIA.test(bruto)) {
    throw new Error(`${onde}: a linha não tem ${camelo} nem ${cobra} como dia AAAA-MM-DD (veio ${JSON.stringify(bruto)})`);
  }
  return bruto;
}

/** Um instante ISO que o `Date` lê. `onsetAt` e `wakeAt` alimentam horário e continuidade. */
function instante(v: unknown, campo: string, onde: string): string {
  if (typeof v !== 'string' || Number.isNaN(new Date(v).getTime())) {
    throw new Error(`${onde}: ${campo} não é um instante legível (veio ${JSON.stringify(v)})`);
  }
  return v;
}

/**
 * A noite, nas duas grafias — com **os cinco campos que a medição usa** conferidos.
 *
 * Não é zelo: `awakenings` ausente (em vez de `[]` ou de uma lista) muda a dimensão
 * da continuidade, e `tzOffset` ausente faz viagem ler como irregularidade. Um
 * export truncado nesses campos produziria um relatório completo, com cara de
 * resultado, medindo outra coisa. Os três estados de `awakenings` são preservados —
 * `null` ("a fonte não reporta"), `[]` ("não houve") e a lista — porque a diferença
 * entre eles chega até a contagem; o que se recusa é a **ausência da chave**.
 */
function umaNoite(r: Record<string, unknown>, i: number): SleepPeriod {
  const onde = `${ARQUIVO_DAS_NOITES}[${i}]`;
  const wakeDay = diaDe(r, 'wakeDay', 'wake_day', onde);
  const comDia = `${onde} (${wakeDay})`;
  const doDominio = 'wakeDay' in r;
  for (const [camelo, cobra] of [['onsetAt', 'onset_at'], ['wakeAt', 'wake_at']] as const) {
    instante(doDominio ? r[camelo] : r[cobra], doDominio ? camelo : cobra, comDia);
  }
  const tz = doDominio ? r['tzOffset'] : r['tz_offset'];
  if (!(typeof tz === 'number' || (typeof tz === 'string' && tz.trim() !== '')) || !Number.isFinite(Number(tz))) {
    throw new Error(`${comDia}: tzOffset não é número (veio ${JSON.stringify(tz)})`);
  }
  if (!Object.hasOwn(r, 'awakenings')) {
    throw new Error(
      `${comDia}: a chave awakenings não existe. Ela muda a continuidade, e os três estados ` +
        '(null, [] e a lista) contam diferente — um export sem ela mede outra coisa em silêncio.',
    );
  }
  const p = doDominio ? (r as unknown as SleepPeriod) : toSleepPeriod(r as unknown as SleepPeriodRecord);
  if (!Number.isFinite(p.asleepH)) {
    throw new Error(`${comDia}: asleepH não é número (veio ${JSON.stringify(p.asleepH)})`);
  }
  if (p.awakenings !== null && !Array.isArray(p.awakenings)) {
    throw new Error(`${comDia}: awakenings não é null nem lista (veio ${JSON.stringify(p.awakenings)})`);
  }
  return p;
}

/**
 * A nota, nas duas grafias.
 *
 * Nota **ausente** é `null` — estado real, e a maioria dos dias não tem nota. Nota
 * **presente e inválida** lança: o banco já tem `check (sleep_quality between 1 and
 * 5)` (`20260607130000_daily_ratings.sql`), então um 0 ou um "4" aqui quer dizer
 * export adulterado, e a percepção sairia de uma escala que não é a da tela.
 */
function umaNota(r: Record<string, unknown>, i: number): { day: string; sleepQuality: number | null } {
  const onde = `${ARQUIVO_DAS_NOTAS}[${i}]`;
  const day = diaDe(r, 'day', 'day', onde);
  const bruto = 'sleepQuality' in r ? r['sleepQuality'] : r['sleep_quality'];
  if (bruto === null || bruto === undefined) return { day, sleepQuality: null };
  if (typeof bruto !== 'number' || !Number.isInteger(bruto) || bruto < 1 || bruto > 5) {
    throw new Error(`${onde} (${day}): sleepQuality tem de ser um inteiro de 1 a 5, e veio ${JSON.stringify(bruto)}`);
  }
  return { day, sleepQuality: bruto };
}

/** Lê um export já em disco. Não abre rede — é o caminho de `--export`. */
export function lerAcervoDoDisco(dir: string): Acervo {
  const cruNoites = lerJson(join(dir, ARQUIVO_DAS_NOITES));
  const cruNotas = lerJson(join(dir, ARQUIVO_DAS_NOTAS));
  const noites = lista(cruNoites.valor, ARQUIVO_DAS_NOITES).map(umaNoite);
  const notas = lista(cruNotas.valor, ARQUIVO_DAS_NOTAS).map(umaNota);
  if (noites.length === 0) throw new Error(`${join(dir, ARQUIVO_DAS_NOITES)} não tem noite nenhuma`);
  return {
    dados: { noites, notas: notasPorDia(notas) },
    acervo: juntar(
      descrever(ARQUIVO_DAS_NOITES, cruNoites.texto, noites.length),
      descrever(ARQUIVO_DAS_NOTAS, cruNotas.texto, notas.length),
    ),
  };
}

/** O que o manifesto de um export diz sobre ele: o dia lido e o acervo que ele descreve. */
export interface ManifestoDoExport {
  readonly hoje: string;
  /** O `sha256` dos dois arquivos juntos, como o manifesto o gravou. */
  readonly sha256: string;
}

/**
 * O manifesto de um export já em disco, ou `null` quando ele não tem — com o `hoje`
 * **validado como dia**, do mesmo jeito que a bandeira `--hoje` é.
 *
 * Um `hoje` qualquer-string aqui atravessaria até `entradaDaSaude` e lançaria longe
 * da causa; pior, um `"2026-9-1"` compara como string contra `wakeDay` e mediria um
 * recorte que não é janela nenhuma.
 */
export function manifestoDoExport(dir: string): ManifestoDoExport | null {
  let texto: string;
  try {
    texto = readFileSync(join(dir, ARQUIVO_DO_MANIFESTO), 'utf8');
  } catch {
    return null;
  }
  let lido: { hoje?: unknown; acervo?: { sha256?: unknown } };
  try {
    lido = JSON.parse(texto) as typeof lido;
  } catch (e) {
    throw new Error(`${join(dir, ARQUIVO_DO_MANIFESTO)} não é JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { hoje } = lido;
  if (typeof hoje !== 'string' || !isValidDate(hoje)) {
    throw new Error(
      `${join(dir, ARQUIVO_DO_MANIFESTO)}: "hoje" tem de ser um dia AAAA-MM-DD real, e veio ${JSON.stringify(hoje)}`,
    );
  }
  const sha = lido.acervo?.sha256;
  if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) {
    throw new Error(`${join(dir, ARQUIVO_DO_MANIFESTO)}: "acervo.sha256" não é um sha256 (veio ${JSON.stringify(sha)})`);
  }
  return { hoje, sha256: sha };
}

/**
 * O acervo em disco é o que o manifesto descreve?
 *
 * **Falha alto quando não bate.** Sem esta conferência dá para trocar o
 * `sleep_periods.json` de um diretório e medir o acervo novo herdando o `hoje` do
 * manifesto velho: a corrida termina, o relatório sai completo e com cara de
 * resultado, e nada no arquivo diz que os dois não se correspondem. É a mesma classe
 * de erro de "medição contra código não revisado", só com o dado no lugar do código.
 */
export function conferirAcervoContraManifesto(lido: AcervoDoManifesto, m: ManifestoDoExport): void {
  if (lido.sha256 !== m.sha256) {
    throw new Error(
      `o acervo em disco não é o que o ${ARQUIVO_DO_MANIFESTO} descreve:\n` +
        `  manifesto: ${m.sha256}\n` +
        `  em disco:  ${lido.sha256}\n` +
        '  Os arquivos mudaram depois do export. Exporte de novo, ou apague o manifesto e passe --hoje\n' +
        '  para declarar o dia deste acervo — medir um contra o outro dá um relatório que mente.',
    );
  }
}
