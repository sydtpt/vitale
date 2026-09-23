/**
 * A amostra no iPhone (story 5.13) — o preparo, a medição de uma janela e a sequência que
 * a tela de desenvolvimento desenha.
 *
 * **A régua é do núcleo** (`packages/shared/src/bancada/`): a amostra, a tradução da
 * medição em linha e as medidas da ADR 0050 são as mesmas da bancada do Mac. O que mora
 * aqui é o que o app acrescenta — o portão das notas, o laço uma-janela-por-vez com
 * "parar" e freio, e a composição que mede uma janela **no motor que o dono escolheu**.
 *
 * **O motor deixou de ser o modelo do sistema por definição** (fatia 5 do redesenho). A
 * amostra media `APARELHO_SISTEMA`, cravado no laço, e por isso os dois pesos abertos só
 * tinham sido provados numa janela cada — uma frase não é taxa. Agora a corrida recebe
 * quem medir, uma por motor e em sequência, e o resultado carrega o nome de quem o
 * produziu. A régua de cada janela continua sendo o template (`SEM_MODELO`), medida dentro
 * dela: é contra ele que a frase do motor é julgada.
 *
 * **Fica aqui, e não na tela**, porque é isto que produz os números que o dono vai ler: na
 * tela, o jest não o importa, e o que sobraria seria uma cópia à mão dizendo que está
 * certo. A barreira do `architecture.test.ts` libera este arquivo junto com a tela e com o
 * teste dele — e mais ninguém no app.
 *
 * Nada aqui grava, e nada sai do aparelho.
 */
import {
  SEM_MODELO,
  SEM_PEDIDO,
  amostraDaNuvem,
  defeitoDe,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  enumerarJanelas,
  hashDaMedicao,
  ler,
  linhaDaMedicao,
  linhaDoDefeito,
  marcasDaChamada,
  mediana,
  noiteMaisAntiga,
  passosPorAlcance,
  templateDaMedicao,
  type CorridaDaAmostra,
  type EventoDoAnel,
  type JanelaClassificada,
  type LinhaDoRelatorio,
  type MotorId,
  type Motor,
  type SleepPeriod,
  type SonoRange,
} from '@vitale/shared';
import { motorPara as motorParaDoApp, registroDoAparelho, type RegistroDoAparelho } from './index';
import { nomeDoMotor } from './catalogo';
import type { ColunaDaCorrida } from './amostras-regras';

/* ── o acervo e o que a medição usou ─────────────────────────────────────── */

/** O acervo que a amostra lê — as noites e as notas da store, já inteiras. */
export interface DadosDaAmostra {
  readonly noites: readonly SleepPeriod[];
  readonly notas: Readonly<Record<string, number>>;
}

/** O que a medição usou — o topo do resultado, para comparar com o manifesto do Mac. */
export interface ContextoDaAmostra {
  readonly hoje: string;
  readonly limite: number;
  readonly noites: number;
  readonly notasDesde: string;
  readonly maisAntiga: string;
  readonly passos: readonly { readonly range: SonoRange; readonly passos: number }[];
  readonly enumeradas: number;
  readonly janelas: number;
}

/* ── o portão das notas ──────────────────────────────────────────────────── */

/** O que a store do sono diz das notas — o bastante para saber se elas cobrem o acervo. */
export interface EstadoDasNotas {
  /** O primeiro dia que o mapa de notas cobre, ou `null` antes de carregar. */
  readonly ratingsSince: string | null;
  /** A última falha ao estender a janela de notas. */
  readonly notasError?: string | null;
}

export type ProntidaoDasNotas =
  /** `desde` é o primeiro dia coberto — quem prepara escreve **este** no contexto, e não um palpite. */
  | { readonly pronta: true; readonly desde: string }
  | { readonly pronta: false; readonly motivo: string };

