/**
 * Testes da janela lunar — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua.test.ts
 *
 * A cheia vem sempre da efeméride (`astro/moon.ts`, conferida contra o USNO em
 * `moon.test.ts`), nunca de uma data escrita à mão: um teste com cheia inventada
 * passaria com a janela deslocada. Nenhum dado de sono entra aqui — o
 * pré-registro proíbe olhar antes de rodar, e a janela não precisa de noite
 * medida para ser conferida.
 *
 * O que este arquivo cobra é o R-18: a janela `[cheia − 5 d, cheia)` com a borda
 * que a fechada à direita erraria. Uma janela deslocada não quebra formato nenhum;
 * quebra estes casos.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lunarPhasesBetween, nextLunarPhase } from '../astro/moon';
import { USNO_FASES_2023_2027 } from '../astro/moon-usno.data';
import {
  HORA_UTC_DO_FIM_DA_NOITE,
  JANELA_LUNAR_NOITES,
  instanteDaNoite,
  janelaLunar,
  janelaLunarDoInstante,
} from './lua';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` do dia UTC do instante. */
const diaUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A cheia da efeméride mais próxima depois de `iso`. */
const cheiaDepois = (iso: string) => nextLunarPhase('full', new Date(iso)).instant;

check('as constantes são as do pré-registro e da decisão de 17/09', () => {
  assert.equal(JANELA_LUNAR_NOITES, 5);
  assert.equal(HORA_UTC_DO_FIM_DA_NOITE, 8);
  assert.equal(instanteDaNoite('2026-09-17').toISOString(), '2026-09-17T08:00:00.000Z');
  // Na troca de horário de Bruxelas a hora continua 08:00 UTC — o relógio local não entra.
  assert.equal(instanteDaNoite('2025-03-30').toISOString(), '2025-03-30T08:00:00.000Z');
  assert.equal(instanteDaNoite('2025-10-26').toISOString(), '2025-10-26T08:00:00.000Z');
  assert.equal(instanteDaNoite('2024-02-29').toISOString(), '2024-02-29T08:00:00.000Z');
});

/* ─────────────────────── A matriz da spec ─────────────────────── */

const CHEIA = cheiaDepois('2026-09-17T00:00:00Z');
const C = CHEIA.getTime();

check('borda esquerda — t = cheia − 5 d exato é a noite −5', () => {
  assert.deepEqual(janelaLunarDoInstante(new Date(C - 5 * DAY_MS)), { cheia: CHEIA, noite: -5 });
});

check('borda direita — t = cheia exato fica FORA (a janela fechada à direita erraria aqui)', () => {
  assert.equal(janelaLunarDoInstante(CHEIA), null);
});

check('um ms antes da cheia é a noite −1', () => {
  assert.deepEqual(janelaLunarDoInstante(new Date(C - 1)), { cheia: CHEIA, noite: -1 });
});

check('fora — um ms antes da borda esquerda', () => {
  assert.equal(janelaLunarDoInstante(new Date(C - 5 * DAY_MS - 1)), null);
});

check('as cinco noites mudam exatamente a cada dia inteiro', () => {
  for (let n = 1; n <= 5; n += 1) {
    // A noite −n vai de `cheia − n d` inclusive a `cheia − (n−1) d` exclusive.
    assert.equal(janelaLunarDoInstante(new Date(C - n * DAY_MS))?.noite, -n, `primeiro ms da −${n}`);
    assert.equal(janelaLunarDoInstante(new Date(C - (n - 1) * DAY_MS - 1))?.noite, -n, `último ms da −${n}`);
    const seguinte = janelaLunarDoInstante(new Date(C - (n - 1) * DAY_MS));
    assert.equal(seguinte?.noite ?? null, n === 1 ? null : -(n - 1), `depois da −${n}`);
  }
});

