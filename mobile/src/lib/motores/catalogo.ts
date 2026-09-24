/**
 * Os motores que **este app conhece** — disponíveis ou não (AD-8, ADR 0048).
 *
 * Conhecer não é ter. A distinção não é burocracia: `resolverCadeia` recebe os
 * ids *conhecidos* justamente para que um motor indisponível continue na cadeia e
 * entre na trilha como tentativa sintética — é assim que a tela consegue dizer
 * **por que** o escolhido não escreveu, em vez de cair no template em silêncio.
 *
 * Por isso o catálogo lista o `aparelho:sistema` sempre, disponível ou não, e com o
 * motivo escrito quando não. Desde a 5.9 a disponibilidade dele é **a do
 * diagnóstico da ponte** — se o modelo do sistema atende, qual variante e que
 * janela, ou por quê não —, que `./index.ts` lê uma vez por sessão e passa para cá
 * como {@link EstadoDaPonte}. Sem o módulo nativo (um build anterior à 5.9, o jest), o
 * aparelho continua listado, apagado, dizendo que a ponte não está neste build; fora
 * do iOS, dizendo que ele só existe no iPhone. Um catálogo que o omitisse faria o
 * seletor mentir por omissão. (O simulador **tem** o módulo quando é build desta
 * branch — o autolinking é o mesmo —, e o diagnóstico diz o que o simulador disser.)
 *
 * Puro, sem rede e sem armazenamento: quem injeta motor e lê a ponte é `./index.ts`,
 * e quem guarda a escolha é `./preferencia.ts`.
 */
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  admiteTipo,
  ehMotivoDoAparelho,
  exposicao,
  formatarMotorId,
  lerMotorId,
  type CompilacaoNoAparelho,
  type Descritor,
  type DiagnosticoDoAparelho,
  type MotivoDoAparelho,
  type MotorDeNuvemAprovado,
  type MotorId,
  type RecursoId,
  type TipoDeMotor,
} from '@vitale/shared';

export interface MotorConhecido {
  readonly id: MotorId;
  /**
   * O sujeito da assinatura, **com artigo**: "a nuvem está escrevendo…". O
   * artigo vem junto porque é dele que `assinatura.ts` tira as contrações ("pela
   * nuvem", "da nuvem") — um nome sem artigo obrigaria a declarar três formas
   * por motor, e três formas divergem.
   */
  readonly nome: string;
  /** O rótulo da linha do seletor. */
  readonly rotulo: string;
  /** Uma linha dizendo o que esse motor é, no seletor. */
  readonly descricao: string;
  readonly disponivel: boolean;
  /** Por que não dá, **em palavras**. Obrigatório quando `disponivel` é falso. */
  readonly motivo?: string;
  /**
   * Uma linha simples que diz **qual** motor é, quando há o que dizer. Hoje só o
   * aparelho a tem, vinda do diagnóstico: `AFM 3 Core Advanced · janela de 8.192
   * tokens` — é a resposta a "que modelo eu tenho".
   */
  readonly detalhe?: string;
  /**
   * O estado ainda está sendo perguntado (o diagnóstico da ponte a caminho). Não é
   * "indisponível": a tela o anuncia como ocupado, não como um motor que não existe.
   */
  readonly consultando?: true;
  /**
   * Este motor é **prova de caminho**, não candidato (story 5.8).
   *
   * A bancada mede todos os motores em cada corrida, e o peso aberto é o mais lento e o mais
   * pesado dos quatro: ele sobe 244 MiB do disco a cada chamada. Medi-lo sempre transformaria
   * cada corrida — que existe para comparar a nuvem com o modelo do sistema — numa espera por
   * um motor que ninguém vai escolher. Então o laço o pula, e quem quiser medi-lo liga.
   *
   * Não muda nada no seletor: lá ele continua listado e escolhível na Saúde do sono.
   */
  readonly prova?: true;
}

/**
 * O motivo do aparelho num build sem a ponte — o módulo nativo `OnDeviceEngine` não
 * está no binário (um build anterior à 5.9, o jest).
 */
export const MOTIVO_SEM_PONTE = 'a ponte para o modelo do sistema não está neste build';

/**
 * O **peso aberto** que este build embarca (story 5.8).
 *
 * `aparelho:<provedor>/<pesos>` — a gramática de `ia/fio.ts`, que já cabia sem mudança
 * nenhuma no núcleo. O provedor é `coreai` (quem carrega os pesos), e o nome é o da pasta
 * que o podspec põe no bundle (`pesos/smollm2-135m/`).
 *
 * **Ele existe para provar o caminho, não para ser usado.** O SmolLM2-135M é o menor modelo
 * com preset de iOS, e é ruim: medido em 21/09 no Mac, ele responde *"Diga olá em
 * português"* com *"Diga olá em portuguéus"*. Fica no seletor, fora de toda cadeia padrão, e
 * o peso sai do binário na story seguinte — que o baixa sob demanda.
 */
/**
 * Um peso aberto que este build embarca (spike 22/09 — o build passou a carregar **vários**).
 *
 * O `pesos` é o nome da pasta que o podspec põe no bundle (`pesos/<pesos>/`) e o que viaja
 * até a ponte nativa **por argumento**, nunca dentro do pedido: `CHAVES_DO_PEDIDO`
 * (`ia/aparelho.ts`) é exaustiva sobre `keyof Pedido`, e um campo a mais ali mudaria o hash
 * do pedido (AD-11) por uma razão que não é o pedido.
 */
