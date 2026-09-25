/**
 * As regras puras da **folha de escolha** e da **ficha do modelo** — a fatia 3 do
 * redesenho de Motores.
 *
 * Elas moram aqui pelo mesmo motivo de `amostras-regras.ts`: as telas alcançam as stores e,
 * por tabela, o cliente do supabase, e um teste que as importasse morreria em `supabaseUrl
 * is required` antes da primeira asserção. Nada abaixo precisa de rede, de disco ou de
 * ponte — é agrupamento, escolha de palavra e aritmética de tamanho —, e é justamente esse
 * tipo de decisão que erra calada: a folha que oferece uma lápide como se fosse alternativa,
 * o total que soma o que ninguém mediu, o carimbo que promete ao lado de "não compilado".
 *
 * Três regras governam o arquivo inteiro:
 *
 *  1. **Onde não houve medida, não há número.** `tamanho` é opcional no catálogo, e todo
 *     caminho que o lê tem um ramo que diz *não medido* em vez de somar zero.
 *  2. **"Não sei" nunca cai do lado do "não".** É a mesma distinção de três valores que
 *     `compilacaoDoModelo` faz, propagada até o texto: um diagnóstico a caminho não vira
 *     "indisponível", e um estado desconhecido não vira contradição.
 *  3. **Nada aqui chama função de descritor.** `semModelo` é uma das cinco que só o
 *     orquestrador percorre (barreira do `architecture.test.ts`, em zero), então a lápide
 *     de cada leitura é **tabela autorada** — conferida contra os três descritores reais no
 *     teste ao lado, que é hospedeiro de teste e pode chamá-los.
 */
import {
  SEM_MODELO,
  lerMotorId,
  type Grava,
  type MotorId,
  type RecursoId,
  type TipoDeMotor,
} from '@vitale/shared';
import { RECURSOS_COM_REGUA, chipsDaCorrida } from './amostras-regras';
import {
  COMPILACAO_AUSENTE,
  PESOS_ABERTOS,
  compilacaoDoModelo,
  milhar,
  motorConhecido,
  pesoAbertoDe,
  type CompilacaoDoModelo,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type MotorConhecido,
  type PesoAberto,
} from './catalogo';
import type { CarimboDaCompilacao } from './carimbo';

/* ── os três grupos da folha ─────────────────────────────────────────────── */

/**
 * Onde um motor roda. A ordem é de **exposição crescente** — o que nunca sai do telefone
 * primeiro, o que sai por último —, e é a mesma em que `resolverCadeia` resolve o recuo.
 * Com N modelos só o grupo do meio cresce, e é por isso que a folha escala onde a tela que
 * repetia todos os motores dentro de cada recurso não escalava.
 */
export type GrupoDaFolha = 'sem-modelo' | 'no-aparelho' | 'fora-do-aparelho';

export const GRUPOS_DA_FOLHA: readonly GrupoDaFolha[] = Object.freeze([
  'sem-modelo',
  'no-aparelho',
  'fora-do-aparelho',
]);

export const NOME_DO_GRUPO: Readonly<Record<GrupoDaFolha, string>> = Object.freeze({
  'sem-modelo': 'Sem modelo',
  'no-aparelho': 'No aparelho',
  'fora-do-aparelho': 'Fora do aparelho',
});

/**
 * Em que grupo um motor entra.
 *
 * Um id que **não se lê** cai em "fora do aparelho", e não no grupo mais inocente: supor o
 * contrário faria a folha prometer que um motor desconhecido não sai do telefone, que é
 * exatamente a afirmação que ela não tem como sustentar. (Ele nem deveria chegar aqui — o
 * catálogo só monta motor a partir de id legível —, mas a resposta segura é de graça.)
 */
export function grupoDoMotor(id: MotorId): GrupoDaFolha {
  const lido = lerMotorId(id);
  if (lido?.tipo === 'sem-modelo') return 'sem-modelo';
  if (lido?.tipo === 'aparelho') return 'no-aparelho';
  return 'fora-do-aparelho';
}

