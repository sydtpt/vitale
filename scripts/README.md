# `scripts/` — o hospedeiro de scripts

O quarto workspace (`@vitale/scripts`). Roda no **Node**, não tem bundler, e é o
único lugar fora dos apps que fala com o banco e com a nuvem.

| Pasta | O que é |
|---|---|
| `bancada/` | A bancada dos motores (story 5.4): mede a leitura da Saúde do sono, motor por motor, sobre o acervo real — e, desde a 5.10, o modelo do aparelho, por uma CLI Swift local (`bancada/aparelho/`) |
| `revista/` | A impressão da edição da Retrospectiva fora do telefone (story 2.2) — a mesma que o iPhone imprimiria —, e o arquivo inteiro em massa (story 2.3). Ver [Imprimir uma edição](#imprimir-uma-edição) e [A impressão em massa](#a-impressão-em-massa-o-arquivo-inteiro) |
| `github/` | As ferramentas em **Python** do quadro e da sprint. Ficam como estão — fora do `tsc` e do `pnpm test` |

```bash
pnpm --filter @vitale/scripts lint              # tsc
pnpm --filter @vitale/scripts test              # os testes, todos puros e sem rede — nenhum chama swift
pnpm --filter @vitale/scripts aparelho:testar   # a ponte Swift, sem modelo — local, fora do CI
```

## A bancada

Ela responde uma pergunta só: **o texto de um modelo vale mais que o do template nas
leituras reais do dono?** Para isso roda o orquestrador em modo `medicao` — uma vez
por janela e por motor — e escreve um relatório com a frase do template, o texto cru
do motor e a frase final, lado a lado.

**O limiar é do dono.** Nada na bancada aprova motor nem fixa nota de corte — ela mede, e ele
decide. As quatro condições que ele fixou em 12/09/2026, lendo a primeira medição, estão na
[ADR 0050](../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md):
aprovação ≥ 90% das janelas medidas, os sete casos da CAP-13 presentes nos dois alcances, nenhuma
frase idêntica à do template, e mediana de tempo por chamada ≤ 20 s. Valem juntas, para o par
recurso × `MotorId` que foi medido: trocar modelo, provedor ou pedido pede medição nova.

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --ajuda
```

### Os dois caminhos de entrada

**1. Sobre um export já em disco — sem rede, sem credencial.** É assim que a coluna
sem modelo fecha, em qualquer máquina:

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --export ~/Orbe-dados/sono-2026-09-12
```

**2. Puxando o acervo de produção e medindo.** O projeto é sempre obrigatório:

```bash
export ORBE_SUPABASE_URL=https://<projeto>.supabase.co   # ou EXPO_PUBLIC_SUPABASE_URL
export ORBE_SUPABASE_ANON_KEY=<chave anônima>            # ou EXPO_PUBLIC_SUPABASE_ANON_KEY
```

E depois **um dos dois caminhos** de autenticação, abaixo.

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts                      # só o template
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --motor nuvem:padrao # + a nuvem
```

Faltando qualquer coisa, a bancada **para antes de abrir rede**, diz o que falta e
ensina os dois caminhos. A nuvem entra com **JWT de usuário**, nunca com chave de
serviço; nada de credencial vai para disco nem para log.

### A coluna do aparelho (story 5.10)

`--motor aparelho:sistema` mede o modelo do próprio sistema — o que o iPhone vai usar na 5.9 —,
**nesta máquina, sem rede e sem custo**. Funciona pelos dois caminhos de entrada, inclusive com
`--export` e sem credencial nenhuma:

```bash
pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts \
  --export ~/Orbe-dados/sono-2026-09-12 --motor aparelho:sistema --sonda
```

**O que precisa estar de pé.** macOS 27 com Apple Intelligence ligado (abaixo do 26 a bancada nem
compila: a coluna sai `indisponivel` com o motivo), e o Xcode do mesmo major do build de entrega
(hoje, o 27 — `xcodebuild -version`). Mac e iPhone medem no mesmo major.minor; relatórios de
versões diferentes não se somam. A coluna do aparelho diz no relatório qual `swiftc` compilou a CLI.

**O peso aberto (`aparelho:coreai/…`) também é medido aqui**, mas **sob demanda**: ele sobe
243,7 MiB do disco por chamada e é o mais lento dos quatro, então o laço da tela de bancada do
iPhone o pula por padrão (há um interruptor). No Mac ele não roda: a CLI chama só o `Engine`.

**Como ela roda.** A ponte é um arquivo só, `mobile/modules/on-device-engine/ios/Engine.swift` —
o mesmo que o app vai compilar. A bancada o compila **sem cópia**, com `swiftc` direto sobre ele e
sobre `bancada/aparelho/main.swift` (sem `Package.swift`, sem symlink), para
`bancada/aparelho/.build/aparelho`, que o git ignora. Compila antes da primeira janela, e de novo
sempre que um dos fontes for mais novo que o binário **ou** o carimbo ao lado dele mudar — a versão
do `swiftc` e os argumentos: trocar de Xcode recompila. Depois abre **um processo vivo** para a
corrida inteira, espera ele dizer que nasceu (`{"pronto":true}`) e troca com ele uma linha por
pedido, pareada por `id` (`{"id":n,"pedido":…}` → `{"id":n,"linha":…}`): a sessão do modelo é nova a
cada pedido, mas o processo não — subir um por pedido mediria a carga, não o motor.

**A primeira linha de cada processo é fria** — o modelo sobe nela. Ela conta como medida, mas fica
fora da mediana, e o relatório diz quantas frias ficaram de fora. O mesmo vale para a primeira
depois de um reinício por prazo.

**O que pode dar errado, e como aparece.** Nada disso para a medição; vira a classe da linha:

| O que houve | A linha diz |
|---|---|
| Apple Intelligence desligado, aparelho não elegível, modelo não pronto | `indisponivel`, com o motivo no detalhe |
| a CLI não compila, o binário não abre ou morre ao nascer (`dyld`) | `indisponivel`, com a saída do `swiftc` ou do processo — a coluna inteira, sem tentar de novo |
| o pedido não cabe na janela do modelo | `janela` |
| o guardrail bloqueou, ou o modelo recusou | `guarda` / `recusa-do-modelo` |
| a CLI não responde em 60 s | `transitoria`; o processo é morto e o próximo pedido abre outro |
| a CLI cai no meio, ou responde com outro `id` | `transitoria`, com `naoMapeado`; o processo é encerrado |
| um erro que a ponte não conhece (caso novo da Apple) | `transitoria`, com `naoMapeado` e o nome cru do erro |

As falhas que a própria bancada fabrica — prazo, processo que caiu, protocolo, e na nuvem a falta de
rede — são marcadas **do hospedeiro** e ficam fora da medida (abaixo).

**A tabela erro → classe tem teste próprio**, que roda sem modelo:
`pnpm --filter @vitale/scripts aparelho:testar`. Não entra no `pnpm test` nem no CI — lá não há
Swift. O processo da CLI é testado no `pnpm test` sem Swift: o Node faz o papel dela.

Desde a 5.8 são **dois binários**, e os dois têm de passar:

| binário | o que compila | o que prova |
|---|---|---|
| `testes` | `Engine.swift` + `MotorCoreAI.swift` + `apoio.swift` + `testes.swift`, **sem** `ORBE_COREAI` | a tabela inteira, a conversão de esquema, o pedido estrito, o formato da linha — e, do peso aberto, a régua do nome, a pasta sobre disco de verdade e as duas portas sem biblioteca |
| `testes-coreai` | os mesmos, **com** `-D ORBE_COREAI` e contra `bancada/aparelho/casca-falsa.swift` | o ramo que o iPhone percorre: a **assinatura** (`provedor` do peso aberto, `modelo` = o nome dos pesos), a falha de carga pelo `catch` de verdade, e a regra de texto vazio |

O segundo existe porque `ORBE_COREAI` só é definido no podspec: sem ele, aquele ramo só era
compilado pelo build do app, que não afirma nada. A `casca-falsa.swift` espelha a **superfície
pública** de `scripts/coreai/OrbeCoreAI.swift` e devolve uma sessão que escreve uma frase
combinada — sem Core AI, sem pesos e sem rede. Quem prova que o modelo de verdade gera é o iPhone.

**Não é pago.** O aparelho não entra na conta do gasto nem no teto de chamadas; a bancada declara
as chamadas locais à parte.

### A sonda de fidelidade (`--sonda`)

Com `--sonda`, cada coluna de modelo roda também a sonda da AD-7, sobre as mesmas janelas: o motor
recebe os **pontos** de cada dimensão medida e escolhe **uma**, por esquema de opções fechadas; a
conferência aprova se a escolha está entre as que o código nomeia (`nomear` do caso). Ela só
pergunta nos casos que nomeiam — `uma`, `duas` e `fora-do-empate`; nos outros a linha sai `mudo`,
sem chamada, e não conta. As opções vêm numa ordem embaralhada por janela (a semente é o hash da
janela, então o mesmo acervo dá o mesmo pedido): a posição não decide a escolha.

A sonda é um **descritor** (`descritorDaSondaDaSaude`, em `sleep/sonda.ts`) e passa pelo mesmo
orquestrador em modo `medicao`. Nunca entra no catálogo nem vira produto: ela existe para dizer se o
motor **poderia** escolher a dimensão — hoje quem escolhe é sempre o código.

Com a nuvem, a sonda também é paga: o gasto declarado conta o teto (todas as janelas da amostra), e
os pontos das dimensões vão ao provedor junto com o pedido.

### Como ler a coluna de um modelo

Cada coluna de modelo abre com três blocos, antes do fecho por caso:

- **Quem respondeu** — provedor, modelo, **plataforma e build do sistema**, como a resposta
  assinou. Mais de uma assinatura na mesma coluna é aviso: o modelo mudou no meio, e as linhas não
  se somam.
- **As quatro medidas da ADR 0050** — com a regra da **janela medida** escrita ao lado: entra a
  tentativa que chegou ao modelo; ficam fora, contadas à parte, a sintética, o defeito, o
  `indisponivel` e a falha do hospedeiro. Aprovação = `ok` ÷ medidas; cobertura por caso × alcance,
  com a presença na amostra **e** as aprovadas, noite e período separados; aprovadas idênticas ao
  template; mediana das medidas não frias. **Sem limiar e sem veredito**: os números saem, a régua
  está na ADR, e a comparação é sua.
- **A cópia do exemplo do pedido** (story 5.11) — o pedido da Saúde traz um exemplo de frase aprovada,
  e a condição 3 da ADR só compara com o template. Por isso as aprovadas saem contadas contra o exemplo
  do próprio pedido: **idênticas**, **quase** (a menos da pontuação, de uma palavra, ou o exemplo cortado
  no fim) e **texto próprio**, com a regra escrita ao lado. Na tabela das linhas, a aprovada que é o
  exemplo aparece marcada. Também sem limiar.
- **A sonda** (com `--sonda`) — um fecho que soma (acertos, escolha errada, fora das opções,
  recusas, falhas, defeitos, mudas), os acertos ao lado do **acerto esperado ao acaso** (a soma de
  nomeadas ÷ opções por pergunta medida), e a tabela com as opções, a escolha e a resposta certa.

### O caminho do token (preferido)

**A conta do dono entra pelo Google, e conta criada por OAuth não tem senha** —
`signInWithPassword` devolve "Invalid login credentials" nela para sempre. O caminho é
pegar o JWT que o navegador já tem depois do login.

1. Suba a web e entre pelo Google:

   ```bash
   pnpm web:dev     # http://localhost:4200
   ```

2. Com a sessão aberta, abra o **console do navegador** (⌥⌘I no Chrome/Safari) e rode:

   ```js
   // A chave do Supabase no armazenamento local termina em "-auth-token";
   // o valor é JSON com access_token e refresh_token. O arquivo desce para
   // ~/Downloads e é apagado na mesma linha que o lê, no passo 3.
   (() => {
     const k = Object.keys(localStorage).find((x) => x.endsWith('-auth-token'));
     if (!k) return 'não achei a sessão — entre primeiro';
     const s = JSON.parse(localStorage.getItem(k));
     const txt = `export ORBE_ACCESS_TOKEN='${s.access_token}'\nexport ORBE_REFRESH_TOKEN='${s.refresh_token}'\n`;
     const a = document.createElement('a');
     a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
     a.download = 'orbe-sessao.txt';
     a.click();
     return 'baixado: orbe-sessao.txt (na pasta Downloads)';
   })()
   ```

3. No terminal onde a bancada vai rodar, leia e apague o arquivo **na mesma linha**:

   ```bash
   source ~/Downloads/orbe-sessao.txt && rm ~/Downloads/orbe-sessao.txt
   echo "partes: $(awk -F. '{print NF}' <<<"$ORBE_ACCESS_TOKEN") · tamanho: ${#ORBE_ACCESS_TOKEN}"
   ```

   A conferência tem de dizer `partes: 3` e um tamanho perto de 1000. Ela mostra a
   **forma** do token, nunca o conteúdo — é assim que se diagnostica isto sem expor
   segredo, aqui e em qualquer conversa.

> **Por que um arquivo, e não a área de transferência.** Esta receita já devolveu as duas
> linhas `export` para copiar, e ela falha na prática, de três jeitos medidos (22/09/2026):
> o console mostra a resposta **entre aspas e com `\n` literal**, que colado não cria
> variável nenhuma; `Ctrl+V` no terminal não cola (é *quoted insert*, e engole o Enter
> seguinte, deixando um `read` preso para sempre); e quem copia o **comando** de um chat ou
> de um documento para colar no terminal **sobrescreve o token** na área de transferência,
> então `pbpaste` devolve o comando — o script morre com "Invalid JWT structure", que não
> diz nada sobre a causa. O arquivo tem uma cópia só e nenhuma ordem a acertar. O preço
> declarado: o segredo passa alguns segundos em disco, e o `rm` do passo 3 é parte da
> receita, não um cuidado opcional.
>
> **Nunca misture "copie este comando" com "copie este segredo"** ao ensinar isto a alguém
> — inclusive a um agente. É a armadilha acima, e ela sempre aparece longe da causa.

O **token de acesso dura cerca de uma hora**. O `ORBE_REFRESH_TOKEN` é opcional, mas é
ele que resolve corrida longa: com ele a bancada renova sozinha no meio da medição; sem
ele, ela avisa quantos minutos faltam e — se a corrida não couber no tempo que resta —
diz antes de começar que provavelmente não termina.

Token vencido ou inválido não vira "credencial inválida" genérica: a bancada diz que é
para pegar um novo no navegador.

### O caminho da senha

Só serve em conta que de fato tem senha:

```bash
export ORBE_EMAIL=<o e-mail da conta>
export ORBE_SENHA=<a senha>
```

Se as duas vias estiverem definidas, **o token ganha** e a bancada avisa no `stderr`
que a senha foi ignorada.

### As bandeiras

| Bandeira | O que faz |
|---|---|
| `--hoje AAAA-MM-DD` | o dia local da leitura (padrão: hoje; com `--export`, o do manifesto) |
| `--motor <MotorId>` | uma coluna de modelo a mais (repetível, ou por vírgula) |
| `--limite <n>` | janelas por caso × alcance na amostra das colunas de modelo — nuvem **e** aparelho (padrão 2 → até 28 por coluna). O aparelho é de graça e ainda assim é recortado: as colunas se comparam janela a janela, e a cobertura que a ADR 0050 lê é a da amostra |
| `--so-exportar` | exporta o acervo e o manifesto, e não mede |
| `--export <dir>` | mede sobre um export já em disco, sem abrir rede |
| `--sonda` | roda também a sonda de fidelidade em cada coluna de modelo (exige um `--motor` de modelo) |
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
| `bancada/aparelho/.build/` | o binário da CLI do aparelho e o dos testes | **não** — saída do `swiftc`, refeita sob demanda |

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

## Reconferir um relatório salvo (`reconferir.ts`)

Desde a story 5.13 a régua — o fecho, as quatro medidas da ADR 0050 e a tradução da
medição em linha — mora no núcleo (`packages/shared/src/bancada/`), porque a tela de
desenvolvimento do iPhone mede com ela também. Este comando torna **reprodutível** a
pergunta que essa mudança levanta: os números gravados nos relatórios continuam sendo os
que a régua de hoje dá?

```bash
pnpm --filter @vitale/scripts exec tsx bancada/reconferir.ts ~/Orbe-dados/<dir>/relatorio-*.json
```

Ele relê cada relatório, refaz as contas **a partir das mesmas linhas** e compara com o
que está gravado — o fecho, as medidas e, quando houver, a sonda:

```
ok  relatorio-9c5838fc6e8f-2026-09-19T09-52-33-030Z.json — 2 colunas, 3 contas conferidas, nenhuma divergência
```

Divergiu, ele diz a coluna, a conta, o gravado e o recalculado, e sai com status 1.

Não abre rede, não chama modelo, não escreve arquivo nenhum — e **não vai ao CI**: os
relatórios carregam dado de saúde e moram fora do git, na máquina do dono. A comparação
por *hash de pedido* entre duas execuções é outra coisa, e é a `--comparar` da bancada.

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
- **Não mede pesos nomeados no aparelho.** Só `aparelho:sistema` tem motor; um
  `aparelho:<provedor>/<pesos>` sai inteiro como tentativa sintética `indisponivel`, sem
  chamada — a linha `model:` da ponte é a F5 (Core AI). A bancada avisa antes de começar,
  e avisa também quando `--sonda` não tem coluna de modelo que rode.
- **Não decide o portão.** As quatro medidas da ADR 0050 saem como números; nenhum código
  as compara com a régua.
- **Não mede o alcance `ano`.** O acervo cobre dois anos parciais, ambos
  `sem-contagem`; as outras quatro janelas do seletor cobrem o que há para ler. O
  rodapé do relatório registra isso.

---

## Imprimir uma edição

`revista/imprimir.ts` imprime a edição de **um** período fechado — mês, trimestre, ano
ou semana — e grava pela mesma porta do iPhone (`portasDaEdicao` → `edicao_imprimir`).
A edição que sai daqui é a que o telefone imprimiria: a entrada é montada pela mesma
conta do núcleo (`entradaDaRetrospectiva`), a sequência é a mesma (`imprimir`), e a
cadeia é a padrão da revista — a do iPhone **sem preferência**. Não há `--motor` nem
`--cadernos`, de propósito: uma escolha aqui seria uma segunda edição possível para o
mesmo período.

**Rode antes com `--sem-gravar`**:

```bash
# o ensaio: chama o modelo, confere, não grava, e compara com o que está no banco
TZ=Europe/Brussels pnpm --filter @vitale/scripts revista:imprimir --tipo month --inicio 2026-08-01 --sem-gravar
# a impressão, num período que ainda NÃO tem edição (se já tiver, ele recusa e diz como seguir)
TZ=Europe/Brussels pnpm --filter @vitale/scripts revista:imprimir --tipo week --inicio 2026-08-17
```

O ensaio é mais útil num período que o **telefone já imprimiu** — agosto/2026 é um deles —,
porque aí a tabela do fim compara linha a linha o que sairia agora com o que está gravado.
Foi assim que a story 2.2 foi aceita em 22/09/2026: zero diferenças nos quatro cadernos.

A credencial é a da bancada ([o caminho do token](#o-caminho-do-token-preferido) ou o
da senha), com uma diferença: **para gravar, o `ORBE_REFRESH_TOKEN` é obrigatório** junto
com o `ORBE_ACCESS_TOKEN`. A porta de gravação confere a conta pela sessão do client, e o
token de acesso sozinho não instala sessão nenhuma — sem o refresh, a gravação recusaria
no fim, depois de pagar os cadernos. Com `--sem-gravar`, o token sozinho basta. Faltando
algo, o script para **antes de abrir rede** e diz o nome da variável, nunca o valor.

| Bandeira | O que faz |
|---|---|
| `--tipo <tipo>` | `month`, `season`, `year` ou `week` (ou `mes`, `estacao`, `ano`, `semana`, como na rota da revista). `all` é recusado: o Total nunca fecha |
| `--inicio AAAA-MM-DD` | o primeiro dia do período, nessa grafia (`2026-5-1`, `2026-05` e `05/2026` são recusados). Um dia que não abre período — a semana começa na segunda, o trimestre em janeiro, abril, julho ou outubro, o ano em 1º de janeiro —, o período em curso e o futuro são recusados antes da rede |
| `--sem-gravar` | chama o modelo e confere, e **nunca** chega à função do banco: compara o que gravaria com o que está gravado — posição, provedor, modelo, `prompt_versao`, `pacote_versao`, `agg_version` e métrica líder. O desfecho é `ensaio`, nunca `gravada` |
| `--reimprimir` | imprime de novo um período que já tem edição. Sem ela (e sem `--sem-gravar`), o período já impresso é recusado antes de chamar o modelo — e a recusa é feita duas vezes: na leitura do começo, e de novo na leitura da sequência, que roda depois do acervo e antes do primeiro caderno. É a segunda que pega o telefone imprimindo o mesmo período enquanto o script lia o acervo |
| `--massa` | o arquivo inteiro — ver [A impressão em massa](#a-impressão-em-massa-o-arquivo-inteiro). Não combina com `--inicio`, `--reimprimir` nem `--sem-gravar` |
| `--sim-gastar-chamadas` | no `--massa`, confirma o gasto e roda a corrida |
| `--exportar <arquivo>` | no `--massa`, grava o texto atual das edições que serão substituídas, e sai |
| `--ajuda` | a lista acima, gerada do código |

**O que sai no terminal:** o período, **o fuso**, a janela lida e as contagens do acervo;
por caderno, o desfecho, o hash curto do pedido e a métrica líder. **Nunca o texto** — ele
é leitura de saúde, e mora no banco. O hash é o do pedido (AD-11): o mesmo pedido no
iPhone tem o mesmo hash.

A linha final separa **três grupos**, no `--sem-gravar` também:

```
  gravou: rotina, movimento, sono / manteve: coracao (…) / saíram: nenhum
  gravaria: rotina, movimento, sono / manteria: coracao (…) / sairiam: nenhum — nada foi gravado
```

- **escritos agora** — o modelo escreveu, a conferência aprovou, e o texto novo vai à função;
- **mantidos** — já estavam impressos e caíram no piso nesta impressão (reprovação, falha
  de rede): ficam na edição com o texto e a assinatura **de antes**, e portanto com a
  `agg_version` antiga, que a errata vai marcar;
- **saíram** — estavam impressos e não estão na ordem nova: a função os apaga.

Sai com status 0 quando a edição foi gravada — ou, no `--sem-gravar`, quando haveria o que
gravar —, e 1 em toda recusa, quando nenhum caderno passou na conferência, ou quando uma
porta falhou (uma leitura do acervo, a guarda da impressão concorrente).

**O fuso tem de ser o do iPhone.** O período, o dia de cada tarefa concluída e o dia de
cada atividade saem do relógio local de quem imprime — no telefone, do dele; aqui, desta
máquina. Com outro fuso, a tarefa feita às 00:30 cai em outro dia, e a edição deixa de ser
a do telefone. O cabeçalho diz o fuso usado, com o deslocamento **de agora**
(`Europe/Brussels (UTC+02:00 agora)`) — que não é necessariamente o do período: um mês de
inverno impresso no verão mostra o do verão. Um `TZ` com o nome errado
(`TZ=Europe/Bruxelas`) **não dá erro no Node** — o processo cai para UTC calado —, então o
script o recusa antes de abrir rede, nomeando a variável; um `TZ` válido cujo deslocamento
não é o do processo também é recusado. Sem `TZ`, vale o fuso do sistema.

**Período anterior ao começo do registro já pode ser impresso.** Até 23/09/2026 ele saía
com **zero** no lugar de "não medido" e **sem lápide** para a métrica que parou de chegar —
foi o que o piloto (1.15) achou em 2023. A 2.6 ensinou a ausência a não virar zero, e a 2.7
pôs o detector de métrica morta. O que sobrou é a fronteira do arquivo: **22/05/2023**, o
primeiro dia com registro. Antes dela não há matéria, e a impressão em massa não a cruza.

**Não imprima o mesmo período pelos dois ao mesmo tempo.** A função do banco apaga todo
caderno fora da ordem da impressão, e a ordem nasce do que estava impresso quando a
impressão começou. A porta relê a edição antes de gravar e recusa (`EdicaoMudouNaImpressao`)
se o conjunto de cadernos mudou no meio — alguém imprimiu ou apagou —, se a gravação pede
outro período que não o lido, ou se já houve uma gravação sobre essa leitura (uma gravação
por leitura). Isso estreita a janela de minutos para uma ida e volta ao banco, e **não a
fecha**: fechá-la é migração, e está no deferred-work.

**A capa é carimbada pela impressão que grava** (story 2.3), e nunca depois: as três peças
da escolha — as atividades do período, o acervo de cidades da legenda e o rótulo por
extenso — subiram para o núcleo (`packages/shared/src/revista/capa.ts`), e por isso a capa
que sai daqui é a que o telefone carimbaria. O `--sem-gravar` não a toca, porque não há
edição a carimbar. **Falha de capa nunca derruba a edição**: ela vira aviso no `stderr`, o
texto fica gravado, e a próxima impressão inteira recarimba.

**A capa que você trocou à mão é mantida.** A troca da story 1.16 grava `motivo: 'trocada'`,
e a impressão a lê antes de carimbar: a escolha automática não desfaz um ato seu sobre um
período fechado. O relatório diz *"capa: foto — mantida, porque você a trocou à mão"*. Se a
**leitura** da capa falhar, nada é carimbado — ficar sem capa se conserta na impressão
seguinte; apagar a sua escolha, não.

Nos períodos antigos, sem foto no acervo, a capa nasce `tracado` (a rota mais longa do
período) ou `grade`. Isso é o desenho, não uma sobra: é a textura das capas que registra
quando o dono passou a fotografar, e é ela que faz a fronteira de 2025 ser visível na
parede (story 2.4) sem legenda nenhuma.

**O que prova que é a mesma edição:** a fixture do núcleo
(`packages/shared/src/period/__tests__/contrato-da-edicao.ts`) é impressa pelo núcleo, pelo
celular (`mobile/src/store/__tests__/contrato-da-edicao.test.ts`) e por este script
(`revista/imprimir.test.ts`), e os três batem **o mesmo gabarito** — o hash de cada caderno e
a carga inteira que chega à função, com a assinatura.

---

## A impressão em massa: o arquivo inteiro

`--massa` é o mesmo script imprimindo **todos** os períodos fechados desde **22/05/2023** —
mês, trimestre e ano, **nunca semana** (semana não grava edição: o postal da Retrospectiva a
calcula na hora). São 53 períodos e até quatro cadernos cada.

**Nada acontece sem o plano na tela e sem um "sim" explícito.** Sem `--sim-gastar-chamadas`
ele enumera, cruza com o arquivo, mostra o que faria e **para** — sem chamar modelo nenhum:

```bash
TZ=Europe/Brussels pnpm --filter @vitale/scripts revista:imprimir --massa
```

```
massa — o arquivo desde 2023-05-22, visto de 2026-09-23
  fuso: Europe/Brussels (UTC+02:00 agora)
  53 períodos fechados enumerados (mês, trimestre e ano; semana nunca) · 11 edições no arquivo
  imprimir: 48 · reimprimir: 5 · pular: 6
  até 212 chamadas de nuvem, uma por caderno — com a mediana medida de 13,6 s (a da Saúde do
  sono, ADR 0050: a revista ainda não tem a sua), cerca de 48 minutos de relógio
    o quê        período        de          a           cadernos  por quê
    imprimir     Junho 2023     2023-06-01  2023-06-30  —
    …
    reimprimir   Setembro 2023  2023-09-01  2023-09-30  rotina    zero falso: impressa antes da gramática da ausência (2.6)
    pular        Junho 2026     2026-06-01  2026-06-30  sono      já impresso, e não está na lista de reimpressão
  nada foi chamado e nada foi gravado. Para gastar, rode de novo com --sim-gastar-chamadas.
```

**As contas não somam 53 de propósito.** 48 + 5 + 6 são **59 linhas**: os 53 períodos
enumerados mais as 6 edições que só o arquivo tem — as cinco semanas do piloto (semana nunca
entra na massa) e o ano de 2023, que começa antes de 22/05/2023 e por isso não é enumerado.
O plano mostra as duas listas juntas porque é o inventário do arquivo que o dono confere.

**O tempo estimado é ordem de grandeza, não promessa.** A mediana de 13,6 s foi medida na
Saúde do sono, cujo pedido é menor que o da revista, então 48 min é o lado otimista; o pior
caso é o prazo do transporte (60 s) vezes as chamadas. É por isso que a corrida é tratada
como "perto de uma hora, e mais no pior caso".

A credencial é a de sempre ([o caminho do token](#o-caminho-do-token-preferido)), com uma
diferença: **no modo em massa o `ORBE_REFRESH_TOKEN` é obrigatório sempre**, inclusive para
ver o plano. A corrida chega perto de uma hora e o token de acesso vale uma — descobrir a
falta no meio custaria as chamadas já pagas.

**Recortes.** `--tipo month|season|year` limita a enumeração **e** o arquivo (o que fica de
fora aparece como `pular`, com o motivo), e `--tipo semana` é recusado antes de qualquer
leitura. `--limite N` corta a corrida nos N primeiros períodos do plano — é o ensaio:

```bash
# um período de verdade, para conferir a edição e a capa no iPhone antes de soltar tudo
TZ=Europe/Brussels pnpm --filter @vitale/scripts revista:imprimir --massa --limite 1 --sim-gastar-chamadas
```

### A lista de reimpressão é nomeada em código

**Nada é reimpresso sem ser nomeado.** As cinco que o dono nomeou em 23/09/2026 estão em
`A_REIMPRIMIR` (`revista/imprimir.ts`), com o motivo de cada uma: setembro/2023,
outubro/2023 e o ano de 2023 pelo **zero falso** (impressas antes da 2.6), e julho/2026 e
agosto/2026 pela **lápide do período** (as mortes de julho e a dos anéis em 17/08 mudam a
ordem gravada). Junho de 2026 fica como está, por decisão dele. Não há bandeira que amplie
essa lista: acrescentar um período é editar o arquivo e commitar.

### Exporte antes de reimprimir

O texto de uma edição reimpressa **não tem outro lugar onde morar** — a reimpressão o
substitui na tabela. Antes de rodar a corrida, tire-o e commite, como se fez com as sete
primeiras edições na janela da 1.9:

```bash
TZ=Europe/Brussels pnpm --filter @vitale/scripts revista:imprimir --massa \
  --exportar docs/specs/revista-retrospectiva/edicoes-substituidas-pela-2-3.md
git add docs/specs/revista-retrospectiva/ && git commit -m "docs(revista): o texto das cinco edições antes da reimpressão"
```

`--exportar` só lê: não chama modelo, não grava edição e não toca na capa. É a única saída
deste script que **contém o texto** das edições — o terminal continua sem mostrar nenhum. Ele
não combina com o `--sim-gastar-chamadas` nem com o `--limite`, e a recusa é antes da rede: a
exportação sai antes de imprimir, e o "sim" seria descartado em silêncio.

Três guardas, porque o arquivo é a **única cópia** do texto que vai ser substituído:

| O que houve | O que ele faz |
|---|---|
| o arquivo de destino já existe | recusa e não escreve nada (sai ≠0) — escolha outro nome |
| nenhum período da lista está como `reimprimir` | avisa e não escreve (sai ≠0): um arquivo só com cabeçalho pareceria uma exportação que deu certo |
| uma edição da lista volta **sem caderno nenhum** | escreve o resto, avisa qual ficou de fora e sai ≠0 — o texto dela não foi salvo |

### Se a corrida morrer no meio

**Não há o que consertar: rode de novo.** A retomada é o próprio banco — cada período é uma
transação pela função `edicao_imprimir`, e o que gravou está gravado. A corrida nova
reenumera, encontra no arquivo o que já existe e o marca como `pular`. Uma reimpressão
nomeada que já aconteceu também é pulada: ela passa a ter `pacote_versao` acima do 3 das
edições antigas, e é por esse carimbo que a corrida a reconhece. Não existe arquivo de
progresso, de propósito — seria um segundo lugar para a verdade morar, e ficaria podre na
primeira mudança da lista.

**Falha de um período não derruba a corrida.** Rede, prazo, conferência reprovada: o período
entra no relatório do fim, a corrida segue para o próximo, e rodar de novo o tenta outra vez
(ele continua sem edição no banco). O processo sai com **1** quando algum falhou:

```
a corrida terminou:
  gravadas: 47 · puladas: 6 · falhadas: 1 · 192 chamadas de nuvem
  as que falharam, e que rodar de novo tenta outra vez:
    Março 2024  2024-03-01  nada-gravado
```

**Mas três falhas SEGUIDAS param a corrida.** Falha seguida não é período ruim: é causa
comum — o refresh revogado, um 429, a cota do provedor —, e sem freio ela percorreria os ~50
períodos um a um, pagando o que a nuvem cobrar por cada tentativa. O que faltava não é
tentado, e a mensagem diz isso; conserte a causa e rode de novo, que a corrida retoma de
onde o banco parou.

**Não rode a massa com o iPhone imprimindo.** Vale a mesma regra de um período só, e a
mesma guarda: a porta relê a edição antes de gravar e recusa (`EdicaoMudouNaImpressao`) se o
conjunto de cadernos mudou no meio. Numa corrida de uma hora a janela é maior — o telefone
tem 53 oportunidades de esbarrar, em vez de uma. Se o telefone imprimir um período **antes**
de a corrida chegar nele, ele sai como **pulado**, não como falha: o trabalho está feito, e
insistir sobrescreveria a edição dele.

### O que estas edições carregam, e que ninguém vai avisar depois

As ~48 edições nascem com os defeitos de leitura que continuam abertos no `deferred-work` —
a borda de fuso do `done_at` (tarefa concluída entre 00:00 e 02:00 do primeiro dia da janela
fica de fora) e as bases externas B2/B3 sem o veredito de "medido" —, e a errata compara
`agg_version_no_momento`, não `pacote_versao`: **elas não se anunciam velhas depois**, então
consertar esses defeitos exige nomear os períodos numa reimpressão nova.

---

## `coreai/` — a casca do Core AI, e como ela vira binário (story 5.8)

O `CoreAILanguageModel`, que transforma **peso aberto** em frase, não vem no iOS: ele mora no
pacote Swift `apple/coreai-models`, que arrasta tokenizador, amostragem, KV-cache e uma
gramática em C++ — mais de vinte pacotes. E módulo Expo local só linka por `.podspec`: o
**CocoaPods não tem atributo de dependência de Swift Package**.

Então o grafo é compilado **aqui**, uma vez, fora do app:

```bash
./scripts/coreai/montar.sh        # ~10 min na primeira vez (clona o pacote e compila o grafo)
```

Saem dois arquivos, em `mobile/modules/on-device-engine/ios/vendor/ios-arm64/`:

| arquivo | o que é |
|---|---|
| `libOrbeCoreAI.a` (21,3 MiB) | o grafo inteiro, ligado por módulo, mais a casca. **Versionado** |
| `OrbeCoreAI.swiftinterface` | a interface da casca — e **só ela** |

**A casca (`coreai/OrbeCoreAI.swift`) é o truque inteiro.** Ela importa o pacote com
`internal import` e é compilada com `-enable-library-evolution`: a interface que sai **não
cita** `CoreAILanguageModels`. É por isso que o pod precisa de um `SWIFT_INCLUDE_PATHS` com um
arquivo dentro, em vez dos vinte e tantos `.swiftmodule` e dos mapas de módulo em C do grafo.
O `montar.sh` confere essa invariante com um `grep` antes de juntar o `.a` — trocar o
`internal import` por um `import` normal compila aqui e só quebraria no build do app.

**A casca não decide nada.** Ela devolve o erro **descrito** (nome do tipo, descrição, domínio
e código do `NSError`); quem o classifica é `MotorCoreAI.identificar`, que é fonte no
repositório, que as barreiras leem e que `aparelho:testar` percorre sem a biblioteca.

**Uma fatia só, `ios-arm64`, e não por economia:** o `CoreAI.framework` existe no
`iPhoneOS27.0.sdk` e **não existe** no `iPhoneSimulator27.0.sdk` (medido em 21/09/2026). No
simulador o pacote nem compila, e o motor aparece no seletor indisponível, com motivo.

Os **pesos** são outra coisa e não saem daqui: eles vêm do export em Python do próprio
`apple/coreai-models` (`uv run coreai.llm.export <id do HF> --platform iOS`), vão para
`mobile/modules/on-device-engine/ios/pesos/<nome>/` e são **gitignored** — 243,7 MiB por
conjunto, com um arquivo de 240,3 MiB dentro, acima do teto de 100 MB por arquivo do GitHub.

Rode os dois **antes do `pod install`**: o podspec decide no instante dele, e o que faltar
vira um app sem Core AI — com aviso no `pod install`, e o motor indisponível no seletor.
