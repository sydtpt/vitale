import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MOD, metaDoTipo } from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CulturaStore, type Periodo } from '../data/cultura.store';

/**
 * Página de análise do módulo Cultura (CAP-6).
 * Spec: docs/specs/cultura/spec.md
 *
 * Ordem deliberada: INSIGHT primeiro, acervo depois. A contagem por mídia já
 * está no hub do mobile — se a web repetisse isso no topo, seria uma segunda
 * tela da mesma coisa. O que só a web faz é cruzar: de quem vêm as boas
 * indicações, e o que está encalhado há meses.
 *
 * Página de leitura, sem escrita. E a resolução temporal disponível é de
 * JANELA, não de dia: nada aqui deve sugerir precisão diária.
 */
@Component({
  selector: 'rt-cultura-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './cultura-page.component.html',
  styleUrl: './cultura-page.component.scss',
})
export class CulturaPageComponent implements OnInit {
  protected readonly store = inject(CulturaStore);

  /** Cor do módulo vem do MOD do núcleo — sem hex solto no componente. */
  protected readonly cor = MOD.cultura;

  protected readonly periodos: ReadonlyArray<{ key: Periodo; label: string }> = [
    { key: 'mes', label: 'Mês' },
    { key: 'ano', label: 'Ano' },
    { key: 'tudo', label: 'Tudo' },
  ];

  protected readonly notasOrdenadas = computed(() => {
    const d = this.store.notas();
    const max = Math.max(1, ...Object.values(d));
    // De 5 para 1: o olho lê "as melhores primeiro", que é como se pensa numa
    // distribuição de notas.
    return [5, 4, 3, 2, 1].map((n) => ({
      nota: n,
      total: d[n] ?? 0,
      pct: ((d[n] ?? 0) / max) * 100,
    }));
  });

  protected readonly temNota = computed(() =>
    this.notasOrdenadas().some((n) => n.total > 0),
  );

  ngOnInit(): void {
    void this.store.load();
  }

  protected rotuloTipo(tipo: string): string {
    return metaDoTipo(tipo).rotulo;
  }

  /** Rótulo do estado na língua da mídia (CAP-8) — "Lendo" vs "Ouvindo". */
  protected rotuloEmCurso(tipo: string): string {
    return metaDoTipo(tipo).estados.consumindo.toLowerCase();
  }

  protected media(v: number | null): string {
    return v === null ? '—' : v.toFixed(1).replace('.', ',');
  }
}
