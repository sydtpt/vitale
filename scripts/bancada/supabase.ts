/**
 * O client e a sessão da bancada — o único arquivo dela que guarda credencial
 * (story 5.4, marco A; AD-14 da revista; critério 4 da 2.1).
 *
 * O núcleo não constrói `SupabaseClient` (é barreira do `architecture.test.ts`):
 * quem o constrói é o hospedeiro, porque o adaptador de armazenamento difere. O
 * da bancada não tem adaptador nenhum — `persistSession: false` —, e é de
 * propósito: **nada é gravado em disco**, e o `access_token` morre com o processo.
 *
 * A nuvem entra com **JWT de usuário**, nunca chave de serviço: a sessão sai de
 * `signInWithPassword` com a credencial de quem roda, e é o mesmo caminho que o
 * app percorre. Uma chave de serviço aqui mediria com privilégio que nenhuma tela
 * tem, e vazaria a RLS da medição.
 *
 * **Faltando credencial, a bancada para antes de abrir rede e nomeia o que
 * falta.** É o que separa "esqueci de exportar a variável" de "a rede caiu": sem
 * isso, a primeira aparece como `indisponivel` em 387 linhas. Nada de credencial
 * é impresso — nem em log de erro: as mensagens daqui carregam o **nome** da
 * variável, nunca o valor.
 */
import { createClient } from '@supabase/supabase-js';
import { fetchSleepPeriodsSince } from '@vitale/shared';

/**
 * O tipo de client que **o núcleo** aceita, tirado da assinatura de quem o recebe.
 *
 * Não é `SupabaseClient` importado aqui de propósito: sob `nodenext`, este workspace
 * é ESM e `packages/shared` é CJS, então os dois veem o mesmo `SupabaseClient` por
 * resoluções diferentes e os tipos não unificam (`resolution-mode` no erro). Derivar
 * da função que vai receber o client elimina a duplicidade pela raiz — e se a
 * assinatura do núcleo mudar, quebra aqui, que é onde se quer saber.
 */
export type ClientDoNucleo = Parameters<typeof fetchSleepPeriodsSince>[0];

/** O ambiente como o processo o entrega. Parâmetro, para a leitura ser pura e testável. */
export type Ambiente = Readonly<Record<string, string | undefined>>;

export interface Credenciais {
  readonly url: string;
  readonly chaveAnonima: string;
  readonly email: string;
  readonly senha: string;
}

/**
 * As variáveis de cada campo, **na ordem de precedência**: as `ORBE_*` primeiro,
 * caindo para as `EXPO_PUBLIC_*` quando existirem — quem já tem o `.env` do
 * mobile exportado não precisa repetir URL e chave anônima.
 *
 * A senha não tem segunda grafia de propósito: não há `EXPO_PUBLIC_` de senha, e
 * inventar um nome convidaria alguém a pôr a senha num arquivo que o bundler lê.
 */
export const VARIAVEIS = Object.freeze({
  url: Object.freeze(['ORBE_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']),
  chaveAnonima: Object.freeze(['ORBE_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']),
  email: Object.freeze(['ORBE_EMAIL']),
  senha: Object.freeze(['ORBE_SENHA']),
} as const satisfies Readonly<Record<keyof Credenciais, readonly string[]>>);

type CampoDaCredencial = keyof typeof VARIAVEIS;

const CAMPOS = Object.keys(VARIAVEIS) as readonly CampoDaCredencial[];

/**
 * O primeiro valor **presente** entre as grafias aceitas de um campo.
 *
 * O `trim` só decide se a variável existe; o valor volta **cru**. Uma senha com
 * espaço na borda é uma senha, e recortá-la daria "Invalid login credentials" sem
 * nenhuma pista de que foi a bancada que a alterou.
 */
function valorDe(env: Ambiente, campo: CampoDaCredencial): string | null {
  for (const nome of VARIAVEIS[campo]) {
    const v = env[nome];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

/** "ORBE_SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL)" — o que exportar, por extenso. */
export function comoExportar(campo: CampoDaCredencial): string {
  const [primeira, ...resto] = VARIAVEIS[campo];
  if (primeira === undefined) throw new Error(`VARIAVEIS.${campo} está vazio`);
  return resto.length === 0 ? primeira : `${primeira} (ou ${resto.join(', ')})`;
}

/**
 * A URL do projeto é endereço de rede, e o transporte pendura `/functions/v1/…`
 * nela. Uma variável com o nome do projeto em vez da URL, ou com `http://` numa
 * máquina de produção, viraria uma chamada que falha como `indisponivel` — a
 * confusão que a leitura da credencial existe para evitar. `http://` é aceito só em
 * `localhost`/`127.0.0.1`, que é o dublê da nuvem em teste.
 */
export function problemaDaUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return `não é uma URL (veio ${JSON.stringify(url)})`;
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    return `tem de ser https:// (veio ${u.protocol}//${u.hostname})`;
  }
  return null;
}

