/**
 * As bandeiras, o destino e "precisa de rede" — onde um erro muda a medição, o
 * gasto ou o lugar do dado de saúde em silêncio.
 *
 * Importar este módulo **não** dispara medição nenhuma: o executável só corre quando
 * `require.main` é este arquivo, e aqui é o do teste.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type SleepPeriod } from '@vitale/shared';
import {
  conferirDestino,
  ehExecucaoPadrao,
  lerBandeiras,
  medirOPlano,
  passoDoProgresso,
  planoDaCorrida,
  precisaDeRede,
} from './bancada.ts';
import { LIMITE_DA_AMOSTRA, enumerarJanelas, type JanelaClassificada } from './janelas.ts';
import { cliDoAparelho, novoRegistro, type AbrirCanal } from './motores.ts';

const AQUI = __dirname;
const RAIZ_DO_REPO = join(AQUI, '..', '..');

describe('lerBandeiras', () => {
  it('sem bandeira: hoje do dia, limite padrão, nenhum motor de modelo', () => {
    assert.deepEqual(lerBandeiras([]), {
      hoje: null,
      motores: [],
      limite: LIMITE_DA_AMOSTRA,
      soExportar: false,
      export: null,
      comparar: [],
      simGastar: false,
      sonda: false,
      ajuda: false,
    });
  });

  it('lê todas as bandeiras que não se excluem', () => {
    const b = lerBandeiras(['--hoje', '2026-09-10', '--motor', NUVEM_PADRAO, '--limite', '4', '--export', '/fora/do/git', '--sim-gastar-chamadas']);
    assert.equal(b.hoje, '2026-09-10');
    assert.deepEqual(b.motores, [NUVEM_PADRAO]);
    assert.equal(b.limite, 4);
    assert.equal(b.export, '/fora/do/git');
    assert.equal(b.simGastar, true);
    assert.equal(b.soExportar, false);
  });

  it('--so-exportar sozinho vale; com --motor de modelo, recusa', () => {
    assert.equal(lerBandeiras(['--so-exportar']).soExportar, true);
    // Não mede nada, então o manifesto registraria um motor que ninguém mediu.
    assert.throws(() => lerBandeiras(['--so-exportar', '--motor', NUVEM_PADRAO]), /--so-exportar não mede nada/);
    assert.throws(() => lerBandeiras(['--motor', 'aparelho:sistema', '--so-exportar']), /--so-exportar não mede nada/);
    // `sem-modelo` não é motor de modelo: não há o que recusar.
    assert.equal(lerBandeiras(['--so-exportar', '--motor', SEM_MODELO]).soExportar, true);
  });

  it('bandeira repetida é recusada — "o último ganha" mediria o que ninguém pediu', () => {
    for (const argv of [
      ['--hoje', '2026-09-10', '--hoje', '2026-09-09'],
      ['--limite', '2', '--limite', '40'],
      ['--export', '/a', '--export', '/b'],
      ['--so-exportar', '--so-exportar'],
    ]) {
      assert.throws(() => lerBandeiras(argv), /aparece mais de uma vez/, argv.join(' '));
    }
    // `--motor` é a exceção declarada: ele acumula, e é assim que se pede duas colunas.
    assert.deepEqual(lerBandeiras(['--motor', NUVEM_PADRAO, '--motor', 'aparelho:sistema']).motores, [
      NUVEM_PADRAO,
      'aparelho:sistema',
    ]);
  });

  it('--motor repete e aceita vírgula, sem duplicar', () => {
    const b = lerBandeiras(['--motor', `${NUVEM_PADRAO}, aparelho:sistema`, '--motor', NUVEM_PADRAO]);
    assert.deepEqual(b.motores, [NUVEM_PADRAO, 'aparelho:sistema']);
  });

  it('MotorId que não se lê é erro de quem chamou, não motor indisponível', () => {
    for (const cru of ['nuvem:padrao/x', 'nuvem:', 'aparelho', 'inventado:coisa', 'nuvem:prov com espaço/m']) {
      assert.throws(() => lerBandeiras(['--motor', cru]), /não é um MotorId/, cru);
    }
  });

  it('--limite só aceita inteiro escrito em algarismos', () => {
    assert.equal(lerBandeiras(['--limite', '0']).limite, 0);
    assert.equal(lerBandeiras(['--limite', '28']).limite, 28);
    for (const n of ['-1', '1.5', 'dois', 'NaN', 'Infinity', '2e1', '0x2', ' 2 ']) {
      assert.throws(() => lerBandeiras(['--limite', n]), /--limite/, `limite ${JSON.stringify(n)}`);
    }
  });

  it('--hoje tem de ser um dia real', () => {
    for (const d of ['2026-02-30', '2026-13-01', '10/09/2026', 'hoje', '2026-9-1']) {
      assert.throws(() => lerBandeiras(['--hoje', d]), /--hoje/, d);
    }
  });

  it('--comparar leva dois arquivos', () => {
    assert.deepEqual(lerBandeiras(['--comparar', 'a.json', 'b.json']).comparar, ['a.json', 'b.json']);
    assert.throws(() => lerBandeiras(['--comparar', 'a.json']), /--comparar precisa de um valor/);
  });

  it('valor vazio é recusado — um `$N` não exportado desligaria a nuvem em silêncio', () => {
    for (const bandeira of ['--limite', '--hoje', '--motor', '--export']) {
      assert.throws(() => lerBandeiras([bandeira, '']), new RegExp(`\\${bandeira} precisa de um valor`), bandeira);
      assert.throws(() => lerBandeiras([bandeira, '   ']), new RegExp(`\\${bandeira} precisa de um valor`), bandeira);
    }
    assert.throws(() => lerBandeiras(['--motor', ' , ,']), /--motor precisa de um valor/);
  });

  it('bandeira desconhecida para a execução — não é ignorada em silêncio', () => {
    assert.throws(() => lerBandeiras(['--motores', NUVEM_PADRAO]), /bandeira desconhecida: --motores/);
    assert.throws(() => lerBandeiras(['-h']), /bandeira desconhecida: -h/);
    assert.throws(() => lerBandeiras(['/fora/do/git']), /bandeira desconhecida/);
  });

  it('--sonda vale com uma coluna de modelo, e só com ela', () => {
    assert.equal(lerBandeiras(['--motor', APARELHO_SISTEMA, '--sonda']).sonda, true);
    assert.equal(lerBandeiras(['--sonda', '--motor', NUVEM_PADRAO]).sonda, true);
    // Sem coluna de modelo, o manifesto registraria uma sonda que não rodou.
    assert.throws(() => lerBandeiras(['--sonda']), /nenhum --motor de modelo/);
    assert.throws(() => lerBandeiras(['--sonda', '--motor', SEM_MODELO]), /nenhum --motor de modelo/);
    assert.throws(() => lerBandeiras(['--so-exportar', '--sonda']), /--so-exportar não mede nada/);
    assert.throws(() => lerBandeiras(['--motor', APARELHO_SISTEMA, '--sonda', '--sonda']), /aparece mais de uma vez/);
  });

  it('--ajuda e --help entram na leitura, e não são bandeira desconhecida', () => {
    assert.equal(lerBandeiras(['--ajuda']).ajuda, true);
    assert.equal(lerBandeiras(['--help']).ajuda, true);
    assert.equal(lerBandeiras([]).ajuda, false);
  });
});

describe('precisaDeRede', () => {
  /** As quatro combinações de {--export | sem} × {motor de nuvem | só sem-modelo}. */
  it('exportar precisa; a nuvem precisa; o resto não', () => {
    assert.equal(precisaDeRede({ export: null, motores: [] }), true, 'sem --export: o export puxa de produção');
    assert.equal(precisaDeRede({ export: null, motores: [NUVEM_PADRAO] }), true);
    assert.equal(precisaDeRede({ export: '/fora', motores: [NUVEM_PADRAO] }), true, 'a nuvem exige o JWT');
    assert.equal(precisaDeRede({ export: '/fora', motores: [] }), false, '--export + sem modelo não abre rede');
    assert.equal(precisaDeRede({ export: '/fora', motores: [SEM_MODELO] }), false);
  });

  it('o aparelho não precisa de rede: a ponte roda nesta máquina, pela CLI local', () => {
    assert.equal(precisaDeRede({ export: '/fora', motores: [APARELHO_SISTEMA] }), false);
    // Junto com a nuvem, quem pede o JWT é a nuvem — não o aparelho.
    assert.equal(precisaDeRede({ export: '/fora', motores: [APARELHO_SISTEMA, NUVEM_PADRAO] }), true);
  });

  it('um motor de nuvem nomeado também precisa', () => {
    assert.equal(precisaDeRede({ export: '/fora', motores: ['nuvem:prov-a/modelo-1'] }), true);
  });
});

