/**
 * A busca textual, contra os casos que o acervo real produziu.
 *
 * Cada bloco aqui existe porque a produção derrubou uma suposição:
 *   - `Brussels` → `Bruxelles` é o pedido original, e só funciona por apelido;
 *   - `Tour du Hageland` casando "louvain" é a prova de que a proveniência
 *     precisa existir: sem ela, o resultado é indistinguível de um bug;
 *   - as 21 rotas com "Tervuren" no nome também passam por Tervuren, e foi
 *     essa sobreposição total que definiu a precedência da linha 2;
 *   - "Yoga" ter 31 nomes editados à mão foi o que matou o `name_edited` como
 *     sinal de ranqueamento.
 */
import assert from 'node:assert/strict';
import type { Activity } from '../models';
import { buildSearchIndex, searchActivities } from './buscar';
import { faixaDe } from './campos';
import { consultaAtiva, tokenizar } from './normalize';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

type Cidade = { name: string; lat: number; lng: number; aliases?: string[] };

let seq = 0;
function ativ(p: {
  dia: string;
  nome?: string;
  rota?: string;
  cidades?: Cidade[];
  aparelho?: string;
  fonte?: string;
}): Activity {
  seq += 1;
  return {
    id: `a${seq}`,
    userId: 'u',
    activityId: 13,
    activityName: p.nome,
    routeName: p.rota,
    cities: p.cidades as Activity['cities'],
    device: p.aparelho,
    sourceName: p.fonte,
    calories: 0,
    startAt: `${p.dia}T09:00:00Z`,
    endAt: `${p.dia}T10:00:00Z`,
    durationS: 3600,
    hasRoute: true,
  };
}

const BXL: Cidade = {
  name: 'Bruxelles',
  lat: 50.84,
  lng: 4.35,
  // A resposta real do Nominatim, conferida em 07/09/2026.
  aliases: ['Brussel', 'Brüssel', 'Brussels', 'Bruxelas', 'BXL'],
};
const LEUVEN: Cidade = { name: 'Leuven', lat: 50.88, lng: 4.7, aliases: ['Louvain', 'Lovaina'] };
const TERVUREN: Cidade = { name: 'Tervuren', lat: 50.82, lng: 4.51 };
const SCHAERBEEK: Cidade = { name: 'Schaerbeek', lat: 50.86, lng: 4.37, aliases: ['Schaarbeek'] };

/* ─────────────── normalização e casamento ─────────────── */

check('prefixo de palavra: `pierre` acha Woluwe-Saint-Pierre, `elles` não acha Ixelles', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-01-01', cidades: [{ name: 'Woluwe-Saint-Pierre', lat: 0, lng: 0 }] }),
    ativ({ dia: '2026-01-02', cidades: [{ name: 'Ixelles', lat: 0, lng: 0 }] }),
  ]);
  assert.equal(searchActivities('pierre', idx).length, 1);
  assert.equal(searchActivities('elles', idx).length, 0, 'trecho solto viraria rede de arrasto');
  assert.equal(searchActivities('ixe', idx).length, 1, 'prefixo de verdade continua achando');
});

check('acento e caixa não importam nos dois lados', () => {
  const idx = buildSearchIndex([ativ({ dia: '2026-01-01', cidades: [BXL] })]);
  assert.equal(searchActivities('BRUSSEL', idx).length, 1);
  assert.equal(searchActivities('brüssel', idx).length, 1);
  assert.deepEqual(tokenizar('Forêt de Soignes'), ['foret', 'de', 'soignes']);
});

check('consulta de uma letra não busca — a tela mostra a lista, não o vazio', () => {
  assert.equal(consultaAtiva('b'), false);
  assert.equal(consultaAtiva(' '), false);
  assert.equal(consultaAtiva('br'), true);
  assert.equal(searchActivities('b', buildSearchIndex([ativ({ dia: '2026-01-01' })])).length, 0);
});

/* ─────────────── apelidos (CAP-3) ─────────────── */

check('os três casos do brief: Brussels, Brussel e Bruxelas acham Bruxelles', () => {
  const idx = buildSearchIndex([ativ({ dia: '2026-08-23', rota: 'Boucle', cidades: [BXL] })]);
  for (const grafia of ['Brussels', 'Brussel', 'Bruxelas', 'BXL']) {
    assert.equal(searchActivities(grafia, idx).length, 1, `${grafia} deveria achar Bruxelles`);
  }
});

