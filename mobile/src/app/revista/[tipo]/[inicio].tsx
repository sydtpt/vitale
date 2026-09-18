import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AGG_VERSION,
  MODULO_DO_CADERNO,
  rotuloDoCaderno,
  type CadernoId,
  type LapideNaEdicao,
  type TipoComEdicao,
} from '@vitale/shared';
import { CapaComFoto } from '../../../components/revista/CapaComFoto';
import { useEntradaDaEdicao } from '../../../hooks/useEntradaDaEdicao';
import { useFotoDaCapa } from '../../../hooks/useFotoDaCapa';
import { useRolagemAncorada, type Ancora } from '../../../hooks/useRolagemAncorada';
import {
  ICONE_DO_CADERNO,
  comDadoDaEntrada,
  fraseDaLapide,
  lapidesDaEntrada,
  periodoDaRota,
} from '../../../lib/edicao-ia';
import { useAuthStore } from '../../../store/auth.store';
import {
  AVISO_SEM_CADERNO,
  chaveDe,
  estadoDe,
  useEdicaoStore,
  vistaDaEdicao,
  type AcaoDoCaderno,
  type CadernoNaVista,
  type CapaNaVista,
} from '../../../store/edicao.store';
import { colors, fonts, moduleColors, radii, spacing, useThemedStyles } from '../../../theme';

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
 * A **1.12** desenhou os cadernos: a faixa sangrada na cor do módulo, com ícone e
 * nome, e a lápide nos dois estados. A capa com foto é da 1.13.
 *
 * A **1.14** pôs o sumário entre a capa e o miolo — a **única** navegação da
 * revista. A ordem do miolo é variável de propósito, então a posição não ensina
 * nada: sem o sumário, quem abre julho rola os quatro cadernos para descobrir
 * qual importa.
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

  /**
   * As lápides, por caderno — **fato da entrada, não da edição** (decisão do dono,
   * 17/09). Não esperam `dadosProntos` como o `comDado`: a lápide não habilita
   * botão nenhum, e a resposta do núcleo é a mesma com a memória pela metade.
   *
   * Hoje o celular não manda lápide nenhuma, então ela fica **invisível no
   * aparelho enquanto não houver detector de métrica morta** — isso é esperado,
   * não defeito: os dois estados já estão desenhados e testados.
   */
  const lapides = useMemo(() => lapidesDaEntrada(entrada), [entrada]);

  const vista = useMemo(() => vistaDaEdicao(estado, comDado, AGG_VERSION), [estado, comDado]);

  /**
   * A imagem da capa carimbada (Story 1.13), resolvida **fora** do `switch`:
   * hooks não moram em ramos. `null` enquanto não há vista de edição, e o hook
   * responde `sem-foto` — que é o mesmo que a capa `tracado`, a `grade` e a edição
   * impressa antes da 1.13.
   */
  const carimbada = vista.tipo === 'edicao' ? vista.capa.carimbada : null;
  const foto = useFotoDaCapa(carimbada);

  /**
   * O sumário e as faixas, ligados pela âncora (Story 1.14) — **fora** do
   * `switch` pela mesma razão da foto: hooks não moram em ramos.
   *
   * O hook é genérico e mora em `hooks/`; a revista só o usa. Aqui o id da âncora
   * é o `CadernoId`, que já é a chave do miolo.
   */
  const rolagem = useRolagemAncorada<CadernoId>();

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
      /**
       * **Quem decide "foto ou papel" é a vista** (`capa.comFoto`), que é onde a
       * matriz a testa. A tela só acrescenta o que a vista não pode saber: se o
       * arquivo da biblioteca resolveu.
       *
       * `procurando` já desenha a capa com foto, sem a imagem — o quadro já tem a
       * altura mínima da capa, e piscar papel antes da foto seria um salto na
       * abertura. `sem-imagem` cai no papel **com a legenda carimbada**, que é o
       * que continua dizendo onde o período aconteceu.
       */
      const desenhaFoto = capa.comFoto
        && (foto.estado === 'pronta' || foto.estado === 'procurando');
      return (
        <ScrollView
          ref={rolagem.scrollRef}
          contentContainerStyle={{ paddingBottom: bottom + spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
        >
          {desenhaFoto ? (
            <CapaComFoto
              periodo={capa.periodo}
              manchete={capa.manchete}
              legenda={capa.legenda ?? ''}
              {...(foto.estado === 'pronta' ? { uri: foto.uri } : {})}
            />
          ) : (
            <CapaEmPapel capa={capa} onEscrever={escreverEdicao} />
          )}

          {/* Capa → sumário → cadernos, nesta ordem: é a forma da revista.
              Miolo vazio não tem sumário — ali o convite está na capa. */}
          {cadernos.length > 0 ? <Sumario cadernos={cadernos} onIr={rolagem.irPara} /> : null}

          {/* **Cada `Caderno` é filho DIRETO deste `ScrollView`, e a âncora
              depende disso.** O `onLayout` dele entrega a posição dentro do pai
              imediato, que só é o deslocamento do `scrollTo` enquanto o pai for o
              `contentContainer`. Embrulhar este `map` numa `View` — para dar um
              `gap`, um fundo, o que for — faz todas as linhas do sumário rolarem
              para o mesmo lugar, sem erro nenhum e com a suíte verde. Se um dia
              precisar do embrulho, a âncora tem que passar a medir contra o
              rolável (`measureLayout`), não contra o pai. */}
          {cadernos.map((c) => (
            <Caderno
              key={c.caderno}
              c={c}
              lapides={lapides[c.caderno]}
              onAcao={escreverCaderno}
              ancora={rolagem.ancora(c.caderno)}
            />
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

/**
 * A capa **em papel** — a da 1.11, agora também o caminho de queda da 1.13.
 *
 * Ela desenha em quatro situações, e as quatro são a mesma coisa para o leitor:
 * o período não foi escrito, a edição é anterior ao carimbo, a capa carimbada é
 * `tracado` ou `grade` (que ninguém desenha ainda), ou a foto não resolve mais.
 * **Nenhum espaço fica reservado** para a imagem que não veio.
 */
function CapaEmPapel({ capa, onEscrever }: {
  capa: CapaNaVista;
  onEscrever: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.capa}>
      <Text style={styles.eyebrow}>A edição</Text>
      <Text style={styles.periodo} accessibilityRole="header">{capa.periodo}</Text>
      {capa.impressa ? (
        <>
          {capa.manchete ? <Text style={styles.manchete}>{capa.manchete}</Text> : null}
          {/* A legenda da capa de foto cuja imagem faltou — a descrição no lugar dela. */}
          {capa.legenda ? <Text style={styles.legenda}>{capa.legenda}</Text> : null}
        </>
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
            <Botao rotulo="Escrever a edição" principal onPress={onEscrever} />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * O sumário — a **única** navegação da revista (Story 1.14, CAP-8).
 *
 * Uma linha por caderno do miolo, **na ordem impressa**: o nome dele e a chamada,
 * que é a mesma frase que a capa já usa como manchete quando o caderno lidera.
 * Ela não diz o que tem dentro; diz **por que entrar**.
 *
 * Quatro coisas que ele faz de propósito, e que passam por defeito:
 *
 * - **A linha permanece em estado misto**, com o nome e sem chamada. Sumir seria
 *   mentir por omissão, e esperar o sumário ficar completo esconderia os cadernos
 *   que deram certo por causa de um que falhou.
 * - **A primeira linha repete a manchete da capa**, e isso é **forma**: é o que
 *   revista impressa faz. A capa é identidade do período; a linha é o alvo de
 *   toque. As duas ficam, visíveis e audíveis.
 * - **A chamada aparece inteira** — sem `numberOfLines`, sem "…". As primeiras
 *   frases reais medem 104 a 148 caracteres, e o fim delas é onde costuma estar a
 *   base contra a qual o número compara. Chamada longa demais se conserta no
 *   prompt, não na tela.
 * - **Tocar rola, não navega.** Nenhuma entrada na pilha, nenhuma rota, nenhuma
 *   barra fixa — e a faixa do caderno continua não tocável: ela é âncora e
 *   identidade.
 */
function Sumario({ cadernos, onIr }: {
  cadernos: readonly CadernoNaVista[];
  onIr: (caderno: CadernoId) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sumario}>
      <View style={styles.sumarioTopo}>
        {/* `header` porque cada faixa de caderno é um — e quem navega por
            cabeçalhos no VoiceOver pularia a única navegação da revista inteira
            se este fosse texto solto entre dois cabeçalhos de seção. */}
        <Text style={styles.eyebrow} accessibilityRole="header">Nesta edição</Text>
      </View>
      {cadernos.map((c) => (
        <LinhaDoSumario
          key={c.caderno}
          rotulo={rotuloDoCaderno(c.caderno)}
          chamada={c.estado === 'pronta' ? c.chamada : null}
          onPress={() => onIr(c.caderno)}
        />
      ))}
    </View>
  );
}

/**
 * A dica da linha do sumário — **a decisão mais incomum da story, dita em voz**.
 *
 * `button` anuncia que o alvo *ativa*; não anuncia que ele rola **na mesma
 * página**. Sem a dica, quem usa VoiceOver espera sair daqui e não sai, e a
 * ausência de transição lê como toque que não funcionou.
 */
const DICA_DA_LINHA = 'Rola até este caderno, na mesma página.';

/**
 * Uma linha do sumário. **O alvo de toque é a linha inteira** (mínimo 62, e a
 * altura é mínima: no tipo dinâmico grande ela cresce com o texto).
 *
 * É `button`, não `link`: rolar na mesma página não é navegar. Um nó só para o
 * leitor de tela, com nome e chamada na mesma frase — a seta é decorativa, e o
 * nome sozinho já bastaria para escolher.
 */
function LinhaDoSumario({ rotulo, chamada, onPress }: {
  rotulo: string;
  chamada: string | null;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={chamada ? `${rotulo}. ${chamada}` : rotulo}
      accessibilityHint={DICA_DA_LINHA}
      style={({ pressed }) => [styles.sumLinha, pressed && styles.pressed]}
    >
      <View style={styles.sumCorpo}>
        <Text style={styles.sumRotulo}>{rotulo}</Text>
        {chamada ? <Text style={styles.sumChamada}>{chamada}</Text> : null}
      </View>
      {/* A seta é **decorativa**: ela mora dentro do nó acessível da linha, então
          o leitor de tela não a lê, e o rótulo não depende dela para dizer o
          destino. Por isso ela pode ficar em `ink3` três linhas abaixo de um
          rótulo que recusou o mesmo token: `ink3` mede 3,05 sobre `surface` — o
          fundo do sumário —, que passa o piso de 3,0 de **objeto gráfico** e
          reprova o de 4,5 de **texto**. O que muda não é a cor; é o que a coisa é. */}
      <Ionicons name="chevron-down" size={18} color={colors.ink3} />
    </Pressable>
  );
}

const ROTULO_DA_ACAO: Record<AcaoDoCaderno, string> = {
  escrever: 'Escrever este caderno',
  'escrever-de-novo': 'Escrever este caderno de novo',
  'tentar-de-novo': 'Tentar de novo',
};

/**
 * Uma lápide — a métrica que parou de chegar, e a data em que parou.
 *
 * **Dois estados, nunca um terceiro** (DESIGN §Lápide): a do período em que a
 * métrica morreu sobe ao topo do caderno, num degrau de corpo de letra na
 * serifada da edição; as outras ficam no pé, em sans, no corpo normal. Nos dois,
 * a mesma régua de 2 px no `accent` do caderno — é o que as liga à seção.
 *
 * **Não é tocável e não leva a Conexões.** A edição congela: o alerta operacional
 * tem o tempo do agora e vive em outro lugar. A data sai em mono porque é carimbo
 * de medida, do mesmo tipo da assinatura.
 */
function Lapide({ l, accent }: { l: LapideNaEdicao; accent: string }) {
  const styles = useThemedStyles(createStyles);
  const frase = fraseDaLapide(l.metrica, l.ultimaMedidaISO);
  return (
    // A frase está partida em três nós porque a data é mono, e o VoiceOver pode
    // ler pedaço a pedaço — "anéis de atividade, última medida em", pausa,
    // "17/08/2026", pausa, ".". `frase.texto` existe exatamente para isto: um nó
    // só, com a frase inteira. `accessible` agrupa; **não** torna tocável.
    <View
      style={[styles.lapide, { borderLeftColor: accent }]}
      accessible
      accessibilityLabel={frase.texto}
    >
      <Text style={l.doPeriodo ? styles.lapideDoPeriodo : styles.lapideAntiga}>
        {frase.antes}
        <Text style={styles.lapideData}>{frase.data}</Text>
        {frase.depois}
      </Text>
    </View>
  );
}

/**
 * Um caderno, no estado dele — a faixa, o corpo recuado e as lápides nos dois lugares.
 *
 * A **âncora** (1.14) entra em dois pontos, e são dois de propósito: o `onLayout`
 * no container, porque é a posição *dele* dentro do rolável que o sumário quer; e
 * o `ref` na **faixa**, porque é ela que o leitor de tela deve passar a ler — ela
 * já é o cabeçalho da seção, com o nome do caderno como rótulo.
 */
function Caderno({ c, lapides, onAcao, ancora }: {
  c: CadernoNaVista;
  lapides: readonly LapideNaEdicao[];
  onAcao: (caderno: CadernoId) => void;
  ancora: Ancora;
}) {
  const styles = useThemedStyles(createStyles);
  // Cor no render, nunca na folha: `moduleColors` lê os eixos ativos no momento
  // da chamada, e no escopo do módulo isso seria o import — a faixa congelaria
  // na paleta clara. A ponte caderno → módulo é do núcleo.
  //
  // **Sem fallback**: o mapa é total sobre `CadernoId` e tipado, então o terceiro
  // argumento nunca seria usado — e se um dia fosse, `habito` é o módulo da
  // Rotina: uma chave quebrada pintaria a faixa de outro caderno no verde dela,
  // calada. Melhor não ter rede do que ter uma que mente.
  const mod = moduleColors(MODULO_DO_CADERNO[c.caderno]);
  const acao = 'acao' in c ? c.acao : undefined;
  const rotulo = rotuloDoCaderno(c.caderno);
  const noTopo = lapides.filter((l) => l.doPeriodo);
  const noPe = lapides.filter((l) => !l.doPeriodo);

  return (
    <View style={styles.caderno} onLayout={ancora.onLayout}>
      {/* A faixa sangra de borda a borda porque é a arquitetura da revista, não o
          que ela tem a dizer. **Não é tocável**, não colapsa e não vira barra
          fixa: é sinalização, e a ordem do miolo muda a cada edição. Para o
          leitor de tela é UM cabeçalho de seção — o nome é o rótulo, e o ícone
          é decorativo, por isso o nó é único. A altura é MÍNIMA: no tipo
          dinâmico grande ela cresce com o nome, sem corte nem reticências.

          O `ref` da âncora é o destino do FOCO, e não do desenho: o sumário rola
          até aqui e manda o leitor de tela ler este cabeçalho. Continua não
          tocável. */}
      <View
        ref={ancora.ref}
        style={[styles.faixa, { backgroundColor: mod.accent }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={rotulo}
      >
        <Ionicons name={ICONE_DO_CADERNO[c.caderno]} size={20} color={mod.onAccent} />
        <Text style={[styles.faixaNome, { color: mod.onAccent }]}>{rotulo}</Text>
      </View>

      <View style={styles.corpo}>
        {/* Estado 1 da lápide: o período em que a métrica morreu. Vem antes do
            texto, e some do topo para sempre na edição seguinte. */}
        {noTopo.length > 0 ? (
          <View style={styles.lapidesTopo}>
            {noTopo.map((l) => <Lapide key={l.metrica} l={l} accent={mod.accent} />)}
          </View>
        ) : null}

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

        {/* Estado 2: as mortes de períodos anteriores, no pé, antes da assinatura. */}
        {noPe.length > 0 ? (
          <View style={styles.lapidesPe}>
            {noPe.map((l) => <Lapide key={l.metrica} l={l} accent={mod.accent} />)}
          </View>
        ) : null}

        {c.estado === 'pronta' && c.assinatura ? (
          <Text style={styles.assinatura}>{c.assinatura}</Text>
        ) : null}

        {/* A ação existe ou não existe — nunca desabilitada. O peso é o da causa. */}
        {acao ? (
          <Botao
            rotulo={ROTULO_DA_ACAO[acao]}
            principal={acao !== 'tentar-de-novo'}
            onPress={() => onAcao(c.caderno)}
          />
        ) : null}
      </View>
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
    /**
     * A legenda carimbada no papel — quando a foto que ela descreve não resolve
     * mais. Mono porque é carimbo de medida (lugar, quilômetro e hora), e `ink2`
     * porque é informação obrigatória: nunca a tinta mais fraca.
     */
    legenda: {
      fontSize: 11.5, fontFamily: fonts.mono, letterSpacing: 0.2,
      color: colors.ink2, marginTop: spacing.md,
    },
    convite: { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink2 },

    /* ── o sumário (CAP-8) ───────────────────────────────────────────────────
     *
     * Os números soltos daqui — 13, 15, 10, 3 e o 62 — **são a geometria do
     * mockup aprovado** (`mockups/key-edicao.html`: `.sum-linha`, `.sumario-topo`,
     * `.sum-rotulo`), medidos em tela e julgados ali. Eles não viram `spacing.*`
     * porque a escala não tem esses degraus, e arredondá-los para os que ela tem
     * seria redesenhar o bloco por conveniência de token. O resto do arquivo usa
     * a escala porque a escala serve; aqui ela não serve.
     */

    // Mesma superfície da capa, com o filete que o separa do primeiro caderno.
    sumario: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
    },
    // `.sumario-topo { padding: 16px 20px 10px }` — os 10 embaixo apertam o
    // versalete contra a primeira linha, que é de quem ele é o título.
    sumarioTopo: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 10 },
    /**
     * A linha inteira é o alvo — `minHeight` e nunca `height`: o alvo mínimo do
     * desenho é 62 (bem acima dos 44 do piso), e com tipo dinâmico grande a
     * chamada empurra a linha para baixo em vez de ser cortada.
     *
     * **13 em cima e 15 embaixo é compensação óptica, não descuido nem herança**:
     * o versalete do rótulo tem o topo da caixa quase vazio (não há ascendente
     * acima da maiúscula), então 13 reais leem como mais; embaixo, a serifada da
     * chamada desce com descendentes e pede os 15 para não encostar no filete da
     * linha seguinte. Medidas iguais leem tortas.
     *
     * O filete vai em CIMA: com ele embaixo, a última linha teria dois traços
     * contra o filete do bloco.
     */
    sumLinha: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      minHeight: 62,
      paddingHorizontal: spacing.xl, paddingTop: 13, paddingBottom: 15,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    },
    sumCorpo: { flex: 1 },
    /**
     * O nome do caderno, em versalete — e em **`ink2`**, divergindo do `ink3` do
     * mockup: é o nome do destino de um alvo de toque, informação obrigatória, e
     * `ink3` mede 2,87 sobre `bg` (revisão de acessibilidade). Corpo e espaçamento
     * são os do `eyebrow`, que é o token que o DESIGN dá a este rótulo.
     *
     * Os 3 de `marginBottom` são os do `.sum-rotulo`: rótulo e chamada são **um
     * bloco**, e o respiro entre eles tem que ser menor que o que separa uma linha
     * da outra, senão os dois leem como itens irmãos em vez de título e frase.
     */
    sumRotulo: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2, marginBottom: 3,
    },
    /**
     * A chamada: serifada, porque é o que a máquina escreveu e passou pela
     * conferência — a mesma família da manchete e do texto do caderno.
     *
     * 16/22 é a rampa normativa do DESIGN (`typography.chamada`); o mockup
     * renderizou 17/23. **Sem `numberOfLines`**: cortar esconderia o fim da
     * frase, que é onde mora a base comparada.
     */
    sumChamada: { fontSize: 16, lineHeight: 22, fontFamily: fonts.serif, color: colors.ink },

    // O caderno não recua: quem recua é o corpo. A faixa sangra por dentro dele.
    caderno: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
    },
    /**
     * A faixa: sangrada, saturada, sem raio. `minHeight` e nunca `height` — no
     * tipo dinâmico grande o nome cresce e a faixa cresce com ele; caixa fixa
     * cortaria justamente para quem tem baixa visão. Sem sombra: a revista é
     * plana, e o caderno é seção de um documento, não cartão flutuante.
     *
     * Fundo e primeiro plano chegam por `moduleColors()` no render — nenhum hex
     * aqui, e o `soft` não serve: medido, as quatro faixas em tint ficam
     * indistinguíveis nas 36 combinações.
     */
    faixa: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      minHeight: 56,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    /**
     * `flex: 1` e sem `numberOfLines`: o nome quebra linha, nunca vira reticência.
     *
     * **E sem `lineHeight`, de propósito** — é o único estilo de texto daqui sem
     * ele. `lineHeight` é dp fixo e NÃO acompanha o tipo dinâmico: em AX3 a letra
     * cresce dentro de uma linha que não cresce, e o nome sai cortado justamente
     * na faixa que a EXPERIENCE manda crescer com ele. Sem a propriedade, o RN usa
     * a métrica da fonte, que escala junto.
     */
    faixaNome: { flex: 1, fontSize: 22, fontFamily: fonts.sansBold, letterSpacing: 0.2 },
    // O que o caderno tem a dizer recua; o que o estrutura sangra.
    corpo: {
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    // Serifada e com entrelinha larga: é texto para ler, não dado para conferir.
    texto: { fontSize: 15, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },
    assinatura: { fontSize: 11, fontFamily: fonts.mono, color: colors.ink2, marginTop: spacing.xs },

    // A régua de 2 px é a mesma nos dois estados; só a cor vem do caderno.
    lapide: { borderLeftWidth: 2, paddingLeft: spacing.md },
    /**
     * O `margin` **soma ao `gap` do `corpo`** e dá 16 dp nas duas costuras da
     * lápide, contra os 8 que separam todo o resto — não é sobra, é o respiro do
     * mockup (`.lapide { margin:16px 0 0 }`, `.lapide.mes-da-morte { margin:0 0
     * 16px }`). A lápide é outra voz: ela precisa do degrau de silêncio antes e
     * depois, senão lê como mais um parágrafo do texto. Entre duas lápides
     * seguidas ficam os 8 do `gap`, porque ali é a mesma voz.
     */
    lapidesTopo: { gap: spacing.sm, marginBottom: spacing.sm },
    lapidesPe: { gap: spacing.sm, marginTop: spacing.sm },
    // O degrau, uma vez: serifada 17/25 na edição do período em que a métrica morreu.
    lapideDoPeriodo: { fontSize: 17, lineHeight: 25, fontFamily: fonts.serif, color: colors.ink },
    // Nos outros períodos, sans 12,5/18 — e `ink2`, porque a lápide é obrigatória.
    lapideAntiga: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink2 },
    // Só a família: corpo e tinta vêm do texto que a envolve.
    lapideData: { fontFamily: fonts.mono },
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
    // `onPrimary`, nunca `primaryOn`: o segundo é a tinta sobre o `primarySoft`
    // (o preenchimento pálido), e sobre o sólido ele mede 1,00 na marca Tinta —
    // texto preto em botão preto, que foi o que o dono viu em 18/09. Barreira em
    // `architecture.test.ts` para não voltar.
    botaoPrincipalTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },
    // Tentar de novo repete o que já se pediu: contorno, mais leve.
    botaoContorno: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.ink },
    botaoContornoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  });