describe('ehExecucaoPadrao', () => {
  it('só a padrão atualiza a linha de base versionada', () => {
    const padrao = { soExportar: false, limite: LIMITE_DA_AMOSTRA, motores: [], export: null, sonda: false };
    assert.equal(ehExecucaoPadrao(padrao), true);
    assert.equal(ehExecucaoPadrao({ ...padrao, sonda: true }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, motores: [APARELHO_SISTEMA] }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, motores: [SEM_MODELO] }), true);
    assert.equal(ehExecucaoPadrao({ ...padrao, soExportar: true }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, limite: 4 }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, motores: [NUVEM_PADRAO] }), false);
  });
});

/* ── o plano da corrida ── */

/** Janelas classificadas de mentira: `n` por caso × alcance. */
function janelasDeMentira(n: number): JanelaClassificada[] {
  const out: JanelaClassificada[] = [];
  for (const caso of ['uma', 'duas', 'tudo-no-maximo'] as const) {
    for (const alcance of ['noite', 'periodo'] as const) {
      for (let i = 0; i < n; i += 1) out.push({ range: alcance === 'noite' ? 'ultima' : '7d', offset: out.length, alcance, caso });
    }
  }
  return out;
}

const BANDEIRAS_DO_PLANO = { motores: [] as const, limite: LIMITE_DA_AMOSTRA, sonda: false, simGastar: false };

