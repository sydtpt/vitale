/**
 * A costura de provedor de modelo (ADR 0040).
 *
 * Aqui mora TUDO que conhece fornecedor: chave, URL, formato de fio. Nada disso
 * sobe para `packages/shared` — o `architecture.test.ts` recusa até o nome de um
 * fornecedor em `shared/src/ia/`.
 *
 * O que chega já vem pronto do núcleo: `{ sistema, usuario }`. O adaptador só
 * mapeia isso para o formato do provedor e devolve o texto. É deliberadamente
 * burro — é o que faz trocar de empresa custar um arquivo, e não uma refatoração.
 *
 * Deno puro, sem imports: esta function é deployada sozinha.
 */

export interface Prompt {
  sistema: string;
  usuario: string;
  /**
   * Pede que a resposta seja um objeto JSON (ADR 0042).
   *
   * É **intenção, não formato de fio**: quem sabe que isso vira `responseMimeType`
   * no provedor atual é o adaptador, e é justamente por isso que o campo pode
   * existir aqui sem quebrar a ADR 0040. O nome de rota precisa dele — sem a
   * garantia da API, o objeto chega embrulhado em prosa ou em cerca de código, e a
   * leitura passa a depender de heurística de texto.
   */
  json?: boolean;
}

export interface Narracao {
  texto: string;
  provedor: string;
  /** O id exato reportado pelo provedor — é o que vai gravado na edição. */
  modelo: string;
  tokens: { entrada: number; saida: number };
  /**
   * Por que o modelo parou. `STOP` é conclusão; qualquer outra coisa —
   * `MAX_TOKENS` à frente — significa texto truncado, e texto truncado nunca
   * pode virar edição. Sem este campo a truncagem chega como um parágrafo que
   * termina no meio da frase e parece escolha editorial.
   */
  motivoDeParada: string;
  /** Contagem crua do provedor, para o registro de custo e diagnóstico. */
  uso: Record<string, unknown>;
}

export interface Narrador {
  narrar(prompt: Prompt, modelo: string, chave: string): Promise<Narracao>;
}

/**
 * Teto de saída. Folgado de propósito: nos modelos que raciocinam antes de
 * escrever, este teto cobre o raciocínio **e** o texto — 800 rendeu 27 tokens de
 * parágrafo e uma frase cortada no meio. O parágrafo em si custa ~400.
 */
const MAX_TOKENS_SAIDA = 8_000;

/**
 * Baixa de propósito. O trabalho é relatar fato apurado, não achar formulação
 * criativa — e variação alta é o que faz o modelo inventar número para arredondar
 * uma frase bonita, que é exatamente o que a verificação reprova.
 */
const TEMPERATURA = 0.4;

const TIMEOUT_MS = 30_000;

/**
 * Adaptador do provedor cujo endpoint é `generativelanguage.googleapis.com`.
 *
 * Ausência deliberada: **`tools` não é enviado**. Grounding (Search/Maps) retém
 * prompt, contexto e saída por 30 dias em qualquer tier, sem opt-out — inaceitável
 * para dado de sono e frequência cardíaca. E é inútil aqui: os fatos vêm do
 * pacote, não da web.
 */
const googleNarrador: Narrador = {
  async narrar(prompt, modelo, chave) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${url}?key=${encodeURIComponent(chave)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.sistema }] },
          contents: [{ role: 'user', parts: [{ text: prompt.usuario }] }],
          generationConfig: {
            temperature: TEMPERATURA,
            maxOutputTokens: MAX_TOKENS_SAIDA,
            // Onde a intenção `json` vira formato de fio. Só aqui.
            ...(prompt.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });

      if (!r.ok) {
        // O corpo do erro nomeia a causa (cota, chave, modelo inexistente). Sem
        // ele, a mensagem que chega no aparelho é "falhou" — a lição do Overpass
        // em 06/09: erro que não se nomeia custa um dia de investigação.
        const corpo = (await r.text()).slice(0, 400);
        throw new Error(`provedor google HTTP ${r.status}: ${corpo}`);
      }

      const j = await r.json();
      const cand = j?.candidates?.[0];
      const motivoDeParada: string = cand?.finishReason ?? 'DESCONHECIDO';
      // Alguns modelos devolvem o texto repartido em vários `parts` — juntar é
      // obrigatório, senão o parágrafo chega pela metade sem nada acusar.
      const texto: string = (cand?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '')
        .join('');
      if (!texto.trim()) {
        throw new Error(`provedor google devolveu texto vazio (${motivoDeParada})`);
      }

      return {
        texto: texto.trim(),
        motivoDeParada,
        uso: j?.usageMetadata ?? {},
        provedor: 'google',
        // `modelVersion` é o id REAL que atendeu, que pode diferir do pedido
        // quando um alias resolve para outra versão. A edição grava o que
        // respondeu, não o que se pediu.
        modelo: j?.modelVersion ?? modelo,
        tokens: {
          entrada: j?.usageMetadata?.promptTokenCount ?? 0,
          saida: j?.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

const NARRADORES: Record<string, Narrador> = {
  google: googleNarrador,
};

/** Chave do segredo que guarda a credencial de cada provedor. */
const SEGREDO: Record<string, string> = {
  google: 'GEMINI_API_KEY',
};

/**
 * Resolve provedor, modelo e chave a partir do ambiente.
 * Trocar de fornecedor é `supabase secrets set` — não é deploy (ADR 0040).
 */
export function resolverNarrador(): { narrador: Narrador; provedor: string; modelo: string; chave: string } {
  const provedor = Deno.env.get('AI_PROVIDER') ?? 'google';
  const narrador = NARRADORES[provedor];
  if (!narrador) {
    throw new Error(
      `AI_PROVIDER='${provedor}' não tem adaptador. Conhecidos: ${Object.keys(NARRADORES).join(', ')}`,
    );
  }
  const modelo = Deno.env.get('AI_MODEL');
  if (!modelo) throw new Error('AI_MODEL não configurado');
  const chave = Deno.env.get(SEGREDO[provedor]);
  if (!chave) throw new Error(`${SEGREDO[provedor]} não configurado`);
  return { narrador, provedor, modelo, chave };
}
