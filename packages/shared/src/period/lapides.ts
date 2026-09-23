/**
 * O detector de métrica morta — as quatro regras do dono sobre os fatos do
 * silêncio (Story 2.7, [ADR 0055](../../../../docs/decisions/0055-a-morte-de-uma-metrica-e-medida-contra-o-ritmo-dela.md)).
 *
 * ## Onde ele mora, e por quê
 *
 * O banco responde *"quando foi a última linha de cada métrica, quantas houve,
 * quais foram os silêncios e se o aparelho estava vivo em cada um"* — fatos, e
 * nenhum juízo (`metricas_silencio`, em `data/health-daily.ts`). Quem decide o
 * que é morte é este arquivo: **puro**, sem SDK, sem rede e sem relógio
 * implícito — o `agora` é parâmetro. Mudar a régua aqui custa um teste; mudá-la
 * no banco custaria uma migração.
 *
 * Fica em `period/` e não em `ia/`: a barreira `PORTA_DE_IA` do
 * `architecture.test.ts` proíbe a tela de importar peça de `ia/`, e a tela
 * precisa da lápide (`useEntradaDaEdicao`). Um detector dentro de `ia/`
 * nasceria barrado.
 *
 * ## Medido contra produção em 23/09/2026
 *
 * A cadeia inteira foi rodada com o SQL de verdade contra o banco, e o resultado
 * alimentado aqui: o detector declara **exatamente** respiração (10/07/2026),
 * VO₂max (14/07), SpO₂ (16/07) e anéis (17/08), e nada mais. O peso ficou de
 * fora pela regra das dez medidas. É a única medição que fecha o risco de a
 * emulação do SQL nos testes ter divergido da função.
 *
 * ## As quatro regras (decisões do dono, 23/09/2026)
 *
 * 1. **Morre quando o silêncio passa do maior silêncio próprio de que ela
 *    voltou**, com piso de {@link PISO_DE_SILENCIO_DIAS} dias, **e** outra
 *    métrica chegou naquele intervalo. Um limiar fixo mentiria nos dois
 *    sentidos: o VO₂max só é medido em treino ao ar livre e cala semanas
 *    inteiras sem ter morrido, enquanto a FC de repouso chega todo dia e duas
 *    semanas mudas nela já são notícia.
 *
 *    **As duas metades protegem coisas diferentes, e a medição de 23/09 corrigiu
 *    qual é qual.** O recorde próprio é quem faz o trabalho no caso comum — uma
 *    *família* de sensores que para (em 11/07–16/09/2025 só a família de
 *    atividade emudeceu, enquanto VFC, SpO₂, respiração, sono e FC de repouso
 *    seguiram chegando). A testemunha (`outraChegou`) é **verdadeira em todos os
 *    silêncios deste acervo**, inclusive naquele: ela não distingue família
 *    parada de métrica morta — pelo dado, as duas coisas são o mesmo evento. O
 *    que ela protege é o caso **catastrófico**: o sync quebrar por inteiro (troca
 *    de telefone, permissão revogada), quando nada chega e sem ela a edição
 *    sairia com lápide em todas as métricas de uma vez.
 * 2. **A lápide é do período da última medida.** Nada a fazer aqui: o fato
 *    levado é a data, e quem separa "morreu neste período" de "morreu antes" é
 *    `lapideDoPeriodo` (`ia/pacote.ts`), com a mesma régua na tela e na
 *    impressão.
 * 3. **A morte antiga é repassada por doze meses**, ou até a métrica voltar.
 *    Sem prazo, toda edição de Movimento e de Coração fecharia com *"saturação
 *    de oxigênio — última medida em 16 de julho de 2026"* até 2028, e depois da
 *    terceira o leitor para de ver.
 * 4. **Métrica com menos de {@link MINIMO_DE_MEDIDAS} medidas na vida nunca
 *    ganha lápide.** O peso tem **uma** linha no acervo (16/07/2026): nunca foi
 *    série, e o que nunca viveu não morre.
 *
 * ## O que ele nunca faz
 *
 * - **Não olha a fonte, só a métrica.** A VFC parou no Apple Watch em 17/07 e
 *   voltou pelo intervals.icu — ela não morreu, e o detector não tem como achar
 *   que sim: o que ele lê é o dia com valor, qualquer que seja quem o gravou.
 * - **Não persiste veredito.** O backfill reescreve até 500 dias e o
 *   `updated_at` é reescrito a cada sync; tudo se recalcula a cada leitura.
 * - **Não explode.** Fato malformado (data que não é dia de calendário, métrica
 *   repetida) é descartado em silêncio: uma lápide inválida derrubaria a
 *   impressão, e o que se perde aqui é uma lápide, não a edição.
 */
import { isValidDate, localDateStr } from '../date/local';
import type { FatoLapide } from '../ia/pacote';
import { METRICAS_COM_LAPIDE, isMetricaComLapide, type MetricaComLapide } from './cadernos';

/* ── os fatos que o banco devolve ────────────────────────────────────────── */

