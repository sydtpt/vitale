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
 *
 * **A sonda de fidelidade é outro descritor pela mesma porta** (story 5.10). Com ela
 * pedida, cada coluna de modelo roda também `descritorDaSondaDaSaude`, sobre as mesmas
 * janelas: o motor recebe os pontos e escolhe uma dimensão entre opções fechadas, e o
 * `conferir` dela diz se a escolha está no que o código nomeia. A bancada não confere
 * nada — só guarda, ao lado, o `nomear` do caso para o dono ler.
 *
 * **A tradução da medição em linha é do núcleo** (story 5.13): `linhaDaMedicao`, o
 * defeito e as marcas do hospedeiro moram em `packages/shared/src/bancada/linha.ts`, e a
 * tela de desenvolvimento do iPhone traduz pela mesma função. O laço fica aqui — é ele que
 * precisa do corpo do pedido para o relatório (`montarPedido`), e o app não pode montá-lo.
 */
import {
  SEM_MODELO,
  SEM_PEDIDO,
  assinaturaDaResposta,
  casoDaSaude,
  defeitoDe,
  descritorDaSaudeDoSono,
  descritorDaSondaDaSaude,
  entradaDaSaude,
  hashDoPedido,
  ler,
  linhaDaMedicao,
  linhaDoDefeito,
  marcasDoHospedeiro,
  msDaTrilha,
  problemasDaTrilha,
  templateDaMedicao,
  type ContagemDoHospedeiro,
  type EventoDoAnel,
  type Medicao,
  type Motor,
  type MotorId,
  type Pedido,
  type SleepPeriod,
} from '@vitale/shared';
import { chaveDoPasso, type JanelaClassificada } from './janelas.ts';
import type { LinhaDaSonda, LinhaDoRelatorio, PedidoDoRelatorio } from './relatorio.ts';

/** O sentinela do hash sem pedido — do núcleo, e reexportado com o nome de sempre. */
export { SEM_PEDIDO };

/** O acervo lido: as noites e as notas por dia de acordar, como a store as guarda. */
export interface Dados {
  readonly noites: readonly SleepPeriod[];
  readonly notas: Readonly<Record<string, number>>;
}

export interface Hospedeiro {
  readonly motorPara: (id: MotorId) => Motor | undefined;
  /** O relógio, injetado — é dele que sai o `ms` de cada tentativa. */
  readonly agora?: () => Date;
  /**
   * O que só o hospedeiro sabe (`motores.ts`): quantas chamadas foram frias e quantas
   * falhas ele mesmo fabricou. A medição lê a diferença antes e depois de cada linha, e a
   * marca (`marcasDoHospedeiro`, do núcleo) — é assim que `frio` e `doHospedeiro` chegam ao
   * relatório.
   */
  readonly registro?: ContagemDoHospedeiro;
}

/** Uma coluna pedida: o motor e as janelas em que ele é medido (a amostra). */
export interface ColunaPedida {
  readonly motor: MotorId;
  readonly janelas: readonly JanelaClassificada[];
}

export interface Medido {
  readonly colunas: readonly {
    readonly motor: MotorId;
    readonly linhas: readonly LinhaDoRelatorio[];
    /** Só com a sonda pedida, e só nas colunas de modelo. */
    readonly sonda?: readonly LinhaDaSonda[];
  }[];
  readonly pedidos: Readonly<Record<string, PedidoDoRelatorio>>;
}

const D = descritorDaSaudeDoSono;
/** A sonda de fidelidade (story 5.10): um descritor só de medição, pela mesma porta. */
const S = descritorDaSondaDaSaude;

/** O recurso e a versão que o manifesto registra — saem do descritor, nunca de literal. */
export const RECURSO = D.recurso;
export const VERSAO_DO_DESCRITOR = D.versao;
export const VERSAO_DA_SONDA = S.versao;

/**
 * Uma linha da sonda. O `esperado` é o `nomear` do caso — para o dono ler a escolha e
 * a resposta certa lado a lado; quem aprovou ou reprovou foi o `conferir` do descritor.
 */
