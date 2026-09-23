/**
 * As regras puras da bancada — as duas que falharam em 22/09 (as duas sem levantar
 * exceção, as duas aparecendo na tela como `mudo` em todos os motores) e as da
 * fatia 4, que decidem quem entra na corrida, quem continua valendo na hora de
 * correr e quanto ela espera por uma coluna.
 *
 * Elas moram aqui, e não num teste de tela, porque são **puras**: um teste de tela
 * custaria mock de supabase e da ponte para cobrir aritmética e escolha de forma.
 */
import { describe, it, expect } from '@jest/globals';
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  descritorDaRetrospectiva,
  descritorDaSaudeDoSono,
  descritorDoNomeDeRota,
  entradaDaSaude,
  periodBounds,
  periodoFechado,
  type Descritor,
  type FatosDoNome,
  type MotorId,
  type SleepPeriod,
} from '@vitale/shared';
import {
  MOTIVO_SEM_NOITE,
  OFFSET_DA_SEMANA_FECHADA,
  RECURSOS_COM_REGUA,
  cabeNoRegime,
  chipsDaCorrida,
  estadoDoMotorNaCorrida,
  janelaComNoite,
  motivoDoTeto,
  rotaMedivel,
  tetoDaCorridaMs,
} from '../motores/amostras-regras';
import {
  COMPILACAO_AUSENTE,
  COMPILACAO_FORA_DO_IOS,
  MOTIVO_COREAI_FORA_DO_IOS,
  PESOS_ABERTOS,
  type EstadoDaCompilacao,
  type MotorConhecido,
} from '../motores/catalogo';

/** 22/09/2026, uma terça — o dia em que o defeito apareceu. */
const TERCA = new Date(2026, 8, 22, 22, 30);

function diaLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** O último dia do período: o fim é exclusivo (00:00 do dia seguinte). */
function ultimoDia(now: Date, offset: number): string {
  return diaLocal(new Date(periodBounds(now, 'week', offset).end.getTime() - 1));
}

describe('o período que a Retrospectiva mede na bancada', () => {
  it('é uma semana FECHADA — com o sinal trocado, nenhum motor escreve', () => {
    expect(periodoFechado('week', ultimoDia(TERCA, OFFSET_DA_SEMANA_FECHADA), TERCA)).toBe(true);
    // A prova do defeito de 22/09: `+1` é a semana que vem, que nunca fechou, e o
    // descritor devolve pedido nulo — a bancada mostrava `mudo` sem dizer por quê.
    expect(periodoFechado('week', ultimoDia(TERCA, 1), TERCA)).toBe(false);
    // E a semana corrente também não serve, pelo mesmo motivo.
    expect(periodoFechado('week', ultimoDia(TERCA, 0), TERCA)).toBe(false);
  });
});

describe('a pedalada que entra na amostra do nome de rota', () => {
  const rota = (distanceM: number, cidades: number): FatosDoNome => ({
    rota: {
      startAt: '2026-07-14T09:00:00.000Z',
      distanceM,
      elevationM: 40,
      lat0: 50.85,
      lng0: 4.34,
      lat1: 50.87,
      lng1: 4.37,
      cities: Array.from({ length: cidades }, (_, i) => ({ name: `Cidade ${i + 1}`, country: 'BE', lat: 50.85 + i / 100, lng: 4.34 + i / 100 })),
    },
    ancoras: [],
  });

  it('recusa a rota que o descritor recusaria — o caso real de 14/07: 4,3 km e uma cidade', () => {
    expect(rotaMedivel(rota(4321, 1))).toBe(false);
  });

  it('recusa rota curta demais e rota sem cidade', () => {
    expect(rotaMedivel(rota(1625, 2))).toBe(false);
    expect(rotaMedivel(rota(16156, 0))).toBe(false);
  });

  it('aceita as que o descritor aceita: cinco cidades em 16 km, e uma cidade em 21 km', () => {
    expect(rotaMedivel(rota(16156, 5))).toBe(true);
    expect(rotaMedivel(rota(21364, 1))).toBe(true);
  });
});

/* ── a janela de sono que existe e não tem fato ──────────────────────────── */

/** Minutos vs UTC em Bruxelas no verão — o fuso real do acervo. */
const BXL = 120;

/** Uma noite que acorda em `wakeDay`, apagando às 23h30 da véspera. */
function noite(wakeDay: string): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + 23.5 * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + 7.5 * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: 7.5,
    awakenings: [],
    stages: null,
    stageSegments: null,
  };
}

