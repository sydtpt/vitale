---
title: 'Pesquisa técnica: Gemini tier gratuito — limites, EEA e treinamento com o conteúdo'
type: 'technical'
topic: 'Gemini tier gratuito — limites, EEA e treinamento com o conteúdo'
decision: 'A camada de IA analítica do Orbe pode ir a produção no tier gratuito do Gemini, ou exige tier pago / outro provedor?'
source: 'run (fan-out web nativo)'
status: complete
preset: 'standard'
validation: 'normal'
shape: 'select'
created: '2026-09-06'
updated: '2026-09-06'
---

# Pesquisa técnica: Gemini tier gratuito — limites, EEA e treinamento com o conteúdo

**Decisão que esta pesquisa serve:** a camada de IA analítica do Orbe pode ir a produção no
tier gratuito do Gemini, ou exige tier pago / outro provedor?

## Sumário executivo

**O tier gratuito está fora — e não pelo motivo que se procurava.**

A pergunta que abriu a investigação era se o tier gratuito comportava o uso e se treinava com o
conteúdo enviado. A resposta é que **ele não pode ser usado**, por cláusula contratual, e que a
preocupação com treinamento **já estava resolvida a favor do usuário** por um motivo que
ninguém tinha considerado: a residência na Bélgica.

Três razões independentes, e qualquer uma sozinha basta:

1. **Proibição contratual.** *"You may use only Paid Services when making API Clients available
   to users in the European Economic Area, Switzerland, or the United Kingdom."* [1] Um
   servidor na Bélgica servindo um indivíduo belga é exatamente esse caso. O tier gratuito não
   é bloqueado por lista de países — é **excluído por restrição de uso**, mecanismo diferente e
   mais difícil de perceber, porque a chave provavelmente funciona.
2. **Dado de saúde.** *"Do not submit sensitive, confidential, or personal information to the
   Unpaid Services."* [3] Diretiva incondicional. O payload é série temporal de sono e FC de
   pessoa identificável — categoria especial do Artigo 9 do RGPD. Só o caminho pago nomeia um
   DPA com o Google como **operador**; o gratuito aponta para a Política de Privacidade e uma
   licença de conteúdo ao Google.
3. **Não é dimensionável.** O Google **removeu** os números de RPM/RPD/TPM do tier gratuito da
   documentação pública [4]. Três páginas oficiais apontam umas para as outras e depois para um
   painel com login. Não existe build que se possa planejar contra números que não são
   publicados — e há precedente de corte de ~92% da noite para o dia, com funcionário do Google
   admitindo que agem primeiro e comunicam depois [5].

**A ironia da investigação:** a mesma cláusula que desqualifica o usuário do tier gratuito —
estar na EEA — é a que **já lhe concede** a proteção de dados do tier pago em tudo, inclusive na
cota gratuita [2]. A pergunta 3 do plano ("o tier gratuito treina com o conteúdo?") tinha
resposta favorável por geografia, e não importa, porque a pergunta 1 fecha a porta antes.

### Veredito

| Candidato | G1 Bélgica | G2 dado de saúde | G3 folga | Resultado |
|---|---|---|---|---|
| **Tier gratuito** | ✗ proibido por termo | ✗ diretiva incondicional | ✗ não publicado | **eliminado** |
| **Tier pago (Gemini)** | ✓ | ✓ DPA de operador | ✓ teto US$ 250 no Tier 1 | **escolhido** |
| Outro provedor | não avaliado | — | — | reserva |

**A escolha é o tier pago do Gemini, em projeto Google Cloud separado.** O custo continua
desprezível — a hipótese de 21/08 se sustenta, só mudou de tier: ~68 chamadas/ano sobre dados
já resumidos, em modelos de classe Flash, não chega a unidades de dólar por ano. O que a
pesquisa derruba não é o custo: é a premissa de que "gratuito" era uma opção disponível.

**Vice-campeão e quando ele ganha:** outro provedor (Anthropic, OpenAI, Mistral) passa a ser a
escolha se o DPA do Google, não lido nesta pesquisa, se revelar inadequado para dado de saúde,
ou se o ZDR for inacessível a conta de desenvolvedor individual. Ambos estão nas questões
abertas.

