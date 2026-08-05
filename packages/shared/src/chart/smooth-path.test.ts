/**
 * Testes de smoothLinePath — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/chart/smooth-path.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import { smoothLinePath, type LinePoint } from './smooth-path';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Amostra a curva do `d` para conferir que ela não escapa dos valores dos pontos. */
function sampleY(d: string, steps = 40): number[] {
  const cmds = d.match(/[MLC][^MLC]*/g) ?? [];
  const ys: number[] = [];
  let cur: LinePoint = { x: 0, y: 0 };
  for (const cmd of cmds) {
    const n = cmd.slice(1).trim().split(/\s+/).map(Number);
    if (cmd[0] === 'M' || cmd[0] === 'L') {
      cur = { x: n[0], y: n[1] };
      ys.push(cur.y);
      continue;
    }
    const [c1x, c1y, c2x, c2y, px, py] = n;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      ys.push(u * u * u * cur.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * py);
    }
    void c1x; void c2x; void px;
    cur = { x: px, y: py };
  }
  return ys;
}

check('vazio → string vazia', () => {
  assert.equal(smoothLinePath([]), '');
  assert.equal(smoothLinePath([null, null]), '');
});

check('um ponto → só o M', () => {
  assert.equal(smoothLinePath([{ x: 10, y: 20 }]), 'M 10 20');
});

check('dois pontos → reta (sem curva com um único trecho)', () => {
  assert.equal(smoothLinePath([{ x: 0, y: 0 }, { x: 10, y: 5 }]), 'M 0 0 L 10 5');
});

check('três pontos → cúbicas passando pelos pontos', () => {
  const d = smoothLinePath([{ x: 0, y: 10 }, { x: 10, y: 4 }, { x: 20, y: 8 }]);
  assert.ok(d.startsWith('M 0 10'), d);
  assert.equal((d.match(/C/g) ?? []).length, 2);
  assert.ok(d.trim().endsWith('20 8'), d);
});

check('null quebra a linha em trechos independentes', () => {
  const d = smoothLinePath([
    { x: 0, y: 1 },
    { x: 10, y: 2 },
    null,
    { x: 30, y: 3 },
    { x: 40, y: 4 },
  ]);
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal(d, 'M 0 1 L 10 2 M 30 3 L 40 4');
});

check('monotônica: não ultrapassa os extremos dos pontos', () => {
  // Degrau brusco: uma Catmull-Rom solta faria a curva descer abaixo de 0 depois do pico.
  const pts: LinePoint[] = [
    { x: 0, y: 100 },
    { x: 10, y: 100 },
    { x: 20, y: 0 },
    { x: 30, y: 100 },
    { x: 40, y: 100 },
  ];
  const ys = sampleY(smoothLinePath(pts));
  assert.ok(Math.min(...ys) >= -0.001, `mínimo ${Math.min(...ys)} escapou abaixo de 0`);
  assert.ok(Math.max(...ys) <= 100.001, `máximo ${Math.max(...ys)} escapou acima de 100`);
});

check('série crescente permanece crescente', () => {
  const pts: LinePoint[] = [
    { x: 0, y: 50 },
    { x: 10, y: 40 },
    { x: 20, y: 39 },
    { x: 30, y: 10 },
  ];
  const ys = sampleY(smoothLinePath(pts));
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] <= ys[i - 1] + 0.001, `subiu de ${ys[i - 1]} para ${ys[i]} em série decrescente`);
  }
});

check('pontos com mesmo x não geram NaN', () => {
  const d = smoothLinePath([{ x: 0, y: 1 }, { x: 0, y: 5 }, { x: 10, y: 3 }]);
  assert.ok(!d.includes('NaN'), d);
});

console.log(`\n${passed} testes passaram.`);
