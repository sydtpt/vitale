/**
 * A leitura da credencial — pura, e é o que decide se a bancada abre rede.
 *
 * Nada aqui constrói client nem chama `signInWithPassword`: o que se prova é a
 * parte que **para antes da rede** e nomeia o que falta. Abrir sessão é portão do
 * dono, com a credencial dele.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VARIAVEIS, comoExportar, lerCredenciais, problemaDaUrl, type Ambiente } from './supabase.ts';

const COMPLETO: Ambiente = Object.freeze({
  ORBE_SUPABASE_URL: 'https://projeto.supabase.co',
  ORBE_SUPABASE_ANON_KEY: 'anon',
  ORBE_EMAIL: 'dono@exemplo',
  ORBE_SENHA: 'a senha',
});

const TODAS = Object.values(VARIAVEIS).flat();

describe('lerCredenciais', () => {
  it('lê as quatro e tira a barra do fim da URL', () => {
    const r = lerCredenciais({ ...COMPLETO, ORBE_SUPABASE_URL: 'https://projeto.supabase.co//' });
    assert.ok(r.ok);
    assert.deepEqual(r.credenciais, {
      url: 'https://projeto.supabase.co',
      chaveAnonima: 'anon',
      email: 'dono@exemplo',
      senha: 'a senha',
    });
  });

  it('cai para as EXPO_PUBLIC_* quando as ORBE_* não existem', () => {
    const r = lerCredenciais({
      EXPO_PUBLIC_SUPABASE_URL: 'https://outro.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-expo',
      ORBE_EMAIL: 'dono@exemplo',
      ORBE_SENHA: 'a senha',
    });
    assert.ok(r.ok);
    assert.equal(r.credenciais.url, 'https://outro.supabase.co');
    assert.equal(r.credenciais.chaveAnonima, 'anon-expo');
  });

  it('a ORBE_* ganha da EXPO_PUBLIC_* — a precedência é declarada, não sorteada', () => {
    const r = lerCredenciais({ ...COMPLETO, EXPO_PUBLIC_SUPABASE_URL: 'https://nao-e-esta' });
    assert.ok(r.ok);
    assert.equal(r.credenciais.url, COMPLETO['ORBE_SUPABASE_URL']);
  });

  it('ambiente vazio: não devolve credencial e nomeia as quatro', () => {
    const r = lerCredenciais({});
    assert.equal(r.ok, false);
    assert.ok(!r.ok);
    assert.equal(r.faltam.length, 4);
    assert.deepEqual(r.problemas, []);
    for (const v of r.faltam) assert.ok(TODAS.some((nome) => v.startsWith(nome)), v);
  });

  it('nomeia exatamente a que falta, uma de cada vez', () => {
    for (const campo of Object.keys(VARIAVEIS) as (keyof typeof VARIAVEIS)[]) {
      const env: Record<string, string | undefined> = { ...COMPLETO };
      for (const nome of VARIAVEIS[campo]) delete env[nome];
      const r = lerCredenciais(env);
      assert.ok(!r.ok, `faltando ${campo} a leitura passou`);
      assert.deepEqual(r.faltam, [comoExportar(campo)]);
    }
  });

  it('variável vazia ou só com espaço conta como ausente', () => {
    for (const valor of ['', '   ', '\t\n']) {
      const r = lerCredenciais({ ...COMPLETO, ORBE_SENHA: valor });
      assert.ok(!r.ok, `ORBE_SENHA=${JSON.stringify(valor)} passou`);
      assert.deepEqual(r.faltam, [comoExportar('senha')]);
    }
  });

  it('o caminho de erro não devolve valor nenhum — só nomes', () => {
    const r = lerCredenciais({ ORBE_SUPABASE_URL: 'https://projeto.supabase.co', ORBE_SENHA: 'a senha' });
    assert.ok(!r.ok);
    const texto = JSON.stringify(r);
    assert.equal(texto.includes('a senha'), false, texto);
    assert.equal(texto.includes('projeto.supabase.co'), false, texto);
  });

  it('a senha não tem segunda grafia — não há EXPO_PUBLIC_ de senha', () => {
    assert.deepEqual([...VARIAVEIS.senha], ['ORBE_SENHA']);
    assert.equal(comoExportar('senha'), 'ORBE_SENHA');
    assert.equal(comoExportar('url'), 'ORBE_SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL)');
  });
});

describe('a senha chega crua', () => {
  it('espaço na borda é parte da senha, não ruído a recortar', () => {
    // Recortá-la daria "Invalid login credentials" sem nenhuma pista de que foi a
    // bancada que alterou a credencial.
    for (const senha of [' com espaço antes', 'e depois ', '  dos  dois  lados  ']) {
      const r = lerCredenciais({ ...COMPLETO, ORBE_SENHA: senha });
      assert.ok(r.ok, JSON.stringify(senha));
      assert.equal(r.credenciais.senha, senha);
    }
  });

  it('o e-mail também vai cru', () => {
    const r = lerCredenciais({ ...COMPLETO, ORBE_EMAIL: ' dono@exemplo ' });
    assert.ok(r.ok);
    assert.equal(r.credenciais.email, ' dono@exemplo ');
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
    const r = lerCredenciais({ ...COMPLETO, ORBE_SUPABASE_URL: 'projeto.supabase.co' });
    assert.ok(!r.ok);
    assert.deepEqual(r.faltam, []);
    assert.equal(r.problemas.length, 1);
    assert.ok(r.problemas[0]?.startsWith('ORBE_SUPABASE_URL'), r.problemas[0]);
    // E nem aqui o valor da senha aparece.
    assert.equal(JSON.stringify(r).includes('a senha'), false);
  });
});
