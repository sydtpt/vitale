import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  desenhoDaCapa,
  type LadrilhoDaParede,
  type LeituraDaRota,
} from '@vitale/shared';
import { useAssetUri } from '../../hooks/useAssetUri';
import { useGradeDoLadrilho } from '../../hooks/useGradeDaCapa';
import { rotuloCurtoDaEdicao } from '../../lib/edicao-ia';
import type { FotoNoLadrilho } from '../../lib/parede';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { CapaGrade } from './CapaGrade';
import { CapaTracado } from './CapaTracado';
import { MUDO, PROPORCAO_DO_LADRILHO } from './constantes-da-capa';

/**
 * Um **ladrilho da parede** — a capa de um mês a 173 px, com o rótulo embaixo
 * (Story 2.4b).
 *
 * É a mesma capa da rota da edição, no mesmo desenho e pelos mesmos desenhistas
 * da 2.4a — `projetarTracado` não depende do tamanho da caixa, e é por isso que a
 * rota sai com a **mesma forma** aqui e em 390 px. O que muda é que a parede põe
 * quarenta deles numa lista rolante, e daí as três regras abaixo.
 *
 * ## Nenhuma leitura por célula
 *
 * A capa, o texto, a foto e a rota chegam **prontos**, dos lotes que
 * `useAcervoDaParede` leu uma vez. Este componente não fala com o banco; uma
 * barreira de código-fonte (`parede-sem-leitura-por-celula.test.ts`) cobra isso,
 * porque a saída fácil — chamar `fetchCapa` ou `fetchPhotoById` aqui — funciona
 * perfeitamente numa célula e custa trinta e nove idas ao banco em quarenta.
 *
 * O único trabalho por célula é **resolver o arquivo da biblioteca** num
 * endereço, e ele é por célula por obrigação: é o PhotoKit, não o banco. Roda só
 * no ladrilho montado (a lista é virtualizada) e passa pelo cache, pelo dedup e
 * pelo teto de seis extrações em voo do `services/asset-uri.ts`.
 *
 * ## O texto nunca senta sobre o desenho
 *
 * Ao contrário da capa inteira, aqui o rótulo fica **fora** da caixa do desenho.
 * Numa capa de 173 px não há altura para as duas coisas, e a manchete por cima de
 * uma polilinha em `graphic` estragaria o piso de 4,5 da letra, que é medido
 * contra a superfície.
 *
 * ## `shadows.card`, e não uma borda escrita à mão
 *
 * A capa precisa se separar do papel do app — no mockup isso é um filete de 1 px.
 * `shadows.card` diz a mesma coisa em token: nos temas Clean ele **é** o contorno
 * de 1 px, e no Orbe é a sombra contida que o resto dos cartões usa. Uma borda
 * fixa aqui daria contorno **e** sombra no Clean, que é o peso visual que ele
 * existe para não ter.
 */
export interface LadrilhoDoArquivoProps {
  ladrilho: LadrilhoDaParede;
  /** A coluna, em px — quem a mede é a parede, uma vez, para as duas colunas. */
  largura: number;
  /** A foto da capa, vinda do lote — ver `lib/parede.ts`. */
  foto: FotoNoLadrilho;
  /** A rota da capa, vinda do lote, nos cinco estados que `desenhoDaCapa` lê. */
  rota: LeituraDaRota;
  /** O relógio da parede — o mesmo para todos os ladrilhos enquanto ela estiver montada. */
  now: Date;
  /** O selo da memória da Retrospectiva: é o que invalida a grade. Ver `store/memoria-da-retro.ts`. */
  selo: number;
  onAbrir: (ladrilho: LadrilhoDaParede) => void;
}

/** O que o leitor de tela ouve ao tocar um ladrilho. */
const DICA = 'Abre a edição';

