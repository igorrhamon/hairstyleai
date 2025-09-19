import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'node:http';

import { HttpError } from './http-error';
import { createGeminiProvider } from './providers/gemini';
import { createOpenAIProvider } from './providers/openai';
import type { ReferenceImagePayload } from './types';

type SuggestionsRequestBody = {
  base64Data?: unknown;
  mimeType?: unknown;
};

type EditRequestBody = SuggestionsRequestBody & {
  prompt?: unknown;
  referenceImage?: unknown;
};

type ProviderKey = 'gemini' | 'openai';

type LlmProvider = {
  name: string;
  generateSuggestions(base64Data: string, mimeType: string): Promise<string>;
  generateHairstyle(
    base64Data: string,
    mimeType: string,
    prompt: string,
    referenceImage: ReferenceImagePayload | null
  ): Promise<string>;
};

const PORT = Number(process.env.PORT) || 3001;
const RAW_PROVIDER = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const SUGGESTIONS_MODEL_ENV = process.env.SUGGESTIONS_MODEL;
const IMAGE_MODEL_ENV = process.env.IMAGE_MODEL;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const DEFAULT_MODELS = {
  gemini: {
    suggestions: 'gemini-2.5-flash',
    image: 'gemini-2.5-flash-image-preview',
  },
  openai: {
    suggestions: 'gpt-4.1-mini',
    image: 'gpt-image-1',
  },
} as const;

const providerKey = resolveProviderKey(RAW_PROVIDER);
const provider: LlmProvider =
  providerKey === 'openai' ? initializeOpenAIProvider() : initializeGeminiProvider();

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

      const suggestions = await provider.generateSuggestions(base64Data, mimeType);
      sendJSON(res, 200, { suggestions });
      return;
    }

    if (method === 'POST' && url === '/api/llm/edit') {
      const body = await parseJsonBody<EditRequestBody>(req);
      const base64Data = ensureNonEmptyString(body.base64Data, 'O campo "base64Data" é obrigatório.');
      const mimeType = ensureNonEmptyString(body.mimeType, 'O campo "mimeType" é obrigatório.');
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      const referenceImage = normalizeReferenceImage(body.referenceImage);

      const image = await provider.generateHairstyle(base64Data, mimeType, prompt, referenceImage);
      sendJSON(res, 200, { image });
      return;
    }

    sendJSON(res, 404, { message: 'Rota não encontrada.' });
  } catch (error) {
    handleError(res, error, provider.name);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor ${provider.name} pronto em http://localhost:${PORT}`);
});

function resolveProviderKey(value: string): ProviderKey {
  if (value === 'gemini' || value === 'openai') {
    return value;
  }

  if (value) {
    console.warn(
      `Valor de LLM_PROVIDER desconhecido "${value}". Utilizando "gemini" como padrão.`
    );
  }

  return 'gemini';
}

function initializeGeminiProvider(): LlmProvider {
  if (!GEMINI_API_KEY) {
    console.error('A variável de ambiente GEMINI_API_KEY não foi definida.');
    process.exit(1);
  }

  return createGeminiProvider({
    apiKey: GEMINI_API_KEY,
    suggestionsModel: SUGGESTIONS_MODEL_ENV ?? DEFAULT_MODELS.gemini.suggestions,
    imageModel: IMAGE_MODEL_ENV ?? DEFAULT_MODELS.gemini.image,
  });
}

function initializeOpenAIProvider(): LlmProvider {
  if (!OPENAI_API_KEY) {
    console.error('A variável de ambiente OPENAI_API_KEY não foi definida.');
    process.exit(1);
  }

  return createOpenAIProvider({
    apiKey: OPENAI_API_KEY,
    suggestionsModel: SUGGESTIONS_MODEL_ENV ?? DEFAULT_MODELS.openai.suggestions,
    imageModel: IMAGE_MODEL_ENV ?? DEFAULT_MODELS.openai.image,
  });
}

function normalizeReferenceImage(value: unknown): ReferenceImagePayload | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    throw new HttpError('O campo "referenceImage" deve ser um objeto com base64Data e mimeType.', 400);
  }

  const reference = value as Record<string, unknown>;
  const base64Data = ensureNonEmptyString(
    reference.base64Data,
    'O campo "referenceImage.base64Data" é obrigatório.'
  );
  const mimeType = ensureNonEmptyString(
    reference.mimeType,
    'O campo "referenceImage.mimeType" é obrigatório.'
  );

  return { base64Data, mimeType };
}

function ensureNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(message, 400);
  }

  return value;
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

function handleError(res: ServerResponse, error: unknown, providerName: string): void {
  if (error instanceof HttpError) {
    console.error(`[${providerName}] Erro tratado:`, error.message);
    sendJSON(res, error.statusCode, { message: error.message });
    return;
  }

  console.error(`[${providerName}] Erro inesperado ao comunicar com o provedor LLM:`, error);
  sendJSON(res, 500, {
    message: 'Erro interno do servidor. Consulte os logs para mais detalhes.',
  });
}
