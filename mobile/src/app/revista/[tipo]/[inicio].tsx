import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AGG_VERSION,
  rotuloDoCaderno,
  type CadernoId,
  type TipoComEdicao,
} from '@vitale/shared';
import { useEntradaDaEdicao } from '../../../hooks/useEntradaDaEdicao';
import { comDadoDaEntrada, periodoDaRota } from '../../../lib/edicao-ia';
import { useAuthStore } from '../../../store/auth.store';
import {
  AVISO_SEM_CADERNO,
  chaveDe,
  estadoDe,
  useEdicaoStore,
  vistaDaEdicao,
  type AcaoDoCaderno,
  type CadernoNaVista,
} from '../../../store/edicao.store';
import { colors, fonts, radii, spacing, useThemedStyles } from '../../../theme';

/**
 * A rota da revista — `/revista/[tipo]/[inicio]` (Story 1.11).
 *
 * A edição sai de dentro da Retrospectiva e ganha a página inteira: a capa não
 * disputa o topo com o seletor de período, o ato pago acontece na página que o
 * explica, e cada caderno tem o seu estado. A Retrospectiva não perde nada — o
 * cartão dela virou a porta (`EdicaoCard`).
 *
 * O endereço guarda o **início** do período (`/revista/mes/2026-08-01`), que não
 * muda com o relógio; o `offset` sai de `offsetDoInicio`, e daí a entrada é a
 * mesma da Retrospectiva (`useEntradaDaEdicao`).
 *
 * Quatro regras que vêm do desenho aprovado em 16/09 (quadros 2 a 5):
 *
 * 1. **Abrir nunca escreve.** A rota só lê. Escrever é o toque em "Escrever a
 *    edição", "Escrever este caderno", "…de novo" ou "Tentar de novo".
 * 2. **A capa é em papel**: o período em serifada e, com edição impressa, a
 *    manchete — a chamada do caderno em `posicao` 1, inteira e sem corte.
 * 3. **O estado é por caderno**, e a ação tem o peso da causa: escrever (de novo)
 *    é o botão principal, porque gasta uma chamada e é decisão do dono; tentar de
 *    novo é contorno, porque repete o que já se pediu.
 * 4. **Rota inválida é cabeçalho e nada mais**: o Total, um início que não é
 *    início de período, um período em curso. Ela nunca adivinha o período e nunca
 *    imprime.
 *
 * Faixa sangrada, ícone de caderno e famílias de fonte por papel são da 1.12; a
 * capa com foto, da 1.13; o sumário, da 1.14.
 */
export default function RevistaScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tipo: string; inicio: string }>();
  const now = useMemo(() => new Date(), []);

  /** O período do endereço — ou `null`, e a rota é só o cabeçalho. */
  const periodo = useMemo(
    () => periodoDaRota(params.tipo, params.inicio, now),
    [params.tipo, params.inicio, now],
  );

  // Aberta a frio (um link, a restauração do estado), não há nada atrás na pilha, e
  // `back()` não faria nada: o voltar leva à Retrospectiva, de onde a porta abre.
  const voltar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/retrospectiva');
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={voltar}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {/* O título ao lado do voltar, como na proposta: é o nome da edição. */}
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">{periodo?.rotulo ?? ''}</Text>
      </View>

      {periodo && periodo.fechado ? (
        <Revista tipo={periodo.tipo} offset={periodo.offset} now={now} bottom={insets.bottom} />
      ) : null}
    </View>
  );
}

