/**
 * A janela lunar do teste pré-registrado — que noite cai nas cinco que
 * **antecedem** a lua cheia, e qual cheia é essa.
 *
 * O protocolo é `docs/specs/revista-retrospectiva/pre-registro-lua.md` (§3): a
 * exposição são as noites −5 a −1 do sinódico, contra todas as outras. Este
 * arquivo entrega só a classificação. O desfecho, os portões e os vereditos são
 * da story 4.2, e moram aqui também quando chegarem, porque são vocabulário de
 * sono; a efeméride fica em `astro/moon.ts`, que não sabe o que é uma noite.
 *
 * ## A noite é o instante do seu fim, 08:00 UTC do `wakeDay`
 *
 * Nunca o `apagou` medido: classificar a exposição pelo desfecho seria endógeno —
 * se a lua atrasa o adormecer, uma noite na fronteira trocaria de coluna por causa
 * do efeito que está sendo medido.
 *
 * E o **fim** da noite, não o entardecer (decisão do dono, 17/09/2026). Com o
 * entardecer às 20:00 e a cheia às 03:00, em hora local, o instante da noite que
 * contém a cheia fica antes dela, e essa noite entrava como −1 — sempre que a cheia
 * caísse entre o entardecer e o fim da noite. Com o instante no fim, uma noite só entra se
 * terminou antes da cheia, que é o sentido literal de "antecedem" — com a
 * exatidão de quanto 08:00 UTC fica perto do despertar real (os dois erros abaixo).
 *
 * **08:00 UTC**, que é 9h no inverno e 10h no verão em Bruxelas — perto do
 * despertar, e não 11:00 UTC, que foi a primeira escolha (decisão do dono na
 * revisão, 17/09/2026). Com 11:00, quando a cheia caía entre o despertar e 11:00
 * UTC, a noite que tinha terminado antes dela saía da janela: a −1 ficava de fora
 * e a −6 entrava.
 *
 * **Fixo em UTC**, nunca em hora local: na troca de horário a noite local tem 23
 * ou 25 horas, e uma janela de cinco dias contaria 4 ou 6 noites. Em UTC os
 * instantes de duas noites seguidas distam exatamente um dia, e toda cheia tem
 * exatamente cinco noites na janela, por construção.
 *
 * ## Os dois erros que qualquer hora fixa carrega, declarados
 *
 * Uma hora fixa só coincide com o despertar real quando ele acorda exatamente
 * nela. Nos outros dias sobra uma faixa entre as duas, e a cheia pode cair nela:
 *
 * - **ele acorda antes das 08:00 UTC, e a cheia cai entre o despertar e 08:00
 *   UTC**: a noite já tinha terminado antes da cheia, mas o instante dela fica
 *   depois, e ela sai da janela — a −1 de verdade vai para a coluna de fora.
 *   Erro **contra** o achado.
 * - **ele acorda depois das 08:00 UTC, e a cheia cai entre 08:00 UTC e o
 *   despertar**: a noite ainda não tinha terminado quando a cheia aconteceu, mas o
 *   instante dela fica antes, e ela entra como −1 — a noite que contém a cheia vai
 *   para a coluna testada. Erro **a favor** do achado.
 *
 * E a hora é fixa em **UTC**, mas o despertar é em hora local: na troca de horário
 * ele anda uma hora contra 08:00 UTC. O mesmo despertar das 7h fica a duas horas
 * de 08:00 UTC no inverno (9h local) e a três no verão (10h local) — a faixa do
 * erro contra o achado fica **uma hora mais larga no verão**, e a do erro a favor,
 * uma hora mais estreita.
 *
 * Por isso "a noite que contém a cheia fica de fora" vale para a noite medida
 * até 08:00 UTC, e não para o despertar real. A frequência dos dois casos depende
 * da hora em que ele acorda, que é dado de sono — e este arquivo não o lê.
 *
 * ## A janela é `[cheia − 5 d, cheia)`
 *
 * Fechada à esquerda, aberta à direita. Fechar à direita incluiria a noite de
 * maior valor esperado sob a hipótese e excluiria a −5: a coluna testada andaria
 * uma noite, e isso **não quebra teste nenhum de formato** — mede ruído com cara
 * de protocolo (R-18).
 *
 * Puro de propósito: sem fuso do hospedeiro, sem ambiente, sem coordenada. O
 * iPhone e um script de backfill têm de classificar a mesma noite do mesmo jeito.
 */
