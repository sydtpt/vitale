/**
 * As regras puras da **tela de compilação** (fatia 2), e a marca de uma tentativa sem desfecho.
 *
 * O que este arquivo protege são as três coisas que a tela poderia mentir, todas caladas:
 *
 *  1. **O relógio.** Ele sai de uma subtração de instantes, e um `-1:-3` na tela seria um
 *     relógio negativo porque o sistema mexeu na hora. Zero é o piso.
 *  2. **A lembrança.** Sem carimbo, a frase muda de **forma** e não de número: ela diz que não
 *     há o que prometer, em vez de inventar um "cerca de dez minutos" que ninguém mediu aqui.
 *  3. **O desfecho, e quem carimba.** Só `compilou` carimba. O caso que o desenho não previa —
 *     a carga voltou e o cache não ficou completo — tem de cair do lado do *não terminou*, com
 *     palavras do app, porque o sistema não disse nada. Se ele caísse do lado do sim, um
 *     modelo não compilado ganharia um *da última vez levou N min* no lugar exato em que o dono
 *     usa esse número para decidir se cabe no intervalo antes de sair.
 *
 * A marca (`em-curso.ts`) entra aqui porque é o que faz o quinto estado da tela existir: sem
 * ela, *interrompida sem você* é inalcançável, e a tela recomeçaria onze minutos sozinha.
 */
import { describe, it, expect } from '@jest/globals';
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  type CompilacaoNoAparelho,
  type MotorId,
  type RecursoId,
} from '@vitale/shared';
import type { KVStore } from '../local-store';
import {
  CARGA_SEM_CACHE,
  ETAPA_UNICA,
  NOME_DO_RECURSO,
  cartaoDoQueSegue,
  duracaoFalada,
  fimDaCompilacao,
  fraseDeParar,
  leiturasDoModelo,
  linhaDaUltimaVez,
  notaDaEtapa,
  relogio,
  somaDaEtapa,
  tituloDaFase,
} from '../motores/compilacao-regras';
import { esquecerEmCurso, lerEmCurso, lerEmCursoDoCru, marcarEmCurso } from '../motores/em-curso';
import {
  MOTIVO_COREAI_FORA_DO_IOS,
  MOTIVO_COREAI_SEM_PONTE,
  MOTIVO_DO_COREAI_EM_PALAVRAS,
  PESOS_ABERTOS,
  PONTE_AUSENTE,
  type EstadoDaCompilacao,
  type PesoAberto,
} from '../motores/catalogo';

const PESO = PESOS_ABERTOS[0]!;
/** O Qwen3 4B — o modelo **sem** medida de compilado, que é o caso do "não medido". */
const SEM_COMPILADO_MEDIDO = PESOS_ABERTOS.find((p) => p.tamanho?.compiladoGB === undefined);

/** A linha da ponte já lida — o que a tela recebe do compilador. */
function lido(compilacao: CompilacaoNoAparelho): EstadoDaCompilacao {
  return { tipo: 'lido', compilacao };
}

/* ── o relógio ───────────────────────────────────────────────────────────── */

describe('o relógio', () => {
  it('conta minutos e segundos, com o segundo em duas casas', () => {
    expect(relogio(0)).toBe('0:00');
    expect(relogio(9_000)).toBe('0:09');
    expect(relogio(5 * 60_000 + 12_000)).toBe('5:12');
    expect(relogio(11 * 60_000 + 4_000)).toBe('11:04');
  });

  it('passa a horas quando passa da hora — 29 min de compilação já foi medido, 60 pode acontecer', () => {
    expect(relogio(3_600_000)).toBe('1:00:00');
    expect(relogio(3_600_000 + 5 * 60_000 + 12_000)).toBe('1:05:12');
  });

  it('nunca mostra tempo negativo: o relógio sai de uma subtração de instantes', () => {
    // Um `-1:-3` na tela seria o sistema tendo mexido na hora, e a tela acusando o dono.
    expect(relogio(-5_000)).toBe('0:00');
    expect(relogio(Number.NaN)).toBe('0:00');
  });

  it('trunca o segundo em vez de arredondar — o relógio não pode adiantar', () => {
    expect(relogio(1_999)).toBe('0:01');
  });
});

