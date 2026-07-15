import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { ConnectionProvider, LinkedAccount } from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ConnectionsStore } from '../data/connections.store';

/**
 * Conexões: vincular fontes de treino (Strava OAuth, intervals.icu por API key).
 * Apple Health é gerenciado no app iPhone — aqui é só informativo.
 * O retorno do OAuth chega em ?provider=&status=&reason= (edge fn strava-oauth).
 */
@Component({
  selector: 'rt-conexoes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './conexoes-page.component.html',
  styleUrl: './conexoes-page.component.scss',
})
export class ConexoesPageComponent {
  protected readonly store = inject(ConnectionsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly strava = computed(() => this.store.account('strava'));
  protected readonly intervals = computed(() => this.store.account('intervals'));

  protected readonly actionError = signal<string | null>(null);
  protected readonly oauthOk = signal(false);

  protected intervalsKey = '';
  protected intervalsAthleteId = '';

  constructor() {
    void this.store.load();

    // Retorno do OAuth da Strava (query params) — mostra o resultado e limpa a URL.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('provider') === 'strava' && qp.get('status')) {
      if (qp.get('status') === 'ok') this.oauthOk.set(true);
      else this.actionError.set(`Conexão com a Strava falhou: ${qp.get('reason') ?? 'erro desconhecido'}`);
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected async run(fn: () => Promise<string | null>): Promise<void> {
    this.actionError.set(null);
    this.oauthOk.set(false);
    const err = await fn();
    if (err) this.actionError.set(err);
  }

  protected connectStrava(): void {
    void this.run(() => this.store.connectStrava());
  }

  protected linkIntervals(): void {
    const key = this.intervalsKey.trim();
    const athlete = this.intervalsAthleteId.trim();
    if (!key || !athlete) return;
    void this.run(async () => {
      const err = await this.store.linkIntervals(key, athlete);
      if (!err) {
        this.intervalsKey = '';
        this.intervalsAthleteId = '';
      }
      return err;
    });
  }

  protected syncNow(provider: ConnectionProvider): void {
    void this.run(() => this.store.syncNow(provider));
  }

  protected disconnect(provider: ConnectionProvider): void {
    if (!confirm('Desvincular esta conta? Os treinos já importados são mantidos.')) return;
    void this.run(() => this.store.disconnect(provider));
  }

  protected statusLine(account: LinkedAccount): string {
    if (account.status === 'error') return `Erro: ${account.lastError ?? 'falha na sincronização'}`;
    if (!account.backfillDone) return 'Importando histórico…';
    if (account.lastSyncAt) {
      const d = new Date(account.lastSyncAt);
      return `Última sincronização: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Aguardando primeira sincronização.';
  }
}
