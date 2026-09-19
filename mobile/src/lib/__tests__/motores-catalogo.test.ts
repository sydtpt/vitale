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
  MOTIVOS_DO_APARELHO,
  NUVEM_PADRAO,
  RECURSOS,
  SEM_MODELO,
  lerMotorId,
} from '@vitale/shared';
import {
  HOSPEDAGEM,
  MOTIVO_CONSULTANDO,
  MOTIVO_DESCONHECIDO,
  MOTIVO_EM_PALAVRAS,
  MOTIVO_FORA_DO_IOS,
  MOTIVO_ILEGIVEL,
  MOTIVO_SEM_PONTE,
  MOTORES_CONHECIDOS,
  PONTE_AUSENTE,
  PONTE_CONSULTANDO,
  PONTE_FORA_DO_IOS,
  detalheDoAparelho,
  idsConhecidos,
  idsConhecidosDe,
  motivoDeBloqueio,
  motivoDoAparelho,
  motorConhecido,
  motorDisponivel,
  motoresDoRecurso,
  nomeDoMotor,
  type EstadoDaPonte,
  type ListaAprovada,
} from '../motores/catalogo';

/** A ponte lida, com o diagnóstico que o teste mandar. */
function lido(diagnostico: Extract<EstadoDaPonte, { tipo: 'lido' }>['diagnostico']): EstadoDaPonte {
  return { tipo: 'lido', diagnostico };
}

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

  it('sem a ponte (o build que o jest vê): sem modelo e nuvem disponíveis, aparelho listado e indisponível com o motivo do build', () => {
    expect(motorDisponivel(SEM_MODELO, MOTORES_CONHECIDOS)).toBe(true);
    expect(motorDisponivel(NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBe(true);

    const aparelho = motorConhecido(APARELHO_SISTEMA, MOTORES_CONHECIDOS);
    // Listado: esconder faria o seletor mentir por omissão.
    expect(aparelho).toBeDefined();
    expect(aparelho?.disponivel).toBe(false);
    expect(aparelho?.motivo).toBe('a ponte para o modelo do sistema não está neste build');
    expect(idsConhecidos).toContain(APARELHO_SISTEMA);
    // E é o mesmo que o catálogo diz com a ponte ausente.
    expect(motorConhecido(APARELHO_SISTEMA, motoresDoRecurso('saude-do-sono', PONTE_AUSENTE, null))).toEqual(aparelho);
  });

  it('todo motor tem rótulo e descrição — o seletor não mostra id cru', () => {
    for (const m of MOTORES_CONHECIDOS) {
      expect(m.rotulo.length).toBeGreaterThan(0);
      expect(m.descricao.length).toBeGreaterThan(0);
      expect(m.rotulo).not.toContain(':');
    }
  });

  it('motor fora do catálogo é indisponível, e não explode', () => {
    expect(motorDisponivel('nuvem:acme/x', MOTORES_CONHECIDOS)).toBe(false);
    expect(motorDisponivel('lixo', MOTORES_CONHECIDOS)).toBe(false);
    expect(motorDisponivel(null, MOTORES_CONHECIDOS)).toBe(false);
    expect(motorConhecido(undefined, MOTORES_CONHECIDOS)).toBeUndefined();
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

  it('na Saúde do sono: sem modelo e nuvem liberados; o aparelho segue a ponte', () => {
    expect(motivoDeBloqueio(saude, SEM_MODELO, MOTORES_CONHECIDOS)).toBeNull();
    expect(motivoDeBloqueio(saude, NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBeNull();
    // Sem a ponte: o motivo do build.
    expect(motivoDeBloqueio(saude, APARELHO_SISTEMA, MOTORES_CONHECIDOS)).toBe(
      'a ponte para o modelo do sistema não está neste build',
    );
    // Com a ponte e o modelo de pé: liberado (5.9).
    const pronto = motoresDoRecurso('saude-do-sono', lido({ estado: 'disponivel', variante: 'AFM 3 Core', janela: 4096 }), null);
    expect(motivoDeBloqueio(saude, APARELHO_SISTEMA, pronto)).toBeNull();
    // Com a ponte e a Apple Intelligence desligada: o motivo em palavras.
    const desligada = motoresDoRecurso('saude-do-sono', lido({ estado: 'indisponivel', motivo: 'appleIntelligenceNotEnabled' }), null);
    expect(motivoDeBloqueio(saude, APARELHO_SISTEMA, desligada)).toBe('a Apple Intelligence está desligada nos Ajustes');
  });

  it('recurso que esta camada não hospeda bloqueia TODOS os motores, com o motivo', () => {
    // Um controle que grava uma preferência que ninguém consulta mente tanto quanto
    // uma opção escondida: o dono trocaria o motor e nada mudaria.
    for (const m of MOTORES_CONHECIDOS) {
      expect(motivoDeBloqueio(nomeDeRota, m.id, MOTORES_CONHECIDOS)).toContain('ainda não usado nesta versão');
    }
  });

  it('na Retrospectiva: sem modelo e nuvem liberados, e o aparelho barrado pelo que a revista admite gravar', () => {
    // Hospedada desde a 1.10. O aparelho não é barrado pelo build aqui, e sim pela
    // AD-12: a revista só grava o que a nuvem escreve, e a razão tem de dizer isso.
    expect(motivoDeBloqueio(retro, SEM_MODELO, MOTORES_CONHECIDOS)).toBeNull();
    expect(motivoDeBloqueio(retro, NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBeNull();
    expect(motivoDeBloqueio(retro, APARELHO_SISTEMA, MOTORES_CONHECIDOS)).toBe('este recurso não guarda o que o modelo do aparelho escreve');
    // E continua barrado com a ponte de pé (5.9): nada muda para quem grava.
    const pronto = motoresDoRecurso('retrospectiva', lido({ estado: 'disponivel', variante: 'AFM 3 Core', janela: 4096 }), null);
    expect(motivoDeBloqueio(retro, APARELHO_SISTEMA, pronto)).toBe('este recurso não guarda o que o modelo do aparelho escreve');
  });

  it('motor acima do regimeMaximo do recurso é bloqueado com o motivo da exposição', () => {
    const soAparelho = { recurso: 'saude-do-sono', regimeMaximo: 'aparelho', grava: false } as const;
    expect(motivoDeBloqueio(soAparelho, NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBe('este recurso não manda dado além do aparelho');
    // E o que cabe no regime segue liberado (fora o build, que é outra razão).
    expect(motivoDeBloqueio(soAparelho, SEM_MODELO, MOTORES_CONHECIDOS)).toBeNull();

    const semModelo = { recurso: 'saude-do-sono', regimeMaximo: 'sem-modelo', grava: false } as const;
    expect(motivoDeBloqueio(semModelo, NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBe('este recurso não manda dado além do código');
  });

  it('tipo que o grava.admite do recurso recusa é bloqueado, com o motivo', () => {
    // Sem isto a preferência era gravada, o marcador não andava e nada explicava:
    // `resolverCadeia` descarta o elo calada.
    const soAparelhoGrava = {
      recurso: 'saude-do-sono',
      regimeMaximo: 'nuvem',
      grava: { admite: ['aparelho'], recusaEResultado: false },
    } as const;
    expect(motivoDeBloqueio(soAparelhoGrava, NUVEM_PADRAO, MOTORES_CONHECIDOS)).toBe(
      'este recurso não guarda o que a nuvem escreve',
    );
    // `sem-modelo` é o piso, sempre admitido.
    expect(motivoDeBloqueio(soAparelhoGrava, SEM_MODELO, MOTORES_CONHECIDOS)).toBeNull();
  });

  it('a gramática do id vem do núcleo, não de startsWith', () => {
    // Um provedor nomeado — o que a 5.6 vai gravar — é nuvem, e tem de ser lido
    // pelo mesmo leitor que a resolução da cadeia usa.
    const soAparelho = { recurso: 'saude-do-sono', regimeMaximo: 'aparelho', grava: false } as const;
    expect(motivoDeBloqueio(soAparelho, 'nuvem:acme/modelo-9', MOTORES_CONHECIDOS)).toBe(
      'este recurso não manda dado além do aparelho',
    );
    // E um id que não se lê não passa por legível.
    expect(motivoDeBloqueio(saude, 'lixo' as never, MOTORES_CONHECIDOS)).toBe('este motor não se lê');
  });
});

describe('o nome dos motores', () => {
  it('o nome traz artigo, e cai no tipo quando o id não é conhecido', () => {
    // O artigo é o que `assinatura.ts` contrai: sem ele, "escrito por nuvem".
    for (const m of MOTORES_CONHECIDOS) {
      expect(m.nome).toMatch(/^(a|o) /);
    }
    expect(nomeDoMotor(NUVEM_PADRAO)).toBe('a nuvem');
    // Um provedor nomeado tem **nome próprio** desde a 5.6: "a nuvem" para todos
    // fazia a assinatura não dizer qual modelo escreveu, e a bancada anunciar
    // "medindo a nuvem…" para N motores diferentes. Cobertura completa em
    // `motores-lista.test.ts`.
    expect(nomeDoMotor('nuvem:acme/modelo-9')).toBe('o modelo-9 da acme');
    expect(nomeDoMotor('aparelho:acme/pesos')).toBe('o modelo do aparelho');
    expect(nomeDoMotor('lixo')).toBe('o template');
  });
});

describe('o aparelho no diagnóstico da ponte (story 5.9)', () => {
  const aparelhoEm = (ponte: EstadoDaPonte) => motorConhecido(APARELHO_SISTEMA, motoresDoRecurso('saude-do-sono', ponte, null));

  it('pronto: disponível, sem motivo, com a variante e a janela numa linha simples', () => {
    const a = aparelhoEm(lido({ estado: 'disponivel', variante: 'AFM 3 Core Advanced', janela: 8192 }));
    expect(a?.disponivel).toBe(true);
    expect(a?.motivo).toBeUndefined();
    expect(a?.detalhe).toBe('AFM 3 Core Advanced · janela de 8.192 tokens');
    // A identidade não muda com o estado: o mesmo rótulo, o mesmo nome.
    expect(a?.rotulo).toBe('Modelo do aparelho');
    expect(a?.nome).toBe('o modelo do aparelho');
  });

  it('pronto antes do 27 (sem variante): a linha fica só com a janela; sem nada, sem linha', () => {
    expect(aparelhoEm(lido({ estado: 'disponivel', janela: 4096 }))?.detalhe).toBe('janela de 4.096 tokens');
    expect(aparelhoEm(lido({ estado: 'disponivel', variante: 'AFM 3 Core' }))?.detalhe).toBe('AFM 3 Core');
    const nu = aparelhoEm(lido({ estado: 'disponivel' }));
    expect(nu?.disponivel).toBe(true);
    expect(nu?.detalhe).toBeUndefined();
  });

  it('cada motivo sai em palavras, apagado e sem linha de detalhe', () => {
    const casos: readonly (readonly [string, string])[] = [
      ['deviceNotEligible', 'este aparelho não é elegível ao modelo do sistema'],
      ['appleIntelligenceNotEnabled', 'a Apple Intelligence está desligada nos Ajustes'],
      ['modelNotReady', 'o modelo do sistema ainda não está pronto — ele pode estar sendo baixado'],
      ['sistemaAntigo', 'o modelo do sistema pede iOS 26 ou mais novo'],
      // O `@unknown default` da ponte: um motivo que esta versão não conhece.
      ['FoundationModels.UnavailableReason: .novo', MOTIVO_DESCONHECIDO],
      // Chave de protótipo não é motivo conhecido.
      ['constructor', MOTIVO_DESCONHECIDO],
    ];
    for (const [motivo, palavras] of casos) {
      const a = aparelhoEm(lido({ estado: 'indisponivel', motivo }));
      expect(a?.disponivel).toBe(false);
      expect(a?.motivo).toBe(palavras);
      expect(a?.detalhe).toBeUndefined();
    }
  });

  it('ausente, consultando e ilegível: apagado, cada um com a sua frase', () => {
    expect(motivoDoAparelho(PONTE_AUSENTE)).toBe(MOTIVO_SEM_PONTE);
    expect(motivoDoAparelho(PONTE_CONSULTANDO)).toBe(MOTIVO_CONSULTANDO);
    expect(motivoDoAparelho(lido({ estado: 'ilegivel', detalhe: 'x' }))).toBe('o aparelho não respondeu como esperado');
    expect(MOTIVO_ILEGIVEL).toBe('o aparelho não respondeu como esperado');
    for (const p of [PONTE_AUSENTE, PONTE_CONSULTANDO, lido({ estado: 'ilegivel', detalhe: 'x' })]) {
      expect(aparelhoEm(p)?.disponivel).toBe(false);
      expect(detalheDoAparelho(p)).toBeUndefined();
    }
  });

  it('indisponível sempre tem motivo, e disponível nunca — em todo estado da ponte', () => {
    const estados: readonly EstadoDaPonte[] = [
      PONTE_AUSENTE,
      PONTE_CONSULTANDO,
      lido({ estado: 'disponivel', variante: 'v', janela: 1 }),
      lido({ estado: 'indisponivel', motivo: 'modelNotReady' }),
      lido({ estado: 'ilegivel', detalhe: 'x' }),
    ];
    for (const p of estados) {
      for (const m of motoresDoRecurso('saude-do-sono', p, null)) {
        if (m.disponivel) expect(m.motivo).toBeUndefined();
        else expect(typeof m.motivo === 'string' && m.motivo.length > 0).toBe(true);
      }
    }
  });

  it('a ponte não muda os ids: o aparelho entra na cadeia em todo estado', () => {
    for (const p of [PONTE_AUSENTE, lido({ estado: 'disponivel' })]) {
      expect(motoresDoRecurso('saude-do-sono', p, null).map((m) => m.id)).toEqual([...idsConhecidos]);
    }
  });
});

describe('a ponte fora do caminho feliz, e o que o seletor precisa (story 5.9, revisão)', () => {
  const aparelhoEm = (ponte: EstadoDaPonte) => motorConhecido(APARELHO_SISTEMA, motoresDoRecurso('saude-do-sono', ponte, null));

  it('fora do iOS o motivo é da plataforma, não do build', () => {
    expect(motivoDoAparelho(PONTE_FORA_DO_IOS)).toBe(MOTIVO_FORA_DO_IOS);
    expect(MOTIVO_FORA_DO_IOS).toBe('o modelo do aparelho só existe no iPhone');
    expect(aparelhoEm(PONTE_FORA_DO_IOS)?.motivo).not.toBe(MOTIVO_SEM_PONTE);
    expect(aparelhoEm(PONTE_FORA_DO_IOS)?.disponivel).toBe(false);
  });

  it('consultando é marcado como tal — e só ele', () => {
    expect(aparelhoEm(PONTE_CONSULTANDO)?.consultando).toBe(true);
    for (const p of [PONTE_AUSENTE, PONTE_FORA_DO_IOS, lido({ estado: 'disponivel' }), lido({ estado: 'indisponivel', motivo: 'modelNotReady' })]) {
      expect(aparelhoEm(p)?.consultando).toBeUndefined();
    }
  });

  it('as palavras cobrem exatamente os motivos que a ponte conhece', () => {
    expect(Object.keys(MOTIVO_EM_PALAVRAS).sort()).toEqual([...MOTIVOS_DO_APARELHO].sort());
    for (const m of MOTIVOS_DO_APARELHO) {
      expect(MOTIVO_EM_PALAVRAS[m].length).toBeGreaterThan(0);
      expect(aparelhoEm(lido({ estado: 'indisponivel', motivo: m }))?.motivo).toBe(MOTIVO_EM_PALAVRAS[m]);
    }
  });

  it('idsConhecidosDe concorda com motoresDoRecurso, com variantes aprovadas, em todo estado da ponte', () => {
    const lista: ListaAprovada = { motores: [{ motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] }], lidaEm: 1 };
    for (const p of [PONTE_AUSENTE, PONTE_FORA_DO_IOS, PONTE_CONSULTANDO, lido({ estado: 'disponivel' })]) {
      for (const recurso of RECURSOS) {
        expect(idsConhecidosDe(recurso, lista)).toEqual(motoresDoRecurso(recurso, p, lista).map((m) => m.id));
        expect(idsConhecidosDe(recurso, null)).toEqual(motoresDoRecurso(recurso, p, null).map((m) => m.id));
      }
    }
    expect(idsConhecidosDe('saude-do-sono', lista)).toContain('nuvem:acme/modelo-9');
  });
});
