/**
 * As regras puras da bancada — separadas de `amostras.ts` para poderem ser
 * **testadas**.
 *
 * O `amostras.ts` alcança as stores, o `services/route-name` e, por tabela, o
 * cliente do supabase: importá-lo num teste de unidade morre em `supabaseUrl is
 * required` antes da primeira asserção. Nenhuma das decisões abaixo precisa de
 * nada disso — são aritmética de calendário, leituras que o descritor já faz e
 * escolhas de forma — e as duas primeiras erraram em 22/09 **sem levantar
 * exceção**: a bancada mostrou `mudo` em todos os motores, que é o pior sintoma
 * possível, porque parece defeito do modelo.
 *
 * A fatia 4 do redesenho trouxe o resto: quem entra na fileira de chips, quem
 * **continua** valendo quando a corrida vai começar, e quanto ela espera por um
 * motor que não devolve nada. As três são decisões, não desenho, e estão aqui
 * pela mesma razão das outras.
 */
import {
  exposicao,
  leituraDoNome,
  lerMotorId,
  SEM_MODELO,
  type EntradaDaSaude,
  type FatosDoNome,
  type MotorId,
  type RecursoId,
  type TipoDeMotor,
} from '@vitale/shared';
import {
  COMPILACAO_AUSENTE,
  compilacaoDoModelo,
  pesoAbertoDe,
  type EstadoDaCompilacao,
  type MotorConhecido,
} from './catalogo';

/**
 * O deslocamento da semana que a Retrospectiva mede: **a anterior**.
 *
 * A convenção é do `period/bounds.ts` — 0 é o período corrente, −1 o anterior,
 * +1 o seguinte. Com `+1` a bancada pedia a semana que vem, que nunca está
 * fechada; e `descritorDaRetrospectiva.montarPedido` devolve nulo para período
 * aberto, porque um jornal não escreve a edição de uma semana que não acabou.
 */
export const OFFSET_DA_SEMANA_FECHADA = -1;

/**
 * Esta rota pode ser medida?
 *
 * O descritor recusa montar pedido para rota **degenerada** — sem cidade, curta
 * demais, ou uma cidade só com menos de 8 km —, e recusar é certo: uma rota de
 * 0 km não custa um token. O que não pode é a amostra oferecê-la assim mesmo,
 * porque aí o dono toca Medir e recebe linhas mudas sem explicação nenhuma.
 *
 * A pergunta é pura e de graça, então se faz antes.
 */
export function rotaMedivel(f: FatosDoNome): boolean {
  return leituraDoNome(f).forma !== 'degenerada';
}

/* ── a janela de sono que existe e não tem fato ──────────────────────────── */

/** O que a bancada diz quando a janela escolhida não tem noite nenhuma. */
export const MOTIVO_SEM_NOITE = 'esta janela não tem noite para ler';

/**
 * Esta janela tem o que ler?
 *
 * **É o buraco mais perigoso da família, porque não parece um vazio.** As outras
 * duas fontes devolvem lista vazia com motivo quando não há caso; a da Saúde do
 * sono **sempre devolve um caso** — a janela que o `PeriodNav` escolheu, com dado
 * ou sem. Uma janela sem noite nenhuma atravessa a corrida inteira e sai com a
 * lápide da contagem em todas as colunas: parece defeito de todos os modelos ao
 * mesmo tempo, que é o mesmo sintoma que a rota degenerada produzia.
 *
 * A pergunta é a que `periodScore` já respondeu — a cobertura de noites gravadas
 * —, e é ela que o caso `sem-noite` do núcleo lê. Aqui ela é lida direto do
 * `score` de propósito: `casoDaSaude` é peça da leitura e está barrada nas telas
 * (guarda (7) do `architecture.test.ts`), justamente para a tela não classificar
 * a contagem por conta própria. Contar noites não é classificar contagem.
 *
 * `coverage` nulo é "não há denominador", não "não há noite": quem o produz é a
 * contagem de uma noite avulsa, que existe por definição.
 */
export function janelaComNoite(e: EntradaDaSaude): boolean {
  const c = e.score.coverage;
  return c === null || c.nights > 0;
}

/* ── a régua, que só existe numa das três leituras ───────────────────────── */

/**
 * Onde o `semModelo` do descritor devolve **frase**, e não lápide.
 *
 * Escrito à mão, e não perguntado ao descritor, porque `semModelo` é uma das
 * cinco funções que só o orquestrador percorre — a barreira do
 * `architecture.test.ts` está em zero e chamá-la aqui abriria a segunda
 * sequência. O que trava a divergência é o teste ao lado, que é hospedeiro de
 * teste e pode chamar: ele confere esta tabela contra os três descritores reais.
 *
 * Fechada sobre `RecursoId`: leitura nova não compila até alguém dizer se ela
 * tem régua. Sem isso, a fileira de chips prometeria uma coluna que o cartão
 * logo acima explica que não vai existir.
 */
