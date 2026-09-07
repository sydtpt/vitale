/**
 * A busca textual sobre as atividades já carregadas
 * (spec busca-textual — CAP-2, CAP-5, CAP-6, CAP-9).
 *
 * Roda no cliente, sobre a lista que `fetchActivities` já traz inteira nos dois
 * apps. Não há consulta nova, teto do PostgREST no caminho, nem dependência de
 * rede. Medido: ~1.100 atividades daqui a dois anos no ritmo de pico, 462 bytes
 * de texto buscável por atividade, ≈1 ms por tecla — desde que o índice seja
 * montado **uma vez por carga**, que é a única premissa que essa conta tem.
 *
 * `searchActivities` é pura de propósito: é a fronteira que deixa trocar o
 * motor por Postgres (`ilike`, `pg_trgm`, `tsvector`) sem tocar nas telas, se
 * um dia o acervo pedir.
 */
import type { Activity } from '../models';
import { casaToken, casaTudo, consultaAtiva, normalizar, tokenizar } from './normalize';
import {
  contar,
  estaAVista,
  faixaDe,
  PESO,
  type SearchEntry,
  type SearchFieldId,
} from './campos';

export interface IndexedActivity {
  activity: Activity;
  entries: readonly SearchEntry[];
}

export interface SearchHit {
  activity: Activity;
  /** Maior peso entre os campos que casaram — é o que ordena a lista. */
  score: number;
  /**
   * O casamento que a tela mostra. **Não é necessariamente o de maior peso:**
   * um campo à vista no cartão vence um invisível mesmo pesando menos, senão a
   * linha de proveniência esconderia justamente o texto que o usuário digitou.
   *
   * Medido em produção: das 21 rotas com "Tervuren" no nome, **todas as 21**
   * também passam pela cidade Tervuren. Sem essa regra, nenhuma delas mostraria
   * o próprio nome.
   */
  match: SearchEntry;
  /** Outros campos que também casaram, para a tela poder dizer "e no nome". */
  alsoMatched: readonly SearchFieldId[];
}

/** Uma marca de cidade rende o nome canônico e, quando houver, os apelidos. */
function entradasDeCidade(a: Activity): SearchEntry[] {
  const out: SearchEntry[] = [];
  const vistos = new Set<string>();
  for (const c of a.cities ?? []) {
    const nome = c.name?.trim();
    if (!nome) continue;
    // Uma rota reentra na mesma cidade várias vezes (Bruxelles aparece 2x numa
    // pedalada de 103 km). Uma entrada por cidade basta — 20 idênticas só
    // encareceriam o casamento.
    const chave = normalizar(nome);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    out.push({
      field: 'cidade',
      label: 'cidade',
      weight: PESO.cidade,
      text: nome,
      tokens: tokenizar(nome),
    });

    // `aliases` só existe depois da story 1; antes dela o laço não roda e a
    // busca por cidade funciona igual, só sem alcançar as outras grafias.
    const apelidos = (c as { aliases?: string[] }).aliases ?? [];
    for (const apelido of apelidos) {
      const tokens = tokenizar(apelido);
      if (tokens.length === 0) continue;
      out.push({
        field: 'cidade-apelido',
        label: 'cidade',
        weight: PESO.cidadeApelido,
        // O texto é o CANÔNICO: digitar `louvain` tem que mostrar `Leuven`.
        text: nome,
        tokens,
      });
    }
  }
  return out;
}

/**
 * Monta o índice. Roda **uma vez por carga do store**, nunca no evento de
 * digitação — normalizar 1.100 atividades a cada tecla jogaria fora a conta
 * inteira de desempenho.
 */
