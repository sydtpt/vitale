# Epic 4 Context: A lua sob pré-registro

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

O dono abre a página da lua e recebe um veredito sobre lua × início do sono — inclusive "faltam cerca de 106 noites" — com o mesmo destaque que um achado teria. O épico existe porque há um prior declarado ("estou me observando nisso") e um sistema que procura o que o dono já acredita encontra: o teste só vale se rodar exatamente como o pré-registro de 07/09/2026 o fixou, antes de qualquer olhar ao dado, e se cada execução ficar permanente e contável. Os dois artefatos obrigatórios já existem (`docs/specs/revista-retrospectiva/pre-registro-lua.md` e `correcao-pre-registro-lua.md`, mais a ADR 0046), então o épico está liberado.

## Stories

- Story 4.1: O instante da lua cheia entra na efeméride
- Story 4.2: O teste lunar sob protocolo, e `lua_execucoes`
- Story 4.3: A barreira do hash, incondicional e offline
- Story 4.4: A página da lua

## Requirements & Constraints

- **O protocolo é imutável e manda.** Desfecho primário único: hora de apagar, em minutos desde a meia-noite. Exposição: as 5 noites que **antecedem** a lua cheia (fase −5 a −1), contra todas as outras. Duas colunas, nunca oito caixas de fase. Direção: atraso, unilateral, α = 5%. Limiar prático de 15 min.
- **Nenhum dado lunar pode ser consultado antes de o teste rodar.** Nem mediana por fase, nem contagem por coluna. O único número permitido antes é o desvio-padrão marginal da hora de apagar. Consultar mais invalida o pré-registro.
- **Três portões** — ≥ 5 noites por coluna (`TRIGGER_MIN_PER_CELL`), ≥ 10 ciclos sinódicos distintos contribuindo, luz do dia disponível para todas as noites. Qualquer um reprovado ⇒ **inconclusivo**, nunca "nenhum padrão".
- **Três vereditos, todos publicáveis na mesma página:** achado (≥ 15 min · p < 0,05 · poder ≥ 80%), nenhum padrão (não significante com poder ≥ 80%), inconclusivo (poder < 80% ou portão reprovado — imprime quantas noites faltam).
- **O sol é pré-requisito da lua:** sem horas de luz como covariável o teste não roda. Sol e lua são derivados na leitura, nunca gravados, o que os torna retroativos de graça.
- **Secundários** (duração, latência, despertares) são exploratórios: nunca manchete, nunca capa.
- Reexecução na cadência de +100 noites, com contador visível. Uma execução é decisão, não render.

## Technical Decisions

- **A efeméride fica onde já mora.** `astro/moon.ts` é o dono do conceito lua e ganha o instante verdadeiro das fases (Meeus cap. 49, erro de minutos), não um módulo novo. Ele **continua sem devolver idade em dias** — a idade sai da elongação com até ~0,8 dia de erro, que numa janela de cinco noites embaralha a coluna testada com a de controle.
- **A janela sai do instante da cheia, não da idade:** `[cheia − 5 dias, cheia)`, **aberta à direita**. Fechar à direita incluiria a noite de maior valor esperado sob a hipótese e excluiria a −5 — a coluna testada andaria uma noite, e isso é desvio de protocolo com cara de precisão. Esse deslocamento **não falha teste nenhum de formato**: mede ruído com aparência de protocolo (risco R-18, nota 6).
- **A noite é representada por um instante fixo do fim da noite (08:00 UTC do `wakeDay`)**, nunca pelo `apagou` medido: classificar a exposição pelo desfecho seria endógeno — uma noite na fronteira trocaria de coluna por causa do efeito medido. Fixo em UTC, e não em hora local, porque a troca de horário daria 4 ou 6 noites numa janela.
  > **Mudou em 17/09/2026, por decisão do dono:** do entardecer para o fim da noite, e na revisão da 4.1 de 11:00 para 08:00 UTC. Os dois erros que qualquer hora fixa carrega ficam declarados — acordar antes das 08:00 UTC pode tirar da janela a noite que terminou antes da cheia (contra o achado); acordar depois pode pôr nela, como −1, a noite que a contém (a favor). A nota completa está na AD-6 da espinha da revista; o pré-registro não muda.
