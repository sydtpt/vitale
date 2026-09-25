/**
 * Do lote para a célula — a metade da matriz de I/O da Story 2.4b que vive no
 * celular.
 *
 * O que se mede aqui é a tradução `lote → estado da célula`: a foto que sumiu do
 * iPhone, a foto que o dono desligou, a rota que não tem linha, a rota vazia e o
 * lote que falhou. Os cinco são linhas da matriz, e os cinco fazem a tela fazer
 * coisas diferentes — `sem-linha` cai para o **papel**, `pronta` com traçado curto
 * cai para a **grade**, e trocá-los não deixa nada vermelho.
 */
import { describe, it, expect } from '@jest/globals';
import assert from 'assert';
import type {
  AcervoDaParede, ActivityPhoto, Capa, ItemDaParede, LadrilhoDaParede, ParDaRota, PonteirosDaParede,
} from '@vitale/shared';
import {
  fotoDoLadrilho, midiaDaParede, paredeInicial, proximaParede, relogioDaParede, rotaDoLadrilho,
  type AcaoDaParede, type EstadoDaParede, type LoteLido,
} from '../parede';

function capa(over: Partial<Capa> = {}): Capa {
  return {
    tipoPeriodo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    natureza: 'foto',
    fotoId: 'f-1',
    fotoTakenAt: '2026-08-14T12:38:00.000Z',
    rotaActivityId: null,
    legenda: 'Ittre · km 31,1 · 12:38',
    carimbadaEm: '2026-09-01T00:00:00.000Z',
    motivo: 'rajada',
    fotoActivityId: 'a-1',
    ...over,
  };
}

function ladrilho(c: Capa | null): LadrilhoDaParede {
  return {
    tipoPeriodo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    chave: 'month\u00002026-08-01\u00002026-08-31',
    rotulo: 'Agosto de 2026',
    manchete: null,
    capa: c,
    legenda: c?.legenda ?? null,
    offset: -1,
  };
}

const FOTO = { id: 'f-1', assetId: 'ph-1', mediaType: 'photo' } as unknown as ActivityPhoto;

const loteDeFotos = (...fotos: ActivityPhoto[]): LoteLido<ActivityPhoto> =>
  ({ estado: 'pronto', porId: new Map(fotos.map((f) => [f.id, f])) });

const loteDeRotas = (entradas: Record<string, ParDaRota[]>): LoteLido<readonly ParDaRota[]> =>
  ({ estado: 'pronto', porId: new Map(Object.entries(entradas)) });

describe('fotoDoLadrilho — o que o lote tem desta capa', () => {
  it('capa que não é de foto não pede nada', () => {
    expect(fotoDoLadrilho(ladrilho(capa({ natureza: 'grade', fotoId: null })), loteDeFotos()))
      .toEqual({ estado: 'nao-pedida' });
    expect(fotoDoLadrilho(ladrilho(null), loteDeFotos())).toEqual({ estado: 'nao-pedida' });
  });

  it('lote em voo é `procurando` — e não "não existe"', () => {
    expect(fotoDoLadrilho(ladrilho(capa()), { estado: 'procurando' })).toEqual({ estado: 'procurando' });
  });

  it('casa por `foto_id`, e não pela atividade', () => {
    const outra = { id: 'f-2', assetId: 'ph-2', mediaType: 'photo' } as unknown as ActivityPhoto;
    const r = fotoDoLadrilho(ladrilho(capa()), loteDeFotos(outra, FOTO));
    expect(r).toEqual({ estado: 'pronta', foto: FOTO });
  });

  /**
   * A linha sumiu, ou o dono desligou a foto depois do carimbo — a leitura em
   * lote só traz `linked`. Nos dois, o ladrilho cai para a legenda carimbada, que
   * continua dizendo o que a capa era.
   */
  it('lote sem esta foto é `sem-foto` — a capa cai para a legenda', () => {
    expect(fotoDoLadrilho(ladrilho(capa()), loteDeFotos())).toEqual({ estado: 'sem-foto' });
  });

  it('capa anterior à 1.16, sem atividade carimbada, também cai para a legenda', () => {
    // Ela nem entra em `ponteirosDaParede`, então nunca estará no lote.
    expect(fotoDoLadrilho(ladrilho(capa({ fotoActivityId: null })), loteDeFotos()))
      .toEqual({ estado: 'sem-foto' });
  });

  it('lote que falhou é `sem-foto`, nunca um quadro vazio para sempre', () => {
    expect(fotoDoLadrilho(ladrilho(capa()), { estado: 'falhou' })).toEqual({ estado: 'sem-foto' });
  });

  it('capa de foto sem `foto_id` não procura nada', () => {
    expect(fotoDoLadrilho(ladrilho(capa({ fotoId: null })), { estado: 'procurando' }))
      .toEqual({ estado: 'sem-foto' });
  });
});

