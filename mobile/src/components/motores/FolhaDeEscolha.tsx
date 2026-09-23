/**
 * A **folha de escolha**: quem escreve uma leitura, neste aparelho (fatia 3 do redesenho).
 *
 * Ela substitui o que a tela raiz fazia — repetir os N motores dentro de **cada** recurso.
 * Com 3 recursos × 5 motores aquilo já era 15 cartões empilhados, e as duas listas vão
 * crescer: a de leituras (nome de rota, edição de imagem, avaliar atividade…) e a de
 * modelos. A raiz passa a ser `recursos + motores`, e o catálogo inteiro vive aqui, aberto
 * por toque, agrupado por **onde roda** — sem modelo · no aparelho · fora do aparelho.
 *
 * O que esta folha promete, e que a lista de antes não prometia:
 *
 * - **"Sem modelo" não é neutro em toda leitura.** Na Retrospectiva e no nome de rota o
 *   `semModelo` do descritor devolve uma **lápide**, e a opção escreve a lápide — oferecer
 *   ali a frase neutra apresentaria como alternativa equivalente o que o código declara
 *   como ausência (`folha-regras.ts`, `DETALHE_DO_SEM_MODELO`).
 * - **Uma opção "consultando" é ocupada, não indisponível.** Forma livre, anunciada `busy`,
 *   e **sem toque**: gravar a preferência antes de a resposta voltar escreveria a escolha
 *   de um motor que o próprio diagnóstico vai recusar meio segundo depois.
 * - **A preferência que aponta para um motor que sumiu é dita em palavras, com o id.** Sem
 *   isso a folha marcaria a opção do recuo e nada explicaria a troca.
 * - **O atalho para Comparar marca só quem já nasceria ligado** (decisão do dono, 23/09) e
 *   **conta** as colunas que vão correr. Os pesos abertos continuam fora por ali também:
 *   cada um sobe mais de um gigabyte e é o elo mais lento da corrida.
 *
 * A folha sobe sobre a tela raiz, que continua visível atrás do véu — a escolha é sobre um
 * item daquela lista, e sair dela é voltar ao mesmo lugar. O véu é `mediaVeil`, a única cor
 * do app que **não** responde ao esquema, e é de propósito: `ink` a 60% é tinta **clara** no
 * escuro e clarearia justamente o que o véu existe para escurecer.
 */
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { resolverCadeia, type Descritor, type MotorId } from '@vitale/shared';
import { motivoDeBloqueio, type EstadoDaCompilacao, type MotorConhecido } from '../../lib/motores/catalogo';
import {
  NOME_DO_GRUPO,
  PRECO_DE_COMPILAR,
  agruparPorOndeRoda,
  colunasDoAtalho,
  detalheDaOpcao,
  ofereceCompilar,
  rotuloDoAtalho,
  subtituloDaFolha,
  subtituloDoAtalho,
  trocaDeMotorSumido,
} from '../../lib/motores/folha-regras';
import { corComAlfa } from '../../lib/veu';
import { colors, fonts, mediaVeil, radii, spacing, useThemedStyles } from '../../theme';

/** A profundidade do véu sob a folha — a tela de trás continua legível como contexto. */
const VEU_DA_FOLHA = 0.6;

/** O alvo de qualquer linha que abre ou grava. Mínimo, nunca altura. */
const ALVO = 44;
/** O alvo de um controle que vive **em linha** com outro — a pílula. */
const ALVO_COMPACTO = 36;

export interface FolhaDeEscolhaProps {
  /** A leitura desta folha, ou `null` quando ela está fechada. */
  readonly recurso: Descritor<unknown, unknown> | null;
  readonly nomeDaLeitura: string;
  /** O catálogo já fundido com a lista do servidor, daquele recurso. */
  readonly motores: readonly MotorConhecido[];
  /** O que está **gravado** — que pode não ser quem escreve. */
  readonly escolhido: MotorId | null;
  readonly compilacao: Readonly<Record<string, EstadoDaCompilacao>>;
  readonly onEscolher: (motor: MotorId) => void;
  readonly onFechar: () => void;
  readonly onComparar: () => void;
}

