import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FotoRecusadaNaTroca,
  nomeDaAtividadeNaCapa,
  type ActivityPhoto,
  type SecaoDoSeletor,
} from '@vitale/shared';
import { useAssetUri } from '../../hooks/useAssetUri';
import { TrocaRecusada } from '../../lib/edicao-ia';
import { getActivityMeta } from '../../lib/workout-types';
import type { ResultadoDaTroca } from '../../store/edicao.store';
import { baseBg, colors, fonts, radii, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * O seletor da troca da capa (Story 1.16) — a **segunda face** do `Modal` da capa
 * aberta, nunca um terceiro modal.
 *
 * As fotos do período que podem ser capa, **agrupadas por atividade** como a
 * galeria da Retrospectiva: a atividade mais recente primeiro, as fotos em ordem
 * cronológica. Quem decide o que entra e em que ordem é o núcleo
 * (`secoesDoSeletor`); aqui só se desenha.
 *
 * ## A foto da capa não é "a selecionada"
 *
 * Ela leva **anel e o rótulo "na capa"** porque é a que está publicada. A seleção
 * é outra coisa — a foto que o dono tocou — e só ela acende o botão do ato. A da
 * capa **não se seleciona** (tocá-la não faz nada, e o leitor de tela a anuncia
 * desabilitada): trocar a capa por ela mesma não é troca — e a store recusa do
 * mesmo jeito, porque apagaria o porquê carimbado.
 *
 * A foto cuja miniatura **não resolveu** (saiu da biblioteca) também não se
 * seleciona: seria uma capa que nunca desenha, escolhida por quem não a viu.
 *
 * ## Virtualizado
 *
 * Julho de 2026 tem **372 fotos em 12 atividades**. Montar todas de uma vez
 * derrubou a galeria do período no aparelho em 07/09; a `SectionList` monta só o
 * que está perto da janela, uma **linha de quatro** por item, e cada miniatura se
 * resolve pelo `useAssetUri` (teto de seis extrações em voo).
 *
 * ## A troca falha em voz alta
 *
 * A mensagem aparece aqui, em cima do botão, e **a seleção fica** — o dono não
 * precisa achar a foto de novo para tentar outra vez. **Enquanto a troca corre, não
 * se sai**: "Voltar" fica inerte (e o `Modal` ignora o voltar do sistema, via
 * `onTrocando`), senão a mensagem de uma falha seria descartada em silêncio. O
 * sucesso é anunciado ao leitor de tela, além de voltar à ficha.
 */
export interface SeletorDaCapaProps {
  titulo: string;
  /** O `activity_photos.id` da foto que está na capa — a do anel. */
  fotoNaCapa: string | null;
  carregarFotos: () => Promise<readonly SecaoDoSeletor[]>;
  trocar: (foto: ActivityPhoto) => Promise<ResultadoDaTroca>;
  onVoltar: () => void;
  onTrocada: () => void;
  /** Avisa quem monta o `Modal` que uma troca começou ou terminou — para ele ignorar o fechar. */
  onTrocando?: (emCurso: boolean) => void;
}

/** Quatro por linha, como no canvas: a miniatura ainda se lê, e a pedalada de 73 cabe em 19 linhas. */
const COLUNAS = 4;
const VAO = 6;

type Lista =
  | { readonly estado: 'carregando' }
  | { readonly estado: 'erro'; readonly mensagem: string }
  | { readonly estado: 'pronta'; readonly secoes: readonly SecaoDoSeletor[] };

/**
 * A frase para uma lista que não veio. As recusas já nascem frase (o acervo que
 * não chegou, o período sem edição); o resto é transporte, e vai para o log.
 */
function mensagemDasFotos(e: unknown): string {
  if (e instanceof TrocaRecusada || e instanceof FotoRecusadaNaTroca) return e.message;
  console.warn('[revista] as fotos do período não vieram para o seletor da capa:', e);
  return 'Não foi possível procurar as fotos do período agora.';
}

const dois = (n: number): string => String(n).padStart(2, '0');

/** `"18/07"` do início da atividade, no dia local — ou vazio, se não se lê. */
function diaCurto(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
}

/** `"17:09"` do instante da foto — o nome dela para quem ouve. */
function horaCurta(ms: number): string {
  const d = new Date(ms);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

const contagem = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** O que o leitor de tela ouve quando a troca dá certo — a face volta para a ficha. */
const ANUNCIO_DA_TROCA = 'Capa trocada.';

export function SeletorDaCapa({
  titulo, fotoNaCapa, carregarFotos, trocar, onVoltar, onTrocada, onTrocando,
}: SeletorDaCapaProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { scheme } = useTheme();

  const [lista, setLista] = useState<Lista>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [escolhida, setEscolhida] = useState<ActivityPhoto | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  /** A face pode sair da árvore no meio de uma resposta — fechar o modal, voltar. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    let desta = true;
    setLista({ estado: 'carregando' });
    carregarFotos().then(
      (secoes) => {
        if (desta) setLista({ estado: 'pronta', secoes });
      },
      (e: unknown) => {
        if (desta) setLista({ estado: 'erro', mensagem: mensagemDasFotos(e) });
      },
    );
    return () => {
      desta = false;
    };
  }, [carregarFotos, tentativa]);

  const tocar = useCallback((p: ActivityPhoto) => {
    // A da capa não se seleciona (o quadro já vem desabilitado; isto é a rede).
    if (trocando || p.id === fotoNaCapa) return;
    setFalha(null);
    // Tocar a escolhida de novo desfaz a seleção, e o botão apaga.
    setEscolhida((atual) => (atual?.id === p.id ? null : p));
  }, [fotoNaCapa, trocando]);

  const confirmar = useCallback(async () => {
    if (!escolhida || trocando) return;
    setTrocando(true);
    onTrocando?.(true);
    setFalha(null);
    const r = await trocar(escolhida);
    onTrocando?.(false);
    if (!vivo.current) return;
    setTrocando(false);
    if (r.ok) {
      AccessibilityInfo.announceForAccessibility(ANUNCIO_DA_TROCA);
      onTrocada();
      return;
    }
    setFalha(r.mensagem);
    AccessibilityInfo.announceForAccessibility(r.mensagem);
  }, [escolhida, trocando, trocar, onTrocada, onTrocando]);

  const tamanho = Math.floor((width - spacing.xl * 2 - VAO * (COLUNAS - 1)) / COLUNAS);

  /** Cada seção vira linhas de quatro — a unidade que a `SectionList` virtualiza. */
  const secoes = useMemo(() => {
    if (lista.estado !== 'pronta') return [];
    return lista.secoes.map((s) => {
      const linhas: ActivityPhoto[][] = [];
      for (let i = 0; i < s.fotos.length; i += COLUNAS) linhas.push(s.fotos.slice(i, i + COLUNAS));
      return {
        key: s.atividade.id,
        // Com rede para o nome vazio: o título da seção nunca sai em branco.
        titulo: nomeDaAtividadeNaCapa(s.atividade, getActivityMeta(s.atividade.activityId).label),
        dia: diaCurto(s.atividade.startAt),
        total: s.fotos.length,
        data: linhas,
      };
    });
  }, [lista]);

  const resumo = lista.estado === 'pronta' && lista.secoes.length > 0
    ? `${contagem(lista.secoes.reduce((n, s) => n + s.fotos.length, 0), 'foto', 'fotos')} · ${
      contagem(lista.secoes.length, 'atividade', 'atividades')}`
    : null;

  return (
    <View style={[styles.raiz, { backgroundColor: baseBg(scheme), paddingTop: insets.top }]}>
      <View style={styles.cabeca}>
        {/* Inerte enquanto a troca corre: sair no meio descartaria a mensagem de
            uma falha sem ninguém lê-la. */}
        <Pressable
          onPress={onVoltar}
          disabled={trocando}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          accessibilityState={{ disabled: trocando }}
          style={({ pressed }) => [styles.voltar, (pressed || trocando) && styles.pressionado]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.titulo} numberOfLines={1} accessibilityRole="header">{titulo}</Text>
      </View>
      {resumo ? <Text style={styles.resumo}>{resumo}</Text> : null}

      <View style={styles.corpo}>
        {lista.estado === 'carregando' ? (
          <View style={styles.aviso}>
            <ActivityIndicator size="small" color={colors.ink3} />
            <Text style={styles.avisoTxt}>Procurando as fotos do período…</Text>
          </View>
        ) : lista.estado === 'erro' ? (
          <View style={styles.aviso}>
            <Text style={styles.avisoTxt}>{lista.mensagem}</Text>
            <Pressable
              onPress={() => setTentativa((n) => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Tentar de novo"
              style={({ pressed }) => [styles.contorno, pressed && styles.pressionado]}
            >
              <Text style={styles.contornoTxt}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : secoes.length === 0 ? (
          <View style={styles.aviso}>
            <Text style={styles.avisoTxt}>Nenhuma foto do período pode ser capa.</Text>
          </View>
        ) : (
          <SectionList
            sections={secoes}
            keyExtractor={(linha) => linha[0]?.id ?? ''}
            renderSectionHeader={({ section }) => (
              <View style={styles.secaoTopo} accessible accessibilityRole="header"
                accessibilityLabel={`${section.titulo}, ${section.dia}, ${contagem(section.total, 'foto', 'fotos')}`}
              >
                <Text style={styles.secaoTitulo} numberOfLines={2}>{section.titulo}</Text>
                <Text style={styles.secaoMeta}>{section.dia ? `${section.dia} · ${section.total}` : `${section.total}`}</Text>
              </View>
            )}
            renderItem={({ item, index, section }) => (
              <View style={styles.linha}>
                {item.map((p, k) => (
                  <QuadroDaFoto
                    key={p.id}
                    foto={p}
                    tamanho={tamanho}
                    // A posição na atividade: numa rajada, dez fotos cabem no mesmo
                    // minuto, e "Foto das 17:09" seria dez vezes o mesmo nome.
                    posicao={index * COLUNAS + k + 1}
                    total={section.total}
                    naCapa={p.id === fotoNaCapa}
                    escolhida={escolhida?.id === p.id}
                    onPress={tocar}
                  />
                ))}
                {/* Preenche a última linha para os quadros não esticarem. */}
                {item.length < COLUNAS
                  ? Array.from({ length: COLUNAS - item.length }, (_, k) => (
                    <View key={`vazio-${section.key}-${k}`} style={{ width: tamanho }} />
                  ))
                  : null}
              </View>
            )}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            windowSize={5}
            removeClippedSubviews
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>

      {/* A barra do ato: só acende quando OUTRA foto foi tocada. */}
      <View style={[styles.barraDoAto, { paddingBottom: insets.bottom + spacing.md }]}>
        {falha ? <Text style={styles.falha}>{falha}</Text> : null}
        {escolhida ? (
          <Pressable
            onPress={confirmar}
            disabled={trocando}
            accessibilityRole="button"
            accessibilityLabel="Trocar por esta foto"
            accessibilityState={{ busy: trocando }}
            style={({ pressed }) => [styles.ato, styles.atoAceso, pressed && styles.pressionado]}
          >
            {trocando ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.atoAcesoTxt}>Trocar por esta foto</Text>
            )}
          </Pressable>
        ) : (
          <View
            style={[styles.ato, styles.atoApagado]}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel="Escolha uma foto para trocar"
          >
            <Text style={styles.atoApagadoTxt}>Escolha uma foto para trocar</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Uma miniatura. Resolve o endereço sozinha — ver `services/asset-uri.ts`, que
 * põe teto nas extrações em voo.
 *
 * **Só se seleciona o que desenhou.** A da capa não (tocá-la não seria troca), e a
 * que ainda não resolveu ou não resolve mais também não: escolher uma foto que
 * saiu da biblioteca daria uma capa que nunca desenha. As duas ficam desabilitadas
 * — e o leitor de tela diz por quê.
 *
 * O anel é desenhado **por dentro** do quadro, com a foto recuada: o `outline-offset`
 * do canvas não existe no React Native, e um anel por fora esbarraria no vizinho.
 * Tinta para "na capa", a marca para a escolhida — e a escolhida leva também o
 * visto, porque na marca Tinta as duas cores coincidem.
 */
function QuadroDaFoto({ foto, tamanho, posicao, total, naCapa, escolhida, onPress }: {
  foto: ActivityPhoto;
  tamanho: number;
  /** A posição da foto na atividade, de 1 a `total` — o nome dela para quem ouve. */
  posicao: number;
  total: number;
  naCapa: boolean;
  escolhida: boolean;
  onPress: (p: ActivityPhoto) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(foto.assetId);
  const comAnel = naCapa || escolhida;
  const semImagem = uri === null;
  const selecionavel = !naCapa && typeof uri === 'string';
  const nome = `Foto ${posicao} de ${total}, ${horaCurta(foto.takenAt)}`;
  const rotulo = naCapa
    ? `${nome}, já está na capa`
    : semImagem ? `${nome}, não está mais na biblioteca` : nome;

  return (
    <Pressable
      onPress={() => onPress(foto)}
      disabled={!selecionavel}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: escolhida, disabled: !selecionavel }}
      style={{ width: tamanho, height: tamanho }}
    >
      <View style={[styles.quadro, comAnel && styles.quadroRecuado]}>
        {typeof uri === 'string' ? (
          <Image source={{ uri }} style={styles.imagem} />
        ) : semImagem ? (
          // A foto saiu da biblioteca: a lacuna, como na galeria — sumir calado faria
          // a contagem do cabeçalho mentir. E não se seleciona.
          <View style={[styles.imagem, styles.lacuna]}>
            <Ionicons name="help-outline" size={16} color={colors.ink3} />
          </View>
        ) : (
          <View style={styles.imagem} />
        )}
      </View>
      {naCapa ? <View style={[styles.anel, styles.anelDaCapa]} pointerEvents="none" /> : null}
      {escolhida ? <View style={[styles.anel, styles.anelEscolhido]} pointerEvents="none" /> : null}
      {naCapa ? (
        <View style={styles.naCapa} pointerEvents="none">
          <Text style={styles.naCapaTxt}>na capa</Text>
        </View>
      ) : null}
      {escolhida ? (
        <View style={styles.visto} pointerEvents="none">
          <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A espessura do anel e o respiro entre ele e a foto — os 3 + 2 do canvas. */
const ANEL = 3;
const RESPIRO = 2;

const createStyles = () =>
  StyleSheet.create({
    raiz: { flex: 1 },
    cabeca: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 6,
    },
    voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    titulo: { flex: 1, fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    // Alinhado ao título, e não ao voltar: é o subtítulo dele.
    resumo: {
      fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink2,
      paddingLeft: spacing.md + 38 + spacing.sm, paddingRight: spacing.xl, paddingBottom: spacing.md,
    },

    corpo: { flex: 1 },
    lista: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
    aviso: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
    // Informação obrigatória nunca na tinta mais fraca.
    avisoTxt: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    contorno: {
      height: 40, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
    },
    contornoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink },

    secaoTopo: {
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md,
      marginTop: 18, marginBottom: spacing.sm,
    },
    secaoTitulo: { flex: 1, fontSize: 13.5, fontFamily: fonts.sansBold, color: colors.ink },
    secaoMeta: { fontSize: 11, fontFamily: fonts.mono, color: colors.ink2 },
    linha: { flexDirection: 'row', gap: VAO, marginBottom: VAO },

    quadro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.sm, overflow: 'hidden' },
    quadroRecuado: {
      top: ANEL + RESPIRO, left: ANEL + RESPIRO, right: ANEL + RESPIRO, bottom: ANEL + RESPIRO,
      borderRadius: radii.sm - ANEL,
    },
    imagem: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    lacuna: {
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.lineDeep, borderStyle: 'dashed',
    },
    anel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: ANEL, borderRadius: radii.sm },
    anelDaCapa: { borderColor: colors.ink },
    anelEscolhido: { borderColor: colors.primary },
    // "na capa": a tinta cheia com o papel por cima — o par de maior contraste
    // do tema, nos dois esquemas. Mono, porque é carimbo.
    naCapa: {
      position: 'absolute', left: ANEL + RESPIRO + 3, bottom: ANEL + RESPIRO + 3,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.ink,
    },
    naCapaTxt: { fontSize: 9, fontFamily: fonts.mono, color: colors.surface },
    visto: {
      position: 'absolute', right: ANEL + RESPIRO + 3, top: ANEL + RESPIRO + 3,
      width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },

    barraDoAto: {
      paddingTop: spacing.md, paddingHorizontal: spacing.xl, gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    },
    // A falha da troca é informação obrigatória: tinta cheia, e a seleção fica.
    falha: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink },
    ato: {
      minHeight: 44, borderRadius: radii.lg,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
    },
    atoAceso: { backgroundColor: colors.primary },
    // `onPrimary`, nunca `primaryOn` — ver a barreira de `architecture.test.ts`.
    atoAcesoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },
    // Apagado, mas legível: é a instrução do que fazer, e `ink2` passa o piso de texto.
    atoApagado: { backgroundColor: colors.line },
    atoApagadoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    pressionado: { opacity: 0.7 },
  });
