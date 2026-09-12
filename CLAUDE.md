# Orbe — Life Organizer

> **Propósito:** Uma plataforma pessoal para gerenciar a rotina completa — treinos, alimentação, casa, compras e finanças. Web para análise, mobile para captura rápida do dia a dia.
>
> Nome antigo: **Vitale** — os pacotes npm mantêm o escopo `@vitale/*` e os bundle IDs `com.sydtpt.vitale` (renomear quebraria builds/entitlements); só a marca visível virou Orbe.

## Arquitetura

Monorepo pnpm workspaces (resolução isolada — ADR 0016) com 4 pacotes:

```
life-organizer/
├── packages/shared/      @vitale/shared  — tokens de design e modelos de domínio
├── web/                  @vitale/web     — Angular 21 dashboard analítico
├── mobile/               @vitale/mobile  — React Native / Expo (captura rápida)
└── scripts/              @vitale/scripts — hospedeiro de scripts: a bancada dos motores
```

O `scripts/` nasceu na story 5.4 (a bancada). Ele roda no Node, não tem bundler, e é
o único workspace que fala com o banco e com a nuvem de fora dos apps — ver
[scripts/README.md](scripts/README.md). As ferramentas em Python de `scripts/github/`
ficam fora do `tsc` dele.

## Comandos essenciais

> **O gerenciador é pnpm** (ADR 0016 / AD-14). A versão vem do campo
> `packageManager` — use `corepack enable pnpm` e não misture `npm install` aqui:
> ele recria uma árvore plana e traz de volta as colisões entre workspaces.

```bash
# Instalar dependências
pnpm install

# Web (Angular 21) — http://localhost:4200
pnpm web:dev

# Mobile (Expo)
pnpm mobile:start       # QR code / Expo DevTools
pnpm mobile:ios         # Simulador iOS
pnpm mobile:android     # Emulador Android

# Validação — o CI roda exatamente isto nos quatro workspaces (AD-17)
pnpm --filter @vitale/shared lint     # tsc do núcleo + é onde vivem as barreiras
pnpm --filter @vitale/shared test     # testes + barreiras de arquitetura (AD-7)
pnpm --filter @vitale/web build       # compila templates e TS
pnpm --filter @vitale/web test        # Vitest
pnpm --filter @vitale/scripts lint    # tsc da bancada (nodenext: o formato do módulo é real)
pnpm --filter @vitale/scripts test    # testes da bancada — puros, nenhum abre rede
cd mobile && pnpm exec tsc --noEmit && pnpm exec jest
cd mobile && pnpm dlx expo-doctor     # 21/21; falha nova dele é sinal, não ruído
```

> **Regras para agentes de IA:** [AGENTS.md](AGENTS.md) (+ um por workspace em
> `web/`, `mobile/`, `packages/shared/`). Mantido por `bmad-project-context` e
> verificado contra o código — em caso de divergência, o AGENTS.md vale.

## Stack

### Shared (`packages/shared`)
- TypeScript 5 — modelos de domínio e design tokens
- Arquivo de entrada: `packages/shared/src/index.ts`
- Modelos: `Meal`, `Habit`, `Chore`, `ShopItem`, `Treino`, `Lift`, `FinancaCategory`, `Transaction`, `Meta`, `DayData`
- Tokens: `surfaces`, `ink`, `brand`, `accents`, `spacing`, `radii`, `fonts`, `MOD` (map de cores por módulo)

### Web (`web/`)
- **Angular 21** com standalone components
- **Store:** signals + `signal()` / `computed()` (sem NgRx)
- **Estilos:** SCSS, OnPush em todo lugar
- **Roteamento:** lazy-loaded feature routes
- Estrutura: `web/src/app/features/<modulo>/`

As rotas moram em `web/src/main.ts` — **não** existe `app.routes.ts` (o
`features/auth/auth.routes.ts` é código morto: exporta `AUTH_ROUTES`, que ninguém
importa). Toda rota de aplicação está atrás de `profileGuard`; `''` redireciona para
`/semana` e `**` para `/login`.