**O argumento mais forte contra a escolha:** o veredito assenta sobre a leitura literal de uma
cláusula de "Use Restrictions" escrita para quem *distribui* um app a terceiros. Um
desenvolvedor que é o único usuário do próprio app pode razoavelmente argumentar que não está
"making API Clients available to users". O Google não trata esse caso. A leitura conservadora
adotada aqui custa alguns dólares por ano e compra tranquilidade sobre dado de saúde — mas é
leitura, não fato.

**A cobertura reversível mais barata:** a superfície é uma edge function e uma tabela de cache
([ADR 0038](../../../../docs/decisions/0038-a-chamada-ao-modelo-sai-da-edge-function.md)).
Trocar de provedor não move nada do domínio.

---

## D1 — Limites reais do tier gratuito

A dimensão fechou por **exaustão de novidade**, e o motivo é ele próprio o achado.

**Os números não existem em fonte pública.** A página oficial de rate limits diz que os limites
*"depend on a variety of factors (such as your usage tier) and can be viewed in Google AI
Studio"* e remete a `aistudio.google.com/rate-limit`, que exige login e é específico da conta
[4]. A página de quotas do Firebase AI Logic fecha a circularidade: também não traz números e
devolve para o ai.google.dev [4]. Não é lacuna de pesquisa — é decisão do Google de tornar
esses números específicos da conta e dinâmicos em vez de documentados. Mais buscas não os criam.

O que **é** oficialmente sourceável:

- Sete modelos constam como elegíveis ao tier gratuito na página de preços de 04/09/2026, do
  2.5 Pro aos 3.x Flash e Flash-Lite. Isso contradiz a alegação difundida por agregadores de
  que o Pro teria saído do gratuito em abril/2026 — a fonte primária diz o contrário. Ressalva:
  um modelo pode constar como elegível e ter RPD perto de zero.
- Os limites valem **por projeto**, não por chave, em três dimensões independentes: RPM, TPM de
  entrada e RPD [4].
- Estourar devolve **HTTP 429 `RESOURCE_EXHAUSTED`** — rejeição, não fila nem throttle suave.
- O RPD zera em **janela de calendário, meia-noite no Pacífico**. Para a Bélgica, a virada cai
  por volta das 09:00 locais — uma análise noturna divide a mesma cota com a manhã anterior.
- O tier gratuito **não tem cobrança por excedente**: teto de gasto "N/A" e tokens "Free of
  charge", então o modo de falha é 429 duro, não fatura surpresa. *Confiança média-alta —
  inferência de dois fatos oficiais, não frase explícita.*

**O risco que a dimensão realmente expôs é de estabilidade.** Em 12/2025 o Flash caiu de 250
para 20 RPD (~92%) sem post de blog; Logan Kilpatrick, do Google, respondeu no fórum oficial que
"turn down the free tier for some models" e que precisam "act quickly" em vez de pré-anunciar
[5]. Os números têm nove meses e estão vencidos — **o precedente é o que vale**: o tier gratuito
muda debaixo de quem depende dele.

## D2 — EEA/Bélgica: disponibilidade e treinamento

Fonte governante: os **Gemini API Additional Terms of Service**, cabeçalho *"Effective March 23,
2026"*, rodapé *"Last updated 2026-04-28 UTC"*, acessados em 06/09/2026.

A dimensão encontrou **duas cláusulas, em seções diferentes, que puxam para lados opostos** — e
confundi-las é o erro que esta pesquisa existiu para evitar.

**A cláusula favorável — uso de dados.** Desenvolvedor na EEA recebe os termos de dados de *Paid
Services* para **tudo**, inclusive AI Studio e a cota gratuita da API [2]:

> "If you're in the European Economic Area, Switzerland, or the United Kingdom, the terms under
> 'How Google uses Your Data' in 'Paid Services' apply to all Services, including Google AI
> Studio and unpaid quota in the Gemini API, even though they are offered free of charge."

O gatilho é a localização do **próprio desenvolvedor**. Lido ao pé da letra: conteúdo enviado da
Bélgica não é usado para treinar, mesmo na cota gratuita. Fora da EEA, o contrário é explícito —
o conteúdo *é* usado para "provide, improve, and develop Google products and services and
machine learning technologies", e "human reviewers may read, annotate, and process your API
input and output" [3].

