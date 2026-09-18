import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fichaDaCapa, type ActivityPhoto, type Capa, type SecaoDoSeletor } from '@vitale/shared';
import type { FotoDaCapa } from '../../hooks/useFotoDaCapa';
import { corComAlfa } from '../../lib/veu';
import { getActivityMeta } from '../../lib/workout-types';
import { useActivitiesStore } from '../../store/activities.store';
import type { ResultadoDaTroca } from '../../store/edicao.store';
import {
  baseBg,
  colors,
  fonts,
  mediaVeil,
  onMedia,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
} from '../../theme';
import { SeletorDaCapa } from './SeletorDaCapa';

/**
 * A capa aberta (Story 1.16) — a foto expandida, a **ficha** embaixo dela e, na
 * segunda face, o seletor da troca.
 *
 * ## Um `Modal`, duas faces
 *
 * A ficha e o seletor são as duas faces do **mesmo** `Modal`, e não dois: o iOS
 * não empilha um terceiro modal sobre o segundo (achado das fotos na pedalada), e
 * a troca mora só dentro da ficha. Quem monta este componente o põe **fora** do
 * `ScrollView` da edição, que continua montado por baixo — fechar devolve a
 * edição na mesma posição de rolagem.
 *
 * ## A ficha é bastidor, e é papel
 *
 * A ficha senta **embaixo** da foto, nunca por cima: a foto aqui é o conteúdo, sem
 * véu e sem texto em cima. O fundo da ficha é o papel (`bg`), mono no que é
 * medida, serifada só no porquê, rótulos em `ink2`. Só o porquê é carimbado;
 * quando, atividade e rota são lidos **ao vivo** — renomear a pedalada muda a
 * ficha, e isso está certo, porque a edição impressa não muda com ela.
 */
export interface CapaAbertaProps {
  visivel: boolean;
  onFechar: () => void;
  /** "A capa de julho de 2026" — `tituloDaCapa`. */
  titulo: string;
  /** A capa carimbada. Só a de foto abre, e é o chamador quem garante isso. */
  capa: Capa;
  /** A imagem da capa, já resolvida pela rota — a mesma que a capa desenha. */
  foto: FotoDaCapa;
  /** As fotos que podem ir para a capa — `fotosParaCapa`. Rejeita quando não dá para saber. */
  carregarFotos: () => Promise<readonly SecaoDoSeletor[]>;
  /** A troca — a ação da store, que nunca rejeita. */
  trocar: (foto: ActivityPhoto) => Promise<ResultadoDaTroca>;
}

type Face = 'ficha' | 'seletor';

export function CapaAberta({ visivel, onFechar, titulo, capa, foto, carregarFotos, trocar }: CapaAbertaProps) {
  const [face, setFace] = useState<Face>('ficha');
  /** Uma troca corre no seletor: o voltar do sistema fica inerte até ela voltar. */
  const [trocando, setTrocando] = useState(false);

  // Fechar recomeça pela ficha: reabrir a capa nunca cai no meio de uma troca antiga.
  useEffect(() => {
    if (!visivel) setFace('ficha');
  }, [visivel]);
  // Fora do seletor não há troca correndo que a tela acompanhe.
  useEffect(() => {
    if (face === 'ficha' || !visivel) setTrocando(false);
  }, [face, visivel]);

  /**
   * O voltar do sistema desfaz um passo: do seletor para a ficha, da ficha para a
   * edição. **Com uma troca correndo, não faz nada** — sair no meio descartaria a
   * mensagem de uma falha em silêncio, e é a mesma regra do "Voltar" do seletor.
   */
  const aoPedirFechar = (): void => {
    if (trocando) return;
    if (face === 'seletor') setFace('ficha');
    else onFechar();
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={aoPedirFechar}
    >
      {face === 'ficha' ? (
        <FaceDaFicha
          titulo={titulo}
          capa={capa}
          foto={foto}
          onFechar={onFechar}
          onTrocar={() => setFace('seletor')}
        />
      ) : (
        <SeletorDaCapa
          titulo={titulo}
          fotoNaCapa={capa.fotoId}
          carregarFotos={carregarFotos}
          trocar={trocar}
          onVoltar={() => setFace('ficha')}
          // A troca deu certo: volta à ficha, que já lê a capa nova — a foto nova e
          // "Você escolheu esta.".
          onTrocada={() => setFace('ficha')}
          onTrocando={setTrocando}
        />
      )}
    </Modal>
  );
}

