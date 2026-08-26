# 0023 — O esquema solar lê o fuso, não o GPS

**Status:** aceita
**Data:** 2026-08-27

## Contexto

O eixo **Esquema** do sistema de temas ([ADR 0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md),
[spec](../specs/temas/spec.md)) tinha três opções: `light`, `dark` e `system`. A terceira
delega ao sistema operacional, que na prática delega ao usuário — quem não agenda claro/escuro
no iOS fica num deles o dia inteiro.

A opção que faltava é a que o app pode responder sozinho: acompanhar a luz lá fora. Para
isso são precisas duas coisas — **onde o aparelho está** e **a que horas amanhece lá**.

## Decisão

**A localização sai do fuso horário do aparelho**, por uma tabela IANA → coordenada gerada
do `zone.tab` do tzdata (`scripts/build-timezone-coords.mjs`, 418 fusos + 135 apelidos,
16 KB). `Europe/Brussels` vira 50,83 / 4,33.

**A virada usa o crepúsculo civil (sol a −6°)**, não o nascer/pôr do sol.

**O estado sai da altitude do sol agora**, não da comparação do relógio com um par
nascer/pôr guardado.

## Alternativas rejeitadas

**GPS via `expo-location`.** Preciso ao metro, e cobra um diálogo de permissão de
localização para escolher a cor de um app — mais uma dependência nativa (rebuild EAS) e um
segundo prompt na web. O ganho de precisão não se converte em nada visível: dentro de um
fuso, o erro de horário é de minutos, e a decisão que ele alimenta é binária.

**Última rota de atividade do Supabase.** Coordenada real, sem permissão, já no banco.
Perde no caso que motiva a feature: viajar. Fica velha se o usuário muda de país e não
treina, e depende de rede na primeira pintura.

**Cidade fixa nas configurações.** Previsível, e para de valer exatamente quando viajar —
que é quando um esquema automático deveria brilhar. O fuso resolve isso de graça, porque o
celular já o troca sozinho no desembarque.

**Nascer/pôr do sol exatos como limiar.** Mais literal em relação ao nome da opção, e
escurece o app enquanto ainda há luz na rua: em Bruxelas, no verão, o crepúsculo civil vale
46 min a mais de tema claro. O limiar de −6° é definido justamente como "a luz do céu deixou
de bastar para ler lá fora".

**Decidir o estado pelo par nascer/pôr.** É como quase toda implementação faz, e é onde
quase toda implementação quebra: no verão polar **não existe pôr do sol**, e quem compara
contra um par precisa inventar uma resposta para o dia que não tem um. Por altitude,
Longyearbyen em junho é `light` o tempo todo sem caso especial nenhum, e a ausência de
evento vira só ausência de agendamento.

**Varrer de minuto em minuto.** 1.440 despertares por dia para detectar 2 mudanças. O
núcleo devolve o instante da próxima virada e os apps agendam um timer nele.

## Consequências

- **Fuso sem coordenada devolve `null`, e o app cai em `system`.** `UTC`, `Etc/GMT+3` e
  afins são offsets, não lugares; chutar o meridiano daria noites de 12 h o ano todo para
  quem pode estar em qualquer lugar. A tela de Aparência **diz isso em voz alta** em vez de
  degradar calado.
- **Timer não basta em nenhum dos dois apps, por motivos diferentes.** No mobile ele não
  roda com o app suspenso; na web o navegador estrangula timers de aba em segundo plano — e
  o Orbe é um dashboard que fica aberto o dia todo. Os dois recalculam ao voltar ao primeiro
  plano (`AppState` / `visibilitychange`), o que de quebra cobre fuso trocado em viagem e
  relógio acertado.
- **`user_preferences.theme` ganhou `'solar'` no CHECK** (`20260827130000_esquema_solar.sql`).
  A tabela é escrita por inteiro num upsert só: sem a migration, escolher "Solar" derrubaria
  tema, paleta, marca e papel de parede junto, com o erro saindo num `console.warn`. A coluna
  `theme` entrou na barreira `ID_COLUMNS` do `architecture.test.ts` para isso não depender de
  alguém lembrar. A migration **foi aplicada e registrada** em `schema_migrations`
  (2026-08-26, via Management API). Conferida nos dois sentidos: um `update` para `'solar'`
  passa, um para `'lunar'` bate na constraint. Ela era pré-requisito de uso e não
  acabamento — escolher "Solar" antes dela perderia as outras preferências.
- **A web listava os valores de `AppTheme` à mão em dois lugares** (`ThemeService` e
  `PreferencesService`), e ambos coagiam o desconhecido para `system`. Um `solar` escolhido
  no celular chegaria na web como `system`, calado. As duas listas agora vêm de `APP_THEMES`.
- **+19,5 KB no bundle inicial da web** (+7,2 KB transferidos), quase todo a tabela de
  fusos. O orçamento do Angular já estourava em 9,9 KB antes disto e passa a estourar em
  29,4 KB. Se um dia incomodar, o corte é carregar a tabela sob demanda — ela só é lida
  quando o esquema é `solar`.
- **A precisão da conta custou mais que a arquitetura, e por um motivo que vale registrar.**
  A primeira versão usava as equações curtas que circulam junto com a "equação do nascer do
  sol" e errava 1min45s. Eram dois erros independentes, e nenhum dos dois quebra um teste de
  formato: a constante de tempo sideral `280.16`, que o SunCalc popularizou e está 0,30°
  errada, e uma longitude média sem o termo de precessão, que vale 0,46° em 2026. Nos dois
  casos o dia continua tendo a duração certa e o gráfico do ano continua com a forma da
  analema — só acontece na hora errada. **Duas referências que discordam entre si não viram
  uma média:** o `sunrise-sunset.org` (que implementa o *Almanac for Computers* de 1990)
  discordava do USNO em até 2min18s, e foi o JPL Horizons, consultado com a elevação minuto
  a minuto, que arbitrou. Hoje: 0,005° de erro na altitude contra o JPL, 36 s nos horários
  contra o USNO — e o USNO publica ao minuto, então boa parte desses 36 s é o
  arredondamento dele.
