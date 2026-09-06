import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gearUsage, type Gear, type GearInput } from '@vitale/shared';
import { useActivitiesStore } from '../store/activities.store';
import { useGearStore } from '../store/gear.store';
import { GearCard } from '../components/cards/GearCard';
import { GearForm } from '../components/cards/GearForm';
import { colors, fonts, radii, shadows, spacing, useTheme, useThemedStyles } from '../theme';

const BIKE_ACTIVITY_ID = 13;

/**
 * Bicicletas — o lugar onde a bicicleta é uma coisa, e não uma opção de filtro.
 *
 * Fica dentro de Ciclismo, e não no Mais: bicicleta não é módulo de vida como
 * Metas ou Cultura, é o equipamento de um tipo de atividade — mesmo precedente
 * da "Visão detalhada por país". Chega-se pelo painel do chip de bicicleta, que
 * é onde a vontade de cadastrar aparece: escolhendo uma e não achando a que se
 * quer.
 */
export default function BicicletasScreen() {
  useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const gears = useGearStore((s) => s.gears);
  const loadGear = useGearStore((s) => s.load);
  const addGear = useGearStore((s) => s.add);
  const editGear = useGearStore((s) => s.edit);
  const setDefaultGear = useGearStore((s) => s.setDefault);
  const removeGear = useGearStore((s) => s.remove);

  const _all = useActivitiesStore((s) => s._all);
  const loadActivities = useActivitiesStore((s) => s.load);

  useEffect(() => {
    loadGear();
    loadActivities();
  }, [loadGear, loadActivities]);

  const rides = useMemo(
    () => _all.filter((a) => !a.hidden && a.activityId === BIKE_ACTIVITY_ID),
    [_all],
  );
  const usage = useMemo(() => gearUsage(gears, rides), [gears, rides]);

  const [editing, setEditing] = useState<Gear | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const onSave = useCallback(
    async (input: GearInput, asDefault: boolean, id?: string) => {
      setBusy(true);
      try {
        if (id) {
          await editGear(id, input);
          if (asDefault) await setDefaultGear(id, input.activeFrom);
        } else {
          await addGear(input, asDefault);
        }
        setEditing(null);
      } catch (e) {
        Alert.alert('Não deu para salvar', e instanceof Error ? e.message : 'Tente de novo.');
      } finally {
        setBusy(false);
      }
    },
    [addGear, editGear, setDefaultGear],
  );

  const onRemove = useCallback(
    (g: Gear) => {
      const n = usage.find((u) => u.gear.id === g.id)?.count ?? 0;
      Alert.alert(
        `Apagar ${g.name}?`,
        n > 0
          ? `${n} ${n === 1 ? 'pedalada volta' : 'pedaladas voltam'} a não ter bicicleta. Nenhuma pedalada é apagada.`
          : 'Nenhuma pedalada usa esta bicicleta.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Apagar',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeGear(g.id);
              } catch (e) {
                Alert.alert('Não deu para apagar', e instanceof Error ? e.message : 'Tente de novo.');
              }
            },
          },
        ],
      );
    },
    [removeGear, usage],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bicicletas</Text>
          <Text style={styles.headerSub}>
            {gears.length} {gears.length === 1 ? 'cadastrada' : 'cadastradas'}
          </Text>
        </View>
        <Pressable
          onPress={() => setEditing('new')}
          hitSlop={12}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Adicionar bicicleta"
        >
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {editing && (
          <GearForm
            gear={editing === 'new' ? undefined : editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={onSave}
          />
        )}

        {usage.length === 0 && !editing && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bike" size={30} color={colors.ink4} />
            <Text style={styles.emptyText}>
              Nenhuma bicicleta cadastrada. Sem ela, as pedaladas não sabem de quem foram.
            </Text>
            <Pressable
              onPress={() => setEditing('new')}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>Adicionar a primeira</Text>
            </Pressable>
          </View>
        )}

        {usage.map((u) => (
          <GearCard
            key={u.gear.id}
            gear={u.gear}
            count={u.count}
            distanceM={u.distanceM}
            rides={rides}
            onEdit={() => setEditing(u.gear)}
            onDefault={() => setDefaultGear(u.gear.id)}
            onRemove={() => onRemove(u.gear)}
          />
        ))}

        {usage.length > 0 && (
          <Text style={styles.foot}>
            A bicicleta de cada pedalada vem da data: quem estava em uso naquele dia. Para
            corrigir uma pedalada específica, toque em Bicicleta no detalhe dela.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.7 },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    roundBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 22, fontFamily: fonts.serif, color: colors.ink },
    headerSub: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono, marginTop: 2 },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 12 },

    empty: { alignItems: 'center', gap: spacing.md, paddingVertical: 40 },
    emptyText: {
      fontSize: 14,
      fontFamily: fonts.sans,
      color: colors.ink2,
      textAlign: 'center',
      maxWidth: 260,
    },
    cta: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    ctaText: { fontSize: 13.5, fontFamily: fonts.sansBold, color: colors.onPrimary },

    foot: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 4, lineHeight: 17 },
  });
