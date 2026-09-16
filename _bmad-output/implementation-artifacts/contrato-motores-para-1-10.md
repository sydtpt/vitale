# O contrato dos motores, para a story 1.10

> **Para quem vai escrever a 1.10** ("A sequência da impressão sobe para o núcleo, como cliente do
> orquestrador"). Escrito em 16/09/2026, depois de a 5.5 fechar, contra a `main` em `1e0114e`.
>
> **Por que este arquivo existe:** o `epics.md` diz *"quem chegar primeiro entre a 1.10 e a 5.5 cria
> `mobile/src/lib/motores/`"*. **A 5.5 chegou primeiro.** O diretório existe, tem forma definida, e
> nasceram barreiras que a 1.10 vai encontrar sem estarem escritas em lugar nenhum do planejamento.
> Sem isto, a 1.10 tenta criar o que já existe, ou bate na barreira sem entender por quê.

## 1. O que já existe, e a 1.10 não precisa construir

### `mobile/src/lib/motores/` — o ponto de injeção do app

É o único lugar de `mobile/src` que pode nomear a `ia-narrar` (catraca abaixo). A 1.10
**acrescenta** aqui, não recria.

| Arquivo | O que exporta | O que a 1.10 usa |
|---|---|---|
| `index.ts` | `motorPara: (id: MotorId) => Motor \| undefined`, `criarMotorPara(chamar?, prazoMs?)`, `criarTransporte(chamar?, prazoMs?)`, `PRAZO_MS = 60_000`, `type Chamar` | **`motorPara` inteiro.** É o `motorPara` que o `ler` do orquestrador pede. Já serializa uma chamada de nuvem por vez, entre a `/sono/saude` e a tela de desenvolvimento — a impressão entra na mesma fila |
| `catalogo.ts` | `MOTORES_CONHECIDOS`, `idsConhecidos`, `motorConhecido`, `motorDisponivel`, `nomeDoMotor`, `HOSPEDAGEM`, `motivoDeBloqueio` | `idsConhecidos` para o `resolverCadeia`; **`HOSPEDAGEM` tem de mudar** (§3) |
| `preferencia.ts` | `lerPreferencias`, `lerPreferencia(recurso)`, `gravarPreferencia`, `type PreferenciaDeMotores` | `lerPreferencia('retrospectiva')` — a escolha do dono, por aparelho, em AsyncStorage sob `vitale:motores-preferencia` |
| `anel.ts` | `anel`, `criarAnel(teto?)`, `TETO_DO_ANEL = 40` | o `registrar` do orquestrador. Memória, nunca persiste — ele carrega o pedido |

### A normalização do cliente da function — **não reescreva, reúse**

O `deferred-work.md` pedia "avaliar na 1.10 um normalizador puro antes de a segunda cópia nascer".
Ele já nasceu na 5.5, e com um achado medido dentro:

> Em todo não-2xx o `@supabase/functions-js` 2.106 **lança** (`FunctionsHttpError`) com o `Response`
> em `error.context`. **As duas cópias antigas do cliente não sabiam disso — o ramo que lia o corpo
> de erro nunca rodava.**

Consequência prática: sem esse desembrulho, **todo** não-2xx vira `semRede` → `indisponivel`, e a
`CLASSE_POR_STATUS` do núcleo fica morta. Um 413 (`janela`), um 429 (`transitoria`) e um 400
(`capacidade`) passariam todos como "a nuvem não atendeu". Nem o `tsc` nem teste algum acusa.

`criarTransporte` já resolve isso e tem 29 testes (`mobile/src/lib/__tests__/motores-porta.test.ts`).
Se a impressão precisar de um transporte próprio, **injete um `Chamar` diferente no mesmo
`criarTransporte`** em vez de escrever o segundo.

### O prazo, e por que ele é `transitoria` e não `indisponivel`

`PRAZO_MS = 60_000`, imposto por **`AbortSignal` nosso** — não pela opção `timeout` do cliente.
A razão não é estilo: abortar por conta própria é a única forma de saber que o aborto foi nosso e
classificá-lo `transitoria` (cai no piso, não repete). Um aborto do cliente viraria `indisponivel`,
que **recua para o próximo elo da cadeia** — comportamento diferente para o mesmo evento.

A bancada foi alinhada a isso em 16/09 (`c749498`). Se a 1.10 impuser prazo próprio, use a mesma
classe, ou os três hospedeiros voltam a discordar.

## 2. O que a 1.10 **não** precisa fazer — já foi feito por outra story

- **A catraca do `'ia-narrar'` já desceu de 2 para 1, e foi a 1.9 que a desceu**, não a 1.10. O
  `epics.md` da 1.10 ainda promete essa descida; ela já aconteceu, junto com a migração, quando a
  narração saiu do celular. `edicao-ia.ts` continua existindo, mas só com a leitura.
  **Ofensor que resta: `mobile/src/services/route-name.ts`, e ele sai na 5.7.** Não conte com
  chegar a zero aqui.
- **A guarda (7) já libera o que a sequência precisa**: `fio`, `motor`, `orquestrar`, `nuvem`,
  `recursos` e todo nome com prefixo `descritor` passam sem contar contra o teto.

## 3. O que a 1.10 tem de fazer, e ninguém mais vai

### `HOSPEDAGEM` — o interruptor que a 5.5 deixou armado

`mobile/src/lib/motores/catalogo.ts` declara, fechado sobre `RecursoId`, quais recursos esta camada
de fato consome:

```ts
export const HOSPEDAGEM: Readonly<Record<RecursoId, Hospedagem>> = {
  'saude-do-sono': { hospedado: true },
  retrospectiva: {
    hospedado: false,
    motivo: 'ainda não usado nesta versão: a narração da revista não passa pelo orquestrador',
  },
  'nome-de-rota': { hospedado: false, motivo: '…' },
};
```

**No minuto em que a 1.10 ligar a impressão pelo orquestrador, `retrospectiva` vira
`{ hospedado: true }`.** Enquanto não virar, `/configuracoes/motores` continua mostrando a
Retrospectiva bloqueada com esse motivo — a tela vai mentir, dizendo que a escolha não é usada
quando ela passou a ser. Nada quebra, nenhum teste fica vermelho: é texto na tela do dono.

Nota de desenho: o mapa é fechado sobre `RecursoId` de propósito — recurso novo no núcleo **não
compila** até alguém dizer se esta camada o hospeda.

### A barreira nova da AD-2 — o que a 1.10 não pode escrever

Nasceu na 5.5 em `packages/shared/src/architecture.test.ts`, e é **detecção por AST**, então
desestruturar ou usar colchete não escapa:

- **`BARREIRA` (teto zero)** — nenhum arquivo de `mobile/src`, `web/src` ou `scripts/` chama
  `.interpretar(`, `.conferir(`, `.montarFrase(`, `.semModelo(` ou `.pedidoCurto(` de um descritor.
- **`CATRACA` (teto 1, ofensor nomeado)** — `.montarPedido(`, e o único ofensor declarado é
  `scripts/bancada/medir.ts`, que precisa do **corpo** do pedido para o relatório do dono.
  A catraca afirma a lista exata, então um ofensor novo falha mesmo se o antigo sair.

Em uma frase: **a 1.10 chama `ler(descritorDaRetrospectiva, fatos, …)` e desenha o resultado.**
Montar o pedido, interpretar, conferir, escrever a frase e cair no piso são do descritor, e só o
orquestrador os percorre. Se precisar do hash do pedido, ele vem do anel (`EventoDoAnel.hash`) ou do
`Medicao` — nunca de montar o pedido por fora.

### O que o `deferred-work.md` já registrou e é entrega desta story

Não repito o conteúdo aqui; são doze entradas com `1.10` no texto. As que mudam o desenho:

- **"Verifica antes de gravar" ficou sem ponto de aplicação na 1.9.** `verificarTexto` não tem
  chamador vivo, e `edicao_imprimir` insere o texto que receber. A ordem "confere, depois grava"
  nasce junto com a sequência.
- **`montarPromptDaEdicao` e `precisaErrata` estão sem chamador de produção.** A 1.10 traz o
  primeiro de volta; se não trouxer, ele sai.
- **A frase provisória tem de sair**: *"A impressão está parada. Quando voltar, a edição sai em
  cadernos."* em `mobile/src/components/EdicaoCard.tsx`. Nada no repositório liga essa frase a esta
  story — sem isto, o app mente sobre si mesmo na tela que o dono mais abre.
- **`coberturaSono` nunca é passado pelo celular**, então a perna de cobertura do portão está sem
  efeito. Quem monta a entrada é a sequência.
- **`AGG_VERSION`/`PACOTE_VERSAO` na carga do RPC** — ler a constante no núcleo, e cobrar por
  barreira que o valor não venha de fora de `packages/shared`.

## 4. Uma armadilha de processo, medida três vezes

O `post-commit` espelha a `sprint-status.yaml` **da árvore que commitou**. Commitar numa worktree
cuja `sprint-status.yaml` é de uma baseline velha rebaixa issues de outras frentes no GitHub.
**Antes de commitar, compare com `origin/main`:**

```bash
git diff origin/main -- _bmad-output/implementation-artifacts/sprint-status.yaml
```

Só a linha da sua story deve aparecer.