export interface PesoAberto {
  /** `aparelho:coreai/<pesos>` — a gramática de `ia/fio.ts`, sem mudança no núcleo. */
  readonly id: MotorId;
  /** A pasta dos pesos, e o argumento da ponte. */
  readonly pesos: string;
  readonly nome: string;
  /**
   * O nome próprio do modelo — `Qwen3 1.7B`, e não `Peso aberto (Qwen3 1.7B)`.
   *
   * O prefixo era necessário enquanto o modelo não tinha página: ele era a única coisa
   * que dizia o que aquela linha era. Com a ficha (`modelo/[id]`), "peso aberto" virou um
   * selo de identidade lá dentro, e repeti-lo em cada linha de cada folha é ruído — a
   * folha já agrupa por **onde roda**, que é a mesma informação dita uma vez por grupo.
   */
  readonly rotulo: string;
  readonly descricao: string;
  /**
   * O que ele ocupa no telefone, em GB — **medido à mão em 22/09**, no iPhone 17 Pro, e
   * por isso opcional: um modelo novo entra em {@link PESOS_ABERTOS} sem número, e a ficha
   * diz *tamanho não medido* em vez de somar o que ninguém mediu.
   *
   * São dois números porque o modelo ocupa o aparelho **duas vezes**: o arquivo que veio
   * no binário, e a especialização para o chip que a compilação produz. Só o segundo se
   * apaga — o primeiro sai junto com o app.
   */
  readonly tamanho?: {
    /** O arquivo instalado (veio dentro do app). */
    readonly instaladoGB: number;
    /** O que a compilação para o chip acrescenta. */
    readonly compiladoGB?: number;
  };
}

/**
 * Os pesos abertos deste build, na ordem em que o seletor os mostra.
 *
 * **Uma lista, não uma constante** (spike 22/09): o iPhone já provou dois modelos — o
 * Qwen3-1.7B e o Tucano2 —, e a escolha entre eles só existe se os dois estiverem no mesmo
 * build, medidos na mesma janela. O lado Swift sempre foi multi-modelo (`responderComPesos`
 * recebe quais pesos); o que era único morava só aqui.
 */
export const PESOS_ABERTOS: readonly PesoAberto[] = Object.freeze([
  Object.freeze({
    id: 'aparelho:coreai/qwen3-1.7b' satisfies MotorId,
    pesos: 'qwen3-1.7b',
    nome: 'o Qwen3 1.7B no aparelho',
    rotulo: 'Qwen3 1.7B',
    descricao: 'Modelo aberto dentro do app, pelo Core AI, com o raciocínio longo desligado. Nada sai do aparelho.',
    tamanho: { instaladoGB: 1.3, compiladoGB: 1.34 },
  }),
  Object.freeze({
    id: 'aparelho:coreai/tucano2-1.5b' satisfies MotorId,
    pesos: 'tucano2-1.5b',
    nome: 'o Tucano2 1.5B no aparelho',
    rotulo: 'Tucano2 1.5B',
    descricao: 'Modelo aberto treinado a mais em português, dentro do app. Nada sai do aparelho.',
    tamanho: { instaladoGB: 1.1, compiladoGB: 1.14 },
  }),
  /*
   * **A segunda tentativa do 4B** (24/09). A primeira, em 22/09, compilou por ~29 min no
   * aparelho e morreu na carga — `TRIM_MEMORY_RUNNING_CRITICAL` e `signal 9`, três vezes
   * seguidas, com o entitlement e com o cache pronto. Jetsam, não o assert do ANE do Mac.
   *
   * Este export muda duas coisas, e só elas, para que a causa fique legível:
   *  - **int4 puro** no lugar do misto 4/8 — 2,1 GB contra 2,3. A economia é pequena porque
   *    a receita mista já era quase toda 4 bits (ela subia cinco camadas para 8);
   *  - **janela 2.048** no lugar de 4.096. A primeira tentativa desta segunda rodada usou
   *    1.024 e falhou por motivo novo: o pedido da Retrospectiva tem **1.628 tokens** e o do
   *    nome de rota **1.128**, então os dois eram cortados e o modelo devolvia
   *    `saida-invalida`. Eu tinha dimensionado a janela olhando só para a Saúde do sono, que
   *    usa 617. A segunda tentativa usou 3.072 e falhou de novo, por um motivo que só o
   *    aparelho contou: `InferenceRuntimeError.invalidState("Failed to find an extend
   *    function with the max context length of 3072")`. O exportador gera uma **escada de
   *    potências de dois** — 256, 512, 1.024, 2.048, 4.096 — e 3.072 não está nela, então
   *    o `.aimodel` parou em `extend_2048` e o runtime procurou uma função que não existe.
   *    Daí **2.048**, conferido na escada antes de gastar a compilação: cabe a maior leitura
   *    (1.628 + 187 = 1.815) e o cache KV (144 KB/token) custa 0,29 GB — menos que os 0,44
   *    de 3.072 e que os 0,60 da configuração que morreu.
   *
   * A terceira alavanca — compilar AOT no Mac com `--architecture h18p`, que tiraria a
   * especialização do aparelho — **não entra neste build**: ela exige o Metal Toolchain do
   * Xcode, que não está instalado. Se este build carregar, ela nem é necessária; se morrer,
   * ela passa a ser o próximo passo, e o dono instala sabendo por quê.
   *
   * `tamanho` traz só o instalado: o compilado deste ninguém mediu ainda.
   */
  Object.freeze({
    id: 'aparelho:coreai/qwen3-4b' satisfies MotorId,
    pesos: 'qwen3-4b',
    nome: 'o Qwen3 4B no aparelho',
    rotulo: 'Qwen3 4B',
    descricao: 'O maior modelo aberto do build, em 4 bits, com janela para as três leituras. Nada sai do aparelho.',
    tamanho: { instaladoGB: 2.1, compiladoGB: 2.06 },
  }),
]);

/** O peso aberto com este id, ou `undefined` — a pergunta que o catálogo faz o tempo todo. */
export function pesoAbertoDe(id: MotorId | string | null | undefined): PesoAberto | undefined {
  if (id === null || id === undefined) return undefined;
  return PESOS_ABERTOS.find((p) => p.id === id);
}

/**
 * O peso aberto por **nome de pasta**, ou `undefined` — o que a ficha `modelo/[id]`
 * recebe da rota.
 *
 * O `MotorId` não serve de parâmetro de rota: ele carrega `:` e `/`, que o caminho da URL
 * come. A pasta é o nome próprio do modelo neste build (`qwen3-1.7b`) e o invariante logo
 * abaixo garante que ela e o id dizem a mesma coisa — então resolver por ela é resolver
 * pelo id, sem escapar nada.
 *
 * `undefined` é o caso **normal**, não o exótico: o dono chega por um estado restaurado
 * pelo Expo Router depois de o iOS encerrar o app, ou por um build antigo que embarcava um
 * peso que o novo não embarca.
 */
