/**
 * As regras puras da **folha de escolha** e da **ficha do modelo** (fatia 3).
 *
 * Elas moram aqui, e não num teste de tela, porque são puras: um teste de tela custaria
 * mock do supabase e da ponte para cobrir agrupamento, escolha de palavra e aritmética de
 * tamanho. E são justamente essas que erram calado — a folha que oferece uma lápide como
 * se fosse alternativa, o total que soma o que ninguém mediu, o carimbo que promete ao lado
 * de "não compilado".
 */
import { describe, it, expect } from '@jest/globals';
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  descritorDaRetrospectiva,
  descritorDaSaudeDoSono,
  descritorDoNomeDeRota,
  descritorDoNomeDeRotaPt,
  type Descritor,
  type MotorId,
} from '@vitale/shared';
import { lerCarimbosDoCru, type CarimboDaCompilacao } from '../motores/carimbo';
import {
  APAGAR_INDISPONIVEL,
  A_NUVEM_EXPOE,
  DETALHE_DO_SEM_MODELO,
  NADA_SAI,
  agruparPorOndeRoda,
  colunasDoAtalho,
  componentesEmTexto,
  dataCurta,
  detalheDaOpcao,
  duracaoEmTexto,
  emGB,
  escreveHojeEmTexto,
  estadoDaCompilacaoEmPalavras,
  foraPorPadrao,
  grupoDoMotor,
  janelaDoModelo,
  linhaDoCarimbo,
  notaDeApagarOCompilado,
  ocupacaoDoModelo,
  ofereceCompilar,
  quantoLevaCompilar,
  rotuloDoAtalho,
  semModeloEhLapide,
  subtituloDaFolha,
  trocaDeMotorSumido,
} from '../motores/folha-regras';
import {
  PESOS_ABERTOS,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type MotorConhecido,
  type PesoAberto,
} from '../motores/catalogo';

const PESO = PESOS_ABERTOS[0]!;

function motor(id: MotorId, extra: Partial<MotorConhecido> = {}): MotorConhecido {
  return { id, nome: `o ${id}`, rotulo: id, descricao: '', disponivel: true, ...extra };
}

function compilacaoLida(compilacao: Extract<EstadoDaCompilacao, { tipo: 'lido' }>['compilacao']): EstadoDaCompilacao {
  return { tipo: 'lido', compilacao };
}

const COMPILADO = { [PESO.pesos]: compilacaoLida({ estado: 'compilado', componentes: 3, compilados: 3 }) };
const NAO_COMPILADO = { [PESO.pesos]: compilacaoLida({ estado: 'nao-compilado', componentes: 3, compilados: 0 }) };

/* ── os três grupos ──────────────────────────────────────────────────────── */

describe('a folha agrupa por onde o motor roda', () => {
  it('põe cada tipo no seu grupo, e a exposição cresce na ordem', () => {
    expect(grupoDoMotor(SEM_MODELO)).toBe('sem-modelo');
    expect(grupoDoMotor(APARELHO_SISTEMA)).toBe('no-aparelho');
    expect(grupoDoMotor(PESO.id)).toBe('no-aparelho');
    expect(grupoDoMotor(NUVEM_PADRAO)).toBe('fora-do-aparelho');
  });

  it('um id que não se lê cai no grupo de MAIOR exposição, nunca no mais inocente', () => {
    // Supor o contrário faria a folha prometer que um motor desconhecido não sai do
    // telefone — a única afirmação desta tela que ela não tem como sustentar.
    expect(grupoDoMotor('isto-não-é-um-id' as MotorId)).toBe('fora-do-aparelho');
  });

  it('não desenha cabeçalho de grupo vazio', () => {
    // Num build sem pesos abertos e sem ponte, "No aparelho" seria um cabeçalho sobre nada.
    const grupos = agruparPorOndeRoda([motor(SEM_MODELO), motor(NUVEM_PADRAO)]);
    expect(grupos.map((g) => g.grupo)).toEqual(['sem-modelo', 'fora-do-aparelho']);
  });

  it('mantém a ordem do catálogo dentro do grupo', () => {
    const grupos = agruparPorOndeRoda([motor(APARELHO_SISTEMA), motor(PESO.id)]);
    expect(grupos[0]!.motores.map((m) => m.id)).toEqual([APARELHO_SISTEMA, PESO.id]);
  });
});

/* ── o cabeçalho, e a lápide ─────────────────────────────────────────────── */