| Grupo | Rotas |
|---|---|
| Visão geral | `/semana` (padrão) · `/retrospectiva` |
| Treino e saúde | `/treinos` · `/workout-history` · `/saude` · `/sono` · `/recuperacao` · `/habits` |
| Dia a dia | `/alimentacao` · `/compras` · `/casa` · `/tasks` · `/registros` · `/cultura` |
| Dinheiro e metas | `/financas` · `/metas` |
| Configuração | `/conexoes` · `/configuracoes` |
| Auth | `/login` · `/register` · `/setup` |

`/workout-history` aninha: `/:slug`, `/:slug/mapa` e `/:slug/:id`. A ordem importa —
`/mapa` é declarada antes de `/:id`, senão o param a engole. `/registros` aninha
`/registros/:id` — o detalhe de um registro (métricas por período + heatmap anual
clicável).

### Mobile (`mobile/`)
- **Expo 57** / React Native 0.86 (New Architecture — única arquitetura a partir da RN 0.82)
- **Roteamento:** Expo Router (file-based, pasta `mobile/src/app/`)
- **Store:** Zustand 5
- **Animações:** `Animated` do React Native — Reanimated está instalado (o `expo-router` o exige), mas **não se usa** (ADR 0010)
- 4 tabs na barra: Hoje, Sono, Histórico, Mais — Semana, Saúde e Compras são telas de tab
  ocultas (`href: null`), abertas pelo Mais

## Design System

**Quatro eixos independentes** — ver [spec](docs/specs/temas/spec.md). Cor nasce em
`packages/shared/src/theme` e chega por `resolveTokens()` / `moduleOf()`; nunca escreva
hex numa tela.

| Eixo | Opções | Governa |
|---|---|---|
| Esquema | sistema · claro · escuro · solar | claro/escuro |
| Tema | Orbe · Clean · Clean elevado | superfície, tinta, linha |
| Paleta | Orbe · Bruma · Terra · Néon · Joia · Acessível | cor dos módulos e das séries |
| Marca | Laranja · Tinta · Azul · Verde | o cromo: FAB, CTA, toggle |

Três regras que o `architecture.test.ts` cobra: nenhum `StyleSheet` de escopo de módulo
lê tema (congela no import), nenhuma variável CSS da web fora do sistema, e todo `CHECK`
de id em `user_preferences` cobre os ids que o app grava.

O recorte abaixo é o tema **Orbe claro** — o padrão histórico, preservado por teste:

| Token         | Valor     | Uso                    |
|---------------|-----------|------------------------|
| `primary`     | `#F25C2B` | CTA, destaque principal |
| `bg`          | `#FFF7EE` | Fundo app mobile       |
| `bgWeb`       | `#FAF3E6` | Fundo web              |
| `surface`     | `#FFFFFF` | Cards                  |
| `ink`         | `#1F1B16` | Texto principal        |
| `ink2`        | `#5C534A` | Texto secundário       |
| `line`        | `#EFE6D8` | Bordas, separadores    |

**Fontes:** Manrope (sans), Geist Mono (números — tabular, alinha em coluna),
Instrument Serif (títulos). Embarcadas no binário do mobile pelo plugin `expo-font`.

**Cores por módulo.** Desde a [ADR 0018](docs/decisions/0018-cor-de-modulo-deriva-de-papel-cromatico.md)
cor de módulo **não é hex autorado**: cada paleta declara *papéis* e cada módulo aponta
para um papel via `MODULE_ROLE` (`packages/shared/src/theme/palettes.ts`). O `tint` sai de
`softOf(accent, esquema)` em OKLab. Em código novo use `moduleOf()` — ele responde à
paleta e ao esquema; o `MOD` de `constants/tokens.ts` é só o recorte derivado da
combinação histórica (paleta orbe · tema orbe · claro).

São **10** módulos, não 7:

| Módulo | Papel | `accent` no recorte Orbe claro |
|---|---|---|
| `treino` | orange | `#F25C2B` |
| `food` | yellow | `#F5B946` |
| `agua` | blue | `#6E8CC9` |
| `habito` | green | `#6FA86A` |
| `casa` | brown | `#B4825B` |
| `compras` | rose | `#E26A8A` |
| `financas` | ink | `#1F1B16` |
| `tarefa` | teal | `#4F9D90` |
| `cultura` | purple | `#8B6BB1` |
| `saude` | red | `#E05C5C` |

## Convenções de código

### Angular (web)
- Todo componente é **standalone** (`standalone: true`)
- Usar **OnPush** (`changeDetection: ChangeDetectionStrategy.OnPush`) em todos
- Estado local via `signal()`, derivações via `computed()`
- Injeção de dependência via `inject()` (não construtor)
- SCSS com variáveis CSS, sem magic values — usar tokens do shared
- Nomeação: `kebab-case` para arquivos, `PascalCase` para classes

### React Native (mobile)
- Componentes funcionais com hooks
- Estilos via `StyleSheet.create()` usando tokens do shared
- Estado global via Zustand store em `mobile/src/store/`
- Animações com `Animated` do React Native (não importar Reanimated — ver `mobile/AGENTS.md`)
- Nomeação: `PascalCase` para componentes, `camelCase` para hooks

### Shared
- Modelos de domínio são **somente leitura** — não adicionar lógica de negócio
- Design tokens exportados do `packages/shared/src/constants/tokens.ts`
- Modelos exportados do `packages/shared/src/models/index.ts`

## Status atual

### Feito ✅
- Estrutura monorepo com workspace compartilhado
- Design tokens e modelos de domínio completos
- Web: roteamento, sidebar, 17 páginas de feature
- Web: dashboard Semana completo (heatmap, gráficos, listas, stats)
- Web: página Treinos (gráfico de lift, gráfico de corrida, planejador semanal)
- Web: página Finanças (gráfico de gastos, transações)
- Mobile: navegação por tabs, Zustand store, tema
- Mobile: 7 telas de tab (Hoje, Sono, Histórico e Mais na barra; Semana, Saúde e Compras
  pelo Mais), mais as rotas de stack (treinos, metas, cultura, tarefas, registros, hábitos,
  retrospectiva…)
- Mobile: componentes UI (`DayRingCard`, `CheckButton`, `QuickAddSheet`) e fontes
  embarcadas via plugin `expo-font`
- Backend: Supabase — Postgres com RLS, 55 migrations, 4 edge functions Deno
  (`connections-ingest`, `ia-narrar`, `intervals-link`, `cultura-search`)
- Autenticação: `/login`, `/register`, `/setup`, com `profileGuard` em toda rota
- Notificações **locais** (client-side, `scheduleNotificationAsync`): eventos de sync e
  tarefas, retros agendadas; prefs em `user_preferences.notification_prefs`
- Tarefas: módulo to-do nos dois apps — recorrências, carry/expire, gatilhos, conclusão
  rica. 8 migrations `todo_*`/`tarefas` no repo
- Temas: quatro eixos (esquema, tema, paleta, marca) nos dois apps, com contraste
  medido em vez de conferido. A web ganhou modo escuro, que não tinha
- Sono (mobile): `sleep_periods` — a noite como evento com instantes — e a tela `/sono`
  (relógios deitou/apagou/acordou, timing chart de 14 noites, despertares por hora do dia,
  nota × medição). Sono é categoria de Saúde, não módulo (ADR 0031)
- Sono — **Saúde do sono**: contagem de cinco dimensões (duração, continuidade, horário,
  regularidade, percepção), 0–2 cada, na escala do RU-SATED. A noite conta quatro; o período
  conta cinco, porque regularidade é relação entre noites. Estágios ficam fora da contagem, e
  os limiares de continuidade saem da distribuição recente do usuário — a troca de relógio
  move a vigília mediana de 71 para 13 min sozinha. `/sono/saude` nos dois apps
  ([ADR 0036](docs/decisions/0036-saude-do-sono-e-contagem-nao-placar.md))
