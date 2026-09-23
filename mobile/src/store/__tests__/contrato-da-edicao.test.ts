/**
 * O contrato da edição, do lado do celular (Story 2.2).
 *
 * O caminho inteiro que a tela percorre — `ensure` → `summary` → `imprimirEdicao` —
 * sobre a fixture do núcleo (`packages/shared/src/period/__tests__/contrato-da-edicao.ts`):
 * as leituras reais de `data/` contra o banco falso dela, o resumo pela store da
 * Retrospectiva, e a impressão com `portasDaEdicao` sobre o mesmo banco e o motor de
 * nuvem do núcleo (`criarMotorDeNuvem`) com o transporte dela. O resultado tem de
 * bater o `GABARITO` — o **mesmo** que o núcleo e o script cobram. Se a store deixar
 * de cortar a janela, ou montar a entrada por outra conta, o celular deixa de
 * imprimir a edição que o Mac imprime, e é aqui que isso aparece.
 *
 * Nenhuma rede: o `supabase` do app é o banco falso da fixture, e a nuvem é o
 * transporte dela.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../lib/supabase', () => {
  const contrato = jest.requireActual(
    '../../../../packages/shared/src/period/__tests__/contrato-da-edicao',
  ) as typeof import('../../../../packages/shared/src/period/__tests__/contrato-da-edicao');
  // Só leitura: o acervo não muda entre os testes, e a impressão grava num banco próprio.
  return { supabase: contrato.bancoFalso().db };
});

jest.mock('../auth.store', () => {
  const contrato = jest.requireActual(
    '../../../../packages/shared/src/period/__tests__/contrato-da-edicao',
  ) as typeof import('../../../../packages/shared/src/period/__tests__/contrato-da-edicao');
  return { useAuthStore: { getState: () => ({ user: { id: contrato.USUARIO } }) } };
});

// O ponto de injeção do app nunca é chamado: o motor vem das deps de cada teste.
jest.mock('../../lib/motores', () => ({
  motorPara: () => undefined,
  catalogoDoRecurso: async () =>
    (jest.requireActual('../../lib/motores/catalogo') as { idsConhecidos: readonly string[] }).idsConhecidos,
}));

import {
  EdicaoMudouNaImpressao,
  SEM_DADOS_DA_RETRO,
  montarEntradaDaEdicao,
  portasDaEdicao,
  type EntradaPacote,
} from '@vitale/shared';
import {
  AGORA,
  GABARITO,
  JANELA,
  JANELA_LARGA,
  OFFSET,
  TIPO,
  USUARIO,
  VO2MAX_PAROU_EM,
  bancoFalso,
  cadernoImpressoDeMaio,
  coletorDeHashes,
  motorParaDaFixture,
  transporteDaFixture,
} from '../../../../packages/shared/src/period/__tests__/contrato-da-edicao';
import { imprimirEdicao } from '../../lib/edicao-ia';
import { idsConhecidos } from '../../lib/motores/catalogo';
import { useActivitiesStore } from '../activities.store';
import { retroSince, useRetroStore } from '../retro.store';

beforeEach(() => {
  useRetroStore.setState({ loading: false, loaded: false, loadedSince: null, falhouEm: null, dados: SEM_DADOS_DA_RETRO });
});

/**
 * A entrada da edição de maio como a tela a monta: a janela garantida, o resumo
 * da store, e as lápides pela conta do núcleo (Story 2.7) — as três coisas que
 * `useEntradaDaEdicao` junta.
 */
async function entradaDoCelular(janelasAbertas: readonly string[]): Promise<EntradaPacote> {
  await useActivitiesStore.getState().load();
  for (const since of janelasAbertas) await useRetroStore.getState().ensure(since);
  const retro = useRetroStore.getState();
  // **A mesma função que o hook chama** (`montarEntradaDaEdicao`), e não um
  // literal recomposto aqui: é o que faz "esqueci as lápides no hook" ficar
  // vermelho, já que o hook em si não é executado por teste nenhum.
  return montarEntradaDaEdicao(retro.summary(AGORA, TIPO, OFFSET), AGORA, retro.lapides(AGORA));
}

