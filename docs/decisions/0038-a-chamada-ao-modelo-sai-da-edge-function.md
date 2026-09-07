# 0038 — A chamada ao modelo sai da edge function, não do Firebase

**Status:** aceita
**Data:** 2026-09-06
**Fecha:** a questão deixada explicitamente aberta na §7 do
[intent de 21/08](../../_bmad-output/brainstorming/brainstorm-insights-ia-analitica-orbe-2026-08-21/brainstorm-intent.md)

## Contexto

A §7 daquele intent listou, em "explicitamente fora de escopo agora":

> *"Decisão de stack/modelo/provedor. Custo foi considerado desprezível (usuário único; a caber
> em plano gratuito tipo Firebase/Gemini), mas **não foi verificado** — é questão aberta, não
> decisão."*

A pesquisa técnica que ia verificar parou em `status: draft`, com as três dimensões "em
aquisição" e sem sumário executivo.

Em 06/09/2026 o usuário reabriu o tema com três usos (parágrafo na Retrospectiva por período
com cache; análise de sono; análise de saúde/FC/esporte) e uma quarta intenção que muda o
peso de todas: **um chat no app onde ele pode perguntar qualquer coisa**, descrito como
"cereja do bolo" e, quando questionado, classificado como **destino** — *"será implementado
em cima de tudo que tem no app"*, mesmo que a integração venha depois.

O motivo declarado para o Firebase era o tier gratuito do Gemini. Custo é o eixo que o próprio
usuário aposentou como critério de decisão, em favor de risco.

### O que estava em jogo, estruturalmente

O Firebase AI Logic existe para o **app cliente** falar com o Gemini sem embarcar uma chave —
proxy mais App Check. É valor para quem não tem backend. O Orbe tem: Postgres com RLS,
quatro edge functions Deno em produção e o precedente de chave de terceiro em `secrets`
(`TMDB_API_KEY`, `GOOGLE_BOOKS_API_KEY`). O cache pedido é uma tabela.

Restava **um** argumento estrutural a favor do Firebase, e ele nasceu da história recente:
doze horas antes, a [ADR 0035](0035-o-piso-e-calculado-no-aparelho.md) tirou o passe de piso
do servidor porque a edge function não alcançava o Overpass. Se esse padrão se repetisse com o
Gemini, o caminho cliente-direto deixaria de ser redundante e passaria a ser a resposta.

Esse argumento foi **medido em vez de discutido**.

## A medição

Função descartável (`gemini-probe`), deployada em produção, três alvos no mesmo instante e pelo
mesmo IP de saída, apagada em seguida. Três rodadas.

| Alvo | Papel | Resultado |
|---|---|---|
| `generativelanguage.googleapis.com` | o alvo | **403 em 28–35 ms**, nas três rodadas |
| `overpass-api.de` | controle negativo | **429 após 16,1 s** |
| `nominatim.openstreetmap.org` | controle positivo | 200 em 12–528 ms |

O 403 do Gemini é `"Method doesn't allow unregistered callers"` — a resposta de quem foi
alcançado e pergunta quem está chamando. DNS, TLS e egress inteiros em 28 ms; sem chave, não
havia resposta melhor possível.

O 429 do Overpass é a causa-raiz da ADR 0035 dizendo o próprio nome: cota por IP esgotada.

**Ressalva de método:** as duas primeiras rodadas do controle negativo deram 406 e **não
valiam nada** — a primeira por mandar o corpo cru em vez de form-encoded, a segunda porque o
`overpass-api.de` recusa o User-Agent do Deno. O controle só virou evidência na terceira. Sem
ele, "o Gemini responde" seria anedota: não provaria que o Overpass continua falhando.

## Decisão

**A chamada ao modelo sai de uma edge function Supabase, com a chave em `secrets`. O Firebase
não entra no Orbe.**

Vale para os quatro consumidores — parágrafo da Retrospectiva, sono, saúde/esporte e o chat
futuro.

## Alternativas rejeitadas

**Firebase AI Logic (SDK no cliente).** Perdeu o único argumento estrutural que tinha na
medição acima. O que sobra é custo — critério aposentado — contra um custo real: segundo
backend, segunda auth, segundo caminho de deploy, regras do Firestore ao lado de RLS que já
está testada. E um SDK a mais dentro de um app Expo que já tem
[ADR 0010](0010-sem-reanimated-no-mobile.md) por causa de uma biblioteca que quebrava o boot,
e um `expo-doctor` 21/21 tratado como sinal.

**Chamada direta do cliente com chave embarcada.** A chave iria para o bundle. É o mesmo
motivo pelo qual a `cultura-search` existe (CAP-7, segredo do TMDB) — precedente já julgado
neste repositório.

**Não decidir ainda.** Era a posição de 21/08 e ela se sustentava enquanto a instrumentação de
contexto tinha prazo e a camada de IA não. O que mudou não foi a urgência: foi o chat virar
destino declarado. Uma camada com quatro consumidores conhecidos precisa da decisão de saída
antes do primeiro, não depois do terceiro.

## Consequências

**O que isso custa.** O parágrafo da Retrospectiva é calculado no aparelho — `retro.ts` tem
1.177 linhas de núcleo puro rodando no telefone. Mandar o resultado desse cálculo para a edge
function, para ela mandar ao modelo, é uma volta a mais no caminho do dado. A alternativa —
recalcular a retro no servidor — significaria duas implementações da mesma retro, e é pior.

**O que custa reverter.** Pouco, e é o ponto. A superfície é uma edge function e uma tabela de
cache. Trocar de provedor de modelo, ou passar a chamar do cliente, não move nada do domínio.

**O que fica em aberto e não bloqueia isto.** Limites reais do tier gratuito hoje; validade na
EEA/Bélgica; se o tier gratuito treina com o conteúdo enviado — relevante porque o payload é
sono e frequência cardíaca de pessoa identificável; e se o projeto Google Cloud que já hospeda
a `GOOGLE_BOOKS_API_KEY` tem faturamento ligado, o que faria o Gemini nascer no tier pago.
Nenhuma dessas respostas muda a arquitetura decidida aqui — todas bloqueiam o **deploy**.
