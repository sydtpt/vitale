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
 * **Ela cobra fiação, e não valor.** Esta é a lição da revisão de 01/10: a barreira de
 * texto prova que a chamada **existe**, nunca que o valor está certo — três mutações
 * mataram a feature com as 85 suítes verdes, e nenhuma delas é visível daqui. O valor
 * mora em `lua.test.ts`, onde a composição é comparada com a regra do núcleo palavra
 * por palavra. As duas são necessárias, e nenhuma substitui a outra.
 *
 * O que ela cobra:
 *
 * - a rota **lê o veredito** (`useVereditoLunar`), compõe pela **função pura**
 *   (`entradaDaLua`, que chama a regra do núcleo) e entrega o texto na prop do
 *   `Caderno`;
 * - o `Caderno` recebe a prop e monta a linha; a linha imprime **os dois
 *   compartimentos das duas famílias**, lidos da frase;
 * - a linha abre a sub-página com **`push`**, e nunca `replace`;
 * - a tipografia da **linha** prende o corpo, a tinta e a ausência de itálico — é na
 *   linha que a emenda à ADR 0045 faz a afirmação, e era a superfície que não tinha
 *   asserção nenhuma;
 * - **nenhum texto de placar é autorado na tela** — nem na rota, nem no hospedeiro,
 *   nem na abertura da sub-página;
 * - a página **lê** e nunca calcula: `vereditoLunar(` não aparece em tela nenhuma;
 * - a moldura, os grupos e o rodapé desenham **fora** do `pronto ?`;
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
/** O hospedeiro puro: o estado, a composição, a moldura e a figura. */
const HOSPEDEIRO = join(__dirname, '..', 'lua.ts');

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
  const hospedeiro = semComentario(HOSPEDEIRO);

  it('as funções que a barreira mira existem — ela não ficou sem alvo', () => {
    for (const f of ['Edicao', 'Caderno', 'EntradaDaLuaNoPe', 'LinhaDaLua']) {
      expect({ funcao: f, achou: corpoDe(rota, f) !== null }).toEqual({ funcao: f, achou: true });
    }
    for (const f of ['SonoLuaScreen', 'FraseColetivaNaPagina', 'LinhaColetiva', 'AvisoDaLeitura']) {
      expect({ funcao: f, achou: corpoDe(pagina, f) !== null }).toEqual({ funcao: f, achou: true });
    }
    for (const f of ['entradaDaLua', 'camposDaMoldura', 'proximoVeredito', 'vereditoValePara']) {
      expect({ funcao: f, achou: corpoDe(hospedeiro, f) !== null })
        .toEqual({ funcao: f, achou: true });
    }
  });

  /**
   * O coração da barreira: a rota lê o veredito, compõe pela **função pura** e
   * **entrega** o texto na prop. Apagar qualquer um dos três elos deixa o pé do
   * caderno Sono vazio sem nada reclamar.
   */
  it('a rota lê o veredito, compõe pelo hospedeiro e entrega na prop', () => {
    const corpo = corpoDe(rota, 'Edicao') ?? '';
    expect(corpo).toContain('useVereditoLunar');
    // A composição vai dentro do objeto que a prop carrega — não é uma variável
    // calculada e esquecida —, e ela recebe o veredito LIDO, não um literal.
    expect(corpo).toMatch(/entradaDaLua\(veredito,\s*periodoDaLua\)/);
    expect(corpo).toMatch(/lua=\{lua\[c\.caderno\]\}/);
  });

  /**
   * **A regra de quem desenha mora no hospedeiro, e o valor dela é testado lá.**
   *
   * A rota não decide estado nenhum: era aí que apertar o portão para
   * `execucao !== null` passava verde e deixava o pé do caderno sem linha no único
   * estado que o aparelho tem hoje. Aqui se cobra que ela **não** decide, e que a
   * composição e a regra do núcleo estão do outro lado.
   */
  it('a rota não filtra estado por conta — quem decide é o hospedeiro', () => {
    const corpo = corpoDe(rota, 'Edicao') ?? '';
    expect(corpo).not.toMatch(/veredito\.estado\s*===/);
    const composicao = corpoDe(hospedeiro, 'entradaDaLua') ?? '';
    expect(composicao).toContain('fraseColetivaDe');
    expect(composicao).toContain('fraseDaFalha');
    // Os dois estados que produzem entrada, e os que não produzem: a falha DESENHA,
    // senão `/sono/lua` fica inalcançável até a migração.
    expect(composicao).toMatch(/case 'pronto'/);
    expect(composicao).toMatch(/case 'falhou'/);
    expect(composicao).toMatch(/return undefined/);
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

  /**
   * E o leitor de tela recebe os dois compartimentos das duas famílias — **pela
   * leitura que o núcleo compõe**, e não por concatenação na tela.
   *
   * `${l.rotulo}. ${l.placar}` dava *"A cheia. A cheia decidiu."*: o rótulo e o começo
   * do placar são o mesmo texto, e a gagueira só existe para quem ouve. E o rótulo
   * **nomeia o destino**, porque o `accessibilityHint` pode estar desligado nos
   * Ajustes.
   */
  it('o rótulo acessível sai da leitura do núcleo e nomeia o destino', () => {
    const entrada = corpoDe(rota, 'EntradaDaLuaNoPe') ?? '';
    expect(entrada).toMatch(/l\.leitura/);
    expect(entrada).toMatch(/accessibilityLabel=\{lido\}/);
    expect(entrada).toMatch(/lido = `\$\{NOME_DO_DESTINO\}/);
    // A concatenação que gagueja não volta pela porta de trás.
    expect(entrada).not.toMatch(/\$\{l\.rotulo\}\. \$\{l\.placar\}/);
    expect(rota).toMatch(/NOME_DO_DESTINO = '[^']+'/);
  });

  /**
   * **`push`, e nunca `replace`.** O Code Map da spec diz por escrito que `replace`
   * não serve: o voltar da sub-página é `router.back()` puro, e a rolagem do chamador
   * se preserva porque o `Stack` mantém a tela montada. Com `replace` a edição é
   * desmontada, o voltar não tem para onde voltar, e o caderno não é devolvido na
   * posição — e a troca passava verde.
   */
  it('a entrada abre a sub-página com push, levando o período', () => {
    const entrada = corpoDe(rota, 'EntradaDaLuaNoPe') ?? '';
    expect(entrada).toMatch(/router\.push\(\{\s*pathname:\s*ROTA_DA_LUA/);
    expect(entrada).toMatch(/params:\s*\{\s*periodo:\s*entrada\.periodo\s*\}/);
    expect(entrada).not.toContain('router.replace');
    expect(entrada).not.toContain('router.navigate');
  });

  /**
   * **A tipografia da LINHA**, que é a superfície sobre a qual a emenda à ADR 0045 faz
   * a afirmação — e era a que não tinha asserção nenhuma. A barreira prendia o degrau
   * e a tinta da **sub-página**, então rebaixar o placar da linha para 11 px em `ink3`
   * e o porquê para 9 px em itálico — **as três atenuações que o §3 proíbe por nome** —
   * passava em tudo.
   *
   * O par é 19/15 contra o 24/17 da abertura da página: menor que a abertura é
   * deliberado (a linha vive dentro do texto de um caderno), e o que o §3 cobra é
   * paridade entre o negativo e o positivo **no mesmo lugar**.
   */
  it('a linha prende corpo, tinta e ausência de itálico nos dois compartimentos', () => {
    const CORPO_DA_LINHA: readonly [string, number][] = [['luaPlacar', 19], ['luaPorque', 15]];
    for (const [estilo, corpo] of CORPO_DA_LINHA) {
      const folha = new RegExp(`${estilo}: \\{([^}]*)\\}`).exec(rota)?.[1] ?? '';
      expect({ estilo, achou: folha.length > 0 }).toEqual({ estilo, achou: true });
      expect({ estilo, corpo: `fontSize: ${String(corpo)}`, tem: folha.includes(`fontSize: ${String(corpo)}`) })
        .toEqual({ estilo, corpo: `fontSize: ${String(corpo)}`, tem: true });
      // Tinta cheia: `ink`, e nunca `ink2` nem `ink3`.
      expect({ estilo, tinta: /color: colors\.ink[,} ]/.test(folha) })
        .toEqual({ estilo, tinta: true });
      for (const atenuada of ['ink2', 'ink3']) {
        expect({ estilo, atenuada, usa: folha.includes(`colors.${atenuada}`) })
          .toEqual({ estilo, atenuada, usa: false });
      }
      // Sem itálico, que é a terceira atenuação proibida por nome.
      expect({ estilo, italico: folha.includes('fontStyle') }).toEqual({ estilo, italico: false });
    }
    // E o rótulo da família continua no corpo dele, acima do par.
    expect(rota).toMatch(/luaFamRotulo: \{ fontSize: 14,[^}]*color: colors\.ink[,} ]/);
  });

  /**
   * Nenhum rótulo autorado. Trocar `{l.placar}` por `"Veja o teste da lua"` é a
   * gaveta em versão educada, e é o que esta asserção reprova. **O hospedeiro entra
   * na conta**: a composição mora lá, e um literal lá é a mesma gaveta um arquivo
   * adiante.
   */
  it('nenhum texto de veredito é autorado na rota nem no hospedeiro', () => {
    for (const [onde, fonte] of [['rota', rota], ['hospedeiro', hospedeiro]] as const) {
      for (const p of VOCABULARIO_DO_VEREDITO) {
        expect({ onde, palavra: p, autorado: fonte.includes(p) })
          .toEqual({ onde, palavra: p, autorado: false });
      }
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
    const fontes = [
      ['rota', rota], ['página', pagina], ['hook', semComentario(HOOK)],
      ['hospedeiro', hospedeiro],
    ] as const;
    for (const [onde, fonte] of fontes) {
      expect({ onde, chama: /(^|[^A-Za-z])vereditoLunar\s*\(/.test(fonte) })
        .toEqual({ onde, chama: false });
    }
    expect(semComentario(HOOK)).toContain('fetchUltimaExecucaoLunar');
    expect(semComentario(HOOK)).toContain('contarExecucoesLunares');
  });

  /**
   * **O hook é cola, e a decisão mora fora dele.**
   *
   * Enquanto as transições viviam dentro do `useReducer`, nada as executava: apagar a
   * guarda de carga e trocar `vereditoValePara` por `return true` deixou o `tsc` em 0 e
   * 85 suítes verdes. Esta asserção impede a volta — o hook importa as transições, e
   * não as declara.
   */
  it('as transições moram no hospedeiro, e o hook só as usa', () => {
    const hook = semComentario(HOOK);
    for (const nome of ['proximoVeredito', 'vereditoInicial', 'vistaDoVeredito', 'chaveDoVeredito']) {
      expect({ nome, usa: hook.includes(nome) }).toEqual({ nome, usa: true });
      expect({ nome, declara: hook.includes(`function ${nome}(`) }).toEqual({ nome, declara: false });
    }
    expect(hook).toMatch(/from '\.\.\/lib\/lua'/);
    // E a guarda da carga continua no hospedeiro, com a chave ao lado.
    expect(corpoDe(hospedeiro, 'proximoVeredito') ?? '').toMatch(/acao\.carga !== atual\.carga/);
    expect(corpoDe(hospedeiro, 'vereditoValePara') ?? '').toMatch(/estado\.chave === chave/);
  });

  /**
   * **A moldura, os grupos e o rodapé desenham nos cinco estados.**
   *
   * Tudo isso ficava atrás de `{pronto ? … : null}`, então no estado em que a página
   * vive hoje a prosa do método, as datas, o α de cada família e os quatro blocos eram
   * invisíveis — e o docblock da própria `MolduraDaLua` diz "cinco campos, sempre na
   * mesma ordem, nos quatro estados". Era a variante curta que a página declara não ter.
   */
  it('a moldura, os grupos e o rodapé não ficam atrás de um pronto', () => {
    const tela = corpoDe(pagina, 'SonoLuaScreen') ?? '';
    for (const bloco of ['<MolduraDaLua', '<GrupoDaFamilia', '<RodapeDoMetodo']) {
      const onde = tela.indexOf(bloco);
      expect({ bloco, monta: onde > -1 }).toEqual({ bloco, monta: true });
      // **O que vem imediatamente antes dele.** Embrulhar os três em
      // `{… ? ( … ) : null}` põe um `? (` aqui, e é esse o guarda que o revisor
      // apertou: a tela só desenhava no `pronto`, que é o estado que o aparelho NÃO
      // tem hoje.
      const antes = tela.slice(Math.max(0, onde - 160), onde);
      expect({ bloco, atrasDeTernario: /\?\s*\(\s*(<>\s*)?$/.test(antes) })
        .toEqual({ bloco, atrasDeTernario: false });
      expect({ bloco, condicionado: /\bpronto\b[^<]*$/.test(antes) })
        .toEqual({ bloco, condicionado: false });
    }
    // E o aviso da leitura responde pelos quatro estados que não são o `pronto`.
    const aviso = corpoDe(pagina, 'AvisoDaLeitura') ?? '';
    for (const e of ["'carregando'", "'sem-sessao'", "'falhou'"]) {
      expect({ estado: e, trata: aviso.includes(e) }).toEqual({ estado: e, trata: true });
    }
    // A falha de integridade é dita, e o recado acionável sobe para a tela.
    expect(aviso).toContain("'integridade'");
    expect(aviso).toMatch(/\{veredito\.recado\}/);
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
    // A medida viaja em prosa, e **duas vezes**: na legenda da figura e no rodapé do
    // método. Ela é composta no hospedeiro — a legenda entregava 30, 20 e 68% sem a
    // oração que os reconcilia, e o comentário do código prometia essa oração.
    expect((pagina.match(/\{MEDIDA_DO_CICLO\}/g) ?? []).length).toBeGreaterThanOrEqual(2);
    const medida = /MEDIDA_DO_CICLO =\s*([\s\S]*?);\n/.exec(hospedeiro)?.[1] ?? '';
    expect(medida).toContain('Contar discos dá');
    expect(medida).toContain('porcentoDoCiclo');
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
    const campos = corpoDe(hospedeiro, 'camposDaMoldura') ?? '';
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
    // **Nenhuma guarda de teatro.** `veredito` e `acervo` não são nuláveis em
    // `ExecucaoLunar`: testá-los era afirmar que os tipos estão errados.
    expect(campos).not.toMatch(/lido === null/);
    expect(campos).not.toMatch(/acervo === null/);
    expect(campos).toMatch(/execucao === null/);
  });

  /**
   * **Uma fonte por número, e nenhum número redigitado.**
   *
   * A figura tinha `const NOITES_DA_JANELA = 5` enquanto a moldura lia `op.janelaNoites`
   * da sonda: duas fontes para o mesmo número na mesma tela. E o limiar, as datas do
   * pré-registro e a latitude eram prosa fixa em três lugares, com as constantes
   * importadas ao lado.
   */
  it('a página deriva o limiar, as datas, a latitude e as noites da janela', () => {
    for (const constante of [
      'LIMIAR_EM_PALAVRAS', 'DATA_DO_PRE_REGISTRO', 'COORDENADA_DA_LUZ', 'MEDIDA_DO_CICLO',
    ]) {
      expect({ constante, usa: pagina.includes(constante) }).toEqual({ constante, usa: true });
    }
    // Nenhuma das três prosas volta a ser literal.
    expect(pagina).not.toMatch(/limiar de 15 minutos/);
    expect(pagina).not.toMatch(/07 set|28 set/);
    expect(pagina).not.toMatch(/50,8° N/);
    // E as cinco noites da janela saem do protocolo, no hospedeiro.
    expect(pagina).not.toMatch(/NOITES_DA_JANELA\s*=/);
    expect(hospedeiro).toContain('JANELA_LUNAR_NOITES');
    expect(hospedeiro).not.toMatch(/janelaNoites:\s*5\b/);
    // O vocabulário de fase vem do núcleo, e a ordem de `PHASE_ORDER`.
    expect(pagina).not.toMatch(/ROTULO_CURTO(_DA_FASE)?\s*:\s*Readonly/);
    expect(hospedeiro).toContain('ROTULO_CURTO_DA_FASE');
    expect(hospedeiro).toMatch(/PHASE_ORDER\.map\(/);
    expect(hospedeiro).not.toMatch(/Object\.keys\(POSICAO_DA_FASE\)/);
    expect(hospedeiro).toMatch(/POSICAO_DA_FASE[^=]*=\s*Object\.freeze/);
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
    // A linha de apoio vem **por estado**, do hospedeiro: *"a primeira execução
    // autorizada ainda não rodou"* é verdade no quarto estado e falsa nos outros três.
    expect(bloco).toMatch(/\[semResultado\]/);
    expect(corpoDe(pagina, 'SonoLuaScreen') ?? '').toContain('apoioSemResultado(veredito)');
    expect(corpoDe(hospedeiro, 'apoioSemResultado') ?? '').toContain('APOIO_SEM_LEITURA');
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
