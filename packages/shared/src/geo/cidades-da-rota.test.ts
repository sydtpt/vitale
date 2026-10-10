/**
 * A regra das cidades da rota, sem rede.
 *
 * Estes casos guardam o que a edge function fazia e que agora roda no aparelho:
 * a amostragem que cabe no teto, o nome certo nas regiões bilíngues, os
 * apelidos que o Nominatim já manda de graça, e o colapso que transforma 40
 * amostras numa lista de cidades.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AMOSTRAS,
  amostrarPorDistancia,
  cidadeDaResposta,
  colapsarConsecutivas,
  colherApelidosDoNome,
  linguaPreferida,
  type PontoGeo,
} from './cidades-da-rota';

/** Uma reta de `n` pontos a ~111 m de passo (0,001° de latitude). */
function reta(n: number): PontoGeo[] {
  return Array.from({ length: n }, (_, i) => ({ lat: 50.6 + i * 0.001, lng: 4.3 }));
}

describe('amostrarPorDistancia', () => {
  it('rota longa cabe no teto, e o fim entra sempre', () => {
    // ~900 pontos × 111 m ≈ 100 km: sem o teto sairiam ~66 amostras a 1,5 km.
    const pontos = reta(900);
    const amostras = amostrarPorDistancia(pontos);

    assert.ok(
      amostras.length <= MAX_AMOSTRAS + 2,
      `amostras demais: ${amostras.length} — o espaçamento tem de crescer na rota longa`,
    );
    assert.deepEqual(amostras[0], pontos[0], 'o início sempre entra');
    assert.deepEqual(
      amostras[amostras.length - 1],
      pontos[pontos.length - 1],
      'o fim sempre entra — é a cidade onde parou',
    );
  });

  it('rota curta usa o espaçamento mínimo, não o teto', () => {
    // 100 pontos ≈ 11 km → ~7 amostras a 1,5 km, bem abaixo do teto.
    const amostras = amostrarPorDistancia(reta(100));
    assert.ok(amostras.length >= 2 && amostras.length <= 12, `veio ${amostras.length}`);
  });

  it('rota vazia não quebra', () => {
    assert.deepEqual(amostrarPorDistancia([]), []);
  });
});

