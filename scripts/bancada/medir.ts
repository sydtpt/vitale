/**
 * O laço da medição: para cada janela, a entrada do núcleo e o orquestrador em
 * modo `medicao` — um motor por coluna (AD-11).
 *
 * **A bancada não reimplementa nada.** Ela monta a entrada com `entradaDaSaude`, a
 * mesma que a tela vai usar, e chama `ler` com `{ modo: 'medicao', motor }`: é o
 * orquestrador que monta o pedido, chama o motor, interpreta, confere e escreve a
 * frase. Por isso o pedido da bancada é, **pelo mesmo hash**, o pedido da tela — e
 * é disso que a 1.10 depende.
 *
 * **Modo `medicao`, não produto:** exatamente um motor, sem recuo e sem piso. O
 * `regimeMaximo` do recurso continua valendo (dado de um recurso só-aparelho não
 * vai à nuvem nem para medir), e o `grava.admite` não — medir não grava.
 *
 * **A coluna sem modelo é a régua, e roda sempre.** Ela é determinística e de
 * graça, mede todas as janelas e dá, de cada uma, a frase do template que o
 * relatório põe ao lado da do motor. Uma coluna de motor não precisa existir para
 * ela existir.
 *
 * **Falha não interrompe.** Nenhuma classe de falha derruba o laço: a porta nunca
 * rejeita, e a linha carrega a classe. Uma exceção de função pura do descritor
 * *derrubaria* — e numa execução de 387 janelas isso significaria nenhum relatório
 * —, então ela é recolhida como `defeito`, com a pilha na linha e um aviso no
 * `stderr`. É medição: o defeito tem de aparecer no relatório, não apagá-lo.
 */
import {
  SEM_MODELO,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  hashDoPedido,
  ler,
  type EventoDoAnel,
  type Medicao,
  type Motor,
  type MotorId,
  type Pedido,
  type ProblemaDaConferencia,
  type SleepPeriod,
  type Tentativa,
} from '@vitale/shared';
import { chaveDaJanela, type JanelaClassificada } from './janelas.ts';
import type { LinhaDoRelatorio, PedidoDoRelatorio } from './relatorio.ts';

/** O acervo lido: as noites e as notas por dia de acordar, como a store as guarda. */
export interface Dados {
  readonly noites: readonly SleepPeriod[];
  readonly notas: Readonly<Record<string, number>>;
}

export interface Hospedeiro {
  readonly motorPara: (id: MotorId) => Motor | undefined;
  /** O relógio, injetado — é dele que sai o `ms` de cada tentativa. */
  readonly agora?: () => Date;
}

/** Uma coluna pedida: o motor e as janelas em que ele é medido (a amostra). */
export interface ColunaPedida {
  readonly motor: MotorId;
  readonly janelas: readonly JanelaClassificada[];
}

export interface Medido {
  readonly colunas: readonly { readonly motor: MotorId; readonly linhas: readonly LinhaDoRelatorio[] }[];
  readonly pedidos: Readonly<Record<string, PedidoDoRelatorio>>;
}

const D = descritorDaSaudeDoSono;

/** O recurso e a versão que o manifesto registra — saem do descritor, nunca de literal. */
export const RECURSO = D.recurso;
export const VERSAO_DO_DESCRITOR = D.versao;

/** A soma do tempo das tentativas da trilha. Sem `pedidoCurto`, é sempre uma. */
function msDa(trilha: readonly Tentativa[]): number {
  return trilha.reduce((s, t) => s + t.ms, 0);
}

/**
 * Os problemas de **toda** a trilha, não só da última tentativa.
 *
 * O `ms` já soma as duas tentativas de uma `janela` que repetiu com o pedido curto;
 * os problemas têm de seguir a mesma regra, senão a conferência da primeira
 * desaparece do relatório e a contagem por regra fica menor que a realidade.
 */
function problemasDa(trilha: readonly Tentativa[]): readonly ProblemaDaConferencia[] {
  return trilha.flatMap((t) => t.problemas ?? []);
}