export function pesoAbertoDaPasta(pasta: string | null | undefined): PesoAberto | undefined {
  if (pasta === null || pasta === undefined) return undefined;
  return PESOS_ABERTOS.find((p) => p.pesos === pasta);
}

/**
 * Para onde a **ficha do modelo** manda comparar: a leitura com régua.
 *
 * Só a Saúde do sono tem template, e é o template que serve de régua — por isso é a única
 * leitura em que a bancada julga sozinha, sem o dono ler cada frase. Nas outras duas a
 * bancada mede e mostra; quem aprova é ele.
 *
 * Isto **não** é mais um limite de escolha: até 23/09 esta constante também era o único
 * recurso em que o peso aberto podia ser escolhido, e essa trava caiu (ADR 0056).
 *
 * Fechado sobre `RecursoId`: se a Saúde do sono mudar de nome, isto não compila.
 */
export const RECURSO_MEDIDO_DO_PESO_ABERTO = 'saude-do-sono' satisfies RecursoId;

/**
 * O id e a pasta são **o mesmo nome**, escrito duas vezes em cada entrada — e nada os amarra.
 *
 * Divergir deixa o motor listado e **sempre** `semPesos`, num build que carrega os pesos: o
 * seletor pede o diagnóstico de um nome e o transporte manda outro, e tudo fica verde. Com uma
 * lista entra a segunda armadilha — **dois modelos com o mesmo nome de pasta** —, que faria o
 * seletor mostrar duas linhas para os mesmos pesos. As duas morrem no carregamento do módulo,
 * antes de qualquer tela.
 */
{
  const vistos = new Set<string>();
  for (const p of PESOS_ABERTOS) {
    if (p.id !== `aparelho:coreai/${p.pesos}`) {
      throw new Error(
        `o id do peso aberto (${p.id}) e o nome dos pesos (${p.pesos}) divergiram — ` +
          'o seletor pediria o diagnóstico de um e o transporte mandaria o outro',
      );
    }
    if (vistos.has(p.pesos)) {
      throw new Error(`dois pesos abertos declaram a mesma pasta (${p.pesos})`);
    }
    vistos.add(p.pesos);
  }
}

/**
 * Os motivos que o motor de peso aberto diz, **em palavras**.
 *
 * As chaves são os literais que o `MotorCoreAI.swift` devolve em `motivos()`, e a barreira do
 * vocabulário no `architecture.test.ts` exige a igualdade de conjunto: um motivo novo de um
 * lado só viraria {@link MOTIVO_DESCONHECIDO} na tela do dono, calado.
 *
 * Eles moram **aqui**, e não no núcleo, de propósito: o núcleo não sabe que peso aberto
 * existe — para ele `aparelho:coreai/smollm2-135m` é só um id que a gramática lê. Quem sabe
 * o que o app embarcou é o app.
 */
export const MOTIVO_DO_COREAI_EM_PALAVRAS: Readonly<Record<string, string>> = {
  semBiblioteca: 'a biblioteca do Core AI não foi montada neste build',
  simulador: 'o modelo de peso aberto só roda no iPhone — o simulador não tem o Core AI',
  semPesos: 'este build não traz os pesos deste modelo',
  pesosIlegiveis: 'a pasta dos pesos veio neste build e não se lê',
  // O único motivo que nasce de um ato do dono (a tela de compilação, fatia 2), e o único que
  // nenhum diagnóstico devolve. A frase não nomeia causa porque a causa vem do sistema, em
  // prosa, no `detalhe` — e a tela a mostra inteira, sob "o que o sistema disse".
  naoCompilou: 'a compilação não terminou: o sistema recusou os pesos ao carregá-los',
};

/**
 * O motivo do peso aberto num build sem a ponte nativa.
 *
 * Diz **"o peso aberto"**, e não "o modelo do aparelho": este último é o guarda-chuva dos
 * dois motores que rodam no telefone, e usá-lo aqui deixaria as duas linhas do seletor
 * separadas por uma palavra — a de cima falando do modelo do sistema, a de baixo falando de
 * "o modelo do aparelho", que é ela **e** a de cima.
 */
export const MOTIVO_COREAI_SEM_PONTE = 'a ponte para o peso aberto não está neste build';
/** O peso aberto fora do iOS: não é falta de build, é plataforma. */
export const MOTIVO_COREAI_FORA_DO_IOS = 'o peso aberto só existe no iPhone';
/**
 * Um motivo que a ponte disse e esta versão do app não conhece — **no peso aberto**.
 *
 * Separado de {@link MOTIVO_DESCONHECIDO}, que fala do modelo do sistema: mostrar aquele na
 * linha do peso aberto anunciaria a indisponibilidade do motor errado.
 */
export const MOTIVO_COREAI_DESCONHECIDO =
  'o peso aberto está indisponível por um motivo que esta versão não conhece';

/**
 * A lista, na ordem em que o seletor a mostra: do que não sai do código ao que
 * sai do aparelho.
 *
 * O aparelho aqui é o de **um build sem a ponte**. O estado de verdade dele entra
 * por {@link motoresDoRecurso}, com o diagnóstico: esta lista é a identidade (ids,
 * nomes, rótulos) e o ponto de partida, não a disponibilidade do aparelho.
 */
export const MOTORES_CONHECIDOS: readonly MotorConhecido[] = [
  {
    id: SEM_MODELO,
    nome: 'o template',
    rotulo: 'Sem modelo',
    descricao: 'A frase que o código escreve. Instantânea, sempre igual, e nada sai do aparelho.',
    disponivel: true,
  },
  {
    id: APARELHO_SISTEMA,
    nome: 'o modelo do aparelho',
    rotulo: 'Modelo do aparelho',
    descricao: 'O modelo que o próprio sistema do iPhone fornece. Nada sai do aparelho.',
    disponivel: false,
    motivo: MOTIVO_SEM_PONTE,
  },
  ...PESOS_ABERTOS.map(
    (p): MotorConhecido => ({
      id: p.id,
      nome: p.nome,
      rotulo: p.rotulo,
      descricao: p.descricao,
      disponivel: false,
      motivo: MOTIVO_COREAI_SEM_PONTE,
      prova: true,
    }),
  ),
  {
    id: NUVEM_PADRAO,
    nome: 'a nuvem',
    rotulo: 'Nuvem',
    descricao: 'O modelo que o servidor escolhe. O caso da leitura sai do aparelho para ser redigido.',
    disponivel: true,
  },
];

