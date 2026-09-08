/**
 * Acesso à tabela `edicoes_ia` — dono único (AD-4).
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040.
 *
 * Uma edição é o parágrafo de um período **fechado**, congelado no momento em
 * que foi impresso. Este módulo só lê e grava linhas: quem decide *se* um
 * período merece edição é o `periodoFechado` (`ia/pacote.ts`), e quem decide se
 * um texto pode virar edição é o `verificarTexto` (`ia/verificar.ts`).
 *
 * Sem paginação de propósito: são ~68 linhas por ano (52 semanas + 12 meses +
 * 4 estações), muito abaixo do teto de 1000 do PostgREST.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';

/** Linha como o PostgREST a devolve (snake_case). */
export interface EdicaoRow {
  user_id: string;
  tipo_periodo: string;
  inicio: string;
  fim: string;
  texto: string;
  provedor: string;
  modelo: string;
  prompt_versao: number;
  pacote_versao: number;
  motivo_de_parada: string;
  tokens_entrada: number;
  tokens_saida: number;
  agg_version_no_momento: number | null;
  gerado_em: string;
}

export interface Edicao {
  tipoPeriodo: string;
  inicio: string;
  fim: string;
  texto: string;
  /** A linha de crédito (ADR 0040) — quem escreveu, com o quê, quando. */
  provedor: string;
  modelo: string;
  promptVersao: number;
  pacoteVersao: number;
  aggVersionNoMomento: number | null;
  geradoEm: string;
}

const COLUMNS = 'user_id,tipo_periodo,inicio,fim,texto,provedor,modelo,prompt_versao,'
  + 'pacote_versao,motivo_de_parada,tokens_entrada,tokens_saida,agg_version_no_momento,gerado_em';

export function toEdicao(r: EdicaoRow): Edicao {
  return {
    tipoPeriodo: r.tipo_periodo,
    inicio: r.inicio,
    fim: r.fim,
    texto: r.texto,
    provedor: r.provedor,
    modelo: r.modelo,
    promptVersao: r.prompt_versao,
    pacoteVersao: r.pacote_versao,
    aggVersionNoMomento: r.agg_version_no_momento,
    geradoEm: r.gerado_em,
  };
}

/** A edição de um período, ou `null` se ele ainda não foi impresso. */
export async function fetchEdicao(
  db: SupabaseClient,
  userId: string,
  tipoPeriodo: string,
  inicio: string,
  fim: string,
): Promise<Edicao | null> {
  const { data, error } = await db
    .from('edicoes_ia')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('tipo_periodo', tipoPeriodo)
    .eq('inicio', inicio)
    .eq('fim', fim)
    .maybeSingle();
  if (error) throw error;
  return data ? toEdicao(data as unknown as EdicaoRow) : null;
}

export interface EdicaoInput {
  tipoPeriodo: string;
  inicio: string;
  fim: string;
  texto: string;
  provedor: string;
  modelo: string;
  promptVersao: number;
  pacoteVersao: number;
  motivoDeParada: string;
  tokensEntrada: number;
  tokensSaida: number;
  // A versão da agregação **não** entra aqui de propósito: quem grava a lê da
  // constante, logo abaixo. Ver a nota em `upsertEdicao`.
}

/**
 * Grava a edição. `upsert` na chave do período, e não `insert`, porque regerar
 * um período é operação legítima — trocou o modelo, subiu a versão do prompt.
 *
 * O que **não** acontece aqui é reescrita silenciosa por dado novo: período
 * fechado não recebe dado novo, e mudança de agregação vira errata pela
 * comparação de `agg_version_no_momento`, não por regravação.
 *
 * **A versão da agregação é lida aqui, nunca recebida.** Ela chegava por quatro
 * passagens opcionais em fila (tela → store → adaptador → este campo) e o que
 * chegava era `undefined`: as 7 edições em produção têm nulo na coluna, e
 * `precisaErrata` devolve `false` para nulo — nenhuma delas era elegível a
 * errata. Tornar a passagem obrigatória fecharia a *omissão* e deixaria aberto o
 * *valor errado*: `PACOTE_VERSAO` é `number`, sai do mesmo barril e compilaria no
 * lugar dela. Como `AGG_VERSION` e este módulo moram no mesmo pacote, ler no
 * ponto de gravação mata a classe inteira — e o script de backfill herda a
 * garantia sem ter que lembrar de nada. Para que essa última frase seja verdade
 * e não promessa, a barreira de dono único (`architecture.test.ts`) varre
 * `scripts/` junto com os apps e as edge functions: um hospedeiro futuro que
 * redeclarasse a constante lá reprovaria antes de existir.
 */
export async function upsertEdicao(
  db: SupabaseClient,
  userId: string,
  e: EdicaoInput,
): Promise<Edicao> {
  const { data, error } = await db
    .from('edicoes_ia')
    .upsert({
      user_id: userId,
      tipo_periodo: e.tipoPeriodo,
      inicio: e.inicio,
      fim: e.fim,
      texto: e.texto,
      provedor: e.provedor,
      modelo: e.modelo,
      prompt_versao: e.promptVersao,
      pacote_versao: e.pacoteVersao,
      motivo_de_parada: e.motivoDeParada,
      tokens_entrada: e.tokensEntrada,
      tokens_saida: e.tokensSaida,
      agg_version_no_momento: AGG_VERSION,
      gerado_em: new Date().toISOString(),
    }, { onConflict: 'user_id,tipo_periodo,inicio,fim' })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toEdicao(data as unknown as EdicaoRow);
}

/**
 * A edição está **desatualizada** quando a agregação que a sustentava mudou.
 *
 * Não dispara regravação: dispara a errata. O jornal não reescreve terça — marca
 * que o número mudou e deixa o leitor decidir se quer a edição nova.
 */
export function precisaErrata(e: Edicao, aggVersionAtual: number): boolean {
  return e.aggVersionNoMomento != null && e.aggVersionNoMomento !== aggVersionAtual;
}