export interface GrupoComOpcoes {
  readonly grupo: GrupoDaFolha;
  readonly motores: readonly MotorConhecido[];
}

/**
 * Os motores agrupados por onde rodam, na ordem dos grupos, **sem grupo vazio**.
 *
 * Um cabeçalho "No aparelho" sobre nada seria a folha anunciando uma categoria que aquele
 * build não tem — e num build sem os pesos abertos e sem a ponte isso aconteceria de
 * verdade. A ordem **dentro** do grupo é a do catálogo, que já é a da cadeia.
 */
export function agruparPorOndeRoda(motores: readonly MotorConhecido[]): readonly GrupoComOpcoes[] {
  return GRUPOS_DA_FOLHA.map((grupo) => ({
    grupo,
    motores: motores.filter((m) => grupoDoMotor(m.id) === grupo),
  })).filter((g) => g.motores.length > 0);
}

/* ── o cabeçalho da folha ────────────────────────────────────────────────── */

/**
 * A linha que diz **o que esta leitura é**, e ela inclui a propriedade que governa tudo o
 * mais: se a leitura grava.
 *
 * Derivada do `grava` do descritor, e não escrita por recurso, porque é exatamente isso que
 * ela afirma — uma leitura nova herda a frase certa sem ninguém lembrar de escrevê-la, e
 * uma que passe a gravar troca de frase sozinha. É a mesma propriedade que decide por que
 * o peso aberto é escolhível numa leitura e não na outra.
 */
export function subtituloDaFolha(grava: Grava): string {
  return grava === false
    ? 'Uma frase por leitura. Esta não grava nada — por isso aceita qualquer motor.'
    : 'Uma frase por leitura. Esta grava no banco — e o que fica gravado não se desfaz.';
}

/**
 * O detalhe da opção **Sem modelo**, que muda com a leitura.
 *
 * Só a Saúde do sono tem template: ali a linha é a neutra, e a opção é um caminho. Nas
 * outras duas o `semModelo` do descritor devolve uma **lápide**, e repetir ali a frase
 * neutra ofereceria como alternativa equivalente o que o próprio código declara como
 * ausência. Mesma forma, mesma posição, outro texto — a diferença entre um caminho e uma
 * ausência é o que está escrito.
 *
 * Fechada sobre `RecursoId`: leitura nova não compila até alguém dizer o que "sem modelo"
 * significa nela. O teste ao lado confere as duas lápides, palavra por palavra, contra o
 * que os descritores reais devolvem.
 */
export const DETALHE_DO_SEM_MODELO: Readonly<Record<RecursoId, string>> = Object.freeze({
  'saude-do-sono': 'instantâneo · sempre igual · nada sai daqui',
  retrospectiva: 'a revista não imprime sem modelo',
  'nome-de-rota': 'sem modelo não há região a nomear: o percurso fica com o nome da fonte',
  // **A mesma lápide, palavra por palavra**, e não uma redação própria: as duas
  // frentes do nome dividem o corpo do descritor (`routes/descritor.ts`), então
  // dividem o `semModelo` — e é isso que o teste ao lado confere. Escrever aqui uma
  // frase "mais adequada ao português" faria a tabela mentir sobre o que o código
  // declara, que é o defeito que esta tabela existe para não ter.
  'nome-de-rota-pt': 'sem modelo não há região a nomear: o percurso fica com o nome da fonte',
});

/** "Sem modelo" é lápide nesta leitura? O inverso de haver régua — uma definição só. */
export function semModeloEhLapide(recurso: RecursoId): boolean {
  return !RECURSOS_COM_REGUA[recurso];
}