/** Imprime como a rota da revista imprime, com as portas e o motor da fixture. */
async function imprimirNoCelular(entrada: EntradaPacote, banco = bancoFalso(), transporte = transporteDaFixture()) {
  const hashes = coletorDeHashes();
  const resultado = await imprimirEdicao(USUARIO, entrada, { aoComecar: hashes.aoComecar }, {
    portas: portasDaEdicao(banco.db, USUARIO),
    motorPara: motorParaDaFixture(transporte),
    registrar: hashes.registrar,
    agora: () => AGORA,
    // Sem preferência: a cadeia padrão do descritor — a mesma do script.
    lerPreferencia: async () => null,
    catalogo: async () => idsConhecidos,
  });
  return { resultado, hashes: hashes.hashes, banco };
}

describe('o celular imprime a fixture do contrato', () => {
  it('a janela que a tela pede para maio é a da fixture', () => {
    expect(retroSince(AGORA, TIPO, OFFSET)).toBe(JANELA);
  });

  /**
   * A lápide existe no aparelho (Story 2.7): a mesma conta do núcleo, sobre os
   * fatos do silêncio que vieram com a janela. Antes desta story `entrada.lapides`
   * chegava vazia da tela, e a edição do iPhone saía sem lápide.
   */
  it('a entrada do celular leva a lápide da fixture, pela conta do núcleo', async () => {
    const entrada = await entradaDoCelular([JANELA]);
    expect(entrada.lapides).toEqual([{ metrica: 'vo2max', ultimaMedidaISO: VO2MAX_PAROU_EM }]);
  });

  it('bate o GABARITO: hash por caderno, ordem e as linhas com a assinatura inteira', async () => {
    const { resultado, hashes, banco } = await imprimirNoCelular(await entradaDoCelular([JANELA]));
    expect(resultado.estado).toBe(GABARITO.estado);
    expect(hashes).toEqual(GABARITO.hashes);
    expect(banco.rpcs).toHaveLength(1);
    expect(banco.rpcs[0].args).toEqual(GABARITO.carga);
  });

  /**
   * O caso que a 2.2 conserta: a Retrospectiva aberta no Ano antes do Mês deixa na
   * memória a janela do ano, e a store não rebusca a do mês. Antes, o mês lia as
   * noites do ano inteiro; agora a entrada é cortada na janela do mês.
   */
  it('com a janela do Ano já carregada, o mesmo GABARITO — e o mesmo resumo da janela exata', async () => {
    const exata = await entradaDoCelular([JANELA]);

    useRetroStore.setState({ loading: false, loaded: false, loadedSince: null, falhouEm: null, dados: SEM_DADOS_DA_RETRO });
    expect(retroSince(AGORA, 'year', 0)).toBe(JANELA_LARGA);
    const larga = await entradaDoCelular([JANELA_LARGA, JANELA]);
    // A janela na memória é mesmo a larga: a segunda `ensure` não rebuscou.
    expect(useRetroStore.getState().loadedSince).toBe(JANELA_LARGA);
    expect(useRetroStore.getState().dados.sleepPeriods.some((p) => p.wakeDay < JANELA)).toBe(true);
    expect(larga.resumo).toEqual(exata.resumo);

    const { hashes, banco } = await imprimirNoCelular(larga);
    expect(hashes).toEqual(GABARITO.hashes);
    expect(banco.rpcs[0].args).toEqual(GABARITO.carga);
  });

  it('outro hospedeiro grava no meio: a impressão rejeita com EdicaoMudouNaImpressao, sem chegar ao rpc', async () => {
    const banco = bancoFalso();
    let pedidos = 0;
    const transporte = transporteDaFixture({
      aoPedir: () => {
        pedidos += 1;
        if (pedidos === 2) banco.tabelas.edicoes_ia.push(cadernoImpressoDeMaio('coracao', 1));
      },
    });
    const entrada = await entradaDoCelular([JANELA]);
    await expect(imprimirNoCelular(entrada, banco, transporte)).rejects.toBeInstanceOf(EdicaoMudouNaImpressao);
    expect(banco.rpcs).toHaveLength(0);
  });
});
