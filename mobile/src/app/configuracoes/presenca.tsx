import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import {
  SHORT_GAP_MIN,
  SHORT_STAY_MIN,
  clearPresenceLog,
  readPresenceLog,
  summarizePresence,
  type PresenceEvent,
} from '../../lib/presence-events';
import {
  DEFAULT_RADIUS_M,
  MAX_REGIONS,
  placeName,
  readPresencePlaces,
  removePresencePlace,
  upsertPresencePlace,
  type PresencePlace,
} from '../../lib/presence-places';
import {
  currentFix,
  getPresencePermission,
  isPresenceRunning,
  requestPresencePermission,
  startPresence,
  stopPresence,
  type PresencePermission,
} from '../../services/presence';

/**
 * /configuracoes/presenca — a Fase 0 da Presença, e nada além dela.
 *
 * Esta tela **não é o produto**. Ela é o instrumento de medição que decide se o
 * produto vale ser construído: os lugares que você nomear, o log cru do que o
 * iOS entregou, e as três contagens que calibram os limiares da fase 1. Nada
 * sobe para o Supabase, nada notifica, nenhum módulo é tocado.
 *
 * Ela vive em Configurações, junto de "Dados", porque é irmã do diagnóstico de
 * sync — mesma natureza, mesmo público de um leitor só.
 *
 * Quando a fase 1 chegar, esta tela é descartável.
 */

/**
 * Sugestões, não uma lista fechada. Aparecem como atalho enquanto o campo está
 * vazio e somem depois que o lugar de mesmo nome existe — qualquer nome serve,
 * e o teto é o do iOS (20), não o desta lista.
 */
const SUGESTOES = ['Casa', 'Escritório', 'Academia', 'Mercado'];

function formatarMomento(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour12: false });
  return hoje ? hora : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

/** Um número do resumo, com o rótulo que diz o que ele calibra. */
function Medida({
  n,
  label,
  nota,
  cor,
  styles,
}: {
  n: number;
  label: string;
  nota: string;
  cor: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.medida}>
      <Text style={[styles.medidaN, { color: cor }]}>{n}</Text>
      <Text style={styles.medidaLabel}>{label}</Text>
      <Text style={styles.medidaNota}>{nota}</Text>
    </View>
  );
}

