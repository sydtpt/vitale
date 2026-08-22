/**
 * Cliente da edge function `cultura-search`.
 * Spec: docs/specs/cultura/spec.md
 *
 * A busca não é feita aqui por três motivos, todos do spec: o segredo do TMDB
 * (CAP-7), o CORS, e o `User-Agent` que o MusicBrainz exige. O app só pede.
 */
import { supabase } from './supabase';

/** Shape único, igual para os quatro tipos — quem respondeu não importa aqui. */
export interface CulturaCandidato {
  fonte: string;
  fonteId: string;
  titulo: string;
  criador?: string;
  capaUrl?: string;
  extra?: Record<string, unknown>;
}

export interface CulturaBusca {
  candidatos: CulturaCandidato[];
  /** `null` quando a cadeia se esgotou — sinal para oferecer cadastro manual. */
  provedor: string | null;
}

/**
 * Busca candidatos de um tipo. Cadeia esgotada devolve lista vazia, não erro:
 * é caminho legítimo (CAP-1), e quem decide o que fazer com isso é a tela.
 */
export async function buscarCultura(tipo: string, q: string): Promise<CulturaBusca> {
  const { data, error } = await supabase.functions.invoke('cultura-search', {
    body: { tipo, q },
  });
  if (error) throw error;
  const d = data as Partial<CulturaBusca> & { error?: string };
  if (d.error) throw new Error(d.error);
  return { candidatos: d.candidatos ?? [], provedor: d.provedor ?? null };
}
