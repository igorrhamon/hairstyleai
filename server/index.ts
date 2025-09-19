import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';

type ReferenceImagePayload = {
  base64Data: string;
  mimeType: string;
};

type SuggestionsRequestBody = {
  base64Data?: unknown;
  mimeType?: unknown;
};

type EditRequestBody = SuggestionsRequestBody & {
  prompt?: unknown;
  referenceImage?: unknown;
};

type GeminiContentPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
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

    if (method === 'POST' && url === '/api/gemini/suggestions') {
      const body = await parseJsonBody<SuggestionsRequestBody>(req);
      const base64Data = ensureNonEmptyString(body.base64Data, 'O campo "base64Data" é obrigatório.');
      const mimeType = ensureNonEmptyString(body.mimeType, 'O campo "mimeType" é obrigatório.');

      const suggestions = await generateSuggestions(base64Data, mimeType);
      sendJSON(res, 200, { suggestions });
      return;
    }

    if (method === 'POST' && url === '/api/gemini/edit') {
      const body = await parseJsonBody<EditRequestBody>(req);
      const base64Data = ensureNonEmptyString(body.base64Data, 'O campo "base64Data" é obrigatório.');
      const mimeType = ensureNonEmptyString(body.mimeType, 'O campo "mimeType" é obrigatório.');
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      const referenceImage = normalizeReferenceImage(body.referenceImage);

      const image = await generateHairstyle(base64Data, mimeType, prompt, referenceImage);
      sendJSON(res, 200, { image });
      return;
    }

    sendJSON(res, 404, { message: 'Rota não encontrada.' });
  } catch (error) {
    handleError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor Gemini pronto em http://localhost:${PORT}`);
});

async function generateSuggestions(base64Data: string, mimeType: string): Promise<string> {
  const userImagePart: GeminiContentPart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };

  const textPart: GeminiContentPart = {
    text: SUGGESTIONS_PROMPT,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [userImagePart, textPart] },
  });

  const suggestions = response.text;
  if (!suggestions) {
    throw new HttpError('A IA não retornou sugestões. Tente novamente em instantes.', 502);
  }

  return suggestions.trim();
}

async function generateHairstyle(
  base64Data: string,
  mimeType: string,
  prompt: string,
  referenceImage: ReferenceImagePayload | null
): Promise<string> {
  const userImagePart: GeminiContentPart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };

  const parts: GeminiContentPart[] = [userImagePart];
  let finalPrompt = `Aplique este estilo de cabelo na pessoa da imagem: ${prompt}`;

  if (referenceImage) {
    const referencePart: GeminiContentPart = {
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
    model: 'gemini-2.5-flash-image-preview',
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
  if (imagePart?.inlineData) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }

  const textPart = findTextPart(response);
  if (textPart?.text) {
    throw new HttpError(`A IA retornou uma mensagem em vez de uma imagem: "${textPart.text}"`, 502);
  }

  console.error('Gemini API não retornou uma imagem utilizável.', JSON.stringify(response, null, 2));
  throw new HttpError(
    'A IA não conseguiu gerar uma imagem. Tente ajustar a descrição ou utilizar outra imagem de referência.',
    502
  );
}

function findImagePart(response: GenerateContentResponse): GeminiContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData) as GeminiContentPart | undefined;
}

function findTextPart(response: GenerateContentResponse): GeminiContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.text) as GeminiContentPart | undefined;
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

  console.error('Erro inesperado ao comunicar com o Gemini:', error);
  sendJSON(res, 500, {
    message: 'Erro interno do servidor. Consulte os logs para mais detalhes.',
  });
}