export function buildSearchIndex(atividades: readonly Activity[]): IndexedActivity[] {
  const freqNome = contar(atividades, (a) => a.activityName, normalizar);
  const freqRota = contar(atividades, (a) => a.routeName, normalizar);

  return atividades.map((activity) => {
    const entries: SearchEntry[] = entradasDeCidade(activity);

    const rota = activity.routeName?.trim();
    if (rota) {
      entries.push({
        field: 'rota',
        // Sem `label` de propósito: o nome próprio está à vista no cartão, então
        // a tela grifa em vez de explicar (CAP-9).
        weight: PESO.rota[faixaDe(freqRota.get(normalizar(rota)) ?? 1)],
        text: rota,
        tokens: tokenizar(rota),
      });
    }

    const nome = activity.activityName?.trim();
    if (nome) {
      // O rótulo de fábrica continua buscável, só vale pouco: é ele que resgata
      // as corridas sem `cities` que carregam a cidade no nome ("Brussels
      // Running"). Excluí-lo mataria exatamente o que a busca multi-campo ganha.
      entries.push({
        field: 'nome',
        label: 'nome',
        weight: PESO.nome[faixaDe(freqNome.get(normalizar(nome)) ?? 1)],
        text: nome,
        tokens: tokenizar(nome),
      });
    }

    const aparelho = activity.device?.trim();
    if (aparelho) {
      entries.push({
        field: 'aparelho',
        label: 'aparelho',
        weight: PESO.aparelho,
        text: aparelho,
        tokens: tokenizar(aparelho),
      });
    }

    const fonte = activity.sourceName?.trim();
    if (fonte) {
      entries.push({
        field: 'fonte',
        label: 'fonte',
        weight: PESO.fonte,
        text: fonte,
        tokens: tokenizar(fonte),
      });
    }

    return { activity, entries };
  });
}

/**
 * Escolhe a entrada que a tela mostra, entre as que casaram.
 *
 * Ordem de desempate, e cada degrau existe por um motivo:
 *   1. **está à vista no cartão** — grifar o que já se lê vence explicar o que
 *      não se vê (CAP-9, e a razão está no comentário de `SearchHit.match`);
 *   2. **casou a consulta inteira** — uma entrada que explica todos os pedaços
 *      é melhor explicação que uma que pegou só um;
 *   3. **maior peso**.
 */
function melhorEntrada(candidatas: readonly SearchEntry[], pedacos: readonly string[]): SearchEntry {
  return candidatas.reduce((melhor, e) => {
    const aVista = Number(estaAVista(e)) - Number(estaAVista(melhor));
    if (aVista !== 0) return aVista > 0 ? e : melhor;
    const inteira = Number(casaTudo(pedacos, e.tokens)) - Number(casaTudo(pedacos, melhor.tokens));
    if (inteira !== 0) return inteira > 0 ? e : melhor;
    return e.weight > melhor.weight ? e : melhor;
  });
}

/**
 * Busca. Devolve os resultados ranqueados, cada um sabendo dizer por que
 * apareceu.
 *
 * Consulta curta demais devolve lista vazia — a tela deve consultar
 * `consultaAtiva()` antes e mostrar a lista normal, não o estado vazio. "Não
 * busquei" e "busquei e não achei" são coisas diferentes (CAP-7).
 */
export function searchActivities(
  consulta: string,
  index: readonly IndexedActivity[],
): SearchHit[] {
  if (!consultaAtiva(consulta)) return [];
  const pedacos = tokenizar(consulta);

  const hits: SearchHit[] = [];
  for (const { activity, entries } of index) {
    // O E da consulta vale sobre a UNIÃO dos campos: `brussels running` pode
    // casar "brussels" na cidade e "running" no nome, na mesma atividade.
    const todosOsTokens = entries.flatMap((e) => e.tokens);
    if (!casaTudo(pedacos, todosOsTokens)) continue;

    const casaram = entries.filter((e) => pedacos.some((p) => casaToken(p, e.tokens)));
    if (casaram.length === 0) continue;

    const match = melhorEntrada(casaram, pedacos);
    hits.push({
      activity,
      score: Math.max(...casaram.map((e) => e.weight)),
      match,
      alsoMatched: [...new Set(casaram.map((e) => e.field))].filter((f) => f !== match.field),
    });
  }

  // Desempate por data decrescente — a mesma ordem do histórico, para a lista
  // não parecer embaralhada quando muitos resultados empatam no peso.
  hits.sort((a, b) =>
    b.score - a.score || b.activity.startAt.localeCompare(a.activity.startAt),
  );
  return hits;
}
