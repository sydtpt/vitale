import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATALOGO_DE_RECURSOS,
  resolverCadeia,
  type Descritor,
  type MotorId,
  type RecursoId,
} from '@vitale/shared';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { FolhaDeEscolha } from '../../../components/motores/FolhaDeEscolha';
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
  HOSPEDAGEM,
  PESOS_ABERTOS,
  compilacaoDoModelo,
  listaAprovada,
  motorConhecido,
  motoresDoRecurso,
  type CompilacaoDoModelo,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type ListaAprovada,
  type PesoAberto,
} from '../../../lib/motores/catalogo';
import {
  AVISO_DE_GRAVACAO_FALHA,
  PRECO_DE_COMPILAR,
  estadoDaCompilacaoEmPalavras,
} from '../../../lib/motores/folha-regras';
import {
  gravarPreferencia,
  lerPreferencias,
  type PreferenciaDeMotores,
} from '../../../lib/motores/preferencia';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../../theme';

/**
 * /configuracoes/motores — quem escreve cada leitura, neste aparelho.
 *
 * **Três blocos, e o modelo vem antes da leitura.** A ordem contrária seria a mais
 * óbvia — primeiro o que o app faz, depois com o quê —, mas a pergunta que traz o
 * dono a esta tela é "o que eu tenho instalado e quanto está custando", não "quem
 * escreve a Retrospectiva". O inventário é o assunto; a atribuição é a consequência.
 *
 * **Uma linha por leitura, não um bloco por leitura** (fatia 3). A tela repetia
 * todos os motores dentro de cada recurso: 3 recursos × 5 motores eram 15 cartões
 * empilhados, e as duas listas vão crescer. Agora a linha mostra **quem escreve** e
 * o catálogo inteiro vive na {@link FolhaDeEscolha}, que abre ao toque. O produto
 * virou soma.
 *
 * **Os recursos vêm do catálogo do núcleo** (`CATALOGO_DE_RECURSOS`), nunca de uma
 * lista escrita aqui: um recurso novo no núcleo aparece nesta tela sem ninguém
 * lembrar de acrescentá-lo. Só o nome em português é local — e num
 * `Record<RecursoId, …>` fechado, para que um recurso sem nome **não compile** em
 * vez de aparecer na tela como `saude-do-sono`.
 *
 * **O valor à direita é quem escreveria agora**, resolvido por `resolverCadeia`, e
 * não o que foi tocado por último: se o dono escolheu a nuvem e o regime do recurso
 * a recusa, a linha mostra o recuo, porque é isso que vai acontecer.
 *
 * **E a volta atrás de uma gravação que falhou é vista.** `preferencia.ts` rejeita
 * de propósito quando o armazenamento falha, e a tela já voltava ao valor anterior —
 * calada. Do ponto de vista do dono a escolha simplesmente não pegava: a folha já
 * tinha fechado, e a linha mudava de valor sozinha atrás dele. Agora a linha diz por
 * quê, no lugar do valor e até o toque seguinte. Não é alerta e não é modal — a
 * folha já se foi, e um alerta perguntaria algo a quem não pediu nada.
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
  // "em português", e não "(pt)": as duas linhas ficam vizinhas no seletor, e a
  // diferença entre elas é a única coisa que o dono precisa ler para escolher dois
  // motores diferentes — que é o motivo de o recurso existir.
  'nome-de-rota-pt': 'Nome de rota em português',
};

export default function MotoresScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [preferencias, setPreferencias] = useState<PreferenciaDeMotores>({});
  /**
   * As leituras cuja gravação falhou — o que a linha diz no lugar do motor, até o
   * toque seguinte. Um conjunto, e não um booleano: duas leituras tocadas em
   * sequência com o armazenamento quebrado falham as duas, e a segunda não pode
   * apagar o aviso da primeira.
   */
  const [falhouAoGravar, setFalhouAoGravar] = useState<ReadonlySet<string>>(() => new Set());
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
  /** Qual leitura está com a folha aberta. `null` é a folha fechada. */
  const [folhaAberta, setFolhaAberta] = useState<RecursoId | null>(null);

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
    // Um toque novo limpa o aviso do toque anterior: ele fala desta tentativa.
    setFalhouAoGravar((f) => {
      if (!f.has(recurso)) return f;
      const proximo = new Set(f);
      proximo.delete(recurso);
      return proximo;
    });
    void gravarPreferencia(recurso, motor).catch(() => {
      setPreferencias((p) => {
        const volta = { ...p };
        if (anterior === undefined) delete volta[recurso];
        else volta[recurso] = anterior;
        return volta;
      });
      // E a volta atrás passa a ser **vista**: sem isto ela é silenciosa, a folha já
      // fechou, e a linha muda de valor sozinha atrás do dono.
      setFalhouAoGravar((f) => new Set(f).add(recurso));
    });
  }, []);

  /** O descritor da folha aberta — e a fonte do `grava` e do `regimeMaximo` dela. */
  const descritorDaFolha = useMemo(
    () => CATALOGO_DE_RECURSOS.find((d) => d.recurso === folhaAberta) ?? null,
    [folhaAberta],
  );
  const motoresDaFolha = useMemo(
    () =>
      descritorDaFolha === null
        ? []
        : motoresDoRecurso(descritorDaFolha.recurso, { sistema: ponte, coreai }, lista),
    [descritorDaFolha, ponte, coreai, lista],
  );

  /**
   * O atalho do pé da folha, e a razão de ele fechar a folha **antes** de navegar: o
   * iOS não empilha três camadas, e empurrar a rota com a folha de pé deixaria a tela
   * nova atrás dela. É o achado pago na frente de fotos, e vale igual aqui.
   */
  const compararDaFolha = useCallback(() => {
    const recurso = folhaAberta;
    if (recurso === null) return;
    setFolhaAberta(null);
    requestAnimationFrame(() => {
      router.push({ pathname: '/configuracoes/motores/bancada', params: { recurso } });
    });
  }, [folhaAberta, router]);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader titulo="Motores" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.hint}>
          Quem escreve cada leitura, neste aparelho. A escolha não sincroniza: o que está
          disponível depende do aparelho.
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
                onAbrir={() => router.push(`/configuracoes/motores/modelo/${p.pesos}`)}
                s={s}
              />
            ))
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Quem escreve o quê</Text>
          {CATALOGO_DE_RECURSOS.map((d) => (
            <LinhaDaLeitura
              key={d.recurso}
              descritor={d}
              escolhido={preferencias[d.recurso] ?? null}
              conhecidos={motoresDoRecurso(d.recurso, { sistema: ponte, coreai }, lista)}
              falhou={falhouAoGravar.has(d.recurso)}
              onAbrir={() => setFolhaAberta(d.recurso)}
              s={s}
            />
          ))}
          <Text style={s.hint}>
            Cada leitura começa onde o código manda — o sono, no template; as outras, na nuvem —
            até você escolher.
          </Text>
        </View>

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

      <FolhaDeEscolha
        recurso={descritorDaFolha}
        nomeDaLeitura={folhaAberta === null ? '' : NOME_DO_RECURSO[folhaAberta]}
        motores={motoresDaFolha}
        escolhido={folhaAberta === null ? null : preferencias[folhaAberta] ?? null}
        compilacao={compilacao}
        onEscolher={(motor) => {
          if (folhaAberta === null) return;
          // Escolher fecha a folha na hora, e a linha da raiz já mostra o novo valor:
          // a gravação é otimista e volta atrás — com aviso — se falhar.
          escolher(folhaAberta, motor);
          setFolhaAberta(null);
        }}
        onFechar={() => setFolhaAberta(null)}
        onComparar={compararDaFolha}
      />
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
 *
 * **A linha inteira abre a ficha** (fatia 3): é lá que moram o que ele ocupa, o carimbo da
 * compilação, a janela e onde ele escreve hoje.
 */
