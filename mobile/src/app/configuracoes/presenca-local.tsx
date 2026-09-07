import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { MAP_STYLES } from '@vitale/shared';
import { TextInput } from 'react-native';
import { colors, fonts, moduleColors, radii, spacing, useThemedStyles } from '../../theme';
import { useSettingsStore } from '../../store/settings.store';
import { buildPlaceMapHtml } from '../../lib/map-html';
import { Slider } from '../../components/ui/Slider';
import {
  DEFAULT_RADIUS_M,
  MIN_RADIUS_M,
  geometryDiffers,
  readPresencePlaces,
  upsertPresencePlace,
  type PresencePlace,
} from '../../lib/presence-places';
import { currentFix, isPresenceRunning, startPresence } from '../../services/presence';

/**
 * /configuracoes/presenca-local — o editor de um lugar, com mapa.
 *
 * **A mira fica parada e o mapa se move.** O centro do lugar é o centro da tela,
 * sempre. Um pino arrastável poria o dedo em cima do alvo exatamente no ajuste
 * final, que é o mais preciso de todos — o mesmo motivo pelo qual escolher
 * endereço no Uber e no Google Maps funciona assim.
 *
 * **O HTML é construído uma vez só.** Raio e posição entram depois por
 * `injectJavaScript`. Se o `source` do WebView dependesse do raio, cada quadro
 * do slider recarregaria os tiles e apagaria o enquadramento — o mesmo motivo
 * pelo qual o cursor do scrub em `map-html.ts` vai por injeção.
 *
 * O teto de 500 m não é do iOS (ele monitora bem mais); é do problema. Nenhum
 * lugar da rotina precisa de meio quilômetro, e um raio grande demais não dá
 * erro: ele mente devagar, engolindo o vizinho.
 */

export const MAX_RADIUS_M = 500;

