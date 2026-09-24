import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATALOGO_DE_RECURSOS } from '@vitale/shared';
import {
  estadoDaCompilacaoDosPesos,
  estadoDosPesosAbertos,
  garantirListaAprovada,
  ponteDoAparelho,
  reconsultarPesosAbertos,
  relerCompilacaoDosPesos,
} from '../../../../lib/motores';
import {
  COMPILACAO_AUSENTE,
  RECURSO_MEDIDO_DO_PESO_ABERTO,
  compilacaoDoModelo,
  estadoDoPesoAberto,
  listaAprovada,
  pesoAbertoDaPasta,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type ListaAprovada,
} from '../../../../lib/motores/catalogo';
import { leiturasDoModelo } from '../../../../lib/motores/compilacao-regras';
import {
  componentesEmTexto,
  escreveHojeEmTexto,
  estadoDaCompilacaoEmPalavras,
  janelaDoModelo,
  linhaDoCarimbo,
  notaDeApagarOCompilado,
  ocupacaoDoModelo,
  quantoLevaCompilar,
} from '../../../../lib/motores/folha-regras';
import { lerCarimbos, SEM_CARIMBOS, type CarimbosDaCompilacao } from '../../../../lib/motores/carimbo';
import { lerPreferencias, type PreferenciaDeMotores } from '../../../../lib/motores/preferencia';
import { colors, fonts, radii, roleColors, spacing, useThemedStyles } from '../../../../theme';

/**
 * A **ficha de um modelo** (fatia 3 do redesenho) — o que ele custa e o que ele entrega.
 *
 * O catálogo deixou de ser de um peso só na noite em que o iPhone provou o segundo, e o que
 * faltava era o modelo como **objeto de tela**: até aqui ele era um id com rótulo, repetido
 * em cada seção. Esta página é onde "quanto isto me custa e o que eu ganho" tem onde ser
 * respondido.
 *
 * Quatro regras a governam, e todas as quatro são sobre **não inventar número**:
 *
 * - **O estado nasce de `isCached`**, relido na montagem e ao focar — nunca de constante,
 *   nunca do que a tela pintou da última vez. O cache é particionado por build do **iOS**:
 *   um app novo sobre o mesmo sistema abre com tudo já compilado, e um sistema atualizado
 *   volta tudo para `instalado, não compilado` sem ninguém tocar em nada.
 * - **O tamanho só aparece onde houve medida.** Os números vêm do catálogo, medidos à mão em
 *   22/09; um modelo novo entra sem eles, e a ficha diz *tamanho não medido* em vez de somar
 *   o que ninguém mediu.
 * - **O carimbo é lembrança, e é lido contra o estado.** Um *compilado em 22/09, levou 15
 *   min* ao lado de *instalado, não compilado* faria o dono achar que o app se desfez; a
 *   ficha escreve a contradição, com a causa (`linhaDoCarimbo`).
 * - **A janela vem do diagnóstico da ponte**, e some quando ele não a traz. Era exatamente
 *   esse o buraco que a revisão de borda apontou: um número autorado numa tela cuja família
 *   existe para não autorar números.
 *
 * **Apagar o compilado é declarado, não oferecido.** O pacote tem `PreparedModel.clearCache`,
 * e a investigação de 22/09 o viu falhar de forma reprodutível com o arquivo preso por um
 * lock. Um botão que não cumpre é pior que um botão ausente — ainda mais este, que o dono só
 * aperta quando o telefone já reclamou de espaço. A nota diz o que ele devolveria, o que
 * custaria refazer, qual leitura escreve com o modelo, e por que ele não está lá.
 */

