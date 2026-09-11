/**
 * O prompt — pacote de fatos em texto, mais as leis que o texto tem que obedecer.
 * Spec: docs/specs/ia-analitica/spec.md · ADR 0040.
 *
 * Mora no núcleo, e não no adaptador, por dois motivos:
 *
 * 1. **É o que se ajusta.** Prompt muda muito mais que provedor. Deixá-lo aqui o
 *    torna versionado e testável ao lado do pacote; deixá-lo no adaptador o
 *    obrigaria a ser reescrito a cada troca de fornecedor.
 * 2. **É agnóstico.** Nenhuma linha daqui conhece um fornecedor de modelo — a
 *    barreira do `architecture.test.ts` recusa até o nome, inclusive em literal
 *    de string, porque o texto do prompt vaza para o contexto do modelo.
 *
 * O adaptador fica com o que sobra: pegar `{ sistema, usuario }` e mapear para o
 * formato de fio do provedor. É isso que faz a troca custar um arquivo.
 *
 * ## A simetria que sustenta a verificação
 *
 * Os números são renderizados aqui em **pt-BR** — vírgula decimal, ponto de
 * milhar —, por `formatarNumero`, que mora em `format/numero.ts` desde a story
 * 5.2 e é reexportado daqui com o mesmo nome. O `verificar.ts` lê de volta no
 * mesmo formato. Se o modelo lê "40,1 h" e escreve "40,1 h", a conferência casa;
 * se um lado usasse ponto e o outro vírgula, toda frase correta seria reprovada.
 *
 * ## A gramática das bases (versão 3)
 *
 * A mesma simetria vale para as **palavras**. Cada base chega rotulada com a
 * frase exata que `verificar.ts` aceita, e a lei manda copiar o rótulo. Não há
 * exemplo fixo no `SISTEMA`: exemplo envelhece em silêncio quando o período
 * muda de tipo, e o rótulo renderizado não.
 */
import { formatarNumero } from '../format/numero';
import { periodProseLabel } from '../period/bounds';
import type {
  BaseId, PacoteDeFatos, FatoNumero, FatoTendencia, FatoTexto,
} from './pacote';
import { BASE_ROTULO, ressalvasObrigatorias } from './pacote';

/**
 * O mesmo símbolo de `format/numero.ts`, reexportado com o mesmo nome para os
 * testes da conferência (`verificar.test.ts`) seguirem pelo caminho de sempre,
 * sem edição. É também por aqui que o barril o alcança — um caminho público basta.
 */
export { formatarNumero };

// ── A frase de cada base ───────────────────────────────────

type Periodo = PacoteDeFatos['periodo'];

/** A ordem em que as bases aparecem na linha do fato. */
const ORDEM_BASES: readonly BaseId[] = ['B1', 'B2', 'B3'];

/**
 * A frase com que cada base é rotulada na linha do fato — **a mesma que a
 * conferência aceita** (`ia/verificar.ts`, quinta regra).
 *
 * As três formas, num mês de agosto: *"contra julho"* (B1), *"contra agosto do
 * ano passado"* (B2), *"contra o que você costuma fazer em agosto"* (B3). A ida
 * e volta — escrever a frase daqui ao lado do valor que ela rotula e passar em
 * `verificarTexto` — é teste, não leitura.
 *
 * **Nome próprio só em `month` e `year`.** São os dois tipos com forma de prosa
 * enumerável, e são os dois que a conferência sabe ler. *"contra 27/07 – 02/08"*
 * poria no texto dígitos que o pacote não autoriza, e a frase reprovaria na
 * **primeira** regra — a do alfabeto —, não na quinta. Semana e trimestre caem
 * no rótulo genérico, que a conferência aceita pelo vocabulário.
 */
