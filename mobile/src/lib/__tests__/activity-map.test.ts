import { describe, it, expect } from '@jest/globals';
import { toActivityRow, toRouteRow, activityLabel } from '../activity-map';
import type { WorkoutItem } from '../workout-types';

const baseWorkout: WorkoutItem = {
  id: 'HK-UUID-1',
  activityId: 37, // Corrida (tipo GPS)
  activityName: 'Outdoor Run',
  calories: 320,
  start: '2026-05-01T10:00:00.000Z',
  end: '2026-05-01T10:45:00.000Z',
  duration: 2700,
  movingTimeS: 2580,
  distance: 6000,
  sourceName: 'Apple Watch',
  sourceId: 'com.apple.health',
  device: 'Watch',
  tracked: true,
  metadata: { foo: 'bar' },
  workoutEventsCount: 3,
};

describe('activity-map', () => {
  it('mapeia WorkoutItem para a linha de activities', () => {
    const row = toActivityRow(baseWorkout, 'user-1');
    expect(row).toMatchObject({
      id: 'HK-UUID-1',
      user_id: 'user-1',
      activity_id: 37,
      activity_name: 'Outdoor Run',
      calories: 320,
      start_at: baseWorkout.start,
      end_at: baseWorkout.end,
      duration_s: 2700,
      moving_time_s: 2580,
      distance_m: 6000,
      source_name: 'Apple Watch',
      tracked: true,
      has_route: true,
    });
  });

  it('dobra workoutEventsCount dentro de metadata', () => {
    const row = toActivityRow(baseWorkout, 'u');
    expect(row.metadata).toEqual({ foo: 'bar', workoutEventsCount: 3 });
  });

  it('arredonda duração/calorias fracionárias para inteiro (coluna int)', () => {
    const row = toActivityRow(
      { ...baseWorkout, duration: 5787.73988699913, calories: 412.6, activityId: 37.0 },
      'u'
    );
    expect(row.duration_s).toBe(5788);
    expect(row.calories).toBe(413);
    expect(Number.isInteger(row.duration_s)).toBe(true);
    expect(Number.isInteger(row.calories)).toBe(true);
  });

  it('marca has_route=false para tipo indoor (musculação)', () => {
    const row = toActivityRow({ ...baseWorkout, activityId: 50 }, 'u');
    expect(row.has_route).toBe(false);
  });

  it('campos ausentes viram null e metadata vazio vira null', () => {
    const minimal: WorkoutItem = {
      id: 'x',
      activityId: 50,
      activityName: '',
      calories: 0,
      start: 's',
      end: 'e',
      duration: 0,
      movingTimeS: 0,
    };
    const row = toActivityRow(minimal, 'u');
    expect(row.distance_m).toBeNull();
    expect(row.source_name).toBeNull();
    expect(row.tracked).toBeNull();
    expect(row.activity_name).toBeNull();
    expect(row.metadata).toBeNull();
    expect(row.moving_time_s).toBe(0);
  });

  it('toRouteRow converte latitude/longitude/altitude', () => {
    const row = toRouteRow('w1', 'u', [
      { latitude: 1, longitude: 2, altitude: 3 },
      { latitude: 4, longitude: 5 },
    ]);
    expect(row.point_count).toBe(2);
    expect(row.points[0]).toEqual({ lat: 1, lng: 2, alt: 3 });
    expect(row.points[1]).toEqual({ lat: 4, lng: 5 });
  });

  it('activityLabel resolve o label do tipo', () => {
    expect(activityLabel(37)).toBe('Corrida');
    expect(activityLabel(99999)).toBe('Treino');
  });
});
