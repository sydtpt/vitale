import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATALOGO_DE_RECURSOS, resolverCadeia, type MotorId, type RecursoId } from '@vitale/shared';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import {
  estadoDaCompilacaoDosPesos,
  estadoDosPesosAbertos,
  garantirListaAprovada,
  ponteDoAparelho,
  reconsultarPesosAbertos,
  relerCompilacaoDosPesos,
} from '../../../lib/motores';
import {
  COMPILACAO_AUSENTE,
  PESOS_ABERTOS,
  compilacaoDoModelo,
  listaAprovada,
  motoresDoRecurso,
  motivoDeBloqueio,
  type CompilacaoDoModelo,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type ListaAprovada,
  type MotorConhecido,
  type PesoAberto,
  type RecursoDoSeletor,
} from '../../../lib/motores/catalogo';
import {
  gravarPreferencia,
  lerPreferencias,
  type PreferenciaDeMotores,
} from '../../../lib/motores/preferencia';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../../theme';

/**
 * /configuracoes/motores — quem escreve cada leitura, neste aparelho.
 *
 * **Os recursos vêm do catálogo do núcleo** (`CATALOGO_DE_RECURSOS`), nunca de uma
 * lista escrita aqui: um recurso novo no núcleo aparece nesta tela sem ninguém
 * lembrar de acrescentá-lo. Só o nome em português é local — e num
 * `Record<RecursoId, …>` fechado, para que um recurso sem nome **não compile** em
 * vez de aparecer na tela como `saude-do-sono`.
 *
 * **Os motores vêm do catálogo do app**, e o que não dá aparece: apagado, não
 * selecionável, com o motivo escrito. O `aparelho:sistema` segue o **diagnóstico
 * da ponte** (story 5.9) — relido ao focar a tela e quando o app volta ao primeiro
 * plano, enquanto não disser "disponível": disponível com a variante e a
 * janela numa linha simples (`AFM 3 Core Advanced · janela de 8.192 tokens` — é a
 * resposta a "que modelo eu tenho"), ou apagado com o motivo em palavras (Apple
 * Intelligence desligada, modelo não pronto, aparelho não elegível, ponte ausente
 * neste build). Esconder o aparelho faria a tela mentir por omissão.
 *
 * **E um controle inerte é a mentira espelhada.** Oferecer escolha para um recurso
 * que não lê a preferência gravaria algo que ninguém consulta — o dono trocaria o
 * motor e nada mudaria. O recurso nesse estado aparece mesmo assim, com o motivo,
 * no mesmo idioma do motor indisponível. Quem diz quais recursos esta camada
 * hospeda é a própria camada (`HOSPEDAGEM`), não esta tela — e desde a 5.7 os três
 * estão ligados: a Saúde do sono (5.5), a Retrospectiva (1.10) e o nome de rota.
 *
 * **A escolha é deste aparelho** (AD-8): vai para o AsyncStorage, não para
 * `user_preferences`. O que está disponível é propriedade do aparelho, e
 * sincronizar a escolha faria um aparelho sem ponte herdar uma preferência que não
 * tem como cumprir.
 */

/** O nome de cada recurso na tela. Fechado: recurso novo sem nome não compila. */
const NOME_DO_RECURSO: Readonly<Record<RecursoId, string>> = {
  retrospectiva: 'Retrospectiva',
  'saude-do-sono': 'Saúde do sono',
  'nome-de-rota': 'Nome de rota',
};

