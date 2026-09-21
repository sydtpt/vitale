/**
 * O descritor do nome de rota (story 5.7).
 *
 * O que estes testes protegem:
 *  1. **O corpo que chega à `ia-narrar` não muda.** O `sistema` e o `usuario` são
 *     byte a byte os de `montarPromptDeNome`, e `json` continua `true` — os 133
 *     nomes aprovados seguem comparáveis. É o teste que morde se alguém trocar a
 *     saída para texto, ou mexer no prompt sem subir `PROMPT_NOME_VERSAO`.
 *  2. **Rota degenerada não produz pedido.** O portão continua saindo antes da
 *     chamada; quem prova que ele não gasta token é `nomear.test.ts`, pelo `ler`.
 *  3. **A interpretação aceita `null`** — que é o que o prompt manda o modelo
 *     responder —, e `conformeAoEsquema` **não** aceitaria. O par de asserções
 *     existe para que a troca por `interpretarPorEsquema` quebre aqui, e não em
 *     produção.
 *  4. A conferência reprova o que já reprovava, mais o molde que não monta.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NUVEM_PADRAO, SEM_MODELO, conformeAoEsquema } from '../ia/fio';
import { corpoDoPedido } from '../ia/nuvem';
import { validarDescritor } from '../ia/recursos';
import { derivarAncoras } from './anchor';
import { ESQUEMA_DO_NOME, REGRA_SEM_MOLDE, descritorDoNomeDeRota, leituraDoNome, type FatosDoNome } from './descritor';
import { PROMPT_NOME_VERSAO, lerRespostaDoModelo, montarPromptDeNome } from './prompt';
import type { NomePreenchido, RouteFacts } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

const ancoras = derivarAncoras(
  rides.flatMap((r) => [
    { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
    { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
  ]),
);

const acharRota = (dia: string, km: number): RouteFacts =>
  rides.find((r) => r.startAt.slice(0, 10) === dia && Math.round(r.distanceM / 1000) === km)!;

const fatosDe = (rota: RouteFacts): FatosDoNome => ({ rota, ancoras });

const PAJOTTENLAND = fatosDe(acharRota('2026-08-15', 75));
const DEGENERADA = fatosDe(acharRota('2026-08-31', 5));

const BOAS: NomePreenchido = {
  regiao: 'Pajottenland',
  artigo: 'le',
  justificativa: ['Sint-Martens-Lennik', 'Strijtem', 'Pamel'],
};

describe('o descritor', () => {
  it('é válido para o catálogo', () => {
    assert.deepEqual(validarDescritor(descritorDoNomeDeRota), []);
  });

  it('declara o que a story fixou: molde, teto na nuvem, padrão na nuvem, recusa como resultado', () => {
    assert.equal(descritorDoNomeDeRota.recurso, 'nome-de-rota');
    assert.equal(descritorDoNomeDeRota.versao, PROMPT_NOME_VERSAO);
    assert.equal(descritorDoNomeDeRota.regimeDeNumeros, 'molde');
    assert.equal(descritorDoNomeDeRota.regimeMaximo, 'nuvem');
    assert.deepEqual([...descritorDoNomeDeRota.cadeiaPadrao], [NUVEM_PADRAO, SEM_MODELO]);
    assert.deepEqual(descritorDoNomeDeRota.grava, { admite: ['nuvem', 'aparelho'], recusaEResultado: true });
  });
});

describe('o pedido', () => {
  it('o corpo da ia-narrar é o de hoje: sistema e usuario byte a byte, e json true', () => {
    const pedido = descritorDoNomeDeRota.montarPedido(PAJOTTENLAND)!;
    const deHoje = montarPromptDeNome(leituraDoNome(PAJOTTENLAND), PAJOTTENLAND.rota);
    const corpo = corpoDoPedido(pedido);

    assert.equal(corpo.sistema, deHoje.sistema);
    assert.equal(corpo.usuario, deHoje.usuario);
    assert.equal(corpo.json, true);
    // O único acréscimo é o `esquema`, que a 5.6 pôs no corpo como diagnóstico —
    // nenhum adaptador o lê. Nada mais entra: `motor` só quando o hospedeiro
    // escolhe uma variante nomeada, e `nuvem:padrao` não leva nenhum.
    assert.deepEqual(Object.keys(corpo).sort(), ['esquema', 'json', 'sistema', 'usuario']);
    assert.deepEqual(corpo.esquema, ESQUEMA_DO_NOME);
  });

  it('rota degenerada não produz pedido — nenhum token a gastar', () => {
    assert.equal(leituraDoNome(DEGENERADA).forma, 'degenerada');
    assert.equal(descritorDoNomeDeRota.montarPedido(DEGENERADA), null);
  });

  it('o mesmo par de fatos dá o mesmo pedido', () => {
    assert.deepEqual(
      descritorDoNomeDeRota.montarPedido(PAJOTTENLAND),
      descritorDoNomeDeRota.montarPedido(fatosDe(PAJOTTENLAND.rota)),
    );
  });
});

describe('a interpretação', () => {
  const de = (texto: string) => ({ texto, assinatura: { tipo: 'nuvem' as const, provedor: 'p', modelo: 'm' } });

  it('lê a resposta com os campos preenchidos', () => {
    const lido = descritorDoNomeDeRota.interpretar(de(JSON.stringify(BOAS)));
    assert.deepEqual(lido, { ...BOAS, via: undefined, viaArtigo: null, origem: undefined, destino: undefined });
  });

  it('aceita os `null` que o prompt manda o modelo responder — e conformeAoEsquema NÃO aceitaria', () => {
    // É o caso mais comum de todos: "Se as cidades não formarem uma região que
    // você reconheça de verdade, devolva `regiao`: null". Trocar a interpretação
    // por `interpretarPorEsquema` reprovaria a maioria das pedaladas.
    const texto = JSON.stringify({
      regiao: null, artigo: null, via: null, viaArtigo: null,
      origem: null, destino: 'Hal', justificativa: ['Halle'],
    });
    const lido = descritorDoNomeDeRota.interpretar(de(texto)) as NomePreenchido;
    assert.deepEqual([...lido.justificativa], ['Halle']);
    assert.equal(lido.destino, 'Hal');
    assert.equal(
      conformeAoEsquema(JSON.parse(texto), ESQUEMA_DO_NOME),
      false,
      'se um dia `Esquema` ganhar `null`, este teste cai — e aí a interpretação pode usar o helper',
    );
  });

  it('o esquema descreve a forma pedida: só a justificativa é obrigatória', () => {
    assert.equal(conformeAoEsquema({ justificativa: ['Halle'] }, ESQUEMA_DO_NOME), true);
    assert.equal(conformeAoEsquema({ regiao: 'Pajottenland', justificativa: ['Pamel'] }, ESQUEMA_DO_NOME), true);
    assert.equal(conformeAoEsquema({ regiao: 'Pajottenland' }, ESQUEMA_DO_NOME), false);
    assert.equal(conformeAoEsquema({ justificativa: [] }, ESQUEMA_DO_NOME), false);
  });

  it('o que não se lê é saida-invalida, com o começo da resposta no detalhe', () => {
    for (const texto of ['não consigo nomear este percurso', '{"regiao":"Pajotten', '{"regiao":"X"}']) {
      const f = descritorDoNomeDeRota.interpretar(de(texto)) as { classe?: string; detalhe?: string };
      assert.equal(f.classe, 'saida-invalida', texto);
      assert.match(f.detalhe ?? '', /não traz as peças do nome/, texto);
      assert.equal(lerRespostaDoModelo(texto), null, texto);
    }
  });
});

describe('a conferência e o molde', () => {
  it('aprova as peças boas, e a frase é o nome que o dono aprovou', () => {
    assert.deepEqual(descritorDoNomeDeRota.conferir(BOAS, PAJOTTENLAND), { ok: true });
    assert.equal(descritorDoNomeDeRota.montarFrase(BOAS, PAJOTTENLAND), 'Tour du Pajottenland');
  });

  it('reprova a justificativa que cita cidade não enviada', () => {
    const c = descritorDoNomeDeRota.conferir({ regiao: 'Toscana', artigo: 'la', justificativa: ['Siena'] }, PAJOTTENLAND);
    assert.equal(c.ok, false);
    assert.ok(c.ok === false && c.problemas.some((p) => p.regra === 'justificativa'));
    // Nunca `recusa`: a conferência do nome não distingue recusa do modelo de
    // resposta errada — as duas são reprovação, e o destino delas é o mesmo.
    assert.equal(c.ok === false ? c.recusa : undefined, undefined);
  });

  it('reprova a cidade da rota vendida como região', () => {
    const c = descritorDoNomeDeRota.conferir({ regiao: 'Ninove', justificativa: ['Ninove'] }, PAJOTTENLAND);
    assert.ok(c.ok === false && c.problemas.some((p) => p.regra === 'regiao-e-cidade'));
  });

  it('peças válidas que o molde não monta viram a regra sem-molde', () => {
    // Um `a-b` (sem âncora perto) cuja última cidade veio sem nome: a
    // justificativa cita uma cidade enviada, nada é inventado, e ainda assim não
    // há frase a montar — o molde exige as duas pontas.
    const semPonta: FatosDoNome = {
      rota: {
        startAt: '2026-08-15T08:00:00Z',
        distanceM: 42_000,
        elevationM: 300,
        lat0: 50.8, lng0: 4.0, lat1: 50.9, lng1: 4.3,
        cities: [
          { name: 'Ninove', country: 'BE', lat: 50.83, lng: 4.02 },
          { name: '', country: 'BE', lat: 50.9, lng: 4.3 },
        ],
      },
      ancoras: [],
    };
    assert.equal(leituraDoNome(semPonta).forma, 'a-b');
    const c = descritorDoNomeDeRota.conferir({ justificativa: ['Ninove'] }, semPonta);
    assert.ok(c.ok === false && c.problemas.map((p) => p.regra).includes(REGRA_SEM_MOLDE));
  });

  it('montarFrase lança se chegar onde a conferência já reprovou — nunca devolve nome vazio', () => {
    const semPonta: FatosDoNome = {
      rota: {
        startAt: '2026-08-15T08:00:00Z',
        distanceM: 42_000,
        elevationM: 300,
        lat0: 50.8, lng0: 4.0, lat1: 50.9, lng1: 4.3,
        cities: [
          { name: 'Ninove', country: 'BE', lat: 50.83, lng: 4.02 },
          { name: '', country: 'BE', lat: 50.9, lng: 4.3 },
        ],
      },
      ancoras: [],
    };
    assert.throws(() => descritorDoNomeDeRota.montarFrase({ justificativa: ['Ninove'] }, semPonta), TypeError);
  });
});

describe('o piso', () => {
  it('sem modelo é ausência com motivo — a região não se deriva das cidades', () => {
    const piso = descritorDoNomeDeRota.semModelo(PAJOTTENLAND);
    assert.ok('ausencia' in piso && piso.ausencia.length > 0);
  });
});
