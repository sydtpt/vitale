/**
 * A assinatura da leitura (story 5.5) — as decisões 3 e 5 do dono.
 *
 * O teste cobre as **sete classes de falha** mais as quatro causas que o
 * orquestrador acrescenta, uma a uma, porque é aqui que a decisão 5 se cumpre: se
 * uma delas voltasse vazia, o dono veria a frase do template com uma assinatura
 * que não diz nada, e o recuo silencioso viraria o comportamento normal sem nunca
 * ser notado.
 *
 * `CLASSES_DE_FALHA` vem do núcleo, não de uma lista escrita aqui: uma classe nova
 * entra no teste sozinha.
 */
import { describe, it, expect } from '@jest/globals';
import { CLASSES_DE_FALHA, NUVEM_PADRAO, SEM_MODELO, type Causa } from '@vitale/shared';
import { motivoDaFalha, tempoDaLeitura, textoDaAssinatura } from '../assinatura';

/** As quatro causas além das classes. Separadas porque só uma delas devolve `null`. */
const OUTRAS_CAUSAS: readonly Causa[] = ['reprovada', 'defeito', 'mudo'];

describe('o motivo da falha, em palavras', () => {
  it('as sete classes têm motivo, e nenhuma vira jargão na tela', () => {
    // "indisponivel" não quer dizer nada para quem lê a Saúde às sete da manhã: o
    // motivo é uma oração, não o nome da classe. ("janela" é palavra do português
    // usada no sentido dela, e por isso não está na lista de jargão abaixo.)
    const JARGAO = ['indisponivel', 'capacidade', 'guarda', 'recusa-do-modelo', 'saida-invalida', 'transitoria'];
    for (const classe of CLASSES_DE_FALHA) {
      const motivo = motivoDaFalha(classe, NUVEM_PADRAO) ?? '';
      expect(motivo.length).toBeGreaterThan(0);
      expect(motivo).toContain(' ');
      expect(motivo).not.toBe(classe);
      for (const j of JARGAO) expect(motivo).not.toContain(j);
    }
  });

  it('reprovada, defeito e mudo também têm motivo', () => {
    for (const causa of OUTRAS_CAUSAS) {
      expect((motivoDaFalha(causa, NUVEM_PADRAO) ?? '').length).toBeGreaterThan(0);
    }
  });

  it('preferência não tem motivo: nada falhou', () => {
    expect(motivoDaFalha('preferencia', SEM_MODELO)).toBeNull();
  });

  it('os textos da matriz de bordas, à letra', () => {
    expect(motivoDaFalha('recusa-do-modelo', NUVEM_PADRAO)).toBe('a nuvem recusou');
    expect(motivoDaFalha('indisponivel', NUVEM_PADRAO)).toBe('a nuvem não atendeu');
    expect(motivoDaFalha('reprovada', NUVEM_PADRAO)).toBe('a nuvem escreveu fora das regras');
  });

  it('o motivo nomeia o motor certo, e contrai o artigo', () => {
    expect(motivoDaFalha('indisponivel', 'aparelho:sistema')).toBe('o modelo do aparelho não atendeu');
    expect(motivoDaFalha('janela', NUVEM_PADRAO)).toBe('o pedido não cabe na janela da nuvem');
    expect(motivoDaFalha('janela', 'aparelho:sistema')).toBe(
      'o pedido não cabe na janela do modelo do aparelho',
    );
  });
});

describe('o tempo da leitura', () => {
  it('abaixo de um segundo é instantâneo, não "0 s"', () => {
    expect(tempoDaLeitura(0)).toBe('instantâneo');
    expect(tempoDaLeitura(999)).toBe('instantâneo');
  });

  it('acima, o segundo inteiro', () => {
    expect(tempoDaLeitura(1000)).toBe('1 s');
    expect(tempoDaLeitura(13_600)).toBe('14 s');
    expect(tempoDaLeitura(17_200)).toBe('17 s');
  });

  it('número que não é número não vira NaN na tela', () => {
    expect(tempoDaLeitura(Number.NaN)).toBe('instantâneo');
  });
});

