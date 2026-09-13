import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { rotuloDoCaderno, type CadernoImpresso } from '@vitale/shared';
// **O tipo vem da store, e não é cópia.** Ele era declarado aqui de novo, letra
// por letra: duas uniões gêmeas mantidas à mão, e nada obrigava a segunda a
// acompanhar a primeira — uma fase nova na store nascia sem desenho, calada.
// `import type` some na compilação, então isto não cria dependência em runtime
// do componente para a store.
import type { EstadoEdicao } from '../store/edicao.store';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../theme';

/**
 * A edição — os cadernos escritos por modelo (ADRs 0038 e 0040 · Story 1.9).
 *
 * Cinco decisões de tela que vêm do desenho, não do gosto:
 *
 * 1. **O que não pode existir não aparece.** Período em curso e período que
 *    nunca fecha não são botão desabilitado nem aviso: são ausência. Um jornal
 *    não anuncia a edição que ainda não fechou, e muito menos uma que não sai.
 * 2. **A ordem é a gravada.** Os cadernos chegam ordenados por `posicao`, que
 *    congelou na última impressão. Esta tela não ordena nada — se ordenasse,
 *    ajustar um peso do ranqueamento reordenaria agosto sozinho.
 * 3. **A assinatura é por caderno.** Provedor, modelo e data embaixo de cada um.
 *    O leitor precisa saber que aquilo foi escrito por máquina, e qual — é a
 *    mesma razão pela qual jornal assina coluna. Por caderno porque a errata é
 *    por caderno: Sono fica velho sem tocar em Movimento.
 * 4. **Toque tem resposta.** A primeira leitura é silenciosa (senão o cartão
 *    pisca a cada foco da tela), mas a releitura que o leitor pediu desenha
 *    progresso — um toque que apaga o cartão e não devolve nada é um toque
 *    perdido.
 * 5. **Escrever está parado, e o aviso diz isso em português de jornal.** Sem
 *    nome de story, sem vocabulário de implementação: quem lê a revista não sabe
 *    o que é "o núcleo", e não deveria precisar saber.
 *
 * A **errata** não mora aqui ainda de propósito: ela é por caderno, e o desenho
 * dos sete estados por caderno é da Story 1.12. `precisaErrata` continua sendo o
 * dono da conta, sem consumidor de tela.
 */

interface Props {
  estado: EstadoEdicao;
  /** Relê a edição. **Não** escreve — não há caminho de escrita nesta tela. */
  onRecarregar: () => void;
}

/**
 * O ramo que não existe. Se a união da store ganhar uma fase e o `switch` abaixo
 * não a tratar, `nunca` deixa de ser `never` e o **compilador** reprova — que é
 * o que o `return` final de antes não fazia: `nao-escrita` caía nele por
 * ausência de ramo próprio, e uma fase nova cairia no mesmo lugar, herdando o
 * desenho de outra coisa sem nada acusar.
 *
 * **Em tempo de execução ele não lança**, e isso é deliberado. A exaustividade
 * já está garantida onde ela é barata — no compilador, pelo parâmetro `never` —,
 * e o único jeito de chegar aqui em produção é um estado que o tipo diz não
 * existir (um `setState` de fora do módulo, um bundle meio velho). Lançar dentro
 * do render trocaria um cartão faltando pela **Retrospectiva inteira caindo**:
 * o preço do defeito ficaria muito acima do defeito. Some o cartão, e o motivo
 * vai para o log, que é onde ele serve.
 */
function faseNaoTratada(nunca: never): null {
  console.warn('[edicao] fase sem desenho no cartão:', nunca);
  return null;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function assinatura(c: CadernoImpresso): string {
  const quando = DATA.format(new Date(c.geradoEm));
  return `${c.modelo} · ${quando}`;
}

export function EdicaoCard({ estado, onRecarregar }: Props) {
  const styles = useThemedStyles(createStyles);

  // **Exaustivo, e não uma cadeia de `if` com um `return` de sobra no fim.**
  // Toda fase da store tem ramo com nome; a que não tiver não compila.
  switch (estado.fase) {
    // Ausência é ausência: sem cartão, sem aviso, sem espaço reservado. E a
    // primeira leitura não pisca.
    case 'ausente':
    case 'carregando':
      return null;

    case 'pronta':
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A edição</Text>
          {estado.edicao.map((c, i) => (
            <View key={c.caderno} style={[styles.caderno, i > 0 && styles.separado]}>
              <Text style={styles.rotulo}>{rotuloDoCaderno(c.caderno)}</Text>
              <Text style={styles.texto}>{c.texto}</Text>
              <Text style={styles.assinatura}>{assinatura(c)}</Text>
            </View>
          ))}
        </View>
      );

    case 'relendo':
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A edição</Text>
          <View style={styles.linha}>
            <ActivityIndicator size="small" color={colors.ink3} />
            <Text style={styles.lab}>Procurando a edição…</Text>
          </View>
        </View>
      );

    case 'erro':
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A edição</Text>
          <Text style={styles.lab}>{estado.mensagem}</Text>
          {/* Relê. O botão antigo chamava a GERAÇÃO depois de um erro de leitura —
              uma chamada paga disparada por uma falha de rede. E é o ÚNICO
              caminho de releitura depois de um erro: a leitura automática desistiu
              dele, para o toque ter o que fazer. */}
          <Pressable style={styles.botao} onPress={onRecarregar}>
            <Text style={styles.botaoTxt}>Tentar de novo</Text>
          </Pressable>
        </View>
      );

    // Sem sessão. Não é erro do app nem período sem edição — e por isso não
    // ganha "Tentar de novo": tentar de novo não resolve o que falta.
    case 'sem-sessao':
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A edição</Text>
          <Text style={styles.lab}>Entre na sua conta para ler a edição.</Text>
        </View>
      );

    // Fechado e não escrito. O aviso ocupa o lugar exato do botão que existia.
    case 'nao-escrita':
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A edição</Text>
          <Text style={styles.lab}>Este período fechou e ainda não foi escrito.</Text>
          <Text style={styles.nota}>A impressão está parada. Quando voltar, a edição sai em cadernos.</Text>
        </View>
      );

    default:
      return faseNaoTratada(estado);
  }
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: radii['2xl'],
      padding: spacing.lg, gap: 6, ...shadows.card,
    },
    // O olho da seção: caixa alta, entreletra larga, tinta fraca. É cromo.
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 2,
    },
    caderno: { gap: 4 },
    // O filete separa cadernos — só ENTRE eles. No primeiro bloco ele viraria um
    // risco entre o olho da seção e o nome do caderno, partindo o cabeçalho ao
    // meio.
    separado: {
      paddingTop: spacing.sm, marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    },
    // O nome do caderno é CONTEÚDO, e o olho acima é cromo: caixa normal e tinta
    // mais forte subordinam um ao outro sem os fazer competir. Repetir a fórmula
    // do olho aqui dava dois títulos disputando a mesma linha.
    rotulo: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    // Serifada e com entrelinha larga: é texto para ler, não dado para conferir.
    texto: { fontSize: 15, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },
    assinatura: {
      fontSize: 11, fontFamily: fonts.mono, color: colors.ink4,
      marginTop: spacing.xs,
    },
    lab: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sans, lineHeight: 18 },
    nota: { fontSize: 11.5, color: colors.ink4, fontFamily: fonts.sans, lineHeight: 17 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    botao: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: radii.lg,
      paddingVertical: 10, marginTop: spacing.sm,
    },
    botaoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.primaryOn },
  });
