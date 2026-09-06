/**
 * As três verificações mecânicas da §5 do spec — o que separa "confio no modelo"
 * de "conferi o modelo".
 *
 * O que NÃO se testa aqui: se a manchete escolhida é a boa. Isso é julgamento do
 * leitor, é uma pessoa só, e ela está disponível. Fingir que dá para automatizar
 * seria pior que não tentar.
 *
 * O que se testa é o que tem resposta binária:
 *   1. todo número citado existe no pacote
 *   2. nenhuma palavra de causa ligando duas medidas
 *   3. nenhuma correlação fora do portão promovida a afirmação
 *   4. toda ressalva obrigatória foi declarada
 *
 * Puro, sem rede, sem provedor — roda igual sobre a saída de qualquer modelo, o
 * que é justamente o que faz trocar de fornecedor custar uma tarde (ADR 0040).
 */
import type { PacoteDeFatos } from './pacote';
import { ressalvasObrigatorias, valoresDoPacote } from './pacote';

export interface Problema {
  regra: 'numero' | 'causa' | 'correlacao' | 'ressalva';
  detalhe: string;
}

export interface Veredito {
  ok: boolean;
  problemas: Problema[];
}

/**
 * Termos que afirmam causa. "Depois de" e "quando" ficam de fora de propósito:
 * são temporais, e o texto precisa poder dizer que duas coisas coincidiram.
 */
const CAUSA = [
  'porque', 'por causa', 'devido a', 'devido à', 'graças a', 'graças à',
  'resultou em', 'levou a', 'levou à', 'provocou', 'causou', 'causa disso',
  'em função de', 'em razão de', 'fez com que', 'por conta de',
];

/**
 * Números pt-BR: ponto de milhar, vírgula decimal. `17.350` é dezessete mil e
 * trezentos e cinquenta; `40,1` é quarenta vírgula um.
 *
 * Anos e horas do relógio saem da conta: `2026` não é uma métrica citada, e
 * `7h02` é formatação de duração, não um número do pacote.
 */
const NUM = /\d{1,3}(?:\.\d{3})+|\d+,\d+|\d+/g;

function paraNumero(bruto: string): number | null {
  const limpo = bruto.replace(/\./g, '').replace(',', '.');
  const v = Number(limpo);
  return Number.isFinite(v) ? v : null;
}

/** Números que o texto pode citar sem estarem no pacote. */
function ignoravel(bruto: string, texto: string, pos: number): boolean {
  const v = paraNumero(bruto);
  if (v == null) return true;
  // Ano: 1900–2100 e escrito sem separador.
  if (/^\d{4}$/.test(bruto) && v >= 1900 && v <= 2100) return true;
  // Hora de relógio: "7h02", "22h".
  const antes = texto.slice(Math.max(0, pos - 3), pos);
  const depois = texto.slice(pos + bruto.length, pos + bruto.length + 6);
  if (/h$/i.test(antes) || /^h/i.test(depois)) return true;
  // Dia do mês num "30 de agosto" — a data vem do pacote, não é métrica.
  if (/^\s*de\s/i.test(depois) && v >= 1 && v <= 31) return true;
  return false;
}

/**
 * Confere um texto contra o pacote que o gerou.
 * `ok: false` significa **não gravar a edição** — não "avisar o usuário".
 */
export function verificarTexto(texto: string, pacote: PacoteDeFatos): Veredito {
  const problemas: Problema[] = [];
  const autorizados = valoresDoPacote(pacote);
  const baixo = texto.toLowerCase();

  // Datas ISO saem de cena antes da varredura. `2026-08-01` vira "2026", "08" e
  // "01" para o regex de número, e o "01" é reprovado como métrica inventada —
  // sendo que a data veio do próprio pacote. Mascarar é mais honesto que
  // remendar o regex de número para entender datas.
  const semDatas = texto.replace(/\d{4}-\d{2}-\d{2}/g, ' ');

  // 1 — números
  for (const m of semDatas.matchAll(NUM)) {
    const bruto = m[0];
    const pos = m.index ?? 0;
    if (ignoravel(bruto, semDatas, pos)) continue;
    const v = paraNumero(bruto);
    if (v == null) continue;
    // Comparação EXATA, com epsilon só para o ruído de ponto flutuante — nunca
    // para tolerar arredondamento. Arredondar aqui aprovaria a média que o
    // modelo fez de cabeça sempre que ela caísse perto de um valor real.
    const existe = [...autorizados].some((a) => Math.abs(a - v) < 1e-9);
    if (!existe) {
      problemas.push({ regra: 'numero', detalhe: `"${bruto}" não está no pacote` });
    }
  }

  // 2 — causa
  for (const termo of CAUSA) {
    if (baixo.includes(termo)) {
      problemas.push({ regra: 'causa', detalhe: `afirma causa: "${termo}"` });
    }
  }

  // 3 — correlação fora do portão
  for (const c of pacote.correlacoes) {
    if (c.dentroDoPortao) continue;
    const rotulo = c.rotulo.toLowerCase();
    const citada = rotulo.length > 3 && baixo.includes(rotulo);
    const ressalvada = /amostra|poucos dias|poucas noites|insuficiente/.test(baixo);
    if (citada && !ressalvada) {
      problemas.push({
        regra: 'correlacao',
        detalhe: `"${c.rotulo}" está fora do portão (${c.nCom} com, ${c.nSem} sem) e foi citada sem ressalva`,
      });
    }
  }

  // 4 — ressalva obrigatória
  for (const r of ressalvasObrigatorias(pacote)) {
    const declarou = /cobertura|dias com dado|noites registradas|registrad|apenas \d|só \d/.test(baixo);
    if (!declarou) {
      problemas.push({
        regra: 'ressalva',
        detalhe: `cobertura desigual em "${r}" não foi declarada no texto`,
      });
    }
  }

  return { ok: problemas.length === 0, problemas };
}