function frasesDasBases(p: Periodo): Readonly<Record<BaseId, string>> {
  const proprio = p.tipo === 'month' || p.tipo === 'year';
  const anterior = proprio ? periodProseLabel(p.tipo, p.rotuloAnterior) : null;
  // O nome do período CORRENTE só entra nas formas de mês: é ele que faz "agosto
  // do ano passado" e "o que você costuma fazer em agosto" lerem como português.
  // Num ano, "o que você costuma fazer em 2025" não é frase.
  const atual = p.tipo === 'month' ? periodProseLabel(p.tipo, p.rotulo) : null;
  return {
    B1: `contra ${anterior ?? BASE_ROTULO.B1}`,
    B2: atual ? `contra ${atual} do ano passado` : `contra ${BASE_ROTULO.B2}`,
    B3: atual
      ? `contra o que você costuma fazer em ${atual}`
      : 'contra o que você costuma fazer neste período',
  };
}

/**
 * O fato, com as bases que têm **valor** — cada uma sob a frase prescrita.
 *
 * ## A regra, geral: nomear base aqui exige o número dela em seguida
 *
 * Nomear uma base é escrever exatamente o que a quinta regra da conferência
 * procura para decidir de quem é o número mais próximo. Um nome de base **sem o
 * número dela logo atrás** fica, na linha, a poucos caracteres do valor de
 * *outra* base — dentro da `JANELA_DECISAO` de 64 — e convida o modelo a
 * reproduzir essa vizinhança na prosa: *"Sem a normal do período, o único
 * contraste é 862"* reprova, porque 862 é B1 e a frase nomeia B3.
 *
 * Por isso as duas formas sem número saem daqui, e as **duas** descem para o
 * bloco do caderno ({@link blocoDeAusencias}):
 *
 * - a base que **não existe** (`existe: false`);
 * - a base que **existe e não foi medida** (`existe: true`, `valor: null`).
 *
 * A iteração 1 desta story tirou só a primeira, e a segunda ficou inline sob a
 * frase prescrita — o nome de B3 a 30 caracteres do valor de B1. Mesma
 * vizinhança, outra porta. A regra é uma só, e agora está escrita como tal.
 *
 * ## Uma base tem UM nome POR REGISTRO
 *
 * A frase prescrita ({@link frasesDasBases}) rotula **número**: é ela que o
 * modelo tem que copiar colada ao valor, e é ela que a conferência aceita. O
 * rótulo genérico ({@link BASE_ROTULO}) nomeia a **base** onde não há número —
 * só no bloco de declarações.
 *
 * **Os dois registros coincidem em `week`, `season` e `all`**, e isso é
 * deliberado: nesses tipos o período não tem nome próprio em prosa, e a frase
 * prescrita *é* o rótulo genérico. A separação de registros é conveniência de
 * leitura, não invariante — o que **é** invariante está acima: nome de base na
 * linha do fato só com o número dela em seguida. Quando as duas coisas
 * coincidem, o par continua correto, porque cada nome segue colado ao próprio
 * valor.
 */
function linhaDeFato(f: FatoNumero, frases: Readonly<Record<BaseId, string>>): string | null {
  if (f.atual == null) return null;
  const u = f.unidade ? ` ${f.unidade}` : '';
  const comparacoes: string[] = [];
  for (const id of ORDEM_BASES) {
    const b = f.bases.find((x) => x.id === id);
    if (!b || !b.existe || b.valor == null) continue;
    let s = `${frases[id]}: ${formatarNumero(b.valor, f.casas)}${u}`;
    if (b.deltaPct != null) s += `, ${formatarNumero(b.deltaPct, 1)}%`;
    comparacoes.push(s);
  }
  const comp = comparacoes.length > 0 ? ` (${comparacoes.join('; ')})` : '';
  return `- ${f.rotulo}: ${formatarNumero(f.atual, f.casas)}${u}${comp}`;
}

