import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  compiladorDosPesos,
  estadoDosPesosAbertos,
  garantirListaAprovada,
  ponteDoAparelho,
} from '../../../../../lib/motores';
import {
  RECURSO_MEDIDO_DO_PESO_ABERTO,
  listaAprovada,
  pesoAbertoDaPasta,
  type EstadoDaPonte,
  type ListaAprovada,
  type PesoAberto,
} from '../../../../../lib/motores/catalogo';
import { ocupacaoDoModelo } from '../../../../../lib/motores/folha-regras';
import {
  AVISO_DE_SAIR,
  AVISO_DE_SAIR_CORPO,
  ETAPA_UNICA,
  INTERROMPIDA_CORPO,
  NAO_E_PARA_SEMPRE,
  NAO_E_PARA_SEMPRE_TITULO,
  PARADA_CORPO,
  PARADA_NAO_CONTA,
  PARAR_NAO_APAGA,
  REMEDIOS_DA_FALHA,
  SEM_RELOGIO_NA_FALHA,
  SUBTITULO_CORRENDO,
  SUBTITULO_FALHOU,
  SUBTITULO_TERMINOU,
  cartaoDoQueSegue,
  fimDaCompilacao,
  fraseDeParar,
  leiturasDoModelo,
  linhaDaUltimaVez,
  notaDaEtapa,
  relogio,
  somaDaEtapa,
  tituloDaFase,
  type FimDaCompilacao,
} from '../../../../../lib/motores/compilacao-regras';
import { gravarCarimbo, lerCarimbos, SEM_CARIMBOS, type CarimbosDaCompilacao } from '../../../../../lib/motores/carimbo';
import { esquecerEmCurso, lerEmCurso, marcarEmCurso } from '../../../../../lib/motores/em-curso';
import { lerPreferencias, type PreferenciaDeMotores } from '../../../../../lib/motores/preferencia';
import { corComAlfa } from '../../../../../lib/veu';
import { colors, fonts, mediaVeil, radii, roleColors, spacing, useThemedStyles } from '../../../../../theme';

/**
 * A **tela de compilação** de um peso aberto (fatia 2 do redesenho de Motores).
 *
 * Até aqui, compilar um modelo aberto só acontecia como efeito colateral de pedir uma leitura
 * de verdade: o dono escolhia o modelo no seletor, tocava "Ler" na Saúde do sono, e a frase
 * voltava dez ou quinze minutos depois — sem aviso, sem relógio e sem poder parar. Esta tela é
 * o ato separado do pedido.
 *
 * **Cinco decisões a governam, e quatro delas são sobre o que a tela NÃO promete:**
 *
 * - **A barra não é progresso.** Ela é listrada e estática, porque o iOS não emite fração,
 *   etapa nem evento durante a carga (medido em 22/09). Uma barra que andasse — mesmo
 *   "indeterminada" mas avançando — seria a única mentira grande desta tela.
 * - **A estimativa é lembrança, nunca promessa.** *Da última vez, neste iPhone, levou N
 *   minutos* só existe porque aconteceu aqui; sem carimbo, a tela diz que não há o que
 *   prometer, e não inventa um "cerca de dez minutos".
 * - **O sucesso é medido.** O que a ponte devolve é o estado relido do cache, não um `true`
 *   afirmado. Daí existir um desfecho que o desenho não previa — a carga voltou e o compilado
 *   não ficou completo —, que cai no cartão da falha e **não carimba**.
 * - **Dois fins sem resultado, e não um.** *Parada por você* mostra o tempo e diz que ele não
 *   conta como medida; *interrompida sem você* não mostra nada. Confundi-las faria a tela
 *   acusar o dono de algo que o sistema fez.
 * - **Só o fim que terminou carimba** (`carimbo.ts`): parar aos três minutos num dia não pode
 *   virar *da última vez levou 3 min* no lugar exato em que o dono usa esse número para
 *   decidir se cabe no intervalo antes de sair.
 *
 * ## A hipótese não medida: "Parar" para mesmo?
 *
 * **Não se sabe, e o código não finge saber.** `OrbeCoreAI.compilar` é um `await` sobre o
 * carregador do Core AI, e nem ele nem o pacote da Apple expõem cancelamento — o
 * `Task.isCancelled` do Swift não alcança o que roda dentro dele, e uma chamada nativa do Expo
 * não se aborta. O que "Parar" faz, de fato e comprovadamente, é **parar de esperar**: o
 * relógio congela, a tela vai para o desfecho *parada*, nada é carimbado, e a promessa em voo é
 * abandonada (o compilador a mantém em `emCurso`, então um segundo toque em "Compilar de novo"
 * se liga à mesma, em vez de subir os pesos duas vezes).
 *
 * Se a compilação continua debaixo, ela termina de preencher o cache e a ficha do modelo passa
 * a dizer *compilado* sem que esta tela tenha comemorado nada — o que é exatamente o
 * comportamento certo para um fato que ninguém mediu.
 *
 * **Como medir, quando houver aparelho:** abrir esta tela com um modelo não compilado, tocar
 * Parar por volta de um minuto, voltar para a ficha e ficar relendo o estado (ele relê ao
 * focar e ao voltar ao primeiro plano). Se em dez ou quinze minutos ele virar *compilado* sem
 * ninguém pedir nada, a compilação não parou — e então o botão precisa trocar de palavra
 * ("Deixar correndo em segundo plano"), não de mecanismo. Se ele ficar em *não compilado* por
 * mais tempo que a maior compilação medida, Parar para.
 *
 * O mesmo vale para o aviso *sair desta tela interrompe*: ele descreve o que a tela faz
 * (desiste de esperar), não o que o sistema faz.
 */

