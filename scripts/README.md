# `scripts/` — o hospedeiro de scripts

O quarto workspace (`@vitale/scripts`). Roda no **Node**, não tem bundler, e é o
único lugar fora dos apps que fala com o banco e com a nuvem.

| Pasta | O que é |
|---|---|
| `bancada/` | A bancada dos motores (story 5.4): mede a leitura da Saúde do sono, motor por motor, sobre o acervo real |
| `github/` | As ferramentas em **Python** do quadro e da sprint. Ficam como estão — fora do `tsc` e do `pnpm test` |

```bash
pnpm --filter @vitale/scripts lint   # tsc
pnpm --filter @vitale/scripts test   # os testes, todos puros e sem rede
```

## A bancada

Ela responde uma pergunta só: **o texto de um modelo vale mais que o do template nas
leituras reais do dono?** Para isso roda o orquestrador em modo `medicao` — uma vez
por janela e por motor — e escreve um relatório com a frase do template, o texto cru
do motor e a frase final, lado a lado.

**O limiar é do dono.** Nada na bancada aprova motor nem fixa nota de corte.

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --ajuda
```

### Os dois caminhos de entrada

**1. Sobre um export já em disco — sem rede, sem credencial.** É assim que a coluna
sem modelo fecha, em qualquer máquina:

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --export ~/Orbe-dados/sono-2026-09-12
```

**2. Puxando o acervo de produção e medindo.** Precisa das variáveis abaixo:

```bash
export ORBE_SUPABASE_URL=https://<projeto>.supabase.co   # ou EXPO_PUBLIC_SUPABASE_URL
export ORBE_SUPABASE_ANON_KEY=<chave anônima>            # ou EXPO_PUBLIC_SUPABASE_ANON_KEY
export ORBE_EMAIL=<o e-mail da conta>
export ORBE_SENHA=<a senha>

pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts                      # só o template
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --motor nuvem:padrao # + a nuvem
```

Faltando qualquer variável, a bancada **para antes de abrir rede** e diz quais
faltam. A nuvem entra com **JWT de usuário** (`signInWithPassword`), nunca com chave
de serviço; nada de credencial vai para disco nem para log.

### As bandeiras

| Bandeira | O que faz |
|---|---|
| `--hoje AAAA-MM-DD` | o dia local da leitura (padrão: hoje; com `--export`, o do manifesto) |
| `--motor <MotorId>` | uma coluna de modelo a mais (repetível, ou por vírgula) |
| `--limite <n>` | janelas por caso × alcance na amostra da nuvem (padrão 2 → até 28 chamadas) |
| `--so-exportar` | exporta o acervo e o manifesto, e não mede |
| `--export <dir>` | mede sobre um export já em disco, sem abrir rede |
| `--comparar a.json b.json` | compara dois relatórios do mesmo manifesto e sai |
| `--sim-gastar-chamadas` | confirma uma corrida acima de 60 chamadas de nuvem |
| `--ajuda` / `--help` | a lista acima, gerada do código |

`--ajuda` é a fonte: ela é montada da mesma declaração que lê as bandeiras, então não
envelhece.

## O que sai, e o que não sai do lugar

**O relatório e o export carregam dado de saúde de produção.** Eles não entram no git,
não saem da máquina e não vão para lugar nenhum (AD-8/AD-11):

| Arquivo | Onde | Versionado? |
|---|---|---|
| `sleep_periods.json`, `daily_ratings.json` | `bancada/saida/sono-<dia>/` (ignorado) ou o `--export <dir>` | **não** |
| `relatorio-<hash>-<instante>.{json,md}` | o mesmo diretório | **não** |
| `bancada/manifesto.json` | ao lado do código | **sim** — só contagens, datas e hashes |

A bancada **recusa** gravar em qualquer diretório dentro de um repositório git (em
qualquer clone ou worktree), menos `bancada/saida/`. Se você apontar `--export` para
dentro do repo, ela para e explica.

### O que é seguro apagar em `saida/`

Tudo. O diretório é ignorado pelo git e se refaz: o export sai de produção de novo
(`--so-exportar`), e o relatório sai de outra corrida. O que **não** se refaz sozinho
é o relatório de uma corrida de nuvem já paga — se você quer guardar um, tire-o de
`saida/` antes (para fora do repositório), porque uma corrida nova não o apaga mas
também não o reconstrói.

Apagar `bancada/manifesto.json` não perde dado, mas perde a linha de base com que
relatórios futuros se comparam; ele volta na próxima execução padrão.

## O manifesto, e por que dois relatórios às vezes não se comparam

O manifesto é a identidade de uma execução: `hoje`, as janelas, o hash do export, a
regra da amostra, os motores medidos e a versão do descritor. Dois relatórios só se
comparam **com o mesmo hash de manifesto** — somar maçã com laranja é pior que não
comparar, porque o número sai com cara de resultado.

Isso é por construção, não defeito: uma corrida com `--motor` tem outro manifesto que
uma corrida só de template, porque os motores e o tamanho da amostra entram no hash.
O `bancada/manifesto.json` versionado é a linha de base da **execução padrão**, e o
próprio arquivo diz isso na primeira chave.

## O que a bancada não faz

- **Não reimplementa nada do núcleo**: ela chama `entradaDaSaude` e `ler`, e é o
  orquestrador que monta o pedido, confere e escreve a frase. O pedido da bancada é,
  pelo mesmo hash, o pedido que a tela vai montar.
- **Não tem a coluna do aparelho.** `--motor aparelho:…` sai inteiro como tentativa
  sintética `indisponivel`, sem chamada — a ponte Swift é o marco B (macOS 27), e a
  bancada avisa antes de começar.
- **Não mede o alcance `ano`.** O acervo cobre dois anos parciais, ambos
  `sem-contagem`; as outras quatro janelas do seletor cobrem o que há para ler. O
  rodapé do relatório registra isso.