export default function MotoresScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [preferencias, setPreferencias] = useState<PreferenciaDeMotores>({});
  // A lista do servidor (ADR 0048). Buscada ao abrir a tela, e **nunca** um
  // obstáculo: enquanto ela não volta (ou se não voltar), a tela mostra o que o
  // app conhece por conta própria, que já inclui `nuvem:padrao`. É o seletor, não
  // a leitura, que pode esperar — aqui o dono só está olhando a lista.
  // Começa no que já está em cache: voltar a esta tela não pode fazer um motor
  // já conhecido piscar fora da lista.
  const [lista, setLista] = useState<ListaAprovada | null>(listaAprovada);
  // A ponte do aparelho (5.9): começa no que já se sabe — ausente, consultando ou o
  // último diagnóstico — e **relê enquanto ele não disser "disponível"**: ao focar
  // a tela, e quando o app volta ao primeiro plano (o dono ligou a Apple
  // Intelligence nos Ajustes e voltou). Disponível não é relido. Nunca rejeita.
  const [ponte, setPonte] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  // O peso aberto (5.8) tem diagnóstico próprio, e pelo mesmo motivo: o modelo do sistema
  // pode estar de pé com os pesos ausentes, e o contrário também.
  // Um diagnóstico por peso aberto (spike 22/09): o build carrega vários, e cada um pode
  // estar de pé ou não por conta própria — pesos presentes num, ausentes no outro.
  const [coreai, setCoreai] = useState<Readonly<Record<string, EstadoDaPonte>>>(() => estadoDosPesosAbertos());
  // A compilação é relida **sempre**, e não só enquanto não disser "sim": um modelo compilado
  // volta a não estar sozinho — o iOS atualiza e recompila tudo, ou purga o cache sob pressão
  // de espaço. A pergunta custa ~0,5 ms; lembrar a resposta é que produziria a mentira.
  const [compilacao, setCompilacao] = useState<Readonly<Record<string, EstadoDaCompilacao>>>(() =>
    estadoDaCompilacaoDosPesos(),
  );
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
    void garantirListaAprovada()
      .then((l) => {
        if (vivo) setLista(l);
      })
      .catch(() => {
        // `garantirListaAprovada` já engole a falha e devolve o cache (ou nulo).
        // O `.catch` é rede contra alguém afrouxar isso, não conserto.
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    // O `.catch` é rede, não conserto: `lerPreferencias` já engole falha de
    // armazenamento e devolve vazio (há teste). Sem ele, bastaria alguém afrouxar
    // aquele `try` para esta tela virar uma rejeição não tratada no arranque.
    void lerPreferencias()
      .then((p) => {
        if (vivo) setPreferencias(p);
      })
      .catch(() => {
        if (vivo) setPreferencias({});
      });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = useCallback((recurso: RecursoId, motor: MotorId) => {
    // O estado local vai primeiro: a gravação é um read-modify-write enfileirado, e
    // esperar por ele deixaria o toque sem resposta visível.
    //
    // Mas ele **volta atrás se a gravação falhar**. O módulo da preferência rejeita
    // de propósito quando o armazenamento falha (tem teste para isso), e jogar a
    // rejeição fora deixava a linha marcada na tela e a escolha perdida no próximo
    // arranque — o pior dos dois mundos, e uma rejeição não tratada de brinde.
    let anterior: MotorId | undefined;
    setPreferencias((p) => {
      anterior = p[recurso];
      return { ...p, [recurso]: motor };
    });
    void gravarPreferencia(recurso, motor).catch(() => {
      setPreferencias((p) => {
        const volta = { ...p };
        if (anterior === undefined) delete volta[recurso];
        else volta[recurso] = anterior;
        return volta;
      });
    });
  }, []);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader titulo="Motores" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.hint}>
          Quem escreve cada leitura, neste aparelho. A escolha não sincroniza: o que está
          disponível depende do aparelho. Sem modelo é o template escrito no código — instantâneo,
          sempre igual, e nada sai daqui.
        </Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Modelos no aparelho</Text>
          {PESOS_ABERTOS.length === 0 ? (
            // Sem CTA: não há de onde instalar — o peso vem no binário.
            <Text style={s.hint}>Este build não embarca nenhum modelo aberto.</Text>
          ) : (
            PESOS_ABERTOS.map((p) => (
              <LinhaDoModelo
                key={p.id}
                peso={p}
                estado={compilacaoDoModelo(compilacao[p.pesos] ?? COMPILACAO_AUSENTE)}
                s={s}
              />
            ))
          )}
        </View>

        {CATALOGO_DE_RECURSOS.map((d) => {
          const recurso: RecursoDoSeletor = d;
          const escolhido = preferencias[recurso.recurso] ?? null;
          // O catálogo é **por recurso** desde a 5.6: a lista do servidor aprova um
          // motor de nuvem para recursos nomeados, não para todos.
          const conhecidos = motoresDoRecurso(recurso.recurso, { sistema: ponte, coreai: coreai }, lista);
          // Quem de fato escreveria agora: a cadeia resolvida decide, não a tela.
          // Sem preferência, é o padrão do recurso; com uma que o regime recusa, é o
          // recuo — e a tela mostra o que o orquestrador faria, não o que foi tocado.
          const efetivo = resolverCadeia(d, escolhido, conhecidos.map((m) => m.id))[0];
          return (
            <View key={recurso.recurso} style={s.section}>
              <Text style={s.sectionTitle}>{NOME_DO_RECURSO[recurso.recurso]}</Text>
              {conhecidos.map((m) => (
                <LinhaDoMotor
                  key={m.id}
                  motor={m}
                  selecionado={m.id === efetivo}
                  motivo={motivoDeBloqueio(recurso, m.id, conhecidos)}
                  onPress={() => escolher(recurso.recurso, m.id)}
                  s={s}
                />
              ))}
            </View>
          );
        })}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Desenvolvimento</Text>
          <Pressable
            onPress={() => router.push('/configuracoes/motores/bancada')}
            accessibilityRole="button"
            style={({ pressed }) => [s.card, pressed && s.pressed]}
          >
            <View style={s.meta}>
              <Text style={s.name}>Bancada</Text>
              <Text style={s.sub}>
                Os motores lado a lado na mesma janela, em modo medição — com o desfecho, o tempo,
                os tokens e o texto cru.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
          </Pressable>
        </View>

        <Text style={s.hint}>
          A leitura é efêmera: ela só acontece quando você toca o ícone, e nunca é gravada em lugar
          nenhum. Por isso ela pode ler um período em curso.
        </Text>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Um modelo aberto deste build, com o **estado real do cache** — lido de `isCached` na
 * montagem e a cada foco, nunca suposto.
 *
 * **"Todo build nasce não compilado" é falso**, e é essa suposição que esta linha existe para
 * não repetir: o cache do Core AI é particionado por build do **iOS**, não do app, então
 * instalar um app novo sobre o mesmo sistema abre com os modelos já compilados. A espera só
 * volta quando o iPhone atualiza — ou quando o sistema purga o cache por falta de espaço, e aí
 * um modelo compilado deixa de estar sem ninguém ter tocado em nada.
 *
 * **Compilar só aparece onde há o que compilar.** Uma linha compilada não o carrega: um botão
 * que recompilasse o já compilado cobraria minutos por um toque que não mudaria nada. E uma
 * linha em "não dá para saber" também não — oferecer o ato para um modelo que este build nem
 * traz é a confusão exata entre "não" e "não sei" que o estado de três valores evita.
 */
/** O preço do ato, dito antes dele — e a única coisa honesta a dizer enquanto a tela não existe. */
const PRECO_DE_COMPILAR =
  'A primeira leitura deste modelo compila para o chip, e leva minutos. A tela que faz isso ainda não existe.';

function LinhaDoModelo({ peso, estado, s }: { peso: PesoAberto; estado: CompilacaoDoModelo; s: Styles }) {
  const dizer =
    estado.tipo === 'compilado'
      ? 'compilado'
      : estado.tipo === 'nao-compilado'
        ? 'instalado, não compilado'
        : estado.motivo;
  // O rótulo acessível carrega **tudo o que está à vista**, porque o agrupamento cala o
  // resto: sem ele, quem usa VoiceOver ouviria "não compilado" e perderia o preço.
  const rotuloAcessivel =
    estado.tipo === 'nao-compilado' ? `${peso.rotulo} — ${dizer}. ${PRECO_DE_COMPILAR}` : `${peso.rotulo} — ${dizer}`;
  return (
    <View style={s.card} accessible accessibilityLabel={rotuloAcessivel}>
      <View style={s.meta}>
        <Text style={s.name}>{peso.rotulo}</Text>
        <Text style={[s.motivo, estado.tipo === 'compilado' && s.compilado]}>{dizer}</Text>
        {estado.tipo === 'nao-compilado' ? <Text style={s.motivo}>{PRECO_DE_COMPILAR}</Text> : null}
      </View>
      {/* Tracejada e abafada de propósito: o tracejado diz "isto não é um controle" sem gastar
          uma palavra, e ela não é mesmo — a tela de compilar é a fatia seguinte. Um botão com
          cara de botão que não faz nada mente tanto quanto uma omissão. */}
      {estado.tipo === 'nao-compilado' ? (
        <View style={s.pilula}>
          <Text style={s.pilulaTexto}>Compilar</Text>
        </View>
      ) : null}
    </View>
  );
}

function LinhaDoMotor({
  motor,
  selecionado,
  motivo,
  onPress,
  s,
}: {
  motor: MotorConhecido;
  selecionado: boolean;
  /** Por que não dá, em palavras — ou `null`, se dá. */
  motivo: string | null;
  onPress: () => void;
  s: Styles;
}) {
  const bloqueado = motivo !== null;
  // "Consultando" não é "indisponível": o leitor de tela o anuncia ocupado, com o
  // próprio rótulo, e não como um motor que não existe.
  const consultando = motor.consultando === true;
  // O detalhe (variante · janela) só quando a linha está livre: bloqueado pelo
  // recurso (a Retrospectiva), ele empilharia com o motivo, e a pergunta ali não é
  // "qual modelo" — é "por que não".
  const detalhe = bloqueado ? undefined : motor.detalhe;
  const rotuloAcessivel = consultando
    ? `${motor.rotulo} — consultando o aparelho`
    : `${motor.rotulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}${bloqueado ? ` — indisponível: ${motivo}` : ''}`;
  return (
    <Pressable
      onPress={bloqueado ? undefined : onPress}
      disabled={bloqueado}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionado, disabled: bloqueado, busy: consultando }}
      accessibilityLabel={rotuloAcessivel}
      style={({ pressed }) => [s.card, selecionado && s.cardSelected, pressed && s.pressed]}
    >
      <View style={s.meta}>
        <Text style={[s.name, bloqueado && s.faded]}>{motor.rotulo}</Text>
        <Text style={[s.sub, bloqueado && s.faded]}>{motor.descricao}</Text>
        {/* Qual modelo é, quando há o que dizer — no estilo da linha do motivo. */}
        {detalhe !== undefined ? <Text style={s.motivo}>{detalhe}</Text> : null}
        {motivo !== null ? <Text style={s.motivo}>{motivo}</Text> : null}
      </View>
      <View style={[s.check, selecionado && s.checkOn]}>
        {/* `onPrimary`, não um branco cravado: a marca `tinta` fica quase branca
            no escuro, e aí o branco ficaria branco sobre branco. */}
        {selecionado && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
      </View>
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },
    content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
    hint: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 18, paddingHorizontal: 4 },
    section: { gap: spacing.sm, marginTop: spacing.lg },
    sectionTitle: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink2, paddingHorizontal: 4 },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 14,
      ...shadows.card,
    },
    cardSelected: { borderColor: colors.primary },
    meta: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 17 },
    faded: { color: colors.ink4 },
    motivo: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 17, marginTop: 3 },
    // Papel `green` como **texto** (`greenText`), não como traço: o `green` do Orbe claro mede
    // 2,81 sobre a superfície e não paga os 4,5 de letra.
    compilado: { color: colors.greenText },
    pilula: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.line,
    },
    pilulaTexto: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  });