/**
 * Como um fato se chama na declaração — o grupo desambigua as três "Distância".
 *
 * `null` quando o nome carrega **dígito**: *"Hábitos ruins · Cerveja 500 ml"*
 * poria o `500`, que não está no alfabeto, a poucos caracteres do vocabulário de
 * base — dentro da seção criada justamente para manter os dois longe um do
 * outro. É a mesma guarda que o `desde` da trajetória já tinha.
 */
function nomeDoFato(f: FatoNumero): string | null {
  const nome = f.grupo ? `${f.grupo} · ${f.rotulo}` : f.rotulo;
  return /\d/.test(nome) ? null : nome;
}

/** `em X, Y` / `em todos os fatos` / `em parte dos fatos` — nunca com dígito. */
function alcance(sem: readonly FatoNumero[], total: number): string {
  if (sem.length === total) return 'em todos os fatos deste caderno';
  const nomes = sem.map(nomeDoFato);
  return nomes.every((n): n is string => n != null)
    ? `em ${nomes.join(', ')}`
    : 'em parte dos fatos deste caderno';
}

/**
 * As comparações **sem número** deste caderno, declaradas uma vez, longe da
 * lista.
 *
 * Ausência é fato: o modelo não pode descobrir sozinho que não há ano anterior —
 * ele tem que ser informado de que não há. O que a Story 1.5 corrigiu foi
 * **onde** isso se diz.
 *
 * As duas formas continuam **distintas** entre si, porque a matriz da spec as
 * distingue: base que não existe é uma coisa, base que existe e não foi medida é
 * outra. O que elas passam a ter em comum é o lugar.
 */
function blocoDeAusencias(p: PacoteDeFatos): string {
  // Só os fatos que a lista mostra. Um fato com `atual` nulo não é renderizado —
  // declarar a base dele aqui falaria de uma linha que o modelo não vê.
  const naLista = p.metricas.filter((f) => f.atual != null);
  if (naLista.length === 0) return '';

  const linhas: string[] = [];
  for (const id of ORDEM_BASES) {
    const daBase = (teste: (b: PacoteDeFatos['metricas'][number]['bases'][number]) => boolean) =>
      naLista.filter((f) => f.bases.some((b) => b.id === id && teste(b)));

    const inexistente = daBase((b) => !b.existe);
    if (inexistente.length > 0) {
      linhas.push(`- sem ${BASE_ROTULO[id]}: não existe ${alcance(inexistente, naLista.length)}.`);
    }
    const semMedida = daBase((b) => b.existe && b.valor == null);
    if (semMedida.length > 0) {
      linhas.push(
        `- ${BASE_ROTULO[id]} existe, mas não foi medida ${alcance(semMedida, naLista.length)}.`,
      );
    }
  }
  if (linhas.length === 0) return '';

  // A linha de fecho é regra da SEÇÃO, e por isso vem depois de uma linha em
  // branco: emendada ao último `- item` por um `\n` só, o Markdown a lê como
  // continuação preguiçosa do item — vira texto de uma das bases, não da seção.
  // "As linhas acima" não serve como fronteira: acima desta seção estão também a
  // lista de fatos e a Cobertura, que TÊM número — e num período sem nome próprio
  // a mesma base aparece nas duas, rotulando o valor dela. A frase nomeia a
  // seção, não uma posição.
  return `#### Comparações sem número neste caderno\n${linhas.join('\n')}\n\n`
    + 'As comparações desta seção não têm número neste caderno. Ao escrever, não\n'
    + 'ponha o nome de nenhuma delas junto de um número de outra comparação.';
}

const DIRECAO: Readonly<Record<FatoTendencia['direcao'], string>> = {
  sobe: 'sobe', cai: 'cai', oscila: 'oscila',
};