function linhaDaSondaMedida(
  j: JanelaClassificada,
  hash: string,
  esperado: readonly string[],
  opcoes: readonly string[],
  m: Medicao<string>,
  anel: EventoDoAnel | null,
): LinhaDaSonda {
  const base = { range: j.range, offset: j.offset, alcance: j.alcance, caso: j.caso, esperado, opcoes };
  if (m.tipo === 'template') return { ...base, hashDoPedido: hash, desfecho: 'template', ms: 0 };
  if (m.tipo === 'mudo') return { ...base, hashDoPedido: SEM_PEDIDO, desfecho: 'mudo', ms: 0 };
  const ultima = m.trilha[m.trilha.length - 1];
  const problemas = problemasDaTrilha(m.trilha);
  const assinatura = assinaturaDaResposta(m.resposta);
  return {
    ...base,
    hashDoPedido: hash,
    desfecho: m.desfecho,
    ms: msDaTrilha(m.trilha),
    ...(m.resposta?.tokens ? { tokens: m.resposta.tokens } : {}),
    ...(typeof m.valor === 'string' ? { escolha: m.valor } : {}),
    ...(m.resposta?.texto !== undefined ? { textoDoMotor: m.resposta.texto } : {}),
    ...(problemas.length > 0 ? { problemas } : {}),
    ...(ultima?.sintetica ? { sintetica: true as const } : {}),
    ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
    ...(anel?.pilha !== undefined ? { pilha: anel.pilha } : {}),
    ...(assinatura ? { assinatura } : {}),
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
  /**
   * Roda também a sonda de fidelidade em cada coluna de modelo, sobre as mesmas janelas
   * dela (story 5.10). Só pergunta onde o caso nomeia; o resto é `mudo`, sem chamada.
   */
  readonly sonda?: boolean;
  readonly aoAndar?: (p: {
    readonly motor: MotorId;
    readonly feito: number;
    readonly total: number;
    readonly sonda?: true;
  }) => void;
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
  ): Promise<{
    readonly m: Medicao<string> | null;
    readonly anel: EventoDoAnel | null;
    readonly hash: string;
    readonly erro?: ReturnType<typeof defeitoDe>;
    readonly marcas: ReturnType<typeof marcasDoHospedeiro>;
  }> => {
    const antes = { frias: hospedeiro.registro?.frias ?? 0, doHospedeiro: hospedeiro.registro?.doHospedeiro ?? 0 };
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
      return { m, anel, hash, marcas: marcasDoHospedeiro(hospedeiro.registro, antes) };
    } catch (x) {
      return { m: null, anel, hash: SEM_PEDIDO, erro: defeitoDe(x), marcas: marcasDoHospedeiro(hospedeiro.registro, antes) };
    }
  };

  /**
   * A linha de um defeito: a janela que não virou medição nenhuma.
   *
   * **Toda** exceção do laço passa por aqui — a da leitura, a de `linhaDaMedicao` e a
   * de `templateDaMedicao`. Uma delas escapando derrubaria a corrida inteira e não
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
    avisar(`defeito em ${onde} ${chaveDoPasso(j)}: ${falhou.detalhe}`);
    return linhaDoDefeito(j, hash, template, falhou);
  };

  /* A régua: todas as janelas, sem rede. */
  const linhasDoTemplate: LinhaDoRelatorio[] = [];
  let feito = 0;
  for (const j of janelas) {
    const { m, anel, hash, erro: falhou } = await medirUma(j, SEM_MODELO);
    feito += 1;
    aoAndar?.({ motor: SEM_MODELO, feito, total: janelas.length });
    if (!m || falhou) {
      linhasDoTemplate.push(linhaDeDefeito(j, hash, '(defeito)', falhou ?? defeitoDe(new Error('sem medição')), SEM_MODELO));
      continue;
    }
    // O piso e a linha também podem lançar (um `SleepScore` incoerente faz
    // `porcentagem` lançar, por exemplo), e aqui já é fora do `try` de `medirUma`.
    try {
      const template = templateDaMedicao(m);
      templates.set(chaveDoPasso(j), { hash, template });
      linhasDoTemplate.push(linhaDaMedicao(j, hash, template, m, anel));
    } catch (x) {
      linhasDoTemplate.push(linhaDeDefeito(j, hash, '(defeito)', defeitoDe(x), SEM_MODELO));
    }
  }

  /**
   * Uma janela da sonda. Mesma regra do laço de cima: nenhuma exceção sai daqui — o
   * defeito vira linha, com a pilha, e as outras janelas seguem.
   */
  const medirSonda = async (j: JanelaClassificada, motor: MotorId): Promise<LinhaDaSonda> => {
    let anel: EventoDoAnel | null = null;
    const registrar = (e: EventoDoAnel): void => {
      anel = e;
    };
    let esperado: readonly string[] = [];
    let opcoes: readonly string[] = [];
    let hash = SEM_PEDIDO;
    const antes = { frias: hospedeiro.registro?.frias ?? 0, doHospedeiro: hospedeiro.registro?.doHospedeiro ?? 0 };
    try {
      const e = entradaDaSaude(dados.noites, dados.notas, { range: j.range, offset: j.offset, hoje });
      const caso = casoDaSaude(e.score);
      esperado = caso.nomear;
      opcoes = caso.dimensoes;
      const pedido: Pedido | null = S.montarPedido(e);
      hash = pedido ? hashDoPedido(pedido, S.versao) : SEM_PEDIDO;
      if (pedido) pedidos[hash] ??= { sistema: pedido.sistema, usuario: pedido.usuario };
      const m = await ler(S, e, { modo: 'medicao', motor, motorPara: hospedeiro.motorPara, registrar, agora });
      return { ...linhaDaSondaMedida(j, hash, esperado, opcoes, m, anel), ...marcasDoHospedeiro(hospedeiro.registro, antes) };
    } catch (x) {
      const falhou = defeitoDe(x);
      avisar(`defeito na sonda de ${motor} ${chaveDoPasso(j)}: ${falhou.detalhe}`);
      return {
        range: j.range,
        offset: j.offset,
        alcance: j.alcance,
        caso: j.caso,
        esperado,
        opcoes,
        hashDoPedido: hash,
        desfecho: 'defeito',
        ms: 0,
        ...falhou,
      };
    }
  };

  const colunas: { motor: MotorId; linhas: LinhaDoRelatorio[]; sonda?: LinhaDaSonda[] }[] = [
    { motor: SEM_MODELO, linhas: linhasDoTemplate },
  ];

  /* As colunas de modelo, sobre a amostra de cada uma. */
  for (const pedida of args.colunas) {
    if (pedida.motor === SEM_MODELO) continue; // a régua já está feita
    const linhas: LinhaDoRelatorio[] = [];
    let n = 0;
    for (const j of pedida.janelas) {
      const regua = templates.get(chaveDoPasso(j));
      const { m, anel, hash, erro: falhou, marcas } = await medirUma(j, pedida.motor);
      n += 1;
      aoAndar?.({ motor: pedida.motor, feito: n, total: pedida.janelas.length });
      const template = regua?.template ?? '(fora da passada do template)';
      if (!m || falhou) {
        linhas.push(linhaDeDefeito(j, regua?.hash ?? hash, template, falhou ?? defeitoDe(new Error('sem medição')), pedida.motor));
        continue;
      }
      try {
        linhas.push({ ...linhaDaMedicao(j, hash, template, m, anel), ...marcas });
      } catch (x) {
        linhas.push(linhaDeDefeito(j, hash, template, defeitoDe(x), pedida.motor));
      }
    }

    /* A sonda, sobre as mesmas janelas da coluna. */
    if (!args.sonda) {
      colunas.push({ motor: pedida.motor, linhas });
      continue;
    }
    const sonda: LinhaDaSonda[] = [];
    let k = 0;
    for (const j of pedida.janelas) {
      sonda.push(await medirSonda(j, pedida.motor));
      k += 1;
      aoAndar?.({ motor: pedida.motor, feito: k, total: pedida.janelas.length, sonda: true });
    }
    colunas.push({ motor: pedida.motor, linhas, sonda });
  }

  return { colunas, pedidos };
}
