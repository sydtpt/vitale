/**
 * A manchete: **dias sem sair de casa**.
 *
 * O dono escolheu esta métrica em 02/10/2026, contra a recomendação da mesa (que
 * era "horas fora de casa"). A troca melhorou o desenho junto: "saiu / não saiu" é
 * **binário**, e um heatmap anual binário se lê de longe — um gradiente de 365 tons
 * de laranja, não.
 *
 * São **três** estados, nunca quatro:
 *
 * | Estado | Quando |
 * |---|---|
 * | `saiu` | houve ausência de casa acima do limiar de saída |
 * | `nao-saiu` | o dia foi coberto e nenhuma ausência passou do limiar |
 * | `sem-cobertura` | não há medição para o dia |
 *
 * **Célula vazia não é dia em casa.** Sem o terceiro estado o heatmap mente bonito
 * por um ano inteiro, e é por isso que `sem-cobertura` não tem valor padrão: ou o dia
 * está na janela medida, ou ele não existe na contagem.
 *
 * Saída curta — acima de {@link COLAGEM_MIN} e abaixo do limiar — **não vira um
 * quarto estado**. Ela aparece no detalhe do dia (`curtas`), nunca na grade do ano:
 * quatro estados obrigam legenda, e legenda é a morte do heatmap.
 */

import { ausencias, contaComoSaida, SAIDA_MIN_PADRAO, type Ausencia } from './regras';
import type { Visita } from './eventos';
import type { DiaDeLugar } from './rollup';

export type EstadoDoDia = 'saiu' | 'nao-saiu' | 'sem-cobertura';

export interface DiaDePresenca {
  /** 'YYYY-MM-DD' no fuso do lugar, não no do aparelho que está lendo. */
  dia: string;
  estado: EstadoDoDia;
  /** Ausências que contaram como saída. */
  saidas: number;
  /** Ausências que existiram e não contaram. Vivem no detalhe do dia. */
  curtas: number;
  /** Minutos da maior ausência do dia; `null` se não houve nenhuma. */
  maiorMin: number | null;
}

export interface OpcoesDosDias {
  /** O lugar que é "casa". Sem ele não há pergunta: "sair" é sair de algum lugar. */
  casa: string;
  /** Fuso do dia local. O dia de uma ausência é o dia em que ela **começou**. */
  tz: string;
  limiarMin?: number;
  /**
   * A janela realmente observada, em instantes ISO — tipicamente o primeiro e o
   * último evento do log.
   *
   * **Ela não é decoração: ela decide as bordas.** Um dia só é coberto quando a
   * janela contém o dia **inteiro**; o primeiro e o último dia são parciais por
   * definição e nascem `sem-cobertura`.
   *
   * Isso não é purismo. No log real de 24 dias, o primeiro evento é um `exit` às
   * 13h00 — ele saiu de casa naquele dia, e a saída não tem par porque a observação
   * começou depois dela. Sem esta regra, **07/09 entra na conta como "não saiu"**:
   * a métrica afirmaria reclusão exatamente no dia em que o aparelho a viu sair.
   */
  janela?: { inicio: string; fim: string };
  /** Limites do calendário a percorrer. Padrão: do primeiro ao último dia com visita. */
  de?: string;
  ate?: string;
  /**
   * O rollup do período, quando houver — e com ele a regra fica honesta na noite virada.
   *
   * **O caso que obrigou isto**, achado no mockup com dado real em 02/10/2026: o domingo
   * 20/09 aparecia como "não saiu" com **15,1 h fora de casa**. A ausência tinha começado
   * no sábado às 19:33 e terminado no domingo às 15:08 — e, como ela pertence ao dia em
   * que *começou*, o domingo inteiro fora não contava como ter saído. Um leitor chamaria
   * isso de bug, com razão.
   *
   * A correção não precisa de limiar novo: **se ele passou mais tempo fora do que em
   * casa naquele dia, ele não ficou em casa.** São duas grandezas medidas comparadas
   * entre si, e isso basta — no acervo real ela vira exatamente um dia (o 20/09) e deixa
   * o 13/09 em paz, que é o caso oposto: voltou 01:36 e não saiu mais.
   */
  rollup?: readonly DiaDeLugar[];
}

/**
 * Dia local de um instante, no fuso dado — não no fuso de quem lê.
 *
 * Uma semana em outro fuso desloca todos os dias e ninguém percebe; é por isso que o
 * `tz` viaja junto do dado desde a Fase 0, em vez de ser derivado na leitura.
 */
