/**
 * O nome da rota, do aparelho (ADR 0041 · ADR 0042 · story 5.7).
 *
 * Todo o juízo mora no núcleo — forma, prompt, leitura, conferência, molde —, e
 * quem o percorre é o **orquestrador**, sobre os descritores do nome. Este arquivo
 * é hospedeiro: junta os fatos, resolve a cadeia com a preferência do dono, chama
 * `ler` e grava o que `metaDaLeitura` mandar gravar. Não monta pedido, não
 * interpreta, não confere e não escreve frase (AD-2).
 *
 * **Não conhece a function.** Até a 5.7 este era o segundo cliente da function de
 * narração no app, com o nome dela escrito aqui e a leitura de erro própria.
 * Agora o motor vem do ponto de injeção (`lib/motores/`), que é o único lugar do
 * app que a nomeia — e a guarda do `architecture.test.ts` virou barreira em zero
 * por causa desta story.
 *
 * ## Duas frentes, e toda atividade com GPS (23/09)
 *
 * Duas coisas mudaram por decisão do dono, e as duas são deste arquivo:
 *
 *  1. **Caiu o crivo de bicicleta.** O filtro é `hasRoute`, e mais nada de tipo:
 *     as 138 caminhadas e corridas com GPS se chamam literalmente "Walking" e
 *     "Running", e um nome repetido ainda é mais informação que nenhum. O portão
 *     que sobra é o da rota degenerada, que já existia e já roda **antes** de
 *     qualquer chamada. (`BIKE_ACTIVITY_ID` continua em `activity-sync.ts`, onde
 *     ele é do passe de **piso das rotas** — outra frente, outro crivo.)
 *  2. **O nome em português é uma segunda frente**, com recurso próprio, motor
 *     próprio e par de colunas próprio. A marca de "já tentei" é **por língua**:
 *     quem já tem o nome local e não tem o português paga só a segunda chamada, e
 *     uma marca só deixaria as 135 pedaladas já nomeadas sem legenda para sempre.
 *
 * **O gatilho continua sendo o mesmo**: uma vez por atividade e por frente, quando
 * o dono abre o detalhe, protegido pela marca gravada. Nunca há repetição daqui —
 * quem repete, recua e cai no piso é o orquestrador.
 */
