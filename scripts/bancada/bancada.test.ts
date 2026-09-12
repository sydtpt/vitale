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
import { NUVEM_PADRAO, SEM_MODELO } from '@vitale/shared';
import { conferirDestino, ehExecucaoPadrao, lerBandeiras, precisaDeRede } from './bancada.ts';
import { LIMITE_DA_AMOSTRA } from './janelas.ts';

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

  it('o aparelho não precisa de rede nesta bancada — não há ponte aqui', () => {
    assert.equal(precisaDeRede({ export: '/fora', motores: ['aparelho:sistema'] }), false);
  });

  it('um motor de nuvem nomeado também precisa', () => {
    assert.equal(precisaDeRede({ export: '/fora', motores: ['nuvem:prov-a/modelo-1'] }), true);
  });
});

describe('ehExecucaoPadrao', () => {
  it('só a padrão atualiza a linha de base versionada', () => {
    const padrao = { soExportar: false, limite: LIMITE_DA_AMOSTRA, motores: [], export: null };
    assert.equal(ehExecucaoPadrao(padrao), true);
    assert.equal(ehExecucaoPadrao({ ...padrao, motores: [SEM_MODELO] }), true);
    assert.equal(ehExecucaoPadrao({ ...padrao, soExportar: true }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, limite: 4 }), false);
    assert.equal(ehExecucaoPadrao({ ...padrao, motores: [NUVEM_PADRAO] }), false);
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