/**
 * Os ids que o app conhece **sem a lista do servidor** — é esta lista que vai ao
 * `catalogo` de `resolverCadeia` quando a lista nunca foi lida. Conhecidos, não
 * disponíveis (ver o cabeçalho). Para o catálogo já fundido por recurso, use
 * {@link idsConhecidosDe}.
 */
export const idsConhecidos: readonly MotorId[] = MOTORES_CONHECIDOS.map((m) => m.id);

/* ── a ponte do aparelho (story 5.9) ─────────────────────────────────────── */

/**
 * O que o app sabe da ponte do aparelho. Quem o lê é `./index.ts` — o único lugar
 * que carrega o módulo nativo —, **uma vez por sessão**; aqui ele só entra por
 * parâmetro.
 */
export type EstadoDaPonte =
  /** O módulo nativo não está neste build. */
  | { readonly tipo: 'ausente' }
  /**
   * Não é iOS: o modelo do sistema só existe no iPhone, e o módulo é só `apple`
   * (`expo-module.config.json`). Motivo próprio, porque "a ponte não está neste
   * build" seria falso — lá ela nunca vai estar.
   */
  | { readonly tipo: 'fora-do-ios' }
  /** O módulo está, e o diagnóstico ainda não voltou. */
  | { readonly tipo: 'consultando' }
  /**
   * O diagnóstico voltou — legível ou não —, com a linha **crua** que a ponte
   * escreveu, quando houve uma (a tela de desenvolvimento a mostra).
   */
  | { readonly tipo: 'lido'; readonly diagnostico: DiagnosticoDoAparelho; readonly cru?: string };

export const PONTE_AUSENTE: EstadoDaPonte = { tipo: 'ausente' };
export const PONTE_FORA_DO_IOS: EstadoDaPonte = { tipo: 'fora-do-ios' };
export const PONTE_CONSULTANDO: EstadoDaPonte = { tipo: 'consultando' };

/**
 * Os motivos que a ponte conhece, em palavras. **Exaustivo sobre
 * `MOTIVOS_DO_APARELHO`** (o núcleo), que a guarda do contrato amarra aos literais
 * que o `Engine.swift` devolve: um motivo novo na lista não compila aqui até ganhar
 * palavras. É aqui, e não no núcleo, que o nome da Apple Intelligence aparece: é
 * texto de tela.
 */
export const MOTIVO_EM_PALAVRAS: Readonly<Record<MotivoDoAparelho, string>> = {
  deviceNotEligible: 'este aparelho não é elegível ao modelo do sistema',
  appleIntelligenceNotEnabled: 'a Apple Intelligence está desligada nos Ajustes',
  modelNotReady: 'o modelo do sistema ainda não está pronto — ele pode estar sendo baixado',
  sistemaAntigo: 'o modelo do sistema pede iOS 26 ou mais novo',
};

/** O aparelho fora do iOS: não é falta de build, é plataforma. */
export const MOTIVO_FORA_DO_IOS = 'o modelo do aparelho só existe no iPhone';

/** Um motivo que a ponte disse e esta versão do app não conhece. */
export const MOTIVO_DESCONHECIDO = 'o modelo do sistema está indisponível por um motivo que esta versão não conhece';
/** O diagnóstico voltou fora do contrato, ou não voltou (matriz da 5.9). */
export const MOTIVO_ILEGIVEL = 'o aparelho não respondeu como esperado';
/** O diagnóstico ainda está a caminho: apagado por um instante, sem inventar motivo. */
export const MOTIVO_CONSULTANDO = 'consultando o modelo do aparelho…';

/** Por que o aparelho não atende, em palavras — ou `null`, se atende. */
export function motivoDoAparelho(ponte: EstadoDaPonte): string | null {
  switch (ponte.tipo) {
    case 'ausente':
      return MOTIVO_SEM_PONTE;
    case 'fora-do-ios':
      return MOTIVO_FORA_DO_IOS;
    case 'consultando':
      return MOTIVO_CONSULTANDO;
    case 'lido': {
      const d = ponte.diagnostico;
      if (d.estado === 'disponivel') return null;
      if (d.estado === 'ilegivel') return MOTIVO_ILEGIVEL;
      return ehMotivoDoAparelho(d.motivo) ? MOTIVO_EM_PALAVRAS[d.motivo] : MOTIVO_DESCONHECIDO;
    }
  }
}

/**
 * Por que o peso aberto não atende, em palavras — ou `null`, se atende (story 5.8).
 *
 * O gêmeo de {@link motivoDoAparelho}, e separado dele porque o **vocabulário é outro**: o
 * modelo do sistema fala de elegibilidade e de Apple Intelligence; o peso aberto fala de
 * biblioteca, de simulador e da pasta que veio (ou não) no binário. O estado é o mesmo tipo
 * ({@link EstadoDaPonte}) porque a linha do diagnóstico é a mesma — quem a lê é o mesmo
 * `lerDiagnosticoDoAparelho` do núcleo.
 */
export function motivoDoCoreAI(ponte: EstadoDaPonte): string | null {
  switch (ponte.tipo) {
    case 'ausente':
      return MOTIVO_COREAI_SEM_PONTE;
    case 'fora-do-ios':
      return MOTIVO_COREAI_FORA_DO_IOS;
    case 'consultando':
      return MOTIVO_CONSULTANDO;
    case 'lido': {
      const d = ponte.diagnostico;
      if (d.estado === 'disponivel') return null;
      if (d.estado === 'ilegivel') return MOTIVO_ILEGIVEL;
      return palavrasDoMotivoDoCoreAI(d.motivo);
    }
  }
}

/**
 * Um motivo do Core AI, como a ponte o escreveu → as palavras da tela.
 *
 * **Chave própria, e o resultado tem de ser texto.** O motivo vem da ponte, que o lê de uma
 * linha JSON: um motivo chamado `constructor` ou `__proto__` acharia uma função no protótipo
 * do objeto, o `??` não a pegaria, e o `<Text>` receberia uma função — quebrando a tela
 * inteira por causa de uma string que veio de fora.
 */