describe('planoDaCorrida', () => {
  const JANELAS = janelasDeMentira(5); // 6 grupos × 5 → amostra de 12 com limite 2

  it('só a nuvem é paga; o aparelho conta à parte, e só o do sistema', () => {
    const p = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA, NUVEM_PADRAO, 'aparelho:prov-a/pesos'] }, JANELAS);
    assert.equal(p.amostra, 12);
    assert.deepEqual(p.colunas.map((c) => c.motor), [APARELHO_SISTEMA, NUVEM_PADRAO, 'aparelho:prov-a/pesos']);
    assert.ok(p.colunas.every((c) => c.janelas.length === 12), 'as colunas não mediram a mesma amostra');
    assert.equal(p.pagas, 12);
    assert.equal(p.locais, 12, 'os pesos nomeados contaram como chamada local — eles saem sintéticos');
    assert.equal(p.precisaDaCli, true);
  });

  it('a sonda dobra o teto das duas contas — e o plano a leva para a medição', () => {
    const p = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA, NUVEM_PADRAO], sonda: true }, JANELAS);
    assert.equal(p.sonda, true);
    assert.equal(p.pagas, 24);
    assert.equal(p.locais, 24);
  });

  it('o --limite recorta o aparelho também: a amostra é uma só para as colunas de modelo', () => {
    const p = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA], limite: 1 }, JANELAS);
    assert.equal(p.amostra, 6);
    assert.equal(p.locais, 6);
  });

  it('acima do teto, a nuvem exige o sim explícito; o aparelho, nunca', () => {
    const muitas = janelasDeMentira(20);
    assert.equal(planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [NUVEM_PADRAO], limite: 20 }, muitas).exigeConfirmacao, true);
    assert.equal(planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [NUVEM_PADRAO], limite: 20, simGastar: true }, muitas).exigeConfirmacao, false);
    assert.equal(planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA], limite: 20, sonda: true }, muitas).exigeConfirmacao, false);
  });

  it('avisa que os pesos nomeados saem sintéticos, e que a sonda sem coluna que rode não mede nada', () => {
    const p = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: ['aparelho:prov-a/pesos'], sonda: true }, JANELAS);
    assert.equal(p.precisaDaCli, false);
    assert.equal(p.locais, 0);
    assert.ok(p.avisos.some((a) => /aparelho:prov-a\/pesos.*sintética/.test(a)), JSON.stringify(p.avisos));
    assert.ok(p.avisos.some((a) => /--sonda.*nenhuma coluna/.test(a)), JSON.stringify(p.avisos));
    assert.deepEqual(planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA], sonda: true }, JANELAS).avisos, []);
  });

  it('sem coluna de modelo, nada: nem amostra, nem CLI', () => {
    const p = planoDaCorrida(BANDEIRAS_DO_PLANO, JANELAS);
    assert.deepEqual(p.colunas, []);
    assert.equal(p.amostra, 0);
    assert.equal(p.precisaDaCli, false);
  });
});

