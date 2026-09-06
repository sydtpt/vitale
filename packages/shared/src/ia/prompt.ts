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
import type { PacoteDeFatos, ModuloFatos, FatoNumero } from './pacote';
import { ressalvasObrigatorias } from './pacote';

/** Número em pt-BR: vírgula decimal, ponto de milhar. */
export function formatarNumero(v: number, casas: number): string {
  const fixo = Math.abs(v).toFixed(casas);
  const [inteira, decimal] = fixo.split('.');
  const comMilhar = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const corpo = decimal ? `${comMilhar},${decimal}` : comMilhar;
  return v < 0 ? `−${corpo}` : corpo;
}

function linhaDeFato(f: FatoNumero): string | null {
  if (f.atual == null) return null;
  const u = f.unidade ? ` ${f.unidade}` : '';
  let s = `- ${f.rotulo}: ${formatarNumero(f.atual, f.casas)}${u}`;
  if (f.anterior != null) {
    s += ` (anterior: ${formatarNumero(f.anterior, f.casas)}${u}`;
    if (f.deltaPct != null) s += `, ${formatarNumero(f.deltaPct, 1)}%`;
    s += ')';
  }
  return s;
}

function blocoDeModulo(m: ModuloFatos): string {
  const linhas = m.metricas.map(linhaDeFato).filter((l): l is string => l != null);
  if (linhas.length === 0) return '';
  let s = `\n### ${m.rotulo}\n${linhas.join('\n')}`;
  if (m.cobertura) {
    const c = m.cobertura;
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
 * `PacoteDeFatos` → `{ sistema, usuario }`.
 * O `usuario` é o pacote em texto; o `sistema` é a lei. Nenhum dos dois conhece
 * o provedor que vai recebê-los.
 */
export function montarPrompt(p: PacoteDeFatos): Prompt {
  const partes: string[] = [
    `# ${p.periodo.rotulo}`,
    `Período: ${p.periodo.inicioISO} a ${p.periodo.fimISO} (${p.periodo.diasNoPeriodo} dias).`,
  ];

  for (const m of p.modulos) {
    const bloco = blocoDeModulo(m);
    if (bloco) partes.push(bloco);
  }

  if (p.eventos.length > 0) {
    partes.push(`\n### Eventos\n${p.eventos.map((e) => `- ${e.dia}: ${e.rotulo}`).join('\n')}`);
  }

  if (p.correlacoes.length > 0) {
    const linhas = p.correlacoes.map((c) => {
      const base = `- ${c.rotulo}`;
      if (!c.dentroDoPortao) {
        return `${base}: AMOSTRA INSUFICIENTE (${c.nCom} com, ${c.nSem} sem) — não use como afirmação.`;
      }
      const d = c.deltaPct != null ? `${formatarNumero(c.deltaPct, 1)}%` : 'sem base';
      return `${base}: ${d} (${c.nCom} com, ${c.nSem} sem)`;
    });
    partes.push(`\n### Associações observadas (NUNCA são causa)\n${linhas.join('\n')}`);
  }

  if (p.lacunas.length > 0) {
    const linhas = p.lacunas.map(
      (l) => `- ${l.modulo}: ${l.diasSemDado} dias sem dado${l.motivo ? ` (${l.motivo})` : ''}`,
    );
    partes.push(`\n### Lacunas\n${linhas.join('\n')}`);
  }

  const ressalvas = ressalvasObrigatorias(p);
  if (ressalvas.length > 0) {
    partes.push(
      `\n### Ressalvas obrigatórias\nO texto TEM que declarar a cobertura desigual de: `
      + `${ressalvas.join(', ')}.`,
    );
  }

  return { sistema: SISTEMA, usuario: partes.join('\n') };
}
