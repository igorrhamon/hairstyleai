import OpenAI, { APIError } from 'openai';
import type { ResponseOutputItem } from 'openai/resources/responses/responses';

import { HttpError } from '../http-error';
import { SUGGESTIONS_PROMPT } from '../prompts';
import type { ReferenceImagePayload } from '../types';

export type OpenAIProviderConfig = {
  apiKey: string;
  suggestionsModel: string;
  imageModel: string;
};

export type OpenAIProvider = {
  name: 'OpenAI';
  generateSuggestions(base64Data: string, mimeType: string): Promise<string>;
  generateHairstyle(
    base64Data: string,
    mimeType: string,
    prompt: string,
    referenceImage: ReferenceImagePayload | null
  ): Promise<string>;
};

export function createOpenAIProvider(config: OpenAIProviderConfig): OpenAIProvider {
  const client = new OpenAI({ apiKey: config.apiKey });

  async function generateSuggestions(base64Data: string, mimeType: string): Promise<string> {
    try {
      const response = await client.responses.create({
        model: config.suggestionsModel,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: toDataURL(base64Data, mimeType),
                detail: 'auto',
              },
              {
                type: 'input_text',
                text: SUGGESTIONS_PROMPT,
              },
            ],
          },
        ],
      });

      if (response.error) {
        throw new HttpError(`Sua solicitação foi rejeitada: ${response.error.message}`, 400);
      }

      const suggestions = response.output_text?.trim();
      if (!suggestions) {
        throw new HttpError('A IA não retornou sugestões. Tente novamente em instantes.', 502);
      }

      return suggestions;
    } catch (error) {
      handleOpenAIError(error);
    }
  }

  async function generateHairstyle(
    base64Data: string,
    mimeType: string,
    prompt: string,
    referenceImage: ReferenceImagePayload | null
  ): Promise<string> {
    const content: Array<
      | { type: 'input_image'; image_url: string; detail: 'low' | 'high' | 'auto' }
      | { type: 'input_text'; text: string }
    > = [
      {
        type: 'input_image',
        image_url: toDataURL(base64Data, mimeType),
        detail: 'high',
      },
    ];

    let finalPrompt = `Aplique este estilo de cabelo na pessoa da imagem: ${prompt}`;

    if (referenceImage) {
      content.push({
        type: 'input_image',
        image_url: toDataURL(referenceImage.base64Data, referenceImage.mimeType),
        detail: 'high',
      });
      const promptFallback = prompt.trim() || 'o estilo da imagem de referência';
      finalPrompt = `Usando o penteado da segunda imagem como principal referência visual, aplique um estilo semelhante na pessoa da primeira imagem. Use a seguinte descrição como guia adicional: ${promptFallback}.`;
    }

    content.push({
      type: 'input_text',
      text: `${finalPrompt}. Gere apenas a nova imagem, sem texto adicional.`,
    });

    try {
      const response = await client.responses.create({
        model: config.suggestionsModel,
        input: [
          {
            role: 'user',
            content,
          },
        ],
        tools: [
          {
            type: 'image_generation',
            model: (config.imageModel || 'gpt-image-1') as 'gpt-image-1',
            output_format: 'png',
            background: 'auto',
            input_fidelity: 'high',
          },
        ],
      });

      if (response.error) {
        const status = response.error.code === 'rate_limit_exceeded' ? 429 : 400;
        throw new HttpError(`Sua solicitação foi rejeitada: ${response.error.message}`, status);
      }

      const imageCall = findImageCall(response.output);
      if (imageCall?.result) {
        return `data:image/png;base64,${imageCall.result}`;
      }

      const textFallback = response.output_text?.trim();
      if (textFallback) {
        throw new HttpError(`A IA retornou uma mensagem em vez de uma imagem: "${textFallback}"`, 502);
      }

      throw new HttpError(
        'A IA não conseguiu gerar uma imagem. Tente ajustar a descrição ou utilizar outra imagem de referência.',
        502
      );
    } catch (error) {
      handleOpenAIError(error);
    }
  }

  return {
    name: 'OpenAI',
    generateSuggestions,
    generateHairstyle,
  };
}

function toDataURL(base64Data: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64Data}`;
}

function findImageCall(output: ResponseOutputItem[]): ResponseOutputItem.ImageGenerationCall | undefined {
  return output.find((item): item is ResponseOutputItem.ImageGenerationCall => item.type === 'image_generation_call');
}

function handleOpenAIError(error: unknown): never {
  if (error instanceof HttpError) {
    throw error;
  }

  if (error instanceof APIError) {
    const status = error.status ?? 502;

    if (status === 401 || status === 403) {
      throw new HttpError('Falha na autenticação com a OpenAI. Verifique a chave de API configurada.', status);
    }

    if (status === 429) {
      throw new HttpError('A OpenAI está limitando requisições no momento. Tente novamente em instantes.', status);
    }

    if (status >= 400 && status < 500) {
      throw new HttpError(error.message, status);
    }

    throw new HttpError('Erro ao gerar conteúdo com a OpenAI. Tente novamente mais tarde.', status);
  }

  if (error instanceof Error) {
    throw new HttpError(error.message, 502);
  }

  throw error;
}
