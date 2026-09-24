/**
 * As constantes da capa da edição — as que mais de um arquivo precisa combinar.
 *
 * Elas não moram no componente que as usa primeiro porque **duas capas as
 * compartilham**: a de foto e a em papel que desenha. A altura nasceu dentro da
 * `CapaComFoto` e virou um apelido reexportado no dia em que a capa em papel
 * passou a precisar dela — que é justamente a segunda fonte que o TSDoc de lá diz
 * querer evitar.
 */
import type { RoleKey } from '@vitale/shared';

/**
 * A fração da altura da tela que a capa ocupa — `{spacing.capa-altura}: 45vh`.
 *
 * É **mínimo, nunca altura fixa**. A manchete é a chamada inteira e não tem teto
 * de tamanho (`deferred-work.md`, entrada da 1.8), e o tipo dinâmico pode crescer
 * muito: numa caixa fixa, a combinação das duas cortaria o começo da manchete
 * justamente para quem tem baixa visão. Com mínimo, a capa cresce e a imagem — ou
 * o desenho — cresce com ela.
 *
 * A capa em papel só a reserva **quando desenha**: sem desenho vale a regra da
 * 1.13, de não reservar espaço para a imagem que não veio.
 */
export const FRACAO_DA_ALTURA_DA_CAPA = 0.45;

/**
 * O papel cromático da capa desenhada — o traçado e a grade (Story 2.4a).
 *
 * **`orange`, e não `--primary`.** O mockup aprovado pinta o traçado com o laranja
 * do recorte histórico (paleta orbe · tema orbe · claro · marca laranja), em que a
 * marca e o papel `orange` calham de ser a mesma cor — e é exatamente por isso que
 * a escolha precisa estar escrita. `primary` é **cromo**: ele muda com a marca que
 * o dono escolher, e na marca Tinta a rota da capa sairia preta. Rota e célula
 * marcada são **dado**, e dado responde à paleta, não à marca
 * (*marca ≠ cor de dado*).
 *
 * `orange` é o papel do módulo `treino` (`MODULE_ROLE`), que é o que as duas capas
 * mostram: a pedalada do período, e os dias em que houve o quê fazer. Um papel só
 * para as duas naturezas é deliberado — na parede (2.4b) elas ficam lado a lado, e
 * duas tintas fariam a fronteira 2025→2026 parecer troca de assunto em vez de
 * troca de era.
 *
 * Quem lê o quarteto é o componente, no render, por `roleColors(PAPEL_DA_CAPA)`:
 * `graphic` para o traço e a célula marcada (o acento empurrado ao piso de 3,0 de
 * objeto gráfico) e `wash` para a célula vazia (o fundo que existe sem destacar).
 */
export const PAPEL_DA_CAPA: RoleKey = 'orange';

/**
 * Invisível ao leitor de tela, nas duas plataformas — o idioma do `ClimbsCard`.
 *
 * `accessible={false}` **não esconde a subárvore**: ele só diz que aquele nó não
 * é, ele próprio, um elemento de acessibilidade — os filhos continuam sendo
 * varridos. Quem some com eles é `accessibilityElementsHidden` (iOS) e
 * `importantForAccessibility="no-hide-descendants"` (Android), e nenhuma das duas
 * cobre a outra plataforma. O desenho da capa é fundo; quem fala é a legenda
 * carimbada, em texto de verdade logo abaixo.
 */
export const MUDO = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;
