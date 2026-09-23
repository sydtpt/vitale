/**
 * Diagramação da Retrospectiva — quais blocos existem, em que ordem, quais estão
 * escondidos — e **quais cadernos da revista o leitor silenciou**.
 *
 * O usuário pediu explicitamente "incluir ideias, ver quais uso mais, e depois
 * refinar ou remover". Isso só funciona se **remover for barato**: cada seção da
 * tela é um bloco com id, ordem e visibilidade, e matar um bloco é apagar uma
 * entrada — não cirurgia no template.
 *
 * ## Dois vocabulários, dois atos (Story 2.5)
 *
 * {@link RetroPrefs.hidden} esconde **bloco da Retrospectiva** ({@link
 * RetroBlockId}); {@link RetroPrefs.cadernosOcultos} silencia **caderno da
 * revista** (`CadernoId`, com dono único em `period/cadernos.ts` — AD-2). São
 * duas listas e dois atos independentes: alargar `RetroBlockId` com os quatro
 * cadernos deixaria a `order` do leitor voltar pela porta dos fundos do
 * ranqueamento do miolo (ver o cabeçalho de `cadernos.ts`).
 *
 * Silenciar é a **única forma de contrariar a revista**: o caderno some da edição
 * na tela e deixa de ser pedido à nuvem quando o telefone imprime — o filtro
 * entra em `OpcoesDaImpressao.cadernos`, que já é a lista de candidatos, antes da
 * primeira chamada paga. **Nada é apagado do banco**: caderno fora de `pedidos`
 * sobrevive à sequência, então dessilenciar traz de volta tudo o que já foi
 * impresso.
 *
 * O núcleo **não conhece preferência**: quem filtra é o hospedeiro. O telefone lê
 * {@link cadernosVisiveis} e passa; `scripts/revista/imprimir.ts` segue sem
 * passar, e imprime os quatro.
 *
 * ## A prova de gráfica acabou
 *
 * A Retrospectiva é **um jornal**, e um jornal é igual toda edição — você abre e
 * sabe onde está tudo. Até a 2.5 a resposta a essa tensão era uma "prova de
 * gráfica" de 60 dias: ordem editável no começo, congelada depois, e bloco
 * escondido por 60 dias virava candidato a sair do código.
 *
 * As duas regras saíram. A do congelamento porque o que ela protegia (jornal
 * igual toda edição) já é verdade sem ela — a ordem do miolo da revista vem da
 * coluna `posicao`, não daqui; a dos 60 dias porque `deadBlocks` nunca teve um
 * chamador de produção, e regra que ninguém executa não é regra, é prosa. **A
 * `order` já gravada fica e continua valendo** — ela só deixou de ser editável na
 * tela.
 *
 * **O custo disso, declarado:** um bloco criado depois da 2.5 entra no fim da
 * `order` já salva — é o que {@link resolveRetroPrefs} sempre fez, para que seção
 * nova nunca suma — e **fica lá para sempre**, porque não existe mais UI para
 * movê-lo. A `order` do dono tem 13 entradas e ele lê as cinco primeiras; o 14º
 * bloco nasceria abaixo delas, sem recurso. Quem quiser desfazer paga uma de três:
 * devolver as setas, dar ao bloco novo uma posição autoral no catálogo com um
 * passe de resolução que a respeite, ou zerar a `order` de propósito.
 *
 * Persistido como jsonb `user_preferences.retro_prefs`, resolvido defensivamente
 * sobre os defaults: chave ausente ou versão antiga do app nunca quebra — herda o
 * default. Adicionar bloco novo = acrescentar ao catálogo, sem migration nova.
 *
 * Ver docs/specs/retrospectiva/v2-jornal.md §6.
 */
import type { PeriodKind } from './bounds';
import { CADERNO_IDS, isCadernoId, type CadernoId } from './cadernos';

export type RetroBlockId =
  | 'lede'
  | 'kpis'
  | 'highlights'
  | 'heatmap'
  | 'tasks'
  | 'dailyTasks'
  | 'purchases'
  | 'fitness'
  | 'sports'
  | 'health'
  | 'sleep'
  | 'habits'
  | 'yearSeries';

export interface RetroBlockDef {
  id: RetroBlockId;
  label: string;
  /** Em que modos o bloco faz sentido. Vazio ⇒ todos. */
  kinds?: readonly PeriodKind[];
  /** Blocos que a manchete precisa para existir não podem ser escondidos. */
  fixed?: boolean;
}

