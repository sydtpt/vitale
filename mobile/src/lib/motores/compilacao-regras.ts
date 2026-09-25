/**
 * As regras puras da **tela de compilação** — a fatia 2 do redesenho de Motores.
 *
 * Elas moram aqui pelo mesmo motivo de `folha-regras.ts` e `amostras-regras.ts`: as telas
 * alcançam as stores e, por tabela, o cliente do supabase, e um teste que as importasse
 * morreria em `supabaseUrl is required` antes da primeira asserção. Nada abaixo precisa de
 * rede, de disco ou de ponte — é aritmética de tempo, escolha de palavra e a leitura de um
 * desfecho.
 *
 * Quatro regras governam o arquivo, e todas as quatro vêm do desenho aprovado em 23/09:
 *
 *  1. **O relógio conta, e não promete.** O iOS não emite fração nenhuma durante a carga
 *     (medido em 22/09), então o que a tela mostra é *quanto já correu*, nunca *quanto falta*.
 *     A única estimativa que existe é a lembrança deste aparelho ({@link linhaDaUltimaVez}).
 *  2. **Só o fim que terminou tem relógio.** A falha não mostra tempo — o que correu até
 *     falhar não diz quanto levaria se desse certo. A interrupção sem o dono também não: nem
 *     se sabe quanto correu. Parar mostra, porque foi escolha dele, e diz que não conta como
 *     medida.
 *  3. **Só o fim que terminou carimba.** É a regra que `carimbo.ts` declara no cabeçalho, e
 *     {@link fimDaCompilacao} é quem a torna decidível: um `compilou` carimba, e mais nada.
 *  4. **O sucesso é medido, não afirmado.** O que volta da ponte é o estado relido do cache,
 *     então há um desfecho que o desenho não previa — a carga voltou e o compilado não ficou
 *     completo. Ele cai no cartão da falha, com palavras do app (o sistema não disse nada) e
 *     **sem carimbo**.
 */
import { CATALOGO_DE_RECURSOS, resolverCadeia, type MotorId, type RecursoId } from '@vitale/shared';
import type { CarimboDaCompilacao } from './carimbo';
import {
  COMPILACAO_AUSENTE,
  compilacaoDoModelo,
  motoresDoRecurso,
  type EstadoDaCompilacao,
  type EstadoDasPontes,
  type ListaAprovada,
  type PesoAberto,
} from './catalogo';
import { componentesEmTexto, duracaoEmTexto, emGB } from './folha-regras';

/* ── o relógio e a duração falada ────────────────────────────────────────── */

/**
 * Uma duração como **relógio**: `5:12`, `11:04`, e `1:05:12` quando passa da hora.
 *
 * Mono e em dois pontos porque é a mesma leitura de um cronômetro — o dono compara este número
 * com o da lembrança, e minutos:segundos é a forma em que a comparação é imediata.
 *
 * Negativo e `NaN` viram `0:00`: o relógio sai de uma subtração de instantes, e um relógio da
 * tela **nunca** pode mostrar `-1:-3` porque o sistema mexeu na hora.
 */