/**
 * As notas estão **inteiras** para enumerar? Cobrem desde a noite mais antiga — e, quando
 * não cobrem, o erro da última carga diz por quê.
 *
 * É o portão que faz a amostra do iPhone ser a do Mac: a percepção muda o caso, e com as
 * notas de 90 dias que a store carrega sozinha as janelas antigas cairiam em outros casos
 * — outra amostra, e números que não se comparam. Nota antes da noite mais antiga não
 * muda caso nenhum (a percepção só lê a nota do dia de acordar de uma noite), então cobrir
 * a partir dela basta.
 *
 * **A cobertura decide; o erro explica.** Um `notasError` que ficou de uma carga anterior
 * — de outra janela, que já foi coberta por outra chamada — não pode travar a sessão
 * inteira: se o mapa cobre a noite mais antiga, não há percepção faltando, e medir é
 * correto. O erro só barra quando a cobertura de fato não chegou lá.
 */
export function prontidaoDasNotas(estado: EstadoDasNotas, noiteMaisAntiga: string): ProntidaoDasNotas {
  if (estado.ratingsSince !== null && estado.ratingsSince <= noiteMaisAntiga) return { pronta: true, desde: estado.ratingsSince };
  const porque =
    estado.notasError !== undefined && estado.notasError !== null
      ? `as notas não chegaram: ${estado.notasError}`
      : estado.ratingsSince === null
        ? 'as notas ainda não chegaram'
        : `as notas só chegaram desde ${estado.ratingsSince}, e a noite mais antiga é de ${noiteMaisAntiga}`;
  return { pronta: false, motivo: porque };
}

/* ── o preparo ───────────────────────────────────────────────────────────── */

/** O que a tela lê da store do sono para preparar a amostra. */
export interface AcervoDaStore extends EstadoDasNotas {
  readonly loaded: boolean;
  readonly error?: string;
  readonly periods: readonly SleepPeriod[];
  readonly sleepRatings: Readonly<Record<string, number>>;
}

/** As etapas do preparo, na ordem — a tela diz qual está rodando. */
export const ETAPAS_DO_PREPARO = ['motores', 'notas', 'enumerando', 'amostrando'] as const;
export type EtapaDoPreparo = (typeof ETAPAS_DO_PREPARO)[number];

export const ETAPA_EM_PALAVRAS: Readonly<Record<EtapaDoPreparo, string>> = {
  motores: 'relendo o diagnóstico e o compilado dos motores marcados…',
  notas: 'carregando as notas até a noite mais antiga…',
  enumerando: 'enumerando as janelas do acervo…',
  amostrando: 'escolhendo a amostra…',
};

export type PreparoDaAmostra =
  | {
      readonly ok: true;
      readonly janelas: readonly JanelaClassificada[];
      readonly dados: DadosDaAmostra;
      readonly contexto: ContextoDaAmostra;
      /** Uma corrida por motor, na ordem — a recusada inclusive (ela vira resultado com o motivo). */
      readonly fila: readonly ColunaDaCorrida[];
    }
  /** `motivo` nulo é "cancelado": ninguém pediu explicação. */
  | { readonly ok: false; readonly motivo: string | null };

/**
 * Por que nenhuma corrida sairia desta fila — ou `null`, quando ao menos um motor mede.
 *
 * A fila só de recusas é o caso que merece a frase: o dono marcou um modelo, e entre a
 * marcação e o toque ele perdeu o pé. Enumerar 390 janelas para depois mostrar duas linhas
 * de recusa seria gastar segundos de tela para dizer o que já se sabia no primeiro passo.
 */
function semQuemMedir(fila: readonly ColunaDaCorrida[]): string | null {
  if (fila.some((c) => c.recusa === undefined)) return null;
  if (fila.length === 0) return 'nenhum motor do aparelho marcado — marque um nos chips de "quem entra"';
  return `nenhum motor marcado mede agora: ${fila.map((c) => `${nomeDoMotor(c.motor)} — ${c.recusa}`).join(' · ')}`;
}

