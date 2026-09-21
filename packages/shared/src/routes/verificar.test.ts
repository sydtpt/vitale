/**
 * A conferência da saída do modelo (ADR 0041, invariante 2).
 *
 * O que estes testes protegem:
 *  1. Cidade que não foi enviada é reprovada — é a tradução direta de "todo
 *     número citado existe no pacote" do `ia/verificar.ts`.
 *  2. Uma "região" que é uma das cidades é reprovada. Era exatamente esse
 *     disfarce — o nome da cidade de casa virando nome do passeio — que originou
 *     a feature.
 *  3. Rota degenerada com preenchimento é reprovada: significa que o portão
 *     falhou e alguém gastou uma chamada.
 *  4. Acento e caixa não decidem nada.
 *  5. O artigo é da língua do nome — `de` passa em neerlandês e reprova em
 *     francês, onde é preposição.
 *  6. As 20 do golden passam — a conferência não pode reprovar o que foi aprovado.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import { montarNome } from './molde';
import { lerRota } from './shape';
import { verificarNome } from './verificar';
import type { Lingua, NomePreenchido, RouteFacts, RouteReading } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);
const golden: { dia: string; km: number; preenchido: NomePreenchido; esperado: string | null }[] =
  JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'golden.json'), 'utf8'));

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const cidade = (name: string) => ({ name, country: 'België / Belgique / Belgien', lat: 0, lng: 0 });
const rota = { cities: [cidade('Ninove'), cidade('Pamel'), cidade('Strijtem')] };
const viva = { forma: 'casa-b' as const, lingua: 'fr' as const };

check('preenchimento consistente passa', () => {
  const v = verificarNome(rota, viva, {
    regiao: 'Pajottenland',
    artigo: 'le',
    justificativa: ['Pamel', 'Strijtem'],
  });
  assert.equal(v.ok, true, JSON.stringify(v.problemas));
});

check('cidade que não foi enviada reprova', () => {
  const v = verificarNome(rota, viva, {
    regiao: 'Pajottenland',
    justificativa: ['Pamel', 'Gooik'],
  });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'justificativa');
  assert.match(v.problemas[0].detalhe, /Gooik/);
});

check('justificativa vazia reprova', () => {
  const v = verificarNome(rota, viva, { regiao: 'Pajottenland', justificativa: [] });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'justificativa');
});

check('região que é uma das cidades reprova — é trajeto disfarçado', () => {
  const v = verificarNome(rota, viva, { regiao: 'Ninove', justificativa: ['Ninove'] });
  assert.equal(v.ok, false);
  assert.ok(v.problemas.some((p) => p.regra === 'regiao-e-cidade'));
});

check('rota degenerada com preenchimento reprova', () => {
  const v = verificarNome(rota, { forma: 'degenerada', lingua: 'fr' }, {
    regiao: 'Pajottenland',
    justificativa: ['Pamel'],
  });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'degenerada');
});

check('acento e caixa não decidem nada', () => {
  const comAcento = { cities: [cidade('São Paulo'), cidade('Anhée')] };
  const v = verificarNome(comAcento, viva, { justificativa: ['sao paulo', 'ANHEE'] });
  assert.equal(v.ok, true, JSON.stringify(v.problemas));
});

check('num A→B, partida igual à chegada reprova', () => {
  const v = verificarNome(rota, { forma: 'a-b', lingua: 'fr' }, {
    origem: 'Ninove',
    destino: 'Ninove',
    justificativa: ['Ninove'],
  });
  assert.equal(v.ok, false);
  assert.ok(v.problemas.some((p) => p.regra === 'repeticao'));
});

check('num LOOP, partida igual à chegada é o esperado — não reprova', () => {
  // A primeira versão desta regra não distinguia a forma e reprovou, no primeiro
  // smoke test contra o modelo real, o Hageland e a volta em São Paulo — os dois
  // loops, os dois com o modelo respondendo certo.
  for (const forma of ['casa-loop-casa', 'a-loop-a'] as const) {
    const v = verificarNome(rota, { forma, lingua: 'fr' }, {
      origem: 'Ninove',
      destino: 'Ninove',
      justificativa: ['Ninove'],
    });
    assert.equal(v.ok, true, `${forma}: ${JSON.stringify(v.problemas)}`);
  }
});

/* ───────────────────── o artigo tem de ser da língua do nome ───────────────────── */

/** Só os problemas da regra nova — o resto da conferência fica de fora. */
const doArtigo = (v: { problemas: { regra: string; detalhe: string }[] }) =>
  v.problemas.filter((p) => p.regra === 'artigo');
/** Tudo menos a regra nova: é com isto que se prova que ninguém mais morde o caso. */
const semArtigo = (v: { problemas: { regra: string; detalhe: string }[] }) =>
  v.problemas.filter((p) => p.regra !== 'artigo');

