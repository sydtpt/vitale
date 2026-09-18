import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { hexToRgb } from '@vitale/shared';
import { degrauDoVeu, htmlDaMedicao, lerMedicao, type PixelMedido } from '../../lib/veu';
import { fonts, mediaVeil, onMedia, spacing, useThemedStyles } from '../../theme';

/**
 * A capa da edição **com foto** (Story 1.13).
 *
 * A imagem sangra de borda a borda e o texto senta em cima dela, sobre um véu em
 * gradiente **local** — nunca um filtro sobre a imagem inteira: a foto informa, e
 * escurecê-la por inteiro para caber texto seria decorar em cima de dado
 * (DESIGN §Elevation & Depth).
 *
 * ## O que este componente não decide
 *
 * **Não escolhe a capa.** Natureza, foto e legenda vêm carimbadas de
 * `edicoes_capa`; recalcular aqui faria a edição de agosto mudar de cara em
 * outubro. A **manchete** é a exceção declarada: ela continua derivada do caderno
 * em `posicao` 1, e uma reimpressão parcial que troque o líder troca a manchete
 * sob a mesma imagem.
 *
 * ## O véu tem piso, e o piso é medido
 *
 * Um céu branco sob texto claro mede ≈1,8. O `MedidorDoVeu` lê o pixel mais claro
 * **da faixa que o texto cobre** e `degrauDoVeu` escolhe o véu mais raso que ainda
 * alcança 4,5 ali. Enquanto isso não volta — e se falhar — vale o degrau mais
 * profundo: a falha é sempre para o lado legível.
 *
 * O véu é **chapado sob o texto** e só rampa acima dele. Um gradiente que
 * continuasse clareando por baixo da manchete faria a medida valer para a legenda
 * e não para ela; assim, todo pixel de texto senta sobre a mesma profundidade que
 * foi medida.
 */

/**
 * A fração da altura da tela que a capa ocupa — `{spacing.capa-altura}: 45vh`.
 *
 * É **mínimo, nunca altura fixa**. A manchete é a chamada inteira e não tem teto
 * de tamanho (`deferred-work.md`, entrada da 1.8), e o tipo dinâmico pode crescer
 * muito: numa caixa fixa, a combinação das duas cortaria o começo da manchete
 * justamente para quem tem baixa visão. Com mínimo, a capa cresce e a imagem
 * cresce com ela.
 */
const FRACAO_DA_ALTURA = 0.45;
/** Onde o véu deixa de ser chapado e começa a sumir, acima do bloco de texto. */
const RAMPA = 96;
/** O bloco de texto antes de ele se medir: o suficiente para não saltar. */
const TEXTO_PRESUMIDO = 180;
/**
 * Quanto se espera pela página de medição antes de desistir dela.
 *
 * Sem teto, o caso pior não é lento: é **mudo**. Um WebView que nem carrega nem
 * erra deixa o véu no mais profundo — que é legível, e por isso indistinguível de
 * um véu medido — e sem nada no log. O teto transforma esse silêncio em uma linha
 * dizendo que nunca se mediu, e libera o processo de conteúdo junto.
 */
const TETO_DA_MEDICAO_MS = 6_000;

/** O que se sabe sobre a foto de baixo. `nunca` inclui "ainda medindo". */
type Medicao =
  | { readonly estado: 'nunca' }
  | { readonly estado: 'medida'; readonly pixel: PixelMedido }
  | { readonly estado: 'falhou' };

export interface CapaComFotoProps {
  /** O período por extenso — "Agosto de 2026". */
  periodo: string;
  /** A chamada do caderno em `posicao` 1, inteira e sem corte — ou `null`. */
  manchete: string | null;
  /** A legenda carimbada — e, para quem não vê a imagem, a descrição dela. */
  legenda: string;
  /** O endereço já resolvido pela biblioteca. Nunca um `ph://` montado à mão. */
  uri?: string;
}