describe('o cabeçalho da folha', () => {
  it('a leitura que não grava aceita qualquer motor, e o diz', () => {
    expect(subtituloDaFolha(false)).toContain('não grava nada');
  });

  it('a leitura que grava avisa que o que fica gravado não se desfaz', () => {
    expect(subtituloDaFolha({ admite: ['nuvem'], recusaEResultado: false })).toContain('grava no banco');
  });
});

/**
 * A tabela autorada × o que o `semModelo` de cada descritor devolve.
 *
 * `DETALHE_DO_SEM_MODELO` é escrita à mão porque `semModelo` é uma das cinco funções que só
 * o orquestrador percorre, e a barreira do `architecture.test.ts` está em zero fora dele.
 * Este arquivo é teste, pode chamar, e é o único lugar do app onde a tabela e o descritor
 * se olham. Sem isto, a folha ofereceria uma lápide com a frase neutra — apresentando como
 * alternativa equivalente o que o código declara como ausência.
 */
describe('o que "Sem modelo" diz em cada leitura', () => {
  it('nas três leituras sem template, a opção escreve a LÁPIDE do descritor, palavra por palavra', () => {
    for (const d of [descritorDaRetrospectiva, descritorDoNomeDeRota, descritorDoNomeDeRotaPt]) {
      const piso = (d as Descritor<unknown, unknown>).semModelo({});
      expect('ausencia' in piso).toBe(true);
      expect(semModeloEhLapide(d.recurso)).toBe(true);
      expect(DETALHE_DO_SEM_MODELO[d.recurso]).toBe('ausencia' in piso ? piso.ausencia : null);
    }
  });

  it('as duas frentes do nome dizem a MESMA lápide — elas dividem o corpo do descritor', () => {
    // Uma redação própria para o português faria a tabela afirmar algo que o
    // `semModelo` não diz, e é a tabela que a folha mostra.
    expect(DETALHE_DO_SEM_MODELO['nome-de-rota-pt']).toBe(DETALHE_DO_SEM_MODELO['nome-de-rota']);
  });

  it('na Saúde do sono ela é um caminho, e a linha é a neutra — não a frase do template', () => {
    expect(semModeloEhLapide(descritorDaSaudeDoSono.recurso)).toBe(false);
    expect(DETALHE_DO_SEM_MODELO['saude-do-sono']).toBe('instantâneo · sempre igual · nada sai daqui');
  });
});

/* ── a preferência que aponta para um motor que sumiu ────────────────────── */

describe('a preferência que aponta para um motor que sumiu', () => {
  const conhecidos = [motor(SEM_MODELO), motor(NUVEM_PADRAO)];

  it('diz a troca em palavras, COM o id — que é o único traço do que ele escolhera', () => {
    const frase = trocaDeMotorSumido({
      escolhido: PESO.id,
      efetivo: NUVEM_PADRAO,
      conhecidos,
    });
    expect(frase).toContain(PESO.id);
    expect(frase).toContain('não está neste build');
    expect(frase).toContain(NUVEM_PADRAO);
  });

  it('cala quando não há preferência', () => {
    expect(trocaDeMotorSumido({ escolhido: null, efetivo: NUVEM_PADRAO, conhecidos })).toBeNull();
  });

  it('cala quando o catálogo conhece o motor — aí a opção aparece, e a explicação é outra', () => {
    // Bloqueado pelo regime, por exemplo: a opção fica na folha com o motivo escrito, e uma
    // segunda explicação no cabeçalho contaria a mesma coisa duas vezes, errado.
    expect(trocaDeMotorSumido({ escolhido: NUVEM_PADRAO, efetivo: SEM_MODELO, conhecidos })).toBeNull();
  });
});

/* ── o detalhe de uma opção ──────────────────────────────────────────────── */

describe('o detalhe de uma opção declara o que sai do aparelho', () => {
  it('a nuvem é específica: os números DESTA leitura, não "seus dados"', () => {
    expect(detalheDaOpcao(motor(NUVEM_PADRAO), 'saude-do-sono', {})).toBe(A_NUVEM_EXPOE);
  });

  it('o modelo do sistema junta o detalhe do diagnóstico ao que não sai daqui', () => {
    const m = motor(APARELHO_SISTEMA, { detalhe: 'AFM 3 Core Advanced · janela de 8.192 tokens' });
    expect(detalheDaOpcao(m, 'saude-do-sono', {})).toBe(
      `AFM 3 Core Advanced · janela de 8.192 tokens · ${NADA_SAI}`,
    );
  });

  it('sem diagnóstico, o aparelho diz só o que não sai — e não um detalhe inventado', () => {
    expect(detalheDaOpcao(motor(APARELHO_SISTEMA), 'saude-do-sono', {})).toBe(NADA_SAI);
  });

  it('o peso aberto leva o estado da compilação, com o tamanho medido', () => {
    expect(detalheDaOpcao(motor(PESO.id), 'saude-do-sono', COMPILADO)).toBe(`compilado · 2,64 GB · ${NADA_SAI}`);
    expect(detalheDaOpcao(motor(PESO.id), 'saude-do-sono', NAO_COMPILADO)).toBe(
      `instalado, não compilado · 1,3 GB · ${NADA_SAI}`,
    );
  });

  it('"Sem modelo" é a lápide da leitura, e não a frase neutra', () => {
    expect(detalheDaOpcao(motor(SEM_MODELO), 'retrospectiva', {})).toBe('a revista não imprime sem modelo');
  });
});