/*
 * `Partial<NomePreenchido>`, e não `Record<string, unknown>` com cast: com o cast
 * um campo mal escrito (`viaArtgio`) compilava, e o teste ficava verde testando
 * exatamente nada.
 *
 * A região vem preenchida por padrão de propósito — é ela que faz o `artigo` ser
 * lido. A regra é amarrada ao uso do campo, então um arnês sem região não
 * exercitaria a regra nenhuma vez.
 */
const comArtigo = (lingua: Lingua, pecas: Partial<NomePreenchido>) =>
  verificarNome(
    rota,
    { forma: 'casa-b', lingua },
    { regiao: 'Pajottenland', justificativa: ['Pamel'], ...pecas },
  );

check('artigo certo na língua do nome passa', () => {
  assert.equal(comArtigo('fr', { artigo: 'la' }).ok, true);
  assert.equal(comArtigo('fr', { artigo: 'le' }).ok, true);
  assert.equal(comArtigo('fr', { artigo: 'les' }).ok, true);
  assert.equal(comArtigo('nl', { artigo: 'het' }).ok, true);
  assert.equal(comArtigo('pt', { artigo: 'o' }).ok, true);
  assert.equal(comArtigo('pt', { artigo: 'as' }).ok, true);
});

check('`de` é artigo em neerlandês e preposição em francês — a tabela é por língua', () => {
  // O caso que prova que não dá para ter uma lista global de artigos.
  assert.equal(comArtigo('nl', { artigo: 'de' }).ok, true, 'de é artigo definido em nl');

  const fr = comArtigo('fr', { artigo: 'de' });
  assert.equal(fr.ok, false, 'em francês `de` é preposição, não artigo');
  assert.equal(doArtigo(fr).length, 1);
  assert.match(doArtigo(fr)[0].detalhe, /franc/);
});

check('artigo de outra língua reprova, e o detalhe nomeia a língua', () => {
  // O defeito medido: 127 de 135 respostas do modelo aberto trouxeram artigo
  // português numa rota francesa.
  const v = comArtigo('fr', { artigo: 'a' });
  assert.equal(v.ok, false);
  assert.equal(doArtigo(v).length, 1);
  assert.equal(doArtigo(v)[0].regra, 'artigo');
  assert.match(doArtigo(v)[0].detalhe, /"a"/);
  assert.match(doArtigo(v)[0].detalhe, /francês/);

  assert.equal(comArtigo('nl', { artigo: 'le' }).ok, false);
  assert.equal(comArtigo('pt', { artigo: 'het' }).ok, false);
});

check('artigo nulo passa — é o caso de 120 das 135', () => {
  assert.equal(comArtigo('fr', { artigo: null }).ok, true);
  assert.equal(comArtigo('nl', { artigo: null }).ok, true);
  assert.equal(comArtigo('pt', { artigo: null }).ok, true);
  // Ausente e em branco são o mesmo caso: o molde trata os dois como "sem artigo".
  assert.equal(comArtigo('fr', {}).ok, true);
  assert.equal(comArtigo('fr', { artigo: '  ' }).ok, true);
});

check('a elisão é forma legítima do artigo', () => {
  assert.equal(comArtigo('fr', { artigo: "l'" }).ok, true);
  assert.equal(comArtigo('nl', { artigo: "'t" }).ok, true);
});

check('caixa e acento não decidem o artigo — a comparação normaliza como `chave()`', () => {
  /*
   * Esta é metade da linha "caixa e acento" da matriz: a conferência tolera.
   * A outra metade é o molde, que compara com `===` cru e perderia o artigo — e
   * por isso a normalização de verdade mora no `lerRespostaDoModelo`. A costura
   * ponta a ponta ("Le" → `Tour du Pajottenland`) está no `prompt.test.ts`; sem
   * ela, este teste carimbaria como bom um caso que sai errado na frase.
   */
  assert.equal(comArtigo('fr', { artigo: 'LA ' }).ok, true);
  assert.equal(comArtigo('fr', { artigo: ' Le' }).ok, true);
  assert.equal(comArtigo('nl', { artigo: 'HET' }).ok, true);
});

check('o artigo da via cai na mesma regra, no mesmo campo de problema', () => {
  const v = comArtigo('fr', { via: 'Rupel', viaArtigo: 'via' });
  assert.equal(v.ok, false);
  assert.equal(doArtigo(v).length, 1);
  assert.equal(doArtigo(v)[0].regra, 'artigo');
  assert.match(doArtigo(v)[0].detalhe, /viaArtigo/);

  assert.equal(comArtigo('fr', { via: 'Rupel', viaArtigo: 'le' }).ok, true);
  assert.equal(comArtigo('nl', { via: 'Groene Hart', viaArtigo: 'het' }).ok, true);
  assert.equal(comArtigo('fr', { via: 'Rupel', viaArtigo: null }).ok, true);
});

check('os dois campos errados dão dois problemas, não um', () => {
  const v = comArtigo('fr', { artigo: 'o', via: 'Rupel', viaArtigo: 'a' });
  assert.equal(doArtigo(v).length, 2);
});

