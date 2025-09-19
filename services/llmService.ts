const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
const FALLBACK_PROVIDER = 'gemini';
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image-preview';
const FALLBACK_SUGGESTION_MODEL = 'gemini-2.5-flash';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

interface SuggestionsResponse {
  suggestions: string;
}

interface EditImageResponse {
  image?: string;
  text?: string;
}

interface ReferenceImagePayload {
  base64Data: string;
  mimeType: string;
}

interface ErrorResponseBody {
  message?: string;
}

export interface LlmRequestOptions {
  provider?: string;
  model?: string;
  suggestionsModel?: string;
}

export interface LlmEditResult {
  image: string | null;
  text: string | null;
}

type RequiredLlmOptions = {
  provider: string;
  model: string;
  suggestionsModel: string;
};

export const DEFAULT_LLM_PROVIDER = normalizeEnv(import.meta.env?.VITE_LLM_PROVIDER) || FALLBACK_PROVIDER;
export const DEFAULT_LLM_MODEL = normalizeEnv(import.meta.env?.VITE_LLM_MODEL) || FALLBACK_IMAGE_MODEL;
export const DEFAULT_LLM_SUGGESTION_MODEL =
  normalizeEnv(import.meta.env?.VITE_LLM_SUGGESTION_MODEL) ||
  normalizeEnv(import.meta.env?.VITE_LLM_MODEL) ||
  FALLBACK_SUGGESTION_MODEL;

export const DEFAULT_LLM_OPTIONS: RequiredLlmOptions = Object.freeze({
  provider: DEFAULT_LLM_PROVIDER,
  model: DEFAULT_LLM_MODEL,
  suggestionsModel: DEFAULT_LLM_SUGGESTION_MODEL,
});

export async function getHairstyleSuggestions(
  base64Data: string,
  mimeType: string,
  options: LlmRequestOptions = {}
): Promise<string> {
  const response = await postJSON<SuggestionsResponse>('/llm/suggestions', {
    base64Data,
    mimeType,
    provider: resolveProvider(options.provider),
    model: resolveModel(options.suggestionsModel ?? options.model, DEFAULT_LLM_SUGGESTION_MODEL),
  });

  if (typeof response.suggestions !== 'string' || !response.suggestions.trim()) {
    throw new Error('O servidor não retornou sugestões válidas.');
  }

  return response.suggestions;
}

export async function editImageWithHairstyle(
  base64ImageData: string,
  mimeType: string,
  prompt: string,
  referenceImage: ReferenceImagePayload | null,
  options: LlmRequestOptions = {}
): Promise<LlmEditResult> {
  const response = await postJSON<EditImageResponse>('/llm/edit', {
    base64Data: base64ImageData,
    mimeType,
    prompt,
    referenceImage: referenceImage ?? null,
    provider: resolveProvider(options.provider),
    model: resolveModel(options.model, DEFAULT_LLM_MODEL),
  });

  const image = typeof response.image === 'string' && response.image.trim() ? response.image : null;
  const text = typeof response.text === 'string' && response.text.trim() ? response.text : null;

  if (!image && !text) {
    throw new Error('O servidor não retornou conteúdo gerado.');
  }

  return { image, text };
}

function resolveProvider(provider?: string): string {
  return provider?.trim() || DEFAULT_LLM_PROVIDER;
}

function resolveModel(model: string | undefined, fallback: string): string {
  const normalizedModel = model?.trim();
  if (normalizedModel) {
    return normalizedModel;
  }

  return fallback;
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const url = buildUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e se o backend está em execução.'
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Falha desconhecida ao comunicar com o servidor.');
  }

  const parsedBody = await parseResponseBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(parsedBody);
    throw new Error(message);
  }

  if (parsedBody === null || typeof parsedBody !== 'object') {
    throw new Error('Resposta inválida do servidor.');
  }

  return parsedBody as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      console.error('Falha ao interpretar o JSON retornado pelo servidor.', error);
      return null;
    }
  }

  const text = await response.text();
  return text || null;
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body && typeof (body as ErrorResponseBody).message === 'string') {
    const message = (body as ErrorResponseBody).message?.trim();
    if (message) {
      return message;
    }
  }

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  return 'Falha ao comunicar com o servidor. Tente novamente mais tarde.';
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!API_BASE_URL) {
    return normalizedPath;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

function normalizeEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