export function relogio(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const dois = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/**
 * A mesma duração **falada**: `3 minutos e 41 segundos`.
 *
 * A folha de confirmação a usa, e não o relógio, porque ali a frase é um argumento e não uma
 * medida: *parar agora perde 3 minutos e 41 segundos*. Um `3:41` no meio de uma frase obriga o
 * leitor a converter justamente no instante em que ele está decidindo.
 */
export function duracaoFalada(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const s = total % 60;
  const m = Math.floor(total / 60);
  const seg = `${s} segundo${s === 1 ? '' : 's'}`;
  if (m === 0) return seg;
  const min = `${m} minuto${m === 1 ? '' : 's'}`;
  return s === 0 ? min : `${min} e ${seg}`;
}

/* ── a lembrança, que é a única estimativa honesta ───────────────────────── */

/**
 * A frase da lembrança, no cartão que corre.
 *
 * **O texto muda de forma, e não só de número.** Com carimbo, ele afirma um fato deste
 * aparelho; sem carimbo, ele diz que não há o que prometer — e nunca cai num "leva cerca de
 * dez minutos", que é o número que ninguém mediu aqui. Nenhum número publicado serve: o
 * tamanho do arquivo não prediz o tempo (o Tucano2 é 15% menor e compilou 27% mais rápido) e o
 * que o Mac mediu não vale para o telefone.
 */
export function linhaDaUltimaVez(carimbo: CarimboDaCompilacao | undefined): string {
  const fecho = 'O sistema não diz quanto falta — só avisa quando termina.';
  return carimbo === undefined
    ? `Este iPhone nunca compilou este modelo, então não há quanto tempo prometer. ${fecho}`
    : `Da última vez, neste iPhone, levou ${duracaoEmTexto(carimbo.ms)}. ${fecho}`;
}

/* ── a etapa: uma só, e ela não avança à vista ───────────────────────────── */

/** O rótulo da única etapa. Singular de propósito: não há passos a mostrar. */
export const ETAPA_UNICA = 'Compilando para o chip';

/**
 * Quanto a compilação vai **somar** no telefone — `+1,14 GB` —, ou nada.
 *
 * `undefined` quando ninguém mediu o compilado deste modelo (é o caso do Qwen3 4B). A etapa
 * continua existindo sem o número: o que não pode existir é um `+0 GB`, que prometeria que
 * compilar é de graça.
 */
export function somaDaEtapa(peso: PesoAberto): string | undefined {
  const c = peso.tamanho?.compiladoGB;
  return c === undefined ? undefined : `+${emGB(c)}`;
}

/**
 * A nota sob a etapa: por que ela não avança, e o que já está instalado.
 *
 * O tamanho instalado entra aqui porque é a régua do número de cima — *vai somar 1,14 GB sobre
 * 1,1 GB já instalado* —, e some quando não há medida.
 */
export function notaDaEtapa(peso: PesoAberto): string {
  const base =
    'Uma etapa só, e ela não avança à vista: o sistema não divide a compilação em passos que dê para mostrar.';
  const t = peso.tamanho;
  return t === undefined ? base : `${base} Instalado no aparelho: ${emGB(t.instaladoGB)}.`;
}

/* ── o desfecho ──────────────────────────────────────────────────────────── */

/**
 * O que a ponte devolveu, lido como **desfecho**.
 *
 * Duas formas, e a segunda carrega as palavras porque a tela da falha existe para mostrá-las:
 * a linha de cima é o motivo no vocabulário do catálogo, e o `detalhe` é a prosa que o sistema
 * escreveu. Quando quem falou foi o app — o prazo estourado, o cache que não ficou completo —,
 * `doSistema` é falso, e a tela não anuncia como fala do sistema o que ela mesma escreveu.
 */
export type FimDaCompilacao =
  | { readonly tipo: 'compilou' }
  | {
      readonly tipo: 'nao-compilou';
      /** O motivo em palavras — o título do cartão. */
      readonly palavras: string;
      /** A prosa, quando houve. */
      readonly detalhe?: string;
      /** As palavras de cima vieram do sistema (e não do app). */
      readonly doSistema: boolean;
    };

/** O que o app diz quando a carga voltou e o cache não ficou completo. */
export const CARGA_SEM_CACHE =
  'o sistema carregou os pesos e o compilado não ficou completo — a próxima leitura vai compilar de novo';

/**
 * O estado medido depois da compilação → o desfecho da tela.
 *
 * `compilacaoDoModelo` já faz a leitura de três valores com as palavras certas, e é ela que
 * decide: nenhuma tabela nova, nenhum segundo vocabulário. O que este mapa acrescenta é a
 * **terceira saída** — `nao-compilado` depois de uma compilação que não lançou —, que não
 * existe em nenhuma outra tela porque em nenhuma outra o ato acabou de acontecer.
 *
 * **Só `compilou` carimba.** É aqui que a regra de `carimbo.ts` fica decidível.
 */
export function fimDaCompilacao(estado: EstadoDaCompilacao): FimDaCompilacao {
  const lido = compilacaoDoModelo(estado);
  if (lido.tipo === 'compilado') return { tipo: 'compilou' };
  const detalhe = prosaDaCompilacao(estado);
  if (lido.tipo === 'nao-sabido') {
    return {
      tipo: 'nao-compilou',
      palavras: lido.motivo,
      ...(detalhe !== undefined ? { detalhe } : {}),
      // O motivo do Core AI é do sistema; o prazo estourado e a ponte que lançou são do app, e
      // `compilacaoDoModelo` os traduz na mesma forma — a diferença está no estado bruto.
      doSistema: estado.tipo === 'lido' && estado.compilacao.estado === 'nao-sabido',
    };
  }
  const componentes = componentesEmTexto(estado);
  return {
    tipo: 'nao-compilou',
    palavras: CARGA_SEM_CACHE,
    ...(componentes !== undefined ? { detalhe: componentes } : {}),
    doSistema: false,
  };
}

/** A prosa que a linha trouxe, quando ela existe — o `detalhe` do não-sabido e do ilegível. */
function prosaDaCompilacao(estado: EstadoDaCompilacao): string | undefined {
  if (estado.tipo !== 'lido') return undefined;
  const c = estado.compilacao;
  if (c.estado === 'ilegivel') return c.detalhe;
  if (c.estado === 'nao-sabido') return c.detalhe;
  return undefined;
}

/* ── o que a tela escreve em cada fase ───────────────────────────────────── */

/** O título, em serifada, de cada fase da tela. */
export function tituloDaFase(
  fase: 'correndo' | 'terminou' | 'falhou' | 'parada' | 'interrompida',
  peso: PesoAberto,
): string {
  switch (fase) {
    case 'correndo':
      return `Compilando o ${peso.rotulo}`;
    case 'terminou':
      return `${peso.rotulo} compilado`;
    case 'falhou':
      return 'A compilação não terminou';
    case 'parada':
      return 'Compilação parada';
    case 'interrompida':
      return 'A compilação foi interrompida';
  }
}

export const SUBTITULO_CORRENDO =
  'O iPhone reescreve o modelo para o chip dele. Só na primeira vez — depois ele abre em segundos.';
export const SUBTITULO_TERMINOU = 'Daqui em diante ele abre em segundos, até o iPhone atualizar de versão.';
export const SUBTITULO_FALHOU = 'O modelo continua instalado. Nada do que já existia foi perdido.';

/**
 * O aviso de que sair interrompe.
 *
 * **O gesto de voltar está desligado nesta tela, não interceptado** — e o texto diz isso em vez
 * de prometer uma folha que não aparece. O desenho pedia a confirmação também no gesto; o
 * roteador deste app (Expo Router do SDK 57, sobre `standard-navigation`) não expõe um
 * `usePreventRemove`, então o que existe é bloquear a borda e pôr a confirmação na seta. O
 * objetivo do desenho — quinze minutos não morrem por acidente de dedo — está cumprido; a
 * forma é outra, e está escrita.
 */
export const AVISO_DE_SAIR = 'Sair desta tela interrompe a compilação';
export const AVISO_DE_SAIR_CORPO =
  'O gesto de voltar fica desligado enquanto ela corre — a confirmação, com o tempo que se perde, aparece na seta do canto.';

export const PARAR_NAO_APAGA =
  'Parar não apaga nada: o modelo fica instalado, esperando ser compilado de novo.';

export const NAO_E_PARA_SEMPRE_TITULO = 'Isto não é para sempre';
export const NAO_E_PARA_SEMPRE =
  'Uma atualização do iPhone refaz a compilação de todos os modelos, e o sistema pode apagá-la se o telefone ficar sem espaço.';

export const SEM_RELOGIO_NA_FALHA =
  'Não há relógio aqui de propósito: o tempo que correu até falhar não diz quanto levaria se desse certo.';

export const PARADA_NAO_CONTA = 'correram, e não contam como medida';
export const PARADA_CORPO =
  'O modelo continua instalado. Compilar de novo começa do início — e é por isso que este tempo não vira "da última vez levou".';

export const INTERROMPIDA_CORPO =
  'O app foi encerrado, ou esta tela ficou para trás. Não há relógio nem carimbo: o que correu antes não se sabe, e inventar um número seria pior que não ter nenhum.';

/** O que costuma resolver, na falha — os dois remédios do desenho, nesta ordem. */
export const REMEDIOS_DA_FALHA: readonly string[] = Object.freeze([
  'Liberar espaço: compilar pede quase o mesmo tanto que o modelo ocupa.',
  'Fechar os outros apps e tentar de novo — compilar disputa memória com eles.',
]);

/** A frase da folha de confirmação: o que se perde ao parar agora. */
export function fraseDeParar(ms: number): string {
  return `Parar agora perde ${duracaoFalada(ms)} de compilação. Começar de novo custa o tempo inteiro.`;
}

/* ── o cartão "o resto do app continua" ─────────────────────────────────── */

/**
 * O nome de cada leitura na tela. Fechado sobre `RecursoId`: recurso novo no núcleo **não
 * compila** até alguém lhe dar nome.
 *
 * Mora aqui, e não na ficha, desde a fatia 2: as duas telas precisam do mesmo nome, e duas
 * grafias fariam a ficha dizer que o modelo escreve uma leitura que a compilação chama de
 * outro jeito.
 */
export const NOME_DO_RECURSO: Readonly<Record<RecursoId, string>> = Object.freeze({
  retrospectiva: 'Retrospectiva',
  'saude-do-sono': 'Saúde do sono',
  'nome-de-rota': 'Nome de rota',
  'nome-de-rota-pt': 'Nome de rota em português',
});

/**
 * As leituras que **este modelo escreve agora** — resolvidas pelo orquestrador, não lidas da
 * preferência.
 *
 * A diferença importa: a preferência pode apontar para um motor que este build não traz, e o
 * que a tela tem de dizer é o que aconteceria se o dono pedisse a leitura hoje. Uma definição
 * só, dividida pela ficha do modelo e pela tela de compilação — duas divergiriam, e o dono
 * leria uma lista na ficha e outra ao compilar.
 */
export function leiturasDoModelo(p: {
  readonly peso: PesoAberto;
  readonly pontes: EstadoDasPontes;
  readonly lista: ListaAprovada | null;
  readonly preferencias: Readonly<Partial<Record<RecursoId, MotorId>>>;
}): readonly string[] {
  return CATALOGO_DE_RECURSOS.filter((d) => {
    const conhecidos = motoresDoRecurso(d.recurso, p.pontes, p.lista);
    return (
      resolverCadeia(
        d,
        p.preferencias[d.recurso] ?? null,
        conhecidos.map((m) => m.id),
      )[0] === p.peso.id
    );
  }).map((d) => NOME_DO_RECURSO[d.recurso]);
}

/**
 * O cartão que diz que **o resto do app não para** — e que só promete o que é verdade.
 *
 * O desenho trazia "a Saúde do sono continua escrevendo com Qwen3 1.7B", que é a frase certa
 * para o caso em que se compila um modelo **antes** de escolhê-lo. Quando ele já é o escolhido
 * de alguma leitura, essa frase seria falsa: é justamente essa leitura que estaria pagando a
 * espera. Então há duas redações, e qual delas aparece sai do estado, não da suposição.
 */
export function cartaoDoQueSegue(leituras: readonly string[]): string {
  if (leituras.length === 0) {
    return 'Nada no app espera por isto: nenhuma leitura usa este modelo hoje. As leituras seguem com os motores que já escreviam.';
  }
  const nomes = leituras.join(' e ');
  const verbo = leituras.length === 1 ? 'usa' : 'usam';
  return `As outras leituras seguem com os motores que já escreviam. Só ${nomes} ${verbo} este modelo — e ${
    leituras.length === 1 ? 'ela espera' : 'elas esperam'
  } a compilação na primeira vez que for pedida.`;
}
