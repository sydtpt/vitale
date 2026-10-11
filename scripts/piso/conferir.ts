/**
 * Confere o passe de piso contra as rotas **de verdade**, fora do aparelho.
 *
 * ## Por que existe
 *
 * Em 10–11/10/2026 o piso levou oito rodadas de conserto, e o ciclo de
 * verificação era: consertar → build → instalar → o dono tocar → esperar →
 * consultar o banco. Quinze minutos por hipótese, uma hipótese por volta. Pior,
 * as medições do Overpass foram feitas contra um **círculo sintético** — se as
 * rotas reais tivessem algo diferente (área maior, região com mais vias), o
 * teste nunca pegaria.
 *
 * Este script fecha o laço em segundos, com o dado real: lê o `route_overview`
 * das pedaladas que ainda estão na fila, monta exatamente as mesmas consultas
 * que o app monta, e relata **cada tentativa contra cada espelho**, com tempo e
 * tamanho.
 *
 * ## O que ele NÃO faz
 *
 * **Não escreve nada.** Nem no banco, nem no OSM. É leitura de `activities` /
 * `activity_routes` e consulta ao Overpass. Rodar isto não conserta nem estraga
 * pedalada nenhuma — ele só responde se a consulta que o app faz tem como dar
 * certo agora.
 *
 * ## Uso
 *
 *   pnpm --filter @vitale/scripts exec tsx piso/conferir.ts
 *   pnpm --filter @vitale/scripts exec tsx piso/conferir.ts --rodadas 3
 *
 * A credencial é a mesma da bancada (JWT de usuário, nunca chave de serviço):
 * faltando, ele para antes de abrir rede e diz o que exportar.
 */
import {
  SURFACE_MATCH_RADIUS_M,
  SURFACE_SAMPLE_SPACING_M,
  fetchSurfaceCandidates,
  overpassWaysQuery,
  parseOverpassWays,
  planSurface,
} from '@vitale/shared';
import {
  abrirSessao,
  comoSeAutenticar,
  lerCredenciais,
  type ClientDoNucleo,
} from '../bancada/supabase.ts';

/** Os mesmos valores do app (`mobile/src/lib/surface-osm.ts`). Divergir aqui
 *  mediria outra coisa, e o relatório mentiria com precisão. */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;
const OVERPASS_TIMEOUT_S = 50;
const TIMEOUT_MS = (OVERPASS_TIMEOUT_S + 25) * 1000;
const PONTOS_POR_CONSULTA = 80;
const BICICLETA = 13;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const host = (url: string) => url.replace(/^https?:\/\//, '').split('/')[0];

interface Tentativa {
  readonly espelho: string;
  readonly desfecho: string;
  readonly segundos: number;
  readonly bytes: number;
  readonly vias: number;
}

/** Uma consulta contra um espelho, com tudo que o relatório precisa saber. */
async function tentar(url: string, query: string): Promise<Tentativa> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const base = { espelho: host(url), bytes: 0, vias: 0 };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'Orbe/1.0 (life-organizer)', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });
    const texto = await res.text();
    const segundos = (Date.now() - t0) / 1000;
    if (!res.ok) {
      return { ...base, desfecho: `HTTP ${res.status}`, segundos, bytes: texto.length };
    }
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      return { ...base, desfecho: 'resposta não é JSON', segundos, bytes: texto.length };
    }
    const remark = (corpo as { remark?: unknown })?.remark;
    if (typeof remark === 'string' && remark.length > 0) {
      return { ...base, desfecho: `remark: ${remark.slice(0, 70)}`, segundos, bytes: texto.length };
    }
    const vias = parseOverpassWays(corpo).length;
    return {
      ...base,
      desfecho: vias === 0 ? '200 mas ZERO vias' : 'ok',
      segundos,
      bytes: texto.length,
      vias,
    };
  } catch (e) {
    const segundos = (Date.now() - t0) / 1000;
    const motivo = ctrl.signal.aborted ? `timeout ${TIMEOUT_MS / 1000}s` : e instanceof Error ? e.message : String(e);
    return { ...base, desfecho: motivo, segundos };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const rodadas = Number(
    process.argv[process.argv.indexOf('--rodadas') + 1] || '2',
  );

  const leitura = lerCredenciais(process.env);
  if (!leitura.ok) {
    // Mesma regra da bancada: parar ANTES de abrir rede, e nomear o que falta.
    // "Esqueci de exportar" e "a rede caiu" não podem sair iguais.
    if (leitura.faltam.length > 0) console.error(`faltam: ${leitura.faltam.join(', ')}`);
    for (const p of leitura.problemas) console.error(p);
    console.error(comoSeAutenticar());
    process.exitCode = 1;
    return;
  }
  const sessao = await abrirSessao(leitura.credenciais);
  const db = sessao.db as ClientDoNucleo;

  // `retryBefore` no futuro de propósito: aqui queremos TODAS as pendentes,
  // inclusive as que falharam há pouco e que o passe do app ainda ignora.
  const futuro = new Date(Date.now() + 86_400_000).toISOString();
  const fila = await fetchSurfaceCandidates(db, sessao.userId, [BICICLETA], 50, futuro);

  console.log(`\nfila do piso: ${fila.length} pedalada(s) sem piso\n`);
  if (fila.length === 0) return;

  for (const { activityId, overview } of fila) {
    const plan = planSurface(overview, SURFACE_SAMPLE_SPACING_M, SURFACE_MATCH_RADIUS_M, OVERPASS_TIMEOUT_S);
    const pontos = plan.samples.map((s) => s.point);
    const fatias = Math.ceil(pontos.length / PONTOS_POR_CONSULTA);
    console.log(`── ${activityId}`);
    console.log(
      `   overview ${overview.length} pts · ${(plan.lengthM / 1000).toFixed(1)} km · ` +
        `${plan.samples.length} amostras · ${fatias} fatia(s) · ${plan.gaps.length} buraco(s)`,
    );

    let viasTotal = 0;
    let falhou = false;
    for (let i = 0; i < pontos.length; i += PONTOS_POR_CONSULTA) {
      const fatia = pontos.slice(i, i + PONTOS_POR_CONSULTA);
      const query = overpassWaysQuery(fatia, SURFACE_MATCH_RADIUS_M, OVERPASS_TIMEOUT_S);
      const n = Math.floor(i / PONTOS_POR_CONSULTA) + 1;
      let venceu = false;
      for (let r = 0; r < rodadas && !venceu; r++) {
        if (r > 0) await dormir(3000);
        for (const url of MIRRORS) {
          const t = await tentar(url, query);
          console.log(
            `   fatia ${n}/${fatias} · rodada ${r + 1} · ${t.espelho.padEnd(24)} ` +
              `${t.desfecho.padEnd(22)} ${t.segundos.toFixed(1)}s ${t.bytes}B ${t.vias} vias`,
          );
          if (t.vias > 0) {
            viasTotal += t.vias;
            venceu = true;
            break;
          }
        }
      }
      if (!venceu) falhou = true;
    }
    console.log(
      `   ⇒ ${falhou ? 'FALHOU — alguma fatia não respondeu' : `ok — ${viasTotal} vias no total`}\n`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