describe('a duração falada, da folha de confirmação', () => {
  it('diz minutos e segundos, no singular e no plural', () => {
    expect(duracaoFalada(3 * 60_000 + 41_000)).toBe('3 minutos e 41 segundos');
    expect(duracaoFalada(60_000 + 1_000)).toBe('1 minuto e 1 segundo');
    expect(duracaoFalada(5 * 60_000)).toBe('5 minutos');
    expect(duracaoFalada(41_000)).toBe('41 segundos');
    expect(duracaoFalada(1_000)).toBe('1 segundo');
    expect(duracaoFalada(0)).toBe('0 segundos');
  });

  it('entra na frase de parar, que é um argumento e não uma medida', () => {
    expect(fraseDeParar(3 * 60_000 + 41_000)).toBe(
      'Parar agora perde 3 minutos e 41 segundos de compilação. Começar de novo custa o tempo inteiro.',
    );
  });
});

/* ── a lembrança ─────────────────────────────────────────────────────────── */

describe('a lembrança é a única estimativa, e some quando não existe', () => {
  it('com carimbo, afirma um fato deste aparelho', () => {
    const frase = linhaDaUltimaVez({ em: Date.now(), ms: 11 * 60_000 });
    expect(frase).toContain('Da última vez, neste iPhone, levou 11 min');
    expect(frase).toContain('só avisa quando termina');
  });

  it('sem carimbo, ela NÃO inventa número — muda de forma', () => {
    const frase = linhaDaUltimaVez(undefined);
    expect(frase).toContain('nunca compilou este modelo');
    // A regressão que este teste existe para pegar: qualquer dígito aqui é um número que
    // ninguém mediu neste aparelho.
    expect(frase).not.toMatch(/\d/);
  });
});

/* ── a etapa ─────────────────────────────────────────────────────────────── */

describe('a etapa é uma só, e o tamanho só aparece onde houve medida', () => {
  it('soma o que a compilação acrescenta, quando alguém mediu', () => {
    expect(somaDaEtapa(PESO)).toBe('+1,34 GB');
    expect(ETAPA_UNICA).toBe('Compilando para o chip');
  });

  it('sem medida do compilado, não há soma — e nunca um "+0 GB"', () => {
    expect(SEM_COMPILADO_MEDIDO).toBeDefined();
    expect(somaDaEtapa(SEM_COMPILADO_MEDIDO!)).toBeUndefined();
  });

  it('a nota diz por que ela não avança, e traz o instalado quando há medida', () => {
    expect(notaDaEtapa(PESO)).toContain('não divide a compilação em passos');
    expect(notaDaEtapa(PESO)).toContain('Instalado no aparelho: 1,3 GB.');
  });

  it('sem tamanho nenhum, a nota existe e não fala de instalado', () => {
    const semMedida: PesoAberto = { ...PESO, tamanho: undefined };
    expect(notaDaEtapa(semMedida)).not.toContain('Instalado');
  });
});

/* ── o desfecho, e quem carimba ──────────────────────────────────────────── */