**A cláusula restritiva — permissão de uso.** Em "Use Restrictions" [1]:

> "You may use only Paid Services when making API Clients available to users in the European
> Economic Area, Switzerland, or the United Kingdom."

Um servidor na Bélgica servindo um indivíduo belga disponibiliza um API Client a um usuário na
EEA. Em leitura direta, cenário exclusivo de tier pago.

**E a diretiva que sobrevive às duas** [3]:

> "Do not submit sensitive, confidential, or personal information to the Unpaid Services."

Incondicional, na seção de Unpaid Services. A ressalva da EEA muda os *termos de uso de dados*
aplicáveis; não revoga visivelmente essa frase.

### Retenção — onde o "55 dias" engana

Os termos **não publicam prazo numérico de retenção para nenhum dos dois tiers** — só "a limited
period of time" para Paid Services [6]. O número de 55 dias que circula é de outra coisa: logs
opcionais de propriedade do desenvolvedor, disponíveis **só em projetos com faturamento**,
configuráveis em 7/14/28/55 dias, e que por padrão não alimentam melhoria de produto. Só viram
dado de treino se o desenvolvedor deliberadamente montar um dataset e compartilhá-lo.

Retenção zero de verdade exige **ZDR aprovado por projeto**; sem isso existem logs de antiabuso
com prompts e respostas. E alguns recursos retêm em qualquer tier, sem opt-out — Grounding com
Search e Maps guardam prompt, contexto e saída por 30 dias, *"no way to disable"*. Consequência
prática de desenho: **a camada do Orbe não deve usar grounding.**

**Nenhum prazo de retenção para conteúdo de Unpaid Services foi encontrado em fonte primária
alguma.** A logs-policy cobre explicitamente só projetos com faturamento. Quanto tempo os
prompts do tier gratuito persistem, e se são apagados, não está documentado. Lacuna real, e
pesa contra o gratuito para dado de saúde.

### O que decide, no fim

Sob o RGPD o payload é dado de saúde, categoria especial do Artigo 9. Só o caminho pago nomeia
um **Data Processing Addendum com o Google como operador**; o gratuito aponta para a Política de
Privacidade e uma licença de conteúdo. **Essa assimetria pesa mais que a cláusula de
treinamento** — e continua pesando mesmo com a ressalva da EEA a favor.

## D3 — Faturamento e determinação de tier

A cadeia é **conta de faturamento → projeto → chave**, e cada elo está documentado [6]:

> "Tiers, rate limits, and billing account caps are all determined at the billing account
> level."

> "All projects linked to a Cloud Billing account inherit the billing account's usage tier and
> associated rate limits and account caps."

> "API keys are credentials generated inside a project. They have no independent billing
> settings; they inherit the tier limits and billing status of the project."

Chave do AI Studio **é** chave de projeto do Google Cloud — não são objetos distintos: *"Every
Gemini API key is associated with a Google Cloud project."* E quem já tem conta Cloud não ganha
projeto padrão automático; precisa importar um existente.

**Resposta ao ponto que motivou a dimensão:** sim, gerar a chave do Gemini no projeto que já
hospeda a `GOOGLE_BOOKS_API_KEY` a põe no tier pago, **em silêncio**, se aquele projeto tiver
conta de faturamento vinculada. A qualificação do tier gratuito é "Active project" *sem*
faturamento; vinculado, a do Tier 1 está satisfeita por definição.

*Ressalva registrada como não verificada* [7]: nenhuma frase do Google trata este cenário exato.
A conclusão aplica uma regra enunciada sem condicionantes e sem exceção por qual API causou o
faturamento — é inferência sólida, não citação.

**Ruga operacional nova, e ela morde.** Desde 23/03/2026, o tier pago *"will only serve requests
if you have a positive Prepay credit balance"*. Uma conta Postpay antiga pode deixar o projeto
em "Set up Prepay" ou "No credits" — o modo de falha realista **não é fatura surpresa, é
classificação como pago com requisições recusadas**, sem nunca cair de volta nos limites
gratuitos. Some-se a armadilha do crédito: contas abertas depois de 02/03/2026 não podem gastar
crédito de boas-vindas do Cloud em Gemini API nem AI Studio, e um projeto de agosto/2026 está
dentro dessa janela.

