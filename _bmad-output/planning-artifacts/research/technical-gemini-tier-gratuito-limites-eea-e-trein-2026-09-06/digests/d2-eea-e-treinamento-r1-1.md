# D2 — EEA/Bélgica: disponibilidade e treinamento com o conteúdo · rodada 1

Fonte governante: **https://ai.google.dev/gemini-api/terms** — cabeçalho "Effective March 23,
2026"; rodapé "Last updated 2026-04-28 UTC". Acessado 2026-09-06.

## Achados

**1. Gemini API e AI Studio estão disponíveis na Bélgica.** A Bélgica consta da lista oficial
de regiões (195+ países); a página não distingue EEA/UK/Suíça e **não publica lista de regiões
própria do tier gratuito**.
`source: https://ai.google.dev/gemini-api/docs/available-regions | publisher: Google | pub_date: rodapé "Last updated 2026-04-28 UTC" | accessed: 2026-09-06 | confidence: high | class: availability`

**2. Os termos PROÍBEM usar o tier gratuito para servir usuários na EEA, Suíça ou Reino Unido
— exige-se Paid Services.** Está em "Use Restrictions", seção distinta da de uso de dados.
`source: https://ai.google.dev/gemini-api/terms | publisher: Google | pub_date: Effective 2026-03-23 | accessed: 2026-09-06 | confidence: high | class: availability`

**3. Globalmente, conteúdo do tier gratuito ("Unpaid Services") É usado para desenvolver e
melhorar produtos e tecnologias de aprendizado de máquina do Google, e revisores humanos podem
lê-lo.** Os termos ainda dizem, sem condicionar: não submeta informação pessoal aos Unpaid
Services.
`source: https://ai.google.dev/gemini-api/terms | publisher: Google | pub_date: Effective 2026-03-23 | accessed: 2026-09-06 | confidence: high | class: training`

**4. Conteúdo de Paid Services NÃO é usado para melhorar produtos do Google**, e é processado
sob o Data Processing Addendum em que o Google é operador (processor).
`source: https://ai.google.dev/gemini-api/terms | publisher: Google | pub_date: Effective 2026-03-23 | accessed: 2026-09-06 | confidence: high | class: training`

**5. CRÍTICO — para quem está na EEA, os termos de dados de Paid Services valem para TODOS os
serviços, inclusive a cota gratuita, mesmo sendo de graça.** O gatilho é a localização do
desenvolvedor.
`source: https://ai.google.dev/gemini-api/terms | publisher: Google | pub_date: Effective 2026-03-23 | accessed: 2026-09-06 | confidence: high | class: training`

**6. Não há período numérico de retenção publicado para nenhum dos tiers** nos termos — só
"a limited period of time" para Paid Services. Zero ocorrências de "retention" ou contagem de
dias no texto dos termos; os únicos 30 dias são de Grounding com Search/Maps.
`source: https://ai.google.dev/gemini-api/terms | publisher: Google | pub_date: Effective 2026-03-23 | accessed: 2026-09-06 | confidence: high | class: retention`

**7. Os "55 dias" são de outra coisa** — logs opcionais de propriedade do desenvolvedor,
disponíveis **só em projetos com faturamento**, configuráveis em 7/14/28/55 dias. Por padrão
não são usados para melhoria de produto; só viram dado de treino se o desenvolvedor
deliberadamente montar um dataset e compartilhá-lo, e aí os termos de Unpaid Services passam a
valer para o dataset.
`source: https://ai.google.dev/gemini-api/docs/logs-policy | publisher: Google | pub_date: undated | accessed: 2026-09-06 | confidence: high | class: retention`

**8. Retenção zero de verdade no tier pago exige pedido de ZDR aprovado por projeto**; sem
isso existem logs de antiabuso com prompts e respostas.
`source: https://ai.google.dev/gemini-api/docs/zdr | publisher: Google | pub_date: undated | accessed: 2026-09-06 | confidence: high | class: retention`

**9. Alguns recursos retêm dado em qualquer tier e não têm opt-out** — Grounding com Search e
com Maps guardam prompt, contexto e saída por 30 dias, "no way to disable"; Live API guarda
estado por até 24 h; arquivos da File API persistem até serem apagados.
`source: https://ai.google.dev/gemini-api/docs/zdr | publisher: Google | pub_date: undated | accessed: 2026-09-06 | confidence: high | class: retention`

**10. A página de preços apresenta o gratuito como "used to improve our products" e o pago
como não** — sem qualificador regional impresso ali.
`source: https://ai.google.dev/gemini-api/docs/pricing | publisher: Google | pub_date: rodapé "Last updated 2026-09-04 UTC" | accessed: 2026-09-06 | confidence: medium (lido via sumarizador, não no texto cru) | class: training`

## Citações literais

Todas de `https://ai.google.dev/gemini-api/terms` salvo indicação:

> "Unpaid Services — Any Services that are offered free of charge like direct interactions with
> Google AI Studio or unpaid quota in Gemini API are unpaid Services (the "Unpaid Services")."

> "When you use Unpaid Services, including, for example, Google AI Studio and the unpaid quota
> on Gemini API, Google uses the content you submit to the Services and any generated responses
> to provide, improve, and develop Google products and services and machine learning
> technologies, including Google's enterprise features, products, and services, consistent with
> our Privacy Policy."

