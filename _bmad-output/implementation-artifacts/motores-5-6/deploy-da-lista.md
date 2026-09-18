# O deploy da lista de motores de nuvem (story 5.6)

Escrito em 18/09/2026, ao fechar a implementação da 5.6.

Este arquivo é para ser seguido **na hora**, com o terminal aberto. Ele existe porque a
regra que mais importa aqui — **nenhum provedor entra na lista sem a tabela de regime
versionada** (AD-9 / ADR 0048) — não tem barreira mecânica possível: a lista mora num
`secret`, fora do git. Nenhum teste a alcança. Então ela mora aqui, no caminho de quem
vai rodar o comando, e não só no cabeçalho de um `.ts` que ninguém abre para rodar CLI.

---

## 1. A boa notícia: aqui não há janela

Diferente da 1.9, **as duas pontas se aguentam nos dois sentidos**. Não existe intervalo
em que algo quebra.

| Quem | Contra a function VELHA | Contra a function NOVA |
|---|---|---|
| App instalado hoje | funciona | **funciona** |
| Build da 5.6 | **funciona** (degrada) | funciona |

Por quê, em detalhe:

- **O app velho contra a function nova.** A function trocou `{error, detalhe}` por
  `{classe, detalhe}`, mas o `STATUS_POR_CLASSE` foi escolhido para **coincidir onde os
  dois se tocam**: 503 segue 503, 413 segue 413, 502 segue 502. Onde não coincide, a
  classe a que o cliente velho chega pelo status continua segura — `json_invalido` e
  `prompt_vazio` foram de 400 para 422, e a tabela do cliente velho mapeia os dois para
  `capacidade`, que recua sem aumentar exposição. A única perda é cosmética: o `detalhe`
  do erro perde o prefixo `error`, o que só aparece na tela de desenvolvimento.