/**
 * O hash de uma linha em que **nenhum pedido foi montado** (o `mudo` do
 * orquestrador, e o defeito antes do pedido).
 *
 * Não é string vazia: duas janelas mudas com `''` pareceriam ter o mesmo pedido para
 * `compararRelatorios`, e o Markdown imprimiria uma célula de hash em branco. O
 * sentinela não casa `/^[0-9a-f]{64}$/`, então ele também não se confunde com hash.
 */
export const SEM_PEDIDO = '(sem pedido)';

function erro(e: unknown): { detalhe: string; pilha: string } {
  return {
    detalhe: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    pilha: e instanceof Error ? (e.stack ?? String(e)) : String(e),
  };
}

/** Os campos que toda linha da mesma janela compartilha. */
function base(j: JanelaClassificada, hash: string, template: string): Omit<LinhaDoRelatorio, 'desfecho' | 'ms'> {
  return {
    range: j.range,
    offset: j.offset,
    alcance: j.alcance,
    caso: j.caso,
    ...(j.motivo !== undefined ? { motivo: j.motivo } : {}),
    hashDoPedido: hash,
    template,
  };
}

/** O piso como texto. A Saúde sempre tem frase; ausência com motivo também é piso válido. */
function textoDoPiso(m: Extract<Medicao<string>, { tipo: 'template' }>): string {
  return 'frase' in m ? m.frase : `(sem frase: ${m.ausencia})`;
}

/** Uma linha a partir do resultado da medição de um motor. */
function linhaDaMedicao(
  j: JanelaClassificada,
  hash: string,
  template: string,
  m: Medicao<string>,
  anel: EventoDoAnel | null,
): LinhaDoRelatorio {
  const comum = base(j, hash, template);
  if (m.tipo === 'template') return { ...comum, desfecho: 'template', ms: 0, frase: textoDoPiso(m) };
  if (m.tipo === 'mudo') return { ...comum, hashDoPedido: SEM_PEDIDO, desfecho: 'mudo', ms: 0 };

  const ultima = m.trilha[m.trilha.length - 1];
  const problemas = problemasDa(m.trilha);
  const texto = typeof m.valor === 'string' ? m.valor : m.resposta?.texto;
  return {
    ...comum,
    desfecho: m.desfecho,
    ms: msDa(m.trilha),
    ...(m.resposta?.tokens ? { tokens: m.resposta.tokens } : {}),
    ...(m.frase !== undefined ? { frase: m.frase } : {}),
    ...(texto !== undefined ? { textoDoMotor: texto } : {}),
    ...(problemas.length > 0 ? { problemas } : {}),
    ...(ultima?.sintetica ? { sintetica: true as const } : {}),
    ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
    ...(anel?.pilha !== undefined ? { pilha: anel.pilha } : {}),
  };
}

/**
 * Mede as colunas pedidas.
 *
 * A passada do template vem primeiro, sobre **todas** as janelas: ela dá a coluna
 * `sem-modelo` e a régua de cada janela. Depois, uma passada por motor, sobre as
 * janelas daquela coluna.
 */