/** A edição de um período fechado e bem endereçado. */
function Revista({ tipo, offset, now, bottom }: { tipo: TipoComEdicao; offset: number; now: Date; bottom: number }) {
  const styles = useThemedStyles(createStyles);
  const { entrada, dadosProntos } = useEntradaDaEdicao(tipo, offset, now);

  const carregar = useEdicaoStore((s) => s.carregar);
  const recarregar = useEdicaoStore((s) => s.recarregar);
  const imprimir = useEdicaoStore((s) => s.imprimir);
  const imprimirCaderno = useEdicaoStore((s) => s.imprimirCaderno);
  const porPeriodo = useEdicaoStore((s) => s.porPeriodo);
  const uid = useAuthStore((s) => s.user?.id);
  const sessaoHidratando = useAuthStore((s) => s.isLoading);

  // A chave é string e só muda com o dono e o período; a entrada muda a cada ciclo
  // da busca da retro. O efeito de leitura depende da chave, e lê com a entrada mais
  // recente — senão cada ciclo de `ensure` relia o banco.
  const chave = useMemo(() => (uid ? chaveDe(uid, entrada) : null), [uid, entrada]);
  const estado = useMemo(() => estadoDe(porPeriodo, chave, sessaoHidratando), [porPeriodo, chave, sessaoHidratando]);
  const entradaRef = useRef(entrada);
  entradaRef.current = entrada;

  // Abrir só lê. A chave nula (sessão ainda no disco) vira chave quando ela chega.
  useEffect(() => {
    void carregar(entradaRef.current);
  }, [carregar, chave]);

  /**
   * Quem tem o que dizer — a resposta do núcleo, pela régua da impressão. `null`
   * enquanto os dados não chegaram: "tem dado" sobre uma memória pela metade não é
   * resposta, e sem resposta nenhum botão de escrever aparece. É a mesma função que
   * as ações da store conferem.
   */
  const comDado = useMemo(() => comDadoDaEntrada(entrada, dadosProntos), [dadosProntos, entrada]);

  const vista = useMemo(() => vistaDaEdicao(estado, comDado, AGG_VERSION), [estado, comDado]);

  const escreverEdicao = useCallback(() => {
    void imprimir(entrada, dadosProntos);
  }, [imprimir, entrada, dadosProntos]);
  const escreverCaderno = useCallback((caderno: CadernoId) => {
    void imprimirCaderno(entrada, dadosProntos, caderno);
  }, [imprimirCaderno, entrada, dadosProntos]);
  const reler = useCallback(() => {
    void recarregar(entrada);
  }, [recarregar, entrada]);

  switch (vista.tipo) {
    case 'nada':
      return null;

    case 'lendo':
      return (
        <View style={styles.aviso}>
          <View style={styles.linha}>
            <ActivityIndicator size="small" color={colors.ink3} />
            <Text style={styles.lab}>Procurando a edição…</Text>
          </View>
        </View>
      );

    case 'sem-sessao':
      return (
        <View style={styles.aviso}>
          <Text style={styles.lab}>Entre na sua conta para ler a edição.</Text>
        </View>
      );

    // Uma porta falhou. O botão relê — nunca escreve. Depois de uma impressão que
    // não terminou, o rótulo diz o que a releitura faz: o `gravar` pode ter feito
    // commit, e só o banco sabe.
    case 'erro':
      return (
        <View style={styles.aviso}>
          <Text style={styles.lab}>{vista.mensagem}</Text>
          <Pressable
            onPress={reler}
            accessibilityRole="button"
            accessibilityLabel={vista.aposImpressao ? 'Ver o que ficou gravado' : 'Tentar de novo'}
            style={({ pressed }) => [styles.botao, styles.botaoContorno, pressed && styles.pressed]}
          >
            <Text style={styles.botaoContornoTxt}>
              {vista.aposImpressao ? 'Ver o que ficou gravado' : 'Tentar de novo'}
            </Text>
          </Pressable>
        </View>
      );

    case 'edicao': {
      const { capa, cadernos } = vista;
      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: bottom + spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
        >
          {/* A capa em papel. Sem foto: ela é escolhida e carimbada na impressão (1.13). */}
          <View style={styles.capa}>
            <Text style={styles.eyebrow}>A edição</Text>
            <Text style={styles.periodo} accessibilityRole="header">{capa.periodo}</Text>
            {capa.impressa ? (
              capa.manchete ? <Text style={styles.manchete}>{capa.manchete}</Text> : null
            ) : capa.escrevendo ? (
              // A mesma frase da porta: com a impressão correndo, o convite mentiria.
              <View style={styles.linha}>
                <ActivityIndicator size="small" color={colors.ink3} />
                <Text style={styles.convite}>Escrevendo a edição…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.convite}>Este período fechou e ainda não foi escrito.</Text>
                {capa.semCaderno ? <Text style={styles.convite}>{AVISO_SEM_CADERNO}</Text> : null}
                {capa.escrever ? (
                  <Botao rotulo="Escrever a edição" principal onPress={escreverEdicao} />
                ) : null}
              </>
            )}
          </View>

          {cadernos.map((c) => (
            <Caderno key={c.caderno} c={c} onAcao={escreverCaderno} />
          ))}
        </ScrollView>
      );
    }

    default:
      return vistaNaoTratada(vista);
  }
}

function vistaNaoTratada(nunca: never): null {
  console.warn('[revista] vista sem desenho:', nunca);
  return null;
}

const ROTULO_DA_ACAO: Record<AcaoDoCaderno, string> = {
  escrever: 'Escrever este caderno',
  'escrever-de-novo': 'Escrever este caderno de novo',
  'tentar-de-novo': 'Tentar de novo',
};