export function palavrasDoMotivoDoCoreAI(motivo: string): string {
  const proprio = Object.prototype.hasOwnProperty.call(MOTIVO_DO_COREAI_EM_PALAVRAS, motivo)
    ? MOTIVO_DO_COREAI_EM_PALAVRAS[motivo]
    : undefined;
  return typeof proprio === 'string' ? proprio : MOTIVO_COREAI_DESCONHECIDO;
}

/* ── a compilação de um peso aberto ──────────────────────────────────────── */

/**
 * O que o app sabe da **compilação** de uma pasta de pesos. O gêmeo de
 * {@link EstadoDaPonte}, e pela mesma razão: quem carrega o módulo nativo é `./index.ts`, e
 * aqui ele só entra por parâmetro.
 *
 * As três primeiras formas não chegam a perguntar — e nenhuma delas é "não compilado".
 */
export type EstadoDaCompilacao =
  /** O módulo nativo não está neste build. */
  | { readonly tipo: 'ausente' }
  /** Não é iOS: não há Core AI nem cache a olhar. */
  | { readonly tipo: 'fora-do-ios' }
  /** O módulo está, e a resposta ainda não voltou. */
  | { readonly tipo: 'consultando' }
  /** A ponte respondeu — legível ou não —, com a linha crua quando houve uma. */
  | { readonly tipo: 'lido'; readonly compilacao: CompilacaoNoAparelho; readonly cru?: string };

export const COMPILACAO_AUSENTE: EstadoDaCompilacao = { tipo: 'ausente' };
export const COMPILACAO_FORA_DO_IOS: EstadoDaCompilacao = { tipo: 'fora-do-ios' };
export const COMPILACAO_CONSULTANDO: EstadoDaCompilacao = { tipo: 'consultando' };

/**
 * A compilação como a tela a lê: três respostas, e **"não" nunca é "não sei"**.
 *
 * É a distinção inteira desta fatia. Um booleano faria os quatro casos em que ninguém pôde
 * perguntar — sem ponte, simulador, pasta fora do build, linha ilegível — caírem do lado do
 * "não", e a tela ofereceria **Compilar** para um modelo que este build nem traz. `nao-sabido`
 * carrega o motivo em palavras, porque uma tela que diz "não sei" sem dizer por que não sabe
 * é pior do que uma que não diz nada.
 */
export type CompilacaoDoModelo =
  | { readonly tipo: 'compilado' }
  | { readonly tipo: 'nao-compilado' }
  | { readonly tipo: 'nao-sabido'; readonly motivo: string };

/** O motivo de a compilação não ter resposta enquanto a pergunta está a caminho. */
export const MOTIVO_COMPILACAO_CONSULTANDO = 'consultando o cache do aparelho…';
/** A ponte respondeu fora do contrato, ou não respondeu. */
export const MOTIVO_COMPILACAO_ILEGIVEL = 'o aparelho não respondeu como esperado sobre a compilação';

/** O estado da compilação → a resposta de três valores que a linha do modelo mostra. */
export function compilacaoDoModelo(estado: EstadoDaCompilacao): CompilacaoDoModelo {
  switch (estado.tipo) {
    case 'ausente':
      return { tipo: 'nao-sabido', motivo: MOTIVO_COREAI_SEM_PONTE };
    case 'fora-do-ios':
      return { tipo: 'nao-sabido', motivo: MOTIVO_COREAI_FORA_DO_IOS };
    case 'consultando':
      return { tipo: 'nao-sabido', motivo: MOTIVO_COMPILACAO_CONSULTANDO };
    case 'lido':
      switch (estado.compilacao.estado) {
        case 'compilado':
          return { tipo: 'compilado' };
        case 'nao-compilado':
          return { tipo: 'nao-compilado' };
        case 'ilegivel':
          return { tipo: 'nao-sabido', motivo: MOTIVO_COMPILACAO_ILEGIVEL };
        case 'nao-sabido':
          return { tipo: 'nao-sabido', motivo: palavrasDoMotivoDoCoreAI(estado.compilacao.motivo) };
      }
  }
}

