# IA analítica — tarefas

Origem: pergunta do Sydnei em 06/09/2026 ("integrar o app com o Firebase para
acessar o Gemini com tier free") → party mode (Winston, Mary, Sally, John,
Murat) → smoke test em produção → deep recon dos termos → ADRs 0038, 0039, 0040.

Fecha a questão deixada aberta em 21/08 na §7 do
[intent do brainstorm](../../brainstorming/brainstorm-insights-ia-analitica-orbe-2026-08-21/brainstorm-intent.md).

Spec: [docs/specs/ia-analitica/spec.md](../../../docs/specs/ia-analitica/spec.md) ·
Pesquisa: [research.md](../../planning-artifacts/research/technical-gemini-tier-gratuito-limites-eea-e-trein-2026-09-06/research.md)

## Decisões que já valem

- **Firebase não entra** (ADR 0038). A edge function alcança o Gemini em 28–35 ms,
  medido em produção com controle negativo válido. O único argumento estrutural a
  favor do cliente morreu na bancada.
- **Tier pago, não gratuito.** Não por dinheiro — o gratuito é *proibido* para quem
  serve usuário na EEA, e a diretiva "do not submit personal information to the
  Unpaid Services" é incondicional. Custo real: < US$ 1/ano nos três usos,
  ~US$ 19/ano com o chat, teto duro de US$ 250 no Tier 1.
- **Projeto Google Cloud separado**, não o que hospeda a `GOOGLE_BOOKS_API_KEY` —
  para isolar teto de gasto, tier e logs. Tier é herdado da conta de faturamento;
  chave não tem tier próprio.
- **Provedor e modelo são configuração** (ADR 0040). Núcleo puro sem SDK, um
  adaptador por provedor atrás de uma interface, `fetch` contra HTTP, e cada edição
  gravada carrega `provedor` + `modelo` + `gerado_em` — a linha de crédito.
- **Sem grounding.** Search e Maps retêm 30 dias em qualquer tier, sem opt-out.
- **Edição, não cache** (confirmado pelo Sydnei). Período fechado congela e carrega
  data; período em curso **não ganha parágrafo**; `AGG_VERSION` que reprocessa gera
  errata, não reescrita.
- **Estatística acha; LLM prioriza e narra** (21/08). O modelo nunca calcula, nunca
  deriva número que não recebeu, nunca afirma causa.
- **Mobile first** — lei da casa. Se não tem no celular, ele não vê.

## Fase 0 — Portões de deploy (leitura, não código)

**Nenhum dos três portões de leitura bloqueia** (fechados em 06/09/2026). Dois
deixaram restrição de desenho e um deixou pendência. Os três restantes exigem
login na conta Google do usuário.

### Fechados

- [x] **T0.4 — Gen AI Prohibited Use Policy: NÃO bloqueia.** Nenhuma proibição a
      inferência de saúde, diagnóstico ou processamento de dado de saúde. A única
      cláusula adjacente é a §1.8: *"Makes automated decisions that have a material
      detrimental impact on individual rights without human supervision in high-risk
      domains — for example, in employment, healthcare, finance…"*.
      → **Restrição que isso impõe:** a camada narra, nunca **decide**. Nada de ação
      automática a partir de inferência de saúde. É a mesma lei que o usuário já
      declarou — *"a Retrospectiva é um jornal: informa, não aconselha"* —, então a
      política do Google já estava satisfeita por acidente.
      ⚠️ *A página exibe "Last modified: December 17, 2024" — data velha para
      06/09/2026. Reconferir antes do deploy.*

- [x] **T0.5 — ZDR: indisponível na prática.** A documentação não publica critério de
      elegibilidade nem formulário; fala em "when your request… is approved" e remete
      a contato comercial / plataforma enterprise. Trate como **fora de alcance para
      conta de desenvolvedor individual**.
      → **Consequência aceita:** existem logs de antiabuso com prompts e respostas
      por "a limited period of time", sem número publicado.
      → **Efeito colateral bom:** como ZDR não está em jogo, o **cache de contexto
      fica liberado** (sob ZDR ele "should not be used"). Destrava a T5.1, que é o que
      derruba o custo do chat.

