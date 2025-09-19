import React, { useId, useRef } from 'react';
import { PhotoIcon, XCircleIcon, LightBulbIcon } from './Icons';

interface ControlsProps {
    prompt: string;
    setPrompt: (prompt: string) => void;
    onSubmit: () => void;
    onSuggest: () => void;
    isLoading: boolean;
    buttonIcon: React.ReactNode;
    buttonText: string;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    referenceImage: string | null;
    onRemoveReferenceImage: () => void;
    provider: string;
    providerOptions: string[];
    onProviderChange: (provider: string) => void;
    suggestionsModel: string;
    suggestionsModelOptions: string[];
    onSuggestionsModelChange: (model: string) => void;
    generationModel: string;
    generationModelOptions: string[];
    onGenerationModelChange: (model: string) => void;
}

export const Controls: React.FC<ControlsProps> = ({
    prompt,
    setPrompt,
    onSubmit,
    onSuggest,
    isLoading,
    buttonIcon,
    buttonText,
    onImageUpload,
    referenceImage,
    onRemoveReferenceImage,
    provider,
    providerOptions,
    onProviderChange,
    suggestionsModel,
    suggestionsModelOptions,
    onSuggestionsModelChange,
    generationModel,
    generationModelOptions,
    onGenerationModelChange,
}) => {

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uniqueId = useId().replace(/:/g, '');
    const generationDatalistId = `llm-generation-${uniqueId}`;
    const suggestionsDatalistId = `llm-suggestions-${uniqueId}`;
    const suggestionsModelLabel = suggestionsModel.trim() || 'padrão do servidor';
    const generationModelLabel = generationModel.trim() || 'padrão do servidor';

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isLoading && (prompt.trim() || referenceImage)) {
            onSubmit();
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="w-full bg-gray-800/70 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex flex-col gap-1 text-sm text-gray-300">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Provedor</span>
                        <select
                            value={provider}
                            onChange={(event) => onProviderChange(event.target.value)}
                            disabled={isLoading}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-70"
                        >
                            {providerOptions.map((option) => (
                                <option key={option} value={option}>
                                    {formatProviderLabel(option)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-300">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Modelo para sugestões</span>
                        <input
                            type="text"
                            value={suggestionsModel}
                            onChange={(event) => onSuggestionsModelChange(event.target.value)}
                            disabled={isLoading}
                            list={suggestionsModelOptions.length > 0 ? suggestionsDatalistId : undefined}
                            placeholder="Ex.: gemini-2.5-flash"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-70"
                        />
                        {suggestionsModelOptions.length > 0 && (
                            <datalist id={suggestionsDatalistId}>
                                {suggestionsModelOptions.map((option) => (
                                    <option key={option} value={option} />
                                ))}
                            </datalist>
                        )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-300">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Modelo para geração de imagem</span>
                        <input
                            type="text"
                            value={generationModel}
                            onChange={(event) => onGenerationModelChange(event.target.value)}
                            disabled={isLoading}
                            list={generationModelOptions.length > 0 ? generationDatalistId : undefined}
                            placeholder="Ex.: gemini-2.5-flash-image-preview"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-70"
                        />
                        {generationModelOptions.length > 0 && (
                            <datalist id={generationDatalistId}>
                                {generationModelOptions.map((option) => (
                                    <option key={option} value={option} />
                                ))}
                            </datalist>
                        )}
                    </label>
                </div>
                <p className="text-xs text-gray-400">
                    Usando <span className="text-gray-200">{formatProviderLabel(provider)}</span> com modelos
                    <span className="text-gray-200"> {suggestionsModelLabel}</span> (sugestões) e
                    <span className="text-gray-200"> {generationModelLabel}</span> (geração).
                </p>
            </div>
            <div className="w-full flex items-center gap-3">
                {referenceImage ? (
                    <div className="relative flex-shrink-0">
                        <img src={referenceImage} alt="Imagem de referência" className="w-14 h-14 rounded-lg object-cover border-2 border-purple-500" />
                        <button
                            onClick={onRemoveReferenceImage}
                            className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white hover:text-red-400 transition-colors"
                            aria-label="Remover imagem de referência"
                        >
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleUploadClick}
                        disabled={isLoading}
                        className="flex-shrink-0 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold p-4 rounded-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 h-14 w-14"
                        aria-label="Carregar imagem de referência"
                    >
                        <PhotoIcon className="w-6 h-6" />
                    </button>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onImageUpload}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    disabled={isLoading}
                />
                
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Envie uma foto ou descreva um estilo"
                    className="w-full flex-grow bg-gray-700 border-2 border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-base h-14"
                    disabled={isLoading}
                />
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-5 gap-3">
                <button
                    onClick={onSuggest}
                    disabled={isLoading}
                    className="sm:col-span-2 w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                >
                    <LightBulbIcon className="w-6 h-6" />
                    Sugerir
                </button>
                <button
                    onClick={onSubmit}
                    disabled={isLoading || (!prompt.trim() && !referenceImage)}
                    className="sm:col-span-3 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
                >
                    {buttonIcon}
                    {buttonText}
                </button>
            </div>
        </div>
    );
};

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