/**
 * O catálogo — a ordem aqui **é** a diagramação padrão do jornal, e a ordem
 * padrão é editorial: a manchete abre, o número contextualiza, o detalhe segue.
 */
export const RETRO_BLOCKS: readonly RetroBlockDef[] = [
  { id: 'lede', label: 'A manchete', fixed: true },
  { id: 'kpis', label: 'Números do período' },
  { id: 'highlights', label: 'Destaques' },
  { id: 'heatmap', label: 'Grade diária', kinds: ['week', 'month', 'season'] },
  { id: 'tasks', label: 'Tarefas feitas' },
  { id: 'dailyTasks', label: 'Tarefas — todo dia', kinds: ['week', 'month'] },
  { id: 'purchases', label: 'Compras & gastos' },
  { id: 'fitness', label: 'Treinos & atividade' },
  { id: 'sports', label: 'Ciclismo & corrida' },
  { id: 'health', label: 'Saúde & bem-estar' },
  // 05/09/2026: a noite típica do período (sleep/retro.ts). Entra no fim da ordem
  // já salva — `resolveRetroPrefs` —, e a `order` gravada é quem manda daí em
  // diante: ele já a arrumou (sleep em 3º, habits em 5º) e ela não se reescreve.
  { id: 'sleep', label: 'Sono' },
  { id: 'habits', label: 'Hábitos & registros' },
  { id: 'yearSeries', label: 'Por mês', kinds: ['year'] },
];

const BY_ID = new Map(RETRO_BLOCKS.map((b) => [b.id, b]));

export interface RetroPrefs {
  /** Ordem completa dos blocos. Ids desconhecidos são descartados na resolução. */
  order: RetroBlockId[];
  /**
   * Blocos escondidos → dia 'YYYY-MM-DD' em que foram escondidos.
   *
   * **A data não é lida por ninguém — e este campo tem dado em produção.** Ela
   * existia para a regra dos 60 dias (`deadBlocks`), que saiu na 2.5; o que a
   * chave carrega hoje é só "escondido" (presença) e um carimbo que ninguém
   * consulta. A forma ficou porque trocá-la por booleano seria migration de dado
   * sobre a preferência do único usuário, pelo prazer da simetria.
   *
   * O mesmo custo, declarado igual, vale para {@link RetroPrefs.cadernosOcultos}.
   */
  hidden: Partial<Record<RetroBlockId, string>>;
  /**
   * Cadernos silenciados → dia 'YYYY-MM-DD' em que foram silenciados.
   *
   * **A data não é lida por ninguém, e isso está declarado** — exatamente como em
   * {@link RetroPrefs.hidden}, de quem ela copiou a forma. Quem for lê-la um dia
   * está lendo uma promessa que já não se cumpre.
   *
   * Opcional porque um jsonb gravado antes da 2.5 não a tem — e porque um build
   * anterior a ela a descarta ao regravar. **Um aparelho, um build de cada vez:
   * o custo é aceito.**
   */
  cadernosOcultos?: Partial<Record<CadernoId, string>>;
}

export const DEFAULT_RETRO_PREFS: RetroPrefs = {
  order: RETRO_BLOCKS.map((b) => b.id),
  hidden: {},
  cadernosOcultos: {},
};

/**
 * O valor de `hidden[id]` / `cadernosOcultos[id]` é um carimbo que vale.
 *
 * **String vazia não passa, e isso não é preciosismo:** quem lê esses mapas
 * pergunta `if (prefs.hidden[id])` — presença por truthiness, em `visibleBlocks` e
 * em {@link cadernosVisiveis}. Uma `''` sobreviveria à resolução por ser string e
 * leria como *visível* por ser falsy: o guarda e o leitor discordariam sobre a
 * mesma entrada, e a discordância é calada.
 */