/** O passo do relógio. Um segundo: é a resolução do que a tela mostra. */
const PASSO_DO_RELOGIO_MS = 1000;

/** A profundidade do véu sob a folha — o molde de `FolhaDeEscolha`. */
const VEU_DA_FOLHA = 0.6;

/** Onde a tela está. `desde` e `ms` são instantes e durações em ms. */
type Fase =
  /** Nem começou: a marca de uma tentativa sem desfecho está sendo lida. */
  | { readonly tipo: 'lendo' }
  | { readonly tipo: 'correndo'; readonly desde: number }
  | { readonly tipo: 'terminou'; readonly ms: number }
  | { readonly tipo: 'falhou'; readonly fim: FimDaCompilacao }
  | { readonly tipo: 'parada'; readonly ms: number }
  | { readonly tipo: 'interrompida' };

export default function CompilarScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const peso = useMemo(() => pesoAbertoDaPasta(typeof id === 'string' ? id : undefined), [id]);

  const [fase, setFase] = useState<Fase>({ tipo: 'lendo' });
  const [agora, setAgora] = useState(() => Date.now());
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [carimbos, setCarimbos] = useState<CarimbosDaCompilacao>(SEM_CARIMBOS);
  // As duas pontes, como a tela as viu ao montar. Elas **não** são relidas aqui: reler ao focar
  // é o que a ficha e a raiz fazem, e é para onde o dono volta; nesta tela o estado que muda é
  // o da compilação em curso, e uma releitura ao voltar do primeiro plano não acrescenta nada.
  const [sistema] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  const [coreai] = useState<Readonly<Record<string, EstadoDaPonte>>>(() => estadoDosPesosAbertos());
  const [lista, setLista] = useState<ListaAprovada | null>(listaAprovada);
  const [preferencias, setPreferencias] = useState<PreferenciaDeMotores>({});

  /**
   * A tentativa desta montagem. Ela existe porque a compilação é abandonada, não cancelada: o
   * desfecho de uma tentativa que o dono já parou não pode voltar e sobrescrever a tela — nem
   * carimbar.
   */
  const tentativa = useRef(0);

  const iniciar = useCallback(() => {
    if (peso === undefined) return;
    const minha = tentativa.current + 1;
    tentativa.current = minha;
    const desde = Date.now();
    setFase({ tipo: 'correndo', desde });
    setAgora(desde);
    void marcarEmCurso(peso.pesos).catch(() => undefined);
    void compiladorDosPesos[peso.pesos]!.compilar().then((estado) => {
      // Chegou depois de o dono parar, ou de a tela ter sido desmontada e remontada: o
      // resultado é dado velho de outra tentativa, e substituir a tela com ele apagaria o
      // desfecho que o dono escolheu.
      if (tentativa.current !== minha) return;
      // **Um instante só**, lido uma vez: dois `Date.now()` dariam um `em` gravado diferente do
      // que a tela mostra, e a ficha leria o do disco.
      const em = Date.now();
      const ms = em - desde;
      const fim = fimDaCompilacao(estado);
      void esquecerEmCurso().catch(() => undefined);
      if (fim.tipo === 'compilou') {
        // **O único lugar do app que carimba** — ver o cabeçalho de `carimbo.ts`.
        void gravarCarimbo(peso.pesos, { em, ms }).catch(() => undefined);
        setCarimbos((c) => ({ ...c, [peso.pesos]: { em, ms } }));
        setFase({ tipo: 'terminou', ms });
        return;
      }
      setFase({ tipo: 'falhou', fim });
    });
  }, [peso]);

  /**
   * O arranque, uma vez por montagem: se há marca de uma tentativa sem desfecho, esta tela é a
   * volta de um app encerrado no meio — e aí ela **não recomeça sozinha** onze minutos de
   * trabalho que ninguém pediu de novo. Sem marca, ela começa, porque foi para isso que o dono
   * tocou em Compilar.
   */
  useEffect(() => {
    if (peso === undefined) return;
    let vivo = true;
    void lerEmCurso()
      .then((pasta) => {
        if (!vivo) return;
        if (pasta !== null) {
          // A marca velha é apagada aqui: sem isso, a tela diria "foi interrompida" em toda
          // visita seguinte.
          void esquecerEmCurso().catch(() => undefined);
          setFase({ tipo: 'interrompida' });
          return;
        }
        iniciar();
      })
      .catch(() => {
        if (vivo) iniciar();
      });
    return () => {
      vivo = false;
    };
  }, [peso, iniciar]);

  /**
   * A tela desmontando com uma compilação em voo: a tentativa é invalidada e a marca sai.
   *
   * A marca sai porque **este** caso é o do dono saindo da tela, e o desfecho dele é *parada*,
   * não *interrompida* — e ele já o viu, ou vai vê-lo na volta pela ficha. A marca existe só
   * para o caso em que nenhum código nosso roda: o app encerrado pelo iOS.
   */
  useEffect(
    () => () => {
      tentativa.current += 1;
      void esquecerEmCurso().catch(() => undefined);
    },
    [],
  );

  /** O relógio, só enquanto corre. Um `setInterval` vivo numa tela parada é bateria por nada. */
  useEffect(() => {
    if (fase.tipo !== 'correndo') return;
    const t = setInterval(() => setAgora(Date.now()), PASSO_DO_RELOGIO_MS);
    return () => clearInterval(t);
  }, [fase.tipo]);

  useEffect(() => {
    let vivo = true;
    // Os três `.catch` são rede, não conserto: os módulos já engolem falha e devolvem vazio.
    void lerCarimbos()
      .then((c) => {
        if (vivo) setCarimbos(c);
      })
      .catch(() => undefined);
    void lerPreferencias()
      .then((p) => {
        if (vivo) setPreferencias(p);
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

  const leituras = useMemo(
    () => (peso === undefined ? [] : leiturasDoModelo({ peso, pontes: { sistema, coreai }, lista, preferencias })),
    [peso, sistema, coreai, lista, preferencias],
  );

  const parar = useCallback(() => {
    if (fase.tipo !== 'correndo') return;
    tentativa.current += 1;
    void esquecerEmCurso().catch(() => undefined);
    setFolhaAberta(false);
    setFase({ tipo: 'parada', ms: Date.now() - fase.desde });
  }, [fase]);

  const voltar = useCallback(() => {
    if (fase.tipo === 'correndo') {
      setFolhaAberta(true);
      return;
    }
    router.back();
  }, [fase.tipo, router]);

  if (peso === undefined) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Cabecalho onVoltar={() => router.back()} s={s} />
        <View style={s.vazio}>
          <Text style={s.titulo} accessibilityRole="header">
            Modelo não encontrado
          </Text>
          <Text style={s.corpo}>
            Este build não traz o modelo <Text style={s.cru}>{typeof id === 'string' ? id : '—'}</Text>, então não há o
            que compilar. Os modelos vêm dentro do app, e um build diferente traz outro conjunto.
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

  const carimbo = carimbos[peso.pesos];
  const correndoMs = fase.tipo === 'correndo' ? agora - fase.desde : 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* O gesto de borda fica desligado **enquanto corre** — ver AVISO_DE_SAIR_CORPO e o
          cabeçalho: sem `usePreventRemove` no roteador deste SDK, bloquear é o que existe. Nos
          desfechos ele volta, porque ali não há nada a perder. */}
      <Stack.Screen options={{ gestureEnabled: fase.tipo !== 'correndo' }} />
      {fase.tipo === 'correndo' ? <TelaAcesa /> : null}
      <Cabecalho onVoltar={voltar} s={s} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          <Text style={s.titulo} accessibilityRole="header">
            {tituloDaFase(fase.tipo === 'lendo' ? 'correndo' : fase.tipo, peso)}
          </Text>
          {fase.tipo === 'correndo' || fase.tipo === 'lendo' ? <Text style={s.corpo}>{SUBTITULO_CORRENDO}</Text> : null}
          {fase.tipo === 'terminou' ? <Text style={s.corpo}>{SUBTITULO_TERMINOU}</Text> : null}
          {fase.tipo === 'falhou' ? <Text style={s.corpo}>{SUBTITULO_FALHOU}</Text> : null}
        </View>

        {fase.tipo === 'correndo' ? (
          <Correndo
            ms={correndoMs}
            lembranca={linhaDaUltimaVez(carimbo)}
            soma={somaDaEtapa(peso)}
            nota={notaDaEtapa(peso)}
            s={s}
          />
        ) : null}

        {fase.tipo === 'terminou' ? <Terminou ms={fase.ms} peso={peso} s={s} /> : null}
        {fase.tipo === 'falhou' ? <Falhou fim={fase.fim} s={s} /> : null}
        {fase.tipo === 'parada' ? <Parada ms={fase.ms} s={s} /> : null}
        {fase.tipo === 'interrompida' ? <Interrompida s={s} /> : null}

        {fase.tipo === 'correndo' ? (
          <>
            <View style={s.aviso}>
              <Text style={s.avisoTitulo}>{AVISO_DE_SAIR}</Text>
              <Text style={s.corpo}>{AVISO_DE_SAIR_CORPO}</Text>
            </View>
            <View style={s.cartaoSimples}>
              <Text style={s.corpo}>{cartaoDoQueSegue(leituras)}</Text>
            </View>
          </>
        ) : null}

        <View style={s.pe}>
          {fase.tipo === 'correndo' ? (
            <>
              <Pressable
                onPress={() => setFolhaAberta(true)}
                accessibilityRole="button"
                accessibilityLabel="Parar a compilação"
                style={({ pressed }) => [s.botaoSuave, pressed && s.pressed]}
              >
                <Text style={s.botaoSuaveTexto}>Parar a compilação</Text>
              </Pressable>
              <Text style={s.nota}>{PARAR_NAO_APAGA}</Text>
            </>
          ) : null}

          {fase.tipo === 'terminou' ? (
            <>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: '/configuracoes/motores/bancada',
                    params: { recurso: RECURSO_MEDIDO_DO_PESO_ABERTO },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Comparar com os outros motores"
                style={({ pressed }) => [s.botaoCheio, pressed && s.pressed]}
              >
                <Text style={s.botaoCheioTexto}>Comparar com os outros motores</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Voltar para Motores"
                style={({ pressed }) => [s.botaoSuave, pressed && s.pressed]}
              >
                <Text style={s.botaoSuaveTexto}>Voltar para Motores</Text>
              </Pressable>
            </>
          ) : null}

          {fase.tipo === 'falhou' || fase.tipo === 'parada' || fase.tipo === 'interrompida' ? (
            <>
              <Pressable
                onPress={iniciar}
                accessibilityRole="button"
                accessibilityLabel={fase.tipo === 'falhou' ? 'Tentar de novo' : 'Compilar de novo'}
                style={({ pressed }) => [s.botaoCheio, pressed && s.pressed]}
              >
                <Text style={s.botaoCheioTexto}>{fase.tipo === 'falhou' ? 'Tentar de novo' : 'Compilar de novo'}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Voltar para Motores"
                style={({ pressed }) => [s.botaoSuave, pressed && s.pressed]}
              >
                <Text style={s.botaoSuaveTexto}>Voltar para Motores</Text>
              </Pressable>
              {fase.tipo === 'falhou' ? <Text style={s.nota}>{SEM_RELOGIO_NA_FALHA}</Text> : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <FolhaDeParar
        aberta={folhaAberta}
        frase={fraseDeParar(correndoMs)}
        onContinuar={() => setFolhaAberta(false)}
        onParar={parar}
        s={s}
      />
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * A tela acesa enquanto compila — o molde da bancada (`TelaAcesa` de `bancada.tsx`).
 *
 * Com a tela apagada o iOS suspende o app, e o carregador do Core AI em segundo plano cai por
 * taxa: onze minutos de compilação virariam uma falha por um motivo que não é do modelo.
 * Montado só na fase que corre — desmontar solta a trava.
 */
function TelaAcesa() {
  useKeepAwake('orbe-motores-compilar');
  return null;
}

/** O cabeçalho de pilha desta família: o chevron e o nome da tela anterior. */
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

/**
 * O cartão que corre: o relógio, a barra que **não** promete, a lembrança e a etapa única.
 *
 * A barra é listrada e **estática** de propósito. Não há fração a mostrar, e uma animação que
 * andasse — ainda que "indeterminada" — leria como progresso: é a única mentira grande que esta
 * tela poderia contar. As listras são três vistas empilhadas, e não um gradiente repetido, que
 * o React Native não tem.
 */
function Correndo({
  ms,
  lembranca,
  soma,
  nota,
  s,
}: {
  ms: number;
  lembranca: string;
  soma: string | undefined;
  nota: string;
  s: Styles;
}) {
  const amarelo = roleColors('yellow');
  return (
    <View style={s.cartao}>
      <View style={s.linhaDoRelogio}>
        <Text style={s.relogio} accessibilityLabel={`${relogio(ms)} de compilação`}>
          {relogio(ms)}
        </Text>
        <Text style={s.rotulo}>correndo</Text>
      </View>
      <View style={s.barra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[s.barraListra, i % 2 === 0 && { backgroundColor: colors.lineWarm }]} />
        ))}
      </View>
      <Text style={s.nota}>{lembranca}</Text>
      <View style={s.linha}>
        <View style={[s.pontoDaEtapa, { borderColor: amarelo.text }]} />
        <Text style={[s.etapa, { color: amarelo.text }]}>{ETAPA_UNICA}</Text>
        {soma !== undefined ? <Text style={s.valor}>{soma}</Text> : null}
      </View>
      <Text style={s.nota}>{nota}</Text>
    </View>
  );
}

/**
 * O fim que terminou: o tempo que levou, o que ocupa agora, e o aviso de que não é para sempre.
 *
 * A ocupação é pedida com `compilado`, e não com o estado bruto, porque esta fase **só** existe
 * quando `fimDaCompilacao` disse `compilou` — e ele só o diz lendo o cache. O estado e a
 * constante dizem a mesma coisa aqui; passar a constante deixa isso explícito em vez de fazer o
 * leitor refazer a dedução.
 */
function Terminou({ ms, peso, s }: { ms: number; peso: PesoAberto; s: Styles }) {
  const verde = roleColors('green');
  const ocupacao = ocupacaoDoModelo(peso, { tipo: 'compilado' });
  return (
    <>
      <View style={s.cartao}>
        <View style={s.linhaDoRelogio}>
          <Ionicons name="checkmark" size={20} color={verde.text} />
          <Text style={s.relogio}>{relogio(ms)}</Text>
          <Text style={s.rotulo}>foi o que levou</Text>
        </View>
        <View style={s.regua} />
        <View style={s.linha}>
          <Text style={s.rotulo}>Ocupa agora no telefone</Text>
          <Text style={s.valor}>{ocupacao.tipo === 'sem-medida' ? 'não medido' : ocupacao.total}</Text>
        </View>
        {ocupacao.tipo === 'sem-medida' ? <Text style={s.nota}>{ocupacao.frase}</Text> : null}
        {ocupacao.tipo === 'so-instalado' && ocupacao.semMedida !== undefined ? (
          <Text style={s.nota}>{ocupacao.semMedida}</Text>
        ) : null}
        {ocupacao.tipo === 'duas-partes' ? (
          <View style={s.legenda}>
            <Legenda cor={colors.ink3} texto={`instalado ${ocupacao.instalado}`} s={s} />
            <Legenda cor={verde.graphic} texto={`compilado ${ocupacao.compilado}`} s={s} />
          </View>
        ) : null}
      </View>
      <View style={s.aviso}>
        <Text style={s.avisoTitulo}>{NAO_E_PARA_SEMPRE_TITULO}</Text>
        <Text style={s.corpo}>{NAO_E_PARA_SEMPRE}</Text>
      </View>
    </>
  );
}

/**
 * O fim que falhou: as palavras de quem falou, e os dois remédios.
 *
 * **Sem relógio**, e o pé da tela diz por quê. O título do cartão muda com `doSistema`: quando
 * quem falou foi o app — o prazo estourado, o cache que não ficou completo —, anunciá-lo como
 * fala do sistema seria pôr na boca dele uma frase nossa.
 */
function Falhou({ fim, s }: { fim: FimDaCompilacao; s: Styles }) {
  if (fim.tipo === 'compilou') return null;
  const vermelho = roleColors('red');
  return (
    <>
      <View style={[s.cartao, { borderColor: vermelho.graphic }]}>
        <Text style={[s.secaoTitulo, { color: vermelho.text }]}>
          {fim.doSistema ? 'O que o sistema disse' : 'O que aconteceu'}
        </Text>
        <Text style={s.palavras}>{fim.palavras}</Text>
        {fim.detalhe !== undefined ? <Text style={s.nota}>{fim.detalhe}</Text> : null}
      </View>
      <View style={s.cartao}>
        <Text style={s.avisoTitulo}>O que costuma resolver</Text>
        {REMEDIOS_DA_FALHA.map((r, i) => (
          <View key={r} style={s.linha}>
            <Text style={s.numero}>{i + 1}.</Text>
            <Text style={s.remedio}>{r}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

/** Parada por você: mostra o tempo, e diz que ele não conta como medida. */
function Parada({ ms, s }: { ms: number; s: Styles }) {
  return (
    <View style={s.cartao}>
      <View style={s.linhaDoRelogio}>
        <Text style={s.relogioApagado}>{relogio(ms)}</Text>
        <Text style={s.rotulo}>{PARADA_NAO_CONTA}</Text>
      </View>
      <Text style={s.corpo}>{PARADA_CORPO}</Text>
    </View>
  );
}

/** Interrompida sem você: sem relógio e sem carimbo — nem se sabe quanto correu. */
function Interrompida({ s }: { s: Styles }) {
  return (
    <View style={s.cartao}>
      <Text style={s.corpo}>{INTERROMPIDA_CORPO}</Text>
    </View>
  );
}

/**
 * A folha de confirmação, antes de parar — e a mesma que a seta de voltar abre.
 *
 * Ela existe porque quinze minutos não podem morrer por acidente de dedo, e é por isso que o
 * gesto de borda fica desligado enquanto a compilação corre: sem um `usePreventRemove` no
 * roteador deste SDK, não há como intervir num gesto que já está dispensando a tela.
 */
function FolhaDeParar({
  aberta,
  frase,
  onContinuar,
  onParar,
  s,
}: {
  aberta: boolean;
  frase: string;
  onContinuar: () => void;
  onParar: () => void;
  s: Styles;
}) {
  const vermelho = roleColors('red');
  return (
    <Modal visible={aberta} transparent animationType="fade" onRequestClose={onContinuar}>
      <Pressable
        style={[s.veu, { backgroundColor: corComAlfa(mediaVeil, VEU_DA_FOLHA) }]}
        onPress={onContinuar}
        accessibilityRole="button"
        accessibilityLabel="Continuar a compilação"
      />
      <View style={s.folha}>
        <Text style={s.folhaTexto}>{frase}</Text>
        <View style={s.folhaBotoes}>
          <Pressable
            onPress={onContinuar}
            accessibilityRole="button"
            accessibilityLabel="Continuar a compilação"
            style={({ pressed }) => [s.folhaBotao, pressed && s.pressed]}
          >
            <Text style={s.botaoSuaveTexto}>Continuar</Text>
          </Pressable>
          <Pressable
            onPress={onParar}
            accessibilityRole="button"
            accessibilityLabel="Parar a compilação"
            style={({ pressed }) => [s.folhaBotao, { borderColor: vermelho.graphic }, pressed && s.pressed]}
          >
            <Text style={[s.botaoSuaveTexto, { color: vermelho.text }]}>Parar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'], gap: 16 },

    cabecalho: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.xs },
    voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    contexto: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },

    topo: { gap: 7 },
    titulo: { fontSize: 30, lineHeight: 35, fontFamily: fonts.serif, color: colors.ink },

    cartao: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 16,
      gap: spacing.sm,
    },
    cartaoSimples: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
    },
    regua: { height: 1, backgroundColor: colors.line },

    linhaDoRelogio: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    relogio: { fontSize: 34, lineHeight: 40, fontFamily: fonts.monoSemiBold, color: colors.ink },
    relogioApagado: { fontSize: 24, lineHeight: 30, fontFamily: fonts.monoSemiBold, color: colors.ink2 },

    // A barra listrada: seis faixas, alternando vazio e `lineWarm`. Estática — ver `Correndo`.
    barra: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
    barraListra: { flex: 1, height: 6 },

    linha: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    rotulo: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    valor: { flexShrink: 0, textAlign: 'right', fontSize: 13, fontFamily: fonts.monoSemiBold, color: colors.ink },
    etapa: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 13, lineHeight: 19, fontFamily: fonts.sansSemiBold },
    pontoDaEtapa: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, alignSelf: 'center' },
    nota: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    corpo: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    palavras: { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink },
    cru: { fontFamily: fonts.mono, color: colors.ink },
    numero: { flexShrink: 0, fontSize: 12, fontFamily: fonts.mono, color: colors.ink2 },
    remedio: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 12, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink2 },

    secaoTitulo: { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 0.8, textTransform: 'uppercase' },

    legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0 },
    ponto: { width: 7, height: 7, borderRadius: 4 },

    aviso: {
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
      gap: spacing.xs,
    },
    avisoTitulo: { fontSize: 11.5, fontFamily: fonts.sansBold, color: colors.ink },

    pe: { gap: spacing.sm, marginTop: spacing.sm },
    botaoCheio: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
      paddingHorizontal: 14,
    },
    botaoCheioTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.bg },
    botaoSuave: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.lineDeep,
      paddingHorizontal: 14,
    },
    botaoSuaveTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink2 },

    veu: { flex: 1 },
    folha: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii['3xl'],
      borderTopRightRadius: radii['3xl'],
      borderTopWidth: 1,
      borderColor: colors.line,
      padding: spacing.xl,
      paddingBottom: spacing['3xl'],
      gap: spacing.md,
    },
    folhaTexto: { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink },
    folhaBotoes: { flexDirection: 'row', gap: spacing.sm },
    folhaBotao: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.lineDeep,
    },

    vazio: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  });