export function FolhaDeEscolha({
  recurso,
  nomeDaLeitura,
  motores,
  escolhido,
  compilacao,
  onEscolher,
  onFechar,
  onComparar,
}: FolhaDeEscolhaProps) {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  /**
   * Quem escreveria **agora** — e é ele que a folha marca, não o id gravado.
   *
   * Os dois coincidem quase sempre; quando não coincidem é porque a preferência aponta para
   * um motor que sumiu, e aí a linha da troca explica por que a marca está noutro lugar.
   */
  const efetivo = useMemo(
    () => (recurso === null ? null : resolverCadeia(recurso, escolhido, motores.map((m) => m.id))[0] ?? null),
    [recurso, escolhido, motores],
  );

  const grupos = useMemo(() => agruparPorOndeRoda(motores), [motores]);
  const troca = useMemo(
    () => (recurso === null || efetivo === null ? null : trocaDeMotorSumido({ escolhido, efetivo, conhecidos: motores })),
    [recurso, efetivo, escolhido, motores],
  );
  const colunas = useMemo(
    () =>
      recurso === null
        ? 0
        : colunasDoAtalho(motores, {
            regimeMaximo: recurso.regimeMaximo,
            recurso: recurso.recurso,
            compilacao,
          }),
    [recurso, motores, compilacao],
  );

  return (
    <Modal visible={recurso !== null} transparent animationType="slide" onRequestClose={onFechar}>
      {/* O véu, e o toque fora que fecha sem mudar nada. */}
      <Pressable
        style={[s.veu, { backgroundColor: corComAlfa(mediaVeil, VEU_DA_FOLHA) }]}
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar sem escolher"
      />
      {recurso !== null ? (
        // O respiro de baixo é o maior entre o da folha e o indicador de início do iPhone:
        // o atalho é o último elemento, e é ele que encostaria nele.
        <View style={[s.folha, { paddingBottom: Math.max(insets.bottom, spacing['2xl']) }]} accessibilityViewIsModal>
          <View style={s.alca} />
          <View style={s.cabecalho}>
            <Text style={s.titulo} accessibilityRole="header">
              {nomeDaLeitura}
            </Text>
            <Text style={s.subtitulo}>{subtituloDaFolha(recurso.grava)}</Text>
            {/* A troca que ninguém pediu — com o id, que é o único traço do que ele escolhera. */}
            {troca !== null ? <Text style={s.troca}>{troca}</Text> : null}
          </View>

          <ScrollView style={s.rolagem} contentContainerStyle={s.corpo} showsVerticalScrollIndicator={false}>
            {grupos.map((g) => (
              <View key={g.grupo} style={s.grupo}>
                <Text style={s.grupoTitulo}>{NOME_DO_GRUPO[g.grupo]}</Text>
                {g.motores.map((m) => (
                  <Opcao
                    key={m.id}
                    motor={m}
                    selecionado={m.id === efetivo}
                    motivo={motivoDeBloqueio(recurso, m.id, motores)}
                    detalhe={detalheDaOpcao(m, recurso.recurso, compilacao)}
                    compilar={ofereceCompilar(m.id, compilacao)}
                    onPress={() => onEscolher(m.id)}
                    s={s}
                  />
                ))}
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={onComparar}
            accessibilityRole="button"
            accessibilityLabel={`${rotuloDoAtalho(colunas)} — ${subtituloDoAtalho(colunas)}`}
            style={({ pressed }) => [s.atalho, pressed && s.pressed]}
          >
            <Text style={s.atalhoTexto}>{rotuloDoAtalho(colunas)}</Text>
            <Text style={s.atalhoSub}>{subtituloDoAtalho(colunas)}</Text>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Uma opção da folha — quatro formas, e a terceira é a que estava faltando.
 *
 * **livre** responde ao toque; **selecionada** ganha borda da marca e tique (borda, não
 * fundo preenchido: a folha pode ter oito opções, e um bloco laranja no meio de uma pilha
 * grita mais alto que a pergunta); **bloqueada** é superfície apagada com o motivo escrito,
 * nunca em vermelho — um motor bloqueado é propriedade do recurso, não erro do dono; e
 * **ocupada** tem a forma livre e não responde ao toque, porque ainda não se sabe se ela
 * está indisponível, e a resposta pode vir dizendo que está.
 */
function Opcao({
  motor,
  selecionado,
  motivo,
  detalhe,
  compilar,
  onPress,
  s,
}: {
  motor: MotorConhecido;
  selecionado: boolean;
  /** Por que não dá, em palavras — ou `null`, se dá. */
  motivo: string | null;
  detalhe: string;
  /** Este modelo está instalado e não compilado? */
  compilar: boolean;
  onPress: () => void;
  s: Styles;
}) {
  const consultando = motor.consultando === true;
  // "Consultando" não é "indisponível", e também não é tocável: o diagnóstico a caminho
  // pode voltar `ausente`, e gravar antes disso escreveria a escolha de um motor que o
  // próprio diagnóstico vai recusar em seguida.
  const bloqueado = motivo !== null && !consultando;
  const inerte = bloqueado || consultando;
  const rotulo = consultando
    ? `${motor.rotulo} — consultando o aparelho`
    : `${motor.rotulo} — ${detalhe}${bloqueado ? ` — indisponível: ${motivo}` : ''}${
        compilar ? `. ${PRECO_DE_COMPILAR}` : ''
      }`;
  return (
    <Pressable
      onPress={inerte ? undefined : onPress}
      // `disabled` **só quando bloqueado**: o React Native o funde no
      // `accessibilityState`, e passá-lo na opção "consultando" a anunciaria como um motor
      // que não existe — que é justamente a distinção que ela carrega. Quem a torna
      // intocável ali é o `onPress` ausente.
      disabled={bloqueado}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionado, disabled: bloqueado, busy: consultando }}
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        s.opcao,
        selecionado && s.opcaoSelecionada,
        bloqueado && s.opcaoBloqueada,
        pressed && !inerte && s.pressed,
      ]}
    >
      <View style={s.opcaoTexto}>
        <Text style={[s.opcaoNome, bloqueado && s.opcaoNomeBloqueado]}>{motor.rotulo}</Text>
        <Text style={s.opcaoDetalhe}>{detalhe}</Text>
        {/* O motivo é informação obrigatória — texto, e por isso em `ink2`, nunca `ink3`. */}
        {bloqueado ? <Text style={s.opcaoMotivo}>{motivo}</Text> : null}
        {/* A causa de a pílula não responder, escrita: um controle abafado sem explicação é
            o defeito que esta família inteira existe para não ter. */}
        {compilar ? <Text style={s.opcaoMotivo}>{PRECO_DE_COMPILAR}</Text> : null}
      </View>
      {/* Tracejada e abafada de propósito: o tracejado diz "isto não é um controle" sem
          gastar uma palavra, e ela não é mesmo — a tela de compilar é a fatia 2. */}
      {compilar ? (
        <View style={s.pilula}>
          <Text style={s.pilulaTexto}>Compilar</Text>
        </View>
      ) : null}
      {selecionado ? <Ionicons name="checkmark" size={18} color={colors.primary} style={s.tique} /> : null}
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressed: { opacity: 0.6 },
    veu: { flex: 1 },
    folha: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radii['3xl'],
      borderTopRightRadius: radii['3xl'],
      maxHeight: '88%',
    },
    alca: {
      width: 38,
      height: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.lineDeep,
      alignSelf: 'center',
      marginTop: spacing.md,
    },

    cabecalho: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: 3 },
    titulo: { fontSize: 26, lineHeight: 31, fontFamily: fonts.serif, color: colors.ink },
    subtitulo: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },
    troca: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2, marginTop: spacing.xs },

    rolagem: { flexGrow: 0 },
    corpo: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
    grupo: { gap: 7, marginBottom: spacing.sm },
    grupoTitulo: {
      fontSize: 11,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginTop: spacing.sm,
    },

    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      // Mínimo, nunca altura: em Texto grande a opção cresce e o detalhe continua inteiro.
      minHeight: ALVO,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: colors.line,
      padding: 13,
    },
    opcaoSelecionada: { borderColor: colors.primary },
    opcaoBloqueada: { backgroundColor: colors.surfaceMute },
    // `flexShrink` com `minWidth: 0` nos dois lados: uma fileira que não encolhe empurra os
    // irmãos para fora da tela — a lição da fatia 4, que aqui custaria o motivo de um motor
    // bloqueado, que é a única coisa que explica por que ele não responde ao toque.
    opcaoTexto: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    opcaoNome: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    opcaoNomeBloqueado: { color: colors.ink2 },
    opcaoDetalhe: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    opcaoMotivo: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2, marginTop: 2 },

    pilula: {
      flexShrink: 1,
      minWidth: 0,
      minHeight: ALVO_COMPACTO,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.line,
    },
    pilulaTexto: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    tique: { flexShrink: 0 },

    atalho: {
      minHeight: 48,
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
    },
    // `bg`, e não `onPrimary`: a tinta e o fundo se invertem juntos com o esquema e o par
    // continua legível; `onPrimary` é a cor de cima da **marca**, e com a marca `tinta` no
    // escuro ela viraria laranja sobre tinta.
    atalhoTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.bg, textAlign: 'center' },
    atalhoSub: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.bg, opacity: 0.75, textAlign: 'center' },
  });