/** 8192 → "8.192": o separador de milhar da tela, sem depender do `Intl` do motor JS. */
export function milhar(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * A linha de detalhe do aparelho: `AFM 3 Core Advanced · janela de 8.192 tokens`.
 * Só quando ele atende, e só com o que o diagnóstico trouxe — antes do 27 não há
 * variante, e a linha fica só com a janela.
 */
export function detalheDoAparelho(ponte: EstadoDaPonte): string | undefined {
  if (ponte.tipo !== 'lido' || ponte.diagnostico.estado !== 'disponivel') return undefined;
  const { variante, janela } = ponte.diagnostico;
  const partes = [variante, janela !== undefined ? `janela de ${milhar(janela)} tokens` : undefined].filter(
    (p): p is string => p !== undefined,
  );
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/**
 * O aparelho no estado da ponte: disponível com o detalhe, ou apagado com o motivo.
 *
 * `emPalavras` é quem sabe o vocabulário daquele motor — {@link motivoDoAparelho} para o
 * modelo do sistema, {@link motivoDoCoreAI} para o peso aberto. O resto (o detalhe, a limpeza
 * do motivo, a marca de "consultando") é igual nos dois, e é por isso que não há duas cópias.
 */
function aparelhoNaPonte(
  base: MotorConhecido,
  ponte: EstadoDaPonte,
  emPalavras: (p: EstadoDaPonte) => string | null = motivoDoAparelho,
): MotorConhecido {
  const motivo = emPalavras(ponte);
  if (motivo !== null) {
    return { ...base, disponivel: false, motivo, ...(ponte.tipo === 'consultando' ? { consultando: true as const } : {}) };
  }
  const detalhe = detalheDoAparelho(ponte);
  const { motivo: _semMotivo, ...semMotivo } = base;
  return { ...semMotivo, disponivel: true, ...(detalhe !== undefined ? { detalhe } : {}) };
}

/* ── a lista do servidor (story 5.6, ADR 0048) ───────────────────────────── */

/**
 * A lista aprovada como este app a guarda: o que veio, e **quando**.
 *
 * O instante não é enfeite. Sem ele não há como distinguir "nunca perguntei" de
 * "perguntei e o servidor disse que não há nenhum" — e as duas levariam a buscas
 * repetidas a cada toque, ou a nenhuma. `null` é a primeira; uma lista vazia com
 * instante é a segunda, e ela vale tanto quanto uma cheia.
 */
export interface ListaAprovada {
  readonly motores: readonly MotorDeNuvemAprovado[];
  /** O instante (ms) em que a leitura que produziu esta lista voltou. */
  readonly lidaEm: number;
}

/**
 * Quanto tempo uma lista lida continua valendo.
 *
 * Curto o bastante para o dono ver um motor novo no mesmo dia em que o servidor
 * o aprova, e longo o bastante para a leitura da Saúde (que espera a lista antes
 * de resolver a cadeia) não pagar uma ida à rede por toque. A lista só muda por
 * `supabase secrets set`, que é ação humana rara.
 */
export const VALIDADE_DA_LISTA_MS = 10 * 60_000;

/** O que o app leu por último, ou `null` — nunca lida, ou esquecida. */
let guardada: ListaAprovada | null = null;

/** A lista em cache, sem buscar nada. `null` quando nunca foi lida com sucesso. */
export function listaAprovada(): ListaAprovada | null {
  return guardada;
}

/** Guarda o que o servidor devolveu, carimbando o instante. */
export function guardarListaAprovada(
  motores: readonly MotorDeNuvemAprovado[],
  lidaEm: number,
): ListaAprovada {
  guardada = { motores, lidaEm };
  return guardada;
}

/**
 * Esquece o cache.
 *
 * Quem chama hoje é o arranque de um teste, e `esquecerLista` (em `./index.ts`),
 * que esquece o cache **e** a busca em voo. Nada mais: a troca de sessão não
 * passa por aqui — se um dia a lista tiver de virar por usuário, é ali que a
 * ligação entra, e não neste comentário.
 */
export function esquecerListaAprovada(): void {
  guardada = null;
}

/** Vale a pena buscar de novo? Lista ausente sempre vale; vencida, também. */
export function listaVencida(agora: number, lista: ListaAprovada | null = guardada): boolean {
  return lista === null || agora - lista.lidaEm >= VALIDADE_DA_LISTA_MS || agora < lista.lidaEm;
}

/**
 * As variantes de nuvem **nomeadas** que o servidor aprovou para este recurso.
 *
 * Pura, e é ela que a fusão usa. A lista do servidor fala em `MotorId` e em
 * recursos; o rótulo e a descrição são derivados do id, porque o app não pode ter
 * texto autorado para um provedor que ele não conhecia quando foi compilado —
 * e mostrar id cru na tela seria o que o catálogo existe para evitar.
 *
 * Um id que não se lê, ou que não é `nuvem:<provedor>/<modelo>`, não entra:
 * `lerMotoresDeNuvemAprovados` já o descartou no núcleo, e aqui a checagem é a
 * rede contra uma lista montada à mão num teste.
 */
export function variantesDaNuvem(
  recurso: RecursoId,
  lista: ListaAprovada | null,
): readonly MotorConhecido[] {
  if (lista === null) return [];
  const out: MotorConhecido[] = [];
  const vistos = new Set<string>(MOTORES_CONHECIDOS.map((m) => m.id));
  for (const aprovado of lista.motores) {
    if (!aprovado.recursos.includes(recurso)) continue;
    const lido = lerMotorId(aprovado.motor);
    if (!lido || lido.tipo !== 'nuvem' || lido.variante !== 'modelo') continue;
    const id = formatarMotorId(lido);
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      id,
      // A mesma regra que a assinatura usa (`nomeDoMotor`): um nome só por motor.
      nome: nomeDaVariante(lido.provedor, lido.modelo),
      rotulo: `${lido.provedor} · ${lido.modelo}`,
      descricao:
        'Um modelo de nuvem que o servidor aprovou para esta leitura. O caso sai do aparelho para ser redigido.',
      disponivel: true,
    });
  }
  return out;
}

/**
 * O catálogo deste recurso: o que o app já conhecia, mais o que o servidor
 * aprovou para ele.
 *
 * **A lista do servidor só acrescenta.** Ela nunca tira `nuvem:padrao`, nunca
 * tira `sem-modelo` e nunca tira o aparelho da lista — é por isso que a leitura
 * falhar (`null`) custa exatamente as variantes nomeadas, e nada mais. Um app que
 * perdesse `nuvem:padrao` por não conseguir falar com o servidor ficaria sem
 * nuvem justamente quando a rede está ruim, que é quando o dono menos entende o
 * porquê.
 *
 * A ordem põe as nomeadas **depois** de `nuvem:padrao`: o padrão é o que o
 * servidor escolhe, e continua sendo a primeira opção de nuvem que o dono lê.
 *
 * **`ponte` e `coreai` são obrigatórias** (5.9, 5.8), pela mesma razão que `conhecidos` virou
 * obrigatório na 5.6: com um padrão, quem esquecesse de passá-la mostraria "a ponte
 * não está neste build" num iPhone com o modelo de pé — a mentira, sem nada quebrar.
 * `lista` fica com o padrão de sempre (o cache), e o mesmo de {@link idsConhecidosDe}:
 * o cache é o que o app sabe de verdade, não uma suposição.
 *
 * **São dois diagnósticos, não um** (5.8): o modelo do sistema pode estar de pé com o peso
 * aberto ausente, e o contrário também — a biblioteca vendorizada existe e a Apple
 * Intelligence está desligada. Um estado só faria o seletor contar a razão de um como se
 * fosse a do outro.
 *
 * **E eles vêm num objeto, não lado a lado.** Dois parâmetros posicionais do mesmo tipo
 * podem ser trocados sem que nada reclame — `tsc` passa, os testes passam, e o seletor
 * atribui a razão de um motor ao outro. Nomeados, a inversão é erro de compilação, que é o
 * único lugar onde ela pode ser pega.
 */