describe('a pílula Compilar só aparece onde há o que compilar', () => {
  it('não aparece no compilado — recompilar cobraria minutos por um toque que não muda nada', () => {
    expect(ofereceCompilar(PESO.id, COMPILADO)).toBe(false);
  });

  it('aparece no instalado e não compilado', () => {
    expect(ofereceCompilar(PESO.id, NAO_COMPILADO)).toBe(true);
  });

  it('NÃO aparece em "não sei" — "não" e "não sei" são respostas diferentes', () => {
    // Sem resposta da ponte (build sem o módulo, simulador), oferecer o ato seria oferecê-lo
    // para um modelo que este build talvez nem traga.
    expect(ofereceCompilar(PESO.id, {})).toBe(false);
  });

  it('não aparece para quem não é peso aberto', () => {
    expect(ofereceCompilar(NUVEM_PADRAO, NAO_COMPILADO)).toBe(false);
  });
});

/* ── o atalho para Comparar ──────────────────────────────────────────────── */

describe('o atalho do pé da folha', () => {
  const catalogo = [motor(SEM_MODELO), motor(APARELHO_SISTEMA), motor(PESO.id), motor(NUVEM_PADRAO)];

  it('os pesos abertos nascem FORA, e por isso não entram na conta', () => {
    // Decisão do dono, 23/09: um atalho que os marcasse faria o dono disparar vários
    // minutos de medição sem ter ligado nada.
    expect(foraPorPadrao().has(PESO.id)).toBe(true);
    expect(
      colunasDoAtalho(catalogo, { regimeMaximo: 'nuvem', recurso: 'saude-do-sono', compilacao: COMPILADO }),
    ).toBe(3); // aparelho + nuvem + a régua
  });

  it('sem régua a conta cai um: o template não vira coluna onde não há template', () => {
    expect(
      colunasDoAtalho(catalogo, { regimeMaximo: 'nuvem', recurso: 'nome-de-rota', compilacao: COMPILADO }),
    ).toBe(2);
  });

  it('um motor indisponível não conta como coluna que vai aparecer', () => {
    const semAparelho = [
      motor(SEM_MODELO),
      motor(APARELHO_SISTEMA, { disponivel: false, motivo: 'a Apple Intelligence está desligada nos Ajustes' }),
      motor(NUVEM_PADRAO),
    ];
    expect(
      colunasDoAtalho(semAparelho, { regimeMaximo: 'nuvem', recurso: 'saude-do-sono', compilacao: {} }),
    ).toBe(2); // nuvem + a régua
  });

  it('zero não vira "Comparar os 0"', () => {
    expect(rotuloDoAtalho(0)).toBe('Comparar nesta leitura');
    expect(rotuloDoAtalho(3)).toBe('Comparar os 3 nesta leitura');
  });
});

/* ── o tamanho, e a ausência dele ────────────────────────────────────────── */