/**
 * A trajetória como **direção**, nunca como valor bruto — o único número dela é
 * a contagem de períodos.
 *
 * O `desde` é nome de período, e é por isso que ele passa por um filtro: numa
 * edição de mês *"junho"* é nome próprio que não é o corrente nem o anterior, e
 * a quinta regra o acusa se o modelo o escrever colado num valor de base. Nome
 * de período **com dígito** (`"2024"`, `"27/07 – 02/08"`) não vai ao prompt de
 * jeito nenhum: ele poria no texto um número que o pacote não autoriza, e a
 * frase reprovaria na primeira regra.
 */
function linhaDeTendencia(t: FatoTendencia): string {
  const desde = /\d/.test(t.desde) ? '' : `, desde ${t.desde}`;
  return `- ${t.rotulo}: ${DIRECAO[t.direcao]} — ${t.periodos} períodos seguidos${desde}`;
}

function linhaDeTexto(x: FatoTexto): string {
  return `- ${x.rotulo}: ${x.valor}`;
}

function blocoDeCaderno(p: PacoteDeFatos): string {
  const frases = frasesDasBases(p.periodo);

  // Os fatos sem grupo abrem o caderno; os agrupados vêm sob o próprio nome.
  // O caderno Movimento tem três "Distância" — sem o subtítulo, a lista mente.
  const grupos: string[] = [];
  const vistos = new Set<string>();
  for (const f of p.metricas) {
    const g = f.grupo ?? '';
    if (!vistos.has(g)) { vistos.add(g); grupos.push(g); }
  }

  const partes: string[] = [];
  for (const g of grupos) {
    const linhas = p.metricas
      .filter((f) => (f.grupo ?? '') === g)
      .map((f) => linhaDeFato(f, frases))
      .filter((l): l is string => l != null);
    if (linhas.length === 0) continue;
    partes.push(g ? `#### ${g}\n${linhas.join('\n')}` : linhas.join('\n'));
  }

  if (p.tendencias.length > 0) {
    partes.push(`#### Trajetória\n${p.tendencias.map(linhaDeTendencia).join('\n')}`);
  }
  if (p.textos.length > 0) {
    partes.push(`#### Fatos sem número\n${p.textos.map(linhaDeTexto).join('\n')}`);
  }

  // A Cobertura tem seção PRÓPRIA. Sem ela, a linha caía sob o último `####` do
  // caderno — e se esse fosse "Fatos sem número", a regra 5 proibiria exatamente
  // os dois números que a regra 8 obriga a escrever na ressalva.
  //
  // O texto da linha evita de propósito o vocabulário de B1 ("o período
  // anterior"): estes números não são valor de base nenhuma, e nomeá-los assim
  // poria a preposição da quinta regra colada a um número que ela não julga.
  if (p.cobertura) {
    const c = p.cobertura;
    let s = `#### Cobertura\n- Neste período: ${c.diasComDado} de ${c.diasNoPeriodo} dias.`
      + ` No período comparado: ${c.diasComDadoAnterior} de ${c.diasNoPeriodoAnterior} dias.`;
    if (!c.comparavel) {
      s += `\n  ⚠ COBERTURA DESIGUAL — a comparação deste caderno EXIGE ressalva no texto.`;
    }
    partes.push(s);
  }

  const ausencias = blocoDeAusencias(p);
  if (ausencias) partes.push(ausencias);

  if (partes.length === 0) return '';
  return `\n### ${p.rotulo}\n${partes.join('\n')}`;
}

