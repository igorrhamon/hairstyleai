import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';

import { HttpError } from '../http-error';
import { SUGGESTIONS_PROMPT } from '../prompts';
import type { ReferenceImagePayload } from '../types';

export type GeminiProviderConfig = {
  apiKey: string;
  suggestionsModel: string;
  imageModel: string;
};

export type GeminiProvider = {
  name: 'Gemini';
  generateSuggestions(base64Data: string, mimeType: string): Promise<string>;
  generateHairstyle(
    base64Data: string,
    mimeType: string,
    prompt: string,
    referenceImage: ReferenceImagePayload | null
  ): Promise<string>;
};

type GeminiContentPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

export function createGeminiProvider(config: GeminiProviderConfig): GeminiProvider {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

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
      model: config.suggestionsModel,
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
      model: config.imageModel,
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

  return {
    name: 'Gemini',
    generateSuggestions,
    generateHairstyle,
  };
}

function findImagePart(response: GenerateContentResponse): GeminiContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData) as
    | GeminiContentPart
    | undefined;
}

function findTextPart(response: GenerateContentResponse): GeminiContentPart | undefined {
  return response.candidates?.[0]?.content?.parts?.find((part) => part.text) as
    | GeminiContentPart
    | undefined;
}
