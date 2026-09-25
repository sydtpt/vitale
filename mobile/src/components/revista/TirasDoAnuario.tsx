import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MODULO_DO_CADERNO,
  rotuloDoCaderno,
  type CadernoId,
  type CelulaDaTira,
  type TiraDoAno,
} from '@vitale/shared';
import { colors, fonts, moduleColors, radii, shadows, spacing, useTheme, useThemedStyles } from '../../theme';
import { MUDO } from './constantes-da-capa';

/**
 * **O anuário na parede: quatro tiras, e nenhuma capa** (Story 2.4b).
 *
 * O contrato é literal em `docs/specs/revista-retrospectiva/cadernos.md`: *"São
 * quatro tiras de doze meses, uma por caderno, na cor do caderno. (…) O anuário
 * não tem capa: as quatro tiras são a capa do ano."* Por isso o ano ocupa a
 * largura inteira da parede, no lugar onde os meses têm duas colunas — ele não é
 * um mês grande, é outra forma.
 *
 * ## O que cada célula diz, e o que ela não diz
 *
 * Ela lê `metrica_lider`, **a chave carimbada**, e nunca um número. São três
 * estados por mês:
 *
 * - **o caderno liderou com uma métrica** — bloco cheio, no `accent` do módulo;
 * - **o caderno saiu e nenhuma métrica liderou** (`metrica_lider` nulo) — bloco
 *   cheio, no `tint`. É o estado que a coluna nulável existe para registrar;
 * - **o caderno não saiu** — um **filete**, e não um bloco.
 *
 * E, entre duas células, um vão maior marca **onde o líder trocou**. Sem ele,
 * doze meses liderados pelo mesmo fato e doze meses trocando de fato a cada mês
 * desenhariam a mesma barra, e *"quatro batimentos paralelos"* seria só uma frase.
 *
 * ## Por que a ausência é forma, e não uma terceira cor
 *
 * Porque a medição recusou a terceira cor. `tint` contra a `line` do tema fica
 * **abaixo de ΔE 10 nas 144 combinações** de tema × esquema × paleta × caderno, e
 * abaixo de 3 em 49 delas — o pior par mede 1,2. Um tri-estado por cor seria um
 * bi-estado com uma promessa a mais: "não saiu" leria igual a "saiu calado". A
 * forma separa presença de ausência sem depender de cor nenhuma, e à cor sobra só
 * o par que a medição sustenta (`accent` × `tint`, pior caso ΔE 21,8). O teste
 * `theme.test.ts` trava os dois lados disso.
 *
 * ## Cor
 *
 * `moduleColors(MODULO_DO_CADERNO[caderno])`, a mesma ponte da faixa de caderno
 * da 1.12: nenhuma tela escolhe cor, e a ponte caderno → módulo → papel é uma só.
 * Lida **no render**, nunca na folha de estilo — no escopo do módulo ela
 * congelaria na paleta do import.
 */
export interface TirasDoAnuarioProps {
  ano: number;
  /** O início do período, para o toque abrir a edição **deste** ano. */
  inicio: string;
  tiras: readonly TiraDoAno[];
  /** Estável por construção: quem o cria é a parede, uma vez. */
  onAbrir: (inicio: string) => void;
}

/**
 * O vão entre dois meses, e o vão que marca a **troca de líder**.
 *
 * Dois números, e a razão entre eles é o que se lê: 2 px separa meses vizinhos
 * sem os desgrudar, 7 px abre uma pausa que o olho reconhece como "aqui mudou".
 * Um só valor não conseguiria dizer as duas coisas, e um traço no meio da tira
 * competiria com a própria barra a 20 px de célula.
 */
const VAO_DO_MES = 2;
const VAO_DA_TROCA = 7;

/** A altura de uma tira — alta o bastante para a cor se ler, baixa para caber quatro. */
const ALTURA_DA_TIRA = 16;

/**
 * A altura do filete da **ausência** — um quarto do bloco.
 *
 * Um quarto, e não metade: a metade ainda lê como bloco baixo, e o que se quer é
 * que "não saiu" não seja confundido com "saiu". Centrado na faixa, ele desenha
 * uma pausa na linha, que é exatamente o que aquele mês foi.
 */
const ALTURA_DO_FILETE = Math.round(ALTURA_DA_TIRA / 4);

/** Quantos meses o caderno saiu, em palavras — o que o leitor de tela ouve. */
const meses = (n: number): string => (n === 1 ? '1 mês' : `${n} meses`);

/**
 * A tira, em palavras — os **três** estados e as trocas, e não só a contagem.
 *
 * "Sono em 9 meses" não decodifica nada: não separa o mês calado do mês ausente,
 * e não diz nada das trocas, que são a razão declarada de a tira existir. Quem
 * ouve tem de conseguir reconstruir o desenho.
 */
export function tiraEmPalavras(t: TiraDoAno): string {
  const comMetrica = t.celulas.filter((c) => c.estado === 'metrica').length;
  const calados = t.celulas.filter((c) => c.estado === 'sem-metrica').length;
  const trocas = t.celulas.filter((c) => c.estado === 'metrica' && c.mudou).length;
  const nome = rotuloDoCaderno(t.caderno);
  if (t.meses === 0) return `${nome}: não saiu no ano`;
  const partes = [`liderou em ${meses(comMetrica)}`];
  if (calados > 0) partes.push(`saiu sem líder em ${meses(calados)}`);
  partes.push(`não saiu em ${meses(t.celulas.length - t.meses)}`);
  if (trocas > 0) partes.push(trocas === 1 ? 'o líder mudou uma vez' : `o líder mudou ${trocas} vezes`);
  return `${nome}: ${partes.join(', ')}`;
}