/**
 * As leis. Escritas como proibição concreta, não como conselho de estilo.
 *
 * ## Quanto de cada uma a conferência realmente cobra
 *
 * A versão anterior deste comentário afirmava que *"cada uma tem um teste
 * correspondente em `verificar.ts`"*. É falso, e afirmação falsa aqui é pior que
 * ausência de afirmação — ela faz quem lê acreditar que o prompt está atrás de
 * uma rede que não existe. O mapa real:
 *
 * | Lei | O que `verificarTexto` cobra |
 * |---|---|
 * | 1 NÚMEROS | tudo — regra 1, comparação numérica exata |
 * | 2 NOMEAR | tudo — regra 5, inclusive a inversão |
 * | 3 COMPARAÇÃO QUE NÃO EXISTE | **em parte**: só pega quando o nome cai perto de um valor de base; declarar a ausência sozinha passa |
 * | 4 TRAJETÓRIA | **nada**. Não há conferência de direção nem do `desde` |
 * | 5 FATOS SEM NÚMERO | o número — regra 1 o recusa, porque `FatoTexto` não entra no alfabeto. A *forma* de citar, não |
 * | 6 CAUSA | tudo — regra 2, lista fechada de termos |
 * | 7 CORRELAÇÕES | tudo — regra 3 |
 * | 8 RESSALVAS | **em parte**: regra 4 procura palavra-chave de cobertura e **nunca compara os dois números** |
 *
 * As leis 3, 4 e 8 são, na parte não coberta, prescrição — e valem por isso: o
 * leitor é uma pessoa só, e ela está disponível.
 *
 * ## Elas falam do TEXTO, não da lista
 *
 * A distinção não é retórica. A lista de fatos põe três nomes de comparação e
 * três números na mesma linha, de propósito — e a conferência a aceitaria, porque
 * cada nome está colado ao número dele. Uma lei escrita como *"nome de comparação
 * não fica perto de número"* proibiria o que o próprio prompt exibe, e o modelo
 * que a lesse ao pé da letra não teria como escrever nada. Por isso cada lei diz
 * de quem ela fala: **o texto que você escreve**.
 *
 * **Ela serve a dois grãos, e um deles é a produção de hoje.** O celular manda
 * os quatro cadernos num texto só até a Story 1.10. Um `SISTEMA` que abrisse com
 * *"você escreve o caderno"*, no singular, descreveria errado exatamente a
 * chamada que está em produção agora. Por isso o escopo do texto sai do
 * **cabeçalho da mensagem do usuário** — que `montarPrompt` e
 * `montarPromptDaEdicao` escrevem diferente — e a lei fica neutra.
 *
 * **E ela não contém vocabulário de base — nenhum, em lugar nenhum do texto.**
 * As três formas prescritas chegam renderizadas na própria linha do fato
 * ({@link frasesDasBases}); um exemplo fixo aqui envelheceria em silêncio no dia
 * em que o período mudasse de tipo, ensinando ao modelo uma frase que a
 * conferência recusa. A varredura que cobra isso é do `SISTEMA` **inteiro**, e
 * não só do parágrafo da regra 2: a versão anterior proibia planilha com o
 * exemplo *"em comparação com o ciclo passado"*, e `'ciclo passado'` é
 * literalmente `B1_GENERICO` — vocabulário de base dentro da lei que jura não
 * ter nenhum, a três seções de distância de onde a asserção olhava.
 */