/** Um caderno, no estado dele. */
function Caderno({ c, onAcao }: { c: CadernoNaVista; onAcao: (caderno: CadernoId) => void }) {
  const styles = useThemedStyles(createStyles);
  const acao = 'acao' in c ? c.acao : undefined;

  return (
    <View style={styles.caderno}>
      <Text style={styles.rotulo}>{rotuloDoCaderno(c.caderno)}</Text>

      {c.estado === 'pronta' ? (
        <>
          {/* A errata declara e não reescreve: o texto fica como foi impresso. */}
          {c.errata ? (
            <View style={styles.errata}>
              <Ionicons name="information-circle-outline" size={14} color={colors.ink2} />
              <Text style={styles.errataTxt}>Os números abaixo foram reprocessados depois desta edição.</Text>
            </View>
          ) : null}
          <Text style={styles.texto}>{c.texto}</Text>
          {c.assinatura ? <Text style={styles.assinatura}>{c.assinatura}</Text> : null}
        </>
      ) : null}

      {c.estado === 'na-fila' ? <Text style={styles.lab}>Na fila.</Text> : null}

      {c.estado === 'escrevendo' ? (
        <View style={styles.linha}>
          <ActivityIndicator size="small" color={colors.ink3} />
          <Text style={styles.lab}>Escrevendo…</Text>
        </View>
      ) : null}

      {/* Reprovada: a conferência funcionando, não erro do app — por isso diz o quê. */}
      {c.estado === 'reprovada' ? (
        <>
          <Text style={styles.lab}>{c.motivo}</Text>
          {c.problemas.length > 0 ? (
            <View style={styles.problemas}>
              {c.problemas.map((p, i) => (
                <Text key={i} style={styles.problema}>· {p}</Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {c.estado === 'erro' ? <Text style={styles.lab}>{c.motivo}</Text> : null}

      {c.estado === 'nao-escrito' ? <Text style={styles.lab}>Este caderno ainda não foi escrito.</Text> : null}

      {/* A ação existe ou não existe — nunca desabilitada. O peso é o da causa. */}
      {acao ? (
        <Botao
          rotulo={ROTULO_DA_ACAO[acao]}
          principal={acao !== 'tentar-de-novo'}
          onPress={() => onAcao(c.caderno)}
        />
      ) : null}
    </View>
  );
}

function Botao({ rotulo, principal, onPress }: { rotulo: string; principal?: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        styles.botao,
        principal ? styles.botaoPrincipal : styles.botaoContorno,
        pressed && styles.pressed,
      ]}
    >
      <Text style={principal ? styles.botaoPrincipalTxt : styles.botaoContornoTxt}>{rotulo}</Text>
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    headerTitle: { flex: 1, fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    pressed: { opacity: 0.7 },

    aviso: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    // A capa em papel: a superfície, e o filete que a separa do miolo.
    capa: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.xl, paddingTop: 34, paddingBottom: 26,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 6,
    },
    periodo: { fontSize: 38, lineHeight: 42, fontFamily: fonts.serif, color: colors.ink, marginBottom: 14 },
    // A manchete é a chamada inteira — sem `numberOfLines`: cortar esconderia a base.
    manchete: { fontSize: 24, lineHeight: 30, fontFamily: fonts.serif, color: colors.ink },
    convite: { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink2 },

    caderno: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
      gap: spacing.sm,
    },
    rotulo: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink },
    // Serifada e com entrelinha larga: é texto para ler, não dado para conferir.
    texto: { fontSize: 15, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },
    assinatura: { fontSize: 11, fontFamily: fonts.mono, color: colors.ink2, marginTop: spacing.xs },
    // Informação obrigatória nunca na tinta mais fraca.
    lab: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink2 },
    problemas: { gap: 2 },
    problema: { fontSize: 11.5, lineHeight: 17, fontFamily: fonts.mono, color: colors.ink2 },
    errata: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 6,
      backgroundColor: colors.surfaceMute, borderRadius: radii.md,
      paddingHorizontal: spacing.sm, paddingVertical: 6,
    },
    errataTxt: { flex: 1, fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },

    botao: {
      height: 40, borderRadius: radii.lg, marginTop: spacing.md,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
    },
    // Escrever gasta uma chamada e é decisão do dono: o botão principal, na marca.
    botaoPrincipal: { backgroundColor: colors.primary },
    botaoPrincipalTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.primaryOn },
    // Tentar de novo repete o que já se pediu: contorno, mais leve.
    botaoContorno: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.ink },
    botaoContornoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  });