describe('a janela de sono que a bancada oferece', () => {
  const HOJE = '2026-09-22';

  it('uma janela sem noite nenhuma não é caso — senão a lápide da contagem sai em TODAS as colunas', () => {
    // A entrada existe, e é isso que torna este vazio perigoso: as outras duas fontes
    // devolvem lista vazia com motivo, e esta montaria um caso com a ausência dentro.
    const vazia = entradaDaSaude([], {}, { range: '7d', offset: 0, hoje: HOJE });
    expect(vazia.score.coverage?.nights).toBe(0);
    expect(janelaComNoite(vazia)).toBe(false);
  });

  it('uma janela com noite é caso, no período e na noite avulsa', () => {
    const acervo = ['2026-09-20', '2026-09-21', '2026-09-22'].map(noite);
    expect(janelaComNoite(entradaDaSaude(acervo, {}, { range: '7d', offset: 0, hoje: HOJE }))).toBe(true);
    expect(janelaComNoite(entradaDaSaude(acervo, {}, { range: 'ultima', offset: 0, hoje: HOJE }))).toBe(true);
  });

  it('a noite avulsa que não existe também não é caso', () => {
    expect(janelaComNoite(entradaDaSaude([], {}, { range: 'ultima', offset: 0, hoje: HOJE }))).toBe(false);
  });

  it('o motivo é o que a tela mostra, em palavras', () => {
    expect(MOTIVO_SEM_NOITE).toBe('esta janela não tem noite para ler');
  });
});

/* ── a régua, conferida contra os descritores de verdade ─────────────────── */

/**
 * A tabela escrita à mão × o que o `semModelo` de cada descritor devolve.
 *
 * `RECURSOS_COM_REGUA` é autorada porque `semModelo` é uma das cinco funções que só
 * o orquestrador percorre, e a barreira do `architecture.test.ts` está em zero fora
 * dele. **Ela varre hospedeiro fora de teste**, e é justamente por isso que a
 * conferência cabe aqui: este arquivo é teste, pode chamar, e é o único lugar do app
 * onde a tabela e o descritor se olham.
 *
 * Sem isto, uma leitura que ganhasse template continuaria sem chip de régua, e uma que
 * perdesse continuaria prometendo uma coluna que nunca vem.
 */
describe('onde há régua', () => {
  it('a tabela da fileira de chips bate com o `semModelo` dos três descritores', () => {
    const fatos = {
      'saude-do-sono': entradaDaSaude([noite('2026-09-22')], {}, { range: '7d', offset: 0, hoje: '2026-09-22' }),
      // Os dois devolvem lápide sem olhar para os fatos (`semModelo: () => …`): o
      // objeto vazio nunca é lido, e montar um pacote real aqui mediria outra coisa.
      retrospectiva: {},
      'nome-de-rota': {},
    } as const;
    for (const d of [descritorDaSaudeDoSono, descritorDaRetrospectiva, descritorDoNomeDeRota]) {
      const piso = (d as Descritor<unknown, unknown>).semModelo(fatos[d.recurso]);
      expect([d.recurso, 'frase' in piso]).toEqual([d.recurso, RECURSOS_COM_REGUA[d.recurso]]);
    }
  });
});

/* ── quem entra na fileira, e quem continua valendo na hora de correr ────── */

/** A compilação lida, com a resposta que o teste mandar. */
function compilacaoLida(compilacao: Extract<EstadoDaCompilacao, { tipo: 'lido' }>['compilacao']): EstadoDaCompilacao {
  return { tipo: 'lido', compilacao };
}

const PESO = PESOS_ABERTOS[0]!;
const COMPILADO = { [PESO.pesos]: compilacaoLida({ estado: 'compilado', componentes: 1, compilados: 1 }) };
const NAO_COMPILADO = { [PESO.pesos]: compilacaoLida({ estado: 'nao-compilado', componentes: 1, compilados: 0 }) };

function motor(id: MotorId, extra: Partial<MotorConhecido> = {}): MotorConhecido {
  return { id, nome: `o ${id}`, rotulo: id, descricao: '', disponivel: true, ...extra };
}

