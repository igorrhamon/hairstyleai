import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { Part } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function getHairstyleSuggestions(
    base64ImageData: string,
    mimeType: string
): Promise<string> {
    try {
        const userImagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
            },
        };

        const prompt = "Analise os traços faciais da pessoa nesta imagem (formato do rosto, testa, queixo, etc.). Com base nessa análise, sugira 3-4 estilos de penteado que a favoreceriam. Forneça uma breve justificativa (1-2 frases) para cada sugestão. Formate a resposta de forma clara e legível com títulos para cada estilo.";

        const textPart = {
            text: prompt,
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [userImagePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for suggestions:", error);
        throw new Error("Falha ao buscar sugestões da IA. Verifique o console para mais detalhes.");
    }
}

export async function editImageWithHairstyle(
    base64ImageData: string,
    mimeType: string,
    prompt: string,
    referenceImage: { base64Data: string; mimeType: string } | null
): Promise<string | null> {
    try {
        const userImagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
            },
        };

        const parts: Part[] = [userImagePart];
        let finalPrompt = `Aplique este estilo de cabelo na pessoa da imagem: ${prompt}`;

        if (referenceImage) {
            const referenceImagePart = {
                inlineData: {
                    data: referenceImage.base64Data,
                    mimeType: referenceImage.mimeType,
                },
            };
            parts.push(referenceImagePart);
            finalPrompt = `Usando o penteado da segunda imagem como principal referência visual, aplique um estilo semelhante na pessoa da primeira imagem. Use a seguinte descrição como guia adicional: ${prompt || 'o estilo da imagem de referência'}.`;
        }
        
        const textPart = {
            text: finalPrompt,
        };
        parts.push(textPart);

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: parts,
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        // Verifica se a requisição foi bloqueada por motivos de segurança.
        if (response.promptFeedback?.blockReason) {
            const { blockReason, blockReasonMessage } = response.promptFeedback;
            console.error(`Request blocked due to ${blockReason}. Message: ${blockReasonMessage}`);
            throw new Error(`Sua solicitação foi bloqueada: ${blockReasonMessage || blockReason}`);
        }

        const imagePartResponse = response.candidates?.[0]?.content?.parts?.find(
          (part: Part) => part.inlineData
        );
        
        if (imagePartResponse && imagePartResponse.inlineData) {
            const base64ImageBytes: string = imagePartResponse.inlineData.data;
            return `data:${imagePartResponse.inlineData.mimeType};base64,${base64ImageBytes}`;
        }

        // Se nenhuma imagem for encontrada, verifica se há uma resposta de texto para fornecer um erro melhor.
        const textPartResponse = response.candidates?.[0]?.content?.parts?.find(
            (part: Part) => part.text
        );

        if (textPartResponse && textPartResponse.text) {
            console.error("Gemini API returned a text response instead of an image:", textPartResponse.text);
            throw new Error(`A IA retornou uma mensagem em vez de uma imagem: "${textPartResponse.text}"`);
        }
        
        console.error("Gemini API response did not contain a usable image part.", JSON.stringify(response, null, 2));
        return null;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Re-lança o erro para que a mensagem específica (de bloqueio, etc.) seja exibida na UI.
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Falha ao comunicar com a API do Gemini. Verifique o console para mais detalhes.");
    }
}