describe('rotaDoLadrilho — os cinco estados que `desenhoDaCapa` lê', () => {
  const comRota = (over: Partial<Capa> = {}) =>
    ladrilho(capa({ natureza: 'tracado', fotoId: null, fotoActivityId: null, rotaActivityId: 'a-9', ...over }));

  it('capa que não é de traçado não pede nada', () => {
    expect(rotaDoLadrilho(ladrilho(capa()), loteDeRotas({}))).toEqual({ estado: 'nao-pedida' });
    expect(rotaDoLadrilho(ladrilho(null), loteDeRotas({}))).toEqual({ estado: 'nao-pedida' });
  });

  it('capa de traçado sem ponteiro não pede nada', () => {
    expect(rotaDoLadrilho(comRota({ rotaActivityId: null }), loteDeRotas({}))).toEqual({ estado: 'nao-pedida' });
  });

  it('lote em voo é `procurando` — é ele que reserva a altura', () => {
    expect(rotaDoLadrilho(comRota(), { estado: 'procurando' })).toEqual({ estado: 'procurando' });
  });

  it('a rota do lote chega como `pronta`, com os pares crus', () => {
    const overview: ParDaRota[] = [[50.6, 4.3], [50.7, 4.4]];
    expect(rotaDoLadrilho(comRota(), loteDeRotas({ 'a-9': overview })))
      .toEqual({ estado: 'pronta', overview });
  });

  /**
   * A distinção que carrega a matriz: quem não voltou do `.in()` **não tem
   * linha** — e a capa cai para o papel. Uma linha que existe com traçado vazio
   * volta como `pronta`, e a capa cai para a **grade**. Colapsar as duas foi o
   * defeito que a 2.4a corrigiu em `fetchRouteSurface`.
   */
  it('id fora do lote é `sem-linha` — papel, e não grade', () => {
    expect(rotaDoLadrilho(comRota(), loteDeRotas({ 'outra': [] }))).toEqual({ estado: 'sem-linha' });
  });

  it('linha existente com traçado vazio é `pronta` — ela cai para a grade, não para o papel', () => {
    expect(rotaDoLadrilho(comRota(), loteDeRotas({ 'a-9': [] }))).toEqual({ estado: 'pronta', overview: [] });
  });

  it('lote que falhou é `falhou`', () => {
    expect(rotaDoLadrilho(comRota(), { estado: 'falhou' })).toEqual({ estado: 'falhou' });
  });
});

/* ── o relógio ───────────────────────────────────────────────────────────── */

describe('relogioDaParede — renova quando o dia vira, e só', () => {
  it('no mesmo dia devolve o anterior — identidade, não igualdade', () => {
    const antes = new Date(2026, 8, 15, 8, 0, 0);
    const depois = new Date(2026, 8, 15, 23, 59, 59);
    assert.strictEqual(relogioDaParede(antes, depois), antes);
  });

  /**
   * O defeito que ele fecha: uma parede aberta atravessando a virada do mês
   * manteria o `offset` velho, e as capas `grade` desenhariam o mês errado logo
   * abaixo de uma edição que o foco acabou de trazer.
   */
  it('virado o dia devolve o novo', () => {
    const antes = new Date(2026, 8, 30, 23, 59, 59);
    const depois = new Date(2026, 9, 1, 0, 0, 1);
    assert.strictEqual(relogioDaParede(antes, depois), depois);
  });

  it('o ano vira junto', () => {
    const antes = new Date(2026, 11, 31, 20, 0, 0);
    const depois = new Date(2027, 0, 1, 1, 0, 0);
    assert.strictEqual(relogioDaParede(antes, depois), depois);
  });
});

