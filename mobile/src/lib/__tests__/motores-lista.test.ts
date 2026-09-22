/**
 * A lista de motores de nuvem aprovados: do servidor ao catálogo (story 5.6, ADR 0048).
 *
 * **O que precisa de cobertura aqui é a queda, não o sucesso.** A lista é a única
 * peça do catálogo que vem de fora, e o caminho feliz dela é trivial. O que custa
 * caro é a ausência mal tratada: um app que perdesse `nuvem:padrao` porque não
 * conseguiu falar com o servidor ficaria sem nuvem justamente quando a rede está
 * ruim — e a tela diria "indisponível" sem que nada estivesse indisponível.
 *
 * Por isso os cenários da matriz da story estão aqui inteiros: lista nunca lida,
 * lista lida com sucesso, lista que o servidor devolve vazia, function ainda não
 * deployada (o 405), corpo ilegível e rede ausente.
 *
 * **Nenhum teste abre rede:** o `ChamarLista` é injetado, que é a intenção com que
 * ele foi declarado.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

// O módulo constrói o client do Supabase no import. Quem chama aqui é o
// `ChamarLista` injetado, então o client nunca é usado.
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  NUVEM_PADRAO,
  SEM_MODELO,
  APARELHO_SISTEMA,
  descritorDaSaudeDoSono,
  resolverCadeia,
  type MotorDeNuvemAprovado,
} from '@vitale/shared';
import {
  PESOS_ABERTOS,
  MOTORES_CONHECIDOS,
  PONTE_AUSENTE,
  VALIDADE_DA_LISTA_MS,
  guardarListaAprovada,
  idsConhecidosDe,
  listaAprovada,
  listaVencida,
  motivoDeBloqueio,
  motoresDoRecurso,
  nomeDoMotor,
  variantesDaNuvem,
  type ListaAprovada,
} from '../motores/catalogo';
import {
  buscarMotoresAprovados,
  catalogoDoRecurso,
  esquecerLista,
  garantirListaAprovada,
  type ChamarLista,
} from '../motores';

const ACME: MotorDeNuvemAprovado = { motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] };
const OUTRO: MotorDeNuvemAprovado = {
  motor: 'nuvem:acme/modelo-4',
  recursos: ['retrospectiva', 'saude-do-sono'],
};

/** O recurso como o bloqueio o lê — a Saúde do sono, que não grava. */
const SAUDE = { recurso: 'saude-do-sono', regimeMaximo: 'nuvem', grava: false } as const;

/** Uma chamada falsa: devolve o que o teste mandar, e conta as idas. */
function chamada(resultado: { data?: unknown; error?: unknown; lanca?: unknown }) {
  const idas: AbortSignal[] = [];
  const chamar: ChamarLista = async (signal) => {
    idas.push(signal);
    if ('lanca' in resultado) throw resultado.lanca;
    return { data: resultado.data ?? null, error: resultado.error ?? null };
  };
  return { chamar, idas };
}

beforeEach(() => {
  esquecerLista();
});

