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

/** O que sempre é preciso, qualquer que seja o caminho de autenticação. */
interface Projeto {
  readonly url: string;
  readonly chaveAnonima: string;
}

/**
 * A credencial, em **dois caminhos**.
 *
 * `token` é o preferido, e é o único que serve para uma conta criada por OAuth — a do
 * dono entra pelo Google, então ela **não tem senha** e `signInWithPassword` nunca vai
 * funcionar nela. O token sai do navegador já autenticado (ver `scripts/README.md`).
 *
 * `senha` continua existindo para conta de e-mail e senha, e é o caminho que a 5.4
 * nasceu usando.
 *
 * Nos dois, a invariante da AD-14 vale à letra: **JWT de usuário**, com a credencial
 * vinda do ambiente de quem roda, nunca chave de serviço. O token do navegador é
 * exatamente esse JWT, um passo antes.
 */
export type Credenciais = Projeto &
  (
    | { readonly via: 'token'; readonly accessToken: string; readonly refreshToken: string | null }
    | { readonly via: 'senha'; readonly email: string; readonly senha: string }
  );

/**
 * As variáveis de cada campo, **na ordem de precedência**: as `ORBE_*` primeiro,
 * caindo para as `EXPO_PUBLIC_*` quando existirem — quem já tem o `.env` do
 * mobile exportado não precisa repetir URL e chave anônima.
 *
 * Token e senha não têm segunda grafia de propósito: não há `EXPO_PUBLIC_` de
 * credencial pessoal, e inventar um nome convidaria alguém a pôr o segredo num
 * arquivo que o bundler lê.
 *
 * A ordem das chaves é a ordem em que as mensagens ensinam os caminhos — o do token
 * primeiro, porque é o que funciona na conta do dono.
 */
export const VARIAVEIS = Object.freeze({
  url: Object.freeze(['ORBE_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']),
  chaveAnonima: Object.freeze(['ORBE_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']),
  accessToken: Object.freeze(['ORBE_ACCESS_TOKEN']),
  refreshToken: Object.freeze(['ORBE_REFRESH_TOKEN']),
  email: Object.freeze(['ORBE_EMAIL']),
  senha: Object.freeze(['ORBE_SENHA']),
} as const);

export type CampoDaCredencial = keyof typeof VARIAVEIS;

/** O que sempre é obrigatório: o endereço do projeto e a chave pública dele. */
const OBRIGATORIAS: readonly CampoDaCredencial[] = ['url', 'chaveAnonima'];

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
  | { readonly ok: true; readonly credenciais: Credenciais; readonly avisos: readonly string[] }
  | {
      readonly ok: false;
      readonly faltam: readonly string[];
      readonly problemas: readonly string[];
      /** Nenhum dos dois caminhos de autenticação veio: a mensagem tem de ensinar os dois. */
      readonly semCaminho: boolean;
    };

/**
 * Como se autenticar, por extenso — os **dois** caminhos, o do token primeiro.
 *
 * Conta criada por OAuth (Google) **não tem senha**: para ela, `signInWithPassword`
 * devolve "Invalid login credentials" para sempre, e quem não sabe disso gasta a tarde
 * conferindo a senha certa de uma conta que nunca teve uma. Por isso a mensagem diz
 * isso antes de listar variável.
 */
export function comoSeAutenticar(): string {
  return [
    'Dois caminhos — o primeiro é o que funciona em conta criada pelo Google (OAuth não tem senha):',
    '',
    `  1) token do navegador (preferido): ${comoExportar('accessToken')}`,
    `     e, para corrida longa, ${comoExportar('refreshToken')} (opcional, mas recomendado)`,
    '     Como pegar os dois: veja "O caminho do token" em scripts/README.md',
    '',
    `  2) e-mail e senha: ${comoExportar('email')} + ${comoExportar('senha')}`,
    '     Só serve em conta que de fato tem senha.',
  ].join('\n');
}

/**
 * A credencial do ambiente, ou **o que falta** (e o que está mal formado). Pura: não
 * abre rede, não toca disco e **não devolve valor nenhum no caminho de erro** — só
 * nomes de variável.
 *
 * Com os dois caminhos preenchidos, **o token ganha** e a senha é ignorada, com aviso:
 * escolher pela senha um ambiente que também tem token seria escolher o caminho que
 * pode nem existir na conta.
 */