const SISTEMA = `Você escreve para uma revista pessoal. O CABEÇALHO da mensagem diz o
que escrever — um caderno da revista ou a edição inteira; a lei abaixo é a mesma
nos dois casos.

O registro é de JORNAL: informa, não aconselha. Você relata o que aconteceu no
período. Você não recomenda, não sugere, não motiva e não parabeniza. Nada de
"continue assim", "tente dormir mais", "vale a pena acompanhar de perto",
"parabéns pelo mês" — nem essas frases nem nenhuma variação delas.

VOCABULÁRIO. Nos FATOS abaixo, cada linha traz o valor do período e, entre
parênteses, as comparações dele: cada comparação é um rótulo que começa com
"contra", dois-pontos, e o NÚMERO DE COMPARAÇÃO dela. Os outros números da lista
— o valor do próprio período, os percentuais, a contagem de dias — não são
números de comparação.

As oito regras abaixo falam do TEXTO QUE VOCÊ ESCREVE. Elas não descrevem a
lista de fatos: a lista põe vários rótulos e vários números na mesma linha de
propósito, e isso está certo lá. No seu texto, não.

REGRAS ABSOLUTAS — violar qualquer uma invalida o texto inteiro:

1. NÚMEROS. Só cite números que estão nos FATOS abaixo, exatamente como estão
   escritos lá. Nunca calcule, some, divida ou derive um número novo. Se você
   quer dizer algo que exigiria uma conta, não diga.

2. NOMEAR A COMPARAÇÃO. Ao escrever um número de comparação, COPIE junto dele a
   frase do rótulo que ele tem na lista, como ela está — não invente outra forma
   de dizer a mesma coisa e não use o rótulo de uma comparação para outra. Você
   PODE pôr mais de uma comparação na mesma frase, desde que cada nome fique
   colado ao número dele. O que não pode é escrever o nome de uma comparação
   SEM o número dela numa frase que traz o número de outra: aí os dois se
   encostam e o nome passa a valer para o número errado.

3. COMPARAÇÃO QUE NÃO EXISTE. O pé de cada caderno lista as comparações que não
   têm número — as que não existem e as que existem sem medida. Você pode e deve
   dizer ao leitor que elas faltam. O que não pode é escrever o nome de uma
   delas na mesma frase que um NÚMERO DE COMPARAÇÃO. Junto dos outros números,
   pode: dizer que falta uma comparação e citar o valor do próprio período na
   mesma frase está certo.

4. TRAJETÓRIA. Trajetória é DIREÇÃO, não valor: "cai pelo terceiro período
   seguido". O único número dela é a contagem de períodos — nunca escreva um
   valor para ela. O "desde" nomeia um período que NÃO é uma comparação: no seu
   texto, não o ponha na mesma frase que um NÚMERO DE COMPARAÇÃO.

5. FATOS SEM NÚMERO. O que estiver sob "Fatos sem número" você cita pela IDEIA,
   com suas palavras, e SEM o número que estiver dentro dele — esse número não
   está autorizado e reprova pela regra 1. De uma linha que diga qual fração do
   percurso era pavimentada, escreve-se "a maior parte do percurso era
   pavimentada"; a fração em si não se escreve.

6. CAUSA. Nunca afirme que uma coisa causou outra. Não use "porque", "devido a",
   "por causa de", "graças a", "resultou em", "levou a" ligando duas medidas.
   Você pode dizer que duas coisas aconteceram juntas. Não pode dizer por quê.

7. CORRELAÇÕES. As correlações marcadas como "amostra insuficiente" não podem
   virar manchete nem afirmação. Ignore-as ou diga explicitamente que a amostra
   é pequena.

8. RESSALVAS. Se um caderno estiver marcado com COBERTURA DESIGUAL, o texto TEM
   que dizer isso ao leitor, com os dois números da seção Cobertura, dentro do
   texto.

FORMA:

- A PRIMEIRA FRASE é a manchete: ela vira a capa e o sumário, lida sozinha e
  fora de contexto. Escreva-a curta, inteira em si mesma, e termine-a com ponto.
- Dois ou três parágrafos curtos. Português do Brasil.
- ESCOLHA. Não transcreva a lista. A maioria dos números abaixo não deve aparecer
  no texto — cite só os que sustentam o que você decidiu contar.
- Abra pela observação mais NOTÁVEL, e diga o que a torna notável. Notável não é
  o maior número: é o contraste inesperado, a coisa que se moveu ao contrário do
  que se esperaria, a medida que discorda da outra.
- Datas por extenso ("30 de agosto"), nunca no formato 2026-08-30. Não repita o
  intervalo do período: o leitor sabe que período está lendo.
- A linha "Luz do dia" é CONTEXTO DE ESTAÇÃO: diz se o período teve dias
  curtos ou longos, e serve só para situar o que aconteceu. Nunca a use como
  explicação, nunca a compare com outro período ou outro ano, nunca diga que os
  dias estão crescendo ou encurtando, e nunca a escreva em horas — as horas de
  luz não estão nos FATOS.
- Nada de "registrou", "marcou", "ficou em", "ante", "apresentou variação de".
  Isso é registro de planilha. Escreva como um jornal escreve.`;

