/**
 * A leitura do export — o caminho **sem rede**, que é o que reproduz a medição.
 *
 * Tudo num diretório temporário (`mkdtempSync`): nenhum dado de produção entra aqui,
 * nem é lido daqui (AD-8). O que se prova é que as duas grafias dão o mesmo acervo,
 * que o hash é função do texto, e que **cada caminho de recusa recusa** — porque um
 * export levemente quebrado produz um relatório completo, com cara de resultado,
 * medindo outra coisa. Um revisor mediu o tamanho do estrago: tirar o `sleep_quality`
 * de uma linha de nota faz 49 janelas trocarem de caso, em silêncio.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ARQUIVO_DAS_NOITES,
  ARQUIVO_DAS_NOTAS,
  ARQUIVO_DO_MANIFESTO,
  conferirAcervoContraManifesto,
  lerAcervoDoDisco,
  manifestoDoExport,
} from './exportar.ts';

/* ── as duas grafias da mesma noite ── */

/** Uma noite na forma de domínio (camelCase) — o que a bancada escreve. */
const NOITE_DOMINIO = {
  userId: 'u',
  onsetAt: '2026-09-09T21:30:00.000Z',
  wakeAt: '2026-09-10T05:30:00.000Z',
  inBedAt: null,
  inBedEnd: null,
  tzOffset: 120,
  wakeDay: '2026-09-10',
  asleepH: 7.5,
  awakenings: [],
  stages: null,
  stageSegments: null,
};

/** A mesma noite na forma da linha do PostgREST — o export puxado à mão. */
const NOITE_COBRA = {
  user_id: 'u',
  onset_at: '2026-09-09T21:30:00.000Z',
  wake_at: '2026-09-10T05:30:00.000Z',
  in_bed_at: null,
  in_bed_end: null,
  tz_offset: 120,
  wake_day: '2026-09-10',
  asleep_h: '7.5',
  awakenings: [],
  stages: null,
  stage_segments: null,
  source: null,
};

function comDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-export-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Escreve um export e o lê de volta. */
function comExport<T>(noites: unknown, notas: unknown, fn: (dir: string) => T): T {
  return comDir((dir) => {
    writeFileSync(join(dir, ARQUIVO_DAS_NOITES), `${JSON.stringify(noites)}\n`, 'utf8');
    writeFileSync(join(dir, ARQUIVO_DAS_NOTAS), `${JSON.stringify(notas)}\n`, 'utf8');
    return fn(dir);
  });
}

const recusa = (noites: unknown, notas: unknown, padrao: RegExp): void => {
  comExport(noites, notas, (dir) => {
    assert.throws(() => lerAcervoDoDisco(dir), padrao);
  });
};

/* ── a ida e volta ── */

describe('lerAcervoDoDisco', () => {
  it('lê a forma de domínio', () => {
    comExport([NOITE_DOMINIO], [{ day: '2026-09-10', sleepQuality: 4 }], (dir) => {
      const a = lerAcervoDoDisco(dir);
      assert.equal(a.dados.noites.length, 1);
      assert.equal(a.dados.noites[0]?.wakeDay, '2026-09-10');
      assert.equal(a.dados.noites[0]?.asleepH, 7.5);
      assert.deepEqual(a.dados.notas, { '2026-09-10': 4 });
      assert.equal(a.acervo.noites.linhas, 1);
      assert.equal(a.acervo.notas.linhas, 1);
    });
  });

  it('lê a forma da linha do PostgREST, e chega ao mesmo acervo de domínio', () => {
    const doDominio = comExport([NOITE_DOMINIO], [{ day: '2026-09-10', sleepQuality: 4 }], (d) => lerAcervoDoDisco(d).dados);
    const daCobra = comExport([NOITE_COBRA], [{ day: '2026-09-10', sleep_quality: 4 }], (d) => lerAcervoDoDisco(d).dados);
    // O `asleep_h` chega como string do `numeric` e tem de virar número.
    assert.equal(daCobra.noites[0]?.asleepH, 7.5);
    assert.deepEqual(daCobra.notas, doDominio.notas);
    assert.deepEqual(
      daCobra.noites.map((p) => [p.wakeDay, p.onsetAt, p.wakeAt, p.tzOffset, p.asleepH, p.awakenings]),
      doDominio.noites.map((p) => [p.wakeDay, p.onsetAt, p.wakeAt, p.tzOffset, p.asleepH, p.awakenings]),
    );
  });

  it('os três estados de `awakenings` sobrevivem — eles contam diferente', () => {
    for (const estado of [null, [], [{ from: '2026-09-10T01:00:00.000Z', to: '2026-09-10T01:10:00.000Z' }]]) {
      comExport([{ ...NOITE_DOMINIO, awakenings: estado }], [], (dir) => {
        assert.deepEqual(lerAcervoDoDisco(dir).dados.noites[0]?.awakenings, estado, JSON.stringify(estado));
      });
    }
  });

  it('o hash é função do texto: mesmo texto, mesmo hash; texto diferente, hash diferente', () => {
    const um = comExport([NOITE_DOMINIO], [], (d) => lerAcervoDoDisco(d).acervo);
    const igual = comExport([NOITE_DOMINIO], [], (d) => lerAcervoDoDisco(d).acervo);
    const outro = comExport([{ ...NOITE_DOMINIO, asleepH: 7.6 }], [], (d) => lerAcervoDoDisco(d).acervo);
    assert.equal(um.sha256, igual.sha256);
    assert.notEqual(um.sha256, outro.sha256);
    assert.match(um.sha256, /^[0-9a-f]{64}$/);
    // E o hash do conjunto muda quando só as notas mudam.
    const comNota = comExport([NOITE_DOMINIO], [{ day: '2026-09-10', sleepQuality: 3 }], (d) => lerAcervoDoDisco(d).acervo);
    assert.notEqual(um.sha256, comNota.sha256);
  });
});