describe('buscarMotoresAprovados — o que volta do servidor', () => {
  it('2xx com a lista: as entradas legíveis, pela leitura do núcleo', async () => {
    const { chamar } = chamada({ data: { motores: [ACME, OUTRO] } });
    expect(await buscarMotoresAprovados(chamar)).toEqual([ACME, OUTRO]);
  });

  it('2xx com lista vazia é lista vazia — **não** é falha', async () => {
    // "O servidor respondeu e não há nenhuma variante nomeada" é um fato, e o
    // catálogo o trata diferente de "não consegui perguntar".
    const { chamar } = chamada({ data: { motores: [] } });
    expect(await buscarMotoresAprovados(chamar)).toEqual([]);
  });

  it('a entrada solta e ilegível é descartada — as demais passam', async () => {
    const { chamar } = chamada({
      data: {
        motores: [
          ACME,
          { motor: 'nuvem:padrao', recursos: ['saude-do-sono'] }, // o padrão não é desta lista
          { motor: 'aparelho:sistema', recursos: ['saude-do-sono'] }, // nem o aparelho
          { motor: 'lixo', recursos: ['saude-do-sono'] },
          { motor: 'nuvem:acme/x' }, // sem recursos
        ],
      },
    });
    expect(await buscarMotoresAprovados(chamar)).toEqual([ACME]);
  });

  it('a function ainda não deployada (405, AC 3) é null — nunca lista vazia', async () => {
    // Entre o build novo e o deploy da function nova, o GET não é atendido. Se
    // isso virasse lista vazia, o app pararia de perguntar até o cache vencer.
    const { chamar } = chamada({ error: new Error('status 405') });
    expect(await buscarMotoresAprovados(chamar)).toBeNull();
  });

  it('corpo que não é objeto, ou sem `motores`, não derruba nada', async () => {
    // Todos são `null`: **nenhum deles é "o servidor disse que não há nenhum"**.
    // Um 2xx de corpo inesperado — portal cativo, gateway, a function velha
    // respondendo 200 — não pode virar lista vazia, que `garantirListaAprovada`
    // carimbaria por dez minutos e pararia de tentar.
    expect(await buscarMotoresAprovados(chamada({ data: '<html>502</html>' }).chamar)).toBeNull();
    expect(await buscarMotoresAprovados(chamada({ data: {} }).chamar)).toBeNull();
    expect(await buscarMotoresAprovados(chamada({ data: { motores: null } }).chamar)).toBeNull();
    expect(await buscarMotoresAprovados(chamada({ data: { motores: 'nenhum' } }).chamar)).toBeNull();
    // E a lista vazia de verdade — a chave presente, com uma lista — é `[]`.
    expect(await buscarMotoresAprovados(chamada({ data: { motores: [] } }).chamar)).toEqual([]);
  });

  it('o cliente rejeitando (sem rede) é null, e a busca não lança', async () => {
    const { chamar } = chamada({ lanca: new TypeError('Network request failed') });
    await expect(buscarMotoresAprovados(chamar)).resolves.toBeNull();
  });

  it('sempre leva um signal, e o prazo o aborta', async () => {
    const { chamar, idas } = chamada({ data: { motores: [] } });
    await buscarMotoresAprovados(chamar);
    expect(idas[0].aborted).toBe(false);

    // Uma chamada pendurada: o prazo aborta, e a busca devolve null em vez de
    // deixar a leitura da Saúde esperando por uma lista que não vem.
    const pendura: ChamarLista = (signal) =>
      new Promise((_, rejeitar) => {
        signal.addEventListener('abort', () => rejeitar(new Error('AbortError')));
      });
    expect(await buscarMotoresAprovados(pendura, 5)).toBeNull();
  });
});