export function diaLocal(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Um dia por data coberta, com o estado e o detalhe.
 *
 * A ausência pertence ao dia em que **começou**. Sair às 23h40 e voltar às 2h é uma
 * saída daquela noite, não da madrugada seguinte — e é assim que ele leria.
 */
export function diasDePresenca(
  visitas: readonly Visita[],
  opts: OpcoesDosDias,
): DiaDePresenca[] {
  const limiar = opts.limiarMin ?? SAIDA_MIN_PADRAO;
  const fora = ausencias(visitas, opts.casa);

  const porDia = new Map<string, Ausencia[]>();
  for (const a of fora) {
    const d = diaLocal(a.saiuEm, opts.tz);
    const lista = porDia.get(d);
    if (lista) lista.push(a);
    else porDia.set(d, [a]);
  }

  const inicio = opts.de ?? primeiroDia(visitas, opts.tz);
  const fim = opts.ate ?? ultimoDia(visitas, opts.tz);
  if (!inicio || !fim) return [];

  // Um dia só é coberto quando a janela observada o contém **inteiro** — o que, em
  // dia local, quer dizer: a janela começou num dia anterior e terminou num posterior.
  const primeiroCoberto = opts.janela ? diaLocal(opts.janela.inicio, opts.tz) : null;
  const ultimoCoberto = opts.janela ? diaLocal(opts.janela.fim, opts.tz) : null;
  const coberto = (dia: string): boolean =>
    primeiroCoberto === null || ultimoCoberto === null
      ? true
      : dia > primeiroCoberto && dia < ultimoCoberto;

  // Horas em casa e fora, por dia, para a regra da noite virada.
  const emCasa = new Map<string, number>();
  const foraDeCasa = new Map<string, number>();
  for (const l of opts.rollup ?? []) {
    const alvo = l.placeId === opts.casa ? emCasa : l.placeId === null ? foraDeCasa : null;
    if (alvo) alvo.set(l.day, (alvo.get(l.day) ?? 0) + l.seconds);
  }
  const passouODiaFora = (dia: string): boolean =>
    (foraDeCasa.get(dia) ?? 0) > (emCasa.get(dia) ?? 0);

  const out: DiaDePresenca[] = [];
  for (const dia of intervaloDeDias(inicio, fim)) {
    const doDia = porDia.get(dia) ?? [];
    const saidas = doDia.filter((a) => contaComoSaida(a, limiar));
    const saiu = saidas.length > 0 || passouODiaFora(dia);
    out.push({
      dia,
      estado: !coberto(dia) ? 'sem-cobertura' : saiu ? 'saiu' : 'nao-saiu',
      saidas: saidas.length,
      curtas: doDia.length - saidas.length,
      maiorMin: doDia.length ? Math.max(...doDia.map((a) => a.minutos)) : null,
    });
  }
  return out;
}

/** A contagem que a manchete usa, em dois números. `semCobertura` nunca é somado aos outros dois. */
export interface ContagemDosDias {
  semSair: number;
  saiu: number;
  semCobertura: number;
  /** Maior sequência de dias seguidos sem sair. "Confinamento contínuo" é outra coisa. */
  maiorSequencia: number;
}

export function contagemDosDias(dias: readonly DiaDePresenca[]): ContagemDosDias {
  let semSair = 0;
  let saiu = 0;
  let semCobertura = 0;
  let corrente = 0;
  let maior = 0;
  for (const d of dias) {
    if (d.estado === 'saiu') {
      saiu += 1;
      corrente = 0;
    } else if (d.estado === 'nao-saiu') {
      semSair += 1;
      corrente += 1;
      if (corrente > maior) maior = corrente;
    } else {
      semCobertura += 1;
      // Buraco **interrompe** a sequência em vez de continuá-la: não se sabe o que
      // houve ali, e emendar os dois lados afirmaria reclusão que ninguém mediu.
      corrente = 0;
    }
  }
  return { semSair, saiu, semCobertura, maiorSequencia: maior };
}

function primeiroDia(visitas: readonly Visita[], tz: string): string | null {
  return visitas.length ? diaLocal(visitas[0]!.arrivedAt, tz) : null;
}

function ultimoDia(visitas: readonly Visita[], tz: string): string | null {
  const v = visitas[visitas.length - 1];
  return v ? diaLocal(v.departedAt ?? v.arrivedAt, tz) : null;
}

function intervaloDeDias(de: string, ate: string): string[] {
  const out: string[] = [];
  const d = new Date(`${de}T12:00:00Z`);
  const fim = new Date(`${ate}T12:00:00Z`);
  while (d <= fim) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