export interface EstadoDasPontes {
  /** O modelo que o próprio sistema do iPhone fornece. */
  readonly sistema: EstadoDaPonte;
  /**
   * Os pesos abertos que este build embarca, pelo Core AI — **um diagnóstico por modelo**.
   *
   * Aceita as duas formas de propósito: um mapa `pesos → estado`, que é o que o app monta
   * quando pergunta a cada modelo, e um estado **só**, que vale para todos — é o caso do
   * build sem ponte, do simulador e dos testes, onde a resposta é a mesma para qualquer
   * peso e repetí-la por nome seria cerimônia sem informação.
   */
  readonly coreai: EstadoDaPonte | Readonly<Record<string, EstadoDaPonte>>;
}

/** O estado do peso aberto `pesos`, seja qual for a forma que `coreai` tenha. */
export function estadoDoPesoAberto(
  coreai: EstadoDasPontes['coreai'],
  pesos: string,
): EstadoDaPonte {
  // `'tipo' in coreai` não narra: um `Record<string, …>` também admite a chave `tipo`. O que
  // separa as duas formas é o **valor** dela ser a etiqueta de um estado.
  const etiqueta = (coreai as { readonly tipo?: unknown }).tipo;
  if (typeof etiqueta === 'string') return coreai as EstadoDaPonte;
  return (coreai as Readonly<Record<string, EstadoDaPonte>>)[pesos] ?? PONTE_AUSENTE;
}

export function motoresDoRecurso(
  recurso: RecursoId,
  pontes: EstadoDasPontes,
  lista: ListaAprovada | null = guardada,
): readonly MotorConhecido[] {
  const locais = MOTORES_CONHECIDOS.map((m) => {
    if (m.id === APARELHO_SISTEMA) return aparelhoNaPonte(m, pontes.sistema);
    const aberto = pesoAbertoDe(m.id);
    if (aberto !== undefined) {
      return aparelhoNaPonte(m, estadoDoPesoAberto(pontes.coreai, aberto.pesos), motivoDoCoreAI);
    }
    return m;
  });
  return [...locais, ...variantesDaNuvem(recurso, lista)];
}

/**
 * Os ids que o app conhece para este recurso — o que vai ao `resolverCadeia`.
 *
 * **Derivados de {@link motoresDoRecurso}**, com o mesmo padrão de `lista`, para as
 * duas listas nunca divergirem. A ponte não muda id nenhum — conhecer não é ter, e o
 * aparelho entra na cadeia mesmo indisponível (é assim que a trilha diz por que ele
 * não escreveu) —, então qualquer estado serve; vai o do build sem ponte.
 */
export function idsConhecidosDe(
  recurso: RecursoId,
  lista: ListaAprovada | null = guardada,
): readonly MotorId[] {
  return motoresDoRecurso(recurso, PONTES_AUSENTES, lista).map((m) => m.id);
}

/** As duas pontes ausentes — o ponto de partida, e o que {@link idsConhecidosDe} usa. */
export const PONTES_AUSENTES: EstadoDasPontes = { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE };

/** O id do primeiro peso aberto — o que a cadeia padrão e os testes usam quando só há um. */
export const APARELHO_COREAI_SMOLLM2: MotorId = PESOS_ABERTOS[0]!.id;

/**
 * O motor com este id dentro de um catálogo, ou `undefined`. Aceita id cru, de
 * onde ele venha.
 *
 * **`conhecidos` é obrigatório desde a 5.6.** Era `MOTORES_CONHECIDOS` por
 * omissão, e o padrão fazia o caminho errado compilar calado: quem esquecesse de
 * passar a lista fundida receberia "não existe neste build" para um motor que o
 * servidor aprovou — a mentira exata que este módulo existe para não contar.
 */
export function motorConhecido(
  id: string | null | undefined,
  conhecidos: readonly MotorConhecido[],
): MotorConhecido | undefined {
  return conhecidos.find((m) => m.id === id);
}

/**
 * Este motor está disponível, neste catálogo?
 *
 * Motor que o catálogo não conhece conta como indisponível: o app não tem como
 * entregar o que não declarou. É o catálogo **passado** que responde — com a
 * lista fundida, uma variante aprovada está disponível; sem ela, o app nem sabe
 * que ela existe.
 */
export function motorDisponivel(
  id: string | null | undefined,
  conhecidos: readonly MotorConhecido[],
): boolean {
  return motorConhecido(id, conhecidos)?.disponivel === true;
}

/**
 * O nome de uma variante de nuvem nomeada, com artigo.
 *
 * **Sai do próprio id**, e não de uma lista: `nuvem:acme/modelo-9` já carrega
 * provedor e modelo, então não há motivo para depender de uma lista ter sido
 * lida antes de saber como chamá-lo. Uma regra só, usada pelo catálogo e pela
 * assinatura — duas divergiriam, e o dono leria um nome no seletor e outro sob a
 * frase.
 *
 * O artigo é "o", porque o sujeito é o modelo: `por` e `de` o contraem em "pelo"
 * e "do" (ver `assinatura.ts`), e a frase sai "escrito pelo modelo-9 da acme".
 */
export function nomeDaVariante(provedor: string, modelo: string): string {
  return `o ${modelo} da ${provedor}`;
}

/**
 * O nome de um motor, com artigo — para a assinatura e para o seletor.
 *
 * **A variante nomeada tem nome próprio** (5.6). Antes toda ela caía em "a
 * nuvem", e aí a assinatura da `/sono/saude` não dizia qual modelo escreveu e a
 * bancada — a tela que existe para comparar motores — anunciava "medindo a
 * nuvem…" para N motores diferentes. O nome vem do id, então funciona sem
 * catálogo nenhum: uma preferência gravada por uma versão futura do app ainda
 * rende um sujeito legível, em vez de "escrito por undefined".
 */
export function nomeDoMotor(id: string | null | undefined): string {
  const conhecido = motorConhecido(id, MOTORES_CONHECIDOS);
  if (conhecido) return conhecido.nome;
  const lido = lerMotorId(id);
  if (lido?.tipo === 'nuvem') {
    return lido.variante === 'modelo' ? nomeDaVariante(lido.provedor, lido.modelo) : 'a nuvem';
  }
  if (lido?.tipo === 'aparelho') return 'o modelo do aparelho';
  return 'o template';
}

