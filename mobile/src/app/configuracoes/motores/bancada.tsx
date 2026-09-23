import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import {
  LIMITE_DA_AMOSTRA,
  RECURSOS,
  REGRA_DA_AMOSTRA,
  REGRA_DA_JANELA_MEDIDA,
  SEM_MODELO,
  agregar,
  amostrasDivergentes,
  chaveDoPasso,
  entradaDaSaude,
  filterByRange,
  foraEmTexto,
  hashCurto,
  linhaDoResumo,
  localDateStr,
  medidasDoPortao,
  porcento,
  resumoDaCobertura,
  resumoDaCorrida,
  segundos,
  type JanelaClassificada,
  type LinhaDoRelatorio,
  type MotorId,
  type RecursoId,
  type SonoRange,
} from '@vitale/shared';
import { useActivitiesStore } from '../../../store/activities.store';
import { useAuthStore } from '../../../store/auth.store';
import { useSonoStore } from '../../../store/sono.store';
import { useEntradaDaEdicao } from '../../../hooks/useEntradaDaEdicao';
import { PeriodNav } from '../../../components/sono/PeriodNav';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import {
  PESOS_ABERTOS,
  PONTE_AUSENTE,
  listaAprovada,
  motoresDoRecurso,
  nomeDoMotor,
  type EstadoDaCompilacao,
  type EstadoDaPonte,
  type ListaAprovada,
} from '../../../lib/motores/catalogo';
import { TETO_DO_ANEL, anel } from '../../../lib/motores/anel';
import {
  PRAZO_DO_PESO_ABERTO_MS,
  PRAZO_MS,
  estadoDaCompilacaoDosPesos,
  estadoDosPesosAbertos,
  garantirListaAprovada,
  ponteDoAparelho,
  reconsultarPesosAbertos,
  relerCompilacaoDosPesos,
} from '../../../lib/motores';
import {
  SO_O_APARELHO_MEDE_A_AMOSTRA,
  chipsDaCorrida,
  colunasPorVir,
  filaDaAmostra,
  filaDaCorrida,
  motivoDoTeto,
  planoDaAmostra,
  prazoDoMotorMs,
  prazoEmTexto,
  recusaDoMotorAgora,
  tetoDaCorridaMs,
  type ChipDaCorrida,
  type ColunaDaCorrida,
  type PrazosDaCorrida,
} from '../../../lib/motores/amostras-regras';
import {
  ETAPA_EM_PALAVRAS,
  duracaoCurta,
  medirCorridas,
  medirJanela,
  prepararAmostra,
  previsaoDaAmostra,
  type ContextoDaAmostra,
  type CorridaMedida,
  type EtapaDoPreparo,
} from '../../../lib/motores/amostra';
import {
  FONTES,
  OFFSET_DA_SEMANA_FECHADA,
  RECURSO_INICIAL,
  fonteDe,
  type CasosDaAmostra,
  type ContextoDasAmostras,
  type Linha,
} from '../../../lib/motores/amostras';
import { foraPorPadrao } from '../../../lib/motores/folha-regras';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../../theme';

/**
 * /configuracoes/motores/bancada — os motores no mesmo caso, lado a lado com o
 * template.
 *
 * **Todas as leituras, não só a Saúde do sono** (spike 22/09). A tela escolhe uma
 * leitura e um caso dela; de onde vêm os casos, qual descritor percorrer e como
 * virar texto a saída dele é da fonte de amostra (`lib/motores/amostras.ts`) — aqui
 * não há um ramo por recurso, e não pode haver: era o que prendia a bancada à única
 * amostra que alguém tinha escrito.
 *
 * É a tela de desenvolvimento do marco A, e o **único lugar do app onde o texto
 * cru do fornecedor aparece**: em produção o que se mostra é a frase montada, com
 * os marcadores já trocados pelos fatos. Aqui se vê o que o motor escreveu antes
 * disso — é assim que paráfrase e sinônimo que a conferência não pega aparecem
 * para o dono.
 *
 * **Modo `medicao`, um motor por vez** (AD-9): exatamente o motor pedido, sem
 * recuo e sem piso. Por isso a primeira passada é a régua — o template, que é
 * determinístico e de graça — e cada motor depois é uma tentativa isolada, com o
 * desfecho, o tempo, os tokens e os problemas da conferência. A frase do template
 * é repetida **dentro** de cada bloco de motor: num telefone não cabem duas
 * colunas de prosa, e o que faz a comparação é a adjacência, não a geometria.
 *
 * O `regimeMaximo` do recurso continua valendo aqui (dado de um recurso
 * só-aparelho não iria à nuvem nem para medir); o `grava.admite` não, porque medir
 * não grava.
 *
 * Nada é gravado, e nada do que esta tela mostra sai do aparelho.
 *
 * **A amostra** (story 5.13). O iPhone tem um modelo maior que o do Mac da bancada, e só
 * ele pode dizer quanto o próprio modelo aprova. "Medir a amostra" roda, em `medicao`,
 * sobre **a mesma amostra de janelas** da bancada do Mac e com a **mesma régua** — a
 * amostra, a tradução em linha e as medidas são do núcleo (`packages/shared/src/bancada/`),
 * e este é o único arquivo do app que as usa: a amostra carrega caso, e caso não entra em
 * tela de produto (barreira do `architecture.test.ts`). O laço fica aqui: uma janela por
 * vez, pela fila da ponte, com as notas inteiras antes de enumerar e a tela acesa enquanto
 * mede. O resultado são os números da ADR 0050 **sem limiar e sem veredito**, e o hash de
 * cada pedido para comparar com o relatório do Mac.
 *
 * **A amostra mede quem o dono marcar** (fatia 5 do redesenho). Ela era do modelo do
 * sistema por definição, e por isso os dois pesos abertos só tinham sido provados numa
 * frase cada — uma frase não é taxa. Agora os chips de "quem entra" valem para as duas
 * corridas da tela, e a amostra vira **uma corrida por motor marcado, em sequência**, com
 * o resultado nomeando quem o produziu e uma linha de comparação por motor. Só motor do
 * aparelho: a nuvem não tem, neste app, as marcas de hospedeiro que a régua da ADR 0050
 * exige, e ela se mede na bancada do Mac (`SO_O_APARELHO_MEDE_A_AMOSTRA`).
 *
 * **A amostra é preparada uma vez** e serve a todas as corridas da sessão. É isso que faz
 * as taxas se compararem: medir o segundo motor num toque de minutos depois poderia
 * enumerar outro acervo — um sync traz a noite de hoje — e as duas taxas pareceriam
 * comparáveis sem serem.
 *
 * **As guardas de borda** (fatia 4 do redesenho). A corrida **relê** antes de correr —
 * diagnóstico e compilação —, e quem perdeu o pé vira uma linha que diz o motivo em vez de
 * uma chamada que compila por minutos; cada coluna tem teto de espera; Medir tem três
 * formas e nunca larga duas corridas; sair da tela abandona a que estiver em voo. Todas as
 * decisões que dão para tomar sem tela moram em `lib/motores/amostras-regras.ts`, com teste.
 * Na amostra a releitura acontece **também na vez de cada motor**: entre o preparo e o
 * segundo modelo passam minutos, que é tempo de sobra para o iOS purgar o cache do Core AI.
 *
 * **O que o Parar promete** (23/09). Ele impede as **próximas** colunas — a que está em voo
 * termina e publica, porque uma chamada em andamento não se cancela e a do aparelho muito
 * menos. Isso está certo desde sempre; o que estava errado era a palavra. Com um motor só
 * marcado, o dono tocou Parar sobre a única coluna em voo e a medição foi até o fim: o botão
 * prometeu o que não tinha como cumprir. Agora a fila é decidida inteira antes da primeira
 * coluna (`filaDaCorrida`), e o botão só se oferece enquanto `colunasPorVir` for maior que
 * zero. Na última coluna não há botão, há a frase que diz por quê; depois do toque o botão
 * fica, dizendo o que está mesmo acontecendo.
 */

/**
 * O que a corrida espera de cada coluna — os prazos que os transportes já têm.
 *
 * Ficam aqui porque é aqui que eles são conhecidos: `tetoDaCorridaMs` é pura e os recebe,
 * para poder ser testada sem o cliente do supabase que `lib/motores/index.ts` carrega.
 */
const PRAZOS_DA_CORRIDA: PrazosDaCorrida = { padrao: PRAZO_MS, pesoAberto: PRAZO_DO_PESO_ABERTO_MS };

/**
 * Uma medição com teto de espera.
 *
 * A promessa perdida continua viva — uma chamada nativa não se cancela —, e é de propósito:
 * o que este teto solta é **a tela**, não o aparelho. Quem terminar depois resolve para
 * ninguém, e a fila do transporte continua respeitando o modelo.
 */
function comTeto(medir: () => Promise<Linha>, tetoMs: number, motor: MotorId): Promise<Linha> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<Linha>((resolver) => {
    relogio = setTimeout(() => resolver({ motor, desfecho: 'defeito', ms: tetoMs, motivo: motivoDoTeto(tetoMs) }), tetoMs);
  });
  return Promise.race([medir(), estouro]).finally(() => clearTimeout(relogio));
}

