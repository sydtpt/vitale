/**
 * BARREIRA — **a linha de entrada da lua carrega o veredito** (Story 4.4).
 *
 * A emenda de 01/10/2026 à ADR 0045 declara uma afirmação universal: *a linha de
 * entrada, no pé do caderno Sono, carrega o veredito por extenso para toda tupla
 * que o protocolo possa produzir*. É ela que paga a cláusula §3 — *"o negativo
 * não vai (…) atrás de um toque"* — e é a única coisa que o leitor que nunca
 * toca lê.
 *
 * **Sem esta barreira, a emenda fica falsa com tudo verde.** Trocar
 *
 *     lua={lua[c.caderno]}
 *
 * por `lua={undefined}` compila, o `tsc` aceita (a prop é opcional), e nenhuma
 * outra suíte repara: a regra do núcleo continua com as 81 tuplas passando, a
 * sub-página continua existindo, e o pé do caderno Sono fica vazio. O mesmo vale
 * para trocar `{l.placar}` por um rótulo autorado — *"Veja o teste da lua"* — que
 * é a forma educada da gaveta.
 *
 * É o modo de falha do `anuario-fiacao.test.ts` e do `silencio-fiacao.test.ts`, e
 * a resposta é a mesma: guarda de **código-fonte**, não de comportamento. Este
 * workspace não tem renderizador de teste, e a spec não pede dependência nova.
 *
 * O que ela cobra:
 *
 * - a rota **lê o veredito** (`useVereditoLunar`), compõe pela **regra do núcleo**
 *   (`fraseColetivaDe`) e entrega o texto na prop do `Caderno`;
 * - ela entrega **só no estado `pronto`** — carregando e "não deu para ler" não
 *   desenham o quarto estado;
 * - o `Caderno` recebe a prop e monta a linha; a linha imprime **os dois
 *   compartimentos das duas famílias**, lidos da frase;
 * - **nenhum texto de placar é autorado na tela** — nem na rota, nem na abertura
 *   da sub-página;
 * - a página **lê** e nunca calcula: `vereditoLunar(` não aparece em tela nenhuma;
 * - a rota da sub-página está registrada, e a entrada abre justamente ela;
 * - os 68% viajam **em prosa**, e não no `alt` da figura.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');
const ROTA = join(APP, 'revista', '[tipo]', '[inicio].tsx');
const PAGINA = join(APP, 'sono', 'lua.tsx');
const LAYOUT = join(APP, '_layout.tsx');
const HOOK = join(__dirname, '..', '..', 'hooks', 'useVereditoLunar.ts');

/** O fonte sem comentário de linha nem de bloco — a regra citada em prosa não conta. */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * O corpo de uma função, por contagem de chaves — o mesmo de `anuario-fiacao`.
 *
 * Uma regex não serve: o corpo tem JSX com chaves aninhadas em cada expressão, e
 * qualquer parada no primeiro `}` cortaria a função na primeira prop.
 */