/**
 * Sobe a cada mudança que altera o texto que sai — instrução nova, seção nova,
 * regra nova. Vai gravado em cada edição.
 *
 * Existe porque o prompt é a peça que mais muda: sem esta versão, comparar uma
 * edição de agosto escrita hoje com outra escrita daqui a três meses é comparar
 * duas coisas sem saber o que mudou entre elas — e melhorar às cegas.
 *
 * 1 — primeira narração em produção, 06/09/2026.
 * 2 — "escolha, não transcreva"; abre pela mais notável; datas por extenso;
 *     vocabulário de planilha proibido.
 * 3 — a gramática das bases: cada base chega com a frase que a conferência
 *     aceita, a ausência é declarada no pé do caderno, a trajetória sai como
 *     direção, os fatos sem número ganham seção, a Cobertura sai de baixo do
 *     último subtítulo, e a primeira frase vira capa e sumário. O prompt passa
 *     a ser montado por caderno.
 * 4 — a luz do período entra no cabeçalho, uma vez, em palavras (*"dias
 *     curtos"*), sem número e sem vocabulário de base.
 */
export const PROMPT_VERSAO = 4;

/**
 * A linha da luz no cabeçalho — ou nada, quando o período não tem estação.
 *
 * Uma vez por prompt, e não por caderno: a luz é propriedade do período, e
 * repeti-la em cada bloco a faria aparecer quatro vezes na edição e ressuscitar
 * caderno vazio. Em palavras, porque o pacote não carrega as horas — ver
 * `PacoteDeFatos.periodo.luz`.
 */
function linhaDaLuz(periodo: PacoteDeFatos['periodo']): string[] {
  return periodo.luz ? [`Luz do dia: ${periodo.luz}.`] : [];
}

export interface Prompt {
  sistema: string;
  usuario: string;
}

function montar(cabecalho: readonly string[], pacotes: readonly PacoteDeFatos[]): Prompt {
  const partes: string[] = [...cabecalho];

  for (const pacote of pacotes) {
    const bloco = blocoDeCaderno(pacote);
    if (bloco) partes.push(bloco);
  }

  const eventos = pacotes.flatMap((x) => x.eventos);
  if (eventos.length > 0) {
    partes.push(`\n### Eventos\n${eventos.map((e) => `- ${e.dia}: ${e.rotulo}`).join('\n')}`);
  }

  const correlacoes = pacotes.flatMap((x) => x.correlacoes);
  if (correlacoes.length > 0) {
    const linhas = correlacoes.map((c) => {
      const base = `- ${c.rotulo}`;
      if (!c.dentroDoPortao) {
        return `${base}: AMOSTRA INSUFICIENTE (${c.nCom} com, ${c.nSem} sem) — não use como afirmação.`;
      }
      const d = c.deltaPct != null ? `${formatarNumero(c.deltaPct, 1)}%` : 'sem base';
      return `${base}: ${d} (${c.nCom} com, ${c.nSem} sem)`;
    });
    partes.push(`\n### Associações observadas (NUNCA são causa)\n${linhas.join('\n')}`);
  }

  const lacunas = pacotes.flatMap((x) => x.lacunas.map((l) => ({ l, rotulo: x.rotulo })));
  if (lacunas.length > 0) {
    const linhas = lacunas.map(
      ({ l, rotulo }) => `- ${rotulo}: ${l.diasSemDado} dias sem dado${l.motivo ? ` (${l.motivo})` : ''}`,
    );
    partes.push(`\n### Lacunas\n${linhas.join('\n')}`);
  }

  const ressalvas = ressalvasObrigatorias(pacotes);
  if (ressalvas.length > 0) {
    partes.push(
      `\n### Ressalvas obrigatórias\nO texto TEM que declarar a cobertura desigual de: `
      + `${ressalvas.join(', ')}.`,
    );
  }

  return { sistema: SISTEMA, usuario: partes.join('\n') };
}