**Separar por projeto é o padrão sancionado** [6]: *"You can switch between Paid Tier projects
and Free Tier projects as needed by using the respective API keys linked to each type."*

> **Onde D3 e D2 se cruzam, e a recomendação vira do avesso.** D3, sozinha, recomendaria
> *projeto novo **sem** faturamento* para preservar o tier gratuito. D2 elimina o tier gratuito.
> Logo a recomendação correta é **projeto novo COM faturamento** — separado do Books não para
> escapar da cobrança, mas para isolar teto de gasto, tier e logs de um projeto que serve outra
> coisa. Nenhuma das duas dimensões chega sozinha a essa conclusão.

## Ação seguinte, e ela é de um minuto

Antes de qualquer linha de código, abrir `https://aistudio.google.com/projects` e ler a coluna
**Billing Tier**. É a verdade específica da conta, e resolve de uma vez o status do projeto do
Books e o estado de Prepay. Depois, `https://aistudio.google.com/rate-limit` para os números
reais por modelo — os únicos que existem.

Nenhuma pesquisa substitui essas duas telas.

## Questões abertas

| # | Questão | Por que importa | Rota |
|---|---|---|---|
| 1 | O **DPA** (`cloud.google.com/terms/data-processing-addendum`) não foi lido | governa suboperadores, transferências internacionais/SCC e exclusão — a substância do RGPD no caminho pago | leitura dirigida |
| 2 | **ZDR**: elegibilidade para conta de desenvolvedor individual, ou só enterprise? | é o único caminho a retenção zero real | leitura + eventual pedido |
| 3 | **Gen AI Prohibited Use Policy** não lida | verificar se inferência médica/saúde é uso restrito | leitura dirigida |
| 4 | Status de faturamento do projeto do Books | decidiria D3 sozinho; irrelevante para o veredito porque D2 exige pago de qualquer forma | a tela de um minuto |
| 5 | "Projetos gratuitos ilimitados" não verificado | a doc não publica limite por pessoa; ausência de cláusula não prova ausência de prática | — |
| 6 | Versão anterior dos termos não recuperada | não dá para datar quando a ressalva da EEA entrou | Wayback |

## Fontes

| # | Fonte | Publicador | Data |
|---|---|---|---|
| [1] | [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) — Use Restrictions | Google | Effective 2026-03-23 · rodapé 2026-04-28 |
| [2] | [idem](https://ai.google.dev/gemini-api/terms) — ressalva EEA/Suíça/UK | Google | Effective 2026-03-23 |
| [3] | [idem](https://ai.google.dev/gemini-api/terms) — Unpaid Services / uso de dados | Google | Effective 2026-03-23 |
| [4] | [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Firebase AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas?api=dev) | Google | 2026-09-02 · 2026-09-04 · 2026-09-01 |
| [5] | [Fórum: corte de 92% na cota gratuita](https://discuss.ai.google.dev/t/do-they-really-think-we-wouldnt-notice-a-92-free-tier-quota/111262) — resposta de funcionário | Fórum oficial Google | 2025-12-06 · **vencido** |
| [6] | [Billing](https://ai.google.dev/gemini-api/docs/billing) · [API keys](https://ai.google.dev/gemini-api/docs/api-key) | Google | undated, referencia mudanças de 2026-03 |
| [7] | [Logs policy](https://ai.google.dev/gemini-api/docs/logs-policy) · [Zero data retention](https://ai.google.dev/gemini-api/docs/zdr) | Google | undated |
| [8] | [Available regions](https://ai.google.dev/gemini-api/docs/available-regions) | Google | rodapé 2026-04-28 |

**Validade:** relatório de forma *select*. Os termos do Gemini mudaram em 03/2026 e a página de
preços foi atualizada em 04/09/2026 — dois dias antes desta pesquisa. **Reconferir antes de agir
se passarem dois trimestres**, e reconferir os termos a qualquer momento antes do deploy.