export default function PresencaLocalScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const casa = moduleColors('casa');
  const agua = moduleColors('agua');

  const mapStyle = useSettingsStore((s) => s.preferences?.mapStyle) ?? 'voyager';
  // O editor é Leaflet. Se a preferência for vector (MapLibre), cai no raster
  // padrão: um mapa de escolher um ponto não ganha nada com tilt 3D, e manter
  // um só motor aqui evita duplicar a API de círculo em dois dialetos.
  const escolhido = MAP_STYLES[mapStyle];
  const padrao = MAP_STYLES.voyager;
  const tile =
    escolhido.kind === 'raster' ? escolhido : padrao.kind === 'raster' ? padrao : null;

  const webRef = useRef<WebView>(null);
  const centroRef = useRef<{ lat: number; lon: number } | null>(null);

  const [original, setOriginal] = useState<PresencePlace | null>(null);
  const [nome, setNome] = useState('');
  const [raio, setRaio] = useState(DEFAULT_RADIUS_M);
  const [inicial, setInicial] = useState<{ lat: number; lon: number; raio: number } | null>(null);
  const [centro, setCentro] = useState<{ lat: number; lon: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  /* ---------- ponto de partida ---------- */

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (id) {
        const lugar = (await readPresencePlaces()).find((p) => p.id === id);
        if (lugar && vivo) {
          setOriginal(lugar);
          setNome(lugar.name);
          setRaio(lugar.radiusM);
          centroRef.current = { lat: lugar.lat, lon: lugar.lon };
          setCentro({ lat: lugar.lat, lon: lugar.lon });
          setInicial({ lat: lugar.lat, lon: lugar.lon, raio: lugar.radiusM });
          return;
        }
      }
      try {
        const fix = await currentFix();
        if (!vivo) return;
        const at = { lat: fix.coords.latitude, lon: fix.coords.longitude };
        centroRef.current = at;
        setCentro(at);
        setInicial({ ...at, raio: DEFAULT_RADIUS_M });
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  /* ---------- o HTML nasce uma vez ---------- */

  const html = useMemo(
    () =>
      inicial && tile
        ? buildPlaceMapHtml(
            { latitude: inicial.lat, longitude: inicial.lon },
            inicial.raio,
            tile,
            { accent: casa.accent, me: agua.accent },
          )
        : null,
    // Depende só do ponto de partida. Raio e posição depois vão por injeção.
    [inicial, tile, casa.accent, agua.accent],
  );

  const injetar = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js} true;`);
  }, []);

  /* ---------- o ponto "você", separado do raio ---------- */

  const marcarMinhaPosicao = useCallback(
    (mover: boolean) => {
      currentFix()
        .then((fix) => {
          const { latitude, longitude, accuracy } = fix.coords;
          injetar(`window.setMe(${latitude}, ${longitude}, ${Math.max(8, accuracy ?? 30)});`);
          if (mover) injetar(`window.goTo(${latitude}, ${longitude});`);
        })
        .catch(() => {
          // Sem fix o editor continua útil: dá para arrastar o mapa à mão.
        });
    },
    [injetar],
  );

  const aoMensagem = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as
        | { type: 'ready' }
        | { type: 'placeCenter'; lat: number; lng: number };
      if (msg.type === 'ready') {
        marcarMinhaPosicao(false);
        return;
      }
      if (msg.type === 'placeCenter') {
        centroRef.current = { lat: msg.lat, lon: msg.lng };
        setCentro({ lat: msg.lat, lon: msg.lng });
      }
    } catch {
      // Mensagem que não é nossa: ignorar em silêncio.
    }
  };

  const mudarRaio = (v: number) => {
    setRaio(v);
    injetar(`window.setRadius(${v});`);
  };

  /* ---------- salvar ---------- */

  const salvar = () => {
    const at = centroRef.current;
    const limpo = nome.trim();
    if (!at || !limpo) return;

    const proximo: PresencePlace = {
      id: original?.id ?? `p${Date.now().toString(36)}`,
      name: limpo,
      lat: at.lat,
      lon: at.lon,
      radiusM: raio,
    };

    const trocouInstrumento = original != null && geometryDiffers(original, proximo);

    const gravar = () => {
      setSalvando(true);
      upsertPresencePlace(proximo)
        .then(async (lista) => {
          if (await isPresenceRunning()) await startPresence(lista);
          router.back();
        })
        .catch((e: unknown) => Alert.alert('Não deu', e instanceof Error ? e.message : String(e)))
        .finally(() => setSalvando(false));
    };

    if (trocouInstrumento) {
      Alert.alert(
        'Isso troca o instrumento',
        `Os ${original ? '' : ''}eventos que “${original?.name}” já produziu vieram de outro círculo. ` +
          'Eles continuam no log, e o lugar passa a mostrar a data da mudança — mas somar as ' +
          'contagens de antes com as de depois mistura duas medições.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Mudar mesmo assim', onPress: gravar },
        ],
      );
      return;
    }
    gravar();
  };

  const podeSalvar = nome.trim() !== '' && centro != null && !salvando;

  /* ---------- render ---------- */

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* O polegar do slider no raio mínimo fica a ~24 px da esquerda, dentro
          da faixa do swipe-back, e os dois gestos disparam juntos. Desligar só
          durante o arrasto não funciona: não chega a tempo. Ver a nota em
          `components/ui/Slider.tsx`. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar local' : 'Novo local'}</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* ---------- mapa ---------- */}
      <View style={styles.mapaBox}>
        {html ? (
          <>
            <WebView
              ref={webRef}
              source={{ html }}
              originWhitelist={['*']}
              onMessage={aoMensagem}
              style={styles.mapa}
              scrollEnabled={false}
              javaScriptEnabled
            />
            {/* A mira é do RN, não do Leaflet: fica exatamente no centro do
                viewport e desenha nítida em qualquer densidade de tela. */}
            <View pointerEvents="none" style={styles.miraBox}>
              <View style={styles.miraAnel} />
              <View style={[styles.miraTraco, styles.miraCima]} />
              <View style={[styles.miraTraco, styles.miraBaixo]} />
              <View style={[styles.miraTraco, styles.miraEsq]} />
              <View style={[styles.miraTraco, styles.miraDir]} />
            </View>
            <Pressable
              onPress={() => marcarMinhaPosicao(true)}
              style={({ pressed }) => [styles.recentrar, pressed && styles.pressed]}
            >
              <Ionicons name="locate-outline" size={18} color={colors.ink} />
            </Pressable>
          </>
        ) : (
          <View style={styles.mapaVazio}>
            {erro ? (
              <Text style={styles.erro}>{erro}</Text>
            ) : (
              <ActivityIndicator size="small" color={colors.ink3} />
            )}
          </View>
        )}
      </View>

      <Text style={styles.dica}>Arraste o mapa: a mira é o centro do lugar.</Text>

      {/* ---------- controles ---------- */}
      <View style={styles.controles}>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do lugar"
          placeholderTextColor={colors.ink3}
          style={styles.campo}
          autoCapitalize="sentences"
          maxLength={40}
          returnKeyType="done"
        />

        <View style={styles.raioLinha}>
          <Text style={styles.raioLabel}>Raio</Text>
          <Text style={styles.raioValor}>{raio} m</Text>
        </View>
        <Slider
          value={raio}
          min={MIN_RADIUS_M}
          max={MAX_RADIUS_M}
          step={10}
          onChange={mudarRaio}
          accent={casa.accent}
        />
        <View style={styles.raioLinha}>
          <Text style={styles.extremo}>{MIN_RADIUS_M} m</Text>
          <Text style={styles.extremo}>{MAX_RADIUS_M} m</Text>
        </View>
        <Text style={styles.nota}>
          Abaixo de {MIN_RADIUS_M} m o iOS erra a borda: a localização por célula e Wi-Fi tem erro
          da mesma ordem, e você entraria e sairia parado no mesmo lugar.
        </Text>

        {original?.geometryChangedAt ? (
          <Text style={styles.nota}>
            Geometria alterada em{' '}
            {new Date(original.geometryChangedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })}
            . Os eventos anteriores vieram de outro círculo.
          </Text>
        ) : null}

        <Pressable
          onPress={salvar}
          disabled={!podeSalvar}
          style={({ pressed }) => [
            styles.salvar,
            pressed && styles.pressed,
            !podeSalvar && styles.desabilitado,
          ]}
        >
          {salvando ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.salvarTexto}>{id ? 'Salvar alterações' : 'Salvar local'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const MIRA = 26;

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.ink },
    pressed: { opacity: 0.55 },

    mapaBox: {
      flex: 1,
      marginHorizontal: spacing.md,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      backgroundColor: colors.surfaceMute,
    },
    mapa: { flex: 1, backgroundColor: 'transparent' },
    mapaVazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    erro: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink2, textAlign: 'center' },

    miraBox: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: MIRA,
      height: MIRA,
      marginLeft: -MIRA / 2,
      marginTop: -MIRA / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miraAnel: {
      width: 13,
      height: 13,
      borderRadius: 6.5,
      borderWidth: 1.5,
      borderColor: colors.ink,
    },
    miraTraco: { position: 'absolute', backgroundColor: colors.ink },
    miraCima: { width: 1.5, height: 6, top: 0 },
    miraBaixo: { width: 1.5, height: 6, bottom: 0 },
    miraEsq: { height: 1.5, width: 6, left: 0 },
    miraDir: { height: 1.5, width: 6, right: 0 },

    recentrar: {
      position: 'absolute',
      right: spacing.sm,
      bottom: spacing.sm,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },

    dica: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.ink3,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
    },

    controles: { padding: spacing.md, gap: spacing.xs },
    campo: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.ink,
      backgroundColor: colors.bg2,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      minHeight: 44,
      marginBottom: spacing.xs,
    },
    raioLinha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    raioLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
    raioValor: { fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.ink },
    extremo: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink3 },
    nota: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.ink3 },

    salvar: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    salvarTexto: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onPrimary },
    desabilitado: { opacity: 0.4 },
  });
}