/*
 * A regra é amarrada ao uso do campo, e estes dois testes são a guarda disso.
 *
 * Sem eles, a versão anterior desta story reprovava `{ artigo: 'a' }` numa `a-b`
 * sem região — resposta cujo nome o molde escreve perfeitamente, porque
 * `semRegiao` nunca lê `artigo`. Pelos números de 21/09 seriam ~98 das 135, e
 * cada uma viraria recusa **permanente gravada** (`recusaEResultado: true`).
 */
const rotaAB = { cities: [cidade('Tournai'), cidade('Antoing')] };
const leituraAB: RouteReading = {
  forma: 'a-b',
  origem: 'Tournai',
  destino: 'Antoing',
  lingua: 'fr',
  distanciaCasaInicioM: 90_000,
  distanciaCasaFimM: 95_000,
};
const trajeto: NomePreenchido = {
  origem: 'Tournai',
  destino: 'Antoing',
  justificativa: ['Tournai', 'Antoing'],
};
const KM40 = 40_000;

check('artigo solto, sem região, não reprova — `semRegiao` nunca o lê', () => {
  // Artigo português numa rota francesa: errado, e irrelevante sem região.
  const solto: NomePreenchido = { ...trajeto, artigo: 'a' };
  assert.equal(
    verificarNome(rotaAB, leituraAB, solto).ok,
    true,
    'artigo sem região não pode custar o nome da pedalada',
  );

  // O caso-espelho: o molde escreve a MESMA frase com e sem o campo solto.
  assert.equal(montarNome(leituraAB, trajeto, KM40), 'De Tournai à Antoing');
  assert.equal(montarNome(leituraAB, solto, KM40), montarNome(leituraAB, trajeto, KM40));

  // E com região o mesmo artigo reprova, porque aí ele chega à frase — e some
  // dela: `frDe` não conhece `a`, então o artigo sumiria calado.
  const comRegiaoDentro: NomePreenchido = { ...trajeto, regiao: 'Pajottenland', artigo: 'a' };
  assert.equal(verificarNome(rotaAB, leituraAB, comRegiaoDentro).ok, false);
  assert.equal(montarNome(leituraAB, comRegiaoDentro, KM40), 'Tour de Pajottenland');
});

check('viaArtigo solto, sem via, não reprova — `sufixoVia` nem é chamado', () => {
  const solto: NomePreenchido = { ...trajeto, viaArtigo: 'via' };
  assert.equal(verificarNome(rotaAB, leituraAB, solto).ok, true);
  assert.equal(montarNome(leituraAB, solto, KM40), montarNome(leituraAB, trajeto, KM40));

  const comVia: NomePreenchido = { ...trajeto, via: 'Escaut', viaArtigo: 'via' };
  assert.equal(verificarNome(rotaAB, leituraAB, comVia).ok, false);
  assert.ok(verificarNome(rotaAB, leituraAB, comVia).problemas.some((p) => p.regra === 'artigo'));
});

check('caso-espelho: com a regra desligada, os artigos errados passam', () => {
  /*
   * A prova de não-vacuidade. Se qualquer outra regra já reprovasse estes casos,
   * a regra do artigo não estaria mordendo nada — e um teste verde não diria
   * nada. Tirando os problemas da regra nova, a conferência tem de ficar muda.
   */
  const casos: Record<string, unknown>[] = [
    { artigo: 'a' },
    { artigo: 'de' },
    { artigo: 'o' },
    { via: 'Rupel', viaArtigo: 'via' },
    { artigo: 'o', via: 'Rupel', viaArtigo: 'a' },
  ];
  for (const c of casos) {
    const v = comArtigo('fr', c);
    assert.equal(v.ok, false, `${JSON.stringify(c)} deveria reprovar`);
    assert.ok(doArtigo(v).length > 0, `${JSON.stringify(c)}: a regra do artigo tem de morder`);
    assert.deepEqual(
      semArtigo(v),
      [],
      `${JSON.stringify(c)}: sem a regra do artigo, nada mais reprova — ${JSON.stringify(semArtigo(v))}`,
    );
  }
});

check('as 20 do golden passam na conferência', () => {
  const ancoras = derivarAncoras(
    rides.flatMap((r) => [
      { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
      { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
    ]),
  );
  for (const g of golden) {
    const r = rides.find(
      (x) => x.startAt.slice(0, 10) === g.dia && Math.round(x.distanceM / 1000) === g.km,
    )!;
    const leitura = lerRota(r, ancoras);
    const v = verificarNome(r, leitura, g.preenchido);
    // As degeneradas são reprovadas de propósito: elas nunca deveriam ter sido enviadas.
    const esperaOk = leitura.forma !== 'degenerada';
    assert.equal(v.ok, esperaOk, `${g.dia}/${g.km}km: ${JSON.stringify(v.problemas)}`);
  }
});

console.log(`\n${passed} checagens de conferência ok`);
