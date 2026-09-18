/**
 * A parte de `useRolagemAncorada` que decide — e que por isso mora fora do React.
 *
 * O hook em si é três linhas de cola (`scrollTo` e `sendAccessibilityEvent`) em
 * volta de duas respostas: **qual `y`** e **se há `y`**. As duas saem de
 * `destinoDaRolagem` e do registro de âncoras, e é isso que se mede aqui. O que
 * sobra — o dedo na linha, o VoiceOver caindo na faixa certa — é portão do dono
 * no aparelho, e nenhum renderizador de teste prova.
 *
 * `@testing-library/react-native` não existe neste workspace (nem
 * `react-test-renderer`), e a spec não pede dependência nova: por isso a decisão
 * foi extraída em vez de o hook ser montado.
 */
import { describe, it, expect } from '@jest/globals';
import type { LayoutChangeEvent } from 'react-native';
import {
  atoDaRolagem,
  criarAncoras,
  destinoDaRolagem,
  executarAto,
  type AjustesDoSistema,
  type NoDaAncora,
} from '../useRolagemAncorada';

/** O evento de layout, com só o que a âncora lê. */
function layout(y: number): LayoutChangeEvent {
  return { nativeEvent: { layout: { x: 0, y, width: 320, height: 200 } } } as LayoutChangeEvent;
}

/** Um nó de host qualquer — aqui ele só precisa ser identificável. */
function no(nome: string): NoDaAncora {
  return { nome } as unknown as NoDaAncora;
}

type Caderno = 'sono' | 'movimento' | 'coracao' | 'rotina';

describe('destinoDaRolagem — a decisão pura', () => {
  it('sem medida não há destino: nada acontece', () => {
    expect(destinoDaRolagem(undefined)).toBeNull();
  });

  it('a medida é o destino, sem margem de topo (o desenho fixa scroll-margin-top: 0)', () => {
    expect(destinoDaRolagem(0)).toBe(0);
    expect(destinoDaRolagem(742.5)).toBe(742.5);
  });

  it('um y impossível não vira rolagem para trás', () => {
    expect(destinoDaRolagem(-12)).toBe(0);
    expect(destinoDaRolagem(Number.NaN)).toBeNull();
  });
});

describe('o registro de âncoras', () => {
  it('a âncora de um id é o MESMO objeto a cada chamada — ref e onLayout incluídos', () => {
    const r = criarAncoras<Caderno>();
    const a = r.para('sono');
    const b = r.para('sono');
    expect(b).toBe(a);
    expect(b.ref).toBe(a.ref);
    expect(b.onLayout).toBe(a.onLayout);
    // Instável por id seria um ref-callback desmontado e remontado a cada quadro.
    expect(r.para('movimento')).not.toBe(a);
  });

  it('antes do onLayout o destino é nulo; depois dele é a posição medida', () => {
    const r = criarAncoras<Caderno>();
    const a = r.para('coracao');
    expect(r.destinoDe('coracao')).toBeNull();
    a.onLayout(layout(512));
    expect(r.destinoDe('coracao')).toBe(512);
    // A remedida (rotação, tipo dinâmico, um caderno acima que cresceu) manda.
    a.onLayout(layout(640));
    expect(r.destinoDe('coracao')).toBe(640);
  });

  it('cada id guarda a sua medida, e um id nunca medido continua nulo', () => {
    const r = criarAncoras<Caderno>();
    r.para('sono').onLayout(layout(100));
    r.para('rotina').onLayout(layout(900));
    expect(r.destinoDe('sono')).toBe(100);
    expect(r.destinoDe('rotina')).toBe(900);
    expect(r.destinoDe('movimento')).toBeNull();
  });

  it('o nó do foco entra no ref e sai quando ele desmonta', () => {
    const r = criarAncoras<Caderno>();
    const a = r.para('movimento');
    expect(r.noDe('movimento')).toBeNull();
    const faixa = no('faixa-movimento');
    a.ref(faixa);
    expect(r.noDe('movimento')).toBe(faixa);
    a.ref(null);
    expect(r.noDe('movimento')).toBeNull();
  });

  it('medida e nó são independentes: a linha medida cujo nó desmontou ainda rola', () => {
    const r = criarAncoras<Caderno>();
    const a = r.para('sono');
    a.onLayout(layout(240));
    a.ref(no('faixa-sono'));
    a.ref(null);
    expect(r.destinoDe('sono')).toBe(240);
    expect(r.noDe('sono')).toBeNull();
  });
});

/**
 * O **ato inteiro** — as duas linhas da matriz que vivem na composição, e não em
 * nenhuma das partes: "toque na linha" e "Reduzir Movimento ligado".
 *
 * Elas estavam só dentro do `useCallback`, onde nenhum teste as alcançava: dava
 * para soltar o `animated` do ajuste, ou deixar o foco para trás da rolagem, e a
 * suíte continuava verde. Aqui `y`, `animada` e `foco` saem juntos, de uma
 * chamada, e é isso que o hook executa.
 */
