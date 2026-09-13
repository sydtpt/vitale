import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DURATION_FULL_H,
  SCORE_COVERAGE_FLOOR,
  coverageNote,
  entradaDaSaude,
  filterByRange,
  localDateStr,
  type AlcanceDaSaude,
  type SonoRange,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { PeriodNav } from '../../components/sono/PeriodNav';
import { SleepScoreDims } from '../../components/sono/SleepScoreDims';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import {
  CONVITE,
  NOTAS_A_CAMINHO,
  fraseDoEstado,
  textoDaAssinatura,
  type EstadoDaLeitura,
} from '../../lib/assinatura';
import { useLeituraDaSaude } from '../../lib/leitura-da-saude';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

/**
 * /sono/saude — a saúde do sono do período, em cinco dimensões contadas, com a
 * leitura em uma frase por cima.
 *
 * É a tela que a proposta de 06/09/2026 pediu, e ela existe **separada da noite**
 * por um motivo de definição: regularidade é uma relação entre noites, não uma
 * propriedade de uma. A noite conta quatro dimensões; o período conta cinco. Não
 * há como o cartão da aba mostrar a quinta, e é isso que dá sentido a esta tela.
 *
 * O que ela recusa: seta de tendência, comparação com período anterior em forma
 * de "melhorou", meta e streak. A contagem de um período ao lado da de outro é o
 * usuário quem faz, navegando — o app não conclui por ele (ADR 0036).
 *
 * Abaixo do piso de cobertura a contagem some e as medidas ficam. No histórico
 * real isto é o caso comum, não a exceção: 14 dos 18 meses estão abaixo.
 *
 * **A contagem vem de `entradaDaSaude`** (story 5.5). A tela montava a fórmula do
 * período à mão — `rangeBounds` + `rangeNights` + `periodScore`, com o histórico
 * cortado antes da janela — e isso tinha duas consequências. A primeira: a mesma
 * contagem escrita duas vezes, aqui e na bancada, livre para divergir sem ninguém
 * ver. A segunda, visível: em "última", a fórmula do período rodava sobre uma
 * noite só, e dispersão de um ponto é sempre zero — a tela mostrava "horário
 * ± 0 min" com dois traços preenchidos. A entrada usa `nightScore` nesse alcance:
 * quatro dimensões, e o horário medido contra o hábito.
 *
 * **A leitura é efêmera e só por toque** (ADR 0047–0049): nada sai do aparelho ao
 * abrir a tela, nada é gravado, e a vaga da frase sempre diz quem escreveu — e,
 * quando o escolhido não escreveu, por quê.
 */