/**
 * O preparo da amostra, antes de qualquer chamada a modelo nenhum: a fila de motores, as
 * notas inteiras, a enumeração e a amostra.
 *
 * Tudo injetado — a store, o relógio e a fila — para o teste exercitar cada recusa sem
 * React e sem rede. **Cancelável entre as etapas**: a enumeração é síncrona e longa
 * (~390 entradas), e o que se pode prometer é não começar a próxima etapa depois do toque
 * em cancelar.
 *
 * **A fila vem primeiro, e é relida aqui** (fatia 4, agora por motor): perguntar pelos
 * motores antes de enumerar é o que evita gastar segundos de tela para descobrir no fim
 * que ninguém ia medir — e é também a primeira metade da guarda que impede uma corrida de
 * 22 janelas de começar disparando uma compilação de quinze minutos. A segunda metade é
 * por corrida, em {@link medirCorridas}, porque entre o preparo e a vez do segundo motor
 * passam minutos.
 */
export async function prepararAmostra(o: {
  readonly hoje: string;
  readonly limite: number;
  /** A store, lida **a cada vez** — o acervo pode mudar durante os `await`. */
  readonly estado: () => AcervoDaStore;
  readonly carregarNotasDesde: (dia: string) => Promise<void>;
  /** Quem vai medir, com o diagnóstico e o compilado **relidos** agora. */
  readonly motores: () => Promise<readonly ColunaDaCorrida[]>;
  readonly cancelado?: () => boolean;
  readonly aoAndar?: (etapa: EtapaDoPreparo) => void;
  /** Um respiro para a tela pintar entre as etapas. */
  readonly respirar?: () => Promise<void>;
}): Promise<PreparoDaAmostra> {
  const cancelado = o.cancelado ?? ((): boolean => false);
  const respirar = o.respirar ?? ((): Promise<void> => Promise.resolve());
  const etapa = async (qual: EtapaDoPreparo): Promise<boolean> => {
    if (cancelado()) return false;
    o.aoAndar?.(qual);
    await respirar();
    return !cancelado();
  };

  if (!(await etapa('motores'))) return { ok: false, motivo: null };
  const fila = await o.motores();
  const semMedir = semQuemMedir(fila);
  if (semMedir !== null) return { ok: false, motivo: semMedir };

  const antes = o.estado();
  if (!antes.loaded) {
    return { ok: false, motivo: antes.error ? `o sono não carregou: ${antes.error}` : 'o sono ainda está carregando' };
  }
  const maisAntiga = noiteMaisAntiga(antes.periods, o.hoje);
  if (maisAntiga === null) return { ok: false, motivo: 'não há noite gravada até hoje' };

  if (!(await etapa('notas'))) return { ok: false, motivo: null };
  await o.carregarNotasDesde(maisAntiga);
  const depois = o.estado();
  // **O acervo pode ter mudado durante a carga** (um sync trouxe a noite de hoje, ou um
  // `load()` terminou): medir com a noite mais antiga de antes daria uma amostra que não é
  // a deste acervo. Recomeçar sozinho seria laço; o toque é do dono.
  const agoraMaisAntiga = noiteMaisAntiga(depois.periods, o.hoje);
  if (agoraMaisAntiga !== maisAntiga) {
    return {
      ok: false,
      motivo: `o acervo mudou enquanto as notas carregavam (a noite mais antiga era ${maisAntiga} e agora é ${
        agoraMaisAntiga ?? 'nenhuma'
      }) — toque de novo`,
    };
  }
  const notas = prontidaoDasNotas(depois, maisAntiga);
  if (!notas.pronta) return { ok: false, motivo: `${notas.motivo} — sem elas a percepção muda o caso, e a amostra não seria a do Mac` };
  // O dia que o portão conferiu, e não `ratingsSince ?? maisAntiga`: o segundo era um
  // palpite que a tela mostraria como fato se o portão um dia deixasse passar nulo.
  const notasDesde = notas.desde;

  if (!(await etapa('enumerando'))) return { ok: false, motivo: null };
  const dados: DadosDaAmostra = { noites: depois.periods, notas: depois.sleepRatings };
  const todas = enumerarJanelas(dados.noites, dados.notas, o.hoje);

  if (!(await etapa('amostrando'))) return { ok: false, motivo: null };
  const janelas = amostraDaNuvem(todas, o.limite);
  if (janelas.length === 0) {
    return {
      ok: false,
      motivo:
        todas.length === 0
          ? 'nenhuma janela no acervo até hoje — não há o que medir'
          : `a amostra ficou vazia com o limite ${o.limite}`,
    };
  }
  return {
    ok: true,
    janelas,
    dados,
    fila,
    contexto: {
      hoje: o.hoje,
      limite: o.limite,
      noites: dados.noites.filter((p) => p.wakeDay <= o.hoje).length,
      notasDesde,
      maisAntiga,
      passos: passosPorAlcance(todas),
      enumeradas: todas.length,
      janelas: janelas.length,
    },
  };
}

