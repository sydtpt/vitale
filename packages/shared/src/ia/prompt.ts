/**
 * O prompt — pacote de fatos em texto, mais as leis que o texto tem que obedecer.
 * Spec: docs/specs/ia-analitica/spec.md · ADR 0040.
 *
 * Mora no núcleo, e não no adaptador, por dois motivos:
 *
 * 1. **É o que se ajusta.** Prompt muda muito mais que provedor. Deixá-lo aqui o
 *    torna versionado e testável ao lado do pacote; deixá-lo no adaptador o
 *    obrigaria a ser reescrito a cada troca de fornecedor.
 * 2. **É agnóstico.** Nenhuma linha daqui conhece Google, Anthropic ou qualquer
 *    outro — a barreira do `architecture.test.ts` recusa até o nome.
 *
 * O adaptador fica com o que sobra: pegar `{ sistema, usuario }` e mapear para o
 * formato de fio do provedor. É isso que faz a troca custar um arquivo.
 *
 * ## A simetria que sustenta a verificação
 *
 * Os números são renderizados aqui em **pt-BR** — vírgula decimal, ponto de
 * milhar. O `verificar.ts` lê de volta no mesmo formato. Se o modelo lê "40,1 h"
 * e escreve "40,1 h", a conferência casa; se um lado usasse ponto e o outro
 * vírgula, toda frase correta seria reprovada.
 */
import type { PacoteDeFatos, FatoNumero, UmOuMaisPacotes } from './pacote';
import { ressalvasObrigatorias } from './pacote';

/** Número em pt-BR: vírgula decimal, ponto de milhar. */
export function formatarNumero(v: number, casas: number): string {
  const fixo = Math.abs(v).toFixed(casas);
  const [inteira, decimal] = fixo.split('.');
  const comMilhar = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const corpo = decimal ? `${comMilhar},${decimal}` : comMilhar;
  return v < 0 ? `−${corpo}` : corpo;
}

/**
 * Só a base B1 é renderizada, e sem o nome dela.
 *
 * É de propósito, e é temporário: a **gramática das bases** — nomear B1/B2/B3 no
 * texto, e declarar as que não existem — é a Story 1.5, e vem junto com o bump
 * de {@link PROMPT_VERSAO}. Enquanto ela não chega, este renderizador entrega
 * exatamente o mesmo texto que a versão 1 do pacote entregava, para que a
 * mudança de forma não se misture com mudança de prosa.
 *
 * Pela mesma razão, `tendencias` e `textos` ainda não aparecem aqui.
 */
function linhaDeFato(f: FatoNumero): string | null {
  if (f.atual == null) return null;
  const u = f.unidade ? ` ${f.unidade}` : '';
  let s = `- ${f.rotulo}: ${formatarNumero(f.atual, f.casas)}${u}`;
  const b1 = f.bases.find((b) => b.id === 'B1');
  if (b1?.existe && b1.valor != null) {
    s += ` (anterior: ${formatarNumero(b1.valor, f.casas)}${u}`;
    if (b1.deltaPct != null) s += `, ${formatarNumero(b1.deltaPct, 1)}%`;
    s += ')';
  }
  return s;
}

function blocoDeCaderno(p: PacoteDeFatos): string {
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
      .map(linhaDeFato)
      .filter((l): l is string => l != null);
    if (linhas.length === 0) continue;
    partes.push(g ? `#### ${g}\n${linhas.join('\n')}` : linhas.join('\n'));
  }
  if (partes.length === 0) return '';

  let s = `\n### ${p.rotulo}\n${partes.join('\n')}`;
  if (p.cobertura) {
    const c = p.cobertura;
    s += `\n- Cobertura: ${c.diasComDado} de ${c.diasNoPeriodo} dias`
      + ` (período anterior: ${c.diasComDadoAnterior} de ${c.diasNoPeriodoAnterior})`;
    if (!c.comparavel) {
      s += `\n  ⚠ COBERTURA DESIGUAL — a comparação deste bloco EXIGE ressalva no texto.`;
    }
  }
  return s;
}

/**
 * As leis. Escritas como proibição concreta e verificável, não como conselho de
 * estilo: cada uma tem um teste correspondente em `verificar.ts`.
 */
const SISTEMA = `Você escreve o parágrafo de abertura de uma retrospectiva pessoal.

O registro é de JORNAL: informa, não aconselha. Você relata o que aconteceu no
período. Você não recomenda, não sugere, não motiva e não parabeniza.

REGRAS ABSOLUTAS — violar qualquer uma invalida o texto inteiro:

1. NÚMEROS. Só cite números que estão nos FATOS abaixo, exatamente como estão
   escritos lá. Nunca calcule, some, divida ou derive um número novo. Se você
   quer dizer algo que exigiria uma conta, não diga.

2. CAUSA. Nunca afirme que uma coisa causou outra. Não use "porque", "devido a",
   "por causa de", "graças a", "resultou em", "levou a" ligando duas medidas.
   Você pode dizer que duas coisas aconteceram juntas. Não pode dizer por quê.

3. CORRELAÇÕES. As correlações marcadas como "amostra insuficiente" não podem
   virar manchete nem afirmação. Ignore-as ou diga explicitamente que a amostra
   é pequena.

4. RESSALVAS. Se um bloco estiver marcado com COBERTURA DESIGUAL, o texto TEM
   que dizer isso ao leitor, com os dois números, dentro do parágrafo.

FORMA:

- Dois ou três parágrafos curtos. Português do Brasil.
- ESCOLHA. Não transcreva a lista. A maioria dos números abaixo não deve aparecer
  no texto — cite só os que sustentam o que você decidiu contar.
- Abra pela observação mais NOTÁVEL, e diga o que a torna notável. Notável não é
  o maior número: é o contraste inesperado, a coisa que se moveu ao contrário do
  que se esperaria, a medida que discorda da outra.
- Datas por extenso ("30 de agosto"), nunca no formato 2026-08-30. Não repita o
  intervalo do período: o leitor sabe que período está lendo.
- Nada de "registrou", "marcou", "ficou em", "ante", "em comparação com o ciclo
  passado". Isso é registro de planilha. Escreva como um jornal escreve.`;

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
 */
export const PROMPT_VERSAO = 2;

export interface Prompt {
  sistema: string;
  usuario: string;
}

/**
 * Pacote(s) → `{ sistema, usuario }`.
 * O `usuario` é o pacote em texto; o `sistema` é a lei. Nenhum dos dois conhece
 * o provedor que vai recebê-los.
 *
 * Aceita **um caderno ou o conjunto**: a sequência da impressão por caderno é a
 * Story 1.10, e até lá o chamador do celular narra a edição inteira de uma vez,
 * como sempre narrou. Todos os pacotes de uma edição falam do mesmo período —
 * o cabeçalho sai do primeiro.
 */
export function montarPrompt(p: UmOuMaisPacotes): Prompt {
  const pacotes: readonly PacoteDeFatos[] = Array.isArray(p) ? p : [p as PacoteDeFatos];
  if (pacotes.length === 0) return { sistema: SISTEMA, usuario: '' };
  const periodo = pacotes[0].periodo;

  const partes: string[] = [
    `# ${periodo.rotulo}`,
    `Período: ${periodo.inicioISO} a ${periodo.fimISO} (${periodo.diasNoPeriodo} dias).`,
  ];

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