/**
 * Um silêncio de uma métrica: um trecho de dias seguidos sem medida dela.
 *
 * `de` e `ate` são o primeiro e o último dia mudo, inclusive, e `dias` é o
 * tamanho — `ate − de + 1`. O silêncio **corrente** (o de uma métrica que ainda
 * não voltou) vai até hoje, e é o único que pode declarar morte; os fechados
 * são os que ela **atravessou e voltou**, e servem para medir o ritmo dela.
 */
export interface SilencioDeMetrica {
  readonly de: string;
  readonly ate: string;
  readonly dias: number;
  /**
   * Houve linha de **qualquer outra** métrica dentro do intervalo — o aparelho
   * estava gravando e esta métrica é que não chegava.
   *
   * No acervo do dono ele é **verdadeiro em todos os silêncios** (medido em
   * 23/09/2026): mesmo quando a família de atividade inteira emudeceu, em
   * 11/07–16/09/2025, as métricas de pulso seguiram chegando. Ele não separa
   * "uma família de sensores parou" de "a métrica morreu"; quem separa isso é o
   * recorde próprio. O que ele barra é o **blecaute**: troca de telefone,
   * permissão revogada — nada chega, e sem ele a edição sairia com lápide em
   * todas as métricas de uma vez.
   */
  readonly outraChegou: boolean;
}

/**
 * Uma métrica de `health_daily` vista de cima: o que ela teve, e quando calou.
 *
 * A função do banco devolve **também** o dia da primeira medida, e ele não entra
 * aqui: nenhuma das quatro regras o lê. Um campo que nenhuma regra confere é um
 * campo em que alguém confia um dia — e a guarda que o protegia descartava a
 * métrica inteira por causa dele. Quem quiser a data de nascimento chama a
 * função à mão.
 */
export interface MetricaNoAcervo {
  readonly metrica: string;
  /** Dia da última medida, `YYYY-MM-DD`. É a data da lápide. */
  readonly ultimaISO: string;
  /** Quantos dias da vida dela carregaram valor. */
  readonly medidas: number;
  /** Os silêncios de pelo menos o piso pedido, em ordem cronológica. */
  readonly silencios: readonly SilencioDeMetrica[];
}

/* ── os números da regra ─────────────────────────────────────────────────── */

/**
 * O piso: nenhum silêncio menor que isto declara morte, por mais que passe do
 * recorde da métrica.
 *
 * **Trinta dias, medidos** (decisão do dono, 23/09/2026, depois de rodar a cadeia
 * contra produção). Nasceu 14 e subiu, porque a medição mostrou onde está o risco
 * que sobra: **lápide falsa por pausa curta**. Sono, VFC, SpO₂ e respiração têm
 * recorde próprio de 15 a 17 dias, então com piso de 14 bastariam vinte dias de
 * interrupção — uma viagem, um relógio no conserto — para as quatro serem
 * declaradas mortas. Com 30 a pausa curta não vira lápide, e as quatro mortes de
 * hoje continuam declaradas: a mais apertada é a dos anéis, com 37 dias.
 *
 * **O preço é ver a morte cerca de duas semanas mais tarde**, e a latência já o
 * acomoda: a lápide é do período da **última medida**, então a reimpressão a põe
 * no mês certo — não no mês em que foi detectada.
 *
 * **Este número é o mesmo dos dois lados, e não por conferência.** Ele vai como
 * parâmetro da função do banco, que devolve **só** os silêncios deste tamanho
 * para cima — então o recorde próprio que o núcleo calcula ignora, por
 * construção, todo buraco de 1 a 29 dias. O núcleo não tem como reconferir o
 * filtro: os silêncios que ele reprovaria nem chegam. O que o guarda é
 * {@link lapidesDoAcervo} recusar um piso **menor** que este, que seria aplicar
 * uma régua mais frouxa que a dos fatos e subestimar o recorde.
 */
export const PISO_DE_SILENCIO_DIAS = 30;

/**
 * Menos que isto na vida inteira e a métrica nunca foi série — não morre, porque
 * não chegou a viver. O peso tem **uma** medida no acervo do dono.
 */
export const MINIMO_DE_MEDIDAS = 10;

/** Por quanto tempo uma morte continua sendo repassada às edições seguintes. */
export const MESES_DE_REPASSE = 12;

/* ── a regra ─────────────────────────────────────────────────────────────── */

/**
 * O mesmo dia, {@link MESES_DE_REPASSE} meses antes — a borda do repasse.
 *
 * **Sem transbordar.** `Date.UTC(2028, -11, 29)` para 29/02/2028 pediria
 * 29/02/2027, que não existe, e o `Date` o empurraria para 01/03/2027 — um dia
 * a mais de repasse do que a regra diz, justo na borda que este cálculo existe
 * para achar. Quando o dia não cabe no mês de destino, vale o **último dia**
 * dele, que é o que "doze meses antes" quer dizer em português.
 */
function limiteDoRepasse(hoje: string): string {
  const [a, m, d] = hoje.split('-').map(Number);
  const ano = a!;
  const mes = m! - 1 - MESES_DE_REPASSE;
  // Dia 0 do mês seguinte é o último dia do mês de destino.
  const ultimoDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(d!, ultimoDoMes))).toISOString().slice(0, 10);
}