/* ── as transições ───────────────────────────────────────────────────────── */

const NOW = new Date(2026, 8, 15, 10, 0, 0);
const ACERVO: AcervoDaParede = { arquivo: [], capas: [], textos: [] };
const SEM_PONTEIROS: PonteirosDaParede = { fotos: [], rotas: [] };
const COM_PONTEIROS: PonteirosDaParede = { fotos: ['f-1'], rotas: ['a-9'] };

const mapaDeFotos = (...ids: string[]) =>
  new Map<string, ActivityPhoto>(ids.map((id) => [id, { ...FOTO, id }]));

/** Uma parede já desenhada, com as duas ondas respondidas. */
function paredePronta(): EstadoDaParede {
  let e = paredeInicial(NOW);
  e = proximaParede(e, { tipo: 'ler', carga: 1, now: NOW });
  e = proximaParede(e, { tipo: 'acervo', carga: 1, acervo: ACERVO, ponteiros: COM_PONTEIROS });
  e = proximaParede(e, { tipo: 'fotos', carga: 1, porId: mapaDeFotos('f-1') });
  e = proximaParede(e, { tipo: 'rotas', carga: 1, porId: new Map([['a-9', [[50.6, 4.3]] as ParDaRota[]]]) });
  return e;
}

describe('proximaParede — a primeira leitura', () => {
  it('nasce carregando e chega a pronta', () => {
    let e = paredeInicial(NOW);
    assert.equal(e.fase, 'carregando');
    e = proximaParede(e, { tipo: 'ler', carga: 1, now: NOW });
    assert.equal(e.fase, 'carregando');
    e = proximaParede(e, { tipo: 'acervo', carga: 1, acervo: ACERVO, ponteiros: COM_PONTEIROS });
    assert.equal(e.fase, 'pronta');
    // Sem resposta anterior, os lotes procuram — não fingem estar prontos.
    assert.deepEqual(e.fase === 'pronta' ? e.fotos.estado : null, 'procurando');
    assert.deepEqual(e.fase === 'pronta' ? e.rotas.estado : null, 'procurando');
  });

  /**
   * Sem ponteiro nenhum, o lote já nasce **pronto e vazio**. Semeá-lo como
   * `procurando` é o defeito que o revisor demonstrou: as capas anteriores à
   * Story 1.16 ficavam em cinza **para sempre**, e a suíte continuava verde.
   */
  it('sem ponteiros os lotes já nascem prontos — ninguém fica esperando resposta que não vem', () => {
    let e = paredeInicial(NOW);
    e = proximaParede(e, { tipo: 'ler', carga: 1, now: NOW });
    e = proximaParede(e, { tipo: 'acervo', carga: 1, acervo: ACERVO, ponteiros: SEM_PONTEIROS });
    assert.equal(e.fase === 'pronta' ? e.fotos.estado : null, 'pronto');
    assert.equal(e.fase === 'pronta' ? e.rotas.estado : null, 'pronto');
  });

  it('o erro do acervo vira a fase de erro, com a frase', () => {
    let e = proximaParede(paredeInicial(NOW), { tipo: 'ler', carga: 1, now: NOW });
    e = proximaParede(e, { tipo: 'erro', carga: 1, mensagem: 'não deu' });
    assert.deepEqual(e.fase === 'erro' ? e.mensagem : null, 'não deu');
  });

  it('sem sessão a parede diz sem-sessao, mesmo já tendo desenhado antes', () => {
    let e = paredePronta();
    e = proximaParede(e, { tipo: 'ler', carga: 2, now: NOW });
    e = proximaParede(e, { tipo: 'sem-sessao', carga: 2 });
    assert.equal(e.fase, 'sem-sessao');
  });
});