- [x] **T0.3 — DPA: serve, com uma ação e uma pendência.**
      - Google é **operador**, o usuário é **controlador**: *"Google is a processor and
        Customer is a controller or processor, as applicable."* É exatamente o papel
        que falta no caminho gratuito.
      - Dado de categoria especial **está no escopo**, explicitamente: *"Customer
        Personal Data means the personal data contained within the Customer Data,
        including any special categories of personal data or sensitive data defined
        under Applicable Privacy Law."* Ressalva honesta: está no escopo, mas **sem
        regra própria** — cai no regime geral.
      - **Ação:** o DPA **não é automático**. *"Addendum Effective Date means the date
        on which Customer accepted, or the parties otherwise agreed to, this Addendum."*
        Confirmar que está em vigor na conta ao ligar o faturamento — verificação, não
        suposição.
      - **Pendência:** o Apêndice 3 (transferências internacionais e SCC) veio truncado
        e **não foi lido**. Para dado de saúde saindo da Bélgica para empresa
        americana, SCC é o mecanismo real do RGPD. Não bloqueia o desenho; é o único
        item de conformidade ainda aberto.

> **Nota de contexto, não de aconselhamento jurídico:** o usuário é o controlador e o
> único titular do dado, num app pessoal sem terceiros. O Artigo 2(2)(c) do RGPD exclui
> tratamento "no exercício de atividades exclusivamente pessoais ou domésticas". Se
> essa exclusão se aplica, boa parte da discussão acima é prudência, não obrigação —
> mas a prudência custa alguns dólares por ano e não custa nada manter.

### Dependem do login dele

- [x] **T0.1 FEITA 06/09** — `Orbe` (criado hoje) estava Free tier sem chave; `viltale` estava `Tier 1 · Postpay` com **Prepay required**, exatamente o estado que a D3 previu, e SEM chave (a do Books não estava lá). Abrir `aistudio.google.com/projects` e ler a coluna **Billing Tier** —
      resolve de uma vez o status do projeto do Books e o estado de Prepay.