/**
 * O silêncio **corrente** de uma métrica: o que começa depois da última medida.
 *
 * Os fechados terminam antes dela (a métrica voltou); este não terminou. Uma
 * métrica que continua chegando não tem nenhum, ou tem um menor que o piso —
 * e a função do banco nem o devolve.
 *
 * Exportada porque a matriz do detector a usa: um teste que reimplementasse a
 * comparação ficaria verde com o sinal trocado nos dois lados.
 */
export function silencioCorrente(m: MetricaNoAcervo): SilencioDeMetrica | undefined {
  return m.silencios.find((s) => s.de > m.ultimaISO);
}

/**
 * O maior silêncio **de que ela voltou** — zero quando nunca calou tanto assim.
 *
 * "Zero" quer dizer "nenhum acima do piso": os buracos menores que ele não vêm
 * do banco, e por isso o recorde é sempre uma cota inferior do real. Exportada
 * pelo mesmo motivo que a irmã acima.
 */
export function maiorSilencioFechado(m: MetricaNoAcervo): number {
  let maior = 0;
  for (const s of m.silencios) if (s.ate < m.ultimaISO && s.dias > maior) maior = s.dias;
  return maior;
}

/**
 * As métricas que **pararam de chegar**, prontas para `EntradaPacote.lapides`.
 *
 * Aplica as quatro regras do cabeçalho sobre os fatos que `metricas_silencio`
 * devolveu. Só as quatro do catálogo (`LAPIDES`, em `period/cadernos.ts`) podem
 * virar lápide — as outras vêm nos fatos e são ignoradas aqui, porque a revista
 * não sabe nomeá-las em prosa.
 *
 * `acervo` ausente ou vazio — banco antigo, leitura que falhou, hospedeiro que
 * ainda não a conhece — é **lápide nenhuma**, que é exatamente como a edição
 * saía antes desta story.
 *
 * Determinística: ordena por data da morte e, no mesmo dia, pela ordem do
 * catálogo. A resposta é função do conjunto de fatos, não da ordem em que o
 * banco os listou.
 *
 * @param agora o relógio de quem chama — só a regra 3 (o prazo de doze meses)
 *              o lê. O tamanho do silêncio já vem medido nos fatos.
 * @param piso  a régua a aplicar. Só se move **para cima**: os fatos foram
 *              buscados com {@link PISO_DE_SILENCIO_DIAS}, e um piso menor
 *              aplicaria uma régua mais frouxa sobre um recorde que já veio
 *              truncado por ele — declarando morte por um silêncio que o banco
 *              nem devolveu. Um piso menor é recusado.
 * @throws RangeError se `piso` for menor que {@link PISO_DE_SILENCIO_DIAS}.
 */
export function lapidesDoAcervo(
  acervo: readonly MetricaNoAcervo[] | undefined,
  agora: Date,
  piso: number = PISO_DE_SILENCIO_DIAS,
): FatoLapide[] {
  if (!(piso >= PISO_DE_SILENCIO_DIAS)) {
    throw new RangeError(
      `piso de ${piso} dias é menor que o dos fatos (${PISO_DE_SILENCIO_DIAS}): os silêncios abaixo dele `
      + 'nem vêm do banco, então o recorde próprio viria subestimado e a régua mais frouxa declararia '
      + 'morte por um buraco que ninguém mediu.',
    );
  }
  const limite = limiteDoRepasse(localDateStr(agora));
  const vistas = new Set<MetricaComLapide>();
  const out: FatoLapide[] = [];

  for (const m of acervo ?? []) {
    // Só as quatro que a revista sabe nomear. O resto dos fatos é contexto.
    if (!isMetricaComLapide(m.metrica)) continue;
    // Fato malformado não vira lápide: o pacote explodiria com ele, e a edição
    // inteira cairia por causa de uma linha do banco.
    if (!isValidDate(m.ultimaISO)) continue;
    if (vistas.has(m.metrica)) continue;
    // (4) nunca foi série.
    if (m.medidas < MINIMO_DE_MEDIDAS) continue;
    // (3) a morte antiga some depois de doze meses.
    if (m.ultimaISO < limite) continue;
    // (1) o silêncio corrente, acima do piso, acima do recorde próprio, e com o
    //     aparelho vivo durante ele.
    const corrente = silencioCorrente(m);
    if (corrente === undefined) continue;
    if (corrente.dias < piso) continue;
    if (!corrente.outraChegou) continue;
    if (corrente.dias <= maiorSilencioFechado(m)) continue;

    vistas.add(m.metrica);
    // (2) a data da última medida — quem decide o período dela é o pacote.
    out.push({ metrica: m.metrica, ultimaMedidaISO: m.ultimaISO });
  }

  // A mesma ordem de desempate que `lapidesPorCaderno` usa — a do catálogo, e
  // não uma segunda lista escrita aqui.
  const ordem = (m: MetricaComLapide): number => METRICAS_COM_LAPIDE.indexOf(m);
  return out.sort(
    (a, b) => a.ultimaMedidaISO.localeCompare(b.ultimaMedidaISO) || ordem(a.metrica) - ordem(b.metrica),
  );
}