/**
 * A troca que ninguém pediu: a preferência aponta para um motor que **sumiu**.
 *
 * Um peso aberto que o build novo não embarca, uma variante de nuvem que o servidor
 * despublicou. Sem esta linha, a folha marcaria a opção do recuo e nada explicaria a troca
 * — o dono veria a escolha dele simplesmente não estar mais lá.
 *
 * **A preferência gravada não é apagada por isso** (quem apaga seria a tela, e ela não o
 * faz): se o modelo voltar num build seguinte, a escolha dele volta junto. O id entra na
 * frase de propósito: é o único traço que restou do que ele havia escolhido.
 *
 * `null` quando não há troca a contar — sem preferência, ou com uma que o catálogo conhece
 * (aí a opção aparece na folha, marcada ou bloqueada com o motivo, e a explicação é outra).
 */
export function trocaDeMotorSumido(p: {
  readonly escolhido: MotorId | null;
  readonly efetivo: MotorId;
  readonly conhecidos: readonly MotorConhecido[];
}): string | null {
  if (p.escolhido === null) return null;
  if (motorConhecido(p.escolhido, p.conhecidos) !== undefined) return null;
  const voltouPara = motorConhecido(p.efetivo, p.conhecidos)?.rotulo ?? p.efetivo;
  return `o motor que você escolheu (${p.escolhido}) não está neste build; esta leitura voltou para ${voltouPara}`;
}

/* ── o tamanho, quando houve medida ──────────────────────────────────────── */

/**
 * Um número de GB como a tela o escreve: vírgula decimal, até duas casas, sem zero à toa.
 *
 * Duas casas porque é a precisão da medida (`1,34 GB`); o arredondamento para uma casa
 * ficaria mais bonito e apagaria 40 MB do único número que esta família existe para dizer.
 */
export function emGB(n: number): string {
  // **Aritmética, e não corte de string.** Aparar a saída de `toFixed` no ponto — com
  // `split('.')` ou com uma regex de ponto — é a forma como uma frase acaba cortada errada
  // noutro lugar do repositório, e a barreira da chamada cobra o padrão com razão. E o
  // `formatarNumero` do núcleo não vem: ele é peça do núcleo de IA, barrada nas telas pela
  // guarda (7) — o mesmo motivo que `lib/assinatura.ts` já registra.
  const centesimos = Math.round(n * 100);
  const inteiro = Math.trunc(centesimos / 100);
  const resto = Math.abs(centesimos) % 100;
  if (resto === 0) return `${inteiro} GB`;
  const decimais = resto % 10 === 0 ? String(resto / 10) : String(resto).padStart(2, '0');
  return `${inteiro},${decimais} GB`;
}

/**
 * O estado da compilação de um modelo, em palavras, **com o tamanho quando há medida**.
 *
 * `compilado` soma as duas partes, porque é isso que o modelo ocupa agora;
 * `instalado, não compilado` mostra só o arquivo, porque a outra metade ainda não existe
 * no telefone. Sem medida, a frase diz *tamanho não medido* — e o que nunca some é o
 * **estado**, que é a informação que muda a decisão.
 */
export function estadoDaCompilacaoEmPalavras(estado: CompilacaoDoModelo, peso: PesoAberto): string {
  if (estado.tipo === 'nao-sabido') return estado.motivo;
  const t = peso.tamanho;
  if (estado.tipo === 'compilado') {
    const total = t !== undefined && t.compiladoGB !== undefined ? emGB(t.instaladoGB + t.compiladoGB) : null;
    return total === null ? 'compilado · tamanho não medido' : `compilado · ${total}`;
  }
  return t === undefined
    ? 'instalado, não compilado · tamanho não medido'
    : `instalado, não compilado · ${emGB(t.instaladoGB)}`;
}

/* ── o detalhe de uma opção da folha ─────────────────────────────────────── */

/** O que cada motor declara que sai do aparelho — a frase mais importante da folha. */
export const NADA_SAI = 'nada sai daqui';
export const A_NUVEM_EXPOE = 'os números desta leitura saem do aparelho';