/* ── quais recursos esta camada hospeda ─────────────────────────────────── */

export interface Hospedagem {
  /** A leitura deste recurso passa pelo orquestrador **e consulta a preferência**. */
  readonly hospedado: boolean;
  /** Por que ainda não, em palavras — o mesmo idioma do motor indisponível. */
  readonly motivo?: string;
}

/**
 * O que a camada de motores do app de fato consome, recurso por recurso.
 *
 * Existe porque um controle inerte mente tanto quanto uma omissão. O seletor lista
 * os recursos do catálogo do núcleo (e tem de continuar listando), mas só oferece
 * escolha para quem lê a preferência. Leem hoje a Saúde do sono (5.5), a
 * Retrospectiva — desde a 1.10, a impressão da revista resolve a cadeia pela
 * preferência e passa pelo orquestrador (`lib/edicao-ia.ts`) — e o nome de rota,
 * desde a 5.7 (`services/route-name.ts`). Oferecer escolha para quem não a lê
 * gravaria uma preferência que ninguém consulta — o dono trocaria o motor e nada
 * mudaria, sem nenhuma explicação.
 *
 * **Os quatro recursos do núcleo estão ligados.** O campo `motivo` fica, e o tipo
 * `Hospedagem` também: é ele que faz um recurso novo nascer com a resposta escrita
 * em vez de nascer mudo.
 *
 * Fechado sobre `RecursoId`: recurso novo no núcleo **não compila** até alguém dizer
 * se esta camada o hospeda. É o que impede a lista de envelhecer calada.
 */
export const HOSPEDAGEM: Readonly<Record<RecursoId, Hospedagem>> = {
  'saude-do-sono': { hospedado: true },
  retrospectiva: { hospedado: true },
  'nome-de-rota': { hospedado: true },
  // O nome em português entra hospedado no mesmo passo em que nasce (23/09): o
  // `services/route-name.ts` lê a preferência **dele**, separada da do nome local,
  // porque é essa separação que o dono pediu — um motor para o nome, outro para a
  // legenda. Nascer não hospedado faria o seletor mostrar a linha e negar a escolha.
  'nome-de-rota-pt': { hospedado: true },
};

/** O que o bloqueio precisa saber do recurso. Um `Descritor` cabe aqui. */
export type RecursoDoSeletor = Pick<Descritor<never, never>, 'recurso' | 'regimeMaximo' | 'grava'>;

/** O nome de um tipo de motor, com artigo — para o motivo falar do tipo, não do id. */
function nomeDoTipo(tipo: TipoDeMotor): string {
  if (tipo === 'nuvem') return 'a nuvem';
  if (tipo === 'aparelho') return 'o modelo do aparelho';
  return 'o template';
}

/**
 * Por que este motor não pode ser escolhido para este recurso — ou `null`, se pode.
 *
 * Quatro razões, nesta ordem, e **nenhuma delas é "indisponível" sem dono**:
 *
 *  1. a camada não hospeda o recurso (a escolha não seria consultada);
 *  2. o motor expõe mais do que o `regimeMaximo` do recurso admite;
 *  3. o recurso grava e não admite que um motor desse tipo grave (`grava.admite`) —
 *     a preferência seria aceita, o marcador não andaria e nada explicaria;
 *  4. o motor não existe neste build (o catálogo o conhece e não o tem).
 *
 * A gramática do id vem de `lerMotorId`, não de `startsWith`: o provedor nomeado que
 * a 5.6 grava (`nuvem:acme/modelo-9`) tem de ser lido pelo mesmo leitor que o núcleo
 * usa, senão a tela e a resolução da cadeia discordam.
 *
 * `conhecidos` é o catálogo **já fundido** com a lista do servidor
 * ({@link motoresDoRecurso}), e é **obrigatório**: com um padrão, quem esquecesse
 * de passá-lo receberia "não existe neste build" para uma variante que o servidor
 * aprovou — a razão certa para o aparelho, e uma mentira para ela, escrita na tela
 * do dono sem nada quebrar. Um parâmetro obrigatório transforma esse esquecimento
 * num erro de compilação.
 */
export function motivoDeBloqueio(
  recurso: RecursoDoSeletor,
  id: MotorId,
  conhecidos: readonly MotorConhecido[],
): string | null {
  const hospedagem = HOSPEDAGEM[recurso.recurso];
  if (!hospedagem.hospedado) return hospedagem.motivo ?? 'ainda não usado nesta versão';

  const lido = lerMotorId(id);
  if (!lido) return 'este motor não se lê';

  // **Não há linha para o peso aberto aqui, e é de propósito** (ADR 0056, 23/09).
  //
  // Da 5.8 até 23/09 existia uma quinta razão, antes desta: o peso aberto era bloqueado em
  // todo recurso que gravasse, porque a medição de 21/09 mostrava um modelo pequeno
  // acertando ~10% dos nomes e passando no portão em 97% dos casos. Ela caiu por decisão do
  // dono, depois de o Qwen3 1.7B fazer 22 de 22 na amostra da Saúde do sono.
  //
  // O que sobrou no lugar não é menos: `grava.admite` do descritor. A retrospectiva segue
  // fechada ao aparelho porque ela declara `admite: ['nuvem']`, e a razão (3) abaixo a
  // barra — e passaria a aceitar peso aberto no dia em que o descritor dissesse que aceita,
  // que é onde essa decisão pertence. `nome-de-rota` declara `admite: ['nuvem','aparelho']`
  // desde sempre, e agora a tela obedece ao que o descritor diz em vez de um "não" paralelo.

  if (exposicao(lido.tipo) > exposicao(recurso.regimeMaximo)) {
    return `este recurso não manda dado além d${recurso.regimeMaximo === 'sem-modelo' ? 'o código' : 'o aparelho'}`;
  }
  if (!admiteTipo(recurso, lido.tipo)) {
    return `este recurso não guarda o que ${nomeDoTipo(lido.tipo)} escreve`;
  }
  if (motorDisponivel(id, conhecidos)) return null;
  return motorConhecido(id, conhecidos)?.motivo ?? 'indisponível neste build';
}