describe('atoDaRolagem — a composição que o toque produz', () => {
  const FAIXA = no('faixa-movimento');
  const NENHUM: AjustesDoSistema = { reduzirMovimento: false, leitorDeTela: false };
  const SO_MOVIMENTO: AjustesDoSistema = { reduzirMovimento: true, leitorDeTela: false };
  const SO_LEITOR: AjustesDoSistema = { reduzirMovimento: false, leitorDeTela: true };
  const OS_DOIS: AjustesDoSistema = { reduzirMovimento: true, leitorDeTela: true };

  it('toque na linha com âncora medida: rola até o topo do caderno e o foco vai para a faixa', () => {
    expect(atoDaRolagem(742, NENHUM, FAIXA))
      .toEqual({ y: 742, animada: true, semAnimacaoPor: null, foco: FAIXA });
  });

  it('Reduzir Movimento ligado: a rolagem é instantânea, e o foco vai igual', () => {
    expect(atoDaRolagem(742, SO_MOVIMENTO, FAIXA))
      // O ajuste governa a animação e NADA mais: `y` e `foco` são os mesmos do
      // caso animado, e por isso vão em literal — um `atoDaRolagem(...)?.y` aqui
      // passaria a comparar `undefined` com `undefined` no dia em que a função
      // devolvesse `null`, e o teste morreria calado.
      .toEqual({ y: 742, animada: false, semAnimacaoPor: 'reduzir-movimento', foco: FAIXA });
  });

  it('leitor de tela ligado: também salta — animação e foco brigam pelo mesmo elemento', () => {
    // Sem isto, `scrollTo` animado e `sendAccessibilityEvent` correm juntos: o
    // iOS reposiciona sozinho o elemento focado durante a rolagem, e o AC ("o
    // elemento lido em seguida é o nome do caderno de destino") vira sorteio.
    expect(atoDaRolagem(742, SO_LEITOR, FAIXA))
      .toEqual({ y: 742, animada: false, semAnimacaoPor: 'leitor-de-tela', foco: FAIXA });
  });

  it('os dois ligados: o ato é o mesmo, e o motivo dito é o pedido explícito', () => {
    expect(atoDaRolagem(742, OS_DOIS, FAIXA))
      .toEqual({ y: 742, animada: false, semAnimacaoPor: 'reduzir-movimento', foco: FAIXA });
  });

  it('sem medida: nada acontece — nem rolagem nem foco, os dois parados juntos', () => {
    expect(atoDaRolagem(null, NENHUM, FAIXA)).toBeNull();
    // E nem com os ajustes, que não são o que decide se há ato.
    expect(atoDaRolagem(null, SO_MOVIMENTO, FAIXA)).toBeNull();
    expect(atoDaRolagem(null, SO_LEITOR, null)).toBeNull();
  });

  it('medida com o nó desmontado: rola assim mesmo, e o foco fica nulo', () => {
    // A rolagem não depende do nó — segurá-la esperando o cabeçalho montar
    // travaria a única navegação da revista por um detalhe de leitor de tela.
    expect(atoDaRolagem(240, NENHUM, null))
      .toEqual({ y: 240, animada: true, semAnimacaoPor: null, foco: null });
  });

  it('o topo da página é ato, não ausência: y zero rola', () => {
    // `0` é medida legítima (o primeiro caderno encostado na capa) e não pode ser
    // confundido com "sem medida", que é `null`.
    expect(atoDaRolagem(0, NENHUM, FAIXA))
      .toEqual({ y: 0, animada: true, semAnimacaoPor: null, foco: FAIXA });
  });
});

/**
 * A execução do ato — a ordem e as condições, com as duas portas espiãs.
 *
 * Isto existe porque a cola era o ponto cego: apagar o `focar`, ou cravar a
 * animação em `true`, deixava a suíte inteira verde. A barreira nova também não
 * pegava — ela mede **ausência de nome** (`setAccessibilityFocus`,
 * `findNodeHandle`), não presença de comportamento.
 */
describe('executarAto — a ordem e as condições', () => {
  const FAIXA = no('faixa-sono');

  /** As duas portas, e a fita do que foi chamado, na ordem. */
  function espiar(): {
    portas: { rolar: (y: number, animada: boolean) => void; focar: (n: NoDaAncora) => void };
    fita: string[];
    rolagens: { y: number; animada: boolean }[];
    focos: NoDaAncora[];
  } {
    const fita: string[] = [];
    const rolagens: { y: number; animada: boolean }[] = [];
    const focos: NoDaAncora[] = [];
    return {
      fita,
      rolagens,
      focos,
      portas: {
        rolar: (y, animada) => { fita.push('rolar'); rolagens.push({ y, animada }); },
        focar: (n) => { fita.push('focar'); focos.push(n); },
      },
    };
  }

  it('o ato completo aciona as duas portas, e a rolagem vem antes do foco', () => {
    const e = espiar();
    executarAto({ y: 742, animada: true, semAnimacaoPor: null, foco: FAIXA }, e.portas);
    expect(e.fita).toEqual(['rolar', 'focar']);
    expect(e.rolagens).toEqual([{ y: 742, animada: true }]);
    expect(e.focos).toEqual([FAIXA]);
  });

  it('a animação do ato chega à porta como está — não é recalculada na cola', () => {
    const e = espiar();
    executarAto({ y: 300, animada: false, semAnimacaoPor: 'leitor-de-tela', foco: FAIXA }, e.portas);
    expect(e.rolagens).toEqual([{ y: 300, animada: false }]);
    expect(e.focos).toEqual([FAIXA]);
  });

  it('ato nulo não aciona porta nenhuma', () => {
    const e = espiar();
    executarAto(null, e.portas);
    expect(e.fita).toEqual([]);
  });

  it('sem nó, rola e não foca', () => {
    const e = espiar();
    executarAto({ y: 120, animada: true, semAnimacaoPor: null, foco: null }, e.portas);
    expect(e.fita).toEqual(['rolar']);
    expect(e.rolagens).toEqual([{ y: 120, animada: true }]);
    expect(e.focos).toEqual([]);
  });
});