export const RECURSOS_COM_REGUA: Readonly<Record<RecursoId, boolean>> = {
  'saude-do-sono': true,
  retrospectiva: false,
  'nome-de-rota': false,
};

/* ── quem entra na fileira, e quem continua valendo na hora de correr ────── */

/**
 * Este motor cabe no teto de exposição do recurso?
 *
 * **Medir não grava, mas medir manda o caso para fora do aparelho** — e isso é
 * exposição, não escrita. O `grava.admite` se afrouxa na bancada (é por ele que
 * o peso aberto corre em leituras onde ele não pode escrever); o `regimeMaximo`
 * não. O motor que passa do teto **não ganha chip**: nem desligado, nem apagado,
 * ausente. Um chip desligado convidaria a ligar o que a regra proíbe, e um
 * apagado prometeria um motivo que o recurso nunca vai deixar de ter.
 *
 * Hoje os três recursos admitem nuvem e o caso não ocorre. A regra existe para o
 * quarto — só-aparelho — não nascer com um botão que sai do telefone.
 */
export function cabeNoRegime(regimeMaximo: TipoDeMotor, id: MotorId): boolean {
  const lido = lerMotorId(id);
  if (!lido) return false;
  return exposicao(lido.tipo) <= exposicao(regimeMaximo);
}

/** Um motor que não vai correr, com o motivo nas duas medidas de texto da tela. */
export interface ForaDaCorrida {
  readonly tipo: 'fora';
  /**
   * Dentro do rótulo do chip: curto, porque o chip não tem linha de baixo onde
   * pôr explicação.
   */
  readonly noChip: string;
  /**
   * Na linha da corrida: o mesmo fato escrito como quem **perdeu o pé no meio**.
   * São textos diferentes porque os dois instantes são diferentes — no chip a
   * condição nunca existiu; na corrida ela existia quando o dono marcou.
   */
  readonly naCorrida: string;
}

/** O que a corrida sabe de um motor agora. `consultando` não é indisponível. */
export type EstadoNaCorrida = { readonly tipo: 'apto' } | { readonly tipo: 'consultando' } | ForaDaCorrida;

/**
 * O estado de um motor na corrida — **a mesma regra para o chip e para o laço**.
 *
 * Uma função só, e é o ponto: o chip é pintado uma vez e a verdade não fica
 * parada. Entre o instante em que o dono marcou um peso aberto e o instante em
 * que ele toca Medir podem passar minutos, e nesse intervalo o iOS pode purgar o
 * cache do Core AI ou a Apple Intelligence pode ser desligada nos Ajustes. Se a
 * pergunta do chip e a pergunta do laço fossem duas, uma delas envelheceria — e
 * a que envelhece é a que dispara uma compilação de quinze minutos pela única
 * porta desta família que diz, por escrito, que não compila nada.
 *
 * `compilacao` é o mapa `pasta de pesos → estado`, **relido**: guardar a resposta
 * boa é o erro que o leitor da compilação existe para não cometer.
 */
export function estadoDoMotorNaCorrida(
  m: MotorConhecido,
  compilacao: Readonly<Record<string, EstadoDaCompilacao>>,
): EstadoNaCorrida {
  // O diagnóstico ainda a caminho não é um motor que não existe: a tela o anuncia
  // ocupado, e ele não conta como marcado enquanto não responder.
  if (m.consultando === true) return { tipo: 'consultando' };
  if (!m.disponivel) {
    const motivo = m.motivo ?? 'indisponível neste build';
    return { tipo: 'fora', noChip: motivo, naCorrida: motivo };
  }
  const aberto = pesoAbertoDe(m.id);
  if (aberto === undefined) return { tipo: 'apto' };

  // **A corrida não compila nada.** A primeira chamada de um peso aberto não
  // compilado é a compilação — 11 a 15 min, medidos em 22/09 —, e não há progresso
  // em camada nenhuma do iOS 27 para mostrar enquanto ela corre.
  const estado = compilacaoDoModelo(compilacao[aberto.pesos] ?? COMPILACAO_AUSENTE);
  switch (estado.tipo) {
    case 'compilado':
      return { tipo: 'apto' };
    case 'nao-compilado':
      return {
        tipo: 'fora',
        noChip: 'não compilado',
        naCorrida: 'o compilado deste modelo não está mais no aparelho',
      };
    case 'nao-sabido':
      // "Não sei" cai do lado de fora, e nunca do lado de dentro: só o `compilado`
      // afirmado pela ponte garante que a chamada não vai compilar.
      return { tipo: 'fora', noChip: estado.motivo, naCorrida: estado.motivo };
  }
}

/** Como um chip da corrida se desenha e se anuncia. */
export type FormaDoChip = 'dentro' | 'fora' | 'travado' | 'consultando';