/**
 * A linha de baixo de uma opção: **o que ela custa em exposição**, mais o que se sabe dela.
 *
 * A frase da nuvem é específica de propósito — não é "seus dados", é *os números desta
 * leitura*, e o dono sabe exatamente o que é a leitura porque acabou de tocar na linha dela.
 *
 * O detalhe do modelo do sistema (`AFM 3 Core Advanced · janela de 8.192 tokens`) vem do
 * diagnóstico e some quando ele não atende — ali a pergunta deixa de ser "qual modelo" e
 * passa a ser "por que não", e quem responde isso é o motivo de bloqueio, não esta linha.
 */
export function detalheDaOpcao(
  m: MotorConhecido,
  recurso: RecursoId,
  compilacao: Readonly<Record<string, EstadoDaCompilacao>>,
): string {
  if (m.id === SEM_MODELO) return DETALHE_DO_SEM_MODELO[recurso];
  const aberto = pesoAbertoDe(m.id);
  if (aberto !== undefined) {
    const estado = compilacaoDoModelo(compilacao[aberto.pesos] ?? COMPILACAO_AUSENTE);
    return `${estadoDaCompilacaoEmPalavras(estado, aberto)} · ${NADA_SAI}`;
  }
  if (grupoDoMotor(m.id) === 'no-aparelho') {
    return m.detalhe !== undefined ? `${m.detalhe} · ${NADA_SAI}` : NADA_SAI;
  }
  return A_NUVEM_EXPOE;
}

/**
 * A pílula **Compilar** aparece nesta opção?
 *
 * Só onde há o que compilar — um modelo em `compilado` não a carrega, porque um botão que
 * recompilasse o já compilado cobraria minutos por um toque que não mudaria nada; e um em
 * `nao-sabido` também não, porque oferecer o ato para um modelo que este build talvez nem
 * traga é a confusão exata entre "não" e "não sei" que o estado de três valores evita.
 */
export function ofereceCompilar(
  id: MotorId,
  compilacao: Readonly<Record<string, EstadoDaCompilacao>>,
): boolean {
  const aberto = pesoAbertoDe(id);
  if (aberto === undefined) return false;
  return compilacaoDoModelo(compilacao[aberto.pesos] ?? COMPILACAO_AUSENTE).tipo === 'nao-compilado';
}

/**
 * O preço do ato, dito antes dele.
 *
 * Ele era a frase de uma pílula **inerte**, porque a tela que compila não existia. Desde a
 * fatia 2 ela existe, e a frase muda de sentido: nas duas telas que não compilam — a raiz de
 * Motores e a folha de escolha — ela continua sendo **descrição**, e agora diz para onde ir. É
 * a ficha do modelo que tem o botão, porque é lá que estão o tamanho, o carimbo e a decisão.
 */
export const PRECO_DE_COMPILAR =
  'A primeira leitura deste modelo compila para o chip, e leva minutos — a ficha dele compila antes, com relógio.';

/** O que a linha da leitura diz quando a gravação da escolha falhou depois de a folha fechar. */
export const AVISO_DE_GRAVACAO_FALHA = 'não deu para guardar esta escolha';

/* ── o atalho para Comparar, no pé da folha ──────────────────────────────── */

/**
 * Quem nasce **de fora** da corrida: os pesos abertos, sempre.
 *
 * O conjunto guarda quem está de fora, e não quem está dentro, porque um motor que aparece
 * no meio da sessão — uma variante que o servidor aprovou, um peso que acabou de compilar —
 * precisa nascer ligado. Uma definição só, dividida entre a Comparação e o atalho da folha:
 * duas fariam o número do rótulo prometer uma composição que a outra tela não monta.
 */
export function foraPorPadrao(): ReadonlySet<string> {
  return new Set(PESOS_ABERTOS.map((p) => p.id));
}

