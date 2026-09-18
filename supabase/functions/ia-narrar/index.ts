/**
 * Narração da camada de IA analítica (verify_jwt=true).
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038, 0040, 0047 e 0048.
 *
 *   POST /ia-narrar   (JWT do usuário)
 *     body { sistema, usuario, json?, motor?, esquema? }   ← `CorpoDoPedido`
 *     → 2xx `CorpoDaResposta`  ·  falha `CorpoDaFalha` (sempre com `classe`)
 *
 *   GET  /ia-narrar   (JWT do usuário)
 *     → { motores: MotorDeNuvemAprovado[] }   ← a lista do servidor (ADR 0048)
 *
 * O `esquema` do corpo é **aceito e não lido** — quem muda o formato de fio é o
 * `json`. Ele conta no teto de tamanho, e nada mais.
 *
 * ## Por que esta function é burra de propósito
 *
 * Ela não monta o pacote de fatos, não escreve o prompt e não confere a resposta.
 * Tudo isso é derivação pura e mora em `packages/shared/src/ia/`, onde roda no
 * aparelho — que é onde a Retrospectiva já é calculada (1.177 linhas de núcleo no
 * telefone). Duplicar essa lógica aqui criaria duas implementações da mesma conta,
 * e é assim que a manchete passa a divergir da tela que o usuário está olhando.
 *
 * O que sobra para o servidor é a única coisa que o cliente não pode fazer:
 * **guardar a chave** — e, desde a 5.6, **dizer quem está aprovado**. A lista de
 * motores de nuvem é do servidor, nunca do cliente (AD-9/ADR 0048): um aparelho
 * não pode se autoconceder um destinatário novo para dado de saúde.
 *
 * **O que ela aprova é o motor, não o par motor×recurso.** A lista carrega os
 * `recursos` de cada motor, mas o corpo do POST **não diz de que recurso é o
 * pedido** — e nem deveria, porque a function é burra. Então quem filtra por
 * recurso é o cliente, ao montar o seletor; aqui a pergunta é só "este motor
 * está na lista?". Um cliente adulterado poderia pedir um motor aprovado para
 * outro recurso, e o efeito disso é escolher entre modelos que o dono já
 * aprovou — nunca um destinatário novo, que é o que esta porta protege.
 *
 * ## O que a 5.6 mudou: a falha passou a ter classe
 *
 * Antes ela devolvia `{ error, detalhe }` — um vocabulário só dela, que nenhum
 * consumidor conseguia usar para decidir. O cliente lia **o status** e adivinhava.
 * Agora toda falha é um {@link CorpoDaFalha}: a `classe` vem de `ia/fio.ts` (as
 * sete de `CLASSES_DE_FALHA`) e o status vem de `STATUS_POR_CLASSE` — não é
 * escolha deste arquivo. É a classe que diz ao orquestrador se ele recua, repete
 * ou cai no piso; o `detalhe` é diagnóstico e **nenhuma decisão o lê**.
 *
 * O import de `ia/fio.ts` é por caminho relativo com extensão, porque o Deno não
 * resolve specifier sem ela — e é por isso que aquele arquivo não importa nada e
 * o `architecture.test.ts` cobra que continue assim. A mesma barreira cobra que
 * nenhum arquivo daqui escreva a grafia de uma classe sem importar o fio.
 *
 * `verify_jwt=true` não é sobre dado do usuário — o corpo já chega pronto. É para
 * a function não virar proxy aberto queimando o crédito Prepay dele.
 *
 * Segredos: AI_PROVIDER, AI_MODEL e a credencial do provedor (ver
 * `_shared/ia/narrador.ts`), mais NUVEM_MOTORES_APROVADOS (ver `_shared/ia/motores.ts`).
 */
import { json, preflight } from '../_shared/auth.ts';
import { ErroDoProvedor, resolverNarrador } from '../_shared/ia/narrador.ts';
import { lerMotoresAprovados } from '../_shared/ia/motores.ts';
import {
  STATUS_POR_CLASSE,
  alvoDoMotorPedido,
  classeDoStatusDoProvedor,
  type ClasseDeFalha,
  type CorpoDaFalha,
} from '../../../packages/shared/src/ia/fio.ts';

/** Teto de entrada. O pacote de um período fechado não passa disso nem de longe. */
const MAX_CHARS = 60_000;

/**
 * A falha, no vocabulário do núcleo. **O status não é escolha daqui**: sai de
 * `STATUS_POR_CLASSE`, para que um hospedeiro que leia só o status (um gateway
 * que engoliu o corpo, um cliente velho) ainda chegue a uma classe segura.
 */
function falha(classe: ClasseDeFalha, detalhe?: string): Response {
  const corpo: CorpoDaFalha = { classe, ...(detalhe !== undefined ? { detalhe } : {}) };
  return json(corpo, STATUS_POR_CLASSE[classe]);
}

/**
 * A classe de um erro que subiu do adaptador.
 *
 * Só o reconhecimento do tipo mora aqui — a tabela de status → classe é do
 * núcleo ({@link classeDoStatusDoProvedor}), porque é decisão de borda e
 * decisão de borda se testa (AD-4), e nenhuma suíte deste repositório executa
 * Deno. Exceção que não é do provedor (fetch que quebrou, o timeout de 30 s do
 * adaptador, um defeito nosso) é `transitoria`: o mesmo pedido no mesmo motor
 * pode dar certo depois.
 */
