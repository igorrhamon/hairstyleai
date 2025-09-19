import React, { useRef } from 'react';
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
}

export const Controls: React.FC<ControlsProps> = ({ prompt, setPrompt, onSubmit, onSuggest, isLoading, buttonIcon, buttonText, onImageUpload, referenceImage, onRemoveReferenceImage }) => {
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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