export function lerCredenciais(env: Ambiente): LeituraDaCredencial {
  const faltam: string[] = [];
  const problemas: string[] = [];
  for (const campo of OBRIGATORIAS) {
    if (valorDe(env, campo) === null) faltam.push(comoExportar(campo));
  }

  const accessToken = valorDe(env, 'accessToken');
  const refreshToken = valorDe(env, 'refreshToken');
  const email = valorDe(env, 'email');
  const senha = valorDe(env, 'senha');
  const temToken = accessToken !== null;
  const temSenha = email !== null && senha !== null;

  // Meia senha é erro de quem chamou, não um caminho: dizer qual metade falta poupa
  // a volta inteira. Só vale como problema quando não há token para usar no lugar.
  if (!temToken && !temSenha && (email !== null || senha !== null)) {
    problemas.push(
      `para o caminho da senha faltam: ${[email === null ? comoExportar('email') : null, senha === null ? comoExportar('senha') : null]
        .filter((x): x is string => x !== null)
        .join(' e ')}`,
    );
  }

  const url = valorDe(env, 'url');
  if (url !== null) {
    const daUrl = problemaDaUrl(url);
    if (daUrl !== null) problemas.push(`${comoExportar('url')}: ${daUrl}`);
  }

  const semCaminho = !temToken && !temSenha;
  const chaveAnonima = valorDe(env, 'chaveAnonima');
  if (faltam.length > 0 || problemas.length > 0 || semCaminho || url === null || chaveAnonima === null) {
    return { ok: false, faltam, problemas, semCaminho };
  }

  const projeto: Projeto = { url: url.replace(/\/+$/, ''), chaveAnonima };
  if (accessToken !== null) {
    const avisos = temSenha
      ? [`${comoExportar('accessToken')} está definido, então ${comoExportar('senha')} foi ignorada.`]
      : [];
    return { ok: true, credenciais: { ...projeto, via: 'token', accessToken, refreshToken }, avisos };
  }
  // `temSenha` garante os dois; o `if` é prova de tipo, não defesa.
  if (email !== null && senha !== null) {
    return { ok: true, credenciais: { ...projeto, via: 'senha', email, senha }, avisos: [] };
  }
  return { ok: false, faltam, problemas, semCaminho: true };
}

/** Os segredos de uma credencial — o que o `semSegredo` tem de redigir. */
export function segredosDe(c: Credenciais): readonly string[] {
  const out = [c.chaveAnonima];
  if (c.via === 'token') {
    out.push(c.accessToken);
    // O refresh token é **mais** sensível que o de acesso: ele não expira em uma hora.
    if (c.refreshToken !== null) out.push(c.refreshToken);
  } else {
    out.push(c.senha);
  }
  return out;
}