function classeDoErro(e: unknown): ClasseDeFalha {
  if (!(e instanceof ErroDoProvedor)) return 'transitoria';
  return classeDoStatusDoProvedor(e.status);
}

async function atender(req: Request): Promise<Response> {
  const pre = preflight(req);
  if (pre) return pre;

  // A lista do servidor. Sem corpo, sem efeito, e sempre 200: lista vazia é uma
  // resposta legítima ("nenhum motor nomeado está aprovado"), não um erro — e o
  // hospedeiro trata as duas de formas diferentes, então confundi-las custaria
  // caro. `nuvem:padrao` nunca aparece aqui: ele não depende de lista nenhuma.
  if (req.method === 'GET') return json({ motores: lerMotoresAprovados() });

  if (req.method !== 'POST') return falha('capacidade', `método ${req.method} não atendido`);

  let body: {
    sistema?: unknown;
    usuario?: unknown;
    json?: unknown;
    motor?: unknown;
    /**
     * Declarado, **não lido** — e contado no teto abaixo.
     *
     * O núcleo o manda quando a saída é guiada (`corpoDoPedido`), e nenhum
     * adaptador o consome ainda: quem muda o formato de fio é o `json`. Declarar
     * um campo que se ignora é honestidade barata; deixá-lo fora do teto não era —
     * um esquema grande passaria inteiro pelo guardrail de tamanho e só o limite
     * da plataforma o pararia, com outra mensagem e outra classe.
     */
    esquema?: unknown;
  };
  try {
    const lido: unknown = await req.json();
    // JSON válido que não é objeto — `null`, um número, uma lista — é o caso em
    // que ler `body.sistema` **lançaria**, e uma exceção aqui viraria um 500 sem
    // classe nenhuma. É a única coisa que a invariante "toda falha tem classe"
    // não tolera.
    if (typeof lido !== 'object' || lido === null || Array.isArray(lido)) {
      return falha('capacidade', 'json_invalido');
    }
    body = lido;
  } catch {
    return falha('capacidade', 'json_invalido');
  }

  const sistema = typeof body.sistema === 'string' ? body.sistema : '';
  const usuario = typeof body.usuario === 'string' ? body.usuario : '';
  // Repassa a intenção sem interpretá-la — a function continua burra (ADR 0042).
  const querJson = body.json === true;

  if (!sistema.trim() || !usuario.trim()) return falha('capacidade', 'prompt_vazio');
  // O teto cobre o corpo inteiro que iria ao modelo, e não só o par: o `esquema`
  // viaja junto e, no dia em que um adaptador o traduzir, ele consome contexto
  // como qualquer outra palavra. Contá-lo agora faz o guardrail já valer para o
  // que ele vai passar a governar, em vez de abrir um buraco calado enquanto isso.
  const doEsquema = body.esquema === undefined ? 0 : JSON.stringify(body.esquema)?.length ?? 0;
  if (sistema.length + usuario.length + doEsquema > MAX_CHARS) {
    return falha('janela', `prompt_muito_longo (max ${MAX_CHARS})`);
  }

  const escolha = alvoDoMotorPedido(body.motor, lerMotoresAprovados());
  if ('recusa' in escolha) return falha('indisponivel', escolha.recusa);

  let resolvido: ReturnType<typeof resolverNarrador>;
  try {
    resolvido = resolverNarrador(escolha.alvo);
  } catch (e) {
    // Configuração faltando é erro de operação, não do chamador — e a mensagem
    // diz qual segredo falta, para não virar caça ao tesouro. `indisponivel`
    // porque outro elo da cadeia pode atender: o piso sempre pode.
    console.error('ia-narrar config:', e);
    return falha('indisponivel', String(e));
  }

  try {
    const n = await resolvido.narrador.narrar(
      { sistema, usuario, json: querJson },
      resolvido.modelo,
      resolvido.chave,
    );
    return json(n);
  } catch (e) {
    // A mensagem carrega o status e o corpo do provedor — sem isso, cota esgotada
    // e chave inválida chegam idênticas no aparelho (a lição do Overpass, 06/09).
    // O que decide, porém, é a **classe**, não o texto: é ela que diz ao
    // orquestrador se recua (indisponivel), se cai no piso (transitoria) ou se a
    // resposta é que não se lê (saida-invalida).
    console.error('ia-narrar:', e);
    return falha(classeDoErro(e), String(e));
  }
}

/**
 * **Nenhuma resposta sai sem classe** — nem a que nasce de um defeito nosso.
 *
 * Sem esta rede, uma exceção fora dos dois `try` de `atender` viraria o 500 de
 * texto que o runtime escreve sozinho: um corpo que não é `CorpoDaFalha`, que o
 * cliente leria pelo status (`transitoria`, por sorte) e que não apareceria no
 * anel com motivo nenhum. `transitoria` é o desfecho seguro — cai no piso, não
 * repete e não grava.
 */
Deno.serve(async (req: Request): Promise<Response> => {
  try {
    return await atender(req);
  } catch (e) {
    console.error('ia-narrar defeito:', e);
    return falha('transitoria', String(e));
  }
});
