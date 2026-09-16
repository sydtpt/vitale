/**
 * O catálogo de motores do app (story 5.5).
 *
 * O que precisa de cobertura aqui não é a lista — é o que ela **promete** a quem a
 * lê: que todo id se deixa ler pela gramática do núcleo (senão `resolverCadeia` o
 * descarta calado e o seletor mostraria uma opção que nunca é escolhida), e que
 * indisponível **sempre** vem com motivo em palavras. Um motor indisponível sem
 * motivo é exatamente a tela que a decisão 5 do dono proíbe: o dono escolhe, nada
 * acontece, e ninguém diz por quê.
 */
import { describe, it, expect } from '@jest/globals';
import {
  APARELHO_SISTEMA,
  CATALOGO_DE_RECURSOS,
  NUVEM_PADRAO,
  RECURSOS,
  SEM_MODELO,
  lerMotorId,
} from '@vitale/shared';
import {
  HOSPEDAGEM,
  MOTORES_CONHECIDOS,
  idsConhecidos,
  motivoDeBloqueio,
  motorConhecido,
  motorDisponivel,
  nomeDoMotor,
} from '../motores/catalogo';

describe('o catálogo de motores do app', () => {
  it('todo id se deixa ler pela gramática do núcleo', () => {
    for (const m of MOTORES_CONHECIDOS) {
      expect(lerMotorId(m.id)).not.toBeNull();
    }
  });

  it('não repete id, e `idsConhecidos` é a lista inteira', () => {
    const ids = MOTORES_CONHECIDOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...idsConhecidos]).toEqual(ids);
  });

  it('indisponível tem motivo, e disponível não tem — nunca o contrário', () => {
    for (const m of MOTORES_CONHECIDOS) {
      if (m.disponivel) expect(m.motivo).toBeUndefined();
      else expect(typeof m.motivo === 'string' && m.motivo.length > 0).toBe(true);
    }
  });

  it('no marco A: sem modelo e nuvem disponíveis, aparelho listado e indisponível com motivo', () => {
    expect(motorDisponivel(SEM_MODELO)).toBe(true);
    expect(motorDisponivel(NUVEM_PADRAO)).toBe(true);

    const aparelho = motorConhecido(APARELHO_SISTEMA);
    // Listado: esconder faria o seletor mentir por omissão.
    expect(aparelho).toBeDefined();
    expect(aparelho?.disponivel).toBe(false);
    expect(aparelho?.motivo).toBe('a ponte para o modelo do sistema ainda não existe neste build');
    expect(idsConhecidos).toContain(APARELHO_SISTEMA);
  });

  it('todo motor tem rótulo e descrição — o seletor não mostra id cru', () => {
    for (const m of MOTORES_CONHECIDOS) {
      expect(m.rotulo.length).toBeGreaterThan(0);
      expect(m.descricao.length).toBeGreaterThan(0);
      expect(m.rotulo).not.toContain(':');
    }
  });

  it('motor fora do catálogo é indisponível, e não explode', () => {
    expect(motorDisponivel('nuvem:acme/x')).toBe(false);
    expect(motorDisponivel('lixo')).toBe(false);
    expect(motorDisponivel(null)).toBe(false);
    expect(motorConhecido(undefined)).toBeUndefined();
  });

  it('a hospedagem cobre todo recurso do núcleo: a Saúde do sono e a Retrospectiva ligadas, o nome de rota não', () => {
    // Fechada sobre `RecursoId`: o teste falha se um recurso novo entrar no núcleo
    // sem alguém dizer se esta camada o consome.
    expect(Object.keys(HOSPEDAGEM).sort()).toEqual([...RECURSOS].sort());
    expect(HOSPEDAGEM['saude-do-sono'].hospedado).toBe(true);
    // A 1.10 ligou a impressão da revista pelo orquestrador: a escolha passou a ser
    // consultada, e a tela de motores não pode continuar dizendo que não é.
    expect(HOSPEDAGEM.retrospectiva).toEqual({ hospedado: true });
    expect(HOSPEDAGEM['nome-de-rota'].hospedado).toBe(false);
    for (const [id, h] of Object.entries(HOSPEDAGEM)) {
      if (h.hospedado) expect(h.motivo).toBeUndefined();
      else expect(h.motivo).toContain('ainda não usado nesta versão');
      expect(RECURSOS).toContain(id);
    }
  });

  it('todo recurso do catálogo do núcleo tem nome de hospedagem — nenhum fica sem resposta', () => {
    for (const d of CATALOGO_DE_RECURSOS) {
      expect(HOSPEDAGEM[d.recurso]).toBeDefined();
    }
  });
});

