/**
 * A máquina da leitura da Saúde do sono (story 5.5) — a matriz de I/O, com o
 * orquestrador de verdade e motores falsos.
 *
 * **Nenhuma chamada de nuvem roda aqui.** O `motorPara` é injetado, e o ponto de
 * injeção do app (`../motores`) é substituído na carga: ele constrói o client do
 * Supabase no import, o que exigiria credencial e armazenamento nativo para testar
 * uma máquina de estados que não fala com rede nenhuma.
 *
 * As noites são sintéticas, geradas por aritmética — nenhum dado de saúde real
 * entra em arquivo versionado.
 */
import { describe, it, expect, jest } from '@jest/globals';

// Antes dos imports (o babel iça esta chamada): `../motores` constrói o client do
// Supabase ao ser carregado.
jest.mock('../motores', () => ({ motorPara: () => undefined }));

import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  templateDaSaude,
  type Descritor,
  type EntradaDaSaude,
  type EventoDoAnel,
  type Falha,
  type Motor,
  type MotorId,
  type Resposta,
  type SleepPeriod,
  type SonoRange,
} from '@vitale/shared';
import { AUSENCIA_POR_DEFEITO, fraseDoEstado, textoDaAssinatura } from '../assinatura';
import { chaveDaJanela, criarLeitor, type DepsDoLeitor } from '../leitura-da-saude';
import { idsConhecidos } from '../motores/catalogo';

/* ── o acervo sintético ── */

const BXL = 120;

/** Uma noite que acorda em `wakeDay`, apagando às `onsetH` locais da véspera. */
function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + awakeMin / 60) * 3_600_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: awakeMin === 0 ? [] : [
      {
        from: new Date(onsetMs + 3_600_000).toISOString(),
        to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
      },
    ],
    stages: null,
    stageSegments: null,
  };
}

function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOJE = '2026-09-10';

/** Oito semanas com textura: durações, horários e vigílias variando, notas em 2 de 3 dias. */
function acervo(): { noites: SleepPeriod[]; notas: Record<string, number> } {
  const noites: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 56; i += 1) {
    const dia = mais('2026-07-17', i);
    noites.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7, (i * 7) % 41));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites, notas };
}

const ACERVO = acervo();

function entrada(range: SonoRange, offset = 0): EntradaDaSaude {
  return entradaDaSaude(ACERVO.noites, ACERVO.notas, { range, offset, hoje: HOJE });
}

/* ── os motores falsos ── */

/**
 * Um motor aprovado: ele devolve **o próprio template**, com os marcadores.
 *
 * É o único texto que se pode fabricar aqui com certeza de passar pela conferência
 * do descritor — e é o bastante, porque o que se testa é a máquina, não a qualidade
 * do texto. Quem julga texto é a bancada.
 *
 * Responde **pela janela do pedido que recebeu**: a chave é o corpo do pedido, que
 * é função do caso. Duas janelas no mesmo caso têm o mesmo pedido (é de propósito,
 * e é o que faz os hashes coincidirem) e portanto o mesmo template, então a
 * colisão é correta; janelas em casos diferentes recebem cada uma o seu.
 */
function motorQueEscreve(
  entradas: EntradaDaSaude | readonly EntradaDaSaude[],
  tipo: 'aparelho' | 'nuvem' = 'nuvem',
): Motor {
  const lista = Array.isArray(entradas) ? entradas : [entradas as EntradaDaSaude];
  const porPedido = new Map<string, string>();
  for (const e of lista) {
    const pedido = descritorDaSaudeDoSono.montarPedido(e);
    if (pedido) porPedido.set(pedido.usuario, templateDaSaude(e));
  }
  return async (pedido) => {
    const texto = porPedido.get(pedido.usuario);
    if (texto === undefined) throw new Error('o teste não preparou resposta para este pedido');
    const resposta: Resposta = {
      texto,
      assinatura: { tipo, provedor: 'prov-a', modelo: 'modelo-1' },
      tokens: { entrada: 120, saida: 30 },
    };
    return resposta;
  };
}

/** Um motor que devolve texto que a conferência reprova: algarismo, no regime interpolado. */
function motorQueReprova(): Motor {
  return async () => ({
    texto: 'A duração ficou em 5 horas nesta janela.',
    assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' },
  });
}

function motorQueFalha(falha: Falha): Motor {
  return async () => falha;
}