export function CapaComFoto({ periodo, manchete, legenda, uri }: CapaComFotoProps) {
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const minima = Math.round(height * FRACAO_DA_ALTURA);

  const [alturaDoTexto, setAlturaDoTexto] = useState(TEXTO_PRESUMIDO);
  const [alturaDaCapa, setAlturaDaCapa] = useState(minima);
  const [medicao, setMedicao] = useState<Medicao>({ estado: 'nunca' });

  // Foto nova, medida nova: o pixel da anterior não diz nada sobre esta.
  useEffect(() => { setMedicao({ estado: 'nunca' }); }, [uri]);

  /**
   * A resposta da página. **Uma só por foto**: o medidor sai da árvore assim que
   * ela chega, medida ou não, para não segurar um processo de conteúdo por capa
   * numa parede de edições.
   */
  const aoMedir = useCallback((p: PixelMedido | null, motivo?: string) => {
    if (p) {
      setMedicao({ estado: 'medida', pixel: p });
      return;
    }
    // O véu continua legível — fica no mais profundo —, mas "não medi" e "medi e
    // deu profundo" são coisas diferentes, e só o log as separa.
    console.warn(`[revista] o véu NÃO foi medido; fica o mais profundo — ${motivo ?? 'sem motivo'}`);
    setMedicao({ estado: 'falhou' });
  }, []);

  const medirTexto = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setAlturaDoTexto(h);
  }, []);
  const medirCapa = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setAlturaDaCapa(h);
  }, []);

  const alfa = degrauDoVeu(medicao.estado === 'medida' ? medicao.pixel : null);
  const alturaDoVeu = alturaDoTexto + RAMPA;
  // Onde o degradê chega ao valor cheio: o topo do bloco de texto. Abaixo disso
  // ele é chapado, então todo pixel de texto senta sobre a profundidade medida.
  const fimDaRampa = Math.min(0.999, RAMPA / alturaDoVeu);
  const cor = (a: number): string => corComAlfa(mediaVeil, a);

  return (
    // `minHeight` e `justifyContent: flex-end`: com texto curto a capa tem a
    // altura do desenho e o texto encosta embaixo; com texto longo ela cresce, em
    // vez de cortar. A imagem preenche o que a capa acabar sendo.
    <View style={[styles.capa, { minHeight: minima }]} onLayout={medirCapa}>
      {uri ? (
        // A imagem é o fundo, e o fundo não fala: a descrição dela é a legenda,
        // que está escrita por cima em texto de verdade.
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
        />
      ) : null}

      {/* O véu: some para cima, chapado sob todo o texto. */}
      <LinearGradient
        colors={[cor(0), cor(alfa), cor(alfa)]}
        locations={[0, fimDaRampa, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.veu, { height: alturaDoVeu }]}
        pointerEvents="none"
      />

      {/* O respiro acima do texto fica NO DE FORA, para a medição não o contar
          como faixa de texto — e para a capa que cresce ainda ter onde ramper. */}
      <View style={styles.blocoDeTexto}>
        <View style={styles.texto} onLayout={medirTexto}>
          <Text style={styles.eyebrow}>A edição</Text>
          <Text style={styles.periodo} accessibilityRole="header">{periodo}</Text>
          {manchete ? <Text style={styles.manchete}>{manchete}</Text> : null}
          {/* Mono porque é carimbo de medida — lugar, quilômetro e hora. O
              `CHECK` do banco proíbe legenda vazia, e a guarda existe para o vazio
              nunca virar uma linha em branco embaixo da manchete. */}
          {legenda ? <Text style={styles.legenda}>{legenda}</Text> : null}
        </View>
      </View>

      {/* Só enquanto não há resposta: medida ou falha, o WebView vai embora. */}
      {uri && medicao.estado === 'nunca' ? (
        <MedidorDoVeu
          uri={uri}
          razao={alturaDaCapa / width}
          banda={alturaDoTexto / alturaDaCapa}
          aoMedir={aoMedir}
        />
      ) : null}
    </View>
  );
}

/**
 * O medidor: um WebView **sem tamanho**, que desenha a foto num canvas, lê a
 * faixa sob o texto e devolve o pixel mais claro.
 *
 * WebView porque é a ferramenta que a casa já usa para pixel (o cartão de
 * compartilhar), e porque o React Native não sabe ler pixel de uma imagem — nem
 * `expo-image-manipulator` nem `expo-file-system` estão instalados, e acrescentar
 * dependência é pergunta ao dono.
 *
 * Os dois `allow…FromFileURLs` e o `baseUrl` de arquivo existem por uma razão só:
 * sem eles, o canvas com uma imagem `file://` fica *tainted* e o `getImageData`
 * lança `SecurityError`. Quando isso acontece mesmo assim, a página responde
 * `ok:false`, `lerMedicao` devolve `null` e o véu fica no mais profundo — a capa
 * continua legível, sem nada piscar.
 *
 * **A geometria entra arredondada.** `banda` e `razao` mudam de fração de pixel a
 * cada passo de layout, e recalcular o HTML a cada uma delas recarregaria a página
 * no meio da medição — um WebView que nunca chega ao fim. Duas casas bastam: a
 * faixa do texto não se mede em milésimos de tela.
 *
 * **Uma resposta só, e então o desmonte.** Quem decide isso é o pai, que tira o
 * medidor da árvore assim que `aoMedir` chega; aqui dentro o teto de tempo garante
 * que a resposta **sempre** chega — inclusive quando a página não carrega nem erra,
 * que é o caso mudo e o único que ficaria invisível no aparelho.
 */