describe('garantirListaAprovada — o cache com instante', () => {
  it('a primeira chamada busca; a segunda, dentro da validade, não', async () => {
    let idas = 0;
    const buscar = async () => {
      idas += 1;
      return [ACME];
    };
    const agora = () => 1_000;
    expect(await garantirListaAprovada(buscar, agora)).toEqual({ motores: [ACME], lidaEm: 1_000 });
    expect(await garantirListaAprovada(buscar, agora)).toEqual({ motores: [ACME], lidaEm: 1_000 });
    expect(idas).toBe(1);
  });

  it('vencida, busca de novo', async () => {
    let idas = 0;
    const buscar = async () => {
      idas += 1;
      return [ACME];
    };
    let t = 1_000;
    await garantirListaAprovada(buscar, () => t);
    t += VALIDADE_DA_LISTA_MS;
    await garantirListaAprovada(buscar, () => t);
    expect(idas).toBe(2);
    expect(listaAprovada()?.lidaEm).toBe(t);
  });

  it('duas chamadas ao mesmo tempo são uma ida só', async () => {
    // O seletor e a leitura podem pedir a lista juntos no arranque.
    let idas = 0;
    const buscar = async () => {
      idas += 1;
      await new Promise((r) => setTimeout(r, 5));
      return [ACME];
    };
    const [a, b] = await Promise.all([
      garantirListaAprovada(buscar, () => 1_000),
      garantirListaAprovada(buscar, () => 1_000),
    ]);
    expect(idas).toBe(1);
    expect(a).toEqual(b);
  });

  it('a falha não apaga o que já estava guardado', async () => {
    // O que o servidor disse da última vez continua sendo a melhor informação que
    // o app tem: jogá-la fora faria o motor escolhido sumir do seletor no primeiro
    // soluço de rede.
    let t = 1_000;
    await garantirListaAprovada(async () => [ACME], () => t);
    t += VALIDADE_DA_LISTA_MS;
    const depois = await garantirListaAprovada(async () => null, () => t);
    expect(depois).toEqual({ motores: [ACME], lidaEm: 1_000 });
  });

  it('a falha na primeira leitura deixa o catálogo sem lista — e nada mais', async () => {
    expect(await garantirListaAprovada(async () => null, () => 1_000)).toBeNull();
    expect(listaAprovada()).toBeNull();
  });

  it('um `buscar` que lança não derruba a leitura', async () => {
    await expect(
      garantirListaAprovada(async () => {
        throw new Error('quebrou');
      }, () => 1_000),
    ).resolves.toBeNull();
  });

  it('relógio que anda para trás conta como vencida — nunca um cache eterno', () => {
    const lida: ListaAprovada = { motores: [], lidaEm: 10_000 };
    expect(listaVencida(10_000, lida)).toBe(false);
    expect(listaVencida(9_999, lida)).toBe(true);
    expect(listaVencida(10_000 + VALIDADE_DA_LISTA_MS, lida)).toBe(true);
    expect(listaVencida(0, null)).toBe(true);
  });
});