describe('proximaParede — a volta ao foco não pisca', () => {
  /**
   * O que este bloco prende: a releitura **não** derruba o que está na tela. Nem
   * a fase (que continua `pronta`), nem os lotes — que voltariam a cinza em toda
   * capa de foto e de traçado a cada retorno.
   */
  it('`ler` sobre uma parede pronta mantém a fase e os lotes', () => {
    const antes = paredePronta();
    const depois = proximaParede(antes, { tipo: 'ler', carga: 2, now: NOW });
    assert.equal(depois.fase, 'pronta');
    assert.equal(depois.fase === 'pronta' ? depois.fotos.estado : null, 'pronto');
    assert.equal(depois.carga, 2);
  });

  it('o acervo novo semeia os lotes como `relendo`, guardando a resposta anterior', () => {
    let e = paredePronta();
    e = proximaParede(e, { tipo: 'ler', carga: 2, now: NOW });
    e = proximaParede(e, { tipo: 'acervo', carga: 2, acervo: ACERVO, ponteiros: COM_PONTEIROS });
    assert.equal(e.fase === 'pronta' ? e.fotos.estado : null, 'relendo');
    // E a resposta anterior continua lá: é ela que desenha enquanto a nova vem.
    const foto = e.fase === 'pronta' && 'porId' in e.fotos ? e.fotos.porId.get('f-1') : null;
    assert.ok(foto, 'a resposta anterior foi descartada — a parede pisca');
  });

  it('a releitura que falha mantém a resposta anterior, em vez de apagar a parede', () => {
    let e = paredePronta();
    e = proximaParede(e, { tipo: 'ler', carga: 2, now: NOW });
    e = proximaParede(e, { tipo: 'acervo', carga: 2, acervo: ACERVO, ponteiros: COM_PONTEIROS });
    e = proximaParede(e, { tipo: 'fotos-falharam', carga: 2 });
    assert.equal(e.fase === 'pronta' ? e.fotos.estado : null, 'pronto');
    const foto = e.fase === 'pronta' && 'porId' in e.fotos ? e.fotos.porId.get('f-1') : null;
    assert.ok(foto, 'a falha apagou a resposta que ainda valia');
  });

  it('a PRIMEIRA leitura que falha é `falhou` — não há resposta anterior a guardar', () => {
    let e = proximaParede(paredeInicial(NOW), { tipo: 'ler', carga: 1, now: NOW });
    e = proximaParede(e, { tipo: 'acervo', carga: 1, acervo: ACERVO, ponteiros: COM_PONTEIROS });
    e = proximaParede(e, { tipo: 'fotos-falharam', carga: 1 });
    assert.equal(e.fase === 'pronta' ? e.fotos.estado : null, 'falhou');
  });
});

describe('proximaParede — a carga superada', () => {
  /**
   * O caso da troca de conta: a leitura antiga responde **depois** que a nova
   * começou. Sem a guarda, ela desenha o arquivo do dono anterior por cima.
   */
  it('a resposta de uma carga velha é ignorada, em todas as ações', () => {
    let e = proximaParede(paredeInicial(NOW), { tipo: 'ler', carga: 1, now: NOW });
    e = proximaParede(e, { tipo: 'ler', carga: 2, now: NOW });
    const emCurso = e;
    for (const velha of [
      { tipo: 'acervo', carga: 1, acervo: ACERVO, ponteiros: COM_PONTEIROS },
      { tipo: 'erro', carga: 1, mensagem: 'do dono anterior' },
      { tipo: 'sem-sessao', carga: 1 },
      { tipo: 'fotos', carga: 1, porId: mapaDeFotos('f-velha') },
      { tipo: 'rotas', carga: 1, porId: new Map() },
      { tipo: 'fotos-falharam', carga: 1 },
      { tipo: 'rotas-falharam', carga: 1 },
    ] as AcaoDaParede[]) {
      assert.strictEqual(proximaParede(emCurso, velha), emCurso, `${velha.tipo} da carga velha passou`);
    }
  });

  it('a resposta da carga em curso passa', () => {
    let e = proximaParede(paredeInicial(NOW), { tipo: 'ler', carga: 1, now: NOW });
    e = proximaParede(e, { tipo: 'ler', carga: 2, now: NOW });
    e = proximaParede(e, { tipo: 'acervo', carga: 2, acervo: ACERVO, ponteiros: SEM_PONTEIROS });
    assert.equal(e.fase, 'pronta');
  });

  /** A mídia de uma leitura cujo acervo nunca chegou não tem onde pousar. */
  it('a mídia que chega fora de uma parede desenhada não muda nada', () => {
    const e = proximaParede(paredeInicial(NOW), { tipo: 'ler', carga: 1, now: NOW });
    assert.strictEqual(proximaParede(e, { tipo: 'fotos', carga: 1, porId: mapaDeFotos('f-1') }), e);
  });
});

