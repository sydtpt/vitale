import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import {
  APARELHO_SISTEMA,
  LIMITE_DA_AMOSTRA,
  REGRA_DA_AMOSTRA,
  REGRA_DA_JANELA_MEDIDA,
  SEM_MODELO,
  agregar,
  chaveDoPasso,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  filterByRange,
  foraEmTexto,
  hashCurto,
  localDateStr,
  medidasDoPortao,
  porcento,
  resumoDaCobertura,
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
  motivoDoAparelho,
  motoresDoRecurso,
  nomeDoMotor,
  type EstadoDaPonte,
  type ListaAprovada,
} from '../../../lib/motores/catalogo';
import { TETO_DO_ANEL, anel } from '../../../lib/motores/anel';
import {
  PRAZO_MS,
  estadoDosPesosAbertos,
  garantirListaAprovada,
  ponteDoAparelho,
  reconsultarPesosAbertos,
} from '../../../lib/motores';
import {
  ETAPA_EM_PALAVRAS,
  duracaoCurta,
  freioDoHospedeiro,
  medirEmSequencia,
  medirJanelaNoAparelho,
  prepararAmostra,
  previsaoDaAmostra,
  type ContextoDaAmostra,
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
 * ele pode dizer quanto o próprio modelo aprova. "Medir a amostra" roda o modelo do
 * aparelho, em `medicao`, sobre **a mesma amostra de janelas** da bancada do Mac e com a
 * **mesma régua** — a amostra, a tradução em linha e as medidas são do núcleo
 * (`packages/shared/src/bancada/`), e este é o único arquivo do app que as usa: a amostra
 * carrega caso, e caso não entra em tela de produto (barreira do `architecture.test.ts`).
 * O laço fica aqui: uma janela por vez, pela fila da ponte, com as notas inteiras antes
 * de enumerar e a tela acesa enquanto mede. O resultado são os números da ADR 0050 **sem
 * limiar e sem veredito**, e o hash de cada pedido para comparar com o relatório do Mac.
 */
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
  const [recurso, setRecurso] = useState<RecursoId>(RECURSO_INICIAL);
  const fonte = useMemo(() => fonteDe(recurso), [recurso]);

  const [range, setRange] = useState<SonoRange>('7d');
  const [offset, setOffset] = useState(0);
  const [rodando, setRodando] = useState<MotorId | null>(null);
  const [linhas, setLinhas] = useState<readonly Linha[]>([]);
  // O diagnóstico da ponte, cru (5.9): relido ao abrir enquanto não for "disponível".
  const [ponte, setPonte] = useState<EstadoDaPonte>(() => ponteDoAparelho.agora());
  // E o do peso aberto (5.8), que é outro fato.
  const [coreai, setCoreai] = useState<Readonly<Record<string, EstadoDaPonte>>>(() => estadoDosPesosAbertos());
  // **Quem entra na corrida** (22/09). Era uma caixinha só, tudo-ou-nada para os pesos
  // abertos; com N modelos isso deixou de servir — o dono quer escolher quais comparar.
  // O conjunto guarda quem está **de fora**, e não quem está dentro, porque um motor que
  // aparece depois (uma variante que o servidor aprovou no meio da sessão) tem de nascer
  // ligado. Os pesos abertos nascem fora: cada um sobe mais de 1 GB e é o mais lento.
  // O `ref` acompanha o estado porque o laço captura o valor no início e roda por minutos.
  const [foraDaCorrida, setForaDaCorrida] = useState<ReadonlySet<string>>(
    () => new Set(PESOS_ABERTOS.map((p) => p.id)),
  );
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
  const nenhumMotorNaCorrida = motoresDaCorrida.every(
    (m) => m.id === SEM_MODELO || foraDaCorrida.has(m.id) || !m.disponivel,
  );
  const alternarNaCorrida = useCallback((id: MotorId) => {
    setForaDaCorrida((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }, []);
  useEffect(() => {
    let vivo = true;
    void ponteDoAparelho.reconsultar().then((p) => {
      if (vivo) setPonte(p);
    });
    void reconsultarPesosAbertos().then((p) => {
      if (vivo) setCoreai(p);
    });
    return () => {
      vivo = false;
    };
  }, []);

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

  const medir = useCallback(async () => {
    const caso = casoAtual;
    if (caso === null) return;
    const doLaco = `${recurso}|${caso.chave}`;
    setRodando(SEM_MODELO);
    const feitas: Linha[] = [];
    try {
      // A lista do servidor antes do laço (5.6): uma variante nomeada que o dono
      // pode **escolher** no seletor tem de ser mensurável aqui, senão a tela que
      // existe para comparar motores esconde justamente o motor novo.
      // E a ponte do aparelho (5.9): com o módulo no build, o aparelho é medido aqui
      // ao lado da nuvem, com o texto cru dele — é a comparação que o dono pediu.
      const [lista, estadoDaPonte, estadoDoCoreAI] = await Promise.all([
        garantirListaAprovada(),
        ponteDoAparelho.reconsultar(),
        reconsultarPesosAbertos(),
      ]);
      setPonte(estadoDaPonte);
      setCoreai(estadoDoCoreAI);
      setListaDeMotores(lista);
      const conhecidos = motoresDoRecurso(recurso, { sistema: estadoDaPonte, coreai: estadoDoCoreAI }, lista);
      if (identidadeRef.current !== doLaco) return;
      for (const m of conhecidos) {
        // **Abandona o que é de outro caso.** O efeito de limpeza apaga as linhas
        // quando a leitura ou o caso mudam, mas o laço já capturou os dois e
        // continuaria pintando medições do caso velho sob o cabeçalho novo — que é
        // exatamente o erro que esta tela existe para não cometer.
        if (identidadeRef.current !== doLaco) return;
        // Quem o dono deixou de fora não corre. O template nunca é desligável: ele é a
        // régua, e uma corrida sem régua não compara nada.
        if (m.id !== SEM_MODELO && foraRef.current.has(m.id)) continue;
        setRodando(m.id);
        const linha = await fonte.medir(caso, m.id);
        if (identidadeRef.current !== doLaco) return;
        feitas.push(linha);
        // Publica a cada motor: a nuvem leva ~14 s na mediana, e esperar todas as
        // colunas para mostrar a primeira deixaria a tela vazia por meio minuto.
        setLinhas([...feitas]);
      }
    } finally {
      setRodando(null);
    }
  }, [fonte, recurso, casoAtual]);

  const template = linhas.find((l) => l.motor === SEM_MODELO)?.frase;

  /* ── a amostra (story 5.13) ── */

  const [limite, setLimite] = useState<number>(LIMITE_DA_AMOSTRA);
  const [amostra, setAmostra] = useState<EstadoDaAmostra>({ fase: 'parada' });
  const pararRef = useRef(false);
  const amostraEmCurso = amostra.fase === 'preparando' || amostra.fase === 'medindo';

  /**
   * **Perder o foco para a medição**, e não só desmontar: empurrar outra rota deixa esta
   * tela montada, e sem isto o laço seguiria medindo — com a tela acesa — atrás de uma
   * tela que o dono já trocou. A janela em voo termina sozinha; a próxima não abre.
   */
  const [focada, setFocada] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocada(true);
      return () => {
        setFocada(false);
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
    setAmostra({ fase: 'preparando', etapa: 'aparelho' });
    const preparo = await prepararAmostra({
      hoje: localDateStr(),
      limite,
      estado: () => useSonoStore.getState(),
      carregarNotasDesde: (dia) => useSonoStore.getState().carregarNotasDesde(dia),
      motivoDoAparelho: async () => {
        const estadoDaPonte = await ponteDoAparelho.reconsultar();
        setPonte(estadoDaPonte);
        return motivoDoAparelho(estadoDaPonte);
      },
      cancelado: () => pararRef.current,
      aoAndar: (etapa) => setAmostra((a) => (a.fase === 'preparando' ? { ...a, etapa } : a)),
      // O respiro deixa a tela pintar a etapa antes da enumeração, que é síncrona e longa.
      respirar: () => new Promise((r) => setTimeout(r, 16)),
    });
    if (!preparo.ok) {
      return setAmostra(preparo.motivo === null ? { fase: 'parada' } : { fase: 'recusada', motivo: preparo.motivo });
    }

    const { janelas, dados, contexto } = preparo;
    const inicio = Date.now();
    setAmostra({ fase: 'medindo', contexto, linhas: [], emVoo: null, parando: false, inicio });
    // Uma janela por vez, com freio: três seguidas que não chegam ao modelo param a
    // corrida — uma hora de tela acesa sem medir nada não é medição.
    const { linhas: medidas, parcial, motivo } = await medirEmSequencia({
      janelas,
      medir: (j) => medirJanelaNoAparelho(j, dados, contexto.hoje),
      parar: () => pararRef.current,
      abortarSe: freioDoHospedeiro(),
      aoAbrir: (j) => setAmostra((a) => (a.fase === 'medindo' ? { ...a, emVoo: j } : a)),
      aoMedir: (l) => setAmostra((a) => (a.fase === 'medindo' ? { ...a, linhas: l } : a)),
    });
    // **O que já foi medido nunca vira recusa**: mesmo com defeito ou freio, a corrida
    // termina como parcial, com as linhas e o motivo à vista.
    setAmostra({ fase: 'pronta', contexto, linhas: medidas, parcial, inicio, fim: Date.now(), ...(motivo ? { motivo } : {}) });
  }, [limite]);

  const pedirParada = useCallback(() => {
    pararRef.current = true;
    setAmostra((a) => (a.fase === 'medindo' ? { ...a, parando: true } : a.fase === 'preparando' ? { ...a, cancelando: true } : a));
  }, []);

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
          {carregandoCasos ? <Text style={s.meta}>procurando os casos desta leitura…</Text> : null}
          {!carregandoCasos && casoAtual === null ? (
            <Text style={s.motivo}>{casos.motivo ?? 'nenhum caso a medir nesta leitura'}</Text>
          ) : null}

          <Pressable
            onPress={() => void medir()}
            disabled={rodando !== null || amostraEmCurso || casoAtual === null}
            accessibilityRole="button"
            accessibilityLabel="Medir todos os motores neste caso"
            accessibilityState={
              rodando !== null || amostraEmCurso || casoAtual === null
                ? { disabled: true, busy: rodando !== null }
                : {}
            }
            style={({ pressed }) => [
              s.botao,
              (rodando !== null || amostraEmCurso || casoAtual === null) && s.botaoOff,
              pressed && s.pressed,
            ]}
          >
            {rodando !== null ? <ActivityIndicator size="small" color={colors.onPrimary} /> : null}
            <Text style={s.botaoTexto}>
              {rodando === null ? 'Medir os motores' : `medindo ${nomeDoMotor(rodando)}…`}
            </Text>
          </Pressable>
          {casoAtual !== null ? <Text style={s.meta}>caso: {casoAtual.rotulo}</Text> : null}
          <Text style={s.rotulo}>quem entra</Text>
          <View style={s.chips}>
            {motoresDaCorrida.map((m) => {
              if (m.id === SEM_MODELO) {
                return (
                  <View key={m.id} style={[s.chip, s.chipRegua]}>
                    <Text style={s.chipTextoRegua}>{m.rotulo} · régua</Text>
                  </View>
                );
              }
              const dentro = !foraDaCorrida.has(m.id);
              const travado = !m.disponivel;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => alternarNaCorrida(m.id)}
                  disabled={travado || rodando !== null || amostraEmCurso}
                  accessibilityRole="switch"
                  accessibilityLabel={`${m.rotulo} na corrida`}
                  accessibilityState={{ checked: dentro && !travado, disabled: travado }}
                  style={({ pressed }) => [
                    s.chip,
                    dentro && !travado ? s.chipDentro : s.chipFora,
                    travado && s.chipTravado,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={dentro && !travado ? s.chipTextoDentro : s.chipTexto}>
                    {m.rotulo}
                    {travado ? ' · indisponível' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {nenhumMotorNaCorrida ? (
            <Text style={s.aviso}>Só a régua está marcada — ligue ao menos um motor para a corrida medir algo.</Text>
          ) : null}
          {PESOS_ABERTOS.some((p) => !foraDaCorrida.has(p.id)) ? (
            <Text style={s.aviso}>
              Peso aberto na corrida: a primeira chamada de cada modelo compila e leva minutos; o prazo
              dele é de 45 min, não de 1.
            </Text>
          ) : null}
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

        {/* A amostra da 5.13 é **da Saúde do sono**: a enumeração de janelas, a régua e as
            quatro medidas da ADR 0050 são daquela leitura. Escondida nas outras em vez de
            deixada à vista medindo outra coisa — um cartão que mentisse aqui mentiria sobre
            o único número que fixou um limiar. */}
        {recurso === descritorDaSaudeDoSono.recurso ? (
          <>
            <CartaoDaAmostra
              estado={amostra}
              limite={limite}
              aoEscolherLimite={setLimite}
              motivoDoAparelho={motivoDoAparelho(ponte)}
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

function BlocoDoMotor({ linha, template, s }: { linha: Linha; template?: string; s: Styles }) {
  const daRegua = linha.motor === SEM_MODELO;
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

type EstadoDaAmostra =
  | { readonly fase: 'parada' }
  | { readonly fase: 'preparando'; readonly etapa: EtapaDoPreparo; readonly cancelando?: true }
  | { readonly fase: 'recusada'; readonly motivo: string }
  | {
      readonly fase: 'medindo';
      readonly contexto: ContextoDaAmostra;
      readonly linhas: readonly LinhaDoRelatorio[];
      /** A janela que está no aparelho agora. */
      readonly emVoo: JanelaClassificada | null;
      /** "Parar" foi tocado: a janela em voo termina, e a próxima não abre. */
      readonly parando: boolean;
      readonly inicio: number;
    }
  | {
      readonly fase: 'pronta';
      readonly contexto: ContextoDaAmostra;
      readonly linhas: readonly LinhaDoRelatorio[];
      readonly parcial: boolean;
      readonly inicio: number;
      readonly fim: number;
      /** Por que parou antes do fim, quando não foi o toque em "parar" (freio, defeito). */
      readonly motivo?: string;
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
  motivoDoAparelho: semAparelho,
  ocupado,
  aoMedir,
  aoParar,
  s,
}: {
  estado: EstadoDaAmostra;
  limite: number;
  aoEscolherLimite: (n: number) => void;
  /** Por que o modelo do aparelho não atende agora — ou `null`. */
  motivoDoAparelho: string | null;
  /** A comparação por janela está rodando: as duas medições não dividem a fila. */
  ocupado: boolean;
  aoMedir: () => void;
  aoParar: () => void;
  s: Styles;
}) {
  const emCurso = estado.fase === 'preparando' || estado.fase === 'medindo';
  const desligado = emCurso || ocupado;
  const parando = estado.fase === 'medindo' ? estado.parando : estado.fase === 'preparando' ? estado.cancelando === true : false;
  return (
    <>
      <View style={s.card}>
        <Text style={s.motor}>A amostra no aparelho</Text>
        <Text style={s.aviso}>
          O modelo do aparelho, em modo medição, sobre a mesma amostra de janelas da bancada do Mac e com a mesma
          régua. Uma janela por vez; a tela fica acesa enquanto mede. Nada sai do aparelho.
        </Text>

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
            accessibilityLabel={estado.fase === 'medindo' ? 'Parar a medição da amostra' : 'Cancelar o preparo da amostra'}
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
                  : `parar · ${estado.linhas.length} de ${estado.contexto.janelas}`}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={aoMedir}
            disabled={desligado}
            accessibilityRole="button"
            accessibilityLabel="Medir a amostra no modelo do aparelho"
            accessibilityState={desligado ? { disabled: true, busy: false } : {}}
            style={({ pressed }) => [s.botao, desligado && s.botaoOff, pressed && s.pressed]}
          >
            <Text style={s.botaoTexto}>Medir a amostra</Text>
          </Pressable>
        )}

        {estado.fase === 'preparando' ? <Text style={s.meta}>{ETAPA_EM_PALAVRAS[estado.etapa]}</Text> : null}
        {semAparelho !== null && !emCurso ? <Text style={s.motivo}>o aparelho não mede agora: {semAparelho}</Text> : null}
        {estado.fase === 'recusada' ? <Text style={s.motivo}>{estado.motivo}</Text> : null}
        {estado.fase === 'medindo' ? <Progresso estado={estado} s={s} /> : null}
      </View>

      {estado.fase === 'medindo' || estado.fase === 'pronta' ? (
        <ResultadoDaAmostra
          contexto={estado.contexto}
          linhas={estado.linhas}
          situacao={
            estado.fase === 'medindo'
              ? `medindo — ${estado.linhas.length} de ${estado.contexto.janelas}; as medidas abaixo são parciais`
              : estado.parcial
                ? `PARCIAL — ${estado.linhas.length} de ${estado.contexto.janelas} janelas; as medidas são só destas`
                : `completa — ${estado.linhas.length} de ${estado.contexto.janelas} janelas em ${duracaoCurta(estado.fim - estado.inicio)}`
          }
          motivo={estado.fase === 'pronta' ? estado.motivo : undefined}
          s={s}
        />
      ) : null}
    </>
  );
}

/**
 * O andamento: qual janela está no aparelho, quanto já levou e uma **previsão grosseira**
 * do que falta — a mediana do que já foi medido vezes as janelas restantes. Com limite 6 a
 * corrida passa de dez minutos, e isso tem de aparecer antes da espera, não depois.
 */
function Progresso({
  estado,
  s,
}: {
  estado: Extract<EstadoDaAmostra, { fase: 'medindo' }>;
  s: Styles;
}) {
  const restantes = Math.max(0, estado.contexto.janelas - estado.linhas.length);
  const { medianaMs, restanteMs } = previsaoDaAmostra(estado.linhas, restantes);
  return (
    <>
      {estado.emVoo !== null ? (
        <Text style={s.meta}>
          no aparelho: {chaveDoPasso(estado.emVoo)} · {estado.emVoo.caso} · {estado.emVoo.alcance}
        </Text>
      ) : null}
      <Text style={s.meta}>
        decorrido {duracaoCurta(Date.now() - estado.inicio)}
        {restanteMs !== null && restantes > 0
          ? ` · faltam ~${duracaoCurta(restanteMs)} (mediana ${segundos(medianaMs)} × ${restantes})`
          : ''}
      </Text>
    </>
  );
}

/**
 * O resultado: o que foi usado, as quatro medidas da ADR 0050 **sem limiar e sem
 * veredito** com a regra da janela medida ao lado, as regras que reprovaram e a lista por
 * janela — cada uma abrindo o template, o cru do motor e a frase final, que é como a
 * condição 3 ("nada idêntico ao template") se confere de verdade.
 */
function ResultadoDaAmostra({
  contexto: c,
  linhas,
  situacao,
  motivo,
  s,
}: {
  contexto: ContextoDaAmostra;
  linhas: readonly LinhaDoRelatorio[];
  situacao: string;
  motivo?: string;
  s: Styles;
}) {
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
  return (
    <View style={s.card}>
      <View style={s.linhaTopo}>
        <Text style={s.motor}>{nomeDoMotor(APARELHO_SISTEMA)}</Text>
        <Text style={s.desfecho}>{situacao}</Text>
      </View>
      {motivo ? <Text style={s.motivo}>{motivo}</Text> : null}

      <Text style={s.rotulo}>o que foi usado</Text>
      <Text style={s.meta} selectable>
        hoje {c.hoje} · limite {c.limite} por caso × alcance · prazo {Math.round(PRAZO_MS / 1000)} s por janela
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
      <Text style={s.meta} selectable>
        assinado por: {assinaturas.length > 0 ? assinaturas.join(' | ') : '— (nenhuma resposta ainda)'}
      </Text>
      {assinaturas.length > 1 ? (
        <Text style={s.problema}>mais de uma assinatura: o modelo ou o sistema mudou no meio, e as linhas não se somam</Text>
      ) : null}

      <Text style={s.rotulo}>as quatro medidas da ADR 0050 — sem limiar e sem veredito</Text>
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
    botaoTexto: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },
    aviso: { marginTop: spacing.sm, fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink3 },

    // Os chips de "quem entra": ligado é preenchido, desligado é contorno, indisponível é
    // apagado e não responde ao toque. O alvo tem 36 pt de altura por causa do dedo.
    chips: { marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      minHeight: 36,
      paddingHorizontal: 12,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
    },
    chipDentro: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipFora: { backgroundColor: colors.surface, borderColor: colors.line },
    chipTravado: { opacity: 0.45 },
    chipRegua: { backgroundColor: colors.surfaceMute, borderColor: colors.line, borderStyle: 'dashed' },
    chipTexto: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    // Sobre o preenchimento de tinta, o texto é o fundo do app — e não `onPrimary`, que é a
    // cor de cima da MARCA. No escuro a tinta clareia e o fundo escurece, e o par continua
    // legível; `onPrimary` viraria laranja sobre tinta.
    chipTextoDentro: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.bg },
    chipTextoRegua: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink3 },

    linhaTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    motor: { fontSize: 13, fontFamily: fonts.monoSemiBold, color: colors.ink },
    desfecho: { fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink2 },
    frase: { fontSize: 15, lineHeight: 21, fontFamily: fonts.serif, color: colors.ink },
    fraseFraca: { fontSize: 14, lineHeight: 20, fontFamily: fonts.serif, color: colors.ink3 },
    motivo: { fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },
    rotulo: { marginTop: 6, fontSize: 10.5, fontFamily: fonts.sansBold, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
    cru: { fontSize: 12, lineHeight: 17, fontFamily: fonts.mono, color: colors.ink2 },
    meta: { fontSize: 11, lineHeight: 15.5, fontFamily: fonts.mono, color: colors.ink3 },
    problema: { fontSize: 11.5, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    acoesDoAnel: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    // A dobra de uma janela da amostra: recuada, para a lista continuar legível aberta.
    dobra: { marginLeft: spacing.md, marginBottom: spacing.sm, gap: 2 },
    acao: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, backgroundColor: colors.surfaceMute },
    acaoTexto: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  });
