const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

interface SuggestionsResponse {
  suggestions: string;
}

interface EditImageResponse {
  image: string;
}

interface ReferenceImagePayload {
  base64Data: string;
  mimeType: string;
}

interface ErrorResponseBody {
  message?: string;
}

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

export async function getHairstyleSuggestions(base64Data: string, mimeType: string): Promise<string> {
  const response = await postJSON<SuggestionsResponse>('/gemini/suggestions', {
    base64Data,
    mimeType,
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
  referenceImage: ReferenceImagePayload | null
): Promise<string> {
  const response = await postJSON<EditImageResponse>('/gemini/edit', {
    base64Data: base64ImageData,
    mimeType,
    prompt,
    referenceImage: referenceImage ?? null,
  });

  if (typeof response.image !== 'string' || !response.image.trim()) {
    throw new Error('O servidor não retornou a imagem gerada.');
  }

  return response.image;
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