check('o apelido mostra o nome CANÔNICO — quem digita `louvain` vê `Leuven`', () => {
  const idx = buildSearchIndex([ativ({ dia: '2026-08-24', rota: 'Tour du Hageland', cidades: [LEUVEN] })]);
  const [hit] = searchActivities('louvain', idx);
  assert.equal(hit.match.text, 'Leuven');
  assert.equal(hit.match.label, 'cidade');
});

check('Schaarbeek acha Schaerbeek — as duas grafias que convivem no mesmo registro', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-08-23', nome: 'Schaarbeek Cycling', cidades: [SCHAERBEEK, BXL] }),
  ]);
  assert.equal(searchActivities('schaerbeek', idx).length, 1);
  assert.equal(searchActivities('schaarbeek', idx).length, 1);
});

/* ─────────────── proveniência (CAP-5, CAP-9) ─────────────── */

check('Tour du Hageland: casou só na cidade, então a tela precisa explicar', () => {
  const idx = buildSearchIndex([ativ({ dia: '2025-08-24', rota: 'Tour du Hageland', cidades: [LEUVEN] })]);
  const [hit] = searchActivities('louvain', idx);
  assert.equal(hit.match.field, 'cidade-apelido');
  assert.notEqual(hit.match.label, undefined, 'campo invisível TEM rótulo — a tela explica');
});

check('De Bruxelles à Louvain: casou no nome da rota, que está à vista — grifa, não explica', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-04-25', rota: 'De Bruxelles à Louvain', cidades: [BXL, LEUVEN] }),
  ]);
  const [hit] = searchActivities('louvain', idx);
  assert.equal(hit.match.field, 'rota');
  assert.equal(hit.match.label, undefined, 'campo à vista NÃO tem rótulo — a tela grifa');
  assert.equal(hit.match.text, 'De Bruxelles à Louvain');
});

check('a sobreposição total do Tervuren: o nome à vista vence a cidade, que pesa mais', () => {
  // As 21 rotas com Tervuren no nome TAMBÉM passam por Tervuren. Se o peso
  // decidisse sozinho, a cidade (100) venceria a rota (85) e nenhuma delas
  // mostraria o próprio nome.
  const idx = buildSearchIndex([
    ativ({ dia: '2025-10-12', rota: 'Boucle de Tervuren par la Forêt de Soignes', cidades: [TERVUREN] }),
  ]);
  const [hit] = searchActivities('tervuren', idx);
  assert.equal(hit.match.field, 'rota', 'à vista vence peso');
  assert.equal(hit.score, 100, 'mas o RANQUEAMENTO continua usando o peso maior');
  assert.deepEqual([...hit.alsoMatched], ['cidade']);
});

check('sem busca ativa não há proveniência para inventar', () => {
  assert.deepEqual(searchActivities('', buildSearchIndex([ativ({ dia: '2026-01-01' })])), []);
});

/* ─────────────── ranqueamento por raridade (CAP-6) ─────────────── */

check('as faixas medidas', () => {
  assert.equal(faixaDe(1), 'rara');
  assert.equal(faixaDe(3), 'rara');
  assert.equal(faixaDe(4), 'comum');
  assert.equal(faixaDe(20), 'comum');
  assert.equal(faixaDe(21), 'rotulo');
  assert.equal(faixaDe(185), 'rotulo');
});

check('`Cycling` em 175 atividades não empurra a cidade para baixo', () => {
  const genericas = Array.from({ length: 25 }, (_, i) =>
    ativ({ dia: `2026-02-${String(i + 1).padStart(2, '0')}`, nome: 'Cycling' }),
  );
  const comCidade = ativ({ dia: '2020-01-01', nome: 'Outro', cidades: [{ name: 'Cyclinga', lat: 0, lng: 0 }] });
  const hits = searchActivities('cycling', buildSearchIndex([...genericas, comCidade]));
  assert.equal(hits[0].activity.id, comCidade.id, 'a cidade vem primeiro apesar de ser a mais antiga');
  assert.equal(hits[0].score, 100);
  assert.equal(hits[1].score, 20, 'rótulo de fábrica fica na base');
});

