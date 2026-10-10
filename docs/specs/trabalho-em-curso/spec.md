---
id: SPEC-trabalho-em-curso
companions: []
---

> **Contrato canônico.** Este SPEC é o contrato completo do que construir, testar e validar. As medições citadas no *Why* são de 10/10/2026, no iPhone do dono, e estão no log de migalhas daquela noite.

# O trabalho em curso — a tela de detalhe diz o que está fazendo, e se atualiza sozinha

## Why

A tela de detalhe de uma atividade dispara até quatro passes assíncronos e **não mostra nenhum deles**. O pior é o enriquecimento geográfico: numa pedalada de 3.347 pontos ele faz 41 chamadas ao OpenStreetMap a 1,1 s cada — **~45 segundos** em que a tela fica idêntica a uma tela quebrada. Os dois únicos indicadores que existem ali hoje estão amarrados a ação do usuário (salvar o nome, o interruptor de métricas); nada cobre o que o app faz por conta própria.

Isso não é hipótese: em 10/10 o dono esperou, concluiu que não funcionava, e saiu e voltou da tela várias vezes para descobrir se algo tinha acontecido. **Sair e voltar virou a interface de progresso** — e, pior, abrir três pedaladas em sequência foi o que fez o OpenStreetMap recusar com `HTTP 429`, porque cada abertura deixava um passe rodando.

E quando um passe falha, a tela não muda **nada**. Depois de 45 s esperando, silêncio é indistinguível de sucesso vazio: o dono não tem como saber se vale reabrir a tela, se deve esperar mais, ou se quebrou.

Os dois pedidos — *"um indicador de quando estão rodando coisas, para saber que devo esperar"* e *"que a tela se atualize sem eu precisar ficar saindo e voltando"* — são a mesma falha vista de dois ângulos: **o estado do sistema não é visível.**

## Capabilities

- **CAP-1** — Uma faixa no topo nomeia o trabalho em curso
  - **intent:** Enquanto houver um passe longo rodando, uma linha fina abaixo do cabeçalho diz **qual** trabalho é, em palavras, e some sozinha ao terminar.
  - **success:** Abrir uma pedalada sem cidades mostra `procurando as cidades` em até 1 s, e a faixa desaparece quando as cidades aparecem na tela — sem toque nenhum. O texto é o do trabalho, não genérico: `procurando as cidades`, `escrevendo o nome da rota`, `medindo o piso`.

- **CAP-2** — O avanço é honesto, e sem denominador
  - **intent:** Quando o passe sabe quanto falta, a faixa mostra uma barra que avança. Quando não sabe, mostra movimento sem fingir precisão. Em nenhum caso aparece contagem (`12 de 41`).
  - **success:** O enriquecimento de cidades, que conhece o número de amostras, enche a barra proporcionalmente e chega ao fim junto com o resultado. O nome da rota, que é uma chamada de duração desconhecida, mostra barra indeterminada. Uma barra determinada **nunca** regride nem fica parada em 100% esperando.

- **CAP-3** — Só entra na faixa o que demora o bastante para gerar dúvida
  - **intent:** Passes rápidos não piscam na tela. Um passe só aparece se ainda estiver rodando depois de um limiar curto.
  - **success:** Carregar o traçado e a varredura de fotos (1–2 s) não produzem faixa em uso normal. O enriquecimento de cidades sempre produz. Abrir uma atividade já completa não mostra faixa nenhuma.

- **CAP-4** — Uma linha por vez, a do maior tempo de espera
  - **intent:** Com mais de um passe em curso, a faixa mostra **um** trabalho — aquele cuja espera é maior —, porque a pergunta que ela responde é "quanto tempo devo esperar", não "o que está acontecendo ao todo".
  - **success:** Com cidades e nome correndo juntos, a faixa diz `procurando as cidades`; terminado ele, passa a `escrevendo o nome da rota` sem a tela saltar. A faixa nunca empilha duas linhas.

- **CAP-5** — A falha fica na tela, e o "tentar de novo" é honesto
  - **intent:** Um passe que falha troca o texto da faixa por um motivo em linguagem comum, com um toque para repetir. O botão **não** oferece repetir enquanto o serviço tiver pedido espera.
  - **success:** Depois de um `429`, a faixa mostra `o OpenStreetMap recusou` e, no lugar do botão, `aguarde` com o tempo restante enquanto o castigo global durar (`castigoAtivoAte()`); passado ele, o toque refaz o passe. A falha não vira alerta, modal nem vibração.
  - **nota:** a primeira versão desta CAP dizia "no lugar do resultado". Não existe lugar: a tela de detalhe **não tem seção de cidades** — elas alimentam o mapa, o compartilhar e as estatísticas por país, e nada mais. A faixa é o único lugar nesta tela que representa esse trabalho, então é nela que a falha mora.

- **CAP-6** — A tela nunca exige sair e voltar
  - **intent:** Todo resultado que chega enquanto a tela está aberta aparece nela, venha do passe da própria tela ou de um ciclo de sync em segundo plano.
  - **success:** Com a pedalada aberta, um sync que calcula o piso faz o cartão de piso aparecer sem interação. As cidades, o nome e o piso aparecem cada um assim que ficam prontos, em qualquer ordem. Nenhum caminho do usuário depende de voltar ao histórico e entrar de novo.

## Non-goals

- **Não** é um painel de diagnóstico. Quem quer o detalhe técnico tem Configurações › Dados; a faixa fala em português comum e some.
- **Não** cobre passes que rodam fora desta tela e não afetam esta atividade.
- **Não** há cancelar. Os passes já são canceláveis por sair da tela, e um botão de cancelar convida a interromper um trabalho de 45 s que custa caro recomeçar.

## Notas de implementação

- A cor da barra é o `accent` do módulo da atividade, por `moduleOf()` — nunca hex (ADR 0018).
- A animação é `Animated` do React Native (ADR 0010; Reanimated não se usa aqui).
- CAP-2 exige que `cidadesDaRota` informe avanço — hoje ela é opaca. Um retorno de chamada por amostra resolve, e é a única mudança necessária fora da camada de tela.
- O estado de castigo já existe e é global: `castigoAtivoAte()` em `mobile/src/lib/geocode-osm.ts`.
- CAP-6 precisa que o fim de um ciclo de sync recarregue o acervo na store; a tela já é assinante dela.