/**
 * O pacote de **um caderno** → `{ sistema, usuario }`.
 * O `usuario` é o pacote em texto; o `sistema` é a lei. Nenhum dos dois conhece
 * o provedor que vai recebê-los.
 *
 * Este é o grão da frente: é o que a sequência da impressão por caderno (Story
 * 1.10) vai chamar quatro vezes. O escopo — *um caderno* — sai do cabeçalho
 * daqui, e não do `SISTEMA`, que serve aos dois grãos.
 *
 * ## `usuario` vazio significa NÃO GASTE CHAMADA
 *
 * Caderno com `semDado` devolve `usuario: ''`, do mesmo jeito que a edição sem
 * pacote nenhum. É contrato, não descuido: montar cabeçalho e oito leis sobre
 * zero fatos produziria um prompt que só pode ser respondido inventando, e a
 * Story 1.10 chama isto **quatro vezes por edição** — em quatro cadernos vazios
 * seriam quatro chamadas pagas por nada. Quem chama confere o vazio antes de
 * gastar; o núcleo não decide sozinho o que a revista imprime.
 *
 * `semDado` é o vocabulário do próprio pacote, e cobre o caso que importa: um
 * caderno cuja única linha é a lápide tem `textos`, logo `semDado` é falso, logo
 * ele é narrado — a lápide vence o vazio.
 *
 * **Mas `semDado` não é o vazio inteiro**, e por isso ele não decide sozinho.
 * Ele olha `metricas`, `tendencias` e `textos`, e ignora `cobertura`, `lacunas`,
 * `eventos` e `correlacoes` — um caderno de Sono sem uma única métrica pode ter
 * 31 dias de lacuna e uma cobertura **desigual**, que a regra 8 obriga a
 * declarar. Devolver vazio ali calaria uma ressalva obrigatória, e na Story 1.10,
 * onde cada caderno é conferido sozinho, não haveria outro para carregá-la.
 * Mudo é quem não tem nada disso.
 */
export function montarPrompt(p: PacoteDeFatos): Prompt {
  const mudo = p.semDado && p.cobertura == null
    && p.lacunas.length === 0 && p.eventos.length === 0 && p.correlacoes.length === 0;
  if (mudo) return { sistema: SISTEMA, usuario: '' };
  const { periodo } = p;
  return montar([
    `# ${periodo.rotulo}`,
    `Escreva o caderno ${p.rotulo}. Período: ${periodo.inicioISO} a ${periodo.fimISO}`
    + ` (${periodo.diasNoPeriodo} dias).`,
    ...linhaDaLuz(periodo),
  ], [p]);
}

/**
 * Os quatro cadernos num texto só — **transitória, com data de morte**.
 *
 * Existe para o celular continuar narrando uma edição de uma vez até a Story
 * 1.10: narrar quatro vezes hoje quadruplicaria a chamada paga sem haver onde
 * gravar as quatro linhas. Todos os pacotes de uma edição falam do mesmo período
 * — o cabeçalho sai do primeiro.
 */
export function montarPromptDaEdicao(pacotes: readonly PacoteDeFatos[]): Prompt {
  if (pacotes.length === 0) return { sistema: SISTEMA, usuario: '' };
  const { periodo } = pacotes[0];
  return montar([
    `# ${periodo.rotulo}`,
    `Escreva a edição inteira: os cadernos abaixo, num texto só.`
    + ` Período: ${periodo.inicioISO} a ${periodo.fimISO} (${periodo.diasNoPeriodo} dias).`,
    ...linhaDaLuz(periodo),
  ], pacotes);
}