- [x] **T0.2 FECHADA PELA NEGATIVA** — 68 chamadas/ano = 0,19/dia contra limites de 60/**minuto**. Os limites são irrelevantes por três ordens de grandeza; o tier pago é sobre termos, não capacidade. Abrir `aistudio.google.com/rate-limit` — os únicos números por modelo
      que existem; o Google os tirou da documentação pública.
- [x] **T0.6 FEITA 06/09** — faturamento configurado no projeto `Orbe`, US$ 25 de Prepay, `GEMINI_API_KEY`/`AI_PROVIDER`/`AI_MODEL` em `secrets`. Criar o projeto separado + Prepay, aceitar/confirmar o DPA, e gravar
      `AI_PROVIDER`, `AI_MODEL` e a chave em `secrets`.

## Fase 1 — O pacote de fatos (núcleo puro, zero risco externo)

Não chama ninguém, não precisa de chave, não precisa da Fase 0. É o que dá para
começar hoje.

- [x] T1.1 `packages/shared/src/ia/pacote.ts` — o tipo `PacoteDeFatos` e o montador
      a partir do que `retro.ts` já calcula. Puro, sem rede, sem SDK.
- [x] T1.2 Campos que existem por erro conhecido: `cobertura` e `lacunas` (julho tem
      14 noites, agosto 27 — comparar sem declarar isso é mentir), `dentro_do_portao`
      nas correlações (`MIN_DAYS_PER_SIDE`, `MIN_CROSS_DELTA_PCT`), `eventos` (sem
      eles a meia maratona vira "corrida de 21 km"), `anterior` (comparação é do
      núcleo, não do modelo).
- [x] T1.3 `periodoFechado()` — a regra de edição. Semana/mês/estação/ano encerrados
      são fechados; o corrente e o modo `all` nunca são.
- [x] T1.4 Testes com dado real: agosto/2026 como primeiro caso do golden set, com os
      números já conferidos em produção (21 atividades, 435 km, 40,1 h; mediana de
      sono 7,03 h; nota 3,72; 27 noites contra 14 de julho).
- [x] T1.5 Barreira de arquitetura no `architecture.test.ts`: **nada em
      `shared/src/ia/` importa rede ou SDK.**

## Fase 2 — A costura de narração

- [x] T2.1 Interface `Narrador` e o adaptador `google.ts` — `fetch` puro contra
      `generativelanguage.googleapis.com`, sem SDK. Retorna texto + `provedor` +
      `modelo` + tokens.
- [x] T2.2 Edge function `ia-narrar`: recebe o pacote, lê `AI_PROVIDER`/`AI_MODEL`
      de `secrets`, chama o adaptador, devolve. `verify_jwt = true`.
- [x] T2.3 Migration `edicoes_ia`: `(user_id, tipo_periodo, inicio, fim)` como chave,
      mais `texto`, `provedor`, `modelo`, `gerado_em`, `agg_version_no_momento`. RLS.
      **Não aplicar sem "pode".**
- [x] T2.4 As três verificações mecânicas, no núcleo e testadas: todo número citado
      existe no pacote · nenhuma palavra de causa ligando métricas · nenhuma
      correlação fora do portão promovida a manchete. Falhou, rejeita e não grava.
- [x] T2.5 Smoke test do caminho inteiro com o pacote de agosto, comparando a saída
      com o parágrafo escrito à mão na §6 do spec.

## Fase 3 — Primeiro consumidor: a Retrospectiva no celular

- [x] T3.1 Parágrafo no topo da retro, **só em período fechado**, com a data de
      fechamento visível. Período em curso segue como está hoje.
- [x] T3.2 Errata: se `agg_version_no_momento` divergir do atual, marcar a edição —
      não reescrever.
- [x] T3.3 Estado de carregamento e de falha que não quebram a página: sem parágrafo,
      a retro é exatamente o que já é.
- [x] **T3.4 CONFERIDA no iPhone em 06/09.** Nada segue sem isso — e seguiu.

## Fase 4 — Web e os outros consumidores

- [ ] T4.1 O mesmo bloco na retro da web (que ganhou o bloco de Sono em 06/09).
- [ ] T4.2 Uso 2 — leitura de sono por período, reaproveitando o pacote.
- [ ] T4.3 Uso 3 — leitura de saúde/FC/esporte por período.

## Veredito do usuário sobre o texto (06/09)

> *"ainda está fraca e apenas lendo os dados, quero algo mais analítico junto"*

O diagnóstico não é "seco": é **descritivo em vez de analítico**. O parágrafo
transcreve o que aconteceu e não diz o que aquilo significa. Duas causas
separadas, e só a segunda é de redação:

1. **O pacote não carrega o que sustentaria análise.** No caso de agosto,
   `correlacoes` e `lacunas` vieram vazias e `eventos` tinha um item. Sem
   gatilho × métrica, sem dia atípico, sem streak quebrado, não há o que
   analisar — só o que listar. É a instrumentação de contexto que o intent de
   21/08 chamou de fosso, e ela não existe ainda.
2. **O prompt manda escolher, mas não manda concluir.** Ele proíbe causa (com
   razão) e pede a observação mais notável — mas não pede a **leitura** do
   contraste. "Fez mais e pediu menos" é análise; "21 atividades e 435 km" é
   leitura.

A tensão a resolver com o time: **análise sem causalidade**. A lei de 21/08 diz
que a LLM não afirma causa, e a §1.8 da política do Google proíbe decisão
automática — mas nenhuma das duas proíbe *interpretar um contraste*. Onde fica a
linha entre "notar que duas medidas discordam" e "explicar por quê" é a decisão
que a próxima sessão precisa tomar. Sem ela, mexer no prompt é chute.

Ferramentas que já existem para medir a melhora: `PROMPT_VERSAO` (hoje 2) e a
assinatura gravada em cada edição.

## Fase 5 — O chat (desenhado para, não construído)

Destino declarado pelo Sydnei: *"será implementado em cima de tudo que tem no app."*
É a página de opinião do jornal — entra por outra porta, com outra cara, e o leitor
sabe que mudou de seção. Não começa antes das Fases 1–4 estarem em pé.

- [ ] T5.1 Cache de contexto (US$ 0,03/1M, um décimo da entrada) — é o que derruba o
      custo do chat de ~US$ 19/ano para poucos dólares.
- [ ] T5.2 Recuperação sobre os 10 módulos: qual pacote responde qual pergunta.
- [ ] T5.3 A separação visual de "opinião" contra "notícia".

## Riscos vivos

- **O provedor muda debaixo do pé.** Em nove meses o Google cortou cota em 92% sem
  aviso, reescreveu os termos, mudou para Prepay, tirou tabelas da doc e anunciou o
  dobro do preço dos 3.x a partir de 01/01/2027. A ADR 0040 é a resposta; a Fase 1
  não depender de provedor é a prova dela.
- **O veredito do tier repousa em leitura conservadora.** A cláusula da EEA foi
  escrita para quem distribui app a terceiros, e ele é o único usuário do próprio
  app. Custa poucos dólares por ano seguir a leitura estrita e comprar tranquilidade
  sobre dado de saúde — mas é leitura, não fato.
- **A outra aba.** `packages/shared/src/period/retro.ts` foi modificado durante a
  sessão de 06/09 por outra sessão concorrente. A Fase 1 encosta nesse arquivo.
