import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';

type ReferenceImagePayload = {
  base64Data: string;
  mimeType: string;
};

type LlmRequestBase = {
  provider?: unknown;
  model?: unknown;
};

type SuggestionsRequestBody = LlmRequestBase & {
  base64Data?: unknown;
  mimeType?: unknown;
};

type EditRequestBody = SuggestionsRequestBody & {
  prompt?: unknown;
  referenceImage?: unknown;
};

type LlmContentPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeneratedContent = {
  image: string | null;
  text: string | null;
};

class HttpError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const PORT = Number(process.env.PORT) || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_SUGGESTION_MODEL = normalizeEnv(process.env.GEMINI_SUGGESTION_MODEL) || 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL =
  normalizeEnv(process.env.GEMINI_IMAGE_MODEL) || 'gemini-2.5-flash-image-preview';

if (!GEMINI_API_KEY) {
  console.error('A variável de ambiente GEMINI_API_KEY não foi definida.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const SUGGESTIONS_PROMPT =
  'Analise os traços faciais da pessoa nesta imagem (formato do rosto, testa, queixo, etc.). Com base nessa análise, sugira 3-4 estilos de penteado que a favoreceriam. Forneça uma breve justificativa (1-2 frases) para cada sugestão. Formate a resposta de forma clara e legível com títulos para cada estilo.';

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = (req.url ?? '').split('?')[0];

  if (method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  try {
    if (method === 'GET' && url === '/health') {
      sendJSON(res, 200, { status: 'ok' });
      return;
    }

    if (method === 'POST' && url === '/api/llm/suggestions') {
      const body = await parseJsonBody<SuggestionsRequestBody>(req);
      const base64Data = ensureNonEmptyString(body.base64Data, 'O campo "base64Data" é obrigatório.');
      const mimeType = ensureNonEmptyString(body.mimeType, 'O campo "mimeType" é obrigatório.');
      const provider = resolveProvider(body.provider);
      const model = resolveModel(body.model, DEFAULT_SUGGESTION_MODEL);

      const suggestions = await generateSuggestions(provider, base64Data, mimeType, model);
      sendJSON(res, 200, { suggestions });
      return;
    }

    if (method === 'POST' && url === '/api/llm/edit') {
      const body = await parseJsonBody<EditRequestBody>(req);
      const base64Data = ensureNonEmptyString(body.base64Data, 'O campo "base64Data" é obrigatório.');
      const mimeType = ensureNonEmptyString(body.mimeType, 'O campo "mimeType" é obrigatório.');
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      const referenceImage = normalizeReferenceImage(body.referenceImage);

      const provider = resolveProvider(body.provider);
      const model = resolveModel(body.model, DEFAULT_IMAGE_MODEL);

      const result = await generateHairstyle(provider, base64Data, mimeType, prompt, referenceImage, model);
      sendJSON(res, 200, result);
      return;
    }

    sendJSON(res, 404, { message: 'Rota não encontrada.' });
  } catch (error) {
    handleError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor LLM pronto em http://localhost:${PORT}`);
});

async function generateSuggestions(
  provider: string,
  base64Data: string,
  mimeType: string,
  model: string
): Promise<string> {
  if (provider === 'gemini') {
    return generateGeminiSuggestions(base64Data, mimeType, model);
  }

  throw new HttpError(`Provedor "${provider}" não é suportado pelo servidor.`, 400);
}

async function generateGeminiSuggestions(
  base64Data: string,
  mimeType: string,
  model: string
): Promise<string> {
  const userImagePart: LlmContentPart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };

  const textPart: LlmContentPart = {
    text: SUGGESTIONS_PROMPT,
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [userImagePart, textPart] },
  });

  const suggestions = response.text;
  if (!suggestions) {
    throw new HttpError('A IA não retornou sugestões. Tente novamente em instantes.', 502);
  }

  return suggestions.trim();
}