- FC ao longo do dia: `health_series` — a série intradiária (minuto → bpm) gravada pelo mesmo
  sync que produz a linha diária (ADR 0033). Em produção desde 05/09, com 177 dias de backfill.
  Web: três painéis em Coração (curva do dia, Noites, dia × hora). iPhone: o detalhe de FC no
  período Dia com a noite, o treino e a faixa típica, mais o card Dormindo. Conferido em 06/09.
  Ver [docs/specs/fc-serie/](docs/specs/fc-serie/spec.md)

- Busca textual nas atividades (07/09): campo na lista de **cada tipo** — celular e web —
  buscando em cidade, nome da rota, nome, fonte e aparelho ao mesmo tempo. Função pura no
  shared sobre a lista já carregada (índice de 555 atividades em 5 ms, consultas em 0–2 ms),
  sem consulta nova ao banco. O cartão **grifa** o trecho quando ele já está à vista e
  **explica** (`Leuven · cidade`) só quando o casamento foi num campo invisível. O
  ranqueamento usa a **raridade do nome no acervo**, não `name_edited` — dos 33 nomes
  editados à mão, 31 são "Yoga". `CityMark.aliases` guarda as grafias que o Nominatim já
  devolvia e o código descartava, então `Brussels`, `Bruxelas` e `Elsene` passam a achar
  Bruxelles e Ixelles. No mesmo passo o enriquecimento de cidades deixou de ser só de
  bicicleta: o acervo geográfico foi de 138 para **274** atividades e de 1.376 para **1.727**
  marcas — e "Visão detalhada por país" passou a existir para Corrida e Caminhada

### Em andamento / Próximo 🔧
- Piso das rotas: o chão de cada pedalada medido contra o OpenStreetMap no ingest
  ([ADR 0043](docs/decisions/0043-piso-das-rotas-vem-do-osm-no-ingest.md), com o passe rodando
  no aparelho pela [ADR 0035](docs/decisions/0035-o-piso-e-calculado-no-aparelho.md)), com a bicicleta
  como entidade que a pedalada herda pela data ([ADR 0034](docs/decisions/0034-bicicleta-e-entidade-com-heranca-por-data.md)).
  Migrations aplicadas e 137 rotas backfilladas em prod (06/09); cartão de piso no Ciclismo e
  no detalhe da pedalada. Faltam o smoke test do passe deployado, o golden set e a web.
  Tarefas: `_bmad-output/implementation-artifacts/piso-das-rotas/tasks.md`
- Fotos na pedalada: **na main em 07/09** ([ADR 0037](docs/decisions/0037-a-foto-e-ponteiro-com-chave-de-cura.md)).
  A imagem fica na biblioteca do iPhone e só o fato sobe (`activity_photos`), com `taken_at`
  como chave de cura porque o `localIdentifier` não é estável. Agrupa por **parada**, não por
  ponto — e quando o GPS não gravou, a parada é provada pelas próprias fotos. Folha de
  confirmação, cartão no detalhe, marcadores no mapa, trilho do tempo, galeria com seleção
  múltipla, fundo "Foto" no cartão de compartilhar, tira na Retrospectiva (a web mostra o
  fato, não a imagem). **Vídeo** (Fase 9, 07/09): o clipe toca dentro do visor via
  `expo-video`, com o player só na página ativa; a duração, que a API nova entrega em
  **milissegundos**, foi corrigida na origem e nos 37 registros em produção. O **pôster do
  vídeo segue em branco** — o próximo build separa as duas causas possíveis (T9.5).
  **A foto sai para fora** (Fase 11, 07/09, quatro estudos de UX): enquadramento por
  pinça no compositor, a parada no cartão (`Ittre · km 31,1 · 12:38`), ações no visor
  com um caminho novo até o compartilhar, **pino de cabeça quadrada** no mapa no lugar
  do círculo, a **capa** acordada (o app escolhe, a estrela corrige) alimentando a tira
  da Retrospectiva, e a **sequência** de um cartão por parada para Stories.
  **Vínculo automático** (Fase 10, 07/09): a pedalada aberta pela primeira vez liga
  sozinha o que está no **corredor de 40 m** — 89% de acerto medido nas 707 decisões
  manuais dele; "depois da chegada" ficou de fora porque erraria em 3 de 4. Nada é
  recusado pela máquina, nenhuma folha abre sozinha, e a varredura roda uma vez por
  pedalada. O **cartão do Histórico** ganhou o selo de mídia no cabeçalho, com a
  contagem agrupada no banco (`activity_media_counts()`). A web ficou de fora por
  decisão dele. **Falta o veredito dele** sobre gestos e a "parada não gravada".
  Tarefas: `_bmad-output/implementation-artifacts/fotos-na-pedalada/tasks.md`