/** O rótulo do tipo da atividade, último recurso do nome — o vocabulário é do app. */
const ROTULO_SEM_TIPO = 'Atividade';

function FaceDaFicha({ titulo, capa, foto, onFechar, onTrocar }: {
  titulo: string;
  capa: Capa;
  foto: FotoDaCapa;
  onFechar: () => void;
  onTrocar: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { scheme } = useTheme();

  /**
   * A atividade da foto, lida **ao vivo** do acervo visível pelo id carimbado. A
   * escondida conta como fora do acervo: a ficha fica sem atividade e sem rota,
   * que é a mesma degradação de uma que não se acha.
   */
  const todas = useActivitiesStore((s) => s._all);
  const atividade = useMemo(
    () => (capa.fotoActivityId
      ? todas.find((a) => a.id === capa.fotoActivityId && !a.hidden) ?? null
      : null),
    [todas, capa.fotoActivityId],
  );
  const ficha = useMemo(
    () => fichaDaCapa(capa, atividade, atividade ? getActivityMeta(atividade.activityId).label : ROTULO_SEM_TIPO),
    [capa, atividade],
  );

  // 4:3, como a foto de pedalada: a foto inteira, sem corte (`contain`), e a que
  // não é 4:3 ganha faixa no véu em volta — nunca recorte.
  const alturaDaFoto = Math.round((width * 3) / 4);

  return (
    <View style={[styles.raiz, { backgroundColor: baseBg(scheme) }]}>
      {/* O topo é escuro nos dois esquemas: a foto é que manda. */}
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['2xl'] }}
      >
        <View style={[styles.palco, { paddingTop: insets.top }]}>
          <View style={styles.barra}>
            <Pressable
              onPress={onFechar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
            >
              <Ionicons name="close" size={22} color={onMedia} />
            </Pressable>
            <Text style={styles.titulo} numberOfLines={1} accessibilityRole="header">{titulo}</Text>
          </View>

          <View style={{ width, height: alturaDaFoto }}>
            {foto.estado === 'pronta' ? (
              // A legenda carimbada é a descrição da imagem — a mesma que a capa usa.
              <Image
                source={{ uri: foto.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel={`A foto da capa: ${capa.legenda}`}
              />
            ) : foto.estado === 'procurando' ? (
              <View style={styles.centro}>
                <ActivityIndicator size="small" color={onMedia} />
              </View>
            ) : (
              // A imagem não resolveu (ou saiu da biblioteca): a ficha continua
              // abrindo, porque ela sabe o que a foto era — e a legenda carimbada
              // fica no lugar dela.
              <View style={styles.centro}>
                <Text style={styles.legendaNoPalco}>{capa.legenda}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.ficha}>
          <Text style={styles.rotuloDoTopo} accessibilityRole="header">Por que esta foto</Text>
          <Text style={styles.porque}>{ficha.porque}</Text>
          {ficha.nota ? (
            <Text style={ficha.nota.mono ? styles.notaMono : styles.nota}>{ficha.nota.texto}</Text>
          ) : null}

          <View style={styles.filete} />

          <View style={styles.linhas}>
            {ficha.quando ? (
              <LinhaDaFicha rotulo="Quando" fala={ficha.quando}>
                <Text style={styles.valorMono}>{ficha.quando}</Text>
              </LinhaDaFicha>
            ) : null}
            {ficha.atividade ? (
              <LinhaDaFicha
                rotulo="Na atividade"
                fala={ficha.atividade.distancia
                  ? `${ficha.atividade.nome}, ${ficha.atividade.distancia}`
                  : ficha.atividade.nome}
              >
                <Text style={styles.nomeDaAtividade}>{ficha.atividade.nome}</Text>
                {ficha.atividade.distancia ? (
                  <Text style={styles.distancia}>{ficha.atividade.distancia}</Text>
                ) : null}
              </LinhaDaFicha>
            ) : null}
            {ficha.rota ? (
              <LinhaDaFicha rotulo="A rota" fala={ficha.rota}>
                <Text style={styles.rota}>{ficha.rota}</Text>
              </LinhaDaFicha>
            ) : null}
          </View>

          {/* O ato, com o peso de ato: o botão principal, na marca, como "Escrever a edição". */}
          <Pressable
            onPress={onTrocar}
            accessibilityRole="button"
            accessibilityLabel="Trocar a capa"
            style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
          >
            <Text style={styles.botaoTxt}>Trocar a capa</Text>
          </Pressable>
          <Text style={styles.aviso}>Trocar recarimba a capa. O texto da edição não muda.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Uma linha da ficha: o rótulo à esquerda, o valor à direita. **Um nó só** para o
 * leitor de tela, com rótulo e valor na mesma frase — lidos separados, "Quando" e
 * "18/07/2026 · 17:09" chegariam como dois fragmentos sem relação.
 */
function LinhaDaFicha({ rotulo, fala, children }: { rotulo: string; fala: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.linha} accessible accessibilityLabel={`${rotulo}: ${fala}`}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.valor}>{children}</View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    raiz: { flex: 1 },

    // A área da foto: `mediaVeil` nos dois esquemas, como todo visor — fundo claro
    // em volta da foto lava a imagem.
    palco: { backgroundColor: mediaVeil },
    barra: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 10,
    },
    fechar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    // O título é carimbo, não manchete: mono, pequeno, à direita. `onMedia` com alfa
    // sobre o véu chapado ainda mede acima de 10 — é informação, e passa.
    titulo: {
      flexShrink: 1, fontSize: 11, fontFamily: fonts.mono,
      color: corComAlfa(onMedia, 0.72), paddingRight: 6,
    },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    legendaNoPalco: {
      fontSize: 12, lineHeight: 18, fontFamily: fonts.mono, letterSpacing: 0.2,
      color: onMedia, textAlign: 'center',
    },

    // A ficha, em papel. O fundo vem do `baseBg` no render: `colors.bg` é
    // transparente sob papel de parede, e dentro do `Modal` não há parede.
    ficha: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
    rotuloDoTopo: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2, marginBottom: spacing.sm,
    },
    // A única prosa da ficha: serifada, 17/25.
    porque: { fontSize: 17, lineHeight: 25, fontFamily: fonts.serif, color: colors.ink, marginBottom: spacing.xs },
    nota: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink2 },
    // A data da troca é medida: mono.
    notaMono: { fontSize: 12, lineHeight: 18, fontFamily: fonts.mono, color: colors.ink2 },
    filete: {
      height: StyleSheet.hairlineWidth, backgroundColor: colors.line,
      marginTop: 18, marginBottom: spacing.lg,
    },
    linhas: { gap: 14 },
    linha: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
    // 96 de coluna, como no canvas: os três rótulos cabem numa linha no corpo normal.
    rotulo: {
      width: 96, flexShrink: 0, fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2,
    },
    valor: { flex: 1 },
    valorMono: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink },
    nomeDaAtividade: { fontSize: 14, lineHeight: 20, fontFamily: fonts.sansSemiBold, color: colors.ink },
    distancia: { fontSize: 12, fontFamily: fonts.mono, color: colors.ink2, marginTop: 2 },
    rota: { fontSize: 13.5, lineHeight: 20, fontFamily: fonts.sans, color: colors.ink },

    botao: {
      minHeight: 44, borderRadius: radii.lg, marginTop: 22,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
      backgroundColor: colors.primary,
    },
    // `onPrimary`, nunca `primaryOn` — ver a barreira de `architecture.test.ts`.
    botaoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },
    aviso: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2, marginTop: 10 },
    pressionado: { opacity: 0.7 },
  });
