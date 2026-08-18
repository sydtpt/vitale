import { create } from 'zustand';
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import { Period, Sample, periodRange } from '../lib/health-buckets';
import {
  METRICS,
  metricById,
  HEALTH_PERMISSIONS,
  HealthProfile,
  loadProfile,
} from '../config/health-metrics';
import { syncHealth } from '../services/health-sync';

export type PermissionStatus = 'unknown' | 'authorized' | 'denied' | 'unavailable';

interface HealthState {
  permissionStatus: PermissionStatus;
  /** Período do detalhe (Dia / Semana / Mês). */
  period: Period;
  profile: HealthProfile | null;
  /** Amostras dos últimos 7 dias por métrica — alimentam os cards do dashboard. */
  summaries: Record<string, Sample[]>;
  summaryLoading: boolean;
  /** Amostras do período ativo por métrica — alimentam a tela de detalhe. */
  detail: Record<string, Sample[]>;
  detailLoading: Record<string, boolean>;
  /** Sincronização dos agregados diários para o Supabase. */
  syncing: boolean;
  lastSyncAt: string | null;

  requestPermission: () => Promise<void>;
  loadSummaries: () => Promise<void>;
  setPeriod: (p: Period) => void;
  loadMetric: (id: string) => Promise<void>;
  /** Agrega e envia os agregados diários ao Supabase (backfill na 1ª vez). */
  syncToCloud: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  permissionStatus: Platform.OS !== 'ios' ? 'unavailable' : 'unknown',
  period: 'week',
  profile: null,
  summaries: {},
  summaryLoading: false,
  detail: {},
  detailLoading: {},
  syncing: false,
  lastSyncAt: null,

  requestPermission: async () => {
    if (Platform.OS !== 'ios') {
      set({ permissionStatus: 'unavailable' });
      return;
    }
    await new Promise<void>((resolve) => {
      AppleHealthKit.initHealthKit(HEALTH_PERMISSIONS as any, (err: string) => {
        // HealthKit não revela negações de leitura; sucesso = liberado para consultar.
        set({ permissionStatus: err ? 'denied' : 'authorized' });
        resolve();
      });
    });
    if (get().permissionStatus === 'authorized') {
      loadProfile().then((profile) => set({ profile }));
      await get().loadSummaries();
      // Fire-and-forget: sobe os agregados diários sem bloquear a UI.
      void get().syncToCloud();
    }
  },

  loadSummaries: async () => {
    set({ summaryLoading: true });
    const range = periodRange('week');
    const entries = await Promise.all(
      METRICS.map(async (m) => [m.id, await m.fetch(range, 'week')] as const)
    );
    set({ summaries: Object.fromEntries(entries), summaryLoading: false });
  },

  setPeriod: (p) => set({ period: p, detail: {} }),

  loadMetric: async (id) => {
    const metric = metricById(id);
    if (!metric) return;
    const period = get().period;
    set((s) => ({ detailLoading: { ...s.detailLoading, [id]: true } }));
    const data = await metric.fetch(periodRange(period), period);
    set((s) => ({
      detail: { ...s.detail, [id]: data },
      detailLoading: { ...s.detailLoading, [id]: false },
    }));
  },

  syncToCloud: async () => {
    if (get().syncing || Platform.OS !== 'ios') return;
    set({ syncing: true });
    const res = await syncHealth();
    set({ syncing: false, lastSyncAt: res.ok ? new Date().toISOString() : get().lastSyncAt });
  },
}));
