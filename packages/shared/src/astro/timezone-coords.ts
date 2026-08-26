/**
 * Onde o aparelho está, deduzido do fuso horário.
 *
 * ## Por que o fuso e não o GPS
 *
 * O único consumidor é o esquema `solar` do tema, que precisa saber a que horas
 * amanhece **aqui**. O GPS responderia isso ao metro, e cobraria um diálogo de
 * permissão de localização para escolher a cor de um app — além de uma
 * dependência nativa no mobile e um segundo prompt na web. O fuso já está no
 * aparelho, não pede nada a ninguém, funciona offline, é igual nos dois apps, e
 * **acompanha viagem sozinho**: quem desembarca em outro fuso vê o celular
 * trocar, e o app junto.
 *
 * O preço é a precisão. `Europe/Brussels` vira as coordenadas de Bruxelas, o
 * que é exato para quem está lá e erra por até meia hora de horário para quem
 * está na ponta de um fuso largo — `America/New_York` cobre de Michigan à
 * Flórida. Para decidir se o app está claro ou escuro, meia hora na borda do
 * pior caso é barato; para mostrar "pôr do sol às 20h47" na tela, não seria, e
 * é por isso que este módulo devolve `null` em vez de chutar quando não sabe.
 *
 * ## Quando devolve `null`
 *
 * Fusos `Etc/GMT+3`, `UTC` e afins não são lugares, são offsets — não há
 * latitude a associar, e chutar a do meridiano daria noites de 12 h no equador
 * para alguém que pode estar em qualquer lugar. Nome desconhecido também cai
 * aqui. Quem chama trata `null` caindo no esquema do sistema operacional.
 */
import { TIMEZONE_ALIASES_DATA, TIMEZONE_COORDS_DATA } from './timezone-coords.data';
import type { Coords } from './sun';

let coords: Map<string, Coords> | null = null;
let aliases: Map<string, string> | null = null;

/** Monta os mapas na primeira consulta — ver o cabeçalho do arquivo gerado. */
function ensureLoaded(): void {
  if (coords) return;
  coords = new Map();
  for (const linha of TIMEZONE_COORDS_DATA.split('\n')) {
    const [zona, lat, lon] = linha.split(' ');
    coords.set(zona, { lat: Number(lat), lon: Number(lon) });
  }
  aliases = new Map();
  for (const linha of TIMEZONE_ALIASES_DATA.split('\n')) {
    const [apelido, alvo] = linha.split(' ');
    aliases.set(apelido, alvo);
  }
}

/**
 * Coordenada representativa de um fuso IANA, ou `null` se ele não tiver uma.
 *
 * Aceita apelidos (`Asia/Calcutta`, `US/Eastern`): o tzdata mantém dezenas de
 * nomes antigos vivos como links, e qual deles um aparelho devolve depende da
 * versão do ICU que ele carrega, não de escolha do usuário.
 */
export function coordsForTimeZone(timeZone: string | null | undefined): Coords | null {
  if (!timeZone) return null;
  ensureLoaded();
  const direto = coords!.get(timeZone);
  if (direto) return direto;
  const canonico = aliases!.get(timeZone);
  return canonico ? (coords!.get(canonico) ?? null) : null;
}

/**
 * Fuso horário do aparelho, como o ambiente o reporta.
 *
 * `null` quando o ambiente não tem `Intl` com suporte a fuso — não acontece nos
 * dois apps, mas o núcleo também é importado pelo Deno das edge functions, onde
 * "que horas são para o usuário" não é uma pergunta que faça sentido.
 */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Coordenada do aparelho pelo fuso ativo. Atalho de `coordsForTimeZone`. */
export function deviceCoords(): Coords | null {
  return coordsForTimeZone(deviceTimeZone());
}