- **O build novo contra a function velha.** O `GET` responde 405, e a leitura da lista
  devolve **`null`** — não lista vazia. A distinção é deliberada e tem teste
  (`motores-lista.test.ts`, *"a function ainda não deployada (405, AC 3) é null — nunca
  lista vazia"*): `null` é "não perguntei ainda", lista vazia é "perguntei e não há
  nenhum". Com `null`, o catálogo mostra só o que o app conhece por conta própria, e
  **`nuvem:padrao` continua de pé**.

**Ainda assim, a ordem é deploy → build.** Não porque algo quebre, mas porque o contrário
entrega ao dono um seletor que promete uma lista que o servidor ainda não sabe responder.

## 2. O portão que não tem teste: a tabela de regime

**Não escreva um `MotorId` nomeado no secret sem a tabela de regime daquele provedor
versionada em `docs/`.** Esta é a única regra deste arquivo que nenhuma máquina cobra.

A tabela precisa de seis campos (AD-9):

| Campo | O que responde |
|---|---|
| tier | pago ou gratuito — e é isso que costuma decidir o uso para treino |
| o que pode ser enviado | dado de saúde? nome? localização? |
| retenção | por quanto tempo o provedor guarda prompt, contexto e saída |
| DPA | existe acordo de processamento de dados, e sob qual jurisdição |
| uso para treino | o conteúdo alimenta o modelo do fornecedor? |
| guardrails | o que o filtro do provedor faz, e o que acontece quando ele bloqueia |

**Hoje a lista fica vazia**, por decisão do próprio spec da 5.6 (`Never`: *"a lista do
servidor continua nomeando só `nuvem:padrao` hoje; esta story entrega a mecânica, não um
segundo provedor ao vivo"*). Como `nuvem:padrao` **nunca entra na lista** — o leitor do
núcleo o rejeita —, nenhum provedor entra, e o portão não é acionado por esta story.

> ⚠️ **Divergência conhecida, aberta em 18/09/2026.** O `epics.md` diz o contrário do
> spec: *"os dois recursos que existem entram aprovados para o modelo em produção hoje"*.
> O spec aprovado vence, e a lista fica vazia. Mas se o dono decidir que a variante
> nomeada do Google deve existir, **a tabela de regime do Google vira pré-requisito deste
> deploy** — e ela não existe ainda. Três dos seis campos (tier, DPA, uso para treino)
> não se deduzem do código: só o dono sabe em que faturamento a conta está.

O que o código **prova** hoje sobre o provedor em produção, e que já serve de rascunho:

- provedor `google`, em `generativelanguage.googleapis.com/v1beta`, chave `GEMINI_API_KEY`;
- **`tools` não é enviado, de propósito** — grounding retém prompt, contexto e saída por
  30 dias em qualquer tier, sem opt-out (registrado em `_shared/ia/narrador.ts`);
- **`safetySettings` não é definido** → valem os padrões do provedor;
- temperatura 0,4, teto de 8.000 tokens de saída, prazo de 30 s no adaptador.

## 3. O formato do secret

`NUVEM_MOTORES_APROVADOS` é um JSON de `MotorDeNuvemAprovado[]`:

```json
[
  { "motor": "nuvem:google/gemini-2.5-flash", "recursos": ["saude-do-sono", "retrospectiva"] }
]
```

- `motor` **só** aceita `nuvem:<provedor>/<modelo>`. `sem-modelo`, `aparelho:*` e
  `nuvem:padrao` são descartados em silêncio pelo leitor do núcleo — o padrão não precisa
  de lista, e os outros dois tipos não são desta lista.
- `recursos` são os ids do catálogo do núcleo: `saude-do-sono`, `retrospectiva`,
  `nome-de-rota`. **Só entram os que passaram na bancada**, e só a partir de um relatório
  dela (ADR 0050).
- **Entrada malformada é descartada sozinha, e as demais passam.** Um secret quebrado não
  derruba a narração: a lista fica vazia e `nuvem:padrao` segue elegível.
- Secret ausente = lista vazia. É o estado de hoje, e é um estado válido.

## 4. O roteiro

### Antes (sem pressa)

1. A branch `feat/motores-5-6` está mergeada na `main`? O deploy sai da `main`, nunca de
   uma branch — mesma lição do `eas update` de 13/09.
2. Vai escrever algum `MotorId` nomeado? Então **volte à seção 2** e escreva a tabela de
   regime primeiro. Se a lista vai ficar vazia, siga.
3. Os oito gates verdes no commit que vai subir (`shared` lint+test, `web` build+test,
   `scripts` lint+test, `mobile` tsc+jest).

### O deploy

4. A function, da `main`:
   ```bash
   supabase functions deploy ia-narrar --project-ref vitale
   ```
5. O secret, **só se houver entrada nomeada** (com a tabela de regime já escrita):
   ```bash
   supabase secrets set NUVEM_MOTORES_APROVADOS='[...]' --project-ref vitale
   ```
   Sem entrada nomeada, **não defina o secret** — ausente já significa lista vazia.
6. Confira que a function responde ao GET com a lista (JWT de usuário, nunca chave de
   serviço) e que o POST sem `motor` continua narrando como antes.

### Depois

7. **Só então** o build que lê a lista. Antes disso o app degrada de propósito, mas o
   seletor estaria prometendo o que o servidor não responde.
8. No iPhone: abrir `/configuracoes/motores` e confirmar que a lista bate com o secret —
   vazio mostra as três linhas de sempre; com entrada nomeada, ela aparece **depois** do
   `nuvem:padrao` e só nos recursos em que foi aprovada.

## 5. Se der errado

- **O GET devolve 500 ou HTML.** O secret provavelmente tem JSON quebrado. O leitor
  engole e devolve lista vazia, então não deveria acontecer — mas se acontecer, apague o
  secret (`supabase secrets unset NUVEM_MOTORES_APROVADOS`) e a narração volta ao padrão.
- **Um motor nomeado aparece no seletor e não escreve.** Ele está na lista mas o provedor
  o recusa: a tela diz a classe. `indisponivel` costuma ser modelo inexistente ou chave
  sem acesso; `capacidade`, o modelo não atende aquele pedido.
- **Nada disso derruba `nuvem:padrao`.** Se ele parar de escrever, a causa é outra — chave,
  cota ou rede —, e não esta lista.