/* ── uma janela ──────────────────────────────────────────────────────────── */

/** O relógio e as portas que a medição usa — injetáveis, para o teste não tocar no app. */
export interface DepsDaMedicao {
  readonly motorPara?: (id: MotorId) => Motor | undefined;
  readonly registro?: RegistroDoAparelho;
  readonly agora?: () => Date;
}

/**
 * Um relógio **monotônico** vestido de `Date`, que é o que o orquestrador aceita.
 *
 * O `ms` de cada janela é a diferença entre duas leituras dele, e `new Date()` pode andar
 * para trás (o iOS ajusta a hora por NTP) — uma correção de um segundo no meio de uma
 * chamada de 14 s vira uma mediana errada, que é uma das quatro condições da ADR 0050.
 * `performance.now()` não anda para trás; onde ele não existir, cai no relógio de parede.
 */
export function relogioMonotonico(): () => Date {
  const base = Date.now();
  const monotonico = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance : null;
  if (monotonico === null) return () => new Date();
  const zero = monotonico.now();
  return () => new Date(base + (monotonico.now() - zero));
}

/** O texto que a linha ganha quando ninguém pode dizer de quem foi a falha. */
export const MARCAS_INDEFINIDAS =
  'marcas do hospedeiro indefinidas: outra chamada ao aparelho encerrou no meio desta janela';

/**
 * Uma janela da amostra, medida como a bancada do Mac a mede: a régua pelo piso, **o motor
 * pedido** em `medicao`, e a linha traduzida pela **mesma função** do Mac.
 *
 * O motor é parâmetro, e obrigatório (fatia 5): enquanto ele foi `APARELHO_SISTEMA` escrito
 * aqui dentro, a amostra do iPhone só sabia medir o modelo da Apple, e um padrão neste
 * lugar seria a maneira de uma corrida do Qwen voltar medindo outra coisa sem ninguém ver.
 *
 * Não se chama mais `medirJanelaNoAparelho`: o nome dizia onde, e o que importa é **quem**.
 *
 * O hash vem da própria medição (`hashDaMedicao`): é o `hashDoPedido` do pedido que o Mac
 * monta para o relatório, sem o app montá-lo (a catraca do `montarPedido` nomeia só a
 * bancada). O anel do app tem teto, então a medição registra com `registrar` próprio, só
 * para guardar a pilha de um defeito.
 *
 * **`frio` e `doHospedeiro` saem da marca da chamada**, não de contadores: o transporte
 * carimba cada chamada ao encerrá-la e a medição consome as marcas desta janela. Com uma
 * janela por vez, é exatamente uma; se o transporte encerrar duas aqui dentro (outra tela
 * pediu ao aparelho no meio), **não se chuta**: a linha fica sem marca e diz isso no
 * detalhe, porque atribuir a fria ou o prazo à janela errada é pior que não atribuir.
 *
 * **Quem carimba é o transporte do aparelho, e só ele** — daí a fila da amostra ser só de
 * motores do aparelho (`SO_O_APARELHO_MEDE_A_AMOSTRA`). Um motor de outro transporte sairia
 * daqui sem marca nenhuma, e o prazo que o próprio app fabricou entraria na conta como
 * reprovação do modelo.
 *
 * Nunca rejeita: uma exceção de função pura vira a linha de defeito, e a amostra segue.
 */
