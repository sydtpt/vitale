# D1 — Limites reais do tier gratuito · rodada 1

## Achado que domina a dimensão

**O Google removeu os números do tier gratuito da documentação pública.** A página de rate
limits não publica mais RPM/RPD/TPM por modelo: diz que os limites "depend on a variety of
factors (such as your usage tier) and can be viewed in Google AI Studio" e aponta para
`aistudio.google.com/rate-limit`, que exige login e é específico da conta.
`source: https://ai.google.dev/gemini-api/docs/rate-limits | publisher: Google | pub_date: 2026-09-02 | accessed: 2026-09-06 | confidence: high | class: limits`

A página de quotas do Firebase confirma a circularidade: também não traz números e devolve
para o ai.google.dev.
`source: https://firebase.google.com/docs/ai-logic/quotas?api=dev | publisher: Google (Firebase) | pub_date: 2026-09-01 | accessed: 2026-09-06 | confidence: high | class: limits`

## Demais achados

**3. Os limites valem por PROJETO, não por chave**, e em três dimensões independentes — RPM,
TPM de entrada e RPD. Estourar qualquer uma dispara o erro.
`source: https://ai.google.dev/gemini-api/docs/rate-limits.md.txt | publisher: Google | pub_date: 2026-09-02 | accessed: 2026-09-06 | confidence: high | class: limits`

**4. Estourar devolve HTTP 429 `RESOURCE_EXHAUSTED`.** Rejeição, não fila nem throttle suave.
`source: https://ai.google.dev/gemini-api/docs/rate-limits | publisher: Google | pub_date: 2026-09-02 | accessed: 2026-09-06 | confidence: high | class: behavior`

**5. O RPD zera em janela de calendário — meia-noite no Pacífico**, não janela deslizante.
Para quem está na Bélgica (CET/CEST), a virada cai por volta das 09:00 locais.
`source: https://ai.google.dev/gemini-api/docs/rate-limits | publisher: Google | pub_date: 2026-09-02 | accessed: 2026-09-06 | confidence: high | class: behavior`

**6. O tier gratuito é alcançado por NÃO ter conta de faturamento**; vincular uma move o
projeto para o Tier 1. Teto de gasto: Free = N/A · Tier 1 = US$ 250 · Tier 2 = US$ 2.000 ·
Tier 3 = US$ 20.000+.
`source: https://ai.google.dev/gemini-api/docs/rate-limits.md.txt | publisher: Google | pub_date: 2026-09-02 | accessed: 2026-09-06 | confidence: high | class: pricing`

**8. O Pro ainda aparece com tier gratuito na página de preços**, contra a alegação difundida
por agregadores de que teria saído em abril/2026. Constam com gratuito: 2.5 Pro, 2.5 Flash,
2.5 Flash-Lite, 3 Flash Preview, 3.5/3.6/3.7/3.8 Flash, 3.5 e 3.1 Flash-Lite, embeddings.
`source: https://ai.google.dev/gemini-api/docs/pricing | publisher: Google | pub_date: 2026-09-04 | accessed: 2026-09-06 | confidence: high | class: pricing`

**10. O Google já cortou cota do tier gratuito sem aviso, e um funcionário confirmou.** Thread
de 12/2025 relata Gemini Flash caindo de 250 para 20 RPD (~92%). Logan Kilpatrick (Google)
respondeu em 07/12/2025 que "turn down the free tier for some models" para deslocar compute, e
que precisam "act quickly" em vez de pré-anunciar. **Os números têm 9 meses e estão vencidos —
o precedente é que importa.**
`source: https://discuss.ai.google.dev/t/do-they-really-think-we-wouldnt-notice-a-92-free-tier-quota/111262 | publisher: Fórum oficial (resposta de funcionário, não doc) | pub_date: 2025-12-06 | accessed: 2026-09-06 | confidence: medium | class: limits`

## Tabela de limites

**Não foi possível montar.** Sete modelos confirmados como elegíveis ao tier gratuito na
página de preços (04/09/2026), e para todos: RPM, RPD e TPM **não publicados**. Três páginas
oficiais apontam umas para as outras e depois para um painel com login.

Único número datado obtido nesta rodada, vencido e não-oficial: Gemini Flash **20 RPD** em
06/12/2025, caído de 250. Não planejar contra ele.

Limites estruturais que **são** oficiais: teto de gasto Free = N/A; Tier 1 = US$ 250.

## O que isso significa para a decisão

- **Não dá para dimensionar um build de tier gratuito pela documentação.** A única fonte
  autoritativa dos números reais é `https://aistudio.google.com/rate-limit`, logado na conta
  dona da chave. É uma conferência de um minuto que nenhuma pesquisa substitui.
- **O tier gratuito não tem cobrança por excedente** — teto "N/A" e tokens "Free of charge",
  então o modo de falha é 429 duro, não fatura surpresa. Confiança média-alta: é inferência de
  dois fatos oficiais, não uma frase explícita.
- **O risco real é de estabilidade.** Corte de ~92% da noite para o dia, sem post de blog, com
  admissão de que agem primeiro e comunicam depois.

## Leads

- `https://aistudio.google.com/rate-limit` — números por modelo ao vivo, com login.
- Entrada de changelog de março/2026 sobre "revamp of usage tiers and spend caps", não aberta;
  pode explicar quando as tabelas públicas sumiram.
- Capturas do Wayback da página de rate limits datariam a remoção e dariam um piso histórico.

## O que se procurou e NÃO se achou

- **Nenhum número atual de RPM/RPD/TPM do tier gratuito em fonte primária.** Nem na rate-limits,
  nem na de preços, nem na de quotas do Firebase, nem no changelog. Parece deliberado: o Google
  tornou esses números específicos da conta e dinâmicos em vez de documentados.
- **Nenhuma frase oficial dizendo se cota gratuita sobrevive num projeto com faturamento.** A
  doc de billing nunca diz que some nem que fica. Desenvolvedores perguntavam exatamente isso
  no fórum oficial em 06/05/2026 **sem resposta de funcionário** — o que já é evidência de que
  a documentação não resolve.
- **Nenhum changelog ou post de 2026 anunciando mudança de cota gratuita.**
- **Formato exato do corpo do erro 429** (campo `retryDelay`, identificação da métrica).