/**
 * Quantas colunas a Comparação abriria **se ele entrasse agora** por este atalho.
 *
 * Conta o que vai aparecer, não o que a folha lista: os motores que nasceriam ligados, mais
 * a régua onde ela existe. **Os pesos abertos ficam fora** — decisão do dono, 23/09: cada um
 * sobe mais de um gigabyte e é o elo mais lento da corrida, e um atalho que os marcasse
 * faria o dono disparar vários minutos de medição sem ter ligado nada.
 *
 * Contar as opções da folha prometeria colunas que a corrida não vai produzir, e é a mesma
 * mentira do chip de régua onde não há régua.
 */
export function colunasDoAtalho(
  motores: readonly MotorConhecido[],
  opcoes: {
    readonly regimeMaximo: TipoDeMotor;
    readonly recurso: RecursoId;
    readonly compilacao: Readonly<Record<string, EstadoDaCompilacao>>;
  },
): number {
  const chips = chipsDaCorrida(motores, {
    regimeMaximo: opcoes.regimeMaximo,
    fora: foraPorPadrao(),
    compilacao: opcoes.compilacao,
  });
  const marcados = chips.filter((c) => c.marcado).length;
  return marcados + (RECURSOS_COM_REGUA[opcoes.recurso] ? 1 : 0);
}

/** O rótulo do atalho. Zero não vira "Comparar os 0": vira a frase sem número. */
export function rotuloDoAtalho(colunas: number): string {
  return colunas === 0 ? 'Comparar nesta leitura' : `Comparar os ${colunas} nesta leitura`;
}

/** A linha de baixo do atalho — por que o número é esse. */
export function subtituloDoAtalho(colunas: number): string {
  return colunas === 0
    ? 'nenhum motor nasceria ligado aqui — ligue um lá dentro'
    : 'os pesos abertos entram só se você ligá-los lá';
}

/* ── a ficha do modelo: o que ele ocupa ──────────────────────────────────── */

/**
 * O que um modelo ocupa no telefone, **dividido entre o que veio e o que a compilação fez**.
 *
 * Três formas, e as duas primeiras existem porque a medida pode faltar. A barra de duas
 * partes só aparece na terceira: desenhá-la com uma parte de tamanho zero seria uma fração
 * inventada, e desenhá-la para um modelo não compilado prometeria um pedaço de disco que
 * não está lá.
 */
export type OcupacaoDoModelo =
  /** O catálogo não traz medida deste modelo — e o total não some o que ninguém mediu. */
  | { readonly tipo: 'sem-medida'; readonly frase: string }
  /** Só o arquivo instalado: não compilado, ou compilado sem a segunda medida. */
  | {
      readonly tipo: 'so-instalado';
      readonly total: string;
      readonly instalado: string;
      /** O que ficou de fora da soma, quando ficou. */
      readonly semMedida?: string;
    }
  /** Instalado + compilado, com a fração que a barra desenha. */
  | {
      readonly tipo: 'duas-partes';
      readonly total: string;
      readonly instalado: string;
      readonly compilado: string;
      /** 0–1: quanto da barra é o arquivo instalado. */
      readonly fracaoInstalado: number;
    };

export const SEM_TAMANHO_MEDIDO =
  'tamanho não medido — este modelo entrou no build sem que ninguém medisse o que ele ocupa';

export function ocupacaoDoModelo(peso: PesoAberto, estado: CompilacaoDoModelo): OcupacaoDoModelo {
  const t = peso.tamanho;
  if (t === undefined) return { tipo: 'sem-medida', frase: SEM_TAMANHO_MEDIDO };
  const instalado = emGB(t.instaladoGB);
  if (estado.tipo !== 'compilado') {
    return { tipo: 'so-instalado', total: instalado, instalado };
  }
  if (t.compiladoGB === undefined) {
    return {
      tipo: 'so-instalado',
      total: instalado,
      instalado,
      semMedida: 'o compilado deste modelo ainda não foi medido, então ele fica fora do total',
    };
  }
  const soma = t.instaladoGB + t.compiladoGB;
  return {
    tipo: 'duas-partes',
    total: emGB(soma),
    instalado,
    compilado: emGB(t.compiladoGB),
    fracaoInstalado: t.instaladoGB / soma,
  };
}