export async function medirJanela(
  j: JanelaClassificada,
  dados: DadosDaAmostra,
  hoje: string,
  motor: MotorId,
  deps: DepsDaMedicao = {},
): Promise<LinhaDoRelatorio> {
  const motorPara = deps.motorPara ?? motorParaDoApp;
  const registro = deps.registro ?? registroDoAparelho;
  const agora = deps.agora ?? relogioMonotonico();
  const antes = registro.marcas.length;
  let evento: EventoDoAnel | null = null;
  let hash = SEM_PEDIDO;
  let template = '(defeito)';
  try {
    const e = entradaDaSaude(dados.noites, dados.notas, { range: j.range, offset: j.offset, hoje });
    const regua = await ler(descritorDaSaudeDoSono, e, {
      modo: 'medicao',
      motor: SEM_MODELO,
      motorPara,
      registrar: () => undefined,
      agora,
    });
    template = templateDaMedicao(regua);
    const m = await ler(descritorDaSaudeDoSono, e, {
      modo: 'medicao',
      motor,
      motorPara,
      registrar: (ev) => {
        evento = ev;
      },
      agora,
    });
    hash = hashDaMedicao(m);
    const linha = linhaDaMedicao(j, hash, template, m, evento);
    const novas = registro.marcas.slice(antes);
    if (novas.length === 1) return { ...linha, ...marcasDaChamada(novas[0]!) };
    if (novas.length === 0) return linha;                       // nenhuma chamada saiu (sintética, muda)
    return { ...linha, detalhe: [linha.detalhe, MARCAS_INDEFINIDAS].filter(Boolean).join(' · ') };
  } catch (x) {
    return linhaDoDefeito(j, hash, template, defeitoDe(x));
  }
}

/* ── a sequência ─────────────────────────────────────────────────────────── */

export interface ResultadoDaSequencia<L> {
  readonly linhas: readonly L[];
  /** Parou antes da última janela: as medidas são só do que já foi medido. */
  readonly parcial: boolean;
  /** Por que parou antes do fim, quando não foi o toque em "parar". */
  readonly motivo?: string;
}

/**
 * Mede as janelas **uma por vez**, na ordem, e para quando pedirem.
 *
 * "Parar" não cancela a janela em voo — uma chamada nativa não se cancela, e ela termina
 * sozinha —: só não abre a próxima. A linha da janela em voo entra, porque ela foi medida;
 * o resultado sai marcado como parcial se sobrou janela sem medir.
 *
 * **O que já foi medido nunca se perde**: uma exceção de `medir` encerra a corrida como
 * parcial, com o motivo, em vez de subir e apagar as linhas anteriores. E `abortarSe` é o
 * freio — o laço pergunta a cada janela se vale seguir (ver {@link freioDoHospedeiro}).
 */
export async function medirEmSequencia<J, L>(o: {
  readonly janelas: readonly J[];
  readonly medir: (janela: J, indice: number) => Promise<L>;
  readonly parar: () => boolean;
  /** Vale seguir? Devolve o motivo de parar, ou `null`. */
  readonly abortarSe?: (linhas: readonly L[]) => string | null;
  /** Antes de cada janela: qual vai ao aparelho agora. */
  readonly aoAbrir?: (janela: J, indice: number) => void;
  /** Depois de cada janela: o que já foi medido. */
  readonly aoMedir?: (linhas: readonly L[]) => void;
}): Promise<ResultadoDaSequencia<L>> {
  const linhas: L[] = [];
  for (let i = 0; i < o.janelas.length; i += 1) {
    if (o.parar()) return { linhas, parcial: true };
    const janela = o.janelas[i] as J;
    o.aoAbrir?.(janela, i);
    try {
      linhas.push(await o.medir(janela, i));
    } catch (e) {
      return { linhas, parcial: true, motivo: `a medição parou por um defeito: ${defeitoDe(e).detalhe}` };
    }
    o.aoMedir?.([...linhas]);
    const freio = o.abortarSe?.(linhas) ?? null;
    if (freio !== null && i < o.janelas.length - 1) return { linhas, parcial: true, motivo: freio };
  }
  return { linhas, parcial: false };
}

