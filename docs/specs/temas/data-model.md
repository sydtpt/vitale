# Temas — modelo

Companion de [spec.md](spec.md). Contém as quatro colunas, o vocabulário de papéis e a resolução que combina os eixos.

O schema aqui **já está aplicado em produção** e registrado em `schema_migrations` — o inverso do usual neste repositório, e vale saber por quê: o `CHECK` de `wallpaper` estava fora de sincronia com o código, o que derrubava o upsert inteiro de preferências, e a correção precedeu o resto do trabalho.

## `user_preferences` — as quatro colunas

| Coluna | Valores | Nota |
|---|---|---|
| `theme` | `system` \| `light` \| `dark` | **É o ESQUEMA, não o tema.** O nome ficou de quando havia só este eixo |
| `theme_id` | `orbe` \| `clean` \| `cleanElev` | A família de neutros |
| `palette_id` | `orbe` \| `bruma` \| `terra` \| `neon` \| `joia` \| `acessivel` | Módulos **e** séries de gráfico |
| `brand_id` | `laranja` \| `tinta` \| `azul` \| `verde` | O cromo |

**A convivência de `theme` e `theme_id` é deliberada.** Renomear a coluna antiga custaria migration nos dois apps por ganho cosmético. Documentado nos dois lados; `UserPreferences.theme` carrega o mesmo aviso.

**Todo `CHECK` é criado com `drop constraint` + `add constraint` incondicional.** Nunca colado no `add column if not exists` — o Postgres pula o statement inteiro quando a coluna já existe, e o `check` vai junto, calado. Foi assim que o `wallpaper` ficou meses aceitando um conjunto de ids que nunca existiu no código. `architecture.test.ts` cobra que cada coluna de id aceite os ids que o app grava.

## Os três eixos, e o que cada um declara

**Tema** (`theme/themes.ts`) — só neutros, por esquema: `bg`, `bgWeb`, `bg2`, `bg4`, `bgPure`, `surface`, `surfaceWarm`, `surfaceMute`, `hairline`, `ink`…`ink4`, `line`, `lineDeep`, `lineWarm`, `dot`, `inkSoft`. Mais `decorativeWallpapers` e `cardChrome`.

`inkSoft` fica no tema, e não derivado da paleta, porque o papel `ink` é quase acromático — derivar dele daria um cinza morto, e o que a UI quer ali é a superfície abafada do próprio tema. Foi o único papel que a calibração mostrou não seguir a regra dos demais.

**Paleta** (`theme/palettes.ts`) — 11 matizes, nada de superfície:

```
orange  red  rose  purple  blue  teal  green  yellow  brown  deep  ink
```

Os oito primeiros são os papéis das séries de gráfico; os três últimos existem porque o app tem 10 módulos e os gráficos, 8 séries.

**Marca** (`theme/brands.ts`) — `base`, `deep`, `soft`, `on` e `outline`, por esquema. `null` em qualquer um significa "derive"; a `tinta` tem `base: null` e usa a tinta do tema.

## `MODULE_ROLE` — a ponte

| Módulo | Papel | | Módulo | Papel |
|---|---|---|---|---|
| `treino` | `orange` | | `financas` | `ink` |
| `food` | `yellow` | | `tarefa` | `teal` |
| `agua` | `blue` | | `cultura` | `purple` |
| `habito` | `green` | | `saude` | `red` |
| `casa` | `brown` | | | |
| `compras` | `rose` | | | |

`ACTIVITY_ROLE` faz o mesmo para 17 tipos de treino sobre 8 papéis — atividades da mesma família compartilham papel de propósito (ciclismo, remo e natação são todas `blue`), que é o que mantém o gráfico legível.

## Resolução

`resolveTokens(themeId, scheme, paletteId, brandId)` devolve ~60 tokens, memoizado por combinação. Cada papel vira um trio:

| Token | Onde vive | Garantia |
|---|---|---|
| `accent` | ponto, barra, traço sobre o fundo | ≥ 3,0 contra `surface` |
| `*Soft` | preenchimento de chip | — é fundo |
| `*On` | ícone ou texto **dentro** do chip | ≥ 3,0 contra o `*Soft` |

A marca acrescenta `onPrimary` — conteúdo sobre o preenchimento **cheio** — que existe porque a marca `tinta` fica quase branca no escuro, e os 95 `#fff` cravados pelo app virariam branco sobre branco.

**Pinos históricos.** `orbe` + `orbe` (+ marca `laranja`) devolve os hex que o app sempre teve, declarados à mão. Não é desconfiança da derivação: esses valores já estão na tela de quem usa o app. As outras combinações são inteiramente calculadas.

## Como cada plataforma consome

**Mobile** — `theme/tokens.ts` guarda os eixos ativos em escopo de módulo (uma folha de estilo precisa ler cor sem receber contexto) e expõe o proxy `colors`. `theme/index.tsx` é a ponte com o React. A separação existe porque testar cor arrastava o cliente Supabase.

**Web** — a `ThemeService` escreve os tokens como variáveis CSS no `:root`, em runtime. As 144 combinações como CSS estático dariam dezenas de milhares de declarações para usar uma; e assim os 811 `var(--…)` que a web já tinha continuam valendo sem tocar em componente. O `:root` do `styles.scss` é o **piso**: o que a página mostra se o JS não rodar.
