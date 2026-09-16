/**
 * A sequência da impressão — a edição inteira, montada, lida, conferida e gravada
 * numa ordem só (Story 1.10, AD-13 dos motores).
 *
 * **Fora do barril e fora da porta de IA, de propósito.** `imprimirCom` recebe o
 * descritor, e um descritor com `conferir` trocado gravaria texto não conferido.
 * Quem imprime chama `imprimir` (`ia/imprimir.ts`), que fixa o descritor da
 * retrospectiva; `imprimirCom` existe para os testes do núcleo exercitarem o
 * caminho com descritores embrulhados. A guarda (7) do `architecture.test.ts`
 * reprova um app que a importe por caminho profundo.
 *
 * **Cliente do orquestrador, e só dele.** A sequência não recebe cliente de banco
 * nem chama `Motor`: ela monta os pacotes, ordena os cadernos, pergunta ao
 * hospedeiro o que já está impresso (`buscar`), chama `ler` uma vez por caderno, e
 * entrega o **conjunto** à porta `gravar`. Pedido, recuo, conferência e piso são
 * do orquestrador e do descritor. A ordem "confere, depois grava" deixa de ser
 * comentário: a única linha que chega a `gravar` é `LeituraDoMotor`, e ela só
 * existe quando a conferência aprovou.
 *
 * **Mostrar é progressivo, gravar é atômico.** Cada caderno avisa o hospedeiro
 * quando começa e quando termina (`aoComecar`, `aoLer`), e `gravar` roda **no
 * máximo uma vez**, depois do laço, com a ordem e as linhas da edição inteira.
 * Gravar caderno a caderno daria posição 1, depois 1 e 2 — a ordem de um conjunto
 * ainda em crescimento —, e é o caminho natural de quem implementa. Um teste
 * reprova a segunda chamada, e uma barreira do `architecture.test.ts` reprova
 * `.gravar` lido fora deste arquivo.
 *
 * **Imprimir nunca apaga texto publicado por falha de motor.** A função do banco
 * apaga o caderno que sai da ordem; por isso a ordem nasce do que **já está
 * impresso** (`buscar`) e não só do que escreveu agora. Um caderno já impresso
 * que cai no piso — um `transitoria` de rede, uma reprovação — continua na ordem,
 * com o texto de antes. Só sai o caderno **pedido** que ficou vazio (ou mudo), e
 * só quando há o que gravar: sem gravação, nada é apagado.
 *
 * **A versão da agregação não passa por aqui.** Ela não existe no tipo da porta:
 * quem a carimba é `data/edicoes-ia.ts`, a partir de `AGG_VERSION`, no ponto de
 * gravação. O prompt e o pacote gravados saem da `versaoDoDescritor` que o
 * orquestrador carimbou na resposta (`versoesDaRetrospectiva`), e a métrica líder
 * sai de `liderDoCaderno`, uma vez, aqui.
 *
 * Não importa `data/`: o fecho do núcleo de IA recusa o pacote do SDK do banco, e
 * as duas portas chegam prontas do hospedeiro (`portasDaEdicao`).
 */
import { CADERNO_IDS, type CadernoId } from '../period/cadernos';
import type {
  DesfechoDoCaderno,
  DesfechoNaImpressao,
  LinhaDaImpressao,
  OpcoesDaImpressao,
  PeriodoDaEdicao,
  PortasDaImpressao,
  ResultadoDaImpressao,
} from './imprimir';
import { CONCLUSAO } from './motor';
import { ler, type Descritor, type LeituraDoMotor, type LeituraDoPiso } from './orquestrar';
import { montarPacotes, type EntradaPacote, type PacoteDeFatos } from './pacote';
import { liderDoCaderno, ordenarCadernos } from './ranqueamento';
import { versoesDaRetrospectiva } from './retrospectiva';

/** Chama um aviso do hospedeiro sem deixar que ele derrube a impressão. */
function avisar(aviso: () => unknown): void {
  try {
    const r = aviso();
    if (r && typeof (r as PromiseLike<unknown>).then === 'function') {
      (r as Promise<unknown>).then(undefined, () => undefined);
    }
  } catch {
    // O aviso é do hospedeiro; a impressão segue.
  }
}

