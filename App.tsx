import React, { useState, useRef, useCallback, useMemo } from 'react';
import { CameraFeed, CameraFeedRef } from './components/CameraFeed';
import { Controls } from './components/Controls';
import { Header } from './components/Header';
import { Spinner } from './components/Spinner';
import {
  editImageWithHairstyle,
  getHairstyleSuggestions,
  DEFAULT_LLM_OPTIONS,
} from './services/llmService';
import { CameraIcon, SparklesIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, ArrowDownTrayIcon, LightBulbIcon, XMarkIcon } from './components/Icons';

interface ReferenceImage {
  base64Data: string;
  mimeType: string;
  displayUrl: string;
}

const UNKNOWN_ERROR_MESSAGE = 'Ocorreu um erro desconhecido.';
const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e se o backend está em execução.';

const ENV_PROVIDER_OPTIONS = parseEnvList(import.meta.env?.VITE_LLM_PROVIDERS);
const KNOWN_PROVIDER_OPTIONS =
  ENV_PROVIDER_OPTIONS.length > 0 ? ENV_PROVIDER_OPTIONS : ['gemini'];
const KNOWN_GENERATION_MODELS: Record<string, string[]> = {
  gemini: ['gemini-2.5-flash-image-preview', 'gemini-2.5-flash'],
};
const KNOWN_SUGGESTION_MODELS: Record<string, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
};

function uniqueList(...values: Array<string | undefined>): string[] {
  const unique = new Set<string>();

  values.forEach((value) => {
    const trimmed = value?.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  });

  return Array.from(unique);
}