describe('a assinatura', () => {
  it('em repouso não há assinatura — a vaga mostra o convite', () => {
    expect(textoDaAssinatura({ fase: 'repouso' })).toBeNull();
  });

  it('na espera, o motor é nomeado — e antes de saber quem é, não se inventa', () => {
    expect(textoDaAssinatura({ fase: 'escrevendo' })).toBe('está escrevendo…');
    expect(textoDaAssinatura({ fase: 'escrevendo', motor: NUVEM_PADRAO })).toBe(
      'a nuvem está escrevendo…',
    );
  });

  it('quando a nuvem escreve, a assinatura nomeia a nuvem e o tempo', () => {
    expect(
      textoDaAssinatura({ fase: 'lida', frase: 'x', motor: NUVEM_PADRAO, ms: 17_200 }),
    ).toBe('escrito pela nuvem · 17 s');
  });

  it('piso por escolha: escrito sem modelo, instantâneo, sem motivo inventado', () => {
    expect(
      textoDaAssinatura({ fase: 'piso', frase: 'x', causa: 'preferencia', motor: SEM_MODELO, ms: 0 }),
    ).toBe('escrito sem modelo · instantâneo');
  });

  it('piso por falha: o motivo vem primeiro, diz que o texto é do template, e leva o tempo', () => {
    // O texto que a matriz cita é preservado à letra como começo da assinatura; o
    // tempo é o terceiro segmento. Sem ele, duas tentativas falhadas seguidas dariam
    // texto idêntico — e é justamente aqui que o dono mais tenta de novo.
    expect(
      textoDaAssinatura({ fase: 'piso', frase: 'x', causa: 'recusa-do-modelo', motor: NUVEM_PADRAO, ms: 9_000 }),
    ).toBe('a nuvem recusou · escrito sem modelo · 9 s');
    expect(
      textoDaAssinatura({ fase: 'piso', frase: 'x', causa: 'indisponivel', motor: NUVEM_PADRAO, ms: 0 }),
    ).toBe('a nuvem não atendeu · escrito sem modelo · instantâneo');
    expect(
      textoDaAssinatura({ fase: 'piso', frase: 'x', causa: 'reprovada', motor: NUVEM_PADRAO, ms: 12_000 }),
    ).toBe('a nuvem escreveu fora das regras · escrito sem modelo · 12 s');
  });

  it('o texto da matriz é o começo da assinatura, à letra', () => {
    for (const [causa, citado] of [
      ['recusa-do-modelo', 'a nuvem recusou · escrito sem modelo'],
      ['indisponivel', 'a nuvem não atendeu · escrito sem modelo'],
      ['reprovada', 'a nuvem escreveu fora das regras · escrito sem modelo'],
    ] as const) {
      const texto = textoDaAssinatura({ fase: 'piso', frase: 'x', causa, motor: NUVEM_PADRAO, ms: 9_000 }) ?? '';
      expect(texto.startsWith(citado)).toBe(true);
    }
  });

  it('duas falhas seguidas com tempos diferentes dão assinaturas diferentes', () => {
    // É o que substitui o "Reler" que a decisão 7 do dono tirou do cabeçalho.
    const piso = (ms: number) =>
      textoDaAssinatura({ fase: 'piso', frase: 'x', causa: 'transitoria', motor: NUVEM_PADRAO, ms });
    expect(piso(9_000)).not.toBe(piso(21_000));
  });

  it('piso sem frase nenhuma NÃO afirma que o template escreveu', () => {
    // `ausencia` com motivo é piso válido, e aí "escrito sem modelo" é falso: não há
    // texto nenhum na vaga.
    const porFalha = textoDaAssinatura({
      fase: 'piso',
      ausencia: 'Não foi possível escrever esta leitura.',
      causa: 'defeito',
      motor: NUVEM_PADRAO,
      ms: 4_000,
    });
    expect(porFalha).not.toContain('escrito sem modelo');
    expect(porFalha).toContain('defeito');
    expect(porFalha).toContain('4 s');

    const porEscolha = textoDaAssinatura({
      fase: 'piso',
      ausencia: 'nada a dizer',
      causa: 'preferencia',
      motor: SEM_MODELO,
      ms: 0,
    });
    expect(porEscolha).not.toContain('escrito sem modelo');
    expect((porEscolha ?? '').length).toBeGreaterThan(0);
  });

  it('nenhum piso fica sem assinatura, em nenhuma causa — com frase ou sem', () => {
    for (const causa of [...CLASSES_DE_FALHA, ...OUTRAS_CAUSAS, 'preferencia' as Causa]) {
      const comFrase = textoDaAssinatura({ fase: 'piso', frase: 'x', causa, motor: NUVEM_PADRAO, ms: 0 });
      expect((comFrase ?? '').length).toBeGreaterThan(0);
      expect(comFrase).toContain('escrito sem modelo');

      // O ramo da ausência, que o `frase: 'x'` de todo teste acima nunca exercita.
      const semFrase = textoDaAssinatura({ fase: 'piso', ausencia: 'sem texto', causa, motor: NUVEM_PADRAO, ms: 0 });
      expect((semFrase ?? '').length).toBeGreaterThan(0);
      expect(semFrase).not.toContain('escrito sem modelo');
    }
  });
});
