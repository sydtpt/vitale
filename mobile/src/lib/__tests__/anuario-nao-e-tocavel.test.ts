/**
 * BARREIRA — **a tira do anuário não é tocável** (Story 3.2).
 *
 * É a linha da matriz de I/O escrita como código: *"Given qualquer tira, when
 * ela é tocada, then nada acontece."* Sem toque, sem tooltip, sem scrub, sem
 * navegação.
 *
 * ## Por que ela precisa de barreira
 *
 * Porque o contrário já existe, pronto e a uma linha de distância. A tira da
 * **parede** (`TirasDoAnuario.tsx`) é um `Pressable` que abre a edição do ano, e
 * as duas desenham a mesma coisa com o mesmo código de célula. Copiar o
 * `Pressable` junto seria a coisa mais natural do mundo — e aqui ele é uma
 * promessa falsa: esta tira **é** a edição do ano, não há para onde ir.
 *
 * A pressão maior vem do gráfico: toda série do app que se parece com esta tem
 * scrub, tooltip ou toque num dia. Esta **não é visualização, é formato** — ela
 * diz identidade (qual fato liderou, quando ele trocou), nunca grandeza. Um
 * tooltip prometeria um valor que a tira não tem, e a promessa de magnitude está
 * **recusada**, não aberta (decisão do dono, 25/09/2026).
 *
 * ## Por que barreira de código-fonte, e não de comportamento
 *
 * Este workspace não tem renderizador de teste (nem `@testing-library/react-native`
 * nem `react-test-renderer`), e a spec não pede dependência nova — é o mesmo
 * impasse do `capa-sem-webview.test.ts`, do `silencio-fiacao.test.ts` e do
 * `parede-sem-leitura-por-celula.test.ts`, e a mesma resposta: quando a regra não
 * é observável sem tela, prende-se o **fonte**.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

/** O anuário da edição, e o desenho de célula que ele divide com a parede. */
const DO_ANUARIO = [
  join(SRC, 'components', 'revista', 'AnuarioDaEdicao.tsx'),
  join(SRC, 'components', 'revista', 'CelulasDaTira.tsx'),
  join(SRC, 'components', 'revista', 'geometria-da-tira.ts'),
];

/**
 * O fonte sem comentário de linha nem de bloco — a regra citada em prosa não
 * conta, e os dois arquivos falam de `Pressable` justamente para dizer que não
 * têm um.
 *
 * **Limite declarado:** o `//` só é removido quando ele **começa** a linha. Um
 * comentário de fim de linha continua no texto e pode acusar um arquivo limpo.
 * É a forma que o repositório já usa, e o falso positivo é barulhento e fácil de
 * ler; o falso negativo é que seria caro.
 */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * Os valores de uma prop `nome={…}`, recortados por contagem de chaves.
 *
 * Uma regex pararia no primeiro `}`, e o valor desta prop é JSX com chaves
 * aninhadas (`antesDaCapa={x === 'y' ? <A b={c} /> : null}`) — o corte ingênuo
 * devolveria `x === 'y' ? <A b={c` e diria que está limpo.
 */
function valoresDaProp(fonte: string, nome: string): string[] {
  const valores: string[] = [];
  const marca = `${nome}={`;
  for (let de = fonte.indexOf(marca); de >= 0; de = fonte.indexOf(marca, de + 1)) {
    let profundidade = 0;
    for (let i = de + marca.length - 1; i < fonte.length; i += 1) {
      if (fonte[i] === '{') profundidade += 1;
      else if (fonte[i] === '}') {
        profundidade -= 1;
        if (profundidade === 0) {
          valores.push(fonte.slice(de + marca.length, i));
          break;
        }
      }
    }
  }
  return valores;
}

/**
 * Tudo que faz um pedaço de tela responder ao dedo — **ou levar a outro lugar**.
 *
 * Três famílias, e as três têm caminho curto até aqui:
 *
 * 1. **o toque declarado** — `Pressable`, `Touchable*`, `Button`, `onPress*`
 *    (com o sufixo aberto: `onPressIn` e `onPressOut` são as duas portas por
 *    onde um scrub entra sem nunca escrever "onPress");
 * 2. **o dedo medido** — o responder cru (`onStartShouldSetResponder`,
 *    `onResponderMove`…) e os gestos. `\bGesture[A-Za-z]*\b` e não
 *    `GestureDetector`: `Gesture.Pan()`, `GestureHandlerRootView` e um gesto
 *    recebido por prop passariam por baixo do nome completo, e é justamente
 *    assim que o scrub do app é escrito — ele não usa `onPress` nenhum;
 * 3. **a navegação** — `useRouter`, `router.`, `useNavigation`,
 *    `navigation.navigate` e o `Link` do expo-router. Um anuário que abrisse
 *    alguma coisa seria tocável por outro nome.
 *
 * E `accessibilityRole="button"`, que é a promessa de toque feita só em voz:
 * anunciar um botão que não existe é pior que não anunciar nada.
 */
