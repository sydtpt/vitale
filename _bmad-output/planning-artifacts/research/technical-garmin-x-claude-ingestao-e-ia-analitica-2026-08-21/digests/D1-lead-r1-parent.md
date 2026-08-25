# Digest — D1/D3 (aquisição do lead, round 1)

Fonte: pesquisa direta do lead (não-subagente). Acesso: 2026-08-21.

## Achados

**[P1]** A Anthropic lançou conectores de saúde no Claude em beta: **Apple Health (iOS), Health Connect (Android), HealthEx e Function Health** — quatro integrações, todas beta. | source: https://www.macrumors.com/2026/01/22/claude-ai-adds-apple-health-connectivity/ | publisher: MacRumors | pub_date: 2026-01-22 | accessed: 2026-08-21 | confidence: high | class: landscape

**[P2]** O conector do Apple Health roda **no app iOS do Claude**, é **opt-in**, restrito a **assinantes Claude Pro e Max nos EUA**, e cobre movimento, sono e padrões de atividade. | source: https://www.macrumors.com/2026/01/22/claude-ai-adds-apple-health-connectivity/ | publisher: MacRumors | pub_date: 2026-01-22 | accessed: 2026-08-21 | confidence: high | class: landscape
_Segunda fonte (classe exige duas): NBC News — "Anthropic joins OpenAI's push into health care with new Claude tools", https://www.nbcnews.com/tech/tech-news/anthropic-health-care-rcna252872_

**[P3]** **Garmin NÃO aparece na lista de conectores de saúde do Claude.** A página de conectores lista, na categoria health and wellness: HealthEx (beta), AllTrails (GA), Alma (GA, nutrição), CMS Coverage (GA), Function (beta). Nenhuma menção a Garmin. | source: https://claude.com/connectors/healthex | publisher: Anthropic | pub_date: n/d (AllTrails datado 2026-05-01 na página) | accessed: 2026-08-21 | confidence: high | class: landscape (ausência de evidência = achado)

**[P4]** O conector HealthEx é descrito como acessível via Claude.ai, apps desktop/mobile, **Claude Code e API** — sinal de que a superfície de conectores não é exclusivamente de chat consumidor. Requer conta Pro/Max, só EUA. HIPAA-compliant e SOC2; a Anthropic declara não treinar modelos sobre esses dados. | source: https://claude.com/connectors/healthex | publisher: Anthropic | pub_date: n/d | accessed: 2026-08-21 | confidence: medium | class: integração

**[P5]** Existe uma **Consumer Health Data Privacy Policy** da Anthropic, efetiva **12/01/2026**, que "se aplica a usuários em estados dos EUA com leis de dados de saúde do consumidor que escolham integrar aplicativos de saúde de terceiros ao Claude". | source: https://privacy.claude.com/en/articles/10301952-updates-to-our-privacy-policy | publisher: Anthropic | pub_date: 2026-01-12 | accessed: 2026-08-21 | confidence: high | class: política

**[P6]** A Anthropic e a OpenAI enfatizam que essas ferramentas **não se destinam a diagnóstico** e não substituem aconselhamento médico profissional. | source: https://www.nbcnews.com/tech/tech-news/anthropic-health-care-rcna252872 | publisher: NBC News | pub_date: ~2026-01 | accessed: 2026-08-21 | confidence: medium | class: política

### Preço, contexto e caching (fontes primárias, para sustentar recomendação em D3)

**[P7]** Modelos e preços correntes por milhão de tokens: Claude Opus 5 (`claude-opus-5`) $5 in / $25 out, contexto 1M, saída máx. 128k; Claude Sonnet 5 (`claude-sonnet-5`) $2 in / $10 out, contexto 1M, saída 128k; Claude Haiku 4.5 (`claude-haiku-4-5`) $1 in / $5 out, contexto 200k, saída 64k; Claude Fable 5 $10 in / $50 out. | source: https://platform.claude.com/docs/en/about-claude/models/overview.md | publisher: Anthropic | pub_date: n/d (doc viva) | accessed: 2026-08-21 | confidence: high | class: versão/preço

**[P8]** Prompt caching — multiplicadores sobre o preço base de input: **cache write 5-min = 1,25×**, **cache write 1-hora = 2,0×**, **cache read = 0,1×**. Para o Opus 5 isso é $6,25 / $10 / $0,50 por MTok contra $5 base. Prefixo mínimo cacheável no **Opus 5 = 512 tokens** (Sonnet 5 = 1.024; Haiku 4.5 = 4.096). Máximo de **4 breakpoints explícitos** por request. | source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md | publisher: Anthropic | pub_date: n/d (doc viva) | accessed: 2026-08-21 | confidence: high | class: versão/preço

**[P9]** O cache segue a hierarquia `tools` → `system` → `messages`; mudança em qualquer nível invalida aquele nível e todos os seguintes. TTL é contado a partir do **início do request**, não do fim da resposta. | source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md | publisher: Anthropic | pub_date: n/d | accessed: 2026-08-21 | confidence: high | class: padrão

## Leads

- **LEAD CRÍTICO:** se o Claude tem conector de Apple Health mas não de Garmin, o "link Garmin↔Claude" que o usuário viu é quase certamente **Garmin Connect → Apple Health → conector Apple Health do Claude** — uma cadeia de três saltos. Isso herdaria exatamente as perdas de fidelidade do salto Garmin→Apple Health. Verificar no round 2.
- Verificar se existe conector Strava no Claude — seria um caminho de fidelidade melhor que Apple Health para dados de treino.
- O conector HealthEx menciona acesso "via API" — investigar se conectores da Anthropic são consumíveis programaticamente por um app de terceiro ou se é só o cliente Claude.
- Restrição geográfica: EUA apenas. O usuário está no Brasil (documento em pt-BR) — verificar disponibilidade fora dos EUA. Isso pode ser eliminatório.
- OpenAI lançou ChatGPT Health com conector Apple Health ~2 semanas antes — sinal de que a categoria está se consolidando.

## Procurei e não achei

- Página oficial de pricing em `platform.claude.com/docs/en/pricing.md` retornou **HTTP 404**; os preços vieram da página de overview de modelos (fonte primária igualmente).
- Nenhuma menção a Garmin em qualquer superfície oficial da Anthropic encontrada até aqui.
- Não encontrei ainda documentação de conector de saúde voltada a **desenvolvedores de apps terceiros** (só superfície de consumidor).