/* ── a medição do plano, com a CLI de mentira ── */

function noite(wakeDay: string, onsetH: number, durH: number): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - 120 * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + durH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: 120,
    wakeDay,
    asleepH: durH,
    awakenings: [],
    stages: null,
    stageSegments: null,
  };
}

function acervo(): { noites: SleepPeriod[]; notas: Record<string, number> } {
  const noites: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 40; i += 1) {
    const d = new Date(Date.UTC(2026, 7, 1 + i, 12));
    const dia = d.toISOString().slice(0, 10);
    noites.push(noite(dia, 22.5 + (i % 5) * 0.4, 5.5 + (i % 4) * 0.8));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites, notas };
}

/** Um processo que fala o protocolo e responde tudo com a mesma falha — o que importa aqui é o encanamento. */
function canalQueResponde(encerrados: number[]): AbrirCanal {
  let n = 0;
  return (eventos) => {
    n += 1;
    const este = n;
    return {
      pronto: Promise.resolve({ ok: true }),
      escrever: (linha) => {
        const { id } = JSON.parse(linha) as { id: number };
        setImmediate(() => eventos.aoLinha(JSON.stringify({ id, linha: { classe: 'guarda', detalhe: 'bloqueou' } })));
      },
      encerrar: () => {
        encerrados.push(este);
      },
    };
  };
}

describe('medirOPlano', () => {
  const DADOS = acervo();
  const HOJE = '2026-09-09';
  const JANELAS = enumerarJanelas(DADOS.noites, DADOS.notas, HOJE);

  async function medirCom(sonda: boolean) {
    const encerrados: number[] = [];
    const registro = novoRegistro();
    const cli = cliDoAparelho({ preparar: () => ({ ok: true, compilador: 'Apple Swift version 6.4' }), abrir: canalQueResponde(encerrados), registro });
    const plano = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA], limite: 1, sonda }, JANELAS);
    const r = await medirOPlano({
      plano, dados: DADOS, hoje: HOJE, janelas: JANELAS, sessao: null, cli, registro, avisar: () => undefined,
    });
    return { r, encerrados, plano };
  }

  it('mede a coluna do aparelho, com a sonda que o plano pediu, e devolve o compilador', async () => {
    const { r, encerrados, plano } = await medirCom(true);
    const coluna = r.medido.colunas.find((c) => c.motor === APARELHO_SISTEMA);
    assert.ok(coluna);
    assert.equal(coluna.linhas.length, plano.amostra);
    assert.ok(coluna.sonda, 'a sonda do plano não chegou à medição');
    assert.equal(coluna.sonda.length, plano.amostra);
    assert.equal(r.compilador, 'Apple Swift version 6.4');
    assert.deepEqual(encerrados, [1], 'a CLI não foi encerrada no fim');
  });

  it('sem sonda no plano, nenhuma linha de sonda', async () => {
    const { r } = await medirCom(false);
    assert.equal(r.medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.sonda, undefined);
  });

  it('a primeira linha do processo sai fria; as outras, não', async () => {
    const { r } = await medirCom(false);
    const linhas = r.medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.linhas ?? [];
    assert.ok(linhas.length > 2);
    assert.equal(linhas[0]?.frio, true);
    assert.ok(linhas.slice(1).every((l) => l.frio === undefined), 'uma linha do processo já quente saiu fria');
  });

  it('a CLI é encerrada mesmo quando a medição lança', async () => {
    const encerrados: number[] = [];
    const registro = novoRegistro();
    const cli = cliDoAparelho({ preparar: () => ({ ok: true }), abrir: canalQueResponde(encerrados), registro });
    const plano = planoDaCorrida({ ...BANDEIRAS_DO_PLANO, motores: [APARELHO_SISTEMA], limite: 1 }, JANELAS);
    await assert.rejects(
      medirOPlano({
        plano, dados: DADOS, hoje: HOJE, janelas: JANELAS, sessao: null, cli, registro, avisar: () => undefined,
        aoAndar: () => {
          throw new Error('o progresso quebrou');
        },
      }),
      /o progresso quebrou/,
    );
    assert.deepEqual(encerrados, [1], 'o finally não encerrou o processo vivo');
  });
});