export const TirasDoAnuario = React.memo(function TirasDoAnuario(
  { ano, inicio, tiras, onAbrir }: TirasDoAnuarioProps,
) {
  const styles = useThemedStyles(createStyles);
  // Assina o tema: é o que faz o `React.memo` continuar respondendo à troca de
  // paleta e de esquema, que não passam por props — a cor das células é lida no
  // render, por fora do React, e nada mais delataria a troca.
  useTheme();

  /**
   * Um alvo de toque só, e um rótulo só. Tiras aninhadas como elementos separados
   * fariam o VoiceOver parar quatro vezes dentro de um botão — e a 1.16 já
   * estabeleceu que a capa é um alvo, com o texto lido como texto.
   */
  const falado = `O anuário de ${ano}. ${tiras.map(tiraEmPalavras).join('. ')}.`;

  return (
    <Pressable
      onPress={() => onAbrir(inicio)}
      accessibilityRole="button"
      accessibilityLabel={falado}
      accessibilityHint="Abre a edição"
      style={({ pressed }) => [styles.bloco, pressed && styles.pressionado]}
    >
      <Text style={styles.eyebrow}>O anuário</Text>
      <View {...MUDO}>
        {tiras.map((t) => (
          <View key={t.caderno} style={styles.linha}>
            <Text style={styles.caderno} numberOfLines={1}>{rotuloDoCaderno(t.caderno)}</Text>
            <View style={styles.tira}>
              {t.celulas.map((c, mes) => (
                <Celula key={mes} celula={c} caderno={t.caderno} primeiro={mes === 0} styles={styles} />
              ))}
            </View>
          </View>
        ))}
      </View>
      {/* A legenda. Sem ela a tira é bonita e muda: três alturas e duas cores não
          se decodificam por conta própria, e o dono não tem onde perguntar. */}
      <View style={styles.legenda} {...MUDO}>
        <Amostra estado="metrica" texto="liderou" styles={styles} />
        <Amostra estado="sem-metrica" texto="sem líder" styles={styles} />
        <Amostra estado="ausente" texto="não saiu" styles={styles} />
        <Text style={styles.legendaNota}>vão maior = o líder mudou</Text>
      </View>
    </Pressable>
  );
});

/** A cor de um estado, nos eixos ativos. Lida no render, nunca na folha. */
function corDaCelula(estado: CelulaDaTira['estado'], caderno: CadernoId): string {
  const cor = moduleColors(MODULO_DO_CADERNO[caderno]);
  return estado === 'metrica' ? cor.accent : estado === 'sem-metrica' ? cor.tint : colors.line;
}

function Celula({ celula, caderno, primeiro, styles }: {
  celula: CelulaDaTira;
  caderno: CadernoId;
  primeiro: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const ausente = celula.estado === 'ausente';
  const mudou = celula.estado === 'metrica' && celula.mudou;
  return (
    // A caixa externa tem sempre a altura da faixa — é ela que mantém as quatro
    // tiras alinhadas —, e o que muda de forma é a marca dentro dela.
    <View style={[styles.celula, primeiro ? null : { marginLeft: mudou ? VAO_DA_TROCA : VAO_DO_MES }]}>
      <View
        style={[
          styles.marca,
          ausente ? styles.marcaAusente : null,
          { backgroundColor: corDaCelula(celula.estado, caderno) },
        ]}
      />
    </View>
  );
}

/** Uma amostra da legenda: a marca do estado, no tamanho em que ela aparece. */
function Amostra({ estado, texto, styles }: {
  estado: CelulaDaTira['estado'];
  texto: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.amostra}>
      <View style={styles.amostraCaixa}>
        <View
          style={[
            styles.marca,
            estado === 'ausente' ? styles.marcaAusente : null,
            // A amostra usa o **primeiro** caderno como cor: ela explica a forma e
            // a intensidade, não qual caderno é qual — isso o nome ao lado da tira
            // já diz.
            { backgroundColor: corDaCelula(estado, 'sono') },
          ]}
        />
      </View>
      <Text style={styles.legendaTxt}>{texto}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.xs,
      ...shadows.card,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 2,
    },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: ALTURA_DA_TIRA + 6 },
    // Largura fixa: os quatro nomes alinham, e as quatro tiras começam na mesma
    // coluna — é o alinhamento que faz os "batimentos" serem comparáveis.
    caderno: { width: 74, fontSize: 11, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    tira: { flex: 1, flexDirection: 'row', alignItems: 'center', height: ALTURA_DA_TIRA },
    // `flex: 1` e não largura medida: os doze dividem o que sobra depois dos vãos,
    // então a troca de líder abre a pausa sem a tira estourar a caixa.
    celula: { flex: 1, height: ALTURA_DA_TIRA, justifyContent: 'center' },
    // Um quinto do lado, como na célula da `CapaGrade`, e pelo mesmo motivo: o
    // quadrado puro lê como pixel de tabela, e o raio grande, como bolinha.
    marca: { width: '100%', height: ALTURA_DA_TIRA, borderRadius: ALTURA_DA_TIRA / 5 },
    marcaAusente: { height: ALTURA_DO_FILETE, borderRadius: ALTURA_DO_FILETE / 2 },

    legenda: {
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
      gap: spacing.md, marginTop: spacing.xs, paddingLeft: 74 + spacing.sm,
    },
    amostra: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    amostraCaixa: { width: 14, height: ALTURA_DA_TIRA, justifyContent: 'center' },
    // Informação obrigatória nunca na tinta mais fraca: a legenda é o que torna a
    // tira legível, não é cromo.
    legendaTxt: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },
    legendaNota: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },
    pressionado: { opacity: 0.7 },
  });
