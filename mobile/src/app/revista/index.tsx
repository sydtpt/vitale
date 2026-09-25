import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLUNAS_DA_PAREDE,
  cadernosVisiveis,
  montarParede,
  motivoDoVazio,
  resolveRetroPrefs,
  type AcervoDaParede,
  type CadernoId,
  type ItemDaParede,
  type LadrilhoDaParede,
  type TipoComEdicao,
} from '@vitale/shared';
import { LadrilhoDoArquivo } from '../../components/revista/LadrilhoDoArquivo';
import { TirasDoAnuario } from '../../components/revista/TirasDoAnuario';
import { useAcervoDaParede } from '../../hooks/useAcervoDaParede';
import { useMemoriaDaRetro } from '../../hooks/useMemoriaDaRetro';
import { hrefDaRevista } from '../../lib/edicao-ia';
import { midiaDaParede, type EstadoDaParede, type LoteLido } from '../../lib/parede';
import { retroSince } from '../../store/retro.store';
import { useSettingsStore } from '../../store/settings.store';
import { colors, fonts, radii, spacing, useThemedStyles } from '../../theme';
import type { ActivityPhoto, ParDaRota } from '@vitale/shared';

/** O vão entre as duas colunas — os 12 px do mockup, que é `spacing.md`. */
const VAO_DA_COLUNA = spacing.md;

/**
 * A **parede de capas** — `/revista` (Story 2.4b).
 *
 * A rota irmã da edição. Até aqui o arquivo tinha 39 meses impressos e uma porta
 * só: o cartão do período corrente na Retrospectiva. Para ver junho de 2023 era
 * preciso saber que ele existe e navegar até lá — folhear não existia.
 *
 * A tese é do mockup aprovado (`mockups/key-arquivo.html`): *"a grade é uma
 * parede de capas, não um seletor de data"*. Nenhum calendário, nenhuma roda de
 * mês, nenhum campo de intervalo; o ano aparece como **régua fina** entre as
 * fileiras, que agrupa sem virar controle. O que se reconhece é a capa — e é com
 * elas lado a lado que a textura aparece sozinha: 13 dos 21 meses até mar/2025
 * não têm foto, contra 19 de 20 depois.
 *
 * Quatro regras herdadas da revista, que esta tela não reabre:
 *
 * 1. **Abrir só lê.** A parede não imprime e não convida a imprimir: período
 *    fechado que ninguém escreveu simplesmente não tem ladrilho. O ato pago mora
 *    na rota da edição, na página que o explica.
 * 2. **Uma leitura em lote por coisa** — `useAcervoDaParede`. Nenhuma célula fala
 *    com o banco, e uma barreira de código-fonte cobra isso.
 * 3. **Nada de gesto horizontal, carrossel ou compartilhar.** A borda esquerda é
 *    do voltar do sistema, e a lista rola na vertical e só.
 * 4. **O ano não é uma capa**: ele entra como as quatro tiras do anuário.
 *
 * A lista é virtualizada e o item é a **fileira**, não a célula — o molde é o
 * `SeletorDaCapa`, onde montar 372 miniaturas de uma vez derrubou a tela.
 */
export default function ArquivoScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Aberta a frio (um link, a restauração do estado), não há nada atrás na pilha:
  // o voltar leva à Retrospectiva, de onde a parede abre.
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
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">Arquivo</Text>
      </View>
      <Parede bottom={insets.bottom} />
    </View>
  );
}

/**
 * Os dados e os avisos. **A lista mora no filho**, e essa separação não é
 * estética: com tudo numa função, os `useMemo` da montagem e da mídia rodavam
 * antes dos retornos antecipados e precisavam de um lote de mentira para as fases
 * em que lote não existe — um estado impossível descrito por um comentário. Aqui,
 * quem monta a lista só é chamado quando há o que montar.
 */
