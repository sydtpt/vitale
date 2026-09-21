/**
 * Uma medição do orquestrador virando **linha** da bancada — puro, sem rede e sem disco.
 *
 * O modo `medicao` do orquestrador devolve uma `Medicao`: a tentativa com a trilha, a
 * resposta assinada, o valor e a frase. A bancada põe isso numa linha que o dono lê — o
 * desfecho, o tempo, os tokens, o texto cru, os problemas da conferência, quem assinou —
 * e é sobre essas linhas que as medidas da ADR 0050 são contadas (`./medidas.ts`).
 *
 * **Um dono só** (story 5.13): a bancada do Mac (`scripts/bancada/medir.ts`) e a tela de
 * desenvolvimento do iPhone traduzem pela mesma função. Se cada hospedeiro escrevesse a
 * sua, bastaria um deles somar o `ms` de outro jeito para a mediana do iPhone deixar de
 * ser comparável com a do Mac.
 *
 * **O laço não mora aqui.** Quem percorre as janelas, chama o `ler` e sabe o que é frio ou
 * fabricado pelo hospedeiro é cada hospedeiro: o Mac precisa do corpo do pedido para o
 * relatório (a catraca do `montarPedido` nomeia só ele), e o app não pode montá-lo.
 */
import type { RespostaAssinada, UsoDeTokens } from '../ia/motor';
import type { Desfecho, EventoDoAnel, Medicao, ProblemaDaConferencia, Tentativa } from '../ia/orquestrar';
import type { CasoDaSaude, MotivoSemContagem } from '../sleep/caso';
import type { AlcanceDaSaude } from '../sleep/leitura';
import type { SonoRange } from '../sleep/ranges';
import type { JanelaClassificada } from './amostra';

/**
 * Como uma linha terminou. `template` é a coluna sem modelo (o piso, que não é tentativa);
 * `mudo` é o pedido nulo, em que nenhuma chamada sai. O resto é o `Desfecho` do
 * orquestrador.
 */
export type DesfechoDaLinha = Desfecho | 'template' | 'mudo';

/**
 * Quem respondeu, como a resposta assinou — sem o instante, que muda a cada linha. No
 * aparelho é aqui que ficam a plataforma e o build do sistema, porque o modelo muda com
 * eles (e medições de versões diferentes nunca se somam).
 */
export interface AssinaturaDaLinha {
  readonly tipo: 'aparelho' | 'nuvem';
  readonly provedor: string;
  readonly modelo: string;
  readonly plataforma?: string;
  readonly buildDoSistema?: string;
}

/** Uma janela medida por um motor — a linha do relatório do Mac e a da lista do iPhone. */
export interface LinhaDoRelatorio {
  readonly range: SonoRange;
  readonly offset: number;
  readonly alcance: AlcanceDaSaude;
  readonly caso: CasoDaSaude['caso'];
  readonly motivo?: MotivoSemContagem;
  /** O hash do pedido pleno, ou o sentinela `SEM_PEDIDO` quando nenhum foi montado. */
  readonly hashDoPedido: string;
  readonly desfecho: DesfechoDaLinha;
  readonly ms: number;
  readonly tokens?: UsoDeTokens;
  /** A frase pronta — só quando a conferência aprovou (ou é o template). */
  readonly frase?: string;
  /** A frase do piso, sempre: é contra ela que o dono julga a do motor. */
  readonly template: string;
  /** O texto que o motor escreveu, com os marcadores, como a conferência o leu. */
  readonly textoDoMotor?: string;
  /**
   * O exemplo de frase aprovada que o pedido desta janela trazia, com os marcadores
   * (`exemploDaSaude`, story 5.11) — só nas colunas de modelo, e só quando houve pedido.
   *
   * É contra ele que {@link formaDaAprovada} conta a cópia (`./medidas.ts`): a condição 3
   * da ADR 0050 compara a aprovada com o **template**, e um motor que devolve o exemplo
   * marcaria zero idênticas. Quem mede carimba o campo — a linha não o deduz. Linha de
   * antes da 5.11, ou de um hospedeiro que não o carimba, não o tem, e a conta diz isso em
   * vez de adivinhar.
   */
  readonly exemplo?: string;
  readonly problemas?: readonly ProblemaDaConferencia[];
  /** Nenhuma chamada saiu: o hospedeiro não entregou o motor, ou o recurso o recusou. */
  readonly sintetica?: true;
  readonly detalhe?: string;
  /** A pilha que o anel recolheu, quando houve defeito. */
  readonly pilha?: string;
  /** Quem de fato respondeu — só quando uma resposta chegou. */
  readonly assinatura?: AssinaturaDaLinha;
  /** Servida por um processo recém-aberto: o modelo subiu nela. Conta como medida, fora da mediana. */
  readonly frio?: true;
  /** A falha foi fabricada pelo hospedeiro (prazo, processo que caiu, protocolo, rede), não pelo motor. */
  readonly doHospedeiro?: true;
}

