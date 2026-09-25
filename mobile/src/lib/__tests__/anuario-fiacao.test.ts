/**
 * BARREIRA — **o anuário do ano está ligado na rota** (Story 3.2).
 *
 * `antesDaCapa` é um `React.ReactNode`, e `null` é um `ReactNode` perfeitamente
 * válido — é o que o ramo do mês passa. Trocar
 *
 *     antesDaCapa={anuario.estado === 'pronto' ? <AnuarioDaEdicao … /> : null}
 *
 * por `antesDaCapa={null}` **compila e passa em tudo**: o `tsc` aceita, a
 * barreira de AST continua vendo `RevistaDoAno` no braço certo do ternário, e as
 * barreiras do componente continuam achando as strings delas num arquivo que
 * simplesmente nunca é montado. O ano volta a abrir como um mês grande, com a
 * suíte inteira verde.
 *
 * É o mesmo modo de falha do `silencio-fiacao.test.ts` — *"apagar o argumento
 * desliga a feature em silêncio"* — e a resposta é a mesma: guarda de
 * **código-fonte**, não de comportamento. Este workspace não tem renderizador de
 * teste, e a spec não pede dependência nova.
 *
 * O que ela cobra:
 *
 * - o ramo do ano (`RevistaDoAno`) **monta** `<AnuarioDaEdicao` e o entrega em
 *   `antesDaCapa`;
 * - ele lê o hook (`useAnuarioDoAno`) e só desenha no estado `pronto` — o ano
 *   não afirma silêncio antes de saber;
 * - o ramo do mês e da estação (`Revista`) continua passando `null`: as tiras
 *   são do ano, e só dele;
 * - as tiras aparecem **fora** do ramo da edição também, que é o que as faz
 *   existir quando o texto não veio.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROTA = join(__dirname, '..', '..', 'app', 'revista', '[tipo]', '[inicio].tsx');

/** O fonte sem comentário de linha nem de bloco — a regra citada em prosa não conta. */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * O corpo de uma função, por contagem de chaves.
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

describe('BARREIRA — o anuário do ano está ligado na rota', () => {
  const fonte = semComentario(ROTA);

  it('as três funções da ramificação existem — a barreira não ficou sem alvo', () => {
    for (const f of ['RevistaDoAno', 'Revista', 'Edicao']) {
      expect({ funcao: f, achou: corpoDe(fonte, f) !== null }).toEqual({ funcao: f, achou: true });
    }
  });

  /**
   * O coração da barreira: o componente tem de ser **montado** pelo ramo do ano,
   * e entregue na prop que a `Edicao` desenha antes da capa.
   */
  it('o ramo do ano monta o AnuarioDaEdicao e o passa em antesDaCapa', () => {
    const corpo = corpoDe(fonte, 'RevistaDoAno') ?? '';
    expect(corpo).toContain('<AnuarioDaEdicao');
    expect(corpo).toMatch(/antesDaCapa=\{[\s\S]*<AnuarioDaEdicao/);
  });

  /**
   * E ele sai do hook, no estado `pronto`. Sem o hook, alguém montaria o
   * componente com um anuário fabricado na tela; sem o `pronto`, o ano afirmaria
   * o silêncio com os meses ainda em voo — a linha da matriz de I/O que diz que
   * *"o ano não afirma silêncio antes de saber"*.
   */
  it('o ramo do ano lê o hook e só desenha quando a leitura fechou', () => {
    const corpo = corpoDe(fonte, 'RevistaDoAno') ?? '';
    expect(corpo).toContain('useAnuarioDoAno');
    expect(corpo).toMatch(/estado === 'pronto'/);
  });

  /** As tiras são do ano, e só dele: o mês e a estação continuam abrindo na capa. */
  it('o ramo do mês e da estação não passa tira nenhuma', () => {
    const corpo = corpoDe(fonte, 'Revista') ?? '';
    expect(corpo).toContain('antesDaCapa={null}');
    expect(corpo).not.toContain('AnuarioDaEdicao');
  });

  /**
   * **As duas leituras são independentes, e o desenho tem de refletir isso.**
   * `antesDaCapa` aparece duas vezes na `Edicao`: uma dentro do `ScrollView` da
   * edição, outra no fragmento que responde por carregando, erro e sem sessão.
   * Com uma só, o ano perderia as doze formas justamente quando o texto falha —
   * e a story diz o contrário: *"elas acrescentam; não substituem"*.
   */
  it('as tiras existem mesmo quando a edição não vem', () => {
    const corpo = corpoDe(fonte, 'Edicao') ?? '';
    const usos = corpo.match(/\{antesDaCapa\}/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(2);
    // O ramo sem edição: o fragmento tem as tiras antes do aviso.
    expect(corpo).toMatch(/\{antesDaCapa\}\s*<AvisoDaVista/);
  });
});
