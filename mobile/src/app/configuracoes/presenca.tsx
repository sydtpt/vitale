import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import {
  SHORT_GAP_MIN,
  SHORT_STAY_MIN,
  clearPresenceLog,
  readPresenceLog,
  summarizePresence,
  vitalsByPlace,
  type PresenceEvent,
} from '../../lib/presence-events';
import {
  MAX_REGIONS,
  MIN_RADIUS_M,
  placeName,
  readPresencePlaces,
  removePresencePlace,
  type PresencePlace,
} from '../../lib/presence-places';
import {
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

/** "há 2 h", "há 3 d", "agora" — a idade de um sinal, não a data dele. */
function desde(iso: string): string {
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 2) return 'agora';
  if (min < 60) return `há ${Math.round(min)} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

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

  // Carrega na montagem e a cada volta do editor — `useFocusEffect` cobre as
  // duas, então um `useEffect` de montagem seria uma leitura duplicada.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const resumo = useMemo(() => summarizePresence(eventos), [eventos]);
  const vitais = useMemo(() => vitalsByPlace(eventos), [eventos]);
  const recentes = useMemo(() => [...eventos].reverse().slice(0, 60), [eventos]);

  const pedirPermissao = () => {
    setOcupado(true);
    requestPresencePermission()
      .then(setPerm)
      .catch((e: unknown) => Alert.alert('Não deu', String(e)))
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
        <Text style={styles.sectionTitle}>
          Lugares · {lugares.length} de {MAX_REGIONS} vagas
        </Text>
        <View style={styles.card}>
          {lugares.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhum ainda. O primeiro define o que a observação mede.
            </Text>
          ) : (
            lugares.map((p) => {
              const v = vitais.get(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/configuracoes/presenca-local?id=${p.id}`)}
                  style={({ pressed }) => [styles.lugarLinha, pressed && styles.pressed]}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{p.name}</Text>
                    {/* Sinais vitais, não coordenada: de relance o que importa
                        é se o lugar está vivo. A coordenada mora no editor. */}
                    <Text style={[styles.mono, !v && styles.mudo]}>
                      {v
                        ? `${v.count} evento${v.count > 1 ? 's' : ''} · ${desde(v.lastAt!)} · ${p.radiusM} m`
                        : `nenhum evento ainda · ${p.radiusM} m`}
                    </Text>
                    {p.geometryChangedAt ? (
                      <Text style={styles.mono}>
                        geometria alterada {desde(p.geometryChangedAt)}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => apagarLugar(p)}
                    hitSlop={12}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.ink3} />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
                </Pressable>
              );
            })
          )}

          {lugares.length < MAX_REGIONS ? (
            <Pressable
              onPress={() => router.push('/configuracoes/presenca-local')}
              style={({ pressed }) => [styles.botao, pressed && styles.pressed]}
            >
              <Text style={styles.botaoTexto}>+  Adicionar local</Text>
            </Pressable>
          ) : (
            <Text style={styles.nota}>
              As {MAX_REGIONS} vagas do iOS estão ocupadas. Apague um lugar para criar outro.
            </Text>
          )}
        </View>
        {lugares.length > 0 ? (
          <Text style={styles.nota}>Toque num lugar para ajustar o raio ou mover o centro.</Text>
        ) : null}

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

          <View style={styles.divisor} />

          <View style={styles.estadoLinha}>
            <Ionicons
              name="resize-outline"
              size={18}
              color={
                resumo.medianAccuracyM != null && resumo.medianAccuracyM >= MIN_RADIUS_M
                  ? alerta.text
                  : colors.ink3
              }
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>
                {resumo.medianAccuracyM != null
                  ? `Precisão mediana: ±${resumo.medianAccuracyM} m`
                  : 'Precisão mediana: sem fix ainda'}
              </Text>
              <Text style={styles.rowSub}>
                {resumo.medianAccuracyM == null
                  ? 'Aparece depois dos primeiros eventos. É ela que decide o menor raio viável.'
                  : resumo.medianAccuracyM >= MIN_RADIUS_M
                    ? `Seu erro típico alcança o piso de ${MIN_RADIUS_M} m. Um raio no piso vai gerar entradas e saídas com você parado — suba os raios.`
                    : `O raio precisa ser maior que isso. Com ±${resumo.medianAccuracyM} m, ${MIN_RADIUS_M} m tem folga de ${Math.round((MIN_RADIUS_M / resumo.medianAccuracyM) * 10) / 10}×.`}
              </Text>
            </View>
          </View>

          {resumo.redundant > 0 ? (
            <Text style={styles.nota}>
              {resumo.redundant} relatório{resumo.redundant > 1 ? 's' : ''} de estado fora da conta.
              O iOS reavalia a região a cada lançamento do app e diz “dentro”; isso não é chegada,
              e contá-lo inventaria bordas que nunca existiram.
            </Text>
          ) : null}

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
              <View key={e.id} style={[styles.evento, e.redundant && styles.eventoRedundante]}>
                <Text style={styles.eventoHora}>{formatarMomento(e.at)}</Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>
                    {e.redundant
                      ? `relatório de estado · ${placeName(lugares, e.placeId)}`
                      : `${e.kind === 'enter' ? 'chegou' : 'saiu'} · ${placeName(lugares, e.placeId)}`}
                  </Text>
                  <Text style={styles.mono}>
                    {e.appState}
                    {e.accuracyM != null ? ` · ±${Math.round(e.accuracyM)} m` : ' · sem fix'}
                    {e.fixAgeS != null ? ` · fix de ${e.fixAgeS}s` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={
                    e.redundant
                      ? 'ellipse-outline'
                      : e.kind === 'enter'
                        ? 'arrow-down-circle-outline'
                        : 'arrow-up-circle-outline'
                  }
                  size={17}
                  color={e.redundant ? colors.ink3 : e.kind === 'enter' ? ok.text : colors.ink3}
                />
              </View>
            ))
          )}
        </View>
        <Text style={styles.nota}>
          Um evento com estado <Text style={styles.mono}>background</Text> é a prova de que o iOS
          relançou o app sozinho para entregá-lo. Sem nenhum deles, a feature não funciona fechada —
          e é melhor descobrir agora. Só vale a partir de uma saída de casa de verdade: sem
          travessia, não há o que o iOS entregue.
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
    desabilitado: { opacity: 0.4 },

    lugarLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    /** Um lugar sem nenhum evento: o sintoma central da fase 0. */
    mudo: { color: colors.ink2, fontStyle: 'italic' as const },

    medidas: { flexDirection: 'row', gap: spacing.sm },
    medida: { flex: 1, gap: 1 },
    medidaN: { fontFamily: fonts.monoSemiBold, fontSize: 26, lineHeight: 30 },
    medidaLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
    medidaNota: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 15, color: colors.ink3 },

    nota: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.ink3 },
    vazio: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink3 },

    logHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    evento: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    /** Relatório de estado: fica visível como prova de que a task rodou, e
        apagado porque não é travessia. */
    eventoRedundante: { opacity: 0.45 },
    eventoHora: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink3, width: 76 },
  });
}
