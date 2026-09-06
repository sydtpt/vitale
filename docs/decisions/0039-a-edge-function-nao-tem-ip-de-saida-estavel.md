# 0039 — A edge function não tem IP de saída estável

**Status:** aceita
**Data:** 2026-09-06
**Generaliza:** [0035 — O piso é calculado no aparelho](0035-o-piso-e-calculado-no-aparelho.md)

## Contexto

A ADR 0035 tirou o passe de piso do servidor porque o Overpass respondia 504/timeout da edge
function e 5,5 s da rede de casa. A explicação registrada na época foi *"o Overpass dá slots
por IP e o de saída da Supabase é compartilhado"* — plausível, e nunca medida.

Em 06/09/2026, ao medir se a edge function alcança a API do Gemini
([ADR 0038](0038-a-chamada-ao-modelo-sai-da-edge-function.md)), a sonda registrou também a
região e o IP de saída a cada rodada. Não era o objeto do teste.

| Rodada | Região | IP de saída |
|---|---|---|
| 1 | `eu-west-3` (Paris) | `13.36.244.50` |
| 2 | `eu-west-3` (Paris) | `13.39.150.62` |
| 3 | `eu-central-1` (Frankfurt) | `18.184.11.174` |

Três invocações da **mesma** função, em poucos minutos: três IPs, duas regiões, dois países.

Na rodada 3 — a única com o controle bem formado — o Overpass devolveu **429 Too Many
Requests após 16,1 segundos**. Cota por IP esgotada, dita com todas as letras.

A explicação de 06/09 estava certa e estava incompleta. Não é que o IP de saída da Supabase
esteja queimado: é que **não existe "o" IP de saída**. A função sai por um pool rotativo,
compartilhado com os demais projetos da plataforma na região, e a cota que ela encontra do
outro lado é a que outro inquilino deixou. A falha do piso não era intermitência de serviço —
era herança de cota alheia.

## Decisão

**Nenhuma integração do Orbe pode assumir identidade de rede da edge function.**

Na prática, três regras:

1. **Dependência externa com cota ou allowlist por IP não roda na edge function.** Roda no
   aparelho, onde o IP é do usuário e a cota é dele. É o que a ADR 0035 fez para o piso; aqui
   deixa de ser exceção e vira regra.
2. **Serviço que exige IP fixo para autenticar não é integrável** por este caminho. Se for
   necessário, exige proxy com IP estável — o que é uma decisão de infraestrutura nova, não um
   detalhe de implementação.
3. **A identificação vai no cabeçalho, não no endereço.** Chave de API, `User-Agent` próprio,
   token. A sonda também mediu isto: sem `User-Agent` próprio, o `overpass-api.de` recusa o
   padrão do Deno com 406 — uma recusa que se disfarça de erro de requisição.

O que a edge function continua fazendo bem, e a mesma medição confirma: falar com API
comercial autenticada por chave. O Gemini respondeu em 28–35 ms, o Nominatim em 12 ms.

## Alternativas rejeitadas

**Tratar como problema do Overpass.** Foi a leitura de 06/09 pela manhã, e ela custou um
deploy, um smoke test e uma ADR de superseder. A rotação de IP explica o Overpass **e**
qualquer serviço com a mesma política — o próximo achado seria pago do zero de novo.

**Fixar região no deploy.** Reduziria a variação de país, não a de IP: as rodadas 1 e 2 saíram
da mesma região por IPs diferentes. Não resolve, e amarra o deploy por nada.

**Retry com espelhos.** Já foi tentado no `_shared/surface.ts` — três espelhos, todos
falharam. Retry não cria cota; só distribui a mesma recusa.

## Consequências

**O que isso custa.** Fecha a porta para uma classe de integração barata. Serviços comunitários
gratuitos — Overpass, e provavelmente outros do mesmo feitio — passam a exigir o caminho do
aparelho, que é mais trabalhoso: sync, retry, estado por dispositivo.

**O que isso paga.** A regra é preventiva. Custou zero para descobrir — caiu de um teste feito
para outra coisa — e evita repetir a manhã de 06/09 a cada nova dependência.

**O que custa reverter.** Nada: é uma regra de escolha, não código. Se a plataforma passar a
oferecer IP de saída dedicado, a regra 1 perde a razão e esta ADR é superada por outra.

**Onde vale conferir.** A `connections-ingest` fala com Strava, intervals.icu e Nominatim —
todos autenticados por chave ou tolerantes, nenhum com cota por IP conhecida. Não há ação
pendente; a regra vale para o que vier.
