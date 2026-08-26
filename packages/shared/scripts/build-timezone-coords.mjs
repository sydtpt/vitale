#!/usr/bin/env node
/**
 * Gera `src/astro/timezone-coords.data.ts` — a coordenada representativa de
 * cada fuso IANA, que é como o esquema `solar` descobre onde o aparelho está
 * sem pedir permissão de localização.
 *
 * Rodar só quando valer a pena reencostar no tzdata (fuso novo, cidade
 * renomeada). O asset é estável e fica versionado.
 *
 *   node packages/shared/scripts/build-timezone-coords.mjs
 *
 * Fonte: o **tzdata do próprio sistema**, em `/usr/share/zoneinfo` — domínio
 * público. `zone.tab` já traz uma coordenada por fuso canônico, em ISO 6709;
 * não há nada para baixar.
 *
 * O trabalho de verdade são os **apelidos**. `zone.tab` lista só os canônicos,
 * mas um aparelho pode devolver `Asia/Calcutta` ou `US/Eastern`, que não estão
 * lá. Resolver cada apelido tem três degraus, nesta ordem:
 *
 *  1. o ICU do Node canonicaliza (`US/Eastern` → `America/New_York`);
 *  2. o conteúdo binário do arquivo bate com exatamente um canônico — dois
 *     nomes com o mesmo histórico de offsets são o mesmo fuso;
 *  3. desempate por região quando o passo 2 acha vários.
 *
 * O passo 2 sozinho seria perigoso: `Atlantic/Reykjavik` e `Africa/Abidjan` têm
 * arquivos idênticos (UTC+0 sem horário de verão) e 59° de latitude entre eles.
 * Por isso os que sobram ambíguos são **descartados** em vez de chutados, e os
 * poucos links reais que caem nesse buraco estão no `MANUAL` abaixo, conferidos
 * um a um contra o arquivo `backward` do tzdata.
 *
 * Os `Etc/GMT±N`, `UTC` e afins também ficam de fora, e aí é de propósito: são
 * offsets, não lugares. Fuso sem coordenada faz o app cair no esquema do
 * sistema, que é a degradação certa.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZONEINFO = process.argv[2] ?? '/usr/share/zoneinfo';
const SAIDA = path.join(HERE, '..', 'src', 'astro', 'timezone-coords.data.ts');

/** Links do tzdata que o conteúdo não desempata. Conferidos no `backward`. */
const MANUAL = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Coral_Harbour': 'America/Atikokan',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Yap': 'Pacific/Chuuk',
};

/* ── 1. zone.tab: os canônicos, com coordenada ── */

const canonicos = new Map();
for (const linha of fs.readFileSync(path.join(ZONEINFO, 'zone.tab'), 'utf8').split('\n')) {
  if (!linha || linha.startsWith('#')) continue;
  const [, coord, zona] = linha.split('\t');
  if (!zona) continue;
  // ISO 6709: ±DDMM±DDDMM, com segundos opcionais nas duas metades.
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(coord);
  if (!m) throw new Error(`coordenada ilegível em zone.tab: ${coord} (${zona})`);
  const grau = (sinal, d, min, seg) =>
    (sinal === '-' ? -1 : 1) * (+d + +min / 60 + +(seg ?? 0) / 3600);
  canonicos.set(zona, {
    // Duas casas ≈ 1,1 km. O sol não distingue isso: 1 km de longitude vale
    // 4 segundos de horário, e 1 km de latitude, menos que isso.
    lat: +grau(m[1], m[2], m[3], m[4]).toFixed(2),
    lon: +grau(m[5], m[6], m[7], m[8]).toFixed(2),
  });
}

/* ── 2. todos os nomes de fuso que o tzdata conhece ── */

const todos = [];
(function varrer(dir, prefixo) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const nome = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) varrer(path.join(dir, entrada.name), nome);
    else if (!/\.(tab|zi)$|^\+VERSION$|^leap/.test(entrada.name)) todos.push(nome);
  }
})(ZONEINFO, '');

const hashDe = (zona) => {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(path.join(ZONEINFO, zona))).digest('hex');
  } catch {
    return null;
  }
};

const porHash = new Map();
for (const zona of canonicos.keys()) {
  const h = hashDe(zona);
  if (!h) continue;
  if (!porHash.has(h)) porHash.set(h, []);
  porHash.get(h).push(zona);
}

/* ── 3. apelidos ── */

const apelidos = new Map();
const descartados = [];
for (const zona of todos) {
  if (canonicos.has(zona)) continue;
  if (MANUAL[zona]) {
    apelidos.set(zona, MANUAL[zona]);
    continue;
  }
  let icu;
  try {
    icu = new Intl.DateTimeFormat('en', { timeZone: zona }).resolvedOptions().timeZone;
  } catch {
    continue; // nome que nem o ICU aceita: o aparelho não vai devolver
  }
  if (icu && icu !== zona && canonicos.has(icu)) {
    apelidos.set(zona, icu);
    continue;
  }
  const candidatos = porHash.get(hashDe(zona)) ?? [];
  if (candidatos.length === 1) {
    apelidos.set(zona, candidatos[0]);
    continue;
  }
  const mesmaRegiao = candidatos.filter((c) => c.split('/')[0] === zona.split('/')[0]);
  if (mesmaRegiao.length === 1) {
    apelidos.set(zona, mesmaRegiao[0]);
    continue;
  }
  descartados.push(zona);
}

/* ── 4. saída ── */

const versao = fs.existsSync(path.join(ZONEINFO, '+VERSION'))
  ? fs.readFileSync(path.join(ZONEINFO, '+VERSION'), 'utf8').trim()
  : 'desconhecida';

const linhasZonas = [...canonicos]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([zona, c]) => `${zona} ${c.lat} ${c.lon}`);
const linhasApelidos = [...apelidos]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([apelido, alvo]) => `${apelido} ${alvo}`);

const ts = `/**
 * GERADO por \`scripts/build-timezone-coords.mjs\` — não editar à mão.
 *
 * Fonte: tzdata ${versao} (\`/usr/share/zoneinfo/zone.tab\`), domínio público.
 * ${linhasZonas.length} fusos com coordenada, ${linhasApelidos.length} apelidos.
 *
 * Duas strings em vez de dois objetos: são ~16 KB de dado que quase nunca é
 * consultado — uma vez por sessão, para descobrir onde o aparelho está. Como
 * texto, o parser do JS engole num token só e o \`Map\` só é montado se alguém
 * perguntar. Como literal de objeto, seriam ${linhasZonas.length + linhasApelidos.length} propriedades para o
 * motor alocar em todo boot, inclusive de quem nunca usa o esquema solar.
 *
 * Formato: uma linha por fuso, \`Zona lat lon\`. Apelidos: \`Apelido Zona\`.
 */

export const TIMEZONE_COORDS_DATA = \`${linhasZonas.join('\n')}\`;

export const TIMEZONE_ALIASES_DATA = \`${linhasApelidos.join('\n')}\`;
`;

fs.writeFileSync(SAIDA, ts);
console.log(
  `${linhasZonas.length} fusos, ${linhasApelidos.length} apelidos, ` +
    `${descartados.length} descartados (${(ts.length / 1024).toFixed(1)} KB) → ${SAIDA}`,
);
if (descartados.length) console.log(`descartados: ${descartados.join(', ')}`);