- Hábitos — **preço médio e tela de detalhe** (07/09): `habits.unit_price` (€ por unidade do
  hábito) e o gasto derivado na leitura, nunca gravado — o preço vale retroativo sem backfill.
  Cerveja em 11 €/L: os 60 L gravados desde 23/05 viram **≈€660**. Aparece na linha do hábito na
  Retrospectiva, no card de Gráficos da web e na nova tela `/habitos/detalhe` do celular, no molde
  do detalhe de Registros (períodos, barras por valor, dia da semana, heatmap anual com
  intensidade). No mesmo passo, `R$` virou `€` onde há dado real (retro, Semana, Compras) — o
  símbolo agora sai de `format/money.ts`. **Falta a conferência dele** no iPhone e no navegador.
- Presença — **Fase 0 medindo no iPhone desde 07/09; NÃO escrever a Fase 1 antes do veredito.**
  Captura automática de onde o usuário está e por quanto tempo, para responder "quanto tempo
  fiquei em casa" sem digitar. Dois motores na **mesma tabela** `visits`, separados por `source`:
  geofence do iOS (bordas nítidas, só lugares cadastrados) agora, `CLVisit` (descobre a cauda
  longa, mas atrasa a saída) na fase 3. Lugar **não é módulo**, é dimensão — carimba os outros,
  sem cor própria (ADR 0031 como precedente).
  **A fase 0 não escreve nada no banco**: ela existe para responder uma pergunta só — o iOS
  relança o app fechado para entregar um evento de região? A prova é um evento com
  `appState=background` na tela `/configuracoes/presenca`. Sem ele, a fase 1 não se escreve e as
  fases 2–4 caem junto. Ele não tinha saído de casa até 07/09, então **a pergunta segue sem dado**.
  Três armadilhas já pagas, que a fase 1 herda: o iOS entrega **reavaliação de estado como
  entrada** (cada lançamento do app virava uma "chegada" — daí `redundant` e o estado por região
  persistido); a precisão real medida é **±6 a 15 m**, não os ~100 m de folclore; e o teto do log
  sacrifica relatório antes de travessia, senão o volume de relatórios come o dado real.
  **Ainda sem `docs/specs/presenca/`, sem ADR e sem `tasks.md`** — o raciocínio (veredito dos dois
  motores, esquecer = lápide, alerta como propriedade do lugar, as 5 fases) vive só em dois
  artifacts e na memória da sessão. Escrever isso é o próximo passo enquanto a medição roda.
