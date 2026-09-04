import { describe, it, expect } from '@jest/globals';
import { groupRecurringRoutes, type Climb, type RouteActivity } from '@vitale/shared';
import {
  CLIMBS_FOOTNOTE,
  climbText,
  climbTone,
  climbsSummary,
  formatPace,
  km,
  ordinal,
  routeBadge,
  timesText,
} from '../route-view';

function climb(partial: Partial<Climb>): Climb {
  return {
    startM: 0, endM: 1000, lengthM: 1000, gainM: 50, gradePct: 5,
    score: 250, startIdx: 0, endIdx: 10, ...partial,
  };
}

/** Três corridas na mesma reta, com os tempos pedidos. */
function rota(times: number[]) {
  const points = Array.from({ length: 60 }, (_, i) => [50.85 + i * 0.0009, 4.35] as [number, number]);
  const acts: RouteActivity[] = times.map((t, i) => ({
    id: `a${i}`,
    points,
    distanceM: 10000,
    movingTimeS: t,
    startAt: `2026-0${i + 1}-10T08:00:00Z`,
  }));
  return groupRecurringRoutes(acts)[0];
}

describe('formatPace', () => {
  it('formata segundos por km', () => {
    expect(formatPace(327)).toBe('5:27');
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(605)).toBe('10:05');
  });

  it('nunca imprime 60 segundos', () => {
    // 359,7 arredonda para 360: o minuto tem de virar junto com o segundo.
    expect(formatPace(359.7)).toBe('6:00');
    expect(formatPace(359.5)).toBe('6:00');
    expect(formatPace(359.4)).toBe('5:59');
  });

  it('devolve travessão sem ritmo', () => {
    expect(formatPace(null)).toBe('—');
    expect(formatPace(0)).toBe('—');
    expect(formatPace(Number.NaN)).toBe('—');
  });
});

describe('textos curtos', () => {
  it('concorda em número', () => {
    expect(timesText(1)).toBe('1 vez');
    expect(timesText(13)).toBe('13 vezes');
  });
  it('ordinal em pt-BR', () => {
    expect(ordinal(1)).toBe('1º');
    expect(ordinal(13)).toBe('13º');
  });
  it('distância com vírgula', () => {
    expect(km(10130)).toBe('10,1 km');
    expect(km(4200)).toBe('4,2 km');
  });
});

describe('routeBadge', () => {
  const r = rota([1800, 2100, 2400]); // 3:00, 3:30, 4:00 por km

  it('dá medalha ao pódio', () => {
    const melhor = r.efforts.find((e) => e.rank === 1)!;
    const b = routeBadge(r, melhor);
    expect(b.medal).toBe(1);
    expect(b.title).toBe('1º melhor tempo nesta rota');
    expect(b.subtitle).toContain('é o seu recorde aqui');
  });

  it('mede a distância até o recorde em segundos por km', () => {
    const terceiro = r.efforts.find((e) => e.rank === 3)!;
    const b = routeBadge(r, terceiro);
    expect(b.title).toBe('3º melhor tempo nesta rota');
    // 4:00 contra 3:00 = 60 s/km.
    expect(b.subtitle).toContain('60 s/km acima do seu recorde');
  });

  it('conta a vez pela ordem cronológica, não pelo posto', () => {
    const terceira = r.efforts[2];
    expect(routeBadge(r, terceira).subtitle).toContain('sua 3º vez aqui');
  });

  it('sem medalha fora do pódio', () => {
    const quatro = rota([1800, 1900, 2000, 2100]);
    const ultimo = quatro.efforts.find((e) => e.rank === 4)!;
    expect(routeBadge(quatro, ultimo).medal).toBeNull();
  });

  it('sem ritmo, o selo ainda registra a repetição', () => {
    const points = Array.from({ length: 60 }, (_, i) => [50.85 + i * 0.0009, 4.35] as [number, number]);
    const acts: RouteActivity[] = [0, 1, 2].map((i) => ({
      id: `b${i}`, points, distanceM: 10000,
      movingTimeS: i === 2 ? 0 : 1800,
      startAt: `2026-0${i + 1}-10T08:00:00Z`,
    }));
    const g = groupRecurringRoutes(acts)[0];
    const semTempo = g.efforts.find((e) => e.id === 'b2')!;
    const b = routeBadge(g, semTempo);
    expect(b.medal).toBeNull();
    expect(b.title).toBe('Você já correu esta rota');
    expect(b.subtitle).toContain('sem ritmo registrado');
    expect(b.subtitle).toContain('3º vez');
  });
});

describe('subidas', () => {
  it('descreve extensão e inclinação', () => {
    expect(climbText(climb({ lengthM: 4244, gradePct: 4.62 }))).toBe('4,2 km a 4,6%');
  });

  it('a cor segue a inclinação, não o score', () => {
    // Score alto por ser longa, mas rampa suave: continua "fácil".
    expect(climbTone(climb({ gradePct: 3.2, score: 900 }))).toBe('easy');
    expect(climbTone(climb({ gradePct: 4.6 }))).toBe('medium');
    expect(climbTone(climb({ gradePct: 6.5 }))).toBe('hard');
    expect(climbTone(climb({ gradePct: 6 }))).toBe('hard');
    expect(climbTone(climb({ gradePct: 5.99 }))).toBe('medium');
  });

  it('o resumo não inventa fração da elevação publicada', () => {
    const s = climbsSummary(4, 531.4);
    expect(s).toBe('4 subidas · +531 m');
    expect(s).not.toContain('de');
    expect(climbsSummary(1, 25)).toBe('1 subida · +25 m');
  });

  it('sem subida, o resumo diz isso', () => {
    expect(climbsSummary(0, 0)).toContain('Nenhuma subida');
  });

  it('o rodapé declara os pisos', () => {
    expect(CLIMBS_FOOTNOTE).toContain('25 m');
    expect(CLIMBS_FOOTNOTE).toContain('2,5%');
  });
});