/* ── o lote `relendo` na célula ──────────────────────────────────────────── */

describe('a célula durante uma releitura', () => {
  const comFoto = () => ladrilho(capa());

  it('o id que já estava no mapa anterior desenha na hora — é o que não pisca', () => {
    const lote: LoteLido<ActivityPhoto> = { estado: 'relendo', porId: new Map([['f-1', FOTO]]) };
    assert.deepEqual(fotoDoLadrilho(comFoto(), lote), { estado: 'pronta', foto: FOTO });
  });

  /**
   * O id que **não** estava é `procurando`, e não `sem-foto`: dele a resposta
   * ainda não se sabe, e cair para a legenda seria afirmar uma ausência que a
   * leitura em voo pode desmentir no quadro seguinte.
   */
  it('o id que não estava é `procurando`, e não `sem-foto`', () => {
    const lote: LoteLido<ActivityPhoto> = { estado: 'relendo', porId: new Map() };
    assert.deepEqual(fotoDoLadrilho(comFoto(), lote), { estado: 'procurando' });
  });

  it('a rota segue a mesma regra — `procurando`, não `sem-linha`', () => {
    const comRota = ladrilho(capa({ natureza: 'tracado', fotoId: null, rotaActivityId: 'a-9' }));
    const lote: LoteLido<readonly ParDaRota[]> = { estado: 'relendo', porId: new Map() };
    assert.deepEqual(rotaDoLadrilho(comRota, lote), { estado: 'procurando' });
  });
});

/* ── a mídia resolvida por onda ──────────────────────────────────────────── */

describe('midiaDaParede — identidade estável por onda', () => {
  const L = ladrilho(capa());
  const itens: ItemDaParede[] = [{ tipo: 'linha', chave: 'linha|x', ladrilhos: [L] }];
  const lote = loteDeFotos(FOTO);

  /**
   * O ponto inteiro: `fotoDoLadrilho` devolve objeto novo a cada chamada no estado
   * `pronta`, e o `React.memo` do ladrilho — que existe porque a parede monta
   * quarenta deles — nunca casaria.
   */
  it('a mesma célula devolve o MESMO objeto em duas leituras', () => {
    const m = midiaDaParede(itens, lote, { estado: 'pronto', porId: new Map() });
    assert.strictEqual(m.foto(L), m.foto(L));
    assert.strictEqual(m.rota(L), m.rota(L));
  });

  it('e o valor é o mesmo que a regra crua daria', () => {
    const m = midiaDaParede(itens, lote, { estado: 'pronto', porId: new Map() });
    assert.deepEqual(m.foto(L), fotoDoLadrilho(L, lote));
  });

  /** Total por construção: um ladrilho de fora destes `itens` cai na regra crua. */
  it('um ladrilho que não veio destes itens ainda responde', () => {
    const m = midiaDaParede([], lote, { estado: 'pronto', porId: new Map() });
    assert.deepEqual(m.foto(L), { estado: 'pronta', foto: FOTO });
  });

  it('a régua e o anuário não entram no mapa — só a fileira tem ladrilho', () => {
    const m = midiaDaParede(
      [{ tipo: 'regua', chave: 'regua|2026', ano: 2026 }],
      lote,
      { estado: 'pronto', porId: new Map() },
    );
    assert.deepEqual(m.foto(L), { estado: 'pronta', foto: FOTO });
  });
});