function ehCarimbo(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Resolve o jsonb cru sobre os defaults.
 *
 * **Blocos novos entram no fim**, não somem: uma ordem salva por uma versão antiga
 * do app não pode esconder uma seção que passou a existir depois.
 *
 * O retorno é montado **do zero**, com as chaves que esta versão conhece: chave
 * desconhecida (o `proofStartedOn` de antes da 2.5, um id inventado) cai em
 * silêncio, e nunca há spread do jsonb cru.
 */
export function resolveRetroPrefs(raw: unknown): RetroPrefs {
  if (!raw || typeof raw !== 'object') {
    return { order: [...DEFAULT_RETRO_PREFS.order], hidden: {}, cadernosOcultos: {} };
  }
  const r = raw as Record<string, unknown>;

  const seen = new Set<RetroBlockId>();
  const order: RetroBlockId[] = [];
  if (Array.isArray(r['order'])) {
    for (const id of r['order']) {
      if (typeof id !== 'string') continue;
      const key = id as RetroBlockId;
      if (!BY_ID.has(key) || seen.has(key)) continue;
      seen.add(key);
      order.push(key);
    }
  }
  for (const b of RETRO_BLOCKS) if (!seen.has(b.id)) order.push(b.id);

  const hidden: Partial<Record<RetroBlockId, string>> = {};
  const rawHidden = r['hidden'];
  if (rawHidden && typeof rawHidden === 'object') {
    for (const [k, v] of Object.entries(rawHidden as Record<string, unknown>)) {
      const key = k as RetroBlockId;
      const def = BY_ID.get(key);
      // `fixed` nunca fica escondido, nem que o jsonb diga o contrário.
      if (!def || def.fixed || !ehCarimbo(v)) continue;
      hidden[key] = v;
    }
  }

  // O guarda do jsonb é o de `cadernos.ts` — `isCadernoId` —, e não uma segunda
  // lista escrita aqui: um quinto caderno nasceria silenciável sem que ninguém
  // tocasse neste arquivo.
  const cadernosOcultos: Partial<Record<CadernoId, string>> = {};
  const rawCadernos = r['cadernosOcultos'];
  if (rawCadernos && typeof rawCadernos === 'object') {
    for (const [k, v] of Object.entries(rawCadernos as Record<string, unknown>)) {
      if (!isCadernoId(k) || !ehCarimbo(v)) continue;
      cadernosOcultos[k] = v;
    }
  }

  return { order, hidden, cadernosOcultos };
}

/**
 * Os blocos a renderizar, na ordem, para um dado modo — já sem os escondidos e
 * sem os que não fazem sentido no período.
 */
export function visibleBlocks(prefs: RetroPrefs, kind: PeriodKind): RetroBlockDef[] {
  const out: RetroBlockDef[] = [];
  for (const id of prefs.order) {
    const def = BY_ID.get(id);
    if (!def) continue;
    if (prefs.hidden[id]) continue;
    if (def.kinds && !def.kinds.includes(kind)) continue;
    out.push(def);
  }
  return out;
}

/** Alterna a visibilidade de um bloco, carimbando o dia em que foi escondido. */
export function toggleBlock(prefs: RetroPrefs, id: RetroBlockId, today: string): RetroPrefs {
  const def = BY_ID.get(id);
  if (!def || def.fixed) return prefs;
  const hidden = { ...prefs.hidden };
  if (hidden[id]) delete hidden[id];
  else hidden[id] = today;
  return { ...prefs, hidden };
}

/**
 * Os cadernos que o leitor **não** silenciou, na ordem do catálogo — **a** lista,
 * lida pela tela e pela impressão (Story 2.5).
 *
 * Uma só porque as duas têm que concordar: a tela decide o que desenhar e qual
 * botão oferecer, e a impressão decide por quem pagar. Duas listas seriam o dia em
 * que o botão aparece para um caderno que a sequência não vai pedir.
 *
 * Pode voltar **vazia** — os quatro silenciados —, e quem imprime precisa tratar
 * isso: `imprimirCom` lança `TypeError` com a lista vazia, porque ausente é "os
 * quatro" e vazia é chamada errada.
 */
export function cadernosVisiveis(prefs: RetroPrefs): CadernoId[] {
  const ocultos = prefs.cadernosOcultos ?? {};
  return CADERNO_IDS.filter((id) => !ocultos[id]);
}

/**
 * Silencia ou dessilencia um caderno, carimbando o dia em que foi silenciado.
 *
 * **Não há caderno `fixed`**: os quatro podem ser silenciados, inclusive todos ao
 * mesmo tempo. A manchete da capa não depende de um caderno em particular — ela
 * passa para o primeiro visível —, então não há o que proteger aqui.
 */
export function toggleCaderno(prefs: RetroPrefs, id: CadernoId, today: string): RetroPrefs {
  const cadernosOcultos = { ...(prefs.cadernosOcultos ?? {}) };
  if (cadernosOcultos[id]) delete cadernosOcultos[id];
  else cadernosOcultos[id] = today;
  return { ...prefs, cadernosOcultos };
}