/** Quantas janelas seguidas fabricadas pelo hospedeiro param a corrida. */
export const SEGUIDAS_DO_HOSPEDEIRO_PARA_PARAR = 3;

/**
 * O freio: N janelas **seguidas** em que a falha foi do hospedeiro (prazo, ponte) e nenhuma
 * chegou ao modelo.
 *
 * Sem ele, um aparelho que parou de responder custa 60 s por janela — uma hora de tela
 * acesa, com a amostra inteira fora da medida e nada medido. O freio não julga o modelo:
 * ele diz que **esta corrida** não está medindo.
 */
export function freioDoHospedeiro(
  teto: number = SEGUIDAS_DO_HOSPEDEIRO_PARA_PARAR,
): (linhas: readonly Pick<LinhaDoRelatorio, 'doHospedeiro'>[]) => string | null {
  return (linhas) => {
    if (linhas.length < teto) return null;
    const ultimas = linhas.slice(-teto);
    if (!ultimas.every((l) => l.doHospedeiro)) return null;
    return `${teto} janelas seguidas não chegaram ao modelo (prazo ou ponte) — a corrida parou; nada aqui mede o modelo`;
  };
}

/* ── uma corrida por motor, em sequência (fatia 5) ───────────────────────── */

/** Uma corrida da amostra como o app a guarda: a do núcleo, mais como ela terminou. */
export interface CorridaMedida extends CorridaDaAmostra {
  /** Parou antes da última janela: as medidas são só do que já foi medido. */
  readonly parcial: boolean;
  /** Por que parou antes do fim, quando não foi o toque em "parar" (freio, defeito). */
  readonly motivo?: string;
  readonly inicio: number;
  readonly fim: number;
}

/** O que a corrida seguinte diz quando o dono parou antes da vez dela. */
export const PARADO_ANTES_DA_VEZ = 'a corrida foi parada antes da vez deste motor';

/**
 * A amostra inteira, **um motor por corrida e em sequência**.
 *
 * Nunca em paralelo: os motores do aparelho dividem a mesma vez (`FilaDoAparelho`) porque
 * disputam a memória e o Neural Engine do mesmo telefone — duas corridas ao mesmo tempo só
 * fariam uma esperar dentro do transporte, e a espera entraria no `ms` das duas, estragando
 * a mediana de ambas. Sequencial é o que o aparelho já impõe; aqui isso fica dito.
 *
 * **Cada corrida relê antes de abrir a primeira janela** (`conferir`). É a guarda da fatia
 * 4 no lugar onde ela mais vale: a fila foi decidida antes da primeira janela, e a vez do
 * segundo motor chega minutos depois — tempo de sobra para o iOS purgar o cache do Core AI.
 * Sem esta releitura, a primeira chamada do segundo modelo **seria a compilação dele**, 11 a
 * 15 min, pela porta que promete não compilar nada.
 *
 * **O freio do hospedeiro é por motor**: cada corrida tem o seu, contando as janelas
 * seguidas dela. Um aparelho que parou de responder derruba a corrida em curso e a seguinte
 * ainda tenta — o freio diz que *aquela* corrida não está medindo, nunca que o telefone
 * morreu.
 *
 * **Nenhum motor some do resultado.** A corrida que não aconteceu — recusada no preparo,
 * recusada na releitura ou parada antes da vez — entra com o motivo, porque um modelo que
 * simplesmente sumisse da lista deixaria o dono comparando dois números e achando que pediu
 * três.
 */