/** A sessão aberta: o client para as leituras e o JWT para o transporte da nuvem. */
export interface Sessao {
  readonly db: ClientDoNucleo;
  readonly userId: string;
  readonly url: string;
  readonly chaveAnonima: string;
  /** Por qual caminho ela abriu — o relatório não vê isto, o `stderr` sim. */
  readonly via: Credenciais['via'];
  /** Quando o token de acesso vence, pelo `exp` que o servidor validou. */
  readonly expiraEm: Date;
  /** Há refresh token (ou senha): a corrida longa sobrevive ao vencimento. */
  readonly podeRenovar: boolean;
  /** Os segredos a redigir de todo diagnóstico — inclui o refresh token. */
  readonly segredos: readonly string[];
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

/** O client do caminho da senha e do token-com-refresh: a sessão vive no client e renova. */
type ClientComAuth = ClientDoNucleo & { auth: ReturnType<typeof createClient>['auth'] };

function construirClient(c: Credenciais, cabecalhoFixo: boolean): ClientComAuth {
  // O `as` é a ponte entre as duas visões do mesmo tipo (ver `ClientDoNucleo`): é o
  // mesmo objeto em execução, e esta é a única linha que precisa dizê-lo.
  return createClient(c.url, c.chaveAnonima, {
    auth: {
      // Nada em disco: a bancada não é um app, e uma sessão persistida aqui
      // viraria token no diretório de quem rodou.
      persistSession: false,
      // **Renova** quando há o que renovar: o JWT vale cerca de uma hora, e uma
      // corrida com `--limite` alto passa disso. Sem renovação, a nuvem começa a
      // devolver 401 no meio da medição e o relatório registra `indisponivel` em
      // janelas que nunca foram medidas de verdade — exatamente a confusão entre
      // "falta credencial" e "a rede caiu" que este módulo existe para não deixar
      // acontecer. Com token avulso não há o que renovar, e ligar o relógio só
      // prenderia o processo sem ganho.
      autoRefreshToken: !cabecalhoFixo,
      detectSessionInUrl: false,
    },
    ...(cabecalhoFixo && c.via === 'token'
      ? {
          // Sem refresh token não há sessão a instalar: o jeito de as leituras do
          // núcleo carregarem o JWT é o cabeçalho fixo do client. As consultas de
          // `data/` não sabem nada disso — elas só recebem o client.
          global: { headers: { Authorization: `Bearer ${c.accessToken}` } },
        }
      : {}),
  }) as unknown as ClientComAuth;
}

/**
 * O `sub` e o `exp` de um token, **validados no servidor**.
 *
 * `getClaims` é o caminho certo para as duas coisas: ele valida a assinatura (e, em
 * projeto com segredo simétrico, pergunta ao servidor, como o `getUser`) e devolve as
 * claims. Decodificar o JWT à mão daria o `exp` sem provar nada — um token adulterado
 * passaria, e a bancada mediria com uma identidade que o banco vai recusar.
 */
async function claimsDoToken(db: ClientComAuth, token: string): Promise<{ sub: string; exp: number }> {
  const recado = (motivo: string): Error =>
    new Error(
      `o token não foi aceito: ${motivo}\n` +
        `  Ele dura cerca de uma hora. Pegue um novo no navegador (veja "O caminho do token" em\n` +
        `  scripts/README.md) e exporte ${comoExportar('accessToken')} de novo.`,
    );

  // `getClaims` **lança** em parte dos casos (token vencido, "JWT has expired") e
  // devolve `{ error }` em outros (token recusado pelo servidor). Medido no ensaio: sem
  // o `try`, o vencido chegava ao dono como um "JWT has expired" pelado, sem dizer que
  // o conserto é pegar outro no navegador — que é a única coisa que ele precisa saber.
  let data: Awaited<ReturnType<ClientComAuth['auth']['getClaims']>>['data'];
  try {
    const r = await db.auth.getClaims(token);
    if (r.error) throw recado(r.error.message);
    data = r.data;
  } catch (e) {
    throw e instanceof Error && e.message.startsWith('o token não foi aceito')
      ? e
      : recado(e instanceof Error ? e.message : String(e));
  }
  const claims = data?.claims;
  const sub = claims?.sub;
  const exp = claims?.exp;
  if (typeof sub !== 'string' || sub === '' || typeof exp !== 'number') {
    throw new Error('o token foi aceito mas não trouxe `sub` e `exp` — não dá para saber de quem é nem até quando vale');
  }
  return { sub, exp };
}

/**
 * Abre a sessão de usuário, pelo caminho que a credencial declara.
 *
 * Lança com a mensagem do provedor — que nomeia o motivo, nunca a credencial. No
 * caminho da senha, `signInWithPassword` numa conta criada por OAuth responde
 * "Invalid login credentials" para sempre; a mensagem daqui diz isso, porque a
 * alternativa é procurar uma senha que não existe.
 */
export async function abrirSessao(c: Credenciais): Promise<Sessao> {
  const comRefresh = c.via === 'token' && c.refreshToken !== null;
  const cabecalhoFixo = c.via === 'token' && c.refreshToken === null;
  const db = construirClient(c, cabecalhoFixo);
  const segredos = segredosDe(c);

  if (c.via === 'senha') {
    const { data, error } = await db.auth.signInWithPassword({ email: c.email, password: c.senha });
    if (error) {
      throw new Error(
        `a sessão não abriu: ${error.message}\n` +
          '  Se esta conta foi criada pelo Google, ela não tem senha e este caminho nunca vai funcionar.\n' +
          `  Use o token do navegador (${comoExportar('accessToken')}); veja scripts/README.md.`,
      );
    }
    const token = data.session?.access_token;
    const userId = data.user?.id;
    if (!token || !userId) throw new Error('a sessão abriu sem access_token ou sem usuário');
    const { exp } = await claimsDoToken(db, token);
    return {
      db,
      userId,
      url: c.url,
      chaveAnonima: c.chaveAnonima,
      via: 'senha',
      expiraEm: new Date(exp * 1000),
      podeRenovar: true,
      segredos,
      tokenAtual: () => tokenVivo(db),
      fechar: () => void db.auth.stopAutoRefresh().catch(() => undefined),
    };
  }

  // O caminho do token. A validação vem primeiro: é ela que distingue "token velho"
  // de "rede caiu", e o erro dela ensina a pegar outro.
  const { sub, exp } = await claimsDoToken(db, c.accessToken);

  if (comRefresh && c.refreshToken !== null) {
    // Com refresh, a sessão é instalada no client: o `autoRefreshToken` passa a valer
    // e `tokenAtual()` lê o token **vivo**, não o que veio do ambiente.
    const { error } = await db.auth.setSession({ access_token: c.accessToken, refresh_token: c.refreshToken });
    if (error) {
      throw new Error(
        `o refresh token não foi aceito: ${error.message}\n` +
          `  Pegue o par novo no navegador (veja scripts/README.md) e exporte ${comoExportar('accessToken')}\n` +
          `  e ${comoExportar('refreshToken')} de novo.`,
      );
    }
    return {
      db,
      userId: sub,
      url: c.url,
      chaveAnonima: c.chaveAnonima,
      via: 'token',
      expiraEm: new Date(exp * 1000),
      podeRenovar: true,
      segredos,
      tokenAtual: () => tokenVivo(db),
      fechar: () => void db.auth.stopAutoRefresh().catch(() => undefined),
    };
  }

  // Token avulso: nada renova, e o token fixo é o que vai no cabeçalho e no transporte.
  const token = c.accessToken;
  return {
    db,
    userId: sub,
    url: c.url,
    chaveAnonima: c.chaveAnonima,
    via: 'token',
    expiraEm: new Date(exp * 1000),
    podeRenovar: false,
    segredos,
    tokenAtual: async () => token,
    fechar: () => undefined,
  };
}

/** O token corrente da sessão instalada no client — já renovado, quando foi preciso. */
async function tokenVivo(db: ClientComAuth): Promise<string> {
  const { data, error } = await db.auth.getSession();
  if (error) throw new Error(`a sessão não renovou: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error('a sessão venceu e não renovou');
  return token;
}

/**
 * O aviso sobre a validade do token, antes de a medição começar — ou `null` quando não
 * há o que avisar.
 *
 * Puro, e é por isso que tem teste: ele faz a conta que decide se vale apertar o botão.
 * Uma corrida de 28 chamadas com um token de 3 minutos de vida não termina, e descobrir
 * isso no meio custa as chamadas já pagas e um relatório cheio de `indisponivel` em
 * janelas que nunca foram medidas.
 */
export function avisoDeValidade(a: {
  readonly expiraEm: Date;
  readonly podeRenovar: boolean;
  readonly chamadas: number;
  readonly prazoMs: number;
  readonly agora: Date;
}): string | null {
  if (a.podeRenovar) return null;
  const restamMs = a.expiraEm.getTime() - a.agora.getTime();
  const minutos = Math.floor(restamMs / 60_000);
  if (restamMs <= 0) {
    return (
      `o token de acesso já venceu (${a.expiraEm.toISOString()}). Pegue um novo no navegador — e ` +
      `exporte também ${comoExportar('refreshToken')}, que resolve corrida longa.`
    );
  }
  const base = `o token de acesso vence em ${minutos} min e não há ${comoExportar('refreshToken')} para renovar.`;
  if (a.chamadas === 0) return base;
  // A estimativa é pelo pior caso: cada chamada pode levar o prazo inteiro. É
  // deliberadamente pessimista — errar para o lado do aviso custa um aviso a mais;
  // errar para o outro custa a corrida.
  const piorCasoMs = a.chamadas * a.prazoMs;
  if (piorCasoMs > restamMs) {
    const pior = Math.ceil(piorCasoMs / 60_000);
    return (
      `${base}\n` +
      `  ${a.chamadas} chamadas podem levar até ${pior} min (pior caso), então a corrida provavelmente NÃO termina.\n` +
      `  O caminho é exportar também ${comoExportar('refreshToken')} — veja scripts/README.md.`
    );
  }
  return base;
}