/**
 * O hash de uma linha em que **nenhum pedido foi montado** (o `mudo` do orquestrador, e o
 * defeito antes do pedido).
 *
 * Não é string vazia: duas janelas mudas com `''` pareceriam ter o mesmo pedido para quem
 * compara por hash, e a tela imprimiria uma célula em branco. O sentinela não casa
 * `/^[0-9a-f]{64}$/`, então ele também não se confunde com hash.
 */
export const SEM_PEDIDO = '(sem pedido)';

/** Quem assinou a resposta, sem o instante — é o que a bancada agrupa por coluna. */
export function assinaturaDaResposta(r: RespostaAssinada | undefined): AssinaturaDaLinha | undefined {
  if (!r) return undefined;
  const a = r.assinatura;
  return {
    tipo: a.tipo,
    provedor: a.provedor,
    modelo: a.modelo,
    ...(a.plataforma !== undefined ? { plataforma: a.plataforma } : {}),
    ...(a.buildDoSistema !== undefined ? { buildDoSistema: a.buildDoSistema } : {}),
  };
}

/** A soma do tempo das tentativas da trilha. Sem `pedidoCurto`, é sempre uma. */
export function msDaTrilha(trilha: readonly Tentativa[]): number {
  return trilha.reduce((s, t) => s + t.ms, 0);
}

/**
 * Os problemas de **toda** a trilha, não só da última tentativa.
 *
 * O `ms` já soma as duas tentativas de uma `janela` que repetiu com o pedido curto; os
 * problemas têm de seguir a mesma regra, senão a conferência da primeira desaparece da
 * linha e a contagem por regra fica menor que a realidade.
 */
export function problemasDaTrilha(trilha: readonly Tentativa[]): readonly ProblemaDaConferencia[] {
  return trilha.flatMap((t) => t.problemas ?? []);
}

/** O hash que a linha carrega: o do pedido, quando a medição chegou a montá-lo; senão, o sentinela. */
export function hashDaMedicao(m: Medicao<unknown>): string {
  return m.tipo === 'tentativa' ? m.hash : SEM_PEDIDO;
}

/** O piso como texto. A Saúde sempre tem frase; ausência com motivo também é piso válido. */
export function textoDoPiso(m: Extract<Medicao<string>, { tipo: 'template' }>): string {
  return 'frase' in m ? m.frase : `(sem frase: ${m.ausencia})`;
}

/**
 * A frase do template de uma medição da coluna sem modelo — a régua que a linha do motor
 * carrega ao lado. Uma medição que não é do piso não tem template a dar, e diz isso.
 */