function MedidorDoVeu({ uri, razao, banda, aoMedir }: {
  uri: string;
  razao: number;
  banda: number;
  aoMedir: (p: PixelMedido | null, motivo?: string) => void;
}) {
  const duasCasas = (v: number): number => Math.round(v * 100) / 100;
  const faixa = duasCasas(banda);
  const forma = duasCasas(razao);
  const html = useMemo(() => htmlDaMedicao({ uri, razao: forma, banda: faixa }), [uri, forma, faixa]);

  // Uma resposta por montagem: o teto não pode falar depois de a página falar.
  const respondeu = useRef(false);
  const responder = useCallback((p: PixelMedido | null, motivo?: string) => {
    if (respondeu.current) return;
    respondeu.current = true;
    aoMedir(p, motivo);
  }, [aoMedir]);

  useEffect(() => {
    const t = setTimeout(
      () => responder(null, `a página não respondeu em ${TETO_DA_MEDICAO_MS / 1000}s`),
      TETO_DA_MEDICAO_MS,
    );
    return () => clearTimeout(t);
  }, [responder]);

  const aoResponder = useCallback((e: WebViewMessageEvent) => {
    const p = lerMedicao(e.nativeEvent.data);
    responder(p, p ? undefined : `a página respondeu sem medida: ${e.nativeEvent.data}`);
  }, [responder]);

  return (
    <View style={estilosDoMedidor.oculto} pointerEvents="none" accessible={false}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'file:///' }}
        // Sem isto o canvas com imagem `file://` fica tainted e getImageData lança.
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={aoResponder}
        onError={() => responder(null, 'a página não carregou')}
      />
    </View>
  );
}

/**
 * A cor do véu + alfa → a string `rgba(...)` que o degradê usa. O hex vem do tema
 * (`mediaVeil`), nunca de um literal aqui; só o alfa varia, e ele é o que a
 * medição decide.
 */
function corComAlfa(hex: string, alfa: number): string {
  const { r, g, b } = hexToRgb(hex);
  const canal = (v: number): number => Math.round(v * 255);
  return `rgba(${canal(r)}, ${canal(g)}, ${canal(b)}, ${Math.round(alfa * 1000) / 1000})`;
}

/**
 * O medidor não pode ocupar espaço nem ser visto, e **não pode ter tamanho zero**:
 * um WebView de 0×0 não é montado em alguns caminhos do iOS, e aí ele nunca
 * carregaria a imagem. Um pixel fora da tela resolve os dois.
 */
const estilosDoMedidor = StyleSheet.create({
  oculto: { position: 'absolute', left: -2, top: -2, width: 1, height: 1, opacity: 0 },
});

/**
 * A folha dentro de `useThemedStyles`, como toda folha do app: `colors` resolve
 * na leitura, e uma criada no escopo do módulo nasce congelada na paleta clara.
 * Aqui só `onMedia` e `mediaVeil` são lidos — os dois independentes de tema,
 * porque a foto também é —, mas a folha fica no lugar certo do mesmo jeito: a
 * próxima cor que alguém acrescentar aqui já nasce respondendo ao tema.
 *
 * **Nenhum texto tem opacidade**, e isso é diferente do mockup, que escreve o
 * eyebrow em `.82` e a legenda em `.80`. O véu foi medido contra `onMedia`
 * inteiro; texto meio transparente tornaria a medida uma promessa que a tela não
 * cumpre, justamente na informação obrigatória (a legenda **é** a descrição da
 * imagem). A hierarquia fica por corpo e família, que é onde ela já estava.
 */
const createStyles = () => StyleSheet.create({
  // Sem raio: a capa sangra, e canto arredondado sangrando é contradição. O fundo
  // é a cor do véu, para o quadro não piscar claro antes de a imagem chegar.
  capa: { position: 'relative', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: mediaVeil },
  veu: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // No fluxo, e não absoluto: é ele que faz a capa crescer com o texto.
  blocoDeTexto: { paddingTop: RAMPA },
  texto: { paddingHorizontal: spacing.xl, paddingBottom: 22 },
  eyebrow: {
    fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
    letterSpacing: 1.1, color: onMedia, marginBottom: 6,
  },
  periodo: { fontSize: 28, lineHeight: 33, fontFamily: fonts.serif, color: onMedia, marginBottom: 10 },
  // A manchete é a chamada inteira — sem `numberOfLines`: cortar esconderia a base.
  manchete: { fontSize: 24, lineHeight: 30, fontFamily: fonts.serif, color: onMedia, marginBottom: 12 },
  legenda: { fontSize: 11.5, fontFamily: fonts.mono, letterSpacing: 0.2, color: onMedia },
});