export interface ChipDaCorrida {
  readonly id: MotorId;
  /** O rótulo inteiro, já com o motivo dentro quando ele não é tocável. */
  readonly rotulo: string;
  readonly forma: FormaDoChip;
  /** Por que não é tocável — também vai ao rótulo acessível. */
  readonly motivo?: string;
  /** Conta como "há motor marcado **e** disponível" — a condição que solta o Medir. */
  readonly marcado: boolean;
}

export interface OpcoesDosChips {
  /** O teto de exposição do recurso escolhido. */
  readonly regimeMaximo: TipoDeMotor;
  /** Quem o dono deixou **de fora** (a inversão é deliberada — ver a tela). */
  readonly fora: ReadonlySet<string>;
  readonly compilacao: Readonly<Record<string, EstadoDaCompilacao>>;
}

/**
 * A fileira "quem entra": um chip por motor conhecido da leitura, **menos**
 * quem passa do teto de exposição e menos o template, que é régua e não motor.
 *
 * O template sai daqui de propósito: ele não é desligável, não tem estado e não
 * conta como motor — e onde não há régua ele não aparece nem como chip. Quem
 * decide isso é {@link RECURSOS_COM_REGUA}, na tela, porque é uma propriedade da
 * leitura e não de um motor.
 */
export function chipsDaCorrida(
  motores: readonly MotorConhecido[],
  { regimeMaximo, fora, compilacao }: OpcoesDosChips,
): readonly ChipDaCorrida[] {
  const out: ChipDaCorrida[] = [];
  for (const m of motores) {
    if (m.id === SEM_MODELO) continue;
    if (!cabeNoRegime(regimeMaximo, m.id)) continue;
    const estado = estadoDoMotorNaCorrida(m, compilacao);
    if (estado.tipo === 'consultando') {
      out.push({
        id: m.id,
        rotulo: `${m.rotulo} · ${m.motivo ?? 'consultando…'}`,
        forma: 'consultando',
        ...(m.motivo !== undefined ? { motivo: m.motivo } : {}),
        marcado: false,
      });
      continue;
    }
    if (estado.tipo === 'fora') {
      out.push({
        id: m.id,
        rotulo: `${m.rotulo} · ${estado.noChip}`,
        forma: 'travado',
        motivo: estado.noChip,
        marcado: false,
      });
      continue;
    }
    const dentro = !fora.has(m.id);
    out.push({ id: m.id, rotulo: m.rotulo, forma: dentro ? 'dentro' : 'fora', marcado: dentro });
  }
  return out;
}

/* ── o teto de espera de uma coluna ──────────────────────────────────────── */

/** Os prazos que os transportes deste app já têm — injetados, para serem testáveis. */
export interface PrazosDaCorrida {
  /** O prazo da nuvem e do modelo do sistema (`PRAZO_MS`). */
  readonly padrao: number;
  /** O prazo do peso aberto (`PRAZO_DO_PESO_ABERTO_MS`), que paga a compilação. */
  readonly pesoAberto: number;
}

/**
 * Quanto a corrida espera por **uma** coluna antes de fechá-la como defeito.
 *
 * Um motor que não devolve nem resposta nem erro deixa o botão `busy` para
 * sempre, e a tela inteira fica refém de uma coluna.
 *
 * **Não é um prazo novo: é o dobro do que o transporte daquele motor já tem.**
 * Cada transporte promete resolver dentro do prazo dele — `PRAZO_MS` na nuvem e
 * no modelo do sistema, `PRAZO_DO_PESO_ABERTO_MS` no peso aberto, que é o único
 * que pode pagar uma carga de minutos. Este teto é **rede**, não relógio: ele só
 * existe para o caso em que a promessa não foi cumprida, e chegar antes dela
 * apagaria a falha bem escrita que o transporte sabe dar ("o prazo de 60 s
 * estourou", com a classe certa) para pôr no lugar um "não respondeu" genérico.
 * O mesmo prazo de novo é a folga mais curta que garante isso.
 *
 * Nenhum número aqui saiu de gosto: os dois vêm de medida, e o segundo do fato de
 * que a primeira carga do Qwen3-4B levou 2 h 48 min no Mac M1.
 */
export function tetoDaCorridaMs(id: MotorId, prazos: PrazosDaCorrida): number {
  return 2 * (pesoAbertoDe(id) !== undefined ? prazos.pesoAberto : prazos.padrao);
}

/**
 * O que a coluna estourada diz.
 *
 * Em segundos enquanto eles são legíveis, em minutos depois: "não respondeu em
 * 5400 s" é um número que ninguém converte de cabeça. O teto **não** aparece em
 * lugar nenhum antes de estourar — um teto que o dono lesse viraria uma promessa
 * de tempo que esta família não faz.
 */
export function motivoDoTeto(tetoMs: number): string {
  const s = Math.round(tetoMs / 1000);
  return s < 600 ? `não respondeu em ${s} s` : `não respondeu em ${Math.round(s / 60)} min`;
}