export async function medirCorridas(o: {
  readonly fila: readonly ColunaDaCorrida[];
  readonly janelas: readonly JanelaClassificada[];
  /** O motor ainda está de pé? O motivo, ou `null` — relido na vez dele. */
  readonly conferir: (motor: MotorId) => Promise<string | null>;
  readonly medir: (janela: JanelaClassificada, motor: MotorId) => Promise<LinhaDoRelatorio>;
  readonly parar: () => boolean;
  readonly agora?: () => number;
  /** Antes da primeira janela de um motor. */
  readonly aoAbrirCorrida?: (motor: MotorId, indice: number) => void;
  readonly aoAbrirJanela?: (janela: JanelaClassificada) => void;
  readonly aoMedir?: (linhas: readonly LinhaDoRelatorio[]) => void;
  /** Depois de fechar uma corrida — inclusive a que não mediu nada. */
  readonly aoFechar?: (corrida: CorridaMedida) => void;
}): Promise<readonly CorridaMedida[]> {
  const agora = o.agora ?? ((): number => Date.now());
  const feitas: CorridaMedida[] = [];
  const fechar = (c: CorridaMedida): void => {
    feitas.push(c);
    o.aoFechar?.(c);
  };
  const semMedir = (motor: MotorId, recusa: string, quando: number): void =>
    fechar({ motor, linhas: [], recusa, parcial: false, inicio: quando, fim: quando });

  for (let i = 0; i < o.fila.length; i += 1) {
    const { motor, recusa } = o.fila[i]!;
    const abriu = agora();
    if (o.parar()) {
      semMedir(motor, PARADO_ANTES_DA_VEZ, abriu);
      continue;
    }
    if (recusa !== undefined) {
      semMedir(motor, recusa, abriu);
      continue;
    }
    // A releitura da vez dele — ver o cabeçalho.
    const perdeuOPe = await o.conferir(motor);
    if (perdeuOPe !== null) {
      semMedir(motor, perdeuOPe, agora());
      continue;
    }
    o.aoAbrirCorrida?.(motor, i);
    const inicio = agora();
    const { linhas, parcial, motivo } = await medirEmSequencia({
      janelas: o.janelas,
      medir: (j) => o.medir(j, motor),
      parar: o.parar,
      // Um freio novo por corrida: ele conta as janelas seguidas **desta**.
      abortarSe: freioDoHospedeiro(),
      aoAbrir: (j) => o.aoAbrirJanela?.(j),
      aoMedir: (l) => o.aoMedir?.(l),
    });
    fechar({ motor, linhas, parcial, ...(motivo !== undefined ? { motivo } : {}), inicio, fim: agora() });
  }
  return feitas;
}

/* ── o tempo da corrida ──────────────────────────────────────────────────── */

/**
 * O que a tela mostra enquanto mede: o decorrido e uma **previsão grosseira** do que falta
 * — a mediana do que já foi medido vezes as janelas restantes.
 *
 * Grosseira de propósito, e dita como tal: com limite 6 a corrida passa de dez minutos, e
 * o dono tem de poder decidir se espera antes de descobrir isso esperando.
 */
export function previsaoDaAmostra(
  linhas: readonly Pick<LinhaDoRelatorio, 'ms' | 'frio'>[],
  restantes: number,
): { readonly medianaMs: number | null; readonly restanteMs: number | null } {
  const quentes = linhas.filter((l) => !l.frio).map((l) => l.ms);
  const m = mediana(quentes.length > 0 ? quentes : linhas.map((l) => l.ms));
  return { medianaMs: m, restanteMs: m === null ? null : Math.round(m * restantes) };
}

/** `3m12s`, `48s`, `1h02m` — o tempo como se lê de relance, sem biblioteca. */
export function duracaoCurta(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  if (h > 0) return `${h}h${String(min).padStart(2, '0')}m`;
  if (min > 0) return `${min}m${String(seg).padStart(2, '0')}s`;
  return `${seg}s`;
}