export default function SonoSaudeScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const sc = sleepColors();

  const periods = useSonoStore((s) => s.periods);
  const ratings = useSonoStore((s) => s.sleepRatings);
  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  const ratingsSince = useSonoStore((s) => s.ratingsSince);
  const carregarNotasDesde = useSonoStore((s) => s.carregarNotasDesde);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  // Começa em 7 dias, não em "última": a quinta dimensão é a razão desta tela
  // existir, e ela precisa de noites seguidas. "Última" continua no seletor e
  // degrada sozinha — uma noite só sai com regularidade não medida, que é a
  // verdade, e é o mesmo que o cartão da aba mostra.
  const [range, setRange] = useState<SonoRange>('7d');
  const [offset, setOffset] = useState(0);

  // `hoje` é **dia local**, não instante: a entrada é a mesma da bancada, e o
  // mesmo instante é dia 10 em Bruxelas e dia 9 em São Paulo. Fixo na montagem,
  // como o `today` que ele substituiu.
  const hoje = useMemo(() => localDateStr(), []);
  const today = useMemo(() => new Date(), []);
  // A lista de noites é só para o rótulo do `PeriodNav` ("a noite de 10/09"); a
  // contagem não sai daqui.
  const nights = useMemo(() => filterByRange(periods, range, today, offset), [periods, range, offset, today]);

  const entrada = useMemo(
    () => entradaDaSaude(periods, ratings, { range, offset, hoje }),
    [periods, ratings, range, offset, hoje],
  );
  const score = entrada.score;

  // A janela pode ser mais antiga que os 90 dias de nota que a store carrega —
  // `12m` e `ano` sempre são. Sem isto, a percepção de um ano contaria as notas de
  // três meses e a cobertura mentiria para cima.
  const desde = entrada.janela.since;
  useEffect(() => {
    if (desde !== null) void carregarNotasDesde(desde);
  }, [desde, carregarNotasDesde]);

  // **As notas desta janela já chegaram?** Enquanto não, a contagem da percepção é
  // parcial — e ler agora custaria ~14 s de nuvem por uma frase que seria descartada
  // no instante em que o mapa de notas crescer e a chave da janela mudar. O gatilho
  // espera; a vaga diz por quê.
  const notasACaminho = desde !== null && (ratingsSince === null || ratingsSince > desde);

  const leitura = useLeituraDaSaude(entrada);
  const { estado, escrevendo } = leitura;
  const temFrase = fraseDoEstado(estado) !== null;
  const semToque = escrevendo || notasACaminho;

  // As três temperaturas do ícone (decisão 7 do dono): ele nunca some. Aceso na
  // marca quando não há frase, apagado e sem toque enquanto escreve (ou enquanto as
  // notas não chegaram), e de volta em tinta fraca depois — ainda tocável, porque
  // reler é legítimo.
  const corDoIcone = semToque ? colors.ink4 : temFrase ? colors.ink3 : colors.primary;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* O gatilho ocupa o slot que era do `HeaderSpacer`. Só o ícone, sem palavra —
          então o `accessibilityLabel` é o único texto que ele tem, e é o que o
          VoiceOver fala. */}
      <ScreenHeader
        titulo="Saúde do sono"
        acao={{
          icone: 'reader-outline',
          label: 'Ler esta janela',
          cor: corDoIcone,
          onPress: leitura.ler,
          desabilitado: semToque,
          ocupado: escrevendo,
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <PeriodNav
            range={range}
            offset={offset}
            periods={periods}
            nights={nights}
            onRange={(r) => {
              setRange(r);
              setOffset(0);
            }}
            onOffset={setOffset}
          />

          {/* A manchete, acima das cinco dimensões (decisão 1 do dono). */}
          <VagaDaLeitura estado={estado} notasACaminho={notasACaminho} styles={styles} />

          <SleepScoreDims
            score={score}
            palette={sc}
            note={coverageNote(score) ?? undefined}
          />

          {!score.scored && score.coverage !== null && score.coverage.nights > 0 && (
            <Text style={styles.warn}>
              Abaixo de {Math.round(SCORE_COVERAGE_FLOOR * 100)}% das noites, uma contagem seria sobre
              as noites que o relógio conseguiu gravar — não sobre o período.
            </Text>
          )}
        </View>

        <DeOndeVemCadaLinha alcance={entrada.alcance} styles={styles} />

        <Text style={styles.note}>
          Não é diagnóstico, e não é comparação com outras pessoas. Estágios de sono ficam de fora
          da contagem por decisão: nas suas noites, a fração de sono profundo cai quando você dorme
          mais, então pontuá-la seria premiar noite curta.
        </Text>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * A vaga da frase: convite, espera, ou a manchete com a assinatura.
 *
 * Em repouso ela não fica vazia — o texto aponta para o ícone, que é a única
 * pista que sobrou quando a palavra saiu do cabeçalho. E some quando a frase
 * nasce.
 */
function VagaDaLeitura({
  estado,
  notasACaminho,
  styles,
}: {
  estado: EstadoDaLeitura;
  notasACaminho: boolean;
  styles: Styles;
}) {
  const frase = fraseDoEstado(estado);
  const assinatura = textoDaAssinatura(estado);

  if (estado.fase === 'repouso') {
    return (
      <View style={styles.vaga}>
        {/* O convite aponta para o ícone; quando o ícone está sem toque porque as
            notas não chegaram, apontar para ele seria pedir o impossível. */}
        <Text style={styles.convite}>{notasACaminho ? NOTAS_A_CAMINHO : CONVITE}</Text>
      </View>
    );
  }

  if (estado.fase === 'escrevendo') {
    return (
      <View style={styles.vaga}>
        <Esqueleto styles={styles} />
        {assinatura ? <Text style={styles.assinatura}>{assinatura}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.vaga}>
      {frase !== null ? (
        <Text style={styles.manchete}>{frase}</Text>
      ) : (
        <Text style={styles.convite}>{estado.fase === 'piso' ? (estado.ausencia ?? CONVITE) : CONVITE}</Text>
      )}
      {assinatura ? <Text style={styles.assinatura}>{assinatura}</Text> : null}
    </View>
  );
}

/**
 * O esqueleto varrendo (decisão 4 do dono).
 *
 * Varredura, e **não** barra de progresso: o orquestrador não sabe quanto falta —
 * a mediana medida é de 13,6 s e o pior caso de 25,8 s, e uma barra que anda sem
 * saber para onde é uma barra que mente. O que a varredura diz é só "ainda está
 * acontecendo", que é tudo o que se sabe.
 *
 * `Animated` do React Native, não Reanimated (ADR 0010), e `useNativeDriver` —
 * a animação roda fora do JS, então ela não engasga enquanto a resposta é
 * processada.
 */
function Esqueleto({ styles }: { styles: Styles }) {
  const anda = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const laco = Animated.loop(
      Animated.timing(anda, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [anda]);

  const opacidade = anda.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
  return (
    <View style={styles.esqueleto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 0.82, 0.45].map((largura, i) => (
        <Animated.View
          key={i}
          style={[styles.esqueletoLinha, { width: `${largura * 100}%`, opacity: opacidade }]}
        />
      ))}
    </View>
  );
}

/**
 * De onde vem cada linha — **pelo alcance**.
 *
 * Num período são cinco dimensões, e o horário é dispersão ("quanto as noites se
 * espalham"). Numa noite são quatro: regularidade é relação entre noites e não
 * existe aqui, e o horário passa a ser desvio do habitual. O texto que descrevia a
 * dispersão debaixo de uma contagem de quatro dimensões era a explicação do
 * comportamento que esta story removeu — justamente o "± 0 min" que ela consertou.
 */
function DeOndeVemCadaLinha({ alcance, styles }: { alcance: AlcanceDaSaude; styles: Styles }) {
  const noite = alcance === 'noite';
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>De onde vem cada linha</Text>
      <Legend
        label="Duração"
        text={`Dois traços a partir de ${DURATION_FULL_H} h — o consenso da AASM e da Sleep Research Society (2015).`}
        styles={styles}
      />
      <Legend
        label="Continuidade"
        text="Tempo acordado, comparado com as suas 30 noites anteriores. É relativo de propósito: a troca de relógio em julho derrubou a sua vigília mediana de 71 para 13 minutos sem você mudar nada."
        styles={styles}
      />
      <Legend
        label="Horário"
        text={
          noite
            ? 'Quanto o meio desta noite se afastou do seu horário habitual, medido contra as noites anteriores a ela.'
            : 'Quanto o meio das suas noites se espalha dentro do período. Uma semana inteira deslocada, mas coerente consigo, não é desordem.'
        }
        styles={styles}
      />
      {noite ? null : (
        <Legend
          label="Regularidade"
          text="O índice que compara o seu estado agora com o de 24 h atrás, minuto a minuto. É a medida com a melhor evidência de desfecho que existe, e só roda em noites seguidas."
          styles={styles}
        />
      )}
      <Legend
        label="Percepção"
        text="A nota que você deu ao acordar. É a única dimensão que nenhum aparelho tem — e nas suas noites é a duração que mais anda junto com ela."
        styles={styles}
        last
      />
      {noite ? (
        <Text style={styles.warn}>
          Uma noite conta quatro dimensões: regularidade é uma relação entre noites, não uma
          propriedade de uma.
        </Text>
      ) : null}
    </View>
  );
}

function Legend({ label, text, styles, last }: { label: string; text: string; styles: Styles; last?: boolean }) {
  return (
    <View style={[styles.legendRow, last && styles.noBorder]}>
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.line,
      ...shadows.card,
    },
    cardTitle: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: spacing.sm },
    warn: { marginTop: spacing.md, fontSize: 12, lineHeight: 17, color: colors.ink3, fontFamily: fonts.sans },

    vaga: { marginTop: spacing.md, gap: 5 },
    manchete: { fontSize: 16.5, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },
    convite: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink3 },
    assinatura: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink3 },
    esqueleto: { gap: 7, paddingVertical: 3 },
    esqueletoLinha: { height: 11, borderRadius: 5, backgroundColor: colors.line },

    legendRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 },
    noBorder: { borderBottomWidth: 0, paddingBottom: 0 },
    legendLabel: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    legendText: { fontSize: 12.5, lineHeight: 18, color: colors.ink2, fontFamily: fonts.sans },

    note: { fontSize: 12, lineHeight: 17.5, color: colors.ink3, fontFamily: fonts.sans, paddingHorizontal: 4 },
  });