/* ── a ficha do modelo: o carimbo, e a contradição ───────────────────────── */

/** `1234` → `21/09`; com ano quando ele não é o de hoje. */
export function dataCurta(em: number, agora: number): string {
  const d = new Date(em);
  const p = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  const dia = `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  return d.getFullYear() === new Date(agora).getFullYear() ? dia : `${dia}/${d.getFullYear()}`;
}

/** Uma duração medida, como a tela a escreve: minutos onde eles fazem sentido, segundos abaixo. */
export function duracaoEmTexto(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/**
 * O que a ficha mostra do carimbo, **lido contra o estado real da compilação**.
 *
 * É a guarda inteira desta parte: o carimbo é memória e `isCached` é fato, e os dois podem
 * discordar sem ninguém ter tocado em nada — o iOS recompila tudo quando o sistema atualiza
 * e apaga o cache sob pressão de espaço. Mostrar *compilado em 22/09, levou 15 min* ao lado
 * de *instalado, não compilado* deixaria o dono achar que o app se desfez.
 *
 * Em `nao-sabido` o carimbo **não aparece**: ali não se sabe se ele ainda vale, e afirmar a
 * contradição seria tão inventado quanto afirmar a lembrança.
 */
export type LinhaDoCarimbo =
  | { readonly tipo: 'ausente' }
  | { readonly tipo: 'carimbo'; readonly rotulo: string; readonly valor: string }
  | { readonly tipo: 'contradicao'; readonly frase: string };

export function linhaDoCarimbo(
  carimbo: CarimboDaCompilacao | undefined,
  estado: CompilacaoDoModelo,
  agora: number,
): LinhaDoCarimbo {
  if (carimbo === undefined) return { tipo: 'ausente' };
  if (estado.tipo === 'compilado') {
    return {
      tipo: 'carimbo',
      rotulo: `Compilado em ${dataCurta(carimbo.em, agora)}, levou`,
      valor: duracaoEmTexto(carimbo.ms),
    };
  }
  if (estado.tipo === 'nao-compilado') {
    return {
      tipo: 'contradicao',
      frase:
        `este iPhone compilou o modelo em ${dataCurta(carimbo.em, agora)} (levou ${duracaoEmTexto(carimbo.ms)}), ` +
        'e o compilado não está mais aqui: o cache é por build do iOS, e o sistema o apaga sob pressão de espaço',
    };
  }
  return { tipo: 'ausente' };
}

/**
 * A lembrança que a compilação usaria como estimativa — e a frase sem número quando este
 * aparelho nunca compilou este modelo.
 *
 * Nenhum número publicado é confiável, o tamanho do arquivo não prediz o tempo (o Tucano2 é
 * 15% menor e compilou 27% mais rápido) e o que o Mac mediu não vale para o telefone.
 */
export function quantoLevaCompilar(carimbo: CarimboDaCompilacao | undefined): string {
  return carimbo === undefined ? 'leva minutos' : `da última vez levou ${duracaoEmTexto(carimbo.ms)}`;
}

/* ── a ficha do modelo: onde ele escreve hoje ────────────────────────────── */

export interface EscreveHoje {
  readonly titulo: string;
  /** A contagem, quando ela acrescenta algo ao título. */
  readonly medida: string | null;
}

/**
 * Onde este modelo escreve agora: **o nome quando é uma leitura, a contagem quando é mais
 * de uma** (a redação que a espinha deixou proposta e esta fatia fixa).
 *
 * Com duas leituras, listar as duas na mesma linha a faria quebrar; com uma, a contagem
 * sozinha esconderia justamente o que o dono veio saber. Zero é uma resposta legítima e
 * frequente — é ela que torna o "apagar o compilado" uma decisão fácil.
 */
export function escreveHojeEmTexto(nomes: readonly string[], total: number): EscreveHoje {
  if (nomes.length === 0) return { titulo: 'Não escreve nenhuma leitura hoje', medida: null };
  if (nomes.length === 1) return { titulo: nomes[0]!, medida: `1 de ${total} leituras` };
  return { titulo: `${nomes.length} de ${total} leituras`, medida: null };
}

/* ── a ficha do modelo: apagar o compilado ───────────────────────────────── */

/**
 * Por que **Apagar o compilado** não é um botão nesta versão.
 *
 * O pacote tem `PreparedModel.clearCache(at:)`, e a investigação de 22/09 o viu falhar de
 * forma reprodutível, com o compilado preso por um lock remanescente. Um botão que não
 * cumpre é pior que um botão ausente — ainda mais este, que o dono só aperta quando o
 * telefone já está reclamando de espaço. A ação fica **declarada**, com o preço que ela
 * teria e a razão de não estar lá.
 */
export const APAGAR_INDISPONIVEL =
  'a porta do Core AI que apagaria o compilado falhou de forma reprodutível em 22/09, com o arquivo preso por um lock — enquanto ela não for provada, o app não oferece um botão que não cumpre';

/**
 * A nota do pé da ficha: o que apagar devolveria, o que custaria refazer, e qual leitura
 * escreve com ele.
 *
 * **O modelo veio dentro do app**: o arquivo instalado é parte do binário e não sai sem
 * desinstalar. Só o compilado se apaga, e prometer o total seria a tela mentindo sobre o
 * único número que ela existe para dizer.
 */
export function notaDeApagarOCompilado(p: {
  readonly ocupacao: OcupacaoDoModelo;
  readonly carimbo: CarimboDaCompilacao | undefined;
  readonly leituras: readonly string[];
}): string {
  const devolve =
    p.ocupacao.tipo === 'duas-partes'
      ? `Devolveria ${p.ocupacao.compilado} — o modelo continua no app, porque veio dentro dele.`
      : 'Devolveria o compilado — o modelo continua no app, porque veio dentro dele; quanto ele ocupa não foi medido.';
  const refazer = `Compilar de novo ${quantoLevaCompilar(p.carimbo)}.`;
  const escreve =
    p.leituras.length === 0
      ? ''
      : ` ${p.leituras.join(' e ')} ${p.leituras.length === 1 ? 'escreve' : 'escrevem'} com ele: troque antes, na linha da leitura.`;
  return `${devolve} ${refazer}${escreve} Hoje não dá: ${APAGAR_INDISPONIVEL}.`;
}

/* ── a ficha do modelo: a janela ─────────────────────────────────────────── */

/**
 * A janela do modelo, em tokens — `4.096 tokens`.
 *
 * Vem do **diagnóstico da ponte**, e de mais lugar nenhum: é a mesma linha que o modelo do
 * sistema devolve, e o dono a viu em tela para o peso aberto. `undefined` quando o
 * diagnóstico não atende ou não a traz, e aí a ficha **não tem essa linha** — em vez de um
 * número que ninguém mediu na única tela que existe para não autorar números.
 */
export function janelaDoModelo(ponte: EstadoDaPonte): string | undefined {
  if (ponte.tipo !== 'lido' || ponte.diagnostico.estado !== 'disponivel') return undefined;
  const j = ponte.diagnostico.janela;
  return j === undefined ? undefined : `${milhar(j)} tokens`;
}

/**
 * Quantos componentes a pasta traz, e quantos já estão compilados — `3 de 3 componentes`.
 *
 * O compilado do Tucano2 são **três arquivos**, não um (medido em 22/09). A linha só existe
 * quando a ponte devolveu os dois números; sem eles, o estado já diz o que precisa ser dito.
 */
export function componentesEmTexto(estado: EstadoDaCompilacao): string | undefined {
  if (estado.tipo !== 'lido') return undefined;
  const c = estado.compilacao;
  if (c.estado !== 'compilado' && c.estado !== 'nao-compilado') return undefined;
  if (c.componentes === undefined || c.compilados === undefined) return undefined;
  return `${c.compilados} de ${c.componentes} componentes compilados`;
}