check('noite que contém a cheia — cheia de madrugada, 07/10/2025 03:47 UTC', () => {
  const cheia = cheiaDepois('2025-10-05T00:00:00Z');
  const hora = cheia.getUTCHours();
  assert.ok(hora >= 0 && hora < HORA_UTC_DO_FIM_DA_NOITE, `a cheia não caiu de madrugada: ${cheia.toISOString()}`);
  const W = diaUTC(cheia.getTime());
  assert.equal(W, '2025-10-07');
  // A noite que termina em W contém a cheia: fica de fora.
  assert.equal(janelaLunar(W), null);
  // A noite anterior terminou antes dela: é a −1.
  assert.deepEqual(janelaLunar('2025-10-06'), { cheia, noite: -1 });
  assert.deepEqual(janelaLunar('2025-10-02'), { cheia, noite: -5 });
  assert.equal(janelaLunar('2025-10-01'), null);
});

check('cheia à tarde — 18/07/2027 15:45 UTC: W é −1, W+1 fica de fora', () => {
  const cheia = cheiaDepois('2027-07-16T00:00:00Z');
  const hora = cheia.getUTCHours();
  assert.ok(hora >= HORA_UTC_DO_FIM_DA_NOITE, `a cheia não caiu à tarde: ${cheia.toISOString()}`);
  assert.equal(diaUTC(cheia.getTime()), '2027-07-18');
  assert.deepEqual(janelaLunar('2027-07-18'), { cheia, noite: -1 });
  assert.equal(janelaLunar('2027-07-19'), null);
  assert.deepEqual(janelaLunar('2027-07-14'), { cheia, noite: -5 });
  assert.equal(janelaLunar('2027-07-13'), null);
});

/** A cheia do USNO com instante `iso`, e a da efeméride que corresponde a ela. */
function cheiaDoUsno(iso: string): { usno: number; cheia: Date } {
  assert.ok(
    USNO_FASES_2023_2027.some(([k, i]) => k === 'full' && i === iso),
    `o USNO não lista cheia em ${iso}`,
  );
  const usno = Date.parse(iso);
  const cheia = nextLunarPhase('full', new Date(usno - DAY_MS)).instant;
  // A mesma cheia: a efeméride fica a 2 min do USNO (a tolerância de moon.test.ts).
  assert.ok(Math.abs(cheia.getTime() - usno) <= 2 * 60_000, `efeméride ${cheia.toISOString()} vs USNO ${iso}`);
  return { usno, cheia };
}

/**
 * O USNO publica ao minuto, e a API não diz se arredonda ou trunca. O instante
 * verdadeiro está, então, em `[usno − 30 s, usno + 60 s)`: 30 s antes se ele
 * arredonda, até 60 s depois se trunca. As asserções abaixo valem na faixa toda.
 */
const USNO_ANTES_MS = 30_000;
const USNO_DEPOIS_MS = 60_000;

check('cheia entre 08:00 e 11:00 UTC — 20/05/2027, 10:59 UTC pelo USNO: W é −1, W+1 fica de fora', () => {
  const { usno, cheia } = cheiaDoUsno('2027-05-20T10:59Z');
  const W = '2027-05-20';
  const t = instanteDaNoite(W).getTime();
  // As duas desigualdades que decidem o caso valem em toda a faixa do minuto do
  // USNO. A segunda é o que a hora antiga faria: com 11:00 UTC o instante da noite
  // de 20/05 ficaria depois da cheia, e ela sairia da janela. Ela é conferida contra
  // o USNO e não contra a efeméride: a 61 s das 11:00, a efeméride pode cair do
  // outro lado dentro dos 2 min que `moon.test.ts` tolera.
  assert.ok(t < usno - USNO_ANTES_MS, 'a noite de 20/05 termina antes da cheia');
  // `<=` basta: o instante verdadeiro é estritamente menor que `usno + 60 s`.
  assert.ok(usno + USNO_DEPOIS_MS <= t + 3 * 3_600_000, 'e a cheia cai antes das 11:00 UTC');
  assert.deepEqual(janelaLunar(W), { cheia, noite: -1 });
  assert.equal(janelaLunar('2027-05-21'), null);
});