describe('conferirDestino', () => {
  const fora = mkdtempSync(join(tmpdir(), 'orbe-destino-'));

  it('aceita um diretório fora de qualquer repositório', () => {
    conferirDestino(fora);
    conferirDestino(join(fora, 'que-ainda-nao-existe'));
  });

  it('aceita o saida/ abençoado e os filhos dele', () => {
    conferirDestino(join(AQUI, 'saida'));
    conferirDestino(join(AQUI, 'saida', 'sono-2026-09-10'));
  });

  it('recusa a raiz do repositório e qualquer diretório dele', () => {
    for (const d of [RAIZ_DO_REPO, join(RAIZ_DO_REPO, 'docs'), AQUI, join(AQUI, '..')]) {
      assert.throws(() => conferirDestino(d), /está dentro do repositório git/, d);
    }
  });

  it('recusa `saida-old/` — a comparação é por separador, não por prefixo', () => {
    assert.throws(() => conferirDestino(join(AQUI, 'saida-old')), /está dentro do repositório git/);
    assert.throws(() => conferirDestino(join(AQUI, 'saidaX')), /está dentro do repositório git/);
  });

  it('recusa outro repositório git, não só a árvore em que a bancada roda', () => {
    // Este projeto vive em worktrees paralelos: o furo real é gravar acervo de saúde
    // dentro de OUTRO clone, que tem o mesmo .gitignore e não ignora o diretório.
    const outroRepo = join(fora, 'outro-clone');
    mkdirSync(join(outroRepo, 'tmp'), { recursive: true });
    writeFileSync(join(outroRepo, '.git'), 'gitdir: /algum/lugar\n', 'utf8');
    assert.throws(() => conferirDestino(join(outroRepo, 'tmp')), /está dentro do repositório git/);
    assert.throws(() => conferirDestino(join(outroRepo, 'tmp', 'fundo', 'do', 'poco')), /está dentro do repositório git/);
  });

  it('resolve symlink: um link para dentro de um repositório é recusado', () => {
    const link = join(fora, 'atalho-para-o-repo');
    try {
      symlinkSync(join(RAIZ_DO_REPO, 'docs'), link, 'dir');
    } catch {
      return; // sem permissão de symlink: o caso não se exercita aqui
    }
    assert.throws(() => conferirDestino(link), /está dentro do repositório git/);
  });
});

describe('passoDoProgresso', () => {
  it('coluna de modelo dá sinal de vida em cada janela — cada uma é uma chamada paga', () => {
    // O caso real que motivou isto: 22 janelas de nuvem, cinco minutos sem uma linha.
    assert.equal(passoDoProgresso(22), 1);
    assert.equal(passoDoProgresso(1), 1);
    assert.equal(passoDoProgresso(30), 1);
  });

  it('coluna grande não vira ruído', () => {
    assert.equal(passoDoProgresso(31), 10);
    assert.equal(passoDoProgresso(100), 10);
    assert.equal(passoDoProgresso(389), 100);
  });

  it('o passo divide a contagem, então a linha do fim nunca é a única', () => {
    for (const total of [22, 31, 100, 101, 389]) {
      const passo = passoDoProgresso(total);
      const anuncios = [...Array(total).keys()].map((i) => i + 1).filter((f) => f === total || f % passo === 0);
      assert.ok(anuncios.length >= 1, `${total} não anuncia nada`);
      assert.equal(anuncios[anuncios.length - 1], total, `${total} não anuncia o fim`);
      // Nenhuma coluna fica mais de 100 janelas calada.
      const maiorSilencio = anuncios.reduce((max, f, i) => Math.max(max, f - (i === 0 ? 0 : anuncios[i - 1]!)), 0);
      assert.ok(maiorSilencio <= 100, `${total} fica ${maiorSilencio} janelas sem dizer nada`);
    }
  });
});