export type LeituraDaCredencial =
  | { readonly ok: true; readonly credenciais: Credenciais }
  | { readonly ok: false; readonly faltam: readonly string[]; readonly problemas: readonly string[] };

/**
 * A credencial do ambiente, ou **quais variáveis faltam** (e quais estão mal
 * formadas). Pura: não abre rede, não toca disco e **não devolve valor nenhum no
 * caminho de erro** — só nomes de variável.
 */
export function lerCredenciais(env: Ambiente): LeituraDaCredencial {
  const achado = new Map<CampoDaCredencial, string>();
  const faltam: string[] = [];
  for (const campo of CAMPOS) {
    const v = valorDe(env, campo);
    if (v === null) faltam.push(comoExportar(campo));
    else achado.set(campo, v);
  }
  if (faltam.length > 0) return { ok: false, faltam, problemas: [] };

  const url = achado.get('url');
  const chaveAnonima = achado.get('chaveAnonima');
  const email = achado.get('email');
  const senha = achado.get('senha');
  if (url === undefined || chaveAnonima === undefined || email === undefined || senha === undefined) {
    // Inalcançável: `faltam` vazio quer dizer que os quatro entraram. Fica como
    // prova de tipo em vez de `!`, que é onde um campo novo passaria calado.
    return { ok: false, faltam: CAMPOS.map(comoExportar), problemas: [] };
  }
  const daUrl = problemaDaUrl(url);
  if (daUrl !== null) return { ok: false, faltam: [], problemas: [`${comoExportar('url')}: ${daUrl}`] };

  return { ok: true, credenciais: { url: url.replace(/\/+$/, ''), chaveAnonima, email, senha } };
}

/** A sessão aberta: o client para as leituras e o JWT para o transporte da nuvem. */
export interface Sessao {
  readonly db: ClientDoNucleo;
  readonly userId: string;
  readonly url: string;
  readonly chaveAnonima: string;
  /**
   * O JWT **de agora**, não uma cópia do início da corrida.
   *
   * É função, e não campo, porque `autoRefreshToken` está ligado: guardar o token
   * num `const` desfaria a renovação em silêncio — o transporte seguiria mandando o
   * token velho e a nuvem passaria a responder 401 no meio da medição. Morre com o
   * processo: nada disto vai para disco.
   */
  readonly tokenAtual: () => Promise<string>;
  /**
   * Para o relógio de renovação.
   *
   * `autoRefreshToken` arma um `setInterval`, e um `setInterval` vivo **segura o
   * processo Node aberto** — o que, com `process.exitCode` em vez de
   * `process.exit()`, deixaria a bancada pendurada depois de escrever o relatório.
   */
  readonly fechar: () => void;
}

/**
 * Abre a sessão de usuário. Lança com a mensagem do provedor — que nomeia o
 * motivo ("Invalid login credentials"), nunca a credencial.
 */
export async function abrirSessao(c: Credenciais): Promise<Sessao> {
  // O `as` é a ponte entre as duas visões do mesmo tipo (ver `ClientDoNucleo`): é o
  // mesmo objeto em execução, e esta é a única linha que precisa dizê-lo.
  const db = createClient(c.url, c.chaveAnonima, {
    auth: {
      // Nada em disco: a bancada não é um app, e uma sessão persistida aqui
      // viraria token no diretório de quem rodou.
      persistSession: false,
      // **Renova**: o JWT vale cerca de uma hora, e uma corrida com `--limite` alto
      // passa disso. Sem renovação, a nuvem começa a devolver 401 no meio da
      // medição e o relatório registra `indisponivel` em janelas que nunca foram
      // medidas de verdade — exatamente a confusão entre "falta credencial" e "a
      // rede caiu" que este módulo existe para não deixar acontecer.
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }) as unknown as ClientDoNucleo & { auth: ReturnType<typeof createClient>['auth'] };
  const { data, error } = await db.auth.signInWithPassword({ email: c.email, password: c.senha });
  if (error) throw new Error(`a sessão não abriu: ${error.message}`);
  const primeiro = data.session?.access_token;
  const userId = data.user?.id;
  if (!primeiro || !userId) throw new Error('a sessão abriu sem access_token ou sem usuário');

  const tokenAtual = async (): Promise<string> => {
    // `getSession` devolve a sessão corrente e, com a renovação ligada, já entrega
    // o token novo quando o velho venceu.
    const { data: agora, error: erroDaSessao } = await db.auth.getSession();
    if (erroDaSessao) throw new Error(`a sessão não renovou: ${erroDaSessao.message}`);
    const token = agora.session?.access_token;
    if (!token) throw new Error('a sessão venceu e não renovou');
    return token;
  };

  return {
    db,
    userId,
    url: c.url,
    chaveAnonima: c.chaveAnonima,
    tokenAtual,
    fechar: () => db.auth.stopAutoRefresh().catch(() => undefined),
  };
}