> "To help with quality and improve our products, human reviewers may read, annotate, and
> process your API input and output."

> **"Do not submit sensitive, confidential, or personal information to the Unpaid Services."**

> **"If you're in the European Economic Area, Switzerland, or the United Kingdom, the terms
> under "How Google uses Your Data" in "Paid Services" apply to all Services, including Google
> AI Studio and unpaid quota in the Gemini API, even though they are offered free of charge."**

> **"You may only access the Services (or make API Clients available to users) within an
> available region. You may use only Paid Services when making API Clients available to users
> in the European Economic Area, Switzerland, or the United Kingdom."**

> "When you use Paid Services … Google doesn't use your prompts … or responses to improve our
> products, and will process your prompts and responses in accordance with the Data Processing
> Addendum for Products Where Google is a Data Processor."

> "Your access to Gemini API is a "Paid Service" only when accessing the API through a Cloud
> Project associated with an active billing account."

De `https://ai.google.dev/gemini-api/docs/logs-policy`:

> "Logs are retained for a default maximum period of 55 days. … The storage retention window
> for a project can be updated in AI Studio to automatically mark logs for deletion after 7,
> 14, 28, or 55 days."

> "By default, because logging is only available for billing-enabled projects, prompts and
> responses within logs are not used for product improvement or development."

De `https://ai.google.dev/gemini-api/docs/zdr`:

> "When your request for ZDR for a particular project is approved, all user content (prompts
> and responses) and identifiable metadata (such as IP addresses and Google Account IDs) are
> cleared prior to logging."

## EEA × resto do mundo

Os termos divergem, e divergem em **duas cláusulas de seções diferentes que não podem ser
confundidas**:

1. **Uso de dados — a favor.** Desenvolvedor na EEA recebe os termos de dados de *Paid
   Services* para *tudo*, inclusive a cota gratuita. Lido ao pé da letra: conteúdo enviado da
   Bélgica no tier gratuito não é usado para treinar, e cai sob o DPA de operador. O gatilho é
   a localização do próprio desenvolvedor.
2. **Permissão de usar o tier gratuito — contra.** As Use Restrictions dizem que só Paid
   Services podem ser usados "when making API Clients available to users in the European
   Economic Area, Switzerland, or the United Kingdom". Um servidor na Bélgica servindo um
   indivíduo belga está disponibilizando um API Client a um usuário na EEA. Em leitura direta,
   é cenário exclusivo de tier pago, e usar o gratuito ali viola os termos — **mesmo com** a
   proteção de dados já concedida.

Conclusão honesta para esta decisão: o tier gratuito **não é bloqueado por lista de países; é
excluído contratualmente pela restrição de uso**, enquanto a proteção contra treinamento que se
queria já vem por residência.

Dois pontos que pesam sobre enviar 288 noites de sono e FC de uma pessoa identificável:

- "Do not submit sensitive, confidential, or personal information to the Unpaid Services" é
  diretiva incondicional na seção de Unpaid Services. A ressalva da EEA muda os *termos de uso
  de dados* aplicáveis; não revoga visivelmente essa frase.
- Sob o RGPD esse payload é dado de saúde, categoria especial do Artigo 9. Só o caminho pago
  nomeia um DPA com o Google como operador; o gratuito aponta para a Política de Privacidade e
  uma licença de conteúdo ao Google. **Essa assimetria pesa mais que a cláusula de treinamento.**

## Leads

- O **DPA** (cloud.google.com/terms/data-processing-addendum) não foi lido — governa
  suboperadores, transferências internacionais/SCC e exclusão. É a substância do RGPD no
  caminho pago.
- **Processo de ZDR**: critérios de elegibilidade e formulário não recuperados. Confirmar se
  vale para conta de desenvolvedor individual ou só contrato enterprise.
- **Gen AI Prohibited Use Policy** não lida — verificar se inferência médica/saúde é uso
  restrito.
- Post de Logan Kilpatrick (Google) no X alegando expansão do tier gratuito a 35 países
  "incluindo UE e Reino Unido" apareceu na busca, **não foi aberto**, não é fonte primária e
  pode ser anterior aos termos atuais. Tratar como não verificado; a página de termos governa.

## O que se procurou e NÃO se achou

- **Nenhuma lista de países do tier gratuito** em fonte primária. Não dá para confirmar que o
  gratuito seja tecnicamente *bloqueado* na Bélgica — a evidência é de proibição *contratual*,
  mecanismo diferente. Uma chave criada da Bélgica pode muito bem funcionar; isso não a torna
  permitida.
- **Nenhum prazo de retenção publicado para conteúdo de Unpaid Services.** Os termos não dão
  nenhum, e a logs-policy cobre explicitamente só projetos com faturamento. Quanto tempo os
  prompts do tier gratuito persistem, e se são apagados, não está em nenhuma fonte primária
  lida. Lacuna real, e pesa contra o tier gratuito para dado de saúde.
- **Nenhum número de retenção para os logs de antiabuso do tier pago** além de "a limited
  period of time".
- **Nenhum opt-out de logging de antiabuso** fora do caminho ZDR aprovado.
- **Nenhuma versão anterior dos termos** recuperada — não dá para dizer quando a ressalva da
  EEA foi introduzida.
- A linha de uso de dados da página de preços veio por sumarizador, não do HTML cru.
