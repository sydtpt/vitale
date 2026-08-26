/**
 * Papel cromático de cada cartão da tira de **Recordes** do histórico.
 *
 * Antes isto era `HL_COLORS`: treze pares `bg`/`fg` de hex escritos à mão, em
 * duas cópias — uma no mobile, outra na web — com um comentário em cada pedindo
 * sincronia. Cor literal não responde a tema nem a paleta, e era exatamente o
 * que fazia a tira sair de modo claro no escuro. Ver
 * `docs/decisions/0022-tint-de-recorde-e-derivado-do-esquema.md`.
 *
 * Aqui só mora a associação destaque → papel. A cor sai de `resolveTokens()`,
 * como no resto do app, e a casca (preenchido ou contorno) sai do tema.
 *
 * ## A invariante é por fileira, não por tela
 *
 * São treze destaques para onze papéis, e não cabe. Mas o que precisa ser
 * distinto não é a tela inteira: é a **fileira**. Cada linha é um carrossel
 * horizontal próprio, e é ali que os cartões se comparam — dois cartões em
 * linhas diferentes nunca ficam lado a lado. Então `orange` pode servir
 * `longest` no resumo e `10000` nos recordes, e `brown`/`teal` podem se repetir
 * entre corrida e ciclismo. É o mesmo arranjo que `ACTIVITY_ROLE` já faz com
 * dezessete tipos de treino sobre oito papéis.
 *
 * ## `deep` não entra
 *
 * Medindo os 55 pares de papéis nas 36 combinações, só **dois** ficam abaixo do
 * piso de separação de 3,5 — e ambos são do `deep`: `orange×deep` cai a **1,0**
 * nas paletas `neon` e `joia`, e `red×deep` a **2,7** na `acessivel`. Como a
 * fileira de recordes da corrida já usa `red`, e o resumo logo acima usa
 * `orange`, não sobra lugar seguro para ele. `10000` era coral e ficou com
 * `orange`, que é o vizinho natural.
 */

import type { RoleKey } from '../theme/derive';

/**
 * Destaque → papel. As chaves DEVEM casar com as de `activityHighlights()` no
 * mobile e na web.
 *
 * Dois destaques andaram um passo de matiz porque treze não cabe em onze:
 * `half` era magenta e virou `rose`; `20000` era rosa e virou `red`. E
 * `1000 → ink` é escolha, não sobra: é o papel de menor contraste do conjunto
 * no escuro, o que faz do 1 km o cartão mais quieto da fileira — que é o certo
 * para a menor distância. A maratona ficou com `brown`, que é rico nos dois
 * esquemas; com `ink` ela saía apagada, e ela é a que menos pode.
 */
export const HIGHLIGHT_ROLE: Record<string, RoleKey> = {
  // Linha 1 — resumo de distância, nas duas telas.
  longest: 'orange',
  last12mo: 'blue',
  total: 'green',
  // Linha 2 — recordes por distância (best efforts), só corrida.
  marathon: 'brown',
  '40000': 'teal',
  '30000': 'purple',
  half: 'rose',
  '20000': 'red',
  // Coral → `orange`. Repete o papel de `longest`, que está na fileira de cima.
  '10000': 'orange',
  '5000': 'yellow',
  '1000': 'ink',
  // Linha 2 — recordes de elevação, só ciclismo.
  maxElev: 'brown',
  elev12mo: 'teal',
};

/** Papel de um destaque, com queda segura para quem não está no mapa. */
export function highlightRole(key: string): RoleKey {
  return HIGHLIGHT_ROLE[key] ?? 'ink';
}

/**
 * As fileiras que cada tela desenha, na ordem em que aparecem. A primeira é o
 * resumo de distância; a segunda, os recordes.
 *
 * Existe para o teste conseguir cobrar a invariante — sem isto, "papéis
 * distintos dentro da fileira" seria uma frase, não uma asserção, e o décimo
 * segundo destaque a quebraria em silêncio.
 */
export const HIGHLIGHT_ROWS: Record<'corrida' | 'ciclismo', readonly (readonly string[])[]> = {
  corrida: [
    ['longest', 'last12mo', 'total'],
    ['marathon', '40000', '30000', 'half', '20000', '10000', '5000', '1000'],
  ],
  ciclismo: [
    ['longest', 'last12mo', 'total'],
    ['maxElev', 'elev12mo'],
  ],
};
