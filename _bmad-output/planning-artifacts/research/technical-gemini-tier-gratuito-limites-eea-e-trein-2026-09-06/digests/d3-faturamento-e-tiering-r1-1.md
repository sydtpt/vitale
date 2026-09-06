# D3 — Faturamento e determinação de tier · rodada 1

## Achados

**1. O tier é determinado no nível da CONTA DE FATURAMENTO**, não da chave.
> "Tiers, rate limits, and billing account caps are all determined at the billing account level."

`source: https://ai.google.dev/gemini-api/docs/billing.md.txt | publisher: Google | pub_date: undated (referencia mudanças de 2026-03-23 e 2026-03-02) | accessed: 2026-09-06 | confidence: high | class: tiering`

**2. Todo projeto vinculado a uma conta de faturamento HERDA o tier dela, automaticamente.**
> "All projects linked to a Cloud Billing account inherit the billing account's usage tier and
> associated rate limits and account caps."

`source: idem | confidence: high | class: tiering`

**3. Chaves de API não têm tier próprio — herdam o do projeto.**
> "API keys are credentials generated inside a project. They have no independent billing
> settings; they inherit the tier limits and billing status of the project."

`source: idem | confidence: high | class: key-model`

**4. Qualificação: Free = "Active project" (teto N/A); Tier 1 = "Set up and link an active
billing account" (teto US$ 250); Tier 2 = US$ 100 + 3 dias; Tier 3 = US$ 1.000 + 30 dias.**
`source: idem | confidence: high | class: tiering`

**6. Separar tiers por projeto é o padrão documentado e sancionado.**
> "You can switch between Paid Tier projects and Free Tier projects as needed by using the
> respective API keys linked to each type."

E o caminho de volta: "You can unlink a project from its billing account to return to the free
tier."
`source: idem | confidence: high | class: tiering`

**7. Chave do AI Studio É chave de projeto do Google Cloud — não são objetos distintos.**
> "Every Gemini API key is associated with a Google Cloud project."

Quem já tem conta Cloud não ganha projeto padrão automático: precisa importar um existente pela
página de Projetos do AI Studio.
`source: https://ai.google.dev/gemini-api/docs/api-key | publisher: Google | pub_date: undated | accessed: 2026-09-06 | confidence: high | class: key-model`

**8. O tier pago exige saldo Prepay positivo, e projeto com faturamento mas sem Prepay fica num
estado bloqueado próprio.**
> "Unlike the free tier, paid tier status is dynamic; while your usage tier is determined by
> your account history, the Gemini API will only serve requests if you have a positive Prepay
> credit balance."

A página de Projetos mostra "Set up billing", "Set up Prepay" ou "No credits". Prepay/Postpay
passou a valer em 23/03/2026.
`source: https://ai.google.dev/gemini-api/docs/billing.md.txt | confidence: high | class: billing`

**9. O tier pago também muda o tratamento de dados** — vincular faturamento é o que garante que
prompts e respostas **não** sejam usados para melhorar produtos do Google.
`source: idem | confidence: high | class: tiering`

## Resposta direta ao ponto

**Sim — reusar aquele projeto põe a chave do Gemini no tier pago, e isso acontece em silêncio.**
A cadeia é conta de faturamento → projeto → chave, e o projeto do Books já está no topo dela.
A qualificação do tier gratuito é "Active project" *sem* conta de faturamento vinculada; no
instante em que uma é vinculada, a qualificação do Tier 1 está satisfeita por definição.

**Ressalva honesta:** nenhuma frase do Google trata deste cenário exato ("habilitei faturamento
para outra API, o que acontece com o Gemini?"). A conclusão é aplicação direta de uma regra
enunciada sem condicionantes e sem exceção por qual API causou o faturamento — mas é
**inferência**, não citação da resposta à pergunta como posta.

Segunda ruga, que agrava o risco prático: como o tier pago "will only serve requests if you have
a positive Prepay credit balance", uma conta Postpay antiga pode deixar o projeto em "Set up
Prepay"/"No credits" — o modo de falha realista não é fatura surpresa, é **classificação como
pago com requisições recusadas até o Prepay ser financiado**, sem jamais cair de volta nos
limites gratuitos.

**Correção documentada e barata:** projeto separado, sem conta de faturamento vinculada, e a
chave do Gemini gerada nele. O Google endossa rodar os dois. Manter a chave do Books onde está;
não importar o projeto do Books para o AI Studio.

## Leads

- **Página de Projetos do AI Studio (`aistudio.google.com/projects`) é a verdade de campo** — a
  coluna *Billing Tier* mostra o tier real de cada projeto e a ação exigida. Antes de escrever
  código, ler essa coluna para o projeto do Books.
- `https://aistudio.google.com/rate-limit` — tabela de limites ao vivo, com login.
- **Armadilha do crédito de US$ 300:** contas abertas depois de 02/03/2026 não podem gastar
  crédito de boas-vindas do Cloud em Gemini API nem AI Studio. Um projeto de agosto/2026 está
  dentro dessa janela.

## O que se procurou e NÃO se achou

- **Nenhum limite documentado de quantos projetos no tier gratuito uma pessoa pode ter.** A
  qualificação é por *projeto*, o que sugere que um projeto novo sem vínculo qualifica — mas a
  ausência de cláusula antiabuso na doc não prova que não haja uma na prática. Tratar
  "projetos gratuitos ilimitados" como **não verificado**.
- **Nenhuma frase respondendo o cenário exato.** A resposta é montada a partir da regra de
  herança; sinalizado como inferência em vez de vestido de citação.
- **Nenhum fallback gratuito documentado.** Nada diz que projeto pago ainda recebe cota
  gratuita em modelos elegíveis antes de o faturamento entrar. A doc descreve tier como estado
  único do projeto, o que argumenta contra existir fallback — mas o negativo não é afirmado.
- **Status de faturamento da Google Books API: não estabelecido.** A busca única alocada não
  resolveu. **É o fato de que toda a questão depende: se aquele projeto não tem conta de
  faturamento vinculada, não há problema a resolver.** Uma olhada no console de billing ou na
  página de Projetos do AI Studio encerra.