describe('o tamanho só existe onde houve medida', () => {
  it('escreve com vírgula decimal e sem zero à toa', () => {
    expect(emGB(1.3)).toBe('1,3 GB');
    expect(emGB(1.34)).toBe('1,34 GB');
    expect(emGB(2)).toBe('2 GB');
  });

  it('o compilado soma as duas partes; o não compilado mostra só o arquivo', () => {
    expect(estadoDaCompilacaoEmPalavras({ tipo: 'compilado' }, PESO)).toBe('compilado · 2,64 GB');
    expect(estadoDaCompilacaoEmPalavras({ tipo: 'nao-compilado' }, PESO)).toBe('instalado, não compilado · 1,3 GB');
  });

  it('um modelo sem medida diz "tamanho não medido" em vez de somar zero', () => {
    const novo: PesoAberto = { ...PESO, tamanho: undefined };
    expect(estadoDaCompilacaoEmPalavras({ tipo: 'compilado' }, novo)).toBe('compilado · tamanho não medido');
    expect(ocupacaoDoModelo(novo, { tipo: 'compilado' })).toEqual({
      tipo: 'sem-medida',
      frase: expect.stringContaining('não medido') as unknown as string,
    });
  });

  it('"não sei" continua sendo o motivo, e nunca vira "não compilado"', () => {
    expect(estadoDaCompilacaoEmPalavras({ tipo: 'nao-sabido', motivo: 'o simulador não tem o Core AI' }, PESO)).toBe(
      'o simulador não tem o Core AI',
    );
  });

  it('a barra de duas partes só existe quando as duas partes existem', () => {
    // Desenhá-la para um modelo não compilado prometeria um pedaço de disco que não está lá.
    expect(ocupacaoDoModelo(PESO, { tipo: 'nao-compilado' })).toEqual({
      tipo: 'so-instalado',
      total: '1,3 GB',
      instalado: '1,3 GB',
    });
    const duas = ocupacaoDoModelo(PESO, { tipo: 'compilado' });
    expect(duas.tipo).toBe('duas-partes');
    if (duas.tipo === 'duas-partes') {
      expect(duas.total).toBe('2,64 GB');
      expect(duas.compilado).toBe('1,34 GB');
      expect(duas.fracaoInstalado).toBeCloseTo(1.3 / 2.64, 5);
    }
  });

  it('compilado sem a segunda medida declara o que ficou de fora do total', () => {
    const meio: PesoAberto = { ...PESO, tamanho: { instaladoGB: 1.1 } };
    const o = ocupacaoDoModelo(meio, { tipo: 'compilado' });
    expect(o.tipo).toBe('so-instalado');
    if (o.tipo === 'so-instalado') expect(o.semMedida).toContain('fica fora do total');
  });
});

describe('os componentes da pasta', () => {
  it('diz quantos de quantos, quando a ponte devolveu os dois números', () => {
    expect(componentesEmTexto(COMPILADO[PESO.pesos]!)).toBe('3 de 3 componentes compilados');
  });

  it('cala quando a ponte não devolveu — nada é inferido', () => {
    expect(componentesEmTexto(compilacaoLida({ estado: 'compilado' }))).toBeUndefined();
    expect(componentesEmTexto({ tipo: 'ausente' })).toBeUndefined();
  });
});

/* ── o carimbo, e a contradição ──────────────────────────────────────────── */

describe('o carimbo é lembrança, e é lido contra o estado', () => {
  const AGORA = new Date(2026, 8, 23, 10, 0).getTime();
  const carimbo: CarimboDaCompilacao = { em: new Date(2026, 8, 22, 21, 0).getTime(), ms: 15 * 60_000 };

  it('sem carimbo, não há linha — e nenhum número é inventado', () => {
    expect(linhaDoCarimbo(undefined, { tipo: 'compilado' }, AGORA)).toEqual({ tipo: 'ausente' });
  });

  it('com o modelo compilado, ele diz quando foi e quanto levou', () => {
    expect(linhaDoCarimbo(carimbo, { tipo: 'compilado' }, AGORA)).toEqual({
      tipo: 'carimbo',
      rotulo: 'Compilado em 22/09, levou',
      valor: '15 min',
    });
  });

  it('com o modelo NÃO compilado, ele vira contradição explicada — nunca some calado', () => {
    // É a guarda inteira: um "compilado em 22/09" ao lado de "instalado, não compilado"
    // faria o dono achar que o app se desfez. O cache é por build do iOS.
    const l = linhaDoCarimbo(carimbo, { tipo: 'nao-compilado' }, AGORA);
    expect(l.tipo).toBe('contradicao');
    if (l.tipo === 'contradicao') {
      expect(l.frase).toContain('22/09');
      expect(l.frase).toContain('build do iOS');
    }
  });

  it('em "não sei" o carimbo não aparece: afirmar a contradição seria tão inventado quanto a lembrança', () => {
    expect(linhaDoCarimbo(carimbo, { tipo: 'nao-sabido', motivo: 'x' }, AGORA)).toEqual({ tipo: 'ausente' });
  });

  it('a data ganha o ano quando ele não é o de hoje', () => {
    expect(dataCurta(new Date(2025, 0, 5).getTime(), AGORA)).toBe('05/01/2025');
    expect(dataCurta(new Date(2026, 0, 5).getTime(), AGORA)).toBe('05/01');
  });

  it('a duração vira minutos onde eles fazem sentido, e segundos abaixo', () => {
    expect(duracaoEmTexto(15 * 60_000)).toBe('15 min');
    expect(duracaoEmTexto(42_000)).toBe('42 s');
  });

  it('sem uma compilação feita AQUI, não há estimativa — só "leva minutos"', () => {
    // Nenhum número publicado é confiável, e o tamanho do arquivo não prediz o tempo.
    expect(quantoLevaCompilar(undefined)).toBe('leva minutos');
    expect(quantoLevaCompilar(carimbo)).toBe('da última vez levou 15 min');
  });
});