function corpoDe(fonte: string, funcao: string): string | null {
  const abre = fonte.indexOf(`function ${funcao}(`);
  if (abre < 0) return null;
  const inicio = fonte.indexOf('{', fonte.indexOf(')', abre));
  if (inicio < 0) return null;
  let profundidade = 0;
  for (let i = inicio; i < fonte.length; i += 1) {
    if (fonte[i] === '{') profundidade += 1;
    else if (fonte[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return fonte.slice(inicio, i + 1);
    }
  }
  return null;
}

/**
 * O vocabulário do placar e do segundo compartimento.
 *
 * Nenhuma destas palavras pode aparecer em **código** de tela: elas são saída da
 * regra do núcleo, varrida por tupla em `lua-frase.test.ts`. Uma delas num
 * literal de componente é um rótulo autorado passando por veredito — e aí a
 * garantia da emenda vale para a frase que alguém digitou, não para as 81.
 */
const VOCABULARIO_DO_VEREDITO: readonly string[] = [
  'decidiu',
  'decidiram',
  'não foi lida',
  'não foram lidas',
  'sem poder',
  'nenhum padrão',
  'inconclusivo',
  'A cheia',
  'As três',
];

describe('BARREIRA — a linha de entrada da lua carrega o veredito', () => {
  const rota = semComentario(ROTA);
  const pagina = semComentario(PAGINA);

  it('as funções que a barreira mira existem — ela não ficou sem alvo', () => {
    for (const f of ['Edicao', 'Caderno', 'EntradaDaLuaNoPe', 'LinhaDaLua']) {
      expect({ funcao: f, achou: corpoDe(rota, f) !== null }).toEqual({ funcao: f, achou: true });
    }
    for (const f of ['SonoLuaScreen', 'FraseColetivaNaPagina', 'LinhaColetiva']) {
      expect({ funcao: f, achou: corpoDe(pagina, f) !== null }).toEqual({ funcao: f, achou: true });
    }
  });

  /**
   * O coração da barreira: a rota lê o veredito, compõe pela regra e **entrega** o
   * texto na prop. Apagar qualquer um dos três elos deixa o pé do caderno Sono
   * vazio sem nada reclamar.
   */
  it('a rota lê o veredito, compõe pela regra do núcleo e entrega na prop', () => {
    const corpo = corpoDe(rota, 'Edicao') ?? '';
    expect(corpo).toContain('useVereditoLunar');
    expect(corpo).toContain('fraseColetivaDe');
    // A composição vai dentro do objeto que a prop carrega — não é uma variável
    // calculada e esquecida.
    expect(corpo).toMatch(/frase:\s*fraseColetivaDe\(/);
    expect(corpo).toMatch(/lua=\{lua\[c\.caderno\]\}/);
  });

  /** A linha só aparece quando a leitura fechou: carregando não é "ainda não rodou". */
  it('a rota entrega só no estado pronto', () => {
    const corpo = corpoDe(rota, 'Edicao') ?? '';
    expect(corpo).toMatch(/veredito\.estado === 'pronto'/);
  });

  /** E ela é do Sono: a lua é página **dentro** do caderno Sono, não de outro. */
  it('a prop é por caderno, e o caderno é o Sono', () => {
    expect(rota).toMatch(/CADERNO_DA_LUA: CadernoId = 'sono'/);
    expect(corpoDe(rota, 'Edicao') ?? '').toContain('[CADERNO_DA_LUA]');
  });

  /** O `Caderno` recebe a prop e monta a linha — sem ela, a prop morre no caminho. */
  it('o Caderno recebe a prop e monta a linha no pé', () => {
    // A prop vive na assinatura, que `corpoDe` não alcança — ela corta no corpo.
    expect(rota).toMatch(/lua\?:\s*EntradaDaLua;/);
    const corpo = corpoDe(rota, 'Caderno') ?? '';
    expect(corpo).toMatch(/\{lua \? <EntradaDaLuaNoPe entrada=\{lua\}/);
  });

  /**
   * **As duas linhas, e os dois compartimentos de cada uma.** É a invariante de
   * forma que a emenda declara: nenhuma linha some, nenhum compartimento some, e
   * as duas nunca viram um número só.
   */
  it('a linha imprime as duas famílias, com os dois compartimentos de cada', () => {
    const entrada = corpoDe(rota, 'EntradaDaLuaNoPe') ?? '';
    expect(entrada).toMatch(/entrada\.frase\.linhas\.map\(/);
    expect(entrada).toContain('<LinhaDaLua');
    const linha = corpoDe(rota, 'LinhaDaLua') ?? '';
    expect(linha).toContain('{l.rotulo}');
    expect(linha).toContain('{l.placar}');
    expect(linha).toContain('{l.porque}');
  });

  /** E o leitor de tela recebe os quatro compartimentos, não só o primeiro. */
  it('o rótulo acessível carrega o placar e o porquê das duas famílias', () => {
    const entrada = corpoDe(rota, 'EntradaDaLuaNoPe') ?? '';
    expect(entrada).toMatch(/l\.rotulo[\s\S]{0,40}l\.placar[\s\S]{0,40}l\.porque/);
    expect(entrada).toMatch(/accessibilityLabel=\{lido\}/);
  });

  /**
   * Nenhum rótulo autorado. Trocar `{l.placar}` por `"Veja o teste da lua"` é a
   * gaveta em versão educada, e é o que esta asserção reprova.
   */
  it('nenhum texto de veredito é autorado na rota', () => {
    for (const p of VOCABULARIO_DO_VEREDITO) {
      expect({ palavra: p, naRota: rota.includes(p) }).toEqual({ palavra: p, naRota: false });
    }
  });

  /** O mesmo na abertura da sub-página: o texto é o da regra, não o da tela. */
  it('a abertura da sub-página também lê a frase, em vez de escrevê-la', () => {
    const bloco = corpoDe(pagina, 'FraseColetivaNaPagina') ?? '';
    expect(bloco).toMatch(/frase\.linhas\.map\(/);
    const linha = corpoDe(pagina, 'LinhaColetiva') ?? '';
    expect(linha).toContain('{l.rotulo}');
    expect(linha).toContain('{l.placar}');
    expect(linha).toContain('{l.porque}');
    for (const p of VOCABULARIO_DO_VEREDITO) {
      expect({ palavra: p, naFrase: `${bloco}${linha}`.includes(p) })
        .toEqual({ palavra: p, naFrase: false });
    }
  });

  /**
   * **A página lê, e nunca calcula.** Uma execução é uma decisão do dono, não um
   * render: chamar o motor ao abrir gravaria... nada, mas o contador da §7.4
   * deixaria de significar *quantas vezes ele decidiu olhar*, que é a peça
   * anti-gaveta inteira.
   */
  it('nenhuma tela chama o motor', () => {
    for (const [onde, fonte] of [['rota', rota], ['página', pagina], ['hook', semComentario(HOOK)]] as const) {
      expect({ onde, chama: /(^|[^A-Za-z])vereditoLunar\s*\(/.test(fonte) })
        .toEqual({ onde, chama: false });
    }
    expect(semComentario(HOOK)).toContain('fetchUltimaExecucaoLunar');
    expect(semComentario(HOOK)).toContain('contarExecucoesLunares');
  });

  /** A sub-página existe na pilha, e o voltar dela devolve o caderno montado. */
  it('a rota /sono/lua está registrada com slide_from_right', () => {
    const layout = semComentario(LAYOUT);
    expect(layout).toMatch(/name="sono\/lua" options=\{\{ animation: 'slide_from_right' \}\}/);
    expect(corpoDe(rota, 'EntradaDaLuaNoPe') ?? '').toContain('ROTA_DA_LUA');
    expect(rota).toMatch(/ROTA_DA_LUA = '\/sono\/lua'/);
  });

  /**
   * Os 68% viajam **em prosa**, não no `alt` da figura.
   *
   * Escrito como barreira porque o "conserto" natural é enfiar o número no `alt` e
   * apagar o parágrafo — e aí quem usa leitor de tela perde o portador dele.
   */
  it('a medida dos 68% está em prosa, e fora do alt da figura', () => {
    const alt = /ALT_DA_FIGURA =\s*([\s\S]*?);/.exec(pagina)?.[1] ?? '';
    expect(alt.length).toBeGreaterThan(0);
    expect(alt).not.toContain('68');
    expect(pagina).toContain('68% do ciclo');
  });

  /**
   * **O quarto estado aparece inteiro, e não fabrica número nenhum.**
   *
   * É o estado real hoje — `lua_execucoes` está vazia —, e é onde a página passa a
   * maior parte do tempo. A moldura tem os cinco campos; *Próxima leitura* vira
   * *Primeira leitura* e imprime a **condição**; e *Noites e ciclos* diz o que o
   * protocolo fixa, porque uma contagem que ninguém mediu seria inventada.
   */
  it('o quarto estado tem a moldura inteira, com a condição e sem número fabricado', () => {
    const campos = /function camposDaMoldura\(([\s\S]*?)\n}/.exec(pagina)?.[1] ?? '';
    expect(campos.length).toBeGreaterThan(0);
    for (const rotulo of ['Janela testada', 'Desfecho', 'Noites e ciclos', 'Execuções']) {
      expect(campos).toContain(rotulo);
    }
    expect(campos).toContain('Primeira leitura');
    expect(campos).toContain('Próxima leitura');
    expect(campos).toContain('quando a primeira execução autorizada rodar');
    // Sem execução, o campo das noites sai do protocolo — nunca de um literal.
    expect(campos).toContain('INICIO_DO_ACERVO_LUNAR');
    expect(campos).toContain('NOITES_MINIMAS_POR_COLUNA');
    expect(campos).toContain('CICLOS_MINIMOS');
    // Nome de story num campo de leitor faz o estado ler como "esperando o build".
    expect(campos).not.toMatch(/\b4\.2\b|story/i);
  });

  /**
   * E *"sem leitura"* ocupa a **vaga da palavra de veredito** — não um travessão,
   * que leria como nulo *medido*, e não uma linha de apoio, que seria corpo menor
   * mais tinta de apoio: duas das três atenuações que a ADR 0045 §3 proíbe por
   * nome, no estado em que a página vive hoje.
   */
  it('"sem leitura" ocupa a vaga do veredito, no degrau e na tinta dele', () => {
    const bloco = corpoDe(pagina, 'BlocoDaFase') ?? '';
    expect(bloco).toMatch(/resultado === null \? SEM_LEITURA : PALAVRA_DO_VEREDITO/);
    expect(bloco).toMatch(/style=\{styles\.veredito\}/);
    expect(bloco).toContain('APOIO_SEM_LEITURA');
    // A folha prende o degrau e a tinta da vaga do veredito.
    expect(pagina).toMatch(/veredito: \{ fontSize: 21,[^}]*color: colors\.ink[,} ]/);
    expect(bloco).not.toContain('—');
  });

  /**
   * A procedência não é assinatura de modelo: o rótulo é `aritmética`, e não
   * `motor` — que neste app é a palavra de **motor de IA**.
   */
  it('o rodapé carimba aritmética, nunca motor', () => {
    const rodape = corpoDe(pagina, 'RodapeDoMetodo') ?? '';
    expect(rodape).toContain('aritmética v');
    expect(rodape).not.toContain('motor v');
  });
});