function LinhaDoModelo({
  peso,
  estado,
  onAbrir,
  s,
}: {
  peso: PesoAberto;
  estado: CompilacaoDoModelo;
  onAbrir: () => void;
  s: Styles;
}) {
  const dizer = estadoDaCompilacaoEmPalavras(estado, peso);
  // O rótulo acessível carrega **tudo o que está à vista**, porque o agrupamento cala o
  // resto: sem ele, quem usa VoiceOver ouviria "não compilado" e perderia o preço.
  const rotuloAcessivel =
    estado.tipo === 'nao-compilado' ? `${peso.rotulo} — ${dizer}. ${PRECO_DE_COMPILAR}` : `${peso.rotulo} — ${dizer}`;
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.meta}>
        <Text style={s.name}>{peso.rotulo}</Text>
        <Text style={[s.motivo, estado.tipo === 'compilado' && s.compilado]}>{dizer}</Text>
        {estado.tipo === 'nao-compilado' ? <Text style={s.motivo}>{PRECO_DE_COMPILAR}</Text> : null}
      </View>
      {/* Tracejada e abafada de propósito: o tracejado diz "isto não é um controle" sem gastar
          uma palavra, e ela não é mesmo — a tela de compilar é a fatia 2. Um botão com
          cara de botão que não faz nada mente tanto quanto uma omissão. */}
      {estado.tipo === 'nao-compilado' ? (
        <View style={s.pilula}>
          <Text style={s.pilulaTexto}>Compilar</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={15} color={colors.ink3} style={s.chevron} />
      )}
    </Pressable>
  );
}

