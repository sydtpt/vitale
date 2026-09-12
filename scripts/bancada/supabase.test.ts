/**
 * A leitura da credencial — pura, e é o que decide se a bancada abre rede.
 *
 * Nada aqui constrói client, nem chama `setSession`, `getClaims` ou
 * `signInWithPassword`: o que se prova é a parte que **para antes da rede**, escolhe
 * o caminho e nomeia o que falta. Abrir sessão é portão do dono, com a credencial dele.
 *
 * **Dois caminhos** desde 12/09: o token do navegador (preferido — a conta do dono é do
 * Google e não tem senha) e o par e-mail/senha que a 5.4 nasceu usando.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OMITIDO, semSegredo } from './motores.ts';
import {
  VARIAVEIS,
  avisoDeValidade,
  comoExportar,
  comoSeAutenticar,
  lerCredenciais,
  problemaDaUrl,
  segredosDe,
  type Ambiente,
} from './supabase.ts';

const PROJETO: Ambiente = Object.freeze({
  ORBE_SUPABASE_URL: 'https://projeto.supabase.co',
  ORBE_SUPABASE_ANON_KEY: 'anon',
});

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.o-token-de-acesso.assinatura';
const REFRESH = 'o-refresh-token-que-nao-expira-em-uma-hora';

const SO_TOKEN: Ambiente = { ...PROJETO, ORBE_ACCESS_TOKEN: TOKEN };
const SO_SENHA: Ambiente = { ...PROJETO, ORBE_EMAIL: 'dono@exemplo', ORBE_SENHA: 'a senha' };

describe('os dois caminhos', () => {
  it('só token: via token, sem refresh', () => {
    const r = lerCredenciais(SO_TOKEN);
    assert.ok(r.ok);
    assert.deepEqual(r.credenciais, {
      url: 'https://projeto.supabase.co',
      chaveAnonima: 'anon',
      via: 'token',
      accessToken: TOKEN,
      refreshToken: null,
    });
    assert.deepEqual(r.avisos, []);
  });

  it('token + refresh: os dois entram, e é o caminho da corrida longa', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_REFRESH_TOKEN: REFRESH });
    assert.ok(r.ok);
    assert.equal(r.credenciais.via, 'token');
    assert.ok(r.credenciais.via === 'token');
    assert.equal(r.credenciais.accessToken, TOKEN);
    assert.equal(r.credenciais.refreshToken, REFRESH);
  });

  it('só senha: via senha, como a 5.4 nasceu', () => {
    const r = lerCredenciais(SO_SENHA);
    assert.ok(r.ok);
    assert.ok(r.credenciais.via === 'senha');
    assert.equal(r.credenciais.email, 'dono@exemplo');
    assert.equal(r.credenciais.senha, 'a senha');
    assert.deepEqual(r.avisos, []);
  });

  it('os dois preenchidos: o TOKEN ganha, e o aviso diz que a senha foi ignorada', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ...SO_SENHA, ORBE_ACCESS_TOKEN: TOKEN });
    assert.ok(r.ok);
    assert.equal(r.credenciais.via, 'token');
    assert.equal(r.avisos.length, 1);
    assert.match(r.avisos[0] ?? '', /ORBE_ACCESS_TOKEN/);
    assert.match(r.avisos[0] ?? '', /ORBE_SENHA foi ignorada/);
  });

  it('refresh sozinho não é caminho — sem o de acesso não há o que instalar', () => {
    const r = lerCredenciais({ ...PROJETO, ORBE_REFRESH_TOKEN: REFRESH });
    assert.ok(!r.ok);
    assert.equal(r.semCaminho, true);
  });

  it('nenhum caminho: a mensagem ensina os DOIS, e o do token vem primeiro', () => {
    const r = lerCredenciais(PROJETO);
    assert.ok(!r.ok);
    assert.equal(r.semCaminho, true);
    assert.deepEqual(r.faltam, [], 'url e chave anônima estão lá: não é falta delas');

    const texto = comoSeAutenticar();
    // Conta de OAuth não tem senha — é a informação que evita a tarde perdida.
    assert.match(texto, /OAuth não tem senha/);
    assert.ok(texto.indexOf('ORBE_ACCESS_TOKEN') < texto.indexOf('ORBE_EMAIL'), texto);
    for (const v of ['ORBE_ACCESS_TOKEN', 'ORBE_REFRESH_TOKEN', 'ORBE_EMAIL', 'ORBE_SENHA']) {
      assert.ok(texto.includes(v), `${v} não aparece em comoSeAutenticar()`);
    }
    assert.match(texto, /README/);
  });

  it('meia senha, e sem token: o problema diz qual metade falta', () => {
    const soEmail = lerCredenciais({ ...PROJETO, ORBE_EMAIL: 'dono@exemplo' });
    assert.ok(!soEmail.ok);
    assert.equal(soEmail.problemas.length, 1);
    assert.match(soEmail.problemas[0] ?? '', /ORBE_SENHA/);

    const soSenha = lerCredenciais({ ...PROJETO, ORBE_SENHA: 'a senha' });
    assert.ok(!soSenha.ok);
    assert.match(soSenha.problemas[0] ?? '', /ORBE_EMAIL/);
  });

  it('meia senha COM token não é problema: o token é o caminho', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_EMAIL: 'dono@exemplo' });
    assert.ok(r.ok);
    assert.equal(r.credenciais.via, 'token');
  });
});

describe('a URL e a chave anônima são obrigatórias nos dois caminhos', () => {
  it('token sem URL, ou sem chave anônima', () => {
    const semUrl = lerCredenciais({ ORBE_SUPABASE_ANON_KEY: 'anon', ORBE_ACCESS_TOKEN: TOKEN });
    assert.ok(!semUrl.ok);
    assert.deepEqual(semUrl.faltam, [comoExportar('url')]);
    assert.equal(semUrl.semCaminho, false, 'o caminho existe: o que falta é o projeto');

    const semChave = lerCredenciais({ ORBE_SUPABASE_URL: 'https://projeto.supabase.co', ORBE_ACCESS_TOKEN: TOKEN });
    assert.ok(!semChave.ok);
    assert.deepEqual(semChave.faltam, [comoExportar('chaveAnonima')]);
  });

  it('senha sem URL nem chave anônima: as duas são nomeadas', () => {
    const r = lerCredenciais({ ORBE_EMAIL: 'dono@exemplo', ORBE_SENHA: 'a senha' });
    assert.ok(!r.ok);
    assert.deepEqual(r.faltam, [comoExportar('url'), comoExportar('chaveAnonima')]);
    assert.equal(r.semCaminho, false);
  });

  it('ambiente vazio: nomeia o projeto E diz que não há caminho', () => {
    const r = lerCredenciais({});
    assert.ok(!r.ok);
    assert.equal(r.faltam.length, 2);
    assert.equal(r.semCaminho, true);
  });

  it('cai para as EXPO_PUBLIC_* no projeto, e a ORBE_* ganha', () => {
    const r = lerCredenciais({
      EXPO_PUBLIC_SUPABASE_URL: 'https://outro.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-expo',
      ORBE_ACCESS_TOKEN: TOKEN,
    });
    assert.ok(r.ok);
    assert.equal(r.credenciais.url, 'https://outro.supabase.co');
    assert.equal(r.credenciais.chaveAnonima, 'anon-expo');

    const comOrbe = lerCredenciais({ ...SO_TOKEN, EXPO_PUBLIC_SUPABASE_URL: 'https://nao-e-esta' });
    assert.ok(comOrbe.ok);
    assert.equal(comOrbe.credenciais.url, PROJETO['ORBE_SUPABASE_URL']);
  });

  it('tira a barra do fim da URL', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_SUPABASE_URL: 'https://projeto.supabase.co//' });
    assert.ok(r.ok);
    assert.equal(r.credenciais.url, 'https://projeto.supabase.co');
  });
});

describe('o valor chega cru, e nenhum caminho de erro o devolve', () => {
  it('espaço na borda é parte da senha e do token, não ruído a recortar', () => {
    for (const senha of [' com espaço antes', 'e depois ', '  dos  dois  lados  ']) {
      const r = lerCredenciais({ ...SO_SENHA, ORBE_SENHA: senha });
      assert.ok(r.ok && r.credenciais.via === 'senha', JSON.stringify(senha));
      assert.equal(r.credenciais.senha, senha);
    }
    const comToken = lerCredenciais({ ...SO_TOKEN, ORBE_ACCESS_TOKEN: ` ${TOKEN} ` });
    assert.ok(comToken.ok && comToken.credenciais.via === 'token');
    assert.equal(comToken.credenciais.accessToken, ` ${TOKEN} `);
  });

  it('variável vazia ou só com espaço conta como ausente', () => {
    for (const valor of ['', '   ', '\t\n']) {
      const r = lerCredenciais({ ...SO_TOKEN, ORBE_ACCESS_TOKEN: valor });
      assert.ok(!r.ok, `token ${JSON.stringify(valor)} passou`);
      assert.equal(r.semCaminho, true);
    }
  });

  it('nem token nem senha aparecem no caminho de erro', () => {
    const r = lerCredenciais({ ORBE_ACCESS_TOKEN: TOKEN, ORBE_REFRESH_TOKEN: REFRESH, ORBE_SENHA: 'a senha' });
    assert.ok(!r.ok);
    const texto = JSON.stringify(r);
    for (const segredo of [TOKEN, REFRESH, 'a senha']) {
      assert.equal(texto.includes(segredo), false, texto);
    }
  });
});

describe('problemaDaUrl', () => {
  it('aceita https, e http só no local (o dublê da nuvem em teste)', () => {
    assert.equal(problemaDaUrl('https://projeto.supabase.co'), null);
    assert.equal(problemaDaUrl('http://127.0.0.1:54321'), null);
    assert.equal(problemaDaUrl('http://localhost:54321'), null);
  });

  it('recusa o que não é URL, e http fora do local', () => {
    for (const url of ['projeto.supabase.co', 'svyyuhxkblufhfvfvqte', '', 'nao sou url']) {
      assert.ok(problemaDaUrl(url)?.includes('não é uma URL'), url);
    }
    assert.ok(problemaDaUrl('http://projeto.supabase.co')?.includes('https://'));
    assert.ok(problemaDaUrl('ftp://projeto.supabase.co')?.includes('https://'));
  });

  it('a credencial com URL torta não passa, e o problema nomeia a variável', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_SUPABASE_URL: 'projeto.supabase.co' });
    assert.ok(!r.ok);
    assert.equal(r.problemas.length, 1);
    assert.ok(r.problemas[0]?.startsWith('ORBE_SUPABASE_URL'), r.problemas[0]);
  });
});

describe('segredosDe, e o que o transporte redige', () => {
  it('o caminho do token leva os dois tokens e a chave anônima', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_REFRESH_TOKEN: REFRESH });
    assert.ok(r.ok);
    const segredos = segredosDe(r.credenciais);
    assert.deepEqual([...segredos].sort(), ['anon', REFRESH, TOKEN].sort());
  });

  it('sem refresh, só o de acesso e a chave', () => {
    const r = lerCredenciais(SO_TOKEN);
    assert.ok(r.ok);
    assert.deepEqual([...segredosDe(r.credenciais)].sort(), ['anon', TOKEN].sort());
  });

  it('o caminho da senha leva a senha', () => {
    const r = lerCredenciais(SO_SENHA);
    assert.ok(r.ok);
    assert.deepEqual([...segredosDe(r.credenciais)].sort(), ['a senha', 'anon'].sort());
  });

  it('`semSegredo` redige o REFRESH token também — ele não expira em uma hora', () => {
    const r = lerCredenciais({ ...SO_TOKEN, ORBE_REFRESH_TOKEN: REFRESH });
    assert.ok(r.ok);
    const cru = `falhou com Bearer ${TOKEN} e refresh=${REFRESH} na chave anon`;
    const limpo = semSegredo(cru, segredosDe(r.credenciais));
    assert.equal(limpo.includes(TOKEN), false, limpo);
    assert.equal(limpo.includes(REFRESH), false, limpo);
    assert.ok(limpo.includes(OMITIDO));
    // Não-vácuo: a marca entrou duas vezes, uma por segredo.
    assert.equal(limpo.split(OMITIDO).length - 1, 3, limpo);
  });
});

describe('avisoDeValidade', () => {
  const agora = new Date('2026-09-12T12:00:00.000Z');
  const em = (minutos: number): Date => new Date(agora.getTime() + minutos * 60_000);

  it('com refresh (ou senha), não há o que avisar', () => {
    assert.equal(
      avisoDeValidade({ expiraEm: em(1), podeRenovar: true, chamadas: 28, prazoMs: 60_000, agora }),
      null,
    );
  });

  it('token já vencido: manda pegar um novo e sugere o refresh', () => {
    const aviso = avisoDeValidade({ expiraEm: em(-5), podeRenovar: false, chamadas: 0, prazoMs: 60_000, agora });
    assert.match(aviso ?? '', /já venceu/);
    assert.match(aviso ?? '', /ORBE_REFRESH_TOKEN/);
  });

  it('token com folga para a corrida: diz os minutos e não alarma', () => {
    const aviso = avisoDeValidade({ expiraEm: em(55), podeRenovar: false, chamadas: 2, prazoMs: 60_000, agora });
    assert.match(aviso ?? '', /vence em 55 min/);
    assert.equal(/NÃO termina/.test(aviso ?? ''), false, aviso ?? '');
  });

  it('corrida maior que a validade: diz que provavelmente não termina, e o caminho', () => {
    // 28 chamadas × 60 s de prazo = até 28 min de pior caso, contra 10 min de token.
    const aviso = avisoDeValidade({ expiraEm: em(10), podeRenovar: false, chamadas: 28, prazoMs: 60_000, agora });
    assert.match(aviso ?? '', /vence em 10 min/);
    assert.match(aviso ?? '', /28 chamadas podem levar até 28 min/);
    assert.match(aviso ?? '', /NÃO termina/);
    assert.match(aviso ?? '', /ORBE_REFRESH_TOKEN/);
  });

  it('sem chamada de nuvem, o aviso é só o prazo — não há corrida a estimar', () => {
    const aviso = avisoDeValidade({ expiraEm: em(3), podeRenovar: false, chamadas: 0, prazoMs: 60_000, agora });
    assert.match(aviso ?? '', /vence em 3 min/);
    assert.equal(/NÃO termina/.test(aviso ?? ''), false);
  });
});

describe('as variáveis declaradas', () => {
  it('o token e a senha não têm segunda grafia — nada de EXPO_PUBLIC_ de credencial', () => {
    assert.deepEqual([...VARIAVEIS.accessToken], ['ORBE_ACCESS_TOKEN']);
    assert.deepEqual([...VARIAVEIS.refreshToken], ['ORBE_REFRESH_TOKEN']);
    assert.deepEqual([...VARIAVEIS.senha], ['ORBE_SENHA']);
    assert.equal(comoExportar('accessToken'), 'ORBE_ACCESS_TOKEN');
    assert.equal(comoExportar('url'), 'ORBE_SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL)');
  });

  it('a ordem declarada põe o caminho do token antes do da senha', () => {
    const chaves = Object.keys(VARIAVEIS);
    assert.ok(chaves.indexOf('accessToken') < chaves.indexOf('email'), chaves.join(', '));
  });
});