check('nome raro vence nome repetido — sem consultar name_edited', () => {
  const acervo = [
    ativ({ dia: '2026-07-21', nome: 'Tour de la Meuse-Rhin' }),
    ...Array.from({ length: 30 }, (_, i) =>
      ativ({ dia: `2026-03-${String(i + 1).padStart(2, '0')}`, nome: 'Meuse Treino' }),
    ),
  ];
  const hits = searchActivities('meuse', buildSearchIndex(acervo));
  assert.equal(hits[0].activity.activityName, 'Tour de la Meuse-Rhin');
  assert.equal(hits[0].score, 80);
  assert.equal(hits[1].score, 20);
});

check('os 22 "Boucle de Bruxelles" nascem rebaixados, sem ninguém configurar nada', () => {
  const parede = Array.from({ length: 22 }, (_, i) =>
    ativ({ dia: `2026-01-${String(i + 1).padStart(2, '0')}`, rota: 'Boucle de Bruxelles' }),
  );
  const passaPor = ativ({ dia: '2020-01-01', rota: 'Outra rota', cidades: [BXL] });
  const hits = searchActivities('bruxelles', buildSearchIndex([...parede, passaPor]));
  assert.equal(hits[0].activity.id, passaPor.id, 'quem PASSA por Bruxelles vem antes de 22 nomes iguais');
  assert.equal(hits[hits.length - 1].score, 22, 'nome de rota repetido 22x é rótulo');
});

/* ─────────────── multi-campo (CAP-2) ─────────────── */

check('o E da consulta vale sobre a união dos campos', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-08-26', nome: 'Brussels Running', aparelho: 'Garmin Venu 4' }),
  ]);
  assert.equal(searchActivities('brussels garmin', idx).length, 1, 'um token em cada campo');
  assert.equal(searchActivities('brussels lisboa', idx).length, 0, 'um token sem casa derruba tudo');
});

check('`tour meuse` acha Meuse-Rhin e não Wallonie Picarde', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-07-21', nome: 'Tour de la Meuse-Rhin' }),
    ativ({ dia: '2026-07-22', nome: 'Tour de la Wallonie Picarde' }),
  ]);
  const hits = searchActivities('tour meuse', idx);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].activity.activityName, 'Tour de la Meuse-Rhin');
});

check('a corrida sem cidade é resgatada pelo rótulo de fábrica', () => {
  // O achado do brief: as corridas não têm `cities`, mas carregam a cidade no
  // nome que a Strava deu. Excluir nome genérico as perderia todas.
  const idx = buildSearchIndex([ativ({ dia: '2026-08-26', nome: 'Brussels Running' })]);
  const [hit] = searchActivities('brussels', idx);
  assert.equal(hit.match.field, 'nome');
  assert.equal(hit.match.label, 'nome');
});

check('aparelho e fonte também casam', () => {
  const idx = buildSearchIndex([
    ativ({ dia: '2026-08-26', nome: 'Cycling', aparelho: 'Garmin Venu 4', fonte: 'Strava' }),
  ]);
  assert.equal(searchActivities('garmin', idx)[0].match.label, 'aparelho');
  assert.equal(searchActivities('strava', idx)[0].match.label, 'fonte');
});

/* ─────────────── índice ─────────────── */

check('a cidade repetida na rota vira UMA entrada, não vinte', () => {
  const iaIda = ativ({ dia: '2026-08-23', cidades: [BXL, SCHAERBEEK, { ...BXL }] });
  const [{ entries }] = buildSearchIndex([iaIda]);
  const cidades = entries.filter((e) => e.field === 'cidade');
  assert.equal(cidades.length, 2, 'Bruxelles duas vezes no percurso, uma vez no índice');
});

check('atividade sem nada buscável não quebra nem casa', () => {
  const idx = buildSearchIndex([ativ({ dia: '2026-01-01' })]);
  assert.equal(idx[0].entries.length, 0);
  assert.equal(searchActivities('qualquer', idx).length, 0);
});

check('funciona antes da story 1, com marcas de cidade ainda sem aliases', () => {
  const idx = buildSearchIndex([ativ({ dia: '2026-01-01', cidades: [TERVUREN] })]);
  assert.equal(searchActivities('tervuren', idx).length, 1);
  assert.equal(searchActivities('brussels', idx).length, 0);
});

console.log(`\n${passed} checagens de busca ok`);