/**
 * A entrada com a cobertura de noites do Sono.
 *
 * `EntradaPacote.coberturaSono` é opcional desde a 1.4, e o celular nunca a
 * passou — com ela nula, a perna de cobertura do portão e a ressalva de noites
 * ficam sem efeito. Quem monta a entrada da impressão é esta sequência, então ela
 * a deriva de `resumo.sleep` quando a entrada não a traz. Sem `resumo.sleep` não
 * há de onde contar noites, e a cobertura continua ausente — nunca inventada.
 */
function comCoberturaDoSono(entrada: EntradaPacote): EntradaPacote {
  if (entrada.coberturaSono !== undefined) return entrada;
  const sono = entrada.resumo.sleep;
  if (sono == null) return entrada;
  return { ...entrada, coberturaSono: { noites: sono.cur.nights, noitesAnterior: sono.prev?.nights ?? 0 } };
}

/** Os tokens são medida inteira e não negativa — ou não são medida. */
function tokensDe(l: LeituraDoMotor<string>): { entrada: number; saida: number } | null {
  const t = l.resposta.tokens;
  if (!t) return null;
  const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  return ok(t.entrada) && ok(t.saida) ? { entrada: t.entrada, saida: t.saida } : null;
}

function desfechoDe(l: LeituraDoMotor<string> | LeituraDoPiso): DesfechoDoCaderno {
  if (l.origem === 'piso') return { tipo: 'nao-escrito', leitura: l };
  return tokensDe(l) === null ? { tipo: 'incompleto', leitura: l, falta: 'tokens' } : { tipo: 'escrito', leitura: l };
}

/** A posição de um caderno no catálogo — a ordem de quem ficou fora do ranqueamento. */
function peloCatalogo(a: CadernoId, b: CadernoId): number {
  return CADERNO_IDS.indexOf(a) - CADERNO_IDS.indexOf(b);
}

/**
 * Imprime a edição de um período fechado, com o descritor dado.
 *
 * **Tudo o que se valida sem gastar é validado antes de `buscar` e de qualquer
 * `ler`**, para o mesmo argumento errado dar o mesmo desfecho a qualquer hora do
 * relógio e nunca depois das chamadas pagas. Rejeita, e nenhum caso é falha de
 * motor:
 *
 * 1. `cadernos` vazio — `TypeError`, antes até de olhar o período (ausente é "os
 *    quatro"; vazia é chamada errada);
 * 2. a versão do descritor não se decodifica em prompt e pacote — `RangeError`;
 * 3. uma função pura da montagem ou do ranqueamento lança (lápide inválida,
 *    caderno repetido) — antes de `buscar`;
 * 4. `buscar` lança — antes de qualquer chamada paga;
 * 5. uma função do descritor lança durante um `ler` (bug de código puro, que o
 *    orquestrador relança depois de registrar no anel) — as chamadas dos cadernos
 *    anteriores já foram pagas, e nada é gravado;
 * 6. `gravar` lança — depois de todas as chamadas; os textos já mostrados se
 *    perdem, e a nova tentativa paga de novo (custo declarado).
 *
 * Exceção de aviso (`aoComecar`, `aoLer`) não rejeita: é engolida.
 */