- **Motores de IA** — modelo no aparelho (Foundation Models, depois Core AI), nuvem (`ia-narrar`)
  e sem modelo, escolhidos **por recurso e por aparelho**. **F0 e o marco A da bancada estão na
  `main` (12/09)**: a porta, o fio e o orquestrador (5.1), o descritor da retrospectiva e as listas
  de termos proibidos (5.2), a leitura da Saúde do sono sem modelo (5.3) e a bancada no quarto
  workspace (5.4 marco A). **A primeira medição rodou em 12/09**, sobre 295 noites de produção: a
  nuvem aprovou em **22 de 22** janelas, com zero frase igual à do template e mediana de 13,6 s por
  chamada. O dono fixou o limiar lendo isso —
  [ADR 0050](docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md):
  aprovação ≥ 90%, os sete casos nos dois alcances, nada idêntico ao template, mediana ≤ 20 s. Falta
  o **marco B** (a coluna do aparelho, que depende do macOS 27) e a **5.5**, que leva o botão à tela.
  Arquitetura aprovada em 10/09:
  [espinha](_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md)
  com 14 ADs, passada por portão de revisão, e as ADRs
  [0047](docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md) (uma porta,
  um orquestrador, a ponte Swift `on-device-engine`),
  [0048](docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md)
  (escolha por aparelho, lista da nuvem no servidor) e
  [0049](docs/decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md) (o motor
  escreve palavras, o código escreve números). Primeira leitura: a **Saúde do sono em uma frase**
  (CAP-13 do spec de Sono), gerada por botão, só no iPhone. Entrou na sprint da revista como
  **Épico 5** pelo correct-course de 10/09
  ([proposta](_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md)): a F0
  (5.1–5.3) e o marco A da bancada (5.4) vinham **antes da story 1.10**, que passa a ser cliente do
  orquestrador (AD-13) — e agora está liberada; a F2 (5.5) vem depois da 1.9, em build próprio; F3–F5
  ficam para a próxima sprint. A bancada mede no Mac, com Mac e iPhone no 27, e vive em
  [scripts/](scripts/README.md).
- Tarefas: ponte real com Compras/Finanças
- Sono: **falta conferir em tela** — CAP-7 (Tempos, Despertares, Estágios) foi conferida no
  iPhone em 05/09, mas o bloco
  **Sono na Retrospectiva** (`sleep/retro.ts`, noite típica vs período anterior, nota ×
  medição como manchete, gatilho × noite em valores absolutos, séries Sono/Acordado no
  Ano) e as leituras **Dispersão**, **antes × agora** e **Grade** do Tempos foram escritos
  em 05/09 e aguardam conferência no iPhone; ver Fase 6 do tasks
- Sono: **Saúde do sono** (CAP-11, ADR 0036) escrita em 06/09 nos dois apps — a tela `/sono/saude`
  e o **bloco Sono da Retrospectiva**, que ganhou o selo e mais seis leituras (média × mediana,
  hora do despertar, duração dos despertares, regularidade por semana, nota por faixa e os
  extremos com data) e passou a existir **também na web**. Núcleo testado e validado contra as
  288 noites reais, mas **sem conferência no iPhone nem no navegador**
- Push **remoto** (servidor): hoje só há notificação local agendada no device — não há
  registro de token nem envio server-side
- Distribuição: EAS e deploy das edge functions não estão versionados em nenhum doc

## Specs detalhados

Cada módulo tem seu spec em `docs/specs/`:

