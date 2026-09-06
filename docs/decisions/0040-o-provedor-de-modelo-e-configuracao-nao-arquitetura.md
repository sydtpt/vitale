# 0040 — O provedor de modelo é configuração, não arquitetura

**Status:** aceita
**Data:** 2026-09-06
**Complementa:** [0038](0038-a-chamada-ao-modelo-sai-da-edge-function.md) — que decidiu *de onde*
sai a chamada; esta decide *para quem*, e como trocar depois

## Contexto

A [ADR 0038](0038-a-chamada-ao-modelo-sai-da-edge-function.md) fechou a saída: edge function
Supabase, chave em `secrets`, Firebase fora. A pesquisa que a seguiu
([relatório](../../_bmad-output/planning-artifacts/research/technical-gemini-tier-gratuito-limites-eea-e-trein-2026-09-06/research.md))
respondeu as quatro perguntas de deploy e mudou uma premissa: **o tier gratuito não é uma opção
para este usuário**, por três razões independentes.

1. Os termos, em vigor desde 23/03/2026, proíbem: *"You may use only Paid Services when making
   API Clients available to users in the European Economic Area, Switzerland, or the United
   Kingdom."* O usuário mora na Bélgica.
2. *"Do not submit sensitive, confidential, or personal information to the Unpaid Services"* é
   diretiva incondicional, e o payload é dado de saúde do Artigo 9 do RGPD. Só o caminho pago
   nomeia um DPA com o Google como **operador**.
3. O Google removeu os números de RPM/RPD/TPM do tier gratuito da documentação pública, e há
   precedente de corte de ~92% sem aviso.

O custo do caminho pago, com preços lidos em 06/09/2026: **menos de US$ 1/ano** nos três usos
declarados, ~US$ 19/ano se o chat entrar com cinco perguntas por dia, contra um teto duro de
US$ 250 no Tier 1.

Em seguida o usuário declarou o requisito que motiva este documento: **"a empresa e os modelos
poderão ser alterados com o tempo."**

Isso não é preferência. É a leitura correta do que a pesquisa mostrou: em nove meses o Google
cortou cota em 92% sem aviso, reescreveu os termos, mudou o regime de faturamento para Prepay,
retirou tabelas da documentação e anunciou o dobro do preço dos modelos 3.x a partir de
01/01/2027. Um desenho que assuma provedor estável já nasceu contra a evidência.

## Decisão

**Nada acima da costura de narração conhece o provedor.**

Quatro invariantes:

### 1. O núcleo é puro e não sabe que existe modelo

`packages/shared` produz o `PacoteDeFatos` — período, métricas por módulo, deltas, correlações
com seus portões, eventos, lacunas. É puro, testado, e **nunca importa SDK nem faz rede**. Se
todo provedor do mundo sumir, o núcleo continua compilando e passando nos testes.

### 2. Um adaptador por provedor, atrás de uma interface

```
Narrador {
  narrar(pacote: PacoteDeFatos, opcoes): Promise<{
    texto: string
    provedor: string     // 'google' | 'anthropic' | ...
    modelo: string       // o id exato usado
    tokens: { entrada: number, saida: number }
  }>
}
```

Trocar de provedor é escrever um arquivo novo, não mexer no que existe.

### 3. Sem SDK — `fetch` contra a API HTTP

Todo provedor é um POST com JSON. O SDK é justamente a peça que encarece a troca: ele vaza a
própria forma para dentro do código que o chama. As quatro edge functions do Orbe já não têm
importação externa nenhuma; esta segue o precedente.

### 4. Provedor e modelo são dados, e cada edição carrega sua assinatura

Provedor e modelo vêm de configuração (`AI_PROVIDER`, `AI_MODEL` em `secrets`) — trocar de
modelo é um comando, não um deploy.

E **toda edição gravada registra quem a escreveu**: `provedor`, `modelo`, `gerado_em`. É a
linha de crédito do jornal. Sem ela, no dia em que o modelo mudar, não há como saber quais
parágrafos vieram de qual cabeça, nem o que vale a pena regerar.

### Consequência que não é opcional

**A camada não usa grounding.** Grounding com Search e com Maps retém prompt, contexto e saída
por 30 dias em qualquer tier, *"no way to disable"*. Fora de questão para dado de saúde, e
felizmente inútil aqui: os fatos vêm do pacote, não da web.

**E o regime de cada provedor é dado, não folclore.** Tabela por provedor — tier exigido, o que
pode ser enviado, retenção, DPA. O achado da Bélgica vai se repetir diferente em cada um.

## Alternativas rejeitadas

**SDK oficial do provedor.** Ergonomia melhor no primeiro dia, custo alto no dia da troca, e
mais uma dependência no bundle Deno. Não compensa para uma chamada HTTP.

**Camada de abstração de terceiros** (LangChain, LiteLLM e afins). Resolveria a troca em troca
de uma dependência grande, superfície de atualização própria e uma abstração que muda quando o
autor dela quer. Para um adaptador de ~50 linhas por provedor, é comprar um problema maior que
o resolvido.

**Provedor fixo com "trocamos depois se precisar".** É a posição que a evidência derruba: o
"depois" chegou três vezes em nove meses só no Google.

**Multi-provedor ativo desde o início** (fallback automático). Dobra a superfície de teste e os
regimes de dado a auditar, para resolver um problema — indisponibilidade — que um usuário único
com análise assíncrona não tem. A costura permite; o dia 1 não usa.

## Consequências

**O que isso custa.** Um adaptador por provedor e a disciplina de não deixar vocabulário de
fornecedor subir para o núcleo. É pouco, e só se paga quando a troca acontece — mas a pesquisa
mostra que ela acontece.

**O que isso paga.** A troca de provedor passa a ser um arquivo novo mais uma rodada de golden
set, em vez de uma refatoração. E o golden set é o que qualifica o candidato: mesmo pacote de
fatos, provedor novo, e as três verificações mecânicas — todo número citado existe no pacote,
nenhuma palavra de causa ligando métricas, nenhuma correlação fora do portão promovida a
manchete — continuam passando ou não.

**O que custa reverter.** Nada. É uma regra de fronteira, não infraestrutura.

**O que fica em aberto.** O DPA do Google, os critérios de elegibilidade do ZDR e a Prohibited
Use Policy não foram lidos. Nenhum bloqueia este desenho; o primeiro e o terceiro podem
bloquear o deploy.