async function generateHairstyle(
  provider: string,
  base64Data: string,
  mimeType: string,
  prompt: string,
  referenceImage: ReferenceImagePayload | null,
  model: string
): Promise<GeneratedContent> {
  if (provider === 'gemini') {
    return generateGeminiHairstyle(base64Data, mimeType, prompt, referenceImage, model);
  }

  throw new HttpError(`Provedor "${provider}" não é suportado pelo servidor.`, 400);
}

async function generateGeminiHairstyle(
  base64Data: string,
  mimeType: string,
  prompt: string,
  referenceImage: ReferenceImagePayload | null,
  model: string
): Promise<GeneratedContent> {
  const userImagePart: LlmContentPart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };

  const parts: LlmContentPart[] = [userImagePart];
  let finalPrompt = `Aplique este estilo de cabelo na pessoa da imagem: ${prompt}`;

  if (referenceImage) {
    const referencePart: LlmContentPart = {
      inlineData: {
        data: referenceImage.base64Data,
        mimeType: referenceImage.mimeType,
      },
    };

    parts.push(referencePart);
    const promptFallback = prompt.trim() || 'o estilo da imagem de referência';
    finalPrompt = `Usando o penteado da segunda imagem como principal referência visual, aplique um estilo semelhante na pessoa da primeira imagem. Use a seguinte descrição como guia adicional: ${promptFallback}.`;
  }

  parts.push({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts,
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  if (response.promptFeedback?.blockReason) {
    const { blockReason, blockReasonMessage } = response.promptFeedback;
    const blockMessage = blockReasonMessage || blockReason || 'Solicitação bloqueada por motivos de segurança.';
    throw new HttpError(`Sua solicitação foi bloqueada: ${blockMessage}`, 400);
  }

  const imagePart = findImagePart(response);
  const textPart = findTextPart(response);
  const image = imagePart?.inlineData
    ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
    : null;
  const text = textPart?.text ? textPart.text.trim() : null;

  if (image || text) {
    return { image, text };
  }

  console.error('Provedor LLM não retornou uma imagem nem texto utilizável.', JSON.stringify(response, null, 2));
  throw new HttpError(
    'A IA não conseguiu gerar uma imagem. Tente ajustar a descrição ou utilizar outra imagem de referência.',
    502
  );
}

function findImagePart(response: GenerateContentResponse): LlmContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData) as LlmContentPart | undefined;
}

function findTextPart(response: GenerateContentResponse): LlmContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.text) as LlmContentPart | undefined;
}

function normalizeReferenceImage(value: unknown): ReferenceImagePayload | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    throw new HttpError('O campo "referenceImage" deve ser um objeto com base64Data e mimeType.', 400);
  }

  const reference = value as Record<string, unknown>;
  const base64Data = ensureNonEmptyString(reference.base64Data, 'O campo "referenceImage.base64Data" é obrigatório.');
  const mimeType = ensureNonEmptyString(reference.mimeType, 'O campo "referenceImage.mimeType" é obrigatório.');

  return { base64Data, mimeType };
}

function ensureNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(message, 400);
  }

  return value;
}

function resolveProvider(value: unknown): string {
  const provider = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_PROVIDER;

  if (provider !== 'gemini') {
    throw new HttpError(`Provedor "${provider}" não é suportado pelo servidor.`, 400);
  }

  return provider;
}

function resolveModel(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    throw new HttpError('Corpo da requisição vazio.', 400);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Falha ao fazer parse do corpo da requisição:', error);
    throw new HttpError('Não foi possível interpretar o corpo da requisição como JSON.', 400);
  }
}

function handleOptions(res: ServerResponse): void {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end();
}

function sendJSON(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    console.error('Erro tratado:', error.message);
    sendJSON(res, error.statusCode, { message: error.message });
    return;
  }

  console.error('Erro inesperado ao comunicar com o provedor LLM:', error);
  sendJSON(res, 500, {
    message: 'Erro interno do servidor. Consulte os logs para mais detalhes.',
  });
}

function normalizeEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