/* ── cada recusa ── */

describe('as recusas da noite', () => {
  it('arquivo que falta, que não é JSON, que não é lista, e acervo vazio', () => {
    comDir((dir) => assert.throws(() => lerAcervoDoDisco(dir), /o export não tem/));
    comDir((dir) => {
      writeFileSync(join(dir, ARQUIVO_DAS_NOITES), 'nao sou json', 'utf8');
      writeFileSync(join(dir, ARQUIVO_DAS_NOTAS), '[]', 'utf8');
      assert.throws(() => lerAcervoDoDisco(dir), /não é JSON/);
    });
    recusa({ nao: 'e lista' }, [], /não é uma lista/);
    recusa([], [], /não tem noite nenhuma/);
  });

  it('sem dia, ou com dia que não é dia', () => {
    const { wakeDay: _wakeDay, ...semDia } = NOITE_DOMINIO;
    recusa([semDia], [], /não tem wakeDay nem wake_day/);
    recusa([{ ...NOITE_DOMINIO, wakeDay: null }], [], /não tem wakeDay nem wake_day/);
    recusa([{ ...NOITE_DOMINIO, wakeDay: '2026-9-1' }], [], /não tem wakeDay nem wake_day/);
  });

  it('sem `onsetAt` ou `wakeAt` legível — eles alimentam horário e continuidade', () => {
    recusa([{ ...NOITE_DOMINIO, onsetAt: undefined }], [], /onsetAt não é um instante legível/);
    recusa([{ ...NOITE_DOMINIO, wakeAt: 'ontem à noite' }], [], /wakeAt não é um instante legível/);
    recusa([{ ...NOITE_COBRA, onset_at: null }], [], /onset_at não é um instante legível/);
  });

  it('sem `tzOffset` — sem ele, viagem lê como irregularidade', () => {
    recusa([{ ...NOITE_DOMINIO, tzOffset: undefined }], [], /tzOffset não é número/);
    recusa([{ ...NOITE_DOMINIO, tzOffset: 'duas horas' }], [], /tzOffset não é número/);
  });

  it('sem a chave `awakenings` — ela muda a continuidade sem erro nenhum', () => {
    const { awakenings: _awakenings, ...semVigilia } = NOITE_DOMINIO;
    recusa([semVigilia], [], /a chave awakenings não existe/);
    recusa([{ ...NOITE_DOMINIO, awakenings: 'nenhum' }], [], /awakenings não é null nem lista/);
  });

  it('sem `asleepH` numérico', () => {
    recusa([{ ...NOITE_DOMINIO, asleepH: 'sete e meia' }], [], /asleepH não é número/);
  });

  it('a mensagem nomeia o índice e o dia — achar a linha é metade do conserto', () => {
    recusa([NOITE_DOMINIO, { ...NOITE_DOMINIO, wakeDay: '2026-09-11', asleepH: null }], [], /\[1\] \(2026-09-11\)/);
  });
});