export function templateDaMedicao(m: Medicao<string>): string {
  return m.tipo === 'template' ? textoDoPiso(m) : '(o piso não foi pedido)';
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

/**
 * Uma linha a partir do resultado da medição de um motor.
 *
 * `hash` é o do pedido pleno da janela — o Mac o tem do corpo que monta para o relatório,
 * o app o lê da própria medição ({@link hashDaMedicao}); os dois são o mesmo
 * `hashDoPedido`. `anel` é o último evento que o `registrar` da medição recebeu: é dele
 * que sai a pilha de um defeito.
 */
export function linhaDaMedicao(
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
  const problemas = problemasDaTrilha(m.trilha);
  const texto = typeof m.valor === 'string' ? m.valor : m.resposta?.texto;
  const assinatura = assinaturaDaResposta(m.resposta);
  return {
    ...comum,
    desfecho: m.desfecho,
    ms: msDaTrilha(m.trilha),
    ...(m.resposta?.tokens ? { tokens: m.resposta.tokens } : {}),
    ...(m.frase !== undefined ? { frase: m.frase } : {}),
    ...(texto !== undefined ? { textoDoMotor: texto } : {}),
    ...(problemas.length > 0 ? { problemas } : {}),
    ...(ultima?.sintetica ? { sintetica: true as const } : {}),
    ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
    ...(anel?.pilha !== undefined ? { pilha: anel.pilha } : {}),
    ...(assinatura ? { assinatura } : {}),
  };
}

/** Uma exceção como o defeito a registra: o nome e a mensagem, e a pilha inteira. */
export function defeitoDe(e: unknown): { detalhe: string; pilha: string } {
  return {
    detalhe: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    pilha: e instanceof Error ? (e.stack ?? String(e)) : String(e),
  };
}

/**
 * A linha de um defeito: a janela que não virou medição nenhuma, porque uma função pura
 * lançou (bug nosso). Medição não interrompe por defeito — ele vira linha, com a pilha,
 * e as outras janelas seguem.
 */
export function linhaDoDefeito(
  j: JanelaClassificada,
  hash: string,
  template: string,
  falhou: { readonly detalhe: string; readonly pilha: string },
): LinhaDoRelatorio {
  return { ...base(j, hash, template), desfecho: 'defeito', ms: 0, detalhe: falhou.detalhe, pilha: falhou.pilha };
}

/**
 * O que só o hospedeiro sabe de cada chamada, como contadores: quantas foram **frias**
 * (a primeira de um processo, em que o modelo sobe) e quantas falhas **ele mesmo
 * fabricou** (prazo estourado, processo que caiu, protocolo, rede) — nenhuma das duas o
 * motor diz.
 */
export interface ContagemDoHospedeiro {
  readonly frias: number;
  readonly doHospedeiro: number;
}

/**
 * As marcas do hospedeiro numa linha, pela **diferença de contadores**: o que mudou
 * enquanto ela era medida. Quem mede lê a contagem antes de chamar o `ler` e passa as duas
 * pontas — é assim que `frio` e `doHospedeiro` chegam à linha sem a porta (`Motor`) ganhar
 * campo nenhum.
 *
 * A diferença só é confiável quando **uma** chamada aconteceu na janela: é o caso da
 * bancada do Mac, cujo processo é o único a falar com a CLI. Um hospedeiro em que outra
 * tela pode chamar o motor no meio da janela usa {@link marcasDaChamada}, que carimba a
 * chamada em vez de subtrair contadores.
 */
export function marcasDoHospedeiro(
  depois: ContagemDoHospedeiro | undefined,
  antes: ContagemDoHospedeiro,
): { frio?: true; doHospedeiro?: true } {
  if (!depois) return {};
  return {
    ...(depois.frias > antes.frias ? { frio: true as const } : {}),
    ...(depois.doHospedeiro > antes.doHospedeiro ? { doHospedeiro: true as const } : {}),
  };
}

/**
 * A marca de **uma** chamada, como o transporte a observou ao encerrá-la: ela subiu o
 * modelo (fria) e/ou a falha foi fabricada pelo hospedeiro.
 *
 * É o que um transporte capaz de carimbar cada chamada empilha, em ordem, para quem mede
 * consumir — sem subtrair contadores globais, que numa concorrência caem na janela errada.
 */
export interface MarcaDaChamada {
  readonly frio: boolean;
  readonly doHospedeiro: boolean;
}

/** A marca de uma chamada nos campos da linha. */
export function marcasDaChamada(m: MarcaDaChamada): { frio?: true; doHospedeiro?: true } {
  return {
    ...(m.frio ? { frio: true as const } : {}),
    ...(m.doHospedeiro ? { doHospedeiro: true as const } : {}),
  };
}
