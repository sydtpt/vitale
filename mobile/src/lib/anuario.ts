/**
 * O anuário do ano, **fora do React** — o estado e as transições da leitura dos
 * doze meses (Story 3.2).
 *
 * `useAnuarioDoAno` lê o arquivo e desenha; tudo o que ele *decide* mora aqui, e
 * pelo mesmo motivo medido da parede (`lib/parede.ts`): enquanto as transições
 * moravam dentro do hook, nada as executava — trocar uma delas deixava a tela
 * mentindo com a suíte inteira verde, porque este workspace não tem renderizador
 * de teste.
 *
 * ## A pergunta que estas três fases respondem
 *
 * *O ano pode afirmar silêncio?* A matriz de I/O da story é explícita: **o ano
 * não afirma silêncio antes de saber**. Com os meses em voo, a frase *"nenhum mês
 * de 2024 reuniu medida bastante para liderar"* seria uma afirmação sobre um
 * arquivo que ninguém leu — e ela apareceria por um instante em **todo** ano,
 * inclusive nos que têm doze líderes.
 *
 * Por isso `carregando` e `sem-tiras` são fases distintas, e nenhuma das duas
 * desenha a frase: quem a desenha é `pronto`, depois de o núcleo
 * (`montarAnuario`) dizer que não há líder nenhum.
 *
 * ## A chave, e o quadro de atraso que ela mata
 *
 * O estado carrega **a chave da leitura que o produziu** — a conta e o ano. Sem
 * ela, trocar de conta (ou de ano, num `replace` de rota) deixava o estado
 * `pronto` da leitura anterior no ar por um quadro: o efeito que dispara a
 * releitura só roda **depois** do render, então o ano novo desenharia os doze
 * meses do dono anterior antes de qualquer coisa acontecer. Com a chave, quem lê
 * o estado compara e recebe `carregando` já no primeiro quadro.
 *
 * ## E quando a leitura falha
 *
 * `sem-tiras`: **o texto do ano abre sem as tiras**. A edição não depende delas —
 * a capa, o sumário e os quatro cadernos continuam sendo o que sempre foram —, e
 * um aviso de erro no topo da página trocaria uma ausência discreta por um
 * alarme sobre uma coisa que o leitor não pediu. O motivo vai para o log.
 */
import type { EdicaoNoArquivo } from '@vitale/shared';

/**
 * A identidade de uma leitura: **de quem** e **de que ano**.
 *
 * `\u0000` como separador porque um id de usuário não o contém, e `-` ou `|`
 * poderiam colidir entre um uid vazio e um ano — a mesma escolha da chave de
 * período em `revista/parede.ts`.
 */
export function chaveDoAnuario(uid: string | null | undefined, ano: number | null): string {
  return `${uid ?? ''}\u0000${ano ?? ''}`;
}

export type FaseDoAnuario =
  /** Os meses ainda não chegaram. Nada se afirma sobre o ano. */
  | { readonly fase: 'carregando' }
  /**
   * O arquivo chegou. O que ele **diz** sobre o ano é do núcleo, e não daqui: o
   * estado guarda as linhas cruas e quem monta é `montarAnuario`, no hospedeiro.
   * Guardar o `Anuario` já montado prenderia o ano nesta fase, e o ano é do
   * endereço — não da leitura.
   */
  | { readonly fase: 'pronto'; readonly arquivo: readonly EdicaoNoArquivo[] }
  /** Sem sessão, endereço ilegível, ou a leitura falhou: a edição abre sem as tiras. */
  | { readonly fase: 'sem-tiras' };

export type EstadoDoAnuario = FaseDoAnuario & {
  /**
   * Qual leitura produziu este estado. A resposta de uma carga superada — a
   * conta trocou, o ano do endereço mudou — é **ignorada**: sem isso, a resposta
   * velha chega depois e desenha os meses de outro ano.
   */
  readonly carga: number;
  /** De quem e de que ano é este estado. Ver {@link chaveDoAnuario}. */
  readonly chave: string;
};

export type AcaoDoAnuario =
  /** Uma leitura começou, para esta chave. */
  | { readonly tipo: 'ler'; readonly carga: number; readonly chave: string }
  | { readonly tipo: 'arquivo'; readonly carga: number; readonly arquivo: readonly EdicaoNoArquivo[] }
  /** Sem sessão, ou a leitura não veio — as duas caem no mesmo lugar. */
  | { readonly tipo: 'sem-tiras'; readonly carga: number };

/** O estado de um anuário que ainda não leu nada. */
export function anuarioInicial(): EstadoDoAnuario {
  return { fase: 'carregando', carga: 0, chave: chaveDoAnuario(null, null) };
}

/**
 * A transição — **a regra inteira do hospedeiro, pura**.
 *
 * `ler` **sempre volta para `carregando`**, e aqui isso é o contrário da parede.
 * Lá, a releitura a cada foco não podia apagar as capas já desenhadas; aqui, uma
 * leitura nova só acontece quando o ano do endereço muda ou a conta troca — e
 * nos dois casos o arquivo anterior é de outro ano ou de outro dono. Mantê-lo na
 * tela desenharia as doze formas erradas enquanto as certas não chegam.
 *
 * Toda ação que não seja `ler` é ignorada quando vem de uma carga superada.
 */
export function proximoAnuario(atual: EstadoDoAnuario, acao: AcaoDoAnuario): EstadoDoAnuario {
  if (acao.tipo === 'ler') return { fase: 'carregando', carga: acao.carga, chave: acao.chave };
  if (acao.carga !== atual.carga) return atual;
  return acao.tipo === 'arquivo'
    ? { fase: 'pronto', arquivo: acao.arquivo, carga: atual.carga, chave: atual.chave }
    : { fase: 'sem-tiras', carga: atual.carga, chave: atual.chave };
}

/**
 * O estado **vale para esta chave**? — a guarda que mata o quadro de atraso.
 *
 * Ela é a pergunta que o hospedeiro faz **no render**, antes do efeito rodar: um
 * estado de outra conta ou de outro ano não descreve o que está na tela, e
 * desenhá-lo é mostrar os doze meses do dono anterior. Mora aqui, e não no hook,
 * porque é a única regra do conjunto que nenhuma transição produz — e por isso
 * seria a única sem teste.
 */
export function anuarioValePara(estado: EstadoDoAnuario, chave: string): boolean {
  return estado.chave === chave;
}