describe('a fusão: o que o app conhece, mais o que o servidor aprovou', () => {
  it('sem lista (nunca lida): só o que o app conhece, com `nuvem:padrao`', () => {
    // AC 1: o app abre, a lista nunca foi lida, e nenhuma variante nomeada aparece.
    const ids = idsConhecidosDe('saude-do-sono', null);
    expect(ids).toEqual([SEM_MODELO, APARELHO_SISTEMA, ...PESOS_ABERTOS.map((p) => p.id), NUVEM_PADRAO]);
  });

  it('com lista: a variante aprovada para ESTE recurso entra, depois do padrão', () => {
    // AC 2: aprovada para o recurso corrente, ela aparece no seletor.
    const lista: ListaAprovada = { motores: [ACME, OUTRO], lidaEm: 1 };
    expect(idsConhecidosDe('saude-do-sono', lista)).toEqual([
      SEM_MODELO,
      APARELHO_SISTEMA,
      ...PESOS_ABERTOS.map((p) => p.id),
      NUVEM_PADRAO,
      ACME.motor,
      OUTRO.motor,
    ]);
    // E a que não foi aprovada para a Retrospectiva não aparece nela.
    expect(idsConhecidosDe('retrospectiva', lista)).toEqual([
      SEM_MODELO,
      APARELHO_SISTEMA,
      ...PESOS_ABERTOS.map((p) => p.id),
      NUVEM_PADRAO,
      OUTRO.motor,
    ]);
  });

  it('a lista só acrescenta: nunca tira o padrão, o piso nem o aparelho', () => {
    // AC 3, e a linha "lista do servidor falha ao ler" da matriz: o que se perde
    // são as variantes nomeadas, e **nada mais**.
    for (const lista of [null, { motores: [], lidaEm: 1 }, { motores: [ACME], lidaEm: 1 }]) {
      const ids = idsConhecidosDe('saude-do-sono', lista);
      expect(ids).toContain(SEM_MODELO);
      expect(ids).toContain(APARELHO_SISTEMA);
      expect(ids).toContain(NUVEM_PADRAO);
    }
  });

  it('a variante nomeada aparece com rótulo legível — nunca id cru', () => {
    const [v] = variantesDaNuvem('saude-do-sono', { motores: [ACME], lidaEm: 1 });
    expect(v.rotulo).toBe('acme · modelo-9');
    // O nome distingue o modelo — é ele que a assinatura da tela contrai.
    expect(v.nome).toBe('o modelo-9 da acme');
    expect(v.descricao.length).toBeGreaterThan(0);
    expect(v.disponivel).toBe(true);
    expect(v.motivo).toBeUndefined();
  });

  it('a lista não duplica o que o app já conhece, nem entrada repetida', () => {
    const lista: ListaAprovada = {
      motores: [
        ACME,
        ACME,
        { motor: NUVEM_PADRAO, recursos: ['saude-do-sono'] },
        { motor: SEM_MODELO as never, recursos: ['saude-do-sono'] },
      ],
      lidaEm: 1,
    };
    const ids = idsConhecidosDe('saude-do-sono', lista);
    expect(ids).toEqual([SEM_MODELO, APARELHO_SISTEMA, ...PESOS_ABERTOS.map((p) => p.id), NUVEM_PADRAO, ACME.motor]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a variante aprovada é selecionável; sem a lista, ela nem existe', () => {
    const conhecidos = motoresDoRecurso('saude-do-sono', { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE }, { motores: [ACME], lidaEm: 1 });
    expect(motivoDeBloqueio(SAUDE, ACME.motor, conhecidos)).toBeNull();
    // Sem a lista, o catálogo não a conhece — e o seletor nem a desenha.
    expect(motoresDoRecurso('saude-do-sono', { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE }, null).some((m) => m.id === ACME.motor)).toBe(false);
  });

  it('a variante aprovada continua sujeita ao regime do recurso', () => {
    // A lista do servidor aprova um destinatário; ela não levanta o teto de
    // exposição de um recurso que não manda dado para fora.
    const soAparelho = { recurso: 'saude-do-sono', regimeMaximo: 'aparelho', grava: false } as const;
    const conhecidos = motoresDoRecurso('saude-do-sono', { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE }, { motores: [ACME], lidaEm: 1 });
    expect(motivoDeBloqueio(soAparelho, ACME.motor, conhecidos)).toBe(
      'este recurso não manda dado além do aparelho',
    );
  });

  it('o cache guardado alimenta o catálogo por padrão', () => {
    guardarListaAprovada([ACME], 1);
    expect(idsConhecidosDe('saude-do-sono')).toContain(ACME.motor);
    esquecerLista();
    expect(idsConhecidosDe('saude-do-sono')).not.toContain(ACME.motor);
  });

  it('o motivo de bloqueio exige o catálogo — o estático não conhece a variante', () => {
    // O parâmetro é obrigatório de propósito: com um padrão, quem esquecesse de
    // passar a lista fundida leria "indisponível neste build" para um motor que o
    // servidor aprovou. Aqui os dois catálogos aparecem lado a lado.
    expect(motivoDeBloqueio(SAUDE, ACME.motor, MOTORES_CONHECIDOS)).toBe('indisponível neste build');
    expect(motivoDeBloqueio(SAUDE, ACME.motor, motoresDoRecurso('saude-do-sono', { sistema: PONTE_AUSENTE, coreai: PONTE_AUSENTE }, { motores: [ACME], lidaEm: 1 }))).toBeNull();
  });
});

/**
 * `catalogoDoRecurso` — o fio que leva a lista fundida às duas leituras reais.
 *
 * **Estava sem teste nenhum**, e é o ponto em que a escolha do dono vive ou
 * morre: `resolverCadeia` descarta calada a preferência que o catálogo não
 * contém, então trocá-lo de volta por uma constante devolveria a frase do padrão
 * com o seletor marcando outra coisa — e nenhuma suíte diria nada.
 */
describe('catalogoDoRecurso — da lista à cadeia', () => {
  it('traz a variante aprovada para o recurso, e a cadeia a põe na cabeça', async () => {
    guardarListaAprovada([ACME], Date.now());

    const catalogo = await catalogoDoRecurso('saude-do-sono');
    expect(catalogo).toContain(ACME.motor);

    // O que a leitura de verdade faz com isso: a preferência do dono sobrevive.
    const cadeia = resolverCadeia(descritorDaSaudeDoSono, ACME.motor, catalogo);
    expect(cadeia[0]).toBe(ACME.motor);
    // E o piso continua fechando a cadeia — a variante não substitui o template.
    expect(cadeia[cadeia.length - 1]).toBe(SEM_MODELO);
  });

  it('sem a lista, a MESMA preferência é descartada e a cadeia cai no padrão', async () => {
    // O contrapositivo, que é o que prova o fio: sem `catalogoDoRecurso` levando
    // a lista, a escolha do dono vira o padrão do recurso sem nada explicar.
    esquecerLista();
    const catalogo = await catalogoDoRecurso('saude-do-sono');
    expect(catalogo).not.toContain(ACME.motor);
    expect(resolverCadeia(descritorDaSaudeDoSono, ACME.motor, catalogo)[0]).not.toBe(ACME.motor);
  });

  it('a variante aprovada só para a Saúde não aparece no catálogo da Retrospectiva', async () => {
    guardarListaAprovada([ACME], Date.now());
    expect(await catalogoDoRecurso('retrospectiva')).not.toContain(ACME.motor);
    expect(await catalogoDoRecurso('saude-do-sono')).toContain(ACME.motor);
  });
});

describe('o nome de uma variante nomeada', () => {
  it('sai do id, e distingue um modelo do outro', () => {
    // Antes toda variante caía em "a nuvem": a assinatura não dizia qual modelo
    // escreveu, e a bancada anunciava "medindo a nuvem…" para N motores.
    expect(nomeDoMotor('nuvem:acme/modelo-9')).toBe('o modelo-9 da acme');
    expect(nomeDoMotor('nuvem:acme/modelo-4')).toBe('o modelo-4 da acme');
    expect(nomeDoMotor('nuvem:acme/modelo-9')).not.toBe(nomeDoMotor('nuvem:acme/modelo-4'));
    // O simbólico continua sendo "a nuvem" — é o servidor que escolhe.
    expect(nomeDoMotor(NUVEM_PADRAO)).toBe('a nuvem');
  });

  it('o artigo é o que a assinatura contrai — "pelo", não "por o"', () => {
    // `assinatura.ts` contrai "o …" em "pelo …" e "do …". Um nome sem artigo
    // sairia como "escrito por modelo-9 da acme".
    expect(nomeDoMotor('nuvem:acme/modelo-9').startsWith('o ')).toBe(true);
  });

  it('o catálogo e a assinatura usam o mesmo nome — não há dois', () => {
    const [v] = variantesDaNuvem('saude-do-sono', { motores: [ACME], lidaEm: 1 });
    expect(v.nome).toBe(nomeDoMotor(ACME.motor));
  });
});

describe('o typo no secret — o erro de operação mais provável', () => {
  it('a entrada com recurso que não existe é lida, e avisada', async () => {
    // `saude_do_sono` em vez de `saude-do-sono` produz uma entrada VÁLIDA que
    // nunca casa com recurso nenhum: o motor some do seletor sem erro. A leitura
    // não a rejeita (ela pode ser de uma versão futura do app), mas o aparelho
    // avisa — uma vez por busca, nunca em render.
    const avisos: unknown[] = [];
    const warn = jest.spyOn(console, 'warn').mockImplementation((...a) => {
      avisos.push(a[0]);
    });
    try {
      const comTypo: MotorDeNuvemAprovado = { motor: 'nuvem:acme/modelo-9', recursos: ['saude_do_sono'] };
      await garantirListaAprovada(async () => [comTypo], () => 1_000);
      expect(avisos).toHaveLength(1);
      expect(String(avisos[0])).toContain('nuvem:acme/modelo-9');
      expect(String(avisos[0])).toContain('NUVEM_MOTORES_APROVADOS');
      // E o sintoma que o aviso explica: ela não entra em catálogo nenhum.
      expect(await catalogoDoRecurso('saude-do-sono')).not.toContain(comTypo.motor);
    } finally {
      warn.mockRestore();
    }
  });

  it('a entrada com recurso conhecido não avisa nada', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await garantirListaAprovada(async () => [ACME], () => 1_000);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