/** Um motor lento, para a janela trocar no meio da espera. */
function motorLento(
  entradas: EntradaDaSaude | readonly EntradaDaSaude[],
  ms: number,
): { motor: Motor; chamadas: () => number } {
  let chamadas = 0;
  const pronto = motorQueEscreve(entradas);
  return {
    motor: async (p) => {
      chamadas += 1;
      await new Promise((r) => setTimeout(r, ms));
      return pronto(p);
    },
    chamadas: () => chamadas,
  };
}

/* ── o hospedeiro falso ── */

interface Montado {
  readonly deps: DepsDoLeitor;
  readonly anel: EventoDoAnel[];
  readonly pedidos: () => number;
}

/**
 * O relógio injetado, na ordem em que o orquestrador o lê: o instante da
 * execução, o início da chamada e o fim dela. A diferença entre os dois últimos é
 * o `ms` da assinatura — 17,2 s, na escala do que foi medido em 12/09.
 */
const RELOGIO: readonly number[] = [0, 0, 17_200];

function hospedeiro(
  motores: Readonly<Partial<Record<MotorId, Motor>>>,
  preferencia: string | null,
  relogio: readonly number[] = RELOGIO,
): Montado {
  const anel: EventoDoAnel[] = [];
  let pedidos = 0;
  let tique = 0;
  return {
    anel,
    pedidos: () => pedidos,
    deps: {
      motorPara: (id) => {
        const m = motores[id];
        if (m) pedidos += 1;
        return m;
      },
      registrar: (e) => {
        anel.push(e);
      },
      // Relógio injetado: o `ms` da assinatura é medido, não cronometrado.
      agora: () => new Date(relogio[Math.min(tique++, relogio.length - 1)]),
      lerPreferencia: async () => preferencia as MotorId | null,
      // Assíncrono desde a 5.6: parte do catálogo vem do servidor (a lista de
      // motores aprovados). Aqui é só o que o app conhece sozinho — nenhum teste
      // desta suíte abre rede.
      catalogo: async () => idsConhecidos,
    },
  };
}

/* ── os testes ── */