export default function BancadaScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const periods = useSonoStore((st) => st.periods);
  const ratings = useSonoStore((st) => st.sleepRatings);
  const loaded = useSonoStore((st) => st.loaded);
  const load = useSonoStore((st) => st.load);
  const carregarNotasDesde = useSonoStore((st) => st.carregarNotasDesde);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  // **Qual leitura está na bancada.** O catálogo é o das fontes de amostra, que é
  // fechado sobre os recursos do núcleo: leitura nova aparece aqui sozinha.
  //
  // O atalho do pé da folha de escolha (fatia 3) chega com a leitura no parâmetro, para o
  // dono não ter de reencontrá-la aqui. Um valor que **não é** um recurso conhecido cai no
  // inicial em silêncio: o parâmetro vem da URL, e um estado restaurado pelo Expo Router
  // (ou um link de rascunho) pode trazer qualquer coisa — e travar a tela por isso seria
  // pior do que abrir na leitura de sempre.
  const { recurso: recursoDoAtalho } = useLocalSearchParams<{ recurso?: string }>();
  const [recurso, setRecurso] = useState<RecursoId>(() =>
    (RECURSOS as readonly string[]).includes(recursoDoAtalho ?? '')
      ? (recursoDoAtalho as RecursoId)
      : RECURSO_INICIAL,
  );
  const fonte = useMemo(() => fonteDe(recurso), [recurso]);

  const [range, setRange] = useState<SonoRange>('7d');
  const [offset, setOffset] = useState(0);
  const [rodando, setRodando] = useState<MotorId | null>(null);
  const [linhas, setLinhas] = useState<readonly Linha[]>([]);
  // O diagnóstico da ponte, cru (5.9): relido ao abrir enquanto não for "disponível".
  const [ponte, setPonte] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  // E o do peso aberto (5.8), que é outro fato.
  const [coreai, setCoreai] = useState<Readonly<Record<string, EstadoDaPonte>>>(() => estadoDosPesosAbertos());
  // E a compilação de cada peso aberto, que é um terceiro (fatia 1 do redesenho). Ela é a
  // única das três que volta a ser falsa **sozinha** — o iOS atualiza e recompila tudo, ou
  // purga o cache sob pressão de espaço —, e é por isso que ela é relida a cada foco e mais
  // uma vez antes do laço: um chip marcado cujo compilado sumiu no meio é o caminho pelo
  // qual esta tela dispararia a compilação de minutos que ela promete nunca disparar.
  const [compilacao, setCompilacao] = useState<Readonly<Record<string, EstadoDaCompilacao>>>(() =>
    estadoDaCompilacaoDosPesos(),
  );
  // **Quem entra na corrida** (22/09). Era uma caixinha só, tudo-ou-nada para os pesos
  // abertos; com N modelos isso deixou de servir — o dono quer escolher quais comparar.
  // O conjunto guarda quem está **de fora**, e não quem está dentro, porque um motor que
  // aparece depois (uma variante que o servidor aprovou no meio da sessão) tem de nascer
  // ligado. Os pesos abertos nascem fora: cada um sobe mais de 1 GB e é o mais lento.
  // O `ref` acompanha o estado porque o laço captura o valor no início e roda por minutos.
  // Uma definição só de "quem nasce fora" (`foraPorPadrao`), dividida com o atalho da folha
  // de escolha: duas fariam o número do rótulo de lá prometer uma composição que esta tela
  // não monta.
  const [foraDaCorrida, setForaDaCorrida] = useState<ReadonlySet<string>>(foraPorPadrao);
  const foraRef = useRef(foraDaCorrida);
  foraRef.current = foraDaCorrida;
  // A lista do servidor, para os chips existirem antes de a corrida começar.
  const [listaDeMotores, setListaDeMotores] = useState<ListaAprovada | null>(listaAprovada());

  /**
   * Os motores que a corrida pode incluir agora — o mesmo catálogo fundido que ela
   * usa, **do recurso escolhido**: a lista de nuvem aprovada é por recurso (ADR
   * 0048), e um catálogo fixo esconderia na Retrospectiva a variante que o servidor
   * aprovou só para ela.
   *
   * **E nada aqui passa por `motivoDeBloqueio`.** Aquele motivo diz quem pode
   * *escrever* num recurso — é por ele que o peso aberto só é escolhível na Saúde do
   * sono, que não grava. Medir não grava: na bancada o peso aberto corre em qualquer
   * leitura, e é justamente comparar o que ele escreveria que esta tela serve.
   */
  const motoresDaCorrida = useMemo(
    () => motoresDoRecurso(recurso, { sistema: ponte, coreai }, listaDeMotores),
    [recurso, ponte, coreai, listaDeMotores],
  );
  const alternarNaCorrida = useCallback((id: MotorId) => {
    setForaDaCorrida((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }, []);

  /**
   * Os três diagnósticos, relidos **ao ganhar o foco** — e não uma vez na montagem.
   *
   * A tela fica montada quando o dono empurra outra rota; voltar dela sem reler deixaria a
   * fileira de chips pintada com o que era verdade antes de ele ir aos Ajustes ligar a Apple
   * Intelligence, ou antes de o iOS purgar o cache do Core AI. Custa uma linha JSON por
   * modelo, ~0,5 ms cada.
   */
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void ponteDoAparelho.reconsultar().then((p) => {
        if (vivo) setPonte(p);
      });
      void reconsultarPesosAbertos().then((p) => {
        if (vivo) setCoreai(p);
      });
      void relerCompilacaoDosPesos().then((c) => {
        if (vivo) setCompilacao(c);
      });
      return () => {
        vivo = false;
      };
    }, []),
  );

  /**
   * A fileira "quem entra": um chip por motor conhecido da leitura, menos o template —
   * que é régua, não motor — e menos quem passa do teto de exposição do recurso.
   *
   * A regra inteira é pura e mora no núcleo da bancada (`amostras-regras.ts`), com teste:
   * ela é **a mesma** que o laço aplica antes de chamar cada motor. Duas perguntas
   * diferentes para o mesmo fato é como um chip marcado sobrevive a um compilado que sumiu.
   */
  const chips = useMemo(
    () => chipsDaCorrida(motoresDaCorrida, { regimeMaximo: fonte.regimeMaximo, fora: foraDaCorrida, compilacao }),
    [motoresDaCorrida, fonte, foraDaCorrida, compilacao],
  );
  /** Um motor consultando **não** conta: ele ainda não disse se existe. */
  const nenhumMotorNaCorrida = chips.every((c) => !c.marcado);

  /**
   * **Quem a amostra mediria se ele tocasse agora** — os mesmos chips, pelas mesmas regras.
   *
   * É uma prévia, e a corrida relê tudo antes de começar (e de novo na vez de cada motor):
   * o que se pinta aqui é para o dono saber quantas corridas está pedindo, não para decidir
   * a fila. Decidir por este valor traria de volta o defeito da fatia 4, com minutos no
   * lugar de segundos entre a pintura e o toque.
   */
  const amostraDeAgora = useMemo(
    () => filaDaAmostra(motoresDaCorrida, { regimeMaximo: fonte.regimeMaximo, fora: foraDaCorrida, compilacao }),
    [motoresDaCorrida, fonte, foraDaCorrida, compilacao],
  );
  const prontosParaAmostra = useMemo(
    () => amostraDeAgora.corridas.filter((c) => c.recusa === undefined).map((c) => c.motor),
    [amostraDeAgora],
  );
  const foraDaAmostra = amostraDeAgora.foraDaAmostra;
  /** A régua, quando a leitura tem uma — o chip que não é controle. */
  const regua = fonte.temRegua ? motoresDaCorrida.find((m) => m.id === SEM_MODELO) : undefined;

  const hoje = useMemo(() => localDateStr(), []);
  const today = useMemo(() => new Date(), []);
  const nights = useMemo(() => filterByRange(periods, range, today, offset), [periods, range, offset, today]);
  const entrada = useMemo(
    () => entradaDaSaude(periods, ratings, { range, offset, hoje }),
    [periods, ratings, range, offset, hoje],
  );

  const desde = entrada.janela.since;
  useEffect(() => {
    if (desde !== null) void carregarNotasDesde(desde);
  }, [desde, carregarNotasDesde]);

  /* ── o mundo que as fontes recebem ── */

  /**
   * A edição da **semana fechada anterior** (offset 1), pelo mesmo hook da revista:
   * é ele que garante a janela carregada e diz quando os dados chegaram. O relógio
   * fica fixo enquanto a tela vive — um `new Date()` a cada render daria uma entrada
   * nova por quadro, e com ela um caso novo, que apagaria as linhas medidas.
   *
   * Ele busca a janela da retro ao abrir a bancada, mesmo que o dono fique só na
   * Saúde do sono: hook não é condicional. Numa tela de desenvolvimento, uma consulta
   * a mais é mais barata que uma segunda máquina de carregamento escrita aqui.
   */
  const agora = useMemo(() => new Date(), []);
  // **Semana anterior é `-1`**, não `+1`: a convenção do `period/bounds.ts` é
  // "0 = corrente, −1 = anterior, +1 = seguinte". Com `1` a bancada pedia a semana
  // que VEM — que nunca está fechada, e `descritorDaRetrospectiva.montarPedido`
  // devolve nulo para período aberto. O sintoma era todo motor voltando `mudo`.
  const { entrada: entradaDaEdicao, dadosProntos } = useEntradaDaEdicao('week', OFFSET_DA_SEMANA_FECHADA, agora);

  const atividades = useActivitiesStore((st) => st._all);
  const atividadesCarregadas = useActivitiesStore((st) => st.loaded);
  const carregarAtividades = useActivitiesStore((st) => st.load);
  const userId = useAuthStore((st) => st.user?.id ?? null);
  useEffect(() => {
    if (!atividadesCarregadas) void carregarAtividades();
  }, [atividadesCarregadas, carregarAtividades]);

  // O traçado é carregado sob demanda e cacheado pela store: `loadRoute` sai cedo
  // quando já o tem, então a amostra do nome de rota custa uma consulta por pedalada
  // nova e nenhuma nas voltas seguintes.
  const pontosDe = useCallback(async (id: string) => {
    await useActivitiesStore.getState().loadRoute(id);
    return useActivitiesStore.getState().routes[id];
  }, []);

  const ctx = useMemo<ContextoDasAmostras>(
    () => ({
      saude: entrada,
      edicao: dadosProntos ? entradaDaEdicao : null,
      pedaladas: { userId, atividades, pontosDe },
    }),
    [entrada, dadosProntos, entradaDaEdicao, userId, atividades, pontosDe],
  );

  /* ── os casos da leitura escolhida ── */

  const [casos, setCasos] = useState<CasosDaAmostra>({ casos: [] });
  const [carregandoCasos, setCarregandoCasos] = useState(true);
  const [chaveDoCaso, setChaveDoCaso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregandoCasos(true);
    void (async () => {
      let achados: CasosDaAmostra;
      try {
        achados = await fonte.casos(ctx);
      } catch (e) {
        // A fonte promete não rejeitar; se rejeitar assim mesmo, a tela diz o motivo
        // em vez de ficar para sempre em "procurando".
        achados = { casos: [], motivo: `a amostra não se montou: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (!vivo) return;
      setCasos(achados);
      setCarregandoCasos(false);
    })();
    return () => {
      vivo = false;
    };
  }, [fonte, ctx]);

  /** O caso medido agora: o escolhido, ou o primeiro da lista. */
  const casoAtual = useMemo(() => {
    const lista = casos.casos;
    if (lista.length === 0) return null;
    return lista.find((c) => c.chave === chaveDoCaso) ?? lista[0]!;
  }, [casos, chaveDoCaso]);

  /**
   * O que está medido, identificado: **a leitura mais o caso**.
   *
   * Trocar qualquer um dos dois apaga as linhas. A regra já valia para a janela do
   * sono — comparar a frase de um motor numa janela com a de outro motor em outra é
   * o erro que esta tela existe para não cometer —, e com três leituras ela vale
   * inteira: comparar uma frase de sono com um caderno da revista é o mesmo erro,
   * maior.
   */
  const identidade = `${recurso}|${casoAtual?.chave ?? ''}`;
  useEffect(() => {
    setLinhas([]);
  }, [identidade]);

  // O laço compara a cada volta: ele leva ~14 s por motor, e nesse tempo o dono
  // troca de leitura ou de caso.
  const identidadeRef = useRef(identidade);
  identidadeRef.current = identidade;

  // As três chaves da corrida, todas em `ref` porque o laço roda por minutos e um
  // estado capturado no início não as veria mudar: uma corrida em voo (para o segundo
  // toque não largar a segunda), o "Parar" tocado e a tela fora de foco.
  const corridaEmVooRef = useRef(false);
  const pararCorridaRef = useRef(false);
  const foraDeFocoRef = useRef(false);
  /** Só para a tela dizer "parando…" — quem para o laço é o `ref`. */
  const [parandoCorrida, setParandoCorrida] = useState(false);
  /**
   * **Quantas chamadas "Parar" ainda impede** — e `null` enquanto a corrida não
   * abriu coluna nenhuma, que é quando ele impede tudo o que vier.
   *
   * É esta contagem, e não a existência da corrida, que decide se o botão aparece:
   * na última coluna ele não tem o que impedir, e um botão ali seria a promessa
   * que quebrou em 23/09.
   */
  const [porVir, setPorVir] = useState<number | null>(null);

  /**
   * Os motores conhecidos agora, com os três diagnósticos e a lista do servidor **relidos**.
   *
   * Uma função para as duas corridas (fatia 5): a comparação de uma janela a chama uma vez,
   * antes da fila; a amostra a chama no preparo **e na vez de cada motor**. É dela que sai a
   * garantia central da tela — não compilar nada —, e duas cópias dela envelheceriam em
   * separado. Numa corrida de 22 janelas a conta é outra: um peso aberto sem compilado
   * dispara 11 a 15 min de compilação já no primeiro item.
   *
   * Os três estados da tela são atualizados junto, para os chips não contarem uma história
   * diferente da que a corrida está seguindo.
   */
  const relerOsMotores = useCallback(async () => {
    const [lista, estadoDaPonte, estadoDoCoreAI, estadoDaCompilacao] = await Promise.all([
      garantirListaAprovada(),
      ponteDoAparelho.reconsultar(),
      reconsultarPesosAbertos(),
      relerCompilacaoDosPesos(),
    ]);
    setPonte(estadoDaPonte);
    setCoreai(estadoDoCoreAI);
    setCompilacao(estadoDaCompilacao);
    setListaDeMotores(lista);
    const conhecidos = motoresDoRecurso(recurso, { sistema: estadoDaPonte, coreai: estadoDoCoreAI }, lista);
    return {
      conhecidos,
      opcoes: { regimeMaximo: fonte.regimeMaximo, fora: foraRef.current, compilacao: estadoDaCompilacao },
    };
  }, [recurso, fonte]);

  const medir = useCallback(async () => {
    const caso = casoAtual;
    if (caso === null) return;
    // **Dois toques não largam duas corridas.** O `disabled` do `Pressable` só existe
    // depois de um render, e dois toques no mesmo quadro passam os dois: seriam duas
    // publicações incrementais pintando a mesma lista, e o dono lendo uma mistura de
    // duas composições sem saber que são duas. O `ref` fecha a porta no mesmo instante.
    if (corridaEmVooRef.current) return;
    corridaEmVooRef.current = true;
    pararCorridaRef.current = false;
    setParandoCorrida(false);
    // Nenhuma coluna aberta ainda: neste instante "Parar" impede a corrida inteira.
    setPorVir(null);
    const doLaco = `${recurso}|${caso.chave}`;
    setRodando(SEM_MODELO);
    const feitas: Linha[] = [];
    try {
      // A lista do servidor antes do laço (5.6): uma variante nomeada que o dono
      // pode **escolher** no seletor tem de ser mensurável aqui, senão a tela que
      // existe para comparar motores esconde justamente o motor novo.
      // E a ponte do aparelho (5.9): com o módulo no build, o aparelho é medido aqui
      // ao lado da nuvem, com o texto cru dele — é a comparação que o dono pediu.
      //
      // **E a compilação de cada peso aberto** (fatia 4). Os chips foram pintados uma
      // vez e a verdade não fica parada: entre marcar um peso aberto e tocar Medir
      // podem passar minutos, e nesse intervalo o iOS pode ter purgado o cache do Core
      // AI. Sem esta releitura, o toque em Medir manda compilar — quinze minutos
      // disparados pela única porta desta família que diz, por escrito, que não compila
      // nada. É a primeira instrução do botão de propósito.
      //
      // A releitura é a **mesma** das corridas da amostra (`relerOsMotores`): duas
      // cópias dela envelheceriam em separado, e é dela que sai a garantia de não
      // compilar.
      const { conhecidos, opcoes } = await relerOsMotores();
      if (foraDeFocoRef.current || identidadeRef.current !== doLaco) return;
      // **A fila inteira antes da primeira coluna.** Os filtros eram aplicados um a
      // um dentro do laço, e por isso ninguém — nem o laço — sabia quantas colunas
      // ainda viriam. Sem esse número o "Parar" não tem como dizer a verdade: em
      // 23/09 ele apareceu numa corrida cuja única coluna já estava em voo e
      // prometeu uma interrupção que não existia. As regras são as mesmas e estão
      // agora num lugar só, puro e testado.
      const fila = filaDaCorrida(conhecidos, opcoes);
      for (let i = 0; i < fila.length; i++) {
        const coluna = fila[i]!;
        // **Abandona o que é de outro caso.** O efeito de limpeza apaga as linhas
        // quando a leitura ou o caso mudam, mas o laço já capturou os dois e
        // continuaria pintando medições do caso velho sob o cabeçalho novo — que é
        // exatamente o erro que esta tela existe para não cometer.
        //
        // **E abandona quem saiu da tela**: a mesma regra da compilação. A coluna em
        // voo termina sozinha e não publica — repintar uma rota que o dono já trocou
        // não é resultado, é ruído.
        if (identidadeRef.current !== doLaco || foraDeFocoRef.current) return;
        // "Parar" é o controle que existe para isto. A coluna em voo já publicou —
        // descartar uma medição que aconteceu (e, na nuvem, que foi paga) seria jogar
        // fora justamente o que a corrida veio buscar.
        if (pararCorridaRef.current) break;
        // A coluna que não aconteceu: quem perdeu o pé entre o chip e o toque em
        // Medir vira uma linha com o motivo. Não é um erro — é uma medição que não
        // houve, e ela vale tanto quanto uma que houve.
        if (coluna.recusa !== undefined) {
          feitas.push({ motor: coluna.motor, desfecho: 'fora', ms: 0, motivo: coluna.recusa });
          setLinhas([...feitas]);
          continue;
        }
        setRodando(coluna.motor);
        // O que "Parar" ainda impediria, agora: é o que decide se ele se oferece.
        setPorVir(colunasPorVir(fila, i));
        // O teto de espera: um motor que não devolve nem resposta nem erro deixaria o
        // botão `busy` para sempre, e a tela inteira refém de uma coluna.
        const linha = await comTeto(
          () => fonte.medir(caso, coluna.motor),
          tetoDaCorridaMs(coluna.motor, PRAZOS_DA_CORRIDA),
          coluna.motor,
        );
        if (identidadeRef.current !== doLaco || foraDeFocoRef.current) return;
        feitas.push(linha);
        // Publica a cada motor: a nuvem leva ~14 s na mediana, e esperar todas as
        // colunas para mostrar a primeira deixaria a tela vazia por meio minuto.
        setLinhas([...feitas]);
      }
    } finally {
      setRodando(null);
      setParandoCorrida(false);
      setPorVir(null);
      corridaEmVooRef.current = false;
    }
  }, [fonte, recurso, casoAtual]);

  /**
   * "Parar": a coluna em voo termina e publica; **a próxima não abre**.
   *
   * O que ele muda é o futuro da corrida, e só. Uma chamada em andamento não se
   * cancela — a da nuvem já foi paga, a do aparelho não tem cancelamento nenhum —,
   * e jogar fora uma medição que aconteceu seria descartar o que a corrida veio
   * buscar. Por isso o botão só existe enquanto há próxima coluna, e por isso ele
   * fica na tela depois do toque, dizendo o que está mesmo acontecendo.
   */
  const pararCorrida = useCallback(() => {
    pararCorridaRef.current = true;
    setParandoCorrida(true);
  }, []);

  /**
   * **"Parar" tem o que impedir?** `null` é "a corrida ainda não abriu coluna", e aí
   * ele impede tudo. Zero é a última coluna: ali o botão não pode se oferecer.
   */
  const pararImpedeAlgo = porVir === null || porVir > 0;

  const template = linhas.find((l) => l.motor === SEM_MODELO)?.frase;

  /* ── a amostra (story 5.13) ── */

  const [limite, setLimite] = useState<number>(LIMITE_DA_AMOSTRA);
  const [amostra, setAmostra] = useState<EstadoDaAmostra>({ fase: 'parada' });
  const pararRef = useRef(false);
  const amostraEmCurso = amostra.fase === 'preparando' || amostra.fase === 'medindo';

  /**
   * **Perder o foco para as duas corridas**, e não só desmontar: empurrar outra rota deixa
   * esta tela montada, e sem isto os laços seguiriam medindo — com a tela acesa — atrás de
   * uma tela que o dono já trocou. O que está em voo termina sozinho; o próximo não abre.
   *
   * A da amostra guarda o que já mediu (ela publica por janela); a comparação **não
   * publica** a coluna em voo, porque ela repintaria uma lista que ninguém está vendo.
   */
  const [focada, setFocada] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocada(true);
      foraDeFocoRef.current = false;
      return () => {
        setFocada(false);
        foraDeFocoRef.current = true;
        pararRef.current = true;
      };
    }, []),
  );

  // O relógio da corrida: um tique por segundo, só enquanto mede, para o decorrido andar.
  // O valor não é lido — quem lê a hora é o `Progresso`; o tique só repinta (o mesmo
  // arranjo do `Anel`, logo abaixo).
  const [, setTique] = useState(0);
  useEffect(() => {
    if (amostra.fase !== 'medindo') return undefined;
    const t = setInterval(() => setTique((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [amostra.fase]);

  const medirAmostra = useCallback(async () => {
    pararRef.current = false;
    setAmostra({ fase: 'preparando', etapa: 'motores' });
    const preparo = await prepararAmostra({
      hoje: localDateStr(),
      limite,
      estado: () => useSonoStore.getState(),
      carregarNotasDesde: (dia) => useSonoStore.getState().carregarNotasDesde(dia),
      motores: async () => {
        const { conhecidos, opcoes } = await relerOsMotores();
        return filaDaAmostra(conhecidos, opcoes).corridas;
      },
      cancelado: () => pararRef.current,
      aoAndar: (etapa) => setAmostra((a) => (a.fase === 'preparando' ? { ...a, etapa } : a)),
      // O respiro deixa a tela pintar a etapa antes da enumeração, que é síncrona e longa.
      respirar: () => new Promise((r) => setTimeout(r, 16)),
    });
    if (!preparo.ok) {
      return setAmostra(preparo.motivo === null ? { fase: 'parada' } : { fase: 'recusada', motivo: preparo.motivo });
    }

    const { janelas, dados, contexto, fila } = preparo;
    const inicio = Date.now();
    setAmostra({ fase: 'medindo', contexto, fila, feitas: [], emCurso: null, parando: false, inicio });
    // Uma corrida por motor, em sequência; dentro de cada uma, uma janela por vez com
    // freio próprio — três seguidas que não chegam ao modelo param **aquela** corrida, e a
    // seguinte ainda tenta. Uma hora de tela acesa sem medir nada não é medição.
    const feitas = await medirCorridas({
      fila,
      janelas,
      conferir: async (motor) => {
        const { conhecidos, opcoes } = await relerOsMotores();
        return recusaDoMotorAgora(conhecidos, opcoes, motor);
      },
      medir: (j, motor) => medirJanela(j, dados, contexto.hoje, motor),
      parar: () => pararRef.current,
      aoAbrirCorrida: (motor) =>
        setAmostra((a) => (a.fase === 'medindo' ? { ...a, emCurso: { motor, linhas: [], emVoo: null, inicio: Date.now() } } : a)),
      aoAbrirJanela: (j) =>
        setAmostra((a) => (a.fase === 'medindo' && a.emCurso !== null ? { ...a, emCurso: { ...a.emCurso, emVoo: j } } : a)),
      aoMedir: (l) =>
        setAmostra((a) => (a.fase === 'medindo' && a.emCurso !== null ? { ...a, emCurso: { ...a.emCurso, linhas: l } } : a)),
      // Publica corrida a corrida: com dois modelos a segunda leva minutos, e esperar o
      // fim de tudo deixaria a primeira medida escondida por todo esse tempo.
      aoFechar: (c) =>
        setAmostra((a) => (a.fase === 'medindo' ? { ...a, feitas: [...a.feitas, c], emCurso: null } : a)),
    });
    // **O que já foi medido nunca vira recusa**: mesmo com defeito ou freio, cada corrida
    // termina com as linhas e o motivo à vista.
    setAmostra({ fase: 'pronta', contexto, corridas: feitas, inicio, fim: Date.now() });
  }, [limite, relerOsMotores]);

  const pedirParada = useCallback(() => {
    pararRef.current = true;
    setAmostra((a) => (a.fase === 'medindo' ? { ...a, parando: true } : a.fase === 'preparando' ? { ...a, cancelando: true } : a));
  }, []);

  /**
   * **Por que Medir está inerte** — ou `null`, quando ele não está.
   *
   * A causa é uma só, e ela é escrita ao lado do botão **e** dentro do rótulo acessível:
   * um botão apagado sem motivo audível não diz nada a quem usa VoiceOver, e um botão
   * apagado sem motivo visível não diz nada a quem enxerga. A ordem é a da pergunta que o
   * dono faria primeiro: "tem caso?" antes de "tem motor?".
   */
  const causaDoMedirInerte: string | null = carregandoCasos
    ? 'ainda procurando os casos desta leitura'
    : casoAtual === null
      ? (casos.motivo ?? 'nenhum caso a medir nesta leitura')
      : amostraEmCurso
        ? 'a amostra está medindo — uma corrida por vez'
        : nenhumMotorNaCorrida
          ? 'nenhum motor marcado'
          : null;
  const medirInerte = causaDoMedirInerte !== null || rodando !== null;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader titulo="Bancada" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.rotulo}>leitura</Text>
          <View style={s.chips}>
            {FONTES.map((f) => {
              const escolhida = f.recurso === recurso;
              return (
                <Pressable
                  key={f.recurso}
                  onPress={() => {
                    setRecurso(f.recurso);
                    // O caso escolhido é de outra leitura: sem isto, a chave sobreviveria
                    // à troca e a primeira volta poderia cair num caso que não existe mais.
                    setChaveDoCaso(null);
                  }}
                  disabled={rodando !== null || amostraEmCurso}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: escolhida, disabled: rodando !== null || amostraEmCurso }}
                  style={({ pressed }) => [s.chip, escolhida ? s.chipDentro : s.chipFora, pressed && s.pressed]}
                >
                  <Text style={escolhida ? s.chipTextoDentro : s.chipTexto}>{f.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>

          {fonte.seletor === 'janela-de-sono' ? (
            <PeriodNav
              range={range}
              offset={offset}
              periods={periods}
              nights={nights}
              onRange={(r) => {
                setRange(r);
                setOffset(0);
              }}
              onOffset={setOffset}
            />
          ) : (
            <>
              <Text style={s.rotulo}>caso</Text>
              <View style={s.chips}>
                {casos.casos.map((c) => {
                  const escolhido = c.chave === casoAtual?.chave;
                  return (
                    <Pressable
                      key={c.chave}
                      onPress={() => setChaveDoCaso(c.chave)}
                      disabled={rodando !== null || amostraEmCurso}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: escolhido, disabled: rodando !== null || amostraEmCurso }}
                      style={({ pressed }) => [s.chip, escolhido ? s.chipDentro : s.chipFora, pressed && s.pressed]}
                    >
                      <Text style={escolhido ? s.chipTextoDentro : s.chipTexto}>{c.rotulo}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {/* O motivo de não haver caso não é escrito aqui: ele é **a causa do botão inerte**,
              e é lá embaixo, ao lado do Medir, que ele responde à pergunta que o dono faz.
              Escrevê-lo nos dois lugares diria a mesma frase duas vezes na mesma tela. */}
          {casoAtual !== null ? <Text style={s.meta}>caso: {casoAtual.rotulo}</Text> : null}

          <Text style={s.rotulo}>quem entra</Text>
          <View style={s.chips}>
            {/* A régua **só onde há régua**: nas outras duas leituras o `semModelo` devolve
                uma lápide, e um chip escrito "· régua" ali prometeria uma coluna que o
                cartão logo abaixo explica que não vai existir. Ela não é controle — o
                tracejado diz isso sem gastar uma palavra —, então é `View`, não `Pressable`. */}
            {regua !== undefined ? (
              <View style={[s.chip, s.chipRegua]}>
                <Text style={s.chipTextoRegua}>{regua.rotulo} · régua</Text>
              </View>
            ) : null}
            {chips.map((c) => (
              <ChipDoMotor
                key={c.id}
                chip={c}
                travadoPelaCorrida={rodando !== null || amostraEmCurso}
                aoAlternar={alternarNaCorrida}
                s={s}
              />
            ))}
          </View>
          {nenhumMotorNaCorrida ? (
            <Text style={s.aviso}>
              {regua === undefined
                ? 'Nenhum motor marcado — ligue ao menos um para a corrida medir algo.'
                : 'Só a régua está marcada — ligue ao menos um motor para a corrida medir algo.'}
            </Text>
          ) : null}
          <Text style={s.aviso}>
            A corrida não compila nada: um peso aberto que não esteja compilado fica travado e não
            entra. E ela relê o diagnóstico e o compilado antes de começar — quem perdeu o pé no
            meio sai com o motivo, em vez de virar uma chamada de minutos.
          </Text>
          {/* Uma fileira para as duas corridas da tela (fatia 5): a de uma janela, logo
              abaixo, e a da amostra inteira, no cartão do fim. Um segundo seletor lá seria a
              maneira de os dois botões discordarem sobre quem está marcado. */}
          <Text style={s.aviso}>
            Estes chips valem para as duas medições: a comparação de uma janela e a amostra de N
            janelas. Lá, cada motor marcado vira uma corrida própria, em sequência.
          </Text>

          <View style={s.linhaDoBotao}>
            <Pressable
              onPress={() => void medir()}
              disabled={medirInerte}
              accessibilityRole="button"
              accessibilityLabel={
                rodando !== null
                  ? `Medir — medindo ${nomeDoMotor(rodando)}`
                  : causaDoMedirInerte !== null
                    ? `Medir — ${causaDoMedirInerte}`
                    : 'Medir todos os motores neste caso'
              }
              accessibilityState={medirInerte ? { disabled: true, busy: rodando !== null } : {}}
              style={({ pressed }) => [s.botao, s.botaoLargo, medirInerte && s.botaoOff, pressed && s.pressed]}
            >
              {rodando !== null ? <ActivityIndicator size="small" color={colors.onPrimary} /> : null}
              <Text style={s.botaoTexto}>
                {rodando === null ? 'Medir os motores' : `medindo ${nomeDoMotor(rodando)}…`}
              </Text>
            </Pressable>
            {/* Parar é o controle que existe para impedir as **próximas** colunas: o próprio
                Medir fica inerte enquanto corre, senão um segundo toque largaria uma segunda
                corrida sobre a mesma lista.

                **Ele só aparece quando tem o que impedir** (23/09). Antes, bastava haver
                corrida: com um motor marcado, o dono tocava Parar sobre a única coluna em voo
                e a medição ia até o fim e publicava — o botão estava certo e a promessa,
                errada. Na última coluna não há botão, há a frase que diz por quê.

                **E ele não some depois do toque.** Quem tocou precisa ver o que está
                acontecendo, não um vazio que parece "já parou": enquanto `parandoCorrida`, ele
                fica na tela com o rótulo do que está de fato em curso, mesmo que a contagem já
                tenha chegado a zero. O rótulo acessível diz a mesma coisa que o visível. */}
            {rodando !== null && (pararImpedeAlgo || parandoCorrida) ? (
              <Pressable
                onPress={pararCorrida}
                disabled={parandoCorrida}
                accessibilityRole="button"
                accessibilityLabel={
                  parandoCorrida
                    ? 'Parando — a coluna em voo termina e publica'
                    : 'Parar a corrida — impede as próximas colunas; a que está em voo termina e publica'
                }
                accessibilityState={parandoCorrida ? { disabled: true } : {}}
                style={({ pressed }) => [s.botaoSuave, parandoCorrida && s.botaoOff, pressed && s.pressed]}
              >
                <Text style={s.botaoSuaveTexto}>
                  {parandoCorrida ? 'parando — a coluna em voo termina' : 'Parar'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {/* Onde o botão não está, o fato. Uma tela que só some com o controle deixa o dono
              procurando o que não existe mais. */}
          {rodando !== null && !pararImpedeAlgo && !parandoCorrida ? (
            <Text style={s.meta}>última coluna — parar não teria o que impedir</Text>
          ) : null}
          <Text style={s.aviso}>
            Parar impede as próximas colunas — a que está em voo termina e publica.
          </Text>
          {/* A causa ao lado do botão, e não num alerta: ela é a resposta à única pergunta
              que um botão apagado levanta. */}
          {rodando === null && causaDoMedirInerte !== null ? (
            <Text style={s.motivo}>Medir está inerte: {causaDoMedirInerte}.</Text>
          ) : null}
          {/* O "parando…" que morava aqui foi para dentro do próprio botão: a mesma frase em
              dois lugares da mesma tela é uma delas envelhecendo sozinha. */}
          <Text style={s.aviso}>
            Modo medição: um motor por vez, sem recuo e sem piso. A frase do template é a régua. O
            texto cru só aparece aqui, e nada disto sai do aparelho.
          </Text>
          <Text style={s.aviso}>
            Medir não grava — por isso o peso aberto corre em qualquer leitura aqui, inclusive nas
            que o seletor lhe fecha. Lá o bloqueio diz quem pode escrever; escrever é outra coisa.
          </Text>
          <Text style={s.rotulo}>diagnóstico da ponte</Text>
          <Text style={s.meta}>{diagnosticoCru(ponte)}</Text>
          {PESOS_ABERTOS.map((p) => (
            <View key={p.pesos}>
              <Text style={s.rotulo}>diagnóstico de {p.pesos}</Text>
              <Text style={s.meta}>{diagnosticoCru(coreai[p.pesos] ?? PONTE_AUSENTE)}</Text>
            </View>
          ))}
        </View>

        {linhas.map((l) => (
          <BlocoDoMotor key={l.motor} linha={l} template={template} s={s} />
        ))}

        {/* A corrida de N janelas da 5.13 é **da Saúde do sono**: a enumeração, a régua e as
            quatro medidas da ADR 0050 são daquela leitura. Quem diz isso é a **fonte**, e não
            um `recurso === 'saude-do-sono'` escrito aqui: os chips de amostra ("22 janelas",
            "o ano") só existem onde há mais de uma janela, e numa leitura sem série anual eles
            seriam botões que não têm o que abrir. Escondida nas outras em vez de deixada à
            vista medindo outra coisa — um cartão que mentisse aqui mentiria sobre o único
            número que fixou um limiar. */}
        {fonte.variasJanelas ? (
          <>
            <CartaoDaAmostra
              estado={amostra}
              limite={limite}
              aoEscolherLimite={setLimite}
              prontos={prontosParaAmostra}
              foraDaAmostra={foraDaAmostra}
              ocupado={rodando !== null}
              aoMedir={() => void medirAmostra()}
              aoParar={pedirParada}
              s={s}
            />
            {amostraEmCurso && focada ? <TelaAcesa /> : null}
          </>
        ) : null}

        <Anel s={s} />
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Um chip de "quem entra", nas quatro formas.
 *
 * **Consultando não é indisponível**, e é a forma nova desta fatia: o diagnóstico ainda
 * está a caminho, então o chip não responde ao toque, é anunciado **ocupado** (não como um
 * motor que não existe) e não conta como marcado. Travado carrega o motivo dentro do
 * próprio rótulo, porque um chip não tem linha de baixo onde pôr explicação — e por isso
 * os 36 pt do alvo são **mínimo**: com Texto grande o chip cresce e quebra em duas linhas,
 * e é justamente o motivo que uma altura fixa cortaria primeiro.
 *
 * As duas formas sem toque são `View`, e não `Pressable` desabilitado: um controle que não
 * é controle não deve nem registrar o toque.
 */
function ChipDoMotor({
  chip,
  travadoPelaCorrida,
  aoAlternar,
  s,
}: {
  chip: ChipDaCorrida;
  /** A corrida (ou a amostra) está medindo: trocar a composição no meio a tornaria incomparável consigo mesma. */
  travadoPelaCorrida: boolean;
  aoAlternar: (id: MotorId) => void;
  s: Styles;
}) {
  if (chip.forma === 'consultando' || chip.forma === 'travado') {
    const consultando = chip.forma === 'consultando';
    return (
      <View
        accessible
        accessibilityRole="switch"
        accessibilityLabel={`${chip.rotulo} na corrida`}
        accessibilityState={{ checked: false, disabled: true, busy: consultando }}
        style={[s.chip, s.chipFora, consultando ? s.chipConsultando : s.chipTravado]}
      >
        <Text style={s.chipTexto}>{chip.rotulo}</Text>
      </View>
    );
  }
  const dentro = chip.forma === 'dentro';
  return (
    <Pressable
      onPress={() => aoAlternar(chip.id)}
      disabled={travadoPelaCorrida}
      accessibilityRole="switch"
      accessibilityLabel={`${chip.rotulo} na corrida`}
      accessibilityState={{ checked: dentro, disabled: travadoPelaCorrida }}
      style={({ pressed }) => [s.chip, dentro ? s.chipDentro : s.chipFora, pressed && s.pressed]}
    >
      <Text style={dentro ? s.chipTextoDentro : s.chipTexto}>{chip.rotulo}</Text>
    </Pressable>
  );
}

function BlocoDoMotor({ linha, template, s }: { linha: Linha; template?: string; s: Styles }) {
  const daRegua = linha.motor === SEM_MODELO;
  // **A coluna que não aconteceu.** Um motor que perdeu o pé na releitura não tem tempo,
  // não tem frase e não tem régua ao lado: mostrar o cabeçalho de uma medição para ele
  // sugeriria que houve chamada. O cartão é apagado, e o que resta é o fato.
  if (linha.desfecho === 'fora') {
    return (
      <View style={[s.card, s.cardFora]}>
        <Text style={s.motor}>{linha.motor}</Text>
        <Text style={s.motivo}>fora: {linha.motivo}</Text>
      </View>
    );
  }
  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.motor}>{linha.motor}</Text>
        <Text style={s.desfecho}>
          {linha.desfecho}
          {linha.ms > 0 ? ` · ${(linha.ms / 1000).toFixed(1)} s` : ''}
        </Text>
      </View>

      {/* A régua ao lado do motor, na mesma janela. No bloco do próprio template
          ela não se repete. */}
      {!daRegua && template !== undefined ? (
        <>
          <Text style={s.rotulo}>template</Text>
          <Text style={s.fraseFraca}>{template}</Text>
        </>
      ) : null}

      {linha.frase !== undefined ? (
        <>
          {!daRegua ? <Text style={s.rotulo}>motor</Text> : null}
          <Text style={s.frase}>{linha.frase}</Text>
        </>
      ) : null}
      {linha.motivo ? <Text style={s.motivo}>{linha.motivo}</Text> : null}

      {linha.cru !== undefined && linha.cru !== linha.frase ? (
        <>
          <Text style={s.rotulo}>texto cru</Text>
          <Text style={s.cru}>{linha.cru}</Text>
        </>
      ) : null}

      {linha.modelo !== undefined ? (
        <Text style={s.meta}>
          assinado por {linha.provedor} · modelo {linha.modelo}
          {linha.tokens ? ` · ${linha.tokens.entrada}→${linha.tokens.saida} tokens` : ''}
        </Text>
      ) : null}
      {linha.hash !== undefined ? <Text style={s.meta}>hash {linha.hash.slice(0, 12)}</Text> : null}
      {linha.detalhe !== undefined ? <Text style={s.meta}>{linha.detalhe}</Text> : null}

      {linha.problemas?.map((p, i) => (
        <Text key={`${p.regra}-${i}`} style={s.problema}>
          {p.regra}: {p.detalhe}
        </Text>
      ))}
    </View>
  );
}

/* ── a amostra (story 5.13) ──────────────────────────────────────────────── */

/** A corrida que está no aparelho agora — a única que publica por janela. */
interface CorridaEmCurso {
  readonly motor: MotorId;
  readonly linhas: readonly LinhaDoRelatorio[];
  /** A janela que está no motor agora. */
  readonly emVoo: JanelaClassificada | null;
  readonly inicio: number;
}

type EstadoDaAmostra =
  | { readonly fase: 'parada' }
  | { readonly fase: 'preparando'; readonly etapa: EtapaDoPreparo; readonly cancelando?: true }
  | { readonly fase: 'recusada'; readonly motivo: string }
  | {
      readonly fase: 'medindo';
      readonly contexto: ContextoDaAmostra;
      /** A fila inteira, decidida antes da primeira corrida: é ela que diz "1 de 2". */
      readonly fila: readonly ColunaDaCorrida[];
      readonly feitas: readonly CorridaMedida[];
      readonly emCurso: CorridaEmCurso | null;
      /** "Parar" foi tocado: a janela em voo termina, e nem a próxima nem o próximo motor abrem. */
      readonly parando: boolean;
      readonly inicio: number;
    }
  | {
      readonly fase: 'pronta';
      readonly contexto: ContextoDaAmostra;
      readonly corridas: readonly CorridaMedida[];
      readonly inicio: number;
      readonly fim: number;
    };

/** As escolhas do `--limite` do Mac: a amostra dele (padrão) e a validação. */
const LIMITES = [
  { limite: LIMITE_DA_AMOSTRA, rotulo: 'a do Mac (~22 janelas)' },
  { limite: 6, rotulo: 'a validação (~61)' },
] as const;

/**
 * A tela acesa enquanto mede: com ela apagada, o iOS suspende o app e o modelo em segundo
 * plano cai por taxa. Montado só durante a medição **e com a tela em foco** — desmontar
 * solta a trava.
 */
function TelaAcesa() {
  useKeepAwake('orbe-bancada-amostra');
  return null;
}

function CartaoDaAmostra({
  estado,
  limite,
  aoEscolherLimite,
  prontos,
  foraDaAmostra,
  ocupado,
  aoMedir,
  aoParar,
  s,
}: {
  estado: EstadoDaAmostra;
  limite: number;
  aoEscolherLimite: (n: number) => void;
  /** Quem correria se ele tocasse agora — pelos mesmos chips de "quem entra". */
  prontos: readonly MotorId[];
  /** Marcados que esta corrida não mede — ver `SO_O_APARELHO_MEDE_A_AMOSTRA`. */
  foraDaAmostra: readonly MotorId[];
  /** A comparação por janela está rodando: as duas medições não dividem a fila. */
  ocupado: boolean;
  aoMedir: () => void;
  aoParar: () => void;
  s: Styles;
}) {
  const emCurso = estado.fase === 'preparando' || estado.fase === 'medindo';
  // Sem motor do aparelho marcado não há corrida: o botão fica inerte, e a linha de plano
  // logo abaixo diz o porquê — um botão apagado sozinho não explica nada.
  const desligado = emCurso || ocupado || prontos.length === 0;
  const nomes = prontos.map(nomeDoMotor);
  const parando = estado.fase === 'medindo' ? estado.parando : estado.fase === 'preparando' ? estado.cancelando === true : false;
  return (
    <>
      <View style={s.card}>
        <Text style={s.motor}>A amostra, motor a motor</Text>
        <Text style={s.aviso}>
          Os motores marcados acima, em modo medição, sobre a mesma amostra de janelas da bancada do Mac e com a
          mesma régua — o template de cada janela. Uma corrida por motor, em sequência; dentro dela, uma janela por
          vez. A tela fica acesa enquanto mede, e nada sai do aparelho.
        </Text>
        <Text style={s.aviso}>{SO_O_APARELHO_MEDE_A_AMOSTRA}</Text>
        {foraDaAmostra.length > 0 ? (
          <Text style={s.motivo}>
            fora desta corrida, marcado{foraDaAmostra.length > 1 ? 's' : ''} acima:{' '}
            {foraDaAmostra.map(nomeDoMotor).join(', ')} — a comparação de uma janela continua medindo.
          </Text>
        ) : null}

        <Text style={s.rotulo}>janelas por caso × alcance</Text>
        <View style={s.acoesDoAnel}>
          {LIMITES.map((l) => {
            const escolhido = l.limite === limite;
            return (
              <Pressable
                key={l.limite}
                onPress={() => aoEscolherLimite(l.limite)}
                disabled={emCurso}
                accessibilityRole="radio"
                accessibilityState={{ selected: escolhido, disabled: emCurso }}
                style={({ pressed }) => [s.acao, pressed && s.pressed]}
              >
                <Text style={s.acaoTexto}>
                  {escolhido ? '● ' : '○ '}
                  {l.limite} · {l.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {emCurso ? (
          /* Sair também do preparo (item 5 da revisão): a enumeração é longa, e ficar
             preso a ela sem saída é o oposto de uma tela de medição. */
          <Pressable
            onPress={aoParar}
            disabled={parando}
            accessibilityRole="button"
            accessibilityLabel={
              estado.fase === 'medindo'
                ? 'Parar a amostra — a janela em voo termina, e nem a próxima nem os motores seguintes abrem'
                : 'Cancelar o preparo da amostra'
            }
            style={({ pressed }) => [s.botao, parando && s.botaoOff, pressed && s.pressed]}
          >
            <ActivityIndicator size="small" color={colors.onPrimary} />
            <Text style={s.botaoTexto}>
              {estado.fase === 'preparando'
                ? parando
                  ? 'cancelando…'
                  : 'cancelar'
                : parando
                  ? 'parando — a janela em voo termina sozinha'
                  : `parar · motor ${Math.min(estado.feitas.length + 1, estado.fila.length)} de ${estado.fila.length} · ${
                      estado.emCurso?.linhas.length ?? 0
                    } de ${estado.contexto.janelas}`}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={aoMedir}
            disabled={desligado}
            accessibilityRole="button"
            accessibilityLabel={
              prontos.length === 0
                ? 'Medir a amostra — nenhum motor do aparelho pronto'
                : `Medir a amostra em ${nomes.join(', ')}`
            }
            accessibilityState={desligado ? { disabled: true, busy: false } : {}}
            style={({ pressed }) => [s.botao, desligado && s.botaoOff, pressed && s.pressed]}
          >
            <Text style={s.botaoTexto}>Medir a amostra</Text>
          </Pressable>
        )}

        {/* O que o toque vai fazer, **antes** dele: com dois modelos marcados são duas
            corridas de minutos cada, e isso tem de aparecer antes da espera. */}
        {!emCurso ? <Text style={s.meta}>{planoDaAmostra(nomes)}</Text> : null}
        {estado.fase === 'preparando' ? <Text style={s.meta}>{ETAPA_EM_PALAVRAS[estado.etapa]}</Text> : null}
        {estado.fase === 'recusada' ? <Text style={s.motivo}>{estado.motivo}</Text> : null}
        {estado.fase === 'medindo' ? <Progresso estado={estado} s={s} /> : null}
      </View>

      {estado.fase === 'medindo' || estado.fase === 'pronta' ? <ResultadoDaAmostra estado={estado} s={s} /> : null}
    </>
  );
}

/**
 * O andamento: **qual motor** está correndo, qual janela está nele, quanto já levou e uma
 * previsão grosseira do que falta — a mediana do que já foi medido vezes as janelas
 * restantes. Com limite 6 a corrida passa de dez minutos, e isso tem de aparecer antes da
 * espera, não depois.
 *
 * A previsão é **da corrida em curso**, não da sessão: os motores têm tempos por janela
 * diferentes (medidos em 22/09: 9,8 s no Qwen3, 7,1 s no Tucano2), e somar os dois numa
 * previsão só produziria um número que não vale para nenhum dos dois.
 */
function Progresso({
  estado,
  s,
}: {
  estado: Extract<EstadoDaAmostra, { fase: 'medindo' }>;
  s: Styles;
}) {
  const linhas = estado.emCurso?.linhas ?? [];
  const restantes = Math.max(0, estado.contexto.janelas - linhas.length);
  const { medianaMs, restanteMs } = previsaoDaAmostra(linhas, restantes);
  const emVoo = estado.emCurso?.emVoo ?? null;
  return (
    <>
      {estado.emCurso !== null ? (
        <Text style={s.meta}>
          medindo {nomeDoMotor(estado.emCurso.motor)} — motor {Math.min(estado.feitas.length + 1, estado.fila.length)} de{' '}
          {estado.fila.length}
        </Text>
      ) : null}
      {emVoo !== null ? (
        <Text style={s.meta}>
          no motor: {chaveDoPasso(emVoo)} · {emVoo.caso} · {emVoo.alcance}
        </Text>
      ) : null}
      <Text style={s.meta}>
        decorrido {duracaoCurta(Date.now() - estado.inicio)}
        {restanteMs !== null && restantes > 0
          ? ` · faltam ~${duracaoCurta(restanteMs)} neste motor (mediana ${segundos(medianaMs)} × ${restantes})`
          : ''}
      </Text>
    </>
  );
}

/**
 * O resultado da sessão: **o que foi usado uma vez**, a comparação lado a lado e um cartão
 * por corrida.
 *
 * O contexto sai do cartão de cada motor e sobe para cá de propósito: ele é o mesmo para
 * todas as corridas — a amostra é preparada uma vez — e repeti-lo por motor sugeriria o
 * contrário, que é exatamente a dúvida que a comparação por taxa não pode ter.
 */
function ResultadoDaAmostra({
  estado,
  s,
}: {
  estado: Extract<EstadoDaAmostra, { fase: 'medindo' | 'pronta' }>;
  s: Styles;
}) {
  const feitas = estado.fase === 'medindo' ? estado.feitas : estado.corridas;
  const emCurso = estado.fase === 'medindo' ? estado.emCurso : null;
  return (
    <>
      <OQueFoiUsado
        contexto={estado.contexto}
        situacao={
          estado.fase === 'medindo'
            ? `medindo — ${feitas.length} de ${estado.fila.length} motores`
            : `${feitas.length} ${feitas.length === 1 ? 'corrida' : 'corridas'} em ${duracaoCurta(estado.fim - estado.inicio)}`
        }
        s={s}
      />
      {feitas.length > 1 ? <LadoALado corridas={feitas} emCurso={emCurso !== null} s={s} /> : null}
      {feitas.map((c) => (
        <ResultadoDaCorrida key={c.motor} corrida={c} contexto={estado.contexto} s={s} />
      ))}
      {emCurso !== null ? (
        <ResultadoDaCorrida
          corrida={{ motor: emCurso.motor, linhas: emCurso.linhas, parcial: true, inicio: emCurso.inicio, fim: Date.now() }}
          contexto={estado.contexto}
          emAndamento
          s={s}
        />
      ) : null}
    </>
  );
}

/** O acervo, a regra da amostra e as janelas — o mesmo para todas as corridas da sessão. */
function OQueFoiUsado({
  contexto: c,
  situacao,
  s,
}: {
  contexto: ContextoDaAmostra;
  situacao: string;
  s: Styles;
}) {
  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.motor}>o que foi usado</Text>
        <Text style={s.desfecho}>{situacao}</Text>
      </View>
      <Text style={s.meta} selectable>
        hoje {c.hoje} · limite {c.limite} por caso × alcance
      </Text>
      <Text style={s.meta} selectable>
        amostra: {REGRA_DA_AMOSTRA.descricao} ({REGRA_DA_AMOSTRA.id} v{REGRA_DA_AMOSTRA.versao})
      </Text>
      <Text style={s.meta} selectable>
        acervo: {c.noites} noites desde {c.maisAntiga} · notas carregadas desde {c.notasDesde}
      </Text>
      <Text style={s.meta} selectable>
        janelas: {c.passos.map((p) => `${p.range} ${p.passos}`).join(' · ')} ({c.enumeradas}) → {c.janelas} na amostra
      </Text>
      <Text style={s.aviso}>
        A amostra é preparada uma vez e serve a todas as corridas desta sessão — é o que faz as taxas se compararem.
      </Text>
    </View>
  );
}

/**
 * A comparação: **uma linha por motor**, com a taxa de aprovação, a mediana e as idênticas.
 *
 * É o que esta fatia existe para produzir — dois pesos abertos provados numa frase cada não
 * comparavam nada. Continua **sem limiar e sem veredito**: as linhas saem na ordem em que
 * correram, nunca ordenadas por taxa, porque ordenar já é dizer qual ganhou.
 */
function LadoALado({
  corridas,
  emCurso,
  s,
}: {
  corridas: readonly CorridaMedida[];
  /** Há corrida em voo: ela entra nesta lista quando terminar. */
  emCurso: boolean;
  s: Styles;
}) {
  const divergem = amostrasDivergentes(corridas, nomeDoMotor);
  return (
    <View style={s.card}>
      <Text style={s.motor}>lado a lado</Text>
      {corridas.map((c) => (
        <Text key={c.motor} style={s.meta} selectable>
          {linhaDoResumo(resumoDaCorrida(c), nomeDoMotor(c.motor))}
        </Text>
      ))}
      {/* A armadilha desta tela: uma corrida parada no meio mediu menos janelas, e a taxa
          dela não se compara com a de quem correu a amostra inteira. */}
      {divergem !== null ? <Text style={s.problema}>{divergem}</Text> : null}
      {emCurso ? <Text style={s.aviso}>a corrida em curso entra aqui quando terminar.</Text> : null}
    </View>
  );
}

/**
 * Uma corrida: **de quem é a medida**, as quatro medidas da ADR 0050 sem limiar e sem
 * veredito com a regra da janela medida ao lado, as regras que reprovaram e a lista por
 * janela — cada uma abrindo o template, o cru do motor e a frase final, que é como a
 * condição 3 ("nada idêntico ao template") se confere de verdade.
 */
function ResultadoDaCorrida({
  corrida,
  contexto,
  emAndamento = false,
  s,
}: {
  corrida: CorridaMedida;
  contexto: ContextoDaAmostra;
  /** Esta é a corrida em voo: as medidas são parciais por construção. */
  emAndamento?: boolean;
  s: Styles;
}) {
  const linhas = corrida.linhas;
  const nome = nomeDoMotor(corrida.motor);
  // A corrida que não aconteceu: cartão apagado, sem cabeçalho de medição — mostrar as
  // quatro medidas zeradas sugeriria que houve chamada.
  if (corrida.recusa !== undefined) {
    return (
      <View style={[s.card, s.cardFora]}>
        <Text style={s.motor}>{nome}</Text>
        <Text style={s.motivo}>não mediu: {corrida.recusa}</Text>
      </View>
    );
  }
  const m = medidasDoPortao(linhas);
  const cobertura = resumoDaCobertura(m);
  const fecho = agregar(linhas);
  // Quem assinou: mais de uma assinatura é o modelo ou o sistema mudando no meio, e as
  // linhas não se somam.
  const assinaturas = [
    ...new Set(
      linhas.flatMap((l) =>
        l.assinatura ? [[l.assinatura.modelo, l.assinatura.plataforma, l.assinatura.buildDoSistema].filter(Boolean).join(' · ')] : [],
      ),
    ),
  ];
  const situacao = emAndamento
    ? `medindo — ${linhas.length} de ${contexto.janelas}; as medidas abaixo são parciais`
    : corrida.parcial
      ? `PARCIAL — ${linhas.length} de ${contexto.janelas} janelas; as medidas são só destas`
      : `completa — ${linhas.length} de ${contexto.janelas} janelas em ${duracaoCurta(corrida.fim - corrida.inicio)}`;
  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.motor}>{nome}</Text>
        <Text style={s.desfecho}>{situacao}</Text>
      </View>
      {corrida.motivo !== undefined ? <Text style={s.motivo}>{corrida.motivo}</Text> : null}

      {/* O prazo é **deste** motor: 60 s na nuvem e no modelo do sistema, 45 min no peso
          aberto, que é o único que pode pagar uma carga de minutos. Misturá-los aqui
          escreveria na tela um número que o transporte daquela corrida não promete. */}
      <Text style={s.meta} selectable>
        prazo {prazoEmTexto(prazoDoMotorMs(corrida.motor, PRAZOS_DA_CORRIDA))} por janela
      </Text>
      <Text style={s.meta} selectable>
        assinado por: {assinaturas.length > 0 ? assinaturas.join(' | ') : '— (nenhuma resposta ainda)'}
      </Text>
      {assinaturas.length > 1 ? (
        <Text style={s.problema}>mais de uma assinatura: o modelo ou o sistema mudou no meio, e as linhas não se somam</Text>
      ) : null}

      {/* O nome do motor **dentro** do rótulo, e não só no cabeçalho: estas linhas são
          `selectable`, e um bloco de medidas copiado daqui sem dono é um número órfão —
          duas corridas produzem listas com a mesma cara. */}
      <Text style={s.rotulo}>as quatro medidas da ADR 0050 em {nome} — sem limiar e sem veredito</Text>
      <Text style={s.meta} selectable>
        aprovação (ok ÷ medidas): {m.aprovadas} de {m.medidas} ({porcento(m.aprovadas, m.medidas)})
      </Text>
      <Text style={s.meta} selectable>
        medidas: {m.medidas} de {m.janelas} — fora da medida: {foraEmTexto(m.foraDaMedida)}
      </Text>
      <Text style={s.meta} selectable>
        cobertura: {cobertura.presentes} de {cobertura.combinacoes} combinações na amostra, {cobertura.comAprovada} com
        aprovada{cobertura.semJanela.length > 0 ? ` — sem janela: ${cobertura.semJanela.join(', ')}` : ''}
      </Text>
      <Text style={s.meta} selectable>
        aprovadas idênticas ao template: {m.identicasAoTemplate} de {m.aprovadas}
      </Text>
      <Text style={s.meta} selectable>
        mediana por chamada: {segundos(m.medianaMs)} ({m.naMediana} medidas; {m.frias}{' '}
        {m.frias === 1 ? 'fria ficou' : 'frias ficaram'} de fora)
      </Text>
      <Text style={s.aviso}>{REGRA_DA_JANELA_MEDIDA.replace(/`/g, '')}</Text>

      <Text style={s.rotulo}>cobertura por caso (na amostra / aprovadas)</Text>
      {m.cobertura.map((k) => (
        <Text key={k.caso} style={s.meta}>
          {k.caso} · noite {k.noite.amostra}/{k.noite.aprovadas} · período {k.periodo.amostra}/{k.periodo.aprovadas}
        </Text>
      ))}

      <Text style={s.rotulo}>por regra da conferência (só o que reprovou)</Text>
      {fecho.porRegra.length === 0 ? (
        <Text style={s.meta}>nenhuma reprovação</Text>
      ) : (
        fecho.porRegra.map((r) => (
          <Text key={r.regra} style={s.meta}>
            {r.regra} · {r.vezes}
          </Text>
        ))
      )}
      {fecho.porClasse.length > 0 ? (
        <>
          <Text style={s.rotulo}>por classe de falha</Text>
          {fecho.porClasse.map((r) => (
            <Text key={r.classe} style={s.meta}>
              {r.classe} · {r.vezes}
            </Text>
          ))}
        </>
      ) : null}

      <Text style={s.rotulo}>por janela · toque para ver o template, o cru e a frase</Text>
      {linhas.map((l) => (
        <LinhaDaAmostra key={chaveDoPasso(l)} linha={l} s={s} />
      ))}
    </View>
  );
}

/** O hash como o relatório do Mac o escreve: os 12 primeiros, ou o sentinela inteiro. */
function hashNaLista(hash: string): string {
  return /^[0-9a-f]{64}$/.test(hash) ? hashCurto(hash) : hash;
}

/**
 * Uma janela na lista, recolhida: o endereço, o caso, o desfecho, o tempo e o hash do
 * pedido. Aberta, mostra o **template**, o **cru do motor** e a **frase final** — as três
 * colunas de texto do relatório do Mac, que é onde a paráfrase e a cópia do template
 * aparecem. Sem elas, "0 idênticas de 19" é um número que o dono não pode conferir.
 */
function LinhaDaAmostra({ linha: l, s }: { linha: LinhaDoRelatorio; s: Styles }) {
  const [aberta, setAberta] = useState(false);
  const marcas = [l.sintetica ? 'sintética' : null, l.frio ? 'fria' : null, l.doHospedeiro ? 'do hospedeiro' : null].filter(
    (x): x is string => x !== null,
  );
  const porque = l.problemas && l.problemas.length > 0 ? l.problemas.map((p) => p.regra).join(', ') : l.desfecho === 'ok' ? null : l.detalhe;
  return (
    <>
      <Pressable
        onPress={() => setAberta((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel={`${chaveDoPasso(l)}, ${l.caso}, ${l.desfecho}`}
        style={({ pressed }) => [pressed && s.pressed]}
      >
        <Text style={s.meta} selectable>
          {aberta ? '▾ ' : '▸ '}
          {chaveDoPasso(l)} · {l.caso} · {l.alcance} · {l.desfecho}
          {marcas.length > 0 ? ` (${marcas.join(', ')})` : ''} · {l.ms} ms · {hashNaLista(l.hashDoPedido)}
          {porque ? ` — ${porque}` : ''}
        </Text>
      </Pressable>
      {aberta ? (
        <View style={s.dobra}>
          <Text style={s.rotulo}>template</Text>
          <Text style={s.fraseFraca}>{l.template}</Text>
          {l.textoDoMotor !== undefined ? (
            <>
              <Text style={s.rotulo}>texto cru</Text>
              <Text style={s.cru}>{l.textoDoMotor}</Text>
            </>
          ) : null}
          {l.frase !== undefined ? (
            <>
              <Text style={s.rotulo}>frase final</Text>
              <Text style={s.frase}>{l.frase}</Text>
              {l.frase.trim() === l.template.trim() ? <Text style={s.problema}>idêntica ao template</Text> : null}
            </>
          ) : null}
          {l.problemas?.map((p, i) => (
            <Text key={`${p.regra}-${i}`} style={s.problema}>
              {p.regra}: {p.detalhe}
            </Text>
          ))}
          {l.detalhe !== undefined ? <Text style={s.meta}>{l.detalhe}</Text> : null}
          <Text style={s.meta} selectable>
            pedido {l.hashDoPedido}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * O diagnóstico como a ponte o escreveu — ou o estado, quando não houve linha.
 *
 * Serve aos **dois** motores do aparelho (5.8): a linha é a mesma, e o texto dos estados sem
 * linha fala do aparelho, não de um modelo em particular — quem nomeia o motor é o rótulo
 * acima dele na tela.
 */
function diagnosticoCru(p: EstadoDaPonte): string {
  switch (p.tipo) {
    case 'ausente':
      return 'ausente — o módulo OnDeviceEngine não está neste build';
    case 'fora-do-ios':
      return 'fora do iOS — o modelo do aparelho só existe no iPhone';
    case 'consultando':
      return 'consultando…';
    case 'lido':
      return p.cru ?? (p.diagnostico.estado === 'ilegivel' ? `ilegível: ${p.diagnostico.detalhe}` : JSON.stringify(p.diagnostico));
  }
}

/**
 * A trilha das execuções — o anel, que é memória e nunca sai do aparelho.
 *
 * **Alcançável e limpável**, porque ele é o único diagnóstico de uma leitura que caiu
 * no piso em produção: mostrar oito de quarenta eventos sem jeito de ver o resto é
 * ter o diagnóstico e não poder lê-lo, e sem `limpar` uma sessão de bancada enterra
 * sob relatório o evento da leitura que realmente interessa.
 */
function Anel({ s }: { s: Styles }) {
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const [, setGeracao] = useState(0);
  // Lido a cada render, **sem memo**: o anel não é reativo, e quem o atualiza na
  // tela é a própria medição, que re-renderiza a cada motor. Um `useMemo` aqui
  // congelava a lista entre as colunas — o diagnóstico da leitura que acabou de
  // rodar não aparecia. O `setGeracao` existe só para o `limpar` repintar.
  const todos = anel.ler();
  const eventos = mostrarTudo ? todos : todos.slice(0, 8);
  // As notas do hospedeiro (5.9): o que aconteceu fora de uma leitura — hoje, a vez
  // do aparelho solta à força por uma chamada nativa que não voltou.
  const notas = anel.notas();

  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.rotulo}>anel (em memória, não sai do aparelho)</Text>
        <Text style={s.desfecho}>
          {todos.length}/{TETO_DO_ANEL}
        </Text>
      </View>

      {notas.map((n, i) => (
        <Text key={`nota-${n.instante}-${i}`} style={s.problema}>
          {n.instante.slice(11, 19)} · hospedeiro · {n.texto}
        </Text>
      ))}

      {eventos.length === 0 ? (
        <Text style={s.meta}>nenhuma leitura nesta sessão</Text>
      ) : (
        eventos.map((e, i) => (
          <Text key={`${e.instante}-${i}`} style={s.meta}>
            {e.instante.slice(11, 19)} · {e.modo} · {e.causa ?? 'motor'} ·{' '}
            {e.trilha.map((t) => `${t.motor}:${t.desfecho}`).join(' → ') || '—'}
          </Text>
        ))
      )}

      <View style={s.acoesDoAnel}>
        {todos.length > 8 ? (
          <Pressable
            onPress={() => setMostrarTudo((v) => !v)}
            accessibilityRole="button"
            style={({ pressed }) => [s.acao, pressed && s.pressed]}
          >
            <Text style={s.acaoTexto}>{mostrarTudo ? 'mostrar só as 8 últimas' : `ver todas as ${todos.length}`}</Text>
          </Pressable>
        ) : null}
        {todos.length > 0 || notas.length > 0 ? (
          <Pressable
            onPress={() => {
              anel.limpar();
              setMostrarTudo(false);
              setGeracao((g) => g + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Limpar o anel"
            style={({ pressed }) => [s.acao, pressed && s.pressed]}
          >
            <Text style={s.acaoTexto}>limpar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },
    content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 4,
      ...shadows.card,
    },
    // O cartão de uma coluna que não aconteceu: apagado, para não competir com as medições.
    cardFora: { backgroundColor: colors.surfaceMute },
    botao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: spacing.md,
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    botaoOff: { opacity: 0.6 },
    botaoTexto: { flexShrink: 1, fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.onPrimary, textAlign: 'center' },
    /**
     * Medir e Parar lado a lado: o forte cresce, o suave fica do tamanho do dedo —
     * **e a fileira quebra quando os dois não cabem**.
     *
     * O `flexWrap` é a saída de verdade para o Texto grande: dois alvos de toque
     * numa linha só não encolhem sem virar um alvo pequeno demais, e o rótulo do
     * Parar em curso ("parando — a coluna em voo termina") é longo de propósito.
     * Quebrando, os dois botões empilham e nenhum sai da tela. No tamanho normal
     * eles continuam cabendo numa linha, e nada muda.
     */
    linhaDoBotao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 },
    // `minWidth: 0` é o par do `flexShrink`: sem ele o botão não desce abaixo do
    // conteúdo, e é o conteúdo que cresce com o Texto grande.
    botaoLargo: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    botaoSuave: {
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      minWidth: 84,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
    },
    botaoSuaveTexto: { flexShrink: 1, fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink2, textAlign: 'center' },
    aviso: { marginTop: spacing.sm, fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink3 },

    // Os chips de "quem entra": ligado é preenchido, desligado é contorno, indisponível é
    // apagado e não responde ao toque, e consultando é uma quarta forma — mais viva que o
    // travado, porque ele ainda pode virar um motor de pé.
    //
    // **Os 36 pt são mínimo, nunca altura fixa.** O motivo mora dentro do rótulo do chip
    // travado (ele não tem linha de baixo onde pô-lo), e uma caixa de altura travada corta
    // primeiro exatamente ele, em Texto grande — deixando na tela um controle apagado sem
    // explicação nenhuma. O `maxWidth` prende o chip à fileira para o texto quebrar em duas
    // linhas em vez de transbordar, e a fileira quebra com ele.
    chips: { marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      minHeight: 36,
      maxWidth: '100%',
      flexShrink: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
    },
    chipDentro: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipFora: { backgroundColor: colors.surface, borderColor: colors.line },
    chipTravado: { opacity: 0.45 },
    // Consultando fica **entre** o desligado e o travado, e não tracejado: o tracejado é o
    // vocabulário da régua ("isto não é um controle"), e um motor que ainda vai responder é
    // um controle. Quem carrega o sentido é a palavra no rótulo, não a opacidade.
    chipConsultando: { opacity: 0.7 },
    chipRegua: { backgroundColor: colors.surfaceMute, borderColor: colors.line, borderStyle: 'dashed' },
    chipTexto: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    // Sobre o preenchimento de tinta, o texto é o fundo do app — e não `onPrimary`, que é a
    // cor de cima da MARCA. No escuro a tinta clareia e o fundo escurece, e o par continua
    // legível; `onPrimary` viraria laranja sobre tinta.
    chipTextoDentro: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.bg },
    chipTextoRegua: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },

    // O nome à esquerda e o desfecho à direita — e a fileira quebra, porque o
    // desfecho às vezes é uma frase ("medindo — 3 de 22; as medidas abaixo são
    // parciais") e não cabe ao lado de nada com o Texto grande.
    linhaTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    motor: { flexShrink: 1, fontSize: 13, fontFamily: fonts.monoSemiBold, color: colors.ink },
    desfecho: { flexShrink: 1, fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink2 },
    frase: { fontSize: 15, lineHeight: 21, fontFamily: fonts.serif, color: colors.ink },
    fraseFraca: { fontSize: 14, lineHeight: 20, fontFamily: fonts.serif, color: colors.ink3 },
    motivo: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },
    rotulo: { marginTop: 6, fontSize: 10.5, fontFamily: fonts.sansBold, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
    cru: { fontSize: 12, lineHeight: 17, fontFamily: fonts.mono, color: colors.ink2 },
    meta: { fontSize: 11, lineHeight: 15.5, fontFamily: fonts.mono, color: colors.ink3 },
    problema: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    acoesDoAnel: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    // A dobra de uma janela da amostra: recuada, para a lista continuar legível aberta.
    dobra: { marginLeft: spacing.md, marginBottom: spacing.sm, gap: 2 },
    acao: { flexShrink: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, backgroundColor: colors.surfaceMute },
    acaoTexto: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  });