import { nextLunarPhase } from '../astro/moon';

/** Quantas noites antes da cheia formam a exposição (§3 do pré-registro). */
export const JANELA_LUNAR_NOITES = 5;

/** A hora UTC, no próprio `wakeDay`, que representa a noite: o fim dela. 9h/10h em Bruxelas. */
export const HORA_UTC_DO_FIM_DA_NOITE = 8;

const DAY_MS = 86_400_000;

/** A posição da noite antes da cheia: −5 é a mais distante, −1 a última antes dela. */
export type NoiteLunar = -5 | -4 | -3 | -2 | -1;

/** Uma noite dentro da janela: a cheia que ela antecede, e a quantas noites dela. */
export interface JanelaLunar {
  /**
   * O instante da cheia, em UT. Identifica o ciclo sinódico da noite.
   *
   * Para contar ciclos distintos (o portão de ciclos da 4.2), use
   * `cheia.getTime()`: cada chamada devolve um `Date` novo, e um `Set<Date>` ou uma
   * comparação por `===` contaria cada noite como um ciclo.
   */
  cheia: Date;
  noite: NoiteLunar;
}

/**
 * O instante que representa a noite de `wakeDay`: 08:00 UTC do próprio dia.
 *
 * `wakeDay` é a chave da noite em `SleepPeriod` — `'YYYY-MM-DD'`, o dia em que
 * ele acordou. Lança `RangeError` se não for uma data de verdade: `'2026-9-1'`,
 * `''` e `'2026-02-30'` não viram um instante qualquer calado. A ida e volta
 * pelo texto é o que pega o 30 de fevereiro, que `Date.UTC` rolaria para março.
 */
export function instanteDaNoite(wakeDay: string): Date {
  if (typeof wakeDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wakeDay)) {
    const d = new Date(
      Date.UTC(
        Number(wakeDay.slice(0, 4)),
        Number(wakeDay.slice(5, 7)) - 1,
        Number(wakeDay.slice(8, 10)),
        HORA_UTC_DO_FIM_DA_NOITE,
      ),
    );
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === wakeDay) return d;
  }
  throw new RangeError(`wakeDay não é uma data YYYY-MM-DD: '${String(wakeDay)}'`);
}

/**
 * Em que noite da janela lunar cai o instante `t`, ou `null` se fora dela.
 *
 * Só a **próxima** cheia estritamente depois de `t` pode conter `t` na janela: a
 * anterior já passou, e a de depois dela está a mais de 29 dias. Por isso
 * `nextLunarPhase` basta, e o "estritamente" é a borda aberta à direita — com `t`
 * igual à cheia, a próxima é a do mês que vem, e a noite fica fora.
 *
 * `noite = −⌈(cheia − t) / 1 d⌉`, com a borda esquerda `t = cheia − 5 d` dando −5.
 *
 * **Nunca** chame com o `apagou` medido nem com outro instante do desfecho: isso é
 * a classificação endógena que o docblock do arquivo proíbe. A porta para uma
 * noite é `janelaLunar(wakeDay)`; este instante existe para as bordas e os testes.
 */
export function janelaLunarDoInstante(t: Date): JanelaLunar | null {
  const { instant: cheia } = nextLunarPhase('full', t);
  const falta = cheia.getTime() - t.getTime();
  if (falta > JANELA_LUNAR_NOITES * DAY_MS) return null;
  return { cheia, noite: -Math.ceil(falta / DAY_MS) as NoiteLunar };
}

/** A janela lunar da noite de `wakeDay`. Lança `RangeError` se a data for torta. */
export function janelaLunar(wakeDay: string): JanelaLunar | null {
  return janelaLunarDoInstante(instanteDaNoite(wakeDay));
}