export default function ModeloScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  /**
   * O id é resolvido **antes de desenhar qualquer coisa**, e o "não existe" é o caso
   * normal, não o exótico: o dono chega por um estado que o Expo Router restaurou depois de
   * o iOS encerrar o app, ou por um build antigo que embarcava um peso que o novo não
   * embarca. Uma ficha em branco com um título vazio seria pior que a frase.
   */
  const peso = useMemo(() => pesoAbertoDaPasta(typeof id === 'string' ? id : undefined), [id]);

  const [ponte, setPonte] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  const [coreai, setCoreai] = useState<Readonly<Record<string, EstadoDaPonte>>>(() => estadoDosPesosAbertos());
  const [compilacao, setCompilacao] = useState<Readonly<Record<string, EstadoDaCompilacao>>>(() =>
    estadoDaCompilacaoDosPesos(),
  );
  const [preferencias, setPreferencias] = useState<PreferenciaDeMotores>({});
  const [lista, setLista] = useState<ListaAprovada | null>(listaAprovada);
  const [carimbos, setCarimbos] = useState<CarimbosDaCompilacao>(SEM_CARIMBOS);

  // Os três fatos que mudam sozinhos, relidos ao focar e ao voltar ao primeiro plano — é a
  // mesma regra da tela raiz, e a compilação é a única que volta a ser falsa sem ninguém
  // tocar em nada.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      const reler = () => {
        void ponteDoAparelho.reconsultar().then((p) => {
          if (vivo) setPonte(p);
        });
        void reconsultarPesosAbertos().then((p) => {
          if (vivo) setCoreai(p);
        });
        void relerCompilacaoDosPesos().then((c) => {
          if (vivo) setCompilacao(c);
        });
      };
      reler();
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') reler();
      });
      return () => {
        vivo = false;
        assinatura.remove();
      };
    }, []),
  );

  useEffect(() => {
    let vivo = true;
    // Os três `.catch` são rede, não conserto: os módulos já engolem falha e devolvem
    // vazio. Sem eles, afrouxar um `try` lá dentro viraria rejeição não tratada aqui.
    void lerPreferencias()
      .then((p) => {
        if (vivo) setPreferencias(p);
      })
      .catch(() => undefined);
    void lerCarimbos()
      .then((c) => {
        if (vivo) setCarimbos(c);
      })
      .catch(() => undefined);
    void garantirListaAprovada()
      .then((l) => {
        if (vivo) setLista(l);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * As leituras que este modelo escreve **agora** — resolvidas, não lidas da preferência.
   *
   * A regra mora em `compilacao-regras.ts` desde a fatia 2, porque a tela de compilação precisa
   * exatamente dela para dizer o que continua escrevendo durante a espera. Duas cópias
   * divergiriam, e o dono leria uma lista na ficha e outra ao compilar.
   */
  const leituras = useMemo(
    () =>
      peso === undefined
        ? []
        : leiturasDoModelo({ peso, pontes: { sistema: ponte, coreai }, lista, preferencias }),
    [peso, ponte, coreai, lista, preferencias],
  );

  if (peso === undefined) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Cabecalho onVoltar={() => router.back()} s={s} />
        <View style={s.vazio}>
          <Text style={s.titulo} accessibilityRole="header">
            Modelo não encontrado
          </Text>
          <Text style={s.corpo}>
            Este build não traz o modelo <Text style={s.cru}>{typeof id === 'string' ? id : '—'}</Text>. Os modelos
            vêm dentro do app, então um build diferente traz outro conjunto.
          </Text>
          <Pressable
            onPress={() => router.replace('/configuracoes/motores')}
            accessibilityRole="button"
            accessibilityLabel="Voltar para Motores"
            style={({ pressed }) => [s.botaoSuave, pressed && s.pressed]}
          >
            <Text style={s.botaoSuaveTexto}>Voltar para Motores</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const estado = compilacaoDoModelo(compilacao[peso.pesos] ?? COMPILACAO_AUSENTE);
  const bruto = compilacao[peso.pesos] ?? COMPILACAO_AUSENTE;
  const ocupacao = ocupacaoDoModelo(peso, estado);
  const carimbo = carimbos[peso.pesos];
  const linha = linhaDoCarimbo(carimbo, estado, Date.now());
  const janela = janelaDoModelo(estadoDoPesoAberto(coreai, peso.pesos));
  const componentes = componentesEmTexto(bruto);
  const escreve = escreveHojeEmTexto(leituras, CATALOGO_DE_RECURSOS.length);
  const verde = roleColors('green');

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Cabecalho onVoltar={() => router.back()} s={s} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          <Text style={s.titulo} accessibilityRole="header">
            {peso.rotulo}
          </Text>
          <View style={s.selos}>
            {/* O selo **não preenche**: um selo preenchido com texto de 11 px é uma
                armadilha de contraste, e o sistema não tem token que garanta 4,5 contra um
                `soft`. Contorno é objeto gráfico (piso 3,0) e a palavra é texto (4,5). */}
            <Selo
              texto={
                estado.tipo === 'compilado'
                  ? 'compilado'
                  : estado.tipo === 'nao-compilado'
                    ? 'não compilado'
                    : 'não dá para saber'
              }
              cor={estado.tipo === 'compilado' ? verde.text : colors.ink2}
              borda={estado.tipo === 'compilado' ? verde.graphic : colors.lineDeep}
              s={s}
            />
            <Selo texto="peso aberto" cor={colors.ink2} borda={colors.lineDeep} s={s} />
            <Selo texto="nada sai daqui" cor={colors.ink2} borda={colors.lineDeep} s={s} />
          </View>
          <Text style={s.corpo}>{peso.descricao}</Text>
        </View>

        {/* ── o que ocupa ─────────────────────────────────────────────────── */}
        <View style={s.cartao}>
          <View style={s.linha}>
            <Text style={s.rotulo}>Ocupa no telefone</Text>
            <Text style={s.valor}>
              {ocupacao.tipo === 'sem-medida' ? 'não medido' : ocupacao.total}
            </Text>
          </View>
          {ocupacao.tipo === 'sem-medida' ? (
            <Text style={s.nota}>{ocupacao.frase}</Text>
          ) : null}
          {ocupacao.tipo === 'so-instalado' && ocupacao.semMedida !== undefined ? (
            <Text style={s.nota}>{ocupacao.semMedida}</Text>
          ) : null}
          {/* A barra de duas partes só existe quando as duas partes existem: desenhá-la com
              uma parte de tamanho zero seria uma fração inventada. */}
          {ocupacao.tipo === 'duas-partes' ? (
            <>
              <View style={s.barra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View
                  style={[
                    s.barraParte,
                    { flex: ocupacao.fracaoInstalado, backgroundColor: colors.ink3 },
                  ]}
                />
                <View
                  style={[
                    s.barraParte,
                    { flex: 1 - ocupacao.fracaoInstalado, backgroundColor: verde.graphic },
                  ]}
                />
              </View>
              <View style={s.legenda}>
                <Legenda cor={colors.ink3} texto={`instalado ${ocupacao.instalado}`} s={s} />
                <Legenda cor={verde.graphic} texto={`compilado ${ocupacao.compilado}`} s={s} />
              </View>
            </>
          ) : null}

          <View style={s.regua} />
          <View style={s.linha}>
            <Text style={s.rotulo}>Estado</Text>
            <Text style={s.valorTexto}>{estadoDaCompilacaoEmPalavras(estado, peso)}</Text>
          </View>
          {componentes !== undefined ? <Text style={s.nota}>{componentes}</Text> : null}

          {linha.tipo === 'carimbo' ? (
            <>
              <View style={s.regua} />
              <View style={s.linha}>
                <Text style={s.rotulo}>{linha.rotulo}</Text>
                <Text style={s.valor}>{linha.valor}</Text>
              </View>
            </>
          ) : null}
          {linha.tipo === 'contradicao' ? (
            <>
              <View style={s.regua} />
              <Text style={s.nota}>{linha.frase}</Text>
            </>
          ) : null}
          {linha.tipo === 'ausente' && estado.tipo === 'compilado' ? (
            <>
              <View style={s.regua} />
              <Text style={s.nota}>
                Este iPhone não registrou quando este modelo compilou: o carimbo nasce na tela de
                compilação, e ele já estava compilado antes dela existir.
              </Text>
            </>
          ) : null}

          {/* A janela só existe quando o diagnóstico a traz. Sem ela, a linha não existe —
              em vez de um número que ninguém mediu. */}
          {janela !== undefined ? (
            <>
              <View style={s.regua} />
              <View style={s.linha}>
                <Text style={s.rotulo}>Janela</Text>
                <Text style={s.valor}>{janela}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── escreve hoje ────────────────────────────────────────────────── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Escreve hoje</Text>
          <View style={s.cartaoSimples}>
            <Text style={s.nome}>{escreve.titulo}</Text>
            {escreve.medida !== null ? <Text style={s.medida}>{escreve.medida}</Text> : null}
          </View>
        </View>

        {/* ── como ele escreve ────────────────────────────────────────────── */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Como ele escreve</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/configuracoes/motores/bancada',
                params: { recurso: RECURSO_MEDIDO_DO_PESO_ABERTO },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Ainda não medido — comparar na mesma janela"
            style={({ pressed }) => [s.cartaoSimples, s.cartaoEmColuna, pressed && s.pressed]}
          >
            <View style={s.linha}>
              <Text style={s.nome}>Ainda não medido</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.ink3} style={s.chevron} />
            </View>
            <Text style={s.corpo}>
              Comparar com o template, o modelo do aparelho e a nuvem na mesma janela.
            </Text>
          </Pressable>
        </View>

        {/* ── o pé: compilar, ou a nota de apagar ─────────────────────────── */}
        <View style={s.pe}>
          {estado.tipo === 'compilado' ? (
            <View style={s.aviso}>
              <Text style={s.avisoTitulo}>Apagar o compilado</Text>
              <Text style={s.corpo}>
                {notaDeApagarOCompilado({ ocupacao, carimbo, leituras })}
              </Text>
            </View>
          ) : estado.tipo === 'nao-compilado' ? (
            // **Um controle de verdade desde a fatia 2.** Ele era tracejado e inerte porque a
            // tela que compila não existia, e um botão com cara de botão que não faz nada mente
            // tanto quanto uma omissão. Agora ele abre a tela — que é onde o preço volta a ser
            // dito, com relógio, e onde dá para parar.
            <>
              <Pressable
                onPress={() => router.push(`/configuracoes/motores/modelo/${peso.pesos}/compilar`)}
                accessibilityRole="button"
                accessibilityLabel={`Compilar o ${peso.rotulo}. ${quantoLevaCompilar(carimbo)}`}
                style={({ pressed }) => [s.botaoCheio, pressed && s.pressed]}
              >
                <Text style={s.botaoCheioTexto}>Compilar</Text>
              </Pressable>
              <Text style={s.nota}>
                {`Compilar para o chip ${quantoLevaCompilar(carimbo)}, e a tela fica acesa esperando. ` +
                  'Depois disso ele abre em segundos.'}
              </Text>
            </>
          ) : (
            // Nem compilar nem apagar: "não sei" não é "não", e oferecer qualquer dos dois
            // aqui seria agir sobre um modelo que este build talvez nem traga.
            <View style={s.aviso}>
              <Text style={s.avisoTitulo}>Nem compilar, nem apagar</Text>
              <Text style={s.corpo}>
                Não dá para saber em que estado este modelo está: {estado.motivo}.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * O cabeçalho de pilha desta família: o chevron e o nome da tela **anterior**.
 *
 * O `ScreenHeader` do app centraliza o título da tela atual; aqui o título mora no conteúdo,
 * em serifada grande, porque ele é o nome de um objeto e não o rótulo de um cromo.
 */
function Cabecalho({ onVoltar, s }: { onVoltar: () => void; s: Styles }) {
  return (
    <View style={s.cabecalho}>
      <Pressable
        onPress={onVoltar}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Voltar para Motores"
        style={({ pressed }) => [s.voltar, pressed && s.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={s.contexto}>Motores</Text>
    </View>
  );
}

function Selo({ texto, cor, borda, s }: { texto: string; cor: string; borda: string; s: Styles }) {
  return (
    <View style={[s.selo, { borderColor: borda }]}>
      <Text style={[s.seloTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

function Legenda({ cor, texto, s }: { cor: string; texto: string; s: Styles }) {
  return (
    <View style={s.legendaItem}>
      <View style={[s.ponto, { backgroundColor: cor }]} />
      <Text style={s.nota}>{texto}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'], gap: 18 },

    cabecalho: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.xs },
    voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    contexto: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },

    topo: { gap: 7 },
    titulo: { fontSize: 30, lineHeight: 35, fontFamily: fonts.serif, color: colors.ink },
    selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    selo: {
      flexShrink: 1,
      minWidth: 0,
      borderWidth: 1,
      borderRadius: radii.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    seloTexto: { fontSize: 11, fontFamily: fonts.sansSemiBold },

    cartao: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
      gap: spacing.sm,
    },
    cartaoSimples: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 44,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
    },
    cartaoEmColuna: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs },
    regua: { height: 1, backgroundColor: colors.line },

    linha: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
    rotulo: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    // Mono porque é medida; sans quando é o app afirmando um estado.
    valor: { flexShrink: 1, minWidth: 0, textAlign: 'right', fontSize: 14, fontFamily: fonts.monoSemiBold, color: colors.ink },
    valorTexto: { flexShrink: 1, minWidth: 0, textAlign: 'right', fontSize: 12.5, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink },
    nota: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    corpo: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    cru: { fontFamily: fonts.mono, color: colors.ink },
    chevron: { flexShrink: 0 },

    barra: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    barraParte: { height: 6, borderRadius: 3 },
    legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0 },
    ponto: { width: 7, height: 7, borderRadius: 4 },

    secao: { gap: spacing.sm },
    secaoTitulo: {
      fontSize: 11,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.ink2,
    },
    nome: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    medida: { flexShrink: 1, minWidth: 0, fontSize: 11, fontFamily: fonts.mono, color: colors.ink3 },

    pe: { gap: spacing.sm, marginTop: spacing.sm },
    aviso: {
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
      gap: spacing.xs,
    },
    avisoTitulo: { fontSize: 11.5, fontFamily: fonts.sansBold, color: colors.ink },
    botaoCheio: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
      paddingHorizontal: 14,
    },
    botaoCheioTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.bg },

    vazio: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
    botaoSuave: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.lineDeep,
    },
    botaoSuaveTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  });