export async function medir(args: {
  readonly dados: Dados;
  readonly hoje: string;
  readonly janelas: readonly JanelaClassificada[];
  readonly colunas: readonly ColunaPedida[];
  readonly hospedeiro: Hospedeiro;
  readonly aoAndar?: (p: { readonly motor: MotorId; readonly feito: number; readonly total: number }) => void;
  readonly avisar?: (mensagem: string) => void;
}): Promise<Medido> {
  const { dados, hoje, janelas, hospedeiro, aoAndar } = args;
  const avisar = args.avisar ?? ((m: string) => process.stderr.write(`${m}\n`));
  const agora = hospedeiro.agora ?? ((): Date => new Date());
  const pedidos: Record<string, PedidoDoRelatorio> = {};
  const templates = new Map<string, { readonly hash: string; readonly template: string }>();

  /** Uma leitura em modo medição, com o anel recolhido — e o defeito virando linha. */
  const medirUma = async (
    j: JanelaClassificada,
    motor: MotorId,
  ): Promise<{ readonly m: Medicao<string> | null; readonly anel: EventoDoAnel | null; readonly hash: string; readonly erro?: ReturnType<typeof erro> }> => {
    let anel: EventoDoAnel | null = null;
    const registrar = (e: EventoDoAnel): void => {
      anel = e;
    };
    try {
      const e = entradaDaSaude(dados.noites, dados.notas, { range: j.range, offset: j.offset, hoje });
      const pedido: Pedido | null = D.montarPedido(e);
      const hash = pedido ? hashDoPedido(pedido, D.versao) : SEM_PEDIDO;
      if (pedido) pedidos[hash] ??= { sistema: pedido.sistema, usuario: pedido.usuario };
      const m = await ler(D, e, { modo: 'medicao', motor, motorPara: hospedeiro.motorPara, registrar, agora });
      return { m, anel, hash };
    } catch (x) {
      return { m: null, anel, hash: SEM_PEDIDO, erro: erro(x) };
    }
  };

  /**
   * A linha de um defeito: a janela que não virou medição nenhuma.
   *
   * **Toda** exceção do laço passa por aqui — a da leitura, a de `linhaDaMedicao` e a
   * de `textoDoPiso`. Uma delas escapando derrubaria a corrida inteira e não
   * escreveria relatório nenhum, que é o oposto de "falha não interrompe": o defeito
   * tem de virar uma linha que o dono vê, não o apagamento das outras 386.
   */
  const linhaDeDefeito = (
    j: JanelaClassificada,
    hash: string,
    template: string,
    falhou: { detalhe: string; pilha: string },
    onde: string,
  ): LinhaDoRelatorio => {
    avisar(`defeito em ${onde} ${chaveDaJanela(j)}: ${falhou.detalhe}`);
    return { ...base(j, hash, template), desfecho: 'defeito', ms: 0, ...falhou };
  };

  /* A régua: todas as janelas, sem rede. */
  const linhasDoTemplate: LinhaDoRelatorio[] = [];
  let feito = 0;
  for (const j of janelas) {
    const { m, anel, hash, erro: falhou } = await medirUma(j, SEM_MODELO);
    feito += 1;
    aoAndar?.({ motor: SEM_MODELO, feito, total: janelas.length });
    if (!m || falhou) {
      linhasDoTemplate.push(linhaDeDefeito(j, hash, '(defeito)', falhou ?? erro(new Error('sem medição')), SEM_MODELO));
      continue;
    }
    // O piso e a linha também podem lançar (um `SleepScore` incoerente faz
    // `porcentagem` lançar, por exemplo), e aqui já é fora do `try` de `medirUma`.
    try {
      const template = m.tipo === 'template' ? textoDoPiso(m) : '(o piso não foi pedido)';
      templates.set(chaveDaJanela(j), { hash, template });
      linhasDoTemplate.push(linhaDaMedicao(j, hash, template, m, anel));
    } catch (x) {
      linhasDoTemplate.push(linhaDeDefeito(j, hash, '(defeito)', erro(x), SEM_MODELO));
    }
  }

  const colunas: { motor: MotorId; linhas: LinhaDoRelatorio[] }[] = [
    { motor: SEM_MODELO, linhas: linhasDoTemplate },
  ];

  /* As colunas de modelo, sobre a amostra de cada uma. */
  for (const pedida of args.colunas) {
    if (pedida.motor === SEM_MODELO) continue; // a régua já está feita
    const linhas: LinhaDoRelatorio[] = [];
    let n = 0;
    for (const j of pedida.janelas) {
      const regua = templates.get(chaveDaJanela(j));
      const { m, anel, hash, erro: falhou } = await medirUma(j, pedida.motor);
      n += 1;
      aoAndar?.({ motor: pedida.motor, feito: n, total: pedida.janelas.length });
      const template = regua?.template ?? '(fora da passada do template)';
      if (!m || falhou) {
        linhas.push(linhaDeDefeito(j, regua?.hash ?? hash, template, falhou ?? erro(new Error('sem medição')), pedida.motor));
        continue;
      }
      try {
        linhas.push(linhaDaMedicao(j, hash, template, m, anel));
      } catch (x) {
        linhas.push(linhaDeDefeito(j, hash, template, erro(x), pedida.motor));
      }
    }
    colunas.push({ motor: pedida.motor, linhas });
  }

  return { colunas, pedidos };
}