check('a cheia do USNO mais perto de 08:00 UTC — 09/08/2025, 07:55: W fica de fora, W−1 é −1', () => {
  // Achada, não escolhida: entre as 62 cheias de 2023 a 2027 do USNO, a de menor
  // distância entre a hora do dia e 08:00 UTC. Ela fica a 5 min, longe demais para
  // que perder o ΔT (69 s) a troque de lado — quem reprova isso é o viés cobrado em
  // `moon.test.ts`. Este caso prende a borda da hora fixa, não a efeméride.
  const perto = USNO_FASES_2023_2027
    .filter(([k]) => k === 'full')
    .map(([, iso]) => {
      const d = new Date(iso);
      return { iso, dist: Math.abs(d.getUTCHours() * 60 + d.getUTCMinutes() - HORA_UTC_DO_FIM_DA_NOITE * 60) };
    })
    .sort((a, b) => a.dist - b.dist)[0];
  assert.equal(perto.iso, '2025-08-09T07:55Z');
  const { usno, cheia } = cheiaDoUsno(perto.iso);
  const W = '2025-08-09';
  const t = instanteDaNoite(W).getTime();
  // 5 min antes de 08:00: a cheia fica antes do fim da noite em toda a faixa do
  // minuto do USNO.
  assert.ok(usno + USNO_DEPOIS_MS <= t, 'a cheia cai antes das 08:00 UTC de 09/08');
  assert.ok(cheia.getTime() < t, `a efeméride pôs a cheia em ${cheia.toISOString()}, depois das 08:00`);
  assert.equal(janelaLunar(W), null);
  assert.deepEqual(janelaLunar('2025-08-08'), { cheia, noite: -1 });
  assert.deepEqual(janelaLunar('2025-08-04'), { cheia, noite: -5 });
});

check('wakeDay malformado lança RangeError com o valor', () => {
  for (const ruim of ['2026-9-1', '', '2026-02-30', '2025-02-29', '2026-13-01', '17/09/2026', ' 2026-09-17']) {
    assert.throws(
      () => janelaLunar(ruim),
      (e: unknown) => e instanceof RangeError && e.message.includes(`'${ruim}'`),
      `'${ruim}' deveria lançar RangeError citando o valor`,
    );
    assert.throws(() => instanteDaNoite(ruim), RangeError);
  }
});

/* ─────────────────────── Toda cheia, de 22/05/2023 a 2027 ─────────────────────── */

