import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, MOD } from '../../theme';
import { DayRingCard } from '../../components/cards/DayRingCard';
import { CheckButton } from '../../components/ui/CheckButton';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';
import { HOJE } from '../../services/mock-data';
import { useRotinaStore } from '../../store';

export default function HojeScreen() {
  const [sheetVisible, setSheetVisible] = useState(false);

  // Use local state for prototype (store can be wired later)
  const [meals, setMeals] = useState(HOJE.meals);
  const [habits, setHabits] = useState(HOJE.habits);
  const [casa, setCasa] = useState(HOJE.casa);
  const [water, setWater] = useState(HOJE.water.current);
  const [treinoDone, setTreinoDone] = useState(false);

  const mealsDone = meals.filter(m => m.done).length;
  const habitsDone = habits.filter(h => h.done).length;
  const activity = treinoDone ? 100 : 60;
  const food = meals.length > 0 ? Math.round((mealsDone / meals.length) * 70 + (water / 8) * 30) : 0;
  const mind = habits.length > 0 ? Math.round((habitsDone / habits.length) * 100) : 0;
  const overall = Math.round((activity + food + mind) / 3);

  const toggleMeal = (id: string) => setMeals(arr => arr.map(m => m.id === id ? { ...m, done: !m.done } : m));
  const toggleHabit = (id: string) => setHabits(arr => arr.map(h => h.id === id ? { ...h, done: !h.done } : h));
  const toggleCasa = (id: string) => setCasa(arr => arr.map(c => c.id === id ? { ...c, done: !c.done } : c));

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Greeting */}
        <View style={styles.greet}>
          <Text style={styles.date}>{HOJE.date.toUpperCase()}</Text>
          <Text style={styles.greeting}>{HOJE.greeting}.</Text>
          <Text style={styles.sub}>{HOJE.weekDay} · {4 - mealsDone} checks pendentes</Text>
        </View>

        {/* Day Ring Card */}
        <DayRingCard activity={activity} food={food} mind={mind} overall={overall} />

        {/* Treino */}
        <SectionLabel>Treino</SectionLabel>
        <Pressable style={styles.treinoCard} onPress={() => setTreinoDone(!treinoDone)}>
          <View style={[styles.iconBox, { backgroundColor: MOD.treino.tint }]}>
            <Ionicons name="barbell-outline" size={22} color={MOD.treino.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{HOJE.treino.name}</Text>
            <Text style={styles.cardMeta}>{HOJE.treino.time} · {HOJE.treino.duration} · {HOJE.treino.exercises} exercícios</Text>
          </View>
          <CheckButton checked={treinoDone} />
        </Pressable>

        {/* Alimentação */}
        <SectionLabel right={`${mealsDone}/${meals.length}`}>Alimentação</SectionLabel>
        <View style={styles.card}>
          {meals.map((m, i) => (
            <Pressable key={m.id} style={[styles.mealRow, i === meals.length - 1 && styles.noBorder, m.done && styles.done]}
              onPress={() => toggleMeal(m.id)}>
              <Text style={styles.emoji}>{m.emoji}</Text>
              <View style={styles.flex}>
                <Text style={[styles.mealTitle, m.done && styles.strikethrough]}>{m.name}</Text>
                <Text style={styles.mealMeta} numberOfLines={1}>{m.time} · {m.items}</Text>
              </View>
              <Text style={styles.kcal}>{m.kcal}</Text>
              <CheckButton checked={m.done} small />
            </Pressable>
          ))}
        </View>

        {/* Água */}
        <SectionLabel right={`${water}/8 copos`}>Água</SectionLabel>
        <View style={[styles.card, styles.pad]}>
          <View style={styles.waterRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <Pressable key={i} style={[styles.cup, { backgroundColor: i < water ? MOD.agua.accent : MOD.agua.tint }]}
                onPress={() => setWater(i + 1 === water ? i : i + 1)}>
                <Ionicons name="water" size={20} color={i < water ? '#fff' : MOD.agua.accent} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Hábitos */}
        <SectionLabel right={`${habitsDone}/${habits.length}`}>Hábitos</SectionLabel>
        <View style={styles.habitsGrid}>
          {habits.map(h => (
            <Pressable key={h.id} style={[styles.habitTile, { backgroundColor: h.done ? MOD.habito.tint : colors.surface }]}
              onPress={() => toggleHabit(h.id)}>
              <View style={styles.habitTop}>
                <Ionicons name={h.icon === 'book' ? 'book-outline' : h.icon === 'moon' ? 'moon-outline' : h.icon === 'leaf' ? 'leaf-outline' : 'body-outline'}
                  size={20} color={h.done ? MOD.habito.accent : colors.ink2} />
                <CheckButton checked={h.done} small />
              </View>
              <Text style={styles.habitTitle}>{h.name}</Text>
              <Text style={styles.habitStreak}>
                {h.streak > 0 ? `🔥 ${h.streak} dias` : 'sem streak'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Casa */}
        <SectionLabel right={`${casa.filter(c => c.done).length}/${casa.length}`}>Casa</SectionLabel>
        <View style={styles.card}>
          {casa.map((c, i) => (
            <Pressable key={c.id} style={[styles.choreRow, i === casa.length - 1 && styles.noBorder]}
              onPress={() => toggleCasa(c.id)}>
              <View style={styles.flex}>
                <Text style={[styles.choreTitle, c.done && styles.strikethrough, c.done && styles.muted]}>{c.name}</Text>
              </View>
              <CheckButton checked={c.done} small />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <QuickAddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  date: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontWeight: '600' },
  greeting: { fontFamily: 'InstrumentSerif', fontSize: 34, lineHeight: 36, marginTop: 4, color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, marginTop: 4 },

  treinoCard: {
    backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing.lg,
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12.5, color: colors.ink2 },

  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], marginTop: 8, overflow: 'hidden' },
  pad: { padding: spacing.lg },

  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  noBorder: { borderBottomWidth: 0 },
  done: { opacity: 0.55 },
  emoji: { fontSize: 22, width: 28 },
  mealTitle: { fontSize: 14.5, fontWeight: '500', color: colors.ink },
  mealMeta: { fontSize: 12, color: colors.ink3 },
  kcal: { fontSize: 12.5, color: colors.ink2, fontFamily: 'GeistMono', marginRight: 4 },
  strikethrough: { textDecorationLine: 'line-through' },
  muted: { color: colors.ink3 },

  waterRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cup: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  habitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  habitTile: {
    width: '48%', borderRadius: 16, padding: 12, gap: 6,
  },
  habitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  habitTitle: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  habitStreak: { fontSize: 11.5, color: colors.ink3, fontFamily: 'GeistMono' },

  choreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  choreTitle: { fontSize: 14.5, fontWeight: '500', color: colors.ink },
});