- **O teste mora em `sleep/lua.ts`.** Desfecho, portões e regra das duas colunas são vocabulário de sono. Não em `ia/` (é calculado sob protocolo, não narrado, e não assina modelo) e não em `astro/` (efeméride pura, que não sabe o que é uma noite).
- **A coordenada é constante do núcleo** (`COORDENADA_DA_LUZ`, ~50,8° N), nunca `deviceCoords()`: dois hospedeiros têm de produzir o mesmo resultado. Viagem não é modelada.
- **`lua_execucoes` é tabela própria:** chave surrogate, uma linha por execução, RLS pelo dono, acumula. Carrega o hash do pré-registro que autorizou, a janela, o veredito (`achado` · `nenhum_padrao` · `inconclusivo`), noites dentro e fora, ciclos distintos, noites faltantes e o portão reprovado (`amostra` · `ciclos` · `luz`). Efeito, p e poder ficam **nulos** quando o portão reprovou antes de medir — nulo é "não foi medido", nunca zero. Dono do acesso em `shared/src/data/lua-execucoes.ts`. A página lê a última linha e nunca calcula ao abrir.
- **A barreira do hash é incondicional e offline** (`architecture.test.ts`): pina a sha256 do pré-registro **e** de cada documento de correção, e quebra o build sempre que divergir, tenha havido execução ou não. A suíte roda com `tsx`, sem banco; um teste que dependesse de rede seria verde por não executar. `PRE_REGISTRO_LUA_SHA` nasce na 4.2; o guarda, na 4.3.
- Testes do `shared` são scripts `tsx` com `node:assert`, sem framework; valores de efeméride vêm de fonte oficial e são a única verdade do teste.

## UX & Interaction Patterns

- A moldura é invariável em **campos**, não em pixels: janela testada · desfecho · noites e ciclos · próxima leitura · contador de execuções — sempre presentes e na mesma ordem, sem variante curta para "não deu nada".
- Quatro estados: os três vereditos e "ainda não rodou" (com a data da primeira leitura), que é onde a página passa a maior parte do tempo.
- O bloco do veredito **cresce com o texto**, igual nos três vereditos; altura fixa é proibida (corta em AX3).
- Não assina modelo: a procedência é o hash do pré-registro e o contador. Sem faixa de caderno e sem ícone; abre com a fase sinódica desenhada, com a fatia das cinco noites destacada.
- A luz do dia vive no rodapé do método e só sobe para o bloco do veredito quando o portão da luz é o que reprovou.
- A entrada é uma linha no pé do caderno Sono que **nomeia o veredito por extenso**, idêntica nos quatro estados. Rótulos obrigatórios em `ink2`, nunca `ink3`.

## Cross-Story Dependencies

- 4.1 → 4.2: o teste classifica cada noite pela janela que a 4.1 entrega.
- **Regra de ordem (17/09/2026):** o pré-registro novo das outras fases (lua nova e quartos) tem de ser escrito e datado **antes da primeira execução da 4.2**, porque a coluna "fora" da cheia contém as noites das outras fases — ver a entrada sobre as outras fases em `deferred-work.md`.
- 4.2 → 4.3: a constante do hash nasce antes do guarda; nenhuma das duas depende de story futura.
- 4.2 → 4.4: a página lê a última linha de `lua_execucoes`.
- A 4.4 vive dentro do caderno Sono da revista, e por isso depende da superfície da edição do Épico 1 (1.11–1.14).
- A luz do dia como covariável já entrou nos pacotes pela Story 1.6 (`astro/sun.ts`, `astro/casa.ts`).
- A 4.2 traz a única migração do épico; migração e JS que a lê seguem a regra de entrega única do projeto.