describe('por que um motor não pode ser escolhido', () => {
  const saude = CATALOGO_DE_RECURSOS.find((d) => d.recurso === 'saude-do-sono')!;
  const retro = CATALOGO_DE_RECURSOS.find((d) => d.recurso === 'retrospectiva')!;
  // O nome de rota ainda não está no catálogo do núcleo (entra na 5.7); a forma que o
  // bloqueio lê basta para medir o recurso que esta camada não hospeda.
  const nomeDeRota = { recurso: 'nome-de-rota', regimeMaximo: 'nuvem', grava: false } as const;

  it('na Saúde do sono: sem modelo e nuvem liberados, aparelho com o motivo do build', () => {
    expect(motivoDeBloqueio(saude, SEM_MODELO)).toBeNull();
    expect(motivoDeBloqueio(saude, NUVEM_PADRAO)).toBeNull();
    expect(motivoDeBloqueio(saude, APARELHO_SISTEMA)).toBe(
      'a ponte para o modelo do sistema ainda não existe neste build',
    );
  });

  it('recurso que esta camada não hospeda bloqueia TODOS os motores, com o motivo', () => {
    // Um controle que grava uma preferência que ninguém consulta mente tanto quanto
    // uma opção escondida: o dono trocaria o motor e nada mudaria.
    for (const m of MOTORES_CONHECIDOS) {
      expect(motivoDeBloqueio(nomeDeRota, m.id)).toContain('ainda não usado nesta versão');
    }
  });

  it('na Retrospectiva: sem modelo e nuvem liberados, e o aparelho barrado pelo que a revista admite gravar', () => {
    // Hospedada desde a 1.10. O aparelho não é barrado pelo build aqui, e sim pela
    // AD-12: a revista só grava o que a nuvem escreve, e a razão tem de dizer isso.
    expect(motivoDeBloqueio(retro, SEM_MODELO)).toBeNull();
    expect(motivoDeBloqueio(retro, NUVEM_PADRAO)).toBeNull();
    expect(motivoDeBloqueio(retro, APARELHO_SISTEMA)).toBe('este recurso não guarda o que o modelo do aparelho escreve');
  });

  it('motor acima do regimeMaximo do recurso é bloqueado com o motivo da exposição', () => {
    const soAparelho = { recurso: 'saude-do-sono', regimeMaximo: 'aparelho', grava: false } as const;
    expect(motivoDeBloqueio(soAparelho, NUVEM_PADRAO)).toBe('este recurso não manda dado além do aparelho');
    // E o que cabe no regime segue liberado (fora o build, que é outra razão).
    expect(motivoDeBloqueio(soAparelho, SEM_MODELO)).toBeNull();

    const semModelo = { recurso: 'saude-do-sono', regimeMaximo: 'sem-modelo', grava: false } as const;
    expect(motivoDeBloqueio(semModelo, NUVEM_PADRAO)).toBe('este recurso não manda dado além do código');
  });

  it('tipo que o grava.admite do recurso recusa é bloqueado, com o motivo', () => {
    // Sem isto a preferência era gravada, o marcador não andava e nada explicava:
    // `resolverCadeia` descarta o elo calada.
    const soAparelhoGrava = {
      recurso: 'saude-do-sono',
      regimeMaximo: 'nuvem',
      grava: { admite: ['aparelho'], recusaEResultado: false },
    } as const;
    expect(motivoDeBloqueio(soAparelhoGrava, NUVEM_PADRAO)).toBe(
      'este recurso não guarda o que a nuvem escreve',
    );
    // `sem-modelo` é o piso, sempre admitido.
    expect(motivoDeBloqueio(soAparelhoGrava, SEM_MODELO)).toBeNull();
  });

  it('a gramática do id vem do núcleo, não de startsWith', () => {
    // Um provedor nomeado — o que a 5.6 vai gravar — é nuvem, e tem de ser lido
    // pelo mesmo leitor que a resolução da cadeia usa.
    const soAparelho = { recurso: 'saude-do-sono', regimeMaximo: 'aparelho', grava: false } as const;
    expect(motivoDeBloqueio(soAparelho, 'nuvem:acme/modelo-9')).toBe(
      'este recurso não manda dado além do aparelho',
    );
    // E um id que não se lê não passa por legível.
    expect(motivoDeBloqueio(saude, 'lixo' as never)).toBe('este motor não se lê');
  });
});

describe('o nome dos motores', () => {
  it('o nome traz artigo, e cai no tipo quando o id não é conhecido', () => {
    // O artigo é o que `assinatura.ts` contrai: sem ele, "escrito por nuvem".
    for (const m of MOTORES_CONHECIDOS) {
      expect(m.nome).toMatch(/^(a|o) /);
    }
    expect(nomeDoMotor(NUVEM_PADRAO)).toBe('a nuvem');
    // Um provedor nomeado — o que a 5.6 vai gravar — ainda rende um sujeito legível.
    expect(nomeDoMotor('nuvem:acme/modelo-9')).toBe('a nuvem');
    expect(nomeDoMotor('aparelho:acme/pesos')).toBe('o modelo do aparelho');
    expect(nomeDoMotor('lixo')).toBe('o template');
  });
});