- [Arquitetura geral](docs/specs/00-overview.md)
- [Web: Semana](docs/specs/web-semana.md)
- [Web: Treinos](docs/specs/web-treinos.md)
- [Web: Alimentação](docs/specs/web-alimentacao.md)
- [Web: Compras](docs/specs/web-compras.md)
- [Web: Casa](docs/specs/web-casa.md)
- [Web: Finanças](docs/specs/web-financas.md)
- [Web: Metas](docs/specs/web-metas.md)
- [Mobile: Saúde](docs/specs/mobile-saude.md)
- [Mobile: Hoje](docs/specs/mobile-hoje.md)
- [Mobile: Semana](docs/specs/mobile-semana.md)
- [Mobile: Compras](docs/specs/mobile-compras.md)
- [Mobile: Mais](docs/specs/mobile-mais.md)
- [Backend / API](docs/specs/backend.md)
- [Sync: Atividades (HealthKit → Supabase)](docs/specs/sync-atividades/spec.md) · [plan](docs/specs/sync-atividades/plan.md) · [data-model](docs/specs/sync-atividades/data-model.md) · [tasks](_bmad-output/implementation-artifacts/sync-atividades/tasks.md)
- [Web: Histórico de Treinos](docs/specs/historico-treinos/spec.md) · [plan](docs/specs/historico-treinos/plan.md) · [data-model](docs/specs/historico-treinos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/historico-treinos/tasks.md)
- [Habitos (contadores diários)](docs/specs/habitos/spec.md) · [plan](docs/specs/habitos/plan.md) · [data-model](docs/specs/habitos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/habitos/tasks.md)
- [Tarefas (to-do com agendamento)](docs/specs/tarefas/spec.md) · [plan](docs/specs/tarefas/plan.md) · [data-model](docs/specs/tarefas/data-model.md) · [tasks](_bmad-output/implementation-artifacts/tarefas/tasks.md)
- [Registros (marcação diária avulsa)](docs/specs/registros/spec.md) · [plan](docs/specs/registros/plan.md) · [data-model](docs/specs/registros/data-model.md) · [tasks](_bmad-output/implementation-artifacts/registros/tasks.md)
- [Mobile: Histórico de Treinos](docs/specs/mobile-historico-treinos/spec.md) · [plan](docs/specs/mobile-historico-treinos/plan.md) · [data-model](docs/specs/mobile-historico-treinos/data-model.md) · [tasks](_bmad-output/implementation-artifacts/mobile-historico-treinos/tasks.md)
- [Web: Carga Semanal (zonas de FC agregadas)](docs/specs/carga-semanal/spec.md) · [data-model](docs/specs/carga-semanal/data-model.md) · [tasks](_bmad-output/implementation-artifacts/carga-semanal/tasks.md)
- [Web: Readiness → Treino (prontidão acionável)](docs/specs/readiness-treino/spec.md) · [tasks](_bmad-output/implementation-artifacts/readiness-treino/tasks.md)
- [Web: Correlações de Gatilho (hábito-ruim/registro × saúde)](docs/specs/correlacoes-gatilho/spec.md) · [tasks](_bmad-output/implementation-artifacts/correlacoes-gatilho/tasks.md)
- [Web: Recap Semanal (resumo automático da semana)](docs/specs/recap-semanal/spec.md) · [tasks](_bmad-output/implementation-artifacts/recap-semanal/tasks.md)
- [Ratings diários subjetivos (sono ao acordar + dia após 22h)](docs/specs/ratings-diarios/spec.md)
- [Retrospectiva (resumo agregado por semana/mês/estação/ano/total com insights cruzados)](docs/specs/retrospectiva/spec.md) · [v2 — o jornal](docs/specs/retrospectiva/v2-jornal.md)
- [Web: Visão detalhada por país (Ciclismo — mapa de rotas + cidades por país)](docs/specs/mapa-por-pais/spec.md) · [plan](docs/specs/mapa-por-pais/plan.md) · [data-model](docs/specs/mapa-por-pais/data-model.md) · [tasks](_bmad-output/implementation-artifacts/mapa-por-pais/tasks.md)
- [Temas (quatro eixos: esquema, tema, paleta e marca)](docs/specs/temas/spec.md) · [data-model](docs/specs/temas/data-model.md)
- [Cultura (livros, filmes, podcasts e álbuns)](docs/specs/cultura/spec.md) · [data-model](docs/specs/cultura/data-model.md) · [stories](docs/specs/cultura/stories.yaml)
- [Sono (tela própria: horários, timing chart, despertares e percepção × medição)](docs/specs/sono/spec.md) · [data-model](docs/specs/sono/data-model.md) · [plan](docs/specs/sono/plan.md) · [tasks](_bmad-output/implementation-artifacts/sono/tasks.md)
- [FC ao longo do dia (série intradiária em `health_series`)](docs/specs/fc-serie/spec.md) · [data-model](docs/specs/fc-serie/data-model.md) · [tasks](_bmad-output/implementation-artifacts/fc-serie/tasks.md)
- [Fotos na pedalada (a foto ligada à atividade, agrupada por parada)](docs/specs/fotos-na-pedalada/spec.md) · [data-model](docs/specs/fotos-na-pedalada/data-model.md) · [tasks](_bmad-output/implementation-artifacts/fotos-na-pedalada/tasks.md)
- [Busca textual nas atividades (cidade, nome da rota, nome, fonte, aparelho)](docs/specs/busca-textual/spec.md) · [data-model](docs/specs/busca-textual/data-model.md) · [stories](docs/specs/busca-textual/stories.yaml)