describe('o motor que perdeu o pé entre o chip e o toque em Medir', () => {
  it('um peso aberto disponível e COMPILADO corre', () => {
    expect(estadoDoMotorNaCorrida(motor(PESO.id), COMPILADO)).toEqual({ tipo: 'apto' });
  });

  it('um peso aberto disponível e não compilado sai, com o fato escrito como perda', () => {
    // É a guarda inteira desta fatia: sem ela o toque em Medir manda compilar, e a
    // compilação medida em 22/09 levou 11 a 15 min — pela única porta desta família
    // que diz, por escrito, que não compila nada.
    expect(estadoDoMotorNaCorrida(motor(PESO.id), NAO_COMPILADO)).toEqual({
      tipo: 'fora',
      noChip: 'não compilado',
      naCorrida: 'o compilado deste modelo não está mais no aparelho',
    });
  });

  it('"não sei" cai do lado de fora, e nunca do lado de dentro', () => {
    // Só o `compilado` afirmado pela ponte garante que a chamada não vai compilar:
    // sem ponte, no simulador ou com a linha ilegível, a resposta honesta é sair.
    for (const compilacao of [{}, { [PESO.pesos]: COMPILACAO_AUSENTE }, { [PESO.pesos]: COMPILACAO_FORA_DO_IOS }]) {
      expect(estadoDoMotorNaCorrida(motor(PESO.id), compilacao).tipo).toBe('fora');
    }
    expect(estadoDoMotorNaCorrida(motor(PESO.id), { [PESO.pesos]: COMPILACAO_FORA_DO_IOS })).toEqual({
      tipo: 'fora',
      noChip: MOTIVO_COREAI_FORA_DO_IOS,
      naCorrida: MOTIVO_COREAI_FORA_DO_IOS,
    });
  });

  it('consultando não é indisponível — é um motor que ainda não respondeu', () => {
    const consultando = motor(APARELHO_SISTEMA, { disponivel: false, motivo: 'consultando…', consultando: true });
    expect(estadoDoMotorNaCorrida(consultando, {})).toEqual({ tipo: 'consultando' });
  });

  it('o indisponível sai com o motivo que o catálogo escreveu', () => {
    const fora = motor(APARELHO_SISTEMA, { disponivel: false, motivo: 'a Apple Intelligence está desligada nos Ajustes' });
    expect(estadoDoMotorNaCorrida(fora, {})).toEqual({
      tipo: 'fora',
      noChip: 'a Apple Intelligence está desligada nos Ajustes',
      naCorrida: 'a Apple Intelligence está desligada nos Ajustes',
    });
  });

  // Quem não corre por escolha do dono não passa por aqui: a exclusão dele é do laço,
  // e dizer "fora" para um chip que ele desligou seria explicar a própria escolha dele.
  it('um motor de nuvem disponível corre, com ou sem compilação de peso nenhum', () => {
    expect(estadoDoMotorNaCorrida(motor(NUVEM_PADRAO), {})).toEqual({ tipo: 'apto' });
  });
});