describe('cidadeDaResposta', () => {
  const BRUXELAS = {
    lat: '50.8465',
    lon: '4.3517',
    address: {
      city: 'Bruxelles - Brussel',
      state: 'Bruxelles-Capitale',
      country: 'België / Belgique / Belgien',
      country_code: 'be',
      'ISO3166-2-lvl4': 'BE-BRU',
    },
    namedetails: {
      name: 'Bruxelles - Brussel',
      'name:fr': 'Bruxelles',
      'name:nl': 'Brussel',
      'name:de': 'Brüssel',
      'name:en': 'Brussels',
      'name:pt': 'Bruxelas',
      short_name: 'BXL',
    },
  };

  it('o nome bilíngue vira o da língua da região, e o país sobe em maiúscula', () => {
    const c = cidadeDaResposta(BRUXELAS, 50.0, 4.0);
    assert.equal(c?.name, 'Bruxelles', 'BE-BRU é francófona');
    assert.equal(c?.countryCode, 'BE');
  });

  it('os apelidos vêm da mesma resposta e nunca repetem o canônico', () => {
    const c = cidadeDaResposta(BRUXELAS, 50.0, 4.0);
    assert.ok(c);
    assert.ok(!c.aliases?.includes('Bruxelles'), 'o canônico não é apelido de si mesmo');
    for (const esperado of ['Brussel', 'Brussels', 'Bruxelas', 'BXL']) {
      assert.ok(c.aliases?.includes(esperado), `faltou ${esperado}`);
    }
  });

  /**
   * **`Brüssel` não entra, e isto é o comportamento de produção.** O
   * `chaveDedupe` normaliza acento, então `name:de` = "Brüssel" colide com
   * `name:nl` = "Brussel", que vem antes na lista — e a busca acha os dois pelo
   * mesmo motivo, porque ela também normaliza. O comentário herdado da edge
   * function listava Brüssel entre os sobreviventes; ele está errado desde
   * sempre, e este caso é o que impede alguém de "consertar" o dedupe lendo
   * aquele texto.
   */
  it('a grafia que só difere por acento NÃO vira apelido', () => {
    const c = cidadeDaResposta(BRUXELAS, 50.0, 4.0);
    assert.ok(!c?.aliases?.includes('Brüssel'));
  });

  it('a âncora é o centro da cidade, não a amostra da rota', () => {
    const c = cidadeDaResposta(BRUXELAS, 50.0, 4.0);
    assert.equal(c?.lat, 50.8465);
    assert.equal(c?.lng, 4.3517);
  });

  it('sem centro na resposta, cai de volta na amostra', () => {
    const semCentro = { ...BRUXELAS, lat: undefined, lon: undefined };
    const c = cidadeDaResposta(semCentro, 50.0, 4.0);
    assert.equal(c?.lat, 50.0);
    assert.equal(c?.lng, 4.0);
  });

  it('ponto no mar: resposta OK e nenhuma cidade', () => {
    assert.equal(cidadeDaResposta({}, 0, 0), null);
    assert.equal(cidadeDaResposta({ address: { country: 'x' } }, 0, 0), null);
  });

  it('`aliases` é sempre presente, mesmo vazio', () => {
    const semApelido = {
      address: { city: 'Etterbeek', country_code: 'be' },
      namedetails: { name: 'Etterbeek' },
    };
    const c = cidadeDaResposta(semApelido, 50.8, 4.4);
    assert.deepEqual(
      c?.aliases,
      [],
      'ausente faria "não tem outra grafia" virar "marca antiga" — e Etterbeek voltaria à fila para sempre',
    );
  });
});

describe('linguaPreferida', () => {
  it('conhece as três regiões da Bélgica, e cala fora delas', () => {
    assert.equal(linguaPreferida({ 'ISO3166-2-lvl4': 'BE-VLG' }), 'nl');
    assert.equal(linguaPreferida({ 'ISO3166-2-lvl4': 'BE-BRU' }), 'fr');
    assert.equal(linguaPreferida({ 'ISO3166-2-lvl4': 'BE-WAL' }), 'fr');
    assert.equal(linguaPreferida({ 'ISO3166-2-lvl4': 'FR-IDF' }), null);
    assert.equal(linguaPreferida({}), null);
  });
});

describe('colapsarConsecutivas', () => {
  const marca = (name: string) => ({ name, lat: 0, lng: 0 });

  it('colapsa a repetição seguida e descarta os nulos', () => {
    const out = colapsarConsecutivas([
      marca('Ittre'),
      marca('Ittre'),
      null,
      marca('Ittre'),
      marca('Nivelles'),
    ]);
    assert.deepEqual(out.map((c) => c.name), ['Ittre', 'Nivelles']);
  });

  it('a re-entrada depois de outra cidade é marca nova — a lista é o percurso', () => {
    const out = colapsarConsecutivas([marca('Ittre'), marca('Nivelles'), marca('Ittre')]);
    assert.deepEqual(out.map((c) => c.name), ['Ittre', 'Nivelles', 'Ittre']);
  });
});

describe('colherApelidosDoNome', () => {
  it('o OSM separa grafias por ponto-e-vírgula no mesmo valor', () => {
    const out = colherApelidosDoNome({ alt_name: 'Anvers;Antwerpen;Antwerp' }, 'Antwerpen');
    assert.deepEqual(out, ['Anvers', 'Antwerp']);
  });

  it('deduplica ignorando acento e caixa', () => {
    const out = colherApelidosDoNome({ 'name:pt': 'SÃO PAULO', 'name:en': 'Sao Paulo' }, 'São Paulo');
    assert.deepEqual(out, []);
  });
});
