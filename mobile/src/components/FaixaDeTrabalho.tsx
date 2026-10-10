/**
 * A faixa que diz o que o app está fazendo nesta atividade.
 *
 * Uma linha fina abaixo do cabeçalho, com o trabalho em palavras e uma barra.
 * Some sozinha quando acaba. Ver `docs/specs/trabalho-em-curso/spec.md`.
 *
 * **Por que ela existe.** O enriquecimento de cidades de uma pedalada longa são
 * 41 chamadas ao OpenStreetMap a 1,1 s — ~45 s em que a tela ficava idêntica a
 * uma tela quebrada, e o dono saía e voltava para descobrir se algo acontecia.
 *
 * **Por que sem contagem.** A barra avança, mas não escreve `12 de 41`: ele já
 * recusou denominador antes, e o número não muda a decisão — a pergunta é
 * "devo esperar?", não "quanto exatamente falta".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing, useThemedStyles } from '../theme';
import { ROTULO, oQueMostrar, useTrabalhoStore } from '../store/trabalho.store';

/**
 * Abaixo disto o passe não aparece: carregar o traçado e varrer fotos levam
 * 1–2 s, e uma faixa que pisca é pior que nenhuma (CAP-3).
 */
const LIMIAR_MS = 600;

/** Quanto falta, em palavras curtas. */
function esperaEmPalavras(ate: number, agora: number): string {
  const faltam = Math.max(0, ate - agora);
  const min = Math.ceil(faltam / 60_000);
  if (min <= 1) return 'menos de 1 min';
  return `${min} min`;
}

export function FaixaDeTrabalho({
  atividadeId,
  color,
  onRepetir,
}: {
  atividadeId: string;
  /** Accent do módulo da atividade — a barra não tem cor própria. */
  color: string;
  onRepetir?: (tipo: 'cidades' | 'nome' | 'piso') => void;
}) {
  const styles = useThemedStyles(createStyles);
  const emCurso = useTrabalhoStore((s) => s.emCurso);
  const falhas = useTrabalhoStore((s) => s.falhas);
  const esquecerFalha = useTrabalhoStore((s) => s.esquecerFalha);

  const mostrar = oQueMostrar(atividadeId, emCurso, falhas);

  // Um relógio só enquanto há faixa: ele serve ao limiar e à contagem da
  // espera, e para quando não há nada na tela.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!mostrar) return;
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, [!!mostrar]);

  const novoDemais =
    mostrar?.estado === 'curso' && agora - mostrar.trabalho.desde < LIMIAR_MS;
  const visivel = !!mostrar && !novoDemais;

  // Altura animada: a faixa nasce e morre sem a tela saltar.
  const altura = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(altura, {
      toValue: visivel ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [visivel, altura]);

  // A barra indeterminada: vai e volta enquanto não há avanço para mostrar.
  const desliza = useRef(new Animated.Value(0)).current;
  const indeterminada =
    mostrar?.estado === 'curso' && !(mostrar.trabalho.total && mostrar.trabalho.total > 0);
  useEffect(() => {
    if (!visivel || !indeterminada) return;
    const laco = Animated.loop(
      Animated.timing(desliza, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    );
    desliza.setValue(0);
    laco.start();
    return () => laco.stop();
  }, [visivel, indeterminada, desliza]);

  if (!mostrar) return null;

  const corpo =
    mostrar.estado === 'curso' ? (
      <>
        <Text style={styles.rotulo}>{ROTULO[mostrar.trabalho.tipo]}</Text>
        <View style={styles.trilho}>
          {indeterminada ? (
            <Animated.View
              style={[
                styles.barra,
                {
                  backgroundColor: color,
                  width: '35%',
                  left: desliza.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ['0%', '65%', '0%'],
                  }),
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.barra,
                {
                  backgroundColor: color,
                  width: `${Math.round(
                    (100 * (mostrar.trabalho.feito ?? 0)) / (mostrar.trabalho.total || 1),
                  )}%`,
                },
              ]}
            />
          )}
        </View>
      </>
    ) : (
      <View style={styles.falhaLinha}>
        <View style={styles.falhaTexto}>
          <Text style={styles.rotulo}>{mostrar.falha.motivo}</Text>
          {mostrar.falha.repetirApos && mostrar.falha.repetirApos > agora ? (
            <Text style={styles.sub}>
              dá para tentar em {esperaEmPalavras(mostrar.falha.repetirApos, agora)}
            </Text>
          ) : null}
        </View>
        {mostrar.falha.repetirApos && mostrar.falha.repetirApos > agora ? (
          // Botão desabilitado de propósito: oferecer repetir durante a espera
          // do serviço é convidar a tomar outro 429 e piorar o bloqueio.
          <View style={[styles.repetir, styles.repetirMudo]}>
            <Ionicons name="time-outline" size={14} color={colors.ink3} />
            <Text style={styles.repetirTextoMudo}>aguarde</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              esquecerFalha(mostrar.falha.atividadeId, mostrar.falha.tipo);
              onRepetir?.(mostrar.falha.tipo);
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.repetir, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={14} color={color} />
            <Text style={[styles.repetirTexto, { color }]}>tentar de novo</Text>
          </Pressable>
        )}
      </View>
    );

  return (
    <Animated.View
      style={[
        styles.fora,
        {
          opacity: altura,
          maxHeight: altura.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }),
        },
      ]}
      pointerEvents={visivel ? 'auto' : 'none'}
    >
      <View style={styles.dentro}>{corpo}</View>
    </Animated.View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    fora: { overflow: 'hidden' },
    dentro: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    rotulo: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink2 },
    sub: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
    trilho: {
      height: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.lineDeep,
      overflow: 'hidden',
    },
    barra: { position: 'absolute', top: 0, bottom: 0, borderRadius: radii.pill },
    falhaLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    falhaTexto: { flex: 1 },
    repetir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    repetirMudo: { opacity: 0.7 },
    repetirTexto: { fontSize: 13, fontFamily: fonts.sansBold },
    repetirTextoMudo: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3 },
    pressed: { opacity: 0.6 },
  });