describe('a fileira "quem entra"', () => {
  const nuvem = motor(NUVEM_PADRAO, { rotulo: 'Nuvem' });
  const aparelho = motor(APARELHO_SISTEMA, { rotulo: 'Modelo do aparelho' });
  const peso = motor(PESO.id, { rotulo: PESO.rotulo });
  const catalogo = [motor(SEM_MODELO, { rotulo: 'Sem modelo' }), aparelho, peso, nuvem];
  const semNinguemFora = new Set<string>();

  it('o template não é chip: ele é régua, não tem estado e não conta como motor', () => {
    const chips = chipsDaCorrida(catalogo, {
      regimeMaximo: 'nuvem',
      fora: semNinguemFora,
      compilacao: COMPILADO,
    });
    expect(chips.map((c) => c.id)).toEqual([APARELHO_SISTEMA, PESO.id, NUVEM_PADRAO]);
  });

  it('o motor acima do `regimeMaximo` não vira chip — ausente, e não desligado', () => {
    // Um chip desligado convidaria a ligar o que a regra proíbe; um apagado prometeria
    // um motivo que o recurso nunca vai deixar de ter. Hoje os três recursos admitem
    // nuvem e o caso não ocorre — a regra existe para o quarto, só-aparelho.
    const chips = chipsDaCorrida(catalogo, {
      regimeMaximo: 'aparelho',
      fora: semNinguemFora,
      compilacao: COMPILADO,
    });
    expect(chips.map((c) => c.id)).toEqual([APARELHO_SISTEMA, PESO.id]);
    // E com o teto no código, sobra o código: nenhum motor, nem o do aparelho.
    expect(chipsDaCorrida(catalogo, { regimeMaximo: 'sem-modelo', fora: semNinguemFora, compilacao: COMPILADO })).toEqual([]);
  });

  it('só o chip ligado conta como marcado — desligado, travado e consultando não', () => {
    const chips = chipsDaCorrida(catalogo, {
      regimeMaximo: 'nuvem',
      fora: new Set([NUVEM_PADRAO]),
      compilacao: NAO_COMPILADO,
    });
    const porId = new Map(chips.map((c) => [c.id, c]));
    expect(porId.get(APARELHO_SISTEMA)).toMatchObject({ forma: 'dentro', marcado: true });
    expect(porId.get(NUVEM_PADRAO)).toMatchObject({ forma: 'fora', marcado: false });
    expect(porId.get(PESO.id)).toMatchObject({ forma: 'travado', marcado: false, motivo: 'não compilado' });
  });

  it('o chip travado carrega o motivo dentro do próprio rótulo — ele não tem linha de baixo', () => {
    const [chip] = chipsDaCorrida([peso], { regimeMaximo: 'nuvem', fora: semNinguemFora, compilacao: NAO_COMPILADO });
    expect(chip?.rotulo).toBe(`${PESO.rotulo} · não compilado`);
  });

  it('consultando tem forma própria, e não conta como "há motor marcado"', () => {
    const chips = chipsDaCorrida(
      [motor(APARELHO_SISTEMA, { rotulo: 'Modelo do aparelho', disponivel: false, motivo: 'consultando o modelo do aparelho…', consultando: true })],
      { regimeMaximo: 'nuvem', fora: semNinguemFora, compilacao: {} },
    );
    expect(chips).toEqual([
      {
        id: APARELHO_SISTEMA,
        rotulo: 'Modelo do aparelho · consultando o modelo do aparelho…',
        forma: 'consultando',
        motivo: 'consultando o modelo do aparelho…',
        marcado: false,
      },
    ]);
    expect(chips.every((c) => !c.marcado)).toBe(true);
  });

  it('um motor que aparece no meio da sessão nasce LIGADO — o conjunto guarda quem está de fora', () => {
    const variante = motor('nuvem:acme/modelo-9' as MotorId, { rotulo: 'acme · modelo-9' });
    const [chip] = chipsDaCorrida([variante], { regimeMaximo: 'nuvem', fora: new Set([PESO.id]), compilacao: {} });
    expect(chip).toMatchObject({ forma: 'dentro', marcado: true });
  });
});

describe('o teto de espera de uma coluna', () => {
  const PRAZOS = { padrao: 60_000, pesoAberto: 45 * 60_000 };

  it('é o dobro do prazo que o transporte daquele motor já tem — rede, não relógio', () => {
    // Chegar antes do prazo do transporte apagaria a falha bem escrita que ele sabe dar
    // ("o prazo de 60 s estourou", com a classe certa) para pôr no lugar um "não
    // respondeu" genérico. O mesmo prazo de novo é a folga mais curta que garante isso.
    expect(tetoDaCorridaMs(NUVEM_PADRAO, PRAZOS)).toBe(120_000);
    expect(tetoDaCorridaMs(APARELHO_SISTEMA, PRAZOS)).toBe(120_000);
    expect(tetoDaCorridaMs(SEM_MODELO, PRAZOS)).toBe(120_000);
    expect(tetoDaCorridaMs(PESO.id, PRAZOS)).toBe(2 * 45 * 60_000);
  });

  it('o motivo é legível nas duas ordens de grandeza', () => {
    expect(motivoDoTeto(120_000)).toBe('não respondeu em 120 s');
    expect(motivoDoTeto(2 * 45 * 60_000)).toBe('não respondeu em 90 min');
  });
});

describe('o teto de exposição de um recurso', () => {
  it('lê a gramática do id, e não o prefixo dele', () => {
    expect(cabeNoRegime('nuvem', NUVEM_PADRAO)).toBe(true);
    expect(cabeNoRegime('aparelho', NUVEM_PADRAO)).toBe(false);
    expect(cabeNoRegime('aparelho', PESO.id)).toBe(true);
    expect(cabeNoRegime('sem-modelo', APARELHO_SISTEMA)).toBe(false);
    expect(cabeNoRegime('sem-modelo', SEM_MODELO)).toBe(true);
  });

  it('um id que não se lê não cabe em regime nenhum', () => {
    expect(cabeNoRegime('nuvem', 'isto não é um motor' as MotorId)).toBe(false);
  });
});