describe('a leitura da Saúde do sono, na tela', () => {
  it('a tela abre e nada sai: nenhuma chamada, e a vaga em repouso', () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);
    leitor.janela(chaveDaJanela(e));

    expect(leitor.estadoDe(chaveDaJanela(e))).toEqual({ fase: 'repouso' });
    expect(h.pedidos()).toBe(0);
    expect(h.anel).toHaveLength(0);
  });

  it('a nuvem escreve: a frase é a do motor, e a assinatura nomeia a nuvem e o tempo', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    expect(estado.fase).toBe('lida');
    if (estado.fase !== 'lida') throw new Error('não leu');
    expect(estado.motor).toBe(NUVEM_PADRAO);
    expect(estado.frase.length).toBeGreaterThan(0);
    // A frase montada não tem marcador: o código trocou cada um pelo fato.
    expect(estado.frase).not.toMatch(/[{}]/);
    expect(textoDaAssinatura(estado)).toBe('escrito pela nuvem · 17 s');
    // O hash do pedido veio do anel — o app não o calcula.
    expect(estado.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a nuvem recusa: template, e o motivo em palavras', async () => {
    const e = entrada('7d');
    const h = hospedeiro(
      { [NUVEM_PADRAO]: motorQueFalha({ classe: 'recusa-do-modelo', detalhe: 'não posso' }) },
      NUVEM_PADRAO,
    );
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    expect(estado.fase).toBe('piso');
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('recusa-do-modelo');
    // O piso é o template já interpolado — a mesma frase de quando não há motor.
    expect(estado.frase).toBe(await templateDaTela(e));
    expect(estado.frase).not.toMatch(/[{}]/);
    // O texto que a matriz cita, à letra, com o tempo como terceiro segmento (ver o
    // Spec Change Log: o tempo é o que prova que houve chamada nova).
    expect(textoDaAssinatura(estado)).toBe('a nuvem recusou · escrito sem modelo · 17 s');
  });

  it('sem rede: indisponível, e o template', async () => {
    const e = entrada('7d');
    const h = hospedeiro(
      { [NUVEM_PADRAO]: motorQueFalha({ classe: 'indisponivel', detalhe: 'sem rede' }) },
      NUVEM_PADRAO,
    );
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('indisponivel');
    expect(textoDaAssinatura(estado)).toBe('a nuvem não atendeu · escrito sem modelo · 17 s');
  });

  it('reprovada na conferência: template, e os problemas ficam só no anel', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueReprova() }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('reprovada');
    expect(textoDaAssinatura(estado)).toBe('a nuvem escreveu fora das regras · escrito sem modelo · 17 s');
    // Os problemas não chegam à tela: eles vivem na trilha, no anel.
    expect(JSON.stringify(estado)).not.toContain('regra');
    const problemas = h.anel.flatMap((ev) => ev.trilha.flatMap((t) => t.problemas ?? []));
    expect(problemas.length).toBeGreaterThan(0);
  });

  it('motor indisponível no seletor: o aparelho entra na trilha sem nenhuma chamada', async () => {
    const e = entrada('7d');
    // O hospedeiro não entrega o aparelho (é o marco B), mas o catálogo o conhece.
    const h = hospedeiro({}, APARELHO_SISTEMA);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('indisponivel');
    expect(estado.motor).toBe(APARELHO_SISTEMA);
    const trilha = h.anel[0].trilha;
    expect(trilha).toHaveLength(1);
    expect(trilha[0].sintetica).toBe(true);
  });

  it('piso por escolha: preferência sem-modelo não chama ninguém', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, SEM_MODELO, [0, 0]);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('preferencia');
    expect(h.pedidos()).toBe(0);
    expect(textoDaAssinatura(estado)).toBe('escrito sem modelo · instantâneo');
  });

  it('preferência ilegível cai no padrão do recurso — e o padrão é sem-modelo', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, 'lixo-corrompido', [0, 0]);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('preferencia');
    expect(h.pedidos()).toBe(0);
  });

  it('pedido nulo: a vaga volta ao convite, e nenhuma chamada sai', async () => {
    const e = entrada('7d');
    // O descritor da Saúde nunca devolve pedido nulo ("todo caso gera pedido"), então
    // o ramo só se alcança com um recurso que devolva — é para isso que o leitor
    // aceita o descritor injetado.
    const mudo: Descritor<EntradaDaSaude, string> = {
      ...descritorDaSaudeDoSono,
      montarPedido: () => null,
    };
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO, [0]);
    const leitor = criarLeitor({ ...h.deps, descritor: mudo });

    await leitor.ler(e);

    // "vaga fica em repouso com o texto de convite": o estado é repouso, e é o
    // repouso que a tela desenha como convite.
    expect(leitor.estadoDe(chaveDaJanela(e))).toEqual({ fase: 'repouso' });
    // "nenhuma chamada sai": o motor nem foi pedido ao ponto de injeção.
    expect(h.pedidos()).toBe(0);
    // E o orquestrador registrou a execução como muda — a prova de que o ramo
    // exercitado é o do pedido nulo, e não o da preferência em sem-modelo.
    expect(h.anel).toHaveLength(1);
    expect(h.anel[0].causa).toBe('mudo');
    expect(h.anel[0].trilha).toEqual([]);
  });

  it('pedido nulo: a frase do piso que o orquestrador devolve é descartada, não promovida a manchete', async () => {
    const e = entrada('7d');
    const mudo: Descritor<EntradaDaSaude, string> = {
      ...descritorDaSaudeDoSono,
      montarPedido: () => null,
    };
    // O orquestrador, em modo produto, devolve piso COM a frase do template nesse
    // caminho. A tela não a mostra: ela não foi pedida a modelo nenhum, e as cinco
    // linhas abaixo já dizem o que ela diria. Este teste trava essa decisão — sem
    // ele, "repouso" e "manchete do template" passariam a mesma suíte.
    const h = hospedeiro({}, NUVEM_PADRAO, [0]);
    const leitor = criarLeitor({ ...h.deps, descritor: mudo });

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    expect(estado.fase).not.toBe('piso');
    expect(estado.fase).not.toBe('lida');
    expect(fraseDoEstado(estado)).toBeNull();
    expect(textoDaAssinatura(estado)).toBeNull();
  });

  it('toque repetido: o segundo não dispara nada e espera o primeiro', async () => {
    const e = entrada('7d');
    const lento = motorLento(e, 20);
    const h = hospedeiro({ [NUVEM_PADRAO]: lento.motor }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    await Promise.all([leitor.ler(e), leitor.ler(e), leitor.ler(e)]);
    expect(lento.chamadas()).toBe(1);
    expect(leitor.estadoDe(chaveDaJanela(e)).fase).toBe('lida');
  });

  it('toque numa janela NOVA durante a espera dispara leitura própria — não é engolido', async () => {
    const velha = entrada('7d');
    const nova = entrada('7d', 1);
    const lento = motorLento([velha, nova], 20);
    const h = hospedeiro({ [NUVEM_PADRAO]: lento.motor }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    // O dono toca, troca o período durante a espera, e toca de novo. O ícone da
    // janela nova está aceso (a vaga dela está em repouso), então o toque tem de
    // produzir chamada — juntar-se à leitura da janela velha deixaria a tela inerte.
    const primeira = leitor.ler(velha);
    leitor.janela(chaveDaJanela(nova));
    await Promise.all([primeira, leitor.ler(nova)]);

    expect(lento.chamadas()).toBe(2);
    const estado = leitor.estadoDe(chaveDaJanela(nova));
    expect(estado.fase).toBe('lida');
    if (estado.fase !== 'lida') throw new Error('a janela nova não foi lida');
    // A frase sob a janela nova é a dela: a da velha foi descartada.
    expect(estado.frase).toBe(await templateDaTela(nova));
    expect(leitor.estadoDe(chaveDaJanela(velha))).toEqual({ fase: 'repouso' });
  });

  it('janela trocada durante a espera: a resposta é descartada, e a vaga volta ao repouso', async () => {
    const velha = entrada('7d');
    const nova = entrada('7d', 1);
    expect(chaveDaJanela(velha)).not.toBe(chaveDaJanela(nova));

    const lento = motorLento(velha, 20);
    const h = hospedeiro({ [NUVEM_PADRAO]: lento.motor }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    const corrida = leitor.ler(velha);
    // O dono anda um período para trás enquanto a nuvem escreve.
    leitor.janela(chaveDaJanela(nova));
    await corrida;

    expect(leitor.estadoDe(chaveDaJanela(nova))).toEqual({ fase: 'repouso' });
    expect(leitor.estadoDe(chaveDaJanela(velha))).toEqual({ fase: 'repouso' });
  });

  it('a contagem entra na chave: as notas chegando depois não deixam a frase velha na tela', async () => {
    // A mesma janela, contada sem nota e com nota. É o que acontece de verdade
    // quando `carregarNotasDesde` estende o mapa depois do primeiro render de `12m`.
    const semNotas = entradaDaSaude(ACERVO.noites, {}, { range: '7d', offset: 0, hoje: HOJE });
    const comNotas = entrada('7d');
    expect(comNotas.janela).toEqual(semNotas.janela);
    expect(chaveDaJanela(comNotas)).not.toBe(chaveDaJanela(semNotas));

    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(semNotas) }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);
    await leitor.ler(semNotas);
    expect(leitor.estadoDe(chaveDaJanela(semNotas)).fase).toBe('lida');
    // A frase da contagem sem nota não aparece sob a contagem com nota.
    expect(leitor.estadoDe(chaveDaJanela(comNotas))).toEqual({ fase: 'repouso' });
  });

  it('a vaga da janela nova nasce em repouso, mesmo com a frase da anterior já lida', async () => {
    const a = entrada('7d');
    const b = entrada('4s');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(a) }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    await leitor.ler(a);
    expect(leitor.estadoDe(chaveDaJanela(a)).fase).toBe('lida');
    expect(leitor.estadoDe(chaveDaJanela(b))).toEqual({ fase: 'repouso' });
  });

  it('a espera nomeia o motor, e os ouvintes são avisados', async () => {
    const e = entrada('7d');
    const lento = motorLento(e, 10);
    const h = hospedeiro({ [NUVEM_PADRAO]: lento.motor }, NUVEM_PADRAO);
    const leitor = criarLeitor(h.deps);

    const fases: string[] = [];
    leitor.assinar(() => {
      const s = leitor.estadoDe(chaveDaJanela(e));
      fases.push(s.fase === 'escrevendo' ? `escrevendo:${s.motor ?? '—'}` : s.fase);
    });

    await leitor.ler(e);
    expect(fases).toEqual(['escrevendo:—', `escrevendo:${NUVEM_PADRAO}`, 'lida']);
  });

  it('defeito do núcleo não põe mensagem de exceção na tela — só palavras', async () => {
    const e = entrada('7d');
    // Um descritor cujo `montarFrase` lança: é bug de código puro, e o orquestrador
    // relança depois de registrar no anel.
    const comBug: Descritor<EntradaDaSaude, string> = {
      ...descritorDaSaudeDoSono,
      montarFrase: () => {
        throw new TypeError("Cannot read property 'x' of undefined");
      },
    };
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO);
    const leitor = criarLeitor({ ...h.deps, descritor: comBug });

    await leitor.ler(e);
    const estado = leitor.estadoDe(chaveDaJanela(e));
    if (estado.fase !== 'piso') throw new Error('não caiu no piso');
    expect(estado.causa).toBe('defeito');
    // Nada de "Cannot read property" na tela do dono.
    const naTela = `${estado.frase ?? ''}${estado.ausencia ?? ''}${textoDaAssinatura(estado) ?? ''}`;
    expect(naTela).not.toContain('Cannot read property');
    expect(naTela).not.toContain('TypeError');
    expect(estado.ausencia).toBe(AUSENCIA_POR_DEFEITO);
    // E o texto cru está no anel, com a pilha — é lá que ele serve.
    const comPilha = h.anel.find((ev) => ev.pilha !== undefined);
    expect(comPilha?.pilha).toContain('Cannot read property');
  });

  it('o alcance "última" conta quatro dimensões, e o horário não é "± 0 min"', () => {
    const e = entrada('ultima');
    expect(e.alcance).toBe('noite');
    expect(e.score.dimensions.map((d) => d.key)).toEqual([
      'duracao',
      'continuidade',
      'horario',
      'percepcao',
    ]);
    const horario = e.score.dimensions.find((d) => d.key === 'horario');
    expect(horario?.fact).not.toBe('± 0 min');
  });

  /**
   * **A vaga nunca fica presa em "escrevendo".**
   *
   * `escrevendo` é publicado antes de a preferência e o catálogo serem lidos —
   * é o toque do dono, e a espera começa nele. Uma rejeição nesses dois `await`
   * sairia por fora do `try` da leitura e deixaria a tela girando para sempre,
   * com uma rejeição não tratada de brinde. É a família de bug que já mordeu
   * este repositório uma vez (a janela da retro que não destravava), e o
   * contrato das deps ("nunca lança") é promessa, não garantia: quem injeta é
   * outro código.
   */
  it('catálogo que rejeita: cai no estático e a leitura termina — nunca fica em "escrevendo"', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO);
    const leitor = criarLeitor({
      ...h.deps,
      catalogo: () => Promise.reject(new Error('a lista quebrou')),
    });
    leitor.janela(chaveDaJanela(e));

    await leitor.ler(e);

    const s = leitor.estadoDe(chaveDaJanela(e));
    expect(s.fase).not.toBe('escrevendo');
    // E o catálogo estático ainda contém `nuvem:padrao`, então a escolha do dono
    // sobrevive à queda: o que se perde é só a variante nomeada.
    expect(s.fase).toBe('lida');
  });

  it('preferência que rejeita: cai no padrão do recurso, e a leitura termina', async () => {
    const e = entrada('7d');
    const h = hospedeiro({ [NUVEM_PADRAO]: motorQueEscreve(e) }, NUVEM_PADRAO);
    const leitor = criarLeitor({
      ...h.deps,
      lerPreferencia: () => Promise.reject(new Error('o disco quebrou')),
    });
    leitor.janela(chaveDaJanela(e));

    await leitor.ler(e);

    const s = leitor.estadoDe(chaveDaJanela(e));
    expect(s.fase).not.toBe('escrevendo');
    // Sem preferência legível, a cadeia padrão da Saúde é `[sem-modelo]`: o piso,
    // que nunca sobe exposição. Nenhuma chamada de nuvem saiu.
    expect(s.fase).toBe('piso');
    expect(h.pedidos()).toBe(0);
  });
});

/**
 * A frase do template desta entrada, pelo caminho que a própria tela usa: uma
 * leitura com a preferência em `sem-modelo`. Nada de reimplementar a interpolação
 * aqui — se o piso mudar, o teste acompanha.
 */
async function templateDaTela(e: EntradaDaSaude): Promise<string> {
  const h = hospedeiro({}, SEM_MODELO, [0]);
  const leitor = criarLeitor(h.deps);
  await leitor.ler(e);
  const s = leitor.estadoDe(chaveDaJanela(e));
  if (s.fase !== 'piso' || s.frase === undefined) throw new Error('a Saúde sempre tem frase no piso');
  return s.frase;
}
