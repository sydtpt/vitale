import React from 'react';
import { View } from 'react-native';
import {
  MODULO_DO_CADERNO,
  type CadernoId,
  type CelulaDaTira,
} from '@vitale/shared';
import { colors, moduleColors, useTheme } from '../../theme';
import {
  estiloDoVao,
  formaDaTira,
  vaoAntesDaCelula,
  type ColunasDaTira,
  type FormaDaTira,
} from './geometria-da-tira';

/**
 * Os doze meses de um caderno, lado a lado — **o desenho que a parede e o
 * anuário compartilham** (Stories 2.4b e 3.2).
 *
 * A tira nasceu na miniatura da parede, a 16 px, dentro de um `Pressable` que
 * abre a edição do ano. Na 3.2 ela virou também a abertura da edição do ano, a
 * 34 px e **sem toque nenhum**. O que é igual nas duas mora aqui e em
 * `geometria-da-tira.ts`; o que é de cada uma fica com ela.
 *
 * **Escrever de novo era a alternativa, e ela falha calada.** A tira do anuário
 * copiaria a tabela de cores e dois números, e o dia em que a paleta ganhasse um
 * papel ou o `soft` mudasse de conta, uma das duas mudaria junto e a outra não —
 * com a suíte inteira verde, porque nenhuma delas tem teste de pixel.
 *
 * ## O que cada célula diz
 *
 * Ela lê `metrica_lider`, **a chave carimbada**, e nunca um número:
 *
 * - **liderou com uma métrica** — bloco cheio, no `accent` do módulo;
 * - **saiu e nenhuma métrica liderou** (`metrica_lider` nulo) — bloco cheio, no
 *   `tint`. É o estado que a coluna nulável existe para registrar;
 * - **não saiu** — um **filete**, e não um bloco.
 *
 * ## Por que a ausência é forma, e não uma terceira cor
 *
 * Porque a medição recusou a terceira cor. `tint` contra a `line` do tema fica
 * **abaixo de ΔE 10 nas 144 combinações** de tema × esquema × paleta × caderno,
 * e abaixo de 3 em 49 delas — o pior par mede 1,2. Um tri-estado por cor seria
 * um bi-estado com uma promessa a mais: *"não saiu"* leria igual a *"saiu
 * calado"*. A forma separa presença de ausência sem depender de cor nenhuma, e à
 * cor sobra só o par que a medição sustenta (`accent` × `tint`, pior caso ΔE
 * 21,8). A catraca de `theme.test.ts:785` trava os dois lados disso — e a
 * segunda asserção dela é **invertida de propósito**: no dia em que todas as
 * combinações passarem de ΔE 10, ela reprova e a decisão se reabre.
 *
 * ## Cor
 *
 * `moduleColors(MODULO_DO_CADERNO[caderno])`, a mesma ponte da faixa de caderno
 * da 1.12: nenhuma tela escolhe cor, e a ponte caderno → módulo → papel é uma
 * só. Lida **no render**, nunca na folha de estilo — no escopo do módulo ela
 * congelaria na paleta do import.
 */
export interface CelulasDaTiraProps {
  celulas: readonly CelulaDaTira[];
  caderno: CadernoId;
  /** A altura da faixa, em pixel. Grampeada por `alturaDaTira`. */
  altura: number;
  /**
   * Como as doze colunas se dividem — ver o cabeçalho de `geometria-da-tira.ts`.
   *
   * Sem padrão, de propósito: a escolha decide se uma régua de meses pode
   * legendar as quatro tiras, e um padrão faria a tela nova herdar a grade da
   * parede sem ninguém decidir nada.
   */
  colunas: ColunasDaTira;
}

export function CelulasDaTira({ celulas, caderno, altura, colunas }: CelulasDaTiraProps) {
  // Assina o tema: a cor das células é lida por fora do React (`moduleColors` no
  // render), então uma troca de paleta ou de esquema não passa por prop nenhuma
  // e nada mais delataria a mudança. O pai da parede é `React.memo`; sem esta
  // assinatura, ele seguraria a folha antiga.
  useTheme();
  const forma = formaDaTira(altura);
  return (
    <View style={[FILA, { height: forma.celula.height }]}>
      {celulas.map((c, mes) => (
        <Celula key={mes} celula={c} caderno={caderno} indice={mes} forma={forma} colunas={colunas} />
      ))}
    </View>
  );
}

/** A fila dos doze — medidas, nenhuma cor. */
const FILA = Object.freeze({ flex: 1, flexDirection: 'row', alignItems: 'center' } as const);

/**
 * A cor de um estado, nos eixos ativos. Lida no render, nunca na folha.
 *
 * Três estados, duas cores e uma `line`: o par que carrega informação é `accent`
 * × `tint` (liderou × saiu calado); a `line` do estado ausente é só o traço que
 * a **forma** já distinguiu.
 *
 * **`switch` com saída exaustiva, e não um ternário encadeado.** Com o ternário,
 * um quarto estado em `CelulaDaTira` cairia no último ramo e seria pintado de
 * `line` — desenhado como filete? Não: a forma é decidida por `estado ===
 * 'ausente'`, então ele sairia como um **bloco cinza**, que na gramática da tira
 * não quer dizer nada. Aqui ele deixa de compilar.
 */
function corDaCelula(estado: CelulaDaTira['estado'], caderno: CadernoId): string {
  const cor = moduleColors(MODULO_DO_CADERNO[caderno]);
  switch (estado) {
    case 'metrica':
      return cor.accent;
    case 'sem-metrica':
      return cor.tint;
    case 'ausente':
      return colors.line;
    default:
      // Inalcançável pelo tipo. Se alguém contornar com `as`, o bloco em `tint`
      // ("saiu, sem líder") mente menos que o filete de `line` ("não saiu"): o
      // estado novo descreve, por construção, um mês que a edição registrou.
      return corDeEstadoNaoTratado(estado, cor.tint);
  }
}

function corDeEstadoNaoTratado(nunca: never, reserva: string): string {
  console.warn('[revista] estado de célula da tira sem cor definida:', nunca);
  return reserva;
}

/** Uma célula: a coluna com a altura da faixa, e a marca que muda de forma dentro dela. */
function Celula({ celula, caderno, indice, forma, colunas }: {
  celula: CelulaDaTira;
  caderno: CadernoId;
  indice: number;
  forma: FormaDaTira;
  colunas: ColunasDaTira;
}) {
  return (
    // A caixa externa tem sempre a altura da faixa — é ela que mantém as quatro
    // tiras alinhadas —, e o que muda de forma é a marca dentro dela.
    <View style={[forma.celula, estiloDoVao(colunas, vaoAntesDaCelula(celula, indice))]}>
      <View
        style={[
          forma.marca,
          celula.estado === 'ausente' ? forma.marcaAusente : null,
          { backgroundColor: corDaCelula(celula.estado, caderno) },
        ]}
      />
    </View>
  );
}

/**
 * A marca de um estado **fora da tira** — a amostra da legenda da parede.
 *
 * Ela existe aqui, e não na parede, porque é a mesma marca: uma segunda cópia da
 * regra forma-vs-cor numa legenda é a cópia que fica para trás quando a regra
 * muda.
 */
export function MarcaDaTira({ estado, caderno, altura }: {
  estado: CelulaDaTira['estado'];
  caderno: CadernoId;
  altura: number;
}) {
  useTheme();
  const forma = formaDaTira(altura);
  return (
    <View
      style={[
        forma.marca,
        estado === 'ausente' ? forma.marcaAusente : null,
        { backgroundColor: corDaCelula(estado, caderno) },
      ]}
    />
  );
}