describe('os carimbos lidos do disco', () => {
  it('descartam entrada que não se lê, e não apagam o resto', () => {
    expect(
      lerCarimbosDoCru({
        bom: { em: 1, ms: 10 },
        semMs: { em: 1 },
        msTexto: { em: 1, ms: '10' },
        emZero: { em: 0, ms: 10 },
        msNegativo: { em: 1, ms: -1 },
        naoObjeto: 7,
      }),
    ).toEqual({ bom: { em: 1, ms: 10 } });
  });

  it('um mapa que não é mapa devolve vazio, e nunca lança', () => {
    expect(lerCarimbosDoCru(null)).toEqual({});
    expect(lerCarimbosDoCru([1, 2])).toEqual({});
    expect(lerCarimbosDoCru('nada')).toEqual({});
  });
});

/* ── onde ele escreve, e o pé da ficha ───────────────────────────────────── */

describe('onde este modelo escreve hoje', () => {
  it('o nome quando é uma', () => {
    expect(escreveHojeEmTexto(['Saúde do sono'], 3)).toEqual({
      titulo: 'Saúde do sono',
      medida: '1 de 3 leituras',
    });
  });

  it('a contagem quando é mais de uma — duas na mesma linha a fariam quebrar', () => {
    expect(escreveHojeEmTexto(['Saúde do sono', 'Retrospectiva'], 3)).toEqual({
      titulo: '2 de 3 leituras',
      medida: null,
    });
  });

  it('zero é resposta legítima, e é ela que torna apagar o compilado uma decisão fácil', () => {
    expect(escreveHojeEmTexto([], 3)).toEqual({ titulo: 'Não escreve nenhuma leitura hoje', medida: null });
  });
});

describe('a nota de apagar o compilado', () => {
  const ocupacao = ocupacaoDoModelo(PESO, { tipo: 'compilado' });

  it('promete o COMPILADO, nunca o total — o modelo veio dentro do app e não sai', () => {
    const nota = notaDeApagarOCompilado({ ocupacao, carimbo: undefined, leituras: [] });
    expect(nota).toContain('1,34 GB');
    expect(nota).not.toContain('2,64 GB');
    expect(nota).toContain('veio dentro dele');
  });

  it('nomeia a leitura que escreve com ele, e oferece trocar antes', () => {
    const nota = notaDeApagarOCompilado({ ocupacao, carimbo: undefined, leituras: ['Saúde do sono'] });
    expect(nota).toContain('Saúde do sono escreve com ele');
    expect(nota).toContain('troque antes');
  });

  it('declara a ação como indisponível, com o motivo — botão que não cumpre é pior que ausente', () => {
    expect(notaDeApagarOCompilado({ ocupacao, carimbo: undefined, leituras: [] })).toContain(APAGAR_INDISPONIVEL);
  });

  it('o preço de refazer sai do carimbo, e é "minutos" quando não houve carimbo', () => {
    expect(notaDeApagarOCompilado({ ocupacao, carimbo: undefined, leituras: [] })).toContain('leva minutos');
    expect(
      notaDeApagarOCompilado({ ocupacao, carimbo: { em: 1, ms: 11 * 60_000 }, leituras: [] }),
    ).toContain('da última vez levou 11 min');
  });
});

/* ── a janela ────────────────────────────────────────────────────────────── */

describe('a janela do modelo vem do diagnóstico, e de mais lugar nenhum', () => {
  const lido = (diagnostico: Extract<EstadoDaPonte, { tipo: 'lido' }>['diagnostico']): EstadoDaPonte => ({
    tipo: 'lido',
    diagnostico,
  });

  it('formata o milhar como a tela o escreve', () => {
    expect(janelaDoModelo(lido({ estado: 'disponivel', janela: 4096 }))).toBe('4.096 tokens');
  });

  it('cala quando o diagnóstico não a traz — a ficha fica sem a linha, não com um número inventado', () => {
    expect(janelaDoModelo(lido({ estado: 'disponivel' }))).toBeUndefined();
    expect(janelaDoModelo(lido({ estado: 'indisponivel', motivo: 'semPesos' }))).toBeUndefined();
    expect(janelaDoModelo({ tipo: 'ausente' })).toBeUndefined();
  });
});
