/**
 * Todas as fotos de uma pedalada, em tela cheia (ADR 0037).
 *
 * O cartão do detalhe mostra duas miniaturas por parada — ele é índice, não
 * álbum. Esta tela é o álbum, e mantém a **parada como unidade**: cada seção
 * é um lugar onde a bicicleta ficou parada, com a cidade, o km e quanto tempo.
 * Uma grade cronológica única seria mais simples de varrer, e perderia
 * exatamente o "onde" que é a tese da feature.
 *
 * O visor é interno de propósito: sair para o app Fotos perderia o contexto da
 * pedalada, que é o que dá sentido à foto aqui — a hora e o quilômetro embaixo
 * dela são o que nenhum outro app mostra.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  Image,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityPhoto } from '@vitale/shared';
import { colors, fonts, onMedia, radii, spacing, useThemedStyles } from '../../theme';
import { useAssetUri } from '../../hooks/useAssetUri';
import { formatClip } from '../../lib/workout-format';

/** Colunas da grade. Três dá miniatura legível sem virar contato-prova. */
const COLS = 3;

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function km(m: number | null): string | null {
  if (m === null) return null;
  return `km ${(m / 1000).toFixed(1).replace('.', ',')}`;
}

/** Miniatura da grade. Resolve o endereço sozinha — ver `services/asset-uri.ts`. */
function GridTile({
  photo,
  size,
  onPress,
  onLongPress,
  selecting,
  selected,
}: {
  photo: ActivityPhoto;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  selecting: boolean;
  selected: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const isVideo = photo.mediaType === 'video';
  const uri = useAssetUri(photo.assetId, isVideo, photo.durationS);
  const box = { width: size, height: size };

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={280} style={[box, styles.tile]}>
      {typeof uri === 'string' ? (
        <Image source={{ uri }} style={styles.tileImg} />
      ) : uri === null ? (
        /**
         * Vídeo sem pôster **não** é vídeo perdido: a extração do quadro pode
         * falhar com o clipe inteiro intacto e tocável. Por isso a lacuna
         * pontilhada com "?" — que afirma "esta mídia sumiu da biblioteca" —
         * fica só para foto; o vídeo cai num quadro de filme, que não mente.
         */
        <View style={[styles.tileImg, isVideo ? styles.tileFilm : styles.tileGap]}>
          <Ionicons
            name={isVideo ? 'play' : 'help-outline'}
            size={isVideo ? 20 : 16}
            color={isVideo ? onMedia : colors.ink4}
          />
        </View>
      ) : (
        <View style={styles.tileImg} />
      )}
      {isVideo && photo.durationS !== null && (
        <View style={styles.clip}>
          <Ionicons name="play" size={7} color={onMedia} />
          <Text style={styles.clipText}>{formatClip(photo.durationS)}</Text>
        </View>
      )}
      {photo.isCover && !selecting && (
        <View style={styles.cover}>
          <Ionicons name="star" size={9} color={onMedia} />
        </View>
      )}
      {selecting && (
        <>
          {selected && <View style={styles.selVeil} />}
          <View style={[styles.selMark, selected && styles.selMarkOn]}>
            {selected && <Ionicons name="checkmark" size={12} color={onMedia} />}
          </View>
        </>
      )}
    </Pressable>
  );
}

