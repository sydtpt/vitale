/**
 * Testes do módulo Cultura — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/cultura/cultura.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 *
 * O foco é o que a bmad-review apontou como frágil: a máquina de estados e os
 * invariantes que o banco impõe. Cada bloco cita a capability que protege.
 */
import assert from 'node:assert/strict';
import {
  CULTURA_TIPOS,
  cadeiaDeProvedores,
  isTipoConhecido,
  metaDoTipo,
  rotuloEstado,
  tiposConhecidos,
  type CulturaEstado,
} from './tipos';
import {
  convergirIndicador,
  datasAposTransicao,
  normalizarIndicadoPor,
  podeTransitar,
  validarItem,
} from './estados';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ESTADOS: CulturaEstado[] = ['quero', 'consumindo', 'concluido'];

/* ── Registro de tipos (CAP-8, CAP-9, CAP-13) ───────────────────────── */

check('os quatro tipos do v1 estão no registro', () => {
  assert.deepEqual(tiposConhecidos(), ['livro', 'filme', 'podcast', 'album']);
});

check('todo tipo tem rótulo para os três estados (CAP-8)', () => {
  for (const t of CULTURA_TIPOS) {
    for (const e of ESTADOS) {
      assert.ok(t.estados[e].length > 0, `${t.tipo}/${e} sem rótulo`);
    }
  }
});

check('nenhum rótulo de mídia vaza para chave do registro (CAP-8)', () => {
  // O vocabulário interno é neutro: as chaves são quero/consumindo/concluido
  // nos quatro tipos. Se 'lido' virasse chave, filme e álbum quebrariam.
  for (const t of CULTURA_TIPOS) {
    assert.deepEqual(Object.keys(t.estados).sort(), ['concluido', 'consumindo', 'quero']);
  }
});

check('livro e álbum falam línguas diferentes para o mesmo estado (CAP-8)', () => {
  assert.equal(rotuloEstado('livro', 'concluido'), 'Lido');
  assert.equal(rotuloEstado('album', 'concluido'), 'Ouvido');
  assert.equal(rotuloEstado('filme', 'quero'), 'Quero ver');
});

check('tipo desconhecido é rejeitado na escrita mas renderiza na leitura (CAP-13)', () => {
  assert.equal(isTipoConhecido('serie'), false);
  const meta = metaDoTipo('serie');
  assert.equal(meta.rotulo, 'Item');
  assert.equal(meta.estados.concluido, 'Concluído'); // não quebra a tela
});

check('cadeia de provedores respeita o fallback de cada tipo (CAP-1)', () => {
  // Google Books na frente: é o único dos dois com acervo brasileiro. Exige
  // GOOGLE_BOOKS_API_KEY na edge function — sem ela cai na cota anônima e a
  // Open Library assume, que é degradação e não o estado desejado.
  assert.deepEqual(cadeiaDeProvedores('livro'), ['google_books', 'open_library']);
  assert.deepEqual(cadeiaDeProvedores('filme'), ['tmdb', 'itunes']);
  assert.deepEqual(cadeiaDeProvedores('album'), ['itunes', 'musicbrainz']);
  // Podcast é o único sem fallback — a assimetria é declarada, não esquecida.
  assert.deepEqual(cadeiaDeProvedores('podcast'), ['itunes']);
});

check('só o filme tem fallback de disponibilidade', () => {
  const disp = CULTURA_TIPOS.filter((t) => t.provedores.naturezaFallback === 'disponibilidade');
  assert.deepEqual(disp.map((t) => t.tipo), ['filme']);
});

/* ── Máquina de estados (CAP-2) ─────────────────────────────────────── */

check('as arestas que a review pegou existem (CAP-2)', () => {
  assert.ok(podeTransitar('quero', 'concluido'), 'filme visto numa sentada');
  assert.ok(podeTransitar('concluido', 'consumindo'), 'reler/rever');
  assert.ok(podeTransitar('concluido', 'quero'), 'quer reler, não começou');
});

check('item nasce em qualquer estado — é o mecanismo do backfill', () => {
  for (const e of ESTADOS) assert.ok(podeTransitar(null, e));
});

check('transitar para o mesmo estado não é transição', () => {
  for (const e of ESTADOS) assert.equal(podeTransitar(e, e), false);
});

check('quero → concluido grava as duas datas iguais', () => {
  assert.deepEqual(datasAposTransicao({}, 'concluido', '2026-08-22'), {
    iniciadoEm: '2026-08-22',
    concluidoEm: '2026-08-22',
  });
});