/**
 * Uma leitura, e **quem escreveria nela agora**.
 *
 * O valor à direita sai de `resolverCadeia`, não da preferência: a tela mostra o que o
 * orquestrador faria. Um recurso que esta camada não hospeda aparece **com o motivo e sem
 * chevron** — hoje os três estão ligados e o caso não ocorre; o ramo existe para o quarto
 * recurso não nascer mudo.
 */
function LinhaDaLeitura({
  descritor,
  escolhido,
  conhecidos,
  falhou,
  onAbrir,
  s,
}: {
  descritor: Descritor<unknown, unknown>;
  escolhido: MotorId | null;
  conhecidos: ReturnType<typeof motoresDoRecurso>;
  /** A última gravação desta leitura falhou, e a linha voltou ao valor anterior. */
  falhou: boolean;
  onAbrir: () => void;
  s: Styles;
}) {
  const hospedagem = HOSPEDAGEM[descritor.recurso];
  const efetivo = resolverCadeia(descritor, escolhido, conhecidos.map((m) => m.id))[0];
  const nomeDoEfetivo = motorConhecido(efetivo, conhecidos)?.rotulo ?? efetivo ?? '—';
  const valor = falhou ? AVISO_DE_GRAVACAO_FALHA : nomeDoEfetivo;
  const nome = NOME_DO_RECURSO[descritor.recurso];
  const rotuloAcessivel = hospedagem.hospedado
    ? `${nome} — escreve ${valor}`
    : `${nome} — indisponível: ${hospedagem.motivo ?? 'ainda não usado nesta versão'}`;
  return (
    <Pressable
      onPress={hospedagem.hospedado ? onAbrir : undefined}
      disabled={!hospedagem.hospedado}
      accessibilityRole="button"
      accessibilityState={{ disabled: !hospedagem.hospedado }}
      accessibilityLabel={rotuloAcessivel}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.meta}>
        <Text style={s.name}>{nome}</Text>
        {!hospedagem.hospedado ? (
          <Text style={s.motivo}>{hospedagem.motivo ?? 'ainda não usado nesta versão'}</Text>
        ) : null}
      </View>
      {hospedagem.hospedado ? (
        <>
          {/* O aviso ocupa o lugar do valor: é ele que responde "quem escreve" agora —
              e a resposta honesta é que a escolha não pegou. `ink2`, não `ink3`: o que
              muda a decisão do dono é texto e cobra 4,5. */}
          <Text style={[s.valor, falhou && s.valorFalhou]}>{valor}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.ink3} style={s.chevron} />
        </>
      ) : null}
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
      // Mínimo, nunca altura: em Texto grande a linha cresce em vez de cortar o estado.
      minHeight: 44,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 14,
      ...shadows.card,
    },
    // `flexShrink` com `minWidth: 0` nos dois lados da linha: uma fileira que não encolhe
    // empurra os irmãos para fora da tela — a lição da fatia 4.
    meta: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 17 },
    motivo: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 17, marginTop: 3 },
    valor: {
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: fonts.sans,
      color: colors.ink3,
    },
    valorFalhou: { color: colors.ink2 },
    chevron: { flexShrink: 0 },
    // Papel `green` como **texto** (`greenText`), não como traço: o `green` do Orbe claro mede
    // 2,81 sobre a superfície e não paga os 4,5 de letra.
    compilado: { color: colors.greenText },
    pilula: {
      flexShrink: 1,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.line,
    },
    pilulaTexto: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },
  });
