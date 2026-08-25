# Resolução de contradição — o Garmin Developer Program está aberto ou fechado?

Resolvido pelo lead, 2026-08-21, com fetch direto das páginas primárias.

## A contradição

- **D2a-[3]/[4]** afirmou: programa **PAUSADO** desde ~abr/2026, sem previsão. Evidência: resposta de funcionário da Garmin (Partner Services) em thread do fórum oficial + issue no repo `open-wearables` (09/06/2026) relatando que o formulário foi removido + blog datado de 21/08/2026.
- **D2b-[C4]** afirmou: programa **ATIVO e aceitando solicitações**. Evidência: texto da Program FAQ em developer.garmin.com, lido diretamente — "we will confirm the status of your application within two business days".

A regra do pack: conflitos resolvem por **recência, consistência com fatos adjacentes e qualidade do publisher — nunca por média**. Ambos citavam fonte defensável, então fui à primária.

## Verificação do lead (fetch direto, 2026-08-21)

**Página de overview do programa** — `https://developer.garmin.com/gc-developer-program/overview/`:
> A página **não contém nenhum link ou botão visível** para solicitar ou aplicar a acesso de API. O conteúdo diz "Stay tuned for more updates on the program", sem qualquer mecanismo de aplicação.

**Program FAQ** — `https://developer.garmin.com/gc-developer-program/program-faq/`:
> Nenhum aviso de pausa. Descreve o processo ("we will confirm the status of your application within two business days"). Contém a frase "Stay tuned for more updates on the program". **Sem data de última atualização.**
> Sobre elegibilidade, texto explícito: **"it is only for business use"** — nenhuma acomodação para uso pessoal ou hobbyista.

## Resolução

**D2a está correto quanto à substância; D2b leu boilerplate de processo como evidência de programa aberto.**

O fato decisivo é comportamental, não textual: **a página primária do programa não tem mais formulário de aplicação.** Uma FAQ que descreve *como* o processo funciona não é evidência de que o processo esteja *disponível* — e a FAQ não tem data de revisão, então é texto legado que sobreviveu à mudança. A frase "Stay tuned for more updates on the program", presente nas duas páginas, é exatamente a linguagem branda que D2a sinalizou como divergente da resposta direta do funcionário no fórum.

**Status registrado:** o Garmin Connect Developer Program está **efetivamente fechado a novos solicitantes** em 21/08/2026 — sem formulário na página oficial, com funcionário da Garmin confirmando pausa sem previsão, e com caso documentado de solicitante recebendo confirmação da remoção do formulário. `class=version/compatibility`, satisfaz a barra de duas fontes com folga (fórum oficial + issue GitHub + ausência verificada do formulário na primária).

## Ganho colateral — claim promovida

A exclusão de uso pessoal, que D2a só tinha via documentação de terceiro (Open Wearables, confidence medium-high), agora está **confirmada em fonte primária da Garmin**: a FAQ oficial diz **"it is only for business use"**.

→ Claim promovida a **confidence: high**, com duas fontes independentes (FAQ oficial da Garmin + openwearables.io).

## Consequência para a decisão

As duas travas são independentes e cada uma sozinha já bloqueia o caminho oficial para este caso de uso:

1. **Uso pessoal é excluído por política** — vale mesmo se o programa reabrir amanhã.
2. **O programa está fechado a novos solicitantes** — vale mesmo para quem tem pessoa jurídica.

Um app pessoal de um desenvolvedor solo falha nas duas.