import {
  descritorDoNomeDeRota,
  descritorDoNomeDeRotaPt,
  fetchHomeAnchors,
  ler as lerRecurso,
  metaDaLeitura,
  resolverCadeia,
  saveRouteName,
  saveRouteNamePt,
  type Activity,
  type Descritor,
  type FatosDoNome,
  type HomeAnchor,
  type Lingua,
  type NomePreenchido,
  type RecursoId,
  type RouteCity,
  type RouteFacts,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { catalogoDoRecurso, motorPara } from '../lib/motores';
import { anel } from '../lib/motores/anel';
import { lerPreferencia } from '../lib/motores/preferencia';

/* ── as duas frentes do nome ─────────────────────────────────────────────── */

/**
 * As duas frentes, na ordem em que rodam: **o nome local primeiro**.
 *
 * A ordem não é arbitrária — o nome local é o que manda, e o português é legenda
 * (decisão 2 do plano). Numa atividade que precisa dos dois, o que aparece na tela
 * depois do primeiro `load()` é o título, não a legenda.
 */
export const FRENTES_DO_NOME = ['nome-de-rota', 'nome-de-rota-pt'] as const satisfies readonly RecursoId[];

export type FrenteDoNome = (typeof FRENTES_DO_NOME)[number];

/**
 * O que cada frente sabe de si: o descritor, a língua que ela carimba na meta, o
 * nome que ela já escreveu, a marca de que já tentou, e onde ela grava.
 *
 * **Uma tabela, e não dois caminhos paralelos.** O gatilho, a leitura e a gravação
 * são o mesmo código nas duas frentes; o que difere é qual par de colunas responde.
 * Escrever o segundo caminho à mão faria a próxima regra — um recuo novo, um
 * motivo de recusa novo — valer para uma língua e não para a outra, e o sintoma
 * seria "o português não grava", longe da causa.
 */
interface Frente {
  readonly descritor: Descritor<FatosDoNome, NomePreenchido>;
  /**
   * A língua que a meta desta frente registra, quando ela não é a do país
   * dominante. `undefined` é o nome local, onde `metaDaLeitura` a deriva.
   */
  readonly lingua?: Lingua;
  /** O nome que esta frente escreve, se já houver um. */
  nome(a: Activity): string | undefined;
  /** A marca gravada de "esta frente já passou por aqui". */
  tentou(a: Activity): boolean;
  /**
   * A gravação daquele par de colunas — dono único da tabela no núcleo (AD-4).
   *
   * **Não se chama `gravar`**: esse nome é da porta de gravação da revista, e o
   * `architecture.test.ts` barra `.gravar` lido fora da sequência da impressão —
   * um homônimo aqui derruba o portão do shared sem nada da revista ter sido tocado.
   */
  readonly gravarColunas: typeof saveRouteName;
}

const FRENTE: Readonly<Record<FrenteDoNome, Frente>> = {
  'nome-de-rota': {
    descritor: descritorDoNomeDeRota,
    nome: (a) => a.routeName,
    tentou: (a) => a.routeNameChecked === true,
    gravarColunas: saveRouteName,
  },
  'nome-de-rota-pt': {
    descritor: descritorDoNomeDeRotaPt,
    lingua: 'pt',
    nome: (a) => a.routeNamePt,
    tentou: (a) => a.routeNamePtChecked === true,
    gravarColunas: saveRouteNamePt,
  },
};

/**
 * A chave da tabela e o recurso do descritor são **o mesmo nome**, escrito duas
 * vezes — e o tipo não os amarra.
 *
 * Trocar os dois descritores de lugar gravaria a legenda em português na coluna do
 * nome local, com a meta dizendo `fr`, e `tsc` ficaria limpo. Morre no carregamento
 * do módulo, antes de qualquer tela. (Molde do invariante de `PESOS_ABERTOS`, em
 * `lib/motores/catalogo.ts`.)
 */
for (const frente of FRENTES_DO_NOME) {
  if (FRENTE[frente].descritor.recurso !== frente) {
    throw new Error(
      `a frente ${frente} aponta para o descritor de ${FRENTE[frente].descritor.recurso} — ` +
        'o nome sairia numa língua e seria gravado na coluna da outra',
    );
  }
}

/**
 * Esta frente precisa rodar nesta atividade? Puro, e a razão de o gatilho poder
 * ser burro.
 *
 * **Recebe a frente por parâmetro, em vez de haver duas funções**, porque a
 * pergunta é a mesma nas duas — já tem nome, já tentou, tem rota — e só as colunas
 * mudam. Duas funções divergiriam no dia em que o crivo ganhasse uma condição, e o
 * sintoma seria uma das línguas nunca ser tentada.
 */
export function precisaDeNome(a: Activity, frente: FrenteDoNome): boolean {
  // Sem traçado não há forma a derivar, e é o único crivo de escopo que restou:
  // toda atividade com GPS entra, não só a pedalada (decisão 4 do plano).
  if (!a.hasRoute) return false;
  const f = FRENTE[frente];
  return !f.nome(a) && !f.tentou(a);
}

/** As frentes que faltam nesta atividade, na ordem em que vão rodar. */
export function frentesQueFaltam(a: Activity): readonly FrenteDoNome[] {
  return FRENTES_DO_NOME.filter((frente) => precisaDeNome(a, frente));
}

/** Alguma frente precisa rodar? O que a tela pergunta antes de disparar o efeito. */
export function precisaDeAlgumNome(a: Activity): boolean {
  return frentesQueFaltam(a).length > 0;
}

/**
 * As casas mudam de ano em ano, não de minuto em minuto — e a mesma abertura de
 * tela pode nomear mais de uma rota, e mais de uma frente da mesma rota. Guardar
 * por sessão poupa uma consulta por frente sem risco de servir dado velho: quem
 * escreve `places` é o passe de manutenção, não o app.
 */
let ancorasEmCache: HomeAnchor[] | null = null;

export function limparCacheDeAncoras(): void {
  ancorasEmCache = null;
}

async function ancoras(userId: string): Promise<HomeAnchor[]> {
  if (!ancorasEmCache) ancorasEmCache = await fetchHomeAnchors(supabase, userId);
  return ancorasEmCache;
}

export interface PontaDaRota {
  lat: number;
  lng: number;
}

/** O que este caminho precisa do mundo. Injetável para o teste não abrir rede. */
export interface DepsDoNome {
  readonly motorPara: typeof motorPara;
  readonly registrar: typeof anel.registrar;
  readonly agora: () => Date;
  /**
   * A escolha do dono **para aquela frente**, ou `null`.
   *
   * Recebe o recurso porque é aí que a decisão do dono vive: o nome local e a
   * legenda em português podem ser escritos por motores diferentes, e ler uma
   * escolha só faria a segunda frente herdar calada a preferência da primeira.
   *
   * **Rejeição aqui aborta a frente desta vez** — ver o corpo. Não há
   * `.catch(() => null)`: para o recurso que grava, "não consegui ler a escolha"
   * não pode virar "não há escolha".
   */
  readonly lerPreferencia: (recurso: FrenteDoNome) => Promise<string | null>;
  /**
   * Os ids que o hospedeiro conhece para aquela frente — disponíveis ou não.
   * Rejeição aborta a frente, pela mesma razão da preferência: o catálogo estático
   * descartaria calado as variantes que só a lista do servidor conhece, e a escolha
   * do dono viraria o padrão — gravado.
   */
  readonly catalogo: (recurso: FrenteDoNome) => Promise<readonly string[]>;
  readonly salvar: (
    frente: FrenteDoNome,
    id: string,
    nome: string | null,
    meta: unknown,
  ) => Promise<void>;
}

function depsDoApp(userId: string): DepsDoNome {
  return {
    motorPara,
    registrar: anel.registrar,
    agora: () => new Date(),
    lerPreferencia: (recurso) => lerPreferencia(recurso),
    catalogo: (recurso) => catalogoDoRecurso(recurso),
    salvar: (frente, id, nome, meta) => FRENTE[frente].gravarColunas(supabase, userId, id, nome, meta),
  };
}

/**
 * Os fatos do nome desta atividade — a rota mais as casas do dono —, ou `null`
 * quando o traçado não tem as duas pontas.
 *
 * **Extraída no spike de 22/09** porque a bancada dos motores precisa da mesma
 * entrada para medir o recurso, e uma segunda montagem lá seria uma segunda
 * definição de "os fatos desta atividade": bastaria uma das duas esquecer a
 * elevação, ou o `?? 0` da distância, para a bancada medir um pedido que a
 * produção não manda — e é o pedido que o hash identifica (AD-11).
 *
 * **As duas frentes dividem os mesmos fatos**, e é o que garante que a legenda em
 * português fale da mesma rota que o nome local: a língua entra depois, na leitura
 * derivada do descritor, e nunca nos fatos.
 *
 * Sem as pontas não há forma a derivar, e sem forma não há molde: devolver `null`
 * deixa a rota pendente para quando o traçado já estiver carregado.
 *
 * **Pode rejeitar**: a consulta das âncoras abre rede. Quem chama trata — o
 * gatilho engole e tenta de novo na próxima abertura.
 */
export async function fatosDaRota(
  activity: Activity,
  pontos: readonly PontaDaRota[] | undefined,
  userId: string,
): Promise<FatosDoNome | null> {
  const primeiro = pontos?.[0];
  const ultimo = pontos?.[pontos.length - 1];
  if (!primeiro || !ultimo) return null;

  const rota: RouteFacts = {
    startAt: activity.startAt,
    distanceM: activity.distanceM ?? 0,
    elevationM: activity.elevationM ?? 0,
    lat0: primeiro.lat,
    lng0: primeiro.lng,
    lat1: ultimo.lat,
    lng1: ultimo.lng,
    cities: (activity.cities ?? []) as readonly RouteCity[],
  };
  return { rota, ancoras: await ancoras(userId) };
}

/** Os nomes que saíram nesta passagem, por frente. Frente ausente = não houve nome. */
export type NomesDaRota = Partial<Record<FrenteDoNome, string>>;

/**
 * Nomeia uma atividade nas frentes que lhe faltam. Devolve os nomes que saíram — e
 * o objeto vazio **não é falha**.
 *
 * **Uma leitura por frente, em sequência.** Sequencial e não em paralelo por duas
 * razões: os motores do aparelho dividem a mesma vez (`FilaDoAparelho`), então
 * duas chamadas juntas só fariam uma esperar a outra dentro do transporte; e
 * `fatosDaRota` consulta as âncoras, que a primeira frente aquece para a segunda.
 *
 * **Cada frente com a sua própria preferência**, que é o ponto central da decisão
 * do dono: o nome local pode sair da nuvem e a legenda em português de um peso
 * aberto treinado a mais em português, ou o contrário. A resolução da cadeia é por
 * recurso, e não há uma escolha comum a resolver.
 *
 * **Engole erro de rede de propósito, e frente a frente.** A falha transitória não
 * produz meta (`metaDaLeitura` devolve `null`), a atividade fica sem aquela coluna
 * de meta e entra de novo na próxima abertura, exatamente como a varredura de
 * fotos faz quando o iOS nega a biblioteca em segundo plano. O `catch` de dentro
 * cobre o que ainda pode lançar naquela frente — **a preferência e o catálogo**, a
 * gravação, e o bug de código puro que o orquestrador não engole — e é **de
 * dentro** para que a falha de uma língua não cancele a outra: elas são
 * independentes por construção, e uma cota estourada na nuvem não é razão para o
 * modelo do aparelho não escrever a legenda.
 */
export async function nomearRotaSePreciso(
  activity: Activity,
  pontos: readonly PontaDaRota[] | undefined,
  userId: string,
  deps: DepsDoNome = depsDoApp(userId),
): Promise<NomesDaRota> {
  const faltando = frentesQueFaltam(activity);
  if (faltando.length === 0) return {};

  let fatos: FatosDoNome | null;
  try {
    // Sem as pontas do traçado não há fatos, e a rota fica pendente para quando
    // ele estiver carregado. No `try` porque a montagem consulta as âncoras, e
    // rejeição ali termina como toda falha daqui: nada gravado. Fora do laço
    // porque as âncoras são comuns às duas frentes — se elas não vêm, nenhuma roda.
    fatos = await fatosDaRota(activity, pontos, userId);
  } catch {
    return {};
  }
  if (fatos === null) return {};

  const saiu: NomesDaRota = {};
  for (const frente of faltando) {
    const nome = await nomearUmaFrente(frente, activity, fatos, deps);
    if (nome !== null) saiu[frente] = nome;
  }
  return saiu;
}

/**
 * Uma frente: resolve a cadeia com a preferência dela, lê, e grava o que
 * `metaDaLeitura` mandar. `null` quando não houve nome — e `null` aqui não é falha.
 */
async function nomearUmaFrente(
  frente: FrenteDoNome,
  activity: Activity,
  fatos: FatosDoNome,
  deps: DepsDoNome,
): Promise<string | null> {
  const { descritor, lingua } = FRENTE[frente];
  try {
    /*
     * A preferência (do disco) e o catálogo (do disco mais o servidor) em
     * paralelo: são independentes. E **sem recuo**, que é a diferença entre este
     * caminho e o da leitura da Saúde (`lib/leitura-da-saude.ts`).
     *
     * Lá, cair no `null` e no catálogo estático custa uma frase efêmera, e a
     * alternativa — a tela pendurada em "escrevendo" — é pior. Aqui o resultado é
     * **gravado** e não se reprocessa: `lerPreferencia().catch(() => null)` faria
     * uma rota ir à nuvem com `sem-modelo` ou `aparelho:sistema` escolhidos, e
     * `catalogo().catch(() => idsConhecidos)` descartaria calada a variante
     * aprovada e nomearia com outro modelo. Nos dois casos o dono só descobriria
     * lendo a meta.
     *
     * Então a exceção sobe para o `catch` de fora: nada gravado, e a atividade
     * volta ao gatilho **naquela frente** na próxima abertura — que é o mesmo
     * desfecho de uma falha transitória, e o mais barato que existe aqui.
     */
    const [preferencia, catalogo] = await Promise.all([
      deps.lerPreferencia(frente),
      deps.catalogo(frente),
    ]);
    const leitura = await lerRecurso(descritor, fatos, {
      modo: 'produto',
      cadeia: resolverCadeia(descritor, preferencia, catalogo),
      motorPara: deps.motorPara,
      registrar: deps.registrar,
      agora: deps.agora,
    });

    // Só causa permanente grava. Transitória devolve `null`, nada é escrito, e a
    // atividade volta ao gatilho na próxima abertura.
    const escrita = metaDaLeitura(leitura, fatos, deps.agora(), lingua);
    if (!escrita) return null;
    await deps.salvar(frente, activity.id, escrita.nome, escrita.meta);
    return escrita.nome;
  } catch {
    return null;
  }
}