function Parede({ bottom }: { bottom: number }) {
  const styles = useThemedStyles(createStyles);
  const { estado, recarregar } = useAcervoDaParede();

  /**
   * Os cadernos que o dono não silenciou (Story 2.5) — a manchete do ladrilho é a
   * mesma da capa da rota, e obedece ao mesmo silêncio. A preferência é resolvida
   * de novo aqui, e não lida crua, porque o cache local pode ter sido gravado por
   * uma versão anterior do app.
   */
  const retroPrefs = useSettingsStore((s) => s.preferences?.retroPrefs);
  const visiveis = useMemo(() => cadernosVisiveis(resolveRetroPrefs(retroPrefs ?? null)), [retroPrefs]);

  /**
   * A janela da Retrospectiva é pedida **uma vez, pelo mês corrente** — e o selo
   * dela é o que invalida as grades dos ladrilhos.
   *
   * Cada ladrilho pedindo a sua transformaria a rolagem num gatilho de busca:
   * chegar em 2023 dispararia a leitura do acervo inteiro para desenhar
   * quadradinhos. Ver `useGradeDoLadrilho`, que declara o que isso custa.
   *
   * O relógio vem do estado, e não de um `useMemo` no mount: ele é renovado
   * quando o **dia vira** (`relogioDaParede`), senão uma parede aberta atravessando
   * a virada do mês manteria o `offset` velho e as capas `grade` desenhariam o mês
   * errado.
   */
  const since = useMemo(() => retroSince(estado.now, 'month', 0), [estado.now]);
  const selo = useMemoriaDaRetro(since);

  if (estado.fase === 'carregando') {
    return (
      <View style={styles.aviso}>
        <View style={styles.linha}>
          <ActivityIndicator size="small" color={colors.ink3} />
          <Text style={styles.lab}>Procurando as edições…</Text>
        </View>
      </View>
    );
  }
  if (estado.fase === 'sem-sessao') {
    return (
      <View style={styles.aviso}>
        <Text style={styles.lab}>Entre na sua conta para ler o arquivo.</Text>
      </View>
    );
  }
  if (estado.fase === 'erro') {
    return (
      <View style={styles.aviso}>
        <Text style={styles.lab}>{estado.mensagem}</Text>
        <Pressable
          onPress={recarregar}
          accessibilityRole="button"
          accessibilityLabel="Tentar de novo"
          style={({ pressed }) => [styles.contorno, pressed && styles.pressed]}
        >
          <Text style={styles.contornoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ListaDaParede
      acervo={estado.acervo}
      fotos={estado.fotos}
      rotas={estado.rotas}
      now={estado.now}
      visiveis={visiveis}
      selo={selo}
      bottom={bottom}
    />
  );
}

function ListaDaParede({ acervo, fotos, rotas, now, visiveis, selo, bottom }: {
  acervo: AcervoDaParede;
  fotos: LoteLido<ActivityPhoto>;
  rotas: LoteLido<readonly ParDaRota[]>;
  now: Date;
  visiveis: readonly CadernoId[];
  selo: number;
  bottom: number;
}) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const itens = useMemo(() => montarParede(acervo, { now, visiveis }), [acervo, now, visiveis]);

  /**
   * A foto e a rota de cada ladrilho, resolvidas **uma vez por onda**.
   *
   * Chamadas por render, as duas devolvem objeto novo a cada quadro no estado
   * `pronta`, e o `React.memo` do ladrilho — que existe justamente porque a parede
   * monta quarenta deles — nunca casaria. Ver `midiaDaParede`.
   */
  const midia = useMemo(() => midiaDaParede(itens, fotos, rotas), [itens, fotos, rotas]);

  /** A coluna: a largura da tela menos as margens e o vão entre as duas. */
  const largura = Math.floor(
    (width - spacing.lg * 2 - VAO_DA_COLUNA * (COLUNAS_DA_PAREDE - 1)) / COLUNAS_DA_PAREDE,
  );

  /**
   * **Dois toques rápidos abririam duas rotas iguais**, uma sobre a outra — a mesma
   * guarda da porta da Retrospectiva. É tempo, e não um "já abri" que o foco
   * limparia: se a navegação não acontecer, o ladrilho não fica morto.
   */
  const ultimoToque = useRef(0);
  const abrir = useCallback((tipo: TipoComEdicao, inicio: string) => {
    const href = hrefDaRevista(tipo, inicio);
    if (href === null) return;
    const agora = Date.now();
    if (agora - ultimoToque.current < 1000) return;
    ultimoToque.current = agora;
    router.push(href);
  }, [router]);
  // As duas estáveis: é o que deixa a `memo` do ladrilho e a das tiras casarem —
  // uma closure criada no `renderItem` seria prop nova a cada quadro.
  const abrirLadrilho = useCallback((l: LadrilhoDaParede) => abrir(l.tipoPeriodo, l.inicio), [abrir]);
  const abrirAnuario = useCallback((inicio: string) => abrir('year', inicio), [abrir]);

  const desenharItem = useCallback(({ item }: { item: ItemDaParede }) => {
    if (item.tipo === 'regua') {
      return (
        <View style={styles.regua}>
          {/* A régua agrupa, e **não é controle**: nada nela se toca, e tocar num
              ano não filtra a parede — é a tese do mockup. Para quem usa
              VoiceOver ela é um cabeçalho de seção, que é o que ela é na página:
              é por ela que se navega o arquivo por saltos, sem virar seletor. */}
          <Text style={styles.reguaAno} accessibilityRole="header">{String(item.ano)}</Text>
          <View style={styles.reguaFilete} />
        </View>
      );
    }
    if (item.tipo === 'anuario') {
      return (
        <View style={styles.bloco}>
          <TirasDoAnuario ano={item.ano} inicio={item.inicio} tiras={item.tiras} onAbrir={abrirAnuario} />
        </View>
      );
    }
    return (
      <View style={styles.fileira}>
        {item.ladrilhos.map((l) => (
          <LadrilhoDoArquivo
            key={l.chave}
            ladrilho={l}
            largura={largura}
            foto={midia.foto(l)}
            rota={midia.rota(l)}
            now={now}
            selo={selo}
            onAbrir={abrirLadrilho}
          />
        ))}
        {/* A fileira ímpar não ganha ladrilho fantasma: o vão fica vazio, e não
            há alvo de toque que não abra nada. */}
        {item.ladrilhos.length < COLUNAS_DA_PAREDE ? <View style={{ width: largura }} /> : null}
      </View>
    );
  }, [styles, largura, midia, now, selo, abrirAnuario, abrirLadrilho]);

  return (
    <FlatList
      data={itens}
      keyExtractor={(item) => item.chave}
      renderItem={desenharItem}
      ListHeaderComponent={
        <View style={styles.cabeca}>
          <Text style={styles.eyebrow}>Edições</Text>
          <Text style={styles.sub}>As edições já impressas.</Text>
        </View>
      }
      // Arquivo vazio é **uma frase**, e não um esqueleto que nunca preenche. E são
      // **duas** frases possíveis: *nada impresso* e *nada que a parede desenhe*
      // são coisas diferentes — quem imprimiu doze semanas leria "nenhuma edição
      // foi escrita ainda" com doze edições no banco, e concluiria que a impressão
      // falhou. Quem separa é o núcleo (`motivoDoVazio`), que tem teste.
      ListEmptyComponent={
        <View style={styles.aviso}>
          <Text style={styles.lab}>
            {motivoDoVazio(acervo) === 'sem-edicao'
              ? 'Nenhuma edição foi escrita ainda.'
              : 'As edições escritas são de semana ou de trimestre. A parede mostra meses e anos.'}
          </Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: bottom + spacing['3xl'] }}
      showsVerticalScrollIndicator={false}
      // Três fileiras cabem na dobra; montar seis já dá margem para a rolagem
      // começar sem branco, sem montar o arquivo inteiro.
      initialNumToRender={6}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const createStyles = () =>
  StyleSheet.create({
    // O mesmo papel da rota irmã (`revista/[tipo]/[inicio]`): o `Stack` é
    // transparente, e sem o token a parede mostraria o `RotinaBackground` enquanto
    // a edição não mostra — duas irmãs com fundo diferente, a um toque uma da outra.
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 6,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    headerTitle: { flex: 1, fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },

    cabeca: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 4,
    },
    // Serifada: é a voz da revista, a mesma do texto dos cadernos.
    sub: { fontSize: 15, lineHeight: 19, fontFamily: fonts.serif, color: colors.ink2 },

    // A régua do ano: o número e um filete. Agrupa, e não é controle.
    regua: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.lg, height: 30, marginTop: spacing.sm,
    },
    reguaAno: { fontSize: 11, fontFamily: fonts.mono, letterSpacing: 1.2, color: colors.ink3 },
    reguaFilete: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },

    fileira: {
      flexDirection: 'row', gap: VAO_DA_COLUNA,
      paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
    },
    bloco: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },

    aviso: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Informação obrigatória nunca na tinta mais fraca.
    lab: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    contorno: {
      minHeight: 44, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
    },
    contornoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    pressed: { opacity: 0.7 },
  });