export async function imprimirCom<E>(
  descritor: Descritor<PacoteDeFatos, string>,
  entrada: EntradaPacote,
  portas: PortasDaImpressao<E>,
  opcoes: OpcoesDaImpressao,
): Promise<ResultadoDaImpressao<E>> {
  if (opcoes.cadernos !== undefined && opcoes.cadernos.length === 0) {
    throw new TypeError('imprimir com a lista de cadernos vazia — ausente é "os quatro"; vazia é chamada errada');
  }
  // A assinatura vira colunas no fim; se a versão não se decodifica, isso se sabe
  // agora, e não depois de pagar pelos cadernos.
  versoesDaRetrospectiva(descritor.versao);

  const { resumo } = entrada;
  const pacotes = montarPacotes(comCoberturaDoSono(entrada));

  // `fechado` é o `periodoFechado` do resumo, carimbado nos quatro pacotes; `all`
  // nunca fecha. O teste do tipo é o que estreita `kind` para a chave da tabela.
  if (resumo.kind === 'all' || !pacotes.every((p) => p.periodo.fechado)) return { estado: 'aberto' };

  const pedidos = new Set<CadernoId>(opcoes.cadernos ?? CADERNO_IDS);
  const ranqueados = ordenarCadernos(pacotes);
  const fila = ranqueados.filter((c) => pedidos.has(c));
  if (fila.length === 0) return { estado: 'sem-caderno' };

  const periodo: PeriodoDaEdicao = { tipoPeriodo: resumo.kind, inicio: resumo.startISO, fim: resumo.endISO };
  const existentes = new Set((await portas.buscar(periodo)).map((l) => l.caderno));

  const pacoteDe = new Map(pacotes.map((p) => [p.caderno, p] as const));
  const desfechos: DesfechoNaImpressao[] = [];
  for (const caderno of fila) {
    avisar(() => opcoes.aoComecar?.(caderno, fila));
    const leitura = await ler(descritor, pacoteDe.get(caderno)!, {
      modo: 'produto',
      cadeia: opcoes.cadeia,
      motorPara: opcoes.motorPara,
      registrar: opcoes.registrar,
      agora: opcoes.agora,
    });
    const desfecho = desfechoDe(leitura);
    desfechos.push({ caderno, desfecho });
    avisar(() => opcoes.aoLer?.(caderno, desfecho));
  }

  // A ordem que a edição passa a ter:
  //   ranqueados ∩ (escritos ∪ mantidos) ++ (mantidos fora do ranqueamento, pelo catálogo)
  //   mantidos = existentes − (pedidos que ficaram vazios ou mudos)
  const escritos = new Set(desfechos.filter((d) => d.desfecho.tipo === 'escrito').map((d) => d.caderno));
  const mudos = new Set(
    desfechos
      .filter((d) => d.desfecho.tipo === 'nao-escrito' && d.desfecho.leitura.causa === 'mudo')
      .map((d) => d.caderno),
  );
  const saem = (c: CadernoId) => pedidos.has(c) && (!ranqueados.includes(c) || mudos.has(c));
  const mantidos = [...existentes].filter((c) => !saem(c));
  const ordem = [
    ...ranqueados.filter((c) => escritos.has(c) || mantidos.includes(c)),
    ...mantidos.filter((c) => !ranqueados.includes(c)).sort(peloCatalogo),
  ];

  const linhas: LinhaDaImpressao[] = [];
  for (const caderno of ordem) {
    const d = desfechos.find((x) => x.caderno === caderno)?.desfecho;
    if (d?.tipo !== 'escrito') continue;
    const { leitura } = d;
    const tokens = tokensDe(leitura)!;
    // O orquestrador carimba a versão do descritor que montou o pedido — a mesma
    // que foi decodificada no início, e por isso esta não lança aqui.
    const versoes = versoesDaRetrospectiva(leitura.resposta.assinatura.versaoDoDescritor);
    linhas.push({
      caderno,
      texto: leitura.frase,
      provedor: leitura.resposta.assinatura.provedor,
      modelo: leitura.resposta.assinatura.modelo,
      promptVersao: versoes.prompt,
      pacoteVersao: versoes.pacote,
      motivoDeParada: CONCLUSAO,
      tokensEntrada: tokens.entrada,
      tokensSaida: tokens.saida,
      metricaLider: liderDoCaderno(pacoteDe.get(caderno)!)?.chave ?? null,
    });
  }

  if (linhas.length === 0) return { estado: 'nada-gravado', desfechos };
  const edicao = await portas.gravar({ ...periodo, ordem, linhas });
  return { estado: 'gravada', edicao, desfechos };
}
