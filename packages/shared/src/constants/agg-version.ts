/**
 * A versão da lógica de agregação da saúde — **dono único** deste vocabulário.
 *
 * Dois consumidores, uma constante. O sync do mobile a compara com o cursor
 * local para decidir se precisa de um re-backfill; a edição da Retrospectiva
 * carimba o valor vigente na linha, e `precisaErrata` compara o carimbo com o
 * valor de hoje. Enquanto ela morava como `const` privada dentro do sync, o
 * segundo consumidor recebia `undefined` por quatro passagens opcionais em fila
 * e gravava nulo — nenhuma edição em produção era elegível a errata.
 *
 * **O valor não viaja.** Quem grava a edição lê esta constante no ponto de
 * gravação (`data/edicoes-ia.ts`); não existe parâmetro nem campo por onde um
 * hospedeiro — telefone, script de backfill, hospedeiro futuro — informe a
 * versão. Um parâmetro tipado garante *presença*, nunca *correção*, e o valor
 * errado está a uma palavra de distância no mesmo barril.
 *
 * **Incrementar é global e caro.** Um bump dispara backfill em todos os
 * dispositivos (recorrige o histórico já gravado) e marca errata em **todas** as
 * edições anteriores. Isso está certo — se a agregação mudou, toda edição
 * anterior é potencialmente velha —, mas o custo é declarado: não se bumpa para
 * consertar um dia.
 *
 * História (movida do sync junto com a constante; é a razão de ser dela):
 *
 * v1 = correção do sono (união de fontes + priorização de estágios + atribuição
 * ao dia de despertar).
 * v2 = dedupe por fonte nas cumulativas (passos/distância/andares/energia vinham
 * somando iPhone + relógio, dobrando a contagem).
 * v3 = detalhamento do sono por estágio (deep/rem/core/unspecified/awake) no
 * `extra`; o backfill recupera o hipnograma do histórico já gravado, porque as
 * amostras cruas seguem no HealthKit do aparelho.
 * v4 = tempo na cama e latência para pegar no sono (`inbed`/`onset`), que o
 * INBED do HealthKit permitia calcular mas era descartado na agregação.
 * v5 = piso de 1 min para aceitar a latência (`MIN_ONSET_MS`). O Garmin abre o
 * `INBED` 1 s antes do sono, gerando `onset` ≈ 0 que se disfarçava de "apagou na
 * hora"; o backfill reescreve essas linhas sem a chave falsa (o upsert troca o
 * `extra` inteiro, não faz merge).
 * v6 = sono passa a gravar `sleep_periods` (instantes, vigílias individuais,
 * janela na cama crua) e a linha diária vira DERIVADA dos períodos — uma fonte,
 * duas formas. Três correções entram no mesmo backfill: o AWAKE em segmentos
 * encostados (Garmin) deixa de ser descartado (36 de 38 noites vinham zeradas);
 * a janela na cama vira a união das INBED, nunca menor que o sono (14 noites do
 * histórico tinham eficiência > 100%); e `value` fica idêntico ao de antes,
 * por teste de paridade. Ver docs/specs/sono/.
 * v7 = onset truncado ao minuto NO CLIENTE, antes de derivar a janela na cama.
 * No v6 só a RPC truncava, e um INBED começando no mesmo minuto ficava até 57 s
 * DEPOIS do onset — 57 noites violando `in_bed_at <= onset_at`. Mesma chave,
 * mesmas linhas: o backfill só corrige o `in_bed_at`.
 * v8 = `stage_segments`: os intervalos por estágio na posição real, que o
 * agregador já fatiava e não emitia. É o dado da Opção 2 da CAP-7 (estágios na
 * barra do timing chart) e do detalhe da noite. Mesma chave, mesmas linhas; só a
 * coluna nova se preenche.
 * v9 = série intradiária da FC em `health_series` (minuto → bpm), a partir das
 * mesmas amostras que já produziam a linha diária; o teto das pesadas sobe de 60
 * para 200 dias, fatiado. A linha diária de `fc` não muda de valor — só ganha
 * dias anteriores a fev/2026 que o teto de 60 nunca alcançou. Ver docs/specs/fc-serie/.
 */
export const AGG_VERSION = 9;