describe('o desfecho da compilação', () => {
  it('compilado é o único "compilou" — e é o único que carimba', () => {
    expect(fimDaCompilacao(lido({ estado: 'compilado', componentes: 3, compilados: 3 }))).toEqual({
      tipo: 'compilou',
    });
  });

  it('a falha do sistema traz as palavras do catálogo e a prosa dele', () => {
    const fim = fimDaCompilacao(
      lido({ estado: 'nao-sabido', motivo: 'naoCompilou', detalhe: 'os pesos não compilaram: não coube' }),
    );
    expect(fim.tipo).toBe('nao-compilou');
    if (fim.tipo !== 'nao-compilou') throw new Error('desfecho errado');
    expect(fim.palavras).toBe(MOTIVO_DO_COREAI_EM_PALAVRAS['naoCompilou']);
    expect(fim.detalhe).toContain('não coube');
    // Quem falou foi o sistema: o cartão anuncia "o que o sistema disse".
    expect(fim.doSistema).toBe(true);
  });

  it('a carga que voltou sem o cache completo NÃO é "compilou" — e não é fala do sistema', () => {
    // O caso que o desenho não previa, e que "afirmar o sucesso" esconderia: o carregador
    // voltou, e o compilado não está todo lá. Carimbar isso produziria um "da última vez
    // levou N min" para um modelo que vai compilar de novo na próxima leitura.
    const fim = fimDaCompilacao(lido({ estado: 'nao-compilado', componentes: 3, compilados: 1 }));
    expect(fim.tipo).toBe('nao-compilou');
    if (fim.tipo !== 'nao-compilou') throw new Error('desfecho errado');
    expect(fim.palavras).toBe(CARGA_SEM_CACHE);
    expect(fim.detalhe).toBe('1 de 3 componentes compilados');
    expect(fim.doSistema).toBe(false);
  });

  it('o prazo estourado é ilegível, e a tela não o põe na boca do sistema', () => {
    const fim = fimDaCompilacao(lido({ estado: 'ilegivel', detalhe: 'a compilação não voltou em 45 min' }));
    if (fim.tipo !== 'nao-compilou') throw new Error('desfecho errado');
    expect(fim.detalhe).toContain('não voltou em 45 min');
    expect(fim.doSistema).toBe(false);
  });

  it('sem ponte e fora do iOS o desfecho é o motivo do peso aberto, não "compilou"', () => {
    const semPonte = fimDaCompilacao({ tipo: 'ausente' });
    if (semPonte.tipo !== 'nao-compilou') throw new Error('desfecho errado');
    expect(semPonte.palavras).toBe(MOTIVO_COREAI_SEM_PONTE);
    const fora = fimDaCompilacao({ tipo: 'fora-do-ios' });
    if (fora.tipo !== 'nao-compilou') throw new Error('desfecho errado');
    expect(fora.palavras).toBe(MOTIVO_COREAI_FORA_DO_IOS);
  });
});

/* ── os títulos ──────────────────────────────────────────────────────────── */

describe('o título de cada fase', () => {
  it('nomeia o modelo enquanto corre e quando termina, e o ato quando não terminou', () => {
    expect(tituloDaFase('correndo', PESO)).toBe(`Compilando o ${PESO.rotulo}`);
    expect(tituloDaFase('terminou', PESO)).toBe(`${PESO.rotulo} compilado`);
    expect(tituloDaFase('falhou', PESO)).toBe('A compilação não terminou');
    expect(tituloDaFase('parada', PESO)).toBe('Compilação parada');
    expect(tituloDaFase('interrompida', PESO)).toBe('A compilação foi interrompida');
  });

  it('parada e interrompida têm títulos DIFERENTES — confundi-las acusaria o dono', () => {
    expect(tituloDaFase('parada', PESO)).not.toBe(tituloDaFase('interrompida', PESO));
  });
});

/* ── o que continua escrevendo ───────────────────────────────────────────── */