check('reler usa a data NOVA, nunca a da primeira leitura', () => {
  const antes = { iniciadoEm: '2020-01-01', concluidoEm: '2020-02-01' };
  const depois = datasAposTransicao(antes, 'consumindo', '2026-08-22');
  assert.equal(depois.iniciadoEm, '2026-08-22');
  assert.equal(depois.concluidoEm, undefined);
});

check('voltar para quero limpa as duas datas', () => {
  const antes = { iniciadoEm: '2026-01-01', concluidoEm: '2026-02-01' };
  // A data é exigida na assinatura mesmo aqui, onde é ignorada: é a única
  // forma de garantir que nenhum chamador esqueça dela onde ela importa.
  assert.deepEqual(datasAposTransicao(antes, 'quero', '2026-08-22'), {});
});

check('concluir preserva o início já existente', () => {
  const depois = datasAposTransicao({ iniciadoEm: '2026-08-01' }, 'concluido', '2026-08-22');
  assert.equal(depois.iniciadoEm, '2026-08-01');
  assert.equal(depois.concluidoEm, '2026-08-22');
});

check('backfill não é forçado a hoje — a data vem de fora', () => {
  // A regressão que isto pega: gravar current_date em vez da data informada
  // faria toda a estante antiga nascer com a janela errada.
  const d = datasAposTransicao({}, 'concluido', '2019-03-14');
  assert.equal(d.iniciadoEm, '2019-03-14');
  assert.equal(d.concluidoEm, '2019-03-14');
});

/* ── Invariantes, espelhando os `check` da migration (CAP-12) ───────── */

check('toda transição do diagrama produz item válido', () => {
  // Invariante de fecho: se datasAposTransicao e validarItem discordassem,
  // o usuário levaria erro de check do Postgres numa transição legítima.
  const partidas: Array<[CulturaEstado, ReturnType<typeof datasAposTransicao>]> = [
    ['quero', {}],
    ['consumindo', { iniciadoEm: '2026-01-01' }],
    ['concluido', { iniciadoEm: '2026-01-01', concluidoEm: '2026-02-01' }],
  ];
  for (const [de, datas] of partidas) {
    for (const para of ESTADOS) {
      if (!podeTransitar(de, para)) continue;
      const novas = datasAposTransicao(datas, para, '2026-08-22');
      assert.deepEqual(
        validarItem({ estado: para, ...novas }),
        [],
        `${de} → ${para} produziu item inválido`,
      );
    }
  }
});

check('quero com data de início é inválido', () => {
  const v = validarItem({ estado: 'quero', iniciadoEm: '2026-01-01' });
  assert.equal(v.length, 1);
  assert.equal(v[0]!.campo, 'iniciadoEm');
});

check('concluido sem data de conclusão é inválido', () => {
  const v = validarItem({ estado: 'concluido', iniciadoEm: '2026-01-01' });
  assert.equal(v[0]!.campo, 'concluidoEm');
});

check('conclusão anterior ao início é inválida', () => {
  const v = validarItem({
    estado: 'concluido',
    iniciadoEm: '2026-02-01',
    concluidoEm: '2026-01-01',
  });
  assert.ok(v.some((x) => x.mensagem.includes('anterior ao início')));
});

check('nota fora de 1–5 ou fracionária é inválida', () => {
  for (const n of [0, 6, 3.5]) {
    const v = validarItem({ estado: 'quero', nota: n });
    assert.ok(v.some((x) => x.campo === 'nota'), `nota ${n} passou`);
  }
  assert.deepEqual(validarItem({ estado: 'quero', nota: 5 }), []);
});

check('nota é permitida em qualquer estado, não só ao concluir (CAP-4)', () => {
  assert.deepEqual(validarItem({ estado: 'quero', nota: 4 }), []);
  assert.deepEqual(validarItem({ estado: 'consumindo', iniciadoEm: '2026-01-01', nota: 4 }), []);
});

/* ── Indicador (CAP-11) ─────────────────────────────────────────────── */

check('indicador vazio ou só espaço vira ausência, não grupo fantasma', () => {
  assert.equal(normalizarIndicadoPor('   '), undefined);
  assert.equal(normalizarIndicadoPor(''), undefined);
  assert.equal(normalizarIndicadoPor(null), undefined);
  assert.equal(normalizarIndicadoPor('  Ana '), 'Ana');
});

check('autocomplete converge grafias sem distinção de caixa', () => {
  // A regressão: sem isto, "joão" e "João" viram dois indicadores e racham
  // a agregação que é o único motivo do campo existir.
  const existentes = ['João', 'Ana'];
  assert.equal(convergirIndicador('joão', existentes), 'João');
  assert.equal(convergirIndicador('  JOÃO ', existentes), 'João');
  assert.equal(convergirIndicador('Pedro', existentes), 'Pedro');
});

console.log(`\n${passed} testes passaram`);