export const LadrilhoDoArquivo = React.memo(function LadrilhoDoArquivo({
  ladrilho, largura, foto, rota, now, selo, onAbrir,
}: LadrilhoDoArquivoProps) {
  const styles = useThemedStyles(createStyles);
  const altura = Math.round(largura * PROPORCAO_DO_LADRILHO);
  const natureza = ladrilho.capa?.natureza ?? null;

  /**
   * A grade só é contada quando alguém vai desenhá-la — a capa `grade` e a
   * `tracado`, que pode cair nela. Numa parede de capas de foto isso é zero
   * contagem, em vez de quarenta varreduras do acervo.
   */
  const precisaDeGrade = natureza === 'tracado' || natureza === 'grade';
  const grade = useGradeDoLadrilho(ladrilho.offset, now, precisaDeGrade, selo);
  // A decisão E o dado vêm juntos do núcleo — não sobra guarda nenhuma aqui.
  const desenho = useMemo(() => desenhoDaCapa(natureza, rota, grade), [natureza, rota, grade]);

  /**
   * Hooks não moram em ramos: o endereço é pedido sempre, com `null` quando não há
   * foto — e `resolvePosterUri(null)` responde `null` sem tocar na biblioteca.
   */
  const daFoto = foto.estado === 'pronta' ? foto.foto : null;
  const uri = useAssetUri(daFoto?.assetId ?? null, daFoto?.mediaType === 'video', daFoto?.durationS ?? null);
  /**
   * O endereço que o `<Image>` **não conseguiu carregar**.
   *
   * Guardado como a própria `uri`, e não como um booleano: assim ele se limpa
   * sozinho quando a foto muda (uma releitura, uma troca de capa), sem efeito
   * nenhum para zerar. Sem isto, um asset que resolve mas não carrega deixa o
   * quadro cinza para sempre, em vez de cair para o papel com a legenda — que é a
   * linha "imagem sumiu do iPhone" da matriz. É a mesma rede do `Thumb` da galeria.
   */
  const [quebrada, setQuebrada] = useState<string | null>(null);

  const caixa = { width: largura, height: altura };
  /**
   * **A ordem destes ramos é o defeito mais caro da story, invertido.**
   *
   * `useAssetUri` devolve `string | null | 'loading'` — e `'loading'` **é uma
   * string**. Testar `typeof uri === 'string'` primeiro o engole: todo ladrilho de
   * foto montava `<Image source={{ uri: 'loading' }}>` no primeiro quadro, e a
   * guarda de `'loading'` logo abaixo virava código morto. O sintoma ficava
   * mascarado porque o `<Image>` que falha e o quadro vazio compartilham o
   * `surfaceMute`. O precedente certo é o `Thumb` de `ActivityPhotosCard`, que
   * testa `'loading'` antes de tudo — e é essa ordem que está aqui.
   */
  const conteudo = natureza === 'foto'
    ? (uri === 'loading' || foto.estado === 'procurando' ? (
      // O lote ou a biblioteca ainda respondendo: o quadro fica, e nada pisca.
      // A caixa já tem a altura final, então não há salto quando a foto chega.
      <View style={styles.quadroVazio} />
    ) : typeof uri === 'string' && uri !== quebrada ? (
      <Image
        source={{ uri }}
        style={styles.imagem}
        accessibilityIgnoresInvertColors
        onError={() => setQuebrada(uri)}
      />
    ) : (
      // A imagem não resolve mais — a linha sumiu, o arquivo saiu da biblioteca,
      // ou o `<Image>` recusou o que a biblioteca devolveu. Nos três, a capa
      // **diz o que era**, pela legenda carimbada.
      <Papel legenda={ladrilho.legenda} styles={styles} />
    ))
    : desenho.tipo === 'tracado' ? (
      <CapaTracado overview={desenho.overview} largura={largura} altura={altura} />
    ) : desenho.tipo === 'grade' ? (
      <CapaGrade grade={desenho.grade} largura={largura} altura={altura} />
    ) : desenho.tipo === 'reservando' ? (
      <View style={styles.quadroVazio} />
    ) : (
      <Papel legenda={ladrilho.legenda} styles={styles} />
    );

  /**
   * O rótulo falado é o período **por extenso** e a manchete **inteira**; o
   * visível é o curto e cortado em três linhas. Quem usa VoiceOver não perde o fim
   * da frase — que é onde costuma estar a base contra a qual o número compara.
   */
  const falado = ladrilho.manchete ? `${ladrilho.rotulo}: ${ladrilho.manchete}` : ladrilho.rotulo;

  return (
    <Pressable
      onPress={() => onAbrir(ladrilho)}
      accessibilityRole="button"
      accessibilityLabel={falado}
      accessibilityHint={DICA}
      style={({ pressed }) => [{ width: largura }, pressed && styles.pressionado]}
    >
      {/* O desenho é fundo, e fundo não fala: quem descreve o ladrilho é o
          `accessibilityLabel` do alvo, em texto de verdade. */}
      <View style={[styles.capa, caixa]} {...MUDO}>{conteudo}</View>
      <View style={styles.rotulo}>
        <Text style={styles.periodo} numberOfLines={1}>
          {rotuloCurtoDaEdicao(ladrilho.tipoPeriodo, ladrilho.inicio).toUpperCase()}
        </Text>
        {/*
          Três linhas, e o corte é **da plataforma**: as primeiras frases reais
          medem 104 a 148 caracteres, e inteiras aqui empurrariam a capa seguinte
          para fora da tela — a parede deixaria de ser parede. Nunca um corte
          escrito à mão (a chamada tem dono único, e uma barreira o cobra), e o
          texto inteiro continua indo para o leitor de tela, acima.
        */}
        {ladrilho.manchete ? (
          <Text style={styles.manchete} numberOfLines={3}>{ladrilho.manchete}</Text>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * O papel — a capa sem imagem, **com a legenda carimbada quando ela acrescenta**.
 *
 * Sem legenda ele fica em branco de propósito: é uma folha em branco, que é
 * exatamente o que aquela edição tem. O período nunca entra aqui, porque ele já
 * está impresso logo abaixo da caixa — escrevê-lo nos dois lugares é o defeito
 * que `legendaQueAcrescenta` existe para evitar.
 */
function Papel({ legenda, styles }: { legenda: string | null; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.papel}>
      {legenda ? <Text style={styles.legenda} numberOfLines={2}>{legenda}</Text> : null}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    capa: {
      borderRadius: radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    // `surfaceMute`, e não `surface`: enquanto o endereço não chega, o quadro tem
    // de se ler como "a imagem vem aí", e não como uma folha em branco.
    quadroVazio: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    imagem: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    papel: { flex: 1, justifyContent: 'flex-end', padding: spacing.sm },
    // Mono: a legenda é carimbo — cidade, quilômetro e hora —, do mesmo tipo da
    // assinatura de um caderno. `ink2` porque é informação, não cromo.
    legenda: { fontSize: 9.5, lineHeight: 13, fontFamily: fonts.mono, color: colors.ink2 },

    rotulo: { paddingTop: spacing.sm },
    // Caixa alta e entreletra larga: é o olho do ladrilho. `ink2`, e não a tinta
    // mais fraca — é a única coisa que diz de que mês é esta capa.
    periodo: {
      fontSize: 10, fontFamily: fonts.mono, letterSpacing: 0.9,
      color: colors.ink2, marginBottom: 4,
    },
    // Serifada, como todo texto que a revista escreve para ser lido.
    manchete: { fontSize: 14, lineHeight: 17, fontFamily: fonts.serif, color: colors.ink },
    pressionado: { opacity: 0.7 },
  });