describe('as leituras deste modelo, e o cartão do que continua', () => {
  it('sem ponte, o peso aberto não escreve nada — e o cartão diz que nada espera', () => {
    const leituras = leiturasDoModelo({
      peso: PESO,
      pontes: { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE },
      lista: null,
      preferencias: {},
    });
    expect(leituras).toEqual([]);
    expect(cartaoDoQueSegue(leituras)).toContain('Nada no app espera por isto');
  });

  it('escolhido numa leitura disponível, ele aparece nela — e o cartão diz quem espera', () => {
    const pronto = { tipo: 'lido' as const, diagnostico: { estado: 'disponivel' as const, variante: PESO.pesos } };
    const preferencias: Readonly<Partial<Record<RecursoId, MotorId>>> = { 'saude-do-sono': PESO.id };
    const leituras = leiturasDoModelo({
      peso: PESO,
      pontes: { sistema: PONTE_AUSENTE, coreai: { [PESO.pesos]: pronto } },
      lista: null,
      preferencias,
    });
    expect(leituras).toEqual([NOME_DO_RECURSO['saude-do-sono']]);
    const cartao = cartaoDoQueSegue(leituras);
    expect(cartao).toContain('Saúde do sono');
    expect(cartao).toContain('ela espera');
  });

  it('o cartão concorda em número quando são duas leituras', () => {
    expect(cartaoDoQueSegue(['Saúde do sono', 'Nome de rota'])).toContain('elas esperam');
    expect(cartaoDoQueSegue(['Saúde do sono', 'Nome de rota'])).toContain('Saúde do sono e Nome de rota');
  });

  it('a tabela de nomes cobre os quatro recursos, sem duplicata', () => {
    const nomes = Object.values(NOME_DO_RECURSO);
    expect(new Set(nomes).size).toBe(nomes.length);
    // Um motor de nuvem ou o template não são modelo aberto — a lista de nomes é dos recursos,
    // e estes ids existem só para o teste não confundir as duas coisas.
    expect([SEM_MODELO, NUVEM_PADRAO, APARELHO_SISTEMA].every((id) => typeof id === 'string')).toBe(true);
  });
});

/* ── a marca de uma tentativa sem desfecho ───────────────────────────────── */

const CHAVE_EM_CURSO = 'vitale:motores-compilacao-em-curso';

/** Store com latência: sem ela a corrida da fila não se manifesta. */
function storeLento(delayMs = 1): KVStore & { bruto: () => string | null } {
  const map = new Map<string, string>();
  const espera = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    getItem: async (k) => {
      await espera();
      return map.get(k) ?? null;
    },
    setItem: async (k, v) => {
      await espera();
      map.set(k, v);
    },
    removeItem: async (k) => {
      await espera();
      map.delete(k);
    },
    bruto: () => map.get(CHAVE_EM_CURSO) ?? null,
  };
}

describe('a marca da compilação em curso', () => {
  it('marca, lê e esquece', async () => {
    const store = storeLento();
    expect(await lerEmCurso(store)).toBeNull();
    await marcarEmCurso(PESO.pesos, store);
    expect(await lerEmCurso(store)).toBe(PESO.pesos);
    await esquecerEmCurso(store);
    expect(await lerEmCurso(store)).toBeNull();
  });

  it('a última marca vence: duas compilações simultâneas não existem', async () => {
    const store = storeLento();
    await Promise.all([marcarEmCurso('a', store), marcarEmCurso('b', store)]);
    expect(await lerEmCurso(store)).toBe('b');
  });

  it('o que não é um nome de pasta não vira marca — senão a tela travaria em "interrompida"', () => {
    expect(lerEmCursoDoCru(undefined)).toBeNull();
    expect(lerEmCursoDoCru(null)).toBeNull();
    expect(lerEmCursoDoCru(3)).toBeNull();
    expect(lerEmCursoDoCru({ pasta: 'x' })).toBeNull();
    expect(lerEmCursoDoCru('   ')).toBeNull();
    expect(lerEmCursoDoCru(' qwen3-1.7b ')).toBe('qwen3-1.7b');
  });

  it('armazenamento quebrado devolve null, e nunca lança: sem marca, a tela começa', async () => {
    const quebrado: KVStore = {
      getItem: async () => {
        throw new Error('o disco sumiu');
      },
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    await expect(lerEmCurso(quebrado)).resolves.toBeNull();
  });

  it('uma escrita que falha não envenena a corrente — a próxima passa', async () => {
    let falhar = true;
    const store: KVStore = {
      getItem: async () => null,
      setItem: async () => {
        if (falhar) {
          falhar = false;
          throw new Error('a primeira falhou');
        }
      },
      removeItem: async () => undefined,
    };
    await expect(marcarEmCurso('a', store)).rejects.toThrow('a primeira falhou');
    await expect(marcarEmCurso('b', store)).resolves.toBeUndefined();
  });
});