export default function PresencaScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const ok = roleColors('green');
  const alerta = roleColors('yellow');
  const falha = roleColors('red');

  const [perm, setPerm] = useState<PresencePermission | null>(null);
  const [rodando, setRodando] = useState(false);
  const [lugares, setLugares] = useState<PresencePlace[]>([]);
  const [eventos, setEventos] = useState<PresenceEvent[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');

  const carregar = useCallback(async () => {
    const [p, r, l, e] = await Promise.all([
      getPresencePermission(),
      isPresenceRunning(),
      readPresencePlaces(),
      readPresenceLog(),
    ]);
    setPerm(p);
    setRodando(r);
    setLugares(l);
    setEventos(e);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(() => summarizePresence(eventos), [eventos]);
  const recentes = useMemo(() => [...eventos].reverse().slice(0, 60), [eventos]);

  const pedirPermissao = () => {
    setOcupado(true);
    requestPresencePermission()
      .then(setPerm)
      .catch((e: unknown) => Alert.alert('Não deu', String(e)))
      .finally(() => setOcupado(false));
  };

  const adicionarDaqui = () => {
    const nome = nomeNovo.trim();
    if (!nome) return;
    setOcupado(true);
    currentFix()
      .then(async (fix) => {
        const proximos = await upsertPresencePlace({
          id: `p${Date.now().toString(36)}`,
          name: nome,
          lat: fix.coords.latitude,
          lon: fix.coords.longitude,
          radiusM: DEFAULT_RADIUS_M,
        });
        setLugares(proximos);
        setNomeNovo('');
        if (rodando) await startPresence(proximos);
        Alert.alert(
          `“${nome}” registrado`,
          `Raio de ${DEFAULT_RADIUS_M} m, precisão do ponto: ${Math.round(fix.coords.accuracy ?? 0)} m.\n\n` +
            'Se você não estiver exatamente no lugar agora, apague e refaça quando estiver — ' +
            'o centro é o que o iOS vai vigiar.',
        );
      })
      .catch((e: unknown) =>
        Alert.alert('Não deu', e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setOcupado(false));
  };

  const apagarLugar = (p: PresencePlace) => {
    Alert.alert('Apagar lugar', `Remove "${p.name}" e para de vigiar esse raio.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          void removePresencePlace(p.id).then(async (proximos) => {
            setLugares(proximos);
            if (rodando) await startPresence(proximos);
            if (proximos.length === 0) setRodando(false);
          });
        },
      },
    ]);
  };

  const alternar = () => {
    setOcupado(true);
    const acao = rodando ? stopPresence().then(() => false) : startPresence(lugares).then(() => true);
    acao
      .then(setRodando)
      .catch((e: unknown) => Alert.alert('Não deu', e instanceof Error ? e.message : String(e)))
      .finally(() => setOcupado(false));
  };

  const limpar = () => {
    Alert.alert('Limpar o log', 'Apaga os eventos registrados. Os lugares continuam.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: () => void clearPresenceLog().then(carregar) },
    ]);
  };

  const podeLigar = (perm?.background ?? false) && lugares.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Presença · Fase 0</Text>
        <Pressable onPress={() => void carregar()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="refresh-outline" size={19} color={colors.ink3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Duas semanas de observação. Nada é enviado para o servidor e nenhuma visita é criada —
          isto existe só para medir o motor antes de construir em cima dele.
        </Text>

        {/* ---------- estado ---------- */}
        <Text style={styles.sectionTitle}>Estado</Text>
        <View style={styles.card}>
          <View style={styles.estadoLinha}>
            <Ionicons
              name={perm?.background ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={perm?.background ? ok.text : falha.text}
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>
                {perm?.background ? 'Permissão "Sempre" concedida' : 'Falta a permissão "Sempre"'}
              </Text>
              <Text style={styles.rowSub}>
                {perm?.background
                  ? 'O iOS pode acordar o app com ele fechado.'
                  : 'Sem ela o iOS não entrega nada com o app fechado — a captura não existe.'}
              </Text>
            </View>
          </View>

          {!perm?.background ? (
            <Pressable
              onPress={pedirPermissao}
              disabled={ocupado}
              style={({ pressed }) => [styles.botao, pressed && styles.pressed, ocupado && styles.desabilitado]}
            >
              <Text style={styles.botaoTexto}>Conceder permissão</Text>
            </Pressable>
          ) : null}

          <View style={styles.divisor} />

          <View style={styles.estadoLinha}>
            <Ionicons
              name={rodando ? 'radio' : 'pause-circle-outline'}
              size={18}
              color={rodando ? ok.text : colors.ink3}
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{rodando ? 'Vigiando' : 'Parado'}</Text>
              <Text style={styles.rowSub}>
                {lugares.length} de {MAX_REGIONS} vagas do iOS em uso
              </Text>
            </View>
          </View>

          <Pressable
            onPress={alternar}
            disabled={ocupado || (!rodando && !podeLigar)}
            style={({ pressed }) => [
              styles.botao,
              rodando && styles.botaoParar,
              pressed && styles.pressed,
              (ocupado || (!rodando && !podeLigar)) && styles.desabilitado,
            ]}
          >
            {ocupado ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.botaoTexto, rodando && styles.botaoPararTexto]}>
                {rodando ? 'Parar observação' : 'Começar observação'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* ---------- lugares ---------- */}
        <Text style={styles.sectionTitle}>Lugares</Text>
        <View style={styles.card}>
          {lugares.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhum ainda. Cadastre estando no lugar: o ponto de agora vira o centro do raio.
            </Text>
          ) : (
            lugares.map((p) => (
              <View key={p.id} style={styles.lugarLinha}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{p.name}</Text>
                  <Text style={styles.mono}>
                    {p.lat.toFixed(5)}, {p.lon.toFixed(5)} · raio {p.radiusM} m
                  </Text>
                </View>
                <Pressable onPress={() => apagarLugar(p)} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
                  <Ionicons name="trash-outline" size={17} color={colors.ink3} />
                </Pressable>
              </View>
            ))
          )}

          {lugares.length < MAX_REGIONS ? (
            <>
              <View style={styles.divisor} />

              <TextInput
                value={nomeNovo}
                onChangeText={setNomeNovo}
                placeholder="Nome do lugar"
                placeholderTextColor={colors.ink3}
                style={styles.campo}
                autoCapitalize="sentences"
                returnKeyType="done"
                maxLength={40}
                onSubmitEditing={adicionarDaqui}
              />

              {nomeNovo.trim() === '' ? (
                <View style={styles.sugestoes}>
                  {SUGESTOES.filter(
                    (s) => !lugares.some((p) => p.name.toLowerCase() === s.toLowerCase()),
                  ).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setNomeNovo(s)}
                      style={({ pressed }) => [styles.sugestao, pressed && styles.pressed]}
                    >
                      <Text style={styles.sugestaoTexto}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={adicionarDaqui}
                disabled={ocupado || nomeNovo.trim() === ''}
                style={({ pressed }) => [
                  styles.botaoSec,
                  pressed && styles.pressed,
                  (ocupado || nomeNovo.trim() === '') && styles.desabilitado,
                ]}
              >
                <Ionicons name="location-outline" size={17} color={colors.ink} />
                <Text style={styles.botaoSecTexto}>
                  {nomeNovo.trim() === ''
                    ? 'Registrar daqui'
                    : `Registrar “${nomeNovo.trim()}” daqui`}
                </Text>
              </Pressable>
              <Text style={styles.nota}>
                O ponto de agora vira o centro do raio. Cadastre estando no lugar.
              </Text>
            </>
          ) : (
            <Text style={styles.nota}>
              As {MAX_REGIONS} vagas do iOS estão ocupadas. Apague um lugar para criar outro.
            </Text>
          )}
        </View>

        {/* ---------- medidas ---------- */}
        <Text style={styles.sectionTitle}>O que esta fase mede</Text>
        <View style={styles.card}>
          <View style={styles.medidas}>
            <Medida
              n={resumo.total}
              label="eventos"
              nota={resumo.days > 0 ? `em ${resumo.days} dia${resumo.days > 1 ? 's' : ''}` : 'nenhum ainda'}
              cor={colors.ink}
              styles={styles}
            />
            <Medida
              n={resumo.busiestDay?.count ?? 0}
              label="pior dia"
              nota="acima de 60 é flapping"
              cor={(resumo.busiestDay?.count ?? 0) > 60 ? alerta.text : colors.ink}
              styles={styles}
            />
          </View>

          <View style={styles.divisor} />

          <View style={styles.medidas}>
            <Medida
              n={resumo.shortStays}
              label="passagens"
              nota={`ficou menos de ${SHORT_STAY_MIN} min`}
              cor={colors.ink2}
              styles={styles}
            />
            <Medida
              n={resumo.shortGaps}
              label="colagens"
              nota={`voltou em menos de ${SHORT_GAP_MIN} min`}
              cor={colors.ink2}
              styles={styles}
            />
            <Medida
              n={resumo.openEnters}
              label="sem saída"
              nota="borda que seria inferida"
              cor={resumo.openEnters > 0 ? alerta.text : colors.ink2}
              styles={styles}
            />
          </View>

          {resumo.staleFixes > 0 ? (
            <Text style={styles.nota}>
              {resumo.staleFixes} evento{resumo.staleFixes > 1 ? 's' : ''} com coordenada de mais de 5 min —
              o iOS entregou a borda mas o ponto em cache estava velho.
            </Text>
          ) : null}
        </View>
        <Text style={styles.nota}>
          Estes três números decidem os limiares da fase 1. Se os seus contradisserem o que a
          proposta assumiu, quem muda é a proposta.
        </Text>

        {/* ---------- log ---------- */}
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Eventos</Text>
          <Pressable onPress={limpar} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name="trash-outline" size={17} color={colors.ink3} />
          </Pressable>
        </View>
        <View style={styles.card}>
          {recentes.length === 0 ? (
            <Text style={styles.vazio}>Nenhum evento ainda.</Text>
          ) : (
            recentes.map((e) => (
              <View key={e.id} style={styles.evento}>
                <Text style={styles.eventoHora}>{formatarMomento(e.at)}</Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>
                    {e.kind === 'enter' ? 'chegou' : 'saiu'} · {placeName(lugares, e.placeId)}
                  </Text>
                  <Text style={styles.mono}>
                    {e.appState}
                    {e.accuracyM != null ? ` · ±${Math.round(e.accuracyM)} m` : ' · sem fix'}
                    {e.fixAgeS != null ? ` · fix de ${e.fixAgeS}s` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={e.kind === 'enter' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={17}
                  color={e.kind === 'enter' ? ok.text : colors.ink3}
                />
              </View>
            ))
          )}
        </View>
        <Text style={styles.nota}>
          Um evento com estado <Text style={styles.mono}>background</Text> é a prova de que o iOS
          relançou o app sozinho para entregá-lo. Sem nenhum deles, a feature não funciona fechada —
          e é melhor descobrir agora.
        </Text>
      </ScrollView>
    </View>
  );
}

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

    content: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.sm },
    intro: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.ink2 },

    sectionTitle: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginTop: spacing.md,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    divisor: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },

    estadoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    rowContent: { flex: 1, gap: 2 },
    rowLabel: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink },
    rowSub: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.ink2 },
    mono: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink3 },

    botao: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    botaoTexto: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.onPrimary },
    botaoParar: { backgroundColor: colors.surfaceMute },
    botaoPararTexto: { color: colors.ink },
    botaoSec: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingVertical: spacing.sm,
    },
    botaoSecTexto: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink },
    desabilitado: { opacity: 0.4 },

    lugarLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    campo: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.ink,
      backgroundColor: colors.bg2,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      minHeight: 42,
    },
    sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    sugestao: {
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
    },
    sugestaoTexto: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink2 },

    medidas: { flexDirection: 'row', gap: spacing.sm },
    medida: { flex: 1, gap: 1 },
    medidaN: { fontFamily: fonts.monoSemiBold, fontSize: 26, lineHeight: 30 },
    medidaLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
    medidaNota: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 15, color: colors.ink3 },

    nota: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.ink3 },
    vazio: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink3 },

    logHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    evento: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    eventoHora: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink3, width: 76 },
  });
}