function parseEnvList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return uniqueList(
    ...value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function formatProviderLabel(value: string): string {
  if (!value) {
    return 'Padrão do servidor';
  }

  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    const message = error.message?.trim();
    return message || UNKNOWN_ERROR_MESSAGE;
  }

  return UNKNOWN_ERROR_MESSAGE;
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_LLM_OPTIONS.provider);
  const [selectedGenerationModel, setSelectedGenerationModel] = useState<string>(DEFAULT_LLM_OPTIONS.model);
  const [selectedSuggestionsModel, setSelectedSuggestionsModel] = useState<string>(
    DEFAULT_LLM_OPTIONS.suggestionsModel
  );

  const cameraRef = useRef<CameraFeedRef>(null);

  const providerOptions = useMemo(
    () => uniqueList(DEFAULT_LLM_OPTIONS.provider, selectedProvider, ...KNOWN_PROVIDER_OPTIONS),
    [selectedProvider]
  );
  const generationModelOptions = useMemo(() => {
    const known = KNOWN_GENERATION_MODELS[selectedProvider] ?? [];
    return uniqueList(DEFAULT_LLM_OPTIONS.model, selectedGenerationModel, ...known);
  }, [selectedProvider, selectedGenerationModel]);
  const suggestionsModelOptions = useMemo(() => {
    const known = KNOWN_SUGGESTION_MODELS[selectedProvider] ?? [];
    return uniqueList(
      DEFAULT_LLM_OPTIONS.suggestionsModel,
      DEFAULT_LLM_OPTIONS.model,
      selectedSuggestionsModel,
      ...known
    );
  }, [selectedProvider, selectedSuggestionsModel]);
  const providerDisplayName = useMemo(() => formatProviderLabel(selectedProvider), [selectedProvider]);
  const suggestionsModelLabel = selectedSuggestionsModel.trim() || 'padrão do servidor';
  const generationModelLabel = selectedGenerationModel.trim() || 'padrão do servidor';

  const handleSuggestHairstyles = useCallback(async () => {
    if (!cameraRef.current || isLoading || isSuggesting) return;

    setIsSuggesting(true);
    setError(null);
    setSuggestions(null);

    try {
      const frame = cameraRef.current.captureFrame();
      if (!frame) {
        throw new Error('Não foi possível capturar a imagem da câmera.');
      }
      const newSuggestions = await getHairstyleSuggestions(frame.base64Data, frame.mimeType, {
        provider: selectedProvider,
        suggestionsModel: selectedSuggestionsModel,
      });
      setSuggestions(newSuggestions);
    } catch (e) {
      const errorMessage = getFriendlyErrorMessage(e);
      console.error(e);
      setError(errorMessage);
    } finally {
      setIsSuggesting(false);
    }
  }, [isLoading, isSuggesting, selectedProvider, selectedSuggestionsModel]);

  const handleGenerateHairstyle = useCallback(async () => {
    if (!cameraRef.current || isLoading || isSuggesting) return;

    setIsLoading(true);
    setError(null);
    setResultText(null);

    try {
      const frame = cameraRef.current.captureFrame();
      if (!frame) {
        throw new Error('Não foi possível capturar a imagem da câmera.');
      }

      const { image: newImage, text: newText } = await editImageWithHairstyle(
        frame.base64Data,
        frame.mimeType,
        prompt,
        referenceImage ? { base64Data: referenceImage.base64Data, mimeType: referenceImage.mimeType } : null,
        {
          provider: selectedProvider,
          model: selectedGenerationModel,
        }
      );
      setResultImage(newImage);
      setResultText(newText);
    } catch (e) {
      const errorMessage = getFriendlyErrorMessage(e);
      console.error(e);
      setError(errorMessage);
      setResultImage(null);
      setResultText(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    prompt,
    isLoading,
    isSuggesting,
    referenceImage,
    selectedGenerationModel,
    selectedProvider,
  ]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const mimeType = result.substring(result.indexOf(':') + 1, result.indexOf(';'));
        const base64Data = result.split(',')[1];
        setReferenceImage({
            base64Data,
            mimeType,
            displayUrl: result
        });
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const handleRemoveReferenceImage = () => {
      setReferenceImage(null);
  };

  const handleTryAgain = () => {
    setResultImage(null);
    setResultText(null);
    setError(null);
    setPrompt('');
    setReferenceImage(null);
  };

  const handleSaveImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `penteado-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-sans">
      <Header />
      <main className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 mt-6">
        <div className="w-full aspect-square bg-gray-800 rounded-2xl shadow-2xl overflow-hidden relative flex items-center justify-center border-2 border-gray-700">
          {(isLoading || isSuggesting) && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
              <Spinner />
              <p className="mt-4 text-lg text-gray-300 animate-pulse">
                {isLoading ? 'A IA está criando seu novo visual...' : 'Buscando sugestões...'}
              </p>
              <p className="text-sm text-gray-400 mt-2">Isso pode levar alguns segundos.</p>
            </div>
          )}
          {!isCameraReady && !error && !isLoading && !isSuggesting && (
             <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-400">
                <CameraIcon className="w-16 h-16 mb-4" />
                <p className="text-lg">Aguardando permissão da câmera...</p>
             </div>
          )}
          
          <div className={`absolute inset-0 transition-opacity duration-500 ${resultImage ? 'opacity-100 z-10' : 'opacity-0'}`}>
             {resultImage && <img src={resultImage} alt="Resultado do penteado" className="w-full h-full object-cover" />}
          </div>
          
          <CameraFeed ref={cameraRef} onReady={() => setIsCameraReady(true)} onError={setError} />
        </div>

        {suggestions && !isSuggesting && !isLoading && !resultImage && (
          <div className="w-full bg-gray-800 border border-purple-500/50 p-4 rounded-2xl relative shadow-lg transition-all">
              <button
                  onClick={() => setSuggestions(null)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                  aria-label="Fechar sugestões"
              >
                  <XMarkIcon className="w-6 h-6" />
              </button>
              <h3 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-2">
                  <LightBulbIcon className="w-6 h-6" />
                  Sugestões da IA
              </h3>
              <div className="text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto pr-2 text-sm sm:text-base">{suggestions}</div>
          </div>
        )}

        {resultText && !isLoading && (
          <div className="w-full bg-gray-800 border border-purple-500/50 p-4 rounded-2xl relative shadow-lg transition-all">
            <h3 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-2">
              <SparklesIcon className="w-6 h-6" />
              Resposta da IA ({providerDisplayName})
            </h3>
            <div className="text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto pr-2 text-sm sm:text-base">
              {resultText}
            </div>
            {!resultImage && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleTryAgain}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-white transition-colors"
                >
                  <ArrowUturnLeftIcon className="w-4 h-4" />
                  Nova tentativa
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="w-full bg-red-900/50 text-red-300 border border-red-700 p-4 rounded-lg flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-bold">Oops! Algo deu errado.</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {resultImage && !isLoading && !error ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSaveImage}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-500/50"
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
              Salvar Imagem
            </button>
            <button
              onClick={handleTryAgain}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
            >
              <ArrowUturnLeftIcon className="w-6 h-6" />
              Experimentar Outro
            </button>
          </div>
        ) : (
          <Controls
            prompt={prompt}
            setPrompt={setPrompt}
            onSubmit={handleGenerateHairstyle}
            onSuggest={handleSuggestHairstyles}
            isLoading={isLoading || isSuggesting || !isCameraReady}
            buttonIcon={<SparklesIcon className="w-6 h-6" />}
            buttonText="Testar Penteado"
            onImageUpload={handleImageUpload}
            referenceImage={referenceImage?.displayUrl || null}
            onRemoveReferenceImage={handleRemoveReferenceImage}
            provider={selectedProvider}
            providerOptions={providerOptions}
            onProviderChange={setSelectedProvider}
            suggestionsModel={selectedSuggestionsModel}
            suggestionsModelOptions={suggestionsModelOptions}
            onSuggestionsModelChange={setSelectedSuggestionsModel}
            generationModel={selectedGenerationModel}
            generationModelOptions={generationModelOptions}
            onGenerationModelChange={setSelectedGenerationModel}
          />
        )}
      </main>
      <footer className="text-center text-gray-500 mt-8 text-sm">
          <p>
            Criado com React, Tailwind CSS e impulsionado por {providerDisplayName}. Modelos ativos: sugestões —{' '}
            <span className="text-gray-300">{suggestionsModelLabel}</span>; imagem —{' '}
            <span className="text-gray-300">{generationModelLabel}</span>.
          </p>
      </footer>
    </div>
  );
};

export default App;