describe('as recusas da nota', () => {
  it('nota ausente é `null`, e isso é estado real', () => {
    comExport([NOITE_DOMINIO], [{ day: '2026-09-10', sleepQuality: null }, { day: '2026-09-09' }], (dir) => {
      assert.deepEqual(lerAcervoDoDisco(dir).dados.notas, {});
      assert.equal(lerAcervoDoDisco(dir).acervo.notas.linhas, 2);
    });
  });

  it('nota presente fora de 1–5, ou que não é inteiro, recusa', () => {
    for (const q of [0, 6, -1, 3.5, '4', true]) {
      recusa([NOITE_DOMINIO], [{ day: '2026-09-10', sleepQuality: q }], /sleepQuality tem de ser um inteiro de 1 a 5/);
    }
  });

  it('`day` duplicado recusa — deixar a última ganhar escolhe a percepção por ordem de arquivo', () => {
    recusa(
      [NOITE_DOMINIO],
      [{ day: '2026-09-10', sleepQuality: 2 }, { day: '2026-09-10', sleepQuality: 5 }],
      /o dia 2026-09-10 aparece duas vezes/,
    );
  });

  it('nota sem `day` recusa', () => {
    recusa([NOITE_DOMINIO], [{ sleepQuality: 4 }], /não tem day nem day/);
  });
});

/* ── o manifesto do export ── */

describe('manifestoDoExport', () => {
  const bom = { hoje: '2026-09-10', acervo: { sha256: 'a'.repeat(64) } };

  it('sem manifesto, devolve null — é o caso do acervo exportado à mão', () => {
    comDir((dir) => assert.equal(manifestoDoExport(dir), null));
  });

  it('lê o dia e o hash do acervo', () => {
    comDir((dir) => {
      writeFileSync(join(dir, ARQUIVO_DO_MANIFESTO), JSON.stringify(bom), 'utf8');
      assert.deepEqual(manifestoDoExport(dir), { hoje: '2026-09-10', sha256: 'a'.repeat(64) });
    });
  });

  it('`hoje` que não é dia recusa — como a bandeira --hoje já recusa', () => {
    for (const hoje of ['2026-02-30', '2026-9-1', 'hoje', 42, null, undefined]) {
      comDir((dir) => {
        writeFileSync(join(dir, ARQUIVO_DO_MANIFESTO), JSON.stringify({ ...bom, hoje }), 'utf8');
        assert.throws(() => manifestoDoExport(dir), /"hoje" tem de ser um dia/, String(hoje));
      });
    }
  });

  it('sem `acervo.sha256` válido recusa — sem ele não há o que conferir', () => {
    for (const sha of [undefined, 'curto', 'Z'.repeat(64), 123]) {
      comDir((dir) => {
        writeFileSync(join(dir, ARQUIVO_DO_MANIFESTO), JSON.stringify({ ...bom, acervo: { sha256: sha } }), 'utf8');
        assert.throws(() => manifestoDoExport(dir), /"acervo.sha256" não é um sha256/, String(sha));
      });
    }
  });

  it('manifesto que não é JSON recusa em vez de ser ignorado', () => {
    comDir((dir) => {
      writeFileSync(join(dir, ARQUIVO_DO_MANIFESTO), '{ quebrado', 'utf8');
      assert.throws(() => manifestoDoExport(dir), /não é JSON/);
    });
  });
});

describe('conferirAcervoContraManifesto', () => {
  it('bate: passa calado', () => {
    const lido = { noites: { arquivo: 'n', linhas: 1, sha256: 'x' }, notas: { arquivo: 'm', linhas: 0, sha256: 'y' }, sha256: 'z' };
    conferirAcervoContraManifesto(lido, { hoje: '2026-09-10', sha256: 'z' });
  });

  it('não bate: falha alto, e diz os dois hashes', () => {
    const lido = { noites: { arquivo: 'n', linhas: 1, sha256: 'x' }, notas: { arquivo: 'm', linhas: 0, sha256: 'y' }, sha256: 'em-disco' };
    assert.throws(
      () => conferirAcervoContraManifesto(lido, { hoje: '2026-09-10', sha256: 'no-manifesto' }),
      (e: unknown) => {
        const m = e instanceof Error ? e.message : String(e);
        assert.match(m, /não é o que o manifesto\.json descreve/);
        assert.ok(m.includes('em-disco') && m.includes('no-manifesto'), m);
        return true;
      },
    );
  });

  it('o arquivo trocado é pego de ponta a ponta', () => {
    // O furo real: trocar o sleep_periods.json e herdar o `hoje` do manifesto velho.
    comExport([NOITE_DOMINIO], [], (dir) => {
      const antes = lerAcervoDoDisco(dir).acervo;
      writeFileSync(join(dir, ARQUIVO_DAS_NOITES), `${JSON.stringify([{ ...NOITE_DOMINIO, asleepH: 4 }])}\n`, 'utf8');
      const depois = lerAcervoDoDisco(dir).acervo;
      assert.notEqual(antes.sha256, depois.sha256);
      assert.throws(
        () => conferirAcervoContraManifesto(depois, { hoje: '2026-09-10', sha256: antes.sha256 }),
        /não é o que o manifesto\.json descreve/,
      );
    });
  });
});