check('toda cheia de 22/05/2023 a 2027 tem exatamente 5 noites, −5 a −1, e a noite dela fica fora', () => {
  // 22/05/2023 é o início do acervo da revista: as edições existem a partir dessa
  // data, e sol e lua retroagem até ela (`docs/specs/revista-retrospectiva/spec.md`).
  // A janela tem de estar certa em todo período que a revista pode imprimir.
  const inicio = Date.UTC(2023, 4, 22);
  const fim = Date.UTC(2028, 0, 1);
  const cheias = lunarPhasesBetween(new Date(inicio), new Date(fim))
    .filter((f) => f.kind === 'full')
    .map((f) => f.instant.getTime());
  // As do USNO: 8 em 2023 depois de 22/05, 12 em 2024, 12 em 2025, 13 em 2026, 12 em 2027.
  assert.equal(cheias.length, 57, `${cheias.length} cheias no intervalo, e não 57`);

  // Varre todo wakeDay com folga antes da primeira janela e depois da última cheia.
  const porCheia = new Map<number, Array<{ wakeDay: string; noite: number }>>();
  for (let d = inicio - 10 * DAY_MS; d <= fim + 2 * DAY_MS; d += DAY_MS) {
    const wakeDay = diaUTC(d);
    const j = janelaLunar(wakeDay);
    if (!j) continue;
    const lista = porCheia.get(j.cheia.getTime()) ?? [];
    lista.push({ wakeDay, noite: j.noite });
    porCheia.set(j.cheia.getTime(), lista);
  }
  // Nenhuma cheia a mais nem a menos: a janela só aponta para cheias da efeméride.
  assert.deepEqual([...porCheia.keys()], cheias, 'a varredura achou cheias que a efeméride não tem');

  for (const c of cheias) {
    const iso = new Date(c).toISOString();
    const noites = porCheia.get(c) ?? [];
    assert.equal(noites.length, JANELA_LUNAR_NOITES, `cheia de ${iso}: ${noites.length} noites na janela`);
    // Cada uma de −5 a −1, uma vez, em wakeDays consecutivos e na ordem.
    assert.deepEqual(noites.map((n) => n.noite), [-5, -4, -3, -2, -1], `cheia de ${iso}`);
    for (let i = 1; i < noites.length; i += 1) {
      assert.equal(
        Date.parse(noites[i].wakeDay) - Date.parse(noites[i - 1].wakeDay),
        DAY_MS,
        `cheia de ${iso}: ${noites[i - 1].wakeDay} → ${noites[i].wakeDay} não são noites seguidas`,
      );
    }
    // A noite −1 terminou antes da cheia; a seguinte é a que a contém, e fica fora.
    const ultima = noites[noites.length - 1].wakeDay;
    const contem = diaUTC(Date.parse(ultima) + DAY_MS);
    assert.ok(instanteDaNoite(ultima).getTime() < c, `cheia de ${iso}: a −1 (${ultima}) não terminou antes`);
    assert.ok(instanteDaNoite(contem).getTime() >= c, `cheia de ${iso}: ${contem} terminou antes da cheia`);
    assert.equal(janelaLunar(contem), null, `cheia de ${iso}: a noite que a contém (${contem}) entrou`);
  }
  console.log(`     · ${cheias.length} cheias, ${cheias.length * JANELA_LUNAR_NOITES} noites na janela`);
});

/* ─────────────────────── Pureza ─────────────────────── */

check('INVARIÂNCIA DE FUSO — o hospedeiro não muda nenhuma noite de coluna', () => {
  const tzOriginal = process.env.TZ;
  const leituras: string[] = [];
  try {
    for (const tz of ['UTC', 'Europe/Brussels', 'Pacific/Kiritimati', 'Pacific/Midway', 'America/Sao_Paulo']) {
      process.env.TZ = tz;
      const linha: string[] = [];
      // 2025 inteiro: as duas trocas de horário de Bruxelas estão dentro.
      for (let d = Date.UTC(2025, 0, 1); d < Date.UTC(2026, 0, 1); d += DAY_MS) {
        const j = janelaLunar(diaUTC(d));
        linha.push(j ? `${j.cheia.getTime()}:${j.noite}` : '-');
      }
      leituras.push(linha.join(','));
    }
  } finally {
    if (tzOriginal == null) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  }
  assert.equal(new Set(leituras).size, 1, 'o fuso do processo mudou a classificação de alguma noite');
});

check('sleep/lua.ts não lê fuso, ambiente, relógio nem coordenada', () => {
  const fonte = readFileSync(join(import.meta.dirname, 'lua.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const PROIBIDO =
    /process\.|Intl\.|Date\.now|new Date\(\s*\)|toLocale|getTimezoneOffset|\.(?:get|set)(?:Hours|Minutes|Date|Day|Month|FullYear)\(|Coords|COORDENADA|deviceCoords|\/astro\/(?:sun|casa)/;
  const achado = fonte.match(PROIBIDO);
  assert.equal(achado, null, `sleep/lua.ts deixou de ser puro: ${achado?.[0]}`);
});

console.log(`\n${passed} testes de sleep/lua.ts passaram.`);