const TOCA = [
  /\bPressable\b/,
  /\bTouchable[A-Za-z]*\b/,
  /\bonPress[A-Za-z]*\b/,
  /\bPanResponder\b/,
  /\bGesture[A-Za-z]*\b/,
  /\bon[A-Za-z]*ShouldSetResponder[A-Za-z]*\b/,
  /\bonResponder[A-Za-z]*\b/,
  /\bLongPress[A-Za-z]*\b/,
  /\bonTouch[A-Za-z]*\b/,
  /\bhitSlop\b/,
  /\bButton\b/,
  /\buseRouter\b/,
  /\brouter\./,
  /\buseNavigation\b/,
  /\bnavigation\./,
  /<Link\b/,
  /\baccessibilityRole=["']button["']/,
];

describe('BARREIRA — a tira do anuário não é tocável', () => {
  it('nada no anuário da edição responde ao dedo', () => {
    const sujos: string[] = [];
    for (const arquivo of DO_ANUARIO) {
      const fonte = semComentario(arquivo);
      for (const proibido of TOCA) {
        if (proibido.test(fonte)) sujos.push(`${arquivo.replace(SRC, 'src')} → ${proibido}`);
      }
    }
    expect(sujos).toEqual([]);
  });

  /**
   * A metade positiva: sem ela, um arquivo esvaziado ou renomeado passaria na
   * barreira por não ter nada. O anuário tem de continuar sendo **um nó com
   * rótulo** — a fala do leitor de tela é a outra metade do desenho, e ela some
   * tão calada quanto o `Pressable` apareceria.
   */
  it('o anuário continua falando — um nó, um rótulo', () => {
    const fonte = semComentario(DO_ANUARIO[0]!);
    expect(fonte).toContain('accessibilityLabel');
    expect(fonte).toContain('anuarioEmPalavras');
    // `accessible` agrupa o bloco num elemento só; ele **não** torna tocável.
    expect(fonte).toMatch(/\baccessible\b/);
  });

  /** A barreira precisa continuar tendo alvo: arquivo renomeado a deixa vazia. */
  it('os arquivos da lista existem — a barreira não ficou sem alvo', () => {
    for (const arquivo of DO_ANUARIO) {
      expect(readFileSync(arquivo, 'utf8').length).toBeGreaterThan(0);
    }
  });

  /**
   * **O chamador também não pode torná-lo tocável.**
   *
   * Varrer só os arquivos do anuário deixa a saída mais curta de todas aberta:
   * embrulhar `<AnuarioDaEdicao />` num `Pressable` **na rota**, onde o toque é
   * legítimo (a capa abre, o sumário rola, o botão escreve). O bloco passaria a
   * responder ao dedo sem uma linha dos arquivos acima mudar.
   *
   * A régua é o **trecho da prop** que o monta: da abertura de `antesDaCapa={`
   * até o fecho dela, nada que toque. O recorte por contagem de chaves é o
   * mesmo do `anuario-fiacao.test.ts`, e pelo mesmo motivo — o valor da prop é
   * JSX com chaves aninhadas.
   */
  it('a rota não embrulha o anuário em nada tocável', () => {
    const rota = join(SRC, 'app', 'revista', '[tipo]', '[inicio].tsx');
    const fonte = semComentario(rota);
    const props = valoresDaProp(fonte, 'antesDaCapa');
    expect(props.length).toBeGreaterThan(0);
    const sujos: string[] = [];
    for (const valor of props) {
      for (const proibido of TOCA) if (proibido.test(valor)) sujos.push(`${proibido} em ${valor.slice(0, 60)}`);
    }
    expect(sujos).toEqual([]);
  });

  /**
   * A prova de que os padrões mordem: sem ela, um `TOCA` escrito errado (um
   * `\\b` a mais, um nome trocado) deixaria a barreira passar sobre tudo.
   *
   * O caso negativo é o que separa esta barreira da da parede: `accessible` e
   * `accessibilityLabel` **não** são toque, e proibi-los por engano tiraria a voz
   * do bloco — que é justamente o que a metade positiva acima cobra.
   */
  it('os padrões acusam o que deveriam, e poupam o que é só voz', () => {
    const acusa = (fonte: string) => TOCA.some((p) => p.test(fonte));
    // O toque declarado.
    expect(acusa('<Pressable onPress={abrir}>')).toBe(true);
    expect(acusa('<View onPressIn={medirODedo}>')).toBe(true);
    expect(acusa('<TouchableOpacity />')).toBe(true);
    // O dedo medido — o caminho curto para o scrub, que não escreve "onPress".
    expect(acusa('const pan = PanResponder.create({});')).toBe(true);
    expect(acusa('const g = Gesture.Pan().onUpdate(mover);')).toBe(true);
    expect(acusa('<GestureHandlerRootView />')).toBe(true);
    expect(acusa('<View onStartShouldSetResponder={() => true} />')).toBe(true);
    expect(acusa('<View onResponderMove={mover} />')).toBe(true);
    // A navegação.
    expect(acusa('const router = useRouter();')).toBe(true);
    expect(acusa('const nav = useNavigation();')).toBe(true);
    expect(acusa('navigation.navigate("/revista");')).toBe(true);
    expect(acusa('<Link href="/revista">ver</Link>')).toBe(true);
    // A promessa de toque feita só em voz.
    expect(acusa('<View accessibilityRole="button" />')).toBe(true);
    // E o que é só voz, ou só desenho, passa — proibi-los tiraria do bloco
    // exatamente o que a metade positiva acima cobra.
    expect(acusa('<View accessible accessibilityLabel={falado} />')).toBe(false);
    expect(acusa('<Text style={styles.mes}>{MESES_INICIAIS[mes]}</Text>')).toBe(false);
    expect(acusa('<View accessibilityRole="header" />')).toBe(false);
  });

  /**
   * A tira da **parede** continua sendo um botão, e isso não é inconsistência: lá
   * ela *leva* à edição do ano; aqui ela **é** a edição. Sem este caso, apagar o
   * `Pressable` de lá passaria despercebido — e a parede perderia a única porta
   * que o ano tem nela.
   */
  it('a tira da parede, essa sim, continua abrindo a edição', () => {
    const fonte = semComentario(join(SRC, 'components', 'revista', 'TirasDoAnuario.tsx'));
    expect(fonte).toMatch(/\bPressable\b/);
    expect(fonte).toContain('onAbrir');
  });
});
