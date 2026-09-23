# 0056 — O peso aberto deixa de ser só prova, e quem decide é o descritor

- **Data:** 2026-09-23
- **Estado:** aceita
- **Supera:** a Never da [spec da story 5.8](../../_bmad-output/implementation-artifacts/spec-5-8-a-ponte-do-core-ai.md)
  ("ele entra no seletor e para aí")
- **Relacionada:** [0047](0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md) ·
  [0048](0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md) ·
  [0050](0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md)

## Contexto

A story 5.8 embarcou o primeiro peso aberto (SmolLM2-135M) como **prova de caminho**: ele
provava que um modelo nosso roda dentro do app, e nada mais. A spec dizia, em Never, que ele
"entra no seletor e para aí", e a construção descobriu que o regime sozinho não garantia isso
— `nome-de-rota` declara `grava.admite: ['nuvem','aparelho']` e **grava em produção**, então o
peso aberto apareceria como opção escolhível numa leitura que escreve `activities.route_name`.
Com a medição de 21/09 mostrando aquele modelo acertando ~10% dos nomes e **passando no portão
em 97% dos casos**, uma linha em `motivoDeBloqueio` passou a barrá-lo em todo recurso que
gravasse.

Dois fatos mudaram desde então.

O primeiro é o modelo. O SmolLM2-135M deu lugar ao **Qwen3-1.7B** e ao **Tucano2-1.5B**, e em
23/09 a bancada do iPhone correu as 22 janelas da Saúde do sono com os dois sobre a mesma
amostra: o Qwen aprovou em **22 de 22**, com mediana de **5,9 s**, zero frases idênticas ao
template. A nuvem, medida em 12/09 sobre as mesmas janelas, também fez 22 de 22 — com mediana
de 13,6 s. O peso aberto deixou de ser pior que a alternativa: ele empata em aprovação e ganha
em latência, sem que nada saia do aparelho.

O segundo é que a trava era um **"não" paralelo**. O repositório já tem o lugar onde essa
decisão pertence — o `grava.admite` de cada descritor. Manter uma segunda regra na camada da
tela significa que as duas podem discordar, e que a resposta à pergunta "esta leitura aceita
motor de aparelho?" depende de onde se pergunta.

## Decisão

**A linha que barrava o peso aberto fora da Saúde do sono sai.** Quem decide que tipo de motor
pode gravar numa leitura é o `grava.admite` do descritor, e só ele.

O efeito prático, hoje:

| leitura | `grava.admite` | peso aberto escolhível? |
|---|---|---|
| Saúde do sono | não grava | sim — e já era |
| **nome de rota** | `['nuvem','aparelho']` | **sim, passou a ser** |
| retrospectiva | `['nuvem']` | não — barrada pelo descritor |

A retrospectiva continuar fechada **não é efeito colateral feliz**: é a mesma regra funcionando.
Ela abre no dia em que o descritor dela disser que abre, que é onde a decisão deve ser tomada e
revisada.

**Isto não muda cadeia padrão nenhuma.** O peso aberto passa a ser *escolhível* em nome de rota;
ele não passa a ser o padrão de nada. Nenhuma pedalada é nomeada por peso aberto sem o dono ir ao
seletor e escolhê-lo.

## Consequências

**O que fica mais arriscado.** Nomear rota é automático: abrir uma pedalada sem nome dispara
`nomearPedaladaSePreciso`, que grava `activities.route_name` e `route_name_meta`. Não há tela
para editar nem limpar `route_name`. Então, com um peso aberto escolhido, cada pedalada aberta
recebe um nome permanente escrito por um modelo cuja taxa **nesta leitura** ninguém mediu — a
medição de 23/09 é da Saúde do sono, que tem template por régua; nome de rota não tem, e o
`verificar.ts` nunca reprovou nada em 133 nomes.

**O que limita o estrago.** `route_name_meta` carimba `provedor` e `modelo` em toda gravação.
Um lote ruim é identificável e reversível numa consulta:

```sql
update activities set route_name = null, route_name_meta = null
where route_name_meta->>'provedor' = 'coreai';
```

Reversível por SQL não é reversível pelo app, e a diferença importa: quem derrubar esta trava
está aceitando que o desfazer custa uma janela de banco.

**O que deveria vir antes de usar.** Rodar a amostra de nome de rota na bancada com os pesos
abertos — que agora é possível — e ler as frases. A taxa da Saúde do sono não transfere: são
tarefas diferentes, com réguas diferentes.

## Alternativas consideradas

**Manter a trava e medir primeiro.** Seria a ordem prudente, e foi a recomendada. O dono
preferiu abrir a escolha e medir com ela aberta — a bancada mede o mesmo de qualquer jeito, e
manter o bloqueio obrigaria a mexer no código de novo depois da medição.

**Mover a trava para o descritor** (`nome-de-rota` passar a `admite: ['nuvem']`). Fecharia a
leitura para *todo* motor de aparelho, inclusive o da Apple, que já está liberado ali desde a
5.7 e não foi o que motivou o bloqueio. Seria uma regra mais larga que o problema.
