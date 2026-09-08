/**
 * A chamada à camada de narração — o único pedaço do caminho que sai do aparelho.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040.
 *
 * Tudo que decide alguma coisa acontece **aqui no telefone**: o pacote de fatos
 * é montado do `RetroSummary` que a tela já calculou, o prompt sai do núcleo, e
 * a conferência das quatro regras roda sobre a resposta antes de qualquer
 * gravação. A edge function só guarda a chave.
 *
 * Por isso a ordem importa e não é negociável: **verifica antes de gravar**. Um
 * texto que cita número inventado, afirma causa ou esconde ressalva não é uma
 * edição ruim — não é uma edição.
 */
import {
  montarPacote, montarPrompt, verificarTexto, PACOTE_VERSAO, PROMPT_VERSAO,
  upsertEdicao, fetchEdicao,
  type EntradaPacote, type PacoteDeFatos, type Edicao, type Problema,
} from '@vitale/shared';
import { supabase } from './supabase';

interface Narracao {
  texto: string;
  provedor: string;
  modelo: string;
  motivoDeParada: string;
  tokens: { entrada: number; saida: number };
}

export type ResultadoEdicao =
  | { estado: 'ok'; edicao: Edicao }
  /** Período em curso: por desenho não ganha parágrafo (§3 do spec). */
  | { estado: 'aberto' }
  /** O texto voltou, mas reprovou. Não grava, e diz por quê. */
  | { estado: 'reprovado'; problemas: Problema[]; texto: string }
  | { estado: 'erro'; mensagem: string };

async function narrar(pacote: PacoteDeFatos): Promise<Narracao> {
  const { data, error } = await supabase.functions.invoke('ia-narrar', {
    body: montarPrompt(pacote),
  });
  if (error) throw error;
  const d = data as Partial<Narracao> & { error?: string; detalhe?: string };
  if (d.error) throw new Error(d.detalhe ?? d.error);
  if (!d.texto) throw new Error('resposta sem texto');
  // Truncado não é edição — o banco também recusa, mas falhar aqui dá a
  // mensagem certa em vez de um erro de constraint.
  if (d.motivoDeParada && d.motivoDeParada !== 'STOP') {
    throw new Error(`texto truncado (${d.motivoDeParada})`);
  }
  return {
    texto: d.texto,
    provedor: d.provedor ?? 'desconhecido',
    modelo: d.modelo ?? 'desconhecido',
    motivoDeParada: d.motivoDeParada ?? 'STOP',
    tokens: d.tokens ?? { entrada: 0, saida: 0 },
  };
}

/** A edição já impressa deste período, ou `null`. */
export async function buscarEdicao(
  userId: string, entrada: EntradaPacote,
): Promise<Edicao | null> {
  const p = montarPacote(entrada);
  return fetchEdicao(supabase, userId, p.periodo.tipo, p.periodo.inicioISO, p.periodo.fimISO);
}

/**
 * Imprime a edição de um período fechado: monta, narra, confere, grava.
 * Não faz nada se o período está em curso — a decisão é do núcleo, não da tela.
 */
export async function gerarEdicao(
  userId: string,
  entrada: EntradaPacote,
): Promise<ResultadoEdicao> {
  const pacote = montarPacote(entrada);
  if (!pacote.periodo.fechado) return { estado: 'aberto' };

  try {
    const n = await narrar(pacote);
    const v = verificarTexto(n.texto, pacote);
    if (!v.ok) return { estado: 'reprovado', problemas: v.problemas, texto: n.texto };

    const edicao = await upsertEdicao(supabase, userId, {
      tipoPeriodo: pacote.periodo.tipo,
      inicio: pacote.periodo.inicioISO,
      fim: pacote.periodo.fimISO,
      texto: n.texto,
      provedor: n.provedor,
      modelo: n.modelo,
      promptVersao: PROMPT_VERSAO,
      pacoteVersao: PACOTE_VERSAO,
      motivoDeParada: n.motivoDeParada,
      tokensEntrada: n.tokens.entrada,
      tokensSaida: n.tokens.saida,
      // A versão da agregação não aparece aqui: o núcleo a carimba no ponto de
      // gravação. O telefone não escolhe — não tem como escolher.
    });
    return { estado: 'ok', edicao };
  } catch (e) {
    return { estado: 'erro', mensagem: e instanceof Error ? e.message : String(e) };
  }
}