/** O visor: uma foto por página, com o contexto da pedalada embaixo. */
function Viewer({
  photos,
  index,
  onClose,
  onShare,
  onCover,
  onDismiss,
  onOpenActivity,
  sharing = false,
}: {
  photos: ActivityPhoto[];
  index: number;
  onClose: () => void;
  onShare?: (photo: ActivityPhoto) => void;
  onCover?: (photo: ActivityPhoto) => void;
  onDismiss?: (photo: ActivityPhoto) => void;
  /**
   * Ir para a pedalada da foto.
   *
   * É a ação da galeria **de período** (a Retrospectiva), onde as outras três
   * não cabem: compartilhar dali abriria o compositor com o contexto de uma
   * pedalada que não se está vendo, e capa/desligar são decisões que se toma
   * dentro do dia, não folheando o mês.
   */
  onOpenActivity?: (photo: ActivityPhoto) => void;
  /** O compositor está montando. Vem da tela, que é quem sabe. */
  sharing?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);

  /**
   * Arrastar para baixo fecha.
   *
   * Duas tentativas anteriores falharam no aparelho, e a razão é a mesma: o
   * `ScrollView` horizontal do iOS resolve o arrasto no **nível nativo**, com
   * o próprio `UIPanGestureRecognizer`. O `PanResponder` do RN — nem na fase
   * de bolha nem na de captura — chega a ver o gesto, porque ele nunca vira
   * evento de toque no JS.
   *
   * O `react-native-gesture-handler` fala com os reconhecedores nativos, que é
   * o único nível onde os dois gestos podem negociar. Ele já estava instalado,
   * e a ADR 0010 proíbe o **Reanimated**, não ele — por isso a animação segue
   * no `Animated` do RN, via `Animated.event`.
   *
   * `activeOffsetY` só ativa depois de 12 px verticais; `failOffsetX` desiste
   * assim que o dedo anda 16 px na horizontal, devolvendo o gesto ao carrossel.
   * É essa dupla que faz os dois conviverem, e não um limiar em JS.
   */
  const dragY = useRef(new Animated.Value(0)).current;

  const onDrag = Animated.event([{ nativeEvent: { translationY: dragY } }], {
    useNativeDriver: true,
  });

  const onDragEnd = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END && e.nativeEvent.state !== State.CANCELLED) return;
    const { translationY, velocityY } = e.nativeEvent;
    // Fecha por distância OU por velocidade: um puxão curto e rápido é tão
    // intencional quanto um arrasto longo.
    if (translationY > 110 || velocityY > 700) {
      Animated.timing(dragY, {
        toValue: height,
        duration: 160,
        useNativeDriver: true,
      }).start(onClose);
    } else {
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    }
  };

  /** O fundo clareia conforme o dedo desce — o visor "solta" a foto. */
  const backdrop = dragY.interpolate({
    inputRange: [0, height * 0.5],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });
  /** Só para baixo: puxar para cima não arrasta nada. */
  const shift = dragY.interpolate({
    inputRange: [0, height],
    outputRange: [0, height],
    extrapolateLeft: 'clamp',
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* O RNGH exige a própria raiz dentro de um `Modal` do RN — sem ela o
          gesto não chega ao handler, e o visor volta a não fazer nada. */}
      <GestureHandlerRootView style={styles.viewerRoot}>
        <Animated.View style={[styles.viewerBackdrop, { opacity: backdrop }]} />
        <PanGestureHandler
          activeOffsetY={12}
          failOffsetX={[-16, 16]}
          onGestureEvent={onDrag}
          onHandlerStateChange={onDragEnd}
        >
          <Animated.View style={[styles.viewer, { transform: [{ translateY: shift }] }]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) =>
            setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {/**
           * **Só as páginas por perto são montadas.**
           *
           * O carrossel monta todas as páginas de uma vez, e cada uma resolve um
           * arquivo da biblioteca e desenha uma imagem de tela cheia. Numa
           * pedalada são dezenas e ninguém notou; na galeria do período de julho
           * são **372**, e abrir uma foto lá embaixo derrubava o app (conferido
           * no aparelho em 07/09/2026) — a lista já estava virtualizada, o visor
           * não estava.
           *
           * A janela de ±2 mantém a geometria do `ScrollView` intacta (cada
           * página ocupa sua largura, montada ou não), então o `contentOffset` e
           * o paginado continuam exatos. E as vizinhas já estão prontas quando o
           * dedo chega nelas — o `current` só avança no fim do gesto.
           */}
          {photos.map((p, i) =>
            Math.abs(i - current) <= 2 ? (
              <ViewerPage key={p.id} photo={p} width={width} active={i === current} />
            ) : (
              <View key={p.id} style={{ width }} />
            ),
          )}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.viewerClose, { top: insets.top + spacing.sm }]}
        >
          <Ionicons name="close" size={22} color={onMedia} />
        </Pressable>

        <View style={[styles.viewerFoot, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.viewerCtx}>
            <Text style={styles.viewerTime}>{hhmm(photos[current]?.takenAt ?? 0)}</Text>
            {km(photos[current]?.routeDistanceM ?? null) && (
              <Text style={styles.viewerMeta}>{km(photos[current]!.routeDistanceM)}</Text>
            )}
            <Text style={styles.viewerMeta}>
              {current + 1} de {photos.length}
            </Text>
          </View>

          {/**
           * As ações da foto que se está olhando.
           *
           * As duas últimas já existiam — num toque longo nas miniaturas do
           * cartão, que o visor não alcançava. Para desligar uma foto que se
           * está OLHANDO era preciso fechar o visor, achar a miniatura certa e
           * segurar o dedo nela. É olhando que se decide se a foto fica.
           *
           * A ordem é deliberada: compartilhar primeiro, desligar por último e
           * em vermelho, por ser a única com consequência — e mesmo assim
           * reversível, porque a imagem nunca sai do iPhone.
           */}
          {(onShare || onCover || onDismiss || onOpenActivity) && (
            <View style={styles.viewerActs}>
              {onShare && (
                <Pressable
                  style={styles.act}
                  onPress={() => onShare(photos[current]!)}
                  disabled={sharing}
                >
                  {/**
                   * O visor **não** fecha: o compositor abre por cima dele, e
                   * fechar o compositor devolve o dono à mesma foto. Foi o que
                   * o estudo desenhou, e funciona.
                   *
                   * O que faltava era dizer que está indo. Montar o compositor
                   * leva tempo — o WebView do cartão e a extração do arquivo da
                   * foto —, e sem sinal o toque parecia perdido.
                   */}
                  {sharing ? (
                    <ActivityIndicator size="small" color={onMedia} />
                  ) : (
                    <Ionicons name="share-outline" size={21} color={onMedia} />
                  )}
                  <Text style={styles.actText}>{sharing ? 'Abrindo…' : 'Compartilhar'}</Text>
                </Pressable>
              )}
              {onCover && (
                <Pressable
                  style={styles.act}
                  disabled={photos[current]?.isCover}
                  onPress={() => onCover(photos[current]!)}
                >
                  {/* A estrela cheia e o rótulo no passado são o único retorno
                      que esta ação dá: ela grava no banco e não muda mais nada
                      na tela. Sem isso o toque parece não ter funcionado — foi
                      exatamente como ele descreveu (07/09/2026). */}
                  <Ionicons
                    name={photos[current]?.isCover ? 'star' : 'star-outline'}
                    size={21}
                    color={onMedia}
                  />
                  <Text style={styles.actText}>
                    {photos[current]?.isCover ? 'É a capa' : 'Usar como capa'}
                  </Text>
                </Pressable>
              )}
              {onOpenActivity && (
                <Pressable
                  style={styles.act}
                  onPress={() => {
                    const p = photos[current]!;
                    onClose();
                    onOpenActivity(p);
                  }}
                >
                  <Ionicons name="bicycle-outline" size={21} color={onMedia} />
                  <Text style={styles.actText}>Ir para a pedalada</Text>
                </Pressable>
              )}
              {onDismiss && (
                <Pressable
                  style={styles.act}
                  onPress={() => {
                    const p = photos[current]!;
                    onClose();
                    onDismiss(p);
                  }}
                >
                  <Ionicons name="remove-circle-outline" size={21} color={styles.actOff.color} />
                  <Text style={[styles.actText, styles.actOff]}>Desligar</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Foto e vídeo são componentes separados porque hook não é condicional — e
 * porque só um dos dois precisa de um player.
 */
function ViewerPage({
  photo,
  width,
  active,
}: {
  photo: ActivityPhoto;
  width: number;
  active: boolean;
}) {
  return photo.mediaType === 'video' ? (
    <VideoPage photo={photo} width={width} active={active} />
  ) : (
    <PhotoPage photo={photo} width={width} />
  );
}

function PhotoPage({ photo, width }: { photo: ActivityPhoto; width: number }) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(photo.assetId, false);
  return (
    <View style={[styles.viewerPage, { width }]}>
      {typeof uri === 'string' ? (
        <Image source={{ uri }} style={styles.viewerImg} resizeMode="contain" />
      ) : (
        <Ionicons name="help-outline" size={30} color={onMedia} />
      )}
    </View>
  );
}

/**
 * O clipe toca **aqui dentro** (ADR 0037): mandar para o app Fotos perderia a
 * hora e o quilômetro embaixo da imagem, que são justamente o que nenhum outro
 * app mostra. Os controles são os nativos — eles já trazem barra de tempo, som
 * e tela cheia, e reinventá-los aqui seria pior em todos os três.
 *
 * **O player só existe na página ativa.** O `ScrollView` monta todas as páginas
 * de uma vez, e uma pedalada real tem 14 vídeos (a Tour de la Wallonie
 * Picarde, 21/07/2026): 14 `AVPlayer` simultâneos passam do que o iOS
 * decodifica, e garantiriam dois clipes falando ao mesmo tempo.
 *
 * Não toca sozinho, de propósito: chega-se a esta tela varrendo a grade, e um
 * vídeo que começa a falar no meio da curadoria é pior do que um toque a mais.
 *
 * ## Por que a fonte é `ph://` e entra por `replaceAsync`
 *
 * A primeira versão passava ao player o endereço `file://` extraído — o mesmo
 * do pôster — e **nenhum clipe tocava**. O motivo está no código nativo do
 * `expo-video`: aquele caminho carrega uma chave de sandbox concedida no
 * momento da extração, e o `VideoPlayer.swift` recusa de saída uma URL `ph://`
 * no construtor síncrono, dizendo em quantas letras que ela "só pode ser
 * carregada de forma assíncrona".
 *
 * `replaceAsync` é esse caminho: ele pede o `AVAsset` ao PhotoKit e recebe uma
 * URL **com permissão válida**. Ou seja, o `assetId` que já guardamos — que é
 * literalmente `ph://<localIdentifier>` — é a fonte certa, e a extração de
 * arquivo não era só supérflua aqui: era o defeito.
 */
function VideoPage({
  photo,
  width,
  active,
}: {
  photo: ActivityPhoto;
  width: number;
  active: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const player = useVideoPlayer(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) {
      player.pause();
      return;
    }
    if (!photo.assetId) return;
    let alive = true;
    setFailed(false);
    player.replaceAsync(photo.assetId).catch((err) => {
      console.warn('[fotos] o clipe não carregou:', String(err));
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [active, photo.assetId, player]);

  return (
    <View style={[styles.viewerPage, { width }]}>
      {active && !failed ? (
        <VideoView
          player={player}
          style={styles.viewerImg}
          contentFit="contain"
          nativeControls
          allowsPictureInPicture={false}
        />
      ) : (
        <Ionicons
          name={failed ? 'help-outline' : 'play-circle-outline'}
          size={54}
          color={onMedia}
        />
      )}
    </View>
  );
}

export interface GallerySection {
  key: string;
  title: string;
  subtitle: string;
  photos: ActivityPhoto[];
}

interface Props {
  visible: boolean;
  sections: GallerySection[];
  total: number;
  onClose: () => void;
  /**
   * Procurar fotos de novo. Mora aqui, e não na tela da pedalada, porque é
   * onde o álbum está — e porque a biblioteca muda depois: foto que ainda
   * estava subindo do iCloud, ou uma pedalada antiga varrida antes de você ter
   * tirado as fotos dela.
   */
  onRescan?: () => void;
  /** Desliga as fotos escolhidas. Nunca apaga arquivo — só a ligação. */
  onDismiss?: (photoIds: string[]) => Promise<void> | void;
  /**
   * Compartilhar a foto que está no visor.
   *
   * A galeria **não fecha**: o compositor abre por cima, e sair dele devolve o
   * dono à mesma foto. Uma pedalada tem até 60 — fechar aqui obrigaria a rolar
   * tudo de novo para reencontrar a que ele estava vendo.
   */
  onSharePhoto?: (photo: ActivityPhoto) => void;
  /** Tornar capa, a partir do visor. */
  onCover?: (photo: ActivityPhoto) => void;
  /** Da galeria de período: o visor oferece ir para a pedalada da foto. */
  onOpenActivity?: (photo: ActivityPhoto) => void;
  /** O compositor está abrindo — o visor troca o ícone por um indicador. */
  sharing?: boolean;
  /**
   * O compositor, montado **dentro** desta galeria.
   *
   * Não é elegância: é a única forma que o iOS aceita. Um `Modal` montado pela
   * tela de baixo não é apresentado enquanto a galeria estiver de pé — ele só
   * aparece quando ela fecha, que foi exatamente o que ele viu ("fica
   * 'Abrindo', mas não abre; só quando volto para o detalhe").
   *
   * Aqui dentro, a profundidade é a mesma do visor — galeria → compositor —, e
   * essa já era provada: o visor abre assim desde o primeiro dia.
   */
  shareSlot?: React.ReactNode;
}

export function PhotoGalleryModal({
  visible,
  sections,
  total,
  onClose,
  onRescan,
  onDismiss,
  onSharePhoto,
  onCover,
  onOpenActivity,
  sharing,
  shareSlot,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [viewing, setViewing] = useState<number | null>(null);
  /**
   * A foto que estava no visor quando ele foi compartilhar.
   *
   * O visor precisa fechar — senão seriam três modais e o compositor não
   * aparece —, mas fechar sem voltar largaria o dono no topo de uma grade de
   * 60. Guardado aqui, ele é restaurado quando o compositor sai.
   */
  const returnTo = useRef<number | null>(null);
  useEffect(() => {
    if (!sharing && returnTo.current !== null) {
      setViewing(returnTo.current);
      returnTo.current = null;
    }
  }, [sharing]);

  /**
   * A curadoria acontece **depois**: numa pedalada com muitas fotos não dá para
   * julgar uma a uma na folha, então liga-se tudo e limpa-se aqui. O modo entra
   * por toque longo numa foto — o mesmo gesto do app Fotos, para não precisar
   * de um botão a mais no cabeçalho.
   */
  /**
   * Deslizar da esquerda para a direita fecha — o mesmo gesto de voltar que o
   * resto do app tem por ser pilha de navegação. Aqui a galeria é um `Modal`,
   * que não ganha isso de graça, então o gesto é explícito.
   *
   * `activeOffsetX={[-999, 24]}` só ativa para a direita; `failOffsetY` devolve
   * o gesto à grade assim que o dedo tende ao vertical, senão rolar a lista
   * fecharia a tela sem querer.
   */
  const slideX = useRef(new Animated.Value(0)).current;
  const onSlide = Animated.event([{ nativeEvent: { translationX: slideX } }], {
    useNativeDriver: true,
  });
  const onSlideEnd = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END && e.nativeEvent.state !== State.CANCELLED) return;
    const { translationX, velocityX } = e.nativeEvent;
    if (translationX > 90 || velocityX > 700) {
      Animated.timing(slideX, {
        toValue: width,
        duration: 160,
        useNativeDriver: true,
      }).start(onClose);
    } else {
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    }
  };
  const slide = slideX.interpolate({
    inputRange: [0, width],
    outputRange: [0, width],
    extrapolateLeft: 'clamp',
  });

  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const leaveSelection = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  /** A ordem plana da grade — é o que o visor percorre ao deslizar. */
  const flat = useMemo(() => sections.flatMap((s) => s.photos), [sections]);

  /** Cada seção vira linhas de três — a unidade que a `SectionList` virtualiza. */
  const rows = useMemo(
    () =>
      sections.map((s) => {
        const data: ActivityPhoto[][] = [];
        for (let i = 0; i < s.photos.length; i += COLS) data.push(s.photos.slice(i, i + COLS));
        return { ...s, data };
      }),
    [sections],
  );

  const gap = 3;
  const size = Math.floor((width - spacing.lg * 2 - gap * (COLS - 1)) / COLS);

  let offset = 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.viewerRoot}>
        <PanGestureHandler
          activeOffsetX={[-999, 24]}
          failOffsetY={[-14, 14]}
          onGestureEvent={onSlide}
          onHandlerStateChange={onSlideEnd}
          enabled={!selecting}
        >
          <Animated.View
            style={[styles.gallery, { paddingTop: insets.top, transform: [{ translateX: slide }] }]}
          >
        <View style={styles.galleryHead}>
          {selecting ? (
            <>
              <Pressable onPress={leaveSelection} hitSlop={12}>
                <Text style={styles.headAction}>Cancelar</Text>
              </Pressable>
              <Text style={styles.galleryTitle}>
                {picked.size === 0
                  ? 'Escolha as fotos'
                  : `${picked.size} ${picked.size === 1 ? 'escolhida' : 'escolhidas'}`}
              </Text>
              <Pressable onPress={() => setPicked(new Set(flat.map((p) => p.id)))} hitSlop={12}>
                <Text style={[styles.headAction, styles.headActionRight]}>Tudo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="chevron-down" size={24} color={colors.ink} />
              </Pressable>
              <Text style={styles.galleryTitle}>Fotos</Text>
              {onRescan && (
                <Pressable onPress={onRescan} hitSlop={10} style={styles.rescan}>
                  <Ionicons name="search" size={13} color={colors.ink2} />
                  <Text style={styles.rescanText}>Procurar mais</Text>
                </Pressable>
              )}
              <Text style={styles.galleryCount}>{total}</Text>
            </>
          )}
        </View>

        {/**
         * **Virtualizada, e não um `ScrollView`.**
         *
         * A galeria nasceu para UMA pedalada — dezenas de fotos —, e passou a
         * servir também o período inteiro: julho de 2026 tem **372 fotos em 12
         * atividades**. Montando todas de uma vez, cada quadro dispara uma
         * extração de arquivo da biblioteca e uma decodificação de imagem, e o
         * app morre antes de desenhar a primeira tela. Foi o que aconteceu no
         * aparelho em 07/09/2026.
         *
         * A `SectionList` monta só o que está perto da janela. As fotos de cada
         * seção viram **linhas de três**, porque a virtualização é por item e
         * uma foto por item daria uma linha de scroll por foto.
         */}
        <SectionList
          sections={rows}
          keyExtractor={(row) => row[0]?.id ?? String(Math.random())}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSub}>{section.subtitle}</Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <View style={[styles.grid, { gap }]}>
              {item.map((p) => (
                <GridTile
                  key={p.id}
                  photo={p}
                  size={size}
                  selecting={selecting}
                  selected={picked.has(p.id)}
                  onPress={() =>
                    selecting ? toggle(p.id) : setViewing(flat.findIndex((f) => f.id === p.id))
                  }
                  onLongPress={() => {
                    if (!onDismiss) return;
                    setSelecting(true);
                    setPicked(new Set([p.id]));
                  }}
                />
              ))}
              {/* Preenche a última linha para os quadros não esticarem. */}
              {item.length < COLS &&
                Array.from({ length: COLS - item.length }, (_, k) => (
                  <View key={`v${section.key}${k}`} style={{ width: size }} />
                ))}
            </View>
          )}
          contentContainerStyle={[styles.galleryBody, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          windowSize={5}
          removeClippedSubviews
          stickySectionHeadersEnabled={false}
        />

        {selecting && picked.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              style={styles.dismissBtn}
              onPress={async () => {
                const ids = [...picked];
                leaveSelection();
                await onDismiss?.(ids);
              }}
            >
              <Ionicons name="remove-circle-outline" size={17} color={onMedia} />
              <Text style={styles.dismissText}>
                Desligar {picked.size} {picked.size === 1 ? 'foto' : 'fotos'}
              </Text>
            </Pressable>
            <Text style={styles.dismissHint}>As imagens continuam no seu iPhone.</Text>
          </View>
        )}

            {viewing !== null && (
              <Viewer
                photos={flat}
                index={viewing}
                onClose={() => setViewing(null)}
                onShare={
                  onSharePhoto
                    ? (p) => {
                        returnTo.current = viewing;
                        setViewing(null);
                        onSharePhoto(p);
                      }
                    : undefined
                }
                sharing={sharing}
                onCover={onCover}
                onOpenActivity={onOpenActivity}
                onDismiss={onDismiss ? (p) => void onDismiss([p.id]) : undefined}
              />
            )}
          </Animated.View>
        </PanGestureHandler>
        {shareSlot}
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    gallery: { flex: 1, backgroundColor: colors.bg },
    galleryHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    galleryTitle: { fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    galleryCount: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink3 },
    rescan: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMute,
    },
    rescanText: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    galleryBody: { paddingHorizontal: spacing.lg },
    /**
     * Tinta, não marca. `primary`/`primaryDeep` garantem 3,0 — o piso do traço,
     * não o da letra (4,5) —, e a barreira mantém um teto de quantas vezes o
     * acento vira texto. Aqui não vale gastar: "Cancelar" e "Tudo" são ações de
     * cabeçalho, e a ênfase da tela é a contagem de escolhidas.
     */
    headAction: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    headActionRight: { marginLeft: 'auto' },

    selVeil: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(242,92,43,0.28)',
    },
    selMark: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.9)',
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selMarkOn: { backgroundColor: colors.primary },

    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: 6,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    dismissBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 13,
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
    },
    dismissText: { fontSize: 15, fontFamily: fonts.sansBold, color: onMedia },
    dismissHint: {
      fontSize: 11,
      fontFamily: fonts.sansMedium,
      color: colors.ink3,
      textAlign: 'center',
    },

    section: { marginBottom: spacing.xl },
    /** Cabeçalho de seção da lista virtualizada — o respiro que o `section` dava. */
    sectionHead: { marginTop: spacing.lg, marginBottom: spacing.sm },
    sectionTitle: { fontSize: 13.5, fontFamily: fonts.sansBold, color: colors.ink },
    sectionSub: {
      fontSize: 11,
      fontFamily: fonts.mono,
      color: colors.ink3,
      marginTop: 1,
      marginBottom: spacing.sm,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },

    tile: { borderRadius: radii.sm, overflow: 'hidden' },
    tileImg: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    tileGap: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.lineDeep,
      borderStyle: 'dashed',
    },
    /** Escuro nos dois esquemas, como o crachá de duração logo abaixo dele. */
    tileFilm: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    clip: {
      position: 'absolute',
      left: 3,
      bottom: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    clipText: { fontSize: 9, fontFamily: fonts.monoSemiBold, color: onMedia },
    cover: {
      position: 'absolute',
      right: 3,
      top: 3,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /**
     * O visor é escuro nos dois esquemas, de propósito: a foto é que manda, e
     * um fundo claro em volta dela lava a imagem. É a convenção de todo visor.
     */
    viewerRoot: { flex: 1 },
    viewer: { flex: 1 },
    /**
     * O fundo é uma camada à parte para poder clarear enquanto a foto desce.
     * Escuro nos dois esquemas: a foto é que manda, e fundo claro em volta lava
     * a imagem — é a convenção de todo visor.
     */
    viewerBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgb(10,9,8)',
    },
    viewerPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    viewerImg: { width: '100%', height: '100%' },
    viewerClose: {
      position: 'absolute',
      left: spacing.lg,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerFoot: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    viewerCtx: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
    viewerActs: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.18)',
    },
    act: { flex: 1, alignItems: 'center', gap: 6 },
    actText: { fontSize: 11, fontFamily: fonts.sansMedium, color: onMedia },
    /** A única com consequência. Sobre o visor escuro, um coral que se lê. */
    actOff: { color: 'rgb(255,154,138)' },
    viewerTime: { fontSize: 17, fontFamily: fonts.mono, color: onMedia },
    viewerMeta: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.7)' },
